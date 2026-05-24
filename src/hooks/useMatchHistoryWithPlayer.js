import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetch match history between current user and a specific player
 * Shows games played together with results, scores, and ELO deltas
 */
export function useMatchHistoryWithPlayer(userId, targetPlayerId) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId || !targetPlayerId) {
      setLoading(false)
      return
    }

    const fetchMatches = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get all matches where userId played against targetPlayerId
        const { data, error: queryError } = await supabase
          .from('match_history')
          .select('id, player_id, opponent_id, played_at, result, score, elo_delta')
          .or(
            `and(player_id.eq.${userId},opponent_id.eq.${targetPlayerId}),` +
            `and(player_id.eq.${targetPlayerId},opponent_id.eq.${userId})`
          )
          .order('played_at', { ascending: false })

        if (queryError) throw queryError

        // Transform data to unified format (from perspective of userId)
        const transformed = (data || []).map(m => {
          const isCurrentUserPlayer1 = m.player_id === userId
          return {
            id: m.id,
            playedAt: new Date(m.played_at),
            result: isCurrentUserPlayer1 ? m.result : swapResult(m.result),
            score: m.score,
            eloDelta: isCurrentUserPlayer1 ? m.elo_delta : -m.elo_delta,
          }
        })

        setMatches(transformed)
      } catch (err) {
        console.error('Error fetching match history:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMatches()
  }, [userId, targetPlayerId])

  // Helper to swap result perspective (win ↔ loss)
  const swapResult = (result) => {
    if (result === 'win') return 'loss'
    if (result === 'loss') return 'win'
    return result // draw stays draw
  }

  return { matches, loading, error }
}
