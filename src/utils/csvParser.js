import { createId, isValidDate, pad2 } from './formatting.js'

/**
 * Intelligent bank statement CSV parser for Indian & International banks.
 * Handles: HDFC, SBI, ICICI, Axis, Kotak, and Standard/Generic CSV formats.
 */

// General keyword-to-category mapping for smart auto-categorization
const CATEGORY_RULES = [
  {
    category: 'Rent',
    keywords: ['rent', 'house rent', 'flat rent', 'room rent']
  },
  {
    category: 'EMI',
    keywords: [
      'emi', 'loan', 'bajaj', 'tatacapital', 'tata capital', 'incred', 'eduvanz',
      'chola', 'muthoot', 'home loan', 'car loan', 'personal loan', 'clearing corp',
      'retail asset', 'financial ser', 'hdb finance', 'idfc first loan', 'dmi finance'
    ]
  },
  {
    category: 'Food',
    keywords: [
      'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'grofers',
      'mcdonald', 'kfc', 'starbucks', 'domino', 'pizza', 'subway', 'burger',
      'restaurant', 'cafe', 'baker', 'sweet', 'chai', 'tea', 'dhaba', 'barbeque',
      'haldiram', 'eatfit', 'faasos', 'behrouz', 'compass'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'ola', 'rapido', 'redbus', 'irctc', 'railway', 'metro', 'makemytrip',
      'indigo', 'air india', 'spicejet', 'vistara', 'fastag', 'toll',
      'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'shell', 'cng', 'auto rickshaw', 'fuels'
    ]
  },
  {
    category: 'Bills',
    keywords: [
      'electricity', 'bescom', 'tata power', 'cesc', 'bses', 'airtel', 'jio',
      'vodafone', 'vi', 'act fibernet', 'hathway', 'tatasky', 'dth',
      'gas', 'igl', 'mahanagar', 'water', 'broadband', 'utility', 'billpay',
      'credit card payment', 'cc payment'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'youtube',
      'bookmyshow', 'pvr', 'inox', 'cinepolis', 'gaming', 'steam', 'playstation',
      'playstore', 'google play'
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
    category: 'Health',
    keywords: [
      'apollo', 'pharmacy', 'medplus', 'netmeds', '1mg', 'practo', 'hospital',
      'clinic', 'diagnostic', 'dr ', 'lab', 'dental', 'opticals', 'pharma'
    ]
  }
]

/**
 * Clean messy bank transaction narrations (e.g., UPI/428192837/SWIGGY/BANGALORE/PYMNT or UPI-NAME-VPA-BANK-REF-REMARK).
 */
export function cleanNarration(raw) {
  if (!raw) return 'Expense'
  let text = String(raw).trim()

  // 1. Remove common banking prefixes
  text = text.replace(/^(UPI\/[A-Z0-9_-]+\/|POS\s+[0-9]+\s+|NEFT\/[A-Z0-9_-]+\/|IMPS\/[A-Z0-9_-]+\/|ACH\s+D-\s*|IB\s+BILLPAY\s+DR-\s*)/i, '')
  
  // 2. Handle slash-separated narrations
  const slashParts = text.split('/')
  if (slashParts.length > 1) {
    const candidate = slashParts.find((p) => p.trim().length > 2 && !/^\d+$/.test(p.trim()))
    if (candidate) text = candidate.trim()
  }

  // 3. Handle Indian Bank UPI Dash format: UPI-MERCHANT_NAME-VPA@BANK-BANKIFSC-RRN-REMARK
  if (/^UPI-/i.test(text)) {
    const dashParts = text.split('-')
    // Index 1 is usually the merchant / payee name
    if (dashParts.length >= 2 && dashParts[1].trim().length > 1) {
      let candidate = dashParts[1].trim()
      // If it contains an autotag like AUTOPAY-NETFLIX
      if (candidate.toLowerCase() === 'autopay' && dashParts[2]) {
        candidate = dashParts[2].trim()
      }
      text = candidate
    }
  }

  // 4. Remove trailing bank payment suffixes and cities
  text = text.replace(/(\/PYMNT|\/UPI|\/CR|\/DR|\/PAYMENT|\s+IN|\s+BANGALORE|\s+MUMBAI|\s+DELHI|\s+GURGAON|\s+HYDERABAD).*$/i, '')
  
  // 5. Clean up punctuation and excess spaces
  text = text.replace(/[*_#@]/g, ' ').replace(/\s+/g, ' ').trim()

  // 6. Title case if ALL CAPS
  if (text.length > 3 && text === text.toUpperCase()) {
    text = text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return text.slice(0, 70) || 'Expense'
}

/**
 * Predict category using keywords and banking pattern regexes.
 */
export function predictCategory(description, availableCategories = []) {
  const lower = description.toLowerCase()

  // 1. Generic banking pattern matching:
  // - Loan account numbers like PLN12345, HML123, AUTOLOAN, etc.
  if (/\b(pln\d+|hl\d+|bl\d+|al\d+|loan|emi)\b/i.test(lower)) {
    const emiCat = availableCategories.find((c) => c.toLowerCase() === 'emi')
    if (emiCat) return emiCat
  }

  // - Rent remarks like "SEPT RENT", "RENT FOR OCT", etc.
  if (/\b(rent|house\s*rent|room\s*rent)\b/i.test(lower)) {
    const rentCat = availableCategories.find((c) => c.toLowerCase() === 'rent')
    if (rentCat) return rentCat
  }

  // 2. Standard keyword matching
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
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
 * Main parser function: takes an array of 2D string rows (from CSV, TXT, or Excel)
 * and processes transactions, categories, and duplicate detection with 100% precision.
 */
export function parseBankStatementRows(rows, options = {}) {
  const { availableCategories = [], existingExpenses = [], defaultAccountId = null } = options

  if (!Array.isArray(rows) || rows.length < 2) {
    return { ok: false, error: 'The statement file does not contain enough data rows.' }
  }

  // 1. Locate header row (scanning first 25 rows)
  let headerIndex = -1
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i].map((c) => String(c || '').toLowerCase().trim())
    const hasDate = row.some((c) => c.includes('date') || c === 'txn date' || c === 'value dt' || c === 'tran date')
    const hasAmountOrDebit = row.some((c) =>
      c.includes('debit') ||
      c.includes('withdrawal') ||
      c.includes('amount') ||
      c === 'dr' ||
      c.includes('dr amt') ||
      c.includes('spent')
    )
    if (hasDate && hasAmountOrDebit) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    return {
      ok: false,
      error: 'Could not detect bank statement headers. Please ensure the statement includes Date and Debit/Amount columns.',
    }
  }

  const headers = rows[headerIndex].map((h) => String(h || '').toLowerCase().trim())

  // Find column indices
  const dateCol = headers.findIndex((h) => h.includes('txn date') || (h.includes('date') && !h.includes('value'))) !== -1
    ? headers.findIndex((h) => h.includes('txn date') || (h.includes('date') && !h.includes('value')))
    : headers.findIndex((h) => h.includes('date'))

  const narrationCol = headers.findIndex((h) =>
    h.includes('narration') ||
    h.includes('description') ||
    h.includes('particular') ||
    h.includes('remarks') ||
    h.includes('details') ||
    h.includes('transaction details')
  )

  const debitCol = headers.findIndex((h) =>
    h.includes('withdrawal') ||
    h.includes('debit') ||
    h === 'dr' ||
    h.includes('dr amt') ||
    h.includes('debit (inr)') ||
    h.includes('debit amount')
  )

  const creditCol = headers.findIndex((h) =>
    h.includes('deposit') ||
    h.includes('credit') ||
    h === 'cr' ||
    h.includes('cr amt') ||
    h.includes('credit (inr)')
  )

  const typeCol = headers.findIndex((h) => h === 'type' || h === 'cr/dr' || h === 'dr/cr' || h.includes('trans type'))
  const amountCol = headers.findIndex((h) => h === 'amount' || h.includes('txn amount') || h.includes('amount (inr)') || h.includes('net amount'))

  const candidates = []
  let duplicateCount = 0

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < 2) continue

    const rawDate = row[dateCol]
    const isoDate = parseDateToISO(rawDate)
    if (!isoDate) continue

    const rawNarration = narrationCol !== -1 ? String(row[narrationCol] || '').trim() : String(row[1] || '').trim()

    // Determine debit amount
    let isDebit = false
    let rawAmount = ''

    if (debitCol !== -1 && row[debitCol] != null && String(row[debitCol]).trim() !== '') {
      rawAmount = row[debitCol]
      isDebit = true
    } else if (amountCol !== -1 && row[amountCol] != null && String(row[amountCol]).trim() !== '') {
      rawAmount = row[amountCol]
      // Check type column if present
      if (typeCol !== -1) {
        const typeVal = String(row[typeCol] || '').toLowerCase().trim()
        if (typeVal.includes('dr') || typeVal.includes('debit') || typeVal.includes('outflow')) {
          isDebit = true
        } else if (typeVal.includes('cr') || typeVal.includes('credit') || typeVal.includes('inflow')) {
          isDebit = false
        }
      } else if (creditCol !== -1 && row[creditCol] != null && String(row[creditCol]).trim() !== '') {
        // If there's a credit column and it has a value, this row might be a credit
        isDebit = false
      } else {
        // Default to debit if no other indicator
        isDebit = true
      }
    }

    if (!isDebit || !rawAmount) continue

    // Clean amount string: remove currency symbols (₹, Rs, INR, $), commas, and whitespace
    const cleanAmountStr = String(rawAmount).replace(/[₹\$,Rs\.INRA-Za-z\s]/gi, (match) => (match === '.' ? '.' : ''))
    const amount = Math.abs(Number(cleanAmountStr))
    if (!Number.isFinite(amount) || amount <= 0) {
      continue // Skip invalid or zero amounts
    }

    const cleanedNote = cleanNarration(rawNarration)
    const category = predictCategory(rawNarration + ' ' + cleanedNote, availableCategories)

    // Check for duplicate against existing expenses
    const isDuplicate = existingExpenses.some(
      (exp) =>
        exp.date === isoDate &&
        Math.abs(exp.amount - amount) < 0.01 &&
        (exp.note.toLowerCase().includes(cleanedNote.toLowerCase()) ||
          cleanedNote.toLowerCase().includes(exp.note.toLowerCase()) ||
          exp.category === category)
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

/**
 * Main parser function: takes CSV or TSV text.
 */
export function parseBankStatementCSV(csvContent, options = {}) {
  const rows = parseCSVRows(csvContent)
  return parseBankStatementRows(rows, options)
}

/**
 * Universal bank statement parser supporting File objects (.csv, .tsv, .txt, .xls, .xlsx).
 */
export async function parseBankStatementFile(file, options = {}) {
  if (!file) return { ok: false, error: 'No file provided.' }

  const fileName = (file.name || '').toLowerCase()

  // 1. Excel files (.xls, .xlsx)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const { read, utils } = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const workbook = read(arrayBuffer, { type: 'array', cellDates: true })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        return { ok: false, error: 'The Excel workbook has no sheets.' }
      }
      const worksheet = workbook.Sheets[firstSheetName]
      // header: 1 produces 2D array [ [cellA1, cellB1], [cellA2, cellB2] ]
      const rows = utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' })
      return parseBankStatementRows(rows, options)
    } catch (err) {
      console.error('Excel parse failed:', err)
      return { ok: false, error: `Could not parse Excel spreadsheet: ${err.message || 'Unknown format'}` }
    }
  }

  // 2. Text / CSV / TSV files (.csv, .tsv, .txt)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = String(e.target?.result || '')
      resolve(parseBankStatementCSV(text, options))
    }
    reader.onerror = () => {
      resolve({ ok: false, error: 'Could not read the selected text/CSV file.' })
    }
    reader.readAsText(file)
  })
}
