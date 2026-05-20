import { useState, useEffect } from 'react';
import { COURT, PadelBall, FloatingBalls } from '../components/CourtUI';

export default function ResultScreen({ t, lang, level, onContinue, dark }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setS(1), 500);
    const t2 = setTimeout(() => setS(2), 1500);
    const t3 = setTimeout(() => setS(3), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  const rtl = lang === 'he';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(circle at 50% 30%, ${COURT.green}, ${COURT.greenDeep})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, overflow: 'hidden',
    }}>
      <FloatingBalls count={5} />
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <div style={{
          opacity: s >= 1 ? 1 : 0, transform: `translateY(${s >= 1 ? 0 : 16}px)`, transition: 'all 0.9s ease',
          fontFamily: 'Inter', fontSize: 11, color: COURT.gold, letterSpacing: '0.32em',
          textTransform: 'uppercase', marginBottom: 24,
        }}>
          {t.yourLevel}
        </div>

        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', border: `0.5px solid ${COURT.gold}`,
            transform: `scale(${s >= 1 ? 1 : 0.4})`, opacity: s >= 1 ? 1 : 0,
            transition: 'all 0.9s cubic-bezier(.2,.8,.2,1)',
          }} />
          <div style={{
            position: 'absolute', inset: 14, borderRadius: '50%', border: `0.5px solid ${COURT.gold}55`,
            transform: `scale(${s >= 1 ? 1 : 0.5})`, opacity: s >= 1 ? 1 : 0,
            transition: 'all 1s cubic-bezier(.2,.8,.2,1) 0.1s',
          }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: s >= 2 ? 1 : 0, transform: `scale(${s >= 2 ? 1 : 0.6})`, transition: 'all 0.7s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 96, color: COURT.cream, fontWeight: 400, lineHeight: 1 }}>
              {level.toFixed(1)}
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, animation: s >= 1 ? 'orbit 6s linear infinite' : 'none' }}>
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
              <PadelBall size={22} />
            </div>
          </div>
        </div>

        <div style={{
          fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
          fontStyle: rtl ? 'normal' : 'italic', fontSize: 15, color: `${COURT.cream}c0`,
          marginTop: 32, maxWidth: 280, lineHeight: 1.5,
          opacity: s >= 3 ? 1 : 0, transition: 'opacity 0.8s ease',
        }}>
          {t.levelExplain}
        </div>

        <div style={{ marginTop: 36, opacity: s >= 3 ? 1 : 0, transition: 'opacity 0.8s ease 0.2s' }}>
          <button onClick={onContinue} style={{
            background: 'transparent', color: COURT.cream,
            border: `0.5px solid ${COURT.gold}`, borderRadius: 10,
            padding: '14px 36px',
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>
            {t.enterClub}
          </button>
        </div>
      </div>
    </div>
  );
}
