import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryTotals, monthSummary, calculateAccountBalances, calculateFinancialHealth } from './calculations.js'

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

test('calculateFinancialHealth evaluates savings rate, MoM delta, category drift and score', () => {
  const current = {
    monthKey: '2026-10',
    income: 80000,
    budget: 50000,
    spent: 40000,
    budgetRemaining: 10000,
    burnRateStatus: 'on-track',
    categories: [
      { category: 'Food', total: 15000 },
      { category: 'Rent', total: 20000 },
      { category: 'Shopping', total: 5000 },
    ],
  }

  const previous = {
    monthKey: '2026-09',
    income: 75000,
    budget: 50000,
    spent: 48000,
    categories: [
      { category: 'Food', total: 12000 },
      { category: 'Rent', total: 20000 },
      { category: 'Shopping', total: 16000 },
    ],
  }

  const health = calculateFinancialHealth(current, previous)

  // Savings rate: (80000 - 40000) / 80000 = 50%
  assert.equal(health.savingsRate, 50)

  // MoM spend delta: 40000 - 48000 = -8000 (-16.67%)
  assert.equal(health.spendDelta, -8000)
  assert.ok(health.spendDeltaPercent < 0)

  // Category drift
  const shoppingDrift = health.categoryDrift.find((c) => c.category === 'Shopping')
  assert.equal(shoppingDrift.diff, -11000) // 5000 - 16000 = -11000
  assert.equal(shoppingDrift.direction, 'down')

  const foodDrift = health.categoryDrift.find((c) => c.category === 'Food')
  assert.equal(foodDrift.diff, 3000) // 15000 - 12000 = +3000
  assert.equal(foodDrift.direction, 'up')

  // Score & Grade
  assert.ok(health.score >= 80)
  assert.ok(['A+', 'A'].includes(health.grade))
  assert.ok(health.insights.length >= 2)
})

test('monthSummary calculates category budget consumption, remaining, and alert statuses', () => {
  const data = {
    income: { '2026-10': 50000 },
    budgets: { '2026-10': 30000 },
    categoryBudgets: {
      '2026-10': {
        Food: 5000,
        Groceries: 4000,
        Shopping: 2000,
      },
    },
    expenses: [
      { date: '2026-10-02', category: 'Food', amount: 5500 }, // 110% -> exceeded
      { date: '2026-10-03', category: 'Groceries', amount: 3600 }, // 90% -> warning
      { date: '2026-10-04', category: 'Shopping', amount: 800 }, // 40% -> on-track
    ],
  }

  const summary = monthSummary(data, '2026-10', new Date('2026-10-15T12:00:00Z'))

  const food = summary.categories.find((c) => c.category === 'Food')
  assert.equal(food.total, 5500)
  assert.equal(food.budget, 5000)
  assert.equal(food.remaining, -500)
  assert.equal(food.status, 'exceeded')

  const groceries = summary.categories.find((c) => c.category === 'Groceries')
  assert.equal(groceries.total, 3600)
  assert.equal(groceries.budget, 4000)
  assert.equal(groceries.remaining, 400)
  assert.equal(groceries.status, 'warning')

  const shopping = summary.categories.find((c) => c.category === 'Shopping')
  assert.equal(shopping.total, 800)
  assert.equal(shopping.budget, 2000)
  assert.equal(shopping.remaining, 1200)
  assert.equal(shopping.status, 'on-track')

  assert.equal(summary.categoryAlerts.length, 2) // Food (exceeded) + Groceries (warning)
})

test('calculateAccountBalances incorporates income tagging, transfers, CC bill settlement, and utilization', () => {
  const accounts = [
    { id: 'acc_bank', name: 'HDFC Bank', type: 'bank', initialBalance: 50000 },
    { id: 'acc_cc', name: 'Infinia Card', type: 'credit_card', initialBalance: 0, creditLimit: 200000, dueDay: 20, billingDay: 5 },
    { id: 'acc_cash', name: 'Cash Wallet', type: 'cash', initialBalance: 2000 },
  ]

  const income = { '2026-10': 100000 }
  const incomeAccounts = { '2026-10': 'acc_bank' } // 100k deposited into HDFC

  const expenses = [
    { id: 'e1', amount: 20000, accountId: 'acc_bank' }, // General bank spend
    { id: 'e2', amount: 30000, accountId: 'acc_bank' }, // EMI loan payment deducted from bank
    { id: 'e3', amount: 40000, accountId: 'acc_cc' },   // Credit card spend
    { id: 'e4', amount: 500, accountId: 'acc_cash' },   // Cash spend
  ]

  // Transfer 1: Pay 25000 CC bill from HDFC Bank to Infinia Card
  // Transfer 2: ATM cash withdrawal of 5000 from HDFC Bank to Cash Wallet
  const transfers = [
    { id: 't1', fromAccountId: 'acc_bank', toAccountId: 'acc_cc', amount: 25000, date: '2026-10-10' },
    { id: 't2', fromAccountId: 'acc_bank', toAccountId: 'acc_cash', amount: 5000, date: '2026-10-12' },
  ]

  const result = calculateAccountBalances(accounts, expenses, transfers, income, incomeAccounts)

  // HDFC Bank: 50,000 (init) + 100,000 (income) - 50,000 (spent) - 25,000 (CC pay) - 5,000 (ATM) = 70,000
  const bank = result.accounts.find((a) => a.id === 'acc_bank')
  assert.equal(bank.currentBalance, 70000)

  // Cash: 2,000 (init) - 500 (spent) + 5,000 (ATM transfer in) = 6,500
  const cash = result.accounts.find((a) => a.id === 'acc_cash')
  assert.equal(cash.currentBalance, 6500)

  // Total Liquid = 70,000 + 6,500 = 76,500
  assert.equal(result.totalLiquid, 76500)

  // Infinia Card: 40,000 (spent) - 25,000 (bill paid) = 15,000 outstanding
  const cc = result.accounts.find((a) => a.id === 'acc_cc')
  assert.equal(cc.outstanding, 15000)
  assert.equal(cc.currentBalance, -15000)
  assert.equal(cc.availableCredit, 185000)
  assert.equal(cc.utilizationPercent, 7.5) // (15000 / 200000) * 100
  assert.equal(cc.utilizationStatus, 'good')

  // Due info
  assert.ok(cc.dueInfo)
  assert.equal(cc.dueInfo.dueDay, 20)

  // Total credit outstanding & net worth: 76,500 - 15,000 = 61,500
  assert.equal(result.totalCreditOutstanding, 15000)
  assert.equal(result.netWorth, 61500)
})

