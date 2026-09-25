import { formatINR, formatMonthLabel } from '../utils/formatting.js'

export default function Review({ summary }) {
  const monthName = formatMonthLabel(summary.monthKey)
  const top = summary.categories.slice(0, 4).map((row) => row.category)
  const story =
    summary.spent > 0 && top.length
      ? `Most of it went to ${top.join(' + ')}.`
      : 'Add expenses to see where the money went.'

  return (
    <div className="page">
      <header className="page-intro">
        <h1>{monthName.replace(/ \d+$/, '')} Review</h1>
        <p>Where did your money go?</p>
      </header>

      <section className="review-story">
        <p>
          You earned <strong className="money">{summary.income > 0 ? formatINR(summary.income) : 'nothing recorded'}</strong>
        </p>
        <p>
          You spent <strong className="money spent">{formatINR(summary.spent)}</strong>
        </p>
        <p>
          Remaining <strong className={`money ${summary.remaining < 0 ? 'negative' : 'positive'}`}>{formatINR(summary.remaining)}</strong>
        </p>
        <p className="story-line">{story}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Where did your money go?</h2>
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

      {summary.count > 0 ? (
        <section className="facts">
          <article>
            <p>Number of expenses</p>
            <strong>{summary.count}</strong>
          </article>
          <article>
            <p>Average expense</p>
            <strong className="money">{formatINR(summary.averageExpense)}</strong>
          </article>
          {summary.elapsedDays > 0 && summary.spent > 0 ? (
            <article>
              <p>Average daily spending</p>
              <strong className="money">{formatINR(summary.averageDaily)}</strong>
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
