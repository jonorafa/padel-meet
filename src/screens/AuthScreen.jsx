import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { COURT, FloatingBalls, Ornament } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { supabase } from '../lib/supabase'
import { normalizeUsername, usernameToEmail, validateUsername } from '../lib/username'

const LABELS = {
  fr: {
    tagline:   'Trouve ton partenaire idéal',
    create:    'Créer un compte',
    login:     'Se connecter',
    email:     'Email',
    username:  "Nom d'utilisateur",
    password:  'Mot de passe',
    emailPh:   'ton@email.com',
    usernamePh:'Ex: jonathan',
    usernameHint:'3 à 20 caractères : lettres, chiffres et _',
    pwPh:      'Ex: Padel2024',
    loginPwPh: '••••••••',
    cta_create:'Créer mon compte',
    cta_login: 'Se connecter',
    forgot:    'Mot de passe oublié ?',
    or:        'ou',
    google:    'Continuer avec Google',
    guest:     "Continuer en tant qu'invité",
    errEmail:  'Adresse email invalide',
    errUser:   "Choisis un nom d'utilisateur (3 à 20 caractères : lettres, chiffres, _).",
    errUserTaken:'Ce nom d’utilisateur est déjà pris. Choisis-en un autre.',
    errPw:     'Le mot de passe doit contenir 8 caractères min., dont des lettres et des chiffres.',
    errPwLen:  '8 caractères minimum',
    errPwLet:  'Au moins une lettre',
    errPwNum:  'Au moins un chiffre',
    errGen:    'Une erreur est survenue',
    errInvalid:"Nom d'utilisateur ou mot de passe incorrect.",
    errNotConf:'Confirme ton email avant de te connecter (vérifie ta boîte mail).',
    errTaken:  'Ce nom d’utilisateur est déjà pris. Connecte-toi.',
    checkEmail:'Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.',
    resetSent: "Si un compte existe, un lien de réinitialisation vient d'être envoyé.",
    resetAsk:  'Entre ton email puis reclique sur « Mot de passe oublié ».',
    ruleLen:   '8 caractères min.',
    ruleLet:   'Au moins une lettre',
    ruleNum:   'Au moins un chiffre',
    recTitle:  'Nouveau mot de passe',
    recSub:    'Choisis un nouveau mot de passe pour ton compte.',
    recCta:    'Mettre à jour',
    recDone:   'Mot de passe mis à jour ! Connexion en cours…',
  },
  en: {
    tagline:   'Find your ideal padel partner',
    create:    'Create account',
    login:     'Sign in',
    email:     'Email',
    username:  'Username',
    password:  'Password',
    emailPh:   'you@email.com',
    usernamePh:'e.g. jonathan',
    usernameHint:'3 to 20 characters: letters, numbers and _',
    pwPh:      'e.g. Padel2024',
    loginPwPh: '••••••••',
    cta_create:'Create my account',
    cta_login: 'Sign in',
    forgot:    'Forgot password?',
    or:        'or',
    google:    'Continue with Google',
    guest:     'Continue as guest',
    errEmail:  'Invalid email address',
    errUser:   'Choose a username (3 to 20 characters: letters, numbers, _).',
    errUserTaken:'This username is already taken. Pick another one.',
    errPw:     'Password must be at least 8 characters and include letters and numbers.',
    errPwLen:  'At least 8 characters',
    errPwLet:  'At least one letter',
    errPwNum:  'At least one number',
    errGen:    'An error occurred',
    errInvalid:'Incorrect username or password.',
    errNotConf:'Confirm your email before signing in (check your inbox).',
    errTaken:  'This username is already taken. Sign in instead.',
    checkEmail:'Account created! Check your inbox to confirm your address, then sign in.',
    resetSent: 'If an account exists, a reset link has just been sent.',
    resetAsk:  'Enter your email then click "Forgot password" again.',
    ruleLen:   '8 characters min.',
    ruleLet:   'At least one letter',
    ruleNum:   'At least one number',
    recTitle:  'New password',
    recSub:    'Choose a new password for your account.',
    recCta:    'Update',
    recDone:   'Password updated! Signing you in…',
  },
  he: {
    tagline:   'מצא את שותף הפאדל האידיאלי',
    create:    'צור חשבון',
    login:     'התחבר',
    email:     'אימייל',
    username:  'שם משתמש',
    password:  'סיסמה',
    emailPh:   'you@email.com',
    usernamePh:'לדוג׳ jonathan',
    usernameHint:'3 עד 20 תווים: אותיות, ספרות ו־_',
    pwPh:      'לדוג׳ Padel2024',
    loginPwPh: '••••••••',
    cta_create:'צור חשבון',
    cta_login: 'התחבר',
    forgot:    'שכחת סיסמה?',
    or:        'או',
    google:    'המשך עם Google',
    guest:     'המשך כאורח',
    errEmail:  'כתובת אימייל לא תקינה',
    errUser:   'בחר שם משתמש (3 עד 20 תווים: אותיות, ספרות, _).',
    errUserTaken:'שם המשתמש הזה כבר תפוס. בחר אחר.',
    errPw:     'הסיסמה חייבת להכיל לפחות 8 תווים, אותיות וספרות.',
    errPwLen:  'לפחות 8 תווים',
    errPwLet:  'לפחות אות אחת',
    errPwNum:  'לפחות ספרה אחת',
    errGen:    'שגיאה',
    errInvalid:'שם משתמש או סיסמה שגויים.',
    errNotConf:'אשר את האימייל שלך לפני ההתחברות (בדוק את תיבת הדואר).',
    errTaken:  'שם המשתמש הזה כבר תפוס. התחבר במקום.',
    checkEmail:'החשבון נוצר! בדוק את תיבת הדואר כדי לאשר את הכתובת, ואז התחבר.',
    resetSent: 'אם קיים חשבון, נשלח כעת קישור לאיפוס.',
    resetAsk:  'הזן את האימייל שלך ולחץ שוב על "שכחת סיסמה".',
    ruleLen:   'לפחות 8 תווים',
    ruleLet:   'לפחות אות אחת',
    ruleNum:   'לפחות ספרה אחת',
    recTitle:  'סיסמה חדשה',
    recSub:    'בחר סיסמה חדשה לחשבון שלך.',
    recCta:    'עדכן',
    recDone:   'הסיסמה עודכנה! מתחבר…',
  },
}

