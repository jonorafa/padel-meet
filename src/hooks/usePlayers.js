import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function formatLastSeen(ts) {
  if (!ts) return '?'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

function transformDBProfile(p) {
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
    photo: p.photo_url || `https://i.pravatar.cc/600?u=${encodeURIComponent(p.name || p.id)}`,
    bioFr: p.bio_fr || '',
    bioEn: p.bio_en || '',
    bioHe: p.bio_he || '',
    online: p.online || false,
    lastSeen: p.last_seen,      // ISO string — formaté côté UI
    commonMatches: 0,
    isRealUser: true,
  }
}

/**
 * Retourne la liste des joueurs depuis Supabase.
 * - Exclut l'utilisateur courant
 * - Exclut les joueurs déjà swipés (gauche ou droite)
 * - Retourne [] si la DB est vide (jamais de faux joueurs)
 */
export function usePlayers() {
  const { user } = useAuth()
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
      setPlayers(fresh.map(transformDBProfile))
    } else {
      // DB vide ou erreur → état vide honnête, jamais de faux joueurs
      setPlayers([])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [fetchAll])

  return { players, loading: players === null, refetch: fetchAll }
}
