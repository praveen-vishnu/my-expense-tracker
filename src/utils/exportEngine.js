/**
 * Export and Report Generation Engine
 * Supports standard CSV exports and print-ready financial statement triggers.
 */

/**
 * Escapes a single CSV value according to RFC 4180 standards.
 */
function escapeCSVValue(value) {
  if (value == null) return '""'
  const stringValue = String(value)
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return `"${stringValue}"`
}

/**
 * Formats a list of expenses into an RFC 4180 compliant CSV string.
 *
 * @param {Array<Object>} expenses
 * @param {Array<Object>} accounts
 * @returns {string} CSV string
 */
export function generateExpensesCSV(expenses = [], accounts = []) {
  const accountMap = new Map((accounts || []).map((acc) => [acc.id, acc]))

  const headers = ['Date', 'Category', 'Amount (INR)', 'Account', 'Account Type', 'Note / Merchant', 'Expense ID']

  const rows = (expenses || []).map((exp) => {
    const acc = exp.accountId ? accountMap.get(exp.accountId) : null
    const accName = acc ? acc.name : 'Unassigned'
    const accType = acc ? acc.type : 'N/A'

    return [
      escapeCSVValue(exp.date),
      escapeCSVValue(exp.category),
      escapeCSVValue(Number(exp.amount).toFixed(2)),
      escapeCSVValue(accName),
      escapeCSVValue(accType),
      escapeCSVValue(exp.note || ''),
      escapeCSVValue(exp.id),
    ].join(',')
  })

  return [headers.map(escapeCSVValue).join(','), ...rows].join('\r\n')
}

/**
 * Triggers a client-side file download of CSV text.
 *
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCSV(csvContent, filename = 'khaata-expenses.csv') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
