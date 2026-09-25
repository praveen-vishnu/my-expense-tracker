import { useMemo, useState } from 'react'
import ExpenseList from '../components/ExpenseList.jsx'
import { expensesForMonth, groupExpensesByDate } from '../utils/calculations.js'
import { formatMonthLabel } from '../utils/formatting.js'

export default function History({
  data,
  month,
  onEditExpense,
  onDeleteExpense,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const monthExpenses = useMemo(() => expensesForMonth(data.expenses, month), [data.expenses, month])

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const minimum = minAmount === '' ? 0 : Number(minAmount)
    const maximum = maxAmount === '' ? Infinity : Number(maxAmount)
    let list = monthExpenses.filter((expense) => {
      const matchesQuery = !normalizedQuery ||
        expense.category.toLowerCase().includes(normalizedQuery) ||
        expense.note.toLowerCase().includes(normalizedQuery)
      const matchesCategory = category === 'all' || expense.category === category
      const matchesFrom = !fromDate || expense.date >= fromDate
      const matchesTo = !toDate || expense.date <= toDate
      const matchesMinimum = !Number.isNaN(minimum) && expense.amount >= minimum
      const matchesMaximum = !Number.isNaN(maximum) && expense.amount <= maximum
      return matchesQuery && matchesCategory && matchesFrom && matchesTo && matchesMinimum && matchesMaximum
    })
    return groupExpensesByDate(list)
  }, [monthExpenses, query, category, fromDate, toDate, minAmount, maxAmount])

  const usedCategories = useMemo(() => {
    return [...new Set(monthExpenses.map((expense) => expense.category))].sort()
  }, [monthExpenses])

  const hasFilters = query || category !== 'all' || fromDate || toDate || minAmount || maxAmount

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setFromDate('')
    setToDate('')
    setMinAmount('')
    setMaxAmount('')
  }

  return (
    <div className="page">
      <header className="page-intro">
        <h1>History</h1>
        <p>Every expense in {formatMonthLabel(month)}, grouped by date.</p>
      </header>

      <div className="filters filter-grid">
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
          <span>From date</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="field compact">
          <span>To date</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label className="field compact">
          <span>Minimum amount</span>
          <input type="number" min="0" step="0.01" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder="0" />
        </label>
        <label className="field compact">
          <span>Maximum amount</span>
          <input type="number" min="0" step="0.01" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder="No limit" />
        </label>
        {hasFilters ? (
          <button type="button" className="btn btn-ghost clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <section className="panel">
        <ExpenseList
          groups={groups}
          onEdit={onEditExpense}
          onDelete={onDeleteExpense}
          emptyMessage={
            hasFilters
              ? 'No expenses match these filters.'
              : `No expenses in ${formatMonthLabel(month)}.`
          }
        />
      </section>
    </div>
  )
}
