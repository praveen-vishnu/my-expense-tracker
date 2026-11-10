import { useEffect, useRef, useState } from 'react'
import ModalSheet from '../components/ModalSheet.jsx'
import { parseImportedJson } from '../utils/storage.js'
import { formatINR, formatMonthLabel, parseAmount, createId } from '../utils/formatting.js'
import { getStoredGeminiKey, saveStoredGeminiKey } from '../utils/geminiScanner.js'
import { calculateRemainingBalance, guessLoanAmount } from '../utils/debts.js'

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
  onUpdateRecurring,
  onDeleteRecurring,
  onSaveDebt,
  onAddAccount,
  onDeleteAccount,
  onSetDefaultAccount,
}) {
  const fileRef = useRef(null)
  const budgetInputRef = useRef(null)
  const categoryInputRef = useRef(null)
  const accountInputRef = useRef(null)
  const scheduleFields = useRef({})
  const scheduleNameRef = useRef(null)

  const [categoryName, setCategoryName] = useState('')
  const [feedback, setFeedback] = useState({ section: '', error: '', message: '', field: '' })
  const [budgetInput, setBudgetInput] = useState(budget ? String(budget) : '')

  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false)
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleAmount, setScheduleAmount] = useState('')
  const [scheduleCategory, setScheduleCategory] = useState(data.categories[0] || '')
  const [scheduleDay, setScheduleDay] = useState('1')
  const [scheduleKind, setScheduleKind] = useState('monthly')
  const [scheduleInstallments, setScheduleInstallments] = useState('')
  const [scheduleAccountId, setScheduleAccountId] = useState(() => data.accounts?.find((a) => a.isDefault)?.id || '')
  const [scheduleDebtId, setScheduleDebtId] = useState('')
  const [autoDebtAmount, setAutoDebtAmount] = useState('')
  const [autoDebtBalance, setAutoDebtBalance] = useState('')
  const [autoDebtRate, setAutoDebtRate] = useState('')

  // Account form state
  const [accName, setAccName] = useState('')
  const [accType, setAccType] = useState('bank')
  const [accBalance, setAccBalance] = useState('')
  const [accLimit, setAccLimit] = useState('')
  const [accBillingDay, setAccBillingDay] = useState('')
  const [accDueDay, setAccDueDay] = useState('')

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
    link.download = 'pennywise-backup.json'
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
    const billingDay = accType === 'credit_card' && accBillingDay ? Number(accBillingDay) : null
    const dueDay = accType === 'credit_card' && accDueDay ? Number(accDueDay) : null

    if (accType === 'credit_card') {
      if (billingDay != null && (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) {
        reportError('account', 'Billing cycle day must be between 1 and 31.', 'billingDay')
        return
      }
      if (dueDay != null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
        reportError('account', 'Payment due day must be between 1 and 31.', 'dueDay')
        return
      }
    }

    onAddAccount({
      id: createId(),
      name,
      type: accType,
      initialBalance,
      creditLimit,
      billingDay,
      dueDay,
      isDefault: !(data.accounts || []).length,
    })

    setAccName('')
    setAccBalance('')
    setAccLimit('')
    setAccBillingDay('')
    setAccDueDay('')
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

  function handleStartEditRecurring(schedule) {
    setEditingScheduleId(schedule.id)
    setScheduleName(schedule.name || '')
    setScheduleAmount(String(schedule.amount || ''))
    setScheduleCategory(schedule.category || data.categories[0] || '')
    setScheduleDay(String(schedule.day || '1'))
    setScheduleKind(schedule.kind || 'monthly')
    setScheduleInstallments(schedule.installments ? String(schedule.installments) : '')
    setScheduleAccountId(schedule.accountId || '')

    // Auto-match existing debt by name if not already linked
    let initialDebtId = schedule.debtId || ''
    if (schedule.kind === 'emi' && !initialDebtId) {
      const match = (data.debts || []).find((d) =>
        d.status !== 'paid' && d.balance > 0 && d.kind !== 'credit_card' &&
        d.name.trim().toLowerCase() === (schedule.name || '').trim().toLowerCase() &&
        !(data.recurringExpenses || []).some((s) => s.id !== schedule.id && s.debtId === d.id)
      )
      if (match) initialDebtId = match.id
    }
    setScheduleDebtId(initialDebtId)

    const guessed = guessLoanAmount(schedule.name, schedule.amount, schedule.installments)
    setAutoDebtAmount(guessed ? String(guessed) : '')
    setAutoDebtBalance(guessed ? String(guessed) : '')
    setAutoDebtRate('')
    setFeedback({ section: '', error: '', message: '', field: '' })
    setScheduleEditorOpen(true)
  }

  function handleStartAddRecurring() {
    setEditingScheduleId(null)
    setScheduleName('')
    setScheduleAmount('')
    setScheduleCategory(data.categories[0] || '')
    setScheduleDay('1')
    setScheduleKind('monthly')
    setScheduleInstallments('')
    setScheduleAccountId(data.accounts?.find((a) => a.isDefault)?.id || '')
    setScheduleDebtId('')
    setAutoDebtAmount('')
    setAutoDebtBalance('')
    setAutoDebtRate('')
    setFeedback({ section: '', error: '', message: '', field: '' })
    setScheduleEditorOpen(true)
  }

  function handleCancelEditRecurring() {
    setScheduleEditorOpen(false)
    setEditingScheduleId(null)
    setScheduleName('')
    setScheduleAmount('')
    setScheduleCategory(data.categories[0] || '')
    setScheduleDay('1')
    setScheduleKind('monthly')
    setScheduleInstallments('')
    setScheduleAccountId(data.accounts?.find((a) => a.isDefault)?.id || '')
    setScheduleDebtId('')
    setAutoDebtAmount('')
    setAutoDebtBalance('')
    setAutoDebtRate('')
    setFeedback({ section: '', error: '', message: '', field: '' })
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

    let finalDebtId = scheduleKind === 'emi' ? scheduleDebtId || null : null
    let newDebtRecord = null

    if (scheduleKind === 'emi' && scheduleDebtId === '__auto_create__') {
      const parsedOriginal = parseAmount(autoDebtAmount)
      const guessed = guessLoanAmount(scheduleName, amount, installments)
      const originalAmount = (Number.isFinite(parsedOriginal) && parsedOriginal > 0)
        ? parsedOriginal
        : (guessed > 0 ? guessed : Math.round(amount * installments))

      if (!originalAmount || originalAmount <= 0) {
        reportError('schedule', 'Enter a valid loan amount.', 'debt')
        return
      }

      const parsedBalance = parseAmount(autoDebtBalance)
      const balance = (Number.isFinite(parsedBalance) && parsedBalance >= 0)
        ? parsedBalance
        : originalAmount

      const rate = autoDebtRate ? parseAmount(autoDebtRate) : null
      const newDebtId = createId()
      const nextDueDay = Math.min(day, 28)

      newDebtRecord = {
        id: newDebtId,
        kind: 'loan',
        category: scheduleCategory || 'EMI',
        name: scheduleName.trim(),
        lender: scheduleAccountId ? (data.accounts?.find((a) => a.id === scheduleAccountId)?.name || '') : '',
        originalAmount,
        balance,
        rate: Number.isFinite(rate) ? rate : null,
        monthlyRate: Number.isFinite(rate) ? Math.round((rate / 12) * 1000) / 1000 : null,
        emi: amount,
        totalMonths: installments,
        monthsRemaining: installments,
        loanTakenDate: `${month}-${String(nextDueDay).padStart(2, '0')}`,
        nextDue: `${month}-${String(nextDueDay).padStart(2, '0')}`,
        status: balance <= 0 ? 'paid' : 'active',
      }
      finalDebtId = newDebtId
    } else if (scheduleKind === 'emi' && scheduleDebtId && (data.recurringExpenses || []).some((schedule) =>
      schedule.id !== editingScheduleId && schedule.debtId === scheduleDebtId
    )) {
      reportError('schedule', 'That debt is already linked to another EMI schedule.', 'debt')
      return
    }

    if (editingScheduleId) {
      const existing = (data.recurringExpenses || []).find((s) => s.id === editingScheduleId)
      if (onUpdateRecurring) {
        onUpdateRecurring({
          id: editingScheduleId,
          name: scheduleName.trim(),
          amount,
          category: scheduleCategory,
          note: scheduleName.trim(),
          day,
          startMonth: existing?.startMonth || month,
          kind: scheduleKind,
          installments: scheduleKind === 'emi' ? installments : null,
          accountId: scheduleAccountId || null,
          debtId: finalDebtId,
        }, newDebtRecord)
      }
      handleCancelEditRecurring()
      reportMessage('schedule', newDebtRecord ? 'Recurring schedule updated and debt created in Debt Tracker.' : 'Recurring schedule updated.')
    } else {
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
        accountId: scheduleAccountId || null,
        debtId: finalDebtId,
      }, newDebtRecord)
      setScheduleName('')
      setScheduleAmount('')
      setScheduleInstallments('')
      setScheduleDebtId('')
      setAutoDebtAmount('')
      setAutoDebtBalance('')
      setAutoDebtRate('')
      reportMessage('schedule', newDebtRecord ? 'Recurring schedule added and debt created in Debt Tracker.' : 'Recurring schedule added.')
    }
  }

  const availableDebts = (data.debts || []).filter((debt) =>
    (debt.status !== 'paid' && debt.balance > 0 && debt.kind !== 'credit_card') ||
    debt.id === scheduleDebtId
  ).filter((debt) =>
    !(data.recurringExpenses || []).some((schedule) =>
      schedule.id !== editingScheduleId && schedule.debtId === debt.id
    )
  )
  const selectedDebt = availableDebts.find((debt) => debt.id === scheduleDebtId)

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
                      ? `${acc.creditLimit ? `Limit: ${formatINR(acc.creditLimit)}` : 'No credit limit set'}${acc.billingDay ? ` · Bill: ${acc.billingDay}th` : ''}${acc.dueDay ? ` · Due: ${acc.dueDay}th` : ''}`
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

          {accType === 'credit_card' ? (
            <>
              <label className="field">
                <span>Billing cycle day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={accBillingDay}
                  onChange={(event) => setAccBillingDay(event.target.value)}
                  placeholder="e.g. 15"
                />
              </label>
              <label className="field">
                <span>Payment due day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={accDueDay}
                  onChange={(event) => setAccDueDay(event.target.value)}
                  placeholder="e.g. 5"
                />
              </label>
            </>
          ) : null}

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

      <section className="panel stack recurring-section">
        <div className="recurring-section-head">
          <div>
          <h2>Recurring expenses & EMIs</h2>
            <p className="muted">Monthly bills and loan payments scheduled for {formatMonthLabel(month)}.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleStartAddRecurring}>
            Add schedule
          </button>
        </div>
        {feedback.section === 'schedule' && feedback.message ? <p className="form-ok" role="status" aria-live="polite">{feedback.message}</p> : null}
        {data.recurringExpenses.length ? (
          <ul className="schedule-list">
            {data.recurringExpenses.map((schedule) => {
              const account = data.accounts?.find((a) => a.id === schedule.accountId)
              const linkedDebt = (data.debts || []).find((debt) => debt.id === schedule.debtId)
              return (
                <li key={schedule.id}>
                  <span className="schedule-info">
                    <strong>{schedule.name}</strong>
                    <small>
                      {schedule.kind === 'emi' ? `EMI · ${schedule.installments} installments` : 'Monthly expense'} · Due day {schedule.day}
                    </small>
                    <small className="schedule-link-info">
                      {account ? `From ${account.name}` : 'No account selected'}
                      {linkedDebt ? (
                        <span style={{ color: '#2b6cb0', fontWeight: 600 }}> · 🔗 Tracks "{linkedDebt.name}" in Debt Tracker ({formatINR(linkedDebt.balance)} left)</span>
                      ) : (schedule.kind === 'emi' ? (
                        <span style={{ color: '#c05621', fontWeight: 600 }}> · ⚠️ Not linked to Debt Tracker</span>
                      ) : '')}
                    </small>
                  </span>
                  <span className="schedule-actions">
                    <strong className="money">{formatINR(schedule.amount)}</strong>
                    <button
                      type="button"
                      className="text-btn"
                      aria-label={`Edit recurring schedule: ${schedule.name}`}
                      onClick={() => handleStartEditRecurring(schedule)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-btn danger"
                      aria-label={`Remove recurring schedule: ${schedule.name}`}
                      onClick={() => onDeleteRecurring(schedule)}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="recurring-empty-state">No schedules yet. Add one to automatically record a monthly bill or EMI.</p>
        )}
      </section>

      {scheduleEditorOpen ? (
        <ModalSheet
          titleId="recurring-editor-title"
          descriptionId="recurring-editor-description"
          initialFocusRef={scheduleNameRef}
          onDismiss={handleCancelEditRecurring}
          className="schedule-sheet"
        >
          <form className="sheet-form schedule-editor-form" noValidate onSubmit={handleRecurringSubmit}>
            <div className="sheet-head">
              <div>
                <span className="schedule-editor-kicker">{editingScheduleId ? 'Edit schedule' : 'New schedule'}</span>
                <h2 id="recurring-editor-title">{editingScheduleId ? 'Edit recurring expense' : 'Add recurring expense'}</h2>
                <p id="recurring-editor-description" className="muted">
                  Set the amount, due day, and account for this monthly entry.
                </p>
              </div>
              <button type="button" className="text-btn" onClick={handleCancelEditRecurring}>Close</button>
            </div>

            <section className="schedule-editor-section" aria-labelledby="schedule-details-title">
              <h3 id="schedule-details-title">Expense details</h3>
              <div className="schedule-editor-grid">
                <label className="field schedule-field-wide">
                  <span>Name</span>
                  <input ref={(element) => { scheduleFields.current.name = element; scheduleNameRef.current = element }} value={scheduleName} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'name'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'name' ? 'schedule-error' : undefined} onChange={(event) => setScheduleName(event.target.value)} placeholder="Home loan EMI" />
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
                  <span>Deduct from account</span>
                  <select value={scheduleAccountId} onChange={(event) => setScheduleAccountId(event.target.value)}>
                    <option value="">Unassigned (no account deduction)</option>
                    {data.accounts?.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Due day</span>
                  <input ref={(element) => { scheduleFields.current.day = element }} type="number" min="1" max="31" value={scheduleDay} required aria-invalid={feedback.section === 'schedule' && feedback.field === 'day'} aria-describedby={feedback.section === 'schedule' && feedback.field === 'day' ? 'schedule-error' : undefined} onChange={(event) => setScheduleDay(event.target.value)} />
                </label>
                <label className="field">
                  <span>Schedule type</span>
                  <select value={scheduleKind} onChange={(event) => { setScheduleKind(event.target.value); if (event.target.value !== 'emi') setScheduleDebtId('') }}>
                    <option value="monthly">Monthly expense</option>
                    <option value="emi">Loan EMI</option>
                  </select>
                </label>
              </div>
            </section>

            {scheduleKind === 'emi' ? (
              <section className="schedule-editor-section" aria-labelledby="schedule-emi-title">
                <h3 id="schedule-emi-title">Loan tracking</h3>
                <div className="schedule-editor-grid">
                  <label className="field">
                    <span>Number of installments</span>
                    <input
                      ref={(element) => { scheduleFields.current.installments = element }}
                      type="number"
                      min="1"
                      value={scheduleInstallments}
                      required
                      aria-invalid={feedback.section === 'schedule' && feedback.field === 'installments'}
                      aria-describedby={feedback.section === 'schedule' && feedback.field === 'installments' ? 'schedule-error' : undefined}
                      onChange={(event) => {
                        setScheduleInstallments(event.target.value)
                        if (scheduleDebtId === '__auto_create__' && !autoDebtAmount) {
                          const guessed = guessLoanAmount(scheduleName, scheduleAmount, event.target.value)
                          if (guessed) {
                            setAutoDebtAmount(String(guessed))
                            setAutoDebtBalance(String(guessed))
                          }
                        }
                      }}
                      placeholder="24"
                    />
                  </label>
                  <label className="field">
                    <span>Debt to track (optional)</span>
                    <select
                      ref={(element) => { scheduleFields.current.debt = element }}
                      value={scheduleDebtId}
                      aria-invalid={feedback.section === 'schedule' && feedback.field === 'debt'}
                      aria-describedby={feedback.section === 'schedule' && feedback.field === 'debt' ? 'schedule-error' : 'schedule-debt-help'}
                      onChange={(event) => {
                        const val = event.target.value
                        setScheduleDebtId(val)
                        if (val === '__auto_create__' && !autoDebtAmount) {
                          const guessed = guessLoanAmount(scheduleName, scheduleAmount, scheduleInstallments)
                          if (guessed) {
                            setAutoDebtAmount(String(guessed))
                            setAutoDebtBalance(String(guessed))
                          }
                        }
                      }}
                    >
                      <option value="">Do not track a debt</option>
                      <option value="__auto_create__">✨ Automatically create &amp; link in Debt Tracker</option>
                      {availableDebts.map((debt) => (
                        <option key={debt.id} value={debt.id}>{debt.name} ({formatINR(debt.balance)} remaining)</option>
                      ))}
                    </select>
                  </label>
                </div>

                {scheduleDebtId === '__auto_create__' ? (
                  <div className="schedule-debt-autocreate">
                    <div className="schedule-debt-autocreate-header">
                      <strong>✨ Automatically create and link in Debt Tracker</strong>
                      <span>A new loan will be added to your Debt Tracker with this EMI</span>
                    </div>
                    <div className="schedule-editor-grid">
                      <label className="field">
                        <span>Total loan amount (Principal)</span>
                        <input
                          type="number"
                          min="1"
                          value={autoDebtAmount}
                          required
                          onChange={(e) => {
                            const val = e.target.value
                            setAutoDebtAmount(val)
                            if (val && !autoDebtBalance) setAutoDebtBalance(val)
                          }}
                          placeholder={String(guessLoanAmount(scheduleName, scheduleAmount, scheduleInstallments) || '1200000')}
                        />
                      </label>
                      <label className="field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Remaining balance</span>
                          {autoDebtAmount && scheduleAmount ? (
                            <button
                              type="button"
                              className="text-btn"
                              style={{ fontSize: '0.78rem', color: 'var(--brand, #38a169)', fontWeight: 600, padding: 0 }}
                              onClick={() => {
                                const calc = calculateRemainingBalance({
                                  originalAmount: parseAmount(autoDebtAmount),
                                  rate: autoDebtRate ? parseAmount(autoDebtRate) : null,
                                  totalMonths: Number(scheduleInstallments) || null,
                                  loanTakenDate: `${month}-01`,
                                  emi: parseAmount(scheduleAmount) || null,
                                })
                                if (calc != null) setAutoDebtBalance(String(calc))
                              }}
                            >
                              ⚡ Auto-calculate
                            </button>
                          ) : null}
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={autoDebtBalance || autoDebtAmount}
                          required
                          onChange={(e) => setAutoDebtBalance(e.target.value)}
                          placeholder={String(autoDebtAmount || '1200000')}
                        />
                      </label>
                      <label className="field">
                        <span>Annual interest rate % (optional)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={autoDebtRate}
                          onChange={(e) => setAutoDebtRate(e.target.value)}
                          placeholder="e.g. 9.5"
                        />
                      </label>
                    </div>
                    <p className="schedule-debt-help-text">
                      Saving will add <strong>"{scheduleName || 'Loan'}"</strong> to the Debt Tracker and connect each monthly {formatINR(parseAmount(scheduleAmount) || 0)} payment automatically.
                    </p>
                  </div>
                ) : selectedDebt ? (
                  <div className="schedule-debt-summary">
                    <strong>{selectedDebt.name}</strong>
                    <span>{formatINR(selectedDebt.balance)} remaining</span>
                    <p id="schedule-debt-help">Each generated EMI is recorded as an expense and as a payment against this debt. Interest uses the debt’s saved rate. Existing payment history is not changed by editing this schedule.</p>
                  </div>
                ) : (
                  <div id="schedule-debt-help" className="schedule-debt-help">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span>
                        {availableDebts.length
                          ? 'Choose a debt to track its balance alongside this expense. The EMI will still be recorded as an expense if you leave this unlinked.'
                          : 'No eligible debts are available in Debt Tracker yet.'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setScheduleDebtId('__auto_create__')
                          const guessed = guessLoanAmount(scheduleName, scheduleAmount, scheduleInstallments)
                          if (guessed) {
                            setAutoDebtAmount(String(guessed))
                            setAutoDebtBalance(String(guessed))
                          }
                        }}
                      >
                        ✨ Create &amp; link debt automatically
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {feedback.section === 'schedule' && feedback.error ? <p id="schedule-error" className="form-error" role="alert">{feedback.error}</p> : null}
            <div className="schedule-editor-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancelEditRecurring}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingScheduleId ? 'Save changes' : 'Add schedule'}
              </button>
            </div>
          </form>
        </ModalSheet>
      ) : null}

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

      {/* <section className="panel stack">
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
      </section> */}

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
