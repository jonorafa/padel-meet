import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COURT, PadelBall, PadelRacket, FloatingBalls, Ornament,
  SectionHeading, ThinButton, HeritageTag, BottomNav,
  SkeletonCard, MatchFlash, NotifBadge, OnlineDot, BottomSheet,
  setDarkMode, isDark, initialsAvatar,
} from '../components/CourtUI';
import { REGIONS, computeELODelta, I18N } from '../data/courtData';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useAuth }          from '../context/AuthContext';
import { usePrefs }         from '../context/PrefsContext';
import { usePlayers }       from '../hooks/usePlayers';
import { useSwipes }        from '../hooks/useSwipes';
import { useUserMatches }   from '../hooks/useUserMatches';
import { useMatchHistory }  from '../hooks/useMatchHistory';
import { useNotifications } from '../hooks/useNotifications';
import { DetailedProfileModal } from '../components/DetailedProfileModal';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { PendingMatchesPanel } from '../components/PendingMatchesPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMatchResults } from '../hooks/useMatchResults';
import { supabase }         from '../lib/supabase';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Compresse une image via canvas (max ~1200px côté long, qualité 0.82). */
async function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else                 { width  = Math.round(width  * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression échouée')),
        'image/jpeg', quality
      );
    };
    img.onerror = () => reject(new Error('Image invalide'));
    reader.readAsDataURL(file);
  });
}

function formatLastSeen(ts) {
  if (!ts) return '?';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

function matchToActivity(m) {
  const d = m.date || new Date();
  const relDay = () => {
    const diffH = (Date.now() - d.getTime()) / 3600000;
    if (diffH < 30) return { fr: 'Hier', en: 'Yesterday', he: 'אתמול' };
    return {
      fr: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      en: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      he: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
    };
  };
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const rd = relDay();
  return {
    id: m.id,
    kind: 'match',
    date:  { fr: `${rd.fr} · ${time}`, en: `${rd.en} · ${time}`, he: `${rd.he} · ${time}` },
    title: { fr: m.result === 'win' ? 'Victoire' : 'Défaite serrée', en: m.result === 'win' ? 'Win' : 'Close loss', he: m.result === 'win' ? 'ניצחון' : 'הפסד' },
    sub:   { fr: `contre ${m.player?.name || 'Adversaire'}`, en: `vs ${m.player?.name || 'Opponent'}`, he: `נגד ${m.player?.name || 'יריב'}` },
    delta: m.delta,
    scoreL: m.score?.split(' ')[0],
    scoreR: m.score?.split(' ')[1],
  };
}

// ─── Preferences Chips ─────────────────────────────────────────────────────
function Chips({ value, onChange, options, dark }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt.v;
        return (
          <button key={opt.v} onClick={() => onChange(opt.v)} style={{
            padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
            color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '60'}`,
            borderRadius: 999, cursor: 'pointer',
            fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
            fontSize: 14, transition: 'all 0.2s',
          }}>
            {opt.icon && <span style={{ fontSize: 11 }}>{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Range Bar ─────────────────────────────────────────────────────────────
function RangeBar({ min, max, step, valueMin, valueMax, onChange, dark }) {
  // Le pouce gauche doit être cliquable même quand il est à la position minimale :
  // on lui donne un z-index plus élevé quand il est dans la moitié gauche de la plage.
  const minPct = (valueMin - min) / (max - min)
  const zMin = minPct <= 0.5 ? 4 : 2
  const zMax = minPct <= 0.5 ? 2 : 4

  return (
    <div style={{ position: 'relative', padding: '12px 0' }}>
      <div style={{ height: 2, background: `${COURT.green}25`, position: 'relative', borderRadius: 1 }}>
        <div style={{
          position: 'absolute', height: '100%',
          left: `${((valueMin - min) / (max - min)) * 100}%`,
          width: `${((valueMax - valueMin) / (max - min)) * 100}%`,
          background: COURT.green,
        }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={valueMin}
        onChange={e => onChange(Math.min(+e.target.value, valueMax - step), valueMax)}
        style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', zIndex: zMin }} />
      <input type="range" min={min} max={max} step={step} value={valueMax}
        onChange={e => onChange(valueMin, Math.max(+e.target.value, valueMin + step))}
        style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', zIndex: zMax }} />
      <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${((valueMin - min) / (max - min)) * 100}%`, pointerEvents: 'none' }}>
        <PadelBall size={20} />
      </div>
      <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${((valueMax - min) / (max - min)) * 100}%`, pointerEvents: 'none' }}>
        <PadelBall size={20} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 9, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.18em', marginTop: 14 }}>
        <span>{min.toFixed(1)}</span><span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

function PrefGroup({ label, children, dark }) {
  return (
    <div style={{ padding: '16px 24px 4px' }}>
      <div style={{ fontFamily: 'Inter', fontSize: 10, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Preferences (Bottom Sheet) ────────────────────────────────────────────
function PreferencesSheet({ t, lang, initial, onApply, onClose, dark }) {
  const [side, setSide]             = useState(initial.side || 'any');
  const [style, setStyle]           = useState(initial.style || 'any');
  const [motivation, setMotivation] = useState(initial.motivation || 'any');
  const [hand, setHand]             = useState(initial.hand || 'any');
  const [region, setRegion]         = useState(initial.region || 'any');
  const [levelMin, setLevelMin]     = useState(initial.levelMin ?? 1);
  const [levelMax, setLevelMax]     = useState(initial.levelMax ?? 7);
  const [frequency, setFrequency]   = useState(initial.frequency ?? 0);
  const [availability, setAvailability] = useState(initial.availability || []);

  const toggleAvail = (a) => setAvailability(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const reset = () => { setSide('any'); setStyle('any'); setMotivation('any'); setHand('any'); setRegion('any'); setLevelMin(1); setLevelMax(7); setFrequency(0); setAvailability([]); };
  const rtl = lang === 'he';
  const ink = dark ? COURT.darkText : COURT.ink;
  const selectBg = dark ? COURT.darkCard : COURT.cream;

  return (
    <BottomSheet onClose={onClose} title={t.setProfile} dark={dark}>
      <PrefGroup label={t.side} dark={dark}>
        <Chips dark={dark} value={side} onChange={setSide} options={[
          { v: 'any', label: t.anySide },
          { v: 'forehand', label: t.forehand, icon: '◐' },
          { v: 'backhand', label: t.backhand, icon: '◑' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.hand} dark={dark}>
        <Chips dark={dark} value={hand} onChange={setHand} options={[
          { v: 'any', label: t.anySide },
          { v: 'right', label: t.rightHand },
          { v: 'left', label: t.leftHand },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.playerStyle} dark={dark}>
        <Chips dark={dark} value={style} onChange={setStyle} options={[
          { v: 'any', label: t.anyStyle },
          { v: 'aggressive', label: t.aggressive, icon: '▲' },
          { v: 'defensive', label: t.defensive, icon: '▽' },
          { v: 'all-court', label: t.allcourt, icon: '◆' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.motivation} dark={dark}>
        <Chips dark={dark} value={motivation} onChange={setMotivation} options={[
          { v: 'any', label: t.anyMot },
          { v: 'fun', label: t.fun },
          { v: 'improve', label: t.improve },
          { v: 'compete', label: t.compete },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.region} dark={dark}>
        <select value={region} onChange={e => setRegion(e.target.value)} style={{
          width: '100%', padding: '12px 14px', background: selectBg,
          border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
          borderRadius: 8, fontFamily: 'Cormorant Garamond, serif',
          fontSize: 16, color: ink, fontStyle: 'italic',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}>
          <option value="any">— {t.anySide} —</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </PrefGroup>
      <PrefGroup label={t.levelRange} dark={dark}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: COURT.green, marginBottom: 8 }}>
          {levelMin.toFixed(1)} <span style={{ color: dark ? COURT.darkMuted : COURT.stone }}>—</span> {levelMax.toFixed(1)}
        </div>
        <RangeBar dark={dark} min={1} max={7} step={0.5} valueMin={levelMin} valueMax={levelMax}
          onChange={(lo, hi) => { setLevelMin(lo); setLevelMax(hi); }} />
      </PrefGroup>
      <PrefGroup label={t.frequency} dark={dark}>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {[0, 1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setFrequency(n)} style={{
              flex: 1, padding: '10px 0',
              background: frequency === n ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
              color: frequency === n ? COURT.cream : (dark ? COURT.darkText : COURT.green),
              border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '60'}`,
              borderRadius: 6, cursor: 'pointer',
              fontFamily: 'Playfair Display, serif', fontSize: 14,
            }}>{n === 0 ? '—' : `${n}+`}</button>
          ))}
        </div>
      </PrefGroup>
      <PrefGroup label={t.availability} dark={dark}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'Matin', label: t.morning }, { v: 'Soir', label: t.evening }, { v: 'Weekend', label: t.weekend }].map(a => {
            const active = availability.includes(a.v);
            return (
              <button key={a.v} onClick={() => toggleAvail(a.v)} style={{
                flex: 1, padding: '12px 0',
                background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
                color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
                border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '60'}`,
                borderRadius: 8, cursor: 'pointer',
                fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                fontSize: 14, transition: 'all 0.2s',
              }}>{a.label}</button>
            );
          })}
        </div>
      </PrefGroup>
      <div style={{ display: 'flex', gap: 10, padding: '20px 24px 0' }}>
        <button onClick={reset} style={{
          flex: 1, padding: '14px',
          background: dark ? COURT.darkCard : COURT.cream,
          color: dark ? COURT.darkMuted : COURT.stone,
          border: `0.5px solid ${dark ? COURT.darkBorder : COURT.stone + '50'}`,
          borderRadius: 10, fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14, cursor: 'pointer',
        }}>{t.reset}</button>
        <button onClick={() => { onApply({ side, style, motivation, hand, region, levelMin, levelMax, frequency, availability }); onClose(); }} style={{
          flex: 2, padding: '14px', background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.green}`, borderRadius: 10,
          fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15, cursor: 'pointer',
          letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <PadelBall size={18} shadow={false} />{t.saveAndSwipe}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Player Card ────────────────────────────────────────────────────────────
// Mini info bloc (icône + label + valeur) pour la grille 2x2 de la PlayerCard
function InfoChip({ icon, label, value, color, dark }) {
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const bgChip = dark ? COURT.darkBg : `${COURT.green}08`;
  const border = dark ? COURT.darkBorder : `${COURT.green}25`;
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '8px 10px',
      background: bgChip, border: `0.5px solid ${border}`,
      borderRadius: 8,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: `${color}18`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 12,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'Inter', fontSize: 8, color: stone, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'Crimson Text, serif', fontSize: 13, color: ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, dragX, t, lang, dark }) {
  const yesOp = Math.max(0, Math.min(1, dragX / 100));
  const noOp  = Math.max(0, Math.min(1, -dragX / 100));
  const rtl   = lang === 'he';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const ff_serif  = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const border= dark ? COURT.darkBorder : `${COURT.green}50`;

  const styleLabel = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt }[p.style] || t.allcourt;
  const sideLabel  = p.side === 'forehand' ? t.forehand : t.backhand;
  const handLabel  = p.hand === 'left' ? t.leftHand : t.rightHand;
  const region     = CITY_REGION[p.city] || p.city || '—';

  const bio = lang === 'he' ? p.bioHe : (lang === 'en' ? (p.bioEn || p.bioFr) : p.bioFr);

  // Préférences partenaire (Chantier 4)
  const prefs = p.partnerPrefs || {};
  const prefStyleLabel = prefs.style && prefs.style !== 'any' ? ({ aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt }[prefs.style]) : null;
  const prefHandLabel  = prefs.hand  && prefs.hand  !== 'any' ? (prefs.hand === 'left' ? t.leftHand : t.rightHand) : null;
  const prefSideLabel  = prefs.side  && prefs.side  !== 'any' ? (prefs.side === 'forehand' ? t.forehand : t.backhand) : null;
  const prefRegion     = prefs.region && prefs.region !== 'any' ? prefs.region : null;
  const prefLevel      = (prefs.levelMin != null && prefs.levelMax != null && (prefs.levelMin > 1 || prefs.levelMax < 7))
    ? `${prefs.levelMin}–${prefs.levelMax}` : null;
  const hasAnyPrefs = prefStyleLabel || prefHandLabel || prefSideLabel || prefRegion || prefLevel;

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      border: `0.5px solid ${border}`, borderRadius: 14, overflow: 'hidden',
      boxShadow: dark
        ? '0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)'
        : '0 8px 32px rgba(15,61,41,0.12), 0 1px 0 rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Photo (45% de la carte, plus compact) ──────────────────────── */}
      <div style={{
        width: '100%', height: '45%', flexShrink: 0,
        background: `url(${p.photo}) center 25%/cover`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Dégradé bas pour lisibilité du nom */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)` }} />

        {/* Badges haut */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', gap: 6, alignItems: 'center',
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          {p.online && (
            <div style={{
              background: 'rgba(0,0,0,0.45)', padding: '4px 8px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'Inter', fontSize: 9, color: '#7ED957',
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#7ED957' }} />
              {t.online}
            </div>
          )}
        </div>

        {/* Niveau (haut droite) */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: `${COURT.green}EE`, color: COURT.cream,
          padding: '6px 10px 5px', borderRadius: 8,
          border: `0.5px solid ${COURT.gold}`,
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          <div style={{ fontFamily: 'Inter', fontSize: 7, color: COURT.gold, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{t.currentLevel}</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, lineHeight: 1, fontWeight: 400 }}>
            {p.level != null ? p.level.toFixed(1) : '—'}
          </div>
        </div>

        {/* Nom + âge en overlay bas de photo */}
        <div style={{
          position: 'absolute', left: 16, right: 16, bottom: 10,
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            fontFamily: ff_serif, fontSize: 22, color: '#fff', fontWeight: 500,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}>
            <span style={{
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0, maxWidth: '70%',
            }}>
              {p.name.split(' ')[0]}{' '}
              <span style={{ fontStyle: rtl ? 'normal' : 'italic', color: COURT.gold }}>
                {p.name.split(' ').slice(1).join(' ')}
              </span>
            </span>
            <span style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
              {p.age}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em' }}>
              {p.city}{region && region !== p.city ? ` · ${region}` : ''}
            </div>
            <div style={{ width: 2, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.6)' }} />
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
              {p.matches} {t.matches?.toLowerCase?.() || 'matchs'}{p.winrate != null ? ` · ${p.winrate}%` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Contenu scrollable ────────────────────────────────────────── */}
      {/*
        Pas de stopPropagation : les pointer events doivent remonter au SwipeStack
        pour permettre le swipe horizontal et le tap-to-open-profile depuis tout
        l'écran de la carte. Le scroll vertical reste géré nativement via touchAction:'pan-y'
        et la détection verticale dans SwipeStack.onMove.
      */}
      <div
        className="card-scroll"
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '12px 16px 16px',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Grille 2x2 des 4 infos clés */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <InfoChip
            icon="⚡" label={t.styleLabel || 'Style'}
            value={styleLabel} color={COURT.purple} dark={dark}
          />
          <InfoChip
            icon="📍" label={t.regionLabel || 'Région'}
            value={region} color={COURT.green} dark={dark}
          />
          <InfoChip
            icon={p.hand === 'left' ? '🫲' : '🫱'} label={t.handLabel || 'Main'}
            value={handLabel} color={COURT.green} dark={dark}
          />
          <InfoChip
            icon="🎾" label={t.sideLabel || 'Côté'}
            value={sideLabel} color={COURT.gold} dark={dark}
          />
        </div>

        {/* Bio (si renseignée) */}
        {bio && (
          <>
            <Ornament width={32} style={{ margin: '14px auto 10px' }} />
            <p style={{
              fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, color: ink, lineHeight: 1.45, margin: 0,
              textAlign: 'center',
            }}>
              «{' '}{bio}{' '}»
            </p>
          </>
        )}

        {/* ─── Section "Recherche" (partner_prefs) ─────────────────────── */}
        {hasAnyPrefs && (
          <>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: `${COURT.green}25` }} />
              <div style={{
                fontFamily: 'Inter', fontSize: 9, color: COURT.green,
                letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 600,
              }}>
                {t.lookingFor || 'Recherche'}
              </div>
              <div style={{ flex: 1, height: 1, background: `${COURT.green}25` }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10, justifyContent: 'center' }}>
              {prefStyleLabel && <HeritageTag color={COURT.purple}>{prefStyleLabel}</HeritageTag>}
              {prefHandLabel  && <HeritageTag color={COURT.green}>{prefHandLabel}</HeritageTag>}
              {prefSideLabel  && <HeritageTag color={COURT.green}>{prefSideLabel}</HeritageTag>}
              {prefRegion     && <HeritageTag color={COURT.gold}>📍 {prefRegion}</HeritageTag>}
              {prefLevel      && <HeritageTag color={COURT.gold}>Niv. {prefLevel}</HeritageTag>}
            </div>
          </>
        )}

        {/* Confidence bar */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <span>{t.confidence}</span>
          <div style={{ flex: 1, height: 1, background: `${COURT.green}25`, position: 'relative' }}>
            <div style={{ width: `${p.confidenceRate ?? 50}%`, height: '100%', background: COURT.green }} />
          </div>
          <span style={{ color: COURT.green, fontFamily: 'Playfair Display, serif', fontSize: 11, letterSpacing: 0 }}>
            {p.confidenceRate != null ? `${Math.round(p.confidenceRate)}%` : '—'}
          </span>
        </div>

        {/* Hint scroll/tap */}
        <div style={{
          marginTop: 14, paddingTop: 10, borderTop: `0.5px dashed ${COURT.green}25`,
          fontFamily: 'Inter', fontSize: 9, color: stone,
          letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center',
        }}>
          {t.tapToSeeMore || 'Toucher pour voir le profil détaillé'}
        </div>
      </div>

      {/* Swipe overlays */}
      <div style={{ position: 'absolute', inset: 0, opacity: yesOp, pointerEvents: 'none', background: `${COURT.green}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${0.5 + yesOp * 0.5})` }}><PadelBall size={90} /></div>
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: noOp, pointerEvents: 'none', background: `${COURT.purple}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke={COURT.cream} strokeWidth="1.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    </div>
  );
}

function CircBtn({ children, onClick, color, large, dark }) {
  const s = large ? 52 : 42;     // ↓ taille réduite (avant: 64 / 52)
  const bg = dark ? COURT.darkCard : COURT.cream;
  return (
    <button onClick={onClick} style={{
      width: s, height: s, borderRadius: s / 2, background: bg, color,
      border: `0.5px solid ${color}80`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      transition: 'all 0.2s ease',
    }}>{children}</button>
  );
}

const CITY_REGION = {
  'Tel Aviv': 'Centre', 'Herzliya': 'Centre', 'Ramat Gan': 'Centre',
  'Kfar Saba': 'Centre', 'Netanya': 'Centre', 'Haifa': 'Nord',
  'Jerusalem': 'Sud', 'Ashdod': 'Sud', 'Eilat': 'Eilat',
};

function applyFilters(players, f) {
  return players.filter(p => {
    if (f.side !== 'any' && p.side !== f.side) return false;
    if (f.hand !== 'any' && p.hand !== f.hand) return false;
    if (f.style !== 'any' && p.style !== f.style) return false;
    if (f.motivation !== 'any' && p.motivation !== f.motivation) return false;
    if (f.region !== 'any' && CITY_REGION[p.city] !== f.region) return false;
    if (p.level !== null && p.level !== undefined && (p.level < f.levelMin || p.level > f.levelMax)) return false;
    if (f.frequency > 0 && p.frequency < f.frequency) return false;
    if (f.availability?.length && !f.availability.some(a => p.availability?.includes(a))) return false;
    return true;
  });
}

function EmptyStack({ t, lang, onReset, dark }) {
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const rtl   = lang === 'he';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
      <div style={{ animation: 'bounceY 2s ease-in-out infinite', marginBottom: 20 }}><PadelBall size={50} /></div>
      <div style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif', fontSize: 20, color: ink, fontStyle: rtl ? 'normal' : 'italic' }}>{t.closedClub}</div>
      <p style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, maxWidth: 240, margin: '12px 0 24px' }}>{t.closedHint}</p>
      <ThinButton variant="green" onClick={onReset}>{t.refreshStack}</ThinButton>
    </div>
  );
}

