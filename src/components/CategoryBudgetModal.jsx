import { useState } from 'react'
import ModalSheet from './ModalSheet.jsx'
import { formatINR, formatMonthLabel } from '../utils/formatting.js'
import { IconCopy, IconCheck, IconTarget } from '@tabler/icons-react'

export default function CategoryBudgetModal({
  categories = [],
  month,
  currentBudgets = {},
  previousBudgets = {},
  previousMonthKey,
  categoryTotalsMap = {},
  onSaveCategoryBudget,
  onCopyCategoryBudgets,
  onDismiss,
}) {
  const [budgetInputs, setBudgetInputs] = useState(() => {
    const initial = {}
    for (const cat of categories) {
      initial[cat] = currentBudgets[cat] ? String(currentBudgets[cat]) : ''
    }
    return initial
  })

  function handleInputChange(cat, val) {
    setBudgetInputs((prev) => ({
      ...prev,
      [cat]: val,
    }))
  }

  function handleCopyPrevious() {
    if (!previousBudgets || !Object.keys(previousBudgets).length) return
    const next = { ...budgetInputs }
    for (const [cat, val] of Object.entries(previousBudgets)) {
      if (categories.includes(cat)) {
        next[cat] = String(val)
      }
    }
    setBudgetInputs(next)
  }

  function handleSaveAll() {
    for (const cat of categories) {
      const raw = budgetInputs[cat]
      const num = raw === '' ? 0 : Number(raw)
      onSaveCategoryBudget(month, cat, num)
    }
    onDismiss()
  }

  const hasPrevious = previousBudgets && Object.keys(previousBudgets).length > 0
  const totalAllocated = Object.values(budgetInputs)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((sum, n) => sum + n, 0)

  return (
    <ModalSheet titleId="cat-budget-modal-title" className="sheet-wide" onDismiss={onDismiss}>
      <div className="cat-budget-modal-shell">
        <div className="sheet-head">
          <div>
            <h2 id="cat-budget-modal-title">Category Budgets</h2>
            <p className="muted">Set spending targets for {formatMonthLabel(month)}.</p>
          </div>
          <button type="button" className="text-btn" onClick={onDismiss}>
            Close
          </button>
        </div>

        <div className="cat-budget-header-bar">
          <div className="cat-budget-summary">
            <span>Total Category Budget:</span>
            <strong className="money">{formatINR(totalAllocated)}</strong>
          </div>
          {hasPrevious ? (
            <button
              type="button"
              className="text-btn copy-btn"
              onClick={handleCopyPrevious}
              title={`Copy category budgets from ${formatMonthLabel(previousMonthKey)}`}
            >
              <IconCopy size={16} />
              Copy from {formatMonthLabel(previousMonthKey).split(' ')[0]}
            </button>
          ) : null}
        </div>

        <div className="cat-budget-list-container">
          <table className="cat-budget-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Spent so far</th>
                <th style={{ width: '180px' }}>Budget Target (₹)</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const spent = categoryTotalsMap[cat] || 0
                const targetVal = Number(budgetInputs[cat]) || 0
                const remaining = targetVal > 0 ? targetVal - spent : null
                const percent = targetVal > 0 ? (spent / targetVal) * 100 : 0

                return (
                  <tr key={cat}>
                    <td>
                      <strong>{cat}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-mono">
                      <span className={spent > 0 ? 'money spent' : 'muted'}>{formatINR(spent)}</span>
                    </td>
                    <td>
                      <div className="cat-budget-input-wrap">
                        <span className="input-prefix">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={budgetInputs[cat] || ''}
                          onChange={(e) => handleInputChange(cat, e.target.value)}
                          placeholder="No limit"
                          className="cat-budget-input"
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {targetVal > 0 ? (
                        spent > targetVal ? (
                          <span className="pill pill-warn">+{formatINR(spent - targetVal)} over</span>
                        ) : (
                          <span className="pill pill-ok">{Math.round(percent)}% used</span>
                        )
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="cat-budget-actions">
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSaveAll}>
            <IconCheck size={18} />
            Save Budgets
          </button>
        </div>
      </div>
    </ModalSheet>
  )
}
