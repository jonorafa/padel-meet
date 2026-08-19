import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { track, identifyUser, resetUser } from '../analytics'
import { Sentry } from '../sentry'

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
    // ── Filet anti-écran blanc ────────────────────────────────────────────
    // `loading` commande ProtectedRoute, qui ne rend RIEN tant qu'il est vrai.
    // Tant que rien ne garantissait qu'il retombe, n'importe quel blocage du
    // démarrage laissait l'utilisateur sur une page vide, sans message ni
    // recours — symptôme signalé en ouvrant le lien depuis WhatsApp, où seul
    // un rechargement manuel débloquait la situation.
    // getSession() peut ne jamais se résoudre dans un navigateur intégré : il
    // lit le stockage, rafraîchit éventuellement le jeton par le réseau, et
    // supabase-js sérialise ces opérations derrière un verrou. Aucun de ces
    // trois maillons n'échoue de façon observable — ils restent en attente.
    // Ce minuteur borne l'attente : au pire l'utilisateur repart sur l'écran
    // de connexion, ce qui est toujours mieux qu'un écran vide définitif.
    let vivant = true
    const filet = setTimeout(() => {
      if (!vivant) return
      Sentry.captureMessage('Démarrage auth non résolu — filet déclenché', 'warning')
      setLoading(false)
    }, 8000)
    const fini = () => { clearTimeout(filet) }

    // Session initiale (gère aussi le retour OAuth depuis Google)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id).finally(fini)
      else { setLoading(false); fini() }
    }).catch((err) => {
      // Sans ce catch, un rejet laissait `loading` à true pour toujours : le
      // .then ne s'exécute pas, donc aucun setLoading(false) n'était atteint.
      Sentry.captureException(err)
      setLoading(false)
      fini()
    })

    // Écoute tous les changements d'état auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Lien « mot de passe oublié » cliqué → on entre en mode récupération
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Lie l'identité analytics à la connexion — pas seulement au premier
        // signup, à chaque connexion (couvre aussi la reconnexion). resetUser()
        // est appelé au signOut, symétriquement, pour ne pas attribuer les
        // events du prochain utilisateur sur un appareil partagé.
        if (event === 'SIGNED_IN') identifyUser(session.user.id)
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

    return () => { vivant = false; clearTimeout(filet); subscription.unsubscribe() }
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
    // try/finally : sans lui, une erreur réseau sur cette requête sautait le
    // setLoading(false) ci-dessous et bloquait l'app sur un écran vide, la
    // promesse rejetée n'étant par ailleurs rattrapée nulle part.
    let data = null
    try {
      ({ data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle())
      setProfile(data)    // null si pas encore de profil
    } catch (err) {
      Sentry.captureException(err)
    } finally {
      setLoading(false)
    }
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
    resetUser()
    await supabase.auth.signOut()
  }

  /**
   * Crée ou met à jour le profil (merge cumulatif).
   * Peut être appelé plusieurs fois sans écraser les champs existants.
   * Gère le cas où le username est déjà pris (contrainte UNIQUE DB).
   */
  const saveProfile = async (profileData) => {
    if (!user) return { error: new Error('Non authentifié') }
    // Vrai signal de "premier compte" : aucun trigger DB ne crée la ligne
    // profiles à l'inscription (vérifié : aucun trigger sur auth.users dans
    // les migrations). La ligne n'existe qu'après ce tout premier upsert —
    // donc `profile` (state, avant ce merge) est encore null. C'est plus
    // fiable que comparer profiles.created_at à "maintenant" après coup,
    // puisqu'à cet instant précis la ligne n'a pas encore été créée.
    const isFirstProfile = !profile
    const merged = {
      ...(profile || {}),
      ...profileData,
      id: user.id,
      // Normalise le username en minuscules
      ...(profileData.username ? { username: profileData.username.toLowerCase().trim() } : {}),
      // RGPD/PPL : consentement actif (case cochée sur AuthScreen, pas un
      // texte passif) — padel_consent_ts est l'horodatage RÉEL du clic sur la
      // case, écrit en localStorage à cet instant. Jamais réécrit après le
      // premier upsert (?? sur profile?.accepted_terms_at en premier).
      //
      // Fin de chaîne à null, plus new Date() : sans consentement réel
      // enregistré, un horodatage généré ici serait une preuve FABRIQUÉE —
      // exactement ce que la migration 022 visait à éliminer. Les deux champs
      // tombent à null ensemble, ce que la contrainte consent_coherence
      // (migration 024) vérifie côté base.
      accepted_terms_at: profile?.accepted_terms_at ?? localStorage.getItem('padel_consent_ts') ?? null,
      consent_version: profile?.consent_version ?? localStorage.getItem('padel_consent_version') ?? null,
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
    if (data) {
      if (isFirstProfile) track('signup', { method: 'google' })
      setProfile(data)
      localStorage.removeItem('padel_consent_ts')
      localStorage.removeItem('padel_consent_version')
    }
    return { data, error: null }
  }

  // Mémoïsé : useNotifications() en fait une dépendance de useEffect (pour
  // rafraîchir l'indice de confiance à la réception d'une notif d'éval/score).
  // Sans useCallback, une nouvelle référence à chaque rendu du provider aurait
  // fait réabonner le canal realtime des notifications à chaque re-render.
  const refreshProfile = useCallback(() => {
    if (user) loadProfile(user.id)
  }, [user])

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
