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
          // 92px rendait le titre large de ~373 px pour 311 px disponibles
          // (375 px d'écran − 2×32 px de padding) : il repassait à la ligne.
          // Plafond en vw calibré sur la largeur mesurée de Pinyon Script
          // (4,055 × la taille de police) pour tenir sur une ligne jusqu'aux
          // écrans de 320 px, tout en gardant 92 px au-delà de 484 px.
          //
          // Ce calibrage portait sur la CHASSE, or en cursive l'encre déborde
          // de sa chasse : mesuré au getBBox() d'un SVG, le trait de sortie du
          // « t » final de « Meet » dépasse de 21,1 % de la taille de police
          // vers la droite. Le titre occupant déjà toute la largeur
          // disponible, ce trait tombait hors cadre et le « t » apparaissait
          // tranché net (signalé sur mobile, reproduit ici).
          // Les marges négatives rendent au titre les 32 px de padding
          // latéral : la place gagnée accueille le débordement d'encre sans
          // rapetisser le mot, le texte restant centré sur sa chasse.
          fontFamily: 'Pinyon Script, Pinyon Fallback, cursive', fontSize: 'min(92px, 19vw)', lineHeight: 0.9,
          marginLeft: -24, marginRight: -24,
          color: dark ? COURT.greenOnDark : COURT.green, animation: 'inkBleed 1.6s ease-out', whiteSpace: 'nowrap',
        }}>
          Padel Meet
        </div>
        <div style={{
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
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
          <ThinButton variant="green" onClick={onStart} lang={lang} full>
            {t.cta_level}
          </ThinButton>
          {onSkip && (
            <div
              onClick={onSkip}
              style={{
                marginTop: 18,
                fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
                color: stone,
                cursor: 'pointer',
                opacity: visible ? 0.6 : 0,
                transform: `translateY(${visible ? 0 : 8}px)`,
                transition: 'opacity 0.8s ease 0.8s, transform 0.8s ease 0.8s',
              }}
            >
              {t.skipForNow || 'Passer pour l\'instant'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
