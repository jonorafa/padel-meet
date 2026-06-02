import { useNavigate } from 'react-router-dom';
import { COURT, PadelRacket, PadelBall, Ornament } from '../components/CourtUI';
import { usePrefs } from '../context/PrefsContext';

const langs = [
  { code: 'he', flag: '🇮🇱' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'fr', flag: '🇫🇷' },
];

export default function LanguageScreen() {
  const { lang: current, dark, setLang } = usePrefs();
  const navigate = useNavigate();
  const bg = dark ? COURT.darkBg : COURT.cream;
  const ink = dark ? COURT.darkText : COURT.ink;

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '0 32px', overflow: 'hidden',
    }}>
      {/* Raquette fantôme qui swingue */}
      <div style={{
        position: 'absolute', right: -30, top: 130, opacity: dark ? 0.16 : 0.10,
        transformOrigin: '50% 90%', animation: 'racketSwing 5s ease-in-out infinite',
      }}>
        <PadelRacket size={170} frame={COURT.green} grip={COURT.green} />
      </div>

      {/* Balle qui traverse l'écran en rallye */}
      <div style={{
        position: 'absolute', width: 26, height: 26, zIndex: 1,
        animation: 'ballRally 4s cubic-bezier(.45,0,.55,1) infinite',
        filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.15))',
      }}>
        <div style={{ animation: 'ballSpin 1.2s linear infinite' }}>
          <PadelBall size={26} shadow={false} />
        </div>
      </div>

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <Ornament width={120} style={{ margin: '0 auto 18px', display: 'block' }} />
        <div style={{
          fontFamily: 'Pinyon Script, cursive', fontSize: 78, lineHeight: 0.9,
          color: COURT.green, animation: 'inkReveal 1.4s ease-out', whiteSpace: 'nowrap',
        }}>
          Padel Meet
        </div>
        <Ornament width={120} style={{ margin: '16px auto 0', display: 'block' }} />

        <div style={{
          marginTop: 44, fontFamily: 'Cormorant Garamond, serif',
          fontSize: 24, color: ink, fontStyle: 'italic', fontWeight: 500,
          letterSpacing: '0.04em',
        }}>Language</div>

        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 16 }}>
          {langs.map((l, i) => {
            const isActive = current === l.code;
            return (
              <button key={l.code} onClick={() => { setLang(l.code); navigate('/auth'); }}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  background: isActive ? COURT.greenDeep : (dark ? COURT.darkCard : COURT.cream),
                  border: `0.5px solid ${isActive ? COURT.gold : COURT.green}`,
                  cursor: 'pointer', fontSize: 38, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(15,61,41,0.10)',
                  transition: 'all 0.3s cubic-bezier(.2,.9,.3,1.4)',
                  animation: `cardIn 0.5s ease ${0.1 + i * 0.08}s both`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.08)';
                  e.currentTarget.style.background = COURT.greenDeep;
                  e.currentTarget.style.borderColor = COURT.gold;
                  e.currentTarget.style.boxShadow = '0 10px 24px rgba(15,61,41,0.28), 0 0 0 4px rgba(196,158,87,0.18)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.background = isActive ? COURT.greenDeep : (dark ? COURT.darkCard : COURT.cream);
                  e.currentTarget.style.borderColor = isActive ? COURT.gold : COURT.green;
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,61,41,0.10)';
                }}>
                <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>{l.flag}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
