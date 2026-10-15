/**
 * Bank statement to recurring expense reconciliation engine.
 * Scores (statement row, recurring expense) pairs based on payment rail taxonomy,
 * date proximity, category compatibility, token overlap, and learned user aliases.
 */

export const HIGH_CONFIDENCE = 80
export const LOW_CONFIDENCE = 50
export const DATE_WINDOW_DAYS = 4
export const ALIAS_AMOUNT_TOLERANCE = 0.1
const AMOUNT_EPSILON = 0.01
const DAY_MS = 86400000

export const RAILS = {
  investment: {
    narrationPatterns: [
      'indian clearing corp',
      'iccl',
      'nse clearing',
      'cams',
      'kfintech',
      'bse star',
      'nps trust',
      'protean',
    ],
    labelSynonyms: ['sip', 'mutual fund', 'mf', 'invest', 'nps', 'stocks'],
  },
  bill: {
    narrationPatterns: ['billdesk', 'bbps', 'bharat bill', 'payu', 'razorpay'],
    labelSynonyms: ['bill', 'electricity', 'water', 'gas', 'broadband', 'mobile', 'recharge'],
  },
  loan: {
    narrationPatterns: ['nach', 'ach d', 'ecs', 'si debit', 'emi'],
    labelSynonyms: ['emi', 'loan', 'mortgage'],
  },
  rent: {
    narrationPatterns: ['rent', 'house rent', 'flat rent', 'room rent'],
    labelSynonyms: ['rent', 'house rent', 'flat rent', 'room rent'],
  },
  insurance: {
    narrationPatterns: ['lic of india', 'life insurance', 'insurance', 'premium'],
    labelSynonyms: ['insurance', 'premium', 'lic', 'policy'],
  },
}

/** Lowercase, split on punctuation, drop volatile reference tokens. */
export function normalizeNarration(raw) {
  return String(raw || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !(/\d/.test(t) && t.length >= 6))
    .filter((t) => !(/^\d+$/.test(t) && t.length >= 4))
    .join(' ')
}

function hasPhrase(text, phrase, prefix = false) {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^| )${esc}${prefix ? '' : '( |$)'}`).test(text)
}

export function classifyNarration(normalized) {
  for (const [cls, def] of Object.entries(RAILS)) {
    if (def.narrationPatterns.some((p) => hasPhrase(normalized, p))) return cls
  }
  return null
}

export function classifySchedule(schedule) {
  const text = normalizeNarration(`${schedule.note || ''} ${schedule.category || ''}`)
  for (const [cls, def] of Object.entries(RAILS)) {
    if (def.labelSynonyms.some((s) => hasPhrase(text, s, s.length > 3))) return cls
  }
  return null
}

const dayNumber = (iso) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS)
const daysApart = (a, b) => Math.abs(dayNumber(a) - dayNumber(b))
const isSpecific = (c) => Boolean(c) && c.toLowerCase() !== 'other'

export function tierFor(score) {
  if (score >= HIGH_CONFIDENCE) return 'linked'
  if (score >= LOW_CONFIDENCE) return 'suggested'
  return 'new'
}

/** Score one statement row against one recurring expense. Pure function. */
export function scoreMatch(row, schedule, ctx = { aliases: [] }) {
  const key = normalizeNarration(row.rawNarration)
  const alias = (ctx.aliases || []).find((a) => a.scheduleId === schedule.id && a.key === key)
  if (alias && alias.rejectedCount > alias.confirmedCount) return { score: 0, reasons: [] }

  const amountDiff = Math.abs(row.amount - schedule.amount)
  const exact = amountDiff < AMOUNT_EPSILON
  if (alias) {
    if (exact) return { score: 100, reasons: ['you linked this name before'] }
    const pct = amountDiff / schedule.amount
    if (pct <= ALIAS_AMOUNT_TOLERANCE) {
      return { score: 60, reasons: ['you linked this name before', `amount differs by ${amountDiff.toFixed(2)}`] }
    }
    return { score: 0, reasons: [] }
  }
  if (!exact) return { score: 0, reasons: [] } // Invariant 1: amount gate

  let score = 30
  const reasons = ['same amount']
  const rowClass = classifyNarration(key)
  const schedClass = classifySchedule(schedule)

  if (rowClass && schedClass && rowClass === schedClass) {
    score += 35
    reasons.push(`${rowClass} payment`)
  } else if (rowClass && schedClass) { // Invariant 3: class contradiction
    score -= 40
    reasons.push(`narration is ${rowClass}, schedule is ${schedClass}`)
  } else if (
    !rowClass &&
    isSpecific(row.category) &&
    isSpecific(schedule.category) &&
    row.category.toLowerCase() !== schedule.category.toLowerCase()
  ) {
    score -= 30 // Invariant 3: retail merchant contradiction
    reasons.push(`merchant looks like ${row.category}, schedule is ${schedule.category}`)
  }

  if (daysApart(row.date, schedule.date) <= DATE_WINDOW_DAYS) {
    score += 20
    reasons.push('near schedule date')
  }
  if (isSpecific(schedule.category) && row.category === schedule.category) {
    score += 10
    reasons.push('same category')
  }
  const tokens = new Set(key.split(' '))
  if (normalizeNarration(schedule.note).split(' ').some((t) => t && tokens.has(t))) {
    score += 5
  }

  return { score: Math.max(score, 0), reasons }
}

/** Reconcile all rows against all recurring expenses. One-to-one (Invariant 4). */
export function reconcileRows(rows, schedules, ctx = { aliases: [] }) {
  const pairs = []
  rows.forEach((row, ri) => {
    const scored = (schedules || [])
      .map((s) => ({ ri, s, ...scoreMatch(row, s, ctx) }))
      .filter((p) => p.score > 0)
    
    const nonAlias = scored.filter(
      (p) => p.score < 100 && !p.reasons.includes('you linked this name before')
    )
    if (nonAlias.length > 1) { // Invariant 7: ambiguity cap
      for (const p of nonAlias) {
        p.score = Math.min(p.score, HIGH_CONFIDENCE - 1)
        p.reasons = [...p.reasons, 'several schedules share this amount']
      }
    }
    pairs.push(...scored)
  })

  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      daysApart(rows[a.ri].date, a.s.date) - daysApart(rows[b.ri].date, b.s.date) ||
      a.ri - b.ri
  )

  const out = rows.map(() => ({ status: 'new', scheduleId: null, score: 0, reasons: [] }))
  const usedSchedules = new Set()

  for (const p of pairs) {
    if (out[p.ri].scheduleId || usedSchedules.has(p.s.id)) continue
    const status = tierFor(p.score)
    if (status === 'new') continue
    out[p.ri] = {
      status,
      scheduleId: p.s.id,
      score: p.score,
      reasons: p.reasons,
      schedule: p.s,
    }
    usedSchedules.add(p.s.id)
  }

  return out
}
