import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractJsonFromResponse,
  getReceiptPrompt,
} from './geminiScanner.js'

test('extractJsonFromResponse parses pure JSON string', () => {
  const jsonStr = JSON.stringify({
    amount: 540,
    merchant: 'Swiggy',
    date: '2026-10-09',
    category: 'Food',
    note: 'Dinner',
    paymentMethod: 'upi',
  })

  const res = extractJsonFromResponse(jsonStr)
  assert.equal(res.amount, 540)
  assert.equal(res.merchant, 'Swiggy')
  assert.equal(res.paymentMethod, 'upi')
})

test('extractJsonFromResponse strips markdown code blocks', () => {
  const raw = '```json\n{"amount": 1250, "merchant": "Apollo Pharmacy", "date": "2026-10-08", "category": "Health", "note": "Medicines", "paymentMethod": "credit_card"}\n```'
  const res = extractJsonFromResponse(raw)
  assert.equal(res.amount, 1250)
  assert.equal(res.merchant, 'Apollo Pharmacy')
  assert.equal(res.category, 'Health')
})

test('extractJsonFromResponse extracts JSON surrounded by conversational text', () => {
  const raw = 'Here is the extracted information from the receipt:\n{"amount": 99.5, "merchant": "Chai Point", "date": "2026-10-09", "category": "Food"}\nHope this helps!'
  const res = extractJsonFromResponse(raw)
  assert.equal(res.amount, 99.5)
  assert.equal(res.merchant, 'Chai Point')
})

test('getReceiptPrompt includes available categories in instructions', () => {
  const prompt = getReceiptPrompt(['Dining', 'Groceries', 'Utilities'])
  assert.ok(prompt.includes('Dining, Groceries, Utilities'))
  assert.ok(prompt.includes('YYYY-MM-DD'))
  assert.ok(prompt.includes('UPI payment screenshot'))
})
