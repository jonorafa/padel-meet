import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return '< 1min'
  if (m < 60) return `${m}min`
  if (h < 24) return `${h}h`
  return `${d}j`
}

/**
 * Retourne les notifications de l'utilisateur connecté.
 * Écoute en temps réel les nouvelles notifications.
 * Aucun fallback statique — état vide honnête si aucune notification.
 */
// Types de notification qui signalent un changement de confidence_rate côté
// serveur pour LE DESTINATAIRE (peer eval reçue, ou score confirmé par
// l'adversaire). Sans ce refresh, le pourcentage affiché reste celui du
// dernier login — correct en base, mais figé à l'écran tant que la session
// reste ouverte.
const CONFIDENCE_AFFECTING_TYPES = new Set(['eval', 'match_result_confirmed'])

export function useNotifications() {
  const { user, refreshProfile } = useAuth()
  const [notifications, setNotifications] = useState([])

  const normalize = useCallback((n, fromProfile = null) => ({
    id: n.id,
    type: n.type,
    fromId: n.from_id,
    text: { fr: n.text_fr || '', en: n.text_en || '', he: n.text_he || '' },
    time: relativeTime(n.created_at),
    read: n.read,
    fromPlayer: fromProfile
      ? { id: fromProfile.id, name: fromProfile.name, photo: fromProfile.photo_url }
      : null,
  }), [])

  useEffect(() => {
    if (!user) return

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, from:from_id(id, name, photo_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        setNotifications(data.map(n => normalize(n, n.from)))
      }
      // Erreur DB → liste vide, pas de fausses notifications
    }

    fetchNotifs()

    // Écoute les nouvelles notifications en temps réel
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        const n = payload.new
        let fromProfile = null
        if (n.from_id) {
          const { data: fp } = await supabase
            .from('profiles').select('id, name, photo_url').eq('id', n.from_id).maybeSingle()
          fromProfile = fp
        }
        setNotifications(prev => [normalize(n, fromProfile), ...prev])
        // L'indice de confiance vient de changer côté serveur pour ce joueur —
        // sans ce refresh, il resterait figé à l'écran jusqu'au prochain login.
        if (CONFIDENCE_AFFECTING_TYPES.has(n.type)) refreshProfile?.()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, normalize, refreshProfile])

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    if (user) {
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', user.id).eq('read', false)
    }
  }, [user?.id])

  return { notifications, markRead, markAllRead }
}
