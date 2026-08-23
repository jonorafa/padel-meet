import { COURT, PadelBall } from './CourtUI'

// AppLoading est monté AVANT que les contextes soient garantis prêts
// (ProtectedRoute pendant la résolution de session, Suspense pendant le
// chargement à la demande) : pas d'accès à usePrefs()/I18N. La langue vit
// dans localStorage['padel_lang'] (PrefsContext.jsx), lisible indépendamment
// — protégé, un stockage indisponible retombe sur le français.
function lireLangue() {
  try { return localStorage.getItem('padel_lang') || 'fr' }
  catch { return 'fr' }
}

const STRINGS = {
  fr: { loading: 'Chargement…', reload: 'Recharger' },
  en: { loading: 'Loading…',    reload: 'Reload' },
  he: { loading: 'טוען…',       reload: 'טען מחדש' },
}

/**
 * Écran d'attente commun au démarrage.
 *
 * Existe parce que deux endroits rendaient `null` pendant un chargement
 * (ProtectedRoute tant que la session n'est pas résolue, et le Suspense des
 * écrans chargés à la demande). Un `null` sur fond crème est indiscernable
 * d'une application cassée : c'est exactement ce que voyait l'utilisateur en
 * ouvrant le lien depuis WhatsApp. Afficher quelque chose ne corrige pas la
 * lenteur, mais distingue « ça charge » de « c'est mort », et le bouton
 * offre une porte de sortie si l'attente s'éternise malgré tout.
 */
export function AppLoading({ dark = false }) {
  const lang = lireLangue()
  const L = STRINGS[lang] || STRINGS.fr
  const rtl = lang === 'he'

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      background: dark ? COURT.darkBg : COURT.cream,
    }}>
      <div style={{ animation: 'bounceY 1.4s ease-in-out infinite' }}>
        <PadelBall size={44} />
      </div>
      <div style={{
        // Mulish n'a pas d'italique dessiné : romain en hébreu plutôt qu'une
        // inclinaison synthétique (même règle que dans le reste de l'app).
        fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
        fontStyle: rtl ? 'normal' : 'italic', fontSize: 15,
        color: dark ? COURT.darkMuted : COURT.stone,
      }}>
        {L.loading}
      </div>
      {/* N'apparaît qu'au bout de 6s (cf. l'animation) : inutile de proposer
          un rechargement pendant une attente normale, indispensable si le
          démarrage se bloque pour de bon. */}
      <button
        onClick={() => window.location.reload()}
        style={{
          opacity: 0, animation: 'apparaitTardif 0.4s ease 6s forwards',
          padding: '9px 20px', borderRadius: 999,
          background: 'transparent', color: dark ? COURT.darkText : COURT.green,
          border: `0.5px solid ${dark ? COURT.darkBorder : COURT.green}60`,
          fontFamily: 'Mulish, sans-serif', fontSize: 13, cursor: 'pointer',
        }}
      >
        {L.reload}
      </button>
    </div>
  )
}
