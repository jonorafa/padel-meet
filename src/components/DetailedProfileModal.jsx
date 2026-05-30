import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COURT } from './CourtUI'
import { useProfilePhotos } from '../hooks/useProfilePhotos'
import { useMatchHistoryWithPlayer } from '../hooks/useMatchHistoryWithPlayer'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { I18N } from '../data/courtData'
import { PhotoGallery } from './PhotoGallery'

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

  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

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
          <p style={{ fontFamily: 'Inter', color: ink }}>{t.playerNotFound || 'Joueur introuvable'}</p>
          <button
            onClick={onClose}
            style={{
              marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 10,
              background: card, border: `0.5px solid ${border}`,
              fontFamily: 'Inter', fontWeight: 600, color: ink, cursor: 'pointer',
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

  const fallbackPhotos = (!playerPhotos || playerPhotos.length === 0) && player.photo_url
    ? [{ id: 'fallback', url: player.photo_url, is_primary: true }]
    : null
  const photosToShow = playerPhotos && playerPhotos.length > 0 ? playerPhotos : fallbackPhotos

  // Chip for preference tags
  const PrefChip = ({ label, value, color = COURT.green }) => (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: card, border: `0.5px solid ${border}`,
    }}>
      <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color, margin: 0 }}>
        {value}
      </p>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', background: bg,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: `0.5px solid ${border}`,
      }}>
        <div style={{ width: 40 }} />
        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700,
          color: ink, margin: 0,
        }}>
          {t.profile || 'Profil'}
        </h1>
        <button
          onClick={onClose}
          style={{
            width: 40, height: 40, borderRadius: 10, border: `0.5px solid ${border}`,
            background: card, color: ink, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <XIcon />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', background: bg }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Photos */}
          {photosToShow ? (
            <PhotoGallery photos={photosToShow} dark={dark} />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1 / 1', borderRadius: 12,
              background: card, border: `0.5px solid ${border}`,
            }}>
              <p style={{ fontFamily: 'Inter', color: muted }}>{t.noPhotos || 'Aucune photo'}</p>
            </div>
          )}

          {/* Player info */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: card, border: `0.5px solid ${border}`,
          }}>
            <h2 style={{
              fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 800,
              color: ink, margin: '0 0 4px',
            }}>
              {player.name || player.username || 'Joueur'}
            </h2>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: muted, margin: 0 }}>
              {player.age ? `${player.age} ans` : ''}
              {player.age && (player.region || player.city) ? ' · ' : ''}
              {player.region || player.city || ''}
            </p>
          </div>

          {/* Bio */}
          {bio && (
            <div>
              <p style={{
                fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: muted,
                textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px',
              }}>
                {t.bio || 'Bio'}
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: ink, lineHeight: 1.6, margin: 0 }}>
                {bio}
              </p>
            </div>
          )}

          {/* Stats grid */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { value: stats.matches_played || 0, label: t.matches || 'Matchs' },
                { value: stats.wins || 0,           label: t.wins || 'Victoires' },
                { value: winrate !== null ? `${winrate}%` : '—', label: t.winrate || 'Winrate' },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  textAlign: 'center', padding: '12px 8px', borderRadius: 10,
                  background: card, border: `0.5px solid ${border}`,
                }}>
                  <p style={{
                    fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 800,
                    color: COURT.green, margin: '0 0 4px',
                  }}>{value}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11, color: muted, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Preference chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {player.level != null && (
              <PrefChip label={t.currentLevel || 'Niveau'} value={Number(player.level).toFixed(1)} color={COURT.green} />
            )}
            {(player.region || player.city) && (
              <PrefChip label={t.regionLabel || 'Région'} value={player.region || player.city} color={COURT.gold} />
            )}
            {player.motivation && (
              <PrefChip label={t.motivation || 'Motivation'} value={motivLabel} color={COURT.green} />
            )}
            {player.dominant_hand && (
              <PrefChip label={t.hand || 'Main'} value={handLabel} color={COURT.green} />
            )}
            {player.preferred_side && (
              <PrefChip label={t.side || 'Côté'} value={sideLabel} color={COURT.gold} />
            )}
            {player.play_style && (
              <PrefChip label={t.style || 'Style'} value={styleLabel} color={COURT.purple} />
            )}
          </div>

          {/* ── Ce qu'il/elle recherche (partenaire idéal) ────────────── */}
          {hasPrefs && (
            <div>
              <p style={{
                fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: muted,
                textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px',
              }}>
                {t.lookingFor || 'Recherche'} · {t.partnerPrefsTitle || 'Le partenaire idéal'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {prefRegion && <PrefChip label={t.regionLabel || 'Région'} value={prefRegion} color={COURT.gold} />}
                {prefLevel  && <PrefChip label={t.levelRange || 'Plage de niveau'} value={prefLevel} color={COURT.green} />}
                {prefMotiv  && <PrefChip label={t.motivation || 'Motivation'} value={prefMotiv} color={COURT.green} />}
                {prefStyle  && <PrefChip label={t.style || 'Style'} value={prefStyle} color={COURT.purple} />}
                {prefHand   && <PrefChip label={t.hand || 'Main'} value={prefHand} color={COURT.green} />}
                {prefSide   && <PrefChip label={t.side || 'Côté'} value={prefSide} color={COURT.gold} />}
              </div>
            </div>
          )}

          {/* Match history */}
          {!historyLoading && matchHistory && matchHistory.length > 0 && (
            <div>
              <h3 style={{
                fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 700,
                color: ink, margin: '0 0 12px',
              }}>
                {t.matchHistoryWith || 'Historique avec'} {player.name || player.username || ''}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matchHistory.map(match => {
                  const isWin  = match.result === 'win'
                  const isLoss = match.result === 'loss'
                  const resultColor = isWin ? COURT.greenLight : isLoss ? COURT.red : muted
                  return (
                    <div
                      key={match.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 10,
                        background: card, border: `0.5px solid ${border}`,
                      }}
                    >
                      <div>
                        <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: ink, margin: '0 0 2px' }}>
                          {isWin  ? `✓ ${t.youWon  || 'Victoire'}`
                         : isLoss ? `✗ ${t.youLost || 'Défaite'}`
                         : (t.draw || 'Égalité')}
                        </p>
                        <p style={{ fontFamily: 'Inter', fontSize: 12, color: muted, margin: 0 }}>
                          {match.playedAt
                            ? match.playedAt.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-US')
                            : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: resultColor, margin: '0 0 2px' }}>
                          {match.score || '—'}
                        </p>
                        {match.eloDelta != null && (
                          <p style={{ fontFamily: 'Inter', fontSize: 11, color: match.eloDelta >= 0 ? COURT.greenLight : COURT.red, margin: 0 }}>
                            {match.eloDelta >= 0 ? '+' : ''}{match.eloDelta}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `0.5px solid ${border}`, padding: '12px 16px' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: card, border: `0.5px solid ${border}`,
            fontFamily: 'Inter', fontSize: 15, fontWeight: 600, color: ink,
            cursor: 'pointer',
          }}
        >
          {t.close || 'Fermer'}
        </button>
      </div>
    </div>
  )
}
