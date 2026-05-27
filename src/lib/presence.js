/**
 * Formatte le statut de présence d'un joueur en chaîne lisible.
 *
 * Échelle progressive (offline) :
 *   < 5 min  → « En ligne récemment »
 *   < 1 h    → « En ligne il y a X min »
 *   < 24 h   → « En ligne il y a X h »
 *   < 7 j    → « Vu il y a X j »
 *   sinon    → « Vu il y a longtemps »
 *
 * @param {boolean} isOnline   - vrai si l'user est actuellement connecté (Realtime)
 * @param {string|Date|null} lastSeen - timestamp ISO ou Date du dernier passage
 * @param {'fr'|'en'|'he'} lang
 * @returns {string}
 */
export function formatPresence(isOnline, lastSeen, lang = 'fr') {
  const L = LABELS[lang] || LABELS.fr
  if (isOnline) return L.online
  if (!lastSeen) return L.unknown

  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffSec / 3600)
  const diffDay = Math.floor(diffSec / 86400)

  if (diffMin < 5)   return L.recent
  if (diffMin < 60)  return L.minAgo(diffMin)
  if (diffHour < 24) return L.hourAgo(diffHour)
  if (diffDay < 7)   return L.dayAgo(diffDay)
  return L.longAgo
}

const LABELS = {
  fr: {
    online:   'En ligne',
    recent:   'En ligne récemment',
    unknown:  'Hors ligne',
    longAgo:  'Vu il y a longtemps',
    minAgo:  (n) => `En ligne il y a ${n} min`,
    hourAgo: (n) => `En ligne il y a ${n} h`,
    dayAgo:  (n) => `Vu il y a ${n} j`,
  },
  en: {
    online:   'Online',
    recent:   'Recently active',
    unknown:  'Offline',
    longAgo:  'Last seen a while ago',
    minAgo:  (n) => `Active ${n} min ago`,
    hourAgo: (n) => `Active ${n} h ago`,
    dayAgo:  (n) => `Last seen ${n} d ago`,
  },
  he: {
    online:   'מחובר',
    recent:   'פעיל לאחרונה',
    unknown:  'לא מחובר',
    longAgo:  'נראה לפני זמן רב',
    minAgo:  (n) => `פעיל לפני ${n} דק׳`,
    hourAgo: (n) => `פעיל לפני ${n} שעות`,
    dayAgo:  (n) => `נראה לפני ${n} ימים`,
  },
}
