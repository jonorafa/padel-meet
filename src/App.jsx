import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import LanguageScreen from './screens/LanguageScreen'
import AuthScreen     from './screens/AuthScreen'
import OnboardingFlow from './screens/OnboardingFlow'
import MainApp        from './screens/MatchScreen'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { usePrefs }   from './context/PrefsContext'
import './index.css'

// Conteneur centré façon « mobile app »
// Toutes les routes sont rendues à l'intérieur de ce shell
function MobileShell() {
  const { dark } = usePrefs()
  return (
    <div style={{
      width: '100%', minHeight: '100svh',
      background: dark ? '#0d1510' : '#1a1a18',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 430,
        height: '100svh',
        overflow: 'hidden',
        background: dark ? '#121A15' : '#f5f0e8',
      }}>
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Toutes les routes vivent dans le shell 430px */}
        <Route element={<MobileShell />}>
          <Route path="/"           element={<LanguageScreen />} />
          <Route path="/auth"       element={<AuthScreen />} />
          <Route path="/onboarding" element={<OnboardingFlow />} />

          {/* Routes protégées */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app"   element={<MainApp />} />
            <Route path="/app/*" element={<MainApp />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
