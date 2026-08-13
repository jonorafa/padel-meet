import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return; // pas de DSN → silencieux en dev local
  // Uniquement en production : sans ce garde, VITE_SENTRY_DSN étant aussi
  // défini en local, chaque session de dev/test remontait ses erreurs
  // (rechargements de serveur, service worker interrompu…) comme s'il
  // s'agissait d'utilisateurs réels.
  if (!import.meta.env.PROD) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE, // 'production' ou 'development'
    // Performance monitoring : 10 % des sessions en prod, 100 % en dev
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Replay : enregistre 5 % des sessions normales, 100 % des sessions avec erreur
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,  // RGPD : textes masqués dans les replays
        blockAllMedia: true,
      }),
    ],
    // Ignore les erreurs réseau banales
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'ResizeObserver loop limit exceeded',
    ],
  });
}

// Ré-exporte les helpers Sentry pour usage dans l'app
export { Sentry };
