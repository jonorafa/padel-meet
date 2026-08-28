import { useState, useRef, useEffect, useId } from 'react';
import { GLOSSARY } from '../data/courtData';

// ─── Design tokens ───
export const COURT = {
  green: '#1F5C3F',
  greenDeep: '#0F3D29',
  // Fond de pastille (nœud « en cours » du parcours Apprendre). Sert de FOND,
  // pas de texte — ne pas l'éclaircir pour des raisons de contraste de texte,
  // c'est greenOnDark ci-dessous qui joue ce rôle.
  greenLight: '#2A7A52',
  // Vert lisible SUR fond sombre. #1F5C3F donne 2.25:1 sur darkBg (#121A15)
  // et 1.98:1 sur darkCard (#1A2820) — très en dessous du seuil AA de 4.5.
  // #7FBF9B : 8.30:1 sur darkBg, 7.32:1 sur darkCard → AA et AAA sur les deux.
  greenOnDark: '#7FBF9B',
  // Rouille/corail (ex-"purple" — le nom ne décrivait pas la vraie teinte,
  // renommé sans changer la valeur). Sert au concept "défaite/négatif" dans
  // un match, distinct de `red` qui reste réservé à "erreur/danger".
  rust: '#C05050',
  // Idem pour le rouille : #C05050 tombe à 3.80:1 sur darkBg et 3.36:1 sur
  // darkCard. #E89494 : 7.68:1 et 6.78:1 → AA partout, AAA sur darkBg, et
  // aligné sur le poids visuel du gold (7.88) pour que les deux accents se
  // valent en mode sombre.
  rustOnDark: '#E89494',
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
  // #6B8A75 donnait un ratio ≈4:1 sur darkCard (#1A2820), sous le seuil AA —
  // et c'est la couleur de TOUS les libellés secondaires en mode sombre.
  darkMuted: '#8FB39C',
  darkGold: '#D4AF6A',
  red: '#C0392B',
};

// ─── Échelle typographique ───
// Plus rien sous 13px dans l'app. 6 crans, aucune valeur intermédiaire.
export const TYPE = {
  micro:   13,  // libellés secondaires, métadonnées, compteurs
  body:    15,  // corps de texte dense (listes, messages)
  bodyLg:  17,  // corps de texte de lecture (conseils, bios)
  title:   20,  // titres de section (Spectral italique)
  screen:  26,  // titre d'écran (Spectral italique)
  hero:    34,  // chiffre dominant
  display: 52,  // niveau sur le profil (LevelBlock)
  giant:   88,  // valeur du slider d'auto-évaluation
};

// ─── Interlettrage ───
// Une seule valeur, réservée aux sur-titres capitales.
export const TRACK = {
  caps: '0.14em',
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
  bigValue = false, suffix = '', lang,
}) {
  const stone = dark ? '#7C8B81' : '#6F7B70';
  return (
    <div style={{ width: '100%' }} dir="ltr">
      {bigValue && (
        <div style={{
          textAlign: 'center', fontFamily: 'Spectral, serif',
          fontSize: TYPE.giant, lineHeight: 1, color: dark ? COURT.greenOnDark : COURT.green, fontWeight: 400, marginBottom: 4,
        }}>
          {value}
          {suffix && <span style={{ fontSize: 28, color: stone, fontStyle: lang === 'he' ? 'normal' : 'italic', fontFamily: 'Spectral, serif' }}>{suffix}</span>}
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
          fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, marginTop: 4,
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
      <text x="40" y="56" textAnchor="middle" fontFamily="Pinyon Script, Pinyon Fallback, cursive" fontSize="11" fill={frame} opacity="0.85">Padel</text>
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
        fontWeight: 400, fontSize: TYPE.title, margin: 0, color,
      }}>{children}</h3>
      <Ornament width={48} color={_darkMode ? COURT.darkGold : COURT.gold} />
    </div>
  );
}

export function ThinButton({ children, onClick, variant = 'cream', icon, style = {}, full = false, lang }) {
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
      fontSize: 16, fontStyle: lang === 'he' ? 'normal' : 'italic',
      letterSpacing: '0.02em', cursor: 'pointer',
      transition: 'all 0.3s ease',
      ...style,
    }}>
      {icon}{children}
    </button>
  );
}

