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
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload() {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const dark  = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const bg    = dark ? COURT.darkBg   : COURT.cream
    const ink   = dark ? COURT.darkText : COURT.ink
    const stone = dark ? COURT.darkMuted: COURT.stone

    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
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
          fontSize: 15, color: stone, margin: '0 0 28px', maxWidth: 280,
        }}>
          Rechargez la page pour réessayer.
        </p>

        {/* Error detail (dev only) */}
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            fontFamily: 'monospace', fontSize: 11, color: COURT.red,
            background: `${COURT.red}10`,
            border: `1px solid ${COURT.red}30`,
            borderRadius: 8, padding: '8px 12px',
            maxWidth: 320, overflowX: 'auto',
            textAlign: 'left', marginBottom: 20, whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.message}
          </pre>
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
    )
  }
}
