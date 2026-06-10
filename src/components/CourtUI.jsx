import { useState, useRef, useEffect, useId } from 'react';

// ─── Design tokens ───
export const COURT = {
  green: '#1F5C3F',
  greenDeep: '#0F3D29',
  greenLight: '#2A7A52',
  purple: '#C05050',
  cream: '#F5F1E8',
  creamDark: '#EBE4D2',
  gold: '#C9A961',
  goldLight: '#E8C97A',
  ink: '#1A1A1A',
  stone: '#6B6B6B',
  // Dark mode
  darkBg: '#121A15',
  darkCard: '#1A2820',
  darkBorder: '#2A3D30',
  darkText: '#E8F0EB',
  darkMuted: '#6B8A75',
  darkGold: '#D4AF6A',
  red: '#C0392B',
};

// ─── Dark mode context ───
let _darkMode = false;
export const setDarkMode = (v) => { _darkMode = v; };
export const isDark = () => _darkMode;

// Helper: couleurs dynamiques selon dark mode
export function C(light, dark) {
  return _darkMode ? dark : light;
}

/**
 * Génère un avatar SVG inline avec l'initiale du nom.
 * Utilisé comme fallback quand photo_url est NULL (profils sans photo).
 * Ne charge aucune image externe — 100 % local.
 *
 * @param {string} name - Nom du joueur (prend la 1ère lettre)
 * @param {string} bg   - Couleur de fond (défaut : vert court)
 * @param {string} fg   - Couleur du texte (défaut : crème)
 * @returns {string}    - data URI utilisable dans background: url(...)
 */
