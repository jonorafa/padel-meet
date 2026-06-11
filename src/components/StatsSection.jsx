import { COURT } from '../components/CourtUI'
import { usePrefs }        from '../context/PrefsContext'
import { useAuth }         from '../context/AuthContext'
import { usePlayerStats }  from '../hooks/usePlayerStats'
import EvolutionChart      from './EvolutionChart'

// ─── Composant principal ──────────────────────────────────────────────────────
export default function StatsSection() {
  const { lang, dark, level, confidence } = usePrefs()
  const { profile }  = useAuth()
  const { stats }    = usePlayerStats()
  const rtl          = lang === 'he'

  // ── Vraies données ──────────────────────────────────────────────────────────
  const matchCount    = stats?.matchesPlayed ?? 0
  const wins          = stats?.wins          ?? 0
  const winRate       = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0
  const streak        = profile?.streak_current ?? 0          // jours consécutifs
  const currentLevel  = level  ?? 4.0
  const confScore     = Math.round(confidence ?? 0)           // 0–100
  const confLeft      = Math.max(0, 10 - matchCount)          // matchs pour vérifier le niveau

  // ── Design tokens ───────────────────────────────────────────────────────────
  const bg     = dark ? COURT.darkBg     : COURT.cream
  const card   = dark ? COURT.darkCard   : '#F7F3EA'
  const ink    = dark ? COURT.darkText   : COURT.ink
  const stone  = dark ? COURT.darkMuted  : COURT.stone
  const border = dark ? COURT.darkBorder : 'rgba(20,66,46,0.12)'

  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  // ── Traductions ─────────────────────────────────────────────────────────────
  const L = {
    fr: {
      eyebrow:       'Au club',
      title:         'Mes statistiques',
      progression:   'Progression du niveau',
      delta:         'ce semestre',
      matchs:        'Matchs',
      victoires:     'Victoires',
      serie:         'Série',
      niveau:        'Niveau actuel',
      jours:         'jours',
      confiance:     'Indice de confiance',
      confianceSub:  confLeft > 0
        ? `Encore ${confLeft} match${confLeft > 1 ? 's' : ''} pour fiabiliser ton niveau ${currentLevel.toFixed(1)}`
        : `Niveau ${currentLevel.toFixed(1)} bien fiabilisé ✓`,
    },
    en: {
      eyebrow:       'At the club',
      title:         'My statistics',
      progression:   'Level progression',
      delta:         'this semester',
      matchs:        'Matches',
      victoires:     'Win rate',
      serie:         'Streak',
      niveau:        'Current level',
      jours:         'days',
      confiance:     'Confidence index',
      confianceSub:  confLeft > 0
        ? `${confLeft} more match${confLeft > 1 ? 'es' : ''} to verify level ${currentLevel.toFixed(1)}`
        : `Level ${currentLevel.toFixed(1)} verified ✓`,
    },
    he: {
      eyebrow:       'במגרש',
      title:         'הסטטיסטיקות שלי',
      progression:   'התקדמות רמה',
      delta:         'השנה',
      matchs:        'משחקים',
      victoires:     'ניצחונות',
      serie:         'רצף',
      niveau:        'רמה נוכחית',
      jours:         'ימים',
      confiance:     'מדד ביטחון',
      confianceSub:  confLeft > 0
        ? `עוד ${confLeft} משחקים לאימות רמה ${currentLevel.toFixed(1)}`
        : `רמה ${currentLevel.toFixed(1)} מאומתת ✓`,
    },
  }[lang] ?? {}

  // ── Styles communs ──────────────────────────────────────────────────────────
  const cardStyle = {
    background: card,
    border:     `0.5px solid ${border}`,
    borderRadius: 16,
    padding:    18,
  }
  const lbl = {
    fontFamily:    'Mulish',
    fontSize: 11,
    fontWeight:    600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color:         stone,
    marginBottom:  10,
  }
  const valStyle = {
    fontFamily: ff_serif,
    fontSize: 34,
    color:      COURT.green,
    lineHeight: 1,
    fontStyle:  rtl ? 'normal' : 'italic',
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ background: bg, padding: '24px 20px 20px' }}>

      {/* ── Évolution du niveau (graphe interactif, ex-Accueil) ── */}
      <EvolutionChart />

      {/* ── Grille 2×2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '14px 0' }}>

        {/* Matchs */}
        <div style={cardStyle}>
          <div style={lbl}>{L.matchs}</div>
          <div style={valStyle}>{matchCount}</div>
        </div>

        {/* Victoires */}
        <div style={cardStyle}>
          <div style={lbl}>{L.victoires}</div>
          <div style={valStyle}>
            {matchCount > 0 ? winRate : '—'}
            {matchCount > 0 && <span style={{ fontSize: 18 }}>%</span>}
          </div>
        </div>

        {/* Série (jours consécutifs) */}
        <div style={cardStyle}>
          <div style={lbl}>{L.serie}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="20" height="24" viewBox="0 0 100 120">
              <defs>
                <radialGradient id="sfstat" cx="50%" cy="70%" r="60%">
                  <stop offset="0%"   stopColor="#F5D77A" />
                  <stop offset="45%"  stopColor="#E8943A" />
                  <stop offset="100%" stopColor="#E0632A" />
                </radialGradient>
              </defs>
              <path d="M50 8 C62 30 82 40 82 72 a32 32 0 0 1-64 0 C18 52 30 44 38 30 C40 44 50 46 50 38 C48 28 50 18 50 8 Z" fill="url(#sfstat)" />
            </svg>
            <div style={valStyle}>{streak > 0 ? streak : '—'}</div>
          </div>
          {streak > 0 && (
            <div style={{ fontFamily: ff_italic, fontStyle: 'italic', fontSize: 11, color: stone, marginTop: 6 }}>
              {streak} {L.jours}
            </div>
          )}
        </div>

        {/* Niveau actuel */}
        <div style={cardStyle}>
          <div style={lbl}>{L.niveau}</div>
          <div style={valStyle}>{currentLevel != null ? currentLevel.toFixed(1) : '—'}</div>
        </div>
      </div>

      {/* ── Indice de confiance ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={lbl}>{L.confiance}</div>
          <div style={{ fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic', fontSize: 20, color: COURT.green }}>
            {confScore}%
          </div>
        </div>
        <div style={{ height: 8, background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(20,66,46,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${confScore}%`, height: '100%',
            background: `linear-gradient(90deg, ${COURT.green}, ${COURT.gold})`,
            borderRadius: 4,
            transition: 'width 0.8s ease',
          }} />
        </div>
        <div style={{ fontFamily: ff_italic, fontStyle: 'italic', fontSize: 12.5, color: stone, marginTop: 8 }}>
          {L.confianceSub}
        </div>
      </div>

    </div>
  )
}
