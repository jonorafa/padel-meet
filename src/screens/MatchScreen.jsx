import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COURT, PadelBall, PadelRacket, FloatingBalls, Ornament,
  SectionHeading, ThinButton, HeritageTag, BottomNav,
  SkeletonCard, MatchFlash, NotifBadge, OnlineDot, BottomSheet,
  setDarkMode, isDark,
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
import { supabase }         from '../lib/supabase';

// ─── Helpers ───────────────────────────────────────────────────────────────
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

  const styleLabel = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt }[p.style];
  const motivLabel = { fun: t.fun, improve: t.improve, compete: t.compete }[p.motivation];
  const sideLabel  = p.side === 'forehand' ? t.forehand : t.backhand;
  const handLabel  = p.hand === 'left' ? t.leftHand : t.rightHand;

  const bio = lang === 'he' ? p.bioHe : (lang === 'en' ? (p.bioEn || p.bioFr) : p.bioFr);

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      border: `0.5px solid ${border}`, borderRadius: 14, overflow: 'hidden',
      boxShadow: dark
        ? '0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)'
        : '0 8px 32px rgba(15,61,41,0.12), 0 1px 0 rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: '100%', aspectRatio: '1 / 1', flexShrink: 0, background: `url(${p.photo}) center 20%/cover`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 50%, ${bg})` }} />
        <div style={{
          position: 'absolute', top: 14, left: 14,
          display: 'flex', gap: 6, alignItems: 'center',
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          {p.online && (
            <div style={{
              background: `${bg}CC`, padding: '4px 8px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'Inter', fontSize: 9, color: '#4CAF50',
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#4CAF50' }} />
              {t.online}
            </div>
          )}
          {p.commonMatches > 0 && (
            <div style={{
              background: `${bg}CC`, padding: '4px 8px', borderRadius: 20,
              fontFamily: 'Inter', fontSize: 9, color: COURT.gold, letterSpacing: '0.1em',
            }}>⚡ {p.commonMatches} {t.commonMatches}</div>
          )}
        </div>
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: dark ? `${COURT.darkCard}EE` : `${COURT.green}EE`,
          color: COURT.cream, padding: '8px 12px 6px', borderRadius: 8,
          border: `0.5px solid ${COURT.gold}`,
          opacity: 1 - Math.max(yesOp, noOp),
        }}>
          <div style={{ fontFamily: 'Inter', fontSize: 8, color: COURT.gold, letterSpacing: '0.24em', textTransform: 'uppercase' }}>{t.currentLevel}</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, lineHeight: 1, fontWeight: 400 }}>{p.level.toFixed(1)}</div>
        </div>
      </div>

      <div style={{ padding: '12px 20px 16px', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div style={{
            fontFamily: ff_serif, fontSize: 22, color: ink, fontWeight: 500,
            lineHeight: 1.15, minWidth: 0, flex: 1, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.name.split(' ')[0]}{' '}
            <span style={{ fontStyle: rtl ? 'normal' : 'italic', color: COURT.green }}>
              {p.name.split(' ').slice(1).join(' ')}
            </span>
          </div>
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, flexShrink: 0 }}>{p.age}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: stone, letterSpacing: '0.1em' }}>{p.city}</div>
          <div style={{ width: 3, height: 3, borderRadius: 2, background: stone }} />
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: stone }}>
            {p.matches} matchs{p.winrate != null ? ` · ${p.winrate}%` : ''}
          </div>
        </div>

        <Ornament width={36} style={{ margin: '10px 0 8px' }} />

        {bio && (
          <p style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: ink, lineHeight: 1.4, margin: 0 }}>
            «{' '}{bio}{' '}»
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {handLabel  && <HeritageTag color={COURT.green}>{handLabel}</HeritageTag>}
          {sideLabel  && <HeritageTag color={COURT.green}>{sideLabel}</HeritageTag>}
          {styleLabel && <HeritageTag color={COURT.purple}>{styleLabel}</HeritageTag>}
          {motivLabel && <HeritageTag color={COURT.gold}>{motivLabel}</HeritageTag>}
          <HeritageTag>{p.frequency}{t.times}</HeritageTag>
        </div>

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter', fontSize: 9, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <span>{t.confidence}</span>
          <div style={{ flex: 1, height: 1, background: `${COURT.green}25`, position: 'relative' }}>
            <div style={{ width: `${p.confidenceRate ?? 50}%`, height: '100%', background: COURT.green }} />
          </div>
          <span style={{ color: COURT.green, fontFamily: 'Playfair Display, serif', fontSize: 11, letterSpacing: 0 }}>
            {p.confidenceRate != null ? `${Math.round(p.confidenceRate)}%` : '—'}
          </span>
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
  const s = large ? 64 : 52;
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
    if (p.level < f.levelMin || p.level > f.levelMax) return false;
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
function SwipeStack({ t, lang, filters, onEditFilters, onMatch, dark, userLevel }) {
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
  const startRef = useRef({ x: 0, y: 0 });
  const rtl   = lang === 'he';
  const bg    = dark ? COURT.darkBg : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  // Charge le stack dès que les joueurs ou les filtres changent
  useEffect(() => {
    if (playersLoading) { setStack(null); return; }
    setStack(null);
    const timer = setTimeout(() => setStack(matched), 700);
    return () => clearTimeout(timer);
  }, [playersLoading, matched]);

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

  const undo = () => {
    if (!lastCard) return;
    if (navigator.vibrate) navigator.vibrate(6);
    setStack(s => [lastCard, ...(s || [])]);
    setLastCard(null);
  };

  const onDown = (e) => { startRef.current = { x: e.clientX, y: e.clientY }; setDrag({ x: 0, y: 0, active: true }); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!drag.active) return; setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y, active: true }); };
  const onUp   = () => {
    if (!drag.active) return;
    if (drag.x > 90) decide('right');
    else if (drag.x < -90) decide('left');
    else setDrag({ x: 0, y: 0, active: false });
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 56, paddingBottom: 100, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 12px' }}>
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{t.atClub}</div>
          <div style={{ fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif', fontSize: 26, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500, lineHeight: 1.1 }}>{t.partners}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: COURT.green, fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 12 }}>
            <PadelBall size={12} shadow={false} />
            <span>{displayStack?.length ?? '…'} {t.available}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.6"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'he' ? 'חפש...' : lang === 'en' ? 'Search...' : 'Chercher...'}
              style={{
                paddingLeft: 28, paddingRight: 10, height: 36, width: 118,
                background: dark ? COURT.darkCard : COURT.cream,
                border: `0.5px solid ${searchQuery ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '60')}`,
                borderRadius: 999,
                fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
                fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 13, color: ink, outline: 'none', transition: 'border-color 0.2s',
              }}
            />
          </div>
          <button onClick={onEditFilters} style={{
            background: dark ? COURT.darkCard : COURT.cream,
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
            borderRadius: 999, padding: '8px 14px',
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 12, color: COURT.green, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            {t.filters}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 'calc(100% - 200px)', margin: '0 20px' }}>
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
              style={{ position: 'absolute', inset: 0, transform, opacity, transition, zIndex: 10 - i, touchAction: 'none', cursor: isTop ? 'grab' : 'default' }}>
              <PlayerCard p={p} dragX={isTop ? drag.x : 0} t={t} lang={lang} dark={dark} />
            </div>
          );
        }).reverse()}
      </div>

      {top && stack !== null && (
        <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 14, alignItems: 'center' }}>
          {lastCard && (
            <CircBtn onClick={undo} color={COURT.gold} dark={dark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M3 10h10a5 5 0 1 1 0 10H3" /><path d="M3 10l4-4M3 10l4 4" />
              </svg>
            </CircBtn>
          )}
          <CircBtn onClick={() => decide('left')} color={COURT.purple} dark={dark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </CircBtn>
          <CircBtn onClick={() => decide('right')} color={COURT.green} large dark={dark}>
            <PadelBall size={28} shadow={false} />
          </CircBtn>
        </div>
      )}
    </div>
  );
}

