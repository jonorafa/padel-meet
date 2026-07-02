import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Règles « React Compiler » (plugin react-hooks v7) : signaux d'optimisation
      // et de compatibilité compilateur, pas des bugs. Reclassées en warning —
      // à résorber progressivement (surtout lors du découpage de MatchScreen).
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      // Contrainte HMR dev-only : CourtUI.jsx exporte volontairement la palette
      // COURT + helpers à côté des composants.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
