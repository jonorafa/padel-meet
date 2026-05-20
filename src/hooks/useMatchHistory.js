import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MATCHES_HISTORY, PLAYERS } from '../data/courtData' // fallback

/**
 * Retourne l'historique des matchs de l'utilisateur connecté.
 * Fallback sur les données statiques si la DB est vide.
 */
export function useMatchHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user) return

    const fetch = async () => {
      // Récupère l'historique avec le profil de l'adversaire
      const { data, error } = await supabase
        .from('match_history')
        .select('*, opponent:opponent_id(id, name, photo_url)')
        .eq('player_id', user.id)
        .order('played_at', { ascending: false })

      if (!error && data && data.length > 0) {
        setHistory(data.map(m => ({
          id: m.id,
          withId: m.opponent_id,
          date: new Date(m.played_at),
          result: m.result,
          score: m.score,
          delta: m.elo_delta,
          player: {
            id: m.opponent?.id,
            name: m.opponent?.name || 'Adversaire',
            photo: m.opponent?.photo_url || `https://i.pravatar.cc/600?u=${m.opponent_id}`,
          },
        })))
      } else {
        // Fallback : 1 seul match fictif pour voir la mise en page
        const m = MATCHES_HISTORY[0]
        const p = PLAYERS.find(pl => pl.id === m.withId)
        setHistory([{ ...m, player: p ? { id: p.id, name: p.name, photo: p.photo } : null }])
      }
    }

    fetch()
  }, [user?.id])

  return history
}

/**
 * Enregistre un résultat de match en DB et met à jour le profil.
 */
export async function saveMatchResult({ userId, opponentId, result, score, eloDelta }) {
  const ops = [
    supabase.from('match_history').insert({
      player_id: userId,
      opponent_id: opponentId,
      result,
      score,
      elo_delta: eloDelta,
    }),
    // Met à jour les stats du profil
    supabase.rpc('increment_match_stats', {
      p_user_id: userId,
      p_won: result === 'win' ? 1 : 0,
    }),
  ]
  await Promise.all(ops)
}
