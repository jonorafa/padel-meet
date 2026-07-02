import { useState, useEffect } from 'react';
import { COURT, PadelBall, FloatingBalls } from '../components/CourtUI';
import { levelToTopPercent, generateLevelSummary } from '../data/courtData';

export default function ResultScreen({ t, lang, level, answers, onContinue }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setS(1), 500);
    const t2 = setTimeout(() => setS(2), 1500);
    const t3 = setTimeout(() => setS(3), 2400);
    const t4 = setTimeout(() => setS(4), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);
  const rtl = lang === 'he';
  const ff = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';

  const topPct  = level != null ? levelToTopPercent(level) : null;
  const summary = level != null && answers ? generateLevelSummary(answers, lang) : null;


  const regionLabel = lang === 'en' ? 'in your region'
    : lang === 'he' ? 'באזור שלך'
    : 'dans ta région';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(circle at 50% 30%, ${COURT.green}, ${COURT.greenDeep})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', overflow: 'hidden',
    }}>
      <FloatingBalls count={5} />
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2, width: '100%', maxWidth: 360 }}>

        {/* Label "TON NIVEAU" */}
        <div style={{
          opacity: s >= 1 ? 1 : 0, transform: `translateY(${s >= 1 ? 0 : 16}px)`, transition: 'all 0.9s ease',
          fontFamily: 'Mulish', fontSize: 11, color: COURT.gold, letterSpacing: '0.32em',
          textTransform: 'uppercase', marginBottom: 24,
        }}>
          {level != null ? t.yourLevel : (t.levelNotEvaluated || 'Niveau non évalué')}
        </div>

        {/* Cercle niveau */}
        <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
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
            <div style={{ fontFamily: ff, fontStyle: 'italic', fontSize: level != null ? 88 : 44, color: COURT.cream, fontWeight: 400, lineHeight: 1 }}>
              {level != null ? level.toFixed(1) : '—'}
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, animation: s >= 1 ? 'orbit 6s linear infinite' : 'none' }}>
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
              <PadelBall size={20} />
            </div>
          </div>
        </div>

        {/* Badge Top X% */}
        {topPct != null && (
          <div style={{
            opacity: s >= 3 ? 1 : 0, transform: `translateY(${s >= 3 ? 0 : 10}px)`,
            transition: 'all 0.6s ease 0.1s',
            marginTop: 20,
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: `${COURT.greenDeep}CC`, border: `0.5px solid ${COURT.gold}40`,
            borderRadius: 12, padding: '10px 16px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.gold} strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: COURT.cream, fontWeight: 700 }}>
                Top{' '}
                <span style={{ color: COURT.gold }}>{topPct}%</span>
                {' '}{lang === 'en' ? 'of players' : lang === 'he' ? 'מהשחקנים' : 'des joueurs'}
              </div>
              <div style={{ fontFamily: ff, fontStyle: 'italic', fontSize: 11, color: `${COURT.cream}80` }}>
                {regionLabel}
              </div>
            </div>
          </div>
        )}

        {/* Résumé personnalisé */}
        {summary && (
          <div style={{
            opacity: s >= 4 ? 1 : 0, transform: `translateY(${s >= 4 ? 0 : 8}px)`,
            transition: 'all 0.6s ease',
            marginTop: 18,
            background: `${COURT.greenDeep}AA`, border: `0.5px solid ${COURT.gold}30`,
            borderRadius: 12, padding: '14px 18px',
            textAlign: 'left',
          }}>
            <div style={{ fontFamily: ff, fontStyle: 'italic', fontSize: 13.5, color: COURT.cream, lineHeight: 1.55 }}>
              {summary.sentence1}
            </div>
            {summary.sentence2 && (
              <div style={{ fontFamily: ff, fontStyle: 'italic', fontSize: 13, color: `${COURT.cream}90`, lineHeight: 1.55, marginTop: 6 }}>
                {summary.sentence2}
              </div>
            )}
          </div>
        )}

        {/* Bouton continuer */}
        <div style={{ marginTop: 28, opacity: s >= 3 ? 1 : 0, transition: 'opacity 0.8s ease 0.2s' }}>
          <button onClick={onContinue} style={{
            background: 'transparent', color: COURT.cream,
            border: `0.5px solid ${COURT.gold}`, borderRadius: 10,
            padding: '14px 36px',
            fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
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
