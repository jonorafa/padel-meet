import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { computeBadges } from '../lib/badges';
import { compterPersonnesNonLues } from '../lib/unread';
import { applyFilters, elargirJusquaResultat, chargerFiltres, sauverFiltres } from '../lib/filters';
import { RADIUS } from '../components/tokens';
import {
  COURT, TYPE, PadelBall, PadelRacket, FloatingBalls, Ornament,
  ThinButton, BottomNav, ScreenHeader, NotifBadge, SectionHeading,
  SkeletonCard, MatchFlash, BottomSheet, LangButton, ProfileNudge,
  initialsAvatar, Achievements, BadgeRow, BADGE_LABEL_KEY, CompatRing,
  LightningIcon, HourglassIcon, AlertIcon, LockIcon, StarIcon, TrendUpIcon, BellIcon,
} from '../components/CourtUI';
import { FlameSVG } from '../components/FlameSVG';
import { compatScore } from '../lib/compatibility';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { VideoLightbox } from '../components/VideoLightbox';
import { compressImage } from '../lib/image';
import { track } from '../analytics';
import { SUB_REGIONS, I18N, regionToCountry, getGreeting } from '../data/courtData';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useAuth }          from '../context/AuthContext';
import { usePrefs }         from '../context/PrefsContext';
import { useOnline }        from '../context/PresenceContext';
import { formatPresence }   from '../lib/presence';
import { usePlayers }       from '../hooks/usePlayers';
import { useBlocks }        from '../hooks/useBlocks';
import { useSwipes }        from '../hooks/useSwipes';
import { useUserMatches }        from '../hooks/useUserMatches';
import { useMatchPartnersQuick } from '../hooks/useMatchPartnersQuick';
import { useMatchHistory }       from '../hooks/useMatchHistory';
import { useNotifications } from '../hooks/useNotifications';
import { DetailedProfileModal } from '../components/DetailedProfileModal';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import HomeScreen from '../screens/HomeScreen';
import { PendingMatchesPanel } from '../components/PendingMatchesPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMatchResults } from '../hooks/useMatchResults';
import { supabase }         from '../lib/supabase';
import { Sentry }           from '../sentry';
import StreakScreen          from './StreakScreen';
import LearnScreen           from './LearnScreen';
import { tickStreak }        from '../hooks/useStreak';
const StatsSection = lazy(() => import('../components/StatsSection'));
import QuizScreen           from './ScoreScreen';

// ─── Helpers ───────────────────────────────────────────────────────────────


