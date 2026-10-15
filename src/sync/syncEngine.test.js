import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enqueueMutation,
  getPendingMutations,
  removeMutations,
  clearOutbox,
} from './outbox.js'
import {
  pushOutbox,
  deltaPull,
  sync,
  getSyncStatus,
  subscribeSyncStatus,
} from './syncEngine.js'

test('Outbox enqueues, lists chronologically, and removes mutations', async () => {
  await clearOutbox()

  const m1 = await enqueueMutation({
    table: 'expenses',
    id: 'exp_1',
    op: 'upsert',
    payload: { id: 'exp_1', amount: 500, category: 'Food', date: '2026-10-15' },
  })

  const m2 = await enqueueMutation({
    table: 'transfers',
    id: 'tr_1',
    op: 'upsert',
    payload: { id: 'tr_1', fromAccountId: 'a1', toAccountId: 'a2', amount: 1000, date: '2026-10-15' },
  })

  const pending = await getPendingMutations()
  assert.equal(pending.length, 2)
  assert.equal(pending[0].table, 'expenses')
  assert.equal(pending[1].table, 'transfers')

  await removeMutations([m1.outboxId])
  const remaining = await getPendingMutations()
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].id, 'tr_1')

  await clearOutbox()
})

test('pushOutbox batches upserts and clears outbox with fake Supabase client', async () => {
  await clearOutbox()

  await enqueueMutation({
    table: 'expenses',
    id: 'exp_100',
    op: 'upsert',
    payload: { id: 'exp_100', amount: 350, category: 'Coffee', date: '2026-10-15', note: 'Latte' },
  })

  let upsertCalled = false
  let upsertedTable = null
  let upsertedRows = null

  const fakeSupabase = {
    from(table) {
      upsertedTable = table
      return {
        upsert(rows) {
          upsertCalled = true
          upsertedRows = rows
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  const result = await pushOutbox(fakeSupabase, 'user_123')
  assert.equal(result.success, true)
  assert.equal(upsertCalled, true)
  assert.equal(upsertedTable, 'expenses')
  assert.equal(upsertedRows.length, 1)
  assert.equal(upsertedRows[0].id, 'exp_100')
  assert.equal(upsertedRows[0].user_id, 'user_123')
  assert.equal(upsertedRows[0].amount, 350)
  assert.equal(upsertedRows[0].deleted_at, null)

  const pending = await getPendingMutations()
  assert.equal(pending.length, 0)
  assert.equal(getSyncStatus().state, 'synced')
})

test('pushOutbox formats delete operations as tombstones', async () => {
  await clearOutbox()

  await enqueueMutation({
    table: 'accounts',
    id: 'acc_old',
    op: 'delete',
  })

  let capturedRows = null
  const fakeSupabase = {
    from() {
      return {
        upsert(rows) {
          capturedRows = rows
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  await pushOutbox(fakeSupabase, 'user_123')
  assert.ok(capturedRows)
  assert.equal(capturedRows.length, 1)
  assert.equal(capturedRows[0].id, 'acc_old')
  assert.equal(capturedRows[0].user_id, 'user_123')
  assert.ok(capturedRows[0].deleted_at)
})

test('deltaPull applies remote changes and tombstones', async () => {
  const remoteRows = [
    {
      id: 'exp_remote_1',
      user_id: 'user_456',
      amount: 1200,
      category: 'Electronics',
      date: '2026-10-10',
      note: 'Cable',
      updated_at: '2026-10-15T12:00:00Z',
      deleted_at: null,
    },
    {
      id: 'exp_remote_2',
      user_id: 'user_456',
      amount: 400,
      category: 'Dining',
      date: '2026-10-11',
      updated_at: '2026-10-15T12:05:00Z',
      deleted_at: '2026-10-15T12:05:00Z',
    },
  ]

  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                gt() {
                  return {
                    order() {
                      if (table === 'expenses') {
                        return Promise.resolve({ data: remoteRows, error: null })
                      }
                      return Promise.resolve({ data: [], error: null })
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  const dispatched = []
  const result = await deltaPull(fakeSupabase, 'user_456', (change) => {
    dispatched.push(change)
  })

  assert.equal(result.success, true)
  assert.equal(dispatched.length, 2)

  // First row: active upsert
  assert.equal(dispatched[0].table, 'expenses')
  assert.equal(dispatched[0].id, 'exp_remote_1')
  assert.equal(dispatched[0].isDeleted, false)
  assert.equal(dispatched[0].record.amount, 1200)

  // Second row: soft-delete tombstone
  assert.equal(dispatched[1].id, 'exp_remote_2')
  assert.equal(dispatched[1].isDeleted, true)
  assert.equal(dispatched[1].record, null)
})

test('pushOutbox transitions status to error and retains outbox on failure', async () => {
  await clearOutbox()

  await enqueueMutation({
    table: 'expenses',
    id: 'exp_fail',
    op: 'upsert',
    payload: { id: 'exp_fail', amount: 100, category: 'Food', date: '2026-10-15' },
  })

  const failingSupabase = {
    from() {
      return {
        upsert() {
          return Promise.resolve({ error: new Error('Network timeout') })
        },
      }
    },
  }

  const result = await pushOutbox(failingSupabase, 'user_fail')
  assert.equal(result.success, false)

  const status = getSyncStatus()
  assert.equal(status.state, 'error')
  assert.equal(status.errorMessage, 'Network timeout')

  const pending = await getPendingMutations()
  assert.equal(pending.length, 1)

  await clearOutbox()
})

