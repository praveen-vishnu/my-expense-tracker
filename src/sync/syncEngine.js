import { idbGet, idbSet } from './idb.js'
import { getPendingMutations, removeMutations, enqueueMutation } from './outbox.js'
import { TABLE_CONFIGS } from './mappers.js'

const META_STORE = 'meta_store'
const CURSOR_KEY = 'pennywise_last_pulled_at'

let currentStatus = {
  state: 'synced', // 'synced' | 'syncing' | 'pending' | 'error'
  pendingCount: 0,
  lastSyncTime: null,
  errorMessage: null,
}

const listeners = new Set()

export function getSyncStatus() {
  return { ...currentStatus }
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener)
  listener(getSyncStatus())
  return () => listeners.delete(listener)
}

function updateStatus(partial) {
  currentStatus = { ...currentStatus, ...partial }
  listeners.forEach((listener) => {
    try {
      listener(getSyncStatus())
    } catch (err) {
      console.error('Error in sync status listener:', err)
    }
  })
}

/**
 * Push all pending mutations from outbox to Supabase.
 */
export async function pushOutbox(supabase, userId) {
  if (!supabase || !userId) return { success: false, reason: 'unauthenticated' }

  const mutations = await getPendingMutations()
  if (!mutations.length) {
    updateStatus({ state: 'synced', pendingCount: 0, errorMessage: null })
    return { success: true, pushedCount: 0 }
  }

  updateStatus({ state: 'syncing', pendingCount: mutations.length })

  // Group mutations by table
  const byTable = new Map()
  for (const m of mutations) {
    if (!byTable.has(m.table)) byTable.set(m.table, [])
    byTable.get(m.table).push(m)
  }

  const successfullyPushedIds = []

  try {
    for (const [table, tableMutations] of byTable.entries()) {
      const config = TABLE_CONFIGS[table]
      if (!config) continue

      const rowsToUpsert = []
      for (const m of tableMutations) {
        if (m.op === 'delete') {
          // Construct primary key delete tombstone
          const tombstone = {
            deleted_at: new Date().toISOString(),
            user_id: userId,
          }
          if (config.primaryKey === 'user_id,month') {
            tombstone.month = m.id
          } else {
            tombstone[config.primaryKey] = m.id
          }
          rowsToUpsert.push(tombstone)
        } else if (m.op === 'upsert' && m.payload) {
          const row = config.toRow(m.payload, userId)
          row.deleted_at = null
          rowsToUpsert.push(row)
        }
      }

      if (rowsToUpsert.length > 0) {
        const { error } = await supabase
          .from(table)
          .upsert(rowsToUpsert, { onConflict: config.primaryKey })

        if (error) throw error
      }

      successfullyPushedIds.push(...tableMutations.map((m) => m.outboxId))
    }

    await removeMutations(successfullyPushedIds)
    const remaining = await getPendingMutations()

    updateStatus({
      state: remaining.length > 0 ? 'pending' : 'synced',
      pendingCount: remaining.length,
      lastSyncTime: new Date().toISOString(),
      errorMessage: null,
    })

    return { success: true, pushedCount: successfullyPushedIds.length }
  } catch (error) {
    console.error('Failed to push outbox changes:', error)
    const remaining = await getPendingMutations()
    updateStatus({
      state: 'error',
      pendingCount: remaining.length,
      errorMessage: error.message || 'Sync push failed',
    })
    return { success: false, error }
  }
}

/**
 * Fetch remote changes that occurred after the local cursor.
 */
export async function deltaPull(supabase, userId, onRemoteChanges) {
  if (!supabase || !userId) return { success: false, reason: 'unauthenticated' }

  try {
    updateStatus({ state: 'syncing' })
    const lastPulledAt = (await idbGet(META_STORE, `${CURSOR_KEY}_${userId}`)) || '1970-01-01T00:00:00Z'
    let newestTimestamp = lastPulledAt

    for (const [table, config] of Object.entries(TABLE_CONFIGS)) {
      const { data: rows, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastPulledAt)
        .order('updated_at', { ascending: true })

      if (error) throw error
      if (!rows || !rows.length) continue

      for (const row of rows) {
        if (row.updated_at && row.updated_at > newestTimestamp) {
          newestTimestamp = row.updated_at
        }

        const isDeleted = Boolean(row.deleted_at)
        const clientRecord = isDeleted ? null : config.toClient(row)
        const id = config.primaryKey === 'user_id,month' ? row.month : row[config.primaryKey]

        if (typeof onRemoteChanges === 'function') {
          onRemoteChanges({ table, id, record: clientRecord, isDeleted })
        }
      }
    }

    await idbSet(META_STORE, `${CURSOR_KEY}_${userId}`, newestTimestamp)
    const remaining = await getPendingMutations()

    updateStatus({
      state: remaining.length > 0 ? 'pending' : 'synced',
      pendingCount: remaining.length,
      lastSyncTime: new Date().toISOString(),
      errorMessage: null,
    })

    return { success: true, cursor: newestTimestamp }
  } catch (error) {
    console.error('Delta pull failed:', error)
    const remaining = await getPendingMutations()
    updateStatus({
      state: 'error',
      pendingCount: remaining.length,
      errorMessage: error.message || 'Delta sync pull failed',
    })
    return { success: false, error }
  }
}

/**
 * Run a full bi-directional sync cycle (pull remote deltas then push local mutations).
 */
export async function sync(supabase, userId, onRemoteChanges) {
  const pullResult = await deltaPull(supabase, userId, onRemoteChanges)
  if (!pullResult.success) return pullResult
  return pushOutbox(supabase, userId)
}

/**
 * Initialize automatic triggers: window focus, reconnection, and visibility change.
 */
export function initAutoSync(getSupabase, getUserId, onRemoteChanges) {
  if (typeof window === 'undefined') return () => {}

  let timeoutId = null
  const scheduleSync = (delay = 300) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(async () => {
      const supabase = getSupabase()
      const userId = getUserId()
      if (supabase && userId) {
        await sync(supabase, userId, onRemoteChanges)
      }
    }, delay)
  }

  const onFocus = () => scheduleSync(100)
  const onOnline = () => scheduleSync(100)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      scheduleSync(100)
    } else if (document.visibilityState === 'hidden') {
      // Flush pending changes before the tab goes to sleep
      const supabase = getSupabase()
      const userId = getUserId()
      if (supabase && userId) {
        pushOutbox(supabase, userId)
      }
    }
  }

  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    if (timeoutId) clearTimeout(timeoutId)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

