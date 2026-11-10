import { useMemo, useRef, useState } from 'react'
import ModalSheet from '../components/ModalSheet.jsx'
import { formatINR, formatShortDate, isValidDate, parseAmount, todayISO } from '../utils/formatting.js'
import { calculatePaymentSplit, calculateRemainingMonths, formatRemainingTenure, parseDebtImport, parseCSV, parseExcel } from '../utils/debts.js'

function blankDebt() {
  return {
    kind: 'loan',
    category: '',
    name: '',
    lender: '',
    originalAmount: '',
    balance: '',
    rate: '',
    monthlyRate: '',
    emi: '',
    nextDue: '',
    monthsRemaining: '',
    totalMonths: '',
    loanTakenDate: '',
  }
}

function debtFormValues(debt) {
  return Object.fromEntries(
    Object.entries(debt || blankDebt()).map(([key, value]) => [key, value == null ? '' : String(value)])
  )
}

function DebtForm({ initial, onSave, onCancel }) {
  const [values, setValues] = useState(() => debtFormValues(initial))
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const isEditing = Boolean(initial?.id)

  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const originalAmount = parseAmount(values.originalAmount)
    const balance = parseAmount(values.balance)
    if (!values.name.trim()) {
      setError('Enter a name for this debt.')
      nameRef.current?.focus()
      return
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      setError('Enter the original amount.')
      return
    }
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Enter a valid remaining balance.')
      return
    }
    if (values.nextDue && !isValidDate(values.nextDue)) {
      setError('Choose a valid next due date.')
      return
    }

    const amountField = (value) => value === '' ? null : parseAmount(value)
    const integerField = (value) => value === '' ? null : Number(value)
    const explicitMonths = integerField(values.monthsRemaining)
    const totalMonths = integerField(values.totalMonths)
    const calculatedMonths = calculateRemainingMonths({
      ...values,
      balance,
      originalAmount,
      totalMonths,
      loanTakenDate: values.loanTakenDate || null,
      emi: amountField(values.emi),
      rate: amountField(values.rate),
      monthlyRate: amountField(values.monthlyRate),
      nextDue: values.nextDue || null,
      monthsRemaining: explicitMonths,
    })
    const monthsRemaining = explicitMonths != null ? explicitMonths : calculatedMonths

    const result = onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      ...values,
      originalAmount,
      balance,
      rate: amountField(values.rate),
      monthlyRate: amountField(values.monthlyRate),
      emi: amountField(values.emi),
      monthsRemaining,
      totalMonths,
      nextDue: values.nextDue || null,
      loanTakenDate: values.loanTakenDate || null,
      principalPaid: initial?.principalPaid,
      interestPaid: initial?.interestPaid,
      status: balance === 0 ? 'paid' : 'active',
    }, initial?.id)
    if (!result?.ok) {
      setError(result?.error || 'The debt could not be saved.')
      return
    }
    onCancel()
  }

  return (
    <ModalSheet titleId="debt-form-title" initialFocusRef={nameRef} onDismiss={onCancel} className="debt-sheet">
      <form className="sheet-form" noValidate onSubmit={submit}>
        <div className="sheet-head">
          <div>
            <span className="debt-eyebrow">Debt details</span>
            <h2 id="debt-form-title">{isEditing ? 'Edit debt' : 'Add a debt'}</h2>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>Close</button>
        </div>
        <div className="debt-form-grid">
          <label className="field debt-field-wide">
            <span>Name</span>
            <input ref={nameRef} required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Personal loan" />
          </label>
          <label className="field">
            <span>Lender</span>
            <input value={values.lender} onChange={(event) => update('lender', event.target.value)} placeholder="Bank or person" />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={values.kind} onChange={(event) => update('kind', event.target.value)}>
              <option value="loan">Loan</option>
              <option value="shark">Informal loan</option>
              <option value="credit_card">Credit card</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <input value={values.category} onChange={(event) => update('category', event.target.value)} placeholder="e.g. Personal loan" />
          </label>
          <label className="field">
            <span>Original amount</span>
            <input type="number" min="0.01" step="0.01" required value={values.originalAmount} onChange={(event) => update('originalAmount', event.target.value)} placeholder="₹" />
          </label>
          <label className="field">
            <span>Current balance</span>
            <input type="number" min="0" step="0.01" required value={values.balance} onChange={(event) => update('balance', event.target.value)} placeholder="₹" />
          </label>
          <label className="field">
            <span>Monthly payment / EMI</span>
            <input type="number" min="0" step="0.01" value={values.emi} onChange={(event) => update('emi', event.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            <span>Annual interest rate (%)</span>
            <input type="number" min="0" step="0.01" value={values.rate} onChange={(event) => update('rate', event.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            <span>Monthly rate (%)</span>
            <input type="number" min="0" step="0.01" value={values.monthlyRate} onChange={(event) => update('monthlyRate', event.target.value)} placeholder="For informal loans" />
          </label>
          <label className="field">
            <span>Next due date</span>
            <input type="date" value={values.nextDue} onChange={(event) => update('nextDue', event.target.value)} />
          </label>
          <label className="field">
            <span>Original start date</span>
            <input
              type="date"
              value={values.loanTakenDate}
              onChange={(event) => {
                const startDate = event.target.value
                update('loanTakenDate', startDate)
                if (startDate && values.totalMonths) {
                  const autoMonths = calculateRemainingMonths({
                    ...values,
                    loanTakenDate: startDate,
                  })
                  if (autoMonths != null) {
                    update('monthsRemaining', String(autoMonths))
                  }
                }
              }}
            />
          </label>
          <label className="field">
            <span>Total tenure (months)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={values.totalMonths}
              onChange={(event) => {
                const total = event.target.value
                update('totalMonths', total)
                if (total && values.loanTakenDate) {
                  const autoMonths = calculateRemainingMonths({
                    ...values,
                    totalMonths: total,
                  })
                  if (autoMonths != null) {
                    update('monthsRemaining', String(autoMonths))
                  }
                }
              }}
              placeholder="e.g. 60"
            />
          </label>
          <label className="field">
            <span>Months remaining</span>
            <input
              type="number"
              min="0"
              step="1"
              value={values.monthsRemaining}
              onChange={(event) => update('monthsRemaining', event.target.value)}
              placeholder="Auto-calculated from date"
            />
          </label>
        </div>
        {error ? <p className="debt-form-error" role="alert">{error}</p> : null}
        <div className="debt-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">{isEditing ? 'Save changes' : 'Add debt'}</button>
        </div>
      </form>
    </ModalSheet>
  )
}

function PaymentForm({ debt, linkedSchedule, onSave, onCancel }) {
  const regularEmi = debt.emi || linkedSchedule?.amount || (debt.minDue || null)
  const [amount, setAmount] = useState(regularEmi ? String(regularEmi) : '')
  const [customSplit, setCustomSplit] = useState(false)
  const [manualPrincipal, setManualPrincipal] = useState('')
  const [manualInterest, setManualInterest] = useState('')
  const [manualFees, setManualFees] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const amountRef = useRef(null)

  const parsedAmount = parseAmount(amount)
  const autoSplit = useMemo(() => calculatePaymentSplit(debt, parsedAmount), [debt, parsedAmount])

  const principalAmount = customSplit ? parseAmount(manualPrincipal) : autoSplit.principal
  const interestAmount = customSplit ? (manualInterest === '' ? 0 : parseAmount(manualInterest)) : autoSplit.interest
  const feeAmount = customSplit ? (manualFees === '' ? 0 : parseAmount(manualFees)) : autoSplit.fees

  const total = customSplit
    ? [principalAmount, interestAmount, feeAmount].every(Number.isFinite)
      ? Math.round((principalAmount + interestAmount + feeAmount) * 100) / 100
      : 0
    : (Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0)

  const newBalance = Math.max(0, Math.round((debt.balance - (principalAmount || 0)) * 100) / 100)

  function toggleCustomSplit() {
    if (!customSplit) {
      setManualPrincipal(String(autoSplit.principal ?? ''))
      setManualInterest(String(autoSplit.interest ?? ''))
      setManualFees(String(autoSplit.fees ?? ''))
      setCustomSplit(true)
    } else {
      setCustomSplit(false)
    }
  }

  function handleSetAmount(val) {
    setAmount(String(val))
    if (customSplit) {
      const nextSplit = calculatePaymentSplit(debt, val)
      setManualPrincipal(String(nextSplit.principal ?? ''))
      setManualInterest(String(nextSplit.interest ?? ''))
      setManualFees(String(nextSplit.fees ?? ''))
    }
  }

  function submit(event) {
    event.preventDefault()
    if (!Number.isFinite(total) || total <= 0) {
      setError('Please enter a payment amount greater than ₹0.')
      amountRef.current?.focus()
      return
    }
    if (!Number.isFinite(principalAmount) || principalAmount < 0 || !Number.isFinite(interestAmount) || interestAmount < 0 || !Number.isFinite(feeAmount) || feeAmount < 0) {
      setError('Please enter valid positive numbers for the payment breakdown.')
      return
    }
    if (principalAmount > debt.balance) {
      setError(`Principal paid (${formatINR(principalAmount)}) cannot exceed the remaining balance (${formatINR(debt.balance)}).`)
      return
    }
    if (!isValidDate(date)) {
      setError('Choose a valid payment date.')
      return
    }

    const result = onSave(debt.id, {
      amount: total,
      principal: principalAmount,
      interest: interestAmount,
      fees: feeAmount,
      date,
      note,
    })
    if (!result?.ok) {
      setError(result?.error || 'The payment could not be recorded.')
      return
    }
    onCancel()
  }

  return (
    <ModalSheet titleId="debt-payment-title" initialFocusRef={amountRef} onDismiss={onCancel} className="debt-sheet">
      <form className="sheet-form" noValidate onSubmit={submit}>
        <div className="sheet-head">
          <div>
            <span className="debt-eyebrow">Payment entry · {debt.name}</span>
            <h2 id="debt-payment-title">{linkedSchedule ? 'Record extra payment' : 'Record a payment'}</h2>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>Close</button>
        </div>

        {linkedSchedule ? (
          <p className="debt-payment-balance" style={{ fontSize: '0.8rem' }}>
            ℹ️ Your monthly EMI is linked. Use this form to record an extra payment or manual settlement.
          </p>
        ) : null}

        <div className="debt-payment-balance">
          <span>Remaining principal</span>
          <strong>{formatINR(debt.balance)}</strong>
        </div>

        {/* Primary Amount Input */}
        <label className="field debt-field-wide">
          <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>Payment amount (₹)</span>
          <input
            ref={amountRef}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => handleSetAmount(e.target.value)}
            placeholder={regularEmi ? `Regular EMI: ${regularEmi}` : 'Enter payment amount'}
            style={{ fontSize: '1.25rem', fontWeight: 700, padding: '0.65rem 0.85rem' }}
          />
        </label>

        {/* Quick action chips */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '-0.3rem' }}>
          {regularEmi ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleSetAmount(regularEmi)}
              style={{ fontSize: '0.78rem' }}
            >
              ⚡ Regular EMI: {formatINR(regularEmi)}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleSetAmount(debt.balance)}
            style={{ fontSize: '0.78rem' }}
          >
            🎯 Pay full balance: {formatINR(debt.balance)}
          </button>
        </div>

        {/* Automatic Breakdown Preview Card */}
        {!customSplit && (parsedAmount > 0) ? (
          <div style={{
            background: 'var(--sage)',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            border: '1px solid rgba(72,187,120,0.3)',
            margin: '0.3rem 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>
                📊 How this payment is applied
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--pine)', fontWeight: 600 }}>
                ✓ Auto-calculated
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>Principal (reduces balance)</small>
                <strong style={{ fontSize: '0.98rem', color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{formatINR(autoSplit.principal)}</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginTop: '0.15rem' }}>
                  New balance: {formatINR(newBalance)}
                </span>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>Interest portion</small>
                <strong style={{ fontSize: '0.98rem', color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{formatINR(autoSplit.interest)}</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginTop: '0.15rem' }}>
                  {debt.monthlyRate ? `${debt.monthlyRate}%/mo rate` : (debt.rate ? `${debt.rate}% annual rate` : '0% interest')}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Custom Split Toggle & Inputs */}
        <div style={{ margin: '0.2rem 0' }}>
          <button
            type="button"
            className="text-btn"
            onClick={toggleCustomSplit}
            style={{ fontSize: '0.78rem', color: 'var(--pine)', cursor: 'pointer' }}
          >
            {customSplit ? '↺ Use automatic split instead' : '✏️ Need custom split? Adjust principal, interest & fees manually'}
          </button>
        </div>

        {customSplit ? (
          <div className="debt-form-grid" style={{ background: 'rgba(0,0,0,0.04)', padding: '0.8rem', borderRadius: '8px' }}>
            <label className="field">
              <span>Principal paid</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualPrincipal}
                onChange={(e) => setManualPrincipal(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Interest paid</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualInterest}
                onChange={(e) => setManualInterest(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Fees</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualFees}
                onChange={(e) => setManualFees(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        ) : null}

        <div className="debt-form-grid">
          <label className="field">
            <span>Payment date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Regular EMI, Part prepayment (optional)" />
          </label>
        </div>

        <div className="debt-payment-total">
          <span>Total payment</span>
          <strong>{formatINR(total)}</strong>
        </div>

        {error ? <p className="debt-form-error" role="alert">{error}</p> : null}

        <div className="debt-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save payment</button>
        </div>
      </form>
    </ModalSheet>
  )
}

function dueLabel(date, today) {
  if (!date) return 'No due date'
  if (date < today) return `Overdue · ${formatShortDate(date)}`
  if (date === today) return 'Due today'
  return `Due ${formatShortDate(date)}`
}

function monthlyObligation(debt) {
  if (debt.emi) return debt.emi
  if (debt.minDue) return debt.minDue
  if (debt.monthlyRate != null) return Math.round(debt.balance * debt.monthlyRate) / 100
  if (debt.rate != null && debt.balance) return Math.round((debt.balance * debt.rate) / 1200)
  return 0
}

function DebtImportPreviewModal({ items, onConfirm, onCancel, today }) {
  const [debts, setDebts] = useState(items)

  const selectedDebts = debts.filter((d) => d.selected)
  const newCount = debts.filter((d) => !d.isDuplicate).length
  const duplicateCount = debts.filter((d) => d.isDuplicate).length
  const totalBalance = selectedDebts.reduce((sum, d) => sum + (d.balance || 0), 0)
  const allSelected = debts.length > 0 && debts.every((d) => d.selected)

  function toggleAll(checked) {
    setDebts((prev) => prev.map((d) => ({ ...d, selected: checked })))
  }

  function toggleItem(id) {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)))
  }

  return (
    <ModalSheet titleId="debt-import-title" onDismiss={onCancel} className="sheet-wide debt-sheet">
      <div className="debt-import-preview-shell">
        <div className="sheet-head">
          <div>
            <span className="debt-eyebrow">Import preview</span>
            <h2 id="debt-import-title">Review debts before writing to database</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              Verify liability details, balances, and choose which debts to import.
            </p>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>Close</button>
        </div>

        <div className="import-summary-bar" style={{ margin: '1rem 0' }}>
          <div>
            <strong>{debts.length}</strong> <small style={{ color: 'var(--muted)' }}>debts in file</small>
          </div>
          <div>
            <span style={{ background: 'rgba(72,187,120,0.15)', color: '#276749', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.82rem' }}>
              {newCount} new
            </span>
          </div>
          {duplicateCount > 0 ? (
            <div>
              <span style={{ background: 'rgba(237,137,54,0.15)', color: '#c05621', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.82rem' }}>
                {duplicateCount} already in tracker
              </span>
            </div>
          ) : null}
          <div>
            <small style={{ color: 'var(--muted)' }}>Selected balance to import:</small> <strong>{formatINR(totalBalance)}</strong>
          </div>
        </div>

        <div className="import-table-container">
          <table className="import-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    aria-label="Select all debts"
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>Debt name &amp; lender</th>
                <th>Category</th>
                <th>Remaining balance</th>
                <th>Monthly EMI</th>
                <th>Interest rate</th>
                <th>Tenure left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((item) => {
                const tenureLabel = formatRemainingTenure(item, today)
                return (
                  <tr key={item.id} className={!item.selected ? 'row-dimmed' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        aria-label={`Select ${item.name}`}
                        onChange={() => toggleItem(item.id)}
                      />
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      {item.lender ? <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.lender}</div> : null}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.category || item.kind}</span>
                    </td>
                    <td>
                      <strong>{formatINR(item.balance)}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Orig: {formatINR(item.originalAmount)}</div>
                    </td>
                    <td>
                      {item.emi ? formatINR(item.emi) : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {item.monthlyRate != null ? `${item.monthlyRate}%/mo` : (item.rate != null ? `${item.rate}% p.a.` : '—')}
                    </td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {tenureLabel}
                    </td>
                    <td>
                      {item.isDuplicate ? (
                        <span style={{ fontSize: '0.74rem', padding: '0.2rem 0.45rem', borderRadius: '4px', background: 'rgba(237,137,54,0.15)', color: '#c05621', fontWeight: 600 }}>
                          Existing
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', padding: '0.2rem 0.45rem', borderRadius: '4px', background: 'rgba(72,187,120,0.15)', color: '#276749', fontWeight: 600 }}>
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="debt-form-actions" style={{ marginTop: '1.2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedDebts.length === 0}
            onClick={() => onConfirm(selectedDebts)}
          >
            Import {selectedDebts.length} {selectedDebts.length === 1 ? 'Debt' : 'Debts'} into Tracker
          </button>
        </div>
      </div>
    </ModalSheet>
  )
}

function DebtImportModal({ onDismiss, onFileParsed, existingDebts = [] }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const localFileRef = useRef(null)

  const sampleCsv = [
    'Name,Lender,Loan Amount,Balance,EMI,Interest Rate,Tenure,Start Date,Due Date',
    'Home Loan,SBI Bank,2500000,2100000,22000,8.5,240,2024-03-15,2026-12-05',
    'Personal Loan,HDFC Bank,500000,420000,15200,12.5,36,2025-01-10,2026-12-05',
    'Credit Card,ICICI Bank,60000,40000,10500,18,6,2026-06-01,2026-12-01',
  ].join('\n')

  const sampleJson = JSON.stringify([
    {
      "id": "loan-1",
      "name": "Personal Loan",
      "lender": "HDFC Bank",
      "originalAmount": 500000,
      "balance": 420000,
      "emi": 15200,
      "rate": 12.5,
      "loanTakenDate": "2025-01-10",
      "totalMonths": 36,
      "nextDue": "2026-12-05"
    }
  ], null, 2)

  function downloadTemplate(type) {
    if (type === 'csv') {
      const blob = new Blob([sampleCsv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'debt_template.csv'
      link.click()
      URL.revokeObjectURL(url)
    } else if (type === 'excel') {
      import('xlsx').then((mod) => {
        const XLSX = mod.default || mod
        const rows = sampleCsv.split('\n').map((r) => r.split(','))
        const ws = XLSX.utils.aoa_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Debts')
        XLSX.writeFile(wb, 'debt_template.xlsx')
      })
    } else {
      const blob = new Blob([sampleJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'debt_template.json'
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  async function processFile(file) {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    const today = todayISO()
    const existingIds = new Set(existingDebts.map((d) => d.id))

    try {
      let result

      if (ext === 'csv') {
        const text = await file.text()
        const rows = parseCSV(text)
        if (!rows.length) {
          setError('We couldn\'t read any loans from this CSV. Please check that the first row has column names like "Name", "Loan Amount", "Balance", etc.')
          return
        }
        result = parseDebtImport(rows)
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const rows = await parseExcel(buffer)
        if (!rows.length) {
          setError('We couldn\'t read any loans from this spreadsheet. Please check that the first row has column names like "Name", "Loan Amount", "Balance", etc.')
          return
        }
        result = parseDebtImport(rows)
      } else {
        const text = await file.text()
        result = parseDebtImport(text)
      }

      if (!result.ok) {
        setError(result.error || 'We couldn\'t understand this file. Please try using one of the templates above.')
        return
      }

      const previewList = result.debts.map((d) => {
        const autoMonths = calculateRemainingMonths(d, today)
        return {
          ...d,
          monthsRemaining: autoMonths != null ? autoMonths : d.monthsRemaining,
          isDuplicate: existingIds.has(d.id),
          selected: !existingIds.has(d.id),
        }
      })
      onFileParsed(previewList)
    } catch (err) {
      console.error('Import parse error:', err)
      setError('Something went wrong reading that file. Please make sure it\'s a valid .csv, .xlsx, or .json file.')
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) processFile(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(event) {
    event.preventDefault()
    setDragging(true)
  }

  return (
    <ModalSheet titleId="import-modal-title" onDismiss={onDismiss} className="sheet-wide debt-sheet">
      <div className="sheet-head">
        <div>
          <span className="debt-eyebrow">Add multiple debts at once</span>
          <h2 id="import-modal-title">Import Your Debts</h2>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
            Upload a file with your loan details — we'll do the rest.
          </p>
        </div>
        <button type="button" className="text-btn" onClick={onDismiss}>Close</button>
      </div>

      {/* Step 1: How it works */}
      <div style={{ background: 'var(--sage)', borderRadius: '12px', padding: '1rem 1.2rem', margin: '1rem 0' }}>
        <strong style={{ fontSize: '0.92rem', display: 'block', marginBottom: '0.5rem' }}>📋 How it works</strong>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flex: '1 1 160px' }}>
            <span style={{ background: 'var(--pine)', color: '#fff', borderRadius: '50%', width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>1</span>
            <span style={{ fontSize: '0.85rem' }}>Download a template or prepare your own file</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flex: '1 1 160px' }}>
            <span style={{ background: 'var(--pine)', color: '#fff', borderRadius: '50%', width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>2</span>
            <span style={{ fontSize: '0.85rem' }}>Fill in your loan details — name, amount, balance, EMI, etc.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flex: '1 1 160px' }}>
            <span style={{ background: 'var(--pine)', color: '#fff', borderRadius: '50%', width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>3</span>
            <span style={{ fontSize: '0.85rem' }}>Upload the file here — review and confirm before saving</span>
          </div>
        </div>
      </div>

      {/* Step 2: Download templates */}
      <div style={{ margin: '0.8rem 0' }}>
        <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>📥 Download a ready-made template</strong>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 0.6rem' }}>
          Fill in your details and upload the file back here. Use whichever format is easiest for you.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadTemplate('excel')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span> Excel Template (.xlsx)
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadTemplate('csv')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📄</span> CSV Template (.csv)
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadTemplate('json')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔧</span> JSON Template
          </button>
        </div>
      </div>

      {/* Step 3: Upload area */}
      <input
        ref={localFileRef}
        type="file"
        accept=".json,.csv,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Choose debt file to import"
      />
      <div
        className={`dropzone${dragging ? ' active' : ''}`}
        onClick={() => localFileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        style={{ margin: '1rem 0', padding: '2rem 1.5rem', minHeight: 0 }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') localFileRef.current?.click() }}
      >
        <div className="dropzone-icon-circle" style={{ width: '3rem', height: '3rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.4rem' }}>📁</span>
        </div>
        <p style={{ fontWeight: 600 }}>
          {dragging ? 'Drop your file here!' : 'Click to browse or drag & drop your file'}
        </p>
        <small style={{ color: 'var(--muted)' }}>
          Supports <strong>Excel (.xlsx)</strong>, <strong>CSV</strong>, and <strong>JSON</strong> files
        </small>
      </div>

      {error ? (
        <div role="alert" style={{ background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.25)', borderRadius: '10px', padding: '0.75rem 1rem', margin: '0.5rem 0', fontSize: '0.88rem', color: '#c53030' }}>
          <strong>⚠️ Could not import:</strong> {error}
        </div>
      ) : null}

      {/* Collapsible: What columns does my file need? */}
      <details style={{ margin: '0.8rem 0' }}>
        <summary style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', color: 'var(--ink)', padding: '0.3rem 0' }}>
          ❓ What columns should my file have?
        </summary>
        <div style={{ padding: '0.6rem 0 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div style={{ background: 'var(--sage)', padding: '0.8rem', borderRadius: '10px' }}>
              <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--ink)' }}>Must have (at least these)</strong>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', lineHeight: 1.7, listStyle: 'none' }}>
                <li>✅ <strong>Name</strong> — what you call this loan</li>
                <li>✅ <strong>Loan Amount</strong> — total you borrowed</li>
                <li>✅ <strong>Balance</strong> — how much is still left</li>
              </ul>
            </div>
            <div style={{ background: 'var(--sage)', padding: '0.8rem', borderRadius: '10px' }}>
              <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--ink)' }}>Nice to have (fills in more details)</strong>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', lineHeight: 1.7, listStyle: 'none' }}>
                <li>💡 <strong>Lender / Bank</strong></li>
                <li>💡 <strong>EMI</strong> — monthly payment amount</li>
                <li>💡 <strong>Interest Rate</strong> — annual %</li>
                <li>💡 <strong>Tenure</strong> — total months of the loan</li>
                <li>💡 <strong>Start Date</strong> — when the loan began</li>
                <li>💡 <strong>Due Date</strong> — next payment date</li>
              </ul>
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            💡 <em>Don't worry about exact column names — we understand common variations like "Loan Amount", "Original Amount", "Sanctioned Amount", "Amount", etc.</em>
          </p>
        </div>
      </details>

      {/* Collapsible advanced: JSON sample */}
      <details style={{ margin: '0.5rem 0 0' }}>
        <summary style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--muted)', padding: '0.3rem 0' }}>
          🔧 For developers: JSON format reference
        </summary>
        <div style={{ padding: '0.6rem 0 0' }}>
          <pre style={{
            background: 'rgba(0,0,0,0.12)',
            padding: '0.8rem',
            borderRadius: '8px',
            overflowX: 'auto',
            fontSize: '0.78rem',
            maxHeight: '180px',
          }}>
            <code>{sampleJson}</code>
          </pre>
        </div>
      </details>

      <div className="debt-form-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onDismiss}>Cancel</button>
      </div>
    </ModalSheet>
  )
}

export default function DebtTracker({
  debts = [],
  payments = [],
  recurringExpenses = [],
  onSaveDebt,
  onRecordPayment,
  onImportDebts,
}) {
  const [editingDebt, setEditingDebt] = useState(null)
  const [paymentDebt, setPaymentDebt] = useState(null)
  const [previewDebts, setPreviewDebts] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const today = todayISO()
  const currentMonthKey = today.slice(0, 7)
  const currentMonthName = new Date(today + 'T00:00:00').toLocaleString('en-US', { month: 'short' })
  const activeDebts = useMemo(() => debts.filter((debt) => debt.status !== 'paid' && debt.balance > 0), [debts])
  const totalBalance = activeDebts.reduce((sum, debt) => sum + debt.balance, 0)
  const monthlyPayments = activeDebts.reduce((sum, debt) => sum + monthlyObligation(debt), 0)

  const paymentByDebt = useMemo(() => {
    const map = new Map()
    for (const payment of payments) {
      if (!map.has(payment.debtId)) map.set(payment.debtId, [])
      map.get(payment.debtId).push(payment)
    }
    return map
  }, [payments])

  const paidDebtsThisMonth = useMemo(() => {
    return activeDebts.filter((debt) => {
      const list = paymentByDebt.get(debt.id) || []
      return list.some((p) => p.date && p.date.slice(0, 7) === currentMonthKey)
    })
  }, [activeDebts, paymentByDebt, currentMonthKey])

  const totalPaidThisMonth = useMemo(() => {
    return payments
      .filter((p) => p.date && p.date.slice(0, 7) === currentMonthKey)
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments, currentMonthKey])

  const totalOriginalAmount = useMemo(() => {
    return activeDebts.reduce((sum, debt) => sum + (debt.originalAmount || 0), 0)
  }, [activeDebts])

  const pendingObligationThisMonth = useMemo(() => {
    const pendingDebts = activeDebts.filter((debt) => {
      const list = paymentByDebt.get(debt.id) || []
      return !list.some((p) => p.date && p.date.slice(0, 7) === currentMonthKey)
    })
    return pendingDebts.reduce((sum, debt) => sum + monthlyObligation(debt), 0)
  }, [activeDebts, paymentByDebt, currentMonthKey])

  const nextDue = activeDebts
    .filter((debt) => {
      const list = paymentByDebt.get(debt.id) || []
      const paidThisMonth = list.some((p) => p.date && p.date.slice(0, 7) === currentMonthKey)
      return !paidThisMonth
    })
    .map((debt) => ({ ...debt, displayDue: debt.nextDue || debt.nextInterestDue }))
    .filter((debt) => debt.displayDue)
    .sort((a, b) => a.displayDue.localeCompare(b.displayDue))[0] || activeDebts
    .map((debt) => ({ ...debt, displayDue: debt.nextDue || debt.nextInterestDue }))
    .filter((debt) => debt.displayDue)
    .sort((a, b) => a.displayDue.localeCompare(b.displayDue))[0]

  const linkedEmiByDebt = useMemo(() => new Map(
    recurringExpenses
      .filter((schedule) => schedule.kind === 'emi' && schedule.debtId)
      .map((schedule) => [schedule.debtId, schedule])
  ), [recurringExpenses])

  function handleConfirmImport(selectedDebts) {
    const result = onImportDebts(selectedDebts)
    setPreviewDebts(null)
    setFeedback(result.ok
      ? `Imported ${result.imported} debts${result.skipped ? ` · skipped ${result.skipped} duplicates or invalid records` : ''}.`
      : result.error)
  }

  function handleExportDebts() {
    const blob = new Blob([JSON.stringify(debts, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `debts-export-${today}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const sortedDebts = [...debts].sort((a, b) => {
    const aPaid = a.status === 'paid' || a.balance <= 0
    const bPaid = b.status === 'paid' || b.balance <= 0
    if (aPaid !== bPaid) return aPaid ? 1 : -1
    if (!a.nextDue) return 1
    if (!b.nextDue) return -1
    return a.nextDue.localeCompare(b.nextDue)
  })

  return (
    <section className="page debt-page">
      <header className="debt-page-head">
        <div>
          <span className="debt-eyebrow">Your liabilities · one clear view</span>
          <h1>Debt tracker</h1>
          <p>Track what remains, what’s due, and every payment made.</p>
        </div>
        <div className="debt-head-actions">
          {debts.length > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={handleExportDebts}>Export JSON</button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => setImportModalOpen(true)}>Import Debts</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditingDebt({})}>+ Add debt</button>
        </div>
      </header>

      <section className="debt-overview" aria-label="Debt summary">
        <div className="debt-total">
          <span>Total remaining debt</span>
          <strong>{formatINR(totalBalance)}</strong>
          <small>{activeDebts.length} active {activeDebts.length === 1 ? 'liability' : 'liabilities'} · {formatINR(totalOriginalAmount)} original</small>
        </div>
        <div className="debt-overview-divider" />
        <div className="debt-stat">
          <span>Monthly obligation</span>
          <strong>{formatINR(monthlyPayments)}</strong>
          <small>EMIs and interest per month</small>
        </div>
        <div className="debt-stat">
          <span>This month ({currentMonthName})</span>
          <strong>{paidDebtsThisMonth.length} of {activeDebts.length} paid</strong>
          <small>
            {paidDebtsThisMonth.length === activeDebts.length && activeDebts.length > 0
              ? 'All debts paid for this month! 🎉'
              : `${formatINR(totalPaidThisMonth)} paid · ${formatINR(pendingObligationThisMonth)} pending`}
          </small>
        </div>
      </section>

      {feedback ? <p className="debt-feedback" role="status">{feedback}</p> : null}

      <div className="debt-section-heading">
        <div>
          <span className="debt-eyebrow">Portfolio</span>
          <h2>Your debts</h2>
        </div>
        <span className="debt-count">{debts.length} total</span>
      </div>

      {sortedDebts.length ? (
        <div className="debt-list">
          {sortedDebts.map((debt, index) => {
            const isPaid = debt.status === 'paid' || debt.balance <= 0
            const linkedSchedule = linkedEmiByDebt.get(debt.id)
            const progress = debt.originalAmount > 0
              ? Math.min(100, Math.max(0, ((debt.originalAmount - debt.balance) / debt.originalAmount) * 100))
              : 0
            const debtPayments = (paymentByDebt.get(debt.id) || []).sort((a, b) => b.date.localeCompare(a.date))
            const thisMonthPayments = debtPayments.filter((p) => p.date && p.date.slice(0, 7) === currentMonthKey)
            const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
            const isPaidThisMonth = thisMonthPayments.length > 0
            const isOverdue = Boolean(debt.nextDue && debt.nextDue < today && !isPaid && !isPaidThisMonth)

            return (
              <article className={`debt-card${isPaid ? ' debt-card-paid' : ''}`} key={debt.id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                <div className="debt-card-top">
                  <div className="debt-card-title">
                    <span className="debt-mark" aria-hidden="true">{debt.kind === 'credit_card' ? 'CC' : debt.kind === 'shark' ? 'P' : 'LN'}</span>
                    <div>
                      <h3>{debt.name}</h3>
                      <p>{[debt.lender, debt.category].filter(Boolean).join(' · ') || 'Uncategorized debt'}</p>
                    </div>
                  </div>
                  {isPaid ? (
                    <span className="debt-due paid">Paid off</span>
                  ) : isPaidThisMonth ? (
                    <span className="debt-due this-month-paid">✓ Paid for {currentMonthName}</span>
                  ) : (
                    <span className={`debt-due${isOverdue ? ' overdue' : ''}`}>
                      {dueLabel(debt.nextDue || debt.nextInterestDue, today)}
                    </span>
                  )}
                </div>

                <div className="debt-card-balance">
                  <div>
                    <span>Remaining balance</span>
                    <strong>{formatINR(debt.balance)}</strong>
                  </div>
                  <div className="debt-original">
                    <span>Original loan</span>
                    <strong>{formatINR(debt.originalAmount)}</strong>
                  </div>
                </div>

                <div className="debt-progress" role="progressbar" aria-label={`${debt.name} paid off`} aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  <span>{Math.round(progress)}% repaid ({formatINR(debt.principalPaid || Math.max(0, debt.originalAmount - debt.balance))})</span>
                  <span>{formatINR(debt.balance)} remaining</span>
                </div>

                {!isPaid ? (
                  <div className={`debt-month-indicator ${isPaidThisMonth ? 'paid' : isOverdue ? 'overdue' : 'pending'}`}>
                    <span className="debt-month-icon">{isPaidThisMonth ? '✓' : isOverdue ? '⚠️' : '⏳'}</span>
                    <div className="debt-month-text">
                      {isPaidThisMonth ? (
                        <>
                          <strong>Paid for {currentMonthName}</strong> · {formatINR(thisMonthTotal)} recorded {thisMonthPayments.length > 1 ? `across ${thisMonthPayments.length} payments` : `on ${formatShortDate(thisMonthPayments[0].date)}`}
                        </>
                      ) : isOverdue ? (
                        <>
                          <strong>Overdue for {currentMonthName}</strong> · {monthlyObligation(debt) ? `${formatINR(monthlyObligation(debt))} EMI was due on ${formatShortDate(debt.nextDue)}` : 'Payment overdue'}
                        </>
                      ) : (
                        <>
                          <strong>Pending for {currentMonthName}</strong> · {monthlyObligation(debt) ? `${formatINR(monthlyObligation(debt))} EMI due${debt.nextDue ? ` on ${formatShortDate(debt.nextDue)}` : ''}` : 'Payment not recorded yet'}
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="debt-card-facts">
                  <span>{monthlyObligation(debt) ? `${formatINR(monthlyObligation(debt))} / month` : 'No payment listed'}</span>
                  <span>{debt.monthlyRate != null ? `${debt.monthlyRate}% / month` : debt.rate != null ? `${debt.rate}% annual` : '0% interest'}</span>
                  <span>{formatRemainingTenure(debt, today)}</span>
                </div>

                <div className="debt-card-footer">
                  <div className="debt-payment-preview">
                    {debtPayments.length ? (
                      <>
                        <strong>{debtPayments.length} payment{debtPayments.length === 1 ? '' : 's'} recorded</strong>
                        <span>Last · {formatShortDate(debtPayments[0].date)}</span>
                      </>
                    ) : (debt.principalPaid > 0 || debt.interestPaid > 0) ? (
                      <>
                        <strong>{formatINR(debt.principalPaid || 0)} repaid</strong>
                        <span>{debt.interestPaid > 0 ? `· ${formatINR(debt.interestPaid)} interest paid` : 'Prior to tracker'}</span>
                      </>
                    ) : (
                      <span>No payments recorded yet</span>
                    )}
                  </div>
                  <div className="debt-card-actions">
                    <button type="button" className="text-btn" onClick={() => setEditingDebt(debt)}>Edit</button>
                    {!isPaid ? (
                      <button
                        type="button"
                        className={`btn ${isPaidThisMonth ? 'btn-secondary' : 'btn-primary'} debt-pay-btn`}
                        onClick={() => setPaymentDebt(debt)}
                      >
                        {isPaidThisMonth ? '+ Extra payment' : (linkedSchedule ? 'Record extra payment' : 'Record payment')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="debt-empty">
          <span className="debt-empty-symbol" aria-hidden="true">−</span>
          <h3>Nothing to repay here yet</h3>
          <p>Add your first debt, or import your existing list as a JSON file.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditingDebt({})}>Add your first debt</button>
        </div>
      )}

      {payments.length ? (
        <section className="debt-history">
          <div className="debt-section-heading">
            <div>
              <span className="debt-eyebrow">Recent activity</span>
              <h2>Payment history</h2>
            </div>
          </div>
          <div className="debt-history-list">
            {[...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((payment) => {
              const debt = debts.find((item) => item.id === payment.debtId)
              return (
                <article className="debt-history-row" key={payment.id}>
                  <div className="debt-history-date"><strong>{formatShortDate(payment.date)}</strong><span>{debt?.name || 'Debt payment'}</span></div>
                  <div className="debt-history-split"><span>{formatINR(payment.principal)} principal</span><span>{formatINR(payment.interest)} interest{payment.fees ? ` · ${formatINR(payment.fees)} fees` : ''}</span></div>
                  <strong className="debt-history-amount">{formatINR(payment.amount)}</strong>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {editingDebt ? (
        <DebtForm
          initial={editingDebt.id ? editingDebt : null}
          onSave={onSaveDebt}
          onCancel={() => setEditingDebt(null)}
        />
      ) : null}
      {paymentDebt ? (
        <PaymentForm
          debt={paymentDebt}
          linkedSchedule={linkedEmiByDebt.get(paymentDebt.id)}
          onSave={onRecordPayment}
          onCancel={() => setPaymentDebt(null)}
        />
      ) : null}
      {previewDebts ? (
        <DebtImportPreviewModal
          items={previewDebts}
          today={today}
          onConfirm={handleConfirmImport}
          onCancel={() => setPreviewDebts(null)}
        />
      ) : null}
      {importModalOpen ? (
        <DebtImportModal
          existingDebts={debts}
          onDismiss={() => setImportModalOpen(false)}
          onFileParsed={(previewList) => {
            setImportModalOpen(false)
            setPreviewDebts(previewList)
          }}
        />
      ) : null}
    </section>
  )
}
