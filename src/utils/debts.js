import { isValidDate, todayISO } from './formatting.js'

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

export function calculateRemainingMonths(debt, currentDate = todayISO()) {
  if (!debt || typeof debt !== 'object') return null
  if (debt.status === 'paid' || (debt.balance != null && Number(debt.balance) <= 0)) {
    return 0
  }

  const balance = optionalAmount(debt.balance)
  const emi = optionalAmount(debt.emi ?? debt.monthlyPayment ?? debt.minDue)
  const monthlyRate = optionalAmount(debt.monthlyRate ?? debt.monthly_rate)
  const annualRate = optionalAmount(debt.rate ?? debt.apr)
  const rate = monthlyRate != null ? monthlyRate : (annualRate != null ? annualRate / 12 : 0)
  const r = rate > 0 ? rate / 100 : 0

  // 1. Amortization payoff if balance and regular EMI are available (true financial payoff)
  if (balance != null && balance > 0 && emi != null && emi > 0) {
    if (r > 0) {
      if (r * balance < emi) {
        const n = -Math.log(1 - (r * balance) / emi) / Math.log(1 + r)
        if (Number.isFinite(n) && n > 0) {
          return Math.ceil(n)
        }
      } else {
        // Interest-only loan: EMI covers only interest, principal does not amortize monthly
        return null
      }
    } else {
      return Math.ceil(balance / emi)
    }
  }

  // 2. Explicit stored remaining months with calendar elapsed adjustment
  const staticRemaining = optionalInteger(debt.monthsRemaining ?? debt.months_remaining)
  if (staticRemaining != null && staticRemaining > 0) {
    const [currYear, currMonth, currDay] = (currentDate || todayISO()).split('-').map(Number)
    const refDate = debt.nextDue ?? debt.next_due ?? (typeof debt.created_at === 'string' ? debt.created_at.slice(0, 10) : null)
    if (refDate && /^\d{4}-\d{2}/.test(String(refDate))) {
      const [refYear, refMonth, refDay] = String(refDate).split('-').map(Number)
      if (refYear && refMonth) {
        let elapsed = (currYear - refYear) * 12 + (currMonth - refMonth)
        if (refDay && currDay < refDay) elapsed = Math.max(0, elapsed - 1)
        if (elapsed > 0) {
          const remaining = staticRemaining - elapsed
          return remaining > 0 ? remaining : (balance != null && balance > 0 ? 1 : 0)
        }
      }
    }
    return staticRemaining
  }

  // 3. Contract term fallback from loanTakenDate and totalMonths
  const totalMonths = optionalInteger(debt.totalMonths ?? debt.total_months)
  const loanTakenDate = debt.loanTakenDate ?? debt.loan_taken_date
  if (loanTakenDate && totalMonths && totalMonths > 0) {
    const [currYear, currMonth, currDay] = (currentDate || todayISO()).split('-').map(Number)
    const [startYear, startMonth, startDay] = String(loanTakenDate).split('-').map(Number)
    if (startYear && startMonth) {
      let elapsedMonths = (currYear - startYear) * 12 + (currMonth - startMonth)
      const nextDueDate = debt.nextDue ?? debt.next_due
      const dueDay = (nextDueDate ? Number(String(nextDueDate).split('-')[2]) : null) || startDay || 1
      if (currDay < dueDay) {
        elapsedMonths = Math.max(0, elapsedMonths - 1)
      }
      const remaining = totalMonths - elapsedMonths
      if (remaining > 0) {
        return remaining
      }
      return balance != null && balance > 0 ? 1 : 0
    }
  }

  return staticRemaining ?? (balance != null && balance > 0 ? 1 : 0)
}

/**
 * Returns a human-friendly string for the debt's remaining tenure.
 * Examples: "5 of 60 mo left", "22 mo left", "Interest-only", "Paid off"
 */
