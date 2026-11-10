import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeData } from './storage.js'
import { applyDebtPayment, calculatePaymentSplit, calculateRemainingMonths, formatRemainingTenure, guessLoanAmount, normalizeDebt, normalizeDebtPayment, parseCSV, parseDebtImport } from './debts.js'

test('normalizes legacy debt exports and retains informal-loan balances and monthly rates', () => {
  const debt = normalizeDebt({
    id: 'loan-1',
    kind: 'shark',
    category: 'Informal Loan',
    name: 'Family loan',
    lender: '  Relative  ',
    original: '500000',
    balance: null,
    principal_remaining: '480000',
    monthly_rate: '2',
    principal_paid: '20000',
    interest_paid: '3000',
    next_interest_due: '2026-09-07',
  })

  assert.equal(debt.id, 'loan-1')
  assert.equal(debt.lender, 'Relative')
  assert.equal(debt.originalAmount, 500000)
  assert.equal(debt.balance, 480000)
  assert.equal(debt.monthlyRate, 2)
  assert.equal(debt.principalPaid, 20000)
  assert.equal(debt.interestPaid, 3000)
  assert.equal(debt.nextInterestDue, '2026-09-07')
})

test('normalizes debt payments and rejects invalid records', () => {
  const payment = normalizeDebtPayment({
    id: 'payment-1',
    debt_id: 'loan-1',
    amount: '10000',
    principal: '8000',
    interest: '1800',
    fees: '200',
    date: '2026-08-02',
  })

  test('payment allocation reduces principal only and accumulates interest paid', () => {
    const debt = normalizeDebt({
      id: 'loan-1',
      name: 'Loan',
      original: 10000,
      balance: 8000,
      principal_paid: 2000,
      interest_paid: 500,
    })
    const updated = applyDebtPayment(debt, {
      id: 'payment-1',
      debtId: 'loan-1',
      amount: 1500,
      principal: 1200,
      interest: 250,
      fees: 50,
      date: '2026-08-02',
    })

    assert.equal(updated.balance, 6800)
    assert.equal(updated.principalPaid, 3200)
    assert.equal(updated.interestPaid, 750)
    assert.equal(applyDebtPayment(debt, {
      id: 'payment-2',
      debtId: 'loan-1',
      amount: 9000,
      principal: 9000,
      interest: 0,
      fees: 0,
      date: '2026-08-02',
    }), null)
  })

  assert.deepEqual(payment, {
    id: 'payment-1',
    debtId: 'loan-1',
    amount: 10000,
    principal: 8000,
    interest: 1800,
    fees: 200,
    date: '2026-08-02',
    note: '',
  })
  assert.equal(normalizeDebtPayment({ ...payment, principal: 12000 }), null)
  assert.equal(normalizeDebtPayment({ ...payment, date: '2026-02-30' }), null)
})

test('parses JSON debt exports and reports invalid rows', () => {
  const parsed = parseDebtImport(JSON.stringify([
    { id: 'loan-1', name: 'Valid loan', original: '1000', balance: '800' },
    { id: 'loan-1', name: 'Duplicate', original: '2000', balance: '1500' },
    { id: 'bad', name: '', original: '10', balance: '5' },
  ]))

  assert.equal(parsed.ok, true)
  assert.equal(parsed.debts.length, 1)
  assert.equal(parsed.skipped, 2)
  assert.equal(parseDebtImport('{').ok, false)
  assert.equal(parseDebtImport(JSON.stringify({ records: [] })).ok, false)
})

test('normalizes persisted debt records and payment history', () => {
  const data = normalizeData({
    debts: [
      { id: 'loan-1', name: 'Loan', original: '1000', balance: '750', rate: '12' },
      { id: 'invalid', name: '', original: '1000', balance: '750' },
    ],
    debtPayments: [
      { id: 'payment-1', debtId: 'loan-1', amount: 250, principal: 250, date: '2026-08-02' },
      { id: 'orphan-payment', debtId: 'missing-debt', amount: 250, principal: 250, date: '2026-08-02' },
      { id: 'invalid-payment', debtId: 'loan-1', amount: 250, principal: 250, date: 'invalid' },
    ],
  })

  assert.equal(data.debts.length, 1)
  assert.equal(data.debts[0].balance, 750)
  assert.equal(data.debtPayments.length, 1)
})

test('guessLoanAmount parses amounts from names and multiplies installments by EMI', () => {
  assert.equal(guessLoanAmount('12 Lakh Loan', 26124, 2), 1200000)
  assert.equal(guessLoanAmount('Car Loan 5.5 Lacs', 15000, 48), 550000)
  assert.equal(guessLoanAmount('Home Loan 1.2 Crore', 95000, 240), 12000000)
  assert.equal(guessLoanAmount('Personal Loan 50k', 5000, 12), 50000)
  assert.equal(guessLoanAmount('Generic Loan', 10000, 24), 240000)
  assert.equal(guessLoanAmount('Generic Loan', 0, 0), 0)
})

