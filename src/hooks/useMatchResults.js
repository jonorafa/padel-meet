import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook pour gérer la soumission et confirmation des scores de match
 * Système anti-fraude : validation à 2 joueurs requise
 * Système 3-tentatives : après 3 rejets, le match est verrouillé définitivement
 *
 * Retourne :
 *   - pendingResults : liste des scores en attente (submitter OU opponent)
 *   - matchScoreStatus(matchId) : { attempts, locked, remaining } pour un match
 *   - submitResult(opponentId, result, score) : soumettre un nouveau score
 *   - confirmResult(pendingId) : confirmer un score reçu
 *   - rejectResult(pendingId) : rejeter → { attempts, remaining, locked }
 *   - loading, error : états de chargement
 */
export function useMatchResults() {
  const { user } = useAuth()
  const [pendingResults, setPendingResults] = useState([])
  const [matchStatuses,  setMatchStatuses]  = useState({}) // matchId → { attempts, locked }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // ID unique par instance — évite le conflit "cannot add postgres_changes after subscribe()"
  // quand le hook est appelé dans plusieurs composants (MainApp + ActiveChat + LiveScoreTracker)
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // Fetch les pending results impliquant l'utilisateur
  const fetchPendingResults = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('pending_match_results')
        .select(`
          id, submitter_id, opponent_id, match_id,
          submitter_result, score, played_at, status, expires_at, created_at,
          submitter:submitter_id(id, name, photo_url),
          opponent:opponent_id(id, name, photo_url)
        `)
        .eq('status', 'pending')
        .or(`submitter_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      // Transforme les données pour faciliter l'affichage
      const transformed = (data || []).map(p => ({
        id: p.id,
        matchId: p.match_id,
        score: p.score,
        playedAt: new Date(p.played_at),
        expiresAt: new Date(p.expires_at),
        createdAt: new Date(p.created_at),
        isSubmitter: p.submitter_id === user.id,
        submitterResult: p.submitter_result,
        myResult: p.submitter_id === user.id
          ? p.submitter_result
          : (p.submitter_result === 'win'      ? 'loss'
           : p.submitter_result === 'loss'     ? 'win'
           : p.submitter_result === 'teammate' ? 'win'   // coéquipier → les deux gagnent
           : 'draw'),
        otherPlayer: p.submitter_id === user.id ? p.opponent : p.submitter,
      }))

      setPendingResults(transformed)

      // Charge aussi le statut (score_attempts, score_locked) des matchs concernés
      const matchIds = [...new Set((data || []).map(p => p.match_id).filter(Boolean))]
      if (matchIds.length > 0) {
        const { data: statuses } = await supabase
          .from('matches')
          .select('id, score_attempts, score_locked')
          .in('id', matchIds)
        if (statuses) {
          const map = {}
          statuses.forEach(m => { map[m.id] = { attempts: m.score_attempts, locked: m.score_locked } })
          setMatchStatuses(map)
        }
      }
    } catch (err) {
      console.error('Error fetching pending results:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Realtime : écoute les nouveaux pending et les changements de statut
  useEffect(() => {
    if (!user) return

    fetchPendingResults()

    const channel = supabase
      .channel(`pending-results-${user.id}-${instanceIdRef.current}`)
      .on('postgres_changes', {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'pending_match_results',
      }, (payload) => {
        // Filtre côté client : ne réagit que si le user est concerné
        const row = payload.new || payload.old
        if (row && (row.submitter_id === user.id || row.opponent_id === user.id)) {
          fetchPendingResults()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, fetchPendingResults])

  // Soumettre un nouveau score
  const submitResult = useCallback(async ({ opponentId, result, score, playedAt }) => {
    if (!user) {
      setError('Not authenticated')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc('submit_match_result', {
        p_opponent_id: opponentId,
        p_result: result, // 'win' | 'loss' | 'draw'
        p_score: score,
        p_played_at: playedAt || new Date().toISOString(),
      })

      if (rpcError) throw rpcError

      // Recharge la liste
      await fetchPendingResults()

      return { success: true, pendingId: data }
    } catch (err) {
      console.error('Error submitting result:', err)
      const msg = err.message || 'Failed to submit result'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [user?.id, fetchPendingResults])

  // Confirmer un score reçu
  const confirmResult = useCallback(async (pendingId) => {
    try {
      setLoading(true)
      setError(null)

      const { error: rpcError } = await supabase.rpc('confirm_match_result', {
        p_pending_id: pendingId,
      })

      if (rpcError) throw rpcError

      // Recharge la liste
      await fetchPendingResults()

      return { success: true }
    } catch (err) {
      console.error('Error confirming result:', err)
      const msg = err.message || 'Failed to confirm result'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [fetchPendingResults])

  // Rejeter un score reçu
  const rejectResult = useCallback(async (pendingId) => {
    try {
      setLoading(true)
      setError(null)

      const { error: rpcError } = await supabase.rpc('reject_match_result', {
        p_pending_id: pendingId,
      })

      if (rpcError) throw rpcError

      // Recharge la liste
      await fetchPendingResults()

      return { success: true }
    } catch (err) {
      console.error('Error rejecting result:', err)
      const msg = err.message || 'Failed to reject result'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [fetchPendingResults])

  // Helpers pour filtrer
  const pendingToConfirm = pendingResults.filter(p => !p.isSubmitter)
  const pendingAwaitingConfirmation = pendingResults.filter(p => p.isSubmitter)

  // Retourne le statut score d'un match (attempts, locked, remaining)
  const matchScoreStatus = useCallback(async (matchId) => {
    if (matchStatuses[matchId]) return matchStatuses[matchId]
    const { data } = await supabase
      .from('matches')
      .select('score_attempts, score_locked')
      .eq('id', matchId)
      .maybeSingle()
    if (data) {
      const status = { attempts: data.score_attempts, locked: data.score_locked }
      setMatchStatuses(prev => ({ ...prev, [matchId]: status }))
      return status
    }
    return { attempts: 0, locked: false }
  }, [matchStatuses])

  return {
    pendingResults,
    pendingToConfirm,
    pendingAwaitingConfirmation,
    matchStatuses,             // { [matchId]: { attempts, locked } }
    matchScoreStatus,          // fn async(matchId) → { attempts, locked }
    loading,
    error,
    submitResult,
    confirmResult,
    rejectResult,
    refetch: fetchPendingResults,
  }
}