export function initialsAvatar(name, bg = '#1F5C3F', fg = '#F5F1E8') {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">',
    `<rect width="200" height="200" fill="${bg}"/>`,
    `<text x="100" y="130" font-family="serif" font-size="96" font-weight="400" `,
    `fill="${fg}" text-anchor="middle" dominant-baseline="auto">${letter}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function PadelBall({ size = 28, color = '#D8E66A', seam = '#fff', shadow = true, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <defs>
        <radialGradient id={`ball-${color.replace('#', '')}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F0F8B0" />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor="#9BB343" />
        </radialGradient>
      </defs>
      {shadow && <ellipse cx="50" cy="92" rx="28" ry="3" fill="rgba(0,0,0,0.18)" />}
      <circle cx="50" cy="48" r="42" fill={`url(#ball-${color.replace('#', '')})`} />
      <path d="M 13 40 Q 50 28 87 40" stroke={seam} strokeWidth="1.6" fill="none" opacity="0.9" />
      <path d="M 13 56 Q 50 70 87 56" stroke={seam} strokeWidth="1.6" fill="none" opacity="0.9" />
      <circle cx="38" cy="36" r="9" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

/**
 * PadelSlider — slider générique avec une balle de padel comme curseur.
 * Utilise un <input type="range"> natif pour garantir le drag tactile sur iOS.
 *
 * Props :
 *   min, max, step    : bornes (par défaut 1, 10, 1)
 *   value, onChange   : valeur contrôlée
 *   dark              : variante sombre
 *   leftLabel, rightLabel : optionnels — labels sous le slider (ex: "1", "10")
 *   bigValue          : si true, affiche la valeur en gros au-dessus
 *   suffix            : suffixe pour la grosse valeur (ex: "/10")
 */
export function PadelSlider({
  min = 1, max = 10, step = 1,
  value, onChange,
  dark = false,
  leftLabel, rightLabel,
  bigValue = false, suffix = '',
}) {
  const stone = dark ? '#7C8B81' : '#6F7B70';
  return (
    <div style={{ width: '100%' }} dir="ltr">
      {bigValue && (
        <div style={{
          textAlign: 'center', fontFamily: 'Spectral, serif',
          fontSize: 88, lineHeight: 1, color: COURT.green, fontWeight: 400, marginBottom: 4,
        }}>
          {value}
          {suffix && <span style={{ fontSize: 28, color: stone, fontStyle: 'italic', fontFamily: 'Spectral, serif' }}>{suffix}</span>}
        </div>
      )}
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        className={`padel-slider${dark ? ' dark' : ''}`}
      />
      {(leftLabel != null || rightLabel != null) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'Mulish', fontSize: 11, color: stone, marginTop: 4,
        }}>
          <span>{leftLabel}</span><span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

export function PadelRacket({ size = 80, frame = COURT.green, grip = COURT.ink, accent = COURT.gold, face, style = {} }) {
  const faceColor = face || COURT.creamDark;
  const holes = [];
  const cx0 = 40, cy0 = 48;
  const rx = 30, ry = 36;
  const step = 5.5;
  for (let row = -6; row <= 6; row++) {
    for (let col = -6; col <= 6; col++) {
      const x = cx0 + col * step + (row % 2 ? step / 2 : 0);
      const y = cy0 + row * step;
      const nx = (x - cx0) / (rx - 4);
      const ny = (y - cy0) / (ry - 4);
      if (nx * nx + ny * ny < 1) holes.push([x, y]);
    }
  }
  const fKey = frame.replace('#', '');
  const fcKey = faceColor.replace('#', '');
  return (
    <svg width={size} height={size * 1.55} viewBox="0 0 80 124" style={style}>
      <defs>
        <linearGradient id={`pr-frame-${fKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={frame} stopOpacity="1" />
          <stop offset="100%" stopColor={frame} stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={`pr-face-${fcKey}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="60%" stopColor={faceColor} stopOpacity="1" />
          <stop offset="100%" stopColor={faceColor} stopOpacity="1" />
        </radialGradient>
      </defs>
      <path d="M 40 10 C 60 10, 72 28, 72 48 C 72 70, 60 86, 40 86 C 20 86, 8 70, 8 48 C 8 28, 20 10, 40 10 Z"
        fill={`url(#pr-frame-${fKey})`} stroke={accent} strokeWidth="0.6" />
      <ellipse cx={cx0} cy={cy0} rx={rx - 1} ry={ry - 1} fill={`url(#pr-face-${fcKey})`} />
      {holes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill={frame} opacity="0.78" />
      ))}
      <path d="M 22 30 Q 40 22 58 30" stroke={accent} strokeWidth="0.7" fill="none" opacity="0.5" />
      <text x="40" y="56" textAnchor="middle" fontFamily="Pinyon Script, cursive" fontSize="11" fill={frame} opacity="0.85">Padel</text>
      <path d="M 28 84 L 24 96 L 32 96 L 36 92 Z" fill={frame} />
      <path d="M 52 84 L 56 96 L 48 96 L 44 92 Z" fill={frame} />
      <path d="M 32 96 Q 40 100 48 96 L 46 102 Q 40 104 34 102 Z" fill={frame} />
      <rect x="33" y="100" width="14" height="20" rx="2.5" fill={grip} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <line key={i} x1={33} y1={102 + i * 3} x2={47} y2={100 + i * 3} stroke={accent} strokeWidth="0.4" opacity="0.55" />
      ))}
      <rect x="31" y="119" width="18" height="3.5" rx="1.5" fill={accent} />
      <path d="M 40 122 Q 40 128 36 128 Q 32 128 32 124" fill="none" stroke={grip} strokeWidth="1" />
    </svg>
  );
}

export function FloatingBalls({ count = 6 }) {
  const color = _darkMode ? COURT.greenLight : COURT.green;
  const balls = Array.from({ length: count }, (_, i) => {
    const seed = i * 137.5;
    return {
      id: i,
      left: ((seed * 7.3 + 5) % 90) + 5,
      top: ((seed * 3.7 + 5) % 90) + 5,
      size: 14 + (seed % 24),
      delay: (seed % 6),
      duration: 8 + (seed % 8),
    };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.2 }}>
      {balls.map(b => (
        <div key={b.id} style={{
          position: 'absolute', left: `${b.left}%`, top: `${b.top}%`,
          animation: `floatBall ${b.duration}s ease-in-out ${b.delay}s infinite`,
        }}>
          <PadelBall size={b.size} shadow={false} />
        </div>
      ))}
    </div>
  );
}

export function Ornament({ width = 80, color, style = {} }) {
  const c = color || (_darkMode ? COURT.darkGold : COURT.green);
  return (
    <svg width={width} height={12} viewBox="0 0 80 12" style={style}>
      <line x1="2" y1="6" x2="30" y2="6" stroke={c} strokeWidth="0.5" />
      <circle cx="36" cy="6" r="2" fill="none" stroke={c} strokeWidth="0.5" />
      <circle cx="40" cy="6" r="1" fill={c} />
      <circle cx="44" cy="6" r="2" fill="none" stroke={c} strokeWidth="0.5" />
      <line x1="50" y1="6" x2="78" y2="6" stroke={c} strokeWidth="0.5" />
    </svg>
  );
}

