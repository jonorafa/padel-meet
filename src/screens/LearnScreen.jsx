import { useState, useMemo, useEffect, useRef } from 'react'
import { COURT, Ornament } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { QUIZ_CHAPTERS } from '../data/quizData'

// ───────────────────────────────────────────────────────────────────────────
// Module « Apprendre » — quizz pédagogique gamifié (style Duolingo).
// 100% INDÉPENDANT du niveau / confidence_rate.
// ───────────────────────────────────────────────────────────────────────────

const STORE_KEY   = 'padel_learn_progress'
const MASCOT_SRC  = '/mascot.png'
const MASCOT2_SRC = '/mascot2.png'   // casquette "Padel Meet" — déco du chemin
const MASCOT3_SRC = '/mascot3.png'   // casquette "Padel Meet" avec main (quiz)

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { stars: {} } }
  catch { return { stars: {} } }
}
function saveProgress(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)) } catch { /* quota */ }
}

function starsFromScore(correct, total) {
  const pct = total ? correct / total : 0
  if (pct >= 0.999) return 3
  if (pct >= 0.66)  return 2
  if (pct > 0)      return 1
  return 0
}

const LABELS = {
  fr: {
    title: 'Apprendre', tagline: 'Progresse à ton rythme',
    start: 'Commencer', review: 'Revoir', locked: 'Verrouillé',
    question: 'Question', of: 'sur', continue: 'Continuer', finish: 'Terminer',
    correct: 'Bravo !', wrong: 'Pas tout à fait…',
    resultTitle: 'Chapitre terminé !', score: 'Score',
    perfect: 'Parfait, sans faute ! 🎾', good: 'Bien joué !', keep: 'Continue à t’entraîner !',
    mascotMsg: 'Apprends une notion par jour et deviens redoutable sur le terrain !',
    mascotCheer: 'C’est exactement ça ! 🎾', mascotWrong: 'Presque… relis bien l’explication !',
  },
  en: {
    title: 'Learn', tagline: 'Progress at your own pace',
    start: 'Start', review: 'Review', locked: 'Locked',
    question: 'Question', of: 'of', continue: 'Continue', finish: 'Finish',
    correct: 'Nice!', wrong: 'Not quite…',
    resultTitle: 'Chapter complete!', score: 'Score',
    perfect: 'Perfect, flawless! 🎾', good: 'Well played!', keep: 'Keep practising!',
    mascotMsg: 'Learn one concept a day and become unstoppable on court!',
    mascotCheer: 'That’s exactly it! 🎾', mascotWrong: 'Almost… read the explanation!',
  },
  he: {
    title: 'ללמוד', tagline: 'התקדם בקצב שלך',
    start: 'התחל', review: 'חזור', locked: 'נעול',
    question: 'שאלה', of: 'מתוך', continue: 'המשך', finish: 'סיום',
    correct: 'יפה!', wrong: 'כמעט…',
    resultTitle: 'הפרק הושלם!', score: 'ניקוד',
    perfect: 'מושלם, ללא טעות! 🎾', good: 'כל הכבוד!', keep: 'תמשיך להתאמן!',
    mascotMsg: 'למד מושג אחד ביום והפוך לבלתי מנוצח במגרש!',
    mascotCheer: 'בדיוק נכון! 🎾', mascotWrong: 'כמעט… קרא את ההסבר!',
  },
}

// Décalage horizontal (style Duolingo) : 34px par unité
const WAVE = [0, 1, 2, 1, 0, -1, -2, -1]

// ─── Composant Mascotte réutilisable ────────────────────────────────────────
function Mascot({ size = 80, anim = 'bob', style: extraStyle = {}, src: srcProp }) {
  const src = srcProp || MASCOT_SRC
  const animMap = {
    bob:   'mascotBob   2.8s ease-in-out infinite',
    float: 'mascotFloat 3.2s ease-in-out infinite',
    cheer: 'mascotCheer 0.75s ease forwards',
    shake: 'mascotShake 0.6s  ease forwards',
    pop:   'mascotPop   0.5s  cubic-bezier(.34,1.56,.64,1) forwards',
  }
  return (
    <img
      src={src}
      alt="mascotte padel"
      style={{
        width: size, height: size,
        objectFit: 'contain',
        display: 'block',
        animation: animMap[anim] || animMap.bob,
        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
        userSelect: 'none', pointerEvents: 'none',
        ...extraStyle,
      }}
    />
  )
}

