import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addRecurringExpenses,
  applyLinkedEmiPayments,
  syncLinkedEmiAmounts,
  syncRecurringExpenseToExpenses,
} from './recurring.js'

test('addRecurringExpenses generates monthly and EMI expenses with deterministic IDs', () => {
  const data = {
    recurringExpenses: [
      {
        id: 'rec_rent',
        name: 'Apartment Rent',
        amount: 20000,
        category: 'Rent',
        day: 5,
        startMonth: '2026-08',
        kind: 'monthly',
        accountId: 'acc_bank',
      },
      {
        id: 'rec_laptop_emi',
        name: 'Laptop EMI',
        amount: 5000,
        category: 'Gadgets',
        day: 10,
        startMonth: '2026-08',
        kind: 'emi',
        installments: 3, // Months: 2026-08 (0), 2026-09 (1), 2026-10 (2)
        accountId: 'acc_cc',
      },
    ],
    expenses: [],
  }

  // October is offset 2: both rent and the 3rd EMI should generate
  const updated = addRecurringExpenses(data, '2026-10')
  assert.equal(updated.expenses.length, 2)

  const rentExp = updated.expenses.find((e) => e.recurringId === 'rec_rent')
  assert.ok(rentExp)
  assert.equal(rentExp.id, 'recurring_rec_rent_2026-10')
  assert.equal(rentExp.date, '2026-10-05')
  assert.equal(rentExp.accountId, 'acc_bank')

  const emiExp = updated.expenses.find((e) => e.recurringId === 'rec_laptop_emi')
  assert.ok(emiExp)
  assert.equal(emiExp.id, 'recurring_rec_laptop_emi_2026-10')
  assert.equal(emiExp.date, '2026-10-10')
})

test('addRecurringExpenses terminates EMI after all installments are completed', () => {
  const data = {
    recurringExpenses: [
      {
        id: 'rec_phone_emi',
        name: 'Phone EMI',
        amount: 3000,
        category: 'Gadgets',
        day: 1,
        startMonth: '2026-08',
        kind: 'emi',
        installments: 2, // 2026-08 and 2026-09 only
      },
    ],
    expenses: [],
  }

  // In 2026-10 (offset 2 >= 2 installments), no expenses should be generated
  const updated = addRecurringExpenses(data, '2026-10')
  assert.equal(updated.expenses.length, 0)
})

test('addRecurringExpenses is idempotent and does not duplicate existing generated expenses', () => {
  const data = {
    recurringExpenses: [
      {
        id: 'rec_wifi',
        name: 'Broadband',
        amount: 999,
        category: 'Utilities',
        day: 15,
        startMonth: '2026-01',
        kind: 'monthly',
      },
    ],
    expenses: [
      {
        id: 'recurring_rec_wifi_2026-10',
        recurringId: 'rec_wifi',
        amount: 999,
        category: 'Utilities',
        date: '2026-10-15',
      },
    ],
  }

  const updated = addRecurringExpenses(data, '2026-10')
  assert.equal(updated.expenses.length, 1)
})

test('linked EMI schedule keeps the debt tracker monthly payment in sync', () => {
  const data = {
    recurringExpenses: [{
      id: 'home_emi',
      name: 'Home loan EMI',
      amount: 1000,
      category: 'Housing',
      day: 10,
      startMonth: '2026-10',
      kind: 'emi',
      installments: 12,
      debtId: 'home_loan',
    }],
    debts: [{
      id: 'home_loan',
      name: 'Home loan',
      originalAmount: 10000,
      balance: 10000,
      emi: 900,
    }],
  }

  const updated = syncLinkedEmiAmounts(data)
  assert.equal(updated.debts[0].emi, 1000)
  assert.equal(syncLinkedEmiAmounts(updated), updated)
})

