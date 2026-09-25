import { formatINR, relativeDateLabel } from '../utils/formatting.js'

export default function ExpenseList({ groups, onEdit, onDelete, emptyMessage }) {
  if (!groups.length) {
    return <p className="empty-inline">{emptyMessage}</p>
  }

  return (
    <div className="expense-groups">
      {groups.map((group) => (
        <section key={group.date} className="expense-group">
          <h3>{relativeDateLabel(group.date)}</h3>
          <ul>
            {group.items.map((expense) => (
              <li key={expense.id}>
                <button type="button" className="expense-row" onClick={() => onEdit(expense)}>
                  <span className="expense-meta">
                    <strong>{expense.category}</strong>
                    {expense.note ? <span>{expense.note}</span> : null}
                  </span>
                  <span className="money">{formatINR(expense.amount)}</span>
                </button>
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={() => onDelete(expense)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
