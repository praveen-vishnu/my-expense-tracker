import { isValidDate, isValidMonthKey } from './formatting.js'
import { isSupabaseConfigured, supabase } from './supabase.js'

export const STORAGE_KEY = 'expenseTracker'
export const DATA_VERSION = 1

export const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'EMI',
  'Entertainment',
  'Health',
  'Travel',
  'Education',
  'Other',
]

export function emptyData() {
  return {
    version: DATA_VERSION,
    income: {},
    expenses: [],
    categories: [...DEFAULT_CATEGORIES],
  }
}

function isValidExpense(expense) {
  return (
    expense &&
    typeof expense.id === 'string' &&
    expense.id.length > 0 &&
    typeof expense.amount === 'number' &&
    Number.isFinite(expense.amount) &&
    expense.amount > 0 &&
    typeof expense.category === 'string' &&
    expense.category.trim().length > 0 &&
    typeof expense.date === 'string' &&
    isValidDate(expense.date) &&
    (expense.note == null || typeof expense.note === 'string')
  )
}

function normalizeIncome(income) {
  if (!income || typeof income !== 'object' || Array.isArray(income)) return {}
  const next = {}
  for (const [month, amount] of Object.entries(income)) {
    if (!isValidMonthKey(month)) continue
    const value = Number(amount)
    if (Number.isFinite(value) && value > 0) next[month] = value
  }
  return next
}

function normalizeCategories(categories) {
  const list = Array.isArray(categories) ? categories : []
  const cleaned = list
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
  const merged = [...DEFAULT_CATEGORIES, ...cleaned]
  return [...new Set(merged)]
}

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return emptyData()

  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.filter(isValidExpense).map((expense) => ({
        id: expense.id,
        amount: expense.amount,
        category: expense.category.trim(),
        date: expense.date,
        note: expense.note ? String(expense.note) : '',
      }))
    : []

  return {
    version: DATA_VERSION,
    income: normalizeIncome(raw.income),
    expenses,
    categories: normalizeCategories(raw.categories),
  }
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    return normalizeData(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)))
    return true
  } catch {
    return false
  }
}

async function getSupabaseUser() {
  if (!isSupabaseConfigured) return null

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  if (sessionData.session?.user) return sessionData.session.user
  throw new Error('You must sign in before using cloud storage.')
}

export async function loadData() {
  const localData = loadLocalData()
  if (!isSupabaseConfigured) return localData

  try {
    const user = await getSupabaseUser()
    const { data: record, error } = await supabase
      .from('expense_tracker_data')
      .select('payload')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (record?.payload) return normalizeData(record.payload)

    if (localData.expenses.length || Object.keys(localData.income).length) {
      await saveData(localData)
    }
    return localData
  } catch (error) {
    console.warn('Supabase load failed; using local data.', error)
    return localData
  }
}

export async function saveData(data) {
  const normalized = normalizeData(data)
  const localSaved = saveLocalData(normalized)
  if (!isSupabaseConfigured) {
    return { localSaved, remoteSaved: false, error: 'Supabase environment variables are missing.' }
  }

  try {
    const user = await getSupabaseUser()
    const { error } = await supabase.from('expense_tracker_data').upsert({
      user_id: user.id,
      payload: normalized,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return { localSaved, remoteSaved: true, error: null }
  } catch (error) {
    console.warn('Supabase save failed; data remains local.', error)
    return { localSaved, remoteSaved: false, error: error.message || 'Supabase save failed.' }
  }
}

export function parseImportedJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Imported data must be an object with income and expenses.' }
  }

  if (!parsed.income && !parsed.expenses) {
    return { ok: false, error: 'Imported JSON is missing income and expenses.' }
  }

  if (parsed.expenses != null && !Array.isArray(parsed.expenses)) {
    return { ok: false, error: 'expenses must be a list.' }
  }

  if (parsed.income != null && (typeof parsed.income !== 'object' || Array.isArray(parsed.income))) {
    return { ok: false, error: 'income must be an object keyed by month.' }
  }

  const data = normalizeData(parsed)
  if (parsed.expenses && Array.isArray(parsed.expenses) && parsed.expenses.length > 0 && data.expenses.length === 0) {
    return { ok: false, error: 'None of the imported expenses were valid.' }
  }

  return { ok: true, data }
}
