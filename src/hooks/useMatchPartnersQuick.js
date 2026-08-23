import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Sentry } from '../sentry'
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
      const { data: matchRows, error } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

      // `error` était ignoré (seul `data` était déstructuré) : une requête en
      // échec laissait `matchRows` à null, et ce garde-fou sortait SANS
      // jamais appeler setLoading(false) — l'écran "Avec qui ?" tournait
      // indéfiniment, sans message ni recours. Même famille de bug que le
      // blocage d'auth déjà corrigé (setLoading doit être atteint sur TOUS
      // les chemins, succès comme échec).
      if (error) {
        Sentry.captureException(error)
        if (isMounted) { setPartners([]); setLoading(false) }
        return
      }
      if (!matchRows || !isMounted) return

      // Une requête PAR match (`matchRows.map(async …)`) : 20 matchs = 21
      // requêtes. Remplacé par un unique `.in()` sur tous les autres joueurs
      // — les données récupérées (id, nom, photo) sont les mêmes, seul le
      // nombre d'aller-retours réseau change.
      const otherIds = matchRows.map(m => m.player1_id === user.id ? m.player2_id : m.player1_id)
      const { data: profiles, error: profilesError } = otherIds.length
        ? await supabase.from('profiles').select('id, name, photo_url').in('id', otherIds)
        : { data: [], error: null }

      if (profilesError) Sentry.captureException(profilesError) // best-effort : on affiche quand même avec les repli ci-dessous

      const parProfil = new Map((profiles || []).map(p => [p.id, p]))
      const result = matchRows.map((m) => {
        const otherId = m.player1_id === user.id ? m.player2_id : m.player1_id
        const otherProfile = parProfil.get(otherId)
        return {
          matchId: m.id,
          player: {
            id:    otherId,
            name:  otherProfile?.name || 'Joueur',
            photo: otherProfile?.photo_url || initialsAvatar(otherProfile?.name || otherId),
          },
        }
      })

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
