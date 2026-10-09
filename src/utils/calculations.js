import { daysInMonth, monthKeyFromDate } from './formatting.js'

export function expensesForMonth(expenses, monthKey) {
  return expenses.filter((expense) => monthKeyFromDate(expense.date) === monthKey)
}

export function incomeForMonth(incomeByMonth, monthKey) {
  const value = incomeByMonth[monthKey]
  return typeof value === 'number' && value > 0 ? value : 0
}

export function sumExpenses(expenses) {
  return expenses.reduce((total, expense) => total + expense.amount, 0)
}

export function remainingBalance(income, spent) {
  return income - spent
}

export function categoryTotals(expenses) {
  const totals = new Map()
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount)
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function averageExpense(total, count) {
  if (!count) return 0
  return total / count
}

export function elapsedDaysInMonth(monthKey, now = new Date()) {
  const [year, month] = monthKey.split('-').map(Number)
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  if (year < nowYear || (year === nowYear && month < nowMonth)) {
    return daysInMonth(monthKey)
  }
  if (year === nowYear && month === nowMonth) {
    return now.getDate()
  }
  return 0
}

export function averageDailySpending(total, elapsedDays) {
  if (!elapsedDays) return 0
  return total / elapsedDays
}

export function groupExpensesByDate(expenses) {
  const groups = new Map()
  for (const expense of expenses) {
    if (!groups.has(expense.date)) groups.set(expense.date, [])
    groups.get(expense.date).push(expense)
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => b.id.localeCompare(a.id)),
    }))
}

export function monthSummary(data, monthKey, now = new Date()) {
  const monthExpenses = expensesForMonth(data.expenses, monthKey)
  const income = incomeForMonth(data.income, monthKey)
  const budget = Number(data.budgets?.[monthKey]) || 0
  const spent = sumExpenses(monthExpenses)
  const count = monthExpenses.length
  const totalDays = daysInMonth(monthKey)
  const elapsedDays = elapsedDaysInMonth(monthKey, now)
  const remainingDays = Math.max(totalDays - elapsedDays, 0)
  const averageDaily = averageDailySpending(spent, elapsedDays)
  const projectedSpend = elapsedDays > 0 ? averageDaily * totalDays : spent
  const budgetRemaining = budget - spent
  const budgetPercent = budget ? (spent / budget) * 100 : 0

  let burnRateStatus = 'on-track'
  let safeDailySpend = 0
  let projectedOverBudget = 0
  let projectedExhaustionDay = null

  if (budget > 0) {
    safeDailySpend = remainingDays > 0 ? Math.max(budgetRemaining / remainingDays, 0) : 0
    projectedOverBudget = projectedSpend > budget ? projectedSpend - budget : 0
    if (averageDaily > 0) {
      projectedExhaustionDay = Math.min(Math.ceil(budget / averageDaily), totalDays)
    }

    if (spent > budget) {
      burnRateStatus = 'exceeded'
    } else if (projectedSpend > budget) {
      burnRateStatus = 'warning'
    } else {
      burnRateStatus = 'on-track'
    }
  }

  return {
    monthKey,
    income,
    budget,
    spent,
    budgetRemaining,
    budgetPercent,
    remaining: remainingBalance(income, spent),
    expenses: monthExpenses,
    count,
    averageExpense: averageExpense(spent, count),
    totalDays,
    elapsedDays,
    remainingDays,
    averageDaily,
    projectedSpend,
    safeDailySpend,
    projectedOverBudget,
    projectedExhaustionDay,
    burnRateStatus,
    categories: categoryTotals(monthExpenses),
  }
}
