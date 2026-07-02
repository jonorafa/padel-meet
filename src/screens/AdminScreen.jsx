import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { COURT, initialsAvatar } from '../components/CourtUI'

// ─────────────────────────────────────────────────────────────────────────────
// Back-office modération — /admin (réservé aux comptes is_admin).
// Liste les signalements (table reports) et permet de les traiter :
//   open → reviewed | actioned | dismissed
// La RLS (migration 020) garantit que seuls les admins voient tout ; pour un
// non-admin la requête renvoie simplement ses propres signalements → on
// bloque aussi l'accès côté client via profile.is_admin.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  open:      { label: 'À traiter', color: '#C0392B' },
  reviewed:  { label: 'Examiné',   color: '#B8860B' },
  actioned:  { label: 'Sanctionné',color: '#1F5C3F' },
  dismissed: { label: 'Classé',    color: '#7A7A72' },
}
const REASON_LABELS = {
  harassment: 'Harcèlement', fake: 'Faux profil', inappropriate: 'Contenu inapproprié',
  spam: 'Spam', other: 'Autre',
}

export default function AdminScreen() {
  const { profile, loading: authLoading } = useAuth()
  const { dark } = usePrefs()
  const navigate = useNavigate()

  const [reports, setReports] = useState(null)   // null = chargement
  const [filter, setFilter]   = useState('open')
  const [busyId, setBusyId]   = useState(null)

  const bg     = dark ? COURT.darkBg     : COURT.cream
  const card   = dark ? COURT.darkCard   : '#ffffff'
  const ink    = dark ? COURT.darkText   : COURT.ink
  const stone  = dark ? COURT.darkMuted  : COURT.stone
  const border = dark ? COURT.darkBorder : COURT.green + '25'

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        id, reason, details, status, created_at,
        reporter:profiles!reporter_id (id, name, photo_url),
        reported:profiles!reported_id (id, name, photo_url)
      `)
      .order('created_at', { ascending: false })
    setReports(error ? [] : (data || []))
  }, [])

  useEffect(() => { if (profile?.is_admin) load() }, [profile?.is_admin, load])

  // Garde d'accès : attend le profil, puis éjecte les non-admins
  if (authLoading) return null
  if (!profile?.is_admin) {
    navigate('/app', { replace: true })
    return null
  }

  const setStatus = async (id, status) => {
    setBusyId(id)
    const { error } = await supabase.from('reports').update({ status }).eq('id', id)
    if (!error) setReports(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    setBusyId(null)
  }

  const shown = (reports || []).filter(r => filter === 'all' || r.status === filter)
  const counts = (reports || []).reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 18px', borderBottom: `0.5px solid ${border}`, flexShrink: 0,
      }}>
        <button onClick={() => navigate('/app')} style={{
          width: 38, height: 38, borderRadius: 10, border: `0.5px solid ${border}`,
          background: 'transparent', color: ink, cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} aria-label="Retour">←</button>
        <div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 700, color: ink }}>Modération</div>
          <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone }}>
            {reports === null ? 'Chargement…' : `${counts.open || 0} à traiter · ${reports.length} au total`}
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 18px', flexWrap: 'wrap', flexShrink: 0 }}>
        {['open', 'reviewed', 'actioned', 'dismissed', 'all'].map(f => {
          const active = filter === f
          const label = f === 'all' ? 'Tous' : STATUS_META[f].label
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              border: `0.5px solid ${active ? COURT.green : border}`,
              background: active ? COURT.green : 'transparent',
              color: active ? '#fff' : stone,
              fontFamily: 'Mulish', fontSize: 12, fontWeight: 600,
            }}>
              {label}{f !== 'all' && counts[f] ? ` · ${counts[f]}` : ''}
            </button>
          )
        })}
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 40px', WebkitOverflowScrolling: 'touch' }}>
        {reports === null ? null : shown.length === 0 ? (
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, textAlign: 'center', marginTop: 40 }}>
            Aucun signalement dans cette catégorie.
          </div>
        ) : shown.map(r => {
          const meta = STATUS_META[r.status] || STATUS_META.open
          return (
            <div key={r.id} style={{
              background: card, border: `0.5px solid ${border}`, borderRadius: 14,
              padding: 14, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              {/* Signalé */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <img
                  src={r.reported?.photo_url || initialsAvatar(r.reported?.name || '?')}
                  alt="" style={{ width: 38, height: 38, borderRadius: 19, objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Spectral, serif', fontSize: 15, fontWeight: 700, color: ink }}>
                    {r.reported?.name || 'Profil supprimé'}
                  </div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone }}>
                    signalé par {r.reporter?.name || 'Profil supprimé'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <span style={{
                  fontFamily: 'Mulish', fontSize: 10.5, fontWeight: 700, color: '#fff',
                  background: meta.color, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>{meta.label}</span>
              </div>

              {/* Motif */}
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: ink, marginBottom: r.details ? 4 : 10 }}>
                <b>{REASON_LABELS[r.reason] || r.reason}</b>
              </div>
              {r.details && (
                <div style={{ fontFamily: 'Mulish', fontSize: 12.5, color: stone, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                  « {r.details} »
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_META).filter(([s]) => s !== r.status).map(([s, m]) => (
                  <button key={s} disabled={busyId === r.id} onClick={() => setStatus(r.id, s)} style={{
                    padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                    border: `0.5px solid ${m.color}55`, background: 'transparent',
                    color: m.color, fontFamily: 'Mulish', fontSize: 12, fontWeight: 600,
                    opacity: busyId === r.id ? 0.5 : 1,
                  }}>{m.label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
