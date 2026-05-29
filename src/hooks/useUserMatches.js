import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initialsAvatar } from '../components/CourtUI'

/**
 * Retourne la liste des matches (likes mutuels) de l'utilisateur,
 * avec l'autre joueur, le dernier message et le compteur de messages non lus.
 *
 * Tri : conversations avec activité la plus récente en premier
 * (soit dernier message reçu, soit création du match).
 *
 * Écoute en temps réel les nouveaux matches, nouveaux messages, et les
 * accusés de lecture (UPDATE read_at) — pour faire disparaître le rond vert
 * quand le destinataire ouvre la conversation depuis un autre device.
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

      // Pour chaque match, récupère l'autre joueur + dernier message + non-lus
      const enriched = await Promise.all(
        matchRows.map(async (m) => {
          const otherId = m.player1_id === user.id ? m.player2_id : m.player1_id

          const [
            { data: otherProfile },
            { data: lastMsgs },
            { count: unreadCount },
          ] = await Promise.all([
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
            // Compte les messages reçus (sender = l'autre) jamais lus
            supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('match_id', m.id)
              .eq('sender_id', otherId)
              .is('read_at', null),
          ])

          const lastMsg = lastMsgs?.[0]
          // Timestamp utilisé pour le tri : dernier message si présent,
          // sinon date de création du match (pour les matches sans aucun message)
          const sortTs = lastMsg
            ? new Date(lastMsg.created_at).getTime()
            : new Date(m.created_at).getTime()

          return {
            matchId: m.id,
            sortTs,
            unreadCount: unreadCount || 0,
            player: {
              id:       otherId,
              name:     otherProfile?.name     || 'Joueur',
              photo:    otherProfile?.photo_url || initialsAvatar(otherProfile?.name || otherId),
              // `online` n'est plus exposé ici : le statut live vient de PresenceContext
              // (useOnline(player.id)). `lastSeen` reste utile pour l'échelle progressive.
              lastSeen: otherProfile?.last_seen,
            },
            lastMessage: lastMsg ? {
              from: lastMsg.sender_id === user.id ? 'me' : 'them',
              text: { fr: lastMsg.content, en: lastMsg.content, he: lastMsg.content },
              time: new Date(lastMsg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              createdAt: lastMsg.created_at,
            } : null,
          }
        })
      )

      if (!isMounted) return

      // Tri : activité la plus récente en premier
      enriched.sort((a, b) => b.sortTs - a.sortTs)

      // Aucun match → tableau vide (jamais de fausse conversation)
      setMatches(enriched)
      setLoading(false)
    }

    fetchMatches()

    // Écoute les nouveaux matches, messages, et accusés de lecture en temps réel
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
      // UPDATE messages : read_at passe de null à une date → re-fetch pour
      // mettre à jour les compteurs non-lus en temps réel
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
      }, () => { if (isMounted) fetchMatches() })
      .subscribe()

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id])

  return { matches, loading }
}
