import { useState } from 'react'
import { isValidDate, parseAmount, todayISO } from '../utils/formatting.js'

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
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!category) {
      setError('Choose a category.')
      return
    }
    if (!isValidDate(date)) {
      setError('Choose a valid date.')
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
    <div className="overlay" role="presentation" onClick={onCancel}>
      <form
        className="sheet"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button type="button" className="text-btn" onClick={onCancel}>
            Close
          </button>
        </div>

        <label className="field">
          <span>Amount</span>
          <div className="amount-input">
            <span>₹</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="450"
            />
          </div>
        </label>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
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

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Save Changes' : 'Save Expense'}
        </button>
      </form>
    </div>
  )
}