export function SectionHeading({ children, italic = true }) {
  const color = _darkMode ? COURT.darkText : COURT.ink;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <h3 style={{
        fontFamily: 'Spectral, serif',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: 400, fontSize: 20, margin: 0, color,
      }}>{children}</h3>
      <Ornament width={48} color={_darkMode ? COURT.darkGold : COURT.gold} />
    </div>
  );
}

export function ThinButton({ children, onClick, variant = 'cream', icon, style = {}, full = false }) {
  const isCream = variant === 'cream';
  const bg = _darkMode
    ? (isCream ? COURT.darkCard : COURT.green)
    : (isCream ? COURT.cream : COURT.green);
  const color = isCream
    ? (_darkMode ? COURT.darkText : COURT.green)
    : COURT.cream;
  const border = _darkMode ? `0.5px solid ${COURT.darkBorder}` : `0.5px solid ${COURT.green}`;
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '14px 20px', background: bg, color,
      border, borderRadius: 10,
      fontFamily: 'Spectral, serif',
      fontSize: 16, fontStyle: 'italic',
      letterSpacing: '0.02em', cursor: 'pointer',
      transition: 'all 0.3s ease',
      ...style,
    }}>
      {icon}{children}
    </button>
  );
}

export function HeritageTag({ children, color }) {
  const c = color || (_darkMode ? COURT.greenLight : COURT.green);
  const bg = _darkMode ? COURT.darkCard : COURT.cream;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 10px', background: bg,
      color: c, border: `0.5px solid ${c}40`,
      borderRadius: 4, fontFamily: 'Spectral, serif',
      fontSize: 12, letterSpacing: '0.04em',
    }}>{children}</span>
  );
}

// ─── Skeleton card ───
export function SkeletonCard() {
  const bg = _darkMode ? COURT.darkCard : COURT.cream;
  const cls = _darkMode ? 'skeleton-dark' : 'skeleton';
  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      border: `0.5px solid ${_darkMode ? COURT.darkBorder : COURT.green + '30'}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div className={cls} style={{ height: '46%', borderRadius: 0 }} />
      <div style={{ padding: '16px 20px' }}>
        <div className={cls} style={{ height: 22, width: '60%', marginBottom: 10 }} />
        <div className={cls} style={{ height: 14, width: '40%', marginBottom: 16 }} />
        <div className={cls} style={{ height: 40, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[80, 60, 70].map((w, i) => <div key={i} className={cls} style={{ height: 24, width: w }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Match Flash (It's a match!) ───
export function MatchFlash({ player, t, lang, onMessage, onContinue, onProposeSlot, dark }) {
  const rtl = lang === 'he';

  // Infos de jeu (ton sportif, pas dating)
  const sideLabel = player.side === 'forehand'
    ? (t.forehand || 'Drive')
    : (t.backhand || 'Revers');

  const meta = [
    player.level != null ? `${t.currentLevel || 'Niveau'} ${player.level.toFixed(1)}` : null,
    sideLabel,
    player.city || player.country || null,
  ].filter(Boolean);

  const handlePropose = onProposeSlot || onMessage;

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: `radial-gradient(circle at 50% 35%, ${COURT.greenDeep}, #060E0A)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 32,
    }}>
      {/* En-tête sobre */}
      <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease both' }}>
        <div style={{
          fontFamily: 'Mulish', fontSize: 11, color: COURT.gold,
          letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 14,
        }}>PADEL MEET</div>
        <div style={{
          fontFamily: 'Spectral, serif', fontSize: 40, fontWeight: 600,
          color: COURT.cream, lineHeight: 1.05,
        }}>{t.partnerFound || 'Partenaire trouvé'}</div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 14, color: `${COURT.cream}99`,
          marginTop: 10, maxWidth: 300, lineHeight: 1.5,
        }}>{t.partnerFoundSub || 'Vous cherchez tous les deux à jouer. Organisez votre partie.'}</div>
      </div>

      {/* Carte partenaire — infos de jeu */}
      <div style={{
        marginTop: 32, width: '100%', maxWidth: 340,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderRadius: 16,
        background: 'rgba(255,255,255,0.06)',
        border: `0.5px solid ${COURT.cream}22`,
        animation: 'fadeUp 0.6s ease 0.15s both',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 30, flexShrink: 0,
          background: `url(${player.photo}) center/cover`,
          border: `2px solid ${COURT.gold}`,
        }} />
        <div style={{ minWidth: 0, flex: 1, textAlign: rtl ? 'right' : 'left' }}>
          <div style={{
            fontFamily: 'Spectral, serif', fontSize: 22, fontWeight: 600,
            color: COURT.cream, lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{player.name}</div>
          <div style={{
            fontFamily: 'Mulish', fontSize: 12, color: `${COURT.cream}aa`,
            marginTop: 4, lineHeight: 1.4,
          }}>{meta.join(' · ')}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340,
        marginTop: 28, animation: 'fadeUp 0.6s ease 0.3s both',
      }}>
        {/* CTA principal — Proposer un créneau (Lucide CalendarPlus) */}
        <button onClick={handlePropose} style={{
          padding: '15px', background: COURT.green,
          color: COURT.cream, border: `0.5px solid ${COURT.gold}50`,
          borderRadius: 12, fontFamily: 'Mulish', fontWeight: 600,
          fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="19" y1="16" x2="19" y2="22" /><line x1="16" y1="19" x2="22" y2="19" />
          </svg>
          {t.proposeSlot || 'Proposer un créneau'}
        </button>

        {/* CTA secondaire — Envoyer un message (Lucide MessageSquare) */}
        <button onClick={onMessage} style={{
          padding: '14px', background: 'transparent',
          color: COURT.cream, border: `0.5px solid ${COURT.cream}40`,
          borderRadius: 12, fontFamily: 'Mulish', fontWeight: 500,
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t.sendMsg || 'Envoyer un message'}
        </button>

        {/* Lien discret — Continuer à chercher */}
        <button onClick={onContinue} style={{
          marginTop: 4, padding: '8px', background: 'none', border: 'none',
          color: `${COURT.cream}66`, fontFamily: 'Mulish', fontSize: 13,
          cursor: 'pointer', letterSpacing: '0.02em',
        }}>{t.continueSearching || 'Continuer à chercher'}</button>
      </div>
    </div>
  );
}

// ─── Notification Badge ───
export function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <div style={{
      position: 'absolute', top: -4, right: -4,
      width: 16, height: 16, borderRadius: 8,
      background: COURT.red, color: '#fff',
      fontSize: 11, fontFamily: 'Mulish', fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'notifPop 0.4s cubic-bezier(.2,.9,.3,1.4)',
      border: `1.5px solid ${_darkMode ? COURT.darkBg : COURT.cream}`,
    }}>{count > 9 ? '9+' : count}</div>
  );
}

