import { useState } from 'react';
import { COURT, Ornament } from '../components/CourtUI';
import { QUIZ_QUESTIONS, computeLevel } from '../data/courtData';

export default function QuizScreen({ t, lang, onDone, onBack, dark }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [animDir, setAnimDir] = useState('in');
  const total = QUIZ_QUESTIONS.length;
  const q = QUIZ_QUESTIONS[idx];
  const progress = ((idx + 1) / total) * 100;
  const rtl = lang === 'he';
  const txt = (obj) => obj ? (obj[lang] || obj.en || obj.fr) : '';
  const subTxt = (opt) => lang === 'he' ? opt.subHe : (lang === 'en' ? (opt.subEn || opt.subFr) : opt.subFr);

  const bg = dark ? COURT.darkBg : COURT.cream;
  const ink = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const border = dark ? COURT.darkBorder : `${COURT.green}50`;

  const advance = (val) => {
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);
    setAnimDir('out');
    setTimeout(() => {
      if (idx + 1 >= total) {
        const lvl = computeLevel(newAnswers);
        onDone(lvl);
      } else {
        setIdx(idx + 1);
        setAnimDir('in');
      }
    }, 280);
  };

  const goBack = () => {
    if (idx === 0) { if (onBack) onBack(); return; }
    setAnimDir('out');
    setTimeout(() => { setIdx(i => i - 1); setAnimDir('in'); }, 220);
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', padding: '70px 28px 30px',
    }}>
      <button onClick={goBack} aria-label={t.back} style={{
        position: 'absolute', top: 18, [rtl ? 'right' : 'left']: 18,
        width: 36, height: 36, borderRadius: 18,
        background: bg, border: `0.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: COURT.green, zIndex: 5,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rtl ? 'scaleX(-1)' : 'none' }}>
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      <div style={{ position: 'absolute', top: 60, left: 70, right: 70, height: 1.5, background: `${COURT.green}25`, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: COURT.green, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 14, marginBottom: 20 }}>
        {t.quizQ} {idx + 1} {t.of} {total}
      </div>

      <div key={idx} style={{
        animation: animDir === 'in' ? 'slideInRight 0.4s ease' : 'slideOutLeft 0.3s ease forwards',
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif',
          fontSize: 26, fontWeight: 500, color: ink, lineHeight: 1.3, marginBottom: 6,
        }}>{txt(q.q)}</div>
        {q.sub && (
          <div style={{
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginBottom: 18,
          }}>{txt(q.sub)}</div>
        )}
        <Ornament width={50} style={{ marginBottom: 20 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => advance(opt.value)} style={{
              textAlign: rtl ? 'right' : 'left', padding: '14px 16px',
              background: dark ? COURT.darkCard : COURT.cream,
              border: `0.5px solid ${border}`, borderRadius: 10, cursor: 'pointer',
              transition: 'all 0.25s ease', animation: `cardIn 0.4s ease ${i * 0.06}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COURT.green; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif', fontSize: 17, color: ink, fontWeight: 500 }}>
                {opt[lang] || opt.en || opt.fr}
              </div>
              <div style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 12.5, color: stone, marginTop: 2 }}>
                {subTxt(opt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
