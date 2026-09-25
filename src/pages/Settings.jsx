import { useRef, useState } from 'react'
import { parseImportedJson } from '../utils/storage.js'

export default function Settings({
  data,
  onImport,
  onClear,
  onLoadDemo,
  onAddCategory,
}) {
  const fileRef = useRef(null)
  const [categoryName, setCategoryName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'khaata-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
    setError('')
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseImportedJson(String(reader.result || ''))
      if (!result.ok) {
        setError(result.error)
        setMessage('')
        return
      }
      onImport(result.data)
      setError('')
      setMessage('Data imported.')
    }
    reader.readAsText(file)
  }

  function handleAddCategory(event) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      setError('Enter a category name.')
      return
    }
    if (data.categories.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setError('That category already exists.')
      return
    }
    onAddCategory(name)
    setCategoryName('')
    setError('')
    setMessage(`Added ${name}.`)
  }

  return (
    <div className="page">
      <header className="page-intro">
        <h1>Settings</h1>
        <p>Your data stays in this browser. Export a backup if you switch devices.</p>
      </header>

      <section className="panel stack">
        <h2>Data</h2>
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            Export Data
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import Data
          </button>
          <button type="button" className="btn btn-danger" onClick={onClear}>
            Clear All Data
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFile}
        />
        {message ? <p className="form-ok">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="panel stack">
        <h2>Categories</h2>
        <ul className="chip-list">
          {data.categories.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={handleAddCategory}>
          <label className="field">
            <span>Add category</span>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Subscriptions"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            Add
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Demo data</h2>
        <p className="muted">
          Load a sample month so you can see the dashboard. This replaces your current data.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onLoadDemo}>
          Load demo month
        </button>
      </section>
    </div>
  )
}
