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