// ─── Swipe Stack ────────────────────────────────────────────────────────────
function SwipeStack({ t, lang, filters, onEditFilters, onMatch, dark, userLevel, onOpenDetail }) {
  // ── Données réelles ──
  const { players: allPlayers, loading: playersLoading, refetch } = usePlayers();
  const { recordSwipe } = useSwipes();

  const matched = useMemo(() => {
    if (!allPlayers) return [];
    return applyFilters(allPlayers, filters);
  }, [allPlayers, filters]);

  const [stack,       setStack]     = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [decision,    setDecision]  = useState(null);
  const [drag,        setDrag]      = useState({ x: 0, y: 0, active: false });
  const [lastCard,    setLastCard]  = useState(null);
  const [lastDir,     setLastDir]   = useState(null); // direction du dernier swipe
  const stackInitialized = useRef(false);             // évite le flash blanc après swipe
  const startRef = useRef({ x: 0, y: 0 });
  const rtl   = lang === 'he';
  const bg    = dark ? COURT.darkBg : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  // Clé stable basée uniquement sur les IDs des joueurs filtrés.
  // "online" change à chaque heartbeat Presence (toutes les 30s) et créerait
  // une boucle infinie si on dépendait de `matched` directement.
  // En déclenchant l'effet seulement sur les IDs, le stack ne se réinitialise
  // que quand la liste de joueurs change vraiment (swipe, filtre, refetch).
  const matchedKey = matched.map(p => p.id).join(',')
  const matchedRef = useRef(matched)
  matchedRef.current = matched // toujours à jour, sans être une dépendance

  // Charge le stack dès que les joueurs ou les filtres changent.
  // Premier chargement → skeleton 700ms. Mise à jour (après swipe/refetch)
  // → transition directe sans repasser par null pour éviter le flash blanc.
  useEffect(() => {
    if (playersLoading) {
      if (!stackInitialized.current) setStack(null);
      return;
    }
    if (!stackInitialized.current) {
      // Premier chargement : on attend 700ms (skeleton → carte)
      stackInitialized.current = true;
      const timer = setTimeout(() => setStack(matchedRef.current), 700);
      return () => clearTimeout(timer);
    } else {
      // Mise à jour silencieuse : pas de skeleton intermédiaire
      setStack(matchedRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersLoading, matchedKey]);

  const displayStack = useMemo(() => {
    if (!stack || !searchQuery.trim()) return stack;
    return stack.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stack, searchQuery]);

  const top = displayStack?.[0];

  // Enregistre le swipe et détecte un match mutuel
  const decide = useCallback(async (dir) => {
    if (!top) return;
    if (navigator.vibrate) navigator.vibrate(dir === 'right' ? [10, 5, 10] : [8]);
    setLastCard(top);
    setLastDir(dir);
    setDecision({ dir, id: top.id });

    // Retire la carte après l'animation (n'attend pas le réseau)
    const currentTop = top;
    setTimeout(async () => {
      setStack(s => s ? s.slice(1) : s);
      setDecision(null);
      setDrag({ x: 0, y: 0, active: false });

      if (dir === 'right') {
        const { isMatch } = await recordSwipe(currentTop.id, 'right');
        if (isMatch) onMatch(currentTop);
      } else {
        await recordSwipe(currentTop.id, 'left');
      }
      // Recharge la liste des joueurs pour filtrer les déjà-swipés
      refetch();
    }, 380);
  }, [top, onMatch, recordSwipe, refetch]);

  // Undo disponible UNIQUEMENT après une croix (left) — jamais après un like
  const undo = () => {
    if (!lastCard || lastDir !== 'left') return;
    if (navigator.vibrate) navigator.vibrate(6);
    setStack(s => [lastCard, ...(s || [])]);
    setLastCard(null);
    setLastDir(null);
  };

  const onDown = (e) => {
    // On commence le suivi depuis n'importe où sur la carte.
    // La capture du pointer n'est faite qu'une fois le geste horizontal confirmé
    // (dans onMove), ce qui permet au navigateur de gérer le scroll vertical
    // dans la zone .card-scroll tant que la direction n'est pas décidée.
    startRef.current = {
      x: e.clientX, y: e.clientY, t: Date.now(),
      ignore: false, captured: false,
      pointerId: e.pointerId, target: e.currentTarget,
    };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onMove = (e) => {
    if (!drag.active || startRef.current.ignore) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    // Geste nettement vertical → scroll natif, abandon du swipe
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 12) {
      setDrag({ x: 0, y: 0, active: false });
      startRef.current.ignore = true;
      return;
    }
    // Geste horizontal confirmé → capturer le pointer pour swipe fluide
    if (Math.abs(dx) > 8 && !startRef.current.captured) {
      try { startRef.current.target?.setPointerCapture?.(startRef.current.pointerId); } catch (_) {}
      startRef.current.captured = true;
    }
    setDrag({ x: dx, y: dy, active: true });
  };
  const onUp   = () => {
    if (!drag.active || startRef.current.ignore) {
      setDrag({ x: 0, y: 0, active: false });
      return;
    }
    const totalMove = Math.abs(drag.x) + Math.abs(drag.y);
    const elapsed = Date.now() - (startRef.current.t || 0);
    // Tap = peu de mouvement et durée courte ⇒ ouvrir le profil détaillé.
    // Seuils relâchés (25 px / 600 ms) pour matcher la réalité d'un doigt humain.
    if (totalMove < 25 && elapsed < 600) {
      setDrag({ x: 0, y: 0, active: false });
      if (top && onOpenDetail) onOpenDetail(top.id);
      return;
    }
    if (drag.x > 90) decide('right');
    else if (drag.x < -90) decide('left');
    else setDrag({ x: 0, y: 0, active: false });
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))', paddingBottom: 100, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
          <div style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif', fontSize: 26, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500, lineHeight: 1.1 }}>{t.partners}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: COURT.green, fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 12 }}>
            <PadelBall size={12} shadow={false} />
            <span>{displayStack?.length ?? '…'} {t.available}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginLeft: 12 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.6"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'he' ? 'חפש...' : lang === 'en' ? 'Search...' : 'Chercher...'}
              style={{
                paddingLeft: 28, paddingRight: 10, height: 26, width: '100%',
                background: dark ? COURT.darkCard : COURT.cream,
                border: `0.5px solid ${searchQuery ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '60')}`,
                borderRadius: 999,
                fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
                fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 13, color: ink, outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button onClick={onEditFilters} style={{
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
            borderRadius: 999, padding: '0 12px', height: 26,
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 12, color: COURT.green, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            boxSizing: 'border-box',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            {t.filters}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 'calc(100% - 180px)', margin: '0 20px 70px' }}>
        {stack === null ? (
          <div style={{ position: 'absolute', inset: 0 }}><SkeletonCard /></div>
        ) : displayStack.length === 0 ? (
          <EmptyStack t={t} lang={lang} onReset={() => { setStack(matched.length ? matched : allPlayers || []); setLastCard(null); setSearchQuery(''); }} dark={dark} />
        ) : displayStack.slice(0, 3).map((p, i) => {
          const isTop = i === 0;
          let transform  = `translateY(${i * 6}px) scale(${1 - i * 0.03})`;
          let opacity    = 1 - i * 0.18;
          let transition = 'transform 0.4s ease, opacity 0.4s ease';
          if (isTop && decision && decision.id === p.id) {
            const x = decision.dir === 'right' ? 600 : -600;
            transform  = `translate(${x}px, ${decision.dir === 'right' ? -30 : 30}px) rotate(${decision.dir === 'right' ? 22 : -22}deg)`;
            transition = 'transform 0.45s cubic-bezier(.4,0,.2,1), opacity 0.45s';
            opacity    = 0;
          } else if (isTop && drag.active) {
            transform  = `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${drag.x * 0.06}deg)`;
            transition = 'none';
          }
          return (
            <div key={p.id}
              onPointerDown={isTop ? onDown : undefined}
              onPointerMove={isTop ? onMove : undefined}
              onPointerUp={isTop ? onUp : undefined}
              style={{
                position: 'absolute', inset: 0, transform, opacity, transition,
                zIndex: 10 - i,
                // pan-y autorise le scroll vertical natif ; nous prenons en charge
                // le geste horizontal manuellement (swipe gauche/droite).
                touchAction: isTop ? 'pan-y' : 'none',
                cursor: isTop ? 'grab' : 'default',
              }}>
              <PlayerCard p={p} dragX={isTop ? drag.x : 0} t={t} lang={lang} dark={dark} />
            </div>
          );
        }).reverse()}
      </div>

      {top && stack !== null && (
        <div style={{
          position: 'absolute', bottom: 116, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center',
          pointerEvents: 'none', // les boutons gèrent leurs clics individuellement
        }}>
          {lastCard && lastDir === 'left' && (
            <div style={{ pointerEvents: 'auto' }}>
              <CircBtn onClick={undo} color={COURT.gold} dark={dark}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 10h10a5 5 0 1 1 0 10H3" /><path d="M3 10l4-4M3 10l4 4" />
                </svg>
              </CircBtn>
            </div>
          )}
          <div style={{ pointerEvents: 'auto' }}>
            <CircBtn onClick={() => decide('left')} color={COURT.purple} dark={dark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </CircBtn>
          </div>
          <div style={{ pointerEvents: 'auto' }}>
            <CircBtn onClick={() => decide('right')} color={COURT.green} large dark={dark}>
              <PadelBall size={22} shadow={false} />
            </CircBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search flow ────────────────────────────────────────────────────────────
function SearchFlow({ t, lang, dark, userLevel, onNavigateChat, onOpenDetail }) {
  const [showPrefs, setShowPrefs]   = useState(false);
  const [matchPlayer, setMatchPlayer] = useState(null);
  const [filters, setFilters] = useState({
    side: 'any', style: 'any', motivation: 'any', hand: 'any',
    region: 'any', levelMin: 1, levelMax: 7, frequency: 0, availability: [],
  });

  if (matchPlayer) {
    return (
      <MatchFlash
        player={matchPlayer} t={t} lang={lang} dark={dark}
        onMessage={() => { setMatchPlayer(null); onNavigateChat?.(); }}
        onContinue={() => setMatchPlayer(null)}
      />
    );
  }

  return (
    <>
      <SwipeStack
        t={t} lang={lang} filters={filters} dark={dark}
        onEditFilters={() => setShowPrefs(true)}
        onMatch={setMatchPlayer}
        onOpenDetail={onOpenDetail}
        userLevel={userLevel}
      />
      {showPrefs && (
        <PreferencesSheet
          t={t} lang={lang} initial={filters} dark={dark}
          onApply={f => setFilters(f)}
          onClose={() => setShowPrefs(false)}
        />
      )}
    </>
  );
}

// ─── Home Screen ────────────────────────────────────────────────────────────
function HomeScreen({ t, lang, level, confidence, dark, detailPlayerId, setDetailPlayerId }) {
  const { profile } = useAuth();
  const matchHistory = useMatchHistory();

  const [showRing, setShowRing] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds,      setAddedIds]      = useState(new Set());
  const { recordSwipe } = useSwipes();
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef();

  useEffect(() => { const tt = setTimeout(() => setShowRing(true), 200); return () => clearTimeout(tt); }, []);

  // Recherche Supabase en temps réel — name OU username (ILIKE, toutes les personnes)
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, photo_url, level, city')
        .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  const rtl   = lang === 'he';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const ff_serif  = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted: COURT.stone;

  // Données du profil utilisateur — uniquement depuis la DB
  const userName    = profile?.name     || '';
  const userPhoto   = profile?.photo_url || '';
  const userMatches = profile?.matches_played ?? 0;
  const userWins    = profile?.wins ?? 0;
  // null si aucun match — jamais de faux pourcentage
  const userWinrate = userMatches > 0 ? Math.round((userWins / userMatches) * 100) : null;

  // Activité récente : depuis la DB uniquement (jamais de données statiques)
  const recentItems = matchHistory.slice(0, 4).map(matchToActivity);


  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
        <div style={{ fontFamily: 'Pinyon Script, cursive', fontSize: 32, color: COURT.green, lineHeight: 1 }}>Padel Meet</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setSearchMode(m => !m); setSearchQuery(''); }} style={{
            width: 36, height: 36, borderRadius: 18,
            background: searchMode ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
            border: `0.5px solid ${COURT.green}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: searchMode ? COURT.cream : COURT.green,
          }}>
            {searchMode
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            }
          </button>
          <div style={{ width: 36, height: 36, borderRadius: 18, border: `0.5px solid ${COURT.green}`, padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `url(${userPhoto}) center/cover` }} />
          </div>
        </div>
      </div>

      {searchMode && (
        <div style={{ padding: '0 24px' }}>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchPlayer} autoFocus
            style={{
              width: '100%', padding: '12px 16px', boxSizing: 'border-box',
              background: dark ? COURT.darkCard : COURT.cream,
              border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
              borderRadius: 10, fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
              fontSize: 15, color: ink, outline: 'none', marginBottom: 12,
            }}
          />
          {searchQuery.trim() && searchLoading && (
            <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>…</div>
          )}
          {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
            <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>{t.noPlayer}</div>
          )}
          {searchResults.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderBottom: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}`,
              animation: `cardIn 0.3s ease ${i * 0.05}s both`,
            }}>
              <button
                onClick={() => setDetailPlayerId(p.id)}
                style={{
                  width: 44, height: 44, borderRadius: 22, flexShrink: 0,
                  background: `url(${p.photo_url || initialsAvatar(p.name || p.id)}) center/cover`,
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              />
              <button
                onClick={() => setDetailPlayerId(p.id)}
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                }}
              >
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: ink, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.1em' }}>
                  {p.username ? `@${p.username}` : ''}{p.username && p.city ? ' · ' : ''}{p.city || ''}
                </div>
              </button>
              <button onClick={async () => {
                if (addedIds.has(p.id)) return;
                setAddedIds(prev => new Set([...prev, p.id]));
                await recordSwipe(p.id, 'right');
              }} style={{
                padding: '8px 14px', borderRadius: 20,
                background: addedIds.has(p.id) ? `${COURT.green}20` : COURT.green,
                color: addedIds.has(p.id) ? COURT.green : COURT.cream,
                border: `0.5px solid ${COURT.green}`,
                fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13,
                cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>{addedIds.has(p.id) ? t.requestSent : t.addPlayer}</button>
            </div>
          ))}
        </div>
      )}

      {!searchMode && <>
        <div style={{ padding: '0 24px 4px' }}>
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone }}>{t.greeting}</div>
          <div style={{ fontFamily: ff_serif, fontSize: 32, color: ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic', lineHeight: 1.1 }}>{userName}</div>
        </div>

        {/* Level card */}
        <div style={{
          margin: '20px 20px 0', background: COURT.green, borderRadius: 14,
          padding: '24px 24px 20px', position: 'relative', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(15,61,41,0.25)', border: `0.5px solid ${COURT.gold}50`,
        }}>
          <div style={{ position: 'absolute', right: -28, top: -10, opacity: 0.08, transform: 'rotate(18deg)' }}>
            <PadelRacket size={180} frame={COURT.cream} grip={COURT.cream} accent={COURT.gold} />
          </div>
          <div style={{ position: 'absolute', right: 20, top: 20, animation: 'gentleBob 3s ease-in-out infinite' }}>
            <PadelBall size={18} shadow={false} />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: COURT.gold, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 6 }}>{t.currentLevel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: level != null ? 68 : 32, color: COURT.cream, fontWeight: 400, lineHeight: 1, animation: 'levelPop 0.8s cubic-bezier(.2,.9,.3,1.4)' }}>
                {level != null ? level.toFixed(1) : (t.levelNotEvaluated || 'Niveau non évalué')}
              </div>
              {level != null && <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, color: `${COURT.cream}90` }}>{t.outOf} 7.0</div>}
            </div>
            <div style={{ height: 0.5, background: `${COURT.cream}30`, margin: '16px 0 12px' }} />
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontFamily: 'Inter', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.matchesPlayed}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: COURT.cream }}>{userMatches}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Inter', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.winRateLabel}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: COURT.cream }}>
                  {userWinrate != null ? `${userWinrate}%` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'Inter', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.confidence}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: COURT.cream }}>{confidence}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ padding: '28px 24px 0' }}>
          <SectionHeading>{t.recent}</SectionHeading>
          <div style={{ marginTop: 16 }}>
            {recentItems.length === 0 && (
              <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone, padding: '12px 0' }}>
                {t.noActivity || 'Aucune activité récente.'}
              </div>
            )}
            {recentItems.map((a, i) => (
              <div key={a.id} style={{
                padding: '14px 0',
                borderBottom: i < recentItems.length - 1 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '25'}` : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                animation: `cardIn 0.5s ease ${i * 0.06}s both`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  border: `0.5px solid ${a.kind === 'match' ? COURT.green : COURT.purple}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: a.kind === 'match' ? COURT.green : COURT.purple, flexShrink: 0,
                }}>
                  {a.kind === 'match' ? <PadelBall size={14} shadow={false} /> :
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2" />
                    </svg>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>{a.date[lang]}</div>
                  <div style={{ fontFamily: ff_serif, fontSize: 17, color: ink, fontWeight: 500 }}>{a.title[lang]}</div>
                  <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginTop: 2 }}>{a.sub[lang]}</div>
                  {a.scoreL && <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, color: COURT.green, marginTop: 4, letterSpacing: '0.1em' }}>{a.scoreL} · {a.scoreR}</div>}
                </div>
                {a.delta != null && a.delta !== 0 && (
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, color: a.delta > 0 ? COURT.green : COURT.purple, fontWeight: 500, paddingTop: 16 }}>
                    {a.delta > 0 ? '+' : ''}{(+a.delta).toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0 16px' }}>
          <Ornament width={80} />
          <div style={{ fontFamily: 'Pinyon Script, cursive', fontSize: 18, color: COURT.green, opacity: 0.5 }}>est. mmxxvi</div>
        </div>
      </>}
    </div>
  );
}

