import { useEffect, useMemo, useState } from 'react'
import MonthSelector from './components/MonthSelector.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import IncomeForm from './components/IncomeForm.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Review from './pages/Review.jsx'
import Settings from './pages/Settings.jsx'
import AuthForm from './components/AuthForm.jsx'
import { monthSummary } from './utils/calculations.js'
import { createId, currentMonthKey, isValidDate } from './utils/formatting.js'
import { emptyData, loadData, saveData } from './utils/storage.js'
import { isSupabaseConfigured, supabase } from './utils/supabase.js'
import { buildDemoData } from './utils/demo.js'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'History' },
  { id: 'review', label: 'Monthly Review' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [data, setData] = useState(() => emptyData())
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [ready, setReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState('checking')
  const [month, setMonth] = useState(() => currentMonthKey())
  const [page, setPage] = useState('dashboard')
  const [expenseForm, setExpenseForm] = useState(null)
  const [incomeForm, setIncomeForm] = useState(false)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthUser({ id: 'local-user' })
      setAuthReady(true)
      return undefined
    }

    let active = true
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return
      const user = sessionData.session?.user
      if (user?.is_anonymous) {
        supabase.auth.signOut()
        setAuthUser(null)
      } else {
        setAuthUser(user || null)
      }
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setAuthUser(session?.user?.is_anonymous ? null : session?.user || null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady || !authUser) return undefined
    let active = true
    setReady(false)
    loadData().then((loadedData) => {
      if (!active) return
      setData(loadedData)
      setReady(true)
      setSyncStatus(isSupabaseConfigured ? 'cloud' : 'local')
    })
    return () => {
      active = false
    }
  }, [authReady, authUser])

  useEffect(() => {
    if (!ready) return
    setSyncStatus('saving')
    saveData(data).then((result) => {
      setSyncStatus(result.remoteSaved ? 'cloud' : 'local')
    })
  }, [data, ready])

  const summary = useMemo(() => monthSummary(data, month), [data, month])

  if (!authReady) {
    return <div className="loading-state">Checking your account...</div>
  }

  if (isSupabaseConfigured && !authUser) {
    return <AuthForm onAuthenticated={setAuthUser} />
  }

  if (passwordRecovery) {
    return <AuthForm recovery onAuthenticated={() => setPasswordRecovery(false)} />
  }

  if (!ready) {
    return <div className="loading-state">Loading your tracker...</div>
  }

  function upsertExpense(fields, existing) {
    if (!isValidDate(fields.date)) return
    setData((current) => {
      if (existing) {
        return {
          ...current,
          expenses: current.expenses.map((expense) =>
            expense.id === existing.id ? { ...expense, ...fields } : expense,
          ),
        }
      }
      return {
        ...current,
        expenses: [{ id: createId(), ...fields }, ...current.expenses],
      }
    })
    setExpenseForm(null)
    if (!existing) setPage('dashboard')
  }

  function saveIncome(amount) {
    setData((current) => ({
      ...current,
      income: { ...current.income, [month]: amount },
    }))
    setIncomeForm(false)
  }

  function deleteIncome() {
    setData((current) => {
      const next = { ...current.income }
      delete next[month]
      return { ...current, income: next }
    })
    setConfirm(null)
  }

  function deleteExpense(expense) {
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.id !== expense.id),
    }))
    setConfirm(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span>Khaata</span>
          <small>
            Personal spending ·{' '}
            <span className={`sync-status sync-${syncStatus}`}>
              {syncStatus === 'cloud'
                ? 'Saved to cloud'
                : syncStatus === 'saving'
                  ? 'Saving...'
                  : syncStatus === 'checking'
                    ? 'Checking sync...'
                    : 'Saved on this device'}
            </span>
          </small>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
        <button type="button" className="btn btn-primary add-desktop" onClick={() => setExpenseForm({})}>
          + Add Expense
        </button>
      </header>

      <nav className="tabs" aria-label="Main">
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? 'active' : ''}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {page === 'dashboard' ? (
          <Dashboard
            summary={summary}
            onAddExpense={() => setExpenseForm({})}
            onEditExpense={(expense) => setExpenseForm({ expense })}
            onDeleteExpense={(expense) =>
              setConfirm({
                title: 'Delete expense?',
                message: `${expense.category}${expense.note ? ` (${expense.note})` : ''} will be removed.`,
                confirmLabel: 'Delete',
                onConfirm: () => deleteExpense(expense),
              })
            }
            onAddIncome={() => setIncomeForm(true)}
            onEditIncome={() => setIncomeForm(true)}
            onDeleteIncome={() =>
              setConfirm({
                title: 'Delete income?',
                message: `Income for this month will be removed.`,
                confirmLabel: 'Delete',
                onConfirm: deleteIncome,
              })
            }
          />
        ) : null}
        {page === 'history' ? (
          <History
            data={data}
            month={month}
            onEditExpense={(expense) => setExpenseForm({ expense })}
            onDeleteExpense={(expense) =>
              setConfirm({
                title: 'Delete expense?',
                message: `${expense.category}${expense.note ? ` (${expense.note})` : ''} will be removed.`,
                confirmLabel: 'Delete',
                onConfirm: () => deleteExpense(expense),
              })
            }
          />
        ) : null}
        {page === 'review' ? <Review summary={summary} /> : null}
        {page === 'settings' ? (
          <Settings
            data={data}
            accountEmail={isSupabaseConfigured ? authUser.email : null}
            onSignOut={() => supabase.auth.signOut()}
            onImport={(next) => setData(next)}
            onClear={() =>
              setConfirm({
                title: 'Delete everything?',
                message:
                  'This will permanently delete all your income and expense data.',
                confirmLabel: 'Delete Everything',
                onConfirm: () => {
                  setData(emptyData())
                  setConfirm(null)
                },
              })
            }
            onLoadDemo={() =>
              setConfirm({
                title: 'Load demo data?',
                message: 'This replaces your current income and expenses with a sample month.',
                confirmLabel: 'Load demo',
                danger: false,
                onConfirm: () => {
                  setData(buildDemoData(month))
                  setPage('dashboard')
                  setConfirm(null)
                },
              })
            }
            onAddCategory={(name) =>
              setData((current) => ({
                ...current,
                categories: [...current.categories, name],
              }))
            }
          />
        ) : null}
      </main>

      <button type="button" className="fab" onClick={() => setExpenseForm({})}>
        + Add Expense
      </button>

      {expenseForm ? (
        <ExpenseForm
          categories={
            expenseForm.expense &&
            !data.categories.includes(expenseForm.expense.category)
              ? [expenseForm.expense.category, ...data.categories]
              : data.categories
          }
          initial={expenseForm.expense}
          onCancel={() => setExpenseForm(null)}
          onSave={(fields) => upsertExpense(fields, expenseForm.expense)}
        />
      ) : null}

      {incomeForm ? (
        <IncomeForm
          month={month}
          initialAmount={summary.income}
          onCancel={() => setIncomeForm(false)}
          onSave={saveIncome}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger !== false}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      ) : null}
    </div>
  )
}
