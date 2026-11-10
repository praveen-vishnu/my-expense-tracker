import { useState, useEffect, useRef, useCallback } from 'react'
import { emptyData, loadData, saveData, normalizeData, saveLocalData } from '../utils/storage.js'
import { addRecurringExpenses, applyLinkedEmiPayments, syncLinkedEmiAmounts, syncRecurringExpenseToExpenses } from '../utils/recurring.js'
import { createId, isValidDate, todayISO } from '../utils/formatting.js'
import { normalizeNarration } from '../utils/reconcile.js'
import { applyDebtPayment, normalizeDebt, normalizeDebtPayment, parseDebtImport } from '../utils/debts.js'
import { isSupabaseConfigured, supabase } from '../utils/supabase.js'
import { enqueueMutation } from '../sync/outbox.js'
import {
  sync,
  pushOutbox,
  initAutoSync,
  subscribeSyncStatus,
  getSyncStatus,
  backfillNormalizedTables,
} from '../sync/syncEngine.js'

const DEBOUNCE_SAVE_MS = 350

function materializeRecurringData(data, month, applyToExistingSchedules = []) {
  const withExpenses = addRecurringExpenses(syncLinkedEmiAmounts(data), month)
  const previousExpenseIds = new Set((data.expenses || []).map((expense) => expense.id))
  const eligibleExpenseIds = new Set(
    withExpenses.expenses
      .filter((expense) => !previousExpenseIds.has(expense.id))
      .map((expense) => expense.id)
  )
  for (const scheduleId of applyToExistingSchedules) {
    eligibleExpenseIds.add(`recurring_${scheduleId}_${month}`)
  }
  const next = applyLinkedEmiPayments(withExpenses, month, eligibleExpenseIds)
  const schedulesById = new Map((next.recurringExpenses || []).map((schedule) => [schedule.id, schedule]))
  const previousExpenses = new Map((data.expenses || []).map((expense) => [expense.id, expense]))

  for (const expense of next.expenses) {
    const schedule = schedulesById.get(expense.recurringId)
    if (schedule?.kind !== 'emi' || expense.date?.slice(0, 7) !== month) continue
    if (previousExpenses.get(expense.id) === expense) continue
    enqueueMutation({ table: 'expenses', id: expense.id, op: 'upsert', payload: expense })
  }

  const previousDebts = new Map((data.debts || []).map((debt) => [debt.id, debt]))
  for (const debt of next.debts || []) {
    if (previousDebts.get(debt.id) !== debt) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'upsert', payload: debt })
    }
  }

  const previousPaymentIds = new Set((data.debtPayments || []).map((payment) => payment.id))
  for (const payment of next.debtPayments || []) {
    if (!previousPaymentIds.has(payment.id)) {
      enqueueMutation({ table: 'debt_payments', id: payment.id, op: 'upsert', payload: payment })
    }
  }

  return next
}

