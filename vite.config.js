import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendors stables dans leurs propres chunks → mieux mis en cache,
        // et le chunk applicatif initial reste léger.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@sentry'))   return 'sentry'
            if (id.includes('@supabase')) return 'supabase'
            return 'react' // react, react-dom, react-router-dom + petits vendors
          }
        },
      },
    },
  },
})
