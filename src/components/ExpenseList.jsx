import { formatINR, relativeDateLabel } from '../utils/formatting.js'
import { IconTrash } from '@tabler/icons-react'

export default function ExpenseList({ groups, accounts = [], onEdit, onDelete, emptyMessage }) {
  if (!groups.length) {
    return <p className="empty-inline">{emptyMessage}</p>
  }

  const accountMap = new Map((accounts || []).map((a) => [a.id, a.name]))

  return (
    <div className="expense-groups">
      {groups.map((group) => (
        <section key={group.date} className="expense-group">
          <div className="expense-group-head">
            <h3>{relativeDateLabel(group.date)}</h3>
            <span>{group.items.length} {group.items.length === 1 ? 'expense' : 'expenses'} shown</span>
          </div>
          <ul>
            {group.items.map((expense) => (
              <li key={expense.id}>
                <button
                  type="button"
                  className="expense-row"
                  aria-label={`Edit ${expense.category} expense for ${formatINR(expense.amount)}`}
                  onClick={() => onEdit(expense)}
                >
                  <span className="expense-meta">
                    <strong>{expense.category}</strong>
                    {expense.note ? <span>{expense.note}</span> : null}
                    {expense.accountId && accountMap.has(expense.accountId) ? (
                      <span className="expense-acc-pill">{accountMap.get(expense.accountId)}</span>
                    ) : null}
                  </span>
                  <span className="money">{formatINR(expense.amount)}</span>
                </button>
                <button
                  type="button"
                  className="expense-delete"
                  aria-label={`Delete ${expense.category} expense for ${formatINR(expense.amount)}`}
                  title="Delete expense"
                  onClick={() => onDelete(expense)}
                >
                  <IconTrash size={18} stroke={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
