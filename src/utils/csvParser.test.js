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

test('parseBankStatementCSV parses tab-separated or semicolon-separated text statements accurately', () => {
  const tsvText = `Date\tDescription\tDebit\tCredit\n10/09/2026\tSWIGGY BANGALORE\t₹540.00\t\n11/09/2026\tUPI-NETFLIX-SUBSCRIPTION\t199\t\n`

  const result = parseBankStatementCSV(tsvText, {
    availableCategories: ['Food', 'Entertainment'],
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalParsed, 2)
  assert.equal(result.transactions[0].amount, 540)
  assert.equal(result.transactions[0].category, 'Food')
  assert.equal(result.transactions[0].date, '2026-09-10')
  assert.equal(result.transactions[1].amount, 199)
  assert.equal(result.transactions[1].category, 'Entertainment')
  assert.equal(result.transactions[1].date, '2026-09-11')
})

test('parseBankStatementRows parses 2D arrays extracted from Excel sheets (.xls, .xlsx)', async () => {
  const { parseBankStatementRows } = await import('./csvParser.js')
  const excelSheetRows = [
    ['Bank Account Statement', '', '', ''],
    ['Account Number: 1234567890', '', '', ''],
    ['Txn Date', 'Particulars', 'Debit Amount', 'Credit Amount'],
    ['14-Sep-2026', 'BLINKIT QUICK COMMERCE', '620.50', ''],
    ['15-Sep-2026', 'SALARY REVERSAL', '', '1500.00'],
    ['16-Sep-2026', 'TATA POWER ELECTRICITY BILL', '1,450.00', ''],
  ]

  const result = parseBankStatementRows(excelSheetRows, {
    availableCategories: ['Food', 'Bills'],
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalParsed, 2) // Excludes credit amount row
  assert.equal(result.transactions[0].amount, 620.5)
  assert.equal(result.transactions[0].category, 'Food')
  assert.equal(result.transactions[0].date, '2026-09-14')
  assert.equal(result.transactions[1].amount, 1450)
  assert.equal(result.transactions[1].category, 'Bills')
  assert.equal(result.transactions[1].date, '2026-09-16')
})

test('parseBankStatementCSV correctly identifies and matches recurring EMI, Rent, and Bills', () => {
  const statementCSV = `
Date,Narration,Withdrawal,Deposit
05/10/2026,UPI-RENT-PAYMENT-FOR-OCT,25000.00,
07/10/2026,ACH D- BAJAJ FINANCE LOAN EMI,12450.00,
08/10/2026,SWIGGY BANGALORE,350.00,
`

  const existingExpenses = [
    // Pre-generated recurring rent (due on the 1st, paid on the 5th)
    {
      id: 'recurring_rent_2026-10',
      recurringId: 'sched_rent',
      date: '2026-10-01',
      amount: 25000,
      note: 'Home Rent',
      category: 'Rent',
    },
    // Pre-generated recurring EMI (due on the 5th, auto-debited on the 7th)
    {
      id: 'recurring_emi_2026-10',
      recurringId: 'sched_emi',
      date: '2026-10-05',
      amount: 12450,
      note: 'Bajaj Finance EMI',
      category: 'EMI',
    },
  ]

  const result = parseBankStatementCSV(statementCSV, {
    availableCategories: ['Rent', 'EMI', 'Food'],
    existingExpenses,
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalParsed, 3)
  assert.equal(result.duplicateCount, 2)
  assert.equal(result.recurringCount, 2)

  // 1. Rent transaction matches recurring rent
  assert.equal(result.transactions[0].isRecurringMatch, true)
  assert.equal(result.transactions[0].isDuplicate, true)
  assert.equal(result.transactions[0].selected, false) // unselected by default
  assert.equal(result.transactions[0].matchedExpenseId, 'recurring_rent_2026-10')

  // 2. EMI transaction matches recurring EMI
  assert.equal(result.transactions[1].isRecurringMatch, true)
  assert.equal(result.transactions[1].isDuplicate, true)
  assert.equal(result.transactions[1].selected, false)
  assert.equal(result.transactions[1].matchedExpenseId, 'recurring_emi_2026-10')

  // 3. Swiggy transaction is regular new expense
  assert.equal(result.transactions[2].isRecurringMatch, false)
  assert.equal(result.transactions[2].isDuplicate, false)
  assert.equal(result.transactions[2].selected, true)
})

test('does not falsely match recurring expense when amount is identical but notes contradict (e.g. SIP vs Croma)', () => {
  const statementCSV = `
Date,Narration,Withdrawal,Deposit
05/10/2026,UPI-CROMA ELECTRONICS-croma@hdfcbank-9988,6050.00,
`

  const existingExpenses = [
    {
      id: 'recurring_sip_2026-10',
      recurringId: 'sched_sip',
      date: '2026-10-05',
      amount: 6050,
      note: 'SIP - Nippon India Growth Fund',
      category: 'Investments',
    },
  ]

  const result = parseBankStatementCSV(statementCSV, {
    availableCategories: ['Investments', 'Shopping'],
    existingExpenses,
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalParsed, 1)
  assert.equal(result.duplicateCount, 0)
  assert.equal(result.recurringCount, 0)

  const [t1] = result.transactions
  assert.equal(t1.amount, 6050)
  assert.equal(t1.isDuplicate, false)
  assert.equal(t1.isRecurringMatch, false)
  assert.equal(t1.selected, true) // Selected for import because it is Croma, not SIP!
})
