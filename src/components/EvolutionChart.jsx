import { useState, useRef } from 'react'
import { COURT, SectionHeading } from './CourtUI'
import { usePrefs } from '../context/PrefsContext'
import { useLevelHistory } from '../hooks/useLevelHistory'
import { I18N } from '../data/courtData'

// ───────────────────────────────────────────────────────────────────────────
// Graphe d'évolution du niveau — INTERACTIF (sélecteur de période + curseur tactile).
// Source = les VRAIS points de niveau (level_history en DB, repli localStorage),
// c.-à-d. chaque (ré)évaluation. Le niveau ne bouge que par quiz + ré-éval — pas
// par les matchs — donc la courbe affiche ces paliers réels (échelle 0.5–7).
// ───────────────────────────────────────────────────────────────────────────
export default function EvolutionChart() {
  const { lang, dark, level, levelHistory } = usePrefs()
  const dbHistory = useLevelHistory()
  const t = I18N[lang] || I18N.fr
  const rtl = lang === 'he'
  const ff_italic = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'
  const stone = dark ? COURT.darkMuted : COURT.stone

  const [evoPeriod, setEvoPeriod] = useState('all')
  const [touchIdx, setTouchIdx]   = useState(null)
  const evoRef = useRef(null)

  const hasLevel = level != null

  // ─── Vrais points de niveau (DB d'abord, repli localStorage) ─────────
  const rawHistory = (dbHistory && dbHistory.length > 0) ? dbHistory : (levelHistory || [])
  let allEvoPoints = [], allEvoDates = []
  if (rawHistory.length > 0) {
    const sorted = rawHistory
      .map(p => ({
        level: parseFloat(p.level),
        date:  p.date instanceof Date ? p.date : new Date(p.date),
      }))
      .filter(p => !isNaN(p.level) && !isNaN(p.date.getTime()))
      .sort((a, b) => a.date - b.date)
    allEvoPoints = sorted.map(p => p.level)
    allEvoDates  = sorted.map(p => p.date)

    // Ancre le niveau actuel comme dernier point (si différent du dernier connu),
    // pour que la courbe atteigne « aujourd'hui ».
    if (hasLevel) {
      const lastLvl = allEvoPoints[allEvoPoints.length - 1]
      if (lastLvl == null || Math.abs(lastLvl - level) > 0.001) {
        allEvoPoints = [...allEvoPoints, level]
        allEvoDates  = [...allEvoDates, new Date()]
      }
    }
  }

  // ─── Filtre par période ──────────────────────────────────────────────
  const _evoNow = new Date()
  let evoPoints = allEvoPoints
  let evoDates  = allEvoDates
  if (evoPeriod !== 'all' && allEvoDates.length > 0) {
    const cutoff = new Date(_evoNow)
    if      (evoPeriod === '1M') cutoff.setMonth(cutoff.getMonth() - 1)
    else if (evoPeriod === '3M') cutoff.setMonth(cutoff.getMonth() - 3)
    else if (evoPeriod === '6M') cutoff.setMonth(cutoff.getMonth() - 6)
    else if (evoPeriod === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1)
    const si = allEvoDates.findIndex(d => d >= cutoff)
    if (si !== -1) { evoPoints = allEvoPoints.slice(si); evoDates = allEvoDates.slice(si) }
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeading>{t.evolutionTitle}</SectionHeading>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['1Y', '1Y'], ['all', t.periodAll || 'Tout']].map(([key, lbl]) => (
            <button key={key} onClick={() => { setEvoPeriod(key); setTouchIdx(null); }} style={{
              padding: '4px 7px', borderRadius: 6,
              border: `0.5px solid ${evoPeriod === key ? COURT.green : (dark ? COURT.darkBorder : COURT.stone + '40')}`,
              background: evoPeriod === key ? COURT.green : 'transparent',
              color: evoPeriod === key ? '#fff' : stone,
              fontFamily: 'Mulish', fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
          const W = 300, H = 130
          const padL = 26, padR = 8, padT = 10, padB = 22
          const chartW = W - padL - padR
          const chartH = H - padT - padB
          const minY = 0, maxY = 7
          const n = evoPoints.length
          const xy = evoPoints.map((v, i) => {
            const x = padL + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2)
            const y = padT + chartH - ((v - minY) / (maxY - minY)) * chartH
            return [x, y]
          })
          const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
          const areaPath = `${linePath} L ${xy[n-1][0].toFixed(1)} ${padT + chartH} L ${xy[0][0].toFixed(1)} ${padT + chartH} Z`
          const yTicks = [0, 2, 4, 6, 7]
          const fmtDate = (d) => {
            if (!d) return ''
            const dd = d instanceof Date ? d : new Date(d)
            return dd.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })
          }
          const xIdxs = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1]
          const handlePointer = (e) => {
            e.preventDefault()
            const svg = evoRef.current
            if (!svg) return
            const rect = svg.getBoundingClientRect()
            const clientX = e.touches ? e.touches[0].clientX : e.clientX
            const svgX = ((clientX - rect.left) / rect.width) * W
            let ci = 0, cd = Infinity
            for (let i = 0; i < xy.length; i++) {
              const d = Math.abs(xy[i][0] - svgX)
              if (d < cd) { cd = d; ci = i }
            }
            setTouchIdx(ci)
          }
          const cursor = touchIdx !== null ? xy[touchIdx] : null
          const ttW = 90, ttH = 18
          const ttX = cursor ? Math.min(Math.max(cursor[0] - ttW / 2, padL), W - padR - ttW) : 0
          const ttY = cursor ? Math.max(cursor[1] - ttH - 8, padT) : 0
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
                const yy = padT + chartH - ((v - minY) / (maxY - minY)) * chartH
                return (
                  <g key={v}>
                    <line x1={padL} y1={yy} x2={W - padR} y2={yy}
                      stroke={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} strokeWidth="0.5" />
                    <text x={padL - 4} y={yy + 3.5} textAnchor="end"
                      fontSize="7" fontFamily="Mulish" fill={stone}>{v}</text>
                  </g>
                )
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
          )
        })() : (
          <div style={{ fontFamily: ff_italic, fontStyle: rtl ? 'normal' : 'italic', fontSize: 14, color: stone, textAlign: 'center', padding: '8px 0' }}>{t.noEvolutionYet}</div>
        )}
      </div>
    </div>
  )
}
