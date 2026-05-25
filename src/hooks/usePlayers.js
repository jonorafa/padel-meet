import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from './usePresence'
import { initialsAvatar } from '../components/CourtUI'

function formatLastSeen(ts) {
  if (!ts) return '?'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

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
    // Présence réelle : priorité au Set onlineIds (Realtime), fallback DB
    online: onlineIds ? onlineIds.has(p.id) : (p.online || false),
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
  const [players, setPlayers]     = useState(null) // null = chargement
  const [onlineIds, setOnlineIds] = useState(new Set())

  // Enregistre la présence de l'utilisateur courant + écoute les changements
  usePresence(setOnlineIds)

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
      // Initialise le Set des utilisateurs en ligne depuis la DB
      const initialOnline = new Set(profiles.filter(p => p.online).map(p => p.id))
      setOnlineIds(prev => {
        // Fusionne : garde les IDs déjà connus du Realtime + ceux de la DB
        const merged = new Set([...prev, ...initialOnline])
        return merged
      })

      const fresh = profiles.filter(p => !swipedIds.has(p.id))
      setPlayers(fresh.map(p => transformDBProfile(p, null))) // onlineIds géré séparément
    } else {
      // DB vide ou erreur → état vide honnête, jamais de faux joueurs
      setPlayers([])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [fetchAll])

  // Applique onlineIds aux joueurs déjà chargés via useMemo pour stabiliser
  // la référence — évite de déclencher un reset du SwipeStack à chaque
  // heartbeat Realtime Presence (toutes les 30s).
  const playersWithPresence = useMemo(
    () => players ? players.map(p => ({ ...p, online: onlineIds.has(p.id) })) : null,
    [players, onlineIds]
  )

  return { players: playersWithPresence, loading: players === null, refetch: fetchAll }
}