// ─── Online dot ───
export function OnlineDot({ online }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: 4,
      background: online ? '#4CAF50' : COURT.stone,
      border: `1.5px solid ${_darkMode ? COURT.darkCard : COURT.cream}`,
      flexShrink: 0,
    }} />
  );
}

// ─── Bottom Sheet ───
export function BottomSheet({ children, onClose, title, dark }) {
  const bg = dark ? COURT.darkCard : COURT.cream;
  const border = dark ? COURT.darkBorder : `${COURT.green}30`;
  const [dragY, setDragY] = useState(0);
  const [snapping, setSnapping] = useState(false);
  // Après l'animation d'ouverture, on n'utilise plus jamais l'animation CSS
  // (sinon elle rejoue à chaque fois que dragY revient à 0 → crépitement)
  const [entered, setEntered] = useState(false);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);
  const dragEnabled = useRef(false);       // drag-to-close activé seulement si touch sur la poignée OU contenu en haut
  const sheetRef = useRef(null);

  useEffect(() => {
    // L'animation sheetUp dure 350 ms — on la désactive ensuite définitivement
    const t = setTimeout(() => setEntered(true), 380);
    return () => clearTimeout(t);
  }, []);

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    // N'active le drag QUE si on est tout en haut du scroll
    // (sinon on laisse le scroll natif fonctionner sans interférence)
    dragEnabled.current = (sheetRef.current?.scrollTop ?? 0) <= 0;
    setSnapping(false);
  }

  function handleTouchMove(e) {
    if (touchStartY.current === null || !dragEnabled.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Si on swipe vers le haut, on désactive le drag (l'utilisateur scrolle)
    if (delta < -4) {
      dragEnabled.current = false;
      setDragY(0);
      return;
    }
    if (delta > 0) setDragY(delta);
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null) {
      dragEnabled.current = false;
      return;
    }
    const wasDragging = dragEnabled.current;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = delta / elapsed; // px/ms
    touchStartY.current = null;
    dragEnabled.current = false;

    if (wasDragging && (delta > 90 || velocity > 0.45)) {
      onClose?.();
    } else {
      setSnapping(true);
      setDragY(0);
      setTimeout(() => setSnapping(false), 320);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%', maxHeight: '90vh',
          background: bg, borderRadius: '20px 20px 0 0',
          border: `0.5px solid ${border}`,
          overflowY: 'auto',
          overflowX: 'hidden',
          // Après l'animation initiale (entered=true), on fixe transform à translateY(dragY)
          // pour éviter que l'animation CSS ne rejoue à chaque retour à dragY=0 (clignotement)
          animation: entered ? 'none' : 'sheetUp 0.35s cubic-bezier(.2,.9,.3,1)',
          transform: entered ? `translateY(${dragY}px)` : undefined,
          transition: (entered && snapping) ? 'transform 0.3s cubic-bezier(.2,.9,.3,1)' : 'none',
          paddingBottom: 40,
          willChange: 'transform',
        }}>
        {/* Handle + bouton fermer (croix) en haut pour sortie facile */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          background: bg,
          display: 'flex', flexDirection: 'column',
          borderBottom: title ? `0.5px solid ${border}` : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: dark ? COURT.darkBorder : `${COURT.green}40` }} />
          </div>
          {title && (
            <div style={{
              padding: '4px 24px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{
                fontFamily: 'Spectral, serif', fontStyle: 'italic',
                fontSize: 22, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500,
                flex: 1, minWidth: 0,
              }}>{title}</div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: dark ? COURT.darkBg : `${COURT.green}10`,
                  border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '40'}`,
                  color: dark ? COURT.darkText : COURT.green,
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Nav icons ───
const NAV_ICONS = {
  home: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  search: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  learn: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.2H4.5A1.5 1.5 0 0 1 3 16.3z" />
      <path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.2h5.9a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  ),
  trophy: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4z" />
      <path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3" />
      <path d="M10 14h4v3l1 3H9l1-3z" />
    </svg>
  ),
  chat: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  user: (active, dark) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
};

export function BottomNav({ active, onChange, t, notifCount, chatCount, dark }) {
  const bg = dark ? COURT.darkCard : COURT.cream;
  const border = dark ? COURT.darkBorder : `${COURT.green}40`;
  const activeColor = dark ? COURT.greenLight : COURT.green;
  const inactiveColor = dark ? COURT.darkMuted : COURT.stone;
  const dotColor = dark ? COURT.darkGold : COURT.gold;

  const items = [
    { id: 'search', label: t?.search || 'Find', iconKey: 'search' },
    { id: 'learn', label: t?.learn || 'Learn', iconKey: 'learn' },
    { id: 'chat', label: t?.chat || 'Chat', iconKey: 'chat', badge: chatCount },
    { id: 'trophy', label: t?.matches || 'Matches', iconKey: 'trophy' },
    { id: 'profile', label: t?.profile || 'Profile', iconKey: 'user' },
  ];

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: bg, borderTop: `0.5px solid ${border}`,
      padding: '10px 8px 28px',
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => {
            if (navigator.vibrate) navigator.vibrate(8);
            onChange(it.id);
          }} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
            color: isActive ? activeColor : inactiveColor,
            transition: 'color 0.25s',
            position: 'relative',
          }}>
            {it.badge > 0 && <NotifBadge count={it.badge} />}
            {NAV_ICONS[it.iconKey](isActive, dark)}
            <div style={{
              width: 4, height: 4, borderRadius: 4,
              background: isActive ? dotColor : 'transparent',
              transition: 'background 0.25s',
            }} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Trophées cliquables avec bulle de progression (auto-fermeture 3,5s) ───
export function Achievements({ badges, dark }) {
  const [open,   setOpen]   = useState(null);
  const [tipPos, setTipPos] = useState(null); // { left, bottom, arrowLeft } en px viewport
  const timer   = useRef();
  const btnRefs = useRef({});

  const toggle = (i) => {
    clearTimeout(timer.current);
    const btn  = btnRefs.current[i];
    const rect = btn?.getBoundingClientRect();
    if (rect) {
      const TW          = 172;
      const badgeCenterX = rect.left + rect.width / 2;
      const safeLeft    = Math.min(Math.max(8, badgeCenterX - TW / 2), window.innerWidth - TW - 8);
      setTipPos({
        left:      safeLeft,
        bottom:    window.innerHeight - rect.top + 12,
        arrowLeft: Math.max(7, Math.min(TW - 21, badgeCenterX - safeLeft - 7)),
      });
    }
    setOpen(prev => {
      if (prev === i) { setTipPos(null); return null; }
      timer.current = setTimeout(() => { setOpen(null); setTipPos(null); }, 3500);
      return i;
    });
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const stone  = dark ? COURT.darkMuted : COURT.stone;
  const cardBg = dark ? COURT.darkCard  : COURT.creamDark;
  const b      = open !== null ? badges[open] : null;
  const pct    = b ? (b.on ? 100 : Math.min(100, (b.progress.cur / b.progress.max) * 100)) : 0;

  return (
    <>
      {/* Tooltip en position:fixed — échappe tout overflow:hidden/auto des parents */}
      {b && tipPos && (
        <div style={{
          position: 'fixed',
          left:     tipPos.left,
          bottom:   tipPos.bottom,
          width:    172,
          background:  COURT.greenDeep,
          color:       COURT.cream,
          borderRadius: 12,
          padding:     '12px 14px',
          zIndex:      9999,
          boxShadow:   '0 8px 24px rgba(15,61,41,0.3)',
          animation:   'bubbleIn 0.25s ease',
          pointerEvents: 'none',
        }}>
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontWeight: 600, fontSize: 14, color: COURT.gold }}>
            {b.label}
          </div>
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 12, lineHeight: 1.4, marginTop: 3 }}>
            {b.desc}
          </div>
          <div style={{ height: 5, background: `${COURT.cream}25`, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: COURT.gold, borderRadius: 3 }} />
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 11, color: `${COURT.cream}b0`, marginTop: 5, textAlign: 'right' }}>
            {b.on ? '100%' : `${b.progress.cur} / ${b.progress.max}`}
          </div>
          <div style={{
            position: 'absolute', top: '100%', left: tipPos.arrowLeft,
            width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop:  `7px solid ${COURT.greenDeep}`,
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {badges.map((badge, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              ref={el => { btnRefs.current[i] = el; }}
              onClick={() => toggle(i)}
              style={{
                width: 52, height: 52, borderRadius: 26, padding: 0,
                background: badge.on ? COURT.green : cardBg,
                border: `0.5px solid ${badge.on ? COURT.gold : COURT.green + '20'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, cursor: 'pointer',
                filter: badge.on ? 'none' : 'grayscale(1)',
                opacity: badge.on ? 1 : 0.5,
                boxShadow: open === i ? `0 0 0 3px ${COURT.gold}40` : 'none',
                transform: open === i ? 'translateY(-2px)' : 'none',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
            >
              {badge.on ? badge.icon : '🔒'}
            </button>
            <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.04em', marginTop: 6, lineHeight: 1.3, textAlign: 'center', maxWidth: '90%' }}>
              {badge.label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Anneau de compatibilité ───
export function CompatRing({ size = 54, value = 90, stroke = COURT.gold, txt = COURT.green, track = `${COURT.green}20`, label, rtl = false }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const pathId = useId();
  // Demi-arc bas, parcouru gauche→droite → le texte suit la courbe et reste à l'endroit
  const lr = r - 4;
  const arc = `M ${cx - lr},${cy} A ${lr},${lr} 0 0 0 ${cx + lr},${cy}`;
  const labelSize = Math.max(5.5, size * 0.092);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="4" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value/100)} transform={`rotate(-90 ${cx} ${cy})`} />
        {label && (
          <>
            <path id={pathId} d={arc} fill="none" />
            {/* RTL : on inverse les caractères de la chaîne so qu'ils se lisent
                droite→gauche le long de l'arc gauche→droite (effet visuel correct) */}
            <text fill={txt} textAnchor="middle" style={{
              fontFamily: 'Mulish', fontSize: labelSize, letterSpacing: '0.01em',
            }}>
              <textPath href={`#${pathId}`} startOffset="50%">
                {rtl ? [...label].reverse().join('') : label}
              </textPath>
            </text>
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontFamily: 'Spectral, serif', fontSize: size * 0.28, color: txt, lineHeight: 1,
          transform: label ? 'translateY(-3px)' : 'none',
        }}>{value}%</span>
      </div>
    </div>
  );
}
