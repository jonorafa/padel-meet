import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initialsAvatar } from '../components/CourtUI'

/**
 * Retourne la liste des matches (likes mutuels) de l'utilisateur,
 * avec l'autre joueur et le dernier message.
 * Écoute en temps réel les nouveaux matches et nouveaux messages.
 */
export function useUserMatches() {
  const { user } = useAuth()
  const [matches, setMatches] = useState(null)
  const [loading, setLoading] = useState(true)
  // ID unique par instance — évite le conflit Supabase "cannot add callbacks after subscribe()"
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    let isMounted = true
    let channel = null

    const fetchMatches = async () => {
      const { data: matchRows, error } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id, created_at')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error || !matchRows || !isMounted) return

      // Pour chaque match, récupère l'autre joueur + dernier message
      const enriched = await Promise.all(
        matchRows.map(async (m) => {
          const otherId = m.player1_id === user.id ? m.player2_id : m.player1_id

          const [{ data: otherProfile }, { data: lastMsgs }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, name, photo_url, online, last_seen')
              .eq('id', otherId)
              .maybeSingle(),
            supabase
              .from('messages')
              .select('content, sender_id, created_at')
              .eq('match_id', m.id)
              .order('created_at', { ascending: false })
              .limit(1),
          ])

          const lastMsg = lastMsgs?.[0]
          return {
            matchId: m.id,
            player: {
              id:       otherId,
              name:     otherProfile?.name     || 'Joueur',
              photo:    otherProfile?.photo_url || initialsAvatar(otherProfile?.name || otherId),
              online:   otherProfile?.online    || false,
              lastSeen: otherProfile?.last_seen,
            },
            lastMessage: lastMsg ? {
              from: lastMsg.sender_id === user.id ? 'me' : 'them',
              text: { fr: lastMsg.content, en: lastMsg.content, he: lastMsg.content },
              time: new Date(lastMsg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            } : null,
          }
        })
      )

      if (!isMounted) return

      // Aucun match → tableau vide (jamais de fausse conversation)
      setMatches(enriched)
      setLoading(false)
    }

    fetchMatches()

    // Écoute les nouveaux matches et messages en temps réel
    channel = supabase
      .channel(`matches-${user.id}-${instanceIdRef.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matches',
        filter: `player1_id=eq.${user.id}`,
      }, () => { if (isMounted) fetchMatches() })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matches',
        filter: `player2_id=eq.${user.id}`,
      }, () => { if (isMounted) fetchMatches() })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, () => { if (isMounted) fetchMatches() })
      .subscribe()

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id])

  return { matches, loading }
}
