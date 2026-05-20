import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guard pour les routes protégées (/app/*).
 * - Pas connecté → /auth
 * - Connecté mais sans profil complet → /onboarding
 * - Sinon → affiche le contenu enfant via <Outlet />
 */
export default function ProtectedRoute() {
  const { user, loading, isOnboarding } = useAuth()

  // Pendant le chargement initial, on n'affiche rien
  if (loading) return null

  if (!user) return <Navigate to="/auth" replace />
  if (isOnboarding) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
