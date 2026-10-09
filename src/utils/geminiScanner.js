import { isValidDate, todayISO } from './formatting.js'
import { predictCategory } from './csvParser.js'

/**
 * Storage key for user-configured Gemini API Key in localStorage
 */
export const GEMINI_API_KEY_STORAGE = 'khaata_gemini_api_key'

export function getStoredGeminiKey() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return import.meta.env.VITE_GEMINI_API_KEY || ''
  }
  return window.localStorage.getItem(GEMINI_API_KEY_STORAGE) || import.meta.env.VITE_GEMINI_API_KEY || ''
}

export function saveStoredGeminiKey(key) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (key && key.trim()) {
    window.localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim())
  } else {
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE)
  }
}

/**
 * Robustly extract and parse JSON from LLM markdown code blocks or raw response text.
 */
export function extractJsonFromResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from AI engine.')
  }

  // 1. Check for fenced markdown code block ```json ... ``` or ``` ... ```
  const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = match ? match[1].trim() : rawText.trim()

  // 2. Direct JSON.parse
  try {
    return JSON.parse(candidate)
  } catch (err) {
    // 3. Fallback: find outer curly brackets { ... }
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start !== -1 && end > start) {
      const sliced = candidate.slice(start, end + 1)
      return JSON.parse(sliced)
    }
    throw new Error(`Failed to parse AI response into structured JSON: ${err.message}`)
  }
}

/**
 * System prompt instructing Gemini to act as a strict receipt/UPI bill extractor
 */
export function getReceiptPrompt(availableCategories = []) {
  const catList = availableCategories.length
    ? availableCategories.join(', ')
    : 'Food, Groceries, Travel, Shopping, Bills, Entertainment, Health, Other'

  return `You are a financial receipt and transaction document scanner.
Analyze this image (which may be a store bill, grocery receipt, restaurant invoice, or a UPI payment screenshot from GPay, PhonePe, Paytm, CRED, etc.).
Extract the transaction details into a strict JSON object with NO surrounding markdown or extra commentary.

Return this exact JSON schema:
{
  "amount": <number: the total final payable/paid amount in rupees, e.g. 450.50>,
  "merchant": "<string: name of store, restaurant, payee, or platform, e.g. Swiggy, Apollo Pharmacy, D-Mart, Ramesh Stores>",
  "date": "<string: transaction date formatted in YYYY-MM-DD ISO format. If missing or year not visible, use ${todayISO()}>",
  "category": "<string: best matching category from this list: ${catList}>",
  "note": "<string: short 2-5 word summary of items or context, e.g. 'Dinner with friends', 'Medicine', 'Milk & veggies'>",
  "paymentMethod": "<string: 'upi' | 'credit_card' | 'bank' | 'cash' | 'unknown'>"
}

Rules:
1. Always return a valid number for 'amount' (do not include currency symbols or commas).
2. If the date has no year, assume the current calendar year.
3. If category cannot be determined, choose the most sensible from the provided list.
4. If payment method is clearly indicated (e.g. Google Pay/PhonePe/UPI -> 'upi', Visa/Mastercard -> 'credit_card'), include it; otherwise use 'unknown'.
5. Only output JSON.`
}

/**
 * Scan a receipt or UPI screenshot image using the Google Gemini 1.5 Flash API.
 * Accepts image file or base64 data.
 */
export async function parseReceiptWithGemini(fileOrBase64, mimeType = 'image/jpeg', options = {}) {
  const apiKey = (options.apiKey || getStoredGeminiKey()).trim()
  if (!apiKey) {
    return {
      ok: false,
      error: 'Gemini API key is required. Please configure your key in Settings or enter it to scan.',
    }
  }

  const { availableCategories = [] } = options

  try {
    let base64Data = ''
    let actualMime = mimeType

    if (fileOrBase64 instanceof Blob || (typeof File !== 'undefined' && fileOrBase64 instanceof File)) {
      actualMime = fileOrBase64.type || mimeType || 'image/jpeg'
      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const res = String(reader.result || '')
          // strip data:image/...;base64, prefix
          const base64 = res.split(',')[1] || res
          resolve(base64)
        }
        reader.onerror = (err) => reject(new Error('Failed to read image file.'))
        reader.readAsDataURL(fileOrBase64)
      })
    } else if (typeof fileOrBase64 === 'string') {
      base64Data = fileOrBase64.includes(',') ? fileOrBase64.split(',')[1] : fileOrBase64
    } else {
      return { ok: false, error: 'Invalid image format provided.' }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`

    const payload = {
      contents: [
        {
          parts: [
            { text: getReceiptPrompt(availableCategories) },
            {
              inlineData: {
                mimeType: actualMime,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errMessage = `API request failed with status ${response.status}`
      try {
        const errJson = await response.json()
        if (errJson?.error?.message) {
          errMessage = errJson.error.message
        }
      } catch (_) {}
      return { ok: false, error: errMessage }
    }

    const data = await response.json()
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!textOutput) {
      return { ok: false, error: 'AI scanner returned no text from the image.' }
    }

    const parsed = extractJsonFromResponse(textOutput)

    // Validate and sanitize parsed fields
    const rawAmount = Number(parsed.amount)
    const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) / 100 : 0
    const merchant = String(parsed.merchant || 'Store Expense').trim()
    const date = isValidDate(parsed.date) ? parsed.date : todayISO()

    // Match or predict category
    let category = parsed.category
    if (!category || !availableCategories.includes(category)) {
      category = predictCategory(merchant, availableCategories)
    }

    const note = parsed.note ? String(parsed.note).trim() : merchant
    const paymentMethod = ['upi', 'credit_card', 'bank', 'cash'].includes(parsed.paymentMethod)
      ? parsed.paymentMethod
      : 'unknown'

    return {
      ok: true,
      data: {
        amount,
        merchant,
        date,
        category,
        note,
        paymentMethod,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err.message || 'An unexpected error occurred while analyzing the image.',
    }
  }
}
