-- ============================================================================
-- PADEL MEET — Migration 026 : parité de schéma (séries + messages de support)
-- ============================================================================
-- Constat du chantier 6 : le projet EU, construit en rejouant 001→025, ne
-- correspond PAS à Tokyo. Cause racine : plusieurs objets ont été créés à la
-- main dans le dashboard de Tokyo au fil du temps, sans jamais être capturés
-- dans un fichier de migration. Les fichiers du dépôt ne décrivaient donc pas
-- l'intégralité du schéma réel.
--
-- Cette migration met sous contrôle de version les deux seuls objets manquants
-- que l'application UTILISE réellement. Elle est idempotente : sur Tokyo, où
-- ils existent déjà, elle ne change rien (hors le durcissement de policy en
-- partie C, qui est intentionnel et s'applique aux deux projets).
--
-- Vérifié avant écriture, par comparaison des deux schémas :
--   • 6 colonnes streak_* absentes d'EU  → useStreak.js les SELECT nommément
--     (ligne 44), donc PostgREST rejetterait la requête : le système de séries
--     est entièrement cassé sur EU (StreakScreen, StatsSection, badges.jsx).
--   • table support_messages absente d'EU → MatchScreen.jsx:2386 y insère le
--     formulaire de contact, qui échouerait.
--
-- DÉLIBÉRÉMENT NON REPRIS (reliques mortes de Tokyo, 0 usage applicatif
-- vérifié par recherche exhaustive sur src/) — les propager à EU ne ferait
-- qu'y recopier de la dette :
--   colonnes  profiles.avatar_url  (le code lit user_metadata.avatar_url,
--                                   côté auth, pas cette colonne)
--             profiles.bio         (le code utilise bio_fr / bio_en / bio_he)
--             profiles.is_online   (la présence passe par Realtime Presence)
--             profiles.matches_won (le code utilise `wins`)
--   tables    peer_ratings, player_ratings
--   fonctions rls_auto_enable, seed_demo_data_for_me, username_available
--             (l'unicité du pseudo vient de la contrainte UNIQUE + de l'email
--              technique, cf. src/lib/username.js)
-- Si tu veux une parité au bit près plutôt qu'une parité fonctionnelle, c'est
-- une décision séparée — ces objets sont listés ici pour qu'elle soit possible.
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A) Colonnes du système de séries (streak quotidien)
--
-- Types et defaults repris À L'IDENTIQUE de Tokyo (relevés via
-- information_schema le 2026-08-11), pour que les deux projets soient
-- réellement interchangeables :
--   streak_current   SMALLINT NOT NULL DEFAULT 0
--   streak_max       SMALLINT NOT NULL DEFAULT 0
--   streak_week_bits SMALLINT NOT NULL DEFAULT 0  -- bit 0=lundi … bit 6=dimanche
--   streak_week_num  SMALLINT NOT NULL DEFAULT 0  -- n° de semaine ISO
--   streak_start     DATE     NULL
--   streak_last_date DATE     NULL
--
-- NOT NULL DEFAULT 0 sur une table peuplée : Postgres remplit les lignes
-- existantes avec le default sans réécrire la table (métadonnée seule depuis
-- PG 11), donc pas de verrou long même avec des données.
--
-- streak_max ≠ série de VICTOIRES : c'est la plus longue série de CONNEXIONS
-- quotidiennes. Distinction déjà documentée dans src/lib/badges.jsx, qui
-- prend soin de ne pas confondre les deux pour le trophée « série de 5 ».
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_current   SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_max       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_week_bits SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_week_num  SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_start     DATE,
  ADD COLUMN IF NOT EXISTS streak_last_date DATE;


-- ─────────────────────────────────────────────────────────────────────────────
-- B) Table des messages de support (formulaire de contact)
--
-- Structure reprise à l'identique de Tokyo. Le formulaire accepte les
-- visiteurs NON connectés, d'où user_id nullable ; `email` et `name` sont
-- saisis par l'utilisateur (ce ne sont pas des copies de profiles/auth.users).
--
-- ON DELETE SET NULL sur user_id : à la suppression d'un compte (RGPD,
-- delete_user_account, migration 024), le message reste pour le suivi du
-- support mais perd son rattachement — cohérent avec le reste du schéma.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'Feedback',
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Insertion ouverte : le formulaire de contact doit fonctionner pour un
-- visiteur non authentifié (c'est souvent lui qui a besoin d'aide).
DROP POLICY IF EXISTS "support_insert" ON public.support_messages;
CREATE POLICY "support_insert"
  ON public.support_messages FOR INSERT TO public
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- C) Durcissement de la lecture — corrige une fuite constatée sur Tokyo
--
-- ⚠️ La policy de SELECT existante sur Tokyo est :
--        USING ((auth.uid() = user_id) OR (user_id IS NULL))
--    pour le rôle `public`. La seconde branche rend TOUT message envoyé par un
--    visiteur non connecté lisible par N'IMPORTE QUI — nom, email et contenu
--    du message compris. C'est la même classe de problème que profiles.email
--    au chantier 4 : une donnée personnelle exposée sans autorisation.
--    Constaté : 1 message anonyme actuellement dans ce cas sur Tokyo.
--
-- Recopier cette policy telle quelle sur EU y transporterait la fuite. Elle
-- est donc resserrée ici, sur les DEUX projets, à la seule branche légitime.
--
-- Sans risque de régression : l'application n'effectue AUCUN SELECT sur cette
-- table (vérifié — seul MatchScreen.jsx:2386 l'utilise, en INSERT). Un
-- visiteur anonyme n'a de toute façon pas d'identité permettant de relire son
-- propre message. La consultation du support se fait via le dashboard
-- Supabase / service_role, qui contourne RLS et n'est pas affecté.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "support_select_own" ON public.support_messages;
CREATE POLICY "support_select_own"
  ON public.support_messages FOR SELECT TO public
  USING (auth.uid() = user_id);


-- ============================================================================
-- ✅ Migration 026 terminée — parité fonctionnelle EU / Tokyo
-- ============================================================================
