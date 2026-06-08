import { useState, useRef, useEffect, useCallback } from 'react'
import { COURT, PadelBall, Ornament } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'

// ─── Labels i18n ─────────────────────────────────────────────────────────────
const L = {
  fr: {
    title:      'Le partenaire idéal',
    subtitle:   'Décris qui tu cherches comme partenaire de jeu.',
    hand:       'Main',
    side:       'Côté',
    style:      'Style',
    motivation: 'Motivation',
    region:     'Région',
    levelRange: 'Plage de niveau',
    any:        'Indifférent',
    right:      'Droitier',
    left:       'Gaucher',
    forehand:   'Droite',
    backhand:   'Gauche',
    aggressive: 'Offensif',
    defensive:  'Défensif',
    allcourt:   'Polyvalent',
    fun:        'Le plaisir',
    improve:    'Progresser',
    compete:    'Compétition',
    submit:     'Entrer au club',
  },
  en: {
    title:      'Ideal partner',
    subtitle:   'Describe the partner you\'re looking for.',
    hand:       'Hand',
    side:       'Side',
    style:      'Style',
    motivation: 'Motivation',
    region:     'Region',
    levelRange: 'Level range',
    any:        'Any',
    right:      'Right-handed',
    left:       'Left-handed',
    forehand:   'Forehand',
    backhand:   'Backhand',
    aggressive: 'Aggressive',
    defensive:  'Defensive',
    allcourt:   'All-court',
    fun:        'For fun',
    improve:    'Improve',
    compete:    'Compete',
    submit:     'Enter the club',
  },
  he: {
    title:      'השותף האידיאלי',
    subtitle:   'תאר את השותף שאתה מחפש.',
    hand:       'יד',
    side:       'צד',
    style:      'סגנון',
    motivation: 'מוטיבציה',
    region:     'אזור',
    levelRange: 'טווח רמה',
    any:        'לא משנה',
    right:      'ימני',
    left:       'שמאלי',
    forehand:   'פורהנד',
    backhand:   'בקהנד',
    aggressive: 'תוקפני',
    defensive:  'הגנתי',
    allcourt:   'רב-גוני',
    fun:        'הנאה',
    improve:    'שיפור',
    compete:    'תחרות',
    submit:     'כניסה למועדון',
  },
}

// ─── RangeBar ─────────────────────────────────────────────────────────────────
function RangeBar({ min, max, step, valueMin, valueMax, onChange, dark }) {
  const trackRef  = useRef(null)
  const dragRef   = useRef(null)
  const vMinRef   = useRef(valueMin)
  const vMaxRef   = useRef(valueMax)
  vMinRef.current = valueMin
  vMaxRef.current = valueMax

  const snapToStep = useCallback((v) =>
    Math.round((v - min) / step) * step + min,
  [min, step])

  const valueFromClient = useCallback((clientX) => {
    if (!trackRef.current) return null
    const rect = trackRef.current.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return snapToStep(min + pct * (max - min))
  }, [min, max, snapToStep])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const val = valueFromClient(clientX)
      if (val === null) return
      if (dragRef.current === 'min') onChange(Math.min(val, vMaxRef.current - step), vMaxRef.current)
      else onChange(vMinRef.current, Math.max(val, vMinRef.current + step))
    }
    const onEnd = () => { dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onEnd)
    window.addEventListener('touchmove',   onMove, { passive: false })
    window.addEventListener('touchend',    onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onEnd)
      window.removeEventListener('touchmove',   onMove)
      window.removeEventListener('touchend',    onEnd)
    }
  }, [onChange, step, valueFromClient])

  const startDrag = (thumb) => (e) => { e.preventDefault(); e.stopPropagation(); dragRef.current = thumb }
  const minPct = ((valueMin - min) / (max - min)) * 100
  const maxPct = ((valueMax - min) / (max - min)) * 100

  return (
    <div style={{ position: 'relative', padding: '12px 0', touchAction: 'none' }}>
      <div ref={trackRef} style={{ height: 2, background: `${COURT.green}25`, position: 'relative', borderRadius: 1 }}>
        <div style={{ position: 'absolute', height: '100%', left: `${minPct}%`, width: `${maxPct - minPct}%`, background: COURT.green }} />
      </div>
      <div onPointerDown={startDrag('min')} style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${minPct}%`, cursor: 'grab', touchAction: 'none', zIndex: 3 }}>
        <PadelBall size={20} />
      </div>
      <div onPointerDown={startDrag('max')} style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${maxPct}%`, cursor: 'grab', touchAction: 'none', zIndex: 3 }}>
        <PadelBall size={20} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Mulish', fontSize: 11, color: dark ? COURT.darkMuted : COURT.stone, letterSpacing: '0.18em', marginTop: 14 }}>
        <span>{min.toFixed(1)}</span><span>{max.toFixed(1)}</span>
      </div>
    </div>
  )
}

