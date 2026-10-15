import { idbGet, idbSet, idbDelete, idbGetAll, idbClear } from './idb.js'

const OUTBOX_STORE = 'outbox_store'

/**
 * Generate a unique outbox entry ID.
 */
function makeOutboxId(table, id, op) {
  return `${table}::${id}::${op}::${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Enqueue a mutation in the persistent outbox.
 * If there is already an existing pending mutation for the same table and record ID,
 * we can intelligently coalesce them:
 * - If new op is 'delete', any prior pending 'upsert' for the same ID can be superseded.
 */
export async function enqueueMutation({ table, id, op, payload }) {
  const entry = {
    outboxId: makeOutboxId(table, id, op),
    table,
    id: String(id),
    op, // 'upsert' | 'delete'
    payload: payload || null,
    timestamp: new Date().toISOString(),
  }

  await idbSet(OUTBOX_STORE, entry.outboxId, entry)
  return entry
}

/**
 * Get all pending mutations, sorted chronologically.
 */
export async function getPendingMutations() {
  const all = await idbGetAll(OUTBOX_STORE)
  return all.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
}

/**
 * Remove successfully pushed mutations from outbox.
 */
export async function removeMutations(outboxIds) {
  if (!Array.isArray(outboxIds) || !outboxIds.length) return
  await Promise.all(outboxIds.map((oid) => idbDelete(OUTBOX_STORE, oid)))
}

/**
 * Clear the entire outbox.
 */
export async function clearOutbox() {
  await idbClear(OUTBOX_STORE)
}

