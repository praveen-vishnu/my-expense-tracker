import { daysInMonth, isValidMonthKey, pad2 } from './formatting.js'

function monthNumber(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + month - 1
}

function monthOffset(startMonth, month) {
  return monthNumber(month) - monthNumber(startMonth)
}

export function addRecurringExpenses(data, month) {
  const additions = []

  for (const schedule of data.recurringExpenses || []) {
    if (!isValidMonthKey(schedule.startMonth)) continue
    const offset = monthOffset(schedule.startMonth, month)
    if (offset < 0) continue
    if (schedule.kind === 'emi' && offset >= schedule.installments) continue

    const id = `recurring_${schedule.id}_${month}`
    if (data.expenses.some((expense) => expense.id === id)) continue

    const day = Math.min(schedule.day, daysInMonth(month))
    additions.push({
      id,
      recurringId: schedule.id,
      amount: schedule.amount,
      category: schedule.category,
      date: `${month}-${pad2(day)}`,
      note: schedule.note,
    })
  }

  return additions.length
    ? { ...data, expenses: [...additions, ...data.expenses] }
    : data
}
