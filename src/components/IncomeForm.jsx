import { useState } from 'react'
import { formatMonthLabel, parseAmount } from '../utils/formatting.js'

export default function IncomeForm({ month, initialAmount = '', onSave, onCancel }) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [error, setError] = useState('')
  const isEdit = Boolean(initialAmount)

  function handleSubmit(event) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an income amount greater than zero.')
      return
    }
    onSave(value)
  }

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <form
        className="sheet"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{isEdit ? 'Edit Income' : 'Add Income'}</h2>
          <button type="button" className="text-btn" onClick={onCancel}>
            Close
          </button>
        </div>
        <p className="muted">{formatMonthLabel(month)}</p>
        <label className="field">
          <span>Monthly income</span>
          <div className="amount-input">
            <span>₹</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="80000"
            />
          </div>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-block">
          Save Income
        </button>
      </form>
    </div>
  )
}
