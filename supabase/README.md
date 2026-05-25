# Padel Meet — Base de données Supabase

## Structure

```
supabase/
  migrations/
    001_schema.sql      ← Tables, RLS, Vue, Realtime
    002_functions.sql   ← Toutes les fonctions & triggers
    003_storage.sql     ← Bucket profile-photos + policies
  seed.sql              ← 50 profils démo (données, pas migration)
  README.md             ← Ce fichier
```

---

## Ordre d'exécution (base de données vide)

```
001_schema.sql  →  002_functions.sql  →  003_storage.sql  →  seed.sql
```

**Pour un premier setup** ou une réinitialisation complète :
1. Ouvrir Supabase SQL Editor
2. Coller et exécuter **001_schema.sql**
3. Coller et exécuter **002_functions.sql**
4. Coller et exécuter **003_storage.sql**
5. *(Optionnel)* Coller et exécuter **seed.sql** pour les démos

Tous les fichiers sont **idempotents** (ré-exécutables sans erreur).

---

## Ajouter une nouvelle feature (workflow correct)

### Option A — Supabase CLI (recommandé)

```bash
# 1. Installer Supabase CLI (une seule fois)
npm install -g supabase

# 2. Se connecter
supabase login

# 3. Lier au projet (une seule fois, trouvez l'ID dans Dashboard → Settings)
supabase link --project-ref <VOTRE_PROJECT_REF>

# 4. Créer un nouveau fichier de migration
supabase migration new nom_de_la_feature
# → crée supabase/migrations/20240601120000_nom_de_la_feature.sql

# 5. Écrire le SQL dans ce fichier

# 6. Appliquer en production
supabase db push
```

Supabase CLI garde une trace dans `supabase_migrations.schema_migrations`.
Une migration ne s'exécute qu'**une seule fois**.

### Option B — Manuel (plus simple, sans CLI)

1. Créer un fichier `004_nouvelle_feature.sql` dans `migrations/`
2. Y écrire le SQL (utiliser `IF NOT EXISTS`, `CREATE OR REPLACE`)
3. Copier-coller dans Supabase SQL Editor et exécuter
4. Committer le fichier dans Git (`git add + git commit + git push`)

---

## Pourquoi ne pas tout mettre dans une seule query Supabase ?

Supabase SQL Editor **ne garde pas l'historique** des queries exécutées.
Si tu ajoutes tout dans une seule grosse query :
- Tu ne sais plus ce qui a été appliqué
- Tu risques des erreurs si une table existe déjà
- Pas de rollback possible

Avec des fichiers versionnés dans Git :
- Historique complet (qui a changé quoi, quand)
- Reproductible sur un nouveau projet
- Revenir en arrière possible

---

## Fichiers `src/sql/` (anciens chantiers)

Les fichiers dans `src/sql/chantier*.sql` sont l'**historique** des migrations
appliquées progressivement. Ils sont conservés pour référence mais le contenu
final est consolidé dans `supabase/migrations/`.

> ⚠️ Ne pas les ré-exécuter — ils contiennent des versions intermédiaires
> de fonctions qui ont depuis été améliorées.

---

## Tables principales

| Table | Description |
|-------|-------------|
| `profiles` | Profils joueurs (avec `is_demo`, `confidence_rate`, `partner_prefs`) |
| `swipes` | Swipes gauche/droite |
| `matches` | Likes mutuels (avec `score_locked`, `score_attempts`) |
| `messages` | Chat (avec `msg_type`, `metadata`) |
| `notifications` | Notifs temps réel |
| `match_history` | Résultats confirmés |
| `peer_evaluations` | Évaluations de niveau |
| `pending_match_results` | Scores en attente de confirmation (72h) |
| `confidence_log` | Traçabilité des changements de `confidence_rate` |
| `profile_photos` | Galerie photos multi-photos |

## Fonctions clés

| Fonction | Description |
|----------|-------------|
| `submit_match_result()` | Soumet un score (crée un pending) |
| `confirm_match_result()` | Confirme → écrit dans match_history |
| `reject_match_result()` | Rejette → incrémente compteur (lock à 3) |
| `submit_peer_evaluation()` | Évalue le niveau d'un adversaire |
| `expire_old_pending_results()` | À appeler en CRON toutes les heures |
