-- ============================================================================
-- Migration 028 : match_score_status respecte enfin RLS
-- ============================================================================
-- En Postgres, une vue s'exécute par défaut avec les droits de son
-- propriétaire (superuser postgres), pas de l'appelant. La table `matches`
-- restreint son SELECT à player1_id/player2_id du joueur connecté, mais la
-- vue la contournait totalement : tout rôle `authenticated` (GRANT SELECT
-- donné en migration 001) pouvait lire /rest/v1/match_score_status pour
-- TOUS les matchs de l'app — score_attempts, score_locked, current_pending_id
-- de joueurs autres que lui. Trouvé par l'advisor de sécurité Supabase
-- (ERROR, security_definer_view) sur le projet EU.
--
-- security_invoker = true (Postgres 15+) fait exécuter la vue avec les
-- droits de l'appelant : RLS de `matches` et `pending_match_results`
-- s'applique alors normalement, la vue ne montre plus que les matchs du
-- joueur connecté — même résultat que si le code interrogeait la table
-- directement.
-- ============================================================================

ALTER VIEW public.match_score_status SET (security_invoker = true);
