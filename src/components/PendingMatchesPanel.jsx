import { useState } from 'react'
import { COURT, PadelBall, Ornament, BottomSheet, initialsAvatar } from './CourtUI'
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
 * Retourne le label textuel d'un niveau selon la langue
 */
function getLevelLabel(level, t) {
  if (level <= 2.0) return t.levelBeginner     || 'Débutant'
  if (level <= 3.5) return t.levelIntermediate || 'Intermédiaire'
  if (level <= 5.0) return t.levelConfirmed    || 'Confirmé'
  if (level <= 6.0) return t.levelAdvanced     || 'Avancé'
  return t.levelExpert || 'Expert'
}

/**
 * Card pour un score à confirmer (reçu de l'adversaire)
 */
function ScoreToConfirmCard({ pending, t, lang, dark, onConfirm, onReject, busy, rejectConfirmId, onCancelReject }) {
  const rtl = lang === 'he'
  const ink = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const card = dark ? COURT.darkCard : COURT.cream
  const border = dark ? COURT.darkBorder : `${COURT.green}40`
  const ff_serif = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  const isWin = pending.myResult === 'win'
  const isLoss = pending.myResult === 'loss'
  const resultColor = isWin ? COURT.green : (isLoss ? COURT.purple : COURT.gold)
  const resultLabel = isWin ? t.youWon : (isLoss ? t.youLost : t.draw)
  const awaitingRejectConfirm = rejectConfirmId === pending.id

  return (
    <div style={{
      background: card, border: `0.5px solid ${border}`, borderRadius: 12,
      padding: '14px 16px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22, flexShrink: 0,
          background: `url(${pending.otherPlayer?.photo_url || initialsAvatar(pending.otherPlayer?.name || pending.otherPlayer?.id)}) center/cover`,
          border: `1.5px solid ${resultColor}`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ff_serif, fontSize: 17, color: ink, fontWeight: 500 }}>
            {pending.otherPlayer?.name || t.opponent}
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.12em' }}>
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
          fontFamily: 'Spectral, serif', fontSize: 22, color: resultColor,
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
      {awaitingRejectConfirm ? (
        /* Confirmation inline du rejet — remplace le confirm() natif */
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: `${COURT.purple}10`, border: `0.5px solid ${COURT.purple}40` }}>
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: COURT.purple, marginBottom: 8, textAlign: 'center' }}>
            {lang === 'en' ? 'Confirm rejection?' : lang === 'he' ? 'אשר דחייה?' : 'Confirmer le refus ?'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancelReject} disabled={busy} style={{
              flex: 1, padding: '8px', borderRadius: 8, background: 'transparent',
              border: `0.5px solid ${border}`, color: stone,
              fontFamily: 'Mulish', fontSize: 12, cursor: 'pointer',
            }}>
              {lang === 'en' ? 'Cancel' : lang === 'he' ? 'ביטול' : 'Annuler'}
            </button>
            <button onClick={() => onReject(pending.id)} disabled={busy} style={{
              flex: 2, padding: '8px', borderRadius: 8,
              background: COURT.purple, border: 'none', color: COURT.cream,
              fontFamily: 'Mulish', fontSize: 12, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
            }}>
              {busy ? '…' : (lang === 'en' ? '✕ Reject' : lang === 'he' ? '✕ דחה' : '✕ Refuser')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => onReject(pending.id)}
            disabled={busy}
            style={{
              flex: 1, padding: '10px 12px',
              background: dark ? COURT.darkBg : 'transparent',
              color: COURT.purple, border: `0.5px solid ${COURT.purple}60`,
              borderRadius: 8, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
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
              border: `0.5px solid ${COURT.green}`, borderRadius: 8,
              fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <PadelBall size={14} shadow={false} /> {busy ? '…' : t.confirm}
          </button>
        </div>
      )}
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
  const ff_serif = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  return (
    <div style={{
      background: card, border: `0.5px dashed ${border}`, borderRadius: 12,
      padding: '12px 14px', marginBottom: 10, opacity: 0.85,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: `url(${pending.otherPlayer?.photo_url || initialsAvatar(pending.otherPlayer?.name || pending.otherPlayer?.id)}) center/cover`,
          opacity: 0.7,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ff_serif, fontSize: 14, color: ink }}>
            {t.waitingConfirmFrom} <span style={{ fontStyle: rtl ? 'normal' : 'italic', color: COURT.green }}>{pending.otherPlayer?.name}</span>
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.1em', marginTop: 2 }}>
            {pending.score} · {t.expiresIn} {formatTimeRemaining(pending.expiresAt)}
          </div>
        </div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 9, color: stone,
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
  const [panelError, setPanelError] = useState('')
  const [rejectConfirmId, setRejectConfirmId] = useState(null) // id en attente de confirmation de rejet
  // Peer evaluation state: { matchId, playerId, playerName, playerPhoto, playerCurrentLevel } | null
  const [evalPending, setEvalPending] = useState(null)
  const [evalProposedLevel, setEvalProposedLevel] = useState(3.5)
  const [evalSent, setEvalSent] = useState(false)
  const [evalSending, setEvalSending] = useState(false)
  const rtl = lang === 'he'
  const ink = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const ff_serif = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  const handleConfirm = async (pendingId) => {
    const item = pendingToConfirm.find(p => p.id === pendingId)
    setPanelError('')
    setBusy(true)
    const res = await confirmResult(pendingId)
    setBusy(false)
    if (!res.success) {
      setPanelError(res.error || (lang === 'en' ? 'Error — please try again' : 'Erreur — réessaie'))
      return
    }
    if (item) {
      const currentLevel = item.otherPlayer?.level ?? 3.5
      setEvalPending({
        matchId:            item.matchId,
        playerId:           item.otherPlayer?.id,
        playerName:         item.otherPlayer?.name || t.opponent,
        playerPhoto:        item.otherPlayer?.photo_url,
        playerCurrentLevel: currentLevel,
      })
      setEvalProposedLevel(currentLevel)
      setEvalSent(false)
    }
  }

  const handleSendEval = async () => {
    if (!evalPending) return
    setEvalSending(true)
    try {
      await supabase.rpc('submit_peer_evaluation', {
        p_match_id:       evalPending.matchId,
        p_evaluated_id:   evalPending.playerId,
        p_proposed_level: evalProposedLevel,
      })
    } catch (e) {
      console.warn('[peer_eval]', e)
    }
    setEvalSending(false)
    setEvalSent(true)
    setTimeout(() => setEvalPending(null), 1400)
  }

  const handleReject = async (pendingId) => {
    // 1er clic → demande confirmation inline (remplace confirm())
    if (rejectConfirmId !== pendingId) {
      setRejectConfirmId(pendingId)
      return
    }
    // 2ème clic → confirme le rejet
    setRejectConfirmId(null)
    setPanelError('')
    setBusy(true)
    const res = await rejectResult(pendingId)
    setBusy(false)
    if (!res.success) {
      setPanelError(res.error || (lang === 'en' ? 'Error — please try again' : 'Erreur — réessaie'))
    }
  }

  const hasContent = pendingToConfirm.length > 0 || pendingAwaitingConfirmation.length > 0

  return (
    <BottomSheet onClose={onClose} title={t.pendingMatches} dark={dark}>
      <div style={{ padding: '16px 20px 24px', minHeight: 200 }}>
        {/* Section : Scores à confirmer */}
        {pendingToConfirm.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Mulish', fontSize: 10, color: COURT.green,
              letterSpacing: '0.24em', textTransform: 'uppercase',
              fontWeight: 600, marginBottom: 12,
            }}>
              ⚡ {t.toConfirm} ({pendingToConfirm.length})
            </div>
            {panelError && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                background: `${COURT.purple}12`, border: `0.5px solid ${COURT.purple}40`,
                fontFamily: 'Mulish', fontSize: 12, color: COURT.purple,
              }}>
                ⚠️ {panelError}
              </div>
            )}
            {pendingToConfirm.map(p => (
              <ScoreToConfirmCard
                key={p.id} pending={p} t={t} lang={lang} dark={dark}
                onConfirm={handleConfirm} onReject={handleReject} busy={busy}
                rejectConfirmId={rejectConfirmId}
                onCancelReject={() => setRejectConfirmId(null)}
              />
            ))}
            <Ornament width={40} style={{ margin: '20px auto' }} />
          </>
        )}

        {/* Section : En attente de confirmation */}
        {pendingAwaitingConfirmation.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Mulish', fontSize: 10, color: stone,
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

      {/* ── Peer Evaluation overlay — slider de niveau ──────────────────── */}
      {evalPending && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: dark ? 'rgba(18,26,21,0.96)' : 'rgba(245,241,232,0.97)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 28px',
        }}>
          {evalSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
              <p style={{ fontFamily: 'Spectral, serif', fontSize: 20, color: COURT.green, margin: '0 0 6px' }}>
                {t.evalThanks}
              </p>
            </div>
          ) : (
            <>
              {/* Avatar */}
              {evalPending.playerPhoto && (
                <div style={{
                  width: 64, height: 64, borderRadius: 32, marginBottom: 14,
                  background: `url(${evalPending.playerPhoto}) center/cover`,
                  border: `2px solid ${COURT.gold}60`,
                }} />
              )}

              {/* Titre */}
              <p style={{
                fontFamily: 'Spectral, serif', fontSize: 18,
                color: ink, margin: '0 0 4px', textAlign: 'center',
              }}>
                {t.evalLevelTitle || 'Quel est son vrai niveau ?'}
              </p>
              <p style={{
                fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 13, color: stone, margin: '0 0 28px', textAlign: 'center',
              }}>
                {t.evalLevelSub || 'Évaluez honnêtement le niveau de'} {evalPending.playerName}
              </p>

              {/* Niveau affiché en grand */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 4,
                marginBottom: 8,
              }}>
                <span style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: 72, lineHeight: 1,
                  color: COURT.green, fontWeight: 600,
                }}>
                  {evalProposedLevel % 1 === 0 ? evalProposedLevel.toFixed(1) : evalProposedLevel}
                </span>
                <span style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: 22, color: stone, fontStyle: 'italic',
                }}>
                  /7
                </span>
              </div>

              {/* Label de description */}
              <div style={{
                fontFamily: 'Mulish', fontSize: 11, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: COURT.green,
                marginBottom: 20,
              }}>
                {getLevelLabel(evalProposedLevel, t)}
              </div>

              {/* Slider 1.0 → 7.0 pas 0.5 */}
              <div style={{ width: '100%', maxWidth: 280, position: 'relative', marginBottom: 32 }}>
                {/* Track de fond */}
                <div style={{
                  height: 3, borderRadius: 2,
                  background: dark ? COURT.darkBorder : `${COURT.green}25`,
                  width: '100%', position: 'absolute', top: '50%',
                  transform: 'translateY(-50%)',
                }} />
                {/* Track actif */}
                <div style={{
                  height: 3, borderRadius: 2,
                  background: COURT.green,
                  width: `${((evalProposedLevel - 1) / 6) * 100}%`,
                  position: 'absolute', top: '50%',
                  transform: 'translateY(-50%)',
                  transition: 'width 0.12s ease',
                }} />
                {/* Input range invisible par-dessus */}
                <input
                  type="range"
                  min="1" max="7" step="0.5"
                  value={evalProposedLevel}
                  onChange={e => setEvalProposedLevel(parseFloat(e.target.value))}
                  style={{
                    width: '100%', height: 28,
                    WebkitAppearance: 'none', appearance: 'none',
                    background: 'transparent', cursor: 'pointer',
                    position: 'relative', zIndex: 1,
                    outline: 'none',
                    // Thumb
                    // (styles thumb via CSS global — cf. index.css ou via ::pseudo)
                  }}
                />
                <style>{`
                  input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px; height: 20px;
                    border-radius: 50%;
                    background: ${COURT.green};
                    border: 2.5px solid ${dark ? COURT.darkCard : COURT.cream};
                    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
                    cursor: pointer;
                  }
                  input[type=range]::-moz-range-thumb {
                    width: 20px; height: 20px;
                    border-radius: 50%;
                    background: ${COURT.green};
                    border: 2.5px solid ${dark ? COURT.darkCard : COURT.cream};
                    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
                    cursor: pointer;
                  }
                `}</style>
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 280 }}>
                <button
                  onClick={() => setEvalPending(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10,
                    background: 'transparent',
                    border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '40'}`,
                    fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                    fontSize: 14, color: stone, cursor: 'pointer',
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
                    fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
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
