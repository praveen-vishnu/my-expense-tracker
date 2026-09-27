import { useEffect, useRef, useState } from 'react'
import { parseImportedJson } from '../utils/storage.js'
import { formatINR, formatMonthLabel, parseAmount } from '../utils/formatting.js'
import { createId } from '../utils/formatting.js'

export default function Settings({
  data,
  accountEmail,
  onSignOut,
  onImport,
  onClear,
  onAddCategory,
  month,
  budget = 0,
  onSaveBudget,
  onAddRecurring,
  onDeleteRecurring,
}) {
  const fileRef = useRef(null)
  const budgetInputRef = useRef(null)
  const categoryInputRef = useRef(null)
  const scheduleFields = useRef({})
  const [categoryName, setCategoryName] = useState('')
  const [feedback, setFeedback] = useState({ section: '', error: '', message: '', field: '' })
  const [budgetInput, setBudgetInput] = useState(budget ? String(budget) : '')
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleAmount, setScheduleAmount] = useState('')
  const [scheduleCategory, setScheduleCategory] = useState(data.categories[0] || '')
  const [scheduleDay, setScheduleDay] = useState('1')
  const [scheduleKind, setScheduleKind] = useState('monthly')
  const [scheduleInstallments, setScheduleInstallments] = useState('')

  useEffect(() => {
    setBudgetInput(budget ? String(budget) : '')
  }, [month, budget])

  function reportError(section, error, field = '') {
    setFeedback({ section, error, message: '', field })
    if (section === 'budget') budgetInputRef.current?.focus()
    if (section === 'category') categoryInputRef.current?.focus()
    if (section === 'schedule') scheduleFields.current[field]?.focus()
  }

  function reportMessage(section, message) {
    setFeedback({ section, error: '', message, field: '' })
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'khaata-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    reportMessage('data', 'Backup downloaded.')
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseImportedJson(String(reader.result || ''))
      if (!result.ok) {
        setFeedback({ section: 'data', error: result.error, message: '', field: '' })
        return
      }
      onImport(result.data)
      reportMessage('data', 'Data imported.')
    }
    reader.onerror = () => setFeedback({ section: 'data', error: 'The selected file could not be read.', message: '', field: '' })
    reader.readAsText(file)
  }

  function handleAddCategory(event) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      reportError('category', 'Enter a category name.', 'name')
      return
    }
    if (data.categories.some((item) => item.toLowerCase() === name.toLowerCase())) {
      reportError('category', 'That category already exists.', 'name')
      return
    }
    onAddCategory(name)
    setCategoryName('')
    reportMessage('category', `Added ${name}.`)
  }

  function handleBudgetSubmit(event) {
    event.preventDefault()
    const value = parseAmount(budgetInput)
    if (!Number.isFinite(value) || value <= 0) {
      reportError('budget', 'Enter a monthly budget greater than zero.', 'amount')
      return
    }
    onSaveBudget(value)
    reportMessage('budget', `Monthly budget set to ${formatINR(value)}.`)
  }

  function handleRecurringSubmit(event) {
    event.preventDefault()
    const amount = parseAmount(scheduleAmount)
    const day = Number(scheduleDay)
    const installments = Number(scheduleInstallments)
    if (!scheduleName.trim()) {
      reportError('schedule', 'Enter a name for the schedule.', 'name')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      reportError('schedule', 'Enter an amount greater than zero.', 'amount')
      return
    }
    if (!scheduleCategory) {
      reportError('schedule', 'Choose a category for the schedule.', 'category')
      return
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      reportError('schedule', 'Choose a day between 1 and 31.', 'day')
      return
    }
    if (scheduleKind === 'emi' && (!Number.isInteger(installments) || installments < 1)) {
      reportError('schedule', 'Enter the number of EMI installments.', 'installments')
      return
    }
    onAddRecurring({
      id: createId(),
      name: scheduleName.trim(),
      amount,
      category: scheduleCategory,
      note: scheduleName.trim(),
      day,
      startMonth: month,
      kind: scheduleKind,
      installments: scheduleKind === 'emi' ? installments : null,
    })
    setScheduleName('')
    setScheduleAmount('')
    setScheduleInstallments('')
    reportMessage('schedule', 'Recurring schedule added.')
  }

  return (
    <div className="page">
      <header className="page-intro">
        <h1>Settings</h1>
        <p>Your data stays in this browser. Export a backup if you switch devices.</p>
      </header>

      {accountEmail ? (
        <section className="panel account-panel">
          <div>
            <h2>Account</h2>
            <p className="muted">{accountEmail}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      ) : null}

      <section className="panel stack">
        <div>
          <h2>Monthly budget</h2>
          <p className="muted">Set a spending limit for {formatMonthLabel(month)}.</p>
        </div>
        <form className="inline-form" noValidate onSubmit={handleBudgetSubmit}>
          <label className="field">
            <span>Budget amount</span>
            <div className="amount-input">
              <span>₹</span>
              <input
                ref={budgetInputRef}
                type="text"
                inputMode="decimal"
                required
                aria-invalid={feedback.section === 'budget' && Boolean(feedback.error)}
                aria-describedby={feedback.section === 'budget' && feedback.error ? 'budget-error' : undefined}
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                placeholder="50000"
              />
            </div>
          </label>
          <button type="submit" className="btn btn-secondary">Save budget</button>
        </form>
        {feedback.section === 'budget' && feedback.error ? <p id="budget-error" className="form-error" role="alert">{feedback.error}</p> : null}
        {feedback.section === 'budget' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
      </section>

      <section className="panel stack">
        <div>
          <h2>Recurring expenses</h2>
          <p className="muted">Automatically add monthly bills or EMIs from {formatMonthLabel(month)}.</p>
        </div>
        <form className="recurring-form" noValidate onSubmit={handleRecurringSubmit}>
          <label className="field">
            <span>Name</span>
            <input ref={(element) => { scheduleFields.current.name = element }} value={scheduleName} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'name'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'name' ? 'schedule-error' : undefined} onChange={(event) => setScheduleName(event.target.value)} placeholder="Home loan EMI" />
          </label>
          <label className="field">
            <span>Amount</span>
            <div className="amount-input"><span>₹</span><input ref={(element) => { scheduleFields.current.amount = element }} type="text" inputMode="decimal" value={scheduleAmount} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'amount'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'amount' ? 'schedule-error' : undefined} onChange={(event) => setScheduleAmount(event.target.value)} placeholder="25000" /></div>
          </label>
          <label className="field">
            <span>Category</span>
            <select ref={(element) => { scheduleFields.current.category = element }} value={scheduleCategory} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'category'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'category' ? 'schedule-error' : undefined} onChange={(event) => setScheduleCategory(event.target.value)}>
              <option value="">Choose a category</option>
              {data.categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Day of month</span>
            <input ref={(element) => { scheduleFields.current.day = element }} type="number" min="1" max="31" value={scheduleDay} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'day'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'day' ? 'schedule-error' : undefined} onChange={(event) => setScheduleDay(event.target.value)} />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={scheduleKind} onChange={(event) => setScheduleKind(event.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="emi">EMI</option>
            </select>
          </label>
          {scheduleKind === 'emi' ? (
            <label className="field">
              <span>Installments</span>
              <input ref={(element) => { scheduleFields.current.installments = element }} type="number" min="1" value={scheduleInstallments} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'installments'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'installments' ? 'schedule-error' : undefined} onChange={(event) => setScheduleInstallments(event.target.value)} placeholder="24" />
            </label>
          ) : null}
          <button type="submit" className="btn btn-secondary">Add schedule</button>
        </form>
        {feedback.section === 'schedule' && feedback.error ? <p id="schedule-error" className="form-error" role="alert">{feedback.error}</p> : null}
        {feedback.section === 'schedule' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
        {data.recurringExpenses.length ? (
          <ul className="schedule-list">
            {data.recurringExpenses.map((schedule) => (
              <li key={schedule.id}>
                <span><strong>{schedule.name}</strong><small>{schedule.kind === 'emi' ? `EMI · ${schedule.installments} installments` : 'Monthly'} · Day {schedule.day}</small></span>
                <span className="schedule-actions"><strong className="money">{formatINR(schedule.amount)}</strong><button type="button" className="text-btn danger" aria-label={`Remove recurring schedule: ${schedule.name}`} onClick={() => onDeleteRecurring(schedule)}>Remove</button></span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No recurring schedules yet.</p>}
      </section>

      <section className="panel stack">
        <h2>Data</h2>
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            Export Data
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import Data
          </button>
          <button type="button" className="btn btn-danger" onClick={onClear}>
            Clear All Data
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFile}
        />
        {feedback.section === 'data' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
        {feedback.section === 'data' && feedback.error ? <p className="form-error" role="alert">{feedback.error}</p> : null}
      </section>

      <section className="panel stack">
        <h2>Categories</h2>
        <ul className="chip-list">
          {data.categories.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <form className="inline-form" noValidate onSubmit={handleAddCategory}>
          <label className="field">
            <span>Add category</span>
            <input
              ref={categoryInputRef}
              value={categoryName}
              required
              aria-invalid={feedback.section === 'category' && Boolean(feedback.error)}
              aria-describedby={feedback.section === 'category' && feedback.error ? 'category-error' : undefined}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Subscriptions"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            Add
          </button>
        </form>
        {feedback.section === 'category' && feedback.error ? <p id="category-error" className="form-error" role="alert">{feedback.error}</p> : null}
        {feedback.section === 'category' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
      </section>

    </div>
  )
}