export function useTrackerData(authReady, authUser, month) {
  const [data, setData] = useState(() => emptyData())
  const [ready, setReady] = useState(false)
  const [syncInfo, setSyncInfo] = useState(() => getSyncStatus())
  const [legacySyncStatus, setLegacySyncStatus] = useState('checking')
  const saveTimeoutRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const loadedUserIdRef = useRef(null)
  const dataRef = useRef(data)
  const monthRef = useRef(month)

  const userId = authUser?.id

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    monthRef.current = month
  }, [month])

  // Handle remote deltas coming from deltaPull
  const handleRemoteChange = useCallback(({ table, id, record, isDeleted }) => {
    setData((current) => {
      let next = { ...current }

      if (table === 'expenses') {
        const remaining = current.expenses.filter((e) => e.id !== id)
        next.expenses = isDeleted || !record ? remaining : [record, ...remaining]
      } else if (table === 'accounts') {
        const remaining = (current.accounts || []).filter((a) => a.id !== id)
        next.accounts = isDeleted || !record ? remaining : [...remaining, record]
      } else if (table === 'transfers') {
        const remaining = (current.transfers || []).filter((t) => t.id !== id)
        next.transfers = isDeleted || !record ? remaining : [record, ...remaining]
      } else if (table === 'debts') {
        const remaining = (current.debts || []).filter((debt) => debt.id !== id)
        next.debts = isDeleted || !record ? remaining : [record, ...remaining]
      } else if (table === 'debt_payments') {
        const remaining = (current.debtPayments || []).filter((payment) => payment.id !== id)
        next.debtPayments = isDeleted || !record ? remaining : [record, ...remaining]
      } else if (table === 'recurring_schedules') {
        const remaining = (current.recurringExpenses || []).filter((r) => r.id !== id)
        next.recurringExpenses = isDeleted || !record ? remaining : [...remaining, record]
      } else if (table === 'category_budgets') {
        const [monthKey, ...catParts] = id.split('_')
        const cat = catParts.join('_')
        const currentMonthBudgets = { ...(current.categoryBudgets?.[monthKey] || {}) }
        if (isDeleted || !record) {
          delete currentMonthBudgets[cat]
        } else {
          currentMonthBudgets[cat] = record.amount
        }
        next.categoryBudgets = {
          ...(current.categoryBudgets || {}),
          [monthKey]: currentMonthBudgets,
        }
      } else if (table === 'incomes') {
        const monthKey = id
        const nextIncome = { ...current.income }
        const nextIncomeAccounts = { ...(current.incomeAccounts || {}) }
        if (isDeleted || !record) {
          delete nextIncome[monthKey]
          delete nextIncomeAccounts[monthKey]
        } else {
          nextIncome[monthKey] = record.amount
          if (record.accountId) {
            nextIncomeAccounts[monthKey] = record.accountId
          } else {
            delete nextIncomeAccounts[monthKey]
          }
        }
        next.income = nextIncome
        next.incomeAccounts = nextIncomeAccounts
      } else if (table === 'budgets') {
        const monthKey = id
        const nextBudgets = { ...current.budgets }
        if (isDeleted || !record) {
          delete nextBudgets[monthKey]
        } else {
          nextBudgets[monthKey] = record.amount
        }
        next.budgets = nextBudgets
      }

      saveLocalData(next)
      return next
    })
  }, [])

  // Subscribe to sync status updates
  useEffect(() => {
    return subscribeSyncStatus((status) => {
      setSyncInfo(status)
      if (status.state === 'synced') {
        setLegacySyncStatus(isSupabaseConfigured && userId ? 'cloud' : 'local')
      } else if (status.state === 'syncing') {
        setLegacySyncStatus('saving')
      } else if (status.state === 'pending') {
        setLegacySyncStatus('pending')
      } else if (status.state === 'error') {
        setLegacySyncStatus('error')
      }
    })
  }, [userId])

  // 1. Initial Load (Runs once when authenticated; never re-triggers or resets ready on focus or month change)
  useEffect(() => {
    if (!authReady || !userId) return undefined
    // If this exact user is already loaded in memory, do NOT reset ready or unmount UI
    if (loadedUserIdRef.current === userId) return undefined

    let active = true
    setReady(false)
    setLegacySyncStatus('checking')

    loadData().then(async (loadedData) => {
      if (!active) return
      const withRecurring = materializeRecurringData(loadedData, monthRef.current)
      setData(withRecurring)
      loadedUserIdRef.current = userId
      setReady(true)
      isInitialLoadRef.current = false

      if (isSupabaseConfigured && supabase && userId) {
        // Run one-time backfill if per-row tables are empty
        await backfillNormalizedTables(supabase, userId, withRecurring)
        // Run initial delta pull & outbox flush
        await sync(supabase, userId, handleRemoteChange)
      }
    })

    return () => {
      active = false
    }
  }, [authReady, userId, handleRemoteChange])

  // 2. Setup Auto-Sync (runs silently in the background on focus, visibility change, and online events)
  useEffect(() => {
    if (!authReady || !userId) return undefined

    const cleanupAutoSync = initAutoSync(
      () => supabase,
      () => userId,
      handleRemoteChange
    )

    return cleanupAutoSync
  }, [authReady, userId, handleRemoteChange])

  // 3. Materialize recurring expenses when month changes (smoothly in memory, no unmounting)
  useEffect(() => {
    if (!ready) return
    const current = dataRef.current
    const next = materializeRecurringData(current, month)
    if (next !== current) setData(next)
  }, [month, ready, data])

  // 4. Debounced Snapshot Backup Effect
  useEffect(() => {
    if (!ready || isInitialLoadRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveData(dataRef.current).then(() => {
        if (isSupabaseConfigured && supabase && userId) {
          pushOutbox(supabase, userId)
        }
      })
    }, DEBOUNCE_SAVE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [data, ready, userId])

  // Mutation Handlers
  const upsertExpense = useCallback((fields, existingId) => {
    if (!isValidDate(fields.date)) return
    const id = existingId || createId()
    const record = { id, ...fields }

    enqueueMutation({
      table: 'expenses',
      id,
      op: 'upsert',
      payload: record,
    })

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
        expenses: [record, ...current.expenses],
      }
    })
  }, [])

  const deleteExpense = useCallback((expenseId) => {
    enqueueMutation({ table: 'expenses', id: expenseId, op: 'delete' })
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.id !== expenseId),
    }))
  }, [])

  const saveDebt = useCallback((fields, existingId) => {
    const id = existingId || fields.id || createId()
    const normalized = normalizeDebt({ ...fields, id })
    if (!normalized) return { ok: false, error: 'Enter a name, original amount, and valid balance.' }

    enqueueMutation({ table: 'debts', id, op: 'upsert', payload: normalized })
    const existingDebts = dataRef.current?.debts || []
    const exists = existingDebts.some((debt) => debt.id === id)
    const nextDebts = exists
      ? existingDebts.map((debt) => (debt.id === id ? normalized : debt))
      : [normalized, ...existingDebts]
    const next = {
      ...(dataRef.current || {}),
      debts: nextDebts,
    }
    dataRef.current = next
    setData(next)
    return { ok: true, id, debt: normalized }
  }, [])

  const recordDebtPayment = useCallback((debtId, fields) => {
    const currentDebt = dataRef.current?.debts?.find((debt) => debt.id === debtId)
    if (!currentDebt) return { ok: false, error: 'This debt could not be found.' }

    const payment = normalizeDebtPayment({ ...fields, id: createId(), debtId })
    if (!payment || payment.principal > currentDebt.balance) {
      return { ok: false, error: 'Enter a valid payment with principal no greater than the remaining balance.' }
    }

    const updatedDebt = applyDebtPayment(currentDebt, payment)
    if (!updatedDebt) return { ok: false, error: 'The debt balance could not be updated.' }

    enqueueMutation({ table: 'debts', id: debtId, op: 'upsert', payload: updatedDebt })
    enqueueMutation({ table: 'debt_payments', id: payment.id, op: 'upsert', payload: payment })
    setData((current) => ({
      ...current,
      debts: (current.debts || []).map((debt) => debt.id === debtId ? updatedDebt : debt),
      debtPayments: [payment, ...(current.debtPayments || [])],
    }))
    return { ok: true }
  }, [])

  const deleteDebt = useCallback((debtId) => {
    if (!debtId) return
    enqueueMutation({ table: 'debts', id: debtId, op: 'delete' })
    const paymentsToDelete = (dataRef.current?.debtPayments || []).filter((p) => p.debtId === debtId)
    for (const p of paymentsToDelete) {
      enqueueMutation({ table: 'debt_payments', id: p.id, op: 'delete' })
    }
    const schedulesToUpdate = (dataRef.current?.recurringExpenses || []).filter((s) => s.debtId === debtId)
    for (const s of schedulesToUpdate) {
      const unlinked = { ...s, debtId: null }
      enqueueMutation({ table: 'recurring_schedules', id: s.id, op: 'upsert', payload: unlinked })
    }

    setData((current) => {
      const next = {
        ...current,
        debts: (current.debts || []).filter((d) => d.id !== debtId),
        debtPayments: (current.debtPayments || []).filter((p) => p.debtId !== debtId),
        recurringExpenses: (current.recurringExpenses || []).map((s) => s.debtId === debtId ? { ...s, debtId: null } : s),
      }
      dataRef.current = next
      return next
    })
  }, [])

  const clearAllDebts = useCallback(() => {
    for (const debt of dataRef.current?.debts || []) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'delete' })
    }
    for (const p of dataRef.current?.debtPayments || []) {
      enqueueMutation({ table: 'debt_payments', id: p.id, op: 'delete' })
    }
    const schedulesToUpdate = (dataRef.current?.recurringExpenses || []).filter((s) => s.debtId)
    for (const s of schedulesToUpdate) {
      const unlinked = { ...s, debtId: null }
      enqueueMutation({ table: 'recurring_schedules', id: s.id, op: 'upsert', payload: unlinked })
    }

    setData((current) => {
      const next = {
        ...current,
        debts: [],
        debtPayments: [],
        recurringExpenses: (current.recurringExpenses || []).map((s) => s.debtId ? { ...s, debtId: null } : s),
      }
      dataRef.current = next
      return next
    })
  }, [])

  const importDebts = useCallback((input, { overwrite = false } = {}) => {
    const result = parseDebtImport(input)
    if (!result.ok) return result

    if (overwrite) {
      for (const debt of dataRef.current?.debts || []) {
        enqueueMutation({ table: 'debts', id: debt.id, op: 'delete' })
      }
      for (const debt of result.debts) {
        enqueueMutation({ table: 'debts', id: debt.id, op: 'upsert', payload: debt })
      }
      setData((current) => {
        const next = { ...current, debts: result.debts }
        dataRef.current = next
        return next
      })
      return { ok: true, imported: result.debts.length, skipped: result.skipped }
    }

    for (const debt of result.debts) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'upsert', payload: debt })
    }
    setData((current) => {
      const incomingIds = new Set(result.debts.map((d) => d.id))
      const untouched = (current.debts || []).filter((d) => !incomingIds.has(d.id))
      const next = { ...current, debts: [...result.debts, ...untouched] }
      dataRef.current = next
      return next
    })
    return { ok: true, imported: result.debts.length, skipped: result.skipped }
  }, [])

  const importBatchExpenses = useCallback((newExpenses) => {
    if (!Array.isArray(newExpenses) || !newExpenses.length) return
    for (const exp of newExpenses) {
      enqueueMutation({ table: 'expenses', id: exp.id, op: 'upsert', payload: exp })
    }
    setData((current) => ({
      ...current,
      expenses: [...newExpenses, ...current.expenses],
    }))
  }, [])

  const deleteBatchExpenses = useCallback((expenseIds) => {
    if (!Array.isArray(expenseIds) || !expenseIds.length) return
    const idSet = new Set(expenseIds)
    for (const id of expenseIds) {
      enqueueMutation({ table: 'expenses', id, op: 'delete' })
    }
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => !idSet.has(item.id)),
    }))
  }, [])

  const updateBatchExpenses = useCallback((expenseIds, fields) => {
    if (!Array.isArray(expenseIds) || !expenseIds.length || !fields) return
    const idSet = new Set(expenseIds)
    const currentExpenses = dataRef.current?.expenses || []
    for (const item of currentExpenses) {
      if (idSet.has(item.id)) {
        enqueueMutation({ table: 'expenses', id: item.id, op: 'upsert', payload: { ...item, ...fields } })
      }
    }
    setData((current) => {
      const updatedExpenses = current.expenses.map((item) => {
        if (!idSet.has(item.id)) return item
        return { ...item, ...fields }
      })
      return { ...current, expenses: updatedExpenses }
    })
  }, [])

  const saveIncome = useCallback((monthKey, amount, accountId = null) => {
    const val = Number(amount)
    if (Number.isFinite(val) && val > 0) {
      enqueueMutation({
        table: 'incomes',
        id: monthKey,
        op: 'upsert',
        payload: { month: monthKey, amount: val, accountId },
      })
    } else {
      enqueueMutation({
        table: 'incomes',
        id: monthKey,
        op: 'delete',
      })
    }

    setData((current) => {
      const nextIncome = { ...current.income }
      const nextIncomeAccounts = { ...(current.incomeAccounts || {}) }
      if (Number.isFinite(val) && val > 0) {
        nextIncome[monthKey] = val
        if (accountId) {
          nextIncomeAccounts[monthKey] = accountId
        } else {
          delete nextIncomeAccounts[monthKey]
        }
      } else {
        delete nextIncome[monthKey]
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
    enqueueMutation({ table: 'incomes', id: monthKey, op: 'delete' })
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
    const existing = dataRef.current?.expenses?.find((e) => e.id === expenseId)
    if (existing && existing.split) {
      const updated = {
        ...existing,
        split: {
          ...existing.split,
          settled: true,
          settledDate,
          settledAccountId: settledAccountId || null,
        },
      }
      enqueueMutation({ table: 'expenses', id: existing.id, op: 'upsert', payload: updated })
    }

    setData((current) => {
      const updatedExpenses = current.expenses.map((e) => {
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
      })
      return { ...current, expenses: updatedExpenses }
    })
  }, [])

  const saveBudget = useCallback((monthKey, amount) => {
    const val = Number(amount)
    if (Number.isFinite(val) && val > 0) {
      enqueueMutation({
        table: 'budgets',
        id: monthKey,
        op: 'upsert',
        payload: { month: monthKey, amount: val },
      })
    } else {
      enqueueMutation({
        table: 'budgets',
        id: monthKey,
        op: 'delete',
      })
    }

    setData((current) => {
      const nextBudgets = { ...(current.budgets || {}) }
      if (Number.isFinite(val) && val > 0) {
        nextBudgets[monthKey] = val
      } else {
        delete nextBudgets[monthKey]
      }
      return {
        ...current,
        budgets: nextBudgets,
      }
    })
  }, [])

  const saveCategoryBudget = useCallback((monthKey, categoryName, amount) => {
    const val = Number(amount)
    if (!monthKey || !categoryName) return
    const id = `${monthKey}_${categoryName}`

    if (Number.isFinite(val) && val > 0) {
      enqueueMutation({
        table: 'category_budgets',
        id,
        op: 'upsert',
        payload: { id, month: monthKey, category: categoryName, amount: val },
      })
    } else {
      enqueueMutation({
        table: 'category_budgets',
        id,
        op: 'delete',
      })
    }

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
    const id = `${monthKey}_${categoryName}`
    enqueueMutation({ table: 'category_budgets', id, op: 'delete' })

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
    const source = dataRef.current?.categoryBudgets?.[fromMonth] || {}
    for (const [cat, amt] of Object.entries(source)) {
      enqueueMutation({
        table: 'category_budgets',
        id: `${toMonth}_${cat}`,
        op: 'upsert',
        payload: { id: `${toMonth}_${cat}`, month: toMonth, category: cat, amount: amt },
      })
    }
    setData((current) => ({
      ...current,
      categoryBudgets: {
        ...(current.categoryBudgets || {}),
        [toMonth]: { ...(current.categoryBudgets?.[fromMonth] || {}) },
      },
    }))
  }, [])

  const addRecurringExpense = useCallback((schedule, newDebt = null) => {
    let current = dataRef.current
    if (newDebt) {
      const normalizedDebt = normalizeDebt(newDebt)
      if (normalizedDebt) {
        enqueueMutation({ table: 'debts', id: normalizedDebt.id, op: 'upsert', payload: normalizedDebt })
        const existingDebts = current.debts || []
        const exists = existingDebts.some((d) => d.id === normalizedDebt.id)
        current = {
          ...current,
          debts: exists
            ? existingDebts.map((d) => (d.id === normalizedDebt.id ? normalizedDebt : d))
            : [normalizedDebt, ...existingDebts],
        }
      }
    }
    enqueueMutation({
      table: 'recurring_schedules',
      id: schedule.id,
      op: 'upsert',
      payload: schedule,
    })
    const withSchedule = {
      ...current,
      recurringExpenses: [...(current.recurringExpenses || []), schedule],
    }
    const materialized = materializeRecurringData(withSchedule, monthRef.current, schedule.debtId ? [schedule.id] : [])
    dataRef.current = materialized
    setData(materialized)
  }, [])

  const updateRecurringExpense = useCallback((schedule, newDebt = null) => {
    if (!schedule || !schedule.id) return
    let current = dataRef.current
    if (newDebt) {
      const normalizedDebt = normalizeDebt(newDebt)
      if (normalizedDebt) {
        enqueueMutation({ table: 'debts', id: normalizedDebt.id, op: 'upsert', payload: normalizedDebt })
        const existingDebts = current.debts || []
        const exists = existingDebts.some((d) => d.id === normalizedDebt.id)
        current = {
          ...current,
          debts: exists
            ? existingDebts.map((d) => (d.id === normalizedDebt.id ? normalizedDebt : d))
            : [normalizedDebt, ...existingDebts],
        }
      }
    }
    enqueueMutation({
      table: 'recurring_schedules',
      id: schedule.id,
      op: 'upsert',
      payload: schedule,
    })
    const nextSchedules = (current.recurringExpenses || []).map((item) =>
      item.id === schedule.id ? schedule : item
    )
    const currentMonthKey = monthRef.current
    const paymentId = `recurring_emi_${schedule.id}_${currentMonthKey}`
    const alreadyApplied = (current.debtPayments || []).some((payment) => payment.id === paymentId)
    const { expenses: nextExpenses, updatedExpenses } = alreadyApplied
      ? { expenses: current.expenses, updatedExpenses: [] }
      : syncRecurringExpenseToExpenses(current.expenses, schedule, currentMonthKey)

    for (const updatedExp of updatedExpenses) {
      enqueueMutation({
        table: 'expenses',
        id: updatedExp.id,
        op: 'upsert',
        payload: updatedExp,
      })
    }

    const updated = materializeRecurringData({
      ...current,
      recurringExpenses: nextSchedules,
      expenses: nextExpenses,
    }, currentMonthKey, schedule.debtId ? [schedule.id] : [])
    dataRef.current = updated
    setData(updated)
  }, [])

  const deleteRecurringExpense = useCallback((scheduleId) => {
    enqueueMutation({ table: 'recurring_schedules', id: scheduleId, op: 'delete' })
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
    enqueueMutation({
      table: 'accounts',
      id: account.id,
      op: 'upsert',
      payload: account,
    })
    setData((current) => ({
      ...current,
      accounts: [...(current.accounts || []), account],
    }))
  }, [])

  const updateAccount = useCallback((accountId, fields) => {
    const existing = dataRef.current?.accounts?.find((a) => a.id === accountId)
    if (existing) {
      enqueueMutation({
        table: 'accounts',
        id: accountId,
        op: 'upsert',
        payload: { ...existing, ...fields },
      })
    }
    setData((current) => {
      const updatedAccounts = (current.accounts || []).map((acc) => {
        if (acc.id !== accountId) return acc
        return { ...acc, ...fields }
      })
      return { ...current, accounts: updatedAccounts }
    })
  }, [])

  const deleteAccount = useCallback((accountId) => {
    enqueueMutation({ table: 'accounts', id: accountId, op: 'delete' })
    const accounts = dataRef.current?.accounts || []
    const remaining = accounts.filter((acc) => acc.id !== accountId)
    if (remaining.length && !remaining.some((a) => a.isDefault)) {
      enqueueMutation({
        table: 'accounts',
        id: remaining[0].id,
        op: 'upsert',
        payload: { ...remaining[0], isDefault: true },
      })
    }

    setData((current) => {
      const currRemaining = (current.accounts || []).filter((acc) => acc.id !== accountId)
      let finalAccounts = currRemaining
      if (currRemaining.length && !currRemaining.some((a) => a.isDefault)) {
        finalAccounts = currRemaining.map((a, idx) => (idx === 0 ? { ...a, isDefault: true } : a))
      }
      return {
        ...current,
        accounts: finalAccounts,
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
    enqueueMutation({
      table: 'transfers',
      id: newTransfer.id,
      op: 'upsert',
      payload: newTransfer,
    })
    setData((current) => ({
      ...current,
      transfers: [newTransfer, ...(current.transfers || [])],
    }))
  }, [])

  const deleteTransfer = useCallback((transferId) => {
    enqueueMutation({ table: 'transfers', id: transferId, op: 'delete' })
    setData((current) => ({
      ...current,
      transfers: (current.transfers || []).filter((t) => t.id !== transferId),
    }))
  }, [])

  const setDefaultAccount = useCallback((accountId) => {
    const accounts = dataRef.current?.accounts || []
    for (const acc of accounts) {
      enqueueMutation({
        table: 'accounts',
        id: acc.id,
        op: 'upsert',
        payload: { ...acc, isDefault: acc.id === accountId },
      })
    }
    setData((current) => {
      const updatedAccounts = (current.accounts || []).map((acc) => ({
        ...acc,
        isDefault: acc.id === accountId,
      }))
      return { ...current, accounts: updatedAccounts }
    })
  }, [])

  const retrySync = useCallback(async () => {
    if (isSupabaseConfigured && supabase && authUser?.id) {
      await sync(supabase, authUser.id, handleRemoteChange)
    }
  }, [authUser, handleRemoteChange])

  const importData = useCallback((imported) => {
    const normalized = normalizeData(imported)
    for (const payment of dataRef.current?.debtPayments || []) {
      enqueueMutation({ table: 'debt_payments', id: payment.id, op: 'delete' })
    }
    for (const debt of dataRef.current?.debts || []) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'delete' })
    }
    for (const debt of normalized.debts) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'upsert', payload: debt })
    }
    for (const payment of normalized.debtPayments) {
      enqueueMutation({ table: 'debt_payments', id: payment.id, op: 'upsert', payload: payment })
    }
    setData(normalized)
    saveLocalData(normalized)
  }, [])

  const clearAllData = useCallback(() => {
    for (const payment of dataRef.current?.debtPayments || []) {
      enqueueMutation({ table: 'debt_payments', id: payment.id, op: 'delete' })
    }
    for (const debt of dataRef.current?.debts || []) {
      enqueueMutation({ table: 'debts', id: debt.id, op: 'delete' })
    }
    const empty = emptyData()
    setData(empty)
    saveLocalData(empty)
  }, [])

  const confirmStatementAlias = useCallback((scheduleId, rawNarration) => {
    if (!scheduleId || !rawNarration) return
    const key = normalizeNarration(rawNarration)
    if (!key) return
    const today = todayISO()

    setData((current) => {
      const existingAliases = current.statementAliases || []
      const idx = existingAliases.findIndex((a) => a.scheduleId === scheduleId && a.key === key)
      let nextAliases = [...existingAliases]
      if (idx !== -1) {
        nextAliases[idx] = {
          ...nextAliases[idx],
          confirmedCount: (nextAliases[idx].confirmedCount || 0) + 1,
          lastSeen: today,
        }
      } else {
        nextAliases.push({
          id: `alias_${scheduleId}_${key.replace(/\s+/g, '_')}`,
          scheduleId,
          key,
          confirmedCount: 1,
          rejectedCount: 0,
          lastSeen: today,
        })
      }
      const updated = { ...current, statementAliases: nextAliases }
      saveLocalData(updated)
      return updated
    })
  }, [])

  const rejectStatementAlias = useCallback((scheduleId, rawNarration) => {
    if (!scheduleId || !rawNarration) return
    const key = normalizeNarration(rawNarration)
    if (!key) return
    const today = todayISO()

    setData((current) => {
      const existingAliases = current.statementAliases || []
      const idx = existingAliases.findIndex((a) => a.scheduleId === scheduleId && a.key === key)
      let nextAliases = [...existingAliases]
      if (idx !== -1) {
        nextAliases[idx] = {
          ...nextAliases[idx],
          rejectedCount: (nextAliases[idx].rejectedCount || 0) + 1,
          lastSeen: today,
        }
      } else {
        nextAliases.push({
          id: `alias_${scheduleId}_${key.replace(/\s+/g, '_')}`,
          scheduleId,
          key,
          confirmedCount: 0,
          rejectedCount: 1,
          lastSeen: today,
        })
      }
      const updated = { ...current, statementAliases: nextAliases }
      saveLocalData(updated)
      return updated
    })
  }, [])

  const deleteStatementAlias = useCallback((aliasId) => {
    if (!aliasId) return
    setData((current) => {
      const remaining = (current.statementAliases || []).filter((a) => a.id !== aliasId)
      const updated = { ...current, statementAliases: remaining }
      saveLocalData(updated)
      return updated
    })
  }, [])

  return {
    data,
    setData,
    ready,
    syncStatus: legacySyncStatus,
    syncInfo,
    retrySync,
    upsertExpense,
    deleteExpense,
    saveDebt,
    deleteDebt,
    clearAllDebts,
    recordDebtPayment,
    importDebts,
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
    updateRecurringExpense,
    deleteRecurringExpense,
    addCategory,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    saveTransfer,
    deleteTransfer,
    confirmStatementAlias,
    rejectStatementAlias,
    deleteStatementAlias,
    importData,
    clearAllData,
  }
}
