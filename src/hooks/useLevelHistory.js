import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Retourne l'historique de niveau de l'utilisateur connecté depuis la DB,
 * trié du plus ancien au plus récent : [{ level, date }].
 *
 * Tolérant aux pannes : si la table n'existe pas encore (migration non
 * appliquée) ou si le réseau est coupé, retourne [] sans erreur — l'appelant
 * peut alors retomber sur l'historique localStorage.
 */
export function useLevelHistory() {
  const { user } = useAuth()
  const [points, setPoints] = useState([])

  useEffect(() => {
    if (!user?.id) { setPoints([]); return }
    let active = true

    supabase
      .from('level_history')
      .select('level, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active || error || !data) return
        setPoints(data.map(r => ({ level: parseFloat(r.level), date: r.created_at })))
      })

    return () => { active = false }
  }, [user?.id])

  return points
}
