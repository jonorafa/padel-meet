import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initialsAvatar } from '../components/CourtUI'

/**
 * Hook optimisé pour charger rapidement la liste des partenaires (matchs).
 * Charge UNIQUEMENT : l'autre joueur (id, nom, photo).
 * Pas de messages, pas de unread counts → ultra rapide, affichage immédiat.
 * Utilisé par ScheduleMatchSheet pour afficher "Avec qui ?"
 */
export function useMatchPartnersQuick() {
  const { user } = useAuth()
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    let isMounted = true

    const fetchPartners = async () => {
      // Fetch les matches de l'utilisateur
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

      if (!matchRows || !isMounted) return

      // Pour chaque match, récupère JUSTE l'autre joueur (min de données)
      const result = await Promise.all(
        matchRows.map(async (m) => {
          const otherId = m.player1_id === user.id ? m.player2_id : m.player1_id

          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('id, name, photo_url')
            .eq('id', otherId)
            .maybeSingle()

          return {
            matchId: m.id,
            player: {
              id:    otherId,
              name:  otherProfile?.name || 'Joueur',
              photo: otherProfile?.photo_url || initialsAvatar(otherProfile?.name || otherId),
            },
          }
        })
      )

      if (isMounted) {
        setPartners(result)
        setLoading(false)
      }
    }

    fetchPartners()

    return () => { isMounted = false }
  }, [user?.id])

  return { partners, loading }
}
