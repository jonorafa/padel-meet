import { COURT } from '../components/CourtUI'
import { usePrefs } from '../context/PrefsContext'
import { useStreak } from '../hooks/useStreak'

// ── Flamme branded (or/ambre, pas le rouge WHOOP) ─────────────────────────
function Flame({ size = 100, anim = false, dim = false }) {
  // Use size in the gradient ID so multiple sizes don't clash
  const id = `sfg${size}`
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      style={{
        opacity: dim ? 0.25 : 1,
        animation: anim ? 'streakFlick 2.2s ease-in-out infinite' : 'none',
        transformOrigin: '50% 90%',
        display: 'block',
      }}
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="70%" r="60%">
          <stop offset="0%"   stopColor="#F5D77A" />
          <stop offset="45%"  stopColor="#E8943A" />
          <stop offset="100%" stopColor="#E0632A" />
        </radialGradient>
      </defs>
      <path
        d="M50 8 C62 30 82 40 82 72 a32 32 0 0 1-64 0 C18 52 30 44 38 30 C40 44 50 46 50 38 C48 28 50 18 50 8 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M50 56 C56 66 60 70 60 82 a10 10 0 0 1-20 0 C40 74 44 70 50 56 Z"
        fill="#F5D77A"
        opacity="0.92"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StreakScreen({ onClose }) {
  const { lang, dark } = usePrefs()
  const streakData     = useStreak()
  const rtl            = lang === 'he'

  const streak   = streakData.streak_current   ?? 0
  const weekBits = streakData.streak_week_bits ?? 0
  const goal     = 10   // palier "mis en avant"

  const bg     = dark ? COURT.darkBg     : COURT.cream
  const card   = dark ? COURT.darkCard   : '#F7F3EA'
  const stone  = dark ? COURT.darkMuted  : COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}15`

  const remaining = Math.max(0, goal - streak)
  const pct       = Math.min(100, (streak / goal) * 100)

  const days = rtl
    ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
    : ['L',  'M', 'M', 'J', 'V', 'S', 'D']

  const L = ({
    fr: {
      title:  'Série de jours',
      sub:    "jours d'affilée",
      week:   'Cette semaine',
      remain: `Plus que ${remaining} jour${remaining > 1 ? 's' : ''} pour être mis en avant ✨`,
      done:   'Bravo ! Ton profil est mis en avant ✨',
      tier:   'PALIER',
    },
    en: {
      title:  'Day streak',
      sub:    'days in a row',
      week:   'This week',
      remain: `${remaining} more day${remaining > 1 ? 's' : ''} to get featured ✨`,
      done:   "You're featured ✨",
      tier:   'GOAL',
    },
    he: {
      title:  'רצף ימים',
      sub:    'ימים ברצף',
      week:   'השבוע',
      remain: `עוד ${remaining} ימים כדי להופיע ✨`,
      done:   'הפרופיל שלך מובלט ✨',
      tier:   'יעד',
    },
  })[lang] ?? {}

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute', inset: 0,
        background: bg,
        overflowY: 'auto',
        zIndex: 120,
      }}
    >
      {/* ── Topbar ── */}
      <div style={{
        padding: '18px 22px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: stone, fontSize: 24, lineHeight: 1,
            transform: rtl ? 'scaleX(-1)' : 'none',
            padding: 0,
          }}
        >‹</button>
        <span style={{
          fontFamily: 'Mulish', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.24em', textTransform: 'uppercase', color: stone,
        }}>
          {L.title}
        </span>
        <div style={{ width: 26 }} />
      </div>

      <div style={{ padding: '14px 22px 40px', textAlign: 'center' }}>

        {/* ── Flamme + halo ── */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '6px 0 4px' }}>
          <div style={{
            position: 'absolute', inset: -20, borderRadius: '50%',
            background: `radial-gradient(circle, ${COURT.gold}33, transparent 70%)`,
            animation: 'streakGlow 2.5s ease-in-out infinite',
          }} />
          <div style={{ position: 'relative' }}>
            <Flame size={120} anim />
          </div>
        </div>

        {/* ── Compteur ── */}
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: 70, fontWeight: 700,
          color: dark ? COURT.cream : COURT.greenDeep,
          lineHeight: 1, marginTop: 4,
        }}>
          {streak}
        </div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: stone, marginTop: 4,
        }}>
          {L.sub}
        </div>

        {/* ── Cette semaine ── */}
        <div style={{
          background: card,
          border: `0.5px solid ${border}`,
          borderRadius: 16, padding: 16,
          margin: '26px 0 14px',
        }}>
          <div style={{
            fontFamily: 'Mulish', fontSize: 9.5, fontWeight: 600,
            letterSpacing: '0.24em', textTransform: 'uppercase',
            color: stone, marginBottom: 12,
            textAlign: rtl ? 'right' : 'left',
          }}>
            {L.week}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {days.map((d, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'Mulish', fontSize: 9, fontWeight: 600,
                  color: stone, letterSpacing: '0.1em', marginBottom: 7,
                }}>{d}</div>
                <div style={{ width: 20, margin: '0 auto' }}>
                  {/* dim = bit i not set in weekBits (0=Mon … 6=Sun) */}
                  <Flame size={20} dim={!(weekBits & (1 << i))} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Progression vers le palier 10 jours ── */}
        <div style={{
          background: COURT.greenDeep,
          borderRadius: 16, padding: '18px 16px',
          color: COURT.cream,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Flamme + streak courant */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <Flame size={34} />
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 15, marginTop: 2 }}>
                {streak}
              </div>
            </div>

            {/* Texte + barre de progression */}
            <div style={{ flex: 1, textAlign: rtl ? 'right' : 'left' }}>
              <div style={{
                fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
                fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 14, marginBottom: 8,
              }}>
                {remaining > 0 ? L.remain : L.done}
              </div>
              <div style={{
                height: 6,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: COURT.gold,
                  borderRadius: 3,
                  transition: 'width 0.6s',
                }} />
              </div>
            </div>

            {/* Objectif */}
            <div style={{ textAlign: 'center', flexShrink: 0, opacity: 0.55 }}>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: COURT.gold }}>
                {goal}
              </div>
              <div style={{ fontFamily: 'Mulish', fontSize: 8, letterSpacing: '0.1em' }}>
                {L.tier}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
