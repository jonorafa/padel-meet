import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initialsAvatar } from '../components/CourtUI'

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
            photo: m.opponent?.photo_url || initialsAvatar(m.opponent?.name || m.opponent_id),
          },
        })))
      }
      // Erreur DB → garder l'historique vide, ne pas polluer avec de faux matchs
    }

    fetchHistory()
  }, [user?.id])

  return history
}

// ⚠️ Chantier 3 : saveMatchResult retiré pour raisons de sécurité.
// L'écriture directe dans match_history est désormais bloquée par RLS.
// Pour enregistrer un score, utilisez useMatchResults.submitResult() qui passe
// par la fonction SQL submit_match_result() (validation à 2 joueurs).
