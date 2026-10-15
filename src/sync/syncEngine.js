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
 * - Deletes are performed via update({ deleted_at }) rather than upsert,
 *   avoiding PostgreSQL 23502 (NOT NULL constraint) failures.
 * - Upserts are performed via upsert with primary key conflict targets.
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

      const upserts = []
      const deletes = []

      for (const m of tableMutations) {
        if (m.op === 'delete') {
          deletes.push(m)
        } else if (m.op === 'upsert' && m.payload) {
          const row = config.toRow(m.payload, userId)
          row.deleted_at = null
          upserts.push({ outboxId: m.outboxId, row })
        }
      }

      // 1. Process Upserts
      if (upserts.length > 0) {
        const rows = upserts.map((u) => u.row)
        const { error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: config.primaryKey })

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            console.warn(`Table "${table}" not found in Supabase schema cache. Run migration_v4_sync.sql to create it.`)
            continue // Keep in outbox, continue with other tables
          }
          throw error
        }
        successfullyPushedIds.push(...upserts.map((u) => u.outboxId))
      }

      // 2. Process Deletes via UPDATE (setting deleted_at timestamp)
      if (deletes.length > 0) {
        const nowIso = new Date().toISOString()
        for (const del of deletes) {
          let query = supabase.from(table).update({ deleted_at: nowIso }).eq('user_id', userId)

          if (config.primaryKey === 'user_id,month') {
            query = query.eq('month', del.id)
          } else {
            query = query.eq(config.primaryKey, del.id)
          }

          const { error } = await query
          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
              console.warn(`Table "${table}" not found in Supabase schema cache.`)
              continue
            }
            throw error
          }
          successfullyPushedIds.push(del.outboxId)
        }
      }
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

const PAGE_SIZE = 1000

/**
 * Fetch remote changes that occurred after the local cursor with pagination and local conflict prevention.
 */
export async function deltaPull(supabase, userId, onRemoteChanges) {
  if (!supabase || !userId) return { success: false, reason: 'unauthenticated' }

  try {
    updateStatus({ state: 'syncing' })
    const lastPulledAt = (await idbGet(META_STORE, `${CURSOR_KEY}_${userId}`)) || '1970-01-01T00:00:00Z'
    let newestTimestamp = lastPulledAt

    // Check currently pending mutations to avoid clobbering unpushed local changes
    const pendingMutations = await getPendingMutations()
    const pendingKeys = new Set(pendingMutations.map((m) => `${m.table}::${m.id}`))

    for (const [table, config] of Object.entries(TABLE_CONFIGS)) {
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: rows, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastPulledAt)
          .order('updated_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            console.warn(`Table "${table}" not found in Supabase schema cache. Run migration_v4_sync.sql to create it.`)
            break
          }
          throw error
        }

        if (!rows || !rows.length) {
          hasMore = false
          break
        }

        for (const row of rows) {
          if (row.updated_at && row.updated_at > newestTimestamp) {
            newestTimestamp = row.updated_at
          }

          const id = config.primaryKey === 'user_id,month' ? row.month : row[config.primaryKey]

          // Conflict guard: If the user modified or deleted this record locally and it hasn't pushed yet,
          // do NOT let the older or concurrent remote state overwrite the local outbox intent.
          if (pendingKeys.has(`${table}::${id}`)) {
            continue
          }

          const isDeleted = Boolean(row.deleted_at)
          const clientRecord = isDeleted ? null : config.toClient(row)

          if (typeof onRemoteChanges === 'function') {
            onRemoteChanges({ table, id, record: clientRecord, isDeleted })
          }
        }

        if (rows.length < PAGE_SIZE) {
          hasMore = false
        } else {
          offset += PAGE_SIZE
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
 * One-time backfill helper: if user logs in and per-row normalized tables are empty,
 * backfill all data from the loaded dataset / legacy blob into the per-row tables.
 */
export async function backfillNormalizedTables(supabase, userId, currentData) {
  if (!supabase || !userId || !currentData) return { backfilled: false }

  const BACKFILL_FLAG_KEY = `pennywise_backfilled_${userId}`
  const alreadyBackfilled = await idbGet(META_STORE, BACKFILL_FLAG_KEY)
  if (alreadyBackfilled) return { backfilled: false }

  try {
    // Check if per-row expenses table already has records
    const { count, error } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { backfilled: false }
      }
      throw error
    }

    if (count != null && count > 0) {
      // Already has normalized records in DB
      await idbSet(META_STORE, BACKFILL_FLAG_KEY, true)
      return { backfilled: false }
    }

    // Per-row tables are empty; backfill from currentData
    console.info('Backfilling normalized per-row tables from existing dataset...')

    // 1. Accounts
    if (Array.isArray(currentData.accounts) && currentData.accounts.length) {
      const rows = currentData.accounts.map((a) => TABLE_CONFIGS.accounts.toRow(a, userId))
      await supabase.from('accounts').upsert(rows, { onConflict: 'id' })
    }

    // 2. Expenses
    if (Array.isArray(currentData.expenses) && currentData.expenses.length) {
      const rows = currentData.expenses.map((e) => TABLE_CONFIGS.expenses.toRow(e, userId))
      // Batch in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('expenses').upsert(rows.slice(i, i + 500), { onConflict: 'id' })
      }
    }

    // 3. Transfers
    if (Array.isArray(currentData.transfers) && currentData.transfers.length) {
      const rows = currentData.transfers.map((t) => TABLE_CONFIGS.transfers.toRow(t, userId))
      await supabase.from('transfers').upsert(rows, { onConflict: 'id' })
    }

    // 4. Recurring schedules
    if (Array.isArray(currentData.recurringExpenses) && currentData.recurringExpenses.length) {
      const rows = currentData.recurringExpenses.map((r) => TABLE_CONFIGS.recurring_schedules.toRow(r, userId))
      await supabase.from('recurring_schedules').upsert(rows, { onConflict: 'id' })
    }

    // 5. Incomes
    if (currentData.income && typeof currentData.income === 'object') {
      const rows = Object.entries(currentData.income).map(([month, amount]) =>
        TABLE_CONFIGS.incomes.toRow({
          month,
          amount,
          accountId: currentData.incomeAccounts?.[month] || null,
        }, userId)
      )
      if (rows.length) {
        await supabase.from('incomes').upsert(rows, { onConflict: 'user_id,month' })
      }
    }

    // 6. Budgets
    if (currentData.budgets && typeof currentData.budgets === 'object') {
      const rows = Object.entries(currentData.budgets).map(([month, amount]) =>
        TABLE_CONFIGS.budgets.toRow({ month, amount }, userId)
      )
      if (rows.length) {
        await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,month' })
      }
    }

    // 7. Category Budgets
    if (currentData.categoryBudgets && typeof currentData.categoryBudgets === 'object') {
      const rows = []
      for (const [month, catMap] of Object.entries(currentData.categoryBudgets)) {
        if (!catMap || typeof catMap !== 'object') continue
        for (const [category, amount] of Object.entries(catMap)) {
          rows.push(
            TABLE_CONFIGS.category_budgets.toRow({
              id: `${month}_${category}`,
              month,
              category,
              amount,
            }, userId)
          )
        }
      }
      if (rows.length) {
        await supabase.from('category_budgets').upsert(rows, { onConflict: 'id' })
      }
    }

    await idbSet(META_STORE, BACKFILL_FLAG_KEY, true)
    console.info('Normalized per-row table backfill complete.')
    return { backfilled: true }
  } catch (err) {
    console.warn('Backfill to normalized tables encountered an error:', err)
    return { backfilled: false, error: err }
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

