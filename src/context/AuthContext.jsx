import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [photos,  setPhotos]  = useState([])
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem('padel-guest') === 'true')
  // true quand l'utilisateur arrive via un lien « mot de passe oublié »
  // → l'écran Auth affiche le formulaire « nouveau mot de passe » au lieu de rediriger
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    // Session initiale (gère aussi le retour OAuth depuis Google)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    // Écoute tous les changements d'état auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Lien « mot de passe oublié » cliqué → on entre en mode récupération
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ?? null)
      if (session?.user) {
        // User signed in — exit guest mode automatically
        sessionStorage.removeItem('padel-guest')
        sessionStorage.setItem('current_user_id', session.user.id)
        setIsGuest(false)
        // ⚠️ On repasse loading=true AVANT de charger le profil. Sinon, à la
        // reconnexion d'un user existant, il existe une fenêtre où user est
        // défini, loading=false et profile encore null → isOnboarding devient
        // FAUSSEMENT true → AuthScreen redirige vers /onboarding (ré-évaluation
        // du niveau) avant que le vrai profil (avec username) soit chargé.
        setLoading(true)
        loadProfile(session.user.id)
      } else {
        sessionStorage.removeItem('current_user_id')
        setProfile(null);
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Nettoie le localStorage des données utilisateur quand on change d'utilisateur
  useEffect(() => {
    const stored = localStorage.getItem('padel_user_id')
    const current = user?.id || null
    if (stored && stored !== current && !current) {
      // Utilisateur précédent n'est plus connecté
      localStorage.removeItem('padel_level')
      localStorage.removeItem('padel_confidence')
      localStorage.removeItem('padel_level_history')
      localStorage.removeItem('padel_user_id')
    }
    if (current) {
      localStorage.setItem('padel_user_id', current)
    }
  }, [user?.id])

  // Met à jour last_seen quand l'onglet change d'état (changement de visibilité).
  // Le statut online vient désormais de PresenceContext (Supabase Realtime Presence),
  // donc on ne touche plus au champ DB `online` ici — il finira par être déprécié.
  useEffect(() => {
    if (!user) return
    const handleVisibilityChange = () => {
      supabase.from('profiles').update({
        last_seen: new Date().toISOString(),
      }).eq('id', user.id)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id])

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data)    // null si pas encore de profil
    setLoading(false)
    // Met à jour last_seen (pas online — la présence Realtime s'en occupe)
    if (data) {
      await supabase.from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)
    }
    // Load profile photos
    await loadProfilePhotos(userId)
  }

  const loadProfilePhotos = async (userId) => {
    const { data } = await supabase
      .from('profile_photos')
      .select('id, url, storage_path, is_primary, display_order, created_at')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
    setPhotos(data || [])

    // Self-heal : si la galerie a une photo primary mais que profiles.photo_url
    // ne pointe pas dessus, on rattrape (rare cas legacy : photos uploadées
    // via la galerie avant la sync auto, ou photo_url effacée). Silencieux —
    // ne bloque jamais le chargement.
    if (data && data.length > 0) {
      const primary = data.find(p => p.is_primary) ?? data[0]
      const expectedUrl = primary?.url
      if (expectedUrl) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('photo_url')
          .eq('id', userId)
          .maybeSingle()
        if (prof && prof.photo_url !== expectedUrl) {
          const { data: updated } = await supabase
            .from('profiles')
            .update({ photo_url: expectedUrl })
            .eq('id', userId)
            .select()
            .single()
          if (updated) setProfile(updated)
        }
      }
    }
  }

  /** Connexion Google OAuth — redirige vers Google puis revient sur /auth */
  /**
   * Connexion via Google Identity Services (One Tap / bouton overlay).
   * Le token id est validé directement par Supabase → aucun redirect vers
   * `…supabase.co`, donc l'écran Google n'affiche QUE « Padel Meet » + le domaine.
   * @param {string} token  l'ID token JWT renvoyé par Google
   * @param {string} nonce  le nonce BRUT (Google a reçu sa version hashée)
   */
  const signInWithGoogleIdToken = async (token, nonce) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token,
      nonce,
    })
    if (error) throw error
  }

  /** Fallback : redirect OAuth classique (si GIS ne charge pas / est bloqué). */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    })
    if (error) throw error
  }

  /** Mode invité — aucun compte, accès lecture seule */
  const enterAsGuest = () => {
    sessionStorage.setItem('padel-guest', 'true')
    setIsGuest(true)
  }
  const exitGuest = () => {
    sessionStorage.removeItem('padel-guest')
    setIsGuest(false)
  }

  /** Déconnexion — met juste à jour last_seen ; la présence Realtime est coupée par la fermeture du socket. */
  const signOut = async () => {
    if (user) {
      await supabase.from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }
    // Nettoie les données utilisateur du localStorage
    localStorage.removeItem('padel_level')
    localStorage.removeItem('padel_confidence')
    localStorage.removeItem('padel_level_history')
    await supabase.auth.signOut()
  }

  /**
   * Crée ou met à jour le profil (merge cumulatif).
   * Peut être appelé plusieurs fois sans écraser les champs existants.
   * Gère le cas où le username est déjà pris (contrainte UNIQUE DB).
   */
  const saveProfile = async (profileData) => {
    if (!user) return { error: new Error('Non authentifié') }
    const merged = {
      ...(profile || {}),
      ...profileData,
      id: user.id,
      email: user.email,
      // Normalise le username en minuscules
      ...(profileData.username ? { username: profileData.username.toLowerCase().trim() } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('profiles')
      .upsert(merged)
      .select()
      .single()
    if (error) {
      // Contrainte UNIQUE violée sur le username
      if (error.code === '23505' || error.message?.includes('profiles_username_unique')) {
        return { data: null, error: { message: 'Ce pseudo est déjà pris.' } }
      }
      return { data: null, error }
    }
    if (data) setProfile(data)
    return { data, error: null }
  }

  const refreshProfile = () => {
    if (user) loadProfile(user.id)
  }

  /** true si l'user est connecté mais n'a pas encore de profil complet (pseudo obligatoire) */
  const isOnboarding = !!user && !loading && (!profile || !profile.username)

  /** Sort du mode récupération (après mise à jour du mot de passe) */
  const endRecovery = () => setRecovery(false)

  return (
    <AuthContext.Provider value={{
      user, profile, photos, loading, isOnboarding, isGuest, recovery,
      signInWithGoogle, signInWithGoogleIdToken, signOut, saveProfile, refreshProfile, enterAsGuest, exitGuest, endRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
