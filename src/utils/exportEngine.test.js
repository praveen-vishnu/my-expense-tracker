import test from 'node:test'
import assert from 'node:assert/strict'
import { generateExpensesCSV } from './exportEngine.js'

test('generateExpensesCSV creates properly escaped RFC 4180 CSV string with accounts', () => {
  const accounts = [
    { id: 'acc_1', name: 'HDFC Bank', type: 'bank' },
    { id: 'acc_2', name: 'ICICI, CC', type: 'credit_card' },
  ]

  const expenses = [
    {
      id: 'e1',
      date: '2026-10-01',
      category: 'Food',
      amount: 450,
      note: 'Dinner at "Bawarchi", Hyderabad',
      accountId: 'acc_1',
    },
    {
      id: 'e2',
      date: '2026-10-02',
      category: 'Shopping',
      amount: 1200.5,
      note: 'New shoes',
      accountId: 'acc_2',
    },
    {
      id: 'e3',
      date: '2026-10-03',
      category: 'Other',
      amount: 50,
      note: null,
      accountId: null,
    },
  ]

  const csv = generateExpensesCSV(expenses, accounts)
  const lines = csv.split('\r\n')

  assert.equal(lines.length, 4) // Header + 3 rows
  assert.ok(lines[0].includes('Amount (INR)'))

  // First row checks escaped quotes and commas in notes
  assert.ok(lines[1].includes('"2026-10-01"'))
  assert.ok(lines[1].includes('"450.00"'))
  assert.ok(lines[1].includes('"HDFC Bank"'))
  assert.ok(lines[1].includes('"Dinner at ""Bawarchi"", Hyderabad"'))

  // Second row checks account with comma
  assert.ok(lines[2].includes('"ICICI, CC"'))
  assert.ok(lines[2].includes('"credit_card"'))

  // Third row checks unassigned account
  assert.ok(lines[3].includes('"Unassigned"'))
})
