import { useNavigate } from 'react-router-dom'
import { COURT, PadelRacket, PadelBall, Ornament } from '../components/CourtUI'
import { usePrefs } from '../context/PrefsContext'

const langs = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English'  },
  { code: 'he', flag: '🇮🇱', label: 'עברית'    },
]

export default function LanguageScreen() {
  const { lang: current, dark, setLang } = usePrefs()
  const navigate = useNavigate()
  const bg   = dark ? COURT.darkBg   : COURT.cream
  const ink  = dark ? COURT.darkText : COURT.ink
  const card = dark ? COURT.darkCard : '#F7F3EA'
  const border = dark ? COURT.darkBorder : `${COURT.green}20`

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '0 28px', overflow: 'hidden',
    }}>

      {/* Raquette fantôme */}
      <div style={{
        position: 'absolute', right: -30, top: 100, opacity: 0.08,
        transformOrigin: '50% 90%', animation: 'racketSwing 5s ease-in-out infinite',
      }}>
        <PadelRacket size={160} frame={COURT.green} grip={COURT.green} />
      </div>

      {/* Balle rally */}
      <div style={{
        position: 'absolute', width: 24, height: 24, zIndex: 1,
        animation: 'ballRally 4s cubic-bezier(.45,0,.55,1) infinite',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
      }}>
        <div style={{ animation: 'ballSpin 1.2s linear infinite' }}>
          <PadelBall size={24} shadow={false} />
        </div>
      </div>

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <Ornament width={110} style={{ margin: '0 auto 14px', display: 'block' }} />
        <div style={{
          fontFamily: 'Pinyon Script, cursive', fontSize: 72, lineHeight: 0.9,
          color: COURT.green, textAlign: 'center',
          animation: 'inkReveal 1.4s ease-out',
        }}>
          Padel Meet
        </div>
        <Ornament width={110} style={{ margin: '14px auto 32px', display: 'block' }} />

        {/* Label */}
        <div style={{
          textAlign: 'center',
          fontFamily: 'Mulish', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.26em', textTransform: 'uppercase',
          color: dark ? COURT.darkMuted : COURT.stone,
          marginBottom: 16,
        }}>Language</div>

        {/* Liste langues — cliquable direct, sans rond */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {langs.map((l, i) => {
            return (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); navigate('/auth') }}
                style={{
                  background: card,
                  border: `0.5px solid ${border}`,
                  borderRadius: 14, padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(15,61,41,0.06)',
                  transition: 'all 0.22s ease',
                  animation: `cardIn 0.4s ease ${0.08 * i}s both`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = COURT.greenDeep
                  e.currentTarget.style.borderColor = COURT.gold
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,61,41,0.24)'
                  e.currentTarget.style.color = COURT.cream
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = card
                  e.currentTarget.style.borderColor = border
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,61,41,0.06)'
                  e.currentTarget.style.color = ink
                }}
              >
                <span style={{ fontSize: 26 }}>{l.flag}</span>
                <span style={{
                  fontFamily: 'Mulish', fontSize: 15, fontWeight: 600,
                  color: ink,
                }}>{l.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
