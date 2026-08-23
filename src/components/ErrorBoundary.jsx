import { Component } from 'react'
import { COURT, TYPE } from './CourtUI'
import { Sentry } from '../sentry'

// À chaque déploiement, Vite renomme les chunks lazy-loadés avec un nouveau
// hash (OnboardingFlow-XXXX.js). Un onglet resté ouvert depuis AVANT le
// déploiement référence encore l'ancien hash — quand il tente de charger un
// chunk pas encore visité (ex: OnboardingFlow au moment de l'inscription),
// il demande un fichier que le déploiement actuel ne sert plus. Le navigateur
// lève "Failed to fetch dynamically imported module" : rien à voir avec le
// code de l'écran, l'onglet est juste périmé. Un rechargement (qui récupère
// le nouveau index.html, donc les bons hashs) répare ça à coup sûr — pas la
// peine d'imposer ce diagnostic à l'utilisateur.
const CHUNK_ERROR_RE = /failed to fetch dynamically imported module|importing a module script failed|dynamically imported module/i
const CHUNK_RELOAD_KEY = 'padel_chunk_reload_ts'
const CHUNK_RELOAD_WINDOW_MS = 10_000 // si l'erreur revient DANS ce délai après un rechargement, ce n'est pas un chunk périmé — on arrête d'insister

// ErrorBoundary est un composant classe, hors de tout contexte React (il
// enveloppe l'app depuis main.jsx) : pas d'accès à usePrefs()/I18N. La langue
// vit dans localStorage['padel_lang'] (PrefsContext.jsx), lisible
// indépendamment — protégé, un stockage indisponible retombe sur le français.
function lireLangue() {
  try { return localStorage.getItem('padel_lang') || 'fr' }
  catch { return 'fr' }
}

const STRINGS = {
  fr: {
    title: 'Une erreur est survenue',
    hint: 'Rechargez la page pour réessayer.',
    reported: 'Le problème a été signalé automatiquement.',
    back: '← Retour',
    reload: "Recharger l'app",
    details: '▾ Détails techniques',
    detailsOpen: '▴ Détails techniques',
    copy: "📋 Copier l'erreur",
    copied: '✓ Copié !',
  },
  en: {
    title: 'Something went wrong',
    hint: 'Reload the page to try again.',
    reported: 'The issue has been reported automatically.',
    back: '← Back',
    reload: 'Reload app',
    details: '▾ Technical details',
    detailsOpen: '▴ Technical details',
    copy: '📋 Copy error',
    copied: '✓ Copied!',
  },
  he: {
    title: 'אירעה שגיאה',
    hint: 'טען מחדש את הדף.',
    reported: 'התקלה דווחה אוטומטית.',
    back: 'חזרה',
    reload: 'טען מחדש את האפליקציה',
    details: '▾ פרטים טכניים',
    detailsOpen: '▴ פרטים טכניים',
    copy: '📋 העתק שגיאה',
    copied: '✓ הועתק!',
  },
}

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
    this.state = { hasError: false, error: null, errorInfo: null, copied: false, detailsOpen: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)

    if (CHUNK_ERROR_RE.test(error?.message || '')) {
      let lastReload = null
      try { lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || null } catch { /* stockage indisponible (navigation privée) : on retente quand même une fois */ }
      const recentlyReloaded = lastReload && (Date.now() - lastReload) < CHUNK_RELOAD_WINDOW_MS

      if (!recentlyReloaded) {
        // Premier échec, ou le précédent rechargement date d'assez longtemps :
        // c'est bien un chunk périmé, pas une boucle. On recharge SANS montrer
        // l'écran d'erreur — Sentry n'a pas besoin de le voir non plus, ce
        // n'est pas un incident applicatif, juste un onglet en retard d'un
        // déploiement.
        try { sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now())) } catch { /* tant pis, on recharge quand même */ }
        window.location.reload()
        return
      }
      // L'erreur revient MOINS de 10s après un rechargement : soit le chunk
      // manque vraiment (déploiement cassé), soit le réseau est coupé — dans
      // les deux cas, boucler ne réparerait rien. On efface le repère pour
      // qu'un futur vrai chunk périmé retente sa chance, et on montre l'écran
      // manuel comme avant.
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* non bloquant */ }
    }

    Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } })
    this.setState({ errorInfo: info })
  }

  handleReload() {
    window.location.reload()
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false, detailsOpen: false })
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

    const lang = lireLangue()
    const L = STRINGS[lang] || STRINGS.fr
    const rtl = lang === 'he'
    // Mulish n'a pas d'italique dessiné : en hébreu on garde le romain plutôt
    // qu'une inclinaison synthétique (même règle que dans le reste de l'app).
    const ff = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
    const fs = rtl ? 'normal' : 'italic'

    const errorText = [
      this.state.error?.message || String(this.state.error),
      this.state.errorInfo?.componentStack?.split('\n').slice(0, 6).join('\n'),
    ].filter(Boolean).join('\n\n')

    return (
      <div dir={rtl ? 'rtl' : 'ltr'} style={{
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
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontSize: 22, fontWeight: 700, color: ink, margin: '0 0 10px',
        }}>
          {L.title}
        </h1>

        <p style={{
          fontFamily: ff, fontStyle: fs,
          fontSize: 15, color: stone, margin: '0 0 6px', maxWidth: 280,
        }}>
          {L.hint}
        </p>

        {/* Le joueur n'a rien à faire de la trace React : ce qui le rassure,
            c'est de savoir que le problème est remonté (Sentry le reçoit déjà
            via captureException). Le détail reste accessible d'un clic pour
            qu'un testeur puisse l'envoyer. */}
        <p style={{
          fontFamily: 'Mulish, sans-serif',
          fontSize: TYPE.micro, color: stone, margin: '0 0 16px', maxWidth: 280,
        }}>
          {L.reported}
        </p>

        {errorText && (
          <div style={{ width: '100%', maxWidth: 340, marginBottom: 16 }}>
            <button
              onClick={() => this.setState(s => ({ detailsOpen: !s.detailsOpen }))}
              aria-expanded={this.state.detailsOpen}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: stone, fontFamily: 'Mulish, sans-serif', fontSize: TYPE.micro,
                padding: '4px 0', marginBottom: this.state.detailsOpen ? 8 : 0,
              }}
            >
              {this.state.detailsOpen ? L.detailsOpen : L.details}
            </button>
            {this.state.detailsOpen && (
              <>
                <pre dir="ltr" style={{
                  fontFamily: 'monospace', fontSize: TYPE.micro, color: COURT.red,
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
                      fontFamily: 'Mulish', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {this.state.copied ? L.copied : L.copy}
                  </button>
                )}
              </>
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
                fontFamily: ff, fontStyle: fs,
                fontSize: 15, cursor: 'pointer',
              }}
            >
              {L.back}
            </button>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '14px 32px', borderRadius: 12,
              background: COURT.green, color: COURT.cream,
              border: `0.5px solid ${COURT.gold}50`,
              fontFamily: ff, fontStyle: fs,
              fontSize: 16, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15,61,41,0.2)',
            }}
          >
            {L.reload}
          </button>
        </div>
      </div>
    )
  }
}
