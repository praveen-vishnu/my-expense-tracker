import { useState, useRef } from 'react'
import ModalSheet from './ModalSheet.jsx'
import {
  parseReceiptWithGemini,
  getStoredGeminiKey,
  saveStoredGeminiKey,
} from '../utils/geminiScanner.js'
import { formatINR, isValidDate, todayISO } from '../utils/formatting.js'
import {
  IconCamera,
  IconSparkles,
  IconCheck,
  IconKey,
  IconAlertCircle,
  IconPhoto,
  IconArrowRight,
} from '@tabler/icons-react'

export default function ReceiptScannerModal({
  categories = [],
  accounts = [],
  onExpenseExtracted,
  onDismiss,
}) {
  const [apiKey, setApiKey] = useState(() => getStoredGeminiKey())
  const [showKeyConfig, setShowKeyConfig] = useState(() => !getStoredGeminiKey())
  const [keyInput, setKeyInput] = useState(() => getStoredGeminiKey())

  const [imagePreview, setImagePreview] = useState(null)
  const [fileObject, setFileObject] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  // Extracted data preview & confirmation state
  const [extractedData, setExtractedData] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDate, setEditDate] = useState(todayISO())
  const [editNote, setEditNote] = useState('')
  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || ''
  const [editAccountId, setEditAccountId] = useState(defaultAccId)

  const fileInputRef = useRef(null)

  function handleSaveKey(e) {
    e.preventDefault()
    saveStoredGeminiKey(keyInput)
    setApiKey(keyInput.trim())
    setShowKeyConfig(false)
    setScanError('')
  }

  function handleFileSelected(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setScanError('Please select a valid image file (PNG, JPG, WebP).')
      return
    }
    setScanError('')
    setFileObject(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result)
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFileSelected(file)
  }

  async function handleTriggerScan() {
    if (!fileObject) {
      setScanError('Please select or upload an image first.')
      return
    }
    const currentKey = apiKey.trim()
    if (!currentKey) {
      setShowKeyConfig(true)
      setScanError('Please enter your Gemini API key to proceed.')
      return
    }

    setIsScanning(true)
    setScanError('')

    const result = await parseReceiptWithGemini(fileObject, fileObject.type, {
      apiKey: currentKey,
      availableCategories: categories,
    })

    setIsScanning(false)

    if (!result.ok) {
      setScanError(result.error)
      return
    }

    const { amount, merchant, date, category, note, paymentMethod } = result.data

    setExtractedData(result.data)
    setEditAmount(amount ? String(amount) : '')
    setEditCategory(category || categories[0] || 'Food')
    setEditDate(isValidDate(date) ? date : todayISO())
    setEditNote(note || merchant || '')

    // Auto-select matching account if inferred from paymentMethod
    if (paymentMethod === 'credit_card') {
      const cardAcc = accounts.find((a) => a.type === 'credit_card')
      if (cardAcc) setEditAccountId(cardAcc.id)
    } else if (paymentMethod === 'cash') {
      const cashAcc = accounts.find((a) => a.type === 'cash')
      if (cashAcc) setEditAccountId(cashAcc.id)
    } else if (paymentMethod === 'bank' || paymentMethod === 'upi') {
      const bankAcc = accounts.find((a) => a.type === 'bank')
      if (bankAcc) setEditAccountId(bankAcc.id)
    }
  }

  function handleConfirmAndAdd() {
    const num = Number(editAmount)
    if (!Number.isFinite(num) || num <= 0) {
      setScanError('Please specify a valid expense amount greater than zero.')
      return
    }

    onExpenseExtracted({
      amount: num,
      category: editCategory,
      date: editDate,
      note: editNote.trim(),
      accountId: editAccountId || null,
    })
    onDismiss()
  }

  function handleReset() {
    setImagePreview(null)
    setFileObject(null)
    setExtractedData(null)
    setScanError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <ModalSheet titleId="receipt-modal-title" className="sheet-wide" onDismiss={onDismiss}>
      <div className="receipt-modal-shell">
        <div className="sheet-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="scanner-badge-icon">
              <IconSparkles size={20} />
            </span>
            <div>
              <h2 id="receipt-modal-title">AI Receipt & Bill Scanner</h2>
              <p className="muted">Extract bill amounts & UPI screenshots instantly with Gemini 1.5 Flash.</p>
            </div>
          </div>
          <button type="button" className="text-btn" onClick={onDismiss}>
            Close
          </button>
        </div>

        {/* API KEY CONFIGURATION STRIP */}
        {showKeyConfig ? (
          <form className="gemini-key-strip" onSubmit={handleSaveKey}>
            <div className="key-strip-intro">
              <IconKey size={18} className="key-icon" />
              <div>
                <strong>Gemini API Key Required</strong>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                  Uses Google Gemini 1.5 Flash. Key is stored locally in your browser. Get a free key at{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'underline', color: 'inherit' }}
                  >
                    Google AI Studio
                  </a>.
                </p>
              </div>
            </div>
            <div className="key-input-row">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="key-input"
                required
              />
              <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                Save Key
              </button>
            </div>
          </form>
        ) : (
          <div className="gemini-key-active-bar">
            <span className="key-active-label">
              <IconCheck size={14} color="#10b981" /> Gemini Vision Engine Ready
            </span>
            <button
              type="button"
              className="text-btn"
              onClick={() => setShowKeyConfig(true)}
              style={{ fontSize: '0.8rem' }}
            >
              Update Key
            </button>
          </div>
        )}

        {scanError ? (
          <div className="scanner-error-banner" role="alert">
            <IconAlertCircle size={18} />
            <span>{scanError}</span>
          </div>
        ) : null}

        {/* MAIN BODY: STEP 1 (UPLOAD & SCAN) VS STEP 2 (REVIEW & CONFIRM) */}
        {!extractedData ? (
          <div className="scanner-upload-stage">
            {!imagePreview ? (
              <div
                className={`dropzone receipt-dropzone ${dragActive ? 'active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon-circle">
                  <IconCamera size={38} stroke={1.5} />
                </div>
                <p>
                  <strong>Click to upload</strong> or drag and drop a receipt or UPI screenshot
                </p>
                <small className="muted">
                  Supports GPay/PhonePe/Paytm screenshots, restaurant bills, retail invoices (PNG, JPG, WebP)
                </small>
              </div>
            ) : (
              <div className="receipt-preview-card">
                <div className="receipt-img-container">
                  <img src={imagePreview} alt="Receipt preview" className="receipt-img" />
                </div>
                <div className="receipt-preview-controls">
                  <div className="receipt-meta">
                    <strong>{fileObject?.name}</strong>
                    <span className="muted">
                      {Math.round((fileObject?.size || 0) / 1024)} KB
                    </span>
                  </div>
                  <div className="receipt-btn-group">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleReset}
                      disabled={isScanning}
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleTriggerScan}
                      disabled={isScanning}
                    >
                      {isScanning ? (
                        <>
                          <span className="spinner-dots">● ● ●</span> Extracting with Gemini...
                        </>
                      ) : (
                        <>
                          <IconSparkles size={18} /> Analyze Receipt
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
          </div>
        ) : (
          /* STEP 2: REVIEW & CONFIRM EXTRACTED TRANSACTION */
          <div className="scanner-review-stage">
            <div className="scanner-review-grid">
              {imagePreview ? (
                <div className="review-img-col">
                  <img src={imagePreview} alt="Receipt source" className="review-img-thumb" />
                  <div className="review-ai-badge">
                    <IconSparkles size={14} /> Gemini 1.5 Flash Extraction
                  </div>
                </div>
              ) : null}

              <div className="review-form-col">
                <div className="review-field-group">
                  <label className="field">
                    <span>Amount (₹)</span>
                    <div className="amount-input">
                      <span>₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="font-mono"
                        style={{ fontSize: '1.25rem', fontWeight: 600 }}
                      />
                    </div>
                  </label>

                  <div className="review-two-col">
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Account / Payment Mode</span>
                    <select
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : acc.type === 'bank' ? 'Bank' : 'Cash'})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Merchant / Description</span>
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Merchant name or note"
                    />
                  </label>
                </div>

                <div className="review-actions-footer">
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
                    Scan Another
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmAndAdd}
                  >
                    <IconCheck size={18} /> Confirm & Log Expense ({formatINR(editAmount || 0)})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalSheet>
  )
}
