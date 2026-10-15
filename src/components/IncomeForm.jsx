import { useRef, useState, useMemo } from 'react'
import { formatINR, formatMonthLabel, parseAmount, todayISO } from '../utils/formatting.js'
import ModalSheet from './ModalSheet.jsx'
import { IconPlus, IconTrash, IconBuildingBank, IconCoins } from '@tabler/icons-react'

const INCOME_PRESETS = ['Salary', 'Freelance', 'Rental', 'Bonus', 'Dividends', 'Gift']

export default function IncomeForm({
  month,
  initialAmount = '',
  accounts = [],
  initialAccountId = '',
  incomeSources = [],
  onAddIncomeSource,
  onDeleteIncomeSource,
  onSaveFlatIncome,
  onCancel,
}) {
  const currentMonthSources = useMemo(
    () => (incomeSources || []).filter((s) => s.monthKey === month),
    [incomeSources, month]
  )

  const defaultAcc = accounts.find((a) => a.isDefault && a.type !== 'credit_card') || accounts.find((a) => a.type !== 'credit_card') || accounts[0]
  
  // State for new stream entry
  const [sourceName, setSourceName] = useState('')
  const [sourceAmount, setSourceAmount] = useState('')
  const [sourceDate, setSourceDate] = useState(() => {
    const today = todayISO()
    return today.startsWith(month) ? today : `${month}-01`
  })
  const [sourceAccountId, setSourceAccountId] = useState(defaultAcc?.id || '')
  
  // State for flat income fallback
  const [flatAmount, setFlatAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [flatAccountId, setFlatAccountId] = useState(initialAccountId || defaultAcc?.id || '')
  const [activeTab, setActiveTab] = useState(() => (currentMonthSources.length > 0 ? 'streams' : 'streams'))
  const [error, setError] = useState(null)
  const amountRef = useRef(null)

  const totalSourcesAmount = useMemo(
    () => currentMonthSources.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [currentMonthSources]
  )

  function handleAddSource(e) {
    e.preventDefault()
    setError(null)
    const name = sourceName.trim()
    if (!name) {
      setError('Please provide a name or type for this income stream.')
      return
    }
    const val = parseAmount(sourceAmount)
    if (!Number.isFinite(val) || val <= 0) {
      setError('Enter a valid income amount greater than zero.')
      return
    }

    if (onAddIncomeSource) {
      onAddIncomeSource({
        name,
        amount: val,
        date: sourceDate,
        monthKey: month,
        accountId: sourceAccountId || null,
      })
      // Clear stream form inputs for next entry
      setSourceName('')
      setSourceAmount('')
    }
  }

  function handleSaveFlat(e) {
    e.preventDefault()
    setError(null)
    const val = parseAmount(flatAmount)
    if (!Number.isFinite(val) || val <= 0) {
      setError('Enter a valid income amount greater than zero.')
      return
    }
    if (onSaveFlatIncome) {
      onSaveFlatIncome(val, flatAccountId || null)
    }
  }

  function handleConvertFlatToStream() {
    if (!initialAmount || !onAddIncomeSource) return
    onAddIncomeSource({
      name: 'Primary Salary',
      amount: Number(initialAmount),
      date: `${month}-01`,
      monthKey: month,
      accountId: initialAccountId || defaultAcc?.id || null,
    })
    // Also reset flat income since itemized stream will now drive the month
    if (onSaveFlatIncome) {
      onSaveFlatIncome(0, null)
    }
  }

  const parsedStreamAmount = useMemo(() => parseAmount(sourceAmount), [sourceAmount])

  return (
    <ModalSheet
      titleId="income-form-title"
      descriptionId="income-form-month"
      initialFocusRef={amountRef}
      onDismiss={onCancel}
    >
      <div className="sheet-form">
        <div className="sheet-head">
          <div>
            <h2 id="income-form-title">Manage Income</h2>
            <p id="income-form-month" className="muted">{formatMonthLabel(month)}</p>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>
            Done
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="segmented-control mb-sm" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'streams'}
            className={activeTab === 'streams' ? 'active' : ''}
            onClick={() => setActiveTab('streams')}
          >
            Income Streams {currentMonthSources.length > 0 ? `(${currentMonthSources.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flat'}
            className={activeTab === 'flat' ? 'active' : ''}
            onClick={() => setActiveTab('flat')}
          >
            Single Flat Income
          </button>
        </div>

        {activeTab === 'streams' ? (
          <div>
            {/* Monthly Total Header */}
            <div className="income-total-banner">
              <div>
                <span className="income-total-label">Total Monthly Inflow</span>
                <div className="income-total-val">{formatINR(totalSourcesAmount)}</div>
              </div>
              <IconCoins size={28} className="income-total-icon" />
            </div>

            {/* If user had flat income previously and no streams, suggest conversion */}
            {initialAmount && currentMonthSources.length === 0 ? (
              <div className="stream-convert-notice">
                <span>You have a flat income of <strong>{formatINR(initialAmount)}</strong> for {formatMonthLabel(month)}.</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleConvertFlatToStream}
                >
                  Convert to Stream
                </button>
              </div>
            ) : null}

            {/* List of Existing Streams */}
            {currentMonthSources.length > 0 ? (
              <div className="income-sources-list">
                <h4>Active Streams for {formatMonthLabel(month)}</h4>
                {currentMonthSources.map((source) => {
                  const targetAcc = accounts.find((a) => a.id === source.accountId)
                  return (
                    <div key={source.id} className="income-source-item">
                      <div className="income-source-info">
                        <div className="income-source-title">
                          <strong>{source.name}</strong>
                          <span className="income-source-date">{source.date}</span>
                        </div>
                        <div className="income-source-account">
                          <IconBuildingBank size={14} />
                          <span>{targetAcc ? targetAcc.name : 'Unassigned Account'}</span>
                        </div>
                      </div>
                      <div className="income-source-right">
                        <span className="income-source-amount">+{formatINR(source.amount)}</span>
                        {onDeleteIncomeSource ? (
                          <button
                            type="button"
                            className="icon-btn-danger"
                            title="Delete this stream"
                            aria-label={`Delete ${source.name}`}
                            onClick={() => onDeleteIncomeSource(source.id)}
                          >
                            <IconTrash size={15} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* Add New Stream Form */}
            <form onSubmit={handleAddSource} className="add-stream-card mt-md" noValidate>
              <h4>+ Add Income Stream</h4>

              {/* Quick Presets */}
              <div className="preset-strip" role="group" aria-label="Income presets">
                {INCOME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`preset-pill ${sourceName === preset ? 'active' : ''}`}
                    onClick={() => setSourceName(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Stream Name</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Salary, Upwork, House Rent"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Amount (supports math)</span>
                  <div className="amount-input">
                    <span>₹</span>
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="e.g. 75000 or 50000 + 15000"
                      value={sourceAmount}
                      onChange={(e) => setSourceAmount(e.target.value)}
                    />
                  </div>
                  {parsedStreamAmount && parsedStreamAmount > 0 && String(sourceAmount).match(/[+\-*/]/) ? (
                    <div className="math-preview-pill">
                      = {formatINR(parsedStreamAmount)}
                    </div>
                  ) : null}
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Deposit Date</span>
                  <input
                    type="date"
                    required
                    value={sourceDate}
                    onChange={(e) => setSourceDate(e.target.value)}
                  />
                </label>

                {accounts.length ? (
                  <label className="field">
                    <span>Deposit into Account</span>
                    <select
                      value={sourceAccountId}
                      onChange={(e) => setSourceAccountId(e.target.value)}
                    >
                      <option value="">None / Unassigned</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {error ? <p className="form-error" role="alert">{error}</p> : null}

              <button type="submit" className="btn btn-primary btn-block mt-sm">
                <IconPlus size={16} /> Add Income Stream
              </button>
            </form>
          </div>
        ) : (
          /* Flat Income Tab */
          <form onSubmit={handleSaveFlat} noValidate className="mt-sm">
            <p className="field-hint mb-md">
              Set a single lump-sum monthly income figure if you prefer not to itemize individual deposits.
            </p>

            <label className="field">
              <span>Monthly Total Income</span>
              <div className="amount-input">
                <span>₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="80000"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(e.target.value)}
                />
              </div>
            </label>

            {accounts.length ? (
              <label className="field">
                <span>Deposit into account</span>
                <select
                  value={flatAccountId}
                  onChange={(e) => setFlatAccountId(e.target.value)}
                >
                  <option value="">None / Unassigned</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? <p className="form-error" role="alert">{error}</p> : null}

            <button type="submit" className="btn btn-primary btn-block mt-md">
              Save Flat Income
            </button>
          </form>
        )}
      </div>
    </ModalSheet>
  )
}
