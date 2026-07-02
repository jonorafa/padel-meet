import { createContext, useContext, useState, useEffect } from 'react'
import { setDarkMode } from '../components/CourtUI'

const PrefsContext = createContext({})

// ─────────────────────────────────────────────────────────────────────────────
// Historique de niveau — chaque (ré)évaluation ajoute un point { level, date }.
// Stocké en localStorage (cohérent avec level/confidence). Sert à tracer la
// vraie courbe d'évolution dans StatsSection, au lieu d'une courbe fabriquée.
// ─────────────────────────────────────────────────────────────────────────────
function loadLevelHistory() {
  try {
    const raw = localStorage.getItem('padel_level_history')
    const arr = raw ? JSON.parse(raw) : null
    if (Array.isArray(arr) && arr.length > 0) return arr
  } catch { /* ignore JSON cassé */ }
  // Amorçage : si un niveau existe déjà mais aucun historique, on démarre la
  // série avec ce niveau (sinon la courbe n'aurait aucun point de référence).
  const lvl = parseFloat(localStorage.getItem('padel_level'))
  if (!isNaN(lvl)) {
    const seed = [{ level: lvl, date: new Date().toISOString() }]
    localStorage.setItem('padel_level_history', JSON.stringify(seed))
    return seed
  }
  return []
}

// Nettoie les données utilisateur du localStorage si le user a changé.
// Appelée avant de charger les prefs pour garantir que chaque utilisateur
// part d'une ardoise propre (pas d'historique du user précédent).
function cleanupOldUserData() {
  try {
    const storedUserId = localStorage.getItem('padel_user_id')
    const currentUserId = sessionStorage.getItem('current_user_id')
    if (storedUserId && currentUserId && storedUserId !== currentUserId) {
      // User a changé → nettoie les données du précédent
      localStorage.removeItem('padel_level')
      localStorage.removeItem('padel_confidence')
      localStorage.removeItem('padel_level_history')
    }
    if (currentUserId) {
      localStorage.setItem('padel_user_id', currentUserId)
    }
  } catch {
    // Ignore les erreurs de storage
  }
}

export function PrefsProvider({ children }) {
  const [lang,       _setLang]       = useState(() => localStorage.getItem('padel_lang') || 'fr')
  const [dark,       _setDark]       = useState(() => localStorage.getItem('padel_dark') === 'true')
  const [level,      _setLevel]      = useState(() => {
    cleanupOldUserData() // nettoie avant de charger
    const v = parseFloat(localStorage.getItem('padel_level'))
    return isNaN(v) ? null : v  // null = quiz non effectué
  })
  const [confidence, _setConfidence] = useState(() => {
    const v = parseFloat(localStorage.getItem('padel_confidence'))
    return isNaN(v) ? 50 : v
  })
  const [levelHistory, _setLevelHistory] = useState(() => {
    cleanupOldUserData() // nettoie avant de charger l'historique
    return loadLevelHistory()
  })

  // Sync dark mode on mount and whenever dark changes
  useEffect(() => {
    setDarkMode(dark)
    document.body.style.background = dark ? '#121A15' : '#1a1a18'
  }, [dark])

  const setLang       = (l) => { _setLang(l);       localStorage.setItem('padel_lang',       l)           }
  const setDark       = (d) => { _setDark(d);       localStorage.setItem('padel_dark',       String(d))   }
  const setConfidence = (c) => { _setConfidence(c); localStorage.setItem('padel_confidence', String(c))   }

  // Ajoute un point à l'historique de niveau (dédoublonné : on n'enregistre que
  // si le niveau diffère réellement du dernier point connu).
  const recordLevelPoint = (l) => {
    if (l == null) return
    _setLevelHistory(prev => {
      const last = prev[prev.length - 1]
      if (last && Math.abs(last.level - l) < 0.001) return prev
      const next = [...prev, { level: l, date: new Date().toISOString() }]
      try { localStorage.setItem('padel_level_history', JSON.stringify(next)) } catch { /* stockage plein/privé — best-effort */ }
      return next
    })
  }

  // setLevel enregistre AUSSI un point d'historique → la courbe devient réelle.
  const setLevel = (l) => {
    _setLevel(l)
    localStorage.setItem('padel_level', l === null ? '' : String(l))
    recordLevelPoint(l)
  }

  // Réinitialise complètement l'historique (utile pour debug / reset profil).
  const resetLevelHistory = (seed = null) => {
    const next = Array.isArray(seed) ? seed : []
    _setLevelHistory(next)
    try { localStorage.setItem('padel_level_history', JSON.stringify(next)) } catch { /* stockage plein/privé — best-effort */ }
  }

  const toggleDark = () => setDark(!dark)
  const toggleLang = () => setLang(lang === 'fr' ? 'en' : lang === 'en' ? 'he' : 'fr')

  return (
    <PrefsContext.Provider value={{
      lang, dark, level, confidence, levelHistory,
      setLang, setDark, setLevel, setConfidence,
      recordLevelPoint, resetLevelHistory,
      toggleDark, toggleLang,
    }}>
      {children}
    </PrefsContext.Provider>
  )
}

export const usePrefs = () => useContext(PrefsContext)
