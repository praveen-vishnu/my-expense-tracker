import { daysInMonth, monthKeyFromDate, formatINR } from './formatting.js'

export function expensesForMonth(expenses, monthKey) {
  return expenses.filter((expense) => monthKeyFromDate(expense.date) === monthKey)
}

export function incomeForMonth(incomeByMonth, monthKey) {
  const value = incomeByMonth[monthKey]
  return typeof value === 'number' && value > 0 ? value : 0
}

export function sumExpenses(expenses) {
  return expenses.reduce((total, expense) => total + expense.amount, 0)
}

export function remainingBalance(income, spent) {
  return income - spent
}

export function categoryTotals(expenses) {
  const totals = new Map()
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount)
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function averageExpense(total, count) {
  if (!count) return 0
  return total / count
}

export function elapsedDaysInMonth(monthKey, now = new Date()) {
  const [year, month] = monthKey.split('-').map(Number)
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  if (year < nowYear || (year === nowYear && month < nowMonth)) {
    return daysInMonth(monthKey)
  }
  if (year === nowYear && month === nowMonth) {
    return now.getDate()
  }
  return 0
}

export function averageDailySpending(total, elapsedDays) {
  if (!elapsedDays) return 0
  return total / elapsedDays
}

export function groupExpensesByDate(expenses) {
  const groups = new Map()
  for (const expense of expenses) {
    if (!groups.has(expense.date)) groups.set(expense.date, [])
    groups.get(expense.date).push(expense)
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => b.id.localeCompare(a.id)),
    }))
}

export function monthSummary(data, monthKey, now = new Date()) {
  const monthExpenses = expensesForMonth(data.expenses, monthKey)
  const income = incomeForMonth(data.income, monthKey)
  const budget = Number(data.budgets?.[monthKey]) || 0
  const spent = sumExpenses(monthExpenses)
  const count = monthExpenses.length
  const totalDays = daysInMonth(monthKey)
  const elapsedDays = elapsedDaysInMonth(monthKey, now)
  const remainingDays = Math.max(totalDays - elapsedDays, 0)
  const averageDaily = averageDailySpending(spent, elapsedDays)
  const projectedSpend = elapsedDays > 0 ? averageDaily * totalDays : spent
  const budgetRemaining = budget - spent
  const budgetPercent = budget ? (spent / budget) * 100 : 0

  let burnRateStatus = 'on-track'
  let safeDailySpend = 0
  let projectedOverBudget = 0
  let projectedExhaustionDay = null

  if (budget > 0) {
    safeDailySpend = remainingDays > 0 ? Math.max(budgetRemaining / remainingDays, 0) : 0
    projectedOverBudget = projectedSpend > budget ? projectedSpend - budget : 0
    if (averageDaily > 0) {
      projectedExhaustionDay = Math.min(Math.ceil(budget / averageDaily), totalDays)
    }

    if (spent > budget) {
      burnRateStatus = 'exceeded'
    } else if (projectedSpend > budget) {
      burnRateStatus = 'warning'
    } else {
      burnRateStatus = 'on-track'
    }
  }

  return {
    monthKey,
    income,
    budget,
    spent,
    budgetRemaining,
    budgetPercent,
    remaining: remainingBalance(income, spent),
    expenses: monthExpenses,
    count,
    averageExpense: averageExpense(spent, count),
    totalDays,
    elapsedDays,
    remainingDays,
    averageDaily,
    projectedSpend,
    safeDailySpend,
    projectedOverBudget,
    projectedExhaustionDay,
    burnRateStatus,
    categories: categoryTotals(monthExpenses),
  }
}

export function calculateAccountBalances(accounts = [], expenses = []) {
  const spentByAccount = new Map()
  let unassignedSpent = 0

  for (const exp of expenses) {
    if (exp.accountId) {
      spentByAccount.set(exp.accountId, (spentByAccount.get(exp.accountId) || 0) + exp.amount)
    } else {
      unassignedSpent += exp.amount
    }
  }

  let totalLiquid = 0
  let totalCreditOutstanding = 0

  const processed = accounts.map((acc) => {
    const totalSpent = spentByAccount.get(acc.id) || 0
    let currentBalance = 0
    let outstanding = 0
    let availableCredit = null

    if (acc.type === 'credit_card') {
      outstanding = totalSpent
      currentBalance = -outstanding
      totalCreditOutstanding += outstanding
      if (acc.creditLimit != null) {
        availableCredit = Math.max(acc.creditLimit - outstanding, 0)
      }
    } else {
      currentBalance = acc.initialBalance - totalSpent
      totalLiquid += currentBalance
    }

    return {
      ...acc,
      totalSpent,
      currentBalance,
      outstanding,
      availableCredit,
    }
  })

  const netWorth = totalLiquid - totalCreditOutstanding

  return {
    accounts: processed,
    totalLiquid,
    totalCreditOutstanding,
    netWorth,
    unassignedSpent,
  }
}

