import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Estampille le service worker avec un identifiant de build.
//
// Le SW vit dans public/ : Vite le recopie tel quel, sans hachage ni
// transformation. Son cache de shell doit pourtant changer de nom à chaque
// déploiement, sans quoi `install` ne se rejoue jamais et l'index.html mis en
// cache reste celui d'un build révolu, pointant vers des chunks disparus.
//
// L'identifiant dérive du contenu de l'index.html produit, lequel référence
// tous les assets hachés : deux builds identiques donnent le même identifiant
// — donc aucune réinstallation inutile du SW — et le moindre changement de
// code en produit un nouveau.
function estampillerServiceWorker() {
  const REPERE = '__BUILD_ID__'
  return {
    name: 'estampiller-service-worker',
    apply: 'build',
    // closeBundle : les fichiers de public/ sont déjà recopiés dans dist/.
    closeBundle() {
      const cheminSW = resolve('dist/service-worker.js')
      const sw = readFileSync(cheminSW, 'utf8')
      if (!sw.includes(REPERE)) {
        // Échec bruyant : sans le repère, le SW partirait avec un nom de cache
        // figé et le bug d'index.html périmé reviendrait en silence.
        throw new Error(
          `Repère ${REPERE} introuvable dans public/service-worker.js — ` +
          "l'estampillage du cache ne peut pas se faire."
        )
      }
      const html = readFileSync(resolve('dist/index.html'), 'utf8')
      const version = createHash('sha256').update(html).digest('hex').slice(0, 12)
      writeFileSync(cheminSW, sw.split(REPERE).join(version))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), estampillerServiceWorker()],
  build: {
    rollupOptions: {
      output: {
        // Vendors stables dans leurs propres chunks → mieux mis en cache,
        // et le chunk applicatif initial reste léger.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@sentry'))    return 'sentry'
            if (id.includes('@supabase'))  return 'supabase'
            if (id.includes('posthog-js')) return 'posthog'
            return 'react' // react, react-dom, react-router-dom + petits vendors
          }
        },
      },
    },
  },
})
