import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import LanguageScreen from './screens/LanguageScreen'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { usePrefs }   from './context/PrefsContext'
import './index.css'

// Code-splitting : chaque écran lourd devient son propre chunk, chargé à la
// demande — le bundle initial ne contient que le shell + l'écran de langue.
const AuthScreen     = lazy(() => import('./screens/AuthScreen'))
const OnboardingFlow = lazy(() => import('./screens/OnboardingFlow'))
const MainApp        = lazy(() => import('./screens/MatchScreen'))
const LegalScreen    = lazy(() => import('./screens/LegalScreen'))
const AdminScreen    = lazy(() => import('./screens/AdminScreen'))

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
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
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
          <Route path="/privacy"    element={<LegalScreen doc="privacy" />} />
          <Route path="/terms"      element={<LegalScreen doc="terms" />} />
          <Route path="/cgu"        element={<LegalScreen doc="terms" />} />

          {/* Routes protégées */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app"   element={<MainApp />} />
            <Route path="/app/*" element={<MainApp />} />
            <Route path="/admin" element={<AdminScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
