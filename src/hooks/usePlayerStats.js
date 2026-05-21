import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Appelle la fonction RPC get_player_stats pour obtenir les
 * statistiques calculées depuis match_history :
 *   - matches_played : total de matchs enregistrés
 *   - wins           : nombre de victoires
 *   - streak         : victoires consécutives depuis le plus récent match
 *
 * Si la RPC n'est pas encore déployée (erreur DB), retourne des zéros
 * plutôt que de bloquer l'affichage.
 *
 * @param {string|null} playerId - UUID du joueur (défaut : utilisateur courant)
 */
export function usePlayerStats(playerId = null) {
  const { user } = useAuth()
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = playerId || user?.id
    if (!id) { setLoading(false); return }

    let mounted = true

    const fetchStats = async () => {
      const { data, error } = await supabase
        .rpc('get_player_stats', { p_player_id: id })

      if (!mounted) return

      if (!error && data && data.length > 0) {
        setStats({
          matchesPlayed: data[0].matches_played ?? 0,
          wins:          data[0].wins          ?? 0,
          streak:        data[0].streak        ?? 0,
        })
      } else {
        // RPC absente ou erreur → zéros honnêtes plutôt que faux chiffres
        setStats({ matchesPlayed: 0, wins: 0, streak: 0 })
      }
      setLoading(false)
    }

    fetchStats()
    return () => { mounted = false }
  }, [playerId, user?.id])

  return { stats, loading }
}
