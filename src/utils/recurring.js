import { currentMonthKey, daysInMonth, isValidMonthKey, pad2 } from './formatting.js'
import { applyDebtPayment } from './debts.js'

function monthNumber(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + month - 1
}

function monthOffset(startMonth, month) {
  return monthNumber(month) - monthNumber(startMonth)
}

export function syncLinkedEmiAmounts(data) {
  const debtById = new Map((data.debts || []).map((debt) => [debt.id, debt]))
  let debts = data.debts
  let changed = false

  for (const schedule of data.recurringExpenses || []) {
    if (schedule.kind !== 'emi' || !schedule.debtId) continue
    const debt = debtById.get(schedule.debtId)
    if (!debt || debt.emi === schedule.amount) continue

    if (!changed) debts = [...(data.debts || [])]
    const debtIndex = debts.findIndex((item) => item.id === debt.id)
    debts[debtIndex] = { ...debt, emi: schedule.amount }
    debtById.set(debt.id, debts[debtIndex])
    changed = true
  }

  return changed ? { ...data, debts } : data
}

export function addRecurringExpenses(data, month) {
  const additions = []
  const debtById = new Map((data.debts || []).map((debt) => [debt.id, debt]))

  for (const schedule of data.recurringExpenses || []) {
    if (!isValidMonthKey(schedule.startMonth)) continue
    const offset = monthOffset(schedule.startMonth, month)
    if (offset < 0) continue
    if (schedule.kind === 'emi' && offset >= schedule.installments) continue
    const linkedDebt = schedule.debtId ? debtById.get(schedule.debtId) : null
    if (linkedDebt && (linkedDebt.status === 'paid' || linkedDebt.balance <= 0)) continue

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
      ...(schedule.accountId ? { accountId: schedule.accountId } : {}),
    })
  }

  return additions.length
    ? { ...data, expenses: [...additions, ...data.expenses] }
    : data
}

export function applyLinkedEmiPayments(data, month, eligibleExpenseIds, paymentMonth = currentMonthKey()) {
  if (month !== paymentMonth) return data

  const debts = [...(data.debts || [])]
  const debtPayments = [...(data.debtPayments || [])]
  let expenses = data.expenses
  let changed = false

  for (const schedule of data.recurringExpenses || []) {
    if (schedule.kind !== 'emi' || !schedule.debtId) continue
    if (!isValidMonthKey(schedule.startMonth)) continue
    const offset = monthOffset(schedule.startMonth, month)
    if (offset < 0 || offset >= schedule.installments) continue

    const expenseId = `recurring_${schedule.id}_${month}`
    if (eligibleExpenseIds && !eligibleExpenseIds.has(expenseId)) continue
    const expense = expenses.find((item) => item.id === expenseId)
    if (!expense) continue

    const paymentId = `recurring_emi_${schedule.id}_${month}`
    if (debtPayments.some((payment) => payment.id === paymentId)) continue

    const debtIndex = debts.findIndex((item) => item.id === schedule.debtId)
    const debt = debts[debtIndex]
    if (!debt || debt.status === 'paid' || debt.balance <= 0) continue

    const monthlyRate = debt.monthlyRate ?? ((debt.rate ?? debt.apr ?? 0) / 12)
    const interest = Math.min(
      schedule.amount,
      Math.round(debt.balance * monthlyRate) / 100
    )
    const principal = Math.min(
      debt.balance,
      Math.round((schedule.amount - interest) * 100) / 100
    )
    const amount = Math.round((principal + interest) * 100) / 100
    if (amount <= 0) continue

    const payment = {
      id: paymentId,
      debtId: debt.id,
      amount,
      principal,
      interest,
      fees: 0,
      date: expense.date,
      note: `${schedule.name} · automatic EMI`,
    }
    const paidDebt = applyDebtPayment(debt, payment)
    if (!paidDebt) continue

    const nextMonth = nextMonthKey(month)
    const hasNextInstallment = offset + 1 < schedule.installments
    const nextDueDay = Math.min(schedule.day, daysInMonth(nextMonth))
    debts[debtIndex] = {
      ...paidDebt,
      monthsRemaining: paidDebt.status === 'paid'
        ? 0
        : hasNextInstallment
          ? schedule.installments - offset - 1
          : paidDebt.monthsRemaining,
      nextDue: paidDebt.status === 'paid' || !hasNextInstallment
        ? null
        : `${nextMonth}-${pad2(nextDueDay)}`,
    }
    debtPayments.unshift(payment)

    if (amount < expense.amount) {
      expenses = expenses.map((item) => item.id === expenseId ? { ...item, amount } : item)
    }
    changed = true
  }

  return changed ? { ...data, debts, debtPayments, expenses } : data
}

function nextMonthKey(month) {
  const [year, value] = month.split('-').map(Number)
  const next = new Date(year, value, 1)
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`
}

export function syncRecurringExpenseToExpenses(expenses = [], schedule, month) {
  if (!schedule || !month) return { expenses, updatedExpenses: [] }

  const currentMonthExpId = `recurring_${schedule.id}_${month}`
  const day = Math.min(schedule.day, daysInMonth(month))
  const targetDate = `${month}-${pad2(day)}`
  const updatedExpenses = []

  const nextExpenses = expenses.map((exp) => {
    if (exp.id === currentMonthExpId || (exp.recurringId === schedule.id && exp.date?.startsWith(month))) {
      const updated = {
        ...exp,
        amount: schedule.amount,
        category: schedule.category,
        note: schedule.note || schedule.name,
        date: targetDate,
        accountId: schedule.accountId || null,
      }
      updatedExpenses.push(updated)
      return updated
    }
    return exp
  })

  return {
    expenses: nextExpenses,
    updatedExpenses,
  }
}
