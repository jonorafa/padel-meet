import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { PrefsProvider } from './context/PrefsContext.jsx'
import { PresenceProvider } from './context/PresenceContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PresenceProvider>
        <PrefsProvider>
          <App />
        </PrefsProvider>
      </PresenceProvider>
    </AuthProvider>
  </StrictMode>,
)
