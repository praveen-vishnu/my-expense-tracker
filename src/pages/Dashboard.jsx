import { formatINR, formatMonthLabel } from '../utils/formatting.js'
import { groupExpensesByDate } from '../utils/calculations.js'
import ExpenseList from '../components/ExpenseList.jsx'

export default function Dashboard({
  summary,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onAddIncome,
  onEditIncome,
  onDeleteIncome,
}) {
  const maxCategory = summary.categories[0]?.total || 0
  const recent = groupExpensesByDate(summary.expenses).slice(0, 4)
  const recentItems = recent.map((group) => ({
    ...group,
    items: group.items.slice(0, 4),
  }))

  return (
    <div className="page">
      <header className="page-intro">
        <h1>{formatMonthLabel(summary.monthKey)}</h1>
        <p>A snapshot of what came in, what went out, and where it went.</p>
      </header>

      <section className="summary-grid" aria-label="Month totals">
        <article className="stat">
          <p>Income</p>
          {summary.income > 0 ? (
            <>
              <strong className="money">{formatINR(summary.income)}</strong>
              <div className="stat-actions">
                <button type="button" className="text-btn" onClick={onEditIncome}>
                  Edit
                </button>
                <button type="button" className="text-btn danger" onClick={onDeleteIncome}>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <strong className="empty-value">Not set</strong>
              <p className="empty-copy">No income added for {formatMonthLabel(summary.monthKey)}.</p>
              <button type="button" className="btn btn-secondary" onClick={onAddIncome}>
                Add Income
              </button>
            </>
          )}
        </article>
        <article className="stat">
          <p>Spent</p>
          <strong className="money spent">{formatINR(summary.spent)}</strong>
        </article>
        <article className="stat remaining">
          <p>Remaining</p>
          <strong className={`money ${summary.remaining < 0 ? 'negative' : 'positive'}`}>
            {formatINR(summary.remaining)}
          </strong>
        </article>
      </section>

      <section className={`budget-panel ${summary.budget && summary.spent > summary.budget ? 'over-budget' : ''}`}>
        <div className="panel-head">
          <div>
            <h2>Monthly budget</h2>
            <p className="muted">
              {summary.budget ? `${formatINR(summary.spent)} of ${formatINR(summary.budget)} used` : 'Set a budget to track your pace.'}
            </p>
          </div>
          <span className="budget-amount money">
            {summary.budget ? formatINR(Math.max(summary.budgetRemaining, 0)) : 'Not set'}
          </span>
        </div>
        {summary.budget ? (
          <>
            <div className="budget-track" aria-hidden="true">
              <div className="budget-fill" style={{ width: `${Math.min(summary.budgetPercent, 100)}%` }} />
            </div>
            <p className={`budget-caption ${summary.budgetRemaining < 0 ? 'negative' : 'muted'}`}>
              {summary.budgetRemaining < 0
                ? `${formatINR(Math.abs(summary.budgetRemaining))} over budget`
                : `${Math.round(summary.budgetPercent)}% used`}
            </p>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Spending by category</h2>
        </div>
        {summary.categories.length === 0 ? (
          <div className="empty-state">
            <p>No expenses yet.</p>
            <p>Start tracking your spending.</p>
            <button type="button" className="btn btn-primary" onClick={onAddExpense}>
              + Add Expense
            </button>
          </div>
        ) : (
          <ul className="bars">
            {summary.categories.map((row) => (
              <li key={row.category}>
                <div className="bar-meta">
                  <span>{row.category}</span>
                  <span className="money">{formatINR(row.total)}</span>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <div
                    className="bar-fill"
                    style={{ width: `${maxCategory ? (row.total / maxCategory) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.expenses.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Recent expenses</h2>
            <button type="button" className="text-btn" onClick={onAddExpense}>
              + Add Expense
            </button>
          </div>
          <ExpenseList
            groups={recentItems}
            onEdit={onEditExpense}
            onDelete={onDeleteExpense}
            emptyMessage="No expenses yet."
          />
        </section>
      ) : null}
    </div>
  )
}
