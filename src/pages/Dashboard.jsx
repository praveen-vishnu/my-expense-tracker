import { useState, useMemo } from 'react'
import { formatINR, formatMonthLabel, relativeDateLabel } from '../utils/formatting.js'
import {
  groupExpensesByDate,
  getUpcomingOutflows,
  getPendingSplitReceivables,
} from '../utils/calculations.js'
import ExpenseList from '../components/ExpenseList.jsx'
import ModalSheet from '../components/ModalSheet.jsx'
import {
  IconAlertTriangle,
  IconReceipt,
  IconClock,
  IconBuildingBank,
  IconCheck,
  IconArrowsLeftRight,
} from '@tabler/icons-react'

export default function Dashboard({
  summary,
  accountBalances,
  expenses = [],
  recurringExpenses = [],
  onSettleSplit,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onAddIncome,
  onEditIncome,
  onDeleteIncome,
  onOpenCategoryBudgets,
  onOpenAccountDetail,
  onOpenTransfer,
}) {
  const [settleTarget, setSettleTarget] = useState(null)
  const defaultAcc = accountBalances?.accounts?.find((a) => a.isDefault && a.type !== 'credit_card') ||
    accountBalances?.accounts?.find((a) => a.type !== 'credit_card') ||
    accountBalances?.accounts?.[0]
  const [settleAccountId, setSettleAccountId] = useState(defaultAcc?.id || '')

  const maxCategory = summary.categories[0]?.total || 0
  const recent = groupExpensesByDate(summary.expenses).slice(0, 5)
  const recentItems = recent.map((group) => ({
    ...group,
    items: group.items.slice(0, 5),
  }))

  const upcomingOutflows = useMemo(() => {
    return getUpcomingOutflows(recurringExpenses, accountBalances?.accounts || [])
  }, [recurringExpenses, accountBalances?.accounts])

  const splitReceivables = useMemo(() => {
    return getPendingSplitReceivables(expenses)
  }, [expenses])

  function handleConfirmSettle() {
    if (!settleTarget || !onSettleSplit) return
    onSettleSplit(settleTarget.id, settleAccountId || null)
    setSettleTarget(null)
  }

  return (
    <div className="page dashboard-page">
      <header className="page-intro">
        <h1>{formatMonthLabel(summary.monthKey)}</h1>
        <p>A snapshot of what came in, what went out, and where it went.</p>
      </header>

      {/* SHORTFALL ALERT BANNER */}
      {(upcomingOutflows?.shortfalls || upcomingOutflows?.shortfallAlerts || []).length > 0 ? (
        <div className="shortfall-alert-banner" role="alert">
          <div className="shortfall-banner-icon">
            <IconAlertTriangle size={24} />
          </div>
          <div className="shortfall-banner-content">
            <strong>Upcoming Balance Shortfall Warning</strong>
            {(upcomingOutflows.shortfalls || upcomingOutflows.shortfallAlerts).map((sf) => (
              <p key={sf.accountId || sf.account?.id}>
                {sf.accountName || sf.account?.name || 'Account'} has only <strong>{formatINR(sf.currentBalance)}</strong>, which is insufficient for upcoming scheduled commitments totaling <strong>{formatINR(sf.totalDue || sf.upcomingOutflow)}</strong> due in the next 7 days.
              </p>
            ))}
          </div>
          {onOpenTransfer ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm shortfall-action-btn"
              onClick={() => {
                const list = upcomingOutflows.shortfalls || upcomingOutflows.shortfallAlerts
                const first = list[0]
                if (first) {
                  onOpenTransfer(null, first.accountId || first.account?.id, first.shortfall)
                }
              }}
            >
              Transfer Funds
            </button>
          ) : null}
        </div>
      ) : null}

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

          {/* SMART CATEGORY BUDGET ALERTS */}
          {summary.categoryAlerts && summary.categoryAlerts.length > 0 ? (
            <div className="cat-alert-banner" role="alert">
              <IconAlertTriangle size={18} className="cat-alert-icon" />
              <div className="cat-alert-content">
                <strong>Category Budget Alert:</strong>
                <span>
                  {summary.categoryAlerts
                    .map((a) =>
                      a.status === 'exceeded'
                        ? `${a.category} (${formatINR(Math.abs(a.remaining))} over budget)`
                        : `${a.category} (${Math.round(a.percent)}% used)`
                    )
                    .join(' · ')}
                </span>
              </div>
            </div>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2>Spending by category</h2>
              {onOpenCategoryBudgets ? (
                <button type="button" className="text-btn" onClick={onOpenCategoryBudgets}>
                  Set Budgets
                </button>
              ) : null}
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
                {summary.categories.map((row) => {
                  const hasBudget = row.budget != null && row.budget > 0
                  const fillWidth = hasBudget
                    ? Math.min(row.percent, 100)
                    : maxCategory
                      ? (row.total / maxCategory) * 100
                      : 0

                  return (
                    <li key={row.category}>
                      <div className="bar-meta">
                        <span className="cat-label-wrap">
                          <strong>{row.category}</strong>
                          {hasBudget ? (
                            <span
                              className={`cat-budget-pill cat-budget-${row.status}`}
                            >
                              {row.status === 'exceeded'
                                ? `+${formatINR(Math.abs(row.remaining))} over`
                                : `${formatINR(row.remaining)} left`}
                            </span>
                          ) : null}
                        </span>
                        <span className="money-budget-wrap">
                          <span className="money">{formatINR(row.total)}</span>
                          {hasBudget ? (
                            <small className="budget-target-sub"> / {formatINR(row.budget)}</small>
                          ) : null}
                        </span>
                      </div>
                      <div
                        className="bar-track"
                        role="progressbar"
                        aria-label={`${row.category} spending ratio`}
                        aria-valuenow={Math.round(fillWidth)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`bar-fill ${hasBudget ? `bar-fill-${row.status}` : ''}`}
                          style={{ width: `${fillWidth}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
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
                <div className="accounts-head-actions">
                  <span className="net-worth-badge">
                    Net: <strong className={`money ${accountBalances.netWorth < 0 ? 'negative' : 'positive'}`}>{formatINR(accountBalances.netWorth)}</strong>
                  </span>
                  {onOpenTransfer ? (
                    <button
                      type="button"
                      className="text-btn primary"
                      onClick={() => onOpenTransfer()}
                      title="Transfer funds or pay credit card bill"
                    >
                      ⇄ Transfer / Pay
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="accounts-list">
                {accountBalances.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`account-chip acc-${acc.type} interactive`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenAccountDetail && onOpenAccountDetail(acc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenAccountDetail && onOpenAccountDetail(acc)
                      }
                    }}
                  >
                    <div className="acc-info">
                      <span className="acc-type-icon">
                        {acc.type === 'credit_card' ? '💳' : acc.type === 'bank' ? '🏦' : acc.type === 'wallet' ? '📱' : '💵'}
                      </span>
                      <div>
                        <strong>{acc.name}</strong>
                        <div className="acc-sub-row">
                          <small>{acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank Account' : acc.type === 'wallet' ? 'Wallet' : 'Cash'}</small>
                          {acc.dueInfo?.label ? (
                            <span className={`due-badge ${acc.dueInfo.isDueSoon ? 'due-urgent' : ''}`}>
                              {acc.dueInfo.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="acc-balance">
                      {acc.type === 'credit_card' ? (
                        <>
                          <strong className={acc.outstanding > 0 ? 'money spent' : 'money'}>{formatINR(acc.outstanding)}</strong>
                          <small>
                            outstanding
                            {acc.utilizationPercent != null ? (
                              <span className={`chip-util-tag util-${acc.utilizationStatus}`}>
                                {' '}({Math.round(acc.utilizationPercent)}%)
                              </span>
                            ) : null}
                          </small>
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

          {/* MONEY OWED TO YOU (SPLIT RECEIVABLES) WIDGET */}
          {(splitReceivables?.receivables || splitReceivables?.items || []).length > 0 ? (
            <section className="panel receivables-panel">
              <div className="panel-head">
                <div>
                  <h2>Money Owed to You</h2>
                  <p className="muted">
                    {(splitReceivables.receivables || splitReceivables.items).length} pending reimbursement
                    {(splitReceivables.receivables || splitReceivables.items).length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="receivables-total money positive">
                  +{formatINR(splitReceivables.totalOwed || 0)}
                </span>
              </div>
              <div className="receivables-list">
                {(splitReceivables.receivables || splitReceivables.items).map((item) => (
                  <div key={item.id || item.expenseId} className="receivable-item">
                    <div className="receivable-info">
                      <div className="receivable-name-row">
                        <strong>{item.split?.owedBy || item.owedBy || 'Friend'}</strong>
                        <span className="receivable-date">{relativeDateLabel(item.date)}</span>
                      </div>
                      <small className="muted">
                        For {item.category}{item.note ? ` (${item.note})` : ''} · Total {formatINR(item.amount || item.totalAmount || 0)}
                      </small>
                    </div>
                    <div className="receivable-actions">
                      <span className="receivable-amount positive">+{formatINR(item.split?.owedAmount || item.owedAmount || 0)}</span>
                      {onSettleSplit ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm settle-btn"
                          onClick={() => setSettleTarget(item)}
                          title="Mark as paid back and deposit to bank"
                        >
                          <IconCheck size={14} /> Settle
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* UPCOMING 7-DAY OUTFLOWS WIDGET */}
          {(upcomingOutflows?.upcoming || upcomingOutflows?.items || []).length > 0 ? (
            <section className="panel upcoming-panel">
              <div className="panel-head">
                <div>
                  <h2>Upcoming Payments (7 Days)</h2>
                  <p className="muted">Scheduled EMIs and bills</p>
                </div>
                <span className="upcoming-total money spent">
                  {formatINR(upcomingOutflows.totalUpcoming || upcomingOutflows.totalOutflow || 0)}
                </span>
              </div>
              <div className="upcoming-list">
                {(upcomingOutflows.upcoming || upcomingOutflows.items).map((item) => (
                  <div key={item.id} className="upcoming-item">
                    <div className="upcoming-info">
                      <div className="upcoming-title-row">
                        <strong>{item.name}</strong>
                        <span className={`upcoming-day-badge ${item.isDueSoon ? 'badge-urgent' : ''}`}>
                          {item.daysRemaining === 0 || item.daysAway === 0
                            ? 'Today'
                            : (item.daysRemaining === 1 || item.daysAway === 1)
                              ? 'Tomorrow'
                              : `in ${item.daysRemaining ?? item.daysAway} days`}
                        </span>
                      </div>
                      <div className="upcoming-meta">
                        <IconClock size={12} />
                        <span>Due {item.dueDate || `Day ${item.day}`}</span>
                        {(item.accountName || item.account?.name) ? (
                          <>
                            <span>·</span>
                            <span>{item.accountName || item.account?.name}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <strong className="money spent">
                      {formatINR(item.amount)}
                    </strong>
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

      {/* SETTLE SPLIT RECEIVABLE MODAL */}
      {settleTarget ? (
        <ModalSheet
          titleId="settle-split-title"
          descriptionId="settle-split-desc"
          onDismiss={() => setSettleTarget(null)}
        >
          <div className="sheet-form">
            <div className="sheet-head">
              <h2 id="settle-split-title">Settle Split Expense</h2>
              <button type="button" className="text-btn" onClick={() => setSettleTarget(null)}>
                Cancel
              </button>
            </div>
            <p id="settle-split-desc" className="muted">
              Record receipt of <strong>+{formatINR(settleTarget.split?.owedAmount || settleTarget.owedAmount || 0)}</strong> from <strong>{settleTarget.split?.owedBy || settleTarget.owedBy || 'Friend'}</strong>.
            </p>

            <div className="settle-summary-card">
              <div className="settle-summary-row">
                <span>Original Expense:</span>
                <strong>{settleTarget.category} ({formatINR(settleTarget.amount || settleTarget.totalAmount || 0)})</strong>
              </div>
              <div className="settle-summary-row">
                <span>Your Share:</span>
                <span>{formatINR(settleTarget.split?.myShare || settleTarget.myShare || 0)}</span>
              </div>
              <div className="settle-summary-row highlight">
                <span>Reimbursement Amount:</span>
                <strong className="positive">+{formatINR(settleTarget.split?.owedAmount || settleTarget.owedAmount || 0)}</strong>
              </div>
            </div>

            {accountBalances?.accounts?.length ? (
              <label className="field mt-md">
                <span>Deposit reimbursement into</span>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                >
                  <option value="">None / Cash</option>
                  {accountBalances.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : acc.type === 'wallet' ? 'Wallet' : 'Cash'})
                    </option>
                  ))}
                </select>
                <small className="field-hint">
                  Your designated account balance will be credited without inflating your monthly income.
                </small>
              </label>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-block mt-md"
              onClick={handleConfirmSettle}
            >
              <IconCheck size={18} /> Mark as Settled & Credit Account
            </button>
          </div>
        </ModalSheet>
      ) : null}
    </div>
  )
}
