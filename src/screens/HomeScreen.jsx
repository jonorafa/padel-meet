import { Suspense, lazy } from 'react'
import { COURT } from '../components/CourtUI'
import { useAuth }   from '../context/AuthContext'
import { DAILY_TIPS } from '../data/courtData'

const StatsSection = lazy(() => import('../components/StatsSection'))

// ── Icône livre SVG (style trait, non-Apple) ─────────────────────────────────
function BookIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  )
}

// ── Conseil du jour — rotation déterministe sur 24h (minuit UTC) ──────────────
function TipOfTheDay({ lang, dark }) {
  const rtl   = lang === 'he'
  const bg    = dark ? COURT.darkCard : '#F7F3EA'
  const ink   = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const border= dark ? COURT.darkBorder : `${COURT.green}25`
  const ff    = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  // Index déterministe : même conseil toute la journée UTC, change à minuit
  const dayIndex = Math.floor(Date.now() / 86_400_000) % DAILY_TIPS.length
  const tip = DAILY_TIPS[dayIndex]
  const text = tip[lang] ?? tip.fr

  // Numéro du jour dans le cycle (1-based, pour l'affichage)
  const tipNum = (dayIndex % DAILY_TIPS.length) + 1

  const labels = {
    fr: { eyebrow: 'Conseil du jour', counter: `${tipNum} / ${DAILY_TIPS.length}` },
    en: { eyebrow: 'Tip of the day',  counter: `${tipNum} / ${DAILY_TIPS.length}` },
    he: { eyebrow: 'טיפ של היום',     counter: `${tipNum} / ${DAILY_TIPS.length}` },
  }[lang] ?? { eyebrow: 'Conseil du jour', counter: `${tipNum} / ${DAILY_TIPS.length}` }

  return (
    <div style={{
      margin: '0 20px 4px',
      background: bg,
      border: `0.5px solid ${border}`,
      borderLeft: `3px solid ${COURT.green}`,
      borderRadius: 16,
      padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookIcon color={COURT.green} />
          <span style={{
            fontFamily: 'Mulish', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: COURT.green,
          }}>
            {labels.eyebrow}
          </span>
        </div>
        <span style={{ fontFamily: 'Mulish', fontSize: 10, color: stone }}>
          {labels.counter}
        </span>
      </div>

      {/* Texte du conseil */}
      <p style={{
        fontFamily: ff,
        fontStyle: rtl ? 'normal' : 'italic',
        fontSize: 15,
        lineHeight: 1.6,
        color: ink,
        margin: 0,
      }}>
        {text}
      </p>

      {/* Sous-note : renouvellement */}
      <p style={{
        fontFamily: 'Mulish', fontSize: 11, color: stone,
        margin: '10px 0 0', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        <span>
          {lang === 'he' ? 'חזור מדי יום לעצות חדשות'
            : lang === 'en' ? 'Come back daily for new tips'
            : 'Reviens chaque jour pour de nouveaux conseils'}
        </span>
      </p>
    </div>
  )
}

// ── Skeleton pendant le chargement de StatsSection ───────────────────────────
function StatsSkeleton({ dark }) {
  const c = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[120, 80, 200].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 14, background: c }} />
      ))}
    </div>
  )
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function HomeScreen({ lang, dark, onShowNotifs, notifCount = 0 }) {
  const { profile }  = useAuth()
  const rtl          = lang === 'he'
  const bg           = dark ? COURT.darkBg : COURT.cream
  const ink          = dark ? COURT.darkText : COURT.ink
  const border       = dark ? COURT.darkBorder : `${COURT.green}40`
  const ff           = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  const firstName = profile?.name?.split(' ')[0] || ''

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      overflowY: 'auto', overflowX: 'hidden', paddingBottom: 90,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '56px 20px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: `0.5px solid ${border}`,
      }}>
        <div>
          <div style={{
            fontFamily: 'Mulish', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: COURT.green,
            marginBottom: 4,
          }}>
            {lang === 'he' ? 'פאדל מיט' : 'Padel Meet'}
          </div>
          <div style={{ fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontSize: 22, color: ink }}>
            {firstName
              ? (lang === 'he' ? `שלום, ${firstName}` : lang === 'en' ? `Hey, ${firstName}` : `Salut, ${firstName}`)
              : (lang === 'he' ? 'שלום !' : lang === 'en' ? 'Hey!' : 'Salut !')}
          </div>
        </div>

        {/* Cloche notifs */}
        {notifCount > 0 && (
          <button onClick={onShowNotifs} style={{
            background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 4,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{
              position: 'absolute', top: 0, right: 0,
              width: 8, height: 8, borderRadius: '50%',
              background: COURT.gold, border: `1.5px solid ${bg}`,
            }} />
          </button>
        )}
      </div>

      {/* ── Conseil du jour ── */}
      <div style={{ padding: '20px 0 4px' }}>
        <TipOfTheDay lang={lang} dark={dark} />
      </div>

      {/* ── Stats & évolution ── */}
      <div style={{ marginTop: 12 }}>
        <Suspense fallback={<StatsSkeleton dark={dark} />}>
          <StatsSection />
        </Suspense>
      </div>
    </div>
  )
}
