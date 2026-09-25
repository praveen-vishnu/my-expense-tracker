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
  const spent = sumExpenses(monthExpenses)
  const count = monthExpenses.length
  const elapsedDays = elapsedDaysInMonth(monthKey, now)

  return {
    monthKey,
    income,
    spent,
    remaining: remainingBalance(income, spent),
    expenses: monthExpenses,
    count,
    averageExpense: averageExpense(spent, count),
    elapsedDays,
    averageDaily: averageDailySpending(spent, elapsedDays),
    categories: categoryTotals(monthExpenses),
  }
}
