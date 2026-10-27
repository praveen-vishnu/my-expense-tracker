import { useState, useMemo, useCallback } from 'react'
import MonthSelector from './components/MonthSelector.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import IncomeForm from './components/IncomeForm.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import StatementImportModal from './components/StatementImportModal.jsx'
import CategoryBudgetModal from './components/CategoryBudgetModal.jsx'
import ReceiptScannerModal from './components/ReceiptScannerModal.jsx'
import TransferModal from './components/TransferModal.jsx'
import AccountDetailModal from './components/AccountDetailModal.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Review from './pages/Review.jsx'
import Settings from './pages/Settings.jsx'
import AuthForm from './components/AuthForm.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import { IconCamera, IconFileSpreadsheet, IconPlus } from '@tabler/icons-react'
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
  const [categoryBudgetModal, setCategoryBudgetModal] = useState(false)
  const [scanReceiptModal, setScanReceiptModal] = useState(false)
  const [selectedAccountDetail, setSelectedAccountDetail] = useState(null)
  const [transferModal, setTransferModal] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const {
    data,
    ready,
    syncStatus,
    syncInfo,
    retrySync,
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
    copyCategoryBudgets,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    addCategory,
    addAccount,
    deleteAccount,
    setDefaultAccount,
    saveTransfer,
    deleteTransfer,
    confirmStatementAlias,
    rejectStatementAlias,
    importData,
    clearAllData,
  } = useTrackerData(authReady, authUser, month)

  const summary = useMemo(() => monthSummary(data, month), [data, month])
  const prevMonth = useMemo(() => shiftMonth(month, -1), [month])
  const previousSummary = useMemo(() => monthSummary(data, prevMonth), [data, prevMonth])
  const accountBalances = useMemo(
    () => calculateAccountBalances(data.accounts, data.expenses, data.transfers, data.income, data.incomeAccounts, data.incomeSources),
    [data.accounts, data.expenses, data.transfers, data.income, data.incomeAccounts, data.incomeSources]
  )
  const categoryTotalsMap = useMemo(() => {
    const map = {}
    for (const c of summary.categories || []) map[c.category] = c.total
    return map
  }, [summary.categories])

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

  const handleSaveExpense = useCallback((fields, updateScheduleToo) => {
    const existingId = expenseForm?.expense?.id
    upsertExpense(fields, existingId)

    if (updateScheduleToo && existingId) {
      const schedule = (data.recurringExpenses || []).find(
        (r) =>
          r.id === expenseForm.expense.recurringId ||
          existingId === `recurring_${r.id}_${month}` ||
          existingId.startsWith(`recurring_${r.id}_`)
      )
      if (schedule && updateRecurringExpense) {
        const day = Number(fields.date?.split('-')?.[2]) || schedule.day
        updateRecurringExpense({
          ...schedule,
          name: fields.note || schedule.name,
          amount: fields.amount,
          category: fields.category,
          note: fields.note || schedule.note,
          day,
          accountId: fields.accountId || null,
        })
      }
    }

    setExpenseForm(null)
    if (!expenseForm?.expense) {
      setPage('dashboard')
    }
  }, [expenseForm, upsertExpense, data.recurringExpenses, month, updateRecurringExpense])

  const handleSaveIncome = useCallback((amount, accountId) => {
    saveIncome(month, amount, accountId)
    setIncomeForm(false)
  }, [month, saveIncome])

  const handleSaveBudget = useCallback((amount) => {
    saveBudget(month, amount)
  }, [month, saveBudget])

  if (!authReady) {
    return <div className="loading-state" role="status" aria-live="polite">Checking your account...</div>
  }

  if (passwordRecovery) {
    return (
      <AuthForm
        recovery
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={() => {
          setPasswordRecovery(false)
          // Clean recovery hash from URL if present
          if (typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
        }}
      />
    )
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

  if (!ready) {
    return <div className="loading-state" role="status" aria-live="polite">Loading your tracker...</div>
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="brand">
          <span>PennyWise</span>
          <small>
            Personal spending ·{' '}
            <span
              className={`sync-status sync-${syncStatus}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              onClick={() => {
                if (syncStatus === 'error' && syncInfo?.errorMessage) {
                  alert(`Sync Error: ${syncInfo.errorMessage}`)
                }
              }}
              style={syncStatus === 'error' ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
              title={syncStatus === 'error' ? (syncInfo?.errorMessage || 'Tap to see error') : undefined}
            >
              {syncStatus === 'cloud' || syncStatus === 'synced'
                ? 'Saved to cloud'
                : syncStatus === 'saving' || syncStatus === 'syncing'
                  ? 'Syncing...'
                  : syncStatus === 'pending'
                    ? `Pending sync (${syncInfo?.pendingCount || 0})`
                    : syncStatus === 'error'
                      ? (syncInfo?.errorMessage ? `Sync failed: ${syncInfo.errorMessage.slice(0, 32)}...` : 'Sync failed')
                      : syncStatus === 'checking'
                        ? 'Checking sync...'
                        : 'Saved on this device'}
            </span>
            {syncStatus === 'error' && (
              <button
                type="button"
                className="sync-retry-btn"
                onClick={retrySync}
                title={syncInfo?.errorMessage || 'Retry sync'}
              >
                Retry
              </button>
            )}
          </small>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {/* <button
            type="button"
            className="btn btn-secondary topbar-btn"
            onClick={() => setScanReceiptModal(true)}
            title="Scan receipt or UPI screenshot"
            aria-label="Scan receipt or UPI screenshot"
          >
            <IconCamera size={16} />
            <span className="btn-label-desktop">Scan</span>
          </button> */}
          <button
            type="button"
            className="btn btn-secondary topbar-btn"
            onClick={() => setStatementModal(true)}
            title="Import bank statement (CSV)"
            aria-label="Import CSV statement"
          >
            <IconFileSpreadsheet size={16} />
            <span className="btn-label-desktop">Import</span>
          </button>
          <button
            type="button"
            className="btn btn-primary add-desktop"
            onClick={handleOpenAddExpense}
            title="Add a new expense"
          >
            <IconPlus size={16} />
            <span>Add</span>
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
            expenses={data.expenses}
            recurringExpenses={data.recurringExpenses}
            onSettleSplit={settleSplitExpense}
            onAddExpense={handleOpenAddExpense}
            onEditExpense={handleOpenEditExpense}
            onDeleteExpense={handlePromptDeleteExpense}
            onAddIncome={handleOpenAddIncome}
            onEditIncome={handleOpenAddIncome}
            onDeleteIncome={handlePromptDeleteIncome}
            onOpenCategoryBudgets={() => setCategoryBudgetModal(true)}
            onOpenAccountDetail={(acc) => setSelectedAccountDetail(acc)}
            onOpenTransfer={(fromId, toId, amt) =>
              setTransferModal({
                fromAccountId: fromId || '',
                toAccountId: toId || '',
                amount: amt || '',
              })
            }
          />
        ) : null}

        {page === 'history' ? (
          <History
            data={data}
            month={month}
            onEditExpense={handleOpenEditExpense}
            onDeleteExpense={handlePromptDeleteExpense}
            onDeleteBatchExpenses={deleteBatchExpenses}
            onUpdateBatchExpenses={updateBatchExpenses}
            setConfirm={setConfirm}
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
            onOpenCategoryBudgets={() => setCategoryBudgetModal(true)}
            accountEmail={isSupabaseConfigured && authUser?.id !== 'local-user' ? authUser.email : null}
            onSignOut={signOut}
            onImport={importData}
            onImportStatement={() => setStatementModal(true)}
            onClear={handlePromptClearAll}
            onAddCategory={addCategory}
            onAddRecurring={addRecurringExpense}
            onUpdateRecurring={updateRecurringExpense}
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
          recurringSchedule={
            expenseForm.expense
              ? (data.recurringExpenses || []).find(
                  (r) =>
                    r.id === expenseForm.expense.recurringId ||
                    expenseForm.expense.id === `recurring_${r.id}_${month}` ||
                    expenseForm.expense.id.startsWith(`recurring_${r.id}_`)
                ) || null
              : null
          }
          onCancel={() => setExpenseForm(null)}
          onSave={handleSaveExpense}
        />
      ) : null}

      {incomeForm ? (
        <IncomeForm
          month={month}
          initialAmount={summary.income}
          accounts={data.accounts || []}
          initialAccountId={data.incomeAccounts?.[month]}
          incomeSources={data.incomeSources || []}
          onAddIncomeSource={addIncomeSource}
          onDeleteIncomeSource={deleteIncomeSource}
          onSaveFlatIncome={handleSaveIncome}
          onCancel={() => setIncomeForm(false)}
        />
      ) : null}

      {selectedAccountDetail ? (
        <AccountDetailModal
          account={accountBalances.accounts.find((a) => a.id === selectedAccountDetail.id) || selectedAccountDetail}
          allAccounts={data.accounts || []}
          expenses={data.expenses}
          transfers={data.transfers || []}
          income={data.income}
          incomeAccounts={data.incomeAccounts || {}}
          incomeSources={data.incomeSources || []}
          activeMonth={month}
          onOpenTransfer={(fromId, toId, amt) => {
            setTransferModal({
              fromAccountId: fromId || '',
              toAccountId: toId || '',
              amount: amt || '',
            })
          }}
          onClose={() => setSelectedAccountDetail(null)}
        />
      ) : null}

      {transferModal ? (
        <TransferModal
          accounts={data.accounts || []}
          accountBalances={accountBalances}
          initialFromAccountId={transferModal.fromAccountId}
          initialToAccountId={transferModal.toAccountId}
          initialAmount={transferModal.amount}
          onSaveTransfer={(transfer) => {
            saveTransfer(transfer)
            setTransferModal(null)
          }}
          onCancel={() => setTransferModal(null)}
        />
      ) : null}

      {statementModal ? (
        <StatementImportModal
          categories={data.categories}
          accounts={data.accounts || []}
          existingExpenses={data.expenses}
          aliases={data.statementAliases || []}
          onConfirmAlias={confirmStatementAlias}
          onRejectAlias={rejectStatementAlias}
          onImportBatch={(imported, replacedIds) => {
            if (replacedIds?.length) {
              deleteBatchExpenses(replacedIds)
            }
            importBatchExpenses(imported)
          }}
          onDismiss={() => setStatementModal(false)}
        />
      ) : null}

      {scanReceiptModal ? (
        <ReceiptScannerModal
          categories={data.categories}
          accounts={data.accounts || []}
          onExpenseExtracted={(expense) => {
            upsertExpense({
              ...expense,
              id: createId(),
            })
          }}
          onDismiss={() => setScanReceiptModal(false)}
        />
      ) : null}

      {categoryBudgetModal ? (
        <CategoryBudgetModal
          categories={data.categories}
          month={month}
          currentBudgets={data.categoryBudgets?.[month] || {}}
          previousBudgets={data.categoryBudgets?.[prevMonth] || {}}
          previousMonthKey={prevMonth}
          categoryTotalsMap={categoryTotalsMap}
          onSaveCategoryBudget={saveCategoryBudget}
          onCopyCategoryBudgets={copyCategoryBudgets}
          onDismiss={() => setCategoryBudgetModal(false)}
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

