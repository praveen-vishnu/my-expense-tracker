import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeData } from './storage.js'
import { applyDebtPayment, normalizeDebt, normalizeDebtPayment, parseDebtImport } from './debts.js'

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
