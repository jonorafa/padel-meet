import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COURT, PadelBall, PadelRacket, FloatingBalls, Ornament,
  SectionHeading, ThinButton, HeritageTag, BottomNav,
  SkeletonCard, MatchFlash, NotifBadge, OnlineDot, BottomSheet,
  setDarkMode, isDark, initialsAvatar, Achievements, CompatRing,
} from '../components/CourtUI';
import { compatScore } from '../lib/compatibility';
import { REGIONS, computeELODelta, I18N, regionToCountry } from '../data/courtData';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useAuth }          from '../context/AuthContext';
import { usePrefs }         from '../context/PrefsContext';
import { useOnline }        from '../context/PresenceContext';
import { formatPresence }   from '../lib/presence';
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
import StreakScreen          from './StreakScreen';
import { tickStreak }        from '../hooks/useStreak';
import StatsSection          from '../components/StatsSection';
import QuizScreen           from './ScoreScreen';

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
            fontFamily: 'Spectral, serif', fontStyle: 'italic',
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
// Utilise des thumbs draggables indépendants (onPointerDown sur chaque balle)
// plutôt que deux <input type="range"> superposés — évite les conflits de zIndex
// qui rendaient le pouce droit non-tactile sur mobile.
function RangeBar({ min, max, step, valueMin, valueMax, onChange, dark }) {
  const trackRef   = useRef(null);
  const dragRef    = useRef(null);          // 'min' | 'max' | null
  const vMinRef    = useRef(valueMin);
  const vMaxRef    = useRef(valueMax);
  vMinRef.current  = valueMin;
  vMaxRef.current  = valueMax;

  const snapToStep = useCallback((v) =>
    Math.round((v - min) / step) * step + min,
  [min, step]);

  const valueFromClient = useCallback((clientX) => {
    if (!trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snapToStep(min + pct * (max - min));
  }, [min, max, snapToStep]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const val = valueFromClient(clientX);
      if (val === null) return;
      if (dragRef.current === 'min') {
        onChange(Math.min(val, vMaxRef.current - step), vMaxRef.current);
      } else {
        onChange(vMinRef.current, Math.max(val, vMinRef.current + step));
      }
    };
    const onEnd = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onEnd);
    window.addEventListener('touchmove',   onMove, { passive: false });
    window.addEventListener('touchend',    onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onEnd);
      window.removeEventListener('touchmove',   onMove);
      window.removeEventListener('touchend',    onEnd);
    };
  }, [onChange, step, valueFromClient]);

  const startDrag = (thumb) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = thumb;
  };

  const minPct = ((valueMin - min) / (max - min)) * 100;
  const maxPct = ((valueMax - min) / (max - min)) * 100;

  return (
    <div style={{ position: 'relative', padding: '12px 0', touchAction: 'none' }}>
      {/* Track */}
      <div ref={trackRef} style={{ height: 2, background: `${COURT.green}25`, position: 'relative', borderRadius: 1 }}>
        <div style={{
          position: 'absolute', height: '100%',
          left: `${minPct}%`, width: `${maxPct - minPct}%`,
          background: COURT.green,
        }} />
      </div>
      {/* Pouce gauche (min) */}
      <div
        onPointerDown={startDrag('min')}
        style={{
          position: 'absolute', top: '50%',
          transform: 'translate(-50%, -50%)',
          left: `${minPct}%`,
          cursor: 'grab', touchAction: 'none', zIndex: 3,
        }}
      >
        <PadelBall size={20} />
      </div>
      {/* Pouce droit (max) */}
      <div
        onPointerDown={startDrag('max')}
        style={{
          position: 'absolute', top: '50%',
          transform: 'translate(-50%, -50%)',
          left: `${maxPct}%`,
          cursor: 'grab', touchAction: 'none', zIndex: 3,
        }}
      >
        <PadelBall size={20} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Mulish', fontSize: 9, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.18em', marginTop: 14 }}>
        <span>{min.toFixed(1)}</span><span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