export function formatRemainingTenure(debt, currentDate = todayISO()) {
  if (!debt || typeof debt !== 'object') return '—'
  if (debt.status === 'paid' || (debt.balance != null && Number(debt.balance) <= 0)) {
    return 'Paid off'
  }

  const balance = optionalAmount(debt.balance)
  const emi = optionalAmount(debt.emi ?? debt.monthlyPayment ?? debt.minDue)
  const monthlyRate = optionalAmount(debt.monthlyRate ?? debt.monthly_rate)
  const annualRate = optionalAmount(debt.rate ?? debt.apr)
  const rate = monthlyRate != null ? monthlyRate : (annualRate != null ? annualRate / 12 : 0)
  const r = rate > 0 ? rate / 100 : 0

  if (r > 0 && balance > 0 && emi > 0 && r * balance >= emi) {
    return 'Interest-only'
  }

  const months = calculateRemainingMonths(debt, currentDate)
  const totalMonths = optionalInteger(debt.totalMonths ?? debt.total_months)

  if (months != null && months > 0) {
    if (totalMonths && totalMonths >= months) {
      return `${months} of ${totalMonths} mo left`
    }
    return `${months} ${months === 1 ? 'month' : 'months'} left`
  }

  if (totalMonths && totalMonths > 0) {
    return `${totalMonths} mo term`
  }

  return 'Open term'
}

/**
 * Calculates the exact remaining amortized balance of a loan
 * based on originalAmount, rate of interest, totalMonths, loanTakenDate, and emi.
 */
export function calculateRemainingBalance(debt, currentDate = todayISO()) {
  if (!debt || typeof debt !== 'object') return null
  if (debt.status === 'paid' || (debt.balance != null && Number(debt.balance) === 0)) {
    return 0
  }

  const P = optionalAmount(debt.originalAmount ?? debt.original)
  if (!P || P <= 0) return null

  const loanTakenDate = debt.loanTakenDate ?? debt.loan_taken_date
  if (!loanTakenDate || !isValidDate(loanTakenDate)) {
    return null
  }

  const effectiveDate = typeof currentDate === 'string' && isValidDate(currentDate) ? currentDate : todayISO()
  const totalMonths = optionalInteger(debt.totalMonths ?? debt.total_months)
  const monthlyRate = optionalAmount(debt.monthlyRate ?? debt.monthly_rate)
  const annualRate = optionalAmount(debt.rate ?? debt.apr)
  const rate = monthlyRate != null ? monthlyRate : (annualRate != null ? annualRate / 12 : 0)
  const r = rate > 0 ? rate / 100 : 0

  let E = optionalAmount(debt.emi ?? debt.monthlyPayment ?? debt.minDue)

  // Auto-calculate regular EMI if not provided and totalMonths is known
  if ((!E || E <= 0) && totalMonths && totalMonths > 0) {
    if (r > 0) {
      E = (P * r * Math.pow(1 + r, totalMonths)) / (Math.pow(1 + r, totalMonths) - 1)
    } else {
      E = P / totalMonths
    }
  }

  // Calculate elapsed installments from loanTakenDate to effectiveDate
  const [currYear, currMonth, currDay] = effectiveDate.split('-').map(Number)
  const [startYear, startMonth, startDay] = String(loanTakenDate).split('-').map(Number)
  if (!startYear || !startMonth) return null

  let elapsed = (currYear - startYear) * 12 + (currMonth - startMonth)
  const nextDueDate = debt.nextDue ?? debt.next_due
  const dueDay = (nextDueDate && isValidDate(nextDueDate) ? Number(String(nextDueDate).split('-')[2]) : null) || startDay || 1
  if (currDay < dueDay) {
    elapsed = Math.max(0, elapsed - 1)
  }

  if (totalMonths && totalMonths > 0) {
    elapsed = Math.min(totalMonths, Math.max(0, elapsed))
  } else {
    elapsed = Math.max(0, elapsed)
  }

  // If no installments have elapsed yet, full principal remains
  if (elapsed === 0) return Math.round(P * 100) / 100

  // If all installments have elapsed, loan is fully paid off
  if (totalMonths && elapsed >= totalMonths) return 0

  // 0% interest loan (e.g., informal hand loan)
  if (r === 0) {
    if (!E || E <= 0) return Math.round(P * 100) / 100
    return Math.max(0, Math.round((P - elapsed * E) * 100) / 100)
  }

  // Interest-only loan: EMI covers monthly interest, principal does not reduce
  if (E && r * P >= E) {
    return Math.round(P * 100) / 100
  }

  if (!E || E <= 0) return null

  // Month-by-month standard amortisation
  let bal = P
  for (let i = 0; i < elapsed; i++) {
    const interest = bal * r
    const principal = Math.max(0, E - interest)
    bal = Math.max(0, bal - principal)
  }

  return Math.round(bal * 100) / 100
}