export function calculateFinancialHealth(currentSummary, previousSummary = null) {
  const income = currentSummary?.income || 0
  const spent = currentSummary?.spent || 0
  const budget = currentSummary?.budget || 0
  const remaining = income - spent
  const savingsRate = income > 0 ? ((income - spent) / income) * 100 : null

  // 1. Month-over-Month (MoM) Spend Delta
  const prevSpent = previousSummary?.spent || 0
  const spendDelta = previousSummary ? spent - prevSpent : null
  const spendDeltaPercent = previousSummary && prevSpent > 0
    ? ((spent - prevSpent) / prevSpent) * 100
    : null

  // 2. Category Drift Analysis
  const currentCategories = new Map((currentSummary?.categories || []).map((c) => [c.category, c.total]))
  const previousCategories = new Map((previousSummary?.categories || []).map((c) => [c.category, c.total]))
  const allCategoryNames = new Set([...currentCategories.keys(), ...previousCategories.keys()])

  const categoryDrift = []
  for (const name of allCategoryNames) {
    const curVal = currentCategories.get(name) || 0
    const prevVal = previousCategories.get(name) || 0
    const diff = curVal - prevVal
    const diffPercent = prevVal > 0 ? (diff / prevVal) * 100 : null
    let direction = 'same'
    if (diff > 0) direction = 'up'
    else if (diff < 0) direction = 'down'

    categoryDrift.push({
      category: name,
      current: curVal,
      previous: prevVal,
      diff,
      diffPercent,
      direction,
    })
  }

  // Sort by highest absolute dollar change
  categoryDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  // 3. Algorithmic Financial Health Score (0 - 100)
  // Component A: Budget Adherence (up to 40 pts)
  let budgetScore = 30
  if (budget > 0) {
    const ratio = spent / budget
    if (ratio <= 0.8) budgetScore = 40
    else if (ratio <= 1.0) budgetScore = 35
    else if (ratio <= 1.1) budgetScore = 20
    else if (ratio <= 1.25) budgetScore = 10
    else budgetScore = 0
  } else if (income > 0) {
    budgetScore = spent <= income ? 32 : 10
  }

  // Component B: Savings Rate (up to 35 pts)
  let savingsScore = 20
  if (savingsRate != null) {
    if (savingsRate >= 30) savingsScore = 35
    else if (savingsRate >= 20) savingsScore = 28
    else if (savingsRate >= 10) savingsScore = 20
    else if (savingsRate > 0) savingsScore = 12
    else savingsScore = 0
  }

  // Component C: Pacing & Burn Rate (up to 15 pts)
  let paceScore = 15
  if (currentSummary?.burnRateStatus === 'warning') paceScore = 8
  else if (currentSummary?.burnRateStatus === 'exceeded') paceScore = 2

  // Component D: Trajectory / MoM (up to 10 pts)
  let trajectoryScore = 8
  if (spendDeltaPercent != null) {
    if (spendDeltaPercent <= 0) trajectoryScore = 10
    else if (spendDeltaPercent <= 15) trajectoryScore = 6
    else trajectoryScore = 2
  }

  const score = Math.min(Math.max(budgetScore + savingsScore + paceScore + trajectoryScore, 0), 100)

  let grade = 'B'
  let gradeLabel = 'Stable'
  let gradeColor = 'blue'

  if (score >= 90) {
    grade = 'A+'
    gradeLabel = 'Exceptional'
    gradeColor = 'emerald'
  } else if (score >= 80) {
    grade = 'A'
    gradeLabel = 'Healthy'
    gradeColor = 'green'
  } else if (score >= 70) {
    grade = 'B'
    gradeLabel = 'Stable'
    gradeColor = 'blue'
  } else if (score >= 60) {
    grade = 'C'
    gradeLabel = 'Fair'
    gradeColor = 'amber'
  } else {
    grade = 'D'
    gradeLabel = 'At Risk'
    gradeColor = 'rose'
  }

  // 4. Dynamic Actionable Insights
  const insights = []

  if (savingsRate != null) {
    if (savingsRate >= 20) {
      insights.push({
        type: 'positive',
        text: `Strong savings rate of ${Math.round(savingsRate)}% (${formatINR(remaining)} retained), well above the 20% benchmark.`,
      })
    } else if (savingsRate > 0) {
      insights.push({
        type: 'neutral',
        text: `Positive cashflow with ${Math.round(savingsRate)}% saved (${formatINR(remaining)}). Aim for 20% to build your emergency buffer.`,
      })
    } else {
      insights.push({
        type: 'negative',
        text: `Spending exceeded monthly income by ${formatINR(Math.abs(remaining))}. Look for immediate expenses to trim.`,
      })
    }
  }

  if (budget > 0) {
    if (spent > budget) {
      insights.push({
        type: 'negative',
        text: `You have breached your monthly budget by ${formatINR(spent - budget)}.`,
      })
    } else if (currentSummary?.burnRateStatus === 'warning') {
      insights.push({
        type: 'warning',
        text: `Spending burn rate is pacing above budget. Safe daily spend is ${formatINR(currentSummary?.safeDailySpend)}/day.`,
      })
    } else {
      insights.push({
        type: 'positive',
        text: `On track! You have ${formatINR(currentSummary?.budgetRemaining)} buffer left within budget.`,
      })
    }
  }

  // Check biggest category increase
  const biggestIncrease = categoryDrift.find((c) => c.direction === 'up' && c.diff > 0)
  if (biggestIncrease && previousSummary && prevSpent > 0) {
    const pct = biggestIncrease.diffPercent != null ? ` (+${Math.round(biggestIncrease.diffPercent)}%)` : ''
    insights.push({
      type: 'warning',
      text: `${biggestIncrease.category} spending grew by ${formatINR(biggestIncrease.diff)}${pct} compared to last month.`,
    })
  }

  // Check biggest category reduction
  const biggestSaving = categoryDrift.find((c) => c.direction === 'down' && c.diff < 0)
  if (biggestSaving && previousSummary && prevSpent > 0) {
    const pct = biggestSaving.diffPercent != null ? ` (${Math.round(biggestSaving.diffPercent)}%)` : ''
    insights.push({
      type: 'positive',
      text: `Saved ${formatINR(Math.abs(biggestSaving.diff))}${pct} in ${biggestSaving.category} compared to last month.`,
    })
  }

  return {
    score,
    grade,
    gradeLabel,
    gradeColor,
    savingsRate,
    spendDelta,
    spendDeltaPercent,
    categoryDrift,
    insights,
  }
}
