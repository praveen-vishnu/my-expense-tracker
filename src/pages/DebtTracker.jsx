import { useMemo, useRef, useState } from 'react'
import ModalSheet from '../components/ModalSheet.jsx'
import { formatINR, formatShortDate, isValidDate, parseAmount, todayISO } from '../utils/formatting.js'

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
    const result = onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      ...values,
      originalAmount,
      balance,
      rate: amountField(values.rate),
      monthlyRate: amountField(values.monthlyRate),
      emi: amountField(values.emi),
      monthsRemaining: integerField(values.monthsRemaining),
      totalMonths: integerField(values.totalMonths),
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
            <span>Months remaining</span>
            <input type="number" min="0" step="1" value={values.monthsRemaining} onChange={(event) => update('monthsRemaining', event.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            <span>Original start date</span>
            <input type="date" value={values.loanTakenDate} onChange={(event) => update('loanTakenDate', event.target.value)} />
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
  const [principal, setPrincipal] = useState('')
  const [interest, setInterest] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const principalRef = useRef(null)
  const principalAmount = parseAmount(principal)
  const interestAmount = interest === '' ? 0 : parseAmount(interest)
  const feeAmount = fees === '' ? 0 : parseAmount(fees)
  const total = [principalAmount, interestAmount, feeAmount].every(Number.isFinite)
    ? principalAmount + interestAmount + feeAmount
    : 0

  function submit(event) {
    event.preventDefault()
    if (!Number.isFinite(principalAmount) || principalAmount < 0 || !Number.isFinite(interestAmount) || interestAmount < 0 || !Number.isFinite(feeAmount) || feeAmount < 0 || total <= 0) {
      setError('Enter a positive payment amount split between principal, interest, and fees.')
      principalRef.current?.focus()
      return
    }
    if (principalAmount > debt.balance) {
      setError('Principal paid cannot be more than the remaining balance.')
      principalRef.current?.focus()
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
    <ModalSheet titleId="debt-payment-title" initialFocusRef={principalRef} onDismiss={onCancel} className="debt-sheet">
      <form className="sheet-form" noValidate onSubmit={submit}>
        <div className="sheet-head">
          <div>
            <span className="debt-eyebrow">Payment entry · {debt.name}</span>
            <h2 id="debt-payment-title">{linkedSchedule ? 'Record an extra payment' : 'Record a payment'}</h2>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>Close</button>
        </div>
        {linkedSchedule ? (
          <p className="debt-payment-balance">
            The scheduled EMI updates this debt automatically when its current-month expense is generated. Use this form only for additional payments.
          </p>
        ) : null}
        <p className="debt-payment-balance">Remaining principal <strong>{formatINR(debt.balance)}</strong></p>
        <div className="debt-form-grid">
          <label className="field">
            <span>Principal paid</span>
            <input ref={principalRef} type="number" min="0" step="0.01" value={principal} onChange={(event) => setPrincipal(event.target.value)} placeholder="0" />
          </label>
          <label className="field">
            <span>Interest paid</span>
            <input type="number" min="0" step="0.01" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="0" />
          </label>
          <label className="field">
            <span>Fees</span>
            <input type="number" min="0" step="0.01" value={fees} onChange={(event) => setFees(event.target.value)} placeholder="0" />
          </label>
          <label className="field">
            <span>Payment date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field debt-field-wide">
            <span>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="debt-payment-total"><span>Total payment</span><strong>{formatINR(total)}</strong></div>
        <p className="debt-form-hint">Only the principal portion reduces your outstanding balance.</p>
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
  return 0
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
  const [feedback, setFeedback] = useState('')
  const fileRef = useRef(null)
  const today = todayISO()
  const activeDebts = useMemo(() => debts.filter((debt) => debt.status !== 'paid' && debt.balance > 0), [debts])
  const totalBalance = activeDebts.reduce((sum, debt) => sum + debt.balance, 0)
  const monthlyPayments = activeDebts.reduce((sum, debt) => sum + monthlyObligation(debt), 0)
  const nextDue = activeDebts
    .map((debt) => ({ ...debt, displayDue: debt.nextDue || debt.nextInterestDue }))
    .filter((debt) => debt.displayDue)
    .sort((a, b) => a.displayDue.localeCompare(b.displayDue))[0]
  const paymentByDebt = useMemo(() => {
    const map = new Map()
    for (const payment of payments) {
      if (!map.has(payment.debtId)) map.set(payment.debtId, [])
      map.get(payment.debtId).push(payment)
    }
    return map
  }, [payments])
  const linkedEmiByDebt = useMemo(() => new Map(
    recurringExpenses
      .filter((schedule) => schedule.kind === 'emi' && schedule.debtId)
      .map((schedule) => [schedule.debtId, schedule])
  ), [recurringExpenses])

  async function handleImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = onImportDebts(text)
      setFeedback(result.ok
        ? `Imported ${result.imported} debts${result.skipped ? ` · skipped ${result.skipped} duplicates or invalid records` : ''}.`
        : result.error)
    } catch (error) {
      console.error('Debt import failed:', error)
      setFeedback('The selected debt file could not be read.')
    }
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
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} aria-label="Import debt JSON file" />
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditingDebt({})}>+ Add debt</button>
        </div>
      </header>

      <section className="debt-overview" aria-label="Debt summary">
        <div className="debt-total">
          <span>Outstanding balance</span>
          <strong>{formatINR(totalBalance)}</strong>
          <small>{activeDebts.length} active {activeDebts.length === 1 ? 'debt' : 'debts'}</small>
        </div>
        <div className="debt-overview-divider" />
        <div className="debt-stat">
          <span>Monthly payments</span>
          <strong>{formatINR(monthlyPayments)}</strong>
          <small>EMIs, minimums and estimated interest</small>
        </div>
        <div className="debt-stat">
          <span>Next payment</span>
          <strong>{nextDue ? formatINR(monthlyObligation(nextDue)) : '—'}</strong>
          <small>{nextDue ? `${nextDue.name} · ${dueLabel(nextDue.displayDue, today)}` : 'No upcoming due dates'}</small>
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
                  <span className={`debt-due${debt.nextDue && debt.nextDue < today && !isPaid ? ' overdue' : ''}${isPaid ? ' paid' : ''}`}>
                    {isPaid ? 'Paid off' : dueLabel(debt.nextDue || debt.nextInterestDue, today)}
                  </span>
                </div>

                <div className="debt-card-balance">
                  <div>
                    <span>Remaining</span>
                    <strong>{formatINR(debt.balance)}</strong>
                  </div>
                  <div className="debt-original">
                    <span>Original</span>
                    <strong>{formatINR(debt.originalAmount)}</strong>
                  </div>
                </div>

                <div className="debt-progress" role="progressbar" aria-label={`${debt.name} paid off`} aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
                  <span style={{ width: `${progress}%` }} />
                </div>

                <div className="debt-card-facts">
                  <span>{monthlyObligation(debt) ? `${formatINR(monthlyObligation(debt))} / month` : 'No payment listed'}</span>
                  <span>{debt.monthlyRate != null ? `${debt.monthlyRate}% / month` : debt.rate != null ? `${debt.rate}% annual` : 'Rate not set'}</span>
                  <span>{debt.monthsRemaining != null ? `${debt.monthsRemaining} months left` : 'Term not set'}</span>
                </div>

                <div className="debt-card-footer">
                  <div className="debt-payment-preview">
                    {debtPayments.length
                      ? <><strong>{debtPayments.length} payment{debtPayments.length === 1 ? '' : 's'}</strong><span>Last · {formatShortDate(debtPayments[0].date)}</span></>
                      : <span>No payments recorded yet</span>}
                  </div>
                  <div className="debt-card-actions">
                    <button type="button" className="text-btn" onClick={() => setEditingDebt(debt)}>Edit</button>
                    {!isPaid ? <button type="button" className="btn btn-secondary debt-pay-btn" onClick={() => setPaymentDebt(debt)}>{linkedSchedule ? 'Record extra payment' : 'Record payment'}</button> : null}
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
    </section>
  )
}