// ─── ChipRow ──────────────────────────────────────────────────────────────────
function ChipRow({ label, value, options, onChange, stone, dark }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
                color: active ? COURT.cream : (dark ? COURT.darkText : COURT.ink),
                border: `0.5px solid ${active ? COURT.green : (dark ? COURT.darkBorder : `${COURT.green}40`)}`,
                fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PartnerPrefsScreen ───────────────────────────────────────────────────────
export default function PartnerPrefsScreen({ lang, dark, onDone }) {
  const { saveProfile } = useAuth()
  const rtl   = lang === 'he'
  const t     = L[lang] || L.fr
  const bg    = dark ? COURT.darkBg   : COURT.cream
  const ink   = dark ? COURT.darkText : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const card  = dark ? COURT.darkCard  : '#F7F3EA'
  const border = dark ? COURT.darkBorder : `${COURT.green}25`
  const ff = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  const [prefs, setPrefs] = useState({
    hand: 'any', side: 'any', style: 'any',
    motivation: 'any', region: 'any',
    levelMin: 1, levelMax: 7,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    await saveProfile({ partner_prefs: prefs })
    setSaving(false)
    onDone()
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '32px 24px 12px', textAlign: 'center', flexShrink: 0 }}>
        <Ornament width={50} style={{ margin: '0 auto 8px', display: 'block' }} />
        <div style={{ fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontSize: 26, color: ink, fontWeight: 500 }}>
          {t.title}
        </div>
        <div style={{ fontFamily: 'Mulish', fontSize: 12, color: stone, marginTop: 6 }}>
          {t.subtitle}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 40px' }}>

        <ChipRow label={t.hand} value={prefs.hand} stone={stone} dark={dark}
          onChange={(v) => setPrefs(p => ({ ...p, hand: v }))}
          options={[
            { value: 'any',   label: t.any },
            { value: 'right', label: t.right },
            { value: 'left',  label: t.left },
          ]}
        />

        <ChipRow label={t.side} value={prefs.side} stone={stone} dark={dark}
          onChange={(v) => setPrefs(p => ({ ...p, side: v }))}
          options={[
            { value: 'any',      label: t.any },
            { value: 'forehand', label: t.forehand },
            { value: 'backhand', label: t.backhand },
          ]}
        />

        <ChipRow label={t.style} value={prefs.style} stone={stone} dark={dark}
          onChange={(v) => setPrefs(p => ({ ...p, style: v }))}
          options={[
            { value: 'any',        label: t.any },
            { value: 'aggressive', label: t.aggressive },
            { value: 'defensive',  label: t.defensive },
            { value: 'all-court',  label: t.allcourt },
          ]}
        />

        <ChipRow label={t.motivation} value={prefs.motivation} stone={stone} dark={dark}
          onChange={(v) => setPrefs(p => ({ ...p, motivation: v }))}
          options={[
            { value: 'any',     label: t.any },
            { value: 'fun',     label: t.fun },
            { value: 'improve', label: t.improve },
            { value: 'compete', label: t.compete },
          ]}
        />

        <ChipRow label={t.region} value={prefs.region} stone={stone} dark={dark}
          onChange={(v) => setPrefs(p => ({ ...p, region: v }))}
          options={[
            { value: 'any',    label: t.any },
            { value: 'Centre', label: 'Centre' },
            { value: 'Nord',   label: 'Nord' },
            { value: 'Sud',    label: 'Sud' },
            { value: 'Eilat',  label: 'Eilat' },
          ]}
        />

        {/* Plage de niveau */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
            {t.levelRange}
          </div>
          <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 12, padding: '14px 16px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>MIN</div>
                <div style={{ fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontSize: 26, color: COURT.green, lineHeight: 1 }}>
                  {Number.isInteger(prefs.levelMin) ? prefs.levelMin : prefs.levelMin.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Mulish', fontSize: 11, color: stone, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>MAX</div>
                <div style={{ fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontSize: 26, color: COURT.green, lineHeight: 1 }}>
                  {Number.isInteger(prefs.levelMax) ? prefs.levelMax : prefs.levelMax.toFixed(1)}
                </div>
              </div>
            </div>
            <RangeBar dark={dark} min={1} max={7} step={0.5}
              valueMin={prefs.levelMin} valueMax={prefs.levelMax}
              onChange={(lo, hi) => setPrefs(p => ({ ...p, levelMin: lo, levelMax: hi }))}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%', padding: '16px',
            background: COURT.green, color: COURT.cream,
            border: `0.5px solid ${COURT.gold}60`, borderRadius: 12,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: ff, fontStyle: rtl ? 'normal' : 'italic', fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: saving ? 0.7 : 1, transition: 'opacity 0.2s',
          }}
        >
          {saving ? (
            <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${COURT.cream}40`, borderTopColor: COURT.cream, animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <PadelBall size={18} shadow={false} />
          )}
          {t.submit}
        </button>

      </div>
    </div>
  )
}
