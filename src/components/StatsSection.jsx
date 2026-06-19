import { useState } from 'react'
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
  const [showConfModal, setShowConfModal] = useState(false)

  // ── Vraies données ──────────────────────────────────────────────────────────
  const matchCount    = stats?.matchesPlayed ?? 0
  const wins          = stats?.wins          ?? 0
  const winRate       = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0
  const streak        = profile?.streak_current ?? 0          // jours consécutifs
  const currentLevel  = level ?? null
  const confScore     = Math.round(confidence ?? 0)           // 0–100

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
      confianceSub:  'Augmente en jouant avec des partenaires de ton niveau · ou en te faisant évaluer',
      modalTitle:    'Comment est calculé l\'indice de confiance ?',
      modalBase:     'Tu commences à 50% — ce socle représente ton niveau auto-déclaré lors du quiz.',
      modalGoal:     'L\'objectif est d\'atteindre 100% en accumulant des crédits via deux canaux :',
      modalPeerTitle:'Évaluations de partenaires (max +25%)',
      modalPeerBody: 'Après chaque match, tes partenaires peuvent évaluer ton niveau. Si leur proposition est proche du tien (écart ≤ 0.5) → +5%. Si l\'écart est entre 0.5 et 1.0 → +2%. Si l\'écart est trop grand → 0 (ton score ne baisse jamais).',
      modalPlayTitle:'Matchs de niveau similaire (max +25%)',
      modalPlayBody: 'Chaque fois que tu confirmes un match contre un adversaire dont le niveau est proche du tien (écart ≤ 0.5) → +5% pour vous deux. Joue avec des gens de ton niveau pour progresser.',
      modalNote:     'L\'indice ne baisse jamais — il ne peut qu\'augmenter au fil du temps.',
      close:         'Fermer',
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
      confianceSub:  'Grows by playing with partners at your level · or getting peer evaluations',
      modalTitle:    'How is the confidence index calculated?',
      modalBase:     'You start at 50% — this base represents your self-declared level from the quiz.',
      modalGoal:     'The goal is to reach 100% by earning credits through two channels:',
      modalPeerTitle:'Partner evaluations (max +25%)',
      modalPeerBody: 'After each match, your partners can evaluate your level. If their suggestion is close to yours (gap ≤ 0.5) → +5%. If the gap is between 0.5 and 1.0 → +2%. If the gap is too large → 0 (your score never drops).',
      modalPlayTitle:'Same-level matches (max +25%)',
      modalPlayBody: 'Each time you confirm a match against an opponent whose level is close to yours (gap ≤ 0.5) → +5% for both of you. Play with people at your level to progress.',
      modalNote:     'The index never drops — it can only increase over time.',
      close:         'Close',
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
      confianceSub:  'גדל על ידי משחק עם שחקנים ברמה שלך · או הערכות עמיתים',
      modalTitle:    'איך מחושב מדד הביטחון?',
      modalBase:     'אתה מתחיל ב-50% — בסיס זה מייצג את הרמה שהצהרת בשאלון.',
      modalGoal:     'המטרה היא להגיע ל-100% על ידי צבירת זיכויים דרך שני ערוצים:',
      modalPeerTitle:'הערכות שותפים (מקסימום +25%)',
      modalPeerBody: 'אחרי כל משחק, השותפים שלך יכולים להעריך את הרמה שלך. אם ההצעה שלהם קרובה לשלך (פער ≤ 0.5) → +5%. אם הפער בין 0.5 ל-1.0 → +2%. אם הפער גדול מדי → 0 (הציון שלך לא יורד לעולם).',
      modalPlayTitle:'משחקים ברמה דומה (מקסימום +25%)',
      modalPlayBody: 'בכל פעם שאתה מאשר משחק נגד יריב שרמתו קרובה לשלך (פער ≤ 0.5) → +5% לשניכם. שחק עם אנשים ברמה שלך כדי להתקדם.',
      modalNote:     'המדד לא יורד לעולם — הוא יכול רק לעלות עם הזמן.',
      close:         'סגור',
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
          {currentLevel != null ? (
            <div style={valStyle}>{currentLevel.toFixed(1)}</div>
          ) : (
            <div style={{ fontFamily: ff_italic, fontStyle: 'italic', fontSize: 13, color: stone, marginTop: 4, lineHeight: 1.4 }}>
              {lang === 'he' ? 'לא הוערך' : lang === 'en' ? 'Not evaluated' : 'Non évalué'}
            </div>
          )}
        </div>
      </div>

      {/* ── Indice de confiance ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={lbl}>{L.confiance}</div>
            {/* Icône info — cliquable */}
            <button
              onClick={() => setShowConfModal(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', marginBottom: 10,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="8" strokeWidth="2.5"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>
          </div>
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

      {/* ── Modale explication indice de confiance ── */}
      {showConfModal && (
        <div
          onClick={() => setShowConfModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: dark ? COURT.darkCard : '#FDFAF4',
              borderRadius: '20px 20px 0 0',
              padding: '28px 24px 36px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            {/* Titre */}
            <div style={{
              fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 20, color: COURT.green, marginBottom: 18, lineHeight: 1.3,
            }}>
              {L.modalTitle}
            </div>

            {/* Base 50% */}
            <p style={{ fontFamily: 'Mulish', fontSize: 13.5, color: ink, lineHeight: 1.6, marginBottom: 14 }}>
              {L.modalBase}
            </p>
            <p style={{ fontFamily: 'Mulish', fontSize: 13.5, color: ink, lineHeight: 1.6, marginBottom: 18 }}>
              {L.modalGoal}
            </p>

            {/* Canal peer */}
            <div style={{
              background: dark ? 'rgba(255,255,255,0.05)' : `${COURT.green}0D`,
              border: `0.5px solid ${COURT.green}30`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <div style={{ fontFamily: 'Mulish', fontWeight: 700, fontSize: 12.5, color: COURT.green, letterSpacing: '0.05em' }}>
                  {L.modalPeerTitle}
                </div>
              </div>
              <p style={{ fontFamily: 'Mulish', fontSize: 12.5, color: ink, lineHeight: 1.6, margin: 0 }}>
                {L.modalPeerBody}
              </p>
            </div>

            {/* Canal play */}
            <div style={{
              background: dark ? 'rgba(255,255,255,0.05)' : `${COURT.gold}18`,
              border: `0.5px solid ${COURT.gold}50`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.gold} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
                <div style={{ fontFamily: 'Mulish', fontWeight: 700, fontSize: 12.5, color: dark ? COURT.gold : '#8a6a1a', letterSpacing: '0.05em' }}>
                  {L.modalPlayTitle}
                </div>
              </div>
              <p style={{ fontFamily: 'Mulish', fontSize: 12.5, color: ink, lineHeight: 1.6, margin: 0 }}>
                {L.modalPlayBody}
              </p>
            </div>

            {/* Note monotone */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(20,66,46,0.05)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 24,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="2" strokeLinecap="round" style={{ marginTop: 2, flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p style={{ fontFamily: 'Mulish', fontStyle: 'italic', fontSize: 12, color: stone, lineHeight: 1.5, margin: 0 }}>
                {L.modalNote}
              </p>
            </div>

            {/* Bouton fermer */}
            <button
              onClick={() => setShowConfModal(false)}
              style={{
                width: '100%', padding: '14px',
                background: COURT.green, color: COURT.cream,
                border: 'none', borderRadius: 12, cursor: 'pointer',
                fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 16,
              }}
            >
              {L.close}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
