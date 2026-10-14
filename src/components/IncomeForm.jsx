import { useRef, useState } from 'react'
import { formatMonthLabel, parseAmount } from '../utils/formatting.js'
import ModalSheet from './ModalSheet.jsx'

export default function IncomeForm({
  month,
  initialAmount = '',
  accounts = [],
  initialAccountId = '',
  onSave,
  onCancel,
}) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const defaultAcc = accounts.find((a) => a.isDefault && a.type !== 'credit_card') || accounts.find((a) => a.type !== 'credit_card') || accounts[0]
  const [accountId, setAccountId] = useState(initialAccountId || defaultAcc?.id || '')
  const [error, setError] = useState(null)
  const amountRef = useRef(null)
  const isEdit = Boolean(initialAmount)

  function handleSubmit(event) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError({ field: 'amount', message: 'Enter an income amount greater than zero.' })
      amountRef.current?.focus()
      return
    }
    onSave(value, accountId || null)
  }

  return (
    <ModalSheet titleId="income-form-title" descriptionId="income-form-month" initialFocusRef={amountRef} onDismiss={onCancel}>
      <form className="sheet-form" noValidate onSubmit={handleSubmit}>
        <div className="sheet-head">
          <h2 id="income-form-title">{isEdit ? 'Edit Income' : 'Add Income'}</h2>
          <button type="button" className="text-btn" onClick={onCancel}>
            Close
          </button>
        </div>
        <p id="income-form-month" className="muted">{formatMonthLabel(month)}</p>

        <label className="field">
          <span>Monthly income</span>
          <div className="amount-input">
            <span>₹</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'income-form-error' : undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="80000"
            />
          </div>
        </label>

        {accounts.length ? (
          <label className="field">
            <span>Deposit into account</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">None / Unassigned</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {error ? <p id="income-form-error" className="form-error" role="alert">{error.message}</p> : null}
        <button type="submit" className="btn btn-primary btn-block">
          Save Income
        </button>
      </form>
    </ModalSheet>
  )
}
