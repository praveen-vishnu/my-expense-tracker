import { useState, useMemo, useCallback } from 'react'
import MonthSelector from './components/MonthSelector.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import IncomeForm from './components/IncomeForm.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import StatementImportModal from './components/StatementImportModal.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Review from './pages/Review.jsx'
import Settings from './pages/Settings.jsx'
import AuthForm from './components/AuthForm.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import { monthSummary, calculateAccountBalances } from './utils/calculations.js'
import { currentMonthKey, formatINR, relativeDateLabel, shiftMonth } from './utils/formatting.js'
import { isSupabaseConfigured } from './utils/supabase.js'
import { useTheme } from './hooks/useTheme.js'
import { useAuth } from './hooks/useAuth.js'
import { useTrackerData } from './hooks/useTrackerData.js'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'History' },
  { id: 'review', label: 'Monthly Review' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { authReady, authUser, setAuthUser, passwordRecovery, setPasswordRecovery, signOut } = useAuth()
  const [month, setMonth] = useState(() => currentMonthKey())
  const [page, setPage] = useState('dashboard')
  const [expenseForm, setExpenseForm] = useState(null)
  const [incomeForm, setIncomeForm] = useState(false)
  const [statementModal, setStatementModal] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const {
    data,
    ready,
    syncStatus,
    upsertExpense,
    deleteExpense,
    importBatchExpenses,
    saveIncome,
    deleteIncome,
    saveBudget,
    addRecurringExpense,
    deleteRecurringExpense,
    addCategory,
    addAccount,
    deleteAccount,
    setDefaultAccount,
    importData,
    clearAllData,
  } = useTrackerData(authReady, authUser, month)

  const summary = useMemo(() => monthSummary(data, month), [data, month])
  const prevMonth = useMemo(() => shiftMonth(month, -1), [month])
  const previousSummary = useMemo(() => monthSummary(data, prevMonth), [data, prevMonth])
  const accountBalances = useMemo(
    () => calculateAccountBalances(data.accounts, data.expenses),
    [data.accounts, data.expenses]
  )

  const handleOpenAddExpense = useCallback(() => {
    setExpenseForm({})
  }, [])

  const handleOpenEditExpense = useCallback((expense) => {
    setExpenseForm({ expense })
  }, [])

  const handlePromptDeleteExpense = useCallback((expense) => {
    setConfirm({
      title: 'Delete expense?',
      message: `${expense.category}${expense.note ? ` (${expense.note})` : ''} expense for ${formatINR(expense.amount)} from ${relativeDateLabel(expense.date)} will be removed.`,
      confirmLabel: 'Delete expense',
      onConfirm: () => {
        deleteExpense(expense.id)
        setConfirm(null)
      },
    })
  }, [deleteExpense])

  const handleOpenAddIncome = useCallback(() => {
    setIncomeForm(true)
  }, [])

  const handlePromptDeleteIncome = useCallback(() => {
    setConfirm({
      title: 'Delete income?',
      message: 'Income for this month will be removed.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteIncome(month)
        setConfirm(null)
      },
    })
  }, [deleteIncome, month])

  const handlePromptDeleteRecurring = useCallback((schedule) => {
    setConfirm({
      title: 'Remove recurring schedule?',
      message: `${schedule.name} will no longer be generated in future months. Existing expenses will remain.`,
      confirmLabel: 'Remove schedule',
      onConfirm: () => {
        deleteRecurringExpense(schedule.id)
        setConfirm(null)
      },
    })
  }, [deleteRecurringExpense])

  const handlePromptDeleteAccount = useCallback((account) => {
    setConfirm({
      title: 'Delete account?',
      message: `Delete ${account.name}? Past expenses associated with this account will remain as unassigned.`,
      confirmLabel: 'Delete account',
      onConfirm: () => {
        deleteAccount(account.id)
        setConfirm(null)
      },
    })
  }, [deleteAccount])

  const handlePromptClearAll = useCallback(() => {
    setConfirm({
      title: 'Delete everything?',
      message: 'This will permanently delete all your income and expense data.',
      confirmLabel: 'Delete Everything',
      onConfirm: () => {
        clearAllData()
        setConfirm(null)
      },
    })
  }, [clearAllData])

  const handleSaveExpense = useCallback((fields) => {
    upsertExpense(fields, expenseForm?.expense?.id)
    setExpenseForm(null)
    if (!expenseForm?.expense) {
      setPage('dashboard')
    }
  }, [expenseForm, upsertExpense])

  const handleSaveIncome = useCallback((amount) => {
    saveIncome(month, amount)
    setIncomeForm(false)
  }, [month, saveIncome])

  const handleSaveBudget = useCallback((amount) => {
    saveBudget(month, amount)
  }, [month, saveBudget])

  if (!authReady) {
    return <div className="loading-state" role="status" aria-live="polite">Checking your account...</div>
  }

  if (isSupabaseConfigured && !authUser) {
    return (
      <AuthForm
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={setAuthUser}
      />
    )
  }

  if (passwordRecovery) {
    return (
      <AuthForm
        recovery
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={() => setPasswordRecovery(false)}
      />
    )
  }

  if (!ready) {
    return <div className="loading-state" role="status" aria-live="polite">Loading your tracker...</div>
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="brand">
          <span>Khaata</span>
          <small>
            Personal spending ·{' '}
            <span className={`sync-status sync-${syncStatus}`} role="status" aria-live="polite" aria-atomic="true">
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
        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            className="btn btn-secondary import-desktop-btn"
            onClick={() => setStatementModal(true)}
            title="Import bank statement (CSV)"
          >
            Import CSV
          </button>
          <button type="button" className="btn btn-primary add-desktop" onClick={handleOpenAddExpense}>
            + Add Expense
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main">
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? 'active' : ''}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main id="main-content" tabIndex="-1">
        {page === 'dashboard' ? (
          <Dashboard
            summary={summary}
            accountBalances={accountBalances}
            onAddExpense={handleOpenAddExpense}
            onEditExpense={handleOpenEditExpense}
            onDeleteExpense={handlePromptDeleteExpense}
            onAddIncome={handleOpenAddIncome}
            onEditIncome={handleOpenAddIncome}
            onDeleteIncome={handlePromptDeleteIncome}
          />
        ) : null}

        {page === 'history' ? (
          <History
            data={data}
            month={month}
            onEditExpense={handleOpenEditExpense}
            onDeleteExpense={handlePromptDeleteExpense}
          />
        ) : null}

        {page === 'review' ? (
          <Review summary={summary} previousSummary={previousSummary} month={month} />
        ) : null}

        {page === 'settings' ? (
          <Settings
            data={data}
            month={month}
            budget={summary.budget}
            onSaveBudget={handleSaveBudget}
            accountEmail={isSupabaseConfigured && authUser?.id !== 'local-user' ? authUser.email : null}
            onSignOut={signOut}
            onImport={importData}
            onImportStatement={() => setStatementModal(true)}
            onClear={handlePromptClearAll}
            onAddCategory={addCategory}
            onAddRecurring={addRecurringExpense}
            onDeleteRecurring={handlePromptDeleteRecurring}
            onAddAccount={addAccount}
            onDeleteAccount={handlePromptDeleteAccount}
            onSetDefaultAccount={setDefaultAccount}
          />
        ) : null}
      </main>

      <button type="button" className="fab" onClick={handleOpenAddExpense} aria-label="Add new expense">
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
          accounts={data.accounts || []}
          initial={expenseForm.expense}
          onCancel={() => setExpenseForm(null)}
          onSave={handleSaveExpense}
        />
      ) : null}

      {incomeForm ? (
        <IncomeForm
          month={month}
          initialAmount={summary.income}
          onCancel={() => setIncomeForm(false)}
          onSave={handleSaveIncome}
        />
      ) : null}

      {statementModal ? (
        <StatementImportModal
          categories={data.categories}
          accounts={data.accounts || []}
          existingExpenses={data.expenses}
          onImportBatch={importBatchExpenses}
          onDismiss={() => setStatementModal(false)}
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

