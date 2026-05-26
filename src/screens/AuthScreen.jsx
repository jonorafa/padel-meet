import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { COURT, FloatingBalls, Ornament, PadelBall } from '../components/CourtUI'
import { useAuth }  from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

const LABELS = {
  fr: {
    tagline:  "L'art du padel, redéfini.",
    members:  'Rejoignez la communauté padel',
    cta:      'Continuer avec Google',
    secure:   'Sécurisé via Google',
  },
  en: {
    tagline:  'The art of padel, redefined.',
    members:  'Join the padel community',
    cta:      'Continue with Google',
    secure:   'Secured via Google',
  },
  he: {
    tagline:  'אמנות הפאדל, מעוצבת מחדש.',
    members:  'הצטרף לקהילת הפאדל',
    cta:      'המשך עם Google',
    secure:   'מאובטח דרך Google',
  },
}

const GUEST_LABELS = {
  fr: { guest: 'Continuer en tant qu\'invité', guestNote: 'Explorez sans créer de compte.' },
  en: { guest: 'Continue as guest', guestNote: 'Browse without an account.' },
  he: { guest: 'המשך כאורח', guestNote: 'עיין ללא חשבון.' },
}

export default function AuthScreen() {
  const { user, loading: authLoading, isOnboarding, signInWithGoogle, enterAsGuest } = useAuth()
  const { lang, dark } = usePrefs()
  const navigate = useNavigate()

  const L   = LABELS[lang] || LABELS.en
  const G   = GUEST_LABELS[lang] || GUEST_LABELS.fr
  const rtl = lang === 'he'

  // Redirect once authenticated
  useEffect(() => {
    if (authLoading) return
    if (user) {
      navigate(isOnboarding ? '/onboarding' : '/app', { replace: true })
    }
  }, [user, authLoading, isOnboarding, navigate])

  const bg    = dark ? COURT.darkBg    : COURT.cream
  const ink   = dark ? COURT.darkText  : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
      // Supabase redirige vers Google ; l'app reprend sur /auth après le retour OAuth
    } catch (err) {
      console.error('Google sign-in error:', err)
    }
  }

  const handleGuestMode = () => {
    enterAsGuest()
    navigate('/app', { replace: true })
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 28px', overflow: 'hidden',
    }}>
      <FloatingBalls count={3} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 380, zIndex: 2 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Ornament width={70} style={{ display: 'block', margin: '0 auto 8px' }} />
          <div style={{
            fontFamily: 'Pinyon Script, cursive', fontSize: 56,
            color: COURT.green, lineHeight: 1,
          }}>
            Padel Meet
          </div>
          <div style={{
            fontFamily: rtl ? 'Inter, sans-serif' : 'Cormorant Garamond, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 16, color: stone, marginTop: 6,
          }}>
            {L.tagline}
          </div>
        </div>

        {/* Subtitle */}
        <div style={{
          textAlign: 'center', marginBottom: 28,
          fontFamily: 'Inter', fontSize: 11, color: stone,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {L.members}
        </div>

        {/* Google Sign-in Button */}
        <button
          onClick={handleGoogleSignIn}
          style={{
            width: '100%', padding: '16px',
            background: dark ? '#1a2820' : '#ffffff',
            border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '50'}`,
            borderRadius: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 4px 18px rgba(15,61,41,0.14)'
            e.currentTarget.style.borderColor = COURT.green
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'
            e.currentTarget.style.borderColor = dark ? COURT.darkBorder : COURT.green + '50'
          }}
        >
          {/* Google "G" logo */}
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>

          <span style={{
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle:  rtl ? 'normal' : 'italic',
            fontSize: 17, color: ink,
          }}>
            {L.cta}
          </span>
        </button>

        {/* Security note */}
        <div style={{
          marginTop: 20, textAlign: 'center',
          fontFamily: 'Inter', fontSize: 10, color: stone,
          letterSpacing: '0.08em',
        }}>
          🔒 {L.secure}
        </div>

        {/* Guest mode */}
        <button
          onClick={handleGuestMode}
          style={{
            marginTop: 28, width: '100%', background: 'none',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{
            fontFamily: rtl ? 'Inter, sans-serif' : 'Crimson Text, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 15, color: stone,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            {G.guest}
          </span>
          <span style={{ fontFamily: 'Inter', fontSize: 10, color: `${stone}90`, letterSpacing: '0.06em' }}>
            {G.guestNote}
          </span>
        </button>
      </div>
    </div>
  )
}