function PrefGroup({ label, children, dark }) {
  return (
    <div style={{ padding: '16px 24px 4px' }}>
      <div style={{ fontFamily: 'Mulish', fontSize: 10, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
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

  const reset = () => { setSide('any'); setStyle('any'); setMotivation('any'); setHand('any'); setRegion('any'); setLevelMin(1); setLevelMax(7); setFrequency(0); };
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
        <Chips dark={dark} value={region} onChange={setRegion} options={[
          { v: 'any',     label: t.anySide },
          { v: 'France',  label: '🇫🇷 France', icon: '' },
          { v: 'Israël',  label: '🇮🇱 Israël', icon: '' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.levelRange} dark={dark}>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: COURT.green, marginBottom: 8 }}>
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
              fontFamily: 'Spectral, serif', fontSize: 14,
            }}>{n === 0 ? '—' : `${n}+`}</button>
          ))}
        </div>
      </PrefGroup>
      <div style={{ display: 'flex', gap: 10, padding: '20px 24px 0' }}>
        <button onClick={reset} style={{
          flex: 1, padding: '14px',
          background: dark ? COURT.darkCard : COURT.cream,
          color: dark ? COURT.darkMuted : COURT.stone,
          border: `0.5px solid ${dark ? COURT.darkBorder : COURT.stone + '50'}`,
          borderRadius: 10, fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14, cursor: 'pointer',
        }}>{t.reset}</button>
        <button onClick={() => { onApply({ side, style, motivation, hand, region, levelMin, levelMax, frequency }); onClose(); }} style={{
          flex: 2, padding: '14px', background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.green}`, borderRadius: 10,
          fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15, cursor: 'pointer',
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
        <div style={{ fontFamily: 'Mulish', fontSize: 8, color: stone, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 13, color: ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, dragX = 0, t, lang, dark }) {
  const { profile: me } = useAuth();
  const yesOp = Math.max(0, Math.min(1, dragX / 100));
  const noOp  = Math.max(0, Math.min(1, -dragX / 100));
  const playerIsOnline = useOnline(p?.id);
  const ff_serif  = lang === 'he' ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = lang === 'he' ? 'Mulish, sans-serif' : 'Spectral, serif';
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const border= dark ? COURT.darkBorder : `${COURT.green}40`;

  const styleLabel = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt }[p.style] || t.allcourt;
  const motivLabel = { fun: t.fun, improve: t.improve, compete: t.compete }[p.motivation] || t.fun;
  const sideLabel  = p.side === 'forehand' ? t.forehand : t.backhand;
  const handLabel  = p.hand === 'left' ? t.leftHand : t.rightHand;
  const bio = lang === 'he' ? p.bioHe : (lang === 'en' ? (p.bioEn || p.bioFr) : p.bioFr);
  const compat = me ? compatScore(me, p) : (p.confidenceRate ?? 90);

  // Partenaire idéal — réutilise le JSON partner_prefs existant
  const prefs = p.partnerPrefs || {};
  const seekStyleMap = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt };
  const seekMotivMap = { fun: t.fun, improve: t.improve, compete: t.compete };
  const seekChips = [];
  if (prefs.levelMin != null && prefs.levelMax != null && (prefs.levelMin > 1 || prefs.levelMax < 7))
    seekChips.push({ icon: '✦', label: `${prefs.levelMin}–${prefs.levelMax}`, color: COURT.purple });
  if (prefs.hand && prefs.hand !== 'any')
    seekChips.push({ icon: '🤚', label: prefs.hand === 'left' ? t.leftHand : t.rightHand, color: COURT.green });
  if (prefs.side && prefs.side !== 'any')
    seekChips.push({ icon: '🎾', label: prefs.side === 'forehand' ? t.forehand : t.backhand, color: COURT.green });
  if (prefs.style && prefs.style !== 'any')
    seekChips.push({ icon: '⚡', label: seekStyleMap[prefs.style] || prefs.style, color: COURT.purple });
  if (prefs.motivation && prefs.motivation !== 'any')
    seekChips.push({ icon: '◎', label: seekMotivMap[prefs.motivation] || prefs.motivation, color: COURT.gold });
  if (prefs.region && prefs.region !== 'any')
    seekChips.push({ icon: '📍', label: prefs.region, color: stone });

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      border: `0.5px solid ${border}`, borderRadius: 20, overflow: 'hidden',
      boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.4)' : '0 12px 32px rgba(15,61,41,0.14)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Portrait (flexible, remplit l'espace restant) ───────────── */}
      <div style={{
        flex: 1, minHeight: 130,
        background: `url(${p.photo}) center 20%/cover`,
        position: 'relative',
      }}>
        {/* Dégradé bas */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.52) 100%)' }} />

        {/* Badge en ligne (haut gauche) */}
        {playerIsOnline && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(0,0,0,0.45)', padding: '4px 8px', borderRadius: 20,
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'Mulish', fontSize: 9, color: '#7ED957',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            opacity: 1 - Math.max(yesOp, noOp),
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#7ED957' }} />
            {t.online}
          </div>
        )}

        {/* Badge niveau (haut droite) */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: `${COURT.green}E8`, border: `0.5px solid ${COURT.gold}`,
          borderRadius: 10, padding: '7px 12px 5px', textAlign: 'center',
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 7.5, color: COURT.gold, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{t.currentLevel}</div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: COURT.cream, lineHeight: 1 }}>
            {p.level != null ? p.level.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      {/* ─── Infos ───────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 16px', flexShrink: 0, position: 'relative' }}>
        {/* Anneau compat flottant — chevauche le portrait */}
        <div style={{
          position: 'absolute', right: 16, top: -36,
          width: 80, height: 80, borderRadius: 40, background: bg,
          border: `0.5px solid ${border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.14)',
        }}>
          <CompatRing size={70} value={compat} txt={dark ? COURT.cream : COURT.green}
            label={t.compatibility || t.confidence} rtl={lang === 'he'} />
        </div>

        {/* Nom · âge */}
        <div style={{ fontFamily: ff_serif, fontSize: 24, color: ink, fontWeight: 500, lineHeight: 1, paddingRight: 72 }}>
          {p.name.split(' ')[0]}{' '}
          <span style={{ fontStyle: lang === 'he' ? 'normal' : 'italic', color: COURT.green }}>
            {p.name.split(' ').slice(1).join(' ')}
          </span>
          <span style={{ fontFamily: ff_italic, fontStyle: 'italic', fontSize: 14, color: stone }}> · {p.age}</span>
        </div>

        {/* Ville · matchs · winrate */}
        <div style={{ fontFamily: 'Mulish', fontSize: 10.5, color: stone, letterSpacing: '0.05em', marginTop: 5, paddingRight: 72 }}>
          📍 {p.city} · {p.matches} {t.matchesPlayed?.toLowerCase?.() || 'matchs'}{p.winrate != null ? ` · ${p.winrate}% ${t.winsWord}` : ''}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
          <HeritageTag color={COURT.green}>{handLabel}</HeritageTag>
          <HeritageTag color={COURT.green}>{sideLabel}</HeritageTag>
          <HeritageTag color={COURT.purple}>{styleLabel}</HeritageTag>
          <HeritageTag color={COURT.gold}>{motivLabel}</HeritageTag>
        </div>

        {/* Bio */}
        {bio && (
          <p style={{
            fontFamily: ff_italic, fontStyle: 'italic', fontSize: 13,
            color: ink, lineHeight: 1.45, marginTop: 12, marginBottom: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>« {bio} »</p>
        )}

        {/* Partenaire idéal */}
        {seekChips.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}`,
          }}>
            <div style={{
              fontFamily: 'Mulish', fontSize: 8.5, color: COURT.gold,
              letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8,
            }}>
              {t.partnerPrefsTitle || 'Le partenaire idéal'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {seekChips.map((c, i) => (
                <span key={i} style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: `${c.color}12`, color: c.color,
                  border: `0.5px solid ${c.color}30`,
                  fontFamily: ff_italic, fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 12,
                  display: 'inline-flex', gap: 5, alignItems: 'center',
                }}>{c.icon} {c.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Overlays swipe ──────────────────────────────────────────── */}
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
    if (f.region !== 'any' && p.country !== f.region) return false;
    if (p.level !== null && p.level !== undefined && (p.level < f.levelMin || p.level > f.levelMax)) return false;
    if (f.frequency > 0 && p.frequency < f.frequency) return false;
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
      <div style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontSize: 20, color: ink, fontStyle: rtl ? 'normal' : 'italic' }}>{t.closedClub}</div>
      <p style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, maxWidth: 240, margin: '12px 0 24px' }}>{t.closedHint}</p>
      <ThinButton variant="green" onClick={onReset}>{t.refreshStack}</ThinButton>
    </div>
  );
}

// ─── Swipe Stack ────────────────────────────────────────────────────────────
function SwipeStack({ t, lang, filters, onEditFilters, onMatch, dark, userLevel, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0 }) {
  // ── Données réelles ──
  const { profile: me } = useAuth();
  const { players: allPlayers, loading: playersLoading, refetch } = usePlayers();
  const { recordSwipe } = useSwipes();

  const matched = useMemo(() => {
    if (!allPlayers) return [];
    const filtered = applyFilters(allPlayers, filters);
    if (!me) return filtered;
    // Scoring souple : les partenaires les plus compatibles (niveau + main +
    // « partenaire idéal ») remontent en haut de la pile. Personne n'est exclu.
    return filtered
      .map(p => ({ p, sc: compatScore(me, p) }))
      .sort((a, b) => b.sc - a.sc)
      .map(x => x.p);
  }, [allPlayers, filters, me]);

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
    // Mode invité : bloquer les likes
    if (isGuest && dir === 'right') { onGuestAction?.(); return; }
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
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
      paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
        <div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
          <div style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontSize: 26, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500, lineHeight: 1.1 }}>{t.partners}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginLeft: 12 }}>
          {/* Cloche notifications */}
          <button onClick={onShowNotifs} style={{
            position: 'relative', flexShrink: 0, width: 30, height: 30, borderRadius: 15,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Mulish', fontSize: 7, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{notifCount}</div>
            )}
          </button>
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
                fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
                fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 13, color: ink, outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button onClick={onEditFilters} style={{
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
            borderRadius: 999, padding: '0 12px', height: 30,
            fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 12, color: COURT.green, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            whiteSpace: 'nowrap', boxSizing: 'border-box',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0 }}>
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            {t.filters}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', margin: '0 16px 8px', minHeight: 0 }}>
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

      {/* Boutons swipe */}
      <div style={{
        flexShrink: 0, height: 68,
        display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center',
      }}>
        {top && stack !== null && lastCard && lastDir === 'left' && (
          <CircBtn onClick={undo} color={COURT.gold} dark={dark}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 10h10a5 5 0 1 1 0 10H3" /><path d="M3 10l4-4M3 10l4 4" />
            </svg>
          </CircBtn>
        )}
        {top && stack !== null && (
          <>
            <CircBtn onClick={() => decide('left')} color={COURT.purple} dark={dark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </CircBtn>
            <CircBtn onClick={() => decide('right')} color={COURT.green} large dark={dark}>
              <PadelBall size={22} shadow={false} />
            </CircBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Search flow ────────────────────────────────────────────────────────────
function SearchFlow({ t, lang, dark, userLevel, onNavigateChat, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0 }) {
  const { profile } = useAuth();
  // Par défaut, on filtre automatiquement sur le pays de l'utilisateur.
  // L'isolation stricte est de toute façon garantie en amont (usePlayers).
  const userRegion = profile ? regionToCountry(profile) : 'any';
  const [showPrefs, setShowPrefs]   = useState(false);
  const [matchPlayer, setMatchPlayer] = useState(null);
  const [filters, setFilters] = useState({
    side: 'any', style: 'any', motivation: 'any', hand: 'any',
    region: userRegion, levelMin: 1, levelMax: 7, frequency: 0,
  });

  if (matchPlayer) {
    return (
      <MatchFlash
        player={matchPlayer} t={t} lang={lang} dark={dark}
        onProposeSlot={() => { setMatchPlayer(null); onNavigateChat?.(); }}
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
        isGuest={isGuest}
        onGuestAction={onGuestAction}
        onShowNotifs={onShowNotifs}
        notifCount={notifCount}
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
function HomeScreen({ t, lang, level, confidence, dark, detailPlayerId, setDetailPlayerId, isGuest, onGuestAction, onGoToProfile, onShowNotifs, notifCount = 0 }) {
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

  // ─── Évolution interactive ─────────────────────────────────────────
  const [evoPeriod, setEvoPeriod] = useState('all');
  const [touchIdx,  setTouchIdx]  = useState(null);
  const evoRef = useRef(null);

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
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
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

  const hasLevel = level != null;

  // ─── Évolution du niveau (reconstruit depuis les deltas ELO) ──────
  let allEvoPoints = [], allEvoDates = [];
  if (hasLevel && matchHistory.length >= 1) {
    // matchHistory est trié récent → ancien
    let running = level;
    const _pts = [running];
    const _dts = [new Date()]; // point actuel = aujourd'hui
    for (const m of matchHistory) {
      running = running - (m.delta || 0);
      running = Math.max(0, Math.min(7, running));
      _pts.push(running);
      _dts.push(m.date instanceof Date ? m.date : new Date(m.date));
    }
    _pts.reverse(); // ancien → récent
    _dts.reverse();
    allEvoPoints = _pts;
    allEvoDates  = _dts;
  }
  // Filtre par période sélectionnée
  const _evoNow = new Date();
  let evoPoints = allEvoPoints;
  let evoDates  = allEvoDates;
  if (evoPeriod !== 'all' && allEvoDates.length > 0) {
    const cutoff = new Date(_evoNow);
    if      (evoPeriod === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (evoPeriod === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (evoPeriod === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (evoPeriod === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    const si = allEvoDates.findIndex(d => d >= cutoff);
    if (si !== -1) { evoPoints = allEvoPoints.slice(si); evoDates = allEvoDates.slice(si); }
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
        <div style={{ fontFamily: 'Pinyon Script, cursive', fontSize: 32, color: COURT.green, lineHeight: 1 }}>Padel Meet</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Cloche notifications */}
          <button onClick={onShowNotifs} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Mulish', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, animation: 'notifPop 0.4s ease' }}>{notifCount}</div>
            )}
          </button>
          <button onClick={() => { setSearchMode(m => !m); setSearchQuery(''); }} style={{
            width: 36, height: 36, borderRadius: 18,
            // En mode "X" (searchMode=true) on force un vert vif en dark pour assurer le contraste de l'icône
            background: searchMode
              ? (dark ? COURT.greenLight : COURT.green)
              : (dark ? COURT.darkCard : COURT.cream),
            border: `0.5px solid ${searchMode ? (dark ? COURT.greenLight : COURT.green) : COURT.green}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: searchMode ? '#FFFFFF' : COURT.green,
          }}>
            {searchMode
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            }
          </button>
          <button
            onClick={onGoToProfile}
            aria-label="Mon profil"
            style={{
              width: 36, height: 36, borderRadius: 18, padding: 2,
              border: `0.5px solid ${COURT.green}`,
              background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `url(${userPhoto}) center/cover` }} />
          </button>
        </div>
      </div>

      {searchMode && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.searchPlayer} autoFocus
              style={{
                width: '100%', padding: '12px 40px 12px 16px', boxSizing: 'border-box',
                background: dark ? COURT.darkCard : COURT.cream,
                border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
                borderRadius: 10, fontFamily: 'Spectral, serif', fontStyle: 'italic',
                fontSize: 15, color: ink, outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear"
                style={{
                  position: 'absolute', top: '50%', [rtl ? 'left' : 'right']: 10,
                  transform: 'translateY(-50%)',
                  width: 22, height: 22, borderRadius: 11,
                  background: dark ? COURT.darkBorder : `${COURT.green}25`,
                  border: 'none', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: dark ? COURT.darkText : COURT.green,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery.trim() && searchLoading && (
            <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>…</div>
          )}
          {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
            <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>{t.noPlayer}</div>
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
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: ink, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.1em' }}>
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
                fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13,
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
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: COURT.gold, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 6 }}>{t.currentLevel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: level != null ? 68 : 32, color: COURT.cream, fontWeight: 400, lineHeight: 1, animation: 'levelPop 0.8s cubic-bezier(.2,.9,.3,1.4)' }}>
                {level != null ? level.toFixed(1) : (t.levelNotEvaluated || 'Niveau non évalué')}
              </div>
              {level != null && <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, color: `${COURT.cream}90` }}>{t.outOf} 7.0</div>}
            </div>
            <div style={{ height: 0.5, background: `${COURT.cream}30`, margin: '16px 0 12px' }} />
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.matchesPlayed}</div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, color: COURT.cream }}>{userMatches}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.winRateLabel}</div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, color: COURT.cream }}>
                  {userWinrate != null ? `${userWinrate}%` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.confidence}</div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, color: COURT.cream }}>{confidence}%</div>
              </div>
            </div>
          </div>
        </div>



        {/* Évolution */}
        <div style={{ padding: '28px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionHeading style={{ marginBottom: 0 }}>{t.evolutionTitle}</SectionHeading>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['1Y', '1Y'], ['all', t.periodAll || 'Tout']].map(([key, lbl]) => (
                <button key={key} onClick={() => { setEvoPeriod(key); setTouchIdx(null); }} style={{
                  padding: '4px 7px', borderRadius: 6,
                  border: `0.5px solid ${evoPeriod === key ? COURT.green : (dark ? COURT.darkBorder : COURT.stone + '40')}`,
                  background: evoPeriod === key ? COURT.green : 'transparent',
                  color: evoPeriod === key ? '#fff' : stone,
                  fontFamily: 'Mulish', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '30'}`,
            borderRadius: 14, padding: '14px 12px 12px',
          }}>
            {evoPoints.length >= 2 ? (() => {
              const W = 300, H = 130;
              const padL = 26, padR = 8, padT = 10, padB = 22;
              const chartW = W - padL - padR;
              const chartH = H - padT - padB;
              const minY = 0, maxY = 7;
              const n = evoPoints.length;
              const xy = evoPoints.map((v, i) => {
                const x = padL + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
                const y = padT + chartH - ((v - minY) / (maxY - minY)) * chartH;
                return [x, y];
              });
              const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
              const areaPath = `${linePath} L ${xy[n-1][0].toFixed(1)} ${padT + chartH} L ${xy[0][0].toFixed(1)} ${padT + chartH} Z`;
              const yTicks = [0, 2, 4, 6, 7];
              const fmtDate = (d) => {
                if (!d) return '';
                const dd = d instanceof Date ? d : new Date(d);
                return dd.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' });
              };
              const xIdxs = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
              const handlePointer = (e) => {
                e.preventDefault();
                const svg = evoRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const svgX = ((clientX - rect.left) / rect.width) * W;
                let ci = 0, cd = Infinity;
                for (let i = 0; i < xy.length; i++) {
                  const d = Math.abs(xy[i][0] - svgX);
                  if (d < cd) { cd = d; ci = i; }
                }
                setTouchIdx(ci);
              };
              const cursor = touchIdx !== null ? xy[touchIdx] : null;
              const ttW = 90, ttH = 18;
              const ttX = cursor ? Math.min(Math.max(cursor[0] - ttW / 2, padL), W - padR - ttW) : 0;
              const ttY = cursor ? Math.max(cursor[1] - ttH - 8, padT) : 0;
              return (
                <svg ref={evoRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                  style={{ display: 'block', touchAction: 'none' }}
                  onTouchStart={handlePointer} onTouchMove={handlePointer} onTouchEnd={() => setTouchIdx(null)}
                  onMouseMove={handlePointer} onMouseLeave={() => setTouchIdx(null)}
                >
                  <defs>
                    <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COURT.green} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={COURT.green} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Y axis grid + labels */}
                  {yTicks.map(v => {
                    const yy = padT + chartH - ((v - minY) / (maxY - minY)) * chartH;
                    return (
                      <g key={v}>
                        <line x1={padL} y1={yy} x2={W - padR} y2={yy}
                          stroke={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} strokeWidth="0.5" />
                        <text x={padL - 4} y={yy + 3.5} textAnchor="end"
                          fontSize="7" fontFamily="Mulish" fill={stone}>{v}</text>
                      </g>
                    );
                  })}
                  {/* Area + line */}
                  <path d={areaPath} fill="url(#evoFill)" />
                  <path d={linePath} fill="none" stroke={COURT.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  {/* X axis date labels */}
                  {xIdxs.map((idx, li) => (
                    <text key={idx} x={xy[idx][0]} y={H - 4}
                      textAnchor={li === 0 ? 'start' : li === xIdxs.length - 1 ? 'end' : 'middle'}
                      fontSize="7" fontFamily="Mulish" fill={stone}>
                      {fmtDate(evoDates?.[idx])}
                    </text>
                  ))}
                  {/* Endpoint dot (no cursor) */}
                  {!cursor && (
                    <circle cx={xy[n-1][0]} cy={xy[n-1][1]} r="3.5"
                      fill={COURT.gold} stroke={dark ? COURT.darkCard : COURT.cream} strokeWidth="1.5" />
                  )}
                  {/* Interactive cursor */}
                  {cursor && (
                    <g>
                      <line x1={cursor[0]} y1={padT} x2={cursor[0]} y2={padT + chartH}
                        stroke={COURT.green} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
                      <circle cx={cursor[0]} cy={cursor[1]} r="4"
                        fill={COURT.gold} stroke={dark ? COURT.darkCard : COURT.cream} strokeWidth="1.5" />
                      <rect x={ttX} y={ttY} width={ttW} height={ttH} rx="3"
                        fill={dark ? COURT.darkCard : '#fff'} stroke={COURT.green + '60'} strokeWidth="0.5" />
                      <text x={ttX + ttW / 2} y={ttY + 11.5} textAnchor="middle"
                        fontSize="8.5" fontFamily="Mulish" fontWeight="600" fill={COURT.green}>
                        {`${evoPoints[touchIdx]?.toFixed(1)}  ·  ${fmtDate(evoDates?.[touchIdx])}`}
                      </text>
                    </g>
                  )}
                </svg>
              );
            })() : (
              <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '8px 0' }}>{t.noEvolutionYet}</div>
            )}
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
                  <div style={{ fontFamily: 'Mulish', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>{a.date[lang]}</div>
                  <div style={{ fontFamily: ff_serif, fontSize: 17, color: ink, fontWeight: 500 }}>{a.title[lang]}</div>
                  <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginTop: 2 }}>{a.sub[lang]}</div>
                  {a.scoreL && <div style={{ fontFamily: 'Spectral, serif', fontSize: 13, color: COURT.green, marginTop: 4, letterSpacing: '0.1em' }}>{a.scoreL} · {a.scoreR}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0 16px' }}>
          <Ornament width={80} />
          <div style={{ fontFamily: 'Pinyon Script, cursive', fontSize: 18, color: COURT.green, opacity: 0.5 }}>est. 2026</div>
        </div>
      </>}
    </div>
  );
}

// ─── Chat actif (messages temps réel) ──────────────────────────────────────
function ActiveChat({ matchId, player, onBack, onOpenDetail, t, lang, dark }) {
  const { user } = useAuth();
  const playerIsOnline = useOnline(player?.id);
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [sheet,           setSheet]           = useState(null); // 'proposal'|'score'|'eval'
  // Proposition de match
  const [propDate,        setPropDate]        = useState('');
  const [propTime,        setPropTime]        = useState('');
  const [propPlace,       setPropPlace]       = useState('');
  const [propSending,     setPropSending]     = useState(false);
  // Score — saisie par set (max 3)
  const [scoreResult,  setScoreResult]  = useState('win');
  // sets: [{ me: '', them: '' }, ...]
  const [sets,         setSets]         = useState([{ me: '', them: '' }]);
  const [scoreSending,  setScoreSending]  = useState(false);
  const [scoreError,    setScoreError]    = useState('');
  const [rejectingId,   setRejectingId]   = useState(null);
  const [confirmingId,  setConfirmingId]  = useState(null);
  const [actionError,   setActionError]   = useState('');
  // Calcule le texte de score à partir des sets
  const scoreText = sets
    .filter(s => s.me !== '' && s.them !== '')
    .map(s => `${s.me}-${s.them}`)
    .join(' ');
  // Évaluation — overlay quiz complet (même questionnaire qu'à l'onboarding)
  const [evalOpen,          setEvalOpen]          = useState(false);
  const [evalSending,       setEvalSending]       = useState(false);
  // Cooldown 30 jours — Date de prochaine éval disponible, ou null
  const [evalCooldownUntil, setEvalCooldownUntil] = useState(null);
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

  // Blocage par date : si une proposition acceptée est dans le futur, pas de score encore
  const latestAcceptedProposal = messages
    .filter(m => m.msgType === 'match_proposal' && m.metadata?.status === 'accepted')
    .sort((a, b) => new Date(b.metadata?.date || 0) - new Date(a.metadata?.date || 0))[0];
  const scoreDateBlocked = latestAcceptedProposal
    ? (() => {
        const { date, time } = latestAcceptedProposal.metadata || {};
        if (!date) return false;
        const matchDT = new Date(`${date}T${time || '23:59'}`);
        return matchDT > new Date();
      })()
    : false;
  const scoreLocked  = scoreStatus.locked;
  const scoreAttempt = scoreStatus.attempts; // nombre de rejets passés

  // Charge le statut au mount
  useEffect(() => { if (matchId) matchScoreStatus(matchId); }, [matchId]);

  // ── Cooldown éval 30 jours ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !player?.id) return;
    (async () => {
      const { data } = await supabase
        .from('peer_evaluations')
        .select('created_at')
        .eq('evaluator_id', user.id)
        .eq('evaluated_id', player.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.created_at) {
        const until = new Date(new Date(data.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
        setEvalCooldownUntil(until > new Date() ? until : null);
      } else {
        setEvalCooldownUntil(null);
      }
    })();
  }, [user?.id, player?.id]);

  // ── Chargement des messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId || !user) return;

    // Marque tous les messages reçus (sender != moi) comme lus dès l'ouverture.
    // Silencieux — ne bloque pas le chargement.
    const markAllRead = () =>
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .neq('sender_id', user.id)
        .is('read_at', null);

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data.map(msgToState(user.id)));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        // Marquer les messages non lus après avoir affiché la liste
        markAllRead();
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
          // Message entrant pendant que le chat est ouvert → marquer lu immédiatement
          if (m.sender_id !== user.id && !m.read_at) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', m.id);
          }
        })
      // Écoute aussi les UPDATE (réponses Accept/Decline ET accusés de lecture)
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

  // ── Validation score padel (règles tennis/padel) ───────────────────────────
  // Sets valides : 6-0…6-4, 7-5, 7-6 (et leurs inverses)
  const isValidPadelSet = (me, them) => {
    const a = parseInt(me, 10);
    const b = parseInt(them, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return false;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (hi > 7) return false;
    if (hi === 7) return lo === 5 || lo === 6; // 7-5 ou 7-6
    if (hi === 6) return lo <= 4;              // 6-0 à 6-4
    return false;
  };

  // ── Soumettre un score ──────────────────────────────────────────────────────
  const sendScore = async () => {
    // Valide chaque set rempli
    const filledSets = sets.filter(s => s.me !== '' || s.them !== '');
    if (filledSets.length === 0) {
      setScoreError(lang === 'en' ? 'Enter at least one set score' : lang === 'he' ? 'הזן לפחות סט אחד' : 'Entrez au moins un set');
      return;
    }
    const invalidSet = filledSets.find(s => !isValidPadelSet(s.me, s.them));
    if (invalidSet) {
      setScoreError(
        lang === 'en'
          ? 'Invalid score — padel sets: 6-0 to 6-4, 7-5 or 7-6'
          : lang === 'he'
          ? 'תוצאה לא חוקית — סטים בפאדל: 6-0 עד 6-4, 7-5 או 7-6'
          : 'Score invalide — un set au padel : 6-0 à 6-4, 7-5 ou 7-6'
      );
      return;
    }
    setScoreError('');
    setScoreSending(true);
    const res = await submitResult({ opponentId: player.id, result: scoreResult, score: scoreText });
    if (res.success) {
      await supabase.from('messages').insert({
        match_id: matchId, sender_id: user.id,
        content: `🎾 Score soumis : ${scoreText}`,
        msg_type: 'score_card',
        metadata: { pending_id: res.pendingId, score: scoreText, result: scoreResult },
      });
      setSets([{ me: '', them: '' }]); setScoreResult('win');
      setSheet(null);
    } else {
      setScoreError(res.error || (lang === 'he' ? 'שגיאה' : 'Erreur'));
    }
    setScoreSending(false);
  };

  // ── Confirmer un score → ouvre le quiz d'évaluation ────────────────────────
  const handleConfirm = async (pendingId) => {
    setConfirmingId(pendingId);
    setActionError('');
    const res = await confirmResult(pendingId);
    setConfirmingId(null);
    if (res.success) {
      setSheet(null);
      setEvalOpen(true);
    } else {
      setActionError(res.error || (lang === 'en' ? 'Error — try again' : lang === 'he' ? 'שגיאה — נסה שוב' : 'Erreur — réessaie'));
    }
  };

  // ── Refuser un score → notifie dans le chat + recharge les pending ────────────
  const handleReject = async (pendingId) => {
    setRejectingId(pendingId);
    setActionError('');
    const res = await rejectResult(pendingId);
    if (!res || res.success !== false) {
      // Message visible dans le fil pour informer les deux joueurs
      const rejLabel = lang === 'en' ? '❌ Score rejected — please submit a new score'
                     : lang === 'he' ? '❌ התוצאה נדחתה — אנא הגש תוצאה חדשה'
                     : '❌ Score refusé — veuillez soumettre un nouveau score';
      await supabase.from('messages').insert({
        match_id: matchId, sender_id: user.id,
        content: rejLabel, msg_type: 'text', metadata: {},
      });
    } else {
      setActionError(res.error || (lang === 'en' ? 'Error — try again' : lang === 'he' ? 'שגיאה — נסה שוב' : 'Erreur — réessaie'));
    }
    setRejectingId(null);
  };

  // ── Évaluation niveau — appelé après le quiz avec le niveau calculé ─────────
  const sendEval = async (computedLevel) => {
    setEvalSending(true);
    try {
      // On passe matchId (matches.id — le chat entre les deux joueurs),
      // pas match_history.id. La fonction vérifie que les deux joueurs
      // sont bien dans ce match avant d'appliquer le boost.
      const { error } = await supabase.rpc('submit_peer_evaluation', {
        p_match_id:       matchId,
        p_evaluated_id:   player.id,
        p_proposed_level: Math.round(computedLevel * 2) / 2,
      });
      if (error) {
        console.warn('[sendEval] RPC error:', error.message);
      } else {
        // Arme le cooldown côté client immédiatement (30 jours)
        setEvalCooldownUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      }
    } catch (err) {
      console.warn('[sendEval]', err);
    }
    setEvalSending(false);
    setEvalOpen(false);
  };

  // ── Score card dans le fil ──────────────────────────────────────────────────
  const renderScoreCard = (pending) => {
    if (!pending) return null;
    const isTeammate = pending.submitterResult === 'teammate';
    const isWin      = isTeammate || pending.myResult === 'win';
    const color      = isTeammate ? COURT.gold : (isWin ? COURT.green : COURT.purple);
    const label      = isTeammate ? (lang === 'en' ? '🤝 Teammates' : lang === 'he' ? '🤝 שותפים' : '🤝 Coéquipiers')
                     : isWin      ? (lang === 'en' ? 'Victory'      : lang === 'he' ? 'ניצחון'    : 'Victoire')
                                  : (lang === 'en' ? 'Defeat'       : lang === 'he' ? 'הפסד'      : 'Défaite');
    const attemptNum = scoreAttempt + 1; // tentative en cours (1-based)
    const remaining  = 3 - scoreAttempt;
    return (
      <div style={{ margin: '4px 0', background: card, border: `1px solid ${color}40`, borderRadius: 14, padding: '12px 14px', width: '100%' }}>
        {/* Header avec numéro de tentative */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 9, color, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            🎾 {pending.isSubmitter ? (lang === 'en' ? 'Score submitted' : lang === 'he' ? 'תוצאה הוגשה' : 'Score soumis') : (lang === 'en' ? 'Score to confirm' : lang === 'he' ? 'תוצאה לאישור' : 'Score à confirmer')}
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, background: dark ? '#2a2a2a' : '#e8e4da', borderRadius: 999, padding: '2px 8px' }}>
            {attemptNum}/3
          </div>
        </div>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 24, color, letterSpacing: '0.06em', marginBottom: 4 }}>{pending.score}</div>
        <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13, color: stone, marginBottom: pending.isSubmitter ? 0 : 10 }}>
          {label} · {pending.isSubmitter
            ? (lang === 'en' ? 'Awaiting confirmation…' : lang === 'he' ? 'ממתין לאישור…' : 'En attente de confirmation…')
            : (lang === 'en' ? `${player?.name} asks you to confirm` : lang === 'he' ? `${player?.name} מבקש את אישורך` : `${player?.name} demande votre confirmation`)}
        </div>
        {!pending.isSubmitter && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button
                onClick={() => handleConfirm(pending.id)}
                disabled={confirmingId === pending.id || rejectingId === pending.id}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  background: confirmingId === pending.id ? `${COURT.green}80` : COURT.green,
                  border: 'none', color: COURT.cream,
                  fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  opacity: (rejectingId === pending.id) ? 0.4 : 1,
                }}>
                {confirmingId === pending.id ? '…' : (lang === 'en' ? '✓ Confirm' : lang === 'he' ? '✓ אשר' : '✓ Confirmer')}
              </button>
              <button
                onClick={() => handleReject(pending.id)}
                disabled={rejectingId === pending.id || confirmingId === pending.id}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  background: COURT.purple + '15', border: `0.5px solid ${COURT.purple}`,
                  color: COURT.purple, fontFamily: 'Mulish', fontSize: 13,
                  cursor: rejectingId === pending.id ? 'not-allowed' : 'pointer',
                  opacity: (rejectingId === pending.id || confirmingId === pending.id) ? 0.5 : 1,
                }}>
                {rejectingId === pending.id ? '…' : (lang === 'en' ? '✗ Reject' : lang === 'he' ? '✗ דחה' : '✗ Refuser')}
              </button>
            </div>
            {actionError && (
              <div style={{ fontFamily: 'Mulish', fontSize: 11, color: COURT.purple, textAlign: 'center', marginBottom: 4 }}>
                ⚠️ {actionError}
              </div>
            )}
            {remaining > 1 && (
              <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, textAlign: 'center' }}>
                {lang === 'en' ? `${remaining - 1} attempt(s) left after rejection` : lang === 'he' ? `${remaining - 1} ניסיון נוסף אחרי דחייה` : `${remaining - 1} tentative(s) restante(s) si refus`}
              </div>
            )}
            {remaining === 1 && (
              <div style={{ fontFamily: 'Mulish', fontSize: 10, color: COURT.purple, textAlign: 'center', fontWeight: 500 }}>
                ⚠️ {lang === 'en' ? 'Last attempt — reject = match unrecorded' : lang === 'he' ? 'ניסיון אחרון — דחייה = המשחק לא יירשם' : 'Dernière tentative — refus = match inenregistrable'}
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
      <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: COURT.purple, fontStyle: 'italic', marginBottom: 4 }}>
        {lang === 'en' ? 'Match unrecordable' : lang === 'he' ? 'לא ניתן לרשום את המשחק' : 'Match inenregistrable'}
      </div>
      <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13, color: stone }}>
        {lang === 'en' ? '3 consecutive rejections — no score can be submitted for this match.' : lang === 'he' ? '3 דחיות רצופות — לא ניתן להגיש תוצאה למשחק זה.' : '3 désaccords consécutifs — aucun score ne peut être enregistré pour ce match.'}
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
        {/* Avatar + name → tap to open detailed profile */}
        <div
          onClick={() => { if (player?.id && onOpenDetail) onOpenDetail(player.id); }}
          role={onOpenDetail ? 'button' : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
            cursor: onOpenDetail && player?.id ? 'pointer' : 'default',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 19, background: `url(${player?.photo}) center/cover`, flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, background: playerIsOnline ? '#4CAF50' : stone, border: `1.5px solid ${bg}` }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 18, color: ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player?.name}</div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: playerIsOnline ? '#4CAF50' : stone, letterSpacing: '0.12em' }}>
              {formatPresence(playerIsOnline, player?.lastSeen, lang)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Barre d'actions rapides ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: `0.5px solid ${border}`, background: dark ? '#1a1f1a' : '#F7F4EE', overflowX: 'auto' }}>
        {[
          { key: 'proposal', icon: '📅', label: lang === 'en' ? 'Plan match' : lang === 'he' ? 'הצע משחק' : 'Proposer' },
          { key: 'score',    icon: '🎾', label: lang === 'en' ? 'Enter score' : lang === 'he' ? 'הזן תוצאה' : 'Score', disabled: scoreLocked || pendingForMatch.length > 0 },
          (() => {
            if (evalCooldownUntil) {
              const fmtD = evalCooldownUntil.toLocaleDateString(
                lang === 'he' ? 'he-IL' : lang === 'en' ? 'en-US' : 'fr-FR',
                { day: 'numeric', month: 'short' }
              );
              const cooldownLabel = lang === 'en' ? `From ${fmtD}` : lang === 'he' ? `זמין ב-${fmtD}` : `Dispo le ${fmtD}`;
              return { key: 'eval', icon: '⭐', label: cooldownLabel, disabled: true };
            }
            return { key: 'eval', icon: '⭐', label: lang === 'en' ? 'Rate player' : lang === 'he' ? 'דרג שחקן' : 'Évaluer' };
          })(),
        ].map(({ key, icon, label, disabled }) => (
          <button key={key}
            onClick={() => {
              if (disabled) return;
              if (key === 'eval') { setSheet(null); setEvalOpen(true); return; }
              setSheet(sheet === key ? null : key);
            }}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '6px 12px', borderRadius: 999,
              background: sheet === key ? COURT.green : 'transparent',
              border: `0.5px solid ${disabled ? stone : sheet === key ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '50')}`,
              color: disabled ? stone : sheet === key ? COURT.cream : COURT.green,
              fontFamily: 'Mulish', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.45 : 1,
            }}>
            <span style={{ fontSize: 14 }}>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* ── Sheet Proposer un match ─────────────────────────────────────────── */}
      {sheet === 'proposal' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: ink, fontStyle: 'italic' }}>
            {lang === 'en' ? 'Propose a match' : lang === 'he' ? 'הצע משחק' : 'Proposer un match'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={propDate} onChange={e => setPropDate(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Mulish', fontSize: 13, outline: 'none' }} />
            <input type="time" value={propTime} onChange={e => setPropTime(e.target.value)}
              style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Mulish', fontSize: 13, outline: 'none' }} />
          </div>
          <input placeholder={lang === 'en' ? 'Court / location (optional)' : lang === 'he' ? 'מגרש / מיקום (אופציונלי)' : 'Club / terrain (optionnel)'}
            value={propPlace} onChange={e => setPropPlace(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14, outline: 'none' }} />
          <button onClick={sendProposal} disabled={propSending || !propDate || !propTime} style={{
            padding: '10px', borderRadius: 10, background: COURT.green, border: 'none',
            color: COURT.cream, fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer', opacity: (!propDate || !propTime) ? 0.4 : 1,
          }}>
            {propSending ? '…' : (lang === 'en' ? 'Send proposal' : lang === 'he' ? 'שלח הצעה' : 'Envoyer la proposition')}
          </button>
        </div>
      )}

      {/* ── Sheet Entrer un score ───────────────────────────────────────────── */}
      {sheet === 'score' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: ink, fontStyle: 'italic' }}>
            {lang === 'en' ? 'Submit a score' : lang === 'he' ? 'הגש תוצאה' : 'Soumettre un score'}
          </div>

          {/* Avertissement date : match pas encore joué */}
          {scoreDateBlocked && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: `${COURT.gold}18`, border: `0.5px solid ${COURT.gold}60`, borderRadius: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13, color: ink }}>
                {lang === 'en'
                  ? `Match scheduled for ${latestAcceptedProposal?.metadata?.date} — submit the score after the match.`
                  : lang === 'he'
                  ? `משחק מתוכנן ל-${latestAcceptedProposal?.metadata?.date} — הגש את התוצאה לאחר המשחק.`
                  : `Match prévu le ${latestAcceptedProposal?.metadata?.date} — soumettez le score après le match.`}
              </div>
            </div>
          )}

          {/* Résultat — Victoire / Coéquipier / Défaite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['win', 'loss'].map(r => (
                <button key={r} onClick={() => setScoreResult(r)} style={{
                  flex: 1, padding: '8px', borderRadius: 8,
                  background: scoreResult === r ? (r === 'win' ? COURT.green : COURT.red) : 'transparent',
                  border: `0.5px solid ${r === 'win' ? COURT.green : COURT.red}`,
                  color: scoreResult === r ? COURT.cream : (r === 'win' ? COURT.green : COURT.red),
                  fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer',
                }}>
                  {r === 'win' ? (lang === 'en' ? 'Victory 🏆' : lang === 'he' ? 'ניצחון 🏆' : 'Victoire 🏆') : (lang === 'en' ? 'Defeat' : lang === 'he' ? 'הפסד' : 'Défaite')}
                </button>
              ))}
            </div>
            {/* Mode coéquipier — les deux ont gagné */}
            <button onClick={() => setScoreResult('teammate')} style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: scoreResult === 'teammate' ? `${COURT.gold}25` : 'transparent',
              border: `0.5px solid ${COURT.gold}`,
              color: scoreResult === 'teammate' ? COURT.ink : COURT.gold,
              fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer', textAlign: 'left',
            }}>
              {lang === 'en' ? '🤝 Teammate — we both won' : lang === 'he' ? '🤝 שותף — שנינו ניצחנו' : '🤝 Coéquipier — on a tous les deux gagné'}
            </button>
          </div>

          {/* Saisie par set */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              {lang === 'en' ? 'Sets' : 'Sets'}
            </div>
            {sets.map((s, i) => {
              const myG = parseInt(s.me, 10);
              const thG = parseInt(s.them, 10);
              const setWon  = !isNaN(myG) && !isNaN(thG) && myG > thG;
              const setLost = !isNaN(myG) && !isNaN(thG) && myG < thG;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Numéro set */}
                  <div style={{ fontFamily: 'Spectral, serif', fontSize: 13, color: stone, minWidth: 40 }}>
                    Set {i + 1}
                  </div>
                  {/* Mon score */}
                  <input
                    type="number" min="0" max="7" inputMode="numeric"
                    placeholder={lang === 'he' ? 'אני' : lang === 'en' ? 'Me' : 'Moi'}
                    value={s.me}
                    onChange={e => setSets(prev => prev.map((x, j) => j === i ? { ...x, me: e.target.value } : x))}
                    style={{
                      width: 54, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                      border: `0.5px solid ${setWon ? COURT.green : setLost ? COURT.purple : border}`,
                      background: setWon ? `${COURT.green}15` : setLost ? `${COURT.purple}12` : bg,
                      color: ink, fontFamily: 'Spectral, serif', fontSize: 16,
                      outline: 'none', letterSpacing: '0.04em',
                    }}
                  />
                  <span style={{ color: stone, fontFamily: 'Spectral, serif', fontSize: 18 }}>—</span>
                  {/* Score adverse */}
                  <input
                    type="number" min="0" max="7" inputMode="numeric"
                    placeholder={lang === 'he' ? 'הם' : lang === 'en' ? 'Them' : 'Eux'}
                    value={s.them}
                    onChange={e => setSets(prev => prev.map((x, j) => j === i ? { ...x, them: e.target.value } : x))}
                    style={{
                      width: 54, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                      border: `0.5px solid ${setLost ? COURT.purple : setWon ? COURT.green : border}`,
                      background: setLost ? `${COURT.purple}12` : setWon ? `${COURT.green}15` : bg,
                      color: ink, fontFamily: 'Spectral, serif', fontSize: 16,
                      outline: 'none', letterSpacing: '0.04em',
                    }}
                  />
                  {/* Indicateur visuel */}
                  <div style={{ width: 22, textAlign: 'center', fontSize: 14 }}>
                    {setWon ? '✅' : setLost ? '❌' : ''}
                  </div>
                  {/* Supprimer set (seulement si > 1 set) */}
                  {sets.length > 1 && (
                    <button onClick={() => setSets(prev => prev.filter((_, j) => j !== i))} style={{
                      width: 24, height: 24, borderRadius: 12, border: `0.5px solid ${border}`,
                      background: 'transparent', color: stone, cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>×</button>
                  )}
                </div>
              );
            })}
            {/* Bouton + ajouter un set (max 3) */}
            {sets.length < 3 && (
              <button onClick={() => setSets(prev => [...prev, { me: '', them: '' }])} style={{
                alignSelf: 'flex-start', padding: '7px 14px', borderRadius: 20,
                border: `0.5px solid ${COURT.green}`, background: 'transparent',
                color: COURT.green, fontFamily: 'Mulish', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                {lang === 'en' ? 'Add a set' : lang === 'he' ? 'הוסף סט' : 'Ajouter un set'}
              </button>
            )}
          </div>
          {scoreError && <div style={{ fontFamily: 'Mulish', fontSize: 11, color: COURT.purple }}>{scoreError}</div>}
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 12, color: stone }}>
            {lang === 'en' ? `${player?.name} will need to confirm the score.` : lang === 'he' ? `${player?.name} יצטרך לאשר את התוצאה.` : `${player?.name} devra confirmer le score. Anti-spam activé.`}
          </div>
          <button onClick={sendScore} disabled={scoreSending || !scoreText.trim() || scoreDateBlocked} style={{
            padding: '10px', borderRadius: 10, background: COURT.green, border: 'none',
            color: COURT.cream, fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer',
            opacity: (!scoreText.trim() || scoreDateBlocked) ? 0.4 : 1,
          }}>
            {scoreSending ? '…' : (lang === 'en' ? 'Submit score' : lang === 'he' ? 'הגש תוצאה' : 'Soumettre le score')}
          </button>
          {/* Reset des sets quand on ferme le sheet */}
        </div>
      )}

      {/* ── Sheet Évaluer : le bouton ⭐ ouvre le quiz complet (overlay) ─────── */}
      {/* (le quiz est rendu en overlay en bas du composant) */}

      {/* ── Fil de messages ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    <div style={{ fontFamily: 'Mulish', fontSize: 9, color: accentColor, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                      📅 {lang === 'en' ? 'Match proposal' : lang === 'he' ? 'הצעת משחק' : 'Proposition de match'}
                    </div>
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, color: ink, fontWeight: 500 }}>
                      {m.metadata?.date} {lang === 'en' ? 'at' : lang === 'he' ? 'ב' : 'à'} {m.metadata?.time}
                    </div>
                    {m.metadata?.place && (
                      <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13, color: stone, marginTop: 2 }}>📍 {m.metadata.place}</div>
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
                            fontFamily: 'Mulish', fontSize: 12, fontWeight: 500, cursor: 'pointer',
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
                            fontFamily: 'Mulish', fontSize: 12, cursor: 'pointer',
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
                        fontFamily: 'Mulish', fontSize: 11, color: COURT.green, fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✓ {lang === 'en' ? 'Match accepted' : lang === 'he' ? 'משחק אושר' : 'Match accepté'}
                      </div>
                    )}
                    {status === 'declined' && (
                      <div style={{
                        marginTop: 10, padding: '6px 10px',
                        background: `${COURT.purple}15`, borderRadius: 8,
                        fontFamily: 'Mulish', fontSize: 11, color: COURT.purple,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✗ {lang === 'en' ? 'Match declined' : lang === 'he' ? 'משחק נדחה' : 'Match refusé'}
                      </div>
                    )}

                    <div style={{ fontFamily: 'Mulish', fontSize: 9, color: stone, marginTop: 6, textAlign: 'right' }}>{m.time}</div>
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
                fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}>
                {m.text[lang] || m.text.fr}
                {/* Ligne heure + accusé de lecture (messages envoyés uniquement) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 }}>
                  <span style={{ fontFamily: 'Mulish', fontSize: 9, color: m.from === 'me' ? `${COURT.cream}70` : stone }}>{m.time}</span>
                  {m.from === 'me' && <ReadReceipt read={!!m.readAt} />}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Bannière score en attente de confirmation ───────────────────────── */}
      {/* Pincée au-dessus de l'input pour être toujours tappable sur mobile.   */}
      {/* Carte verrouillée (3 rejets) */}
      {scoreLocked && (
        <div style={{ borderTop: `0.5px solid ${COURT.purple}30`, background: card, padding: '8px 14px' }}>
          {renderLockedCard()}
        </div>
      )}
      {/* Carte à confirmer / en attente */}
      {!scoreLocked && pendingForMatch.length > 0 && (
        <div style={{ borderTop: `1px solid ${border}`, background: card, padding: '10px 14px' }}>
          {pendingForMatch.map(p => (
            <div key={p.id}>{renderScoreCard(p)}</div>
          ))}
        </div>
      )}

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
            fontFamily: 'Spectral, serif', fontStyle: 'italic',
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

      {/* ── Overlay quiz évaluation du niveau ──────────────────────────────── */}
      {evalOpen && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: dark ? COURT.darkBg : COURT.cream,
        }}>
          {/* Bandeau intro */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            paddingTop: 'max(52px, env(safe-area-inset-top, 0px))',
            padding: `max(52px, env(safe-area-inset-top, 0px)) 16px 8px`,
            background: dark ? COURT.darkBg : COURT.cream,
            borderBottom: `0.5px solid ${border}`,
            zIndex: 201, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <button onClick={() => setEvalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COURT.green, padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500 }}>
                {lang === 'en' ? `Evaluate ${player?.name}` : lang === 'he' ? `העריך את ${player?.name}` : `Évaluer ${player?.name}`}
              </div>
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 12, color: dark ? COURT.darkMuted : COURT.stone }}>
                {lang === 'en' ? 'Answer as if rating their level' : lang === 'he' ? 'ענה לפי הרמה שלו/ה' : 'Répondez en pensant à son niveau'}
              </div>
            </div>
          </div>
          <QuizScreen
            t={t} lang={lang} dark={dark}
            playerFirstName={player?.name?.split(' ')[0] || ''}
            onDone={(computedLevel) => sendEval(computedLevel)}
            onBack={() => setEvalOpen(false)}
          />
          {/* Spinner pendant l'envoi */}
          {evalSending && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `3px solid ${COURT.green}30`, borderTopColor: COURT.green,
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          )}
        </div>
      )}
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
    readAt:   m.read_at || null,   // null = non lu, string ISO = lu
  });
}

// ── Accusé de lecture style WhatsApp ─────────────────────────────────────────
// Deux coches côte-à-côte : grises = envoyé/non lu, bleues = lu.
// Affiché uniquement sur les bulles envoyées par moi (from === 'me').
function ReadReceipt({ read }) {
  // #53BDEB = bleu WhatsApp, rgba blanc semi-transparent pour "non lu"
  const color = read ? '#53BDEB' : 'rgba(255,255,255,0.55)';
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}>
      {/* Première coche */}
      <polyline points="1,6 4,9 9,2.5"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Deuxième coche (décalée à droite, légèrement chevauchante) */}
      <polyline points="5,6 8,9 13,2.5"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Chat Screen ─────────────────────────────────────────────────────────────
function ChatScreen({ t, lang, dark, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0 }) {
  const { matches, loading: matchesLoading } = useUserMatches();
  const [activeMatch, setActiveMatch] = useState(null); // { matchId, player }
  const rtl   = lang === 'he';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  // Invité → écran d'invitation à créer un compte
  if (isGuest) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 32px 100px' }}>
        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>💬</div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: ink, fontStyle: 'italic', fontWeight: 500, marginBottom: 10 }}>
            {lang === 'en' ? 'Your matches, your chats' : lang === 'he' ? 'ההתאמות שלך, הצ׳אטים שלך' : 'Tes matchs, tes conversations'}
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, lineHeight: 1.6, marginBottom: 28 }}>
            {lang === 'en'
              ? 'Create an account to match with players and chat with them.'
              : lang === 'he'
              ? 'צור חשבון כדי להתאים ולשוחח עם שחקנים.'
              : 'Crée un compte pour matcher avec des joueurs et leur envoyer des messages.'}
          </div>
          <button onClick={onGuestAction} style={{
            padding: '14px 28px', borderRadius: 12,
            background: COURT.green, color: COURT.cream,
            border: `0.5px solid ${COURT.gold}50`, cursor: 'pointer',
            fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 16,
          }}>
            {lang === 'en' ? 'Join the club' : lang === 'he' ? 'הצטרף למועדון' : 'Rejoindre le club'}
          </button>
        </div>
      </div>
    );
  }

  if (activeMatch) {
    return (
      <ErrorBoundary key={activeMatch.matchId} onReset={() => setActiveMatch(null)}>
        <ActiveChat
          matchId={activeMatch.matchId}
          player={activeMatch.player}
          onBack={() => setActiveMatch(null)}
          onOpenDetail={onOpenDetail}
          t={t} lang={lang} dark={dark}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 20px' }}>
        <div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 28, color: ink, fontStyle: 'italic', fontWeight: 500 }}>{t.chat}</div>
        </div>
        <button onClick={onShowNotifs} style={{
          position: 'relative', width: 36, height: 36, borderRadius: 18,
          background: dark ? COURT.darkCard : COURT.cream,
          border: `0.5px solid ${border}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: dark ? COURT.darkText : COURT.green,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifCount > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Mulish', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, animation: 'notifPop 0.4s ease' }}>{notifCount}</div>
          )}
        </button>
      </div>

      {matchesLoading || matches === null ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone }}>
          <div style={{ width: 24, height: 24, margin: '0 auto', borderRadius: '50%', border: `2px solid ${COURT.green}30`, borderTopColor: COURT.green, animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone, fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15 }}>{t.noChats}</div>
      ) : matches.map((m, i) => (
        <ChatListRow
          key={m.matchId}
          match={m}
          index={i}
          ink={ink} stone={stone} border={border} bg={bg} lang={lang}
          onOpen={() => setActiveMatch({ matchId: m.matchId, player: m.player })}
        />
      ))}
    </div>
  );
}

