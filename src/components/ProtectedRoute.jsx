import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { AppLoading } from './AppLoading'

/**
 * Guard pour les routes protégées (/app/*).
 * - Pas connecté → /auth
 * - Connecté mais sans profil complet → /onboarding
 * - Sinon → affiche le contenu enfant via <Outlet />
 */
export default function ProtectedRoute() {
  const { user, loading, isOnboarding, isGuest } = useAuth()
  const { dark } = usePrefs()

  // Pendant le chargement initial, on affiche un écran d'attente. Rendre
  // `null` ici produisait une page entièrement vide, indiscernable d'une app
  // cassée : c'est ce que voyait l'utilisateur quand le démarrage de la
  // session se bloquait (lien ouvert depuis WhatsApp).
  if (loading) return <AppLoading dark={dark} />

  // Les invités peuvent accéder à l'app en lecture seule.
  // On lit aussi sessionStorage directement pour contourner la latence React :
  // quand enterAsGuest() appelle setIsGuest(true) + navigate() dans le même
  // handler, la mise à jour d'état peut ne pas encore être reflétée ici.
  const isGuestNow = isGuest || sessionStorage.getItem('padel-guest') === 'true'
  if (!user && !isGuestNow) return <Navigate to="/auth" replace />
  if (user && isOnboarding) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
