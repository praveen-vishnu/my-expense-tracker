import { formatMonthLabel, shiftMonth } from '../utils/formatting.js'

export default function MonthSelector({ month, onChange }) {
  return (
    <div className="month-selector">
      <button
        type="button"
        className="icon-btn"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        ←
      </button>
      <p className="month-label">{formatMonthLabel(month)}</p>
      <button
        type="button"
        className="icon-btn"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        →
      </button>
    </div>
  )
}
