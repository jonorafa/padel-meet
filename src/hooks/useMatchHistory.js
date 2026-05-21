import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Retourne l'historique des matchs de l'utilisateur connecté.
 * Retourne un tableau vide si la DB est vide (jamais de faux matchs).
 */
export function useMatchHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user) return

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('match_history')
        .select('*, opponent:opponent_id(id, name, photo_url)')
        .eq('player_id', user.id)
        .order('played_at', { ascending: false })

      if (!error && data) {
        setHistory(data.map(m => ({
          id: m.id,
          withId: m.opponent_id,
          date: new Date(m.played_at),
          result: m.result,
          score: m.score,
          delta: m.elo_delta,
          player: {
            id:    m.opponent?.id,
            name:  m.opponent?.name     || 'Adversaire',
            photo: m.opponent?.photo_url || `https://i.pravatar.cc/600?u=${m.opponent_id}`,
          },
        })))
      }
      // Erreur DB → garder l'historique vide, ne pas polluer avec de faux matchs
    }

    fetchHistory()
  }, [user?.id])

  return history
}

/**
 * Enregistre un résultat de match en DB.
 * Le trigger SQL sync_profile_stats met à jour matches_played et wins automatiquement.
 */
export async function saveMatchResult({ userId, opponentId, result, score, eloDelta }) {
  await supabase.from('match_history').insert({
    player_id:   userId,
    opponent_id: opponentId,
    result,
    score,
    elo_delta:   eloDelta,
  })
}
