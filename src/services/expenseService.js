import { supabase, isSupabaseConfigured } from '../utils/supabase.js'
import { normalizeData } from '../utils/storage.js'

/**
 * Service abstraction for normalized and fallback cloud data operations.
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null
  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error || !sessionData?.session?.user) return null
  return sessionData.session.user
}

export async function fetchRemoteTrackerData(userId) {
  if (!isSupabaseConfigured || !userId) return null

  try {
    // Attempt normalized queries
    const [expensesRes, incomesRes, budgetsRes, recurringRes, categoriesRes, accountsRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('incomes').select('*').eq('user_id', userId),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('recurring_schedules').select('*').eq('user_id', userId),
      supabase.from('expense_categories').select('name').eq('user_id', userId).order('name'),
      supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    ])

    const hasNormalizedData =
      (!expensesRes.error && expensesRes.data) ||
      (!incomesRes.error && incomesRes.data) ||
      (!budgetsRes.error && budgetsRes.data) ||
      (!accountsRes.error && accountsRes.data)

    if (hasNormalizedData && (expensesRes.data?.length || incomesRes.data?.length || accountsRes.data?.length)) {
      const incomeMap = {}
      for (const row of incomesRes.data || []) {
        incomeMap[row.month] = Number(row.amount)
      }

      const budgetMap = {}
      for (const row of budgetsRes.data || []) {
        budgetMap[row.month] = Number(row.amount)
      }

      const categories = (categoriesRes.data || []).map((row) => row.name)

      const accounts = (accountsRes.data || []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        initialBalance: Number(row.initial_balance || 0),
        creditLimit: row.credit_limit ? Number(row.credit_limit) : null,
        isDefault: Boolean(row.is_default),
      }))

      return normalizeData({
        expenses: (expensesRes.data || []).map((row) => ({
          id: row.id,
          amount: Number(row.amount),
          category: row.category,
          date: row.date,
          note: row.note || '',
          ...(row.account_id ? { accountId: row.account_id } : {}),
          ...(row.recurring_id ? { recurringId: row.recurring_id } : {}),
        })),
        income: incomeMap,
        budgets: budgetMap,
        recurringExpenses: (recurringRes.data || []).map((row) => ({
          id: row.id,
          name: row.name,
          amount: Number(row.amount),
          category: row.category,
          note: row.note || '',
          day: row.day,
          startMonth: row.start_month,
          kind: row.kind,
          installments: row.installments,
        })),
        accounts,
        categories,
      })
    }

    // Fallback to legacy document store
    const { data: record, error: legacyError } = await supabase
      .from('expense_tracker_data')
      .select('payload')
      .eq('user_id', userId)
      .maybeSingle()

    if (!legacyError && record?.payload) {
      return normalizeData(record.payload)
    }

    return null
  } catch (err) {
    console.warn('Remote fetch failed; falling back to local dataset.', err)
    return null
  }
}

export async function persistRemoteTrackerData(userId, data) {
  if (!isSupabaseConfigured || !userId) {
    return { remoteSaved: false, error: 'Cloud storage not configured' }
  }

  const normalized = normalizeData(data)

  try {
    // 1. Dual-write to legacy payload table for backward safety
    await supabase.from('expense_tracker_data').upsert({
      user_id: userId,
      payload: normalized,
      updated_at: new Date().toISOString(),
    })

    // 2. Write categories
    if (normalized.categories.length) {
      await supabase.from('expense_categories').upsert(
        normalized.categories.map((name) => ({ user_id: userId, name })),
        { onConflict: 'user_id,name', ignoreDuplicates: true }
      )
    }

    // 3. Write accounts
    if (normalized.accounts.length) {
      await supabase.from('accounts').upsert(
        normalized.accounts.map((acc) => ({
          id: acc.id,
          user_id: userId,
          name: acc.name,
          type: acc.type,
          initial_balance: acc.initialBalance,
          credit_limit: acc.creditLimit,
          is_default: acc.isDefault,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      )
    }

    return { remoteSaved: true, error: null }
  } catch (error) {
    console.warn('Remote sync error:', error)
    return { remoteSaved: false, error: error.message || 'Remote sync error' }
  }
}