// ─── Écran principal ─────────────────────────────────────────────────────────
export default function LearnScreen({ lang = 'fr', dark = false }) {
  const { profile } = useAuth()
  const L   = LABELS[lang] || LABELS.fr
  const rtl = lang === 'he'
  const tr  = (obj) => (obj && (obj[lang] ?? obj.fr)) || ''

  const [progress,  setProgress]  = useState(loadProgress)
  const [activeIdx, setActiveIdx] = useState(null)

  // Refs pour tracer la ligne SVG entre les nodes
  const pathRef        = useRef(null)
  const nodeWrapperRefs = useRef([])
  const [connectors, setConnectors] = useState([])

  const bg     = dark ? COURT.darkBg    : COURT.cream
  const card   = dark ? COURT.darkCard  : '#ffffff'
  const ink    = dark ? COURT.darkText  : COURT.ink
  const stone  = dark ? COURT.darkMuted : COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}30`

  const currentIdx = useMemo(() => {
    const i = QUIZ_CHAPTERS.findIndex(c => progress.stars[c.id] === undefined)
    return i === -1 ? QUIZ_CHAPTERS.length : i
  }, [progress])

  const isUnlocked  = (idx) => idx <= currentIdx
  const isCompleted = (idx) => progress.stars[QUIZ_CHAPTERS[idx].id] !== undefined
  const starsOf     = (idx) => progress.stars[QUIZ_CHAPTERS[idx].id] ?? 0

  const totalStars = QUIZ_CHAPTERS.reduce((n, c) => n + (progress.stars[c.id] ?? 0), 0)
  const maxStars   = QUIZ_CHAPTERS.length * 3

  const handleComplete = (chapterId, earned) => {
    setProgress(prev => {
      const best = Math.max(prev.stars[chapterId] ?? 0, earned)
      const next = { ...prev, stars: { ...prev.stars, [chapterId]: best } }
      saveProgress(next)
      return next
    })
    setActiveIdx(null)
  }

  // ── Calcul des connecteurs SVG (positions réelles des nodes) ──
  useEffect(() => {
    const measure = () => {
      if (!pathRef.current) return
      const pathRect = pathRef.current.getBoundingClientRect()
      const pts = nodeWrapperRefs.current.map(wrapper => {
        if (!wrapper) return null
        const r = wrapper.getBoundingClientRect()
        return {
          x: r.left + r.width / 2 - pathRect.left,
          y: r.top  + 38          - pathRect.top,   // 38 = half of 76px button
        }
      })
      const lines = []
      for (let i = 0; i < pts.length - 1; i++) {
        if (pts[i] && pts[i + 1]) {
          lines.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i+1].x, y2: pts[i+1].y })
        }
      }
      setConnectors(lines)
    }
    requestAnimationFrame(measure)
  }, [progress]) // on remesure si la progression change (les étoiles modifient la hauteur)

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
    }}>

      {/* ── En-tête sticky ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, background: bg,
        padding: '18px 20px 12px', borderBottom: `0.5px solid ${border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'Pinyon Script, cursive', fontSize: 34,
              color: COURT.green, lineHeight: 1,
            }}>{L.title}</div>
            <div style={{
              fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 13, color: stone, marginTop: 2,
            }}>{L.tagline}</div>
          </div>
          {/* Compteur étoiles global */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: card, borderRadius: 20, padding: '6px 12px',
            border: `0.5px solid ${border}`,
          }}>
            <Star filled size={15} />
            <span style={{ fontFamily: 'Mulish', fontWeight: 700, fontSize: 14, color: ink }}>
              {totalStars}<span style={{ color: stone, fontWeight: 400 }}>/{maxStars}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Bandeau mascotte ── */}
      <div style={{
        margin: '16px 20px 4px', padding: '16px', borderRadius: 20,
        background: dark ? `${COURT.green}18` : `${COURT.green}0D`,
        border: `1.5px solid ${COURT.green}35`,
        display: 'flex', alignItems: 'center', gap: 16,
        overflow: 'hidden',
      }}>
        <Mascot size={110} anim="bob" />
        <div style={{
          fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 15, color: ink, lineHeight: 1.45, flex: 1,
        }}>{L.mascotMsg}</div>
      </div>

      {/* ── Chemin des chapitres ── */}
      <div ref={pathRef} style={{ position: 'relative', padding: '24px 0 120px' }}>

        {/* SVG : ligne pointillée qui relie les nodes */}
        <svg style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 0, overflow: 'visible',
        }}>
          {connectors.map((c, i) => (
            <line key={i}
              x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
              stroke={dark ? COURT.darkBorder : `${COURT.green}35`}
              strokeWidth="2.5"
              strokeDasharray="7 5"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {QUIZ_CHAPTERS.map((ch, idx) => {
          const offset    = WAVE[idx % WAVE.length] * 34
          const unlocked  = isUnlocked(idx)
          const completed = isCompleted(idx)
          const isCurrent = idx === currentIdx
          return (
            <div
              key={ch.id}
              ref={el => { nodeWrapperRefs.current[idx] = el }}
              style={{
                position: 'relative', zIndex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: 30, transform: `translateX(${rtl ? -offset : offset}px)`,
              }}
            >
              {/* ── Mascotte déco : à gauche du nœud "Le service" — statique + ombre ── */}
              {ch.id === 'serve' && !rtl && (
                <div style={{
                  position: 'absolute',
                  left: 'calc(50% - 210px)',
                  top: -18,
                  pointerEvents: 'none',
                  zIndex: 2,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <Mascot size={105} anim="bob" src={MASCOT2_SRC}
                    style={{ animation: 'none', width: 'auto', height: 105, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))' }} />
                  <div style={{
                    width: 70, height: 9, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.15)', filter: 'blur(6px)', marginTop: -8,
                  }} />
                </div>
              )}
              {ch.id === 'serve' && rtl && (
                <div style={{
                  position: 'absolute',
                  right: 'calc(50% - 210px)',
                  top: -18,
                  pointerEvents: 'none',
                  zIndex: 2,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  transform: 'scaleX(-1)',
                }}>
                  <Mascot size={105} anim="bob" src={MASCOT2_SRC}
                    style={{ animation: 'none', width: 'auto', height: 105, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))' }} />
                  <div style={{
                    width: 70, height: 9, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.15)', filter: 'blur(6px)', marginTop: -8,
                  }} />
                </div>
              )}
              <Node
                icon={ch.icon}
                state={completed ? 'done' : unlocked ? 'current' : 'locked'}
                pulse={isCurrent}
                dark={dark}
                onClick={() => unlocked && setActiveIdx(idx)}
              />
              <div style={{
                fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 14, color: unlocked ? ink : stone, marginTop: 8, textAlign: 'center',
                maxWidth: 160,
              }}>{tr(ch.title)}</div>
              {completed && (
                <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                  {[1, 2, 3].map(s => <Star key={s} filled={s <= starsOf(idx)} size={13} />)}
                </div>
              )}
              {!completed && unlocked && (
                <div style={{
                  fontFamily: 'Mulish', fontSize: 10.5, color: COURT.green, marginTop: 4,
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
                }}>{isCurrent ? L.start : L.review}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Quizz plein écran ── */}
      {activeIdx !== null && (
        <QuizFlow
          chapter={QUIZ_CHAPTERS[activeIdx]}
          lang={lang} dark={dark} L={L} tr={tr} rtl={rtl}
          onClose={() => setActiveIdx(null)}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}

// ─── Node circulaire ────────────────────────────────────────────────────────
function Node({ icon, state, pulse, dark, onClick }) {
  const palette = {
    done:    { bg: COURT.green,      shadow: COURT.greenDeep },
    current: { bg: COURT.greenLight, shadow: COURT.green },
    locked:  { bg: dark ? COURT.darkBorder : '#D8D2C4', shadow: dark ? '#0e1611' : '#C3BCA9' },
  }[state]

  return (
    <button
      onClick={onClick}
      disabled={state === 'locked'}
      style={{
        width: 76, height: 76, borderRadius: '50%', border: 'none',
        background: palette.bg,
        boxShadow: `0 6px 0 ${palette.shadow}`,
        cursor: state === 'locked' ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', fontSize: 32, lineHeight: 1,
        filter: state === 'locked' ? 'grayscale(0.6) opacity(0.75)' : 'none',
        transition: 'transform 0.12s',
        animation: pulse ? 'bounceY 1.8s ease-in-out infinite' : 'none',
        outline: pulse ? `3px solid ${COURT.gold}` : 'none',
        outlineOffset: '10px',
      }}
      onMouseDown={e => { if (state !== 'locked') e.currentTarget.style.transform = 'translateY(3px)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {state === 'locked'
        ? <LockIcon />
        : <span style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }}>{icon}</span>}
    </button>
  )
}

// ─── Moteur de quizz ────────────────────────────────────────────────────────
function QuizFlow({ chapter, lang, dark, L, tr, rtl, onClose, onComplete }) {
  const questions = chapter.questions
  const [qIndex,       setQIndex]       = useState(0)
  const [selected,     setSelected]     = useState(null)
  const [answered,     setAnswered]     = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [phase,        setPhase]        = useState('play') // 'play' | 'result'
  const [mascotAnim,   setMascotAnim]   = useState('float')

  const bg     = dark ? COURT.darkBg    : COURT.cream
  const card   = dark ? COURT.darkCard  : '#ffffff'
  const ink    = dark ? COURT.darkText  : COURT.ink
  const stone  = dark ? COURT.darkMuted : COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}30`

  const q          = questions[qIndex]
  const isCorrect  = answered && selected === q.correct

  const pick = (optId) => {
    if (answered) return
    setSelected(optId)
    setAnswered(true)
    if (optId === q.correct) {
      setCorrectCount(c => c + 1)
      setMascotAnim('cheer')
    } else {
      setMascotAnim('shake')
    }
  }

  const next = () => {
    setMascotAnim('float')
    if (qIndex < questions.length - 1) {
      setQIndex(i => i + 1)
      setSelected(null)
      setAnswered(false)
    } else {
      setPhase('result')
    }
  }

  const earned = starsFromScore(correctCount, questions.length)

  const optStyle = (optId) => {
    const base = {
      width: '100%', textAlign: rtl ? 'right' : 'left', padding: '15px 16px',
      borderRadius: 14, marginBottom: 10, cursor: answered ? 'default' : 'pointer',
      fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
      fontSize: 16, color: ink, background: card,
      border: `1.5px solid ${border}`, transition: 'all 0.15s', boxSizing: 'border-box',
    }
    if (!answered) return base
    if (optId === q.correct) return { ...base, background: `${COURT.green}1A`, border: `1.5px solid ${COURT.green}`, color: COURT.green }
    if (optId === selected)  return { ...base, background: `${COURT.red}14`,   border: `1.5px solid ${COURT.red}`,   color: COURT.red }
    return { ...base, opacity: 0.55 }
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: bg,
      display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease',
    }}>
      {phase === 'play' ? (
        <>
          {/* ── Barre de progression + fermeture ── */}
          <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 26,
              color: stone, lineHeight: 1, padding: 2,
            }}>×</button>
            <div style={{ flex: 1, height: 10, borderRadius: 6, background: dark ? COURT.darkBorder : '#E0DDD4', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, background: COURT.green,
                width: `${((qIndex + (answered ? 1 : 0)) / questions.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* ── Label chapitre ── */}
          <div style={{ padding: '0 22px 16px', flexShrink: 0 }}>
            <div style={{
              fontFamily: 'Mulish', fontSize: 10.5, color: stone,
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>{tr(chapter.title)} · {L.question} {qIndex + 1} {L.of} {questions.length}</div>
          </div>

          {/* ── Mascotte + bulle de dialogue ── */}
          <div style={{
            padding: '0 20px', flexShrink: 0,
            display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 24,
          }}>
            <Mascot size={118} anim={mascotAnim} src={MASCOT3_SRC}
              style={{ flexShrink: 0, width: 'auto', height: 118 }} />
            {/* Bulle — alignée à la hauteur de la main */}
            <div style={{ position: 'relative', flex: 1, marginTop: 16 }}>
              {/* Queue de la bulle pointant vers la mascotte */}
              <div style={{
                position: 'absolute',
                left: rtl ? 'auto' : -10, right: rtl ? -10 : 'auto',
                top: 22,
                width: 0, height: 0,
                borderTop: '9px solid transparent',
                borderBottom: '9px solid transparent',
                borderRight: rtl ? 'none' : `11px solid ${card}`,
                borderLeft: rtl ? `11px solid ${card}` : 'none',
              }} />
              {/* Bordure de la queue */}
              <div style={{
                position: 'absolute',
                left: rtl ? 'auto' : -13, right: rtl ? -13 : 'auto',
                top: 21,
                width: 0, height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderRight: rtl ? 'none' : `12px solid ${dark ? COURT.darkBorder : COURT.green + '22'}`,
                borderLeft: rtl ? `12px solid ${dark ? COURT.darkBorder : COURT.green + '22'}` : 'none',
              }} />
              <div style={{
                background: card,
                border: `1.5px solid ${dark ? COURT.darkBorder : COURT.green + '22'}`,
                borderRadius: 18, padding: '16px 18px',
                boxShadow: '0 3px 16px rgba(0,0,0,0.08)',
              }}>
                <div style={{
                  fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                  fontSize: 20, color: ink, lineHeight: 1.45,
                }}>{tr(q.q)}</div>
              </div>
            </div>
          </div>

          {/* ── Options de réponse ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px' }}>
            {q.options.map(opt => (
              <button key={opt.id} onClick={() => pick(opt.id)} style={optStyle(opt.id)}>
                {tr(opt.text)}
              </button>
            ))}
          </div>

          {/* ── Panel feedback (style Duolingo) + bouton ── */}
          <div style={{ flexShrink: 0 }}>
            {answered ? (
              <div style={{
                padding: '18px 22px',
                paddingBottom: 'max(100px, calc(env(safe-area-inset-bottom, 0px) + 100px))',
                background: isCorrect ? `${COURT.green}15` : `${COURT.red}10`,
                borderTop: `2.5px solid ${isCorrect ? COURT.green : COURT.red}`,
                animation: 'fadeUp 0.22s ease',
              }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: 'italic',
                    fontWeight: 700, fontSize: 16,
                    color: isCorrect ? COURT.green : COURT.red, marginBottom: 4,
                  }}>{isCorrect ? L.mascotCheer : L.mascotWrong}</div>
                  <div style={{
                    fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                    fontSize: 14, color: ink, lineHeight: 1.5,
                  }}>{tr(q.explain)}</div>
                </div>
                <button onClick={next} style={{
                  width: '100%', padding: '15px', borderRadius: 14,
                  background: isCorrect ? COURT.green : COURT.red,
                  color: '#fff', border: 'none',
                  fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                  fontSize: 17, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 4px 0 ${isCorrect ? COURT.greenDeep : '#8B1A1A'}`,
                  letterSpacing: '0.03em',
                }}>
                  {qIndex < questions.length - 1 ? L.continue.toUpperCase() : L.finish.toUpperCase()}
                </button>
              </div>
            ) : (
              <div style={{
                padding: '12px 22px',
                paddingBottom: 'max(100px, calc(env(safe-area-inset-bottom, 0px) + 100px))',
              }}>
                <button disabled style={{
                  width: '100%', padding: '15px', borderRadius: 14,
                  background: `${COURT.green}35`, color: `${COURT.cream}99`,
                  border: 'none', cursor: 'default',
                  fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
                  fontSize: 17, fontWeight: 700, letterSpacing: '0.03em',
                }}>
                  {qIndex < questions.length - 1 ? L.continue.toUpperCase() : L.finish.toUpperCase()}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        // ── Écran de résultat ──
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '0 28px',
          textAlign: 'center',
        }}>
          {/* Grande mascotte qui célèbre */}
          <div style={{ marginBottom: 16 }}>
            <Mascot
              size={120}
              anim={earned >= 2 ? 'cheer' : 'bob'}
              style={{ animation: earned >= 2
                ? 'mascotCheer 0.75s ease forwards, mascotBob 2.8s ease-in-out 0.8s infinite'
                : 'mascotBob 2.8s ease-in-out infinite',
              }}
            />
          </div>

          {/* Étoiles */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {[1, 2, 3].map(s => (
              <span key={s} style={{ animation: `levelPop 0.4s ease ${s * 0.12}s both` }}>
                <Star filled={s <= earned} size={38} />
              </span>
            ))}
          </div>

          <div style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 26, color: ink, marginBottom: 6,
          }}>{L.resultTitle}</div>
          <div style={{ fontFamily: 'Mulish', fontSize: 15, color: stone, marginBottom: 4 }}>
            {L.score} : {correctCount}/{questions.length}
          </div>
          <div style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 16, color: COURT.green, marginBottom: 32,
          }}>
            {earned === 3 ? L.perfect : earned === 2 ? L.good : L.keep}
          </div>
          <button onClick={() => onComplete(chapter.id, earned)} style={{
            width: '100%', maxWidth: 320, padding: '16px', borderRadius: 14,
            background: COURT.green, color: COURT.cream, border: `0.5px solid ${COURT.gold}`,
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 18, cursor: 'pointer', boxShadow: `0 4px 0 ${COURT.greenDeep}`,
          }}>{L.finish}</button>
        </div>
      )}
    </div>
  )
}

// ─── Petites icônes ─────────────────────────────────────────────────────────
function Star({ filled, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? COURT.gold : 'none'} stroke={filled ? COURT.gold : COURT.stone}
      strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
