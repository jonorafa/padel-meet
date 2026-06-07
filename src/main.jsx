import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initSentry } from './sentry.js'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { PrefsProvider } from './context/PrefsContext.jsx'
import { PresenceProvider } from './context/PresenceContext.jsx'

// Initialise Sentry avant le premier render (no-op si VITE_SENTRY_DSN absent)
initSentry();

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

function AppCrash() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', padding: 32, fontFamily: 'Mulish, sans-serif', textAlign: 'center',
      background: '#F5F1E8', color: '#1F5C3F',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎾</div>
      <div style={{ fontSize: 20, fontFamily: 'Spectral, serif', fontStyle: 'italic', marginBottom: 8 }}>
        Une erreur inattendue s'est produite
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
        Notre équipe a été notifiée automatiquement.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px', borderRadius: 999, background: '#1F5C3F', color: '#F5F1E8',
          border: 'none', fontFamily: 'Mulish, sans-serif', fontSize: 14, cursor: 'pointer',
        }}
      >
        Recharger l'application
      </button>
    </div>
  );
}
