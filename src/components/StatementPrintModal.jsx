import ModalSheet from './ModalSheet.jsx'
import { formatINR, formatMonthLabel, formatShortDate } from '../utils/formatting.js'
import { IconPrinter } from '@tabler/icons-react'

export default function StatementPrintModal({
  expenses = [],
  accounts = [],
  month,
  title = 'Monthly Expense Statement',
  onDismiss,
}) {
  const accountMap = new Map((accounts || []).map((a) => [a.id, a.name]))
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Account breakdown
  const accountTotals = new Map()
  let unassignedTotal = 0
  for (const exp of expenses) {
    if (exp.accountId && accountMap.has(exp.accountId)) {
      const name = accountMap.get(exp.accountId)
      accountTotals.set(name, (accountTotals.get(name) || 0) + exp.amount)
    } else {
      unassignedTotal += exp.amount
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <ModalSheet titleId="print-statement-title" className="sheet-wide statement-modal-sheet" onDismiss={onDismiss}>
      <div className="statement-preview-container">
        <div className="statement-actions-bar no-print">
          <div>
            <h2 id="print-statement-title">Statement Preview</h2>
            <p className="muted">Ready for print or export as PDF.</p>
          </div>
          <div className="statement-btn-group">
            <button type="button" className="btn btn-primary print-trigger-btn" onClick={handlePrint}>
              <IconPrinter size={18} />
              Print / Save as PDF
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              Close
            </button>
          </div>
        </div>

        {/* PRINTABLE LETTERHEAD SHEET */}
        <div className="printable-statement" id="printable-statement-area">
          <header className="statement-header">
            <div className="statement-brand">
              <h1>Khaata</h1>
              <p>Personal Financial Statement & Expense Log</p>
            </div>
            <div className="statement-meta-info">
              <p><strong>Period:</strong> {month ? formatMonthLabel(month) : 'Custom Period'}</p>
              <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </header>

          <div className="statement-metrics-summary">
            <div className="statement-metric-box">
              <small>Total Expenses Logged</small>
              <strong>{expenses.length}</strong>
            </div>
            <div className="statement-metric-box">
              <small>Total Amount Spent</small>
              <strong className="money spent">{formatINR(totalSpent)}</strong>
            </div>
            <div className="statement-metric-box">
              <small>Average per Expense</small>
              <strong className="money">{formatINR(expenses.length ? totalSpent / expenses.length : 0)}</strong>
            </div>
          </div>

          {accountTotals.size > 0 ? (
            <div className="statement-accounts-breakdown">
              <h3>Spending by Account</h3>
              <div className="statement-acc-chips">
                {[...accountTotals.entries()].map(([name, sum]) => (
                  <div key={name} className="statement-acc-chip">
                    <span>{name}</span>
                    <strong className="money">{formatINR(sum)}</strong>
                  </div>
                ))}
                {unassignedTotal > 0 ? (
                  <div className="statement-acc-chip">
                    <span>Unassigned</span>
                    <strong className="money">{formatINR(unassignedTotal)}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Date</th>
                  <th style={{ width: '30%' }}>Description / Merchant</th>
                  <th style={{ width: '22%' }}>Category</th>
                  <th style={{ width: '18%' }}>Account</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="font-mono">{formatShortDate(exp.date)}</td>
                    <td><strong>{exp.note || '—'}</strong></td>
                    <td>{exp.category}</td>
                    <td>{exp.accountId ? accountMap.get(exp.accountId) || 'Account' : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="font-mono">{formatINR(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="statement-footer">
            <p>Generated automatically via Khaata · Private & client-side verified.</p>
          </footer>
        </div>
      </div>
    </ModalSheet>
  )
}
