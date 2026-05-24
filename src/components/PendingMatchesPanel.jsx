import { useState } from 'react'
import { COURT, PadelBall, Ornament, BottomSheet } from './CourtUI'
import { supabase } from '../lib/supabase'
import { useMatchResults } from '../hooks/useMatchResults'

/**
 * Format le temps restant avant expiration (ex: "2j 4h", "3h", "12min")
 */
function formatTimeRemaining(expiresAt) {
  const diff = expiresAt.getTime() - Date.now()
  if (diff <= 0) return 'expiré'

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)

  if (days > 0) return `${days}j ${hours}h`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
}

/**
 * Card pour un score à confirmer (reçu de l'adversaire)
 */
function ScoreToConfirmCard({ pending, t, lang, dark, onConfirm, onReject, busy }) {
  const rtl = lang === 'he'
  const ink = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const card = dark ? COURT.darkCard : COURT.cream
  const border = dark ? COURT.darkBorder : `${COURT.green}40`
  const ff_serif = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif'
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif'

  const isWin = pending.myResult === 'win'
  const isLoss = pending.myResult === 'loss'
  const resultColor = isWin ? COURT.green : (isLoss ? COURT.purple : COURT.gold)
  const resultLabel = isWin ? t.youWon : (isLoss ? t.youLost : t.draw)

  return (
    <div style={{
      background: card, border: `0.5px solid ${border}`, borderRadius: 12,
      padding: '14px 16px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22, flexShrink: 0,
          background: `url(${pending.otherPlayer?.photo_url || `https://i.pravatar.cc/600?u=${pending.otherPlayer?.id}`}) center/cover`,
          border: `1.5px solid ${resultColor}`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ff_serif, fontSize: 17, color: ink, fontWeight: 500 }}>
            {pending.otherPlayer?.name || t.opponent}
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.12em' }}>
            {t.scoreSubmittedByThem} · {formatTimeRemaining(pending.expiresAt)}
          </div>
        </div>
      </div>

      {/* Score display */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '10px 0', margin: '8px 0',
        background: dark ? COURT.darkBg : `${COURT.cream}80`,
        borderRadius: 8, border: `0.5px solid ${border}`,
      }}>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 22, color: resultColor,
          fontWeight: 500, letterSpacing: '0.02em',
        }}>
          {pending.score}
        </div>
        <div style={{ width: 1, height: 24, background: border }} />
        <div style={{
          fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 13, color: resultColor, fontWeight: 600,
        }}>
          {resultLabel}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onReject(pending.id)}
          disabled={busy}
          style={{
            flex: 1, padding: '10px 12px',
            background: dark ? COURT.darkBg : 'transparent',
            color: COURT.purple,
            border: `0.5px solid ${COURT.purple}60`,
            borderRadius: 8,
            fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 13, cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          ✕ {t.reject}
        </button>
        <button
          onClick={() => onConfirm(pending.id)}
          disabled={busy}
          style={{
            flex: 2, padding: '10px 12px',
            background: COURT.green, color: COURT.cream,
            border: `0.5px solid ${COURT.green}`,
            borderRadius: 8,
            fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 13, cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <PadelBall size={14} shadow={false} /> {t.confirm}
        </button>
      </div>
    </div>
  )
}

/**
 * Card pour un score que j'ai soumis (en attente)
 */
function ScoreAwaitingCard({ pending, t, lang, dark }) {
  const rtl = lang === 'he'
  const ink = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const card = dark ? COURT.darkCard : COURT.cream
  const border = dark ? COURT.darkBorder : `${COURT.green}30`
  const ff_serif = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif'
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif'

  return (
    <div style={{
      background: card, border: `0.5px dashed ${border}`, borderRadius: 12,
      padding: '12px 14px', marginBottom: 10, opacity: 0.85,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: `url(${pending.otherPlayer?.photo_url || `https://i.pravatar.cc/600?u=${pending.otherPlayer?.id}`}) center/cover`,
          opacity: 0.7,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ff_serif, fontSize: 14, color: ink }}>
            {t.waitingConfirmFrom} <span style={{ fontStyle: rtl ? 'normal' : 'italic', color: COURT.green }}>{pending.otherPlayer?.name}</span>
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.1em', marginTop: 2 }}>
            {pending.score} · {t.expiresIn} {formatTimeRemaining(pending.expiresAt)}
          </div>
        </div>
        <div style={{
          fontFamily: 'Inter', fontSize: 9, color: stone,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          ⏳
        </div>
      </div>
    </div>
  )
}

/**
 * Panel principal — modal qui glisse depuis le bas
 * Affiche tous les pending match results de l'utilisateur
 */
export function PendingMatchesPanel({ t, lang, dark, onClose }) {
  const {
    pendingToConfirm,
    pendingAwaitingConfirmation,
    loading,
    error,
    confirmResult,
    rejectResult,
  } = useMatchResults()

  const [busy, setBusy] = useState(false)
  // Peer evaluation state: { matchId, playerId, playerName } | null
  const [evalPending, setEvalPending] = useState(null)
  const [evalRating, setEvalRating] = useState(4)
  const [evalSent, setEvalSent] = useState(false)
  const [evalSending, setEvalSending] = useState(false)
  const rtl = lang === 'he'
  const ink = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const ff_serif = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif'
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif'

  const handleConfirm = async (pendingId) => {
    // Find the pending item before confirming to extract match + player info
    const item = pendingToConfirm.find(p => p.id === pendingId)
    setBusy(true)
    const { error: err } = await confirmResult(pendingId)
    setBusy(false)
    if (err) { alert(`${t.error}: ${err}`); return }
    // Propose peer evaluation right after confirmation
    if (item) {
      setEvalPending({
        matchId: item.matchId,
        playerId: item.otherPlayer?.id,
        playerName: item.otherPlayer?.name || t.opponent,
        playerPhoto: item.otherPlayer?.photo_url,
      })
      setEvalRating(4)
      setEvalSent(false)
    }
  }

  const handleSendEval = async () => {
    if (!evalPending) return
    setEvalSending(true)
    try {
      await supabase.rpc('submit_peer_evaluation', {
        p_match_id: evalPending.matchId,
        p_evaluated_id: evalPending.playerId,
        p_rating: evalRating,
      })
    } catch (e) {
      console.warn('[peer_eval]', e)
    }
    setEvalSending(false)
    setEvalSent(true)
    setTimeout(() => setEvalPending(null), 1400)
  }

  const handleReject = async (pendingId) => {
    if (!confirm(t.confirmReject || 'Are you sure?')) return
    setBusy(true)
    const { error: err } = await rejectResult(pendingId)
    setBusy(false)
    if (err) alert(`${t.error}: ${err}`)
  }

  const hasContent = pendingToConfirm.length > 0 || pendingAwaitingConfirmation.length > 0

  return (
    <BottomSheet onClose={onClose} title={t.pendingMatches} dark={dark}>
      <div style={{ padding: '16px 20px 24px', minHeight: 200 }}>
        {/* Section : Scores à confirmer */}
        {pendingToConfirm.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Inter', fontSize: 10, color: COURT.green,
              letterSpacing: '0.24em', textTransform: 'uppercase',
              fontWeight: 600, marginBottom: 12,
            }}>
              ⚡ {t.toConfirm} ({pendingToConfirm.length})
            </div>
            {pendingToConfirm.map(p => (
              <ScoreToConfirmCard
                key={p.id} pending={p} t={t} lang={lang} dark={dark}
                onConfirm={handleConfirm} onReject={handleReject} busy={busy}
              />
            ))}
            <Ornament width={40} style={{ margin: '20px auto' }} />
          </>
        )}

        {/* Section : En attente de confirmation */}
        {pendingAwaitingConfirmation.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Inter', fontSize: 10, color: stone,
              letterSpacing: '0.24em', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              ⏳ {t.awaiting} ({pendingAwaitingConfirmation.length})
            </div>
            {pendingAwaitingConfirmation.map(p => (
              <ScoreAwaitingCard
                key={p.id} pending={p} t={t} lang={lang} dark={dark}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {!hasContent && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <PadelBall size={40} />
            <div style={{
              fontFamily: ff_serif, fontSize: 18, color: ink,
              fontStyle: rtl ? 'normal' : 'italic', marginTop: 16,
            }}>
              {t.noPendingMatches}
            </div>
            <div style={{
              fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, color: stone, marginTop: 6,
            }}>
              {t.noPendingHint}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && !hasContent && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 14, color: stone,
          }}>
            …
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            padding: '12px 14px', marginTop: 10,
            background: `${COURT.purple}15`,
            border: `0.5px solid ${COURT.purple}60`,
            borderRadius: 8,
            fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 13, color: COURT.purple,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Peer Evaluation overlay ─────────────────────────────────── */}
      {evalPending && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: dark ? 'rgba(18,26,21,0.95)' : 'rgba(245,241,232,0.97)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 24px',
        }}>
          {evalSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: COURT.green, margin: '0 0 6px' }}>
                {t.evalThanks}
              </p>
            </div>
          ) : (
            <>
              {/* Player avatar */}
              {evalPending.playerPhoto && (
                <div style={{
                  width: 72, height: 72, borderRadius: 36, marginBottom: 12,
                  background: `url(${evalPending.playerPhoto}) center/cover`,
                  border: `2px solid ${COURT.gold}60`,
                }} />
              )}
              <p style={{
                fontFamily: 'Playfair Display, serif', fontSize: 18,
                color: dark ? COURT.darkText : COURT.ink, margin: '0 0 4px', textAlign: 'center',
              }}>
                {t.rateMatch || 'Évaluer ce match'}
              </p>
              <p style={{
                fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
                fontSize: 14, color: dark ? COURT.darkMuted : COURT.stone,
                margin: '0 0 20px', textAlign: 'center',
              }}>
                {t.evalSub} {evalPending.playerName}
              </p>

              {/* Stars */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setEvalRating(star)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 34, padding: 2,
                      filter: star <= evalRating ? 'none' : 'grayscale(1) opacity(0.35)',
                      transition: 'filter 0.15s, transform 0.1s',
                      transform: star <= evalRating ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >⭐</button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 280 }}>
                <button
                  onClick={() => setEvalPending(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    background: 'transparent',
                    border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '40'}`,
                    fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
                    fontSize: 14, color: dark ? COURT.darkMuted : COURT.stone, cursor: 'pointer',
                  }}
                >
                  {t.skipEval || 'Passer'}
                </button>
                <button
                  onClick={handleSendEval}
                  disabled={evalSending}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 10,
                    background: COURT.green, color: COURT.cream, border: 'none',
                    fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
                    fontSize: 14, cursor: evalSending ? 'wait' : 'pointer',
                    opacity: evalSending ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <PadelBall size={14} shadow={false} />
                  {evalSending ? '…' : (t.evalSend || 'Envoyer')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
