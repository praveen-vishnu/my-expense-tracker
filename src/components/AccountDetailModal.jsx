import { useState, useMemo } from 'react'
import { formatINR, formatMonthLabel, relativeDateLabel } from '../utils/formatting.js'
import { getCreditCardCycleSpend } from '../utils/calculations.js'
import ModalSheet from './ModalSheet.jsx'
import { IconCreditCard, IconBuildingBank, IconCash, IconDeviceMobile, IconArrowsLeftRight, IconReceipt } from '@tabler/icons-react'

export default function AccountDetailModal({
  account,
  allAccounts = [],
  expenses = [],
  transfers = [],
  income = {},
  incomeAccounts = {},
  incomeSources = [],
  activeMonth,
  onOpenTransfer,
  onClose,
}) {
  const isCreditCard = account?.type === 'credit_card'
  const [filterMode, setFilterMode] = useState(isCreditCard && account?.billingDay ? 'cycle' : 'month')

  const cycleData = useMemo(() => {
    if (!isCreditCard || !account?.billingDay) return null
    return getCreditCardCycleSpend(account, expenses)
  }, [isCreditCard, account, expenses])

  // Build ledger of all movements for this account
  const ledgerItems = useMemo(() => {
    if (!account) return []
    const items = []

    // 1. Expenses charged to this account
    for (const exp of expenses) {
      if (exp.accountId === account.id) {
        items.push({
          id: `exp_${exp.id}`,
          type: 'expense',
          date: exp.date,
          monthKey: exp.date.slice(0, 7),
          title: exp.category,
          note: exp.note,
          amount: -exp.amount,
        })
      }
    }

    // 2. Income deposits credited to this account
    if ((incomeSources || []).length > 0) {
      for (const src of incomeSources) {
        if (src.accountId === account.id) {
          items.push({
            id: `source_${src.id}`,
            type: 'income',
            date: src.date,
            monthKey: src.monthKey,
            title: src.name || 'Income Stream',
            note: 'Multi-source deposit',
            amount: src.amount,
          })
        }
      }
    } else {
      for (const [monthKey, accId] of Object.entries(incomeAccounts)) {
        if (accId === account.id && income[monthKey]) {
          items.push({
            id: `inc_${monthKey}`,
            type: 'income',
            date: `${monthKey}-01`,
            monthKey,
            title: 'Monthly Income',
            note: `Credited for ${formatMonthLabel(monthKey)}`,
            amount: income[monthKey],
          })
        }
      }
    }

    // 3. Settled split reimbursements credited to this account
    for (const exp of expenses) {
      if (exp.split?.settled && exp.split.settledAccountId === account.id && exp.split.owedAmount > 0) {
        items.push({
          id: `split_settled_${exp.id}`,
          type: 'reimbursement',
          date: exp.split.settledDate || exp.date,
          monthKey: (exp.split.settledDate || exp.date).slice(0, 7),
          title: `Split Settled (${exp.split.owedBy || 'Friend'})`,
          note: `Reimbursement for ${exp.category}`,
          amount: exp.split.owedAmount,
        })
      }
    }

    // 4. Transfers out
    for (const tr of transfers) {
      if (tr.fromAccountId === account.id) {
        const destAcc = allAccounts.find((a) => a.id === tr.toAccountId)
        items.push({
          id: `tr_out_${tr.id}`,
          type: 'transfer_out',
          date: tr.date,
          monthKey: tr.date.slice(0, 7),
          title: destAcc?.type === 'credit_card' ? `Paid ${destAcc.name} Bill` : `Transfer to ${destAcc?.name || 'Account'}`,
          note: tr.note,
          amount: -tr.amount,
        })
      }
    }

    // 5. Transfers in (or CC bill payments received)
    for (const tr of transfers) {
      if (tr.toAccountId === account.id) {
        const srcAcc = allAccounts.find((a) => a.fromAccountId)
        items.push({
          id: `tr_in_${tr.id}`,
          type: 'transfer_in',
          date: tr.date,
          monthKey: tr.date.slice(0, 7),
          title: account.type === 'credit_card' ? `Bill Payment from ${srcAcc?.name || 'Bank'}` : `Transfer from ${srcAcc?.name || 'Account'}`,
          note: tr.note,
          amount: tr.amount,
        })
      }
    }

    // Sort newest date first
    items.sort((a, b) => b.date.localeCompare(a.date))
    return items
  }, [account, expenses, transfers, income, incomeAccounts, incomeSources, allAccounts])

  const filteredItems = useMemo(() => {
    if (filterMode === 'cycle' && cycleData) {
      return ledgerItems.filter((i) => i.date >= cycleData.cycleStart && i.date <= cycleData.cycleEnd)
    }
    if (filterMode === 'month') {
      return ledgerItems.filter((i) => i.monthKey === activeMonth)
    }
    return ledgerItems
  }, [ledgerItems, filterMode, activeMonth, cycleData])

  if (!account) return null

  return (
    <ModalSheet
      titleId="account-detail-title"
      descriptionId="account-detail-desc"
      onDismiss={onClose}
    >
      <div className="sheet-form account-detail-view">
        <div className="sheet-head">
          <div className="acc-detail-head-info">
            <span className="acc-type-icon-large">
              {account.type === 'credit_card' ? (
                <IconCreditCard size={28} />
              ) : account.type === 'bank' ? (
                <IconBuildingBank size={28} />
              ) : account.type === 'wallet' ? (
                <IconDeviceMobile size={28} />
              ) : (
                <IconCash size={28} />
              )}
            </span>
            <div>
              <div className="acc-title-row">
                <h2 id="account-detail-title">{account.name}</h2>
                {account.isDefault ? <span className="default-pill">Default</span> : null}
              </div>
              <p id="account-detail-desc" className="muted">
                {isCreditCard ? 'Credit Card Account' : account.type === 'bank' ? 'Bank Account' : account.type === 'wallet' ? 'Digital Wallet' : 'Cash Account'}
              </p>
            </div>
          </div>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {/* ACCOUNT HERO STATS */}
        <div className="acc-detail-card">
          <div className="acc-hero-stat">
            <span className="acc-stat-sub">
              {isCreditCard ? 'Total Outstanding Balance' : 'Current Available Balance'}
            </span>
            <strong className={`acc-hero-amount ${isCreditCard ? (account.outstanding > 0 ? 'negative' : 'positive') : (account.currentBalance < 0 ? 'negative' : '')}`}>
              {formatINR(isCreditCard ? account.outstanding : account.currentBalance)}
            </strong>
          </div>

          {isCreditCard ? (
            <div className="acc-metrics-grid">
              <div className="acc-metric-item">
                <span>Credit Limit</span>
                <strong>{account.creditLimit ? formatINR(account.creditLimit) : 'None set'}</strong>
              </div>
              <div className="acc-metric-item">
                <span>Available Limit</span>
                <strong className="positive">{account.availableCredit != null ? formatINR(account.availableCredit) : '—'}</strong>
              </div>
              {account.billingDay ? (
                <div className="acc-metric-item">
                  <span>Billing Cycle</span>
                  <strong>{account.billingDay}th of month</strong>
                </div>
              ) : null}
              {account.dueDay ? (
                <div className="acc-metric-item">
                  <span>Payment Due</span>
                  <strong>
                    {account.dueDay}th {account.dueInfo?.isDueSoon ? <span className="due-warning-pill">{account.dueInfo.label}</span> : null}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="acc-metrics-grid">
              <div className="acc-metric-item">
                <span>Initial Balance</span>
                <strong>{formatINR(account.initialBalance)}</strong>
              </div>
              <div className="acc-metric-item">
                <span>Total Spent</span>
                <strong className="money spent">{formatINR(account.totalSpent)}</strong>
              </div>
            </div>
          )}

          {/* CREDIT UTILIZATION GAUGE */}
          {isCreditCard && account.creditLimit ? (
            <div className="credit-util-section">
              <div className="util-meta">
                <span>Credit Utilization</span>
                <span className={`util-badge util-${account.utilizationStatus}`}>
                  {account.utilizationStatus === 'good'
                    ? `✓ ${Math.round(account.utilizationPercent)}% (Healthy · <30%)`
                    : account.utilizationStatus === 'moderate'
                      ? `▲ ${Math.round(account.utilizationPercent)}% (Moderate)`
                      : `⚠ ${Math.round(account.utilizationPercent)}% (High · Impacts score)`}
                </span>
              </div>
              <div
                className="budget-track"
                role="progressbar"
                aria-label="Credit utilization ratio"
                aria-valuenow={Math.min(Math.round(account.utilizationPercent), 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`budget-fill ${account.utilizationStatus === 'high' ? 'bar-fill-exceeded' : account.utilizationStatus === 'moderate' ? 'bar-fill-warning' : 'bar-fill-on-track'}`}
                  style={{ width: `${Math.min(account.utilizationPercent, 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* STATEMENT CYCLE SPEND BREAKDOWN */}
          {isCreditCard && account.billingDay && cycleData ? (
            <div className="cycle-spend-card">
              <div className="cycle-spend-row">
                <div>
                  <span className="cycle-label">Active Statement Cycle</span>
                  <div className="cycle-dates-text">
                    {cycleData.cycleStart} → {cycleData.cycleEnd}
                  </div>
                </div>
                <div className="cycle-amount-col">
                  <span className="cycle-amount money spent">{formatINR(cycleData.cycleSpend)}</span>
                  <small className="muted">{(cycleData.cycleExpenses?.length ?? cycleData.expenseCount ?? 0)} transaction{(cycleData.cycleExpenses?.length ?? cycleData.expenseCount ?? 0) === 1 ? '' : 's'}</small>
                </div>
              </div>
              <p className="cycle-footnote">
                Transactions charged between statement dates ({account.billingDay}th to {account.billingDay}th).
              </p>
            </div>
          ) : null}

          {/* ACTION BUTTONS */}
          <div className="acc-actions-row">
            {isCreditCard ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  onClose()
                  onOpenTransfer(null, account.id, account.outstanding)
                }}
              >
                <IconCreditCard size={18} />
                <span>Pay Credit Card Bill</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  onClose()
                  onOpenTransfer(account.id, null)
                }}
              >
                <IconArrowsLeftRight size={18} />
                <span>Transfer Money</span>
              </button>
            )}
          </div>
        </div>

        {/* ACTIVITY LEDGER */}
        <div className="acc-ledger-section">
          <div className="ledger-head">
            <h3>Account Activity</h3>
            <div className="ledger-filter-pills" role="tablist">
              {isCreditCard && account.billingDay ? (
                <button
                  type="button"
                  className={`filter-pill ${filterMode === 'cycle' ? 'active' : ''}`}
                  onClick={() => setFilterMode('cycle')}
                >
                  Statement Cycle
                </button>
              ) : null}
              <button
                type="button"
                className={`filter-pill ${filterMode === 'month' ? 'active' : ''}`}
                onClick={() => setFilterMode('month')}
              >
                {formatMonthLabel(activeMonth)}
              </button>
              <button
                type="button"
                className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Time
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="ledger-empty">
              <p className="muted">No transactions found for this period.</p>
            </div>
          ) : (
            <ul className="ledger-list">
              {filteredItems.map((item) => {
                const isPositive = item.amount > 0
                return (
                  <li key={item.id} className="ledger-item">
                    <div className="ledger-info">
                      <div className="ledger-title-line">
                        <strong>{item.title}</strong>
                        <span className="ledger-date">{relativeDateLabel(item.date)}</span>
                      </div>
                      {item.note ? <small className="muted">{item.note}</small> : null}
                    </div>
                    <div className={`ledger-amount ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive ? `+${formatINR(item.amount)}` : `-${formatINR(Math.abs(item.amount))}`}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </ModalSheet>
  )
}

