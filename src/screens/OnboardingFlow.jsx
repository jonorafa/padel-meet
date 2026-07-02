import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { usePrefs } from '../context/PrefsContext'
import { useAuth }  from '../context/AuthContext'
import { I18N }     from '../data/courtData'
import WelcomeScreen       from './LevelAssessmentScreen'
import QuizScreen          from './ScoreScreen'
import ResultScreen        from './ProfileSetupScreen'
import SetupProfileScreen  from './SetupProfileScreen'
import PartnerPrefsScreen  from './PartnerPrefsScreen'

/**
 * Flux d'onboarding complet pour un nouvel utilisateur :
 * welcome → quiz → result (niveau calculé) → setup (profil détaillé)
 * Puis redirect vers /app.
 */
export default function OnboardingFlow() {
  const { user }                             = useAuth()
  const { lang, dark, setLevel, setConfidence } = usePrefs()
  const navigate                             = useNavigate()
  const [phase,      setPhase]      = useState('welcome')
  const [level,      setLocalLevel] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [confidence] = useState(50)  // toujours 50 — évolue via peer eval

  const t = I18N[lang] || I18N.fr

  // Sécurité : si l'user n'est pas connecté, retour à /auth
  if (!user) return <Navigate to="/auth" replace />

  // ── Handlers ──────────────────────────────────────────────────
  const handleStartQuiz = () => setPhase('quiz')

  const handleSkipQuiz  = () => {
    setLocalLevel(null)  // quiz non effectué → niveau non évalué
    setPhase('result')
  }

  const handleQuizDone  = (computedLevel, answers) => {
    setLocalLevel(computedLevel)
    setQuizAnswers(answers || {})
    // confidence_rate reste à 50 — il évolue uniquement via peer evaluations
    setPhase('result')
  }

  const handleEnterClub = () => {
    // Persiste dans PrefsContext (localStorage)
    setLevel(level)
    setConfidence(confidence)
    setPhase('setup')
  }

  const handleSetupDone = () => {
    setPhase('partner')
  }

  const handlePartnerDone = () => {
    navigate('/app', { replace: true })
  }

  // ── Rendu selon la phase ───────────────────────────────────────
  if (phase === 'welcome') return (
    <WelcomeScreen
      t={t} lang={lang} dark={dark}
      onStart={handleStartQuiz}
      onSkip={handleSkipQuiz}
    />
  )

  if (phase === 'quiz') return (
    <QuizScreen
      t={t} lang={lang} dark={dark}
      onDone={handleQuizDone}
      onBack={() => setPhase('welcome')}
    />
  )

  if (phase === 'result') return (
    <ResultScreen
      t={t} lang={lang} dark={dark}
      level={level}
      answers={quizAnswers}
      onContinue={handleEnterClub}
    />
  )

  if (phase === 'setup') return (
    <SetupProfileScreen
      lang={lang} dark={dark} level={level}
      onDone={handleSetupDone}
    />
  )

  if (phase === 'partner') return (
    <PartnerPrefsScreen
      lang={lang} dark={dark}
      onDone={handlePartnerDone}
    />
  )

  return null
}
