import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initSentry } from './sentry.js'
import { initAnalytics } from './analytics.js'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { PrefsProvider } from './context/PrefsContext.jsx'
import { PresenceProvider } from './context/PresenceContext.jsx'

// Initialise Sentry avant le premier render (no-op si VITE_SENTRY_DSN absent)
initSentry();
// Idem pour l'analytics (no-op si VITE_POSTHOG_KEY absent)
initAnalytics();

// Service worker (PWA). Déplacé depuis un <script> inline d'index.html : la CSP
// aurait sinon eu besoin de 'unsafe-inline' sur script-src, ce qui annule sa
// protection contre les XSS. Le comportement est identique (attente du load).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch((err) => Sentry.captureException(err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* ErrorBoundary Sentry : capture les crashs React et les envoie à Sentry */}
    <Sentry.ErrorBoundary fallback={<AppCrash />} showDialog>
      <AuthProvider>
        <PresenceProvider>
          <PrefsProvider>
            <App />
          </PrefsProvider>
        </PresenceProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// AppCrash est le repli du Sentry.ErrorBoundary : il s'affiche quand TOUTE
// l'app est morte, y compris les contextes React. Comme ErrorBoundary.jsx et
// AppLoading.jsx, il lit donc la langue directement dans localStorage plutôt
// que via usePrefs() — protégé, avec repli sur le français.
function lireLangue() {
  try { return localStorage.getItem('padel_lang') || 'fr' }
  catch { return 'fr' }
}

const CRASH_STRINGS = {
  fr: {
    title: "Une erreur inattendue s'est produite",
    hint: 'Notre équipe a été notifiée automatiquement.',
    reload: "Recharger l'application",
  },
  en: {
    title: 'An unexpected error occurred',
    hint: 'Our team has been notified automatically.',
    reload: 'Reload the application',
  },
  he: {
    title: 'אירעה שגיאה בלתי צפויה',
    hint: 'הצוות שלנו קיבל התראה אוטומטית.',
    reload: 'טען מחדש את האפליקציה',
  },
};

function AppCrash() {
  const lang = lireLangue();
  const L = CRASH_STRINGS[lang] || CRASH_STRINGS.fr;
  const rtl = lang === 'he';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', padding: 32, fontFamily: 'Mulish, sans-serif', textAlign: 'center',
      background: '#F5F1E8', color: '#1F5C3F',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎾</div>
      {/* Spectral n'a pas de glyphes hébreux et Mulish pas d'italique dessiné :
          en hébreu, romain + Mulish plutôt qu'un italique synthétique. */}
      <div style={{
        fontSize: 20,
        fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
        fontStyle: rtl ? 'normal' : 'italic',
        marginBottom: 8,
      }}>
        {L.title}
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
        {L.hint}
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px', borderRadius: 999, background: '#1F5C3F', color: '#F5F1E8',
          border: 'none', fontFamily: 'Mulish, sans-serif', fontSize: 14, cursor: 'pointer',
        }}
      >
        {L.reload}
      </button>
    </div>
  );
}
