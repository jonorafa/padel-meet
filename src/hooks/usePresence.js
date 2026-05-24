import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Gère la présence en ligne de l'utilisateur connecté.
 *
 * — Au mount     : marque online=true, last_seen=now() dans profiles
 * — Heartbeat    : rafraîchit last_seen toutes les 30 secondes
 * — visibilitychange : online=false si l'onglet est masqué/fermé,
 *                      online=true si l'onglet revient actif
 *
 * Appelle setOnlineIds(prev => newSet) à chaque changement de statut
 * reçu via Realtime pour tenir la liste à jour sans re-fetch complet.
 */
export function usePresence(setOnlineIds) {
  const { user } = useAuth()
  const heartbeatRef = useRef(null)
  const channelRef   = useRef(null)

  // ── Marquer en ligne ────────────────────────────────────────────────────────
  const goOnline = useCallback(() => {
    if (!user) return
    return supabase
      .from('profiles')
      .update({ online: true, last_seen: new Date().toISOString() })
      .eq('id', user.id)
  }, [user?.id])

  // ── Marquer hors ligne ──────────────────────────────────────────────────────
  const goOffline = useCallback(() => {
    if (!user) return
    return supabase
      .from('profiles')
      .update({ online: false, last_seen: new Date().toISOString() })
      .eq('id', user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    // 1. Marquer immédiatement en ligne
    goOnline()

    // 2. Heartbeat : maintient last_seen à jour toutes les 30 secondes
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id)
      }
    }, 30_000)

    // 3. Realtime : écoute les mises à jour online/last_seen de tous les profils
    const channel = supabase
      .channel('presence-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const row = payload.new
        if (!row) return
        setOnlineIds?.(prev => {
          const next = new Set(prev)
          if (row.online) next.add(row.id)
          else            next.delete(row.id)
          return next
        })
      })
      .subscribe()

    channelRef.current = channel

    // 4. Onglet masqué → offline / réaffiché → online
    //    visibilitychange se déclenche aussi AVANT la fermeture de l'onglet,
    //    ce qui permet de marquer offline même à la fermeture.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') goOnline()
      else                                         goOffline()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(heartbeatRef.current)
      supabase.removeChannel(channelRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      goOffline()
    }
  }, [user?.id, goOnline, goOffline])
}
