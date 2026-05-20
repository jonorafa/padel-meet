import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PLAYERS } from '../data/courtData' // fallback si DB vide

function formatLastSeen(ts) {
  if (!ts) return '?'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

function transformDBProfile(p) {
  return {
    id: p.id,                   // UUID string
    name: p.name || 'Joueur',
    age: p.age || 28,
    city: p.city || p.region || 'Israel',
    level: p.level || 3.5,
    confidence: p.confidence || 50,
    hand: p.dominant_hand || 'right',
    side: p.preferred_side || 'forehand',
    style: p.play_style || 'all-court',
    motivation: p.motivation || 'fun',
    frequency: p.frequency || 2,
    availability: p.availability || [],
    height: p.height || 175,
    matches: p.matches_played || 0,
    winrate: p.matches_played > 0 ? Math.round((p.wins / p.matches_played) * 100) : 0,
    photo: p.photo_url || `https://i.pravatar.cc/600?u=${encodeURIComponent(p.name || p.id)}`,
    bioFr: p.bio_fr || '',
    bioEn: p.bio_en || '',
    bioHe: p.bio_he || '',
    online: p.online || false,
    lastSeen: p.last_seen,      // ISO string — formaté côté UI
    commonMatches: 0,
    isRealUser: true,           // tag pour distinguer des faux joueurs
  }
}

/**
 * Retourne la liste des joueurs depuis Supabase.
 * - Exclut l'utilisateur courant
 * - Exclut les joueurs déjà swipés (gauche ou droite)
 * - Fallback sur 1 faux joueur si la DB est vide
 */
export function usePlayers() {
  const { user } = useAuth()
  const [players, setPlayers] = useState(null) // null = chargement

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
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
        // Filtre les joueurs déjà swipés
        const fresh = profiles.filter(p => !swipedIds.has(p.id))
        if (fresh.length > 0) {
          setPlayers(fresh.map(transformDBProfile))
        } else {
          // Tous les joueurs existants ont déjà été swipés
          setPlayers([])
        }
      } else {
        // Fallback : 1 seul joueur fictif pour voir la mise en page du swipe
        setPlayers([{ ...PLAYERS[0], isRealUser: false }])
      }
    }

    fetchAll()
  }, [user?.id])

  const refetch = useCallback(() => {
    if (!user) return
    const fetch = async () => {
      const [profilesResult, swipesResult] = await Promise.all([
        supabase.from('profiles').select('*').neq('id', user.id).order('created_at', { ascending: false }),
        supabase.from('swipes').select('target_id').eq('swiper_id', user.id),
      ])
      const { data: profiles } = profilesResult
      const swipedIds = new Set((swipesResult.data || []).map(s => s.target_id))
      if (profiles && profiles.length > 0) {
        const fresh = profiles.filter(p => !swipedIds.has(p.id))
        setPlayers(fresh.length > 0 ? fresh.map(transformDBProfile) : [])
      } else {
        setPlayers([{ ...PLAYERS[0], isRealUser: false }])
      }
    }
    fetch()
  }, [user?.id])

  return { players, loading: players === null, refetch }
}
