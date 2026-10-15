import { idbGet, idbSet, idbDelete, idbGetAll, idbClear } from './idb.js'

const OUTBOX_STORE = 'outbox_store'
const META_STORE = 'meta_store'
const SEQ_KEY = 'pennywise_outbox_seq'

let memSeq = 0

async function getNextSeq() {
  if (!memSeq) {
    memSeq = (await idbGet(META_STORE, SEQ_KEY)) || 0
  }
  memSeq += 1
  await idbSet(META_STORE, SEQ_KEY, memSeq)
  return memSeq
}

/**
 * Key to coalesce mutations per entity
 */
function makeEntityKey(table, id) {
  return `${table}::${id}`
}

/**
 * Enqueue a mutation in the persistent outbox with coalescing and monotonic sequence ordering.
 */
export async function enqueueMutation({ table, id, op, payload }) {
  const entityKey = makeEntityKey(table, id)
  const seq = await getNextSeq()

  const entry = {
    outboxId: entityKey,
    seq,
    table,
    id: String(id),
    op, // 'upsert' | 'delete'
    payload: op === 'delete' ? null : (payload || null),
    timestamp: new Date().toISOString(),
  }

  // Coalesce: replaces any unpushed mutation for the same (table, id)
  await idbSet(OUTBOX_STORE, entityKey, entry)
  return entry
}

/**
 * Get all pending mutations, strictly sorted by monotonic sequence.
 */
export async function getPendingMutations() {
  const all = await idbGetAll(OUTBOX_STORE)
  return all.sort((a, b) => (a.seq || 0) - (b.seq || 0))
}

/**
 * Remove successfully pushed mutations by their IDs.
 */
export async function removeMutations(outboxIds) {
  if (!Array.isArray(outboxIds) || !outboxIds.length) return
  for (const id of outboxIds) {
    await idbDelete(OUTBOX_STORE, id)
  }
}

/**
 * Clear the entire outbox store.
 */
export async function clearOutbox() {
  await idbClear(OUTBOX_STORE)
  memSeq = 0
  await idbSet(META_STORE, SEQ_KEY, 0)
}
