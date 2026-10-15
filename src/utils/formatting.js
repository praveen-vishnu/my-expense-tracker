const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function isValidDate(iso) {
  if (!DATE_RE.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function isValidMonthKey(key) {
  if (!MONTH_RE.test(key)) return false
  const [y, m] = key.split('-').map(Number)
  return m >= 1 && m <= 12 && y >= 2000 && y <= 2100
}

export function monthKeyFromDate(iso) {
  return iso.slice(0, 7)
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

export function relativeDateLabel(iso, now = new Date()) {
  const today = todayISO(now)
  if (iso === today) return 'Today'
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (iso === todayISO(yesterdayDate)) return 'Yesterday'
  const [y] = iso.split('-').map(Number)
  if (y === now.getFullYear()) return formatShortDate(iso)
  return `${formatShortDate(iso)} ${y}`
}

export function formatINR(value) {
  const amount = Number(value) || 0
  const abs = Math.abs(amount)
  const hasPaise = Math.round(abs * 100) % 100 !== 0
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: hasPaise ? 2 : 0,
    minimumFractionDigits: hasPaise ? 2 : 0,
  }).format(abs)
  return `${amount < 0 ? '-' : ''}₹${formatted}`
}

export function evalMathExpression(raw) {
  if (raw == null) return NaN
  const cleaned = String(raw).replace(/[₹,\s]/g, '')
  if (!cleaned) return NaN

  // If it's just a number
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
    return Number(cleaned)
  }

  // Check if it's a valid arithmetic expression: only numbers and + - * /
  if (!/^[-+]?\d+(?:\.\d+)?(?:[+\-*/]\d+(?:\.\d+)?)+$/.test(cleaned)) {
    return NaN
  }

  try {
    const tokens = cleaned.match(/(\d+(?:\.\d+)?|[+\-*/])/g)
    if (!tokens) return NaN

    let initialTokens = tokens
    if (cleaned.startsWith('-')) {
      initialTokens = ['-' + tokens[1], ...tokens.slice(2)]
    } else if (cleaned.startsWith('+')) {
      initialTokens = tokens.slice(1)
    }

    // Pass 1: * and /
    const intermediate = []
    let i = 0
    while (i < initialTokens.length) {
      const tok = initialTokens[i]
      if (tok === '*' || tok === '/') {
        const prev = intermediate.pop()
        const next = Number(initialTokens[i + 1])
        if (!Number.isFinite(next) || (tok === '/' && next === 0)) return NaN
        const res = tok === '*' ? prev * next : prev / next
        intermediate.push(res)
        i += 2
      } else if (tok === '+' || tok === '-') {
        intermediate.push(tok)
        i++
      } else {
        intermediate.push(Number(tok))
        i++
      }
    }

    // Pass 2: + and -
    let result = intermediate[0]
    let j = 1
    while (j < intermediate.length) {
      const op = intermediate[j]
      const next = intermediate[j + 1]
      if (op === '+') result += next
      else if (op === '-') result -= next
      j += 2
    }

    return Number.isFinite(result) ? Math.round(result * 100) / 100 : NaN
  } catch {
    return NaN
  }
}

export function parseAmount(raw) {
  return evalMathExpression(raw)
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `exp_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
