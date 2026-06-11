import { useNavigate } from 'react-router-dom'
import { usePrefs } from '../context/PrefsContext'
import { COURT } from '../components/CourtUI'

// ─────────────────────────────────────────────────────────────────────────────
// Pages légales — Politique de confidentialité & CGU (EULA).
// Publiques (accessibles sans compte) : /privacy et /terms.
//
// ⚠️ À PERSONNALISER avant publication :
//   • CONTACT_EMAIL : mets une vraie adresse de contact
//   • Raison sociale / éditeur, adresse, et droit applicable si besoin
//   • Les CGU incluent la clause « tolérance zéro » exigée par l'App Store (1.2)
// ─────────────────────────────────────────────────────────────────────────────
const CONTACT_EMAIL = 'contact@padelmeet.app'   // TODO: remplacer par ta vraie adresse
const UPDATED = '12 juin 2026'

export default function LegalScreen({ doc = 'privacy' }) {
  const { dark } = usePrefs()
  const navigate = useNavigate()

  const bg     = dark ? COURT.darkBg   : COURT.cream
  const ink    = dark ? COURT.darkText : COURT.ink
  const muted  = dark ? COURT.darkMuted: COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}28`

  const h2 = { fontFamily: 'Spectral, serif', fontSize: 18, fontWeight: 800, color: COURT.green, margin: '22px 0 8px' }
  const p  = { fontFamily: 'Mulish', fontSize: 14, lineHeight: 1.65, color: ink, margin: '0 0 10px' }
  const li = { ...p, margin: '0 0 6px' }

  const Privacy = () => (
    <>
      <h1 style={{ fontFamily: 'Spectral, serif', fontSize: 26, fontWeight: 800, color: ink, margin: '0 0 4px' }}>
        Politique de confidentialité
      </h1>
      <div style={{ fontFamily: 'Mulish', fontSize: 12, color: muted, marginBottom: 8 }}>Dernière mise à jour : {UPDATED}</div>

      <p style={p}>
        Padel Meet (« l'application ») met en relation des joueurs de padel. Cette politique explique
        quelles données nous collectons, pourquoi, et tes droits sur ces données.
      </p>

      <h2 style={h2}>Données que nous collectons</h2>
      <p style={li}>• <b>Compte</b> : adresse e-mail, nom, âge, photos de profil.</p>
      <p style={li}>• <b>Profil de jeu</b> : niveau, main forte, côté, style, motivation, région/ville, préférences de partenaire.</p>
      <p style={li}>• <b>Activité</b> : matchs enregistrés, évaluations entre joueurs, séries (streak), messages échangés dans l'app.</p>
      <p style={li}>• <b>Technique</b> : données de connexion et de diagnostic (pour la stabilité et la sécurité).</p>

      <h2 style={h2}>Pourquoi (finalités)</h2>
      <p style={p}>
        Te proposer des partenaires pertinents (niveau, région, disponibilités), permettre la messagerie,
        afficher tes statistiques, et assurer la sécurité et la modération du service.
      </p>

      <h2 style={h2}>Hébergement & partage</h2>
      <p style={p}>
        Les données sont hébergées chez notre prestataire d'infrastructure (Supabase) sur des serveurs
        situés dans l'Union européenne. Nous utilisons un outil de suivi des erreurs (Sentry) pour la
        stabilité. Nous <b>ne vendons pas</b> tes données et ne les partageons pas à des fins publicitaires.
      </p>

      <h2 style={h2}>Conservation</h2>
      <p style={p}>
        Tes données sont conservées tant que ton compte est actif. À la suppression du compte, elles sont
        effacées (sauf obligation légale de conservation).
      </p>

      <h2 style={h2}>Tes droits</h2>
      <p style={p}>
        Conformément au RGPD : accès, rectification, suppression et portabilité de tes données. Tu peux
        <b> supprimer ton compte directement dans l'application</b> (Profil → Réglages), ou nous écrire à {CONTACT_EMAIL}.
      </p>

      <h2 style={h2}>Stockage local</h2>
      <p style={p}>
        L'application stocke certaines préférences (langue, thème, niveau) localement sur ton appareil
        pour fonctionner correctement. Aucun cookie publicitaire n'est utilisé.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Pour toute question : <b>{CONTACT_EMAIL}</b>.</p>
    </>
  )

  const Terms = () => (
    <>
      <h1 style={{ fontFamily: 'Spectral, serif', fontSize: 26, fontWeight: 800, color: ink, margin: '0 0 4px' }}>
        Conditions Générales d'Utilisation
      </h1>
      <div style={{ fontFamily: 'Mulish', fontSize: 12, color: muted, marginBottom: 8 }}>Dernière mise à jour : {UPDATED}</div>

      <p style={p}>
        En créant un compte et en utilisant Padel Meet, tu acceptes les présentes conditions. Si tu ne les
        acceptes pas, n'utilise pas l'application.
      </p>

      <h2 style={h2}>Admissibilité</h2>
      <p style={p}>
        Tu dois avoir au moins 16 ans pour utiliser l'application. Tu es responsable de l'exactitude des
        informations de ton profil.
      </p>

      <h2 style={h2}>Règles de conduite — tolérance zéro</h2>
      <p style={p}>
        Padel Meet applique une <b>politique de tolérance zéro</b> envers les contenus répréhensibles et les
        comportements abusifs. Il est strictement interdit de :
      </p>
      <p style={li}>• harceler, menacer, insulter ou intimider un autre utilisateur ;</p>
      <p style={li}>• publier un contenu haineux, violent, sexuellement explicite ou illégal ;</p>
      <p style={li}>• usurper une identité ou créer un faux profil ;</p>
      <p style={li}>• envoyer du spam ou solliciter à des fins commerciales non autorisées.</p>

      <h2 style={h2}>Signalement & blocage</h2>
      <p style={p}>
        Tu peux <b>signaler</b> ou <b>bloquer</b> tout utilisateur depuis son profil. Nous examinons les
        signalements et nous engageons à agir (avertissement, suppression de contenu, suspension ou
        suppression du compte) <b>sous 24 heures</b> pour les contenus répréhensibles. Les utilisateurs
        bloqués ne peuvent plus te contacter ni voir ton profil.
      </p>

      <h2 style={h2}>Contenu des utilisateurs</h2>
      <p style={p}>
        Tu restes responsable des contenus que tu publies (photos, bio, messages). Tu nous accordes le droit
        de les héberger et de les afficher dans le cadre du service. Nous pouvons retirer tout contenu
        contraire aux présentes conditions.
      </p>

      <h2 style={h2}>Suspension & résiliation</h2>
      <p style={p}>
        Nous pouvons suspendre ou supprimer un compte en cas de violation de ces règles, sans préavis si la
        gravité le justifie. Tu peux supprimer ton compte à tout moment.
      </p>

      <h2 style={h2}>Rencontres & responsabilité</h2>
      <p style={p}>
        Padel Meet est un outil de mise en relation sportive. Les rencontres et matchs se font sous ta
        propre responsabilité. Nous ne sommes pas responsables des interactions entre utilisateurs hors de
        l'application.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Pour toute question : <b>{CONTACT_EMAIL}</b>.</p>
    </>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 18px', borderBottom: `0.5px solid ${border}`, flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 38, height: 38, borderRadius: 10, border: `0.5px solid ${border}`,
          background: 'transparent', color: ink, cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} aria-label="Retour">←</button>
        <div style={{ fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 700, color: ink }}>
          {doc === 'terms' ? 'CGU' : 'Confidentialité'}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 20px 40px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {doc === 'terms' ? <Terms /> : <Privacy />}
      </div>
    </div>
  )
}
