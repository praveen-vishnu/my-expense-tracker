import { useState, useEffect, useRef, useCallback } from 'react'
import { emptyData, loadData, saveData, normalizeData } from '../utils/storage.js'
import { addRecurringExpenses } from '../utils/recurring.js'
import { createId, isValidDate } from '../utils/formatting.js'
import { isSupabaseConfigured } from '../utils/supabase.js'

const DEBOUNCE_SAVE_MS = 350

export function useTrackerData(authReady, authUser, month) {
  const [data, setData] = useState(() => emptyData())
  const [ready, setReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState('checking')
  const saveTimeoutRef = useRef(null)
  const isInitialLoadRef = useRef(true)

  // 1. Initial Load
  useEffect(() => {
    if (!authReady || !authUser) return undefined
    let active = true
    setReady(false)
    setSyncStatus('checking')

    loadData().then((loadedData) => {
      if (!active) return
      const withRecurring = addRecurringExpenses(loadedData, month)
      setData(withRecurring)
      setReady(true)
      setSyncStatus(isSupabaseConfigured ? 'cloud' : 'local')
      isInitialLoadRef.current = false
    })

    return () => {
      active = false
    }
  }, [authReady, authUser])

  // 2. Materialize recurring expenses when month changes
  useEffect(() => {
    if (!ready) return
    setData((current) => addRecurringExpenses(current, month))
  }, [month, ready])

  // 3. Debounced Save Effect
  useEffect(() => {
    if (!ready || isInitialLoadRef.current) return

    setSyncStatus('saving')
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveData(data).then((result) => {
        setSyncStatus(result.remoteSaved ? 'cloud' : 'local')
      })
    }, DEBOUNCE_SAVE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [data, ready])

  // Mutation Handlers
  const upsertExpense = useCallback((fields, existingId) => {
    if (!isValidDate(fields.date)) return
    setData((current) => {
      if (existingId) {
        return {
          ...current,
          expenses: current.expenses.map((expense) =>
            expense.id === existingId ? { ...expense, ...fields } : expense
          ),
        }
      }
      return {
        ...current,
        expenses: [{ id: createId(), ...fields }, ...current.expenses],
      }
    })
  }, [])

  const deleteExpense = useCallback((expenseId) => {
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.id !== expenseId),
    }))
  }, [])

  const importBatchExpenses = useCallback((newExpenses) => {
    if (!Array.isArray(newExpenses) || !newExpenses.length) return
    setData((current) => ({
      ...current,
      expenses: [...newExpenses, ...current.expenses],
    }))
  }, [])

  const deleteBatchExpenses = useCallback((expenseIds) => {
    if (!Array.isArray(expenseIds) || !expenseIds.length) return
    const idSet = new Set(expenseIds)
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => !idSet.has(item.id)),
    }))
  }, [])

  const updateBatchExpenses = useCallback((expenseIds, fields) => {
    if (!Array.isArray(expenseIds) || !expenseIds.length || !fields) return
    const idSet = new Set(expenseIds)
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((item) =>
        idSet.has(item.id) ? { ...item, ...fields } : item
      ),
    }))
  }, [])

  const saveIncome = useCallback((monthKey, amount, accountId = null) => {
    setData((current) => {
      const nextIncome = { ...current.income, [monthKey]: amount }
      const nextIncomeAccounts = { ...(current.incomeAccounts || {}) }
      if (accountId) {
        nextIncomeAccounts[monthKey] = accountId
      } else {
        delete nextIncomeAccounts[monthKey]
      }
      return {
        ...current,
        income: nextIncome,
        incomeAccounts: nextIncomeAccounts,
      }
    })
  }, [])

  const deleteIncome = useCallback((monthKey) => {
    setData((current) => {
      const next = { ...current.income }
      delete next[monthKey]
      const nextIncomeAccounts = { ...(current.incomeAccounts || {}) }
      delete nextIncomeAccounts[monthKey]
      const nextIncomeSources = (current.incomeSources || []).filter((s) => s.monthKey !== monthKey)
      return {
        ...current,
        income: next,
        incomeAccounts: nextIncomeAccounts,
        incomeSources: nextIncomeSources,
      }
    })
  }, [])

  const addIncomeSource = useCallback((source) => {
    const newSource = {
      id: createId(),
      ...source,
    }
    setData((current) => ({
      ...current,
      incomeSources: [newSource, ...(current.incomeSources || [])],
    }))
  }, [])

  const updateIncomeSource = useCallback((sourceId, fields) => {
    setData((current) => ({
      ...current,
      incomeSources: (current.incomeSources || []).map((s) =>
        s.id === sourceId ? { ...s, ...fields } : s
      ),
    }))
  }, [])

  const deleteIncomeSource = useCallback((sourceId) => {
    setData((current) => ({
      ...current,
      incomeSources: (current.incomeSources || []).filter((s) => s.id !== sourceId),
    }))
  }, [])

  const settleSplitExpense = useCallback((expenseId, settledAccountId, settledDate = new Date().toISOString().slice(0, 10)) => {
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((e) => {
        if (e.id !== expenseId || !e.split) return e
        return {
          ...e,
          split: {
            ...e.split,
            settled: true,
            settledDate,
            settledAccountId: settledAccountId || null,
          },
        }
      }),
    }))
  }, [])

  const saveBudget = useCallback((monthKey, amount) => {
    setData((current) => ({
      ...current,
      budgets: { ...current.budgets, [monthKey]: amount },
    }))
  }, [])

  const saveCategoryBudget = useCallback((monthKey, categoryName, amount) => {
    const val = Number(amount)
    if (!monthKey || !categoryName) return
    setData((current) => {
      const monthBudgets = { ...(current.categoryBudgets?.[monthKey] || {}) }
      if (Number.isFinite(val) && val > 0) {
        monthBudgets[categoryName] = val
      } else {
        delete monthBudgets[categoryName]
      }
      return {
        ...current,
        categoryBudgets: {
          ...(current.categoryBudgets || {}),
          [monthKey]: monthBudgets,
        },
      }
    })
  }, [])

  const deleteCategoryBudget = useCallback((monthKey, categoryName) => {
    setData((current) => {
      const monthBudgets = { ...(current.categoryBudgets?.[monthKey] || {}) }
      delete monthBudgets[categoryName]
      return {
        ...current,
        categoryBudgets: {
          ...(current.categoryBudgets || {}),
          [monthKey]: monthBudgets,
        },
      }
    })
  }, [])

  const copyCategoryBudgets = useCallback((fromMonth, toMonth) => {
    if (!fromMonth || !toMonth) return
    setData((current) => {
      const source = current.categoryBudgets?.[fromMonth] || {}
      return {
        ...current,
        categoryBudgets: {
          ...(current.categoryBudgets || {}),
          [toMonth]: { ...source },
        },
      }
    })
  }, [])

  const addRecurringExpense = useCallback((schedule) => {
    setData((current) => ({
      ...current,
      recurringExpenses: [...current.recurringExpenses, schedule],
    }))
  }, [])

  const deleteRecurringExpense = useCallback((scheduleId) => {
    setData((current) => ({
      ...current,
      recurringExpenses: current.recurringExpenses.filter((item) => item.id !== scheduleId),
    }))
  }, [])

  const addCategory = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setData((current) => {
      if (current.categories.includes(trimmed)) return current
      return {
        ...current,
        categories: [...current.categories, trimmed],
      }
    })
  }, [])

  const addAccount = useCallback((account) => {
    setData((current) => ({
      ...current,
      accounts: [...(current.accounts || []), account],
    }))
  }, [])

  const updateAccount = useCallback((accountId, fields) => {
    setData((current) => ({
      ...current,
      accounts: (current.accounts || []).map((acc) =>
        acc.id === accountId ? { ...acc, ...fields } : acc
      ),
    }))
  }, [])

  const deleteAccount = useCallback((accountId) => {
    setData((current) => {
      const remaining = (current.accounts || []).filter((acc) => acc.id !== accountId)
      if (remaining.length && !remaining.some((a) => a.isDefault)) {
        remaining[0].isDefault = true
      }
      return {
        ...current,
        accounts: remaining,
        expenses: current.expenses.map((e) =>
          e.accountId === accountId ? { ...e, accountId: null } : e
        ),
        recurringExpenses: (current.recurringExpenses || []).map((r) =>
          r.accountId === accountId ? { ...r, accountId: null } : r
        ),
        transfers: (current.transfers || []).filter(
          (t) => t.fromAccountId !== accountId && t.toAccountId !== accountId
        ),
        incomeAccounts: Object.fromEntries(
          Object.entries(current.incomeAccounts || {}).filter(([_, id]) => id !== accountId)
        ),
        incomeSources: (current.incomeSources || []).map((s) =>
          s.accountId === accountId ? { ...s, accountId: null } : s
        ),
      }
    })
  }, [])

  const saveTransfer = useCallback((transfer) => {
    const newTransfer = {
      id: createId(),
      ...transfer,
    }
    setData((current) => ({
      ...current,
      transfers: [newTransfer, ...(current.transfers || [])],
    }))
  }, [])

  const deleteTransfer = useCallback((transferId) => {
    setData((current) => ({
      ...current,
      transfers: (current.transfers || []).filter((t) => t.id !== transferId),
    }))
  }, [])

  const setDefaultAccount = useCallback((accountId) => {
    setData((current) => ({
      ...current,
      accounts: (current.accounts || []).map((acc) => ({
        ...acc,
        isDefault: acc.id === accountId,
      })),
    }))
  }, [])

  const importData = useCallback((imported) => {
    setData(normalizeData(imported))
  }, [])

  const clearAllData = useCallback(() => {
    setData(emptyData())
  }, [])

  return {
    data,
    setData,
    ready,
    syncStatus,
    upsertExpense,
    deleteExpense,
    importBatchExpenses,
    deleteBatchExpenses,
    updateBatchExpenses,
    saveIncome,
    deleteIncome,
    addIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    settleSplitExpense,
    saveBudget,
    saveCategoryBudget,
    deleteCategoryBudget,
    copyCategoryBudgets,
    addRecurringExpense,
    deleteRecurringExpense,
    addCategory,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    saveTransfer,
    deleteTransfer,
    importData,
    clearAllData,
  }
}
