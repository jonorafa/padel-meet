import { COURT } from '../components/CourtUI'
import { usePrefs }        from '../context/PrefsContext'
import { useAuth }         from '../context/AuthContext'
import { useMatchHistory } from '../hooks/useMatchHistory'
import { usePlayerStats }  from '../hooks/usePlayerStats'
import { useLevelHistory } from '../hooks/useLevelHistory'

// ─── Mois par langue ──────────────────────────────────────────────────────────
const MONTHS = {
  fr: ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  he: ['ינ','פב','מר','אפ','מי','יו','יל','אג','ספ','אק','נו','דצ'],
}

/**
 * Fusionne deux sources d'historique de niveau (DB + localStorage), trie par
 * date et déduplique les niveaux consécutifs identiques. Garantit qu'on affiche
 * la série la plus complète, que la donnée vienne du serveur ou du local.
 */
function mergeLevelHistories(a, b) {
  const all = [...(a || []), ...(b || [])]
    .filter(p => p && p.level != null && p.date)
    .map(p => ({ level: parseFloat(p.level), date: p.date, t: new Date(p.date).getTime() }))
    .filter(p => !isNaN(p.t))
    .sort((x, y) => x.t - y.t)

  const out = []
  for (const p of all) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.level - p.level) < 0.001) continue  // dédoublonne les paliers identiques
    out.push({ level: p.level, date: p.date })
  }
  return out
}

/** Libellé court d'une date — "8 jui" / "8 Jun". */
function shortDate(iso, lang) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const arr = MONTHS[lang] ?? MONTHS.fr
  return `${d.getDate()} ${arr[d.getMonth()]}`
}

/**
 * Construit la VRAIE série d'évolution du niveau à partir de l'historique
 * enregistré (chaque (ré)évaluation = un point { level, date }).
 *   → points : les niveaux réels dans l'ordre chronologique
 *   → labels : la date de chaque point
 * Si aucun historique : on retombe sur le niveau actuel comme point unique.
 * Si un seul point : on le duplique pour qu'une ligne soit visible.
 */
function buildLevelSeries(levelHistory, currentLevel, lang) {
  let series = Array.isArray(levelHistory) ? levelHistory.filter(p => p && p.level != null) : []

  if (series.length === 0 && currentLevel != null) {
    series = [{ level: currentLevel, date: new Date().toISOString() }]
  }

  const points = series.map(s => parseFloat(s.level))
  const labels = series.map(s => shortDate(s.date, lang))

  // Un seul point → on duplique pour dessiner une courte ligne plate.
  if (points.length === 1) {
    points.unshift(points[0])
    labels.unshift('')
  }

  return { points, labels }
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function SparkLine({ data, width = 300, height = 52, color = '#C9A961' }) {
  const max   = Math.max(...data)
  const min   = Math.min(...data)
  const range = max - min || 0.1
  const pts   = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 14) - 7
    return `${x},${y}`
  }).join(' ')
  const [lx, ly] = pts.split(' ').pop().split(',')

  return (
    <svg
      width="100%" height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="4.5" fill={color} />
    </svg>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function StatsSection() {
  const { lang, dark, level, confidence, levelHistory } = usePrefs()
  const { profile }  = useAuth()
  const history      = useMatchHistory()
  const { stats }    = usePlayerStats()
  const dbLevelHist  = useLevelHistory()
  const rtl          = lang === 'he'

  // ── Vraies données ──────────────────────────────────────────────────────────
  const matchCount    = stats?.matchesPlayed ?? 0
  const wins          = stats?.wins          ?? 0
  const winRate       = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0
  const streak        = profile?.streak_current ?? 0          // jours consécutifs
  const currentLevel  = level  ?? 4.0
  const confScore     = Math.round(confidence ?? 0)           // 0–100
  const confLeft      = Math.max(0, 10 - matchCount)          // matchs pour vérifier le niveau

  // Fusionne historique DB (cross-device) + local (offline) → série la plus complète
  const mergedHistory = mergeLevelHistories(dbLevelHist, levelHistory)
  const { points: progressionData, labels: progressionLabels } = buildLevelSeries(mergedHistory, currentLevel, lang)
  const levelStart      = progressionData[0]
  const levelEnd        = progressionData[progressionData.length - 1]
  const levelDelta      = parseFloat((levelEnd - levelStart).toFixed(1))

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

      {/* ── En-tête ── */}
      <div style={{ fontFamily: 'Mulish', fontSize: 11, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: stone }}>
        {L.eyebrow}
      </div>
      <div style={{ fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic', fontSize: 28, color: dark ? COURT.cream : COURT.greenDeep, fontWeight: 500, margin: '6px 0 18px' }}>
        {L.title}
      </div>

      {/* ── Carte Progression (graphe pleine largeur) ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={lbl}>{L.progression}</div>
          <div style={{ fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic', fontSize: 17, color: ink, whiteSpace: 'nowrap' }}>
            {levelStart.toFixed(1)} → {levelEnd.toFixed(1)}
            {levelDelta !== 0 && (
              <span style={{
                fontFamily: ff_italic, fontStyle: 'italic', fontSize: 12,
                color: levelDelta > 0 ? COURT.gold : COURT.purple, marginLeft: 8,
              }}>
                {levelDelta > 0 ? '+' : ''}{levelDelta.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* ── Graph avec axes ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {/* Y-axis labels */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: stone, textAlign: 'right', minWidth: 20, paddingRight: 4 }}>
            <span>7.0</span>
            <span>4.0</span>
            <span>0.5</span>
          </div>

          {/* Graph */}
          <div style={{ flex: 1 }}>
            <SparkLine data={progressionData} color={COURT.gold} />
          </div>
        </div>

        {/* ── X-axis (dates) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {progressionLabels.map((m, i) => (
            <span key={i} style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, flex: 1, textAlign: i === 0 ? 'left' : i === progressionLabels.length - 1 ? 'right' : 'center' }}>
              {m}
            </span>
          ))}
        </div>
      </div>

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