test('calculateRemainingMonths automatically computes remaining months based on current date', () => {
  // Paid or zero balance returns 0
  assert.equal(calculateRemainingMonths({ status: 'paid', balance: 0 }, '2026-11-07'), 0)
  assert.equal(calculateRemainingMonths({ balance: 0 }, '2026-11-07'), 0)

  // Contract term: Loan taken 2026-06-04 with 24 months tenure evaluated at 2026-11-07
  // June to Nov is 5 elapsed months. 24 - 5 = 19 months left.
  assert.equal(calculateRemainingMonths({
    loanTakenDate: '2026-06-04',
    totalMonths: 24,
    balance: 289731,
    nextDue: '2026-08-02',
  }, '2026-11-07'), 19)

  // Due day boundary: If today is before due day in current month, current month is still counted in remaining
  // Loan taken 2021-11-24 with 60 months tenure. Next due is 8th of month.
  // On 2026-11-07 (before 8th): 60 - 59 = 1 month left
  assert.equal(calculateRemainingMonths({
    loanTakenDate: '2021-11-24',
    totalMonths: 60,
    balance: 127218,
    nextDue: '2026-11-08',
  }, '2026-11-07'), 1)

  // On 2026-11-09 (after 8th): 60 contract months elapsed, but unpaid balance returns minimum 1 month remaining
  assert.equal(calculateRemainingMonths({
    loanTakenDate: '2021-11-24',
    totalMonths: 60,
    balance: 127218,
    nextDue: '2026-11-08',
  }, '2026-11-09'), 1)

  // When fully paid off (balance 0), returns 0
  assert.equal(calculateRemainingMonths({
    loanTakenDate: '2021-11-24',
    totalMonths: 60,
    balance: 0,
    nextDue: '2026-11-08',
  }, '2026-11-09'), 0)

  // With EMI and balance, calculates true financial payoff via amortization (5-6 months)
  assert.equal(calculateRemainingMonths({
    balance: 127218,
    emi: 26124,
    rate: 10.7,
  }, '2026-11-09'), 6)

  // Hand loan without loanTakenDate using balance and 0% EMI: 135000 / 5000 = 27 months
  assert.equal(calculateRemainingMonths({
    balance: 135000,
    emi: 5000,
    rate: 0,
  }, '2026-11-07'), 27)

  // Amortization payoff: Balance 10000, EMI 1000, Rate 12% annual (1% mo)
  // n = -ln(1 - 0.01 * 10000 / 1000) / ln(1.01) = -ln(0.9) / ln(1.01) = 10.57 -> 11 months
  assert.equal(calculateRemainingMonths({
    balance: 10000,
    emi: 1000,
    rate: 12,
  }, '2026-11-07'), 11)

  // Interest-only loan (EMI equals monthly interest, principal never amortizes)
  assert.equal(calculateRemainingMonths({
    balance: 500000,
    emi: 10000,
    monthlyRate: 2,
  }, '2026-11-07'), null)
})

test('formatRemainingTenure formats readable labels for amortizing, interest-only, and paid loans', () => {
  // Amortizing with contract tenure
  assert.equal(formatRemainingTenure({
    balance: 127218,
    emi: 26124,
    rate: 10.7,
    totalMonths: 60,
  }, '2026-11-10'), '6 of 60 mo left')

  // Interest-only
  assert.equal(formatRemainingTenure({
    balance: 500000,
    emi: 10000,
    monthlyRate: 2,
  }, '2026-11-10'), 'Interest-only')

  // Paid off
  assert.equal(formatRemainingTenure({
    balance: 0,
    status: 'paid',
  }, '2026-11-10'), 'Paid off')

  // Zero interest hand loan with totalMonths
  assert.equal(formatRemainingTenure({
    balance: 135000,
    emi: 5000,
    rate: 0,
    totalMonths: 40,
  }, '2026-11-10'), '27 of 40 mo left')
})

test('parseCSV parses human-friendly CSV headers into debt objects', () => {
  const csv = `Loan Name,Bank,Loan Amount,Balance,EMI,Interest Rate,Tenure,Start Date,Due Date
Home Loan,SBI Bank,2500000,2100000,22000,8.5,240,2024-03-15,2026-12-05
Personal Loan,HDFC,500000,420000,15200,12.5,36,2025-01-10,2026-12-05`

  const rows = parseCSV(csv)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name, 'Home Loan')
  assert.equal(rows[0].lender, 'SBI Bank')
  assert.equal(rows[0].originalAmount, '2500000')
  assert.equal(rows[0].balance, '2100000')
  assert.equal(rows[0].emi, '22000')
  assert.equal(rows[0].rate, '8.5')
  assert.equal(rows[0].totalMonths, '240')

  const imported = parseDebtImport(rows)
  assert.equal(imported.ok, true)
  assert.equal(imported.debts.length, 2)
  assert.equal(imported.debts[0].name, 'Home Loan')
  assert.equal(imported.debts[0].originalAmount, 2500000)
  assert.equal(imported.debts[0].balance, 2100000)
})

test('calculatePaymentSplit auto-splits payment amount into principal and interest', () => {
  // Rohit Loan 1: Balance 279292, Rate 20%, Payment 15270
  // Monthly rate = 20 / 1200 = 1/60
  // Interest = round(279292 * 1/60 * 100) / 100 = 4654.87
  // Principal = 15270 - 4654.87 = 10615.13
  const split = calculatePaymentSplit({
    balance: 279292,
    rate: 20,
  }, 15270)

  assert.equal(split.interest, 4654.87)
  assert.equal(split.principal, 10615.13)
  assert.equal(split.fees, 0)
  assert.equal(Math.round((split.principal + split.interest) * 100) / 100, 15270)

  // 0% interest loan: 100% to principal
  const zeroInterestSplit = calculatePaymentSplit({
    balance: 135000,
    rate: 0,
  }, 5000)
  assert.equal(zeroInterestSplit.principal, 5000)
  assert.equal(zeroInterestSplit.interest, 0)
  assert.equal(zeroInterestSplit.fees, 0)

  // Payment smaller than monthly interest: all goes to interest
  const smallPayment = calculatePaymentSplit({
    balance: 100000,
    rate: 12, // 1000/mo interest
  }, 500)
  assert.equal(smallPayment.interest, 500)
  assert.equal(smallPayment.principal, 0)
})


