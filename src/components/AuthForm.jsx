import { useState } from 'react'
import { supabase, getAuthRedirectUrl } from '../utils/supabase.js'
import ThemeToggle from './ThemeToggle.jsx'

export default function AuthForm({ onAuthenticated, recovery = false, theme, onToggleTheme }) {
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

    const redirectUrl = getAuthRedirectUrl()

    let result
    if (recovery) {
      result = await supabase.auth.updateUser({ password })
    } else if (mode === 'reset') {
      result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      })
    } else if (mode === 'magic-link') {
      result = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })
    } else if (mode === 'sign-in') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })
    }

    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }

    if (recovery) {
      setMessage('Password updated. Your account is ready to use.')
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        onAuthenticated(data.user)
      }
      return
    }

    if (mode === 'reset') {
      setMessage('Password reset email sent! Check your inbox and follow the link to choose a new password.')
      return
    }

    if (mode === 'magic-link') {
      setMessage('Magic link sent! Check your email and click the link to log in directly.')
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
        <ThemeToggle className="auth-theme-toggle" theme={theme} onToggle={onToggleTheme} />
        <div className="auth-mark" aria-hidden="true" />
        <p className="eyebrow">Personal spending</p>
        <h1>
          {recovery
            ? 'Choose a new password'
            : mode === 'sign-in'
              ? 'Welcome back'
              : mode === 'magic-link'
                ? 'Sign in with Magic Link'
                : mode === 'reset'
                  ? 'Reset your password'
                  : 'Create your account'}
        </h1>
        <p className="auth-copy">
          {recovery
            ? 'Choose a new password for your Khaata account.'
            : mode === 'sign-in'
              ? 'Sign in to access your expenses from any device.'
              : mode === 'magic-link'
                ? 'We will email you a secure login link with no password required.'
                : mode === 'reset'
                  ? 'Enter your email and we will send you a password reset link.'
                  : 'Create an account to keep your tracker synced everywhere.'}
        </p>

        <form className="auth-form" aria-busy={busy} onSubmit={handleSubmit}>
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
          {(mode !== 'reset' && mode !== 'magic-link') || recovery ? (
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={recovery || mode === 'sign-up' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </label>
          ) : null}
          {error ? <p id="auth-error" className="form-error" role="alert">{error}</p> : null}
          {message ? <p id="auth-message" className="form-ok" role="status" aria-live="polite">{message}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy
              ? 'Please wait...'
              : recovery
                ? 'Update password'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : mode === 'magic-link'
                    ? 'Send magic link'
                    : mode === 'reset'
                      ? 'Send reset email'
                      : 'Create account'}
          </button>
        </form>

        {!recovery ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="text-btn auth-switch"
              style={{ margin: '0 auto' }}
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                setError('')
                setMessage('')
              }}
            >
              {mode === 'sign-in' ? 'Create a new account' : 'Back to sign in'}
            </button>
            {mode === 'sign-in' ? (
              <>
                <button
                  type="button"
                  className="text-btn auth-switch"
                  style={{ margin: '0 auto' }}
                  onClick={() => {
                    setMode('magic-link')
                    setError('')
                    setMessage('')
                  }}
                >
                  Sign in with Magic Link (Passwordless)
                </button>
                <button
                  type="button"
                  className="text-btn auth-switch"
                  style={{ margin: '0 auto' }}
                  onClick={() => {
                    setMode('reset')
                    setError('')
                    setMessage('')
                  }}
                >
                  Forgot password?
                </button>
              </>
            ) : mode === 'magic-link' || mode === 'reset' ? (
              <button
                type="button"
                className="text-btn auth-switch"
                style={{ margin: '0 auto' }}
                onClick={() => {
                  setMode('sign-in')
                  setError('')
                  setMessage('')
                }}
              >
                Back to standard sign in
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
