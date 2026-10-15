import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileRows } from './reconcile.js'

const sip = { id: 'sip', note: 'SIP', amount: 6050, category: 'Investments', date: '2026-10-05' }
const mf = { id: 'mf', note: 'Mutual Fund', amount: 5000, category: 'Investments', date: '2026-10-06' }
const sip5k = { id: 'sip5k', note: 'SIP', amount: 5000, category: 'Investments', date: '2026-10-05' }
const elec = { id: 'elec', note: 'Electricity', amount: 1840, category: 'Bills', date: '2026-10-10' }
const emi = { id: 'emi', note: 'Car EMI', amount: 12500, category: 'EMI', date: '2026-10-07' }
const rent = { id: 'rent', note: 'Rent', amount: 25000, category: 'Bills', date: '2026-10-01' }
const eom = { id: 'eom', note: 'SIP', amount: 3000, category: 'Investments', date: '2026-10-31' }

const aliasICCL = { scheduleId: 'sip', key: 'indian clearing corp', confirmedCount: 1, rejectedCount: 0 }
const aliasRent = { scheduleId: 'rent', key: 'upi ramesh kumar ramesh oksbi', confirmedCount: 2, rejectedCount: 0 }
const aliasRejected = { scheduleId: 'sip', key: 'indian clearing corp', confirmedCount: 0, rejectedCount: 2 }

const r = (rawNarration, amount, date, category = 'Other') => ({ rawNarration, amount, date, category })

const SCENARIOS = [
  ['S1 ICCL narration vs "SIP" (no shared words)',
    [r('Indian Clearing Corp-0000zms85ehm', 6050, '2026-10-06')], [sip], [], [['linked', 'sip']]],
  ['S2 Croma purchase, same amount, 20 days later',
    [r('POS CROMA RETAIL', 6050, '2026-10-25', 'Shopping')], [sip], [], [['new', null]]],
  ['S3 Amazon, same amount, SAME day as SIP',
    [r('UPI AMAZON PAY INDIA 442211', 6050, '2026-10-05', 'Shopping')], [sip], [], [['new', null]]],
  ['S4 Unknown merchant, same amount, near date',
    [r('UPI/ABC TRADERS/998877', 6050, '2026-10-06')], [sip], [], [['suggested', 'sip']]],
  ['S5 Learned alias, new reference suffix',
    [r('Indian Clearing Corp-0000abc12xyz', 6050, '2026-10-12')], [sip], [aliasICCL], [['linked', 'sip']]],
  ['S6 Two schedules share the amount (ICCL row)',
    [r('Indian Clearing Corp-0000zms85ehm', 5000, '2026-10-05')], [sip5k, mf], [], [['suggested', 'sip5k']]],
  ['S7 Same ICCL amount twice, one schedule',
    [r('Indian Clearing Corp-0000aaa11bbb', 6050, '2026-10-06'), r('Indian Clearing Corp-0000ccc22ddd', 6050, '2026-10-20')],
    [sip], [], [['linked', 'sip'], ['new', null]]],
  ['S8 SIP step-up +10% with alias',
    [r('Indian Clearing Corp-0000zms85ehm', 6655, '2026-10-05')], [sip], [aliasICCL], [['suggested', 'sip']]],
  ['S9 CAMS vs "Mutual Fund"',
    [r('CAMS-MF-SIP 55102938', 5000, '2026-10-06')], [mf], [], [['linked', 'mf']]],
  ['S10 BillDesk vs "Electricity", 3 days late',
    [r('BILLDESK*TNEB 7788990011', 1840, '2026-10-13')], [elec], [], [['linked', 'elec']]],
  ['S11 BBPS row vs "SIP", same amount (class conflict)',
    [r('BBPS Electricity 1234567', 6050, '2026-10-05')], [sip], [], [['new', null]]],
  ['S12 Month boundary (schedule 31 Oct, debit 2 Nov, rolling window)',
    [r('Indian Clearing Corp-0000zms85ehm', 3000, '2026-11-02')], [eom], [], [['linked', 'eom']]],
  ['S13 Rejected alias stays quiet',
    [r('Indian Clearing Corp-0000zms85ehm', 6050, '2026-10-05')], [sip], [aliasRejected], [['new', null]]],
  ['S14 Rent via UPI to a person, alias saved',
    [r('UPI-RAMESH KUMAR-ramesh@oksbi-4455667788', 25000, '2026-10-02')], [rent], [aliasRent], [['linked', 'rent']]],
  ['S15 NACH debit vs "Car EMI"',
    [r('NACH-DR-HDFC BANK LTD-LN0091234', 12500, '2026-10-07')], [emi], [], [['linked', 'emi']]],
  ['S16 Paise rounding (6050.004 vs 6050)',
    [r('Indian Clearing Corp-0000zms85ehm', 6050.004, '2026-10-05')], [sip], [], [['linked', 'sip']]],
  ['S17 Same amount, no date proximity, unknown merchant',
    [r('UPI/ABC TRADERS/998877', 6050, '2026-10-25')], [sip], [], [['new', null]]],
  ['S18 Mixed statement, 4 rows, 3 schedules',
    [r('Indian Clearing Corp-0000zms85ehm', 6050, '2026-10-06'), r('BILLDESK*TNEB 1', 1840, '2026-10-11'),
      r('POS CROMA', 6050, '2026-10-18', 'Shopping'), r('UPI SWIGGY', 450, '2026-10-12', 'Food')],
    [sip, elec, emi], [], [['linked', 'sip'], ['linked', 'elec'], ['new', null], ['new', null]]],
]

for (const [name, rows, schedules, aliases, expected] of SCENARIOS) {
  test(`Reconciliation Scenario: ${name}`, () => {
    const got = reconcileRows(rows, schedules, { aliases })
    assert.equal(got.length, expected.length)
    got.forEach((g, i) => {
      const [expectedStatus, expectedScheduleId] = expected[i]
      assert.equal(
        g.status,
        expectedStatus,
        `Row ${i + 1} status mismatch in "${name}". Got: ${g.status}, Expected: ${expectedStatus}. Reasons: ${g.reasons.join('; ')}`
      )
      assert.equal(
        g.scheduleId,
        expectedScheduleId,
        `Row ${i + 1} scheduleId mismatch in "${name}". Got: ${g.scheduleId}, Expected: ${expectedScheduleId}`
      )
    })
  })
}