export function normalizeDebt(debt, currentDate = todayISO()) {
  if (!debt || typeof debt !== 'object') return null
  const id = typeof debt.id === 'string' && debt.id.trim() ? debt.id.trim() : null
  const name = typeof debt.name === 'string' ? debt.name.trim() : ''
  const originalAmount = optionalAmount(debt.originalAmount ?? debt.original)
  const currentBalance = optionalAmount(debt.balance)
  const principalRemaining = optionalAmount(debt.principalRemaining ?? debt.principal_remaining)

  const effectiveDate = typeof currentDate === 'string' && isValidDate(currentDate) ? currentDate : todayISO()
  const calculatedBalance = calculateRemainingBalance(debt, effectiveDate)
  const balance = currentBalance ?? principalRemaining ?? (calculatedBalance != null ? calculatedBalance : originalAmount)

  if (!id || !name || originalAmount == null || originalAmount <= 0 || balance == null) return null

  const kind = typeof debt.kind === 'string' && debt.kind.trim() ? debt.kind.trim() : 'loan'
  const date = debt.nextDue ?? debt.next_due
  const nextDue = typeof date === 'string' && isValidDate(date) ? date : null
  const takenDate = debt.loanTakenDate ?? debt.loan_taken_date
  const loanTakenDate = typeof takenDate === 'string' && isValidDate(takenDate) ? takenDate : null
  const interestDate = debt.nextInterestDue ?? debt.next_interest_due
  const nextInterestDue = typeof interestDate === 'string' && isValidDate(interestDate) ? interestDate : null

  const explicitMonths = optionalInteger(debt.monthsRemaining ?? debt.months_remaining)
  const totalMonths = optionalInteger(debt.totalMonths ?? debt.total_months)
  const emi = optionalAmount(debt.emi ?? debt.monthlyPayment ?? debt.minDue)
  const rate = optionalAmount(debt.rate ?? debt.apr)
  const monthlyRate = optionalAmount(debt.monthlyRate ?? debt.monthly_rate)

  const computedMonths = calculateRemainingMonths({
    ...debt,
    balance,
    loanTakenDate,
    totalMonths,
    nextDue,
    emi,
    rate,
    monthlyRate,
    monthsRemaining: explicitMonths,
    status: balance === 0 ? 'paid' : (debt.status || 'active'),
  })
  const monthsRemaining = computedMonths != null ? computedMonths : explicitMonths

  return {
    id,
    kind,
    category: typeof debt.category === 'string' && debt.category.trim() ? debt.category.trim() : 'Other',
    name,
    lender: typeof debt.lender === 'string' ? debt.lender.trim() : '',
    originalAmount,
    balance,
    rate,
    emi,
    nextDue,
    monthsRemaining,
    totalMonths,
    principalPaid: optionalAmount(debt.principalPaid ?? debt.principal_paid) ?? Math.max(originalAmount - balance, 0),
    interestPaid: optionalAmount(debt.interestPaid ?? debt.interest_paid) ?? 0,
    limitAmount: optionalAmount(debt.limitAmount ?? debt.limit_amount),
    apr: optionalAmount(debt.apr),
    minDue: optionalAmount(debt.minDue ?? debt.min_due),
    borrower: typeof debt.borrower === 'string' ? debt.borrower.trim() : '',
    monthlyRate,
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

/**
 * Automatically splits a single payment amount into principal, interest, and fees
 * based on the loan's balance and interest rate.
 */
export function calculatePaymentSplit(debt, amount) {
  const total = Math.max(0, optionalAmount(amount) || 0)
  if (!debt || total <= 0) return { principal: 0, interest: 0, fees: 0 }

  const balance = Math.max(0, optionalAmount(debt.balance) || 0)
  const monthlyRate = debt.monthlyRate != null && Number(debt.monthlyRate) > 0
    ? Number(debt.monthlyRate) / 100
    : (debt.rate != null && Number(debt.rate) > 0 ? Number(debt.rate) / 1200 : 0)

  if (monthlyRate > 0 && balance > 0) {
    const estInterest = Math.round(balance * monthlyRate * 100) / 100
    if (total <= estInterest) {
      return {
        principal: 0,
        interest: total,
        fees: 0,
      }
    }
    const potentialPrincipal = Math.round((total - estInterest) * 100) / 100
    if (potentialPrincipal > balance) {
      return {
        principal: balance,
        interest: Math.round((total - balance) * 100) / 100,
        fees: 0,
      }
    }
    return {
      principal: potentialPrincipal,
      interest: estInterest,
      fees: 0,
    }
  }

  const principal = Math.min(balance, total)
  const excess = Math.round((total - principal) * 100) / 100
  return {
    principal,
    interest: excess,
    fees: 0,
  }
}

/** Map common human-friendly headers to normalizeDebt field names */
const HEADER_ALIASES = {
  // name
  'name': 'name', 'loan name': 'name', 'debt name': 'name', 'description': 'name',
  // id
  'id': 'id', 'loan id': 'id', 'debt id': 'id',
  // lender
  'lender': 'lender', 'bank': 'lender', 'bank name': 'lender', 'institution': 'lender', 'financer': 'lender',
  // kind
  'kind': 'kind', 'type': 'kind', 'loan type': 'kind', 'debt type': 'kind',
  // category
  'category': 'category', 'loan category': 'category',
  // originalAmount
  'original amount': 'originalAmount', 'originalamount': 'originalAmount', 'original_amount': 'originalAmount',
  'original': 'originalAmount', 'loan amount': 'originalAmount', 'total borrowed': 'originalAmount',
  'principal': 'originalAmount', 'sanctioned amount': 'originalAmount', 'amount': 'originalAmount',
  // balance
  'balance': 'balance', 'current balance': 'balance', 'remaining balance': 'balance',
  'outstanding': 'balance', 'outstanding balance': 'balance', 'remaining': 'balance',
  'principal_remaining': 'balance', 'principal remaining': 'balance',
  // emi
  'emi': 'emi', 'monthly emi': 'emi', 'installment': 'emi', 'monthly payment': 'emi',
  'monthlypayment': 'emi', 'min due': 'emi', 'mindue': 'emi', 'min_due': 'emi',
  // rate
  'rate': 'rate', 'interest rate': 'rate', 'interest': 'rate', 'annual rate': 'rate',
  'rate of interest': 'rate', 'roi': 'rate', 'apr': 'rate',
  // monthly rate
  'monthly rate': 'monthlyRate', 'monthlyrate': 'monthlyRate', 'monthly_rate': 'monthlyRate',
  // totalMonths
  'total months': 'totalMonths', 'totalmonths': 'totalMonths', 'total_months': 'totalMonths',
  'tenure': 'totalMonths', 'tenure months': 'totalMonths', 'loan tenure': 'totalMonths',
  'term': 'totalMonths', 'term months': 'totalMonths',
  // loanTakenDate
  'loan taken date': 'loanTakenDate', 'loantakendate': 'loanTakenDate', 'loan_taken_date': 'loanTakenDate',
  'start date': 'loanTakenDate', 'disbursement date': 'loanTakenDate', 'disbursal date': 'loanTakenDate',
  'loan date': 'loanTakenDate', 'taken date': 'loanTakenDate',
  // nextDue
  'next due': 'nextDue', 'nextdue': 'nextDue', 'next_due': 'nextDue',
  'due date': 'nextDue', 'next emi date': 'nextDue', 'next payment date': 'nextDue',
  // months remaining
  'months remaining': 'monthsRemaining', 'monthsremaining': 'monthsRemaining', 'months_remaining': 'monthsRemaining',
  'remaining months': 'monthsRemaining',
  // borrower
  'borrower': 'borrower',
  // principalPaid
  'principal paid': 'principalPaid', 'principalpaid': 'principalPaid', 'principal_paid': 'principalPaid',
  // interestPaid
  'interest paid': 'interestPaid', 'interestpaid': 'interestPaid', 'interest_paid': 'interestPaid',
}

function mapHeaderToField(header) {
  const key = String(header).trim().toLowerCase().replace(/[_\s]+/g, ' ')
  return HEADER_ALIASES[key] || null
}

/**
 * Parse CSV text into an array of row objects.
 * Handles quoted values with commas/newlines inside.
 */
export function parseCSV(text) {
  if (!text || typeof text !== 'string') return []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < lines.length; i++) {
    const ch = lines[i]
    if (inQuotes) {
      if (ch === '"' && lines[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === '\n') {
        rows.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  if (current.trim()) rows.push(current)

  if (rows.length < 2) return [] // need header + at least 1 data row
  const headers = rows[0].split(',').map((h) => h.trim())
  const fieldMap = headers.map(mapHeaderToField)

  // At least "name" must be present
  if (!fieldMap.includes('name')) return []

  const result = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r].split(',').map((c) => c.trim())
    if (cells.every((c) => !c)) continue // skip blank rows
    const obj = {}
    for (let c = 0; c < headers.length; c++) {
      const field = fieldMap[c]
      if (field && cells[c] !== undefined && cells[c] !== '') {
        obj[field] = cells[c]
      }
    }
    // Auto-generate id if not provided
    if (!obj.id) {
      obj.id = `import-${Date.now()}-${r}`
    }
    if (obj.name) result.push(obj)
  }
  return result
}

/**
 * Parse an Excel ArrayBuffer into an array of row objects using SheetJS.
 * Returns [] if xlsx is not available or parsing fails.
 */
export async function parseExcel(buffer) {
  try {
    const mod = await import('xlsx')
    const XLSX = mod.default || mod
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    if (!rows.length) return []

    // Map headers using aliases
    const rawHeaders = Object.keys(rows[0])
    const result = []
    for (let r = 0; r < rows.length; r++) {
      const raw = rows[r]
      const obj = {}
      for (const header of rawHeaders) {
        const field = mapHeaderToField(header)
        if (field) {
          const val = raw[header]
          if (val !== '' && val != null) obj[field] = val
        }
      }
      if (!obj.id) obj.id = `import-${Date.now()}-${r}`
      if (obj.name) result.push(obj)
    }
    return result
  } catch {
    return []
  }
}

export function parseDebtImport(input) {
  let records
  if (Array.isArray(input)) {
    records = input
  } else if (typeof input === 'object' && input !== null) {
    records = Array.isArray(input.debts) ? input.debts : [input]
  } else {
    try {
      const parsed = JSON.parse(input)
      records = Array.isArray(parsed) ? parsed : parsed?.debts
    } catch {
      return { ok: false, error: 'That file is not valid JSON.' }
    }
  }

  if (!Array.isArray(records)) {
    return { ok: false, error: 'Debt import must be a JSON list or an object containing a debts list.' }
  }

  const seenIds = new Set()
  const debts = records
    .map((record) => normalizeDebt(record))
    .filter((debt) => {
      if (!debt || seenIds.has(debt.id)) return false
      seenIds.add(debt.id)
      return true
    })
  if (records.length && !debts.length) {
    return { ok: false, error: 'No valid debts were found. Each debt needs a name and loan amount at minimum.' }
  }

  return { ok: true, debts, skipped: records.length - debts.length }
}

export function guessLoanAmount(name, emiAmount, installments) {
  if (typeof name === 'string') {
    const lakhMatch = name.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l)\b/i)
    if (lakhMatch) {
      const val = parseFloat(lakhMatch[1])
      if (Number.isFinite(val) && val > 0) return Math.round(val * 100000)
    }
    const crMatch = name.match(/(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)\b/i)
    if (crMatch) {
      const val = parseFloat(crMatch[1])
      if (Number.isFinite(val) && val > 0) return Math.round(val * 10000000)
    }
    const kMatch = name.match(/(\d+(?:\.\d+)?)\s*k\b/i)
    if (kMatch) {
      const val = parseFloat(kMatch[1])
      if (Number.isFinite(val) && val > 0) return Math.round(val * 1000)
    }
  }
  const emi = Number(emiAmount) || 0
  const inst = Number(installments) || 0
  if (emi > 0 && inst > 0) {
    return Math.round(emi * inst)
  }
  return 0
}

/**
 * Calculates the overall debt-free date and months remaining across all active debts.
 */
export function calculateDebtFreeDate(debts = [], currentDate = todayISO()) {
  const active = debts.filter((d) => d && d.status !== 'paid' && Number(d.balance) > 0)
  if (!active.length) {
    return { isDebtFree: true, maxMonths: 0, debtFreeDate: null, formattedDate: 'Debt-Free 🎉' }
  }

  let maxMonths = 0
  for (const debt of active) {
    const months = calculateRemainingMonths(debt, currentDate)
    if (months && months > maxMonths) {
      maxMonths = months
    }
  }

  if (maxMonths <= 0) {
    maxMonths = 1
  }

  const [year, monthVal] = currentDate.slice(0, 7).split('-').map(Number)
  const targetDate = new Date(year, monthVal - 1 + maxMonths, 1)
  const targetYear = targetDate.getFullYear()
  const targetMonthName = targetDate.toLocaleString('en-US', { month: 'short' })
  const formattedDate = `${targetMonthName} ${targetYear}`

  return {
    isDebtFree: false,
    maxMonths,
    formattedDate,
    targetYear,
    targetMonthName,
  }
}

/**
 * Calculates Debt-to-Income (DTI) ratio and health status.
 */
export function calculateDtiRatio(monthlyObligation = 0, monthlyIncome = 0) {
  const emi = Number(monthlyObligation) || 0
  const income = Number(monthlyIncome) || 0

  if (income <= 0) {
    return {
      percentage: null,
      status: 'unknown',
      label: 'Set income to calculate DTI',
      description: 'Add your monthly income to assess your debt burden ratio.',
      color: 'var(--muted)',
    }
  }

  const percentage = Math.round((emi / income) * 100)

  if (percentage <= 20) {
    return {
      percentage,
      status: 'healthy',
      label: 'Healthy (< 20%)',
      description: 'Your monthly debt burden is low and safe.',
      color: '#38a169',
    }
  }

  if (percentage <= 35) {
    return {
      percentage,
      status: 'moderate',
      label: 'Manageable (20–35%)',
      description: 'Healthy debt level within standard lending guidelines.',
      color: '#3182ce',
    }
  }

  if (percentage <= 45) {
    return {
      percentage,
      status: 'stretched',
      label: 'Stretched (36–45%)',
      description: 'Caution: Debt is consuming a significant portion of take-home pay.',
      color: '#dd6b20',
    }
  }

  return {
    percentage,
    status: 'critical',
    label: 'High risk (> 45%)',
    description: 'High debt burden. Prioritize prepayments to reduce monthly strain.',
    color: '#e53e3e',
  }
}

/**
 * Ranks active debts for Avalanche (highest interest first) and Snowball (smallest balance first).
 */
export function getRepaymentStrategies(debts = []) {
  const active = debts.filter((d) => d && d.status !== 'paid' && Number(d.balance) > 0)

  // Avalanche: Sort by annual interest rate descending. If equal, higher balance first.
  const avalanche = [...active].sort((a, b) => {
    const rateA = Number(a.monthlyRate != null ? a.monthlyRate * 12 : a.rate ?? a.apr ?? 0)
    const rateB = Number(b.monthlyRate != null ? b.monthlyRate * 12 : b.rate ?? b.apr ?? 0)
    if (rateB !== rateA) return rateB - rateA
    return (Number(b.balance) || 0) - (Number(a.balance) || 0)
  })

  // Snowball: Sort by remaining balance ascending. If equal, higher rate first.
  const snowball = [...active].sort((a, b) => {
    const balA = Number(a.balance) || 0
    const balB = Number(b.balance) || 0
    if (balA !== balB) return balA - balB
    const rateA = Number(a.monthlyRate != null ? a.monthlyRate * 12 : a.rate ?? a.apr ?? 0)
    const rateB = Number(b.monthlyRate != null ? b.monthlyRate * 12 : b.rate ?? b.apr ?? 0)
    return rateB - rateA
  })

  return { avalanche, snowball }
}


