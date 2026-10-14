import { useRef, useState, useMemo } from 'react'
import { formatINR, parseAmount, todayISO, isValidDate } from '../utils/formatting.js'
import ModalSheet from './ModalSheet.jsx'

export default function TransferModal({
  accounts = [],
  accountBalances = null,
  initialFromAccountId = '',
  initialToAccountId = '',
  initialAmount = '',
  onSaveTransfer,
  onCancel,
}) {
  const liquidAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card'),
    [accounts]
  )
  const defaultFrom = initialFromAccountId || liquidAccounts[0]?.id || accounts[0]?.id || ''
  const defaultTo = initialToAccountId || (accounts.find((a) => a.id !== defaultFrom)?.id || '')

  const [fromAccountId, setFromAccountId] = useState(defaultFrom)
  const [toAccountId, setToAccountId] = useState(defaultTo)
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [date, setDate] = useState(() => todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const amountRef = useRef(null)

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isPayingCreditCard = toAccount?.type === 'credit_card'

  const toAccBalanceInfo = accountBalances?.accounts?.find((a) => a.id === toAccountId)
  const fromAccBalanceInfo = accountBalances?.accounts?.find((a) => a.id === fromAccountId)

  function handleSetFullOutstanding() {
    if (toAccBalanceInfo?.outstanding && toAccBalanceInfo.outstanding > 0) {
      setAmount(String(toAccBalanceInfo.outstanding))
      setError(null)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!fromAccountId) {
      setError({ field: 'from', message: 'Choose a source account.' })
      return
    }
    if (!toAccountId) {
      setError({ field: 'to', message: 'Choose a destination account.' })
      return
    }
    if (fromAccountId === toAccountId) {
      setError({ field: 'to', message: 'Source and destination accounts must be different.' })
      return
    }

    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError({ field: 'amount', message: 'Enter a transfer amount greater than zero.' })
      amountRef.current?.focus()
      return
    }

    if (!isValidDate(date)) {
      setError({ field: 'date', message: 'Enter a valid date.' })
      return
    }

    onSaveTransfer({
      fromAccountId,
      toAccountId,
      amount: value,
      date,
      note: note.trim() || (isPayingCreditCard ? `Payment to ${toAccount.name}` : `Transfer to ${toAccount.name}`),
    })
  }

  return (
    <ModalSheet
      titleId="transfer-form-title"
      descriptionId="transfer-form-desc"
      initialFocusRef={amountRef}
      onDismiss={onCancel}
    >
      <form className="sheet-form" noValidate onSubmit={handleSubmit}>
        <div className="sheet-head">
          <h2 id="transfer-form-title">
            {isPayingCreditCard ? 'Pay Credit Card Bill' : 'Transfer Between Accounts'}
          </h2>
          <button type="button" className="text-btn" onClick={onCancel}>
            Close
          </button>
        </div>
        <p id="transfer-form-desc" className="muted">
          {isPayingCreditCard
            ? 'Settle credit card balance directly from your bank without inflating expenses.'
            : 'Move money between your bank, cash, or wallet accounts.'}
        </p>

        <div className="transfer-accounts-grid">
          <label className="field">
            <span>From (Paying Account)</span>
            <select
              value={fromAccountId}
              onChange={(e) => {
                setFromAccountId(e.target.value)
                setError(null)
              }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} disabled={acc.id === toAccountId}>
                  {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                </option>
              ))}
            </select>
            {fromAccBalanceInfo != null ? (
              <small className="field-hint">
                Balance: <strong>{formatINR(fromAccBalanceInfo.currentBalance)}</strong>
              </small>
            ) : null}
          </label>

          <label className="field">
            <span>To (Receiving Account)</span>
            <select
              value={toAccountId}
              onChange={(e) => {
                setToAccountId(e.target.value)
                setError(null)
              }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                  {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                </option>
              ))}
            </select>
            {toAccBalanceInfo != null ? (
              <small className="field-hint">
                {toAccBalanceInfo.type === 'credit_card' ? (
                  <>Outstanding: <strong className="money spent">{formatINR(toAccBalanceInfo.outstanding)}</strong></>
                ) : (
                  <>Balance: <strong>{formatINR(toAccBalanceInfo.currentBalance)}</strong></>
                )}
              </small>
            ) : null}
          </label>
        </div>

        {isPayingCreditCard && toAccBalanceInfo?.outstanding > 0 ? (
          <div className="transfer-quick-action">
            <span>Outstanding due: <strong>{formatINR(toAccBalanceInfo.outstanding)}</strong></span>
            <button
              type="button"
              className="text-btn primary"
              onClick={handleSetFullOutstanding}
            >
              Pay Full Amount
            </button>
          </div>
        ) : null}

        <label className="field">
          <span>Amount</span>
          <div className="amount-input">
            <span>₹</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              required
              aria-invalid={Boolean(error && error.field === 'amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
            />
          </div>
        </label>

        <label className="field">
          <span>Transfer Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isPayingCreditCard ? 'Monthly card bill payment' : 'ATM withdrawal / transfer'}
          />
        </label>

        {error ? (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block">
          {isPayingCreditCard ? 'Confirm Bill Payment' : 'Confirm Transfer'}
        </button>
      </form>
    </ModalSheet>
  )
}
