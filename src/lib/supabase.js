import { createClient } from '@supabase/supabase-js'

// URL et clé lues depuis l'environnement (.env en local, variables Vercel en
// prod) et NON codées en dur : sinon changer de projet Supabase — par exemple
// pour migrer de région — imposerait un commit et un redéploiement, et
// modifier les variables Vercel n'aurait aucun effet visible.
const url = import.meta.env.VITE_SUPABASE_URL
// Format sb_publishable_* : c'est la clé anon, publique par conception (déjà
// visible dans le bundle JS livré au navigateur, protégée uniquement par les
// policies RLS côté base) — pas un secret à traiter comme tel.
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Échec bruyant plutôt que silencieux : sans ces variables l'app ne peut rien
// faire (auth, profils, matchs, chat). Une erreur claire au chargement vaut
// mieux qu'une cascade de requêtes qui échouent une par une.
if (!url || !key) {
  throw new Error(
    'Configuration Supabase manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ' +
    'doivent être définies (fichier .env en local, variables d\'environnement sur Vercel). ' +
    'Rappel : les variables VITE_* sont injectées au build — après les avoir changées ' +
    'sur Vercel, il faut redéployer, un simple redémarrage ne suffit pas.'
  )
}

export const supabase = createClient(url, key)