// ─── Une ligne de conversation — abonnée individuellement à la présence ──────
// Hook au niveau de la ligne (pas dans le .map) pour respecter les rules of hooks
// et permettre une mise à jour réactive du point vert sans re-render global.
function ChatListRow({ match, index, ink, stone, border, bg, lang, onOpen }) {
  const { player, lastMessage, unreadCount = 0 } = match;
  const isOnline = useOnline(player?.id);
  const hasUnread = unreadCount > 0;
  return (
    <div onClick={onOpen} style={{
      padding: '14px 24px', borderBottom: `0.5px solid ${border}`,
      display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer',
      animation: `cardIn 0.4s ease ${index * 0.06}s both`,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: `url(${player.photo}) center/cover`, border: `0.5px solid ${border}` }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, background: isOnline ? '#4CAF50' : stone, border: `1.5px solid ${bg}` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'Spectral, serif',
            fontSize: 17,
            color: ink,
            fontWeight: hasUnread ? 700 : 500,
          }}>{player.name}</div>
          {lastMessage && (
            <div style={{
              fontFamily: 'Mulish',
              fontSize: 10,
              color: hasUnread ? COURT.green : stone,
              fontWeight: hasUnread ? 700 : 400,
            }}>{lastMessage.time}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {lastMessage ? (
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: 'Spectral, serif',
              fontStyle: 'italic',
              fontSize: 13,
              color: hasUnread ? ink : stone,
              fontWeight: hasUnread ? 700 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {lastMessage.from === 'me' ? '→ ' : ''}{lastMessage.text[lang] || lastMessage.text.fr}
            </div>
          ) : (
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.12em',
            }}>
              {formatPresence(isOnline, player?.lastSeen, lang)}
            </div>
          )}
          {hasUnread && (
            <div style={{
              flexShrink: 0,
              minWidth: 20, height: 20, padding: unreadCount > 9 ? '0 6px' : 0,
              borderRadius: 10,
              background: COURT.green,
              color: COURT.cream,
              fontFamily: 'Mulish, sans-serif',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 1px 4px ${COURT.green}55`,
            }}>{unreadCount > 99 ? '99+' : unreadCount}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Matches / Stats Screen ──────────────────────────────────────────────────
function MatchesScreen({ t, lang, level, dark, onShowNotifs, notifCount = 0, onSchedule }) {
  const { profile } = useAuth();
  const history = useMatchHistory();
  const { stats } = usePlayerStats();
  const { matches: myMatches } = useUserMatches();
  const [tab, setTab] = useState('history');
  const [trophyTip, setTrophyTip] = useState(null);
  const [showAllOpponents, setShowAllOpponents] = useState(false);
  const rtl   = lang === 'he';
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
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

  // ─── Trophées ─────────────────────────────────────────────────────
  let longestStreak = 0, _runStreak = 0;
  for (const m of history) {
    if (m.result === 'win') { _runStreak += 1; longestStreak = Math.max(longestStreak, _runStreak); }
    else _runStreak = 0;
  }
  const hasLevel = level != null;
  const trophies = [
    { key: 'first',  label: t.trophyFirstMatch, unlocked: userMatches >= 1 },
    { key: 'streak', label: t.trophyStreak5,     unlocked: longestStreak >= 5 },
    { key: 'ten',    label: t.trophyTenMatches,  unlocked: userMatches >= 10 },
    { key: 'level5', label: t.trophyLevel5,      unlocked: hasLevel && level >= 5 },
  ];

  const tabs = [
    { id: 'history', label: t.history },
    { id: 'stats',   label: t.statsTitle },
  ];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
        <div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
          <div style={{ fontFamily: ff_serif, fontSize: 28, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500 }}>{t.matches}</div>
        </div>
        <button onClick={onShowNotifs} style={{
          position: 'relative', width: 36, height: 36, borderRadius: 18,
          background: dark ? COURT.darkCard : COURT.cream,
          border: `0.5px solid ${border}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: dark ? COURT.darkText : COURT.green,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifCount > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Mulish', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, animation: 'notifPop 0.4s ease' }}>{notifCount}</div>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', margin: '0 24px 20px', background: dark ? COURT.darkCard : COURT.creamDark, borderRadius: 10, padding: 4 }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === tb.id ? COURT.green : 'transparent',
            color: tab === tb.id ? COURT.cream : stone,
            fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14,
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
                  <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {m.date instanceof Date ? m.date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-GB') : ''}
                  </div>
                  {/* Sets colorés : vert = set gagné, rouge = set perdu */}
                  {m.score && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {m.score.split(' ').map((setStr, si) => {
                        const [myG, thG] = setStr.split('-').map(Number);
                        const won  = !isNaN(myG) && !isNaN(thG) && myG > thG;
                        const lost = !isNaN(myG) && !isNaN(thG) && myG < thG;
                        return (
                          <span key={si} style={{
                            fontFamily: 'Spectral, serif', fontSize: 13,
                            padding: '2px 7px', borderRadius: 5,
                            background: won ? `${COURT.green}20` : lost ? `${COURT.purple}18` : `${COURT.stone}15`,
                            color: won ? COURT.green : lost ? COURT.purple : stone,
                            border: `0.5px solid ${won ? COURT.green + '50' : lost ? COURT.purple + '50' : stone + '30'}`,
                          }}>{setStr}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Barre résumé victoires/défaites */}
          {history.length > 0 && (
            <div style={{ borderTop: `0.5px solid ${border}`, paddingTop: 20, marginTop: 8 }}>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                {history.map((m, i) => (
                  <div key={i} style={{ flex: 1, background: m.result === 'win' ? COURT.green : COURT.purple, borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 10, color: COURT.green }}>{wins} {t.winRateLabel?.toLowerCase()}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 10, color: COURT.purple }}>{history.length - wins} {lang === 'he' ? 'הפסדים' : lang === 'en' ? 'losses' : 'défaites'}</div>
              </div>
            </div>
          )}

          {/* ════ JOUE CONTRE EUX ════ */}
          {myMatches && myMatches.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 6 }}>
                {lang === 'fr' ? 'Joue contre eux' : lang === 'he' ? 'שחק נגדם' : 'Play against them'}
              </div>
              {(showAllOpponents ? myMatches : myMatches.slice(0, 4)).map((m, i, arr) => (
                <div key={m.matchId} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0',
                  borderBottom: i < arr.length - 1 ? `0.5px solid ${border}` : 'none',
                  animation: `cardIn 0.4s ease ${i * 0.06}s both`,
                }}>
                  <div style={{ width: 52, height: 52, borderRadius: 26, background: `url(${m.player.photo}) center/cover`, flexShrink: 0, border: `0.5px solid ${border}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: ff_serif, fontSize: 21, color: ink, fontWeight: 500 }}>{m.player.name}</div>
                    {(m.player.level != null || m.player.winrate != null) && (
                      <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 2 }}>
                        {m.player.level != null && `${lang === 'fr' ? 'Niveau' : lang === 'he' ? 'רמה' : 'Level'} ${m.player.level.toFixed(1)}`}
                        {m.player.level != null && m.player.winrate != null && ' · '}
                        {m.player.winrate != null && `${m.player.winrate}% ${lang === 'fr' ? 'victoires' : lang === 'he' ? 'נצחונות' : 'wins'}`}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onSchedule?.(m.player.id)} style={{
                    padding: '10px 22px', borderRadius: 12, flexShrink: 0,
                    background: 'transparent', border: `0.5px solid ${COURT.green}50`,
                    fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, color: COURT.green,
                    cursor: 'pointer',
                  }}>
                    {lang === 'fr' ? 'Défier' : lang === 'he' ? 'אתגר' : 'Challenge'}
                  </button>
                </div>
              ))}

              {/* Voir plus / Voir moins */}
              {myMatches.length > 4 && (
                <button
                  onClick={() => setShowAllOpponents(v => !v)}
                  style={{
                    display: 'block', width: '100%', marginTop: 10,
                    padding: '11px 0', borderRadius: 12,
                    background: 'transparent',
                    border: `0.5px solid ${COURT.green}40`,
                    fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
                    fontSize: 15, color: COURT.green, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {showAllOpponents
                    ? (lang === 'fr' ? 'Voir moins' : lang === 'he' ? 'פחות' : 'Show less')
                    : (lang === 'fr' ? `Voir plus (${myMatches.length - 4})` : lang === 'he' ? `עוד (${myMatches.length - 4})` : `Show more (${myMatches.length - 4})`)
                  }
                </button>
              )}
            </div>
          )}

          {/* ════ PROCHAIN MATCH ════ */}
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 12 }}>
              {lang === 'fr' ? 'Prochain match' : lang === 'he' ? 'המשחק הבא' : 'Next match'}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 16,
              background: card, border: `0.5px solid ${border}`, borderRadius: 16,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 26, flexShrink: 0,
                background: dark ? COURT.darkBg : COURT.creamDark,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: ff_serif, fontSize: 24, color: stone,
              }}>?</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 19, color: ink }}>
                  {lang === 'fr' ? 'Aucun match prévu' : lang === 'he' ? 'אין משחק מתוכנן' : 'No match scheduled'}
                </div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 2 }}>
                  {lang === 'fr' ? 'Planifie ton prochain défi' : lang === 'he' ? 'תכנן את האתגר הבא שלך' : 'Plan your next challenge'}
                </div>
              </div>
              <button onClick={() => onSchedule?.()} style={{
                padding: '12px 22px', borderRadius: 12, flexShrink: 0,
                background: COURT.green, border: `0.5px solid ${COURT.gold}`,
                fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, color: COURT.cream,
                cursor: 'pointer',
              }}>
                {lang === 'fr' ? 'Planifier' : lang === 'he' ? 'תזמן' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <>
          <StatsSection />
          {/* ── Trophées en bas de page ── */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 12, padding: '16px 16px 20px' }}>
              <div style={{ fontFamily: 'Mulish', fontSize: 9, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 16 }}>{t.trophiesTitle || 'Trophées'}</div>
              <Achievements dark={dark} badges={[
                {
                  icon: '🎾', label: trophies[0].label, on: trophies[0].unlocked,
                  desc: lang === 'fr' ? 'Joue ton 1er match pour débloquer ce trophée' : lang === 'en' ? 'Play your first match to unlock' : 'שחק את המשחק הראשון שלך',
                  progress: { cur: Math.min(userMatches, 1), max: 1 },
                },
                {
                  icon: '🔥', label: trophies[1].label, on: trophies[1].unlocked,
                  desc: lang === 'fr' ? 'Gagne 5 matchs d\'affilée pour débloquer' : lang === 'en' ? 'Win 5 matches in a row to unlock' : 'זכה ב-5 משחקים ברצף',
                  progress: { cur: Math.min(longestStreak, 5), max: 5 },
                },
                {
                  icon: '⭐', label: trophies[2].label, on: trophies[2].unlocked,
                  desc: lang === 'fr' ? 'Joue au moins 10 matchs pour débloquer' : lang === 'en' ? 'Play at least 10 matches to unlock' : 'שחק לפחות 10 משחקים',
                  progress: { cur: Math.min(userMatches, 10), max: 10 },
                },
                {
                  icon: '👑', label: trophies[3].label, on: trophies[3].unlocked,
                  desc: lang === 'fr' ? 'Atteins le niveau 5 pour débloquer' : lang === 'en' ? 'Reach level 5 to unlock' : 'הגע לרמה 5 לפתיחה',
                  progress: { cur: Math.min(Math.round((level ?? 0) * 10) / 10, 5), max: 5 },
                },
              ]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Likes Received Sheet ────────────────────────────────────────────────────
function LikesReceivedSheet({ t, lang, dark, userId, onClose, onOpenDetail }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const rtl = lang === 'he';
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
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
                <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.1em' }}>Niv. {p.level?.toFixed(1)}</div>
              )}
            </div>
            <div style={{ color: COURT.green, fontSize: 18 }}>💚</div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// ─── Contact Sheet ───────────────────────────────────────────────────────────
function ContactSheet({ dark, lang, onClose }) {
  const { user, profile } = useAuth();
  const rtl = lang === 'he';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const card  = dark ? COURT.darkCard : COURT.creamDark;
  const border= dark ? COURT.darkBorder : `${COURT.green}30`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';

  const types = ['Feedback', 'Bug', 'Aide'];
  const [type, setType]       = useState('Feedback');
  // Pré-rempli depuis le profil si disponible
  const [name, setName]       = useState(profile?.name || profile?.username || '');
  const [email, setEmail]     = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState(null);

  const canSend = name.trim() && email.trim() && message.trim() && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // 1. Sauvegarde en DB
      const { error: dbErr } = await supabase
        .from('support_messages')
        .insert({
          user_id: user?.id ?? null,
          name:    name.trim(),
          email:   email.trim(),
          type,
          message: message.trim(),
        });
      if (dbErr) throw dbErr;

      // 2. Notification email via Edge Function (best-effort, n'échoue pas si l'email rate)
      supabase.functions.invoke('notify-support', {
        body: { name: name.trim(), email: email.trim(), type, message: message.trim() },
      }).catch(() => {});

      setSent(true);
    } catch (err) {
      setError(
        lang === 'fr' ? 'Erreur lors de l\'envoi. Réessaie.'
          : lang === 'en' ? 'Failed to send. Please try again.'
          : 'שגיאה בשליחה. נסה שוב.'
      );
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: bg, border: `0.5px solid ${border}`,
    fontFamily: 'Mulish', fontSize: 14, color: ink, outline: 'none',
    boxSizing: 'border-box', WebkitAppearance: 'none',
  };

  const title = lang === 'fr' ? 'Nous contacter' : lang === 'en' ? 'Contact us' : 'צור קשר';

  return (
    <BottomSheet onClose={onClose} title={title} dark={dark}>
      <div style={{ padding: '8px 20px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: ff_serif, fontStyle: rtl ? 'normal' : 'italic', fontSize: 22, color: ink, marginBottom: 8 }}>
              {lang === 'fr' ? 'Message envoyé !' : lang === 'en' ? 'Message sent!' : '!ההודעה נשלחה'}
            </div>
            <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone }}>
              {lang === 'fr' ? 'Nous reviendrons vers toi rapidement.'
                : lang === 'en' ? 'We\'ll get back to you shortly.'
                : 'נחזור אליך בקרוב.'}
            </div>
          </div>
        ) : (
          <>
            {/* Sélecteur de type */}
            <div style={{ display: 'flex', gap: 8 }}>
              {types.map(tp => (
                <button key={tp} onClick={() => setType(tp)} style={{
                  flex: 1, padding: '9px 4px', borderRadius: 9, cursor: 'pointer',
                  background: type === tp ? COURT.green : card,
                  border: `0.5px solid ${type === tp ? COURT.gold : border}`,
                  color: type === tp ? COURT.cream : stone,
                  fontFamily: 'Mulish', fontSize: 11, fontWeight: 600,
                  transition: 'all 0.2s',
                }}>{tp}</button>
              ))}
            </div>

            {/* Nom complet */}
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder={lang === 'fr' ? 'Nom complet' : lang === 'en' ? 'Full name' : 'שם מלא'}
              style={inputStyle}
            />

            {/* Adresse email */}
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={lang === 'fr' ? 'Adresse email' : lang === 'en' ? 'Email address' : 'כתובת אימייל'}
              style={inputStyle}
            />

            {/* Message */}
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder={lang === 'fr' ? 'Décrivez votre demande...' : lang === 'en' ? 'Describe your request...' : 'תאר את בקשתך...'}
              rows={5}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />

            {/* Erreur */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: `${COURT.red}15`, border: `1px solid ${COURT.red}40`,
              }}>
                <p style={{ fontFamily: 'Mulish', fontSize: 13, color: COURT.red, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Bouton envoyer */}
            <button onClick={handleSend} disabled={!canSend} style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: canSend ? COURT.green : `${COURT.green}45`,
              border: `0.5px solid ${canSend ? COURT.gold + '80' : 'transparent'}`,
              color: COURT.cream, fontFamily: 'Mulish', fontSize: 15, fontWeight: 600,
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}>
              {sending
                ? (lang === 'fr' ? 'Envoi...' : lang === 'en' ? 'Sending...' : 'שולח...')
                : (lang === 'fr' ? 'Envoyer' : lang === 'en' ? 'Send' : 'שלח')
              }
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ─── Profile Screen ──────────────────────────────────────────────────────────
function ProfileScreen({ t, showEditProfile, setShowEditProfile, onOpenDetail, onShowNotifs, notifCount = 0, onOpenStreak = () => {} }) {
  const { user, profile, signOut, saveProfile }      = useAuth();
  const { lang, dark, level, confidence, setLang, toggleDark, setConfidence } = usePrefs();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showPartnerPrefs, setShowPartnerPrefs] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showReEval, setShowReEval] = useState(false);
  const [showReEvalConfirm, setShowReEvalConfirm] = useState(false); // dialog d'avertissement
  const [showCountry, setShowCountry] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reEvalSaving, setReEvalSaving] = useState(false);
  const [reEvalDone, setReEvalDone] = useState(null);  // niveau confirmé après mise à jour

  // ─── Cooldown mensuel réévaluation ──────────────────────────────────────────
  const lastEvalRaw  = profile?.last_self_eval_date;
  const lastEvalDate = lastEvalRaw ? new Date(lastEvalRaw) : null;
  const today        = new Date();
  const evalBlocked  = lastEvalDate != null
    && lastEvalDate.getFullYear() === today.getFullYear()
    && lastEvalDate.getMonth()    === today.getMonth();
  // 1er du mois suivant
  const nextEvalDate = lastEvalDate
    ? new Date(lastEvalDate.getFullYear(), lastEvalDate.getMonth() + 1, 1)
    : null;
  const nextEvalStr  = nextEvalDate
    ? nextEvalDate.toLocaleDateString(
        lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-GB',
        { day: 'numeric', month: 'long' }
      )
    : null;
  const rtl   = lang === 'he';
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
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

  function SettingRow({ icon, label, sub, right, onClick }) {
    return (
      <button onClick={onClick} style={{
        width: '100%', marginTop: 10, padding: '14px 16px',
        background: card, border: `0.5px solid ${border}`, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500, cursor: 'pointer',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: icon ? 12 : 0 }}>
          {icon ? <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span> : null}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span>{label}</span>
            {sub && <span style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, fontStyle: 'normal', fontWeight: 400, letterSpacing: '0.05em' }}>{sub}</span>}
          </span>
        </span>
        <span style={{ color: COURT.green }}>{right || (rtl ? '←' : '→')}</span>
      </button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      // Single RPC call : supprime toutes les données + auth.users en cascade (RGPD)
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Delete account error:', err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ─── Trophées (profil propre) ────────────────────────────────────────────
  const { stats: myStats } = usePlayerStats();
  const myHistory = useMatchHistory();
  const myMatches = myStats?.matchesPlayed ?? profile?.matches_played ?? 0;
  let myLongestStreak = 0, _s = 0;
  for (const m of myHistory) {
    if (m.result === 'win') { _s += 1; myLongestStreak = Math.max(myLongestStreak, _s); }
    else _s = 0;
  }
  const profileTrophies = [
    { key: 'first',  icon: '🎾', label: t.trophyFirstMatch || 'Premier match', unlocked: myMatches >= 1 },
    { key: 'streak', icon: '🔥', label: t.trophyStreak5    || 'Série de 5',    unlocked: myLongestStreak >= 5 },
    { key: 'ten',    icon: '⭐', label: t.trophyTenMatches || '10 matchs',     unlocked: myMatches >= 10 },
    { key: 'level5', icon: '👑', label: t.trophyLevel5     || 'Niveau 5',      unlocked: level != null && level >= 5 },
  ];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
        <div>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.member}</div>
          <div style={{ fontFamily: ff_serif, fontSize: 28, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500 }}>{t.myProfile}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* 🔥 Série de jours */}
          <button onClick={onOpenStreak} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1,
          }}>🔥</button>
          <button onClick={() => setShowEditProfile(true)} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={() => setShowMenu(true)} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button onClick={onShowNotifs} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifCount > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: COURT.red, border: `1.5px solid ${bg}`, fontFamily: 'Mulish', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, animation: 'notifPop 0.4s ease' }}>{notifCount}</div>
          )}
          </button>
        </div>
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
          {level == null ? (
            /* ── Niveau non évalué — CTA ── */
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, textAlign: 'center' }}>
                {lang === 'he' ? 'רמה לא מוערכת' : lang === 'en' ? 'Level not evaluated' : 'Niveau non évalué'}
              </div>
              <button
                onClick={() => setShowReEval(true)}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: COURT.green, color: COURT.cream,
                  border: `0.5px solid ${COURT.gold}60`, cursor: 'pointer',
                  fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <PadelBall size={14} shadow={false} />
                {lang === 'he' ? 'השלם את ההערכה שלי' : lang === 'en' ? 'Complete my evaluation' : 'Compléter mon évaluation'}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: '100%', marginTop: 4 }}>
                {[
                  { label: t.matchesPlayed, value: userMatches },
                  { label: t.confidence,    value: `${confidence}%` },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: 24, color: COURT.green, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontFamily: 'Mulish', fontSize: 8, color: stone, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Niveau évalué — grille standard ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 18 }}>
              {[
                { label: t.currentLevel,  value: level.toFixed(1) },
                { label: t.matchesPlayed, value: userMatches },
                { label: t.confidence,    value: `${confidence}%` },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
                  <div style={{ fontFamily: 'Spectral, serif', fontSize: 24, color: COURT.green, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 8, color: stone, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 24px 100px' }}>

        {/* ════ MON PROFIL ════ */}
        <div style={{ fontFamily: 'Mulish', fontSize: 9.5, color: stone, letterSpacing: '0.26em',
          textTransform: 'uppercase', marginBottom: 8 }}>
          {lang === 'fr' ? 'Mon profil' : lang === 'en' ? 'My profile' : 'הפרופיל שלי'}
        </div>
        <div style={{ background: card, border: `0.5px solid ${border}`,
          borderRadius: 16, overflow: 'hidden' }}>

          {/* Modifier mon profil */}
          <div onClick={() => setShowEditProfile(true)} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', borderBottom:`0.5px solid ${border}20`, cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {lang==='fr' ? 'Modifier mon profil' : lang==='en' ? 'Edit profile' : 'עריכת פרופיל'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Région */}
          <div onClick={() => setShowCountry(true)} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', borderBottom:`0.5px solid ${border}20`, cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {lang==='fr' ? 'Région' : lang==='en' ? 'Region' : 'אזור'}
            </span>
            <span style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize:14, color:stone }}>
              {profile?.region || profile?.city || '—'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Likes reçus */}
          <div onClick={() => setShowLikes(true)} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {t.likesReceived || 'Likes reçus'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>

        {/* ════ MON JEU ════ */}
        <div style={{ fontFamily:'Mulish', fontSize:9.5, color:stone, letterSpacing:'0.26em',
          textTransform:'uppercase', margin:'22px 0 8px' }}>
          {lang==='fr' ? 'Mon jeu' : lang==='en' ? 'My game' : 'המשחק שלי'}
        </div>
        <div style={{ background:card, border:`0.5px solid ${border}`, borderRadius:16, overflow:'hidden' }}>

          {/* Le partenaire idéal */}
          <div onClick={() => setShowPartnerPrefs(true)} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', borderBottom:`0.5px solid ${border}20`, cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {t.partnerPrefsTitle || 'Le partenaire idéal'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Réévaluer mon niveau */}
          <div
            onClick={evalBlocked ? undefined : () => setShowReEvalConfirm(true)}
            style={{
              display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
              cursor: evalBlocked ? 'default' : 'pointer',
              opacity: evalBlocked ? 0.4 : 1,
              transition: 'opacity 0.3s',
              flexDirection: 'column', alignItems: 'stretch',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Réévaluer mon niveau' : lang==='en' ? 'Re-evaluate my level' : 'הערך מחדש'}
              </span>
              <span style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize:14, color:stone }}>
                {level?.toFixed?.(1) ?? '—'}
              </span>
              {!evalBlocked && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              )}
            </div>
            {evalBlocked && nextEvalStr && (
              <div style={{
                fontFamily:'Mulish', fontSize:10.5, color:stone,
                letterSpacing:'0.06em', paddingLeft:48, paddingBottom:2,
              }}>
                {lang==='fr' ? `Disponible le ${nextEvalStr}` : lang==='en' ? `Available on ${nextEvalStr}` : `זמין מ-${nextEvalStr}`}
              </div>
            )}
          </div>
        </div>

        {/* ════ APPLICATION ════ */}
        <div style={{ fontFamily:'Mulish', fontSize:9.5, color:stone, letterSpacing:'0.26em',
          textTransform:'uppercase', margin:'22px 0 8px' }}>
          {lang==='fr' ? 'Application' : lang==='en' ? 'App' : 'אפליקציה'}
        </div>
        <div style={{ background:card, border:`0.5px solid ${border}`, borderRadius:16, overflow:'hidden' }}>

          {/* Langue */}
          <div onClick={() => setShowLangPicker(true)} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', borderBottom:`0.5px solid ${border}20`, cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Langue' : lang==='en' ? 'Language' : 'שפה'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize:12, color:stone, marginTop:1 }}>
                Français · English · עברית
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Mode sombre */}
          <div onClick={toggleDark} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>{t.darkMode}</span>
            <div style={{ width:44, height:24, borderRadius:12, background: dark ? COURT.green : `${stone}50`,
              position:'relative', transition:'background 0.3s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left: dark ? 22 : 2, width:20, height:20,
                borderRadius:10, background:'#fff', transition:'left 0.3s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>

        {/* ════ AIDE & LÉGAL ════ */}
        <div style={{ fontFamily:'Mulish', fontSize:9.5, color:stone, letterSpacing:'0.26em',
          textTransform:'uppercase', margin:'22px 0 8px' }}>
          {lang==='fr' ? 'Aide & légal' : lang==='en' ? 'Help & legal' : 'עזרה'}
        </div>
        <div style={{ background:card, border:`0.5px solid ${border}`, borderRadius:16, overflow:'hidden' }}>

          {/* Aide & support */}
          <div onClick={() => setShowContact(true)} style={{ display:'flex', alignItems:'center', gap:14,
            padding:'14px 16px', borderBottom:`0.5px solid ${border}20`, cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Aide & support' : lang==='en' ? 'Help & support' : 'עזרה ותמיכה'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize:12, color:stone, marginTop:1 }}>
                {lang==='fr' ? 'Nous contacter' : lang==='en' ? 'Contact us' : 'צור קשר'}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Confidentialité */}
          <div onClick={() => window.open('https://www.iubenda.com/privacy-policy/72981168', '_blank')} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5Z"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:ff_serif, fontSize:19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Confidentialité' : lang==='en' ? 'Privacy' : 'פרטיות'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize:12, color:stone, marginTop:1 }}>
                {lang==='fr' ? 'Politique de confidentialité' : lang==='en' ? 'Privacy policy' : 'מדיניות פרטיות'}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>

        {/* ════ COMPTE ════ */}
        <div style={{ fontFamily:'Mulish', fontSize:9.5, color:stone, letterSpacing:'0.26em',
          textTransform:'uppercase', margin:'22px 0 8px' }}>
          {lang==='fr' ? 'Compte' : lang==='en' ? 'Account' : 'חשבון'}
        </div>
        <div style={{ background:card, border:`0.5px solid ${COURT.red}25`, borderRadius:16, overflow:'hidden' }}>
          <div onClick={handleSignOut} style={{ display:'flex', alignItems:'center',
            gap:14, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.red}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.red} strokeWidth="1.5" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <path d="M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </div>
            <span style={{ flex:1, fontFamily:ff_serif, fontSize:19, color:COURT.red, fontStyle: rtl ? 'normal' : 'italic' }}>
              {lang==='fr' ? 'Se déconnecter' : lang==='he' ? 'התנתק' : 'Sign out'}
            </span>
          </div>
        </div>

        {/* Supprimer le compte — RGPD */}
        {!showDeleteConfirm ? (
          <div onClick={() => setShowDeleteConfirm(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            marginTop:14, color:`${COURT.red}80`, fontFamily:ff_italic, fontStyle:'italic',
            fontSize:13, cursor:'pointer', paddingBottom:20 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            {lang==='fr' ? 'Supprimer mon compte' : lang==='en' ? 'Delete account' : 'מחק חשבון'}
          </div>
        ) : (
          <div style={{
            marginTop: 8, borderRadius: 12,
            border: `0.5px solid ${COURT.red}40`,
            background: dark ? `${COURT.red}12` : `${COURT.red}08`,
            padding: '16px',
            animation: 'fadeUp 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, fontWeight: 600, color: COURT.red, marginBottom: 4 }}>
                  {lang === 'fr' ? 'Action irréversible' : lang === 'he' ? 'פעולה בלתי הפיכה' : 'Irreversible action'}
                </div>
                <div style={{ fontFamily: 'Mulish', fontSize: 12, color: dark ? COURT.darkText : COURT.ink, lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'fr'
                    ? 'Toutes vos données seront supprimées définitivement : profil, matchs, messages et photos.'
                    : lang === 'he'
                    ? 'כל הנתונים שלך יימחקו לצמיתות: פרופיל, משחקים, הודעות ותמונות.'
                    : 'All your data will be permanently deleted: profile, matches, messages and photos.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'transparent',
                  border: `0.5px solid ${dark ? COURT.darkBorder : COURT.stone + '50'}`,
                  borderRadius: 8, fontFamily: 'Mulish', fontSize: 13,
                  color: dark ? COURT.darkMuted : COURT.stone, cursor: 'pointer',
                }}
              >
                {lang === 'fr' ? 'Annuler' : lang === 'he' ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 2, padding: '10px 0',
                  background: COURT.red,
                  border: 'none', borderRadius: 8,
                  fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {deleting ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    {lang === 'fr' ? 'Suppression…' : lang === 'he' ? 'מוחק…' : 'Deleting…'}
                  </>
                ) : (
                  lang === 'fr' ? 'Confirmer la suppression' : lang === 'he' ? 'אשר מחיקה' : 'Confirm deletion'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Politique de confidentialité — lien discret */}
        <div style={{ textAlign:'center', marginTop:24, paddingBottom:8 }}>
          <a
            href="https://www.iubenda.com/privacy-policy/72981168"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily:'Mulish', fontSize:11, color:stone, opacity:0.5,
              textDecoration:'underline', textDecorationColor:`${stone}40` }}
          >
            {lang==='fr' ? 'Politique de confidentialité' : lang==='en' ? 'Privacy policy' : 'מדיניות פרטיות'}
          </a>
        </div>
      </div>

      {/* BottomSheet : Menu hamburger */}
      {showMenu && (
        <BottomSheet
          onClose={() => setShowMenu(false)}
          title={lang === 'fr' ? 'Menu' : lang === 'en' ? 'Menu' : 'תפריט'}
          dark={dark}
        >
          <div style={{ padding: '4px 20px 32px' }}>
            {[
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                label: lang === 'fr' ? 'Mon profil' : lang === 'en' ? 'My profile' : 'הפרופיל שלי',
                sub: lang === 'fr' ? 'Modifier mon profil' : lang === 'en' ? 'Edit my profile' : 'עריכת פרופיל',
                action: () => { setShowMenu(false); setShowEditProfile(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                label: lang === 'fr' ? 'Préférence partenaire' : lang === 'en' ? 'Partner preference' : 'העדפת שותף',
                sub: lang === 'fr' ? 'Afficher le partenaire idéal' : lang === 'en' ? 'Set your ideal partner' : 'הגדר שותף אידיאלי',
                action: () => { setShowMenu(false); setShowPartnerPrefs(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                label: lang === 'fr' ? 'Région' : lang === 'en' ? 'Region' : 'אזור',
                sub: profile?.region || (lang === 'fr' ? 'Non défini' : lang === 'en' ? 'Not set' : 'לא מוגדר'),
                action: () => { setShowMenu(false); setShowCountry(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                label: lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'שפה',
                sub: 'Français · English · עברית',
                action: () => { setShowMenu(false); setShowLangPicker(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                label: lang === 'fr' ? 'Nous contacter' : lang === 'en' ? 'Contact us' : 'צור קשר',
                sub: 'Feedback · Bug report · Help',
                action: () => { setShowMenu(false); setShowContact(true); },
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  borderBottom: i < 4 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '18'}` : 'none',
                  background: 'transparent', border: 'none', borderBottom: i < 4 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '18'}` : 'none',
                  cursor: 'pointer', textAlign: rtl ? 'right' : 'left',
                  animation: `cardIn 0.3s ease ${i * 0.05}s both`,
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? COURT.darkCard : `${COURT.green}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontSize: 17, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic' }}>{item.label}</div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 11, color: dark ? COURT.darkMuted : COURT.stone, marginTop: 2 }}>{item.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                  {rtl ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
                </svg>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* BottomSheet : Formulaire de contact */}
      {showContact && (
        <ContactSheet
          dark={dark} lang={lang}
          onClose={() => setShowContact(false)}
        />
      )}

      {/* BottomSheet : Choix de la langue */}
      {showLangPicker && (
        <BottomSheet
          onClose={() => setShowLangPicker(false)}
          title={lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'שפה'}
          dark={dark}
        >
          <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { code: 'fr', flag: '🇫🇷', label: 'Français' },
              { code: 'en', flag: '🇬🇧', label: 'English' },
              { code: 'he', flag: '🇮🇱', label: 'עברית' },
            ].map(({ code, flag, label }) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  onClick={() => { setLang(code); setShowLangPicker(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                    background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
                    border: `0.5px solid ${active ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '50')}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{flag}</span>
                  <span style={{
                    fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
                    fontSize: 20, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic',
                    color: active ? COURT.cream : (dark ? COURT.darkText : COURT.ink),
                  }}>{label}</span>
                  {active && (
                    <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.cream} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* BottomSheet : Likes reçus */}
      {showLikes && (
        <LikesReceivedSheet
          t={t} lang={lang} dark={dark} userId={user?.id}
          onClose={() => setShowLikes(false)}
          onOpenDetail={onOpenDetail}
        />
      )}

      {/* BottomSheet : Choisir son pays (France / Israël) */}
      {showCountry && (
        <BottomSheet
          onClose={() => setShowCountry(false)}
          title={lang === 'fr' ? 'Mon pays' : lang === 'en' ? 'My country' : 'המדינה שלי'}
          dark={dark}
        >
          <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
              {lang === 'fr' ? 'Les joueurs de l\'autre pays ne seront pas visibles' : lang === 'en' ? 'Players from the other country won\'t be visible' : 'שחקנים ממדינה אחרת לא יוצגו'}
            </div>
            {[{ v: 'France', flag: '🇫🇷' }, { v: 'Israël', flag: '🇮🇱' }].map(({ v, flag }) => {
              const active = (profile?.region || '') === v;
              return (
                <button
                  key={v}
                  onClick={async () => { await saveProfile({ region: v }); setShowCountry(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                    background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
                    border: `0.5px solid ${active ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '50')}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{flag}</span>
                  <span style={{
                    fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
                    fontSize: 20, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic',
                    color: active ? COURT.cream : (dark ? COURT.darkText : COURT.ink),
                  }}>{v}</span>
                  {active && (
                    <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.cream} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </BottomSheet>
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

      {/* ── Dialog confirmation réévaluation ── */}
      {showReEvalConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          display: 'flex', alignItems: 'flex-end',
          background: 'rgba(0,0,0,0.45)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            width: '100%', background: dark ? COURT.darkCard : '#F7F3EA',
            borderRadius: '20px 20px 0 0',
            padding: '24px 24px 40px',
            animation: 'sheetUp 0.3s ease',
          }}>
            {/* Icône avertissement */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 26,
                background: `${COURT.gold}20`, margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COURT.gold} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontFamily: 'Mulish', fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: dark ? COURT.darkMuted : COURT.stone }}>
                {lang==='fr' ? 'Attention' : lang==='en' ? 'Warning' : 'שים לב'}
              </div>
            </div>
            {/* Titre */}
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, fontStyle: 'italic', color: dark ? COURT.darkText : COURT.ink, textAlign: 'center', marginBottom: 12, lineHeight: 1.4 }}>
              {lang==='fr' ? 'Réévaluation mensuelle' : lang==='en' ? 'Monthly re-evaluation' : 'הערכה חודשית'}
            </div>
            {/* Message principal */}
            <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: dark ? COURT.darkMuted : COURT.stone, textAlign: 'center', lineHeight: 1.6, marginBottom: 18 }}>
              {lang==='fr'
                ? 'Tu ne peux réévaluer ton niveau qu\'une seule fois par mois.'
                : lang==='en'
                ? 'You can only re-evaluate your level once per month.'
                : 'ניתן לבצע הערכה מחדש פעם אחת בחודש בלבד.'}
            </div>
            {/* Avertissement pénalité */}
            <div style={{
              background: `${COURT.red}12`, border: `0.5px solid ${COURT.red}40`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 22,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COURT.red} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ fontFamily: 'Mulish', fontSize: 12.5, color: COURT.red, lineHeight: 1.55 }}>
                {lang==='fr'
                  ? `Cette action réduira ton indice de confiance de 10 % (minimum 50 %). Actuellement : ${confidence}% → ${Math.max(50, confidence - 10)}%`
                  : lang==='en'
                  ? `This will reduce your confidence index by 10% (min. 50%). Currently: ${confidence}% → ${Math.max(50, confidence - 10)}%`
                  : `פעולה זו תפחית את מדד האמינות שלך ב-10% (מינימום 50%). כרגע: ${confidence}% → ${Math.max(50, confidence - 10)}%`}
              </div>
            </div>
            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReEvalConfirm(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'transparent', border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
                  fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15,
                  color: dark ? COURT.darkText : COURT.green, cursor: 'pointer',
                }}
              >
                {lang==='fr' ? 'Annuler' : lang==='en' ? 'Cancel' : 'ביטול'}
              </button>
              <button
                onClick={() => { setShowReEvalConfirm(false); setShowReEval(true); }}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: COURT.green, border: `0.5px solid ${COURT.gold}60`,
                  fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15,
                  color: COURT.cream, cursor: 'pointer',
                }}
              >
                {lang==='fr' ? 'Continuer' : lang==='en' ? 'Continue' : 'המשך'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Réévaluation du niveau (quiz seul, sans refaire le profil) ── */}
      {showReEval && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: dark ? COURT.darkBg : COURT.cream,
        }}>
          {/* Quiz seul — pas d'éditeur de profil, pas de navigation */}
          <QuizScreen
            t={t} lang={lang} dark={dark}
            onDone={async (computedLevel) => {
              setReEvalSaving(true);
              // Pénalité indice de confiance : −10%, minimum 50%
              const newConf = Math.max(50, confidence - 10);
              setConfidence(newConf);
              // IMPORTANT : on ne touche QUE level + last_self_eval_date
              await saveProfile({
                level: computedLevel,
                last_self_eval_date: new Date().toISOString().slice(0, 10),
              });
              setReEvalSaving(false);
              setReEvalDone(computedLevel);
              // Ferme automatiquement après confirmation visuelle (1.6s)
              setTimeout(() => {
                setReEvalDone(null);
                setShowReEval(false);
              }, 1600);
            }}
            onBack={() => setShowReEval(false)}
          />

          {reEvalSaving && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `3px solid ${COURT.cream}40`, borderTopColor: COURT.cream,
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          )}

          {reEvalDone != null && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: dark ? COURT.darkBg : COURT.cream,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Ornament width={50} style={{ margin: '0 auto 16px', display: 'block' }} />
                <div style={{
                  fontFamily: 'Spectral, serif', fontStyle: 'italic',
                  fontSize: 14, color: dark ? COURT.darkMuted : COURT.stone,
                  letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12,
                }}>
                  {lang === 'fr' ? 'Niveau mis à jour' : lang === 'en' ? 'Level updated' : 'הרמה עודכנה'}
                </div>
                <div style={{
                  fontFamily: 'Spectral, serif', fontSize: 88,
                  color: COURT.green, lineHeight: 1,
                  animation: 'levelPop 0.8s cubic-bezier(.2,.9,.3,1.4)',
                }}>
                  {reEvalDone.toFixed(1)}
                  <span style={{ fontSize: 28, color: dark ? COURT.darkMuted : COURT.stone, fontStyle: 'italic', fontFamily: 'Spectral, serif' }}>/7.0</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PartnerPrefs Sheet (Chantier 4) ─────────────────────────────────────────
function PartnerPrefsSheet({ t, lang, dark, initial, onSave, onClose }) {
  const rtl   = lang === 'he';
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const [prefs, setPrefs] = useState({
    hand:   initial.hand   || 'any',
    side:   initial.side   || 'any',
    style:  initial.style  || 'any',
    motivation: initial.motivation || 'any',
    region: initial.region || 'any',
    levelMin: initial.levelMin ?? 1,
    levelMax: initial.levelMax ?? 7,
  });
  const [saving, setSaving] = useState(false);

  const ChipRow = ({ label, value, options, onChange }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontFamily: 'Mulish', fontSize: 9, color: stone,
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
          label={t.motivation || 'Motivation'} value={prefs.motivation}
          onChange={(v) => setPrefs(p => ({ ...p, motivation: v }))}
          options={[
            { value: 'any',     label: t.anyMot   || 'Indifférent' },
            { value: 'fun',     label: t.fun      || 'Le plaisir' },
            { value: 'improve', label: t.improve  || 'Progresser' },
            { value: 'compete', label: t.compete  || 'Compétition' },
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
            fontFamily: 'Mulish', fontSize: 9, color: stone,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            marginBottom: 8, fontWeight: 600,
          }}>{t.levelRange || 'Plage de niveau'}</div>
          <div style={{
            background: dark ? COURT.darkCard : '#FBF9F4',
            border: `0.5px solid ${dark ? COURT.darkBorder : `${COURT.green}25`}`,
            borderRadius: 12, padding: '14px 16px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {lang === 'en' ? 'MIN' : lang === 'he' ? 'מינ׳' : 'MIN'}
                </div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 26, color: COURT.green, lineHeight: 1 }}>
                  {Number.isInteger(prefs.levelMin) ? prefs.levelMin : prefs.levelMin.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {lang === 'en' ? 'MAX' : lang === 'he' ? 'מקס׳' : 'MAX'}
                </div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 26, color: COURT.green, lineHeight: 1 }}>
                  {Number.isInteger(prefs.levelMax) ? prefs.levelMax : prefs.levelMax.toFixed(1)}
                </div>
              </div>
            </div>
            <RangeBar dark={dark} min={1} max={7} step={0.5} valueMin={prefs.levelMin} valueMax={prefs.levelMax}
              onChange={(lo, hi) => setPrefs(p => ({ ...p, levelMin: lo, levelMax: hi }))} />
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
        <div style={{ padding: '32px 24px', textAlign: 'center', color: stone, fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 15 }}>{t.noNotifs}</div>
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
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14, color: ink, lineHeight: 1.4 }}>{n.text[lang] || n.text.fr}</div>
              <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginTop: 2 }}>{n.time}</div>
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: COURT.green, flexShrink: 0 }} />}
          </div>
        );
      })}
    </BottomSheet>
  );
}