// ─── Preferences Chips ─────────────────────────────────────────────────────
function Chips({ value, onChange, options, dark, lang }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt.v;
        return (
          <button key={opt.v} className="tap" onClick={() => onChange(opt.v)} style={{
            padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
            color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '60'}`,
            borderRadius: 999, cursor: 'pointer',
            fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic',
            fontSize: 14, transition: 'all 0.2s',
          }}>
            {opt.icon && <span style={{ display: 'inline-flex' }}>{opt.icon}</span>}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.18em', marginTop: 14 }}>
        <span>{min.toFixed(1)}</span><span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

function PrefGroup({ label, children, dark }) {
  return (
    <div style={{ padding: '16px 24px 4px' }}>
      <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.darkMuted : COURT.stone, marginBottom: 10 }}>{label}</div>
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

  return (
    <BottomSheet onClose={onClose} title={t.setProfile} dark={dark} lang={lang}>
      <PrefGroup label={t.side} dark={dark}>
        <Chips dark={dark} lang={lang} value={side} onChange={setSide} options={[
          { v: 'any', label: t.anySide },
          { v: 'forehand', label: t.forehand, icon: '◐' },
          { v: 'backhand', label: t.backhand, icon: '◑' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.hand} dark={dark}>
        <Chips dark={dark} lang={lang} value={hand} onChange={setHand} options={[
          { v: 'any', label: t.anySide },
          { v: 'right', label: t.rightHand },
          { v: 'left', label: t.leftHand },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.playerStyle} dark={dark}>
        <Chips dark={dark} lang={lang} value={style} onChange={setStyle} options={[
          { v: 'any', label: t.anyStyle },
          { v: 'aggressive', label: t.aggressive, icon: '▲' },
          { v: 'defensive', label: t.defensive, icon: '▽' },
          { v: 'all-court', label: t.allcourt, icon: '◆' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.motivation} dark={dark}>
        <Chips dark={dark} lang={lang} value={motivation} onChange={setMotivation} options={[
          { v: 'any', label: t.anyMot },
          { v: 'fun', label: t.fun },
          { v: 'improve', label: t.improve },
          { v: 'compete', label: t.compete },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.region} dark={dark}>
        <Chips dark={dark} lang={lang} value={region} onChange={setRegion} options={[
          { v: 'any',     label: t.anySide },
          { v: 'France',  label: '🇫🇷 France', icon: '' },
          { v: 'Israël',  label: '🇮🇱 Israël', icon: '' },
        ]} />
      </PrefGroup>
      <PrefGroup label={t.levelRange} dark={dark}>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: dark ? COURT.greenOnDark : COURT.green, marginBottom: 8 }}>
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
          borderRadius: 10, fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 14, cursor: 'pointer',
        }}>{t.reset}</button>
        <button onClick={() => { onApply({ side, style, motivation, hand, region, levelMin, levelMax, frequency }); onClose(); }} style={{
          flex: 2, padding: '14px', background: COURT.green, color: COURT.cream,
          border: `0.5px solid ${COURT.green}`, borderRadius: 10,
          fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 15, cursor: 'pointer',
          letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <PadelBall size={18} shadow={false} />{t.saveAndSwipe}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Stat box (grille 2×2 : niveau / confiance / côté / style) ─────────────
// Libellé sur UNE seule ligne (ellipsis si trop long) : sur un écran de 375 px
// chaque colonne fait ~150 px, et un libellé qui passe sur 2 lignes double la
// hauteur de la grille — c'est ce qui forçait la carte à défiler.
// `compact` : utilisé quand une vidéo partage déjà la carte avec la grille de
// 6 stats — moins de padding et une valeur plus petite. `mini` va plus loin
// encore (dernier palier du repli adaptatif de PlayerCard, sur les écrans où
// même `compact` ne suffit pas à tout faire tenir).
function StatBox({ label, value, color, dark, compact = false, mini = false }) {
  return (
    <div style={{
      background: dark ? COURT.darkCard : '#fff',
      border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}`,
      borderRadius: 12, padding: mini ? '5px 8px' : compact ? '7px 10px' : '9px 12px', minWidth: 0,
    }}>
      <div style={{
        fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 600,
        color: dark ? COURT.darkMuted : COURT.stone,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div style={{
        fontFamily: 'Mulish', fontSize: mini ? 13 : compact ? 15 : 18, fontWeight: 700, color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}</div>
    </div>
  );
}

// ─── Player Card ────────────────────────────────────────────────────────────
// Recherche par niveau/fiabilité, pas par photo : la photo reste une petite
// vignette identifiante (haut gauche), l'essentiel de l'espace va aux
// données (niveau, compatibilité, confiance, badges).
function PlayerCard({ p, dragX = 0, t, lang, dark }) {
  const { profile: me } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  // « Cherche » (et la taille de la vignette vidéo) ne rentrent pas toujours :
  // le corps de carte est en overflow:hidden (la carte doit tenir d'un seul
  // tenant, sans défilement), donc tout dépassement est ROGNÉ SANS RIEN
  // AFFICHER. Le point de bascule tombe pile dans les tailles d'iPhone
  // courantes, donc ni « toujours tout afficher » ni un seuil de hauteur en
  // dur ne conviennent : la carte MESURE après rendu et allège par paliers,
  // seulement si besoin.
  //
  // `detail` : 2 = tout (puces + vignette pleine), 1 = sans puces, 0 = sans
  // puces + vignette réduite. Un SEUL nombre plutôt que deux booléens
  // indépendants : la version précédente (chipsTiennent/videoCompacte +
  // "place précédente" mémorisée pour décider si on peut remonter) restait
  // bloquée en l'état plein quand la toute PREMIÈRE mesure tombait sur une
  // valeur transitoire (pile de cartes encore en cours d'animation) — rien ne
  // la corrigeait ensuite tant qu'aucun autre rendu n'était déclenché
  // (confirmé : état React figé sur "puces visibles" avec 139px de
  // débordement bien réel). Ici, chaque déclenchement (montage, ou
  // ResizeObserver signalant un changement de taille) repart du PLEIN détail
  // et laisse l'effet ci-dessous ressérrer si besoin — aucune mémoire d'une
  // mesure potentiellement fausse à corriger a posteriori.
  const corpsRef = useRef(null);
  // Paliers, du plus complet au plus resserré :
  //   4 = badges + puces + vignette 96px
  //   3 = puces + vignette 96px          (badges retirés en PREMIER)
  //   2 = vignette 96px                  (puces retirées)
  //   1 = vignette 72px
  //   0 = vignette 56px + marges resserrées
  // Les badges partent d'abord : c'est le contenu le moins essentiel à une
  // décision de swipe (le niveau, le côté et la compatibilité comptent plus
  // qu'une pastille « 10 matchs »), et ils ne servent qu'à combler le vide
  // laissé par l'absence de vignette. Ils ne sont d'ailleurs rendus que sur
  // les profils SANS vidéo, donc ce palier est simplement inopérant sur les
  // cartes avec vidéo — qui reprennent alors la même suite qu'avant.
  // Le palier « vignette 56px » a été nécessaire quand les 2 cases
  // Main/Motivation ont été ajoutées à la grille (toujours affichées, y
  // compris avec vidéo — demandé explicitement) : les paliers précédents ne
  // suffisaient plus à faire tenir une carte avec vidéo sur un écran de
  // 667px (45px de reste, mesuré).
  const [detail, setDetail] = useState(4);
  // Compteur de mesure — SEULE façon de garantir un rendu à chaque
  // redimensionnement. `repartirDuPlein` ne peut pas s'en charger : il fait
  // setDetail(4), or quand `detail` vaut DÉJÀ 4 (cas d'un écran qui rétrécit
  // alors que la carte est au détail plein) React court-circuite la mise à
  // jour, aucun rendu n'est déclenché, et l'effet de mesure ci-dessous ne
  // tourne donc jamais — la carte reste au détail plein en débordant.
  // Constaté : 812→667 sur une carte avec vidéo, detail figé à 4 et 139px
  // rognés silencieusement. Ce compteur change à chaque notification, donc
  // le rendu (et la mesure) a toujours lieu.
  const [, setMesure] = useState(0);
  // VOLONTAIREMENT sans tableau de dépendances : avec [detail], l'effet ne se
  // rejoue plus sur un rendu ordinaire et la re-mesure reposerait alors
  // uniquement sur le ResizeObserver — qui n'est pas livré quand l'onglet est
  // masqué (comportement du navigateur, déjà rencontré avec
  // requestAnimationFrame plus haut dans ce fichier). En se rejouant à chaque
  // rendu, la mesure se rattrape quoi qu'il arrive ; la suite converge
  // puisqu'on ne réduit que d'un cran par rendu et jamais en dessous de 0.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = corpsRef.current;
    if (!el) return;
    // Mesure SYNCHRONE, sans requestAnimationFrame : rAF ne se déclenche pas
    // dans un onglet masqué (constaté — la mesure ne tournait jamais), et une
    // carte montée en arrière-plan serait restée rognée au retour. Lire
    // scrollHeight ici force le calcul de mise en page : la valeur est juste
    // avant même le premier affichage. Un seul cran par rendu ; l'effet se
    // rejoue à chaque nouveau rendu (déclenché par son propre setDetail), donc
    // la suite converge jusqu'à ce que ça tienne ou qu'il n'y ait plus rien à
    // réduire.
    if (detail > 0 && el.scrollHeight > el.clientHeight + 1) {
      setDetail((d) => d - 1);
    }
  });
  // Redéclenche un cycle « plein détail → resserre si besoin » à chaque
  // changement de taille du corps de carte. `observe()` livre lui-même une
  // notification initiale avant la prochaine peinture (comportement
  // standard) : pas besoin d'appeler repartirDuPlein() séparément au montage,
  // seul le repli sans ResizeObserver doit le faire explicitement.
  //
  // ResizeObserver (comme requestAnimationFrame, déjà rencontré plus haut
  // dans ce fichier) ne notifie PAS tant que l'onglet est en arrière-plan —
  // vérifié directement : un ResizeObserver flambant neuf, posé sur cet
  // élément pendant que document.visibilityState valait "hidden", n'a reçu
  // AUCUNE notification en 2s, pas même celle garantie à l'observation. Si un
  // changement de taille survient précisément pendant cette fenêtre (l'app en
  // arrière-plan, puis remise au premier plan), aucune re-mesure ne se
  // déclenche tant que rien d'autre ne force un nouveau rendu — d'où ce filet
  // sur `visibilitychange`, pour rattraper exactement ce cas au retour.
  useEffect(() => {
    const el = corpsRef.current;
    if (!el) return;
    const repartirDuPlein = () => { setDetail(4); setMesure((n) => n + 1); };
    document.addEventListener('visibilitychange', repartirDuPlein);
    if (typeof ResizeObserver === 'undefined') {
      repartirDuPlein();
      return () => document.removeEventListener('visibilitychange', repartirDuPlein);
    }
    const ro = new ResizeObserver(repartirDuPlein);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', repartirDuPlein);
    };
  }, []);
  // streakMax volontairement omis : la « série de 5 victoires » n'est
  // calculable aujourd'hui que pour l'utilisateur connecté (cf. src/lib/badges.jsx),
  // pas pour un autre joueur — même omission que DetailedProfileModal, qui
  // documente déjà ce choix. Le badge correspondant reste donc verrouillé ici,
  // plutôt que d'être affiché sur la foi d'une valeur qu'on n'a pas.
  const badgesJoueur = useMemo(
    () => computeBadges({ matchesPlayed: p.matches ?? 0, level: p.level ?? 0 }),
    [p.matches, p.level],
  );

  const badgesTiennent = detail >= 4;
  const chipsTiennent  = detail >= 3;
  const videoHauteur   = detail >= 2 ? 96 : detail === 1 ? 72 : 56;
  const margesReduites = detail === 0;
  const yesOp = Math.max(0, Math.min(1, dragX / 100));
  const noOp  = Math.max(0, Math.min(1, -dragX / 100));
  const playerIsOnline = useOnline(p?.id);
  const ff_serif  = lang === 'he' ? 'Mulish, sans-serif' : 'Spectral, serif';
  const bg    = dark ? COURT.darkCard : COURT.cream;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const border= dark ? COURT.darkBorder : `${COURT.green}40`;
  const hasVideo = !!(p.videoUrl && p.videoPoster);

  const styleLabel = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt }[p.style] || t.allcourt;
  const sideLabel  = p.side === 'forehand' ? t.forehand : t.backhand;
  const handLabel  = p.hand === 'left' ? t.leftHand : t.rightHand;
  const motivLabel = { fun: t.fun, improve: t.improve, compete: t.compete }[p.motivation] || t.fun;
  const compat = me ? compatScore(me, p) : (p.confidenceRate ?? 90);

  // Partenaire idéal — réutilise le JSON partner_prefs existant
  const prefs = p.partnerPrefs || {};
  const seekStyleMap = { aggressive: t.aggressive, defensive: t.defensive, 'all-court': t.allcourt };
  const seekMotivMap = { fun: t.fun, improve: t.improve, compete: t.compete };
  const seekChips = [];
  if (prefs.levelMin != null && prefs.levelMax != null && (prefs.levelMin > 1 || prefs.levelMax < 7))
    seekChips.push({ icon: '✦', label: `${prefs.levelMin}–${prefs.levelMax}`, color: dark ? COURT.rustOnDark : COURT.rust });
  if (prefs.hand && prefs.hand !== 'any')
    seekChips.push({ icon: '🤚', label: prefs.hand === 'left' ? t.leftHand : t.rightHand, color: dark ? COURT.greenOnDark : COURT.green });
  if (prefs.side && prefs.side !== 'any')
    seekChips.push({ icon: <PadelBall size={12} shadow={false} />, label: `${t.side} ${prefs.side === 'forehand' ? t.forehand : t.backhand}`, color: dark ? COURT.greenOnDark : COURT.green });
  if (prefs.style && prefs.style !== 'any')
    seekChips.push({ icon: <LightningIcon size={12} color={COURT.rust} />, label: seekStyleMap[prefs.style] || prefs.style, color: dark ? COURT.rustOnDark : COURT.rust });
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
      {/* overflow hidden (et non auto) : la carte de swipe doit tenir d'un seul
          tenant — rien à faire défiler pour voir la suite. Le détail complet
          reste accessible au clic (DetailedProfileModal). */}
      <div ref={corpsRef} style={{ padding: '16px 18px 14px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* ─── En-tête : vignette + nom/âge/ville ──────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 64, height: 64, borderRadius: 32, flexShrink: 0,
              background: `url(${p.photo}) center/cover`,
              border: `0.5px solid ${border}`, cursor: 'pointer', position: 'relative',
            }}
          >
            {/* Pastille en ligne — coin de la vignette */}
            {playerIsOnline && (
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 14, height: 14, borderRadius: 7,
                background: '#7ED957', border: `2px solid ${bg}`,
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: ff_serif, fontSize: 20, color: ink, fontWeight: 500, lineHeight: 1.15 }}>
              {p.name.split(' ')[0]}{' '}
              <span style={{ fontStyle: lang === 'he' ? 'normal' : 'italic', color: dark ? COURT.greenOnDark : COURT.green }}>
                {p.name.split(' ').slice(1).join(' ')}
              </span>
            </div>
            <div style={{ fontFamily: 'Mulish', fontSize: 12, color: stone, marginTop: 3, lineHeight: 1.35 }}>
              {p.age ? `${p.age} ${lang === 'en' ? 'y/o' : lang === 'he' ? 'שנים' : 'ans'} · ` : ''}
              {p.height ? `${p.height} cm · ` : ''}
              📍 {p.city} · {p.matches} {p.matches > 1
                ? (lang === 'en' ? 'matches' : lang === 'he' ? 'משחקים' : 'matchs')
                : (lang === 'en' ? 'match' : lang === 'he' ? 'משחק' : 'match')}
              {p.winrate != null && p.matches > 0 ? ` · ${p.winrate}% ${t.winsWord}` : ''}
            </div>
            {/* Badge « Profil démo » retiré à la demande : ces profils servent
                de comptes de démonstration pour montrer le format aux premiers
                utilisateurs, et doivent donc se présenter comme des comptes
                ordinaires. Le drapeau is_demo reste en base et continue
                d'empêcher tout match (cf. useSwipes) : c'est un choix
                DISTINCT de l'affichage, ne pas le retirer par symétrie. */}
          </div>

          {/* Compatibilité — seul score qui dépend de qui regarde */}
          {compat != null && (
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <CompatRing size={56} value={compat} stroke={COURT.rust} txt={dark ? COURT.rustOnDark : COURT.rust} track={`${COURT.rust}20`} rtl={lang === 'he'} />
              <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, marginTop: 2 }}>
                {lang === 'en' ? 'Compatibility' : lang === 'he' ? 'התאמה' : 'Compatibilité'}
              </div>
            </div>
          )}
        </div>

        {/* ─── Grille de 4 chiffres clés ──────────────────────────────── */}
        {/* ─── Extrait vidéo ──────────────────────────────────────────────
            Seule la VIGNETTE est chargée ici : la vidéo elle-même ne part
            qu'au tap (3 cartes sont montées simultanément dans la pile, en
            précharger 3 vidéos serait ruineux). La vignette reste aussi
            visible si le navigateur ne sait pas décoder le fichier. */}
        {hasVideo && (
          <div
            onClick={(e) => { e.stopPropagation(); setVideoOpen(true); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              marginTop: margesReduites ? 8 : 12, height: videoHauteur, borderRadius: 12, overflow: 'hidden',
              position: 'relative', cursor: 'pointer',
              background: `url(${p.videoPoster}) center/cover`,
              border: `0.5px solid ${border}`,
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 17, flexShrink: 0,
                background: 'rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={COURT.green}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span style={{
                fontFamily: ff_serif, fontStyle: lang === 'he' ? 'normal' : 'italic',
                fontSize: 15, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}>
                {lang === 'en' ? 'Watch a point' : lang === 'he' ? 'צפה בנקודה' : 'Voir un point'}
              </span>
            </div>
          </div>
        )}

        {/* Grille de stats — toujours les 6 mêmes cases (niveau, confiance,
            côté, style, main, motivation), qu'il y ait une vidéo ou non. Avec
            vidéo, la place manque : on les passe en compact (padding/police
            réduits) plutôt que d'en retirer — demandé explicitement, pour ne
            jamais perdre Main/Motivation sur les profils vidéo. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: margesReduites ? 6 : 8, marginTop: margesReduites ? 8 : 12 }}>
          <StatBox compact={hasVideo} mini={margesReduites}
            label={lang === 'en' ? 'Level' : lang === 'he' ? 'רמה' : 'Niveau'}
            value={p.level != null ? p.level.toFixed(1) : '—'}
            color={ink} dark={dark}
          />
          <StatBox compact={hasVideo} mini={margesReduites}
            label={lang === 'en' ? 'Confidence rate' : lang === 'he' ? 'מדד אמינות' : 'Taux de confiance'}
            value={`${Math.round(p.confidenceRate ?? 90)} %`}
            color={COURT.gold} dark={dark}
          />
          <StatBox compact={hasVideo} mini={margesReduites}
            label={t.side || (lang === 'en' ? 'Preferred side' : lang === 'he' ? 'צד מועדף' : 'Côté préféré')}
            value={sideLabel}
            color={ink} dark={dark}
          />
          <StatBox compact={hasVideo} mini={margesReduites}
            label={t.playerStyle || (lang === 'en' ? 'Style' : lang === 'he' ? 'סגנון' : 'Style')}
            value={styleLabel}
            color={dark ? COURT.rustOnDark : COURT.rust} dark={dark}
          />
          <StatBox compact={hasVideo} mini={margesReduites}
            label={lang === 'en' ? 'Hand' : lang === 'he' ? 'יד' : 'Main'}
            value={handLabel}
            color={ink} dark={dark}
          />
          <StatBox compact={hasVideo} mini={margesReduites}
            label={lang === 'en' ? 'Motivation' : lang === 'he' ? 'מוטיבציה' : 'Motivation'}
            value={motivLabel}
            color={COURT.gold} dark={dark}
          />
        </div>

        {/* Cherche — limité à 4 puces : au-delà, la rangée passe sur 2 lignes
            et la carte ne tient plus d'un seul tenant. Affiché même avec une
            vidéo : la vignette est assez compacte pour que les deux tiennent
            dans la carte sans la faire défiler (vérifié sur 375 px de large,
            le plus étroit qu'on vise). */}
        {seekChips.length > 0 && chipsTiennent && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}` }}>
            <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {lang === 'en' ? 'Looking for player' : lang === 'he' ? 'מחפש שחקן' : 'Cherche joueur'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {seekChips.slice(0, 4).map((c, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'transparent', color: ink,
                  border: `0.5px solid ${border}`,
                  fontFamily: ff_serif, fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 13,
                  whiteSpace: 'nowrap',
                }}>{c.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Distinctions — uniquement sur les profils SANS vidéo, où la
            vignette ne prend pas ses 96px et laissait un vide d'environ 200px
            en bas de carte (constaté sur un profil réel). Sur une carte AVEC
            vidéo, la hauteur est déjà à la limite : on n'ajoute rien.
            `tappable={false}` : ailleurs dans l'app un tap sur un badge ouvre
            une infobulle, mais ici la carte est une cible de swipe dont le tap
            ouvre la fiche détaillée — deux gestes concurrents sur la même
            zone. Les badges restent purement informatifs, la fiche détaillée
            porte déjà la version consultable.
            BadgeRow renvoie null si aucun badge n'est débloqué : rien à
            conditionner de plus, la carte retombe simplement sur son ancien
            rendu pour un profil sans distinction. */}
        {!hasVideo && badgesTiennent && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}` }}>
            <BadgeRow badges={badgesJoueur} dark={dark} t={t} tappable={false} />
          </div>
        )}
      </div>

      {/* ─── Overlays swipe ──────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, opacity: yesOp, pointerEvents: 'none', background: `${COURT.green}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${0.5 + yesOp * 0.5})` }}><PadelBall size={90} /></div>
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: noOp, pointerEvents: 'none', background: `${COURT.rust}55`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke={COURT.cream} strokeWidth="1.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <div style={{ fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 22, color: COURT.cream, letterSpacing: '0.06em', fontWeight: 500 }}>
          Passer
        </div>
      </div>

      <PhotoLightbox src={lightboxOpen ? p.photo : null} onClose={() => setLightboxOpen(false)} />
      {/* Monté en permanence (src à null quand fermé) : c'est AnimatePresence,
          à l'intérieur, qui joue l'animation de sortie. */}
      <VideoLightbox
        src={videoOpen ? p.videoUrl : null}
        poster={p.videoPoster}
        onClose={() => setVideoOpen(false)}
      />
    </div>
  );
}

function CircBtn({ children, onClick, color, large, dark }) {
  const s = large ? 52 : 42;     // ↓ taille réduite (avant: 64 / 52)
  const bg = dark ? COURT.darkCard : COURT.cream;
  return (
    <button className="tap" onClick={onClick} style={{
      width: s, height: s, borderRadius: s / 2, background: bg, color,
      border: `0.5px solid ${color}80`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      transition: 'all 0.2s ease',
    }}>{children}</button>
  );
}

// `onElargir` élargit AUTOMATIQUEMENT les critères et relance la recherche.
// Il ouvrait auparavant le panneau Préférences, laissant l'utilisateur deviner
// quel réglage desserrer : un bouton « élargir mes préférences » qui se
// contente d'ouvrir un formulaire ne fait pas ce qu'il annonce. Il relâche
// désormais juste ce qu'il faut pour que des profils reviennent (cf.
// elargirJusquaResultat dans src/lib/filters.js).
// `onReset` (recharger avec les MÊMES critères) recyclait les profils déjà
// écartés dès que `matched` contenait quoi que ce soit — reléguée en action
// secondaire, clairement subordonnée (ThinButton "cream" plutôt que "green").
function EmptyStack({ t, lang, onReset, onElargir, dark }) {
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const rtl   = lang === 'he';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
      <div style={{ animation: 'bounceY 2s ease-in-out infinite', marginBottom: 20 }}><PadelBall size={50} /></div>
      <div style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontSize: 20, color: ink, fontStyle: rtl ? 'normal' : 'italic' }}>{t.closedClub}</div>
      <p style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, maxWidth: 240, margin: '12px 0 24px' }}>{t.closedHint}</p>
      <ThinButton variant="green" onClick={onElargir} lang={lang}>{t.widenFilters}</ThinButton>
      <ThinButton variant="cream" onClick={onReset} lang={lang} style={{ marginTop: 10, padding: '10px 20px', fontSize: 14 }}>{t.refreshStack}</ThinButton>
    </div>
  );
}

