import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryTotals, monthSummary, calculateAccountBalances } from './calculations.js'

test('categoryTotals keeps top spending categories sorted by amount', () => {
  const totals = categoryTotals([
    { category: 'Food', amount: 250 },
    { category: 'Rent', amount: 500 },
    { category: 'Food', amount: 110 },
    { category: 'Travel', amount: 80 },
  ])

  assert.deepEqual(totals, [
    { category: 'Rent', total: 500 },
    { category: 'Food', total: 360 },
    { category: 'Travel', total: 80 },
  ])
})

test('monthSummary exposes chart-ready category totals for the selected month', () => {
  const summary = monthSummary(
    {
      income: { '2026-09': 3500 },
      expenses: [
        { date: '2026-09-02', category: 'Food', amount: 200 },
        { date: '2026-09-03', category: 'Food', amount: 150 },
        { date: '2026-09-05', category: 'Travel', amount: 100 },
      ],
      budgets: { '2026-09': 3000 },
    },
    '2026-09',
    new Date('2026-09-15T12:00:00Z'),
  )

  assert.equal(summary.spent, 450)
  assert.deepEqual(summary.categories, [
    { category: 'Food', total: 350 },
    { category: 'Travel', total: 100 },
  ])
})

test('monthSummary computes projected spend, daily pace, and burn rate status correctly', () => {
  const summary = monthSummary(
    {
      income: { '2026-09': 100000 },
      expenses: [
        { date: '2026-09-05', category: 'Food', amount: 3000 },
        { date: '2026-09-10', category: 'Shopping', amount: 4500 },
      ],
      budgets: { '2026-09': 15000 },
    },
    '2026-09',
    new Date('2026-09-15T12:00:00Z'),
  )

  // September has 30 days. Elapsed = 15 days. Remaining = 15 days.
  assert.equal(summary.spent, 7500)
  assert.equal(summary.elapsedDays, 15)
  assert.equal(summary.remainingDays, 15)
  assert.equal(summary.averageDaily, 500) // 7500 / 15
  assert.equal(summary.projectedSpend, 15000) // 500 * 30
  assert.equal(summary.safeDailySpend, 500) // (15000 - 7500) / 15
  assert.equal(summary.burnRateStatus, 'on-track')
})

test('calculateAccountBalances computes liquid net worth and credit card outstanding balances correctly', () => {
  const accounts = [
    { id: 'acc_bank', name: 'HDFC', type: 'bank', initialBalance: 50000, isDefault: true },
    { id: 'acc_cc', name: 'ICICI CC', type: 'credit_card', initialBalance: 0, creditLimit: 100000 },
    { id: 'acc_cash', name: 'Cash', type: 'cash', initialBalance: 5000 },
  ]

  const expenses = [
    { id: '1', amount: 10000, category: 'Rent', date: '2026-09-01', accountId: 'acc_bank' },
    { id: '2', amount: 15000, category: 'Shopping', date: '2026-09-02', accountId: 'acc_cc' },
    { id: '3', amount: 1000, category: 'Food', date: '2026-09-03', accountId: 'acc_cash' },
    { id: '4', amount: 500, category: 'Other', date: '2026-09-04' }, // unassigned
  ]

  const result = calculateAccountBalances(accounts, expenses)

  assert.equal(result.totalLiquid, 44000) // (50000 - 10000) + (5000 - 1000) = 40000 + 4000 = 44000
  assert.equal(result.totalCreditOutstanding, 15000)
  assert.equal(result.netWorth, 29000) // 44000 - 15000
  assert.equal(result.unassignedSpent, 500)

  const cc = result.accounts.find((a) => a.id === 'acc_cc')
  assert.equal(cc.outstanding, 15000)
  assert.equal(cc.availableCredit, 85000)
})

