import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeData, emptyData, defaultStarterAccounts } from './storage.js'

test('normalizeData returns emptyData for null, undefined or non-object input', () => {
  const defaults = emptyData()
  assert.deepEqual(normalizeData(null), defaults)
  assert.deepEqual(normalizeData(undefined), defaults)
  assert.deepEqual(normalizeData('random string'), defaults)
  assert.deepEqual(normalizeData(123), defaults)
})

test('normalizeData preserves valid accounts and ensures at least one default account', () => {
  const result = normalizeData({
    accounts: [
      { id: 'acc_1', name: 'HDFC Bank', type: 'bank', initialBalance: 5000, isDefault: false },
      { id: 'acc_2', name: 'ICICI CC', type: 'credit_card', initialBalance: 0, creditLimit: 100000, billingDay: 15, dueDay: 5, isDefault: false },
    ],
  })

  assert.equal(result.accounts.length, 2)
  // Because none were marked isDefault: true, the first should be made default
  assert.equal(result.accounts[0].isDefault, true)
  assert.equal(result.accounts[1].type, 'credit_card')
  assert.equal(result.accounts[1].creditLimit, 100000)
  assert.equal(result.accounts[1].billingDay, 15)
  assert.equal(result.accounts[1].dueDay, 5)
})

test('normalizeData falls back to default starter accounts if accounts array is corrupted', () => {
  const result = normalizeData({
    accounts: [{ invalid: true }, null, { id: '', name: '  ' }],
  })

  assert.deepEqual(result.accounts, defaultStarterAccounts())
})

test('normalizeData sanitizes expenses, strips invalid dates, and validates split objects', () => {
  const result = normalizeData({
    expenses: [
      // Valid expense with split
      {
        id: 'exp_1',
        amount: 1500,
        category: 'Dining',
        date: '2026-10-12',
        note: 'Team dinner',
        accountId: 'acc_bank',
        split: {
          myShare: 500,
          owedAmount: 1000,
          owedBy: 'Alex',
          settled: false,
        },
      },
      // Valid minimal expense
      {
        id: 'exp_2',
        amount: 250,
        category: 'Groceries',
        date: '2026-10-14',
      },
      // Invalid expense (amount <= 0)
      { id: 'exp_bad_1', amount: 0, category: 'Test', date: '2026-10-14' },
      // Invalid expense (invalid date)
      { id: 'exp_bad_2', amount: 100, category: 'Test', date: 'not-a-date' },
      // Invalid expense (missing category)
      { id: 'exp_bad_3', amount: 100, category: '   ', date: '2026-10-14' },
    ],
  })

  assert.equal(result.expenses.length, 2)
  assert.equal(result.expenses[0].id, 'exp_1')
  assert.equal(result.expenses[0].split.myShare, 500)
  assert.equal(result.expenses[0].split.owedAmount, 1000)
  assert.equal(result.expenses[0].split.owedBy, 'Alex')
  assert.equal(result.expenses[0].split.settled, false)

  assert.equal(result.expenses[1].id, 'exp_2')
  assert.equal(result.expenses[1].note, '')
})

test('normalizeData normalizes transfers, removing incomplete or zero-amount transfers', () => {
  const result = normalizeData({
    transfers: [
      {
        id: 'tr_1',
        fromAccountId: 'acc_bank',
        toAccountId: 'acc_cc',
        amount: 5000,
        date: '2026-10-05',
        note: 'Credit card bill',
      },
      // Missing toAccountId
      { id: 'tr_2', fromAccountId: 'acc_bank', amount: 200, date: '2026-10-05' },
      // Zero amount
      { id: 'tr_3', fromAccountId: 'acc_bank', toAccountId: 'acc_cash', amount: 0, date: '2026-10-05' },
    ],
  })

  assert.equal(result.transfers.length, 1)
  assert.equal(result.transfers[0].id, 'tr_1')
  assert.equal(result.transfers[0].amount, 5000)
})

test('normalizeData validates monthly maps for income, budgets, categoryBudgets, and incomeAccounts', () => {
  const result = normalizeData({
    income: { '2026-10': 75000, 'invalid-key': 5000 },
    incomeAccounts: { '2026-10': 'acc_bank', 'bad-month': 'acc_cash' },
    budgets: { '2026-10': 40000 },
    categoryBudgets: {
      '2026-10': { Food: 15000, Travel: 5000, InvalidZero: 0 },
      'bad-month': { Food: 10000 },
    },
    categories: ['Food', 'Travel', 'Food', '  Shopping  '],
  })

  assert.deepEqual(result.income, { '2026-10': 75000 })
  assert.deepEqual(result.incomeAccounts, { '2026-10': 'acc_bank' })
  assert.deepEqual(result.budgets, { '2026-10': 40000 })
  assert.deepEqual(result.categoryBudgets, { '2026-10': { Food: 15000, Travel: 5000 } })
  assert.deepEqual(result.categories, ['Food', 'Travel', 'Shopping'])
})

