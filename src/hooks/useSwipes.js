import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Enregistre les swipes en DB et détecte les matches mutuels.
 * Ignore les swipes sur les joueurs "faux" (données statiques).
 */
export function useSwipes() {
  const { user, profile } = useAuth()

  const recordSwipe = useCallback(async (targetId, direction) => {
    if (!user) return { isMatch: false }

    // Les faux joueurs ont des IDs entiers (nombre) — on ne les enregistre pas
    const isUUID = typeof targetId === 'string' && targetId.includes('-')
    if (!isUUID) {
      // Simulation locale de match (33%) pour les faux joueurs
      if (direction === 'right' && Math.random() < 0.33) {
        return { isMatch: true }
      }
      return { isMatch: false }
    }

    // Enregistre le swipe
    const { error } = await supabase
      .from('swipes')
      .upsert(
        { swiper_id: user.id, target_id: targetId, direction },
        { onConflict: 'swiper_id,target_id' }
      )

    if (error) return { isMatch: false }
    if (direction !== 'right') return { isMatch: false }

    // Vérifie si l'autre a déjà swipé droite sur nous
    const { data: mutual } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', targetId)
      .eq('target_id', user.id)
      .eq('direction', 'right')
      .maybeSingle()

    const myName = profile?.name || 'Quelqu\'un'

    if (!mutual) {
      // Pas encore de match mutuel — on envoie une notification "like"
      // pour inciter l'autre à venir voir ton profil
      await supabase.from('notifications').insert({
        user_id: targetId,
        type: 'like',
        from_id: user.id,
        text_fr: `${myName} s'intéresse à toi !`,
        text_en: `${myName} liked you!`,
        text_he: `${myName} אהב אותך!`,
      })
      return { isMatch: false }
    }

    // Crée le match (ordre déterministe pour éviter les doublons)
    const [p1, p2] = user.id < targetId
      ? [user.id, targetId]
      : [targetId, user.id]

    await supabase
      .from('matches')
      .upsert({ player1_id: p1, player2_id: p2 }, { onConflict: 'player1_id,player2_id' })

    // Notifie l'autre joueur du match mutuel
    await supabase.from('notifications').insert({
      user_id: targetId,
      type: 'match',
      from_id: user.id,
      text_fr: `${myName} vous a matché !`,
      text_en: `${myName} matched you!`,
      text_he: `${myName} עשה לך מאץ׳!`,
    })

    return { isMatch: true }
  }, [user?.id, profile?.name])

  return { recordSwipe }
}