test('linked EMI generation records one principal and interest payment against its debt', () => {
  const data = {
    recurringExpenses: [{
      id: 'home_emi',
      name: 'Home loan EMI',
      amount: 1000,
      category: 'Housing',
      day: 10,
      startMonth: '2026-10',
      kind: 'emi',
      installments: 2,
      debtId: 'home_loan',
    }],
    debts: [{
      id: 'home_loan',
      name: 'Home loan',
      originalAmount: 10000,
      balance: 10000,
      rate: 12,
      status: 'active',
    }],
    debtPayments: [],
    expenses: [],
  }

  const generated = addRecurringExpenses(data, '2026-10')
  const paid = applyLinkedEmiPayments(generated, '2026-10', undefined, '2026-10')

  assert.equal(paid.expenses[0].amount, 1000)
  assert.equal(paid.debts[0].balance, 9100)
  assert.equal(paid.debts[0].principalPaid, 900)
  assert.equal(paid.debts[0].interestPaid, 100)
  assert.equal(paid.debts[0].monthsRemaining, 1)
  assert.equal(paid.debts[0].nextDue, '2026-11-10')
  assert.deepEqual(paid.debtPayments[0], {
    id: 'recurring_emi_home_emi_2026-10',
    debtId: 'home_loan',
    amount: 1000,
    principal: 900,
    interest: 100,
    fees: 0,
    date: '2026-10-10',
    note: 'Home loan EMI · automatic EMI',
  })

  const repeated = applyLinkedEmiPayments(addRecurringExpenses(paid, '2026-10'), '2026-10', undefined, '2026-10')
  assert.deepEqual(repeated, paid)
})

test('linked EMI uses the smaller payoff amount and stops generating installments after payoff', () => {
  const data = {
    recurringExpenses: [{
      id: 'small_emi',
      name: 'Small loan EMI',
      amount: 1000,
      category: 'Loans',
      day: 5,
      startMonth: '2026-10',
      kind: 'emi',
      installments: 3,
      debtId: 'small_loan',
    }],
    debts: [{
      id: 'small_loan',
      name: 'Small loan',
      originalAmount: 500,
      balance: 500,
      rate: 12,
      status: 'active',
    }],
    debtPayments: [],
    expenses: [],
  }

  const paid = applyLinkedEmiPayments(addRecurringExpenses(data, '2026-10'), '2026-10', undefined, '2026-10')
  assert.equal(paid.expenses[0].amount, 505)
  assert.equal(paid.debts[0].balance, 0)
  assert.equal(paid.debts[0].status, 'paid')
  assert.equal(paid.debts[0].nextDue, null)
  assert.equal(addRecurringExpenses(paid, '2026-11').expenses.length, 1)
})

test('syncRecurringExpenseToExpenses updates matching materialized expenses for the month', () => {
  const expenses = [
    {
      id: 'recurring_rec_sip_2026-10',
      recurringId: 'rec_sip',
      amount: 5000,
      category: 'Investments',
      note: 'SIP',
      date: '2026-10-01',
      accountId: 'acc_old',
    },
    {
      id: 'exp_other',
      amount: 250,
      category: 'Food',
      date: '2026-10-02',
    },
  ]

  const updatedSchedule = {
    id: 'rec_sip',
    name: 'Nippon India SIP',
    amount: 6050,
    category: 'Investments',
    note: 'Nippon India SIP',
    day: 5,
    accountId: 'acc_new',
  }

  const result = syncRecurringExpenseToExpenses(expenses, updatedSchedule, '2026-10')
  assert.equal(result.updatedExpenses.length, 1)
  assert.equal(result.updatedExpenses[0].amount, 6050)
  assert.equal(result.updatedExpenses[0].note, 'Nippon India SIP')
  assert.equal(result.updatedExpenses[0].date, '2026-10-05')
  assert.equal(result.updatedExpenses[0].accountId, 'acc_new')

  const unchanged = result.expenses.find((e) => e.id === 'exp_other')
  assert.equal(unchanged.amount, 250)
})
