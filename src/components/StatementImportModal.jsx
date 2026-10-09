import { useState, useRef } from 'react'
import ModalSheet from './ModalSheet.jsx'
import { parseBankStatementCSV } from '../utils/csvParser.js'
import { formatINR, formatShortDate } from '../utils/formatting.js'
import { IconUpload, IconFileSpreadsheet, IconAlertTriangle, IconCheck } from '@tabler/icons-react'

export default function StatementImportModal({
  categories = [],
  accounts = [],
  existingExpenses = [],
  onImportBatch,
  onDismiss,
}) {
  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || ''
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccId)
  const [transactions, setTransactions] = useState(null)
  const [summaryInfo, setSummaryInfo] = useState(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileSelected(file) {
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = String(e.target?.result || '')
      const result = parseBankStatementCSV(text, {
        availableCategories: categories,
        existingExpenses,
        defaultAccountId: selectedAccountId,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setTransactions(result.transactions)
      setSummaryInfo({
        totalParsed: result.totalParsed,
        duplicateCount: result.duplicateCount,
      })
    }
    reader.onerror = () => {
      setError('Could not read the selected file.')
    }
    reader.readAsText(file)
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

  function handleConfirmImport() {
    const toImport = (transactions || [])
      .filter((t) => t.selected)
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        category: t.category,
        note: t.note,
        accountId: selectedAccountId || null,
      }))

    if (!toImport.length) {
      setError('No transactions selected for import.')
    }

    onImportBatch(toImport)
    onDismiss()
  }

  const selectedCount = (transactions || []).filter((t) => t.selected).length
  const selectedTotal = (transactions || [])
    .filter((t) => t.selected)
    .reduce((sum, t) => sum + t.amount, 0)

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
              onClick={() => fileInputRef.current?.click()}
            >
              <IconFileSpreadsheet size={42} stroke={1.5} style={{ opacity: 0.8 }} />
              <p><strong>Click to choose a CSV file</strong> or drag and drop here</p>
              <small className="muted">
                Supports HDFC, SBI, ICICI, Axis, Kotak, and Standard bank statement CSV files
              </small>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/comma-separated-values"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelected(e.target.files[0])
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
              {summaryInfo?.duplicateCount > 0 ? (
                <div className="duplicate-alert">
                  <IconAlertTriangle size={16} />
                  <span>{summaryInfo.duplicateCount} duplicate{summaryInfo.duplicateCount > 1 ? 's' : ''} auto-unselected</span>
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
                        {t.isDuplicate ? (
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
