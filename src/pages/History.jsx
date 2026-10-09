import { useMemo, useState } from 'react'
import ExpenseList from '../components/ExpenseList.jsx'
import StatementPrintModal from '../components/StatementPrintModal.jsx'
import { expensesForMonth, groupExpensesByDate } from '../utils/calculations.js'
import { formatINR, formatMonthLabel } from '../utils/formatting.js'
import { generateExpensesCSV, downloadCSV } from '../utils/exportEngine.js'
import {
  IconDownload,
  IconPrinter,
  IconChecklist,
  IconTrash,
  IconTag,
  IconCreditCard,
  IconX,
} from '@tabler/icons-react'

export default function History({
  data,
  month,
  onEditExpense,
  onDeleteExpense,
  onDeleteBatchExpenses,
  onUpdateBatchExpenses,
  setConfirm,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [dateScope, setDateScope] = useState('month') // 'month' | 'all'
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [printModal, setPrintModal] = useState(false)

  // Scope base list
  const baseExpenses = useMemo(() => {
    if (dateScope === 'all') {
      return data.expenses || []
    }
    return expensesForMonth(data.expenses || [], month)
  }, [data.expenses, month, dateScope])

  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const minimum = minAmount === '' ? 0 : Number(minAmount)
    const maximum = maxAmount === '' ? Infinity : Number(maxAmount)

    return baseExpenses.filter((expense) => {
      const matchesQuery =
        !normalizedQuery ||
        expense.category.toLowerCase().includes(normalizedQuery) ||
        (expense.note && expense.note.toLowerCase().includes(normalizedQuery))

      const matchesCategory = category === 'all' || expense.category === category

      const matchesAccount =
        accountFilter === 'all' ||
        (accountFilter === 'unassigned' && !expense.accountId) ||
        expense.accountId === accountFilter

      const matchesFrom = !fromDate || expense.date >= fromDate
      const matchesTo = !toDate || expense.date <= toDate
      const matchesMinimum = !Number.isNaN(minimum) && expense.amount >= minimum
      const matchesMaximum = !Number.isNaN(maximum) && expense.amount <= maximum

      return (
        matchesQuery &&
        matchesCategory &&
        matchesAccount &&
        matchesFrom &&
        matchesTo &&
        matchesMinimum &&
        matchesMaximum
      )
    })
  }, [baseExpenses, query, category, accountFilter, fromDate, toDate, minAmount, maxAmount])

  const groups = useMemo(() => groupExpensesByDate(filteredList), [filteredList])

  const filteredTotal = useMemo(
    () => filteredList.reduce((sum, item) => sum + item.amount, 0),
    [filteredList]
  )

  const usedCategories = useMemo(() => {
    return [...new Set(baseExpenses.map((expense) => expense.category))].sort()
  }, [baseExpenses])

  const hasFilters =
    query ||
    category !== 'all' ||
    accountFilter !== 'all' ||
    dateScope !== 'month' ||
    fromDate ||
    toDate ||
    minAmount ||
    maxAmount

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setAccountFilter('all')
    setDateScope('month')
    setFromDate('')
    setToDate('')
    setMinAmount('')
    setMaxAmount('')
  }

  // Export handlers
  function handleExportCSV() {
    const csv = generateExpensesCSV(filteredList, data.accounts || [])
    const filename = `khaata-${dateScope === 'month' ? month : 'all-expenses'}.csv`
    downloadCSV(csv, filename)
  }

  // Selection handlers
  function handleToggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredList.map((e) => e.id)))
  }

  function handleDeselectAll() {
    setSelectedIds(new Set())
  }

  function handleToggleSelectionMode() {
    if (selectionMode) {
      setSelectionMode(false)
      setSelectedIds(new Set())
    } else {
      setSelectionMode(true)
    }
  }

  // Batch actions
  function handleBatchDeletePrompt() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return

    setConfirm({
      title: `Delete ${ids.length} selected ${ids.length === 1 ? 'expense' : 'expenses'}?`,
      message: `Are you sure you want to remove these ${ids.length} transactions? This action cannot be undone.`,
      confirmLabel: `Delete ${ids.length} ${ids.length === 1 ? 'expense' : 'expenses'}`,
      danger: true,
      onConfirm: () => {
        onDeleteBatchExpenses(ids)
        setSelectedIds(new Set())
        setConfirm(null)
      },
    })
  }

  function handleBatchCategoryChange(newCategory) {
    if (!newCategory) return
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    onUpdateBatchExpenses(ids, { category: newCategory })
    setSelectedIds(new Set())
  }

  function handleBatchAccountChange(newAccountId) {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    onUpdateBatchExpenses(ids, { accountId: newAccountId === 'none' ? null : newAccountId })
    setSelectedIds(new Set())
  }

  const selectedCount = selectedIds.size
  const selectedTotal = useMemo(() => {
    return filteredList
      .filter((e) => selectedIds.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0)
  }, [filteredList, selectedIds])

  return (
    <div className="page history-page">
      <header className="page-intro">
        <div className="history-header-row">
          <div>
            <h1>History</h1>
            <p>
              {dateScope === 'month'
                ? `Every expense in ${formatMonthLabel(month)}, grouped by date.`
                : 'Showing cross-month all-time expense history.'}
            </p>
          </div>

          <div className="history-actions-group">
            <button
              type="button"
              className={`btn btn-secondary ${selectionMode ? 'btn-active' : ''}`}
              onClick={handleToggleSelectionMode}
              title="Toggle multi-select mode"
            >
              <IconChecklist size={18} />
              {selectionMode ? 'Done Selecting' : 'Select'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              disabled={!filteredList.length}
              title="Download filtered expenses as CSV"
            >
              <IconDownload size={18} />
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPrintModal(true)}
              disabled={!filteredList.length}
              title="Printable Statement / Save as PDF"
            >
              <IconPrinter size={18} />
              Statement
            </button>
          </div>
        </div>
      </header>

      {/* BATCH ACTION BAR (Floats/Appears when items are selected) */}
      {selectionMode && selectedCount > 0 ? (
        <aside className="batch-action-bar" role="toolbar" aria-label="Batch operations">
          <div className="batch-status">
            <strong>{selectedCount} selected</strong>
            <span className="batch-total">({formatINR(selectedTotal)})</span>
          </div>

          <div className="batch-tools">
            <label className="batch-tool-label">
              <span>Category:</span>
              <select
                className="batch-select"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchCategoryChange(e.target.value)
                    e.target.value = ''
                  }
                }}
              >
                <option value="" disabled>Change to...</option>
                {data.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="batch-tool-label">
              <span>Account:</span>
              <select
                className="batch-select"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchAccountChange(e.target.value)
                    e.target.value = ''
                  }
                }}
              >
                <option value="" disabled>Change to...</option>
                <option value="none">Unassigned</option>
                {(data.accounts || []).map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-danger batch-btn"
              onClick={handleBatchDeletePrompt}
              title="Delete selected expenses"
            >
              <IconTrash size={16} /> Delete
            </button>

            <button
              type="button"
              className="text-btn"
              onClick={handleDeselectAll}
            >
              Deselect
            </button>
          </div>
        </aside>
      ) : null}

      {/* FILTER CONTROLS */}
      <form
        className="filters filter-grid"
        role="search"
        aria-label="Filter expenses"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="field filter-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search category or note"
          />
        </label>

        <label className="field compact">
          <span>Time Scope</span>
          <select value={dateScope} onChange={(event) => setDateScope(event.target.value)}>
            <option value="month">Selected Month ({formatMonthLabel(month)})</option>
            <option value="all">All-Time (Cross-Month)</option>
          </select>
        </label>

        <label className="field compact">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {usedCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="field compact">
          <span>Payment Account</span>
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
            <option value="all">All accounts</option>
            {(data.accounts || []).map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type === 'credit_card' ? 'Card' : acc.type === 'bank' ? 'Bank' : 'Cash'})
              </option>
            ))}
            <option value="unassigned">Unassigned / Untagged</option>
          </select>
        </label>

        <label className="field compact">
          <span>From date</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>

        <label className="field compact">
          <span>To date</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>

        <label className="field compact">
          <span>Minimum amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value)}
            placeholder="0"
          />
        </label>

        <label className="field compact">
          <span>Maximum amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxAmount}
            onChange={(event) => setMaxAmount(event.target.value)}
            placeholder="No limit"
          />
        </label>

        {hasFilters ? (
          <button type="button" className="btn btn-ghost clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </form>

      {/* FILTER SUMMARY METRIC BAR */}
      {baseExpenses.length > 0 ? (
        <div className="filter-summary-bar">
          <div className="filter-summary-metric">
            <small>Matched Expenses</small>
            <strong>
              {filteredList.length} <span className="muted-count">of {baseExpenses.length}</span>
            </strong>
          </div>
          <div className="filter-summary-metric">
            <small>Filtered Total</small>
            <strong className="money">{formatINR(filteredTotal)}</strong>
          </div>
          <div className="filter-summary-metric">
            <small>Average</small>
            <strong className="money">
              {formatINR(filteredList.length ? filteredTotal / filteredList.length : 0)}
            </strong>
          </div>

          {selectionMode && filteredList.length > 0 ? (
            <div className="filter-select-controls">
              <button type="button" className="text-btn" onClick={handleSelectAll}>
                Select All {filteredList.length}
              </button>
              {selectedCount > 0 ? (
                <button type="button" className="text-btn" onClick={handleDeselectAll}>
                  Clear Selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="panel">
        <ExpenseList
          groups={groups}
          accounts={data.accounts || []}
          onEdit={onEditExpense}
          onDelete={onDeleteExpense}
          selectable={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          emptyMessage={
            hasFilters
              ? 'No expenses match these filters.'
              : `No expenses logged ${dateScope === 'month' ? `in ${formatMonthLabel(month)}` : 'yet'}.`
          }
        />
      </section>

      {printModal ? (
        <StatementPrintModal
          expenses={filteredList}
          accounts={data.accounts || []}
          month={dateScope === 'month' ? month : null}
          onDismiss={() => setPrintModal(false)}
        />
      ) : null}
    </div>
  )
}
