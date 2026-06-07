import { COURT } from '../components/CourtUI'
import { usePrefs } from '../context/PrefsContext'
import { useStreak } from '../hooks/useStreak'
import { FlameSVG }  from '../components/FlameSVG'

// ─────────────────────────────────────────────────────────────────────────────
export default function StreakScreen({ onClose }) {
  const { lang, dark } = usePrefs()
  const streakData     = useStreak()
  const rtl            = lang === 'he'

  const streak   = streakData.streak_current   ?? 0
  const weekBits = streakData.streak_week_bits ?? 0
  const goal     = 10

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
      title:       'Série de jours',
      sub:         "jours d'affilée",
      week:        'Cette semaine',
      remain:      `Plus que ${remaining} jour${remaining > 1 ? 's' : ''} pour être mis en avant ✨`,
      done:        'Bravo ! Ton profil est mis en avant ✨',
      tier:        'PALIER',
      rewardTitle: 'Récompense à 10 jours',
      rewardDesc:  'Ton profil apparaît en premier dans les recherches de partenaires. Plus de visibilité, plus de matchs.',
    },
    en: {
      title:       'Day streak',
      sub:         'days in a row',
      week:        'This week',
      remain:      `${remaining} more day${remaining > 1 ? 's' : ''} to get featured ✨`,
      done:        "You're featured ✨",
      tier:        'GOAL',
      rewardTitle: '10-day reward',
      rewardDesc:  'Your profile appears first in partner searches. More visibility, more matches.',
    },
    he: {
      title:       'רצף ימים',
      sub:         'ימים ברצף',
      week:        'השבוע',
      remain:      `עוד ${remaining} ימים כדי להופיע ✨`,
      done:        'הפרופיל שלך מובלט ✨',
      tier:        'יעד',
      rewardTitle: 'פרס 10 ימים',
      rewardDesc:  'הפרופיל שלך יופיע ראשון בחיפושי שותפים. יותר נראות, יותר משחקים.',
    },
  })[lang] ?? {}

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      style={{ position: 'absolute', inset: 0, background: bg, overflowY: 'auto', zIndex: 120 }}
    >
      {/* ── Topbar ── */}
      <div style={{ padding: '18px 22px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: stone, fontSize: 24, lineHeight: 1, transform: rtl ? 'scaleX(-1)' : 'none', padding: 0 }}
        >‹</button>
        <span style={{ fontFamily: 'Mulish', fontSize: 11, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: stone }}>
          {L.title}
        </span>
        <div style={{ width: 26 }} />
      </div>

      <div style={{ padding: '14px 22px 40px', textAlign: 'center' }}>

        {/* ── Flamme principale animée ── */}
        <div style={{ margin: '6px 0 4px' }}>
          <FlameSVG size={120} animated />
        </div>

        {/* ── Compteur ── */}
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 70, fontWeight: 700, color: dark ? COURT.cream : COURT.greenDeep, lineHeight: 1, marginTop: 4 }}>
          {streak}
        </div>
        <div style={{ fontFamily: 'Mulish', fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: stone, marginTop: 4 }}>
          {L.sub}
        </div>

        {/* ── Cette semaine ── */}
        <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 16, padding: 16, margin: '26px 0 14px' }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: stone, marginBottom: 12, textAlign: rtl ? 'right' : 'left' }}>
            {L.week}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {days.map((d, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, fontWeight: 600, color: stone, letterSpacing: '0.1em', marginBottom: 7 }}>{d}</div>
                <FlameSVG size={20} animated={false} dim={!(weekBits & (1 << i))} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Progression vers le palier 10 jours ── */}
        <div style={{ background: COURT.greenDeep, borderRadius: 16, padding: '18px 16px', color: COURT.cream }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <FlameSVG size={34} animated={false} />
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 15, marginTop: 2 }}>{streak}</div>
            </div>
            <div style={{ flex: 1, textAlign: rtl ? 'right' : 'left' }}>
              <div style={{ fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, marginBottom: 8 }}>
                {remaining > 0 ? L.remain : L.done}
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: COURT.gold, borderRadius: 3, transition: 'width 0.6s' }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0, opacity: 0.55 }}>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: COURT.gold }}>{goal}</div>
              <div style={{ fontFamily: 'Mulish', fontSize: 8, letterSpacing: '0.1em' }}>{L.tier}</div>
            </div>
          </div>
        </div>

        {/* ── Carte récompense palier 10 ── */}
        <div style={{
          background: dark ? COURT.darkCard : '#F7F3EA',
          border: `0.5px solid rgba(20,66,46,0.12)`,
          borderRadius: 14, padding: '16px 18px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          marginTop: 14,
          textAlign: rtl ? 'right' : 'left',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: COURT.greenDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={COURT.gold} strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: 'Mulish', fontSize: 10.5, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: dark ? COURT.cream : COURT.greenDeep, marginBottom: 5,
            }}>
              {L.rewardTitle}
            </div>
            <div style={{
              fontFamily: 'Spectral, serif', fontStyle: 'italic',
              fontSize: 13.5, color: dark ? COURT.darkMuted : '#5A5A52', lineHeight: 1.6,
            }}>
              {L.rewardDesc}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