// ─── Swipe Stack ────────────────────────────────────────────────────────────
function SwipeStack({ t, lang, filters, onEditFilters, onFiltersChange, onMatch, dark, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0, profilManques = [], onCompleterProfil }) {
  // ── Données réelles ──
  const { profile: me } = useAuth();
  const { players: allPlayers, loading: playersLoading, refetch } = usePlayers(lang);
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

  // Élargissement automatique : relâche juste ce qu'il faut pour que des
  // profils reviennent, puis laisse la pile se recharger d'elle-même (l'effet
  // de synchronisation plus bas suit `matched`, qui dépend de `filters`).
  // Repli sur le panneau Préférences si plus rien ne peut être élargi — sinon
  // le bouton ne ferait rien du tout, ce qui est pire que d'ouvrir un réglage.
  const elargirAutomatiquement = useCallback(() => {
    const { filtres, change } = elargirJusquaResultat(allPlayers || [], filters);
    if (change && onFiltersChange) onFiltersChange(filtres);
    else onEditFilters?.();
  }, [allPlayers, filters, onFiltersChange, onEditFilters]);

  const [stack,       setStack]     = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [decision,    setDecision]  = useState(null);
  const [drag,        setDrag]      = useState({ x: 0, y: 0, active: false });
  const [lastCard,    setLastCard]  = useState(null);
  const [lastDir,     setLastDir]   = useState(null); // direction du dernier swipe
  const stackInitialized = useRef(false);             // évite le flash blanc après swipe
  const dragStartRef = useRef(0);
  const dragMovedRef = useRef(false);
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

  // Drag géré par motion/react (drag="x" sur la carte top) : Motion capture le
  // geste horizontal nativement et laisse le scroll vertical natif passer grâce
  // à touchAction: 'pan-y'. On garde juste le suivi de position (pour l'overlay
  // LIKE/NOPE de PlayerCard).
  const handleDragStart = () => { dragStartRef.current = Date.now(); dragMovedRef.current = true; };
  const handleDrag = (event, info) => {
    setDrag({ x: info.offset.x, y: info.offset.y, active: true });
  };
  const handleDragEnd = (event, info) => {
    if (info.offset.x > 90) decide('right');
    else if (info.offset.x < -90) decide('left');
    else setDrag({ x: 0, y: 0, active: false });
  };
  // Tap → ouvre le profil détaillé. Ne peut PAS vivre dans handleDragEnd :
  // Motion ne démarre une session de pan qu'au-delà de ~3px, donc un tap
  // immobile ne déclenche jamais onDragStart/onDragEnd. On passe par le clic
  // natif, en ignorant celui qui suit un vrai drag (dragMovedRef).
  const handleCardClick = () => {
    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
    if (top && onOpenDetail) onOpenDetail(top.id);
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <ScreenHeader
        eyebrow={t.atClub} title={t.partners}
        notifCount={notifCount} onShowNotifs={onShowNotifs}
        dark={dark} rtl={rtl}
        paddingTop="max(56px, calc(env(safe-area-inset-top, 0px) + 16px))"
      />
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px 10px' }}>
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
              paddingLeft: 28, paddingRight: 10, height: 30, width: '100%',
              background: dark ? COURT.darkCard : COURT.cream,
              border: `0.5px solid ${searchQuery ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '60')}`,
              borderRadius: 999,
              fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
              fontStyle: rtl ? 'normal' : 'italic',
              fontSize: TYPE.micro, color: ink, outline: 'none', transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button onClick={onEditFilters} style={{
          background: dark ? COURT.darkCard : COURT.cream,
          border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}`,
          borderRadius: 999, padding: '0 12px', height: 30,
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic', fontSize: TYPE.micro, color: dark ? COURT.greenOnDark : COURT.green, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          whiteSpace: 'nowrap', boxSizing: 'border-box',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0 }}>
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          {t.filters}
        </button>
      </div>

      {/* Profil incomplet : on le signale ici plutôt que de rediriger vers
          l'onglet Profil au démarrage (cf. le useState de `tab` dans MainApp). */}
      <ProfileNudge
        manques={profilManques}
        onOpen={onCompleterProfil}
        dark={dark}
        lang={lang}
      />

      <div style={{ flex: 1, position: 'relative', margin: '0 16px 8px', minHeight: 0 }}>
        {stack === null ? (
          <div style={{ position: 'absolute', inset: 0 }}><SkeletonCard /></div>
        ) : displayStack.length === 0 ? (
          <EmptyStack t={t} lang={lang} onReset={() => { setStack(matched.length ? matched : allPlayers || []); setLastCard(null); setSearchQuery(''); }} onElargir={elargirAutomatiquement} dark={dark} />
        ) : displayStack.slice(0, 3).map((p, i) => {
          const isTop = i === 0;
          if (!isTop) {
            return (
              <div key={p.id} style={{
                position: 'absolute', inset: 0,
                transform: `translateY(${i * 6}px) scale(${1 - i * 0.03})`,
                opacity: 1 - i * 0.18,
                transition: 'transform 0.4s ease, opacity 0.4s ease',
                zIndex: 10 - i,
                touchAction: 'none',
              }}>
                <PlayerCard p={p} dragX={0} t={t} lang={lang} dark={dark} />
              </div>
            );
          }
          const isDeciding = decision && decision.id === p.id;
          const animate = isDeciding
            ? { x: decision.dir === 'right' ? 600 : -600, y: decision.dir === 'right' ? -30 : 30, rotate: decision.dir === 'right' ? 22 : -22, opacity: 0 }
            : drag.active
              ? { x: drag.x, y: drag.y * 0.4, rotate: drag.x * 0.06, opacity: 1 }
              : { x: 0, y: 0, rotate: 0, opacity: 1 };
          const transition = isDeciding
            ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
            : drag.active
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 30 };
          return (
            <motion.div key={p.id}
              drag="x"
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              onClick={handleCardClick}
              animate={animate}
              transition={transition}
              style={{
                position: 'absolute', inset: 0,
                zIndex: 10,
                // pan-y autorise le scroll vertical natif ; motion capture le
                // geste horizontal (swipe gauche/droite).
                touchAction: 'pan-y',
                cursor: 'grab',
              }}>
              <PlayerCard p={p} dragX={drag.active ? drag.x : 0} t={t} lang={lang} dark={dark} />
            </motion.div>
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
            <CircBtn onClick={() => decide('left')} color={COURT.rust} dark={dark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </CircBtn>
            <CircBtn onClick={() => decide('right')} color={COURT.green} large dark={dark}>
              {/* La balle (viewBox 100×100) est dessinée à cy=48, quasi
                  centrée, mais remplit presque tout le cercle du bouton à
                  cette taille — la couture basse touche visuellement le bord
                  et se lit comme une coupure. Léger décalage vers le haut
                  pour rendre un peu d'air sous la balle. */}
              <PadelBall size={22} shadow={false} style={{ transform: 'translateY(-1.5px)' }} />
            </CircBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Search flow ────────────────────────────────────────────────────────────
function SearchFlow({ t, lang, dark, userLevel, onNavigateChat, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0, profilManques = [], onCompleterProfil }) {
  const { profile } = useAuth();
  // Par défaut, on filtre automatiquement sur le pays de l'utilisateur.
  // L'isolation stricte est de toute façon garantie en amont (usePlayers).
  const userRegion = profile ? regionToCountry(profile) : 'any';
  const [showPrefs, setShowPrefs]   = useState(false);
  const [matchPlayer, setMatchPlayer] = useState(null);
  // Filtres RELUS du stockage : ils repartaient jusqu'ici aux valeurs par
  // défaut à chaque ouverture de l'app, et tout réglage était perdu.
  // `chargerFiltres` valide ce qu'il relit et ignore les filtres d'un autre
  // compte (appareil partagé) — cf. src/lib/filters.js.
  const defautsFiltres = useMemo(() => ({
    side: 'any', style: 'any', motivation: 'any', hand: 'any',
    region: userRegion, levelMin: 1, levelMax: 7, frequency: 0,
  }), [userRegion]);
  const [filters, setFilters] = useState(() => chargerFiltres(defautsFiltres, profile?.id ?? null));

  // Sauvegarde à chaque changement. L'échec (mode privé, quota) est silencieux
  // et non bloquant : perdre ses filtres n'est pas un incident, planter si.
  useEffect(() => {
    sauverFiltres(filters, profile?.id ?? null);
  }, [filters, profile?.id]);

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
        t={t} lang={lang} filters={filters} onFiltersChange={setFilters} dark={dark}
        onEditFilters={() => setShowPrefs(true)}
        onMatch={setMatchPlayer}
        onOpenDetail={onOpenDetail}
        userLevel={userLevel}
        isGuest={isGuest}
        onGuestAction={onGuestAction}
        onShowNotifs={onShowNotifs}
        notifCount={notifCount}
        profilManques={profilManques}
        onCompleterProfil={onCompleterProfil}
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

// ─── Chat actif (messages temps réel) ──────────────────────────────────────
function ActiveChat({ matchId, player, onBack, onOpenDetail, t, lang, dark }) {
  const { user } = useAuth();
  const playerIsOnline = useOnline(player?.id);
  // ── Modération (signaler / bloquer) ──────────────────────────────
  const { blockUser, reportUser } = useBlocks();
  const [modSheet, setModSheet] = useState(null);  // null|'menu'|'block'|'report'|'blocked'|'reported'
  const [modBusy,  setModBusy]  = useState(false);
  const doBlock = async () => {
    setModBusy(true);
    await blockUser(player?.id);
    setModBusy(false);
    setModSheet('blocked');
    setTimeout(() => onBack(), 1200);
  };
  const doReport = async (reason) => {
    setModBusy(true);
    await reportUser(player?.id, reason);
    setModBusy(false);
    setModSheet('reported');
  };
  const modLabels = {
    fr: { menu:'Options', report:'Signaler', block:'Bloquer', cancel:'Annuler',
      blockTitle:'Bloquer ce joueur ?', blockBody:'Vous ne verrez plus son profil et il ne pourra plus vous contacter.', confirmBlock:'Bloquer',
      reportTitle:'Signaler ce joueur', reportBody:'Pourquoi le signales-tu ?',
      blockedMsg:'Joueur bloqué ✓', reportedMsg:'Merci, signalement envoyé ✓',
      reasons:{ harassment:'Harcèlement / insultes', inappropriate:'Contenu inapproprié', fake:'Faux profil', spam:'Spam / publicité', other:'Autre' } },
    en: { menu:'Options', report:'Report', block:'Block', cancel:'Cancel',
      blockTitle:'Block this player?', blockBody:"You won't see their profile and they can't contact you anymore.", confirmBlock:'Block',
      reportTitle:'Report this player', reportBody:'Why are you reporting them?',
      blockedMsg:'Player blocked ✓', reportedMsg:'Thanks, report sent ✓',
      reasons:{ harassment:'Harassment / abuse', inappropriate:'Inappropriate content', fake:'Fake profile', spam:'Spam / ads', other:'Other' } },
    he: { menu:'אפשרויות', report:'דיווח', block:'חסימה', cancel:'ביטול',
      blockTitle:'לחסום את השחקן הזה?', blockBody:'לא תראה יותר את הפרופיל שלו והוא לא יוכל ליצור איתך קשר.', confirmBlock:'חסום',
      reportTitle:'דיווח על השחקן', reportBody:'מדוע אתה מדווח עליו?',
      blockedMsg:'השחקן נחסם ✓', reportedMsg:'תודה, הדיווח נשלח ✓',
      reasons:{ harassment:'הטרדה / קללות', inappropriate:'תוכן לא הולם', fake:'פרופיל מזויף', spam:'ספאם / פרסומת', other:'אחר' } },
  }[lang] || {};
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
      Sentry.captureException(error);
    }
    // Pas besoin de refetch — le UPDATE postgres_changes met à jour le state
  };

  // ── Envoi texte ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !matchId || !user) return;
    const text = input.trim();
    // Basé sur l'historique déjà chargé en mémoire (pas de requête
    // supplémentaire) : vrai si aucun message de moi n'existe encore dans ce match.
    const isFirstFromMe = !messages.some(m => m.from === 'me');
    setInput('');
    await supabase.from('messages').insert({ match_id: matchId, sender_id: user.id, content: text });
    if (isFirstFromMe) track('chat_first_message', { match_id: matchId });
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
    const color      = isTeammate ? COURT.gold : (isWin ? COURT.green : COURT.rust);
    const label      = isTeammate ? (lang === 'en' ? '🤝 Teammates' : lang === 'he' ? '🤝 שותפים' : '🤝 Coéquipiers')
                     : isWin      ? (lang === 'en' ? 'Victory'      : lang === 'he' ? 'ניצחון'    : 'Victoire')
                                  : (lang === 'en' ? 'Defeat'       : lang === 'he' ? 'הפסד'      : 'Défaite');
    const attemptNum = scoreAttempt + 1; // tentative en cours (1-based)
    const remaining  = 3 - scoreAttempt;
    return (
      <div style={{ margin: '4px 0', background: card, border: `1px solid ${color}40`, borderRadius: 14, padding: '12px 14px', width: '100%' }}>
        {/* Header avec numéro de tentative */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PadelBall size={14} shadow={false} /> {pending.isSubmitter ? (lang === 'en' ? 'Score submitted' : lang === 'he' ? 'תוצאה הוגשה' : 'Score soumis') : (lang === 'en' ? 'Score to confirm' : lang === 'he' ? 'תוצאה לאישור' : 'Score à confirmer')}
          </div>
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, background: dark ? '#2a2a2a' : '#e8e4da', borderRadius: 999, padding: '2px 8px' }}>
            {attemptNum}/3
          </div>
        </div>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 24, color, letterSpacing: '0.06em', marginBottom: 4 }}>{pending.score}</div>
        <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginBottom: pending.isSubmitter ? 0 : 10 }}>
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
                  background: COURT.rust + '15', border: `0.5px solid ${COURT.rust}`,
                  color: dark ? COURT.rustOnDark : COURT.rust, fontFamily: 'Mulish', fontSize: 13,
                  cursor: rejectingId === pending.id ? 'not-allowed' : 'pointer',
                  opacity: (rejectingId === pending.id || confirmingId === pending.id) ? 0.5 : 1,
                }}>
                {rejectingId === pending.id ? '…' : (lang === 'en' ? '✗ Reject' : lang === 'he' ? '✗ דחה' : '✗ Refuser')}
              </button>
            </div>
            {actionError && (
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust, textAlign: 'center', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <AlertIcon size={12} color={COURT.rust} /> {actionError}
              </div>
            )}
            {remaining > 1 && (
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, textAlign: 'center' }}>
                {lang === 'en' ? `${remaining - 1} attempt(s) left after rejection` : lang === 'he' ? `${remaining - 1} ניסיון נוסף אחרי דחייה` : `${remaining - 1} tentative(s) restante(s) si refus`}
              </div>
            )}
            {remaining === 1 && (
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust, textAlign: 'center', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <AlertIcon size={12} color={COURT.rust} /> {lang === 'en' ? 'Last attempt — reject = match unrecorded' : lang === 'he' ? 'ניסיון אחרון — דחייה = המשחק לא יירשם' : 'Dernière tentative — refus = match inenregistrable'}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── Carte "match verrouillé" ────────────────────────────────────────────────
  const renderLockedCard = () => (
    <div style={{ margin: '4px 0', background: card, border: `1px solid ${COURT.rust}40`, borderRadius: 14, padding: '14px', width: '100%', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><LockIcon size={24} color={COURT.rust} /></div>
      <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: dark ? COURT.rustOnDark : COURT.rust, fontStyle: rtl ? 'normal' : 'italic', marginBottom: 4 }}>
        {lang === 'en' ? 'Match unrecordable' : lang === 'he' ? 'לא ניתן לרשום את המשחק' : 'Match inenregistrable'}
      </div>
      <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone }}>
        {lang === 'en' ? '3 consecutive rejections — no score can be submitted for this match.' : lang === 'he' ? '3 דחיות רצופות — לא ניתן להגיש תוצאה למשחק זה.' : '3 désaccords consécutifs — aucun score ne peut être enregistré pour ce match.'}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', zIndex: 100 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ paddingTop: 'max(52px, env(safe-area-inset-top, 0px))', padding: `max(52px, env(safe-area-inset-top, 0px)) 16px 12px`, borderBottom: `0.5px solid ${border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} aria-label={lang === 'he' ? 'חזור' : lang === 'en' ? 'Back' : 'Retour'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? COURT.greenOnDark : COURT.green, padding: 4, flexShrink: 0 }}>
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
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: playerIsOnline ? '#4CAF50' : stone, letterSpacing: '0.12em' }}>
              {formatPresence(playerIsOnline, player?.lastSeen, lang)}
            </div>
          </div>
        </div>

        {/* Menu modération (signaler / bloquer) */}
        <button
          onClick={() => setModSheet('menu')}
          aria-label={modLabels.menu}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: stone,
            padding: 6, flexShrink: 0, display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </div>

      {/* ── Action sheet modération (signaler / bloquer) ─────────────────────── */}
      {modSheet && (
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          onClick={() => !modBusy && setModSheet(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 430, background: bg,
              borderRadius: '20px 20px 0 0', padding: '18px 18px 28px', borderTop: `0.5px solid ${border}`,
            }}
          >
            {modSheet === 'menu' && (
              <>
                <button onClick={() => setModSheet('report')} style={{
                  width: '100%', padding: '14px', borderRadius: 12, marginBottom: 8,
                  background: card, border: `0.5px solid ${border}`, color: ink,
                  fontFamily: 'Mulish', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  textAlign: rtl ? 'right' : 'left',
                }}>{modLabels.report}</button>
                <button onClick={() => setModSheet('block')} style={{
                  width: '100%', padding: '14px', borderRadius: 12, marginBottom: 8,
                  background: card, border: `0.5px solid ${border}`, color: '#C0392B',
                  fontFamily: 'Mulish', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  textAlign: rtl ? 'right' : 'left',
                }}>{modLabels.block}</button>
                <button onClick={() => setModSheet(null)} style={{
                  width: '100%', padding: '12px', borderRadius: 12, background: 'none',
                  border: 'none', color: stone, fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{modLabels.cancel}</button>
              </>
            )}

            {modSheet === 'block' && (
              <>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 19, fontWeight: 800, color: ink, marginBottom: 6 }}>{modLabels.blockTitle}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: stone, marginBottom: 18, lineHeight: 1.5 }}>{modLabels.blockBody}</div>
                <button disabled={modBusy} onClick={doBlock} style={{
                  width: '100%', padding: '14px', borderRadius: 12, marginBottom: 10,
                  background: '#C0392B', border: 'none', color: '#fff',
                  fontFamily: 'Mulish', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>{modLabels.confirmBlock}</button>
                <button disabled={modBusy} onClick={() => setModSheet('menu')} style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  background: card, border: `0.5px solid ${border}`, color: ink,
                  fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{modLabels.cancel}</button>
              </>
            )}

            {modSheet === 'report' && (
              <>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 19, fontWeight: 800, color: ink, marginBottom: 6 }}>{modLabels.reportTitle}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: stone, marginBottom: 16 }}>{modLabels.reportBody}</div>
                {Object.entries(modLabels.reasons || {}).map(([key, label]) => (
                  <button key={key} disabled={modBusy} onClick={() => doReport(key)} style={{
                    width: '100%', padding: '13px 14px', borderRadius: 12, marginBottom: 8,
                    background: card, border: `0.5px solid ${border}`, color: ink,
                    fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textAlign: rtl ? 'right' : 'left',
                  }}>{label}</button>
                ))}
                <button disabled={modBusy} onClick={() => setModSheet('menu')} style={{
                  width: '100%', padding: '12px', borderRadius: 12, marginTop: 4, background: 'none',
                  border: 'none', color: stone, fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{modLabels.cancel}</button>
              </>
            )}

            {(modSheet === 'blocked' || modSheet === 'reported') && (
              <div style={{
                fontFamily: 'Spectral, serif', fontSize: 18, fontWeight: 700,
                color: dark ? COURT.greenOnDark : COURT.green, textAlign: 'center', padding: '12px 0',
              }}>
                {modSheet === 'blocked' ? modLabels.blockedMsg : modLabels.reportedMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Barre d'actions rapides ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: `0.5px solid ${border}`, background: dark ? '#1a1f1a' : '#F7F4EE', overflowX: 'auto' }}>
        {[
          { key: 'proposal', icon: '📅', label: lang === 'en' ? 'Plan match' : lang === 'he' ? 'הצע משחק' : 'Proposer' },
          { key: 'score',    icon: <PadelBall size={13} shadow={false} />, label: lang === 'en' ? 'Enter score' : lang === 'he' ? 'הזן תוצאה' : 'Score', disabled: scoreLocked || pendingForMatch.length > 0 },
          (() => {
            if (evalCooldownUntil) {
              const fmtD = evalCooldownUntil.toLocaleDateString(
                lang === 'he' ? 'he-IL' : lang === 'en' ? 'en-US' : 'fr-FR',
                { day: 'numeric', month: 'short' }
              );
              const cooldownLabel = lang === 'en' ? `From ${fmtD}` : lang === 'he' ? `זמין ב-${fmtD}` : `Dispo le ${fmtD}`;
              return { key: 'eval', icon: <StarIcon size={13} />, label: cooldownLabel, disabled: true };
            }
            return { key: 'eval', icon: <StarIcon size={13} />, label: lang === 'en' ? 'Rate player' : lang === 'he' ? 'דרג שחקן' : 'Évaluer' };
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
              fontFamily: 'Mulish', fontSize: 13, cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.45 : 1,
            }}>
            <span style={{ fontSize: 14 }}>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* ── Sheet Proposer un match ─────────────────────────────────────────── */}
      {sheet === 'proposal' && (
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${border}`, background: card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: ink, fontStyle: rtl ? 'normal' : 'italic' }}>
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
            style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${border}`, background: bg, color: ink, fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, outline: 'none' }} />
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
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 16, color: ink, fontStyle: rtl ? 'normal' : 'italic' }}>
            {lang === 'en' ? 'Submit a score' : lang === 'he' ? 'הגש תוצאה' : 'Soumettre un score'}
          </div>

          {/* Avertissement date : match pas encore joué */}
          {scoreDateBlocked && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: `${COURT.gold}18`, border: `0.5px solid ${COURT.gold}60`, borderRadius: 8 }}>
              <span style={{ flexShrink: 0, display: 'flex' }}><HourglassIcon size={18} color={COURT.gold} /></span>
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: ink }}>
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
              fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer', textAlign: rtl ? 'right' : 'left',
            }}>
              {lang === 'en' ? '🤝 Teammate — we both won' : lang === 'he' ? '🤝 שותף — שנינו ניצחנו' : '🤝 Coéquipier — on a tous les deux gagné'}
            </button>
          </div>

          {/* Saisie par set */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone,}}>
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
                      border: `0.5px solid ${setWon ? COURT.green : setLost ? COURT.rust : border}`,
                      background: setWon ? `${COURT.green}15` : setLost ? `${COURT.rust}12` : bg,
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
                      border: `0.5px solid ${setLost ? COURT.rust : setWon ? COURT.green : border}`,
                      background: setLost ? `${COURT.rust}12` : setWon ? `${COURT.green}15` : bg,
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
                    <button onClick={() => setSets(prev => prev.filter((_, j) => j !== i))} aria-label={lang === 'he' ? 'הסר סט' : lang === 'en' ? 'Remove set' : 'Retirer ce set'} style={{
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
                color: dark ? COURT.greenOnDark : COURT.green, fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                {lang === 'en' ? 'Add a set' : lang === 'he' ? 'הוסף סט' : 'Ajouter un set'}
              </button>
            )}
          </div>
          {scoreError && <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust }}>{scoreError}</div>}
          <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone }}>
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
                                  : status === 'declined' ? COURT.rust
                                  : COURT.gold;
                return (
                  <div style={{
                    maxWidth: '82%', padding: '12px 14px',
                    borderRadius: 14, background: card,
                    border: `1px solid ${accentColor}50`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  }}>
                    <div style={{ fontFamily: 'Mulish', fontSize: 13, color: accentColor, marginBottom: 6 }}>
                      📅 {lang === 'en' ? 'Match proposal' : lang === 'he' ? 'הצעת משחק' : 'Proposition de match'}
                    </div>
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, color: ink, fontWeight: 500 }}>
                      {m.metadata?.date} {lang === 'en' ? 'at' : lang === 'he' ? 'ב' : 'à'} {m.metadata?.time}
                    </div>
                    {m.metadata?.place && (
                      <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginTop: 2 }}>📍 {m.metadata.place}</div>
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
                            fontFamily: 'Mulish', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            opacity: respondingId === m._id ? 0.5 : 1,
                          }}>
                          ✓ {lang === 'en' ? 'Accept' : lang === 'he' ? 'אשר' : 'Accepter'}
                        </button>
                        <button
                          onClick={() => respondToProposal(m._id, false)}
                          disabled={respondingId === m._id}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8,
                            background: 'transparent', color: dark ? COURT.rustOnDark : COURT.rust,
                            border: `0.5px solid ${COURT.rust}`,
                            fontFamily: 'Mulish', fontSize: 13, cursor: 'pointer',
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
                        fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.greenOnDark : COURT.green, fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✓ {lang === 'en' ? 'Match accepted' : lang === 'he' ? 'משחק אושר' : 'Match accepté'}
                      </div>
                    )}
                    {status === 'declined' && (
                      <div style={{
                        marginTop: 10, padding: '6px 10px',
                        background: `${COURT.rust}15`, borderRadius: 8,
                        fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        ✗ {lang === 'en' ? 'Match declined' : lang === 'he' ? 'משחק נדחה' : 'Match refusé'}
                      </div>
                    )}

                    <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 6, textAlign: rtl ? 'left' : 'right' }}>{m.time}</div>
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
                fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 15,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}>
                {m.text[lang] || m.text.fr}
                {/* Ligne heure + accusé de lecture (messages envoyés uniquement) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 }}>
                  <span style={{ fontFamily: 'Mulish', fontSize: 13, color: m.from === 'me' ? `${COURT.cream}70` : stone }}>{m.time}</span>
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
        <div style={{ borderTop: `0.5px solid ${COURT.rust}30`, background: card, padding: '8px 14px' }}>
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
            fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 15, color: ink, outline: 'none',
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim()} aria-label={lang === 'he' ? 'שלח הודעה' : lang === 'en' ? 'Send message' : 'Envoyer le message'} style={{
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
            <button onClick={() => setEvalOpen(false)} aria-label={lang === 'he' ? 'סגור' : lang === 'en' ? 'Close' : 'Fermer'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? COURT.greenOnDark : COURT.green, padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500 }}>
                {lang === 'en' ? `Evaluate ${player?.name}` : lang === 'he' ? `העריך את ${player?.name}` : `Évaluer ${player?.name}`}
              </div>
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: dark ? COURT.darkMuted : COURT.stone }}>
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
function ChatScreen({ t, lang, dark, onOpenDetail, isGuest, onGuestAction, onShowNotifs, notifCount = 0, onStartMatch }) {
  // `rtl` manquait ici : ScreenHeader plus bas recevait rtl={false} en dur,
  // ce qui ne cassait pas que l'italique — dir="ltr" était forcé sur tout
  // l'en-tête « Messages » quel que soit `lang`.
  const rtl = lang === 'he';
  const { matches, loading: matchesLoading } = useUserMatches(lang);
  const [activeMatch, setActiveMatch] = useState(null); // { matchId, player }
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
          <div style={{ fontFamily: 'Spectral, serif', fontSize: 22, color: ink, fontStyle: lang === 'he' ? 'normal' : 'italic', fontWeight: 500, marginBottom: 10 }}>
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
            fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 16,
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
    <>
    <div style={{ position: 'absolute', inset: 0, background: bg, paddingBottom: 100, overflow: 'auto' }}>
      {/* rtl={false} explicite : cet écran n'a pas de dir="rtl" sur son
          conteneur racine (contrairement aux 3 autres) — pré-existant, hors
          périmètre de ce chantier, pas corrigé silencieusement ici. */}
      <ScreenHeader eyebrow={t.atClub} title={t.chat} notifCount={notifCount} onShowNotifs={onShowNotifs} dark={dark} rtl={rtl} />

      {matchesLoading || matches === null ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone }}>
          <div style={{ width: 24, height: 24, margin: '0 auto', borderRadius: '50%', border: `2px solid ${COURT.green}30`, borderTopColor: COURT.green, animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: stone, fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 15 }}>{t.noChats}</div>
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
    {/* Bouton « Démarrer un match » flottant — déplacé depuis l'ancien Accueil.
        Hors du <div> scrollable → reste fixe ; uniquement sur la liste (pas en conversation). */}
    {onStartMatch && (
      <button onClick={onStartMatch} style={{
        position: 'absolute', bottom: 115, right: 20, zIndex: 50,
        padding: '10px 16px', borderRadius: 24,
        background: COURT.green, color: COURT.cream,
        border: `0.5px solid ${COURT.gold}50`,
        fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 13,
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,61,41,0.25)',
        display: 'flex', alignItems: 'center', gap: 6,
        animation: 'fadeUp 0.6s ease 1s both',
      }}>
        <PadelBall size={16} shadow={false} /> {t.startMatch}
      </button>
    )}
    </>
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
              fontSize: 13,
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
              fontStyle: lang === 'he' ? 'normal' : 'italic',
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
              fontFamily: 'Mulish', fontSize: 13, color: stone, letterSpacing: '0.12em',
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
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 1px 4px ${COURT.green}55`,
            }}>{unreadCount > 99 ? '99+' : unreadCount}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Skeleton (fallback Suspense) ──────────────────────────────────────
function StatsSkeleton({ dark }) {
  const cls = dark ? 'skeleton-dark' : 'skeleton'
  const card = dark ? COURT.darkCard : COURT.cream
  const border = dark ? COURT.darkBorder : `${COURT.green}25`
  return (
    <div style={{ padding: '0 20px' }}>
      {/* Carte progression */}
      <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 16, padding: '18px 16px', marginBottom: 12 }}>
        <div className={cls} style={{ width: 110, height: 10, borderRadius: 5, marginBottom: 14 }} />
        <div className={cls} style={{ width: '100%', height: 52, borderRadius: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          {[...Array(6)].map((_, i) => <div key={i} className={cls} style={{ width: 28, height: 8, borderRadius: 4 }} />)}
        </div>
      </div>
      {/* Grille 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: RADIUS.lg, padding: '14px 16px' }}>
            <div className={cls} style={{ width: 40, height: 28, borderRadius: 6, marginBottom: 8 }} />
            <div className={cls} style={{ width: 70, height: 8, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      {/* Indice de confiance */}
      <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 16, padding: '18px 16px' }}>
        <div className={cls} style={{ width: 130, height: 10, borderRadius: 5, marginBottom: 14 }} />
        <div className={cls} style={{ width: '100%', height: 8, borderRadius: 4 }} />
      </div>
    </div>
  )
}

// ─── Matches / Stats Screen ──────────────────────────────────────────────────
function MatchesScreen({ t, lang, level, dark, onShowNotifs, notifCount = 0, onSchedule, statsSignal = 0 }) {
  const { profile } = useAuth();
  const history = useMatchHistory(lang);
  const { stats } = usePlayerStats();
  const { matches: myMatches } = useUserMatches(lang);
  const [tab, setTab] = useState('history');

  // Ouverture directe des stats depuis le menu "Mes statistiques" (signal incrémental)
  useEffect(() => {
    if (statsSignal > 0) setTab('stats');
  }, [statsSignal]);
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

  // ─── Trophées ─────────────────────────────────────────────────────
  let longestStreak = 0, _runStreak = 0;
  for (const m of history) {
    if (m.result === 'win') { _runStreak += 1; longestStreak = Math.max(longestStreak, _runStreak); }
    else _runStreak = 0;
  }
  const badgeResults = computeBadges({ matchesPlayed: userMatches, streakMax: longestStreak, level: level ?? 0 });
  const trophies = [
    { key: 'first',  label: t.trophyFirstMatch, unlocked: badgeResults[0].unlocked },
    { key: 'streak', label: t.trophyStreak5,     unlocked: badgeResults[1].unlocked },
    { key: 'ten',    label: t.trophyTenMatches,  unlocked: badgeResults[2].unlocked },
    { key: 'level5', label: t.trophyLevel5,      unlocked: badgeResults[3].unlocked },
  ];

  const tabs = [
    { id: 'history', label: t.history },
    { id: 'stats',   label: t.statsTitle },
  ];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingBottom: 100, overflow: 'auto' }}>
      <ScreenHeader eyebrow={t.atClub} title={t.matches} notifCount={notifCount} onShowNotifs={onShowNotifs} dark={dark} rtl={rtl} />

      <div style={{ display: 'flex', margin: '20px 24px', background: dark ? COURT.darkCard : COURT.creamDark, borderRadius: 10, padding: 4 }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === tb.id ? COURT.green : 'transparent',
            color: tab === tb.id ? COURT.cream : stone,
            fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 14,
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
                <div style={{ width: 5, height: 44, borderRadius: 3, background: m.result === 'win' ? COURT.green : COURT.rust, flexShrink: 0 }} />
                {p?.photo && <div style={{ width: 40, height: 40, borderRadius: 20, background: `url(${p.photo}) center/cover`, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500 }}>{p?.name}</div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone,}}>
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
                            background: won ? `${COURT.green}20` : lost ? `${COURT.rust}18` : `${COURT.stone}15`,
                            color: won ? COURT.green : lost ? COURT.rust : stone,
                            border: `0.5px solid ${won ? COURT.green + '50' : lost ? COURT.rust + '50' : stone + '30'}`,
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
                  <div key={i} style={{ flex: 1, background: m.result === 'win' ? COURT.green : COURT.rust, borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.greenOnDark : COURT.green }}>{wins} {t.winRateLabel?.toLowerCase()}</div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust }}>{history.length - wins} {lang === 'he' ? 'הפסדים' : lang === 'en' ? 'losses' : 'défaites'}</div>
              </div>
            </div>
          )}

          {/* ════ JOUE CONTRE EUX ════ */}
          {myMatches && myMatches.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ marginBottom: 14 }}>
                <SectionHeading italic={!rtl}>
                  {lang === 'fr' ? 'Joue contre eux' : lang === 'he' ? 'שחק נגדם' : 'Play against them'}
                </SectionHeading>
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
                    fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 16, color: dark ? COURT.greenOnDark : COURT.green,
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
                    fontSize: 15, color: dark ? COURT.greenOnDark : COURT.green, cursor: 'pointer',
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
            <div style={{ marginBottom: 14 }}>
              <SectionHeading italic={!rtl}>
                {lang === 'fr' ? 'Prochain match' : lang === 'he' ? 'המשחק הבא' : 'Next match'}
              </SectionHeading>
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
          <Suspense fallback={<StatsSkeleton dark={dark} />}>
            <StatsSection />
          </Suspense>
          {/* ── Trophées en bas de page ── */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 12, padding: '16px 16px 20px' }}>
              <div style={{ marginBottom: 18 }}>
                <SectionHeading italic={!rtl}>{t.trophiesTitle || 'Trophées'}</SectionHeading>
              </div>
              {/* `Icon` et `progress` viennent de computeBadges (badges.jsx) —
                  seuls le libellé et la description restent définis ici, ils
                  sont propres à cet écran. */}
              <Achievements dark={dark} lang={lang} badges={[
                {
                  ...badgeResults[0], label: trophies[0].label, on: trophies[0].unlocked,
                  desc: lang === 'fr' ? 'Joue ton 1er match pour débloquer ce trophée' : lang === 'en' ? 'Play your first match to unlock' : 'שחק את המשחק הראשון שלך',
                },
                {
                  ...badgeResults[1], label: trophies[1].label, on: trophies[1].unlocked,
                  desc: lang === 'fr' ? 'Gagne 5 matchs d\'affilée pour débloquer' : lang === 'en' ? 'Win 5 matches in a row to unlock' : 'זכה ב-5 משחקים ברצף',
                },
                {
                  ...badgeResults[2], label: trophies[2].label, on: trophies[2].unlocked,
                  desc: lang === 'fr' ? 'Joue au moins 10 matchs pour débloquer' : lang === 'en' ? 'Play at least 10 matches to unlock' : 'שחק לפחות 10 משחקים',
                },
                {
                  ...badgeResults[3], label: trophies[3].label, on: trophies[3].unlocked,
                  desc: lang === 'fr' ? 'Atteins le niveau 5 pour débloquer' : lang === 'en' ? 'Reach level 5 to unlock' : 'הגע לרמה 5 לפתיחה',
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
    <BottomSheet onClose={onClose} title={t.likesReceived || 'Likes reçus'} dark={dark} lang={lang}>
      <div style={{ padding: '8px 20px 24px', minHeight: 160 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone }}>…</div>
        )}
        {!loading && likes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: `${COURT.green}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="32" height="30" viewBox="0 0 24 22" fill="none" stroke={COURT.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20C12 20 2 13.5 2 7a5 5 0 0 1 10 0 5 5 0 0 1 10 0c0 6.5-10 13-10 13Z" />
              </svg>
            </div>
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
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, letterSpacing: '0.1em' }}>Niv. {p.level?.toFixed(1)}</div>
              )}
            </div>
            <svg width="18" height="17" viewBox="0 0 24 22" fill="none" stroke={COURT.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20C12 20 2 13.5 2 7a5 5 0 0 1 10 0 5 5 0 0 1 10 0c0 6.5-10 13-10 13Z" />
            </svg>
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

      // 2. Notification email via Edge Function (best-effort : le message est déjà
      // enregistré en base, l'utilisateur n'a pas à voir d'erreur si l'email rate).
      // On remonte quand même à Sentry — sinon un email cassé en permanence
      // signifierait des demandes de support jamais notifiées, sans aucun signal.
      supabase.functions.invoke('notify-support', {
        body: { name: name.trim(), email: email.trim(), type, message: message.trim() },
      }).catch(err => Sentry.captureException(err));

      setSent(true);
    } catch {
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
    <BottomSheet onClose={onClose} title={title} dark={dark} lang={lang}>
      <div style={{ padding: '8px 20px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: `${COURT.green}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
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
                  fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
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
function ProfileScreen({ t, setShowEditProfile, onOpenDetail, onShowNotifs, notifCount = 0, onOpenStreak = () => {}, onOpenStats = () => {} }) {
  const { user, profile, signOut, saveProfile }      = useAuth();
  const { lang, dark, level, confidence, setLang, toggleDark, setLevel } = usePrefs();
  const navigate = useNavigate();
  const matchHistory = useMatchHistory(lang);
  const fileInputRef = useRef(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
  // ── Évaluer un partenaire depuis le menu ────────────────────────────────────
  const [showEvalPicker,   setShowEvalPicker]   = useState(false);
  const [evalTarget,       setEvalTarget]       = useState(null); // { id, name, photo, matchId }
  const [showMenuEvalQuiz, setShowMenuEvalQuiz] = useState(false);
  const [menuEvalSending,  setMenuEvalSending]  = useState(false);
  const [menuEvalDone,     setMenuEvalDone]     = useState(false);
  const [showBlockedPlayers, setShowBlockedPlayers] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // ── Fetch partenaires pour l'évaluation depuis le menu ─────────────────────
  const { matches: evalMatches } = useUserMatches(lang);
  const { blockedProfiles, unblockUser } = useBlocks();

  const sendMenuEval = async (computedLevel) => {
    if (!evalTarget) return;
    setMenuEvalSending(true);
    try {
      await supabase.rpc('submit_peer_evaluation', {
        p_match_id:       evalTarget.matchId,
        p_evaluated_id:   evalTarget.id,
        p_proposed_level: Math.round(computedLevel * 2) / 2,
      });
      setMenuEvalDone(true);
      setTimeout(() => {
        setMenuEvalDone(false);
        setShowMenuEvalQuiz(false);
        setEvalTarget(null);
      }, 1800);
    } catch (err) {
      console.warn('[sendMenuEval]', err);
      setShowMenuEvalQuiz(false);
    }
    setMenuEvalSending(false);
  };

  // ─── Cooldown mensuel réévaluation ──────────────────────────────────────────
  // Désactivé UNIQUEMENT en développement local, pour enchaîner des tests sans
  // attendre le mois suivant. `import.meta.env.DEV` vaut false dans tout build
  // de production (Vite le remplace littéralement à la compilation), donc le
  // cooldown est toujours actif pour les utilisateurs réels.
  //
  // Ce drapeau était figé à `true`, y compris en production : n'importe qui
  // pouvait relancer son auto-évaluation en boucle jusqu'à tomber sur le
  // niveau qui l'arrange, ce qui vidait le confidence rate de son sens.
  //
  // ⚠️ Ce garde-fou reste PUREMENT CLIENT. La base n'impose rien : la policy
  // « Users can update own profile » autorise l'écriture de n'importe quelle
  // colonne de son propre profil, et trg_protect_sensitive_profile_columns ne
  // rétablit que is_admin, confidence_rate, matches_played et wins — ni `level`
  // ni `last_self_eval_date`. Un appel REST direct contourne donc entièrement
  // ce cooldown. Fermer cette voie demande une migration (cf. rapport).
  const EVAL_COOLDOWN_TESTING_DISABLED = import.meta.env.DEV;
  const lastEvalRaw  = profile?.last_self_eval_date;
  const lastEvalDate = lastEvalRaw ? new Date(lastEvalRaw) : null;
  const today        = new Date();
  const evalBlocked  = !EVAL_COOLDOWN_TESTING_DISABLED && lastEvalDate != null
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
  // null si aucun match — jamais 0% affiché sans données réelles (même règle
  // que usePlayers.js pour la liste des joueurs).
  const userWinRate = userMatches > 0 && profile?.wins != null
    ? Math.round((profile.wins / userMatches) * 100)
    : null;

  // ─── Trophées (mêmes règles que MatchesScreen, cf src/lib/badges.js) ────
  let longestStreak = 0, _runStreak = 0;
  for (const m of matchHistory) {
    if (m.result === 'win') { _runStreak += 1; longestStreak = Math.max(longestStreak, _runStreak); }
    else _runStreak = 0;
  }
  const badgeResults = computeBadges({ matchesPlayed: userMatches, streakMax: longestStreak, level: level ?? 0 });
  // Noms des trophées débloqués, plutôt qu'un compteur générique ("1 trophées")
  // qui n'apprenait rien sur ce qui a été gagné.
  const badgeNamesLabel = badgeResults
    .filter(b => b.unlocked)
    .map(b => t[BADGE_LABEL_KEY[b.key]])
    .filter(Boolean)
    .join(' · ');

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
      Sentry.captureException(err);
      setUploadError(err.message || 'Échec de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
      Sentry.captureException(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Pas de paddingBottom sur le conteneur défilant ci-dessous : le contenu
  // interne (padding '24px 24px 100px' plus bas) fournit déjà les 100px qui
  // dégagent la nav du bas. En cumuler ici en ajoutait 100 de plus, laissant
  // un vide défilable après le dernier lien.
  return (
    // paddingTop aligné sur le reste du fichier : max(56px, safe-area + 16px),
    // la même formule que l'en-tête de l'onglet Trouver (ligne ~867).
    // Il était monté à max(80px, safe-area + 40px) pour dégager le contour des
    // ronds d'action, mangé sous la barre d'état — mais la vraie cause était
    // ailleurs (bordure 0.5px invisible sur un arc, corrigée depuis en 1px
    // avec un fond blanc). Ces 40px laissaient ~99px de vide sur un iPhone à
    // encoche : une large bande crème avant « Bonjour ». 16px suffisent, comme
    // le prouvent les autres écrans qui l'utilisent déjà.
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 24px 16px' }}>
        <div>
          {/* Salutation selon l'heure : Bonjour (4h–17h) / Bonsoir (17h–4h) */}
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone }}>{getGreeting(lang)}</div>
          <div style={{ fontFamily: ff_serif, fontSize: 28, color: ink, fontStyle: rtl ? 'normal' : 'italic', fontWeight: 500, lineHeight: 1.1 }}>{userName || t.myProfile}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Série de jours */}
          <button onClick={onOpenStreak} aria-label={lang === 'he' ? 'רצף ימים' : lang === 'en' ? 'Streak' : 'Série de jours'} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            // Fond BLANC et non COURT.cream : le cream est exactement la
            // couleur de la page (#F5F1E8), le rond n'avait donc aucun
            // contraste de remplissage et n'existait que par sa bordure.
            background: dark ? COURT.darkCard : '#fff',
            // 1px et non 0.5 : sur un arc, une demi-ligne est étalée par
            // l'anti-crénelage là où le tracé devient horizontal — c.-à-d.
            // pile en haut et en bas du cercle — et une bordure déjà à 31%
            // d'opacité y devenait invisible. D'où un cercle qui paraissait
            // « coupé » en haut alors que rien ne le rognait : les côtés,
            // eux, restaient nets car le tracé y est vertical.
            border: `1px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><FlameSVG size={16} animated={false} /></button>
          <button onClick={() => setShowEditProfile(true)} aria-label={lang === 'he' ? 'ערוך פרופיל' : lang === 'en' ? 'Edit profile' : 'Modifier le profil'} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            // Fond BLANC et non COURT.cream : le cream est exactement la
            // couleur de la page (#F5F1E8), le rond n'avait donc aucun
            // contraste de remplissage et n'existait que par sa bordure.
            background: dark ? COURT.darkCard : '#fff',
            // 1px et non 0.5 : sur un arc, une demi-ligne est étalée par
            // l'anti-crénelage là où le tracé devient horizontal — c.-à-d.
            // pile en haut et en bas du cercle — et une bordure déjà à 31%
            // d'opacité y devenait invisible. D'où un cercle qui paraissait
            // « coupé » en haut alors que rien ne le rognait : les côtés,
            // eux, restaient nets car le tracé y est vertical.
            border: `1px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={() => setShowMenu(true)} aria-label={lang === 'he' ? 'תפריט' : lang === 'en' ? 'Menu' : 'Menu'} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            // Fond BLANC et non COURT.cream : le cream est exactement la
            // couleur de la page (#F5F1E8), le rond n'avait donc aucun
            // contraste de remplissage et n'existait que par sa bordure.
            background: dark ? COURT.darkCard : '#fff',
            // 1px et non 0.5 : sur un arc, une demi-ligne est étalée par
            // l'anti-crénelage là où le tracé devient horizontal — c.-à-d.
            // pile en haut et en bas du cercle — et une bordure déjà à 31%
            // d'opacité y devenait invisible. D'où un cercle qui paraissait
            // « coupé » en haut alors que rien ne le rognait : les côtés,
            // eux, restaient nets car le tracé y est vertical.
            border: `1px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button onClick={onShowNotifs} aria-label={lang === 'he' ? 'התראות' : lang === 'en' ? 'Notifications' : 'Notifications'} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 18,
            // Fond BLANC et non COURT.cream : le cream est exactement la
            // couleur de la page (#F5F1E8), le rond n'avait donc aucun
            // contraste de remplissage et n'existait que par sa bordure.
            background: dark ? COURT.darkCard : '#fff',
            // 1px et non 0.5 : sur un arc, une demi-ligne est étalée par
            // l'anti-crénelage là où le tracé devient horizontal — c.-à-d.
            // pile en haut et en bas du cercle — et une bordure déjà à 31%
            // d'opacité y devenait invisible. D'où un cercle qui paraissait
            // « coupé » en haut alors que rien ne le rognait : les côtés,
            // eux, restaient nets car le tracé y est vertical.
            border: `1px solid ${border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? COURT.darkText : COURT.green,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <NotifBadge count={notifCount} />
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
          {/* Avatar tappable pour l'agrandir — le bouton 📷 séparé sert à la changer */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              onClick={() => !uploading && userPhoto && setLightboxOpen(true)}
              style={{
                width: 72, height: 72, borderRadius: 36,
                background: userPhoto ? `url(${userPhoto}) center/cover` : `${COURT.green}30`,
                border: `2.5px solid ${bg}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                cursor: uploading ? 'wait' : (userPhoto ? 'pointer' : 'default'),
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
              marginTop: 6, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, color: dark ? COURT.rustOnDark : COURT.rust,
            }}>{uploadError}</div>
          )}
          <div style={{ marginTop: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontFamily: ff_serif, fontSize: 24, color: ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic', minWidth: 0 }}>{userName}</div>
              {/* Niveau démarqué à côté du nom — c'est le chiffre qui compte le
                  plus sur ce profil, il n'a plus besoin d'une carte à part.
                  Libellé "Niveau" au-dessus : le chiffre seul ne dit pas de quoi
                  il s'agit. */}
              {level != null && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 600, color: stone,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {lang === 'en' ? 'Level' : lang === 'he' ? 'רמה' : 'Niveau'}
                  </div>
                  <div style={{ fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 40, color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1 }}>
                    {level.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone }}>{userCity} · 2026</div>
            {/* Trophées sur leur propre ligne, pleine largeur : avec 3-4 badges
                débloqués, ça a besoin de place pour respirer plutôt que de se
                comprimer à droite du nom. tappable=false : le libellé est déjà
                affiché en permanence via `label`, pas besoin d'une bulle au tap. */}
            {badgeNamesLabel && (
              <div style={{ marginTop: 10 }}>
                <BadgeRow badges={badgeResults} dark={dark} t={t} label={badgeNamesLabel} tappable={false} />
              </div>
            )}
          </div>
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
                  <div key={i} style={{ padding: '8px 4px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Mulish', fontSize: lang === 'he' ? 11 : 8, fontWeight: 700, color: stone, whiteSpace: 'nowrap' }}>{s.label}</div>
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Le niveau est maintenant affiché à côté du nom, en haut —
                 cette rangée ne montre plus que les trois stats secondaires :
                 % de victoire, matchs joués, indice de confiance. */
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {[
                { label: lang === 'en' ? 'Win rate' : lang === 'he' ? 'אחוז ניצחונות' : '% de victoire',
                  value: userWinRate != null ? `${userWinRate}%` : '—' },
                { label: t.matchesPlayed, value: userMatches },
                { label: t.confidence, value: `${confidence}%` },
              ].map((s, i) => (
                <div key={i} style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 600, color: stone,
                    letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center',
                  }}>{s.label}</div>
                  <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 24px 100px' }}>

        {/* ════ MON PROFIL ════ */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeading italic={!rtl}>
            {lang === 'fr' ? 'Mon profil' : lang === 'en' ? 'My profile' : 'הפרופיל שלי'}
          </SectionHeading>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {lang==='fr' ? 'Région' : lang==='en' ? 'Region' : 'אזור'}
            </span>
            <span style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize: 14, color:stone }}>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {t.likesReceived || 'Likes reçus'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>

        <div style={{ margin: '22px 0 8px' }}>
          <SectionHeading italic={!rtl}>
            {lang==='fr' ? 'Mon jeu' : lang==='en' ? 'My game' : 'המשחק שלי'}
          </SectionHeading>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
              {t.partnerPrefsTitle || 'Le partenaire idéal'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Réévaluer mon niveau */}
          <div
            onClick={evalBlocked ? undefined : () => setShowReEvalConfirm(true)}
            style={{
              display:'flex', gap:14, padding:'14px 16px',
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
              <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Réévaluer mon niveau' : lang==='en' ? 'Re-evaluate my level' : 'הערך מחדש'}
              </span>
              <span style={{ fontFamily:ff_italic, fontStyle:'italic', fontSize: 14, color:stone }}>
                {level?.toFixed?.(1) ?? '—'}
              </span>
              {!evalBlocked && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              )}
            </div>
            {evalBlocked && nextEvalStr && (
              <div style={{
                fontFamily:'Mulish', fontSize: 13, color:stone,
                letterSpacing:'0.06em', paddingLeft:48, paddingBottom:2,
              }}>
                {lang==='fr' ? `Disponible le ${nextEvalStr}` : lang==='en' ? `Available on ${nextEvalStr}` : `זמין מ-${nextEvalStr}`}
              </div>
            )}
          </div>
        </div>

        <div style={{ margin: '22px 0 8px' }}>
          <SectionHeading italic={!rtl}>
            {lang==='fr' ? 'Application' : lang==='en' ? 'App' : 'אפליקציה'}
          </SectionHeading>
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
              <div style={{ fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Langue' : lang==='en' ? 'Language' : 'שפה'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color:stone, marginTop:1 }}>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>{t.darkMode}</span>
            <div style={{ width:44, height:24, borderRadius:12, background: dark ? COURT.green : `${stone}50`,
              position:'relative', transition:'background 0.3s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left: dark ? 22 : 2, width:20, height:20,
                borderRadius:10, background:'#fff', transition:'left 0.3s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>

        <div style={{ margin: '22px 0 8px' }}>
          <SectionHeading italic={!rtl}>
            {lang==='fr' ? 'Aide & légal' : lang==='en' ? 'Help & legal' : 'עזרה'}
          </SectionHeading>
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
              <div style={{ fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Aide & support' : lang==='en' ? 'Help & support' : 'עזרה ותמיכה'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color:stone, marginTop:1 }}>
                {lang==='fr' ? 'Nous contacter' : lang==='en' ? 'Contact us' : 'צור קשר'}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* Confidentialité */}
          <div onClick={() => navigate('/privacy')} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5Z"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? 'Confidentialité' : lang==='en' ? 'Privacy' : 'פרטיות'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color:stone, marginTop:1 }}>
                {lang==='fr' ? 'Politique de confidentialité' : lang==='en' ? 'Privacy policy' : 'מדיניות פרטיות'}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>

          {/* CGU / Conditions d'utilisation */}
          <div onClick={() => navigate('/terms')} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', cursor:'pointer', borderTop:`0.5px solid ${border}` }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${COURT.green}0E`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:ff_serif, fontSize: 19, color:ink, fontStyle: rtl ? 'normal' : 'italic' }}>
                {lang==='fr' ? "Conditions d'utilisation" : lang==='en' ? 'Terms of use' : 'תנאי שימוש'}
              </div>
              <div style={{ fontFamily:ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color:stone, marginTop:1 }}>
                {lang==='fr' ? 'CGU & règles de la communauté' : lang==='en' ? 'Terms & community rules' : 'תנאים וכללי קהילה'}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stone} strokeWidth="1.4" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>

        <div style={{ margin: '22px 0 8px' }}>
          <SectionHeading italic={!rtl}>
            {lang==='fr' ? 'Compte' : lang==='en' ? 'Account' : 'חשבון'}
          </SectionHeading>
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
            <span style={{ flex:1, fontFamily:ff_serif, fontSize: 19, color:COURT.red, fontStyle: rtl ? 'normal' : 'italic' }}>
              {lang==='fr' ? 'Se déconnecter' : lang==='he' ? 'התנתק' : 'Sign out'}
            </span>
          </div>
        </div>

        {/* Supprimer le compte — RGPD */}
        {!showDeleteConfirm ? (
          <div onClick={() => setShowDeleteConfirm(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            marginTop:14, color:`${COURT.red}80`, fontFamily:ff_italic, fontStyle:'italic',
            fontSize: 13, cursor:'pointer', paddingBottom:20 }}>
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
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.darkText : COURT.ink, lineHeight: 1.5, opacity: 0.8 }}>
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
            style={{ fontFamily:'Mulish', fontSize: 13, color:stone, opacity:0.5,
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
          dark={dark} lang={lang}
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
                label: lang === 'fr' ? 'Partenaire idéal' : lang === 'en' ? 'Ideal partner' : 'שותף אידיאלי',
                sub: lang === 'fr' ? 'Définir mes préférences' : lang === 'en' ? 'Set your preferences' : 'הגדר העדפות',
                action: () => { setShowMenu(false); setShowPartnerPrefs(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><circle cx="12" cy="12" r="4"/></svg>,
                label: lang === 'fr' ? 'Ré-évaluer mon niveau' : lang === 'en' ? 'Re-assess my level' : 'הערך מחדש את הרמה',
                sub: lang === 'fr' ? 'Refaire le quiz (1×/mois)' : lang === 'en' ? 'Retake the quiz (1×/month)' : 'בצע מחדש את החידון',
                action: () => { setShowMenu(false); setShowReEvalConfirm(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                label: lang === 'fr' ? 'Évaluer un partenaire' : lang === 'en' ? 'Rate a partner' : 'דרג שחקן',
                sub: lang === 'fr' ? 'Évaluer le niveau d\'un joueur' : lang === 'en' ? 'Rate a player\'s level' : 'הערך רמת שחקן',
                action: () => { setShowMenu(false); setShowEvalPicker(true); },
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                label: lang === 'fr' ? 'Mes statistiques' : lang === 'en' ? 'My statistics' : 'הסטטיסטיקות שלי',
                sub: lang === 'fr' ? 'Progression, victoires, série' : lang === 'en' ? 'Progress, wins, streak' : 'התקדמות, נצחונות',
                action: () => { setShowMenu(false); onOpenStats?.(); },
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
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>,
                label: lang === 'fr' ? 'Joueurs bloqués' : lang === 'en' ? 'Blocked players' : 'שחקנים חסומים',
                sub: blockedProfiles.length > 0 ? `${blockedProfiles.length} ${lang === 'fr' ? 'bloqué(s)' : lang === 'en' ? 'blocked' : 'חסומים'}` : (lang === 'fr' ? 'Aucun' : lang === 'en' ? 'None' : 'אף אחד'),
                action: () => { setShowMenu(false); setShowBlockedPlayers(true); },
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
                  background: 'transparent', border: 'none',
                  borderBottom: i < 7 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '18'}` : 'none',
                  cursor: 'pointer', textAlign: rtl ? 'right' : 'left',
                  animation: `cardIn 0.3s ease ${i * 0.05}s both`,
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? COURT.darkCard : `${COURT.green}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontSize: 17, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic' }}>{item.label}</div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.darkMuted : COURT.stone, marginTop: 2 }}>{item.sub}</div>
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

      {/* BottomSheet : Liste des joueurs bloqués */}
      {showBlockedPlayers && (
        <BottomSheet
          onClose={() => setShowBlockedPlayers(false)}
          title={lang === 'fr' ? 'Joueurs bloqués' : lang === 'en' ? 'Blocked players' : 'שחקנים חסומים'}
          dark={dark} lang={lang}
        >
          <div style={{ padding: '4px 20px 32px' }}>
            {(!blockedProfiles || blockedProfiles.length === 0) ? (
              <p style={{ fontFamily: 'Mulish', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>
                {lang === 'fr' ? 'Aucun joueur bloqué.' : lang === 'en' ? 'No blocked players.' : 'אין שחקנים חסומים.'}
              </p>
            ) : blockedProfiles.map((bp, i) => (
              <div
                key={bp.id}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 0',
                  borderBottom: i < blockedProfiles.length - 1 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '18'}` : 'none',
                }}
              >
                <img
                  src={bp.photo_url || 'https://via.placeholder.com/48'}
                  alt={bp.name}
                  style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontSize: 15, color: dark ? COURT.darkText : COURT.ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic' }}>{bp.name}</div>
                  <div style={{ fontFamily: 'Mulish', fontSize: 13, color: dark ? COURT.darkMuted : COURT.stone, marginTop: 2 }}>
                    {bp.level ? `Niveau ${bp.level}` : 'Niveau non défini'} · {bp.region || bp.city || '—'}
                  </div>
                </div>
                <button
                  disabled={unblockingId === bp.id}
                  onClick={async () => {
                    setUnblockingId(bp.id);
                    await unblockUser(bp.id);
                    setUnblockingId(null);
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: dark ? COURT.darkCard : `${COURT.green}15`,
                    border: `0.5px solid ${COURT.green}50`,
                    color: dark ? COURT.greenOnDark : COURT.green,
                    fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
                    cursor: unblockingId === bp.id ? 'default' : 'pointer',
                    opacity: unblockingId === bp.id ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {unblockingId === bp.id ? '…' : lang === 'fr' ? 'Débloquer' : lang === 'en' ? 'Unblock' : 'בטל חסימה'}
                </button>
              </div>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* BottomSheet : Sélection du joueur à évaluer */}
      {showEvalPicker && (
        <BottomSheet
          onClose={() => setShowEvalPicker(false)}
          title={lang === 'fr' ? 'Choisir un joueur' : lang === 'en' ? 'Choose a player' : 'בחר שחקן'}
          dark={dark} lang={lang}
        >
          <div style={{ padding: '4px 20px 32px' }}>
            {(!evalMatches || evalMatches.length === 0) ? (
              <p style={{ fontFamily: 'Mulish', fontSize: 14, color: stone, textAlign: 'center', padding: '20px 0' }}>
                {lang === 'fr' ? 'Joue d\'abord un match pour évaluer un partenaire.' : lang === 'en' ? 'Play a match first to rate a partner.' : 'שחק משחק קודם כדי לדרג שחקן.'}
              </p>
            ) : evalMatches.map((m, i) => (
              <button
                key={m.matchId}
                onClick={() => {
                  setEvalTarget({ ...m.player, matchId: m.matchId });
                  setShowEvalPicker(false);
                  setShowMenuEvalQuiz(true);
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 0',
                  background: 'transparent', border: 'none',
                  borderBottom: i < evalMatches.length - 1 ? `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '18'}` : 'none',
                  cursor: 'pointer', textAlign: rtl ? 'right' : 'left',
                }}
              >
                <img
                  src={m.player.photo}
                  alt={m.player.name}
                  style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${COURT.green}30` }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: ff_serif, fontSize: 15, color: ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic' }}>{m.player.name}</div>
                  {m.player.level && (
                    <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 1 }}>
                      {lang === 'fr' ? `Niveau ${m.player.level}` : lang === 'en' ? `Level ${m.player.level}` : `רמה ${m.player.level}`}
                    </div>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COURT.green} strokeWidth="1.5" strokeLinecap="round">
                  {rtl ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
                </svg>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Overlay quiz : évaluer le niveau d'un partenaire depuis le menu */}
      {showMenuEvalQuiz && evalTarget && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: dark ? COURT.darkBg : COURT.cream,
        }}>
          {/* Header */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            paddingTop: 'max(52px, env(safe-area-inset-top, 0px))',
            padding: `max(52px, env(safe-area-inset-top, 0px)) 16px 8px`,
            background: dark ? COURT.darkBg : COURT.cream,
            borderBottom: `0.5px solid ${border}`,
            zIndex: 51, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <button onClick={() => { setShowMenuEvalQuiz(false); setEvalTarget(null); }} aria-label={lang === 'he' ? 'סגור' : lang === 'en' ? 'Close' : 'Fermer'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? COURT.greenOnDark : COURT.green, padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={evalTarget.photo}
                alt={evalTarget.name}
                style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', border: `1.5px solid ${COURT.green}40` }}
              />
              <div>
                <div style={{ fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500, fontStyle: rtl ? 'normal' : 'italic' }}>
                  {lang === 'fr' ? `Évaluer ${evalTarget.name}` : lang === 'en' ? `Rate ${evalTarget.name}` : `דרג את ${evalTarget.name}`}
                </div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone }}>
                  {lang === 'fr' ? 'Réponds en pensant à son niveau' : lang === 'en' ? 'Answer thinking about their level' : 'ענה לפי הרמה שלו/ה'}
                </div>
              </div>
            </div>
          </div>

          <QuizScreen
            t={t} lang={lang} dark={dark}
            playerFirstName={evalTarget.name?.split(' ')[0] || ''}
            onDone={(computedLevel) => sendMenuEval(computedLevel)}
            onBack={() => { setShowMenuEvalQuiz(false); setEvalTarget(null); }}
          />

          {/* Spinner pendant l'envoi */}
          {menuEvalSending && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
            }}>
              <div style={{
                width: 48, height: 48, border: `3px solid ${COURT.cream}40`,
                borderTop: `3px solid ${COURT.cream}`,
                borderRadius: 24, animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          )}

          {/* Succès */}
          {menuEvalDone && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
            }}>
              <div style={{
                background: dark ? COURT.darkCard : COURT.cream,
                borderRadius: 20, padding: '28px 32px', textAlign: 'center',
                boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><StarIcon size={40} color={COURT.gold} filled /></div>
                <div style={{ fontFamily: ff_serif, fontSize: 18, color: dark ? COURT.greenOnDark : COURT.green, fontWeight: 700, fontStyle: rtl ? 'normal' : 'italic' }}>
                  {lang === 'fr' ? 'Évaluation envoyée !' : lang === 'en' ? 'Rating sent!' : 'הערכה נשלחה!'}
                </div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 6 }}>
                  {lang === 'fr' ? `Merci pour ton retour sur ${evalTarget.name}` : lang === 'en' ? `Thanks for rating ${evalTarget.name}` : `תודה על הדירוג של ${evalTarget.name}`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BottomSheet : Choix de la langue */}
      {showLangPicker && (
        <BottomSheet
          onClose={() => setShowLangPicker(false)}
          title={lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'שפה'}
          dark={dark} lang={lang}
        >
          <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { code: 'fr', flag: '🇫🇷', label: 'Français' },
              { code: 'en', flag: '🇬🇧', label: 'English' },
              { code: 'he', flag: '🇮🇱', label: 'עברית' },
            ].map(({ code, flag, label }) => (
              <LangButton
                key={code}
                code={code}
                flag={flag}
                label={label}
                onSelect={(c) => { setLang(c); setShowLangPicker(false); }}
              />
            ))}
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
          dark={dark} lang={lang}
        >
          <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 4 }}>
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
              <div style={{ fontFamily: 'Mulish', fontSize: 13, fontWeight: 600, color: dark ? COURT.darkMuted : COURT.stone }}>
                {lang==='fr' ? 'Attention' : lang==='en' ? 'Warning' : 'שים לב'}
              </div>
            </div>
            {/* Titre */}
            <div style={{ fontFamily: 'Spectral, serif', fontSize: 20, fontStyle: rtl ? 'normal' : 'italic', color: dark ? COURT.darkText : COURT.ink, textAlign: 'center', marginBottom: 12, lineHeight: 1.4 }}>
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
            {/* Info : la ré-éval ne touche PAS l'indice de confiance */}
            <div style={{
              background: `${COURT.gold}14`, border: `0.5px solid ${COURT.gold}45`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 22,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COURT.gold} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div style={{ fontFamily: 'Mulish', fontSize: 13.5, color: dark ? COURT.darkText : COURT.ink, lineHeight: 1.55 }}>
                {lang==='fr'
                  ? 'Ton niveau sera mis à jour selon tes réponses. Ton indice de confiance n\'est pas affecté.'
                  : lang==='en'
                  ? 'Your level will be updated from your answers. Your confidence index is not affected.'
                  : 'הרמה שלך תעודכן לפי התשובות. מדד האמינות שלך לא יושפע.'}
              </div>
            </div>
            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReEvalConfirm(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'transparent', border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
                  fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 15,
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
                  fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 15,
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
              // L'indice de confiance ne baisse JAMAIS : il n'est plus piloté ici.
              // Il évolue uniquement côté serveur via submit_peer_evaluation (accord
              // des pairs) et confirm_match_result (matchs de niveau similaire).
              // On ne touche donc plus à confidence_rate lors de la ré-évaluation.
              // Enregistre le niveau + un point d'historique IMMÉDIATEMENT (robuste
              // même si la sauvegarde DB échoue : réseau coupé, etc.)
              setLevel(computedLevel);
              // Sauvegarde level + cooldown en une seule écriture DB
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
                  fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                  fontSize: 14, color: dark ? COURT.darkMuted : COURT.stone, marginBottom: 12,
                }}>
                  {lang === 'fr' ? 'Niveau mis à jour' : lang === 'en' ? 'Level updated' : 'הרמה עודכנה'}
                </div>
                <div style={{
                  fontFamily: 'Spectral, serif', fontSize: TYPE.giant,
                  color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1,
                  animation: 'levelPop 0.8s cubic-bezier(.2,.9,.3,1.4)',
                }}>
                  {reEvalDone.toFixed(1)}
                  <span style={{ fontSize: 28, color: dark ? COURT.darkMuted : COURT.stone, fontStyle: rtl ? 'normal' : 'italic', fontFamily: 'Spectral, serif' }}>/7.0</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <PhotoLightbox src={lightboxOpen ? userPhoto : null} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}

// Rangée de chips — définie au niveau module (et non dans le render de
// PartnerPrefsSheet) : un composant recréé à chaque rendu est vu par React comme
// un TYPE différent, ce qui démonte/remonte les <button> à chaque frappe.
function ChipRow({ label, value, options, onChange, dark, rtl }) {
  const ink       = dark ? COURT.darkText  : COURT.ink;
  const stone     = dark ? COURT.darkMuted : COURT.stone;
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif';
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontFamily: 'Mulish', fontSize: 13, color: stone,
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
}

// ─── PartnerPrefs Sheet (Chantier 4) ─────────────────────────────────────────
function PartnerPrefsSheet({ t, lang, dark, initial, onSave, onClose }) {
  const rtl   = lang === 'he';
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

  const submit = async () => {
    setSaving(true);
    await onSave(prefs);
    setSaving(false);
  };

  return (
    <BottomSheet onClose={onClose} title={t.partnerPrefsTitle || 'Le partenaire idéal'} dark={dark} lang={lang}>
      <div style={{ padding: '8px 20px 20px' }}>
        <p style={{
          fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 13, color: stone, marginTop: 0, marginBottom: 18,
          textAlign: 'center',
        }}>
          {t.partnerPrefsHint || 'Décris qui tu cherches comme partenaire'}
        </p>

        <ChipRow
          dark={dark} rtl={rtl}
          label={t.hand || 'Main'} value={prefs.hand}
          onChange={(v) => setPrefs(p => ({ ...p, hand: v }))}
          options={[
            { value: 'any',   label: t.anyHand   || t.anySide || 'Indifférent' },
            { value: 'right', label: t.rightHand || 'Droitier' },
            { value: 'left',  label: t.leftHand  || 'Gaucher' },
          ]}
        />

        <ChipRow
          dark={dark} rtl={rtl}
          label={t.side || 'Côté'} value={prefs.side}
          onChange={(v) => setPrefs(p => ({ ...p, side: v }))}
          options={[
            { value: 'any',      label: t.anySide || 'Indifférent' },
            { value: 'forehand', label: t.forehand || 'Droite' },
            { value: 'backhand', label: t.backhand || 'Gauche' },
          ]}
        />

        <ChipRow
          dark={dark} rtl={rtl}
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
          dark={dark} rtl={rtl}
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
          dark={dark} rtl={rtl}
          label={t.region || 'Région'} value={prefs.region}
          onChange={(v) => setPrefs(p => ({ ...p, region: v }))}
          // Dérivé de SUB_REGIONS, comme à l'inscription (PartnerPrefsScreen).
          // Ce panneau et celui de l'onboarding sont deux implémentations du
          // MÊME réglage : c'est ainsi qu'ils avaient divergé, tous deux
          // proposant « Eilat », qui n'est une sous-région d'aucun profil et
          // rendait donc la préférence impossible à satisfaire, en silence.
          options={[
            { value: 'any', label: t.anySide || 'Indifférent' },
            ...SUB_REGIONS['Israël'].map(r => ({ value: r, label: r })),
          ]}
        />

        {/* Plage de niveau */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'Mulish', fontSize: 13, color: stone,
            marginBottom: 8, fontWeight: 600,
          }}>{t.levelRange || 'Plage de niveau'}</div>
          {/* dir="ltr" explicite : RangeBar positionne ses poignées en pixels
              physiques (clientX - rect.left), toujours min à gauche / max à
              droite, quel que soit `lang` — comme PadelSlider. Sans ce dir,
              `justifyContent: space-between` inversait l'ordre MIN/MAX en
              hébreu (dir hérité de l'écran), désynchronisant les libellés
              du curseur physiquement fixe juste en dessous : MIN se
              retrouvait au-dessus de la poignée MAX, et inversement. */}
          <div dir="ltr" style={{
            background: dark ? COURT.darkCard : '#FBF9F4',
            border: `0.5px solid ${dark ? COURT.darkBorder : `${COURT.green}25`}`,
            borderRadius: 12, padding: '14px 16px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 3 }}>
                  {lang === 'en' ? 'MIN' : lang === 'he' ? 'מינ׳' : 'MIN'}
                </div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 26, color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1 }}>
                  {Number.isInteger(prefs.levelMin) ? prefs.levelMin : prefs.levelMin.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 3 }}>
                  {lang === 'en' ? 'MAX' : lang === 'he' ? 'מקס׳' : 'MAX'}
                </div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: 26, color: dark ? COURT.greenOnDark : COURT.green, lineHeight: 1 }}>
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
  const border= dark ? COURT.darkBorder : `${COURT.green}25`;
  const ink   = dark ? COURT.darkText : COURT.ink;
  const stone = dark ? COURT.darkMuted : COURT.stone;
  const iconMap = {
    match: <PadelBall size={17} shadow={false} />,
    eval:  <StarIcon size={16} color={COURT.cream} />,
    level: <TrendUpIcon size={16} color={COURT.cream} />,
  };

  return (
    <BottomSheet onClose={onClose} title={t.notifications} dark={dark} lang={lang}>
      {notifications.length === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: stone, fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 15 }}>{t.noNotifs}</div>
      ) : notifications.map((n) => {
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
              <div style={{ width: 40, height: 40, borderRadius: 20, background: COURT.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {iconMap[n.type] || <BellIcon size={16} color={COURT.cream} />}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 14, color: ink, lineHeight: 1.4 }}>{n.text[lang] || n.text.fr}</div>
              <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 2 }}>{n.time}</div>
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
function ScheduleMatchSheet({ lang, dark, onClose, onProposalSent, initialPartnerId }) {
  const { user } = useAuth();
  const { partners: userMatches } = useMatchPartnersQuick(lang);  // ⚡ Quick load sans messages
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
      dark={dark} lang={lang}
    >
      <div style={{ padding: '4px 20px 28px' }}>

        {/* ── Choix du partenaire ─────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 10 }}>
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
                    borderRadius: 10, cursor: 'pointer', textAlign: rtl ? 'right' : 'left',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0, background: `url(${m.player.photo}) center/cover`, border: isSel ? `2px solid ${COURT.green}` : `0.5px solid ${border}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ff_serif, fontSize: 16, color: ink, fontWeight: 500 }}>{m.player.name}</div>
                    </div>
                    {isSel && <div style={{ color: dark ? COURT.greenOnDark : COURT.green, fontSize: 18, fontWeight: 700 }}>✓</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Date + Heure ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 10 }}>
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
        <div style={{ marginTop: 12, fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, textAlign: 'center' }}>
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
  const { profile, isGuest, signInWithGoogle, refreshProfile } = useAuth();
  const { lang, dark: darkMode, level, confidence, setLevel, setConfidence } = usePrefs();
  const t = I18N[lang] || I18N.fr;

  // On s'ouvre TOUJOURS sur Trouver — la valeur du produit est là, pas dans
  // un formulaire de profil. Un profil incomplet est signalé par le bandeau
  // ProfileNudge en haut de Trouver, sans jamais imposer le détour.
  const [tab, setTab] = useState('search');
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  const [showPending,  setShowPending]  = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showStreak,      setShowStreak]      = useState(false);
  // LearnScreen (module d'apprentissage) était construit — 646 lignes, leçons/
  // quiz/étoiles — mais jamais importé ni accessible nulle part dans l'app.
  // Ouvert en overlay depuis l'écran "Conseil" (onglet `learn`, qui affiche en
  // réalité HomeScreen), au même titre que showStreak.
  const [showLearn,       setShowLearn]       = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  // Signal pour ouvrir directement les stats (depuis le menu "Mes statistiques")
  const [statsSignal, setStatsSignal] = useState(0);

  // Les invités peuvent naviguer librement — on bloque seulement les ACTIONS
  // (like, message) au niveau de chaque composant, pas la navigation entre onglets.
  const handleTabChange = (newTab) => {
    // L'onglet profil sans compte → ouvre la modal de connexion
    if (isGuest && newTab === 'profile') {
      setShowGuestModal(true);
      return;
    }
    // LearnScreen n'a pas de zIndex au-dessus de BottomNav (contrairement à
    // StreakScreen/DetailedProfileModal, qui bloquent volontairement la nav
    // tant qu'ils sont ouverts) : le clic sur un onglet changeait bien `tab`
    // en interne, mais LearnScreen restait affiché par-dessus sans jamais se
    // fermer — l'utilisateur voyait le bouton s'activer sans que l'écran
    // change. Un changement d'onglet explicite doit le refermer.
    if (showLearn) setShowLearn(false);
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
    tickStreak(profile.id)
      .then(() => refreshProfile())   // rafraîchit profile.streak_current en mémoire
      .catch(err => Sentry.captureException(err));
  }, [profile?.id]);

  // Sync le niveau depuis la DB vers le state React (ex: connexion depuis un nouvel appareil)
  useEffect(() => {
    if (profile === undefined || profile === null) return;
    const dbLevel = profile.level ?? null;
    const localLevel = level;
    const differ = dbLevel !== localLevel && (dbLevel == null || localLevel == null || Math.abs(dbLevel - localLevel) > 0.01);
    if (differ) setLevel(dbLevel);
  }, [profile?.level]);

  // Sync confidence_rate depuis la DB vers le state React — même logique que le niveau.
  // Les évaluations de partenaires (submit_peer_evaluation) modifient confidence_rate en DB ;
  // ce useEffect s'assure que ce qui est affiché reflète la vraie valeur du serveur.
  useEffect(() => {
    if (profile === undefined || profile === null) return;
    const dbConf = profile.confidence_rate != null ? Math.round(Number(profile.confidence_rate)) : null;
    if (dbConf !== null && dbConf !== confidence) setConfidence(dbConf);
  }, [profile?.confidence_rate]);

  // Notifications temps réel depuis Supabase
  const { notifications, markRead, markAllRead } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Total des messages non lus toutes conversations confondues → badge rouge onglet Chat
  const { matches: chatMatches } = useUserMatches(lang);
  // Compte des PERSONNES, pas des messages : cinq messages non lus d'un même
  // interlocuteur affichent « 1 ». Cf. src/lib/unread.js pour le détail.
  const chatUnread = compterPersonnesNonLues(chatMatches);

  const bellProps = { onShowNotifs: () => setShowNotifs(true), notifCount: unreadCount };

  // Ce qui manque au profil, pour le bandeau en haut de Trouver. On ne
  // retient que les 3 champs qui pèsent réellement sur la mise en relation :
  // sans photo on se fait passer, sans niveau le score de compatibilité est
  // aveugle, sans bio l'autre n'a rien à lire pour se décider.
  // Les invités n'ont pas de profil à compléter — le bandeau les enverrait
  // vers un écran que handleTabChange leur bloque de toute façon.
  const profilManques = isGuest ? [] : [
    !profile?.photo_url && (lang === 'he' ? 'תמונה' : lang === 'en' ? 'Photo' : 'Photo'),
    profile?.level == null && (lang === 'he' ? 'רמה' : lang === 'en' ? 'Level' : 'Niveau'),
    !(profile?.bio_fr || profile?.bio_en || profile?.bio_he) &&
      (lang === 'he' ? 'תיאור' : lang === 'en' ? 'Bio' : 'Bio'),
  ].filter(Boolean);

  const screens = {
    search:  <SearchFlow    t={t} lang={lang} dark={darkMode} userLevel={level} onNavigateChat={() => setTab('chat')} onOpenDetail={setDetailPlayerId} isGuest={isGuest} onGuestAction={onGuestAction} profilManques={profilManques} onCompleterProfil={() => setTab('profile')} {...bellProps} />,
    home:    <HomeScreen    lang={lang} dark={darkMode} onOpenLearn={() => setShowLearn(true)} {...bellProps} />,
    chat:    <ChatScreen    t={t} lang={lang} dark={darkMode} onOpenDetail={setDetailPlayerId} isGuest={isGuest} onGuestAction={onGuestAction} onStartMatch={() => setShowSchedule(true)} {...bellProps} />,
    trophy:  <MatchesScreen t={t} lang={lang} level={level} dark={darkMode} statsSignal={statsSignal} onSchedule={(id) => { setScheduleTargetId(id || null); setShowSchedule(true); }} {...bellProps} />,
    profile: <ProfileScreen t={t} showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile} onOpenDetail={setDetailPlayerId} onOpenStreak={() => setShowStreak(true)} onOpenStats={() => { setStatsSignal(s => s + 1); setTab('trophy'); }} {...bellProps} />,
  };

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
          fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 13,
          boxShadow: '0 2px 8px rgba(15,61,41,0.25)', animation: 'notifPop 0.4s ease',
        }}>
          <PadelBall size={14} shadow={false} />
          <span>{pendingCount} {pendingCount > 1 ? 'scores' : 'score'}</span>
        </button>
      )}

      {/* Le bouton « Démarrer un match » est désormais dans l'onglet Messages (ChatScreen). */}

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

      {showLearn && (
        <LearnScreen lang={lang} dark={darkMode} onClose={() => setShowLearn(false)} />
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
