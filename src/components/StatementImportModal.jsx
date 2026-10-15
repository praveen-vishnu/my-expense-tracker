import { useState, useRef } from 'react'
import ModalSheet from './ModalSheet.jsx'
import { parseBankStatementFile } from '../utils/csvParser.js'
import { formatINR, formatShortDate } from '../utils/formatting.js'
import { IconUpload, IconFileSpreadsheet, IconAlertTriangle, IconCheck } from '@tabler/icons-react'

export default function StatementImportModal({
  categories = [],
  accounts = [],
  existingExpenses = [],
  aliases = [],
  onConfirmAlias,
  onRejectAlias,
  onImportBatch,
  onDismiss,
}) {
  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || ''
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccId)
  const [transactions, setTransactions] = useState(null)
  const [summaryInfo, setSummaryInfo] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  async function handleFileSelected(file) {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const result = await parseBankStatementFile(file, {
        availableCategories: categories,
        existingExpenses,
        aliases,
        defaultAccountId: selectedAccountId,
      })

      if (!result.ok) {
        setError(result.error)
        setLoading(false)
        return
      }

      setTransactions(result.transactions)
      setSummaryInfo({
        totalParsed: result.totalParsed,
        duplicateCount: result.duplicateCount,
        recurringCount: result.recurringCount || 0,
        suggestedCount: result.suggestedCount || 0,
      })
    } catch (err) {
      setError(`Failed to read statement: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFileSelected(file)
  }

  function toggleTransaction(id) {
    setTransactions((current) =>
      current.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    )
  }

  function updateCategory(id, newCategory) {
    setTransactions((current) =>
      current.map((t) => (t.id === id ? { ...t, category: newCategory } : t))
    )
  }

  function selectAll(val) {
    setTransactions((current) => current.map((t) => ({ ...t, selected: val })))
  }

  function handleLinkSuggestion(id) {
    setTransactions((current) =>
      current.map((t) => {
        if (t.id !== id) return t
        if (onConfirmAlias && t.matchedExpenseId && t.rawNarration) {
          onConfirmAlias(t.matchedExpenseId, t.rawNarration)
        }
        return {
          ...t,
          matchStatus: 'linked',
          isDuplicate: true,
          isRecurringMatch: true,
          selected: false,
        }
      })
    )
  }

  function handleDismissSuggestion(id) {
    setTransactions((current) =>
      current.map((t) => {
        if (t.id !== id) return t
        if (onRejectAlias && t.matchedExpenseId && t.rawNarration) {
          onRejectAlias(t.matchedExpenseId, t.rawNarration)
        }
        return {
          ...t,
          matchStatus: 'new',
          isDuplicate: false,
          isRecurringMatch: false,
          matchedExpenseId: null,
          matchedNote: null,
          selected: true,
        }
      })
    )
  }

  function handleUndoLinked(id) {
    setTransactions((current) =>
      current.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          matchStatus: 'new',
          isDuplicate: false,
          isRecurringMatch: false,
          matchedExpenseId: null,
          matchedNote: null,
          selected: true,
        }
      })
    )
  }

  function handleConfirmImport() {
    const selected = (transactions || []).filter((t) => t.selected)
    const toImport = selected.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      category: t.category,
      note: t.note,
      accountId: selectedAccountId || null,
    }))

    if (!toImport.length) {
      setError('No transactions selected for import.')
      return
    }

    // Collect any recurring expenses that the user explicitly chose to import/replace
    const replacedRecurringIds = selected
      .filter((t) => t.isRecurringMatch && t.matchedExpenseId)
      .map((t) => t.matchedExpenseId)

    onImportBatch(toImport, replacedRecurringIds)
    onDismiss()
  }

  const selectedCount = (transactions || []).filter((t) => t.selected).length
  const selectedTotal = (transactions || [])
    .filter((t) => t.selected)
    .reduce((sum, t) => sum + t.amount, 0)
  const duplicateCount = (transactions || []).filter((t) => t.isDuplicate).length
  const recurringCount = (transactions || []).filter((t) => t.isRecurringMatch).length
  const suggestedCount = (transactions || []).filter((t) => t.matchStatus === 'suggested').length

  return (
    <ModalSheet titleId="import-modal-title" className="sheet-wide" onDismiss={onDismiss}>
      <div className="import-modal-shell">
        <div className="sheet-head">
          <div>
            <h2 id="import-modal-title">Import Bank Statement</h2>
            <p className="muted">Auto-parse and reconcile expenses from CSV statements.</p>
          </div>
          <button type="button" className="text-btn" onClick={onDismiss}>
            Close
          </button>
        </div>

        {!transactions ? (
          <div className="import-upload-stage">
            {accounts.length > 0 ? (
              <label className="field" style={{ marginBottom: '1.25rem' }}>
                <span>Importing to Account</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : 'Cash'})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
              style={loading ? { opacity: 0.6, cursor: 'wait' } : {}}
            >
              <IconFileSpreadsheet size={42} stroke={1.5} style={{ opacity: 0.8 }} />
              <p>
                {loading ? (
                  <strong>Parsing statement transactions...</strong>
                ) : (
                  <>
                    <strong>Click to choose a file</strong> or drag and drop here
                  </>
                )}
              </p>
              <small className="muted">
                Supports Excel (<strong>.xlsx, .xls</strong>), Text (<strong>.txt, .tsv</strong>), and <strong>.csv</strong> statements from HDFC, SBI, ICICI, Axis, Kotak & more
              </small>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt,.tsv,text/csv,text/plain,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) handleFileSelected(file)
                }}
              />
            </div>

            {error ? <p className="form-error" role="alert" style={{ marginTop: '1rem' }}>{error}</p> : null}
          </div>
        ) : (
          <div className="import-preview-stage">
            <div className="import-summary-bar">
              <div className="summary-col">
                <strong>{selectedCount} of {summaryInfo?.totalParsed} selected</strong>
                <small className="muted">Total: <span className="money">{formatINR(selectedTotal)}</span></small>
              </div>
              {duplicateCount > 0 || suggestedCount > 0 ? (
                <div className="duplicate-alert">
                  <IconAlertTriangle size={16} />
                  <span>
                    {duplicateCount > 0
                      ? `${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} auto-unselected`
                      : ''}
                    {recurringCount > 0
                      ? ` (${recurringCount} recurring matched)`
                      : ''}
                    {duplicateCount > 0 && suggestedCount > 0 ? ' · ' : ''}
                    {suggestedCount > 0
                      ? `${suggestedCount} suggestion${suggestedCount > 1 ? 's' : ''} to review`
                      : ''}
                  </span>
                </div>
              ) : null}
              <div className="batch-toggle-btns">
                <button type="button" className="text-btn" onClick={() => selectAll(true)}>
                  Select All
                </button>
                <button type="button" className="text-btn" onClick={() => selectAll(false)}>
                  Deselect All
                </button>
              </div>
            </div>

            <div className="import-table-container">
              <table className="import-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>✓</th>
                    <th>Date</th>
                    <th>Merchant / Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className={t.selected ? '' : 'row-dimmed'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={t.selected}
                          onChange={() => toggleTransaction(t.id)}
                          aria-label={`Select ${t.note}`}
                        />
                      </td>
                      <td className="table-date">{formatShortDate(t.date)}</td>
                      <td>
                        <strong>{t.note}</strong>
                        {t.matchStatus === 'linked' ? (
                          <span
                            className="dup-badge recurring-badge"
                            title={t.matchReasons?.join(', ') || 'Matches an existing recurring schedule for this month'}
                          >
                            Matches {t.matchedNote || t.category}
                            <button
                              type="button"
                              className="badge-action-btn"
                              onClick={() => handleUndoLinked(t.id)}
                              title="Unlink and keep this transaction selected for import"
                            >
                              Undo
                            </button>
                          </span>
                        ) : t.matchStatus === 'suggested' ? (
                          <span
                            className="dup-badge suggested-badge"
                            title={t.matchReasons?.join(', ') || 'Possible match for a recurring expense'}
                          >
                            Looks like {t.matchedNote || t.category}?
                            <button
                              type="button"
                              className="badge-action-btn"
                              onClick={() => handleLinkSuggestion(t.id)}
                              title="Link to recurring expense and remember for future statements"
                            >
                              Link
                            </button>
                            <button
                              type="button"
                              className="badge-action-btn"
                              onClick={() => handleDismissSuggestion(t.id)}
                              title="Not this expense (remember rejection)"
                            >
                              Not this
                            </button>
                          </span>
                        ) : t.isDuplicate ? (
                          <span className="dup-badge">Already logged</span>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="table-select"
                          value={t.category}
                          onChange={(e) => updateCategory(t.id, e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="money">{formatINR(t.amount)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error ? <p className="form-error" role="alert" style={{ marginTop: '0.75rem' }}>{error}</p> : null}

            <div className="import-dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTransactions(null)
                  setError('')
                }}
              >
                Choose another file
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedCount === 0}
                onClick={handleConfirmImport}
              >
                Import {selectedCount} {selectedCount === 1 ? 'Expense' : 'Expenses'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalSheet>
  )
}
