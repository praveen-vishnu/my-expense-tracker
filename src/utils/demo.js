import { createId, daysInMonth } from './formatting.js'

function day(monthKey, n, maxDay) {
  const safe = Math.min(n, maxDay)
  return `${monthKey}-${String(safe).padStart(2, '0')}`
}

export function buildDemoData(monthKey) {
  const maxDay = daysInMonth(monthKey)
  const expenses = [
    { amount: 18000, category: 'Bills', date: day(monthKey, 1, maxDay), note: 'Rent' },
    { amount: 2200, category: 'Bills', date: day(monthKey, 5, maxDay), note: 'Electricity' },
    { amount: 1800, category: 'Bills', date: day(monthKey, 8, maxDay), note: 'Internet' },
    { amount: 2000, category: 'Bills', date: day(monthKey, 12, maxDay), note: 'Phone' },
    { amount: 450, category: 'Food', date: day(monthKey, 25, maxDay), note: 'Lunch' },
    { amount: 180, category: 'Food', date: day(monthKey, 24, maxDay), note: 'Chai and snacks' },
    { amount: 1240, category: 'Food', date: day(monthKey, 20, maxDay), note: 'Groceries' },
    { amount: 890, category: 'Food', date: day(monthKey, 18, maxDay), note: 'Dinner out' },
    { amount: 3200, category: 'Food', date: day(monthKey, 10, maxDay), note: 'Weekly groceries' },
    { amount: 3540, category: 'Food', date: day(monthKey, 3, maxDay), note: 'Groceries' },
    { amount: 280, category: 'Transport', date: day(monthKey, 25, maxDay), note: 'Uber' },
    { amount: 1200, category: 'Transport', date: day(monthKey, 2, maxDay), note: 'Metro card' },
    { amount: 640, category: 'Transport', date: day(monthKey, 14, maxDay), note: 'Cab' },
    { amount: 1880, category: 'Transport', date: day(monthKey, 9, maxDay), note: 'Fuel' },
    { amount: 1240, category: 'Shopping', date: day(monthKey, 24, maxDay), note: 'Groceries extras' },
    { amount: 3200, category: 'Shopping', date: day(monthKey, 16, maxDay), note: 'Clothes' },
    { amount: 3560, category: 'Shopping', date: day(monthKey, 7, maxDay), note: 'Home supplies' },
    { amount: 1400, category: 'Entertainment', date: day(monthKey, 21, maxDay), note: 'Movie' },
    { amount: 2000, category: 'Entertainment', date: day(monthKey, 11, maxDay), note: 'Streaming' },
    { amount: 900, category: 'Health', date: day(monthKey, 6, maxDay), note: 'Pharmacy' },
    { amount: 2600, category: 'Other', date: day(monthKey, 4, maxDay), note: 'Gift' },
    { amount: 900, category: 'Other', date: day(monthKey, 15, maxDay), note: 'Miscellaneous' },
  ]

  return {
    version: 1,
    income: { [monthKey]: 80000 },
    categories: [...new Set(expenses.map((expense) => expense.category))],
    expenses: expenses.map((expense) => ({
      id: createId(),
      ...expense,
    })),
  }
}