// ─── Chat actif (messages temps réel) ──────────────────────────────────────
function ActiveChat({ matchId, player, onBack, t, lang, dark }) {
  const { user } = useAuth();
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [sheet,           setSheet]           = useState(null); // 'proposal'|'score'|'eval'
  // Proposition de match
  const [propDate,        setPropDate]        = useState('');
  const [propTime,        setPropTime]        = useState('');
  const [propPlace,       setPropPlace]       = useState('');
  const [propSending,     setPropSending]     = useState(false);
  // Score
  const [scoreResult,     setScoreResult]     = useState('win');
  const [scoreText,       setScoreText]       = useState('');
  const [scoreSending,    setScoreSending]    = useState(false);
  const [scoreError,      setScoreError]      = useState('');
  // Évaluation
  const [evalLevel,       setEvalLevel]       = useState(3.5);
  const [evalSending,     setEvalSending]     = useState(false);
  const [evalDoneId,      setEvalDoneId]      = useState(null); // pendingId déjà évalué
  const bottomRef = useRef(null);
  const rtl    = lang === 'he';
  const bg     = dark ? COURT.darkBg    : COURT.cream;
  const card   = dark ? COURT.darkCard  : '#F0EDE5';
  const border = dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink    = dark ? COURT.darkText  : COURT.ink;
  const stone  = dark ? COURT.darkMuted : COURT.stone;

  const { submitResult, confirmResult, rejectResult, pendingResults, matchStatuses, matchScoreStatus } = useMatchResults();
  // ── Répondre à une proposition de match (Accept / Decline) ──────────────────
  // NOTE: useState doit être déclaré AVANT les useEffect (règles des hooks React)
  const [respondingId, setRespondingId] = useState(null);

  // Scores en attente pour ce match précis
  const pendingForMatch = pendingResults.filter(p => p.matchId === matchId);
  // Statut score pour ce match (tentatives, lock)
  const scoreStatus = matchStatuses[matchId] || { attempts: 0, locked: false };
  const scoreLocked  = scoreStatus.locked;
  const scoreAttempt = scoreStatus.attempts; // nombre de rejets passés

  // Charge le statut au mount
  useEffect(() => { if (matchId) matchScoreStatus(matchId); }, [matchId]);

  // ── Chargement des messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId || !user) return;
    const fetchMsgs = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data.map(msgToState(user.id)));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };
    fetchMsgs();
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const m = payload.new;
          setMessages(prev => {
            if (prev.some(x => x._id === m.id)) return prev;
            return [...prev, msgToState(user.id)(m)];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
      // Écoute aussi les UPDATE (pour les réponses Accept/Decline sur proposals)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const m = payload.new;
          setMessages(prev => prev.map(x => x._id === m.id ? msgToState(user.id)(m) : x));
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [matchId, user?.id]);
  const respondToProposal = async (messageId, accepted) => {
    setRespondingId(messageId);
    const { error } = await supabase.rpc('respond_to_match_proposal', {
      p_message_id: messageId,
      p_accepted:   accepted,
    });
    setRespondingId(null);
    if (error) {
      console.error('Error responding to proposal:', error);
    }
    // Pas besoin de refetch — le UPDATE postgres_changes met à jour le state
  };

  // ── Envoi texte ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !matchId || !user) return;
    const text = input.trim();
    setInput('');
    await supabase.from('messages').insert({ match_id: matchId, sender_id: user.id, content: text });
  };

  // ── Envoyer une proposition de match ────────────────────────────────────────
  const sendProposal = async () => {
    if (!propDate || !propTime) return;
    setPropSending(true);
    const label = lang === 'he'
      ? `📅 הצעת משחק — ${propDate} ${propTime}${propPlace ? ` · ${propPlace}` : ''}`
      : lang === 'en'
      ? `📅 Match proposal — ${propDate} at ${propTime}${propPlace ? ` · ${propPlace}` : ''}`
      : `📅 Proposition de match — ${propDate} à ${propTime}${propPlace ? ` · ${propPlace}` : ''}`;
    await supabase.from('messages').insert({
      match_id: matchId, sender_id: user.id,
      content: label,
      msg_type: 'match_proposal',
      metadata: { date: propDate, time: propTime, place: propPlace },
    });
    setPropDate(''); setPropTime(''); setPropPlace('');
    setPropSending(false);
    setSheet(null);
  };

  // ── Soumettre un score ──────────────────────────────────────────────────────
  const sendScore = async () => {
    if (!scoreText.trim()) { setScoreError('Entrez le score (ex: 6-4 6-3)'); return; }
    setScoreError('');
    setScoreSending(true);
    const res = await submitResult({ opponentId: player.id, result: scoreResult, score: scoreText });
    if (res.success) {
      // Envoie aussi un message "score_card" dans le chat pour notifier visuellement
      await supabase.from('messages').insert({
        match_id: matchId, sender_id: user.id,
        content: `🎾 Score soumis : ${scoreText}`,
        msg_type: 'score_card',
        metadata: { pending_id: res.pendingId, score: scoreText, result: scoreResult },
      });
      setScoreText(''); setScoreResult('win');
      setSheet(null);
    } else {
      setScoreError(res.error || 'Erreur');
    }
    setScoreSending(false);
  };

  // ── Confirmer un score ──────────────────────────────────────────────────────
  const handleConfirm = async (pendingId) => {
    const res = await confirmResult(pendingId);
    if (res.success) setSheet('eval'); // → ouvrir questionnaire
  };

  // ── Évaluation niveau ───────────────────────────────────────────────────────
  const sendEval = async () => {
    setEvalSending(true);
    // On cherche le match_history le plus récent pour ce duo
    const { data: mh } = await supabase
      .from('match_history')
      .select('id')
      .eq('player_id', user.id)
      .eq('opponent_id', player.id)
      .order('played_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mh) {
      await supabase.rpc('submit_peer_evaluation', {
        p_match_id:       mh.id,
        p_evaluated_id:   player.id,
        p_proposed_level: Math.round(evalLevel * 2) / 2, // arrondi au 0.5
      });
    }
    setEvalSending(false);
    setSheet(null);
  };

  // ── Score card dans le fil ──────────────────────────────────────────────────
  const renderScoreCard = (pending) => {
    if (!pending) return null;
    const isWin      = pending.myResult === 'win';
    const color      = isWin ? COURT.green : COURT.purple;
    const label      = isWin ? (lang === 'en' ? 'Victory' : lang === 'he' ? 'ניצחון' : 'Victoire')
                             : (lang === 'en' ? 'Defeat'  : lang === 'he' ? 'הפסד'  : 'Défaite');
    const attemptNum = scoreAttempt + 1; // tentative en cours (1-based)
    const remaining  = 3 - scoreAttempt;
    return (
      <div style={{ margin: '4px 0', background: card, border: `1px solid ${color}40`, borderRadius: 14, padding: '12px 14px', width: '100%' }}>
        {/* Header avec numéro de tentative */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Inter', fontSize: 9, color, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            🎾 {pending.isSubmitter ? (lang === 'en' ? 'Score submitted' : 'Score soumis') : (lang === 'en' ? 'Score to confirm' : 'Score à confirmer')}
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, background: dark ? '#2a2a2a' : '#e8e4da', borderRadius: 999, padding: '2px 8px' }}>
            {attemptNum}/3
          </div>
        </div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color, letterSpacing: '0.06em', marginBottom: 4 }}>{pending.score}</div>
        <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, color: stone, marginBottom: pending.isSubmitter ? 0 : 10 }}>
          {label} · {pending.isSubmitter
            ? (lang === 'en' ? 'Awaiting confirmation…' : 'En attente de confirmation…')
            : (lang === 'en' ? `${player?.name} asks you to confirm` : `${player?.name} demande votre confirmation`)}
        </div>
        {!pending.isSubmitter && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button onClick={() => handleConfirm(pending.id)} style={{ flex: 1, padding: '9px', borderRadius: 8, background: COURT.green, border: 'none', color: COURT.cream, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                {lang === 'en' ? '✓ Confirm' : lang === 'he' ? '✓ אשר' : '✓ Confirmer'}
              </button>
              <button onClick={() => rejectResult(pending.id)} style={{ flex: 1, padding: '9px', borderRadius: 8, background: COURT.purple + '15', border: `0.5px solid ${COURT.purple}`, color: COURT.purple, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer' }}>
                {lang === 'en' ? '✗ Reject' : lang === 'he' ? '✗ דחה' : '✗ Refuser'}
              </button>
            </div>
            {remaining > 1 && (
              <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, textAlign: 'center' }}>
                {lang === 'en' ? `${remaining - 1} attempt(s) left after rejection` : `${remaining - 1} tentative(s) restante(s) si refus`}
              </div>
            )}
            {remaining === 1 && (
              <div style={{ fontFamily: 'Inter', fontSize: 10, color: COURT.purple, textAlign: 'center', fontWeight: 500 }}>
                ⚠️ {lang === 'en' ? 'Last attempt — reject = match unrecorded' : 'Dernière tentative — refus = match inenregistrable'}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── Carte "match verrouillé" ────────────────────────────────────────────────
  const renderLockedCard = () => (
    <div style={{ margin: '4px 0', background: card, border: `1px solid ${COURT.purple}40`, borderRadius: 14, padding: '14px', width: '100%', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: COURT.purple, fontStyle: 'italic', marginBottom: 4 }}>
        {lang === 'en' ? 'Match unrecordable' : 'Match inenregistrable'}
      </div>
      <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, color: stone }}>
        {lang === 'en' ? '3 consecutive rejections — no score can be submitted for this match.' : '3 désaccords consécutifs — aucun score ne peut être enregistré pour ce match.'}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', zIndex: 100 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ paddingTop: 'max(52px, env(safe-area-inset-top, 0px))', padding: `max(52px, env(safe-area-inset-top, 0px)) 16px 12px`, borderBottom: `0.5px solid ${border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COURT.green, padding: 4, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: `url(${player?.photo}) center/cover`, flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, background: player?.online ? '#4CAF50' : stone, border: `1.5px solid ${bg}` }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player?.name}</div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: player?.online ? '#4CAF50' : stone, letterSpacing: '0.12em' }}>
            {player?.online ? (t.online || 'En ligne') : `${t.lastSeen || 'Vu'} ${formatLastSeen(player?.lastSeen)}`}
          </div>
        </div>
      </div>

      {/* ── Barre d'actions rapides ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: `0.5px solid ${border}`, background: dark ? '#1a1f1a' : '#F7F4EE', overflowX: 'auto' }}>
        {[
          { key: 'proposal', icon: '📅', label: lang === 'en' ? 'Plan match' : lang === 'he' ? 'הצע משחק' : 'Proposer' },
          { key: 'score',    icon: '🎾', label: lang === 'en' ? 'Enter score' : lang === 'he' ? 'הזן תוצאה' : 'Score', disabled: scoreLocked || pendingForMatch.length > 0 },
          { key: 'eval',     icon: '⭐', label: lang === 'en' ? 'Rate player' : lang === 'he' ? 'דרג שחקן' : 'Évaluer' },
        ].map(({ key, icon, label, disabled }) => (
          <button key={key}
            onClick={() => !disabled && setSheet(sheet === key ? null : key)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '6px 12px', borderRadius: 999,
              background: sheet === key ? COURT.green : 'transparent',
              border: `0.5px solid ${disabled ? stone : sheet === key ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '50')}`,
              color: disabled ? stone : sheet === key ? COURT.cream : COURT.green,
              fontFamily: 'Inter', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.45 : 1,
            }}>
            <span style={{ fontSize: 14 }}>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* ── Sheet Proposer un match ─────────────────────────────────────────── */}
      {sheet === 'proposal' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: ink, fontStyle: 'italic' }}>
            {lang === 'en' ? 'Propose a match' : lang === 'he' ? 'הצע משחק' : 'Proposer un match'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={propDate} onChange={e => setPropDate(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Inter', fontSize: 13, outline: 'none' }} />
            <input type="time" value={propTime} onChange={e => setPropTime(e.target.value)}
              style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Inter', fontSize: 13, outline: 'none' }} />
          </div>
          <input placeholder={lang === 'en' ? 'Court / location (optional)' : 'Club / terrain (optionnel)'}
            value={propPlace} onChange={e => setPropPlace(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14, outline: 'none' }} />
          <button onClick={sendProposal} disabled={propSending || !propDate || !propTime} style={{
            padding: '10px', borderRadius: 10, background: COURT.green, border: 'none',
            color: COURT.cream, fontFamily: 'Inter', fontSize: 13, cursor: 'pointer', opacity: (!propDate || !propTime) ? 0.4 : 1,
          }}>
            {propSending ? '…' : (lang === 'en' ? 'Send proposal' : 'Envoyer la proposition')}
          </button>
        </div>
      )}

      {/* ── Sheet Entrer un score ───────────────────────────────────────────── */}
      {sheet === 'score' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: ink, fontStyle: 'italic' }}>
            {lang === 'en' ? 'Submit a score' : 'Soumettre un score'}
          </div>
          {/* Résultat */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['win', 'loss'].map(r => (
              <button key={r} onClick={() => setScoreResult(r)} style={{
                flex: 1, padding: '8px', borderRadius: 8,
                background: scoreResult === r ? (r === 'win' ? COURT.green : COURT.purple) : 'transparent',
                border: `0.5px solid ${r === 'win' ? COURT.green : COURT.purple}`,
                color: scoreResult === r ? COURT.cream : (r === 'win' ? COURT.green : COURT.purple),
                fontFamily: 'Inter', fontSize: 13, cursor: 'pointer',
              }}>
                {r === 'win' ? (lang === 'en' ? 'Victory' : 'Victoire 🏆') : (lang === 'en' ? 'Defeat' : 'Défaite')}
              </button>
            ))}
          </div>
          {/* Score texte */}
          <input placeholder="ex: 6-4 6-3 ou 4-6 7-5 6-2"
            value={scoreText} onChange={e => setScoreText(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 8, border: `0.5px solid ${scoreError ? COURT.purple : border}`, background: bg, color: ink, fontFamily: 'Playfair Display, serif', fontSize: 15, outline: 'none', letterSpacing: '0.08em' }} />
          {scoreError && <div style={{ fontFamily: 'Inter', fontSize: 11, color: COURT.purple }}>{scoreError}</div>}
          <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 12, color: stone }}>
            {lang === 'en' ? `${player?.name} will need to confirm the score.` : `${player?.name} devra confirmer le score. Anti-spam activé.`}
          </div>
          <button onClick={sendScore} disabled={scoreSending || !scoreText.trim()} style={{
            padding: '10px', borderRadius: 10, background: COURT.green, border: 'none',
            color: COURT.cream, fontFamily: 'Inter', fontSize: 13, cursor: 'pointer', opacity: !scoreText.trim() ? 0.4 : 1,
          }}>
            {scoreSending ? '…' : (lang === 'en' ? 'Submit score' : 'Soumettre le score')}
          </button>
        </div>
      )}

      {/* ── Sheet Évaluer le niveau ─────────────────────────────────────────── */}
      {sheet === 'eval' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: ink, fontStyle: 'italic' }}>
            {lang === 'en' ? `Rate ${player?.name}'s level` : `Évaluer le niveau de ${player?.name}`}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, color: COURT.green }}>{evalLevel.toFixed(1)}</div>
            <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, color: stone }}>/ 7.0</div>
          </div>
          <input type="range" min="1" max="7" step="0.5" value={evalLevel} onChange={e => setEvalLevel(+e.target.value)}
            style={{ width: '100%', accentColor: COURT.green }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 10, color: stone }}>
            {['Débutant', 'Intermédiaire', 'Confirmé', 'Avancé', 'Expert'].map(l => <span key={l}>{l}</span>)}
          </div>
          <button onClick={sendEval} disabled={evalSending} style={{
            padding: '10px', borderRadius: 10, background: COURT.gold, border: 'none',
            color: COURT.ink, fontFamily: 'Inter', fontSize: 13, cursor: 'pointer',
          }}>
            {evalSending ? '…' : (lang === 'en' ? 'Submit rating' : 'Envoyer l\'évaluation')}
          </button>
          <button onClick={() => setSheet(null)} style={{ background: 'none', border: 'none', color: stone, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer' }}>
            {lang === 'en' ? 'Skip' : 'Passer'}
          </button>
        </div>
      )}

      {/* ── Fil de messages ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Carte verrouillée si 3 rejets */}
        {scoreLocked && renderLockedCard()}
        {/* Cartes score en attente pour ce match */}
        {!scoreLocked && pendingForMatch.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {pendingForMatch.map(p => (
              <div key={p.id}>{renderScoreCard(p)}</div>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m._id || i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
            {m.msgType === 'match_proposal' ? (
              /* Carte proposition de match */
              (() => {
                const status     = m.metadata?.status;          // 'accepted' | 'declined' | undefined
                const isMine     = m.from === 'me';
                const canRespond = !isMine && !status;          // l'autre joueur, pas encore répondu
                const accentColor = status === 'accepted' ? COURT.green
                                  : status === 'declined' ? COURT.purple
                                  : COURT.gold;
                return (
                  <div style={{
                    maxWidth: '82%', padding: '12px 14px',
                    borderRadius: 14, background: card,
                    border: `1px solid ${accentColor}50`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 9, color: accentColor, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                      📅 {lang === 'en' ? 'Match proposal' : 'Proposition de match'}
                    </div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, color: ink, fontWeight: 500 }}>
                      {m.metadata?.date} {lang === 'en' ? 'at' : 'à'} {m.metadata?.time}
                    </div>
                    {m.metadata?.place && (
                      <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, color: stone, marginTop: 2 }}>📍 {m.metadata.place}</div>
                    )}

                    {/* Boutons Accept/Decline (uniquement pour l'autre joueur, pas encore répondu) */}
                    {canRespond && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          onClick={() => respondToProposal(m._id, true)}
                          disabled={respondingId === m._id}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8,
                            background: COURT.green, border: 'none', color: COURT.cream,
                            fontFamily: 'Inter', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            opacity: respondingId === m._id ? 0.5 : 1,
                          }}>
                          ✓ {lang === 'en' ? 'Accept' : lang === 'he' ? 'אשר' : 'Accepter'}
                        </button>
                        <button
                          onClick={() => respondToProposal(m._id, false)}
                          disabled={respondingId === m._id}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8,
                            background: 'transparent', color: COURT.purple,
                            border: `0.5px solid ${COURT.purple}`,
                            fontFamily: 'Inter', fontSize: 12, cursor: 'pointer',
                            opacity: respondingId === m._id ? 0.5 : 1,
                          }}>
                          ✗ {lang === 'en' ? 'Decline' : lang === 'he' ? 'דחה' : 'Refuser'}
                        </button>
                      </div>
                    )}

                    {/* Badge statut une fois répondu */}
                    {status === 'accepted' && (
                      <div style={{
                        marginTop: 10, padding: '6px 10px',
                        background: `${COURT.green}15`, borderRadius: 8,
                        fontFamily: 'Inter', fontSize: 11, color: COURT.green, fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✓ {lang === 'en' ? 'Match accepted' : lang === 'he' ? 'משחק אושר' : 'Match accepté'}
                      </div>
                    )}
                    {status === 'declined' && (
                      <div style={{
                        marginTop: 10, padding: '6px 10px',
                        background: `${COURT.purple}15`, borderRadius: 8,
                        fontFamily: 'Inter', fontSize: 11, color: COURT.purple,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✗ {lang === 'en' ? 'Match declined' : lang === 'he' ? 'משחק נדחה' : 'Match refusé'}
                      </div>
                    )}

                    <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, marginTop: 6, textAlign: 'right' }}>{m.time}</div>
                  </div>
                );
              })()
            ) : (
              /* Message texte normal */
              <div style={{
                maxWidth: '74%', padding: '10px 14px',
                borderRadius: m.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: m.from === 'me' ? COURT.green : (dark ? '#243020' : '#EDE9DF'),
                color: m.from === 'me' ? COURT.cream : ink,
                fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}>
                {m.text[lang] || m.text.fr}
                <div style={{ fontFamily: 'Inter', fontSize: 9, color: m.from === 'me' ? `${COURT.cream}70` : stone, marginTop: 4, textAlign: 'right' }}>{m.time}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input texte ────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 32px', borderTop: `0.5px solid ${border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={t.typeMessage || (lang === 'en' ? 'Message…' : 'Message…')}
          style={{
            flex: 1, padding: '11px 16px', borderRadius: 24,
            background: dark ? COURT.darkCard : '#EDE9DF',
            border: `0.5px solid ${border}`,
            fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
            fontSize: 15, color: ink, outline: 'none',
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim()} style={{
          width: 44, height: 44, borderRadius: 22, background: COURT.green,
          border: 'none', cursor: 'pointer', color: COURT.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: !input.trim() ? 0.4 : 1, transition: 'opacity 0.2s',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Transforme une row DB en état local pour le chat ──────────────────────────
function msgToState(userId) {
  return (m) => ({
    _id:      m.id,
    from:     m.sender_id === userId ? 'me' : 'them',
    text:     { fr: m.content, en: m.content, he: m.content },
    msgType:  m.msg_type || 'text',
    metadata: m.metadata || null,
    time:     new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  });
}

// ─── Chat Screen ─────────────────────────────────────────────────────────────
function ChatScreen({ t, lang, dark }) {
  const { matches, loading: matchesLoading } = useUserMatches();
  const [activeMatch, setActiveMatch] = useState(null); // { matchId, player }
  const rtl   = lang === 'he';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  if (activeMatch) {
    return (
      <ErrorBoundary key={activeMatch.matchId} onReset={() => setActiveMatch(null)}>
        <ActiveChat
          matchId={activeMatch.matchId}
          player={activeMatch.player}
          onBack={() => setActiveMatch(null)}
          t={t} lang={lang} dark={dark}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: ink, fontStyle: 'italic', fontWeight: 500 }}>{t.chat}</div>
      </div>

      {matchesLoading || matches === null ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone }}>
          <div style={{ width: 24, height: 24, margin: '0 auto', borderRadius: '50%', border: `2px solid ${COURT.green}30`, borderTopColor: COURT.green, animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone, fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15 }}>{t.noChats}</div>
      ) : matches.map((m, i) => {
        const { player, lastMessage } = m;
        return (
          <div key={m.matchId} onClick={() => setActiveMatch({
            matchId: m.matchId, player,
          })} style={{
            padding: '14px 24px', borderBottom: `0.5px solid ${border}`,
            display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer',
            animation: `cardIn 0.4s ease ${i * 0.06}s both`,
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: `url(${player.photo}) center/cover`, border: `0.5px solid ${border}` }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, background: player.online ? '#4CAF50' : stone, border: `1.5px solid ${bg}` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, color: ink, fontWeight: 500 }}>{player.name}</div>
                {lastMessage && <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone }}>{lastMessage.time}</div>}
              </div>
              {lastMessage && (
                <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, color: stone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {lastMessage.from === 'me' ? '→ ' : ''}{lastMessage.text[lang] || lastMessage.text.fr}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Matches / Stats Screen ──────────────────────────────────────────────────
function MatchesScreen({ t, lang, level, dark }) {
  const { profile } = useAuth();
  const history = useMatchHistory();
  const { stats } = usePlayerStats();
  const [tab, setTab] = useState('history');
  const rtl   = lang === 'he';
  const ff_serif  = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const card  = dark ? COURT.darkCard : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  const wins        = history.filter(m => m.result === 'win').length;
  const userMatches = stats?.matchesPlayed ?? profile?.matches_played ?? 0;
  const userWins    = stats?.wins ?? profile?.wins ?? 0;
  // null si aucun match — jamais de faux %
  const userWinrate = userMatches > 0 ? Math.round((userWins / userMatches) * 100) : null;
  const streak      = stats?.streak ?? 0;

  const tabs = [{ id: 'history', label: t.history }, { id: 'stats', label: t.statsTitle }];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
        <div style={{ fontFamily: ff_serif, fontSize: 28, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500 }}>{t.matches}</div>
      </div>

      <div style={{ display: 'flex', margin: '0 24px 20px', background: dark ? COURT.darkCard : COURT.creamDark, borderRadius: 10, padding: 4 }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === tb.id ? COURT.green : 'transparent',
            color: tab === tb.id ? COURT.cream : stone,
            fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14,
            transition: 'all 0.25s',
          }}>{tb.label}</button>
        ))}
      </div>

      {tab === 'history' && (
        <div style={{ padding: '0 24px' }}>
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', color: stone, fontSize: 14 }}>
              {lang === 'fr' ? 'Aucun match encore joué.' : lang === 'he' ? 'אין משחקים עדיין.' : 'No matches played yet.'}
            </div>
          )}
          {history.map((m, i) => {
            const p = m.player;
            return (
              <div key={m.id} style={{
                padding: '16px 0', borderBottom: `0.5px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: 14,
                animation: `cardIn 0.4s ease ${i * 0.06}s both`,
              }}>
                <div style={{ width: 5, height: 44, borderRadius: 3, background: m.result === 'win' ? COURT.green : COURT.purple, flexShrink: 0 }} />
                {p?.photo && <div style={{ width: 40, height: 40, borderRadius: 20, background: `url(${p.photo}) center/cover`, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500 }}>{p?.name || 'Adversaire'}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {m.date instanceof Date ? m.date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-GB') : ''}
                  </div>
                  {m.score && <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, color: COURT.green, marginTop: 2 }}>{m.score}</div>}
                </div>
                {m.delta != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: m.delta > 0 ? COURT.green : COURT.purple }}>
                      {m.delta > 0 ? '+' : ''}{(+m.delta).toFixed(2)}
                    </div>
                    <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, textTransform: 'uppercase', letterSpacing: '0.12em' }}>ELO</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: t.matchesPlayed,  value: userMatches },
              { label: t.winRateLabel,   value: userWinrate != null ? `${userWinrate}%` : '—' },
              { label: t.bestStreakLabel, value: streak > 0 ? `${streak}🔥` : '—' },
              { label: t.currentLevel,   value: level != null ? level.toFixed(1) : '—' },
            ].map((s, i) => (
              <div key={i} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 12, padding: '18px 16px', animation: `cardIn 0.4s ease ${i * 0.06}s both` }}>
                <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: COURT.green, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 12, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>{t.history}</div>
            {history.length > 0 ? (
              <>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                  {history.map((m, i) => (
                    <div key={i} style={{ flex: 1, background: m.result === 'win' ? COURT.green : COURT.purple, borderRadius: 2 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ fontFamily: 'Inter', fontSize: 10, color: COURT.green }}>{wins} {t.winRateLabel?.toLowerCase()}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 10, color: COURT.purple }}>{history.length - wins} défaites</div>
                </div>
              </>
            ) : (
              <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone }}>
                {lang === 'fr' ? 'Jouez votre premier match pour voir vos stats !' : lang === 'he' ? 'שחק את המשחק הראשון שלך!' : 'Play your first match to see stats!'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Likes Received Sheet ────────────────────────────────────────────────────
function LikesReceivedSheet({ t, lang, dark, userId, onClose, onOpenDetail }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const rtl = lang === 'he';
  const ff_serif  = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const ink   = dark ? COURT.darkText  : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const card  = dark ? COURT.darkCard  : COURT.cream;
  const border= dark ? COURT.darkBorder: `${COURT.green}30`;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('swipes')
        .select('swiper:swiper_id(id, name, photo_url, level), created_at')
        .eq('target_id', userId)
        .eq('direction', 'right')
        .order('created_at', { ascending: false })
        .limit(40);
      setLikes((data || []).map(r => r.swiper).filter(Boolean));
      setLoading(false);
    })();
  }, [userId]);

  return (
    <BottomSheet onClose={onClose} title={t.likesReceived || 'Likes reçus'} dark={dark}>
      <div style={{ padding: '8px 20px 24px', minHeight: 160 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone }}>…</div>
        )}
        {!loading && likes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💚</div>
            <p style={{ fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic', fontSize: 17, color: ink, margin: 0 }}>{t.noLikesYet || 'Aucun like pour l\'instant'}</p>
          </div>
        )}
        {likes.map((p, i) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `0.5px solid ${border}`, animation: `cardIn 0.3s ease ${i * 0.04}s both`, cursor: onOpenDetail ? 'pointer' : 'default' }}
            onClick={() => onOpenDetail?.(p.id)}
          >
            <div style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: `url(${p.photo_url || initialsAvatar(p.name || p.id)}) center/cover`, border: `1.5px solid ${COURT.green}40` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ff_serif, fontSize: 15, color: ink, fontWeight: 500 }}>{p.name || '—'}</div>
              {p.level != null && (
                <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.1em' }}>Niv. {p.level?.toFixed(1)}</div>
              )}
            </div>
            <div style={{ color: COURT.green, fontSize: 18 }}>💚</div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// ─── Profile Screen ──────────────────────────────────────────────────────────
function ProfileScreen({ t, showEditProfile, setShowEditProfile, onOpenDetail }) {
  const { user, profile, signOut, saveProfile }      = useAuth();
  const { lang, dark, level, confidence, toggleLang, toggleDark } = usePrefs();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showPartnerPrefs, setShowPartnerPrefs] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const rtl   = lang === 'he';
  const ff_serif  = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const card  = dark ? COURT.darkCard : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}50`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  const userName   = profile?.name     || '';
  const userCity   = profile?.region   || profile?.city || '';
  const userPhoto  = profile?.photo_url || '';
  const userMatches= profile?.matches_played ?? 0;

  // ─── Upload photo de profil ──────────────────────────────────────────────
  // Sync à la fois `profile.photo_url` (legacy / avatar) et `profile_photos` (galerie
  // Chantier 2). La photo devient automatiquement la photo "primary" de la galerie.
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Format invalide (JPEG, PNG ou WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image trop lourde (max 5 Mo)');
      return;
    }

    setUploading(true);
    try {
      // 1. Compression Canvas → ~500-700 KB
      const compressed = await compressImage(file);
      const ext = 'jpg'; // compressImage produit toujours du JPEG
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const path = `photos/${user.id}/${stamp}.${ext}`;

      // 2. Upload Supabase Storage
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, compressed, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });
      if (upErr) throw upErr;

      // 3. Récupère l'URL publique
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('URL publique introuvable');

      // 4. MAJ du champ legacy `photo_url` (utilisé partout pour l'avatar simple)
      const { error: saveErr } = await saveProfile({ photo_url: url });
      if (saveErr) throw saveErr;

      // 5. Insère dans la galerie `profile_photos` en photo primary
      //    (la trigger SQL Chantier 2 enlève le flag primary des autres photos)
      try {
        // Démarque toutes les autres en non-primary d'abord
        await supabase
          .from('profile_photos')
          .update({ is_primary: false })
          .eq('user_id', user.id);
        // Insère la nouvelle en primary, en première position
        await supabase
          .from('profile_photos')
          .insert({
            user_id: user.id,
            url,
            storage_path: path,
            is_primary: true,
            display_order: 0,
          });
      } catch (galleryErr) {
        // Erreur galerie non bloquante : l'avatar fonctionne quand même
        console.warn('[gallery sync] non bloquant:', galleryErr);
      }
    } catch (err) {
      console.error('[upload photo]', err);
      setUploadError(err.message || 'Échec de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  function SettingRow({ icon, label, right, onClick }) {
    return (
      <button onClick={onClick} style={{
        width: '100%', marginTop: 10, padding: '14px 16px',
        background: card, border: `0.5px solid ${border}`, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500, cursor: 'pointer',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon} {label}</span>
        <span style={{ color: COURT.green }}>{right || (rtl ? '←' : '→')}</span>
      </button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.member}</div>
        <div style={{ fontFamily: ff_serif, fontSize: 28, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500 }}>{t.myProfile}</div>
      </div>

      {/* Profile card */}
      <div style={{ margin: '0 20px', background: card, border: `0.5px solid ${border}`, borderRadius: 14, overflow: 'hidden', boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(15,61,41,0.08)' }}>
        <div style={{ height: 100, background: `linear-gradient(135deg, ${COURT.green}, ${COURT.greenDeep})`, position: 'relative', overflow: 'hidden' }}>
          <FloatingBalls count={4} />
          <div style={{ position: 'absolute', right: -20, top: -8, opacity: 0.18 }}>
            <PadelRacket size={140} frame={COURT.cream} grip={COURT.cream} accent={COURT.gold} />
          </div>
        </div>
        <div style={{ padding: '0 22px 22px', marginTop: -36, position: 'relative' }}>
          {/* Avatar tappable pour changer la photo */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: 36,
                background: userPhoto ? `url(${userPhoto}) center/cover` : `${COURT.green}30`,
                border: `2.5px solid ${bg}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                cursor: uploading ? 'wait' : 'pointer',
                opacity: uploading ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            />
            {/* Petit badge 📷 sur le coin */}
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28, borderRadius: 14,
                background: COURT.green, color: COURT.cream,
                border: `2px solid ${bg}`, cursor: uploading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, lineHeight: 1, padding: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
              aria-label={t.changePhoto || 'Changer la photo'}
            >
              {uploading ? '…' : '📷'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
          </div>
          {uploadError && (
            <div style={{
              marginTop: 6, fontFamily: ff_italic, fontStyle: 'italic',
              fontSize: 11, color: COURT.purple,
            }}>{uploadError}</div>
          )}
          <div style={{ fontFamily: ff_serif, fontSize: 24, color: ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic', marginTop: 10 }}>{userName}</div>
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginBottom: 14 }}>{userCity} · 2026</div>
          <Ornament width={50} color={COURT.gold} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 18 }}>
            {[
              { label: t.currentLevel,  value: level != null ? level.toFixed(1) : '—' },
              { label: t.matchesPlayed, value: userMatches },
              { label: t.confidence,    value: `${confidence}%` },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: COURT.green, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 8, color: stone, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 0' }}>
        <SectionHeading>{t.settings}</SectionHeading>
        <SettingRow icon="✏️" label={lang === 'fr' ? 'Modifier mon profil' : lang === 'en' ? 'Edit profile' : 'עריכת פרופיל'} onClick={() => setShowEditProfile(true)} />
        <SettingRow icon="💚" label={t.likesReceived || 'Likes reçus'} onClick={() => setShowLikes(true)} />
        <SettingRow icon="🎯" label={t.partnerPrefsTitle || 'Le partenaire idéal'} onClick={() => setShowPartnerPrefs(true)} />
        <SettingRow icon="🌍" label={lang === 'fr' ? '🇫🇷 Français' : lang === 'en' ? '🇬🇧 English' : '🇮🇱 עברית'} onClick={toggleLang} />
        <SettingRow
          icon={dark ? '☀️' : '🌙'}
          label={t.darkMode}
          right={<div style={{ width: 44, height: 24, borderRadius: 12, background: dark ? COURT.green : `${COURT.stone}50`, position: 'relative', transition: 'background 0.3s' }}>
            <div style={{ position: 'absolute', top: 2, left: dark ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>}
          onClick={toggleDark}
        />
        <SettingRow icon="📊" label={lang === 'fr' ? 'Réévaluer mon niveau' : lang === 'en' ? 'Re-evaluate my level' : 'הערך מחדש את הרמה שלי'} onClick={() => navigate('/onboarding', { replace: true })} />
        {/* Déconnexion */}
        <button onClick={handleSignOut} style={{
          width: '100%', marginTop: 10, padding: '14px 16px',
          background: 'transparent', border: `0.5px solid ${COURT.purple}60`, borderRadius: 10,
          fontFamily: ff_serif, fontSize: 16, color: COURT.purple, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {lang === 'fr' ? 'Se déconnecter' : lang === 'he' ? 'התנתק' : 'Sign out'}
        </button>
      </div>

      {/* BottomSheet : Likes reçus */}
      {showLikes && (
        <LikesReceivedSheet
          t={t} lang={lang} dark={dark} userId={user?.id}
          onClose={() => setShowLikes(false)}
          onOpenDetail={onOpenDetail}
        />
      )}

      {/* BottomSheet : Le partenaire idéal (partner_prefs) */}
      {showPartnerPrefs && (
        <PartnerPrefsSheet
          t={t} lang={lang} dark={dark}
          initial={profile?.partner_prefs || {}}
          onSave={async (prefs) => {
            await saveProfile({ partner_prefs: prefs });
            setShowPartnerPrefs(false);
          }}
          onClose={() => setShowPartnerPrefs(false)}
        />
      )}
    </div>
  );
}

// ─── PartnerPrefs Sheet (Chantier 4) ─────────────────────────────────────────
function PartnerPrefsSheet({ t, lang, dark, initial, onSave, onClose }) {
  const rtl   = lang === 'he';
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';
  const [prefs, setPrefs] = useState({
    hand:   initial.hand   || 'any',
    side:   initial.side   || 'any',
    style:  initial.style  || 'any',
    region: initial.region || 'any',
    levelMin: initial.levelMin ?? 1,
    levelMax: initial.levelMax ?? 7,
  });
  const [saving, setSaving] = useState(false);

  const ChipRow = ({ label, value, options, onChange }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontFamily: 'Inter', fontSize: 9, color: stone,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        marginBottom: 8, fontWeight: 600,
      }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '7px 12px',
              background: value === opt.value ? COURT.green : 'transparent',
              color: value === opt.value ? COURT.cream : ink,
              border: `0.5px solid ${value === opt.value ? COURT.green : (dark ? COURT.darkBorder : `${COURT.green}50`)}`,
              borderRadius: 999,
              fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, cursor: 'pointer',
              transition: 'all 0.18s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const submit = async () => {
    setSaving(true);
    await onSave(prefs);
    setSaving(false);
  };

  return (
    <BottomSheet onClose={onClose} title={t.partnerPrefsTitle || 'Le partenaire idéal'} dark={dark}>
      <div style={{ padding: '8px 20px 20px' }}>
        <p style={{
          fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 13, color: stone, marginTop: 0, marginBottom: 18,
          textAlign: 'center',
        }}>
          {t.partnerPrefsHint || 'Décris qui tu cherches comme partenaire'}
        </p>

        <ChipRow
          label={t.hand || 'Main'} value={prefs.hand}
          onChange={(v) => setPrefs(p => ({ ...p, hand: v }))}
          options={[
            { value: 'any',   label: t.anyHand   || t.anySide || 'Indifférent' },
            { value: 'right', label: t.rightHand || 'Droitier' },
            { value: 'left',  label: t.leftHand  || 'Gaucher' },
          ]}
        />

        <ChipRow
          label={t.side || 'Côté'} value={prefs.side}
          onChange={(v) => setPrefs(p => ({ ...p, side: v }))}
          options={[
            { value: 'any',      label: t.anySide || 'Indifférent' },
            { value: 'forehand', label: t.forehand || 'Drive' },
            { value: 'backhand', label: t.backhand || 'Revers' },
          ]}
        />

        <ChipRow
          label={t.playerStyle || 'Style'} value={prefs.style}
          onChange={(v) => setPrefs(p => ({ ...p, style: v }))}
          options={[
            { value: 'any',        label: t.anyStyle  || 'Indifférent' },
            { value: 'aggressive', label: t.aggressive || 'Offensif' },
            { value: 'defensive',  label: t.defensive  || 'Défensif' },
            { value: 'all-court',  label: t.allcourt   || 'Polyvalent' },
          ]}
        />

        <ChipRow
          label={t.region || 'Région'} value={prefs.region}
          onChange={(v) => setPrefs(p => ({ ...p, region: v }))}
          options={[
            { value: 'any', label: t.anySide || 'Indifférent' },
            { value: 'Centre', label: 'Centre' },
            { value: 'Nord',   label: 'Nord' },
            { value: 'Sud',    label: 'Sud' },
            { value: 'Eilat',  label: 'Eilat' },
          ]}
        />

        {/* Plage de niveau */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'Inter', fontSize: 9, color: stone,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            marginBottom: 8, fontWeight: 600,
          }}>{t.levelRange || 'Plage de niveau'} : {prefs.levelMin}–{prefs.levelMax}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="range" min="1" max="7" step="0.5"
              value={prefs.levelMin}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setPrefs(p => ({ ...p, levelMin: v, levelMax: Math.max(v, p.levelMax) }));
              }}
              style={{ flex: 1 }}
            />
            <input
              type="range" min="1" max="7" step="0.5"
              value={prefs.levelMax}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setPrefs(p => ({ ...p, levelMax: v, levelMin: Math.min(v, p.levelMin) }));
              }}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            background: COURT.green, color: COURT.cream,
            border: 'none', borderRadius: 10,
            fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 15, cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '…' : (t.applyFilters || 'Appliquer')}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Notifications Panel ─────────────────────────────────────────────────────
function NotificationsPanel({ t, lang, notifications, onClose, onMarkRead, dark }) {
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const iconMap = { match: '🎾', eval: '⭐', level: '📈' };

  return (
    <BottomSheet onClose={onClose} title={t.notifications} dark={dark}>
      {notifications.length === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: stone, fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15 }}>{t.noNotifs}</div>
      ) : notifications.map((n, i) => {
        const from = n.fromPlayer;
        return (
          <div key={n.id} onClick={() => onMarkRead(n.id)} style={{
            padding: '14px 24px', borderBottom: `0.5px solid ${border}`,
            display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer',
            opacity: n.read ? 0.6 : 1,
            background: !n.read ? (dark ? `${COURT.green}12` : `${COURT.green}06`) : 'transparent',
          }}>
            {from?.photo ? (
              <div style={{ width: 40, height: 40, borderRadius: 20, background: `url(${from.photo}) center/cover`, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 20, background: COURT.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {iconMap[n.type] || '🔔'}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 14, color: ink, lineHeight: 1.4 }}>{n.text[lang] || n.text.fr}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, marginTop: 2 }}>{n.time}</div>
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: COURT.green, flexShrink: 0 }} />}
          </div>
        );
      })}
    </BottomSheet>
  );
}

// ─── Live Score Tracker ──────────────────────────────────────────────────────
function LiveScoreTracker({ t, lang, onClose, dark }) {
  const [score,   setScore]   = useState({ me: 0, them: 0, sets: [] });
  const [serving, setServing] = useState('me');
  const [stage,   setStage]   = useState('playing'); // 'playing' | 'submitting'
  const [selectedOpponentId, setSelectedOpponentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [scoreMode, setScoreMode] = useState('live'); // 'live' | 'text'
  const [scoreText, setScoreText] = useState('');
  const [scoreTextError, setScoreTextError] = useState(null);
  const { matches: userMatches } = useUserMatches();
  const { submitResult } = useMatchResults();

  // Parse "6-4 6-3" ou "6-3 3-6 6-2" → tableau de sets
  const parseScoreText = (txt) => {
    const parts = txt.trim().split(/\s+/);
    if (parts.length === 0 || parts.length > 3) return null;
    const sets = [];
    for (const p of parts) {
      const m = p.match(/^(\d+)-(\d+)$/);
      if (!m) return null;
      const me = parseInt(m[1]), them = parseInt(m[2]);
      sets.push({ me, them, winner: me >= them ? 'me' : 'them' });
    }
    return sets;
  };

  const handleApplyTextScore = () => {
    const sets = parseScoreText(scoreText);
    if (!sets) { setScoreTextError(t.scoreInvalid || 'Format invalide — ex: 6-4 6-3'); return; }
    setScore(prev => ({ ...prev, sets, me: 0, them: 0 }));
    setScoreTextError(null);
    setScoreText('');
    setScoreMode('live');
  };
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}30`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const rtl   = lang === 'he';
  const ff_serif = rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif';
  const ff_italic = rtl ? 'Inter, sans-serif' : 'Crimson Text, serif';

  const addPoint = (who) => {
    setScore(prev => {
      const other = who === 'me' ? 'them' : 'me';
      const newScore = { ...prev, [who]: prev[who] + 1 };
      if (newScore[who] >= 6 && newScore[who] - newScore[other] >= 2) {
        return { me: 0, them: 0, sets: [...prev.sets, { me: newScore.me, them: newScore.them, winner: who }] };
      }
      return newScore;
    });
  };

  // Calcul du résultat global à partir des sets joués
  const setsWonByMe = score.sets.filter(s => s.winner === 'me').length;
  const setsWonByThem = score.sets.filter(s => s.winner === 'them').length;
  const myResult = setsWonByMe > setsWonByThem ? 'win'
    : setsWonByMe < setsWonByThem ? 'loss' : 'draw';
  const scoreString = score.sets.map(s => `${s.me}-${s.them}`).join(' ');

  const handleEndMatch = () => {
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
    if (score.sets.length === 0) {
      // Aucun set joué → ferme simplement
      onClose();
      return;
    }
    setStage('submitting');
  };

  const handleSubmit = async () => {
    if (!selectedOpponentId) {
      setSubmitError(t.selectOpponent || 'Please select an opponent');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const { success, error } = await submitResult({
      opponentId: selectedOpponentId,
      result: myResult,
      score: scoreString,
    });
    setSubmitting(false);
    if (success) {
      if (navigator.vibrate) navigator.vibrate([10, 5, 10]);
      onClose();
    } else {
      setSubmitError(error);
    }
  };

  // ─── Vue "Soumission du score" ───
  if (stage === 'submitting') {
    return (
      <BottomSheet onClose={onClose} title={t.submitScore || 'Soumettre le score'} dark={dark}>
        <div style={{ padding: '0 24px 16px' }}>
          {/* Récap du score */}
          <div style={{
            background: bg, border: `0.5px solid ${border}`, borderRadius: 14,
            padding: 16, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t.finalScore || 'Score final'}
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 30, color: COURT.green, lineHeight: 1.2 }}>
              {scoreString || '—'}
            </div>
            <div style={{
              marginTop: 10, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 14,
              color: myResult === 'win' ? COURT.green : (myResult === 'loss' ? COURT.purple : COURT.gold),
            }}>
              {myResult === 'win' ? (t.youWon || 'Victoire') : (myResult === 'loss' ? (t.youLost || 'Défaite') : (t.draw || 'Égalité'))}
            </div>
          </div>

          {/* Sélection de l'adversaire */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
              {t.selectOpponent || "Adversaire"}
            </div>
            {(!userMatches || userMatches.length === 0) ? (
              <div style={{
                padding: '14px 16px', background: bg, border: `0.5px dashed ${border}`,
                borderRadius: 10, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 13, color: stone, textAlign: 'center',
              }}>
                {t.noMatchesForSubmit || "Vous n'avez aucun partenaire de match. Trouvez-en un d'abord."}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {userMatches.map(m => {
                  const isSelected = selectedOpponentId === m.player.id;
                  return (
                    <button
                      key={m.matchId}
                      onClick={() => setSelectedOpponentId(m.player.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        background: isSelected ? `${COURT.green}15` : bg,
                        border: `0.5px solid ${isSelected ? COURT.green : border}`,
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                        background: `url(${m.player.photo}) center/cover`,
                        border: isSelected ? `1.5px solid ${COURT.green}` : `0.5px solid ${border}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: ff_serif, fontSize: 15, color: ink, fontWeight: 500 }}>
                          {m.player.name}
                        </div>
                      </div>
                      {isSelected && <div style={{ color: COURT.green, fontSize: 20 }}>✓</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Erreur */}
          {submitError && (
            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: `${COURT.purple}15`,
              border: `0.5px solid ${COURT.purple}60`,
              borderRadius: 8, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 12, color: COURT.purple,
            }}>
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={() => setStage('playing')}
              disabled={submitting}
              style={{
                flex: 1, padding: '14px', background: 'transparent',
                color: stone, border: `0.5px solid ${border}`,
                borderRadius: 10, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 14, cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              ← {t.back || 'Retour'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedOpponentId}
              style={{
                flex: 2, padding: '14px',
                background: selectedOpponentId ? COURT.green : `${COURT.green}50`,
                color: COURT.cream, border: 'none', borderRadius: 10,
                fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 15, cursor: (submitting || !selectedOpponentId) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <PadelBall size={14} shadow={false} />
              {submitting ? '…' : (t.submitForConfirmation || 'Envoyer pour confirmation')}
            </button>
          </div>

          <div style={{
            marginTop: 12, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 11, color: stone, textAlign: 'center',
          }}>
            {t.submitHint || 'Votre adversaire devra confirmer le score sous 72h.'}
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} title={t.scoreTracker} dark={dark}>
      <div style={{ padding: '0 24px 16px' }}>

        {/* Mode tabs: Live | Texte */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ k: 'live', label: t.liveMode || 'En direct' }, { k: 'text', label: t.textMode || 'Par texte' }].map(m => (
            <button key={m.k} onClick={() => { setScoreMode(m.k); setScoreTextError(null); }} style={{
              flex: 1, padding: '9px', borderRadius: 8,
              background: scoreMode === m.k ? COURT.green : (dark ? COURT.darkCard : COURT.creamDark),
              color: scoreMode === m.k ? COURT.cream : stone,
              border: `0.5px solid ${scoreMode === m.k ? COURT.green : border}`,
              fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s',
            }}>{m.label}</button>
          ))}
        </div>

        {/* Text mode: saisie directe "6-4 6-3" */}
        {scoreMode === 'text' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t.scoreInputHint || 'Séparer les sets par un espace'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={scoreText}
                onChange={e => { setScoreText(e.target.value); setScoreTextError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleApplyTextScore()}
                placeholder={t.scoreInputPlaceholder || 'Ex: 6-4 6-3'}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 10,
                  background: dark ? COURT.darkCard : COURT.cream,
                  border: `0.5px solid ${scoreTextError ? COURT.red : border}`,
                  fontFamily: 'Playfair Display, serif', fontSize: 18,
                  color: ink, outline: 'none', letterSpacing: '0.04em',
                }}
              />
              <button onClick={handleApplyTextScore} style={{
                padding: '11px 16px', borderRadius: 10, background: COURT.green, color: COURT.cream,
                border: 'none', fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>✓ Ok</button>
            </div>
            {scoreTextError && (
              <div style={{ fontFamily: ff_italic, fontStyle: 'italic', fontSize: 12, color: COURT.red, marginTop: 5 }}>
                {scoreTextError}
              </div>
            )}
          </div>
        )}

        {score.sets.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {score.sets.map((s, i) => (
              <div key={i} style={{ padding: '6px 14px', borderRadius: 20, background: COURT.green, color: COURT.cream, fontFamily: 'Playfair Display, serif', fontSize: 14 }}>{s.me}–{s.them}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[{ key: 'me', label: t.myScore }, { key: 'them', label: t.theirScore }].map(side => (
            <div key={side.key} style={{ background: bg, border: `0.5px solid ${border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>{side.label}</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 64, color: COURT.green, lineHeight: 1 }}>{score[side.key]}</div>
              <button onClick={() => addPoint(side.key)} style={{
                marginTop: 14, width: '100%', padding: '12px', background: COURT.green,
                color: COURT.cream, border: 'none', borderRadius: 10,
                fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15, cursor: 'pointer',
              }}>+ Point</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ key: 'me', label: t.myScore }, { key: 'them', label: t.theirScore }].map(s => (
            <button key={s.key} onClick={() => setServing(s.key)} style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: serving === s.key ? COURT.gold : (dark ? COURT.darkCard : COURT.creamDark),
              color: serving === s.key ? COURT.ink : stone,
              border: `0.5px solid ${serving === s.key ? COURT.gold : border}`,
              fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13, cursor: 'pointer',
            }}>🎾 {s.label}</button>
          ))}
        </div>
        <button onClick={handleEndMatch} style={{
          width: '100%', padding: '14px', background: COURT.purple, color: COURT.cream,
          border: 'none', borderRadius: 10, fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15, cursor: 'pointer',
        }}>{t.endMatch}</button>
      </div>
    </BottomSheet>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function MainApp() {
  const { profile }                                        = useAuth();
  const { lang, dark: darkMode, level, confidence, setLevel } = usePrefs();
  const t = I18N[lang] || I18N.fr;

  const [tab, setTab] = useState('home');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showScore,  setShowScore]  = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Pending match results (anti-fraud system)
  const { pendingToConfirm } = useMatchResults();
  const pendingCount = pendingToConfirm.length;

  // Sync le niveau depuis la DB vers localStorage (ex: connexion depuis un nouvel appareil)
  useEffect(() => {
    if (profile === undefined || profile === null) return;
    const dbLevel = profile.level ?? null;
    const localLevel = level;
    const differ = dbLevel !== localLevel && (dbLevel == null || localLevel == null || Math.abs(dbLevel - localLevel) > 0.01);
    if (differ) setLevel(dbLevel);
  }, [profile?.level]);

  // Notifications temps réel depuis Supabase
  const { notifications, markRead, markAllRead } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  // TODO: Compter les conversations non lues depuis ChatScreen sans double hook
  const chatUnread = 0;

  const screens = {
    home:    <HomeScreen    t={t} lang={lang} level={level} confidence={confidence} dark={darkMode} detailPlayerId={detailPlayerId} setDetailPlayerId={setDetailPlayerId} />,
    search:  <SearchFlow    t={t} lang={lang} dark={darkMode} userLevel={level} onNavigateChat={() => setTab('chat')} onOpenDetail={setDetailPlayerId} />,
    chat:    <ChatScreen    t={t} lang={lang} dark={darkMode} />,
    trophy:  <MatchesScreen t={t} lang={lang} level={level} dark={darkMode} />,
    profile: <ProfileScreen t={t} showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile} onOpenDetail={setDetailPlayerId} />,
  };

  const bg    = darkMode ? COURT.darkBg : COURT.cream;
  const border= darkMode ? COURT.darkBorder : `${COURT.green}40`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {screens[tab]}

      {/* Bouton scores à confirmer (anti-fraude) */}
      {pendingCount > 0 && (
        <button onClick={() => setShowPending(true)} style={{
          position: 'absolute', top: 14, right: 60, zIndex: 50,
          height: 36, padding: '0 12px', borderRadius: 18,
          background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.gold}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 12,
          boxShadow: '0 2px 8px rgba(15,61,41,0.25)', animation: 'notifPop 0.4s ease',
        }}>
          <PadelBall size={14} shadow={false} />
          <span>{pendingCount} {pendingCount > 1 ? 'scores' : 'score'}</span>
        </button>
      )}

      {/* Cloche de notifications */}
      <button onClick={() => setShowNotifs(true)} style={{
        position: 'absolute', top: 14, right: 16, zIndex: 50,
        width: 36, height: 36, borderRadius: 18,
        background: darkMode ? COURT.darkCard : COURT.cream,
        border: `0.5px solid ${border}`, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: darkMode ? COURT.darkText : COURT.green,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Inter', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, animation: 'notifPop 0.4s ease' }}>{unreadCount}</div>
        )}
      </button>

      {/* Bouton score flottant */}
      {tab === 'home' && (
        <button onClick={() => setShowScore(true)} style={{
          position: 'absolute', bottom: 115, right: 20, zIndex: 50,
          padding: '10px 16px', borderRadius: 24,
          background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.gold}50`,
          fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 13,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,61,41,0.25)',
          display: 'flex', alignItems: 'center', gap: 6,
          animation: 'fadeUp 0.6s ease 1s both',
        }}>
          <PadelBall size={16} shadow={false} /> {t.startMatch}
        </button>
      )}

      <BottomNav active={tab} onChange={setTab} t={t} notifCount={unreadCount} chatCount={chatUnread} dark={darkMode} />

      {showNotifs && (
        <NotificationsPanel
          t={t} lang={lang} notifications={notifications} dark={darkMode}
          onClose={() => { setShowNotifs(false); markAllRead(); }}
          onMarkRead={markRead}
        />
      )}

      {showScore && (
        <ErrorBoundary key="live-score-tracker">
          <LiveScoreTracker t={t} lang={lang} dark={darkMode} onClose={() => setShowScore(false)} />
        </ErrorBoundary>
      )}

      {detailPlayerId && (
        <DetailedProfileModal
          playerId={detailPlayerId}
          onClose={() => setDetailPlayerId(null)}
          dark={darkMode}
        />
      )}

      {showEditProfile && (
        <ProfileEditScreen
          onClose={() => setShowEditProfile(false)}
          dark={darkMode}
        />
      )}

      {showPending && (
        <PendingMatchesPanel
          t={t} lang={lang} dark={darkMode}
          onClose={() => setShowPending(false)}
        />
      )}
    </div>
  );
}
