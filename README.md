# Padel Meet

Application web (PWA) de mise en relation entre joueurs de padel, pour la **France** et **Israël**.
Entièrement trilingue **français / anglais / hébreu**, avec prise en charge complète du sens de lecture droite-à-gauche.

**En production :** https://padel-meet.vercel.app

---

## Ce que fait l'application

Un joueur crée son profil, passe un questionnaire d'auto-évaluation qui lui attribue un **niveau de 1 à 7**, puis découvre d'autres joueurs par cartes à faire glisser. Un score de compatibilité croise le niveau, la région, la fréquence de jeu, le style (offensif / défensif / polyvalent), le côté préféré et la motivation.

Deux « j'aime » réciproques ouvrent une conversation. De là, les joueurs planifient un match, saisissent le score, et s'évaluent mutuellement.

Un module d'apprentissage (quiz, glossaire des termes techniques) complète l'ensemble.

## Le confidence rate, en trois lignes

Le niveau déclaré ne suffit pas : chaque joueur porte un **indice de confiance** qui monte à mesure que ses partenaires confirment son niveau réel et qu'il enchaîne des matchs face à des joueurs de son niveau.

Ce n'est **pas un classement de performance** (type ELO) : c'est une mesure de la *cohérence* entre le niveau annoncé et l'appréciation des pairs. Il ne descend jamais.

Un mécanisme anti-collusion plafonne ce qu'un cercle fermé de joueurs peut s'accorder mutuellement, et les scores de match exigent la validation des deux joueurs.

---

## Stack

| Couche | Technologie |
|---|---|
| Interface | React 19 + Vite (Rolldown) |
| Base de données | Supabase — PostgreSQL avec Row Level Security |
| Authentification | Google OAuth via Supabase Auth |
| Temps réel | Supabase Realtime (présence, messagerie) |
| Fichiers | Supabase Storage (photos, extraits vidéo) |
| E-mail | Resend, via une edge function Deno |
| Erreurs | Sentry |
| Mesure d'audience | PostHog (cloud UE) |
| Hébergement | Vercel |

Aucun framework CSS : les styles sont en ligne, à partir d'un jeu de tokens (`COURT`, `TYPE`) défini dans `src/components/CourtUI.jsx`.

## Installation locale

```bash
git clone https://github.com/jonorafa/padel-meet.git
cd padel-meet
npm install
cp .env.example .env      # puis renseigner les variables (voir ci-dessous)
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` |
| `npm test` | Tests unitaires (runner natif de Node) |
| `npx eslint src/` | Analyse statique |

## Variables d'environnement

Toutes sont préfixées `VITE_` : elles sont **injectées au moment du build**, pas au démarrage. Sur Vercel, après les avoir définies, il faut **redéployer** — un simple redémarrage ne suffit pas.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `VITE_SUPABASE_URL` | oui | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | oui | Clé publique Supabase |
| `VITE_GOOGLE_CLIENT_ID` | oui | ID client OAuth (Google Cloud → Identifiants) |
| `VITE_SENTRY_DSN` | non | Vide = aucune erreur remontée |
| `VITE_POSTHOG_KEY` | non | Vide = analytics désactivée en silence |

Les secrets côté serveur (`RESEND_API_KEY`) vivent dans les variables de l'edge function Supabase, jamais dans ce dépôt.

## Architecture des dossiers

```
src/
  screens/      Écrans plein page (MatchScreen est le cœur de l'app)
  components/   Composants partagés + tokens du design system (CourtUI.jsx)
  context/      AuthContext, PrefsContext (langue/thème), PresenceContext
  hooks/        Accès aux données (joueurs, matchs, messages, séries…)
  lib/          Logique métier pure — c'est ce qui est couvert par les tests
  data/         Traductions, questions de quiz, glossaire, régions
supabase/
  migrations/   Source de vérité du schéma — numérotées, jamais réécrites
  functions/    Edge functions Deno
marketing/      Flyer, QR, calendrier social, fiches de boutique
```

`src/lib/` concentre la logique risquée (compatibilité, filtres, règles de l'indice de confiance, comptage des non-lus) précisément pour qu'elle soit testable sans monter de composant. C'est là que vivent les 61 tests.

`src/sql/` contient d'anciens scripts « chantier », **obsolètes** : ils précèdent la mise en place des migrations numérotées et ne doivent plus être exécutés.

## Migrations

`supabase/migrations/` est la **seule** source de vérité du schéma. Une migration appliquée n'est jamais modifiée — toute correction passe par un nouveau fichier numéroté.

```bash
supabase db push --linked          # applique les migrations en attente
supabase functions deploy notify-support   # déploie l'edge function
```

Ne jamais muter la production directement depuis le SQL Editor pour un changement de schéma : les fonctions en base finiraient par diverger des migrations, ce qui est déjà arrivé sur ce projet et a demandé une migration de reconvergence dédiée.

## Sécurité

Le RLS est actif sur l'ensemble des tables. Les opérations sensibles (soumission d'un score, évaluation d'un pair, suppression de compte) passent par des fonctions `SECURITY DEFINER` qui vérifient `auth.uid()` — elles rejettent les appels anonymes, ce qui a été vérifié par appels réels.

Les en-têtes de sécurité (CSP stricte, HSTS, `X-Frame-Options`, `Permissions-Policy`) sont définis dans `vercel.json`.

## Licence

Projet privé. Tous droits réservés.
