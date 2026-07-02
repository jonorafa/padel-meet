import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/**
 * PresenceContext — vraie présence en ligne via Supabase Realtime Presence.
 *
 * Architecture :
 *   1. À l'authentification, on s'abonne au canal global `padel-meet:online`.
 *   2. On `track` notre user_id sur ce canal — on reste tracké tant que la
 *      WebSocket est ouverte. Si l'onglet ferme / crash / perd le réseau,
 *      Supabase nous retire automatiquement de la présence après ~10s.
 *   3. À chaque événement `sync`, on récupère la liste complète des présents
 *      et on la stocke dans un `Set<userId>`.
 *   4. Le hook `useOnline(userId)` lit dans ce Set — réactif aux changements.
 *
 * En parallèle, on maintient `profiles.last_seen` à jour via un heartbeat
 * toutes les 60s tant que l'onglet est visible. C'est ce que les autres
 * utilisateurs utilisent pour afficher « En ligne il y a X min » quand
 * la présence Realtime indique qu'on n'est plus connecté.
 */
const PresenceContext = createContext({ onlineSet: new Set(), isOnline: () => false })

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const [onlineSet, setOnlineSet] = useState(() => new Set())

  // ── Subscription Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setOnlineSet(new Set())
      return
    }

    const channel = supabase.channel('padel-meet:online', {
      config: { presence: { key: user.id } },
    })

    const syncFromChannel = () => {
      const state = channel.presenceState()
      const ids = new Set(Object.keys(state))
      setOnlineSet(ids)
    }

    channel
      .on('presence', { event: 'sync' }, syncFromChannel)
      .on('presence', { event: 'join' }, syncFromChannel)
      .on('presence', { event: 'leave' }, syncFromChannel)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() })
        }
      })

    return () => {
      try { channel.untrack() } catch { /* canal déjà fermé — best-effort */ }
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // ── Heartbeat last_seen (60s tant que l'onglet est visible) ───────────
  useEffect(() => {
    if (!user?.id) return
    const tick = () => {
      if (document.hidden) return
      supabase.from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }
    tick() // immediate
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [user?.id])

  const value = useMemo(
    () => ({
      onlineSet,
      isOnline: (id) => !!id && onlineSet.has(id),
    }),
    [onlineSet]
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence() { return useContext(PresenceContext) }

/** Lecture réactive : true ssi l'user est actuellement connecté en Realtime. */
export function useOnline(userId) {
  const { isOnline } = usePresence()
  return isOnline(userId)
}
