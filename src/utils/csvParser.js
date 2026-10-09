import { createId, isValidDate, pad2 } from './formatting.js'

/**
 * Intelligent bank statement CSV parser for Indian & International banks.
 * Handles: HDFC, SBI, ICICI, Axis, Kotak, and Standard/Generic CSV formats.
 */

// Keyword-to-category mapping for smart auto-categorization
const CATEGORY_RULES = [
  {
    category: 'Food',
    keywords: [
      'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'grofers',
      'mcdonald', 'kfc', 'starbucks', 'domino', 'pizza', 'subway', 'burger',
      'restaurant', 'cafe', 'baker', 'sweet', 'chai', 'tea', 'dhaba', 'barbeque',
      'haldiram', 'eatfit', 'faasos', 'behrouz'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'ola', 'rapido', 'irctc', 'railway', 'metro', 'makemytrip',
      'indigo', 'air india', 'spicejet', 'vistara', 'fastag', 'toll',
      'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'shell', 'cng', 'auto'
    ]
  },
  {
    category: 'Bills',
    keywords: [
      'electricity', 'bescom', 'tata power', 'cesc', 'bses', 'airtel', 'jio',
      'vodafone', 'vi', 'act fibernet', 'hathway', 'tatasky', 'dth',
      'gas', 'igl', 'mahanagar', 'water', 'broadband', 'utility', 'maintenance'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'zara', 'h&m',
      'dmart', 'reliance retail', 'lifestyle', 'westside', 'decathlon', 'croma',
      'vijay sales', 'ikea', 'lenskart', 'tata cliq', 'uniqlo', 'retail'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'youtube',
      'bookmyshow', 'pvr', 'inox', 'cinepolis', 'gaming', 'steam', 'playstation'
    ]
  },
  {
    category: 'Health',
    keywords: [
      'apollo', 'pharmacy', 'medplus', 'netmeds', '1mg', 'practo', 'hospital',
      'clinic', 'diagnostic', 'dr ', 'lab', 'dental', 'opticals', 'pharma'
    ]
  },
  {
    category: 'EMI',
    keywords: [
      'emi', 'loan', 'bajaj finance', 'hdb financial', 'chola', 'muthoot',
      'home loan', 'car loan', 'personal loan'
    ]
  }
]

/**
 * Clean messy bank transaction narrations (e.g., UPI/428192837/SWIGGY/BANGALORE/PYMNT).
 */
