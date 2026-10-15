import { useRef, useState, useMemo } from 'react'
import { isValidDate, parseAmount, todayISO, formatINR } from '../utils/formatting.js'
import ModalSheet from './ModalSheet.jsx'
import { IconUsers, IconCalculator } from '@tabler/icons-react'

export default function ExpenseForm({
  categories,
  accounts = [],
  initial,
  onSave,
  onCancel,
}) {
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category || categories[0] || '')
  const [date, setDate] = useState(initial?.date || todayISO())
  const [note, setNote] = useState(initial?.note || '')

  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || ''
  const [accountId, setAccountId] = useState(initial?.accountId || defaultAccId)

  // Split expense states
  const [isSplit, setIsSplit] = useState(Boolean(initial?.split))
  const [myShare, setMyShare] = useState(initial?.split?.myShare != null ? String(initial.split.myShare) : '')
  const [owedBy, setOwedBy] = useState(initial?.split?.owedBy || '')

  const [error, setError] = useState(null)
  const amountRef = useRef(null)
  const categoryRef = useRef(null)
  const dateRef = useRef(null)

  // In-line math preview
  const mathPreview = useMemo(() => {
    if (!amount || (!amount.includes('+') && !amount.includes('-') && !amount.includes('*') && !amount.includes('/'))) {
      return null
    }
    const evaluated = parseAmount(amount)
    return Number.isFinite(evaluated) && evaluated > 0 ? evaluated : null
  }, [amount])

  // Calculated split amount
  const parsedTotal = parseAmount(amount) || 0
  const parsedMyShare = parseAmount(myShare) || 0
  const calculatedOwed = Math.max(parsedTotal - parsedMyShare, 0)

  // Quick logging presets
  const presets = [
    { label: 'Chai / Coffee', amount: 30, category: categories.find((c) => /food|dine|dining|chai/i.test(c)) || categories[0], note: 'Tea / Coffee' },
    { label: 'Auto / Cab', amount: 120, category: categories.find((c) => /travel|transport|commute/i.test(c)) || categories[0], note: 'Commute' },
    { label: 'Groceries', amount: 350, category: categories.find((c) => /grocery|groceries|kirana/i.test(c)) || categories[0], note: 'Quick Groceries' },
    { label: 'Lunch / Dinner', amount: 450, category: categories.find((c) => /food|dine|dining/i.test(c)) || categories[0], note: 'Meal' },
  ]

  function applyPreset(preset) {
    setAmount(String(preset.amount))
    if (preset.category) setCategory(preset.category)
    if (preset.note) setNote(preset.note)
  }

  function handleAmountChange(val) {
    setAmount(val)
    if (isSplit && (!myShare || parseAmount(myShare) === parsedTotal / 2)) {
      const num = parseAmount(val)
      if (Number.isFinite(num) && num > 0) {
        setMyShare(String(Math.round(num / 2)))
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError({ field: 'amount', message: 'Enter an amount greater than zero.' })
      amountRef.current?.focus()
      return
    }
    if (!category) {
      setError({ field: 'category', message: 'Choose a category.' })
      categoryRef.current?.focus()
      return
    }
    if (!isValidDate(date)) {
      setError({ field: 'date', message: 'Choose a valid date.' })
      dateRef.current?.focus()
      return
    }

    if (isSplit) {
      const shareVal = parseAmount(myShare)
      if (!Number.isFinite(shareVal) || shareVal < 0 || shareVal > value) {
        setError({ field: 'split', message: 'Your share must be between 0 and the total amount.' })
        return
      }
    }

    setError(null)
    onSave({
      amount: value,
      category,
      date,
      note: note.trim(),
      accountId: accountId || null,
      split: isSplit
        ? {
            myShare: parseAmount(myShare) || 0,
            owedAmount: calculatedOwed,
            owedBy: owedBy.trim() || 'Friend',
            settled: initial?.split?.settled || false,
            settledDate: initial?.split?.settledDate || null,
            settledAccountId: initial?.split?.settledAccountId || null,
          }
        : null,
    })
  }

  const isEdit = Boolean(initial)

  return (
    <ModalSheet titleId="expense-form-title" initialFocusRef={amountRef} onDismiss={onCancel}>
      <form className="sheet-form" noValidate onSubmit={handleSubmit}>
        <div className="sheet-head">
          <h2 id="expense-form-title">{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button type="button" className="text-btn" onClick={onCancel}>
            Close
          </button>
        </div>

        {/* 1-TAP FREQUENT PRESETS */}
        {!isEdit ? (
          <div className="quick-presets-strip">
            <span className="preset-label">Quick Presets:</span>
            <div className="preset-chips">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.label} <small>₹{p.amount}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="field">
          <span className="field-label-row">
            <span>Amount</span>
            {mathPreview != null ? (
              <span className="math-preview-pill">
                <IconCalculator size={13} /> = {formatINR(mathPreview)}
              </span>
            ) : null}
          </span>
          <div className="amount-input">
            <span>₹</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="text"
              required
              aria-invalid={error?.field === 'amount'}
              aria-describedby={error?.field === 'amount' ? 'expense-form-error' : undefined}
              value={amount}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="e.g. 450 or 250 + 80"
            />
          </div>
        </label>

        {accounts.length > 0 ? (
          <label className="field">
            <span>Account / Payment method</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>Category</span>
          <select
            ref={categoryRef}
            value={category}
            required
            aria-invalid={error?.field === 'category'}
            aria-describedby={error?.field === 'category' ? 'expense-form-error' : undefined}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Date</span>
          <input
            ref={dateRef}
            type="date"
            value={date}
            required
            aria-invalid={error?.field === 'date'}
            aria-describedby={error?.field === 'date' ? 'expense-form-error' : undefined}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Note <em>(optional)</em></span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Lunch / Kirana / Fuel"
            maxLength={80}
          />
        </label>

        {/* SPLIT BILL SECTION */}
        <div className="split-expense-container">
          <label className="split-toggle-label">
            <input
              type="checkbox"
              checked={isSplit}
              onChange={(e) => {
                const next = e.target.checked
                setIsSplit(next)
                if (next && !myShare && parsedTotal > 0) {
                  setMyShare(String(Math.round(parsedTotal / 2)))
                }
              }}
            />
            <span className="split-toggle-text">
              <IconUsers size={16} />
              <span>Split with friends / Reimbursable</span>
            </span>
          </label>

          {isSplit ? (
            <div className="split-details-card">
              <div className="split-inputs-row">
                <label className="field">
                  <span>My Share</span>
                  <div className="amount-input">
                    <span>₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={myShare}
                      onChange={(e) => setMyShare(e.target.value)}
                      placeholder="My portion"
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Owed By</span>
                  <input
                    type="text"
                    value={owedBy}
                    onChange={(e) => setOwedBy(e.target.value)}
                    placeholder="Friend's Name"
                  />
                </label>
              </div>

              <div className="split-summary-pill">
                <span>Friend owes: <strong>{formatINR(calculatedOwed)}</strong></span>
                <small>Only your share ({formatINR(parsedMyShare)}) counts toward budget</small>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p id="expense-form-error" className="form-error" role="alert">{error.message}</p> : null}

        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Save Changes' : 'Save Expense'}
        </button>
      </form>
    </ModalSheet>
  )
}
