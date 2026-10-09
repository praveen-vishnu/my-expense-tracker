import { isValidDate, isValidMonthKey } from './formatting.js'
import { isSupabaseConfigured, supabase } from './supabase.js'

export const STORAGE_KEY = 'expenseTracker'
export const DATA_VERSION = 1

export function defaultStarterAccounts() {
  return [
    { id: 'acc_bank', name: 'Primary Bank', type: 'bank', initialBalance: 0, isDefault: true },
    { id: 'acc_cash', name: 'Cash', type: 'cash', initialBalance: 0, isDefault: false },
  ]
}

export function emptyData() {
  return {
    version: DATA_VERSION,
    income: {},
    budgets: {},
    recurringExpenses: [],
    expenses: [],
    accounts: defaultStarterAccounts(),
    categories: [],
  }
}

function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts) || !accounts.length) {
    return defaultStarterAccounts()
  }
  const validTypes = new Set(['bank', 'credit_card', 'cash', 'wallet'])
  const cleaned = accounts
    .filter((a) => a && typeof a.id === 'string' && a.id && typeof a.name === 'string' && a.name.trim())
    .map((a) => ({
      id: a.id,
      name: a.name.trim(),
      type: validTypes.has(a.type) ? a.type : 'bank',
      initialBalance: Number.isFinite(Number(a.initialBalance)) ? Number(a.initialBalance) : 0,
      creditLimit: a.type === 'credit_card' && Number.isFinite(Number(a.creditLimit)) ? Number(a.creditLimit) : null,
      isDefault: Boolean(a.isDefault),
    }))

  if (!cleaned.length) {
    return defaultStarterAccounts()
  }

  if (!cleaned.some((a) => a.isDefault)) {
    cleaned[0].isDefault = true
  }

  return cleaned
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
  return [...new Set(cleaned)]
}

function normalizeBudgets(budgets) {
  if (!budgets || typeof budgets !== 'object' || Array.isArray(budgets)) return {}
  const next = {}
  for (const [month, amount] of Object.entries(budgets)) {
    if (!isValidMonthKey(month)) continue
    const value = Number(amount)
    if (Number.isFinite(value) && value > 0) next[month] = value
  }
  return next
}

function normalizeRecurringExpenses(recurringExpenses) {
  if (!Array.isArray(recurringExpenses)) return []
  return recurringExpenses
    .filter((schedule) => (
      schedule &&
      typeof schedule.id === 'string' &&
      schedule.id &&
      typeof schedule.name === 'string' &&
      schedule.name.trim() &&
      typeof schedule.amount === 'number' &&
      Number.isFinite(schedule.amount) &&
      schedule.amount > 0 &&
      typeof schedule.category === 'string' &&
      schedule.category.trim() &&
      Number.isInteger(schedule.day) &&
      schedule.day >= 1 &&
      schedule.day <= 31 &&
      isValidMonthKey(schedule.startMonth) &&
      (schedule.kind === 'monthly' || schedule.kind === 'emi') &&
      (schedule.kind === 'monthly' || (Number.isInteger(schedule.installments) && schedule.installments > 0))
    ))
    .map((schedule) => ({
      id: schedule.id,
      name: schedule.name.trim(),
      amount: schedule.amount,
      category: schedule.category.trim(),
      note: typeof schedule.note === 'string' ? schedule.note.trim() : '',
      day: schedule.day,
      startMonth: schedule.startMonth,
      kind: schedule.kind,
      installments: schedule.kind === 'emi' ? schedule.installments : null,
    }))
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
        ...(typeof expense.accountId === 'string' ? { accountId: expense.accountId } : {}),
        ...(typeof expense.recurringId === 'string' ? { recurringId: expense.recurringId } : {}),
      }))
    : []

  return {
    version: DATA_VERSION,
    income: normalizeIncome(raw.income),
    budgets: normalizeBudgets(raw.budgets),
    recurringExpenses: normalizeRecurringExpenses(raw.recurringExpenses),
    expenses,
    accounts: normalizeAccounts(raw.accounts),
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
    const payloadData = normalizeData(record?.payload || localData)
    const { data: categoryRows, error: categoryError } = await supabase
      .from('expense_categories')
      .select('name')
      .eq('user_id', user.id)
      .order('name')

    if (categoryError) throw categoryError
    const storedCategories = categoryRows.map((row) => row.name)
    const categories = [...new Set([...storedCategories, ...payloadData.categories])]
    const loadedData = { ...payloadData, categories }

    if (!categoryRows.length && payloadData.categories.length) {
      await saveCategories(user.id, payloadData.categories)
    }

    if (!record?.payload && (localData.expenses.length || Object.keys(localData.income).length)) {
      await saveData(loadedData)
    }
    return loadedData
  } catch (error) {
    console.warn('Supabase load failed; using local data.', error)
    return localData
  }
}

async function saveCategories(userId, categories) {
  if (!categories.length) return
  const { error } = await supabase.from('expense_categories').upsert(
    categories.map((name) => ({ user_id: userId, name })),
    { onConflict: 'user_id,name', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function saveData(data) {
  const normalized = normalizeData(data)
  const localSaved = saveLocalData(normalized)
  if (!isSupabaseConfigured) {
    return { localSaved, remoteSaved: false, error: 'Supabase environment variables are missing.' }
  }

  try {
    const user = await getSupabaseUser()
    await saveCategories(user.id, normalized.categories)
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
