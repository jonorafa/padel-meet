import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COURT } from './CourtUI'
import { useProfilePhotos } from '../hooks/useProfilePhotos'
import { useMatchHistoryWithPlayer } from '../hooks/useMatchHistoryWithPlayer'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useBlocks } from '../hooks/useBlocks'
import { I18N } from '../data/courtData'
import { PhotoGallery } from './PhotoGallery'

// ── Libellés modération (signaler / bloquer) ──────────────────────────────────
const MOD_L = {
  fr: {
    report: 'Signaler', block: 'Bloquer',
    blockTitle: 'Bloquer ce joueur ?',
    blockBody: 'Vous ne verrez plus son profil et il ne pourra plus vous contacter.',
    confirmBlock: 'Bloquer', cancel: 'Annuler',
    reportTitle: 'Signaler ce joueur', reportBody: 'Pourquoi le signales-tu ?',
    blockedMsg: 'Joueur bloqué ✓', reportedMsg: 'Merci, signalement envoyé ✓',
    reasons: { harassment: 'Harcèlement / insultes', inappropriate: 'Contenu inapproprié', fake: 'Faux profil', spam: 'Spam / publicité', other: 'Autre' },
  },
  en: {
    report: 'Report', block: 'Block',
    blockTitle: 'Block this player?',
    blockBody: "You won't see their profile and they can't contact you anymore.",
    confirmBlock: 'Block', cancel: 'Cancel',
    reportTitle: 'Report this player', reportBody: 'Why are you reporting them?',
    blockedMsg: 'Player blocked ✓', reportedMsg: 'Thanks, report sent ✓',
    reasons: { harassment: 'Harassment / abuse', inappropriate: 'Inappropriate content', fake: 'Fake profile', spam: 'Spam / ads', other: 'Other' },
  },
  he: {
    report: 'דיווח', block: 'חסימה',
    blockTitle: 'לחסום את השחקן הזה?',
    blockBody: 'לא תראה יותר את הפרופיל שלו והוא לא יוכל ליצור איתך קשר.',
    confirmBlock: 'חסום', cancel: 'ביטול',
    reportTitle: 'דיווח על השחקן', reportBody: 'מדוע אתה מדווח עליו?',
    blockedMsg: 'השחקן נחסם ✓', reportedMsg: 'תודה, הדיווח נשלח ✓',
    reasons: { harassment: 'הטרדה / קללות', inappropriate: 'תוכן לא הולם', fake: 'פרופיל מזויף', spam: 'ספאם / פרסומת', other: 'אחר' },
  },
}

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/**
 * Full-screen modal — COURT design — to view another player's profile
 * Shows photos, stats, bio, preference tags, and match history
 *
 * Props:
 * - playerId: UUID
 * - onClose: Callback
 * - dark: Boolean
 */
