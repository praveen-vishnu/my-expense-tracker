import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('PennyWise uncaught error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-shell" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--danger, #dc2626)' }}>Something went wrong</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              PennyWise encountered an unexpected view error. Your data is safely persisted in local storage.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReload}
              >
                Reload application
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

