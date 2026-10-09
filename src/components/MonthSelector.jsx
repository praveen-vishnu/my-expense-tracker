import { useRef } from 'react'
import { formatMonthLabel, shiftMonth } from '../utils/formatting.js'
import { IconCalendar } from '@tabler/icons-react'

export default function MonthSelector({ month, onChange }) {
  const inputRef = useRef(null)

  return (
    <div className="month-selector">
      <button
        type="button"
        className="icon-btn"
        aria-label="Previous month"
        title="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        ←
      </button>

      <div className="month-label-wrapper" title="Click to jump to a specific month">
        <button
          type="button"
          className="month-jump-btn"
          onClick={() => inputRef.current?.showPicker ? inputRef.current.showPicker() : inputRef.current?.focus()}
          aria-label={`Jump month, currently ${formatMonthLabel(month)}`}
        >
          <span className="month-label">{formatMonthLabel(month)}</span>
          <IconCalendar size={15} stroke={1.8} aria-hidden="true" style={{ opacity: 0.7, marginLeft: '4px' }} />
        </button>
        <input
          ref={inputRef}
          type="month"
          value={month}
          className="sr-only month-native-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value)
            }
          }}
        />
      </div>

      <button
        type="button"
        className="icon-btn"
        aria-label="Next month"
        title="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        →
      </button>
    </div>
  )
}
