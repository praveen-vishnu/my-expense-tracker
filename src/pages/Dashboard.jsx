import { formatINR, formatMonthLabel } from '../utils/formatting.js'
import { groupExpensesByDate } from '../utils/calculations.js'
import ExpenseList from '../components/ExpenseList.jsx'

export default function Dashboard({
  summary,
  accountBalances,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onAddIncome,
  onEditIncome,
  onDeleteIncome,
}) {
  const maxCategory = summary.categories[0]?.total || 0
  const recent = groupExpensesByDate(summary.expenses).slice(0, 5)
  const recentItems = recent.map((group) => ({
    ...group,
    items: group.items.slice(0, 5),
  }))

  return (
    <div className="page dashboard-page">
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

      <div className="dashboard-columns">
        <div className="dashboard-main-col">
          <section className={`budget-panel ${summary.budget && summary.spent > summary.budget ? 'over-budget' : ''}`}>
            <div className="panel-head">
              <div>
                <h2>Monthly budget</h2>
                <p className="muted">
                  {summary.budget
                    ? `${formatINR(summary.spent)} of ${formatINR(summary.budget)} used`
                    : 'Set a budget to track your pace.'}
                </p>
              </div>
              <span className="budget-amount money">
                {summary.budget ? formatINR(Math.max(summary.budgetRemaining, 0)) : 'Not set'}
              </span>
            </div>
            {summary.budget ? (
              <>
                <div
                  className="budget-track"
                  role="progressbar"
                  aria-label="Monthly budget usage"
                  aria-valuenow={Math.min(Math.round(summary.budgetPercent), 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="budget-fill" style={{ width: `${Math.min(summary.budgetPercent, 100)}%` }} />
                </div>
                <p className={`budget-caption ${summary.budgetRemaining < 0 ? 'negative' : 'muted'}`}>
                  {summary.budgetRemaining < 0
                    ? `${formatINR(Math.abs(summary.budgetRemaining))} over budget`
                    : `${Math.round(summary.budgetPercent)}% used`}
                </p>
              </>
            ) : null}

            {(summary.budget > 0 || summary.spent > 0) && summary.elapsedDays > 0 ? (
              <div className={`pace-insight pace-${summary.burnRateStatus}`}>
                <div className="pace-header">
                  <span className="pace-badge">
                    {summary.burnRateStatus === 'exceeded'
                      ? '● Budget exceeded'
                      : summary.burnRateStatus === 'warning'
                        ? '▲ Pacing over budget'
                        : '✓ Pacing on track'}
                  </span>
                  {summary.budget > 0 && summary.burnRateStatus === 'warning' && summary.projectedExhaustionDay ? (
                    <span className="pace-exhaustion">
                      Exhaustion ~Day {summary.projectedExhaustionDay} of {summary.totalDays}
                    </span>
                  ) : null}
                </div>

                <div className="pace-metrics">
                  <div className="pace-stat">
                    <small>Daily burn rate</small>
                    <strong>{formatINR(summary.averageDaily)}<span className="pace-unit">/day</span></strong>
                    <span>{summary.elapsedDays} of {summary.totalDays} days passed</span>
                  </div>
                  <div className="pace-stat">
                    <small>Projected month-end</small>
                    <strong className={summary.projectedSpend > summary.budget && summary.budget > 0 ? 'money spent' : 'money'}>
                      {formatINR(summary.projectedSpend)}
                    </strong>
                    <span>
                      {summary.budget > 0
                        ? summary.projectedOverBudget > 0
                          ? `+${formatINR(summary.projectedOverBudget)} over`
                          : `${formatINR(summary.budget - summary.projectedSpend)} buffer`
                        : 'At current rate'}
                    </span>
                  </div>
                  {summary.budget > 0 && summary.remainingDays > 0 ? (
                    <div className="pace-stat">
                      <small>Safe daily pace</small>
                      <strong>{formatINR(summary.safeDailySpend)}<span className="pace-unit">/day</span></strong>
                      <span>For next {summary.remainingDays} days</span>
                    </div>
                  ) : null}
                </div>
              </div>
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
                    <div
                      className="bar-track"
                      role="progressbar"
                      aria-label={`${row.category} spending ratio`}
                      aria-valuenow={Math.round(maxCategory ? (row.total / maxCategory) * 100 : 0)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
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
        </div>

        <div className="dashboard-side-col">
          {/* ACCOUNTS OVERVIEW WIDGET */}
          {accountBalances && accountBalances.accounts.length > 0 ? (
            <section className="panel accounts-panel">
              <div className="panel-head">
                <div>
                  <h2>Accounts & Liquidity</h2>
                  <p className="muted">Net liquid worth across accounts</p>
                </div>
                <span className="net-worth-badge">
                  Net: <strong className={`money ${accountBalances.netWorth < 0 ? 'negative' : 'positive'}`}>{formatINR(accountBalances.netWorth)}</strong>
                </span>
              </div>

              <div className="accounts-list">
                {accountBalances.accounts.map((acc) => (
                  <div key={acc.id} className={`account-chip acc-${acc.type}`}>
                    <div className="acc-info">
                      <span className="acc-type-icon">
                        {acc.type === 'credit_card' ? '💳' : acc.type === 'bank' ? '🏦' : acc.type === 'wallet' ? '📱' : '💵'}
                      </span>
                      <div>
                        <strong>{acc.name}</strong>
                        <small>{acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank Account' : acc.type === 'wallet' ? 'Wallet' : 'Cash'}</small>
                      </div>
                    </div>
                    <div className="acc-balance">
                      {acc.type === 'credit_card' ? (
                        <>
                          <strong className={acc.outstanding > 0 ? 'money spent' : 'money'}>{formatINR(acc.outstanding)}</strong>
                          <small>outstanding{acc.availableCredit != null ? ` · ${formatINR(acc.availableCredit)} limit left` : ''}</small>
                        </>
                      ) : (
                        <>
                          <strong className={`money ${acc.currentBalance < 0 ? 'negative' : ''}`}>{formatINR(acc.currentBalance)}</strong>
                          <small>available</small>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {summary.expenses.length > 0 ? (
            <section className="panel recent-panel">
              <div className="panel-head">
                <h2>Recent expenses</h2>
                <button type="button" className="text-btn" onClick={onAddExpense}>
                  + Add Expense
                </button>
              </div>
              <ExpenseList
                groups={recentItems}
                accounts={accountBalances?.accounts || []}
                onEdit={onEditExpense}
                onDelete={onDeleteExpense}
                emptyMessage="No expenses yet."
              />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