export function cleanNarration(raw) {
  if (!raw) return 'Expense'
  let text = String(raw).trim()

  // Remove common banking prefixes
  text = text.replace(/^(UPI\/[A-Z0-9_-]+\/|POS\s+[0-9]+\s+|NEFT\/[A-Z0-9_-]+\/|IMPS\/[A-Z0-9_-]+\/|ACH\s+D-\s*)/i, '')
  
  // Extract primary merchant tag if slash-separated
  const parts = text.split('/')
  if (parts.length > 1) {
    const candidate = parts.find((p) => p.trim().length > 2 && !/^\d+$/.test(p.trim()))
    if (candidate) text = candidate.trim()
  }

  // Remove trailing bank payment suffixes
  text = text.replace(/(\/PYMNT|\/UPI|\/CR|\/DR|\/PAYMENT|\s+IN|\s+BANGALORE|\s+MUMBAI|\s+DELHI|\s+GURGAON|\s+HYDERABAD).*$/i, '')
  
  // Clean up punctuation and excess spaces
  text = text.replace(/[*_#@]/g, ' ').replace(/\s+/g, ' ').trim()

  // Title case if ALL CAPS
  if (text.length > 3 && text === text.toUpperCase()) {
    text = text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return text.slice(0, 70) || 'Expense'
}

/**
 * Predict category using keywords in description.
 */
export function predictCategory(description, availableCategories = []) {
  const lower = description.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      // Return matching category if available or as default
      const matched = availableCategories.find(
        (c) => c.toLowerCase() === rule.category.toLowerCase()
      )
      return matched || rule.category
    }
  }
  return availableCategories[0] || 'Other'
}

/**
 * Parse various date formats to ISO YYYY-MM-DD.
 */
export function parseDateToISO(raw) {
  if (!raw) return null
  const str = String(raw).trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isValidDate(str) ? str : null
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const iso = `${y}-${pad2(Number(m))}-${pad2(Number(d))}`
    return isValidDate(iso) ? iso : null
  }

  // DD/MM/YY
  const dmyShort = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
  if (dmyShort) {
    const [, d, m, yy] = dmyShort
    const fullYear = 2000 + Number(yy)
    const iso = `${fullYear}-${pad2(Number(m))}-${pad2(Number(d))}`
    return isValidDate(iso) ? iso : null
  }

  // DD Mon YYYY (e.g. 15 Sep 2026 or 15-Sep-2026)
  const textDateMatch = str.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3})[-/\s]+(\d{4})$/)
  if (textDateMatch) {
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    }
    const [, d, mon, y] = textDateMatch
    const monthNum = months[mon.toLowerCase()]
    if (monthNum) {
      const iso = `${y}-${monthNum}-${pad2(Number(d))}`
      return isValidDate(iso) ? iso : null
    }
  }

  // Fallback: standard JS Date
  const parsed = new Date(str)
  if (!Number.isNaN(parsed.getTime())) {
    const iso = `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
    return isValidDate(iso) ? iso : null
  }

  return null
}

/**
 * Parse raw CSV string into an array of lines respecting quoted values.
 */
function parseCSVRows(csvText) {
  const lines = []
  let currentRow = []
  let currentField = ''
  let insideQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        i++ // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !insideQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++ // Skip Windows CRLF
      }
      currentRow.push(currentField.trim())
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow)
    }
  }

  return lines
}

/**
 * Main parser function: takes CSV text and existing expenses to detect duplicates.
 */
export function parseBankStatementCSV(csvContent, options = {}) {
  const { availableCategories = [], existingExpenses = [], defaultAccountId = null } = options
  const rows = parseCSVRows(csvContent)

  if (rows.length < 2) {
    return { ok: false, error: 'The CSV file does not contain enough data rows.' }
  }

  // 1. Locate header row
  let headerIndex = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((c) => c.toLowerCase())
    const hasDate = row.some((c) => c.includes('date') || c === 'txn date' || c === 'date')
    const hasAmountOrDebit = row.some((c) => c.includes('debit') || c.includes('withdrawal') || c.includes('amount') || c.includes('dr'))
    if (hasDate && hasAmountOrDebit) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    return {
      ok: false,
      error: 'Could not detect bank statement headers. Please ensure the CSV includes Date and Debit/Amount columns.',
    }
  }

  const headers = rows[headerIndex].map((h) => h.toLowerCase().trim())
  
  // Find column indices
  const dateCol = headers.findIndex((h) => h.includes('date') || h === 'txn date')
  const narrationCol = headers.findIndex((h) => h.includes('narration') || h.includes('description') || h.includes('particular') || h.includes('remarks') || h.includes('details'))
  const debitCol = headers.findIndex((h) => h.includes('withdrawal') || h.includes('debit') || h === 'dr' || h.includes('dr amt'))
  const amountCol = headers.findIndex((h) => h === 'amount' || h.includes('txn amount') || h.includes('amount (inr)'))

  const candidates = []
  let duplicateCount = 0

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < 2) continue

    const rawDate = row[dateCol]
    const isoDate = parseDateToISO(rawDate)
    if (!isoDate) continue

    const rawNarration = narrationCol !== -1 ? row[narrationCol] : row[1] || ''
    
    // Extract debit amount
    let rawAmount = ''
    if (debitCol !== -1 && row[debitCol]) {
      rawAmount = row[debitCol]
    } else if (amountCol !== -1 && row[amountCol]) {
      rawAmount = row[amountCol]
    }

    const cleanAmountStr = String(rawAmount).replace(/[â‚¹,\s]/g, '')
    const amount = Math.abs(Number(cleanAmountStr))
    if (!Number.isFinite(amount) || amount <= 0) {
      continue // Skip 0 amounts or deposits
    }

    const cleanedNote = cleanNarration(rawNarration)
    const category = predictCategory(rawNarration + ' ' + cleanedNote, availableCategories)

    // Check for duplicate against existing expenses
    const isDuplicate = existingExpenses.some(
      (exp) => exp.date === isoDate && Math.abs(exp.amount - amount) < 0.01 && (
        exp.note.toLowerCase().includes(cleanedNote.toLowerCase()) ||
        cleanedNote.toLowerCase().includes(exp.note.toLowerCase()) ||
        exp.category === category
      )
    )

    if (isDuplicate) duplicateCount++

    candidates.push({
      id: createId(),
      date: isoDate,
      amount,
      note: cleanedNote,
      rawNarration,
      category,
      accountId: defaultAccountId,
      isDuplicate,
      selected: !isDuplicate, // Unchecked by default if duplicate
    })
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'No valid debit transactions could be found in this statement.',
    }
  }

  return {
    ok: true,
    transactions: candidates,
    totalParsed: candidates.length,
    duplicateCount,
  }
}
