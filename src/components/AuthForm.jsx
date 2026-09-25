import { useState } from 'react'
import { supabase } from '../utils/supabase.js'

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')

    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }

    if (mode === 'sign-up' && !result.data.session) {
      setMessage('Account created. Check your email to confirm your account, then sign in.')
      setMode('sign-in')
      return
    }

    onAuthenticated(result.data.user)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mark" aria-hidden="true" />
        <p className="eyebrow">Personal spending</p>
        <h1>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-copy">
          {mode === 'sign-in'
            ? 'Sign in to access your expenses from any device.'
            : 'Create an account to keep your tracker synced everywhere.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-ok">{message}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="text-btn auth-switch"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError('')
            setMessage('')
          }}
        >
          {mode === 'sign-in' ? 'Create a new account' : 'I already have an account'}
        </button>
      </section>
    </main>
  )
}