// ─── Search flow ────────────────────────────────────────────────────────────
function SearchFlow({ t, lang, dark, userLevel, onNavigateChat }) {
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
function HomeScreen({ t, lang, level, confidence, dark }) {
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
              <div style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: `url(${p.photo_url || `https://i.pravatar.cc/600?u=${p.id}`}) center/cover` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: ink, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 10, color: stone, letterSpacing: '0.1em' }}>
                  {p.username ? `@${p.username}` : ''}{p.username && p.city ? ' · ' : ''}{p.city || ''}
                </div>
              </div>
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
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const bottomRef = useRef(null);
  const rtl   = lang === 'he';
  const bg    = dark ? COURT.darkBg   : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

  // Charge les messages réels
  useEffect(() => {
    if (!matchId || !user) return;

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data.map(m => ({
          from: m.sender_id === user.id ? 'me' : 'them',
          text: { fr: m.content, en: m.content, he: m.content },
          time: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    fetchMsgs();

    // Temps réel
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const m = payload.new;
          // Évite le doublon si c'est notre propre message (optimistic UI)
          setMessages(prev => {
            const isDup = prev.some(x => x._id === m.id);
            if (isDup) return prev;
            return [...prev, {
              _id: m.id,
              from: m.sender_id === user.id ? 'me' : 'them',
              text: { fr: m.content, en: m.content, he: m.content },
              time: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            }];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [matchId, user?.id, isFake]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    if (isFake || !matchId || !user) {
      // Mode faux : update local uniquement
      const newMsg = { from: 'me', text: { fr: text, en: text, he: text }, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, newMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    await supabase.from('messages').insert({ match_id: matchId, sender_id: user.id, content: text });
    // Le realtime ajoutera le message
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* Header */}
      <div style={{ paddingTop: 56, padding: '56px 20px 14px', borderBottom: `0.5px solid ${border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COURT.green, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: `url(${player?.photo}) center/cover`, position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, background: player?.online ? '#4CAF50' : stone, border: `1.5px solid ${bg}` }} />
        </div>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: ink, fontWeight: 500 }}>{player?.name}</div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: player?.online ? '#4CAF50' : stone, letterSpacing: '0.12em' }}>
            {player?.online ? t.online : `${t.lastSeen} ${formatLastSeen(player?.lastSeen)}`}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={m._id || i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: m.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.from === 'me' ? COURT.green : (dark ? '#243020' : COURT.creamDark),
              color: m.from === 'me' ? COURT.cream : ink,
              fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 15,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              {m.text[lang] || m.text.fr}
              <div style={{ fontFamily: 'Inter', fontSize: 9, color: m.from === 'me' ? `${COURT.cream}80` : stone, marginTop: 4, textAlign: 'right' }}>{m.time}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 32px', borderTop: `0.5px solid ${border}`, display: 'flex', gap: 10 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={t.typeMessage}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 24,
            background: dark ? COURT.darkCard : COURT.creamDark,
            border: `0.5px solid ${border}`,
            fontFamily: 'Crimson Text, serif', fontStyle: 'italic',
            fontSize: 15, color: ink, outline: 'none',
          }}
        />
        <button onClick={sendMessage} style={{
          width: 44, height: 44, borderRadius: 22, background: COURT.green,
          border: 'none', cursor: 'pointer', color: COURT.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
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
      <ActiveChat
        matchId={activeMatch.matchId}
        player={activeMatch.player}
        onBack={() => setActiveMatch(null)}
        t={t} lang={lang} dark={dark}
      />
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

// ─── Profile Screen ──────────────────────────────────────────────────────────
function ProfileScreen({ t }) {
  const { profile, signOut }                         = useAuth();
  const { lang, dark, level, confidence, toggleLang, toggleDark } = usePrefs();
  const navigate = useNavigate();
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
          <div style={{ width: 72, height: 72, borderRadius: 36, background: `url(${userPhoto}) center/cover`, border: `2.5px solid ${bg}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
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
    </div>
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
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const border= dark ? COURT.darkBorder : `${COURT.green}30`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;

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

  return (
    <BottomSheet onClose={onClose} title={t.scoreTracker} dark={dark}>
      <div style={{ padding: '0 24px 16px' }}>
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
        <button onClick={() => { if (navigator.vibrate) navigator.vibrate([20, 10, 20]); onClose(); }} style={{
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
    home:    <HomeScreen    t={t} lang={lang} level={level} confidence={confidence} dark={darkMode} />,
    search:  <SearchFlow    t={t} lang={lang} dark={darkMode} userLevel={level} onNavigateChat={() => setTab('chat')} />,
    chat:    <ChatScreen    t={t} lang={lang} dark={darkMode} />,
    trophy:  <MatchesScreen t={t} lang={lang} level={level} dark={darkMode} />,
    profile: <ProfileScreen t={t} />,
  };

  const bg    = darkMode ? COURT.darkBg : COURT.cream;
  const border= darkMode ? COURT.darkBorder : `${COURT.green}40`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {screens[tab]}

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
        <LiveScoreTracker t={t} lang={lang} dark={darkMode} onClose={() => setShowScore(false)} />
      )}
    </div>
  );
}
