import { useEffect, useRef, useState } from 'react'
import { parseImportedJson } from '../utils/storage.js'
import { formatINR, formatMonthLabel, parseAmount, createId } from '../utils/formatting.js'
import { getStoredGeminiKey, saveStoredGeminiKey } from '../utils/geminiScanner.js'

export default function Settings({
  data,
  accountEmail,
  onSignOut,
  onImport,
  onImportStatement,
  onClear,
  onAddCategory,
  month,
  budget = 0,
  onSaveBudget,
  onOpenCategoryBudgets,
  onAddRecurring,
  onDeleteRecurring,
  onAddAccount,
  onDeleteAccount,
  onSetDefaultAccount,
}) {
  const fileRef = useRef(null)
  const budgetInputRef = useRef(null)
  const categoryInputRef = useRef(null)
  const accountInputRef = useRef(null)
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

  // Account form state
  const [accName, setAccName] = useState('')
  const [accType, setAccType] = useState('bank')
  const [accBalance, setAccBalance] = useState('')
  const [accLimit, setAccLimit] = useState('')

  // Gemini API key state
  const [geminiKey, setGeminiKey] = useState(() => getStoredGeminiKey())

  useEffect(() => {
    setBudgetInput(budget ? String(budget) : '')
  }, [month, budget])

  function reportError(section, error, field = '') {
    setFeedback({ section, error, message: '', field })
    if (section === 'budget') budgetInputRef.current?.focus()
    if (section === 'category') categoryInputRef.current?.focus()
    if (section === 'account') accountInputRef.current?.focus()
    if (section === 'schedule') scheduleFields.current[field]?.focus()
  }

  function reportMessage(section, message) {
    setFeedback({ section, error, message, field: '' })
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

  function handleAddAccountSubmit(event) {
    event.preventDefault()
    const name = accName.trim()
    if (!name) {
      reportError('account', 'Enter an account name.', 'name')
      return
    }
    if ((data.accounts || []).some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      reportError('account', 'An account with that name already exists.', 'name')
      return
    }

    const initialBalance = parseAmount(accBalance) || 0
    const creditLimit = accType === 'credit_card' ? parseAmount(accLimit) || null : null

    onAddAccount({
      id: createId(),
      name,
      type: accType,
      initialBalance,
      creditLimit,
      isDefault: !(data.accounts || []).length,
    })

    setAccName('')
    setAccBalance('')
    setAccLimit('')
    reportMessage('account', `Added account: ${name}.`)
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

  function handleSaveGeminiKey(event) {
    event.preventDefault()
    saveStoredGeminiKey(geminiKey)
    reportMessage('gemini', geminiKey.trim() ? 'Gemini API Key saved.' : 'Gemini API Key cleared.')
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
        <p>Your financial accounts, preferences, and data synchronization.</p>
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

      {/* ACCOUNTS & PAYMENT METHODS SECTION */}
      <section className="panel stack">
        <div>
          <h2>Accounts & Payment Methods</h2>
          <p className="muted">Manage your bank accounts, credit cards, and cash wallets.</p>
        </div>

        {data.accounts && data.accounts.length ? (
          <ul className="account-settings-list">
            {data.accounts.map((acc) => (
              <li key={acc.id} className="account-settings-item">
                <div className="acc-meta">
                  <span className="acc-badge">
                    {acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'}
                  </span>
                  <strong>{acc.name}</strong>
                  {acc.isDefault ? <span className="default-pill">Default</span> : null}
                  <small className="muted">
                    {acc.type === 'credit_card'
                      ? acc.creditLimit ? `Limit: ${formatINR(acc.creditLimit)}` : 'No credit limit set'
                      : `Starting: ${formatINR(acc.initialBalance)}`}
                  </small>
                </div>

                <div className="account-actions">
                  {!acc.isDefault ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => onSetDefaultAccount(acc.id)}
                    >
                      Make default
                    </button>
                  ) : null}
                  {data.accounts.length > 1 ? (
                    <button
                      type="button"
                      className="text-btn danger"
                      onClick={() => onDeleteAccount(acc)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <form className="recurring-form" noValidate onSubmit={handleAddAccountSubmit}>
          <label className="field">
            <span>Account name</span>
            <input
              ref={accountInputRef}
              value={accName}
              required
              aria-invalid={feedback.section === 'account' && feedback.field === 'name'}
              aria-describedby={feedback.section === 'account' && feedback.field === 'name' ? 'account-error' : undefined}
              onChange={(event) => setAccName(event.target.value)}
              placeholder="HDFC Salary"
            />
          </label>

          <label className="field">
            <span>Type</span>
            <select value={accType} onChange={(event) => setAccType(event.target.value)}>
              <option value="bank">Bank Account</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash in Hand</option>
              <option value="wallet">Digital Wallet</option>
            </select>
          </label>

          <label className="field">
            <span>{accType === 'credit_card' ? 'Credit limit (optional)' : 'Starting balance'}</span>
            <div className="amount-input">
              <span>₹</span>
              <input
                type="text"
                inputMode="decimal"
                value={accType === 'credit_card' ? accLimit : accBalance}
                onChange={(event) =>
                  accType === 'credit_card' ? setAccLimit(event.target.value) : setAccBalance(event.target.value)
                }
                placeholder={accType === 'credit_card' ? '150000' : '25000'}
              />
            </div>
          </label>

          <button type="submit" className="btn btn-secondary">
            Add account
          </button>
        </form>
        {feedback.section === 'account' && feedback.error ? <p id="account-error" className="form-error" role="alert">{feedback.error}</p> : null}
        {feedback.section === 'account' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
      </section>

      <section className="panel stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2>Monthly budget</h2>
            <p className="muted">Set a spending limit for {formatMonthLabel(month)}.</p>
          </div>
          {onOpenCategoryBudgets ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenCategoryBudgets}
              style={{ fontSize: '0.85rem' }}
            >
              Configure Category Budgets
            </button>
          ) : null}
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

      <section className="panel stack">
        <div>
          <h2>AI Receipt & Bill Scanner</h2>
          <p className="muted">Configure Google Gemini 1.5 Flash API key for instant camera/screenshot parsing.</p>
        </div>
        <form className="inline-form" noValidate onSubmit={handleSaveGeminiKey}>
          <label className="field" style={{ flex: 1 }}>
            <span>Gemini API Key</span>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Paste your Gemini API key (AIzaSy...)"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            Save Key
          </button>
        </form>
        <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
          Your key remains 100% private in browser local storage and is never sent to any backend servers.
        </p>
        {feedback.section === 'gemini' && feedback.message ? (
          <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>Data</h2>
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            Export Data
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import Data (JSON)
          </button>
          {onImportStatement ? (
            <button type="button" className="btn btn-secondary" onClick={onImportStatement}>
              Import Statement (CSV)
            </button>
          ) : null}
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
    </div>
  )
}

