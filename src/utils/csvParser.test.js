import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanNarration, predictCategory, parseDateToISO, parseBankStatementCSV } from './csvParser.js'

test('cleanNarration simplifies cryptic UPI and POS narrations', () => {
  assert.equal(cleanNarration('UPI/428192837/SWIGGY/BANGALORE/PYMNT'), 'Swiggy')
  assert.equal(cleanNarration('POS 40129841 ZOMATO GURGAON'), 'Zomato')
  assert.equal(cleanNarration('ACH D- DMART SUPERMARKET'), 'Dmart Supermarket')
})

test('predictCategory maps merchants to correct spending category', () => {
  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Other']
  assert.equal(predictCategory('UPI/Swiggy Bangalore', categories), 'Food')
  assert.equal(predictCategory('Uber India Systems', categories), 'Transport')
  assert.equal(predictCategory('Amazon Pay Marketplace', categories), 'Shopping')
  assert.equal(predictCategory('Tata Power Electricity', categories), 'Bills')
})

test('parseDateToISO handles Indian and standard date patterns', () => {
  assert.equal(parseDateToISO('15/09/2026'), '2026-09-15')
  assert.equal(parseDateToISO('05-10-2026'), '2026-10-05')
  assert.equal(parseDateToISO('2026-08-20'), '2026-08-20')
  assert.equal(parseDateToISO('12 Sep 2026'), '2026-09-12')
})

test('parseBankStatementCSV parses HDFC CSV with smart category and duplicate detection', () => {
  const hdfcCSV = `
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
02/09/2026,UPI/428192837/SWIGGY/BANGALORE/PYMNT,12345,02/09/2026,450.00,,50000.00
03/09/2026,UBER RIDE BANGALORE,54321,03/09/2026,320.00,,49680.00
04/09/2026,SALARY CREDIT,99999,04/09/2026,,80000.00,129680.00
`

  const existingExpenses = [
    { date: '2026-09-02', amount: 450, note: 'Swiggy', category: 'Food' }
  ]

  const result = parseBankStatementCSV(hdfcCSV, {
    availableCategories: ['Food', 'Transport', 'Shopping'],
    existingExpenses,
    defaultAccountId: 'acc_hdfc'
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalParsed, 2) // Skips salary deposit (Withdrawal Amt empty)
  assert.equal(result.duplicateCount, 1) // First transaction is duplicate

  const [t1, t2] = result.transactions
  assert.equal(t1.amount, 450)
  assert.equal(t1.category, 'Food')
  assert.equal(t1.isDuplicate, true)
  assert.equal(t1.selected, false) // unselected because duplicate

  assert.equal(t2.amount, 320)
  assert.equal(t2.category, 'Transport')
  assert.equal(t2.isDuplicate, false)
  assert.equal(t2.selected, true)
})
