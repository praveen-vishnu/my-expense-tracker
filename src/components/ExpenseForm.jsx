import { useRef, useState } from 'react'
import { isValidDate, parseAmount, todayISO } from '../utils/formatting.js'
import ModalSheet from './ModalSheet.jsx'

export default function ExpenseForm({
  categories,
  initial,
  onSave,
  onCancel,
}) {
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category || categories[0] || '')
  const [date, setDate] = useState(initial?.date || todayISO())
  const [note, setNote] = useState(initial?.note || '')
  const [error, setError] = useState(null)
  const amountRef = useRef(null)
  const categoryRef = useRef(null)
  const dateRef = useRef(null)

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
    setError('')
    onSave({
      amount: value,
      category,
      date,
      note: note.trim(),
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

        <label className="field">
          <span>Amount</span>
          <div className="amount-input">
            <span>₹</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              required
              aria-invalid={error?.field === 'amount'}
              aria-describedby={error?.field === 'amount' ? 'expense-form-error' : undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="450"
            />
          </div>
        </label>

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
            placeholder="Lunch"
            maxLength={80}
          />
        </label>

        {error ? <p id="expense-form-error" className="form-error" role="alert">{error.message}</p> : null}

        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Save Changes' : 'Save Expense'}
        </button>
      </form>
    </ModalSheet>
  )
}
