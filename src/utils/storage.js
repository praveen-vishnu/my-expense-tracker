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
    incomeAccounts: {},
    incomeSources: [],
    budgets: {},
    categoryBudgets: {},
    recurringExpenses: [],
    expenses: [],
    accounts: defaultStarterAccounts(),
    transfers: [],
    categories: [],
    statementAliases: [],
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
      billingDay:
        a.type === 'credit_card' && Number.isInteger(Number(a.billingDay)) && Number(a.billingDay) >= 1 && Number(a.billingDay) <= 31
          ? Number(a.billingDay)
          : null,
      dueDay:
        a.type === 'credit_card' && Number.isInteger(Number(a.dueDay)) && Number(a.dueDay) >= 1 && Number(a.dueDay) <= 31
          ? Number(a.dueDay)
          : null,
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

function normalizeCategoryBudgets(categoryBudgets) {
  if (!categoryBudgets || typeof categoryBudgets !== 'object' || Array.isArray(categoryBudgets)) return {}
  const next = {}
  for (const [month, map] of Object.entries(categoryBudgets)) {
    if (!isValidMonthKey(month) || !map || typeof map !== 'object') continue
    const monthBudgets = {}
    for (const [cat, amt] of Object.entries(map)) {
      const val = Number(amt)
      if (typeof cat === 'string' && cat.trim() && Number.isFinite(val) && val > 0) {
        monthBudgets[cat.trim()] = val
      }
    }
    if (Object.keys(monthBudgets).length) {
      next[month] = monthBudgets
    }
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
      accountId: typeof schedule.accountId === 'string' && schedule.accountId ? schedule.accountId : null,
    }))
}

function normalizeIncomeAccounts(incomeAccounts) {
  if (!incomeAccounts || typeof incomeAccounts !== 'object' || Array.isArray(incomeAccounts)) return {}
  const next = {}
  for (const [month, accId] of Object.entries(incomeAccounts)) {
    if (!isValidMonthKey(month)) continue
    if (typeof accId === 'string' && accId.trim()) {
      next[month] = accId.trim()
    }
  }
  return next
}

function normalizeTransfers(transfers) {
  if (!Array.isArray(transfers)) return []
  return transfers
    .filter((t) => (
      t &&
      typeof t.id === 'string' &&
      t.id &&
      typeof t.fromAccountId === 'string' &&
      t.fromAccountId &&
      typeof t.toAccountId === 'string' &&
      t.toAccountId &&
      typeof t.amount === 'number' &&
      Number.isFinite(t.amount) &&
      t.amount > 0 &&
      typeof t.date === 'string' &&
      isValidDate(t.date)
    ))
    .map((t) => ({
      id: t.id,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      amount: t.amount,
      date: t.date,
      note: typeof t.note === 'string' ? t.note.trim() : '',
    }))
}

function normalizeIncomeSources(incomeSources) {
  if (!Array.isArray(incomeSources)) return []
  return incomeSources
    .filter((s) => (
      s &&
      typeof s.id === 'string' && s.id &&
      typeof s.name === 'string' && s.name.trim() &&
      typeof s.amount === 'number' && Number.isFinite(s.amount) && s.amount > 0 &&
      typeof s.date === 'string' && isValidDate(s.date) &&
      isValidMonthKey(s.monthKey || s.date.slice(0, 7))
    ))
    .map((s) => ({
      id: s.id,
      name: s.name.trim(),
      amount: s.amount,
      date: s.date,
      monthKey: s.monthKey || s.date.slice(0, 7),
      accountId: typeof s.accountId === 'string' && s.accountId ? s.accountId : null,
    }))
}

function normalizeStatementAliases(aliases) {
  if (!Array.isArray(aliases)) return []
  return aliases
    .filter((a) => a && typeof a.scheduleId === 'string' && a.scheduleId && typeof a.key === 'string' && a.key.trim())
    .map((a) => ({
      id: typeof a.id === 'string' && a.id ? a.id : `alias_${a.scheduleId}_${a.key.trim().replace(/\s+/g, '_')}`,
      scheduleId: a.scheduleId,
      key: a.key.trim().toLowerCase(),
      confirmedCount: Number.isInteger(Number(a.confirmedCount)) ? Number(a.confirmedCount) : 1,
      rejectedCount: Number.isInteger(Number(a.rejectedCount)) ? Number(a.rejectedCount) : 0,
      lastSeen: typeof a.lastSeen === 'string' ? a.lastSeen : null,
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
        ...(expense.split && typeof expense.split === 'object'
          ? {
              split: {
                myShare: Number.isFinite(Number(expense.split.myShare)) ? Number(expense.split.myShare) : expense.amount,
                owedAmount: Number.isFinite(Number(expense.split.owedAmount)) ? Number(expense.split.owedAmount) : 0,
                owedBy: typeof expense.split.owedBy === 'string' ? expense.split.owedBy.trim() : '',
                settled: Boolean(expense.split.settled),
                settledDate: typeof expense.split.settledDate === 'string' ? expense.split.settledDate : null,
                settledAccountId: typeof expense.split.settledAccountId === 'string' ? expense.split.settledAccountId : null,
              },
            }
          : {}),
      }))
    : []

  return {
    version: DATA_VERSION,
    income: normalizeIncome(raw.income),
    incomeAccounts: normalizeIncomeAccounts(raw.incomeAccounts),
    incomeSources: normalizeIncomeSources(raw.incomeSources),
    budgets: normalizeBudgets(raw.budgets),
    categoryBudgets: normalizeCategoryBudgets(raw.categoryBudgets),
    recurringExpenses: normalizeRecurringExpenses(raw.recurringExpenses),
    expenses,
    accounts: normalizeAccounts(raw.accounts),
    transfers: normalizeTransfers(raw.transfers),
    categories: normalizeCategories(raw.categories),
    statementAliases: normalizeStatementAliases(raw.statementAliases),
  }
}

import { idbGet, idbSet } from '../sync/idb.js'

export async function loadLocalData() {
  try {
    const idbRecord = await idbGet('data_store', 'current_data')
    if (idbRecord) {
      return normalizeData(idbRecord)
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const normalized = normalizeData(JSON.parse(raw))
        await idbSet('data_store', 'current_data', normalized)
        return normalized
      }
    }

    return emptyData()
  } catch {
    return emptyData()
  }
}

export async function saveLocalData(data) {
  const normalized = normalizeData(data)
  try {
    await idbSet('data_store', 'current_data', normalized)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      } catch {
        // localStorage quota might be exceeded, IDB is primary
      }
    }
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
  const localData = await loadLocalData()
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
  const localSaved = await saveLocalData(normalized)
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