export function DetailedProfileModal({ playerId, onClose = () => {}, dark = false }) {
  const { user } = useAuth()
  const { lang } = usePrefs()
  const t = I18N[lang] || I18N.fr
  const { photos: playerPhotos } = useProfilePhotos(playerId)
  const { matches: matchHistory, loading: historyLoading } = useMatchHistoryWithPlayer(user?.id, playerId)
  const { blockUser, reportUser } = useBlocks()

  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  // ── Modération ─────────────────────────────────────────────────
  const ML = MOD_L[lang] || MOD_L.fr
  const canModerate = !!user?.id && user.id !== playerId
  const [modSheet, setModSheet] = useState(null)  // null|'block'|'report'|'blocked'|'reported'
  const [modBusy, setModBusy] = useState(false)

  const doBlock = async () => {
    setModBusy(true)
    await blockUser(playerId)
    setModBusy(false)
    setModSheet('blocked')
    setTimeout(() => onClose(), 1200)
  }
  const doReport = async (reason) => {
    setModBusy(true)
    await reportUser(playerId, reason)
    setModBusy(false)
    setModSheet('reported')
  }

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        const { data: playerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', playerId)
          .maybeSingle()
        setPlayer(playerData)

        if (playerData) {
          const { data: statsData } = await supabase
            .rpc('get_player_stats', { player_id: playerId })
          setStats(statsData)
        }
      } catch (err) {
        console.error('Error fetching player data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPlayerData()
  }, [playerId])

  // ── Colors ─────────────────────────────────────────────────────
  const bg      = dark ? COURT.darkBg   : COURT.cream
  const card    = dark ? COURT.darkCard : COURT.creamDark
  const ink     = dark ? COURT.darkText : COURT.ink
  const muted   = dark ? COURT.darkMuted: COURT.stone
  const border  = dark ? COURT.darkBorder : `${COURT.green}28`

  // ── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(245,241,232,0.8)',
      }}>
        <div style={{
          borderRadius: 16, padding: 32, background: bg,
          border: `0.5px solid ${border}`,
        }}>
          <div style={{
            width: 44, height: 44, border: `3px solid ${COURT.green}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(245,241,232,0.8)',
      }}>
        <div style={{ borderRadius: 16, padding: 24, background: bg, border: `0.5px solid ${border}` }}>
          <p style={{ fontFamily: 'Mulish', color: ink }}>{t.playerNotFound || 'Joueur introuvable'}</p>
          <button
            onClick={onClose}
            style={{
              marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 10,
              background: card, border: `0.5px solid ${border}`,
              fontFamily: 'Mulish', fontWeight: 600, color: ink, cursor: 'pointer',
            }}
          >{t.close || 'Fermer'}</button>
        </div>
      </div>
    )
  }

  const winrate = stats?.matches_played > 0
    ? Math.round((stats.wins / stats.matches_played) * 100)
    : null
  const bio = player[`bio_${lang}`] || player.bio_fr || ''

  const labelFor = (key) => key ? (t[key] || key) : '—'
  const handLabel  = player.dominant_hand === 'left' ? (t.leftHand || 'Gaucher') : (t.rightHand || 'Droitier')
  const sideLabel  = player.preferred_side === 'forehand' ? (t.forehand || 'Drive')
                   : player.preferred_side === 'backhand' ? (t.backhand || 'Revers')
                   : labelFor(player.preferred_side)
  const styleLabel = labelFor(player.play_style)
  const motivMap   = { fun: t.fun || 'Le plaisir', improve: t.improve || 'Progresser', compete: t.compete || 'Compétition' }
  const motivLabel = player.motivation ? (motivMap[player.motivation] || player.motivation) : '—'

  // ── Ce que ce joueur recherche (partenaire idéal) ───────────────
  const styleMap = { aggressive: t.aggressive || 'Offensif', defensive: t.defensive || 'Défensif', 'all-court': t.allcourt || 'Polyvalent' }
  const prefs = player.partner_prefs || {}
  const prefHand   = prefs.hand  && prefs.hand  !== 'any' ? (prefs.hand === 'left' ? (t.leftHand || 'Gaucher') : (t.rightHand || 'Droitier')) : null
  const prefSide   = prefs.side  && prefs.side  !== 'any' ? (prefs.side === 'forehand' ? (t.forehand || 'Drive') : (t.backhand || 'Revers')) : null
  const prefStyle  = prefs.style && prefs.style !== 'any' ? (styleMap[prefs.style] || prefs.style) : null
  const prefRegion = prefs.region && prefs.region !== 'any' ? prefs.region : null
  const prefMotiv  = prefs.motivation && prefs.motivation !== 'any' ? (motivMap[prefs.motivation] || prefs.motivation) : null
  const prefLevel  = (prefs.levelMin != null && prefs.levelMax != null && (prefs.levelMin > 1 || prefs.levelMax < 7))
    ? `${prefs.levelMin}–${prefs.levelMax}` : null
  const hasPrefs   = prefHand || prefSide || prefStyle || prefRegion || prefMotiv || prefLevel

  // ── Tableau hairline Mon jeu / Je recherche ────────────────────
  const myGameLabel   = lang === 'en' ? 'His game'   : lang === 'he' ? 'המשחק שלו' : 'Son jeu'
  const seekingLabel  = lang === 'en' ? 'He seeks'   : lang === 'he' ? 'הוא מחפש'  : 'Il recherche'

  const profileRows = [
    {
      icon: '✦',
      label: t.currentLevel || 'Niveau',
      mine:  player.level != null ? Number(player.level).toFixed(1) : '—',
      seeks: (prefs.levelMin != null && prefs.levelMax != null && (prefs.levelMin > 1 || prefs.levelMax < 7))
        ? `${prefs.levelMin}–${prefs.levelMax}` : null,
    },
    {
      icon: '📍',
      label: t.regionLabel || 'Région',
      mine:  player.region || player.city || '—',
      seeks: prefs.region && prefs.region !== 'any' ? prefs.region : null,
    },
    {
      icon: '👊',
      label: t.hand || 'Main',
      mine:  player.dominant_hand ? handLabel : '—',
      seeks: prefs.hand && prefs.hand !== 'any'
        ? (prefs.hand === 'left' ? (t.leftHand || 'Gaucher') : (t.rightHand || 'Droitier')) : null,
    },
    {
      icon: '🎾',
      label: t.side || 'Côté',
      mine:  player.preferred_side ? sideLabel : '—',
      seeks: prefs.side && prefs.side !== 'any'
        ? (prefs.side === 'forehand' ? (t.forehand || 'Drive') : (t.backhand || 'Revers')) : null,
    },
    {
      icon: '⚡',
      label: t.playerStyle || 'Style',
      mine:  player.play_style ? (styleMap[player.play_style] || player.play_style) : '—',
      seeks: prefs.style && prefs.style !== 'any' ? (styleMap[prefs.style] || prefs.style) : null,
    },
    {
      icon: '🎯',
      label: t.motivation || 'Motivation',
      mine:  player.motivation ? (motivMap[player.motivation] || player.motivation) : '—',
      seeks: prefs.motivation && prefs.motivation !== 'any' ? (motivMap[prefs.motivation] || prefs.motivation) : null,
    },
  ]

  const fallbackPhotos = (!playerPhotos || playerPhotos.length === 0) && player.photo_url
    ? [{ id: 'fallback', url: player.photo_url, is_primary: true }]
    : null
  const photosToShow = playerPhotos && playerPhotos.length > 0 ? playerPhotos : fallbackPhotos

  const rtl = lang === 'he'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', background: bg,
    }}>
      {/* ─── HEADER AGRANDI + PROFILE INFO ─── */}
      <div style={{
        padding: '28px 24px 32px', borderBottom: `0.5px solid ${border}`,
        display: 'flex', alignItems: 'flex-start', gap: 20,
        position: 'relative',
      }}>
        {/* Photo grande à gauche */}
        <div style={{
          width: 110, height: 110, minWidth: 110, borderRadius: 16, flexShrink: 0,
          background: player.photo_url
            ? `url(${player.photo_url}) center/cover`
            : card,
          border: `1.5px solid ${border}`,
        }} />

        {/* Infos à droite : nom + age + région + niveau */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{
            fontFamily: 'Spectral, serif', fontSize: 28, fontWeight: 800,
            color: ink, margin: 0, lineHeight: 1,
          }}>
            {player.name || player.username || 'Joueur'}
          </h2>
          <p style={{ fontFamily: 'Mulish', fontSize: 14, color: muted, margin: 0, whiteSpace: 'nowrap', fontWeight: 500 }}>
            {player.age ? `${player.age} ans` : ''}
            {player.age && (player.region || player.city) ? ' · ' : ''}
            {player.region || player.city || ''}
          </p>
          {player.level != null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              background: `${COURT.green}18`, border: `0.5px solid ${COURT.green}40`,
              width: 'fit-content',
              marginTop: 4,
            }}>
              <span style={{ fontFamily: 'Mulish', fontSize: 11, color: muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                {t.currentLevel || 'Niveau'}
              </span>
              <span style={{ fontFamily: 'Spectral, serif', fontSize: 20, fontWeight: 700, color: COURT.green, fontStyle: 'italic' }}>
                {player.level.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          style={{
            width: 40, height: 40, borderRadius: 12, border: `0.5px solid ${border}`,
            background: card, color: ink, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <XIcon />
        </button>
      </div>

      {/* ─── CONTENU PRINCIPAL (scroll si besoin) ─── */}
      <div style={{ flex: 1, overflowY: 'auto', background: bg, padding: '24px 16px 16px' }}>
        {/* Stats compactes si présentes */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { value: stats.matches_played || 0, label: t.matches || 'Matchs' },
              { value: stats.wins || 0,           label: t.wins || 'Victoires' },
              { value: winrate !== null ? `${winrate}%` : '—', label: t.winrate || 'Winrate' },
            ].map(({ value, label }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '14px 10px', borderRadius: 12,
                background: card, border: `0.5px solid ${border}`,
              }}>
                <p style={{
                  fontFamily: 'Spectral, serif', fontSize: 20, fontWeight: 800,
                  color: COURT.green, margin: '0 0 4px',
                }}>{value}</p>
                <p style={{ fontFamily: 'Mulish', fontSize: 10, color: muted, margin: 0, fontWeight: 600 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mon jeu + Il recherche */}
        {(player.dominant_hand || player.preferred_side || player.play_style || player.motivation || player.level != null) && (
          <div>
            {/* En-têtes */}
            <div style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 1fr',
              gap: '0 16px', marginBottom: 14, paddingBottom: 12,
              borderBottom: `0.5px solid ${border}`,
            }}>
              <div />
              <div style={{
                fontFamily: 'Mulish', fontSize: 11, fontWeight: 700,
                color: COURT.green, letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>
                {myGameLabel}
              </div>
              <div style={{
                fontFamily: 'Mulish', fontSize: 11, fontWeight: 700,
                color: COURT.purple, letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>
                {seekingLabel}
              </div>
            </div>

            {/* Lignes */}
            {profileRows.map(({ icon, label, mine, seeks }, i) => (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 1fr',
                gap: '0 16px', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < profileRows.length - 1 ? `0.5px solid ${border}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, opacity: 0.7 }}>
                  {icon}
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Mulish', fontSize: 10,
                    color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2, fontWeight: 600,
                  }}>{label}</div>
                  <div style={{
                    fontFamily: 'Spectral, serif', fontStyle: 'italic',
                    fontSize: 16, fontWeight: mine === '—' ? 400 : 600,
                    color: mine === '—' ? muted : COURT.green,
                  }}>{mine}</div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Mulish', fontSize: 10,
                    color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2, fontWeight: 600,
                  }}>{label}</div>
                  <div style={{
                    fontFamily: 'Spectral, serif', fontStyle: 'italic',
                    fontSize: 16, fontWeight: seeks == null ? 400 : 600,
                    color: seeks == null ? muted : COURT.purple,
                  }}>
                    {seeks ?? '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{ borderTop: `0.5px solid ${border}`, padding: '14px 16px' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: card, border: `0.5px solid ${border}`,
            fontFamily: 'Mulish', fontSize: 15, fontWeight: 600, color: ink,
            cursor: 'pointer',
          }}
        >
          {t.close || 'Fermer'}
        </button>

        {/* Modération : signaler / bloquer (discret) */}
        {canModerate && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12 }}>
            <button onClick={() => setModSheet('report')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Mulish', fontSize: 12.5, fontWeight: 600, color: muted,
            }}>{ML.report}</button>
            <span style={{ color: border }}>·</span>
            <button onClick={() => setModSheet('block')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Mulish', fontSize: 12.5, fontWeight: 600, color: '#C0392B',
            }}>{ML.block}</button>
          </div>
        )}
      </div>

      {/* ─── ACTION SHEET MODÉRATION ─── */}
      {modSheet && (
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          onClick={() => !modBusy && setModSheet(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 320, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 430, background: bg,
              borderRadius: '20px 20px 0 0', padding: '20px 18px 28px',
              borderTop: `0.5px solid ${border}`,
            }}
          >
            {/* Confirmation de blocage */}
            {modSheet === 'block' && (
              <>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 19, fontWeight: 800, color: ink, marginBottom: 6 }}>{ML.blockTitle}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: muted, marginBottom: 18, lineHeight: 1.5 }}>{ML.blockBody}</div>
                <button disabled={modBusy} onClick={doBlock} style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, marginBottom: 10,
                  background: '#C0392B', border: 'none', color: '#fff',
                  fontFamily: 'Mulish', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>{ML.confirmBlock}</button>
                <button disabled={modBusy} onClick={() => setModSheet(null)} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: card, border: `0.5px solid ${border}`, color: ink,
                  fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{ML.cancel}</button>
              </>
            )}

            {/* Choix du motif de signalement */}
            {modSheet === 'report' && (
              <>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 19, fontWeight: 800, color: ink, marginBottom: 6 }}>{ML.reportTitle}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: muted, marginBottom: 16 }}>{ML.reportBody}</div>
                {Object.entries(ML.reasons).map(([key, label]) => (
                  <button key={key} disabled={modBusy} onClick={() => doReport(key)} style={{
                    width: '100%', padding: '13px 14px', borderRadius: 12, marginBottom: 8,
                    background: card, border: `0.5px solid ${border}`, color: ink,
                    fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textAlign: rtl ? 'right' : 'left',
                  }}>{label}</button>
                ))}
                <button disabled={modBusy} onClick={() => setModSheet(null)} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, marginTop: 4,
                  background: 'none', border: 'none', color: muted,
                  fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{ML.cancel}</button>
              </>
            )}

            {/* Confirmations */}
            {(modSheet === 'blocked' || modSheet === 'reported') && (
              <div style={{
                fontFamily: 'Spectral, serif', fontSize: 18, fontWeight: 700,
                color: COURT.green, textAlign: 'center', padding: '12px 0',
              }}>
                {modSheet === 'blocked' ? ML.blockedMsg : ML.reportedMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
