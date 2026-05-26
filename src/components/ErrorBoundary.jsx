import { Component } from 'react'
import { COURT } from './CourtUI'

/**
 * ErrorBoundary — attrape les erreurs React non gérées et affiche
 * un écran de secours plutôt qu'un écran blanc.
 *
 * Usage :
 *   <ErrorBoundary>
 *     <MonComposant />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, copied: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    this.setState({ errorInfo: info })
  }

  handleReload() {
    window.location.reload()
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false })
    this.props.onReset?.()
  }

  handleCopy() {
    const { error, errorInfo } = this.state
    const text = [
      error?.message || String(error),
      errorInfo?.componentStack?.split('\n').slice(0, 8).join('\n'),
    ].filter(Boolean).join('\n\n')
    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const dark  = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const bg    = dark ? COURT.darkBg   : COURT.cream
    const ink   = dark ? COURT.darkText : COURT.ink
    const stone = dark ? COURT.darkMuted: COURT.stone

    const errorText = [
      this.state.error?.message || String(this.state.error),
      this.state.errorInfo?.componentStack?.split('\n').slice(0, 6).join('\n'),
    ].filter(Boolean).join('\n\n')

    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
        overflowY: 'auto',
      }}>
        {/* Racket icon */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎾</div>

        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 22, fontWeight: 700, color: ink, margin: '0 0 10px',
        }}>
          Une erreur est survenue
        </h1>

        <p style={{
          fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
          fontSize: 15, color: stone, margin: '0 0 16px', maxWidth: 280,
        }}>
          Rechargez la page pour réessayer.
        </p>

        {/* Error detail — always visible for debugging */}
        {errorText && (
          <div style={{ width: '100%', maxWidth: 340, marginBottom: 16 }}>
            <pre style={{
              fontFamily: 'monospace', fontSize: 11, color: COURT.red,
              background: `${COURT.red}10`,
              border: `1px solid ${COURT.red}30`,
              borderRadius: 8, padding: '8px 12px',
              overflowX: 'auto',
              textAlign: 'left', whiteSpace: 'pre-wrap',
              userSelect: 'text', WebkitUserSelect: 'text',
              marginBottom: 8,
            }}>
              {errorText}
            </pre>
            {navigator.clipboard && (
              <button
                onClick={() => this.handleCopy()}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: this.state.copied ? COURT.green : 'transparent',
                  color: this.state.copied ? COURT.cream : stone,
                  border: `0.5px solid ${stone}`,
                  fontFamily: 'Inter', fontSize: 12, cursor: 'pointer',
                }}
              >
                {this.state.copied ? '✓ Copié !' : '📋 Copier l\'erreur'}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {this.props.onReset && (
            <button
              onClick={() => this.handleReset()}
              style={{
                padding: '12px 24px', borderRadius: 12,
                background: 'transparent', color: stone,
                border: `0.5px solid ${stone}`,
                fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
                fontSize: 15, cursor: 'pointer',
              }}
            >
              ← Retour
            </button>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '14px 32px', borderRadius: 12,
              background: COURT.green, color: COURT.cream,
              border: `0.5px solid ${COURT.gold}50`,
              fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
              fontSize: 16, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15,61,41,0.2)',
            }}
          >
            Recharger l'app
          </button>
        </div>
      </div>
    )
  }
}
