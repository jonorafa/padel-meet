import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import { initialsAvatar } from '../components/CourtUI'

function transformDBProfile(p, onlineIds) {
  const matchesPlayed = p.matches_played || 0
  return {
    id: p.id,                   // UUID string
    name: p.name || 'Joueur',
    age: p.age || 28,
    city: p.city || p.region || 'Israel',
    level: p.level ?? null,     // null = quiz non effectué
    confidenceRate: p.confidence_rate ?? 50,
    hand: p.dominant_hand || 'right',
    side: p.preferred_side || 'forehand',
    style: p.play_style || 'all-court',
    motivation: p.motivation || 'fun',
    frequency: p.frequency || 2,
    availability: p.availability || [],
    height: p.height || 175,
    matches: matchesPlayed,
    // null si aucun match — jamais 0% affiché sans données réelles
    winrate: matchesPlayed > 0 ? Math.round((p.wins / matchesPlayed) * 100) : null,
    photo: p.photo_url || initialsAvatar(p.name || p.id),
    bioFr: p.bio_fr || '',
    bioEn: p.bio_en || '',
    bioHe: p.bio_he || '',
    // Présence : calculée en aval via PresenceContext (Realtime Supabase)
    online: false,
    lastSeen: p.last_seen,      // ISO string — formaté côté UI
    commonMatches: 0,
    isRealUser: true,
    // Chantier 4 : préférences partenaire (ce qu'il/elle cherche)
    partnerPrefs: p.partner_prefs || {},
  }
}

/**
 * Retourne la liste des joueurs depuis Supabase.
 * - Exclut l'utilisateur courant
 * - Exclut les joueurs déjà swipés (gauche ou droite)
 * - Retourne [] si la DB est vide (jamais de faux joueurs)
 * - Gère la présence en ligne via Supabase Realtime
 */
export function usePlayers() {
  const { user } = useAuth()
  const { onlineSet } = usePresence()
  const [players, setPlayers] = useState(null) // null = chargement

  const fetchAll = useCallback(async () => {
    if (!user) return

    // Charge les profils ET les swipes déjà effectués en parallèle
    const [profilesResult, swipesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('swipes')
        .select('target_id')
        .eq('swiper_id', user.id),
    ])

    const { data: profiles, error } = profilesResult
    const swipedIds = new Set((swipesResult.data || []).map(s => s.target_id))

    if (!error && profiles && profiles.length > 0) {
      const fresh = profiles.filter(p => !swipedIds.has(p.id))
      setPlayers(fresh.map(p => transformDBProfile(p)))
    } else {
      // DB vide ou erreur → état vide honnête, jamais de faux joueurs
      setPlayers([])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [fetchAll])

  // Branche la présence Realtime via useMemo — stable tant que onlineSet ne change pas.
  // Le PresenceContext n'émet de nouveau Set qu'aux events join/leave/sync,
  // donc la liste des joueurs ne reset pas à chaque heartbeat.
  const playersWithPresence = useMemo(
    () => players ? players.map(p => ({ ...p, online: onlineSet.has(p.id) })) : null,
    [players, onlineSet]
  )

  return { players: playersWithPresence, loading: players === null, refetch: fetchAll }
}
