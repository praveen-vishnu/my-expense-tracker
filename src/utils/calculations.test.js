import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryTotals, monthSummary } from './calculations.js'

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