export function HeritageTag({ children, color }) {
  const c = color || (_darkMode ? COURT.greenOnDark : COURT.green);
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
export function MatchFlash({ player, t, lang, onMessage, onContinue, onProposeSlot }) {
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
          fontFamily: 'Mulish', fontSize: TYPE.micro, color: COURT.gold,
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

// ─── Icônes d'état — même style que les icônes de nav (linecap round) ───
// Remplacent les emoji ⚡ ⏳ ⚠️ ✕ du panneau des scores à confirmer : c'est
// l'écran où l'on confirme un résultat de match, il mérite le même soin.
export const LightningIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
  </svg>
);

export const HourglassIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12M6 22h12M7 2c0 5 3.5 6 5 8-1.5 2-5 3-5 8M17 2c0 5-3.5 6-5 8 1.5 2 5 3 5 8" />
  </svg>
);

export const AlertIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.86 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
  </svg>
);

export const XIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const StarIcon = ({ size = 16, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
  </svg>
);

export const TrendUpIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" />
  </svg>
);

export const BellIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// ─── Verrou binaire (chapitre verrouillé / déverrouillé) ───
// Vivait dans LearnScreen.jsx ; partagé ici pour tout écran binaire à venir.
// Les trophées n'utilisent PAS ce cadenas : ils ont une progression continue
// (3/5), donc un anneau de progression (cf Achievements) y dit bien plus.
export function LockIcon({ size = 26, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
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
      fontSize: TYPE.micro, fontFamily: 'Mulish', fontWeight: 600,
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
export function BottomSheet({ children, onClose, title, dark, lang }) {
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
                fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic',
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

// ─── Bouton de choix de langue (ligne d'un BottomSheet « Langue ») ───
export function LangButton({ code, flag, label, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const dark = isDark();
  const card = dark ? COURT.darkCard : '#F7F3EA';
  const border = dark ? COURT.darkBorder : `${COURT.green}50`;
  const ink = dark ? COURT.darkText : COURT.ink;

  return (
    <button
      onClick={() => onSelect(code)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
        background: hovered ? COURT.green : card,
        border: `0.5px solid ${hovered ? COURT.green : border}`,
        transition: 'all 0.2s',
      }}
    >
      <span style={{ fontSize: 28 }}>{flag}</span>
      <span style={{
        fontFamily: 'Mulish, sans-serif',
        fontSize: 20, fontWeight: 500,
        color: hovered ? COURT.cream : ink,
      }}>{label}</span>
    </button>
  );
}

// ─── Nav icons ───
const NAV_ICONS = {
  home: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  search: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  learn: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="13" y2="11" />
    </svg>
  ),
  trophy: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4z" />
      <path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3" />
      <path d="M10 14h4v3l1 3H9l1-3z" />
    </svg>
  ),
  chat: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  user: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
};

/**
 * En-tête d'écran unique. Remplace les copies manuelles de MatchScreen
 * (SwipeStack, ChatScreen, MatchesScreen) — leurs pastilles de notification
 * divergeaient (12px sans animation vs 14px avec `notifPop`) faute d'un seul
 * composant partagé. `children` (optionnel) reçoit des actions additionnelles
 * affichées avant la cloche de notifications.
 */
export function ScreenHeader({ eyebrow, title, notifCount = 0, onShowNotifs, dark, rtl = false, children, paddingTop = '56px' }) {
  const ink    = dark ? COURT.darkText   : COURT.ink;
  const border = dark ? COURT.darkBorder : `${COURT.green}30`;
  const accent = dark ? COURT.greenOnDark : COURT.green;
  const ff     = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      padding: `${paddingTop} 22px 16px`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
      borderBottom: `0.5px solid ${border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{
            fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 700,
            letterSpacing: TRACK.caps, textTransform: 'uppercase',
            color: accent, marginBottom: 3,
          }}>{eyebrow}</div>
        )}
        <div style={{
          fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500,
          fontSize: TYPE.screen, lineHeight: 1.1, color: ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {children}
        {onShowNotifs && (
          <button onClick={onShowNotifs} aria-label="Notifications" style={{
            position: 'relative', width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: ink,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <NotifBadge count={notifCount} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BottomNav({ active, onChange, t, chatCount, dark }) {
  const bg = dark ? COURT.darkCard : COURT.cream;
  const border = dark ? COURT.darkBorder : `${COURT.green}40`;
  const activeColor = dark ? COURT.greenOnDark : COURT.green;
  const inactiveColor = dark ? COURT.darkMuted : COURT.stone;

  const items = [
    // id 'home' : l'onglet rend HomeScreen (cf. la table `screens` de MainApp),
    // l'ancien id 'learn' désignait en fait LearnScreen, ouvert séparément par
    // dessus via showLearn — d'où la confusion à la lecture.
    // iconKey volontairement laissé sur 'learn' : NAV_ICONS.home existe (une
    // maison) mais iconKey choisit le GLYPHE affiché, pas un nom interne —
    // basculer changerait le livre en maison dans la barre de nav, sous un
    // libellé « Conseil ». Renommage interne uniquement, rendu inchangé.
    { id: 'home', label: t?.learn || 'Learn', iconKey: 'learn' },
    { id: 'search', label: t?.search || 'Find', iconKey: 'search' },
    { id: 'chat', label: t?.chat || 'Chat', iconKey: 'chat', badge: chatCount },
    { id: 'trophy', label: t?.matches || 'Matches', iconKey: 'trophy' },
    { id: 'profile', label: t?.profile || 'Profile', iconKey: 'user' },
  ];

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: bg, borderTop: `0.5px solid ${border}`,
      padding: '8px 6px 26px',
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => {
            if (navigator.vibrate) navigator.vibrate(8);
            onChange(it.id);
          }} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 6px', minWidth: 60, minHeight: 48, boxSizing: 'border-box',
            color: isActive ? activeColor : inactiveColor,
            transition: 'color 0.25s',
            position: 'relative',
          }}>
            {/* Le badge s'ancre sur l'ICÔNE, pas sur le bouton : celui-ci fait
                60px de large pour la zone tactile alors que l'icône en fait 22,
                donc un positionnement relatif au bouton décollait la pastille
                loin sur la droite au lieu de la poser sur le coin de l'icône.
                Les deux autres NotifBadge (les cloches) restent inchangés :
                leurs boutons sont déjà ajustés à l'icône. */}
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {NAV_ICONS[it.iconKey](isActive, dark)}
              {it.badge > 0 && <NotifBadge count={it.badge} />}
            </span>
            <div style={{
              fontFamily: 'Mulish', fontSize: TYPE.micro,
              fontWeight: isActive ? 800 : 600, lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Trophées cliquables avec bulle de progression (auto-fermeture 3,5s) ───
export function Achievements({ badges, dark, lang }) {
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
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontWeight: 600, fontSize: 14, color: COURT.gold }}>
            {b.label}
          </div>
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 12, lineHeight: 1.4, marginTop: 3 }}>
            {b.desc}
          </div>
          <div style={{ height: 5, background: `${COURT.cream}25`, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: COURT.gold, borderRadius: 3 }} />
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, color: `${COURT.cream}b0`, marginTop: 5, textAlign: lang === 'he' ? 'left' : 'right' }}>
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
        {badges.map((badge, i) => {
          // État verrouillé : l'icône reste visible (en gris), et un anneau
          // doré montre la progression — le cadenas précédent était identique
          // pour les trois trophées et ne disait pas ce qu'il restait à faire.
          const prog = badge.progress;
          const showRing = !badge.on && prog && prog.cur > 0;
          const C = 163.36; // circonférence pour r=26
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 52, height: 52 }}>
                <button
                  ref={el => { btnRefs.current[i] = el; }}
                  onClick={() => toggle(i)}
                  style={{
                    width: 52, height: 52, borderRadius: 26, padding: 0,
                    background: badge.on ? COURT.green : cardBg,
                    border: `0.5px solid ${badge.on ? COURT.gold : COURT.green + '20'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: open === i ? `0 0 0 3px ${COURT.gold}40` : 'none',
                    transform: open === i ? 'translateY(-2px)' : 'none',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                >
                  {badge.Icon
                    ? <badge.Icon size={24} color={badge.on ? COURT.goldLight : (_darkMode ? COURT.darkMuted : COURT.stone)} />
                    : <span style={{ fontSize: 22 }}>{badge.icon}</span>}
                </button>
                {showRing && (
                  <svg width={52} height={52} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <circle cx="26" cy="26" r="25" fill="none" stroke={COURT.gold} strokeWidth="2" strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - prog.cur / prog.max)}
                      transform="rotate(-90 26 26)" />
                  </svg>
                )}
              </div>
              <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, letterSpacing: '0.04em', marginTop: 6, lineHeight: 1.3, textAlign: 'center', maxWidth: '90%' }}>
                {badge.label}
                {showRing && (
                  <div style={{ color: COURT.gold, fontWeight: 700, marginTop: 2 }}>
                    {prog.cur} / {prog.max}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Rangée de badges compacte (icônes débloquées uniquement, sans barre de
// progression) — pour les vues où l'on affiche le profil d'un tiers : carte
// de recherche, fiche détaillée. La vue complète avec progression reste
// `Achievements`, réservée à l'onglet Matchs de l'utilisateur connecté.
// Fait le lien entre la clé retournée par computeBadges() (src/lib/badges.js)
// et les libellés déjà traduits (t.trophyXxx), partagés avec la vue complète
// Achievements de l'onglet Matchs.
export const BADGE_LABEL_KEY = {
  first_match: 'trophyFirstMatch',
  streak_5:    'trophyStreak5',
  matches_10:  'trophyTenMatches',
  level_5:     'trophyLevel5',
};

export function BadgeRow({ badges, size = 18, label, dark, t, align = 'start', tappable = true }) {
  const [open, setOpen] = useState(null);
  const [tipPos, setTipPos] = useState(null); // { left, top } en px viewport, déjà bornés
  const btnRefs = useRef({});
  const unlocked = badges.filter(b => b.unlocked);
  if (unlocked.length === 0) return null;
  const stone   = dark ? COURT.darkMuted : COURT.stone;
  const circleBg = dark ? COURT.darkCard : COURT.cream;
  const border   = dark ? COURT.darkBorder : `${COURT.gold}60`;
  const circleSize = size + 16;

  const toggle = (key) => {
    if (open === key) { setOpen(null); return; }
    const btn = btnRefs.current[key];
    const rect = btn?.getBoundingClientRect();
    if (rect) {
      const TW = 150; // largeur approx de la bulle
      const center = rect.left + rect.width / 2;
      const safeLeft = Math.min(Math.max(8, center - TW / 2), window.innerWidth - TW - 8);
      setTipPos({ left: safeLeft, top: rect.bottom + 6 });
    }
    setOpen(key);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: align === 'end' ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>
        {unlocked.map(b => {
          const badgeLabel = t?.[BADGE_LABEL_KEY[b.key]] || b.key;
          return (
            <button
              key={b.key}
              ref={el => { btnRefs.current[b.key] = el; }}
              type="button"
              onClick={tappable ? () => toggle(b.key) : undefined}
              title={badgeLabel}
              aria-label={badgeLabel}
              style={{
                width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                background: circleBg, border: `1px solid ${border}`, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: size, lineHeight: 1, flexShrink: 0,
                cursor: tappable ? 'pointer' : 'default',
                boxShadow: dark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(15,61,41,0.12)',
              }}
            >
              {b.Icon
                ? <b.Icon size={size} color={COURT.goldLight} />
                : b.icon}
            </button>
          );
        })}
      </div>
      {/* Bulle en position:fixed — échappe tout overflow/bord de carte, bornée à
          l'écran comme dans Achievements (même technique, cf plus haut). */}
      {tappable && open && tipPos && (
        <div style={{
          position: 'fixed', left: tipPos.left, top: tipPos.top,
          zIndex: 9999, whiteSpace: 'nowrap',
          background: COURT.greenDeep, color: COURT.cream,
          padding: '5px 10px', borderRadius: 8,
          fontFamily: 'Mulish', fontSize: TYPE.micro,
          boxShadow: '0 4px 12px rgba(15,61,41,0.25)',
        }}>{t?.[BADGE_LABEL_KEY[open]] || open}</div>
      )}
      {label && (
        <div style={{
          fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, letterSpacing: '0.04em',
          textAlign: align === 'end' ? 'right' : 'left', lineHeight: 1.35,
        }}>
          {label}
        </div>
      )}
    </div>
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
            {/* RTL : direction + unicodeBidi natifs plutôt qu'un reverse() manuel
                caractère par caractère — celui-ci inversait aussi les runs LTR
                imbriqués (ex: "90%" devenait "%09") et cassait lecteurs d'écran
                et copier-coller, les caractères étant réellement dans le désordre
                dans le DOM. L'algorithme bidi du navigateur gère nativement le
                texte mixte hébreu/latin/chiffres. */}
            <text fill={txt} textAnchor="middle" style={{
              fontFamily: 'Mulish', fontSize: labelSize, letterSpacing: '0.01em',
            }}>
              <textPath href={`#${pathId}`} startOffset="50%" direction={rtl ? 'rtl' : 'ltr'} unicodeBidi="plaintext">
                {label}
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

// ─── Rendu de texte avec termes du glossaire cliquables ──────────────────────
// Parcourt le texte, détecte les termes du glossaire (pour la langue courante)
// et les entoure d'un <span> vert/souligné cliquable. Déplacé depuis
// ScoreScreen.jsx pour être réutilisable ailleurs (LevelBlock, StreakScreen).
export function renderWithGlossary(text, lang, onTermClick) {
  if (!text || !GLOSSARY?.length) return text;

  // Collecte les termes pour la langue courante + leurs clés de glossaire
  const termMap = GLOSSARY.map(entry => ({
    display: entry.term[lang] || entry.term.fr,
    key: entry.key,
  })).filter(t => t.display);

  // Trie du plus long au plus court pour éviter les captures partielles
  termMap.sort((a, b) => b.display.length - a.display.length);

  // Construction d'un regex case-insensitive groupant tous les termes
  const escaped = termMap.map(t => t.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const match = termMap.find(t => t.display.toLowerCase() === part.toLowerCase());
    if (match) {
      return (
        <span
          key={i}
          onClick={e => { e.stopPropagation(); onTermClick(match.key); }}
          style={{
            // renderWithGlossary est une fonction utilitaire, pas un composant :
            // aucune prop `dark` ne lui parvient. On lit l'état module-level,
            // comme HeritageTag plus haut dans ce fichier.
            color: _darkMode ? COURT.greenOnDark : COURT.green,
            cursor: 'pointer',
            fontStyle: 'normal',
            // text-decoration + text-underline-offset plutôt que borderBottom :
            // un border-bottom colle au bas de la boîte de ligne du span (qui
            // suit le line-height généreux du paragraphe), pas aux jambages du
            // mot — sur les questions à gros line-height, le pointillé se
            // retrouvait visuellement loin de « bandeja » et proche de la
            // ligne suivante. text-underline-offset donne un contrôle direct
            // en pixels, indépendant du line-height du parent.
            textDecorationLine: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: _darkMode ? COURT.greenOnDark : COURT.green,
            textDecorationThickness: '1.5px',
            textUnderlineOffset: '2px',
          }}
        >{part}</span>
      );
    }
    return part;
  });
}

// ─── Tooltip / carte de définition ───────────────────────────────────────────
export function GlossaryCard({ termKey, lang, dark, onClose }) {
  const entry = GLOSSARY?.find(g => g.key === termKey);
  if (!entry) return null;

  const bg     = dark ? COURT.darkCard  : '#FFFDF8';
  const ink    = dark ? COURT.darkText  : COURT.ink;
  const stone  = dark ? COURT.darkMuted : COURT.stone;
  const border = dark ? COURT.darkBorder: `${COURT.green}40`;

  return (
    // Overlay semi-transparent — clic en dehors ferme
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 450,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end',
        padding: '0 20px 40px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: bg,
          border: `0.5px solid ${border}`,
          borderRadius: 16, padding: '20px 20px 24px',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
          animation: 'fadeUp 0.25s ease',
        }}
      >
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            fontFamily: 'Spectral, serif',
            fontSize: 22, fontWeight: 600, color: dark ? COURT.greenOnDark : COURT.green,
            fontStyle: lang === 'he' ? 'normal' : 'italic',
          }}>
            {entry.term[lang] || entry.term.fr}
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'he' ? 'סגור' : lang === 'en' ? 'Close' : 'Fermer'}
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: `${COURT.green}18`, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: dark ? COURT.greenOnDark : COURT.green,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Séparateur */}
        <div style={{ height: 0.5, background: `${COURT.green}30`, marginBottom: 12 }} />

        {/* Définition */}
        <div style={{
          fontFamily: 'Spectral, serif',
          fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 15,
          color: ink, lineHeight: 1.6,
        }}>
          {entry.def[lang] || entry.def.fr}
        </div>

        {/* Label "Vocabulaire padel" */}
        <div style={{
          marginTop: 14,
          fontFamily: 'Mulish', fontSize: 13,
          color: stone,
        }}>
          {lang === 'he' ? 'מילון פאדל' : lang === 'en' ? 'Padel glossary' : 'Vocabulaire padel'}
        </div>
      </div>
    </div>
  );
}
