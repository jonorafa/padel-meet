// ───────────────────────────────────────────────────────────────────────────
// Auth par PSEUDO (sans email visible)
//
// Supabase Auth exige un email/téléphone en interne. On le rend invisible :
// l'utilisateur choisit un pseudo, et on génère un email TECHNIQUE déterministe
// `<pseudo>@padelmeet.app` utilisé uniquement par Supabase Auth en coulisse.
// L'utilisateur ne le voit ni ne le saisit jamais.
//
// Conséquences :
//  • L'unicité de l'email technique chez Supabase garantit l'unicité du pseudo
//    (en plus de la contrainte UNIQUE sur profiles.username et du RPC de pré-check).
//  • Aucune récupération de mot de passe possible (pas d'email réel) — choix assumé.
// ───────────────────────────────────────────────────────────────────────────

// Domaine technique des emails internes. Jamais contacté (mailer_autoconfirm=true).
export const USERNAME_DOMAIN = 'padelmeet.app'

// Règles du pseudo (sur la forme normalisée)
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/**
 * Normalise un pseudo : minuscules, sans accents, uniquement [a-z0-9_].
 * C'est cette forme qui sert de clé unique partout (email technique + profiles.username).
 */
export function normalizeUsername(raw = '') {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/[^a-z0-9_]/g, '')       // garde lettres/chiffres/underscore
    .slice(0, USERNAME_MAX)
}

/** Construit l'email technique invisible à partir du pseudo. */
export function usernameToEmail(raw = '') {
  return `${normalizeUsername(raw)}@${USERNAME_DOMAIN}`
}

/**
 * Valide le format d'un pseudo.
 * @returns {null | 'required' | 'tooShort' | 'tooLong'} clé d'erreur (null = OK)
 */
export function validateUsername(raw = '') {
  const u = normalizeUsername(raw)
  if (u.length === 0) return 'required'
  if (u.length < USERNAME_MIN) return 'tooShort'
  if (u.length > USERNAME_MAX) return 'tooLong'
  return null
}
