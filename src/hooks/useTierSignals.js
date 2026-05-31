import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Calcule les 3 signaux de promotion / descente de niveau.
 *
 *  Signal 1 — Peer Ratings (60%, signal principal)
 *    Parmi les 5 dernières évaluations reçues, combien d'adversaires ont
 *    proposé un niveau > niveau actuel (= jugent le joueur au-dessus).
 *    Seuil : ≥ 3/5 pour déclencher la promotion.
 *
 *  Signal 2 — Confidence / Couverture (gate bloquant)
 *    (total évals reçues) / (total matchs joués) × 100.
 *    Seuil : ≥ 70 % pour permettre une montée.
 *    En dessous : niveau "provisoire", aucun changement autorisé.
 *
 *  Signal 3 — Win Rate (40%, signal secondaire)
 *    % victoires contre adversaires de niveau ≥ playerLevel − 0.5
 *    sur les 10 derniers matchs.
 *    Seuil : ≥ 55 %.
 *
 *  Promotion : les 3 conditions simultanément remplies.
 *  Descente   : 4/7 dernières évals < niveau actuel ET coverage ≥ 60 %.
 *
 * @param {number|null} playerLevel - niveau actuel (profile.level)
 * @returns {object|null} signals — null pendant le chargement
 */
export function useTierSignals(playerLevel) {
  const { user } = useAuth()
  const [signals, setSignals] = useState(null)

  useEffect(() => {
    if (!user || playerLevel == null) {
      setSignals(null)
      return
    }

    let cancelled = false

    const fetchSignals = async () => {
      const [evalsRes, matchesRes, evalCountRes, matchCountRes] = await Promise.all([
        // 7 dernières évals reçues (5 pour signal 1, 7 pour détection descente)
        supabase
          .from('peer_evaluations')
          .select('proposed_level, created_at')
          .eq('evaluated_id', user.id)
          .order('created_at', { ascending: false })
          .limit(7),

        // 10 derniers matchs avec niveau adversaire (pour win rate)
        supabase
          .from('match_history')
          .select('result, opponent:opponent_id(id, level)')
          .eq('player_id', user.id)
          .order('played_at', { ascending: false })
          .limit(10),

        // Nombre total d'évaluations reçues (pour coverage)
        supabase
          .from('peer_evaluations')
          .select('id', { count: 'exact', head: true })
          .eq('evaluated_id', user.id),

        // Nombre total de matchs joués (pour coverage)
        supabase
          .from('match_history')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', user.id),
      ])

      if (cancelled) return

      const evalsAll    = evalsRes.data   || []
      const matches10   = matchesRes.data  || []
      const totalEvals  = evalCountRes.count  ?? 0
      const totalMatchs = matchCountRes.count ?? 0

      // ── Signal 1 : Peer Ratings ───────────────────────────────────────────
      const peer5     = evalsAll.slice(0, 5)
      const peerAbove = peer5.filter(e => e.proposed_level > playerLevel).length
      const peerMet   = peerAbove >= 3

      // ── Signal 2 : Couverture (gate) ──────────────────────────────────────
      const covPct = totalMatchs > 0
        ? Math.min(100, Math.round((totalEvals / totalMatchs) * 100))
        : 0
      const covMet = covPct >= 70

      // ── Signal 3 : Win rate vs niv. ≥ playerLevel − 0.5 ─────────────────
      const floor     = Math.round((playerLevel - 0.5) * 10) / 10
      const sameLvl   = matches10.filter(
        m => m.opponent?.level != null && m.opponent.level >= floor
      )
      const sameLvlW  = sameLvl.filter(m => m.result === 'win').length
      const wrPct     = sameLvl.length > 0
        ? Math.round((sameLvlW / sameLvl.length) * 100)
        : 0
      const wrMet     = wrPct >= 55

      // ── Risque de descente (7 dernières évals) ────────────────────────────
      const belowCount = evalsAll.filter(e => e.proposed_level < playerLevel).length
      const demoRisk   = belowCount >= 4 && covPct >= 60

      setSignals({
        peer: {
          above: peerAbove,
          total: peer5.length,  // nombre d'évals disponibles (0-5)
          met:   peerMet,
        },
        coverage: {
          pct: covPct,
          met: covMet,
        },
        winRate: {
          pct:   wrPct,
          total: sameLvl.length,
          wins:  sameLvlW,
          floor,
          met:   wrMet,
        },
        promotionReady: peerMet && covMet && wrMet,
        demotionRisk:   demoRisk,
        hasData:        peer5.length > 0 || sameLvl.length > 0,
      })
    }

    fetchSignals()
    return () => { cancelled = true }
  }, [user?.id, playerLevel])

  return signals
}
