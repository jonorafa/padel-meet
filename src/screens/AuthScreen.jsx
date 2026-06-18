import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COURT, FloatingBalls, Ornament } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

const LABELS = {
  fr: {
    tagline: 'Trouve ton partenaire idéal',
    google:  'Continuer avec Google',
    guest:   "Continuer en tant qu'invité",
    errGen:  'Une erreur est survenue',
  },
  en: {
    tagline: 'Find your ideal padel partner',
    google:  'Continue with Google',
    guest:   'Continue as guest',
    errGen:  'An error occurred',
  },
  he: {
    tagline: 'מצא את שותף הפאדל האידיאלי',
    google:  'המשך עם Google',
    guest:   'המשך כאורח',
    errGen:  'שגיאה',
  },
}

export default function AuthScreen() {
  const { user, loading: authLoading, isOnboarding, signInWithGoogle, enterAsGuest } = useAuth()
  const { lang, dark } = usePrefs()
  const navigate = useNavigate()
  const L = LABELS[lang] || LABELS.fr
  const rtl = lang === 'he'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const bg     = dark ? COURT.darkBg     : COURT.cream
  const card   = dark ? COURT.darkCard   : '#ffffff'
  const ink    = dark ? COURT.darkText   : COURT.ink
  const stone  = dark ? COURT.darkMuted  : COURT.stone
  const border = dark ? COURT.darkBorder : COURT.green + '25'

  if (authLoading) return null
  if (user) {
    navigate(isOnboarding ? '/onboarding' : '/app', { replace: true })
    return null
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      console.error(e)
      setError(L.errGen)
      setLoading(false)
    }
  }

  const handleGuest = () => {
    enterAsGuest()
    navigate('/app', { replace: true })
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 28px', overflow: 'hidden',
    }}>
      {/* Bouton retour vers l'écran langue */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute', top: 18, left: 18,
          background: 'none', border: 'none', cursor: 'pointer',
          color: dark ? COURT.darkMuted : COURT.stone,
          fontSize: 24, lineHeight: 1, padding: 4,
        }}
      >‹</button>

      <FloatingBalls count={3} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 380, zIndex: 2 }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Ornament width={70} style={{ display: 'block', margin: '0 auto 8px' }} />
          <div style={{
            fontFamily: 'Pinyon Script, cursive',
            fontSize: 56, color: COURT.green, lineHeight: 1,
          }}>
            Padel Meet
          </div>
          <div style={{
            fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 15, color: stone, marginTop: 7, letterSpacing: '0.02em',
          }}>
            {L.tagline}
          </div>
        </div>

        {/* ── Google ── */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: '100%', padding: '15px', borderRadius: 14,
          background: card, border: `0.5px solid ${border}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s',
          opacity: loading ? 0.7 : 1,
        }}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 4px 18px rgba(15,61,41,0.14)'; e.currentTarget.style.borderColor = COURT.green; } }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'; e.currentTarget.style.borderColor = border; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 17, color: ink,
          }}>{loading ? '…' : L.google}</span>
        </button>

        {/* ── Invité ── */}
        <button onClick={handleGuest} disabled={loading} style={{
          marginTop: 20, width: '100%', background: 'none',
          border: 'none', cursor: loading ? 'default' : 'pointer', textAlign: 'center',
          opacity: loading ? 0.5 : 1,
        }}>
          <span style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 15, color: stone,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            {L.guest}
          </span>
        </button>

        {/* ── Erreur ── */}
        {error && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 10,
            background: `${COURT.red || '#e74c3c'}10`,
            border: `0.5px solid ${COURT.red || '#e74c3c'}30`,
            fontFamily: 'Mulish', fontSize: 12, color: COURT.red || '#e74c3c',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* ── Consentement CGU / Confidentialité ── */}
        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'Mulish', fontSize: 11.5, lineHeight: 1.6, color: stone }}>
          {lang === 'en' ? 'By continuing, you agree to our ' : lang === 'he' ? 'בהמשך, אתה מסכים ל' : 'En continuant, tu acceptes nos '}
          <span onClick={() => navigate('/terms')} style={{ textDecoration: 'underline', cursor: 'pointer', color: COURT.green }}>
            {lang === 'en' ? 'Terms' : lang === 'he' ? 'תנאי השימוש' : 'CGU'}
          </span>
          {lang === 'en' ? ' and ' : lang === 'he' ? ' ו' : ' et notre '}
          <span onClick={() => navigate('/privacy')} style={{ textDecoration: 'underline', cursor: 'pointer', color: COURT.green }}>
            {lang === 'en' ? 'Privacy Policy' : lang === 'he' ? 'מדיניות הפרטיות' : 'Politique de confidentialité'}
          </span>.
        </div>

      </div>
    </div>
  )
}
