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
  onLoadDemo,
  onAddCategory,
  month,
  budget = 0,
  onSaveBudget,
  onAddRecurring,
  onDeleteRecurring,
}) {
  const fileRef = useRef(null)
  const [categoryName, setCategoryName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
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

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'khaata-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
    setError('')
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseImportedJson(String(reader.result || ''))
      if (!result.ok) {
        setError(result.error)
        setMessage('')
        return
      }
      onImport(result.data)
      setError('')
      setMessage('Data imported.')
    }
    reader.readAsText(file)
  }

  function handleAddCategory(event) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      setError('Enter a category name.')
      return
    }
    if (data.categories.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setError('That category already exists.')
      return
    }
    onAddCategory(name)
    setCategoryName('')
    setError('')
    setMessage(`Added ${name}.`)
  }

  function handleBudgetSubmit(event) {
    event.preventDefault()
    const value = parseAmount(budgetInput)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a monthly budget greater than zero.')
      setMessage('')
      return
    }
    onSaveBudget(value)
    setError('')
    setMessage(`Monthly budget set to ${formatINR(value)}.`)
  }

  function handleRecurringSubmit(event) {
    event.preventDefault()
    const amount = parseAmount(scheduleAmount)
    const day = Number(scheduleDay)
    const installments = Number(scheduleInstallments)
    if (!scheduleName.trim() || !Number.isFinite(amount) || amount <= 0 || !scheduleCategory) {
      setError('Enter a name, amount, and category for the schedule.')
      setMessage('')
      return
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError('Choose a day between 1 and 31.')
      setMessage('')
      return
    }
    if (scheduleKind === 'emi' && (!Number.isInteger(installments) || installments < 1)) {
      setError('Enter the number of EMI installments.')
      setMessage('')
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
    setError('')
    setMessage('Recurring schedule added.')
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
        <form className="inline-form" onSubmit={handleBudgetSubmit}>
          <label className="field">
            <span>Budget amount</span>
            <div className="amount-input">
              <span>₹</span>
              <input
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                placeholder="50000"
              />
            </div>
          </label>
          <button type="submit" className="btn btn-secondary">Save budget</button>
        </form>
      </section>

      <section className="panel stack">
        <div>
          <h2>Recurring expenses</h2>
          <p className="muted">Automatically add monthly bills or EMIs from {formatMonthLabel(month)}.</p>
        </div>
        <form className="recurring-form" onSubmit={handleRecurringSubmit}>
          <label className="field">
            <span>Name</span>
            <input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="Home loan EMI" />
          </label>
          <label className="field">
            <span>Amount</span>
            <div className="amount-input"><span>₹</span><input type="text" inputMode="decimal" value={scheduleAmount} onChange={(event) => setScheduleAmount(event.target.value)} placeholder="25000" /></div>
          </label>
          <label className="field">
            <span>Category</span>
            <select value={scheduleCategory} onChange={(event) => setScheduleCategory(event.target.value)}>
              <option value="">Choose a category</option>
              {data.categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Day of month</span>
            <input type="number" min="1" max="31" value={scheduleDay} onChange={(event) => setScheduleDay(event.target.value)} />
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
              <input type="number" min="1" value={scheduleInstallments} onChange={(event) => setScheduleInstallments(event.target.value)} placeholder="24" />
            </label>
          ) : null}
          <button type="submit" className="btn btn-secondary">Add schedule</button>
        </form>
        {data.recurringExpenses.length ? (
          <ul className="schedule-list">
            {data.recurringExpenses.map((schedule) => (
              <li key={schedule.id}>
                <span><strong>{schedule.name}</strong><small>{schedule.kind === 'emi' ? `EMI · ${schedule.installments} installments` : 'Monthly'} · Day {schedule.day}</small></span>
                <span className="schedule-actions"><strong className="money">{formatINR(schedule.amount)}</strong><button type="button" className="text-btn danger" onClick={() => onDeleteRecurring(schedule)}>Remove</button></span>
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
        {message ? <p className="form-ok">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="panel stack">
        <h2>Categories</h2>
        <ul className="chip-list">
          {data.categories.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={handleAddCategory}>
          <label className="field">
            <span>Add category</span>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Subscriptions"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            Add
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Demo data</h2>
        <p className="muted">
          Load a sample month so you can see the dashboard. This replaces your current data.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onLoadDemo}>
          Load demo month
        </button>
      </section>
    </div>
  )
}
