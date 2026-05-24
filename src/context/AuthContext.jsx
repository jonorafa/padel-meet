import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [photos,  setPhotos]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Session initiale (gère aussi le retour OAuth depuis Google)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    // Écoute tous les changements d'état auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Marque hors-ligne quand le navigateur se ferme / l'onglet est quitté
  useEffect(() => {
    if (!user) return
    const handleVisibilityChange = () => {
      supabase.from('profiles').update({
        online: !document.hidden,
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
    // Marque l'utilisateur en ligne
    if (data) {
      await supabase.from('profiles')
        .update({ online: true, last_seen: new Date().toISOString() })
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
  }

  /** Connexion Google OAuth — redirige vers Google puis revient sur /auth */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
  }

  /** Déconnexion — marque hors-ligne avant de couper la session */
  const signOut = async () => {
    if (user) {
      await supabase.from('profiles')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }
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

  return (
    <AuthContext.Provider value={{
      user, profile, photos, loading, isOnboarding,
      signInWithGoogle, signOut, saveProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
