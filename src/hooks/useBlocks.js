import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Modération — blocage & signalement.
//
// `blockedIds` = ensemble des UUID à masquer (dans les DEUX sens) :
//   • les gens que J'AI bloqués
//   • les gens qui M'ONT bloqué
// → chaque client masque l'autre des deux côtés (invisibilité mutuelle).
//
// Actions exposées (utilisent l'utilisateur courant automatiquement) :
//   blockUser(targetId)   · unblockUser(targetId)   · reportUser(targetId, reason, details)
// ─────────────────────────────────────────────────────────────────────────────
export function useBlocks() {
  const { user } = useAuth()
  const [blockedIds, setBlockedIds] = useState(() => new Set())
  const [blockedProfiles, setBlockedProfiles] = useState([])

  const refresh = useCallback(async () => {
    if (!user?.id) { setBlockedIds(new Set()); setBlockedProfiles([]); return }
    const { data: blockData, error } = await supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .eq('blocker_id', user.id)  // Seulement les MIENS (que JE ai bloqués)
    if (error || !blockData) { setBlockedProfiles([]); return }

    const ids = new Set()
    const blockedIds_arr = []
    for (const b of blockData) {
      ids.add(b.blocked_id)
      blockedIds_arr.push(b.blocked_id)
    }
    setBlockedIds(ids)

    // Récupère les profils complets des bloqués
    if (blockedIds_arr.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, photo_url, level, city, region')
        .in('id', blockedIds_arr)
      setBlockedProfiles(profiles || [])
    } else {
      setBlockedProfiles([])
    }
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  const blockUser = useCallback(async (targetId) => {
    if (!user?.id || !targetId) return { error: new Error('not_ready') }
    const res = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: targetId })
    if (!res.error) setBlockedIds(prev => new Set(prev).add(targetId))
    return res
  }, [user?.id])

  const unblockUser = useCallback(async (targetId) => {
    if (!user?.id || !targetId) return { error: new Error('not_ready') }
    const res = await supabase.from('blocks').delete()
      .eq('blocker_id', user.id).eq('blocked_id', targetId)
    if (!res.error) setBlockedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
    return res
  }, [user?.id])

  const reportUser = useCallback(async (targetId, reason, details = '') => {
    if (!user?.id || !targetId) return { error: new Error('not_ready') }
    return supabase.from('reports').insert({
      reporter_id: user.id, reported_id: targetId, reason, details,
    })
  }, [user?.id])

  return { blockedIds, blockedProfiles, refresh, blockUser, unblockUser, reportUser }
}