export default function AuthScreen() {
  const { user, loading: authLoading, isOnboarding, signInWithGoogle, enterAsGuest, recovery, endRecovery } = useAuth()
  const { lang, dark } = usePrefs()
  const navigate = useNavigate()
  const L = LABELS[lang] || LABELS.fr
  const rtl = lang === 'he'

  const [tab, setTab]           = useState('create') // 'create' | 'login'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [notice, setNotice]     = useState('') // message positif (vérifie ta boîte mail, etc.)

  const bg     = dark ? COURT.darkBg     : COURT.cream
  const card   = dark ? COURT.darkCard   : '#ffffff'
  const ink    = dark ? COURT.darkText   : COURT.ink
  const stone  = dark ? COURT.darkMuted  : COURT.stone
  const border = dark ? COURT.darkBorder : COURT.green + '25'

  useEffect(() => {
    if (authLoading) return
    if (recovery) return // pendant la récupération, on reste sur l'écran « nouveau mot de passe »
    if (user) navigate(isOnboarding ? '/onboarding' : '/app', { replace: true })
  }, [user, authLoading, isOnboarding, navigate, recovery])

  // Règles de validation du mot de passe (live)
  const pwRules = {
    len: password.length >= 8,
    let: /[a-zA-Z]/.test(password),
    num: /[0-9]/.test(password),
  }
  const pwValid   = pwRules.len && pwRules.let && pwRules.num
  // Pseudo valide = format OK (3–20 car. [a-z0-9_] après normalisation)
  const usernameValid = validateUsername(username) === null

  // Traduit les messages d'erreur Supabase (anglais) en message convivial localisé
  const mapError = (msg = '') => {
    const m = msg.toLowerCase()
    if (m.includes('invalid login credentials'))        return L.errInvalid
    if (m.includes('email not confirmed'))              return L.errNotConf
    if (m.includes('already registered') ||
        m.includes('already been registered'))          return L.errTaken
    if (m.includes('password') && m.includes('least')) return L.errPw
    return msg || L.errGen
  }

  const handleSubmit = async () => {
    setError(''); setNotice('')
    if (!usernameValid)               return setError(L.errUser)
    if (tab === 'create' && !pwValid) return setError(L.errPw)
    if (tab === 'login' && password.length < 1) return setError(L.errPw)

    // Auth par pseudo : Supabase travaille avec un email TECHNIQUE invisible
    // dérivé du pseudo (cf. src/lib/username.js). L'utilisateur ne voit que le pseudo.
    const normalized = normalizeUsername(username)
    const authEmail  = usernameToEmail(username)
    setLoading(true)
    try {
      if (tab === 'create') {
        // Pré-vérif d'unicité contre profiles.username. Indispensable car les
        // comptes Google existants ont un pseudo SANS email technique
        // correspondant : on ne peut pas se fier uniquement à l'unicité de
        // l'email Supabase. (La contrainte UNIQUE DB reste le garde-fou final.)
        const { data: available, error: rpcErr } = await supabase
          .rpc('username_available', { p_username: normalized })
        if (!rpcErr && available === false) {
          setError(L.errUserTaken); setTab('login'); setPassword('')
          return
        }

        const { data, error: e } = await supabase.auth.signUp({
          email: authEmail,
          password,
          // Le pseudo voyage dans user_metadata → réutilisé tel quel à l'onboarding
          // (SetupProfileScreen) pour renseigner profiles.username.
          options: { data: { username: normalized } },
        })
        if (e) {
          const friendly = mapError(e.message)
          setError(friendly)
          if (friendly === L.errTaken) { setTab('login'); setPassword('') }
          return
        }
        // Pseudo déjà pris (email technique existant) : Supabase renvoie un user
        // "fantôme" dont la liste d'identités est VIDE. Aucune écriture DB : le
        // compte existant n'est JAMAIS écrasé.
        const identities = data?.user?.identities
        const alreadyRegistered = !!data?.user && (!identities || identities.length === 0)
        if (alreadyRegistered) {
          setError(L.errTaken); setTab('login'); setPassword('')
          return
        }
        // mailer_autoconfirm=true → une session est renvoyée directement →
        // onAuthStateChange (AuthContext) redirige vers /onboarding.
        if (!data?.session) setNotice(L.checkEmail)
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        })
        if (e) { setError(mapError(e.message)); return }
        // Succès : onAuthStateChange gère la redirection
      }
    } catch (e) {
      setError(mapError(e?.message))
    } finally {
      setLoading(false)
    }
  }

  // NB : plus de « mot de passe oublié » — l'auth par pseudo n'a pas d'email réel,
  // donc aucune réinitialisation par email n'est possible (choix assumé).

  // Définit le nouveau mot de passe après clic sur le lien de récupération
  const handleResetPassword = async () => {
    setError(''); setNotice('')
    if (!pwValid) return setError(L.errPw)
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password })
      if (e) { setError(mapError(e.message)); return }
      setNotice(L.recDone)
      setPassword('')
      // Sort du mode récupération → l'effet de redirection envoie vers /app ou /onboarding
      endRecovery()
    } catch (e) {
      setError(mapError(e?.message))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    try { await signInWithGoogle() } catch (e) { console.error(e) }
  }

  const handleGuest = () => {
    enterAsGuest()
    navigate('/app', { replace: true })
  }

  const switchTab = (id) => { setTab(id); setError(''); setNotice('') }
  const onKey = (e) => { if (e.key === 'Enter' && !loading) handleSubmit() }

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
            {recovery ? L.recSub : L.tagline}
          </div>
        </div>

        {recovery ? (
        <>
          {/* ── Récupération : nouveau mot de passe ── */}
          <div style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 22, color: ink, textAlign: 'center', marginBottom: 18,
          }}>{L.recTitle}</div>

          <div style={{ marginBottom: 4 }}>
            <div style={{
              fontFamily: 'Mulish', fontSize: 9.5, color: stone,
              letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7,
            }}>{L.password}</div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !loading) handleResetPassword() }}
                placeholder={L.pwPh}
                autoComplete="new-password"
                style={{
                  width: '100%', padding: '14px 44px 14px 16px', borderRadius: 12,
                  background: card, border: `0.5px solid ${border}`,
                  fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
                  fontStyle: rtl ? 'normal' : 'italic',
                  fontSize: 16, color: ink, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={stone} strokeWidth="1.5" strokeLinecap="round">
                  {showPw
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
          </div>

          {password.length > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              {[[pwRules.len, L.ruleLen], [pwRules.let, L.ruleLet], [pwRules.num, L.ruleNum]].map(([ok, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 7, flexShrink: 0,
                    background: ok ? COURT.green : 'transparent',
                    border: `1.5px solid ${ok ? COURT.green : stone}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                  }}>
                    {ok && <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4,7.5 8,2.5" stroke={COURT.cream} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>}
                  </div>
                  <span style={{ fontFamily: 'Mulish', fontSize: 11, color: ok ? COURT.green : stone, transition: 'color 0.2s' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {error ? (
            <div style={{
              margin: '10px 0', padding: '10px 14px', borderRadius: 10,
              background: `${COURT.red || '#e74c3c'}10`, border: `0.5px solid ${COURT.red || '#e74c3c'}30`,
              fontFamily: 'Mulish', fontSize: 12, color: COURT.red || '#e74c3c',
            }}>{error}</div>
          ) : notice ? (
            <div style={{
              margin: '10px 0', padding: '10px 14px', borderRadius: 10,
              background: `${COURT.green}12`, border: `0.5px solid ${COURT.green}33`,
              fontFamily: 'Mulish', fontSize: 12, color: COURT.green,
            }}>{notice}</div>
          ) : <div style={{ height: 16 }} />}

          <button onClick={handleResetPassword} disabled={loading} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: loading ? `${COURT.green}80` : COURT.green,
            color: COURT.cream, border: `0.5px solid ${COURT.gold}`,
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic',
            fontSize: 18, cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s',
          }}>
            {loading ? '…' : L.recCta}
          </button>
        </>
        ) : (
        <>

        {/* ── Onglets ── */}
        <div style={{
          display: 'flex', background: dark ? COURT.darkCard : '#EBE7DE',
          borderRadius: 12, padding: 4, marginBottom: 20,
        }}>
          {[['create', L.create], ['login', L.login]].map(([id, label]) => (
            <button key={id} onClick={() => switchTab(id)} style={{
              flex: 1, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === id ? COURT.green : 'transparent',
              color: tab === id ? COURT.cream : stone,
              fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
              fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 15, transition: 'all 0.25s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Champ Nom d'utilisateur ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'Mulish', fontSize: 9.5, color: stone,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7,
          }}>{L.username}</div>
          <input
            type="text" value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={onKey}
            placeholder={L.usernamePh}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: card, border: `0.5px solid ${border}`,
              fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
              fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 16, color: ink, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {tab === 'create' && (
            <div style={{
              fontFamily: 'Mulish', fontSize: 10.5, color: stone,
              marginTop: 5, marginLeft: 2,
            }}>{L.usernameHint}</div>
          )}
        </div>

        {/* ── Champ Mot de passe ── */}
        <div style={{ marginBottom: 4 }}>
          <div style={{
            fontFamily: 'Mulish', fontSize: 9.5, color: stone,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7,
          }}>{L.password}</div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              placeholder={tab === 'create' ? L.pwPh : L.loginPwPh}
              autoComplete={tab === 'create' ? 'new-password' : 'current-password'}
              style={{
                width: '100%', padding: '14px 44px 14px 16px', borderRadius: 12,
                background: card, border: `0.5px solid ${border}`,
                fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
                fontStyle: rtl ? 'normal' : 'italic',
                fontSize: 16, color: ink, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={stone} strokeWidth="1.5" strokeLinecap="round">
                {showPw
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* ── Règles du mot de passe (create seulement, live) ── */}
        {tab === 'create' && password.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {[
              [pwRules.len, L.ruleLen],
              [pwRules.let, L.ruleLet],
              [pwRules.num, L.ruleNum],
            ].map(([ok, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7, flexShrink: 0,
                  background: ok ? COURT.green : 'transparent',
                  border: `1.5px solid ${ok ? COURT.green : stone}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {ok && <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7.5 8,2.5" stroke={COURT.cream} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>
                <span style={{
                  fontFamily: 'Mulish', fontSize: 11,
                  color: ok ? COURT.green : stone,
                  transition: 'color 0.2s',
                }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'login' && <div style={{ height: 10 }} />}

        {/* ── Message (erreur ou info) ── */}
        {error ? (
          <div style={{
            margin: '10px 0', padding: '10px 14px', borderRadius: 10,
            background: `${COURT.red || '#e74c3c'}10`,
            border: `0.5px solid ${COURT.red || '#e74c3c'}30`,
            fontFamily: 'Mulish', fontSize: 12, color: COURT.red || '#e74c3c',
          }}>
            {error}
          </div>
        ) : notice ? (
          <div style={{
            margin: '10px 0', padding: '10px 14px', borderRadius: 10,
            background: `${COURT.green}12`,
            border: `0.5px solid ${COURT.green}33`,
            fontFamily: 'Mulish', fontSize: 12, color: COURT.green,
          }}>
            {notice}
          </div>
        ) : <div style={{ height: 16 }} />}

        {/* ── Bouton principal ── */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '16px', borderRadius: 14,
          background: loading ? `${COURT.green}80` : COURT.green,
          color: COURT.cream, border: `0.5px solid ${COURT.gold}`,
          fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 18, cursor: loading ? 'default' : 'pointer',
          transition: 'all 0.2s', marginBottom: 0,
        }}>
          {loading ? '…' : (tab === 'create' ? L.cta_create : L.cta_login)}
        </button>

        {/* ── Séparateur ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 0.5, background: `${COURT.green}25` }} />
          <span style={{
            fontFamily: rtl ? 'Mulish' : 'Spectral, serif',
            fontStyle: 'italic', fontSize: 14, color: stone,
          }}>{L.or}</span>
          <div style={{ flex: 1, height: 0.5, background: `${COURT.green}25` }} />
        </div>

        {/* ── Google ── */}
        <button onClick={handleGoogle} style={{
          width: '100%', padding: '15px', borderRadius: 14,
          background: card, border: `0.5px solid ${border}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(15,61,41,0.14)'; e.currentTarget.style.borderColor = COURT.green; }}
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
          }}>{L.google}</span>
        </button>

        {/* ── Invité ── */}
        <button onClick={handleGuest} style={{
          marginTop: 20, width: '100%', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'center',
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
        </>
        )}

      </div>
    </div>
  )
}