// ─── Schedule Match Sheet ────────────────────────────────────────────────────
// Remplace le Live Score Tracker : choisir partenaire + date → proposition envoyée
function ScheduleMatchSheet({ t, lang, dark, onClose, onProposalSent, initialPartnerId }) {
  const { user } = useAuth();
  const { matches: userMatches } = useUserMatches();
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [propDate,  setPropDate]  = useState('');
  const [propTime,  setPropTime]  = useState('');
  const [propPlace, setPropPlace] = useState('');
  const [sending,   setSending]   = useState(false);

  // Pré-sélectionne le partenaire quand on arrive via « Défier » depuis l'historique
  useEffect(() => {
    if (initialPartnerId && userMatches?.length) {
      const found = userMatches.find(m => m.player.id === initialPartnerId);
      if (found) setSelectedMatch(found);
    }
  }, [initialPartnerId, userMatches]);

  const rtl      = lang === 'he';
  const bg       = dark ? COURT.darkBg    : COURT.cream;
  const card     = dark ? COURT.darkCard  : '#F0EDE5';
  const border   = dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink      = dark ? COURT.darkText  : COURT.ink;
  const stone    = dark ? COURT.darkMuted : COURT.stone;
  const ff_serif  = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  const canSend  = selectedMatch && propDate && propTime;

  const handleSend = async () => {
    if (!canSend || !user) return;
    setSending(true);
    const label = lang === 'en'
      ? `📅 Match proposal — ${propDate} at ${propTime}${propPlace ? ` · ${propPlace}` : ''}`
      : lang === 'he'
      ? `📅 הצעת משחק — ${propDate} ${propTime}${propPlace ? ` · ${propPlace}` : ''}`
      : `📅 Proposition de match — ${propDate} à ${propTime}${propPlace ? ` · ${propPlace}` : ''}`;
    await supabase.from('messages').insert({
      match_id:  selectedMatch.matchId,
      sender_id: user.id,
      content:   label,
      msg_type:  'match_proposal',
      metadata:  { date: propDate, time: propTime, place: propPlace },
    });
    setSending(false);
    onProposalSent?.(selectedMatch);
    onClose();
  };

  // Placeholder — le vieux LiveScoreTracker n'est plus utilisé
  return (
    <BottomSheet
      onClose={onClose}
      title={lang === 'en' ? 'Schedule a match' : lang === 'he' ? 'תזמן משחק' : 'Planifier un match'}
      dark={dark}
    >
      <div style={{ padding: '4px 20px 28px' }}>

        {/* ── Choix du partenaire ─────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
            {lang === 'en' ? 'Partner' : lang === 'he' ? 'שותף' : 'Avec qui ?'}
          </div>
          {(!userMatches || userMatches.length === 0) ? (
            <div style={{ padding: '14px 16px', background: bg, border: `0.5px dashed ${border}`, borderRadius: 10, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, textAlign: 'center' }}>
              {lang === 'en' ? 'No matched players yet.' : 'Aucun partenaire encore. Swipez pour en trouver un !'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 210, overflowY: 'auto' }}>
              {userMatches.map(m => {
                const isSel = selectedMatch?.matchId === m.matchId;
                return (
                  <button key={m.matchId} onClick={() => setSelectedMatch(m)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: isSel ? `${COURT.green}15` : bg,
                    border: `0.5px solid ${isSel ? COURT.green : border}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0, background: `url(${m.player.photo}) center/cover`, border: isSel ? `2px solid ${COURT.green}` : `0.5px solid ${border}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500 }}>{m.player.name}</div>
                    </div>
                    {isSel && <div style={{ color: COURT.green, fontSize: 18, fontWeight: 700 }}>✓</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Date + Heure ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
            {lang === 'en' ? 'Date & Time' : lang === 'he' ? 'תאריך ושעה' : 'Date et heure'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={propDate} onChange={e => setPropDate(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Mulish', fontSize: 14, outline: 'none' }} />
            <input type="time" value={propTime} onChange={e => setPropTime(e.target.value)}
              style={{ width: 110, padding: '10px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Mulish', fontSize: 14, outline: 'none' }} />
          </div>
        </div>

        {/* ── Club / terrain (optionnel) ───────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <input
            placeholder={lang === 'en' ? 'Club / court (optional)' : 'Club / terrain (optionnel)'}
            value={propPlace} onChange={e => setPropPlace(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, outline: 'none' }}
          />
        </div>

        {/* ── Bouton envoyer ───────────────────────────────────────────── */}
        <button onClick={handleSend} disabled={!canSend || sending} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: canSend ? COURT.green : `${COURT.green}40`,
          color: COURT.cream, border: 'none',
          fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 15, cursor: canSend && !sending ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.2s',
        }}>
          <PadelBall size={16} shadow={false} />
          {sending ? '…' : (lang === 'en' ? 'Send proposal' : lang === 'he' ? 'שלח הצעה' : 'Envoyer la proposition')}
        </button>

        {/* ── Note explicative ─────────────────────────────────────────── */}
        <div style={{ marginTop: 12, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 12, color: stone, textAlign: 'center' }}>
          {selectedMatch
            ? (lang === 'en'
                ? `${selectedMatch.player.name} will need to accept. The score can be entered after the match.`
                : `${selectedMatch.player.name} devra accepter. Le score sera saisissable après le match.`)
            : (lang === 'en' ? 'Select a partner to continue.' : 'Choisissez un partenaire pour continuer.')}
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── Guest Login Modal ────────────────────────────────────────────────────────
function GuestLoginModal({ lang, dark, onSignIn, onClose }) {
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const rtl   = lang === 'he';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430,
        background: bg, borderRadius: '20px 20px 0 0',
        padding: '28px 24px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <Ornament width={40} />
        <div style={{
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 22, color: ink, textAlign: 'center',
        }}>
          {lang === 'fr' ? 'Rejoindre le club' : lang === 'en' ? 'Join the club' : 'הצטרף למועדון'}
        </div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 13, color: stone, textAlign: 'center', lineHeight: 1.5,
        }}>
          {lang === 'fr'
            ? 'Connectez-vous avec Google pour liker, matcher et jouer.'
            : lang === 'en'
            ? 'Sign in with Google to like, match and play.'
            : 'התחבר עם Google כדי לעשות לייק, להתאים ולשחק.'}
        </div>
        <button onClick={onSignIn} style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.gold}60`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic', fontSize: 17,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {lang === 'fr' ? 'Continuer avec Google' : lang === 'en' ? 'Continue with Google' : 'המשך עם Google'}
        </button>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'Mulish', fontSize: 13, color: stone,
        }}>
          {lang === 'fr' ? 'Plus tard' : lang === 'en' ? 'Maybe later' : 'אולי אחר כך'}
        </button>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function MainApp() {
  const { profile, isGuest, signInWithGoogle }             = useAuth();
  const { lang, dark: darkMode, level, confidence, setLevel } = usePrefs();
  const t = I18N[lang] || I18N.fr;

  const [tab, setTab] = useState('home');
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  const [showPending,  setShowPending]  = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showStreak,      setShowStreak]      = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Les invités peuvent naviguer librement — on bloque seulement les ACTIONS
  // (like, message) au niveau de chaque composant, pas la navigation entre onglets.
  const handleTabChange = (newTab) => {
    // L'onglet profil sans compte → ouvre la modal de connexion
    if (isGuest && newTab === 'profile') {
      setShowGuestModal(true);
      return;
    }
    setTab(newTab);
  };

  // Guest action trigger (e.g. when they like someone)
  const onGuestAction = () => setShowGuestModal(true);

  // Pending match results (anti-fraud system)
  const { pendingToConfirm } = useMatchResults();
  const pendingCount = pendingToConfirm.length;

  // ── Streak daily tick — fires once per session on app open ────────────────
  const _streakTicked = useRef(false);
  useEffect(() => {
    if (!profile?.id || _streakTicked.current) return;
    _streakTicked.current = true;
    tickStreak(profile.id).catch(() => {});
  }, [profile?.id]);

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

  // Total des messages non lus toutes conversations confondues → badge rouge onglet Chat
  const { matches: chatMatches } = useUserMatches();
  const chatUnread = chatMatches
    ? chatMatches.reduce((sum, m) => sum + (m.unreadCount || 0), 0)
    : 0;

  const bellProps = { onShowNotifs: () => setShowNotifs(true), notifCount: unreadCount };

  const screens = {
    home:    <HomeScreen    t={t} lang={lang} level={level} confidence={confidence} dark={darkMode} detailPlayerId={detailPlayerId} setDetailPlayerId={setDetailPlayerId} isGuest={isGuest} onGuestAction={onGuestAction} onGoToProfile={() => setTab('profile')} {...bellProps} />,
    search:  <SearchFlow    t={t} lang={lang} dark={darkMode} userLevel={level} onNavigateChat={() => setTab('chat')} onOpenDetail={setDetailPlayerId} isGuest={isGuest} onGuestAction={onGuestAction} {...bellProps} />,
    chat:    <ChatScreen    t={t} lang={lang} dark={darkMode} onOpenDetail={setDetailPlayerId} isGuest={isGuest} onGuestAction={onGuestAction} {...bellProps} />,
    trophy:  <MatchesScreen t={t} lang={lang} level={level} dark={darkMode} onSchedule={(id) => { setScheduleTargetId(id || null); setShowSchedule(true); }} {...bellProps} />,
    profile: <ProfileScreen t={t} showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile} onOpenDetail={setDetailPlayerId} onOpenStreak={() => setShowStreak(true)} {...bellProps} />,
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
          fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 12,
          boxShadow: '0 2px 8px rgba(15,61,41,0.25)', animation: 'notifPop 0.4s ease',
        }}>
          <PadelBall size={14} shadow={false} />
          <span>{pendingCount} {pendingCount > 1 ? 'scores' : 'score'}</span>
        </button>
      )}

      {/* Bouton planifier un match (flottant) */}
      {tab === 'home' && (
        <button onClick={() => setShowSchedule(true)} style={{
          position: 'absolute', bottom: 115, right: 20, zIndex: 50,
          padding: '10px 16px', borderRadius: 24,
          background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.gold}50`,
          fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 13,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,61,41,0.25)',
          display: 'flex', alignItems: 'center', gap: 6,
          animation: 'fadeUp 0.6s ease 1s both',
        }}>
          <PadelBall size={16} shadow={false} /> {t.startMatch}
        </button>
      )}

      <BottomNav active={tab} onChange={handleTabChange} t={t} notifCount={unreadCount} chatCount={chatUnread} dark={darkMode} />

      {showNotifs && (
        <NotificationsPanel
          t={t} lang={lang} notifications={notifications} dark={darkMode}
          onClose={() => { setShowNotifs(false); markAllRead(); }}
          onMarkRead={markRead}
        />
      )}

      {showSchedule && (
        <ErrorBoundary key="schedule-match-sheet">
          <ScheduleMatchSheet
            t={t} lang={lang} dark={darkMode}
            initialPartnerId={scheduleTargetId}
            onClose={() => { setShowSchedule(false); setScheduleTargetId(null); }}
            onProposalSent={() => { setShowSchedule(false); setScheduleTargetId(null); setTab('chat'); }}
          />
        </ErrorBoundary>
      )}

      {detailPlayerId && (
        <DetailedProfileModal
          playerId={detailPlayerId}
          onClose={() => setDetailPlayerId(null)}
          dark={darkMode}
        />
      )}

      {showStreak && (
        <StreakScreen onClose={() => setShowStreak(false)} />
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

      {showGuestModal && (
        <GuestLoginModal
          lang={lang} dark={darkMode}
          onSignIn={signInWithGoogle}
          onClose={() => setShowGuestModal(false)}
        />
      )}
    </div>
  );
}
