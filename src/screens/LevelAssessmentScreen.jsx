import { useState, useEffect } from 'react';
import { COURT, PadelRacket, FloatingBalls, Ornament, ThinButton } from '../components/CourtUI';

export default function WelcomeScreen({ t, lang, onStart, onSkip, dark }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const tt = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(tt);
  }, []);
  const rtl = lang === 'he';
  const bg = dark ? COURT.darkBg : COURT.cream;
  const ink = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px', overflow: 'hidden',
    }}>
      <FloatingBalls count={5} />
      <div style={{
        position: 'absolute', right: -30, top: 80,
        animation: 'racketTilt 6s ease-in-out infinite', transformOrigin: '50% 95%', opacity: 0.16,
      }}>
        <PadelRacket size={140} />
      </div>
      <div style={{
        position: 'absolute', left: -40, bottom: 140, opacity: 0.13,
        animation: 'racketTilt 7s ease-in-out infinite reverse', transformOrigin: '50% 95%',
        transform: 'rotate(180deg)',
      }}>
        <PadelRacket size={120} />
      </div>

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <Ornament width={120} style={{ margin: '0 auto 24px', display: 'block' }} />
        <div style={{
          fontFamily: 'Pinyon Script, cursive', fontSize: 92, lineHeight: 0.9,
          color: COURT.green, animation: 'inkBleed 1.6s ease-out',
        }}>
          Padel Meet
        </div>
        <div style={{
          fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif',
          fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 19, color: dark ? stone : COURT.ink, letterSpacing: '0.04em', marginTop: 4,
          opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease 0.3s',
        }}>
          {t.tagline}
        </div>
        <Ornament width={120} style={{ margin: '24px auto 0', display: 'block' }} />

        <div style={{
          marginTop: 56,
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? 0 : 12}px)`,
          transition: 'all 0.8s ease 0.6s',
        }}>
          <ThinButton variant="green" onClick={onStart} full>
            {t.cta_level}
          </ThinButton>
          <div style={{
            marginTop: 10, fontFamily: 'Inter', fontSize: 11,
            color: dark ? stone : COURT.stone, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            {t.members}
          </div>
        </div>
      </div>
    </div>
  );
}
