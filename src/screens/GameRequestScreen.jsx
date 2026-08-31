import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { COURT, TYPE, Ornament, ThinButton } from '../components/CourtUI'
import { usePrefs } from '../context/PrefsContext'
import { supabase } from '../lib/supabase'
import { track } from '../analytics'
import { Sentry } from '../sentry'

// ─────────────────────────────────────────────────────────────────────────────
// /g/:token — aperçu public d'une demande de partie.
//
// Cet écran est le SEUL de l'app conçu pour être vu par quelqu'un qui n'a pas
// de compte : c'est un lien collé dans une conversation WhatsApp. Il ne doit
// donc rien exiger — ni session, ni onboarding — avant d'avoir montré ce qui
// est proposé. La création de compte n'arrive qu'après, si la partie
// intéresse.
//
// Les données viennent de la RPC get_game_request_preview (migration 040), qui
// est accessible à `anon` et ne renvoie que le strict nécessaire : jamais
// creator_id, jamais les tokens d'autres demandes. La table game_requests
// elle-même reste fermée en lecture directe.
// ─────────────────────────────────────────────────────────────────────────────

const L = {
  fr: {
    eyebrow: 'INVITATION',
    loading: 'Chargement…',
    notFound: 'Cette invitation n’existe plus',
    notFoundSub: 'Le lien est peut-être expiré, ou la partie a été annulée.',
    past: 'Cette partie a déjà eu lieu',
    pastSub: 'Mais tu peux trouver d’autres partenaires sur Padel Meet.',
    looking: (n, prenom) => `${prenom} cherche ${n} joueur${n > 1 ? 's' : ''}`,
    lookingNoName: (n) => `On cherche ${n} joueur${n > 1 ? 's' : ''}`,
    level: 'Niveau',
    interested: 'Ça m’intéresse',
    interestedDone: 'Intérêt envoyé ✓',
    explore: 'Découvrir Padel Meet',
    howto: 'Crée ton compte pour rejoindre la partie et discuter avec les joueurs.',
  },
  en: {
    eyebrow: 'INVITATION',
    loading: 'Loading…',
    notFound: 'This invitation no longer exists',
    notFoundSub: 'The link may have expired, or the game was cancelled.',
    past: 'This game already took place',
    pastSub: 'But you can still find other partners on Padel Meet.',
    looking: (n, prenom) => `${prenom} is looking for ${n} player${n > 1 ? 's' : ''}`,
    lookingNoName: (n) => `Looking for ${n} player${n > 1 ? 's' : ''}`,
    level: 'Level',
    interested: 'I’m interested',
    interestedDone: 'Interest sent ✓',
    explore: 'Discover Padel Meet',
    howto: 'Create your account to join the game and chat with the players.',
  },
  he: {
    eyebrow: 'הזמנה',
    loading: 'טוען…',
    notFound: 'ההזמנה הזו כבר לא קיימת',
    notFoundSub: 'ייתכן שהקישור פג או שהמשחק בוטל.',
    past: 'המשחק הזה כבר התקיים',
    pastSub: 'אבל אפשר למצוא שותפים אחרים ב-Padel Meet.',
    looking: (n, prenom) => `${prenom} מחפש ${n} שחקנים`,
    lookingNoName: (n) => `מחפשים ${n} שחקנים`,
    level: 'רמה',
    interested: 'מעניין אותי',
    interestedDone: 'העניין נשלח ✓',
    explore: 'לגלות את Padel Meet',
    howto: 'צור חשבון כדי להצטרף למשחק ולשוחח עם השחקנים.',
  },
}

