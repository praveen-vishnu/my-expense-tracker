import { isValidDate } from './formatting.js'

function optionalAmount(value) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function optionalInteger(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

export function normalizeDebt(debt) {
  if (!debt || typeof debt !== 'object') return null
  const id = typeof debt.id === 'string' && debt.id.trim() ? debt.id.trim() : null
  const name = typeof debt.name === 'string' ? debt.name.trim() : ''
  const originalAmount = optionalAmount(debt.originalAmount ?? debt.original)
  const currentBalance = optionalAmount(debt.balance)
  const principalRemaining = optionalAmount(debt.principalRemaining ?? debt.principal_remaining)
  const balance = currentBalance ?? principalRemaining ?? originalAmount

  if (!id || !name || originalAmount == null || originalAmount <= 0 || balance == null) return null

  const kind = typeof debt.kind === 'string' && debt.kind.trim() ? debt.kind.trim() : 'loan'
  const date = debt.nextDue ?? debt.next_due
  const nextDue = typeof date === 'string' && isValidDate(date) ? date : null
  const takenDate = debt.loanTakenDate ?? debt.loan_taken_date
  const loanTakenDate = typeof takenDate === 'string' && isValidDate(takenDate) ? takenDate : null
  const interestDate = debt.nextInterestDue ?? debt.next_interest_due
  const nextInterestDue = typeof interestDate === 'string' && isValidDate(interestDate) ? interestDate : null

  return {
    id,
    kind,
    category: typeof debt.category === 'string' && debt.category.trim() ? debt.category.trim() : 'Other',
    name,
    lender: typeof debt.lender === 'string' ? debt.lender.trim() : '',
    originalAmount,
    balance,
    rate: optionalAmount(debt.rate),
    emi: optionalAmount(debt.emi),
    nextDue,
    monthsRemaining: optionalInteger(debt.monthsRemaining ?? debt.months_remaining),
    totalMonths: optionalInteger(debt.totalMonths ?? debt.total_months),
    principalPaid: optionalAmount(debt.principalPaid ?? debt.principal_paid) ?? Math.max(originalAmount - balance, 0),
    interestPaid: optionalAmount(debt.interestPaid ?? debt.interest_paid) ?? 0,
    limitAmount: optionalAmount(debt.limitAmount ?? debt.limit_amount),
    apr: optionalAmount(debt.apr),
    minDue: optionalAmount(debt.minDue ?? debt.min_due),
    borrower: typeof debt.borrower === 'string' ? debt.borrower.trim() : '',
    monthlyRate: optionalAmount(debt.monthlyRate ?? debt.monthly_rate),
    nextInterestDue,
    loanTakenDate,
    status: debt.status === 'paid' || balance === 0 ? 'paid' : 'active',
  }
}

export function normalizeDebtPayment(payment) {
  if (!payment || typeof payment !== 'object') return null
  const id = typeof payment.id === 'string' && payment.id.trim() ? payment.id.trim() : null
  const debtId = typeof payment.debtId === 'string' && payment.debtId.trim()
    ? payment.debtId.trim()
    : typeof payment.debt_id === 'string' && payment.debt_id.trim()
      ? payment.debt_id.trim()
      : null
  const date = payment.date
  const amount = optionalAmount(payment.amount)
  const principal = optionalAmount(payment.principal)
  const interest = optionalAmount(payment.interest) ?? 0
  const fees = optionalAmount(payment.fees) ?? 0

  const componentTotal = (principal || 0) + interest + fees
  if (!id || !debtId || !isValidDate(date) || amount == null || amount <= 0 || principal == null || Math.abs(componentTotal - amount) > 0.01) {
    return null
  }

  return {
    id,
    debtId,
    amount,
    principal,
    interest,
    fees,
    date,
    note: typeof payment.note === 'string' ? payment.note.trim() : '',
  }
}

export function applyDebtPayment(debt, payment) {
  const currentDebt = normalizeDebt(debt)
  const normalizedPayment = normalizeDebtPayment({
    ...payment,
    debtId: payment?.debtId || currentDebt?.id,
  })
  if (!currentDebt || !normalizedPayment || normalizedPayment.debtId !== currentDebt.id || normalizedPayment.principal > currentDebt.balance) {
    return null
  }

  return normalizeDebt({
    ...currentDebt,
    balance: Math.max(0, Math.round((currentDebt.balance - normalizedPayment.principal) * 100) / 100),
    principalPaid: Math.round((currentDebt.principalPaid + normalizedPayment.principal) * 100) / 100,
    interestPaid: Math.round((currentDebt.interestPaid + normalizedPayment.interest) * 100) / 100,
  })
}

export function parseDebtImport(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  const records = Array.isArray(parsed) ? parsed : parsed?.debts
  if (!Array.isArray(records)) {
    return { ok: false, error: 'Debt import must be a JSON list or an object containing a debts list.' }
  }

  const seenIds = new Set()
  const debts = records
    .map(normalizeDebt)
    .filter((debt) => {
      if (!debt || seenIds.has(debt.id)) return false
      seenIds.add(debt.id)
      return true
    })
  if (records.length && !debts.length) {
    return { ok: false, error: 'No valid debts were found. Each debt needs an id, name, original amount, and balance.' }
  }

  return { ok: true, debts, skipped: records.length - debts.length }
}
