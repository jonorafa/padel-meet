import posthog from 'posthog-js';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics comportementale (PostHog Cloud EU) — events explicites uniquement,
// pas d'autocapture ni de session recording (contredirait la politique de
// confidentialité : l'autocapture enverrait du contenu de page — noms,
// messages de chat — à un tiers). Chacun des 6 events sert une des 4
// métriques produit aujourd'hui non calculables :
//
//   signup              → point de départ des cohortes de rétention J7/J30
//   quiz_completed       → taux de complétion du questionnaire de niveau
//   swipe                → volume d'usage du mode découverte
//   match_created         → nombre de matchs organisés
//   chat_first_message    → conversion match → conversation réelle
//   result_confirmed      → matchs réellement joués (pas juste matchés) et,
//                           combiné à profiles.confidence_rate, confidence
//                           rate moyen des utilisateurs actifs
// ─────────────────────────────────────────────────────────────────────────────

const KEY = import.meta.env.VITE_POSTHOG_KEY;

export function initAnalytics() {
  if (!KEY) return; // pas de clé → silencieux en dev local, aucun event envoyé

  posthog.init(KEY, {
    api_host: 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: 'localStorage',
  });
}

// Sûr à appeler même sans initAnalytics() (clé absente) — no-op silencieux,
// comme Sentry.captureException fonctionne déjà sans DSN configuré.
export function track(eventName, properties) {
  if (!KEY) return;
  posthog.capture(eventName, properties);
}

export function identifyUser(userId) {
  if (!KEY) return;
  posthog.identify(userId);
}

export function resetUser() {
  if (!KEY) return;
  posthog.reset();
}