export default function GameRequestScreen() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { lang, dark } = usePrefs()
  const t = L[lang] || L.fr
  const rtl = lang === 'he'

  const [etat, setEtat] = useState('chargement')   // chargement | ok | introuvable | erreur
  const [demande, setDemande] = useState(null)
  const [interetEnvoye, setInteretEnvoye] = useState(false)

  const bg    = dark ? COURT.darkBg    : COURT.cream
  const card  = dark ? COURT.darkCard  : '#ffffff'
  const ink   = dark ? COURT.darkText  : COURT.ink
  const stone = dark ? COURT.darkMuted : COURT.stone
  const green = dark ? COURT.greenOnDark : COURT.green
  const ffTitre = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  useEffect(() => {
    let annule = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_game_request_preview', { p_token: token })
      if (annule) return
      if (error) {
        Sentry.captureException(error)
        setEtat('erreur')
        return
      }
      const d = Array.isArray(data) ? data[0] : data
      if (!d) { setEtat('introuvable'); return }
      setDemande(d)
      setEtat('ok')
      // Envoyé une seule fois, à l'ouverture réussie du lien. C'est le seul
      // event de la série qui part typiquement sans session.
      track('game_link_opened', { is_past: !!d.is_past })
    })()
    return () => { annule = true }
  }, [token])

  const dateLisible = demande?.scheduled_at
    ? new Date(demande.scheduled_at).toLocaleString(
        lang === 'he' ? 'he-IL' : lang === 'en' ? 'en-GB' : 'fr-FR',
        { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  const surInteret = () => {
    setInteretEnvoye(true)
    track('game_join_interest')
    // Pas de compte requis pour signaler l'intérêt : on l'enregistre côté
    // analytics, puis on propose la création de compte. Exiger l'inscription
    // AVANT de savoir si la personne est intéressée ferait perdre les deux.
    setTimeout(() => navigate('/auth'), 900)
  }

  const enveloppe = (contenu) => (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg, overflowY: 'auto',
      padding: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px)) 22px 40px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>{contenu}</div>
  )

  if (etat === 'chargement') return enveloppe(
    <div style={{ marginTop: '35vh', fontFamily: ffTitre, fontStyle: rtl ? 'normal' : 'italic', fontSize: 15, color: stone }}>
      {t.loading}
    </div>
  )

  if (etat === 'introuvable' || etat === 'erreur') return enveloppe(
    <>
      <div style={{ fontSize: 40, marginTop: '25vh', marginBottom: 14 }}>🎾</div>
      <h1 style={{ fontFamily: ffTitre, fontSize: 21, fontWeight: 700, color: ink, margin: '0 0 8px', textAlign: 'center' }}>
        {t.notFound}
      </h1>
      <p style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone, textAlign: 'center', margin: '0 0 24px', maxWidth: 300 }}>
        {t.notFoundSub}
      </p>
      <ThinButton onClick={() => navigate('/')} variant="green" lang={lang}>{t.explore}</ThinButton>
    </>
  )

  const n = demande.spots_needed
  const titre = demande.creator_first_name
    ? t.looking(n, demande.creator_first_name)
    : t.lookingNoName(n)

  return enveloppe(
    <>
      <div style={{
        fontFamily: 'Mulish', fontSize: TYPE.micro, letterSpacing: '0.14em',
        color: green, marginBottom: 4,
      }}>{t.eyebrow}</div>

      <h1 style={{
        fontFamily: ffTitre, fontStyle: rtl ? 'normal' : 'italic',
        fontSize: 26, fontWeight: 700, color: ink, margin: '0 0 10px',
        textAlign: 'center', textWrap: 'balance',
      }}>{titre}</h1>

      <Ornament width={50} color={COURT.gold} />

      {demande.is_past && (
        <div style={{
          marginTop: 16, padding: '10px 14px', borderRadius: 10,
          background: dark ? `${COURT.gold}14` : `${COURT.gold}1F`,
          border: `0.5px solid ${COURT.gold}80`,
          fontFamily: 'Mulish', fontSize: TYPE.micro, color: ink, textAlign: 'center',
        }}>
          <b>{t.past}</b><br />{t.pastSub}
        </div>
      )}

      <div style={{
        width: '100%', maxWidth: 360, marginTop: 20,
        background: card, borderRadius: 14, padding: '18px 20px',
        border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '20'}`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {dateLisible && (
          <Ligne label="🗓" valeur={dateLisible} ink={ink} />
        )}
        {(demande.club_name || demande.city) && (
          <Ligne label="📍" valeur={[demande.club_name, demande.city].filter(Boolean).join(' · ')} ink={ink} />
        )}
        {demande.level_min != null && demande.level_max != null && (
          <Ligne label="✦" valeur={`${t.level} ${demande.level_min}–${demande.level_max}`} ink={ink} />
        )}
        {/* Le nombre de places cherchées n'est PAS répété ici : le titre le
            porte déjà (« Adam cherche 2 joueurs »). Une ligne « 🎾 2 » isolée
            n'ajoutait rien et ne se comprenait pas sans son titre. */}
      </div>

      {!demande.is_past && (
        <div style={{ width: '100%', maxWidth: 360, marginTop: 20 }}>
          <ThinButton
            onClick={surInteret}
            variant="green"
            full
            lang={lang}
          >
            {interetEnvoye ? t.interestedDone : t.interested}
          </ThinButton>
          <p style={{
            fontFamily: 'Mulish', fontSize: TYPE.micro, color: stone,
            textAlign: 'center', marginTop: 10, lineHeight: 1.5,
          }}>{t.howto}</p>
        </div>
      )}
    </>
  )
}

// Défini au niveau module : un composant recréé à chaque rendu est vu par
// React comme un TYPE différent et remonte le sous-arbre.
function Ligne({ label, valeur, ink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontFamily: 'Mulish', fontSize: 15, color: ink, lineHeight: 1.4 }}>
        {valeur}
      </span>
    </div>
  )
}
