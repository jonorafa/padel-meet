import { createContext, useContext, useState, useEffect } from 'react'
import { setDarkMode } from '../components/CourtUI'

const PrefsContext = createContext({})

export function PrefsProvider({ children }) {
  const [lang,       _setLang]       = useState(() => localStorage.getItem('padel_lang') || 'fr')
  const [dark,       _setDark]       = useState(() => localStorage.getItem('padel_dark') === 'true')
  const [level,      _setLevel]      = useState(() => parseFloat(localStorage.getItem('padel_level') || '3.5'))
  const [confidence, _setConfidence] = useState(() => parseInt(localStorage.getItem('padel_confidence') || '50', 10))

  // Sync dark mode on mount and whenever dark changes
  useEffect(() => {
    setDarkMode(dark)
    document.body.style.background = dark ? '#121A15' : '#1a1a18'
  }, [dark])

  const setLang       = (l) => { _setLang(l);       localStorage.setItem('padel_lang',       l)           }
  const setDark       = (d) => { _setDark(d);       localStorage.setItem('padel_dark',       String(d))   }
  const setLevel      = (l) => { _setLevel(l);      localStorage.setItem('padel_level',      String(l))   }
  const setConfidence = (c) => { _setConfidence(c); localStorage.setItem('padel_confidence', String(c))   }

  const toggleDark = () => setDark(!dark)
  const toggleLang = () => setLang(lang === 'fr' ? 'en' : lang === 'en' ? 'he' : 'fr')

  return (
    <PrefsContext.Provider value={{
      lang, dark, level, confidence,
      setLang, setDark, setLevel, setConfidence,
      toggleDark, toggleLang,
    }}>
      {children}
    </PrefsContext.Provider>
  )
}

export const usePrefs = () => useContext(PrefsContext)
