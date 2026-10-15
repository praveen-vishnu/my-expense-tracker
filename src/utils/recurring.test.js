import test from 'node:test'
import assert from 'node:assert/strict'
import { addRecurringExpenses } from './recurring.js'

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

