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
  const [category, setCategory] = useState('all')

  const groups = useMemo(() => {
    let list = expensesForMonth(data.expenses, month)
    if (category !== 'all') {
      list = list.filter((expense) => expense.category === category)
    }
    return groupExpensesByDate(list)
  }, [data.expenses, month, category])

  const usedCategories = useMemo(() => {
    return [...new Set(expensesForMonth(data.expenses, month).map((expense) => expense.category))].sort()
  }, [data.expenses, month])

  return (
    <div className="page">
      <header className="page-intro">
        <h1>History</h1>
        <p>Every expense in {formatMonthLabel(month)}, grouped by date.</p>
      </header>

      <div className="filters">
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
      </div>

      <section className="panel">
        <ExpenseList
          groups={groups}
          onEdit={onEditExpense}
          onDelete={onDeleteExpense}
          emptyMessage={
            category === 'all'
              ? `No expenses in ${formatMonthLabel(month)}.`
              : `No ${category} expenses in ${formatMonthLabel(month)}.`
          }
        />
      </section>
    </div>
  )
}
