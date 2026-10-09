import { useMemo } from 'react'
import { formatINR, formatMonthLabel } from '../utils/formatting.js'
import { calculateFinancialHealth } from '../utils/calculations.js'
import {
  IconTrendingUp,
  IconTrendingDown,
  IconAward,
  IconCheck,
  IconAlertTriangle,
  IconSparkles,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react'

export default function Review({ summary, previousSummary = null, month }) {
  const monthName = formatMonthLabel(summary?.monthKey || month)
  const prevMonthName = previousSummary ? formatMonthLabel(previousSummary.monthKey) : 'Previous Month'

  const health = useMemo(
    () => calculateFinancialHealth(summary, previousSummary),
    [summary, previousSummary]
  )

  const chartMax = summary?.categories?.reduce((max, row) => Math.max(max, row.total), 0) || 0

  return (
    <div className="page review-page">
      <header className="page-intro">
        <h1>{monthName.replace(/ \d+$/, '')} Review</h1>
        <p>Comprehensive monthly financial audit, spending drift & health scorecard.</p>
      </header>

      {/* 1. HERO FINANCIAL HEALTH SCORECARD */}
      <section className="panel health-scorecard-panel">
        <div className="scorecard-grid">
          <div className="scorecard-main">
            <div className="score-header">
              <span className="score-kicker">
                <IconSparkles size={16} /> Financial Health Score
              </span>
              <span className={`score-badge score-grade-${health.grade.toLowerCase().replace('+', '-plus')}`}>
                Grade {health.grade} · {health.gradeLabel}
              </span>
            </div>

            <div className="score-display">
              <div className="score-number-wrap">
                <span className="score-number">{health.score}</span>
                <span className="score-denominator">/ 100</span>
              </div>
              <div
                className="score-track"
                role="progressbar"
                aria-label="Financial health score"
                aria-valuenow={health.score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`score-fill score-grade-${health.grade.toLowerCase().replace('+', '-plus')}`}
                  style={{ width: `${health.score}%` }}
                />
              </div>
            </div>
            <p className="score-explanation">
              Evaluated across budget discipline, savings retention, burn pace stability, and month-over-month trajectory.
            </p>
          </div>

          <div className="scorecard-metrics">
            <div className="health-stat-card">
              <span className="stat-label">Savings Rate</span>
              <strong className="stat-value">
                {health.savingsRate != null ? `${Math.round(health.savingsRate)}%` : 'Not set'}
              </strong>
              <small className="stat-subtext">
                {health.savingsRate != null
                  ? health.savingsRate >= 20
                    ? '✓ Exceeds 20% target'
                    : 'Target: ≥ 20%'
                  : 'Add monthly income'}
              </small>
            </div>

            <div className="health-stat-card">
              <span className="stat-label">MoM Spend Trajectory</span>
              <strong className="stat-value">
                {health.spendDeltaPercent != null ? (
                  <span className={health.spendDelta > 0 ? 'text-danger' : 'text-ok'}>
                    {health.spendDelta > 0 ? '+' : ''}
                    {Math.round(health.spendDeltaPercent)}%
                  </span>
                ) : (
                  'No previous data'
                )}
              </strong>
              <small className="stat-subtext">
                {health.spendDelta != null && previousSummary?.spent > 0
                  ? health.spendDelta > 0
                    ? `+${formatINR(health.spendDelta)} vs last month`
                    : `${formatINR(Math.abs(health.spendDelta))} saved vs last month`
                  : 'Compared to prior month'}
              </small>
            </div>

            <div className="health-stat-card">
              <span className="stat-label">Net Retained</span>
              <strong className={`stat-value money ${summary.remaining < 0 ? 'negative' : 'positive'}`}>
                {formatINR(summary.remaining)}
              </strong>
              <small className="stat-subtext">
                {summary.income > 0 ? `${formatINR(summary.income)} incoming` : 'From income'}
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DYNAMIC ACTIONABLE FINANCIAL INSIGHTS */}
      {health.insights.length > 0 ? (
        <section className="panel insights-panel">
          <div className="panel-head">
            <h2>Key Observations & Insights</h2>
          </div>
          <div className="insights-list">
            {health.insights.map((insight, idx) => (
              <div key={idx} className={`insight-card insight-${insight.type}`}>
                <div className="insight-icon">
                  {insight.type === 'positive' ? (
                    <IconCheck size={18} />
                  ) : insight.type === 'warning' ? (
                    <IconAlertTriangle size={18} />
                  ) : insight.type === 'negative' ? (
                    <IconAlertTriangle size={18} />
                  ) : (
                    <IconSparkles size={18} />
                  )}
                </div>
                <div className="insight-text">{insight.text}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. MONTH-OVER-MONTH (MoM) COMPARISON */}
      {previousSummary && (previousSummary.spent > 0 || previousSummary.income > 0) ? (
        <section className="panel mom-comparison-panel">
          <div className="panel-head">
            <div>
              <h2>Month-over-Month Comparison</h2>
              <p className="muted">Comparing {monthName} against {prevMonthName}</p>
            </div>
          </div>

          <div className="mom-grid">
            <div className="mom-card">
              <span className="mom-title">Total Spending</span>
              <div className="mom-row">
                <div>
                  <small className="muted">{prevMonthName}</small>
                  <strong>{formatINR(previousSummary.spent)}</strong>
                </div>
                <div className="mom-arrow">→</div>
                <div>
                  <small className="muted">{monthName}</small>
                  <strong className="money spent">{formatINR(summary.spent)}</strong>
                </div>
              </div>
              <div className="mom-delta-badge">
                {health.spendDelta != null ? (
                  <span className={`pill ${health.spendDelta <= 0 ? 'pill-ok' : 'pill-warn'}`}>
                    {health.spendDelta <= 0 ? <IconTrendingDown size={14} /> : <IconTrendingUp size={14} />}
                    {health.spendDelta <= 0 ? 'Saved ' : 'Increased '}
                    {formatINR(Math.abs(health.spendDelta))}
                    {health.spendDeltaPercent != null ? ` (${Math.abs(Math.round(health.spendDeltaPercent))}%)` : ''}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mom-card">
              <span className="mom-title">Income & Retained Buffer</span>
              <div className="mom-row">
                <div>
                  <small className="muted">{prevMonthName}</small>
                  <strong className="money">{formatINR(previousSummary.remaining)}</strong>
                </div>
                <div className="mom-arrow">→</div>
                <div>
                  <small className="muted">{monthName}</small>
                  <strong className={`money ${summary.remaining < 0 ? 'negative' : 'positive'}`}>
                    {formatINR(summary.remaining)}
                  </strong>
                </div>
              </div>
              <div className="mom-delta-badge">
                <span className="muted-sub">
                  {summary.remaining > previousSummary.remaining
                    ? `+${formatINR(summary.remaining - previousSummary.remaining)} net retention increase`
                    : `${formatINR(Math.abs(summary.remaining - previousSummary.remaining))} net retention decrease`}
                </span>
              </div>
            </div>

            <div className="mom-card">
              <span className="mom-title">Transaction Volume</span>
              <div className="mom-row">
                <div>
                  <small className="muted">{prevMonthName}</small>
                  <strong>{previousSummary.count} expenses</strong>
                </div>
                <div className="mom-arrow">→</div>
                <div>
                  <small className="muted">{monthName}</small>
                  <strong>{summary.count} expenses</strong>
                </div>
              </div>
              <div className="mom-delta-badge">
                <span className="muted-sub">
                  Avg transaction: {formatINR(summary.averageExpense)}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* 4. CATEGORY DRIFT & VARIANCE ANALYSIS */}
      {health.categoryDrift.length > 0 && previousSummary && previousSummary.spent > 0 ? (
        <section className="panel category-drift-panel">
          <div className="panel-head">
            <div>
              <h2>Category Spending Drift</h2>
              <p className="muted">Detailed category spend fluctuations vs prior month</p>
            </div>
          </div>

          <div className="drift-table-container">
            <table className="drift-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>{prevMonthName}</th>
                  <th style={{ textAlign: 'right' }}>{monthName}</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th style={{ textAlign: 'right' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {health.categoryDrift.map((c) => (
                  <tr key={c.category}>
                    <td><strong>{c.category}</strong></td>
                    <td style={{ textAlign: 'right' }} className="muted font-mono">{formatINR(c.previous)}</td>
                    <td style={{ textAlign: 'right' }} className="font-mono"><strong>{formatINR(c.current)}</strong></td>
                    <td style={{ textAlign: 'right' }} className="font-mono">
                      <span className={c.diff > 0 ? 'text-danger' : c.diff < 0 ? 'text-ok' : 'muted'}>
                        {c.diff > 0 ? `+${formatINR(c.diff)}` : c.diff < 0 ? `-${formatINR(Math.abs(c.diff))}` : '₹0'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {c.direction === 'up' ? (
                        <span className="drift-pill drift-up">
                          <IconArrowUpRight size={14} /> +{c.diffPercent != null ? Math.round(c.diffPercent) : ''}%
                        </span>
                      ) : c.direction === 'down' ? (
                        <span className="drift-pill drift-down">
                          <IconArrowDownRight size={14} /> {c.diffPercent != null ? Math.round(c.diffPercent) : ''}%
                        </span>
                      ) : (
                        <span className="drift-pill drift-same">— No change</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 5. SPENDING BREAKDOWN BARS */}
      <section className="panel">
        <div className="panel-head">
          <h2>Spending by category</h2>
        </div>
        {summary.categories.length === 0 ? (
          <p className="empty-inline">No spending recorded for {monthName}.</p>
        ) : (
          <div className="spending-chart" aria-label="Category spending chart">
            {summary.categories.map((row) => (
              <div key={row.category} className="chart-row">
                <div className="chart-label-row">
                  <span>{row.category}</span>
                  <span className="money">{formatINR(row.total)}</span>
                </div>
                <div
                  className="chart-track"
                  role="progressbar"
                  aria-label={`${row.category} spending ratio`}
                  aria-valuenow={Math.round(chartMax ? (row.total / chartMax) * 100 : 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="chart-fill"
                    style={{ width: `${chartMax ? (row.total / chartMax) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. WHERE DID YOUR MONEY GO? RANKING */}
      <section className="panel">
        <div className="panel-head">
          <h2>Category Rankings</h2>
        </div>
        {summary.categories.length === 0 ? (
          <p className="empty-inline">No spending recorded for {monthName}.</p>
        ) : (
          <ol className="rank-list">
            {summary.categories.map((row, index) => (
              <li key={row.category}>
                <span className="rank">{index + 1}</span>
                <span>{row.category}</span>
                <span className="money">{formatINR(row.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 7. QUICK VELOCITY FACTS */}
      {summary.count > 0 ? (
        <section className="facts">
          <article>
            <p>Total Expenses Logged</p>
            <strong>{summary.count}</strong>
          </article>
          <article>
            <p>Average per Expense</p>
            <strong className="money">{formatINR(summary.averageExpense)}</strong>
          </article>
          {summary.elapsedDays > 0 && summary.spent > 0 ? (
            <article>
              <p>Average Daily Spending</p>
              <strong className="money">{formatINR(summary.averageDaily)}</strong>
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

