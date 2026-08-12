-- ============================================================================
-- Migration 029 : ferme les RPC internes exposés à anon + search_path figé
-- ============================================================================
-- PostgREST expose AUTOMATIQUEMENT toute fonction du schéma `public` sur
-- /rest/v1/rpc/<nom> dès que le rôle a EXECUTE. Or `anon` et `authenticated`
-- avaient EXECUTE sur TOUTES les fonctions, y compris des helpers internes
-- qui ne vérifient aucune identité — ils tiennent leur sécurité du fait
-- d'être appelés depuis une fonction qui, elle, a déjà validé auth.uid().
--
-- ── Le trou principal : add_confidence_credit ──────────────────────────────
-- Signature : (p_user, p_evaluator, p_channel, p_amount, p_reason).
-- Aucun contrôle de auth.uid(), tous les paramètres viennent de l'appelant.
-- Le plafond anti-collusion de la migration 023 (2 crédits peer / 7 jours)
-- ne s'applique QUE si p_channel = 'peer' — un appelant choisit ce paramètre.
--
-- Exploit, sans aucun compte (la clé publishable est publique par design) :
--   POST /rest/v1/rpc/add_confidence_credit
--   {"p_user":"<victime>", "p_channel":"play", "p_amount":25,
--    "p_reason":"play"}
-- → p_channel <> 'peer' : plafond de vitesse sauté, v_weight reste à 1.00
-- → recompute_confidence_rate ne somme que les reason LIKE 'peer%' / 'play%',
--   plafonnés à 25 chacun → confidence_rate = 50 + 25 + 25 = 100.
-- N'importe qui pouvait donc fixer le taux de confiance de n'importe quel
-- joueur à 100, ou saborder l'équité du système d'évaluation. Vérifié en
-- conditions réelles : l'appel anonyme renvoyait HTTP 204 (succès).
--
-- Ironie : la migration 021 avait ajouté un trigger BEFORE UPDATE pour
-- empêcher précisément l'écriture directe de confidence_rate par un client.
-- Ce RPC en SECURITY DEFINER (donc current_user = postgres) contournait
-- entièrement cette protection.
--
-- Révoquer est sans effet sur le fonctionnement : add_confidence_credit
-- n'est appelée que par confirm_match_result et submit_peer_evaluation —
-- toutes deux SECURITY DEFINER appartenant à postgres, et toutes deux
-- vérifiant auth.uid(). Une fonction SECURITY DEFINER s'exécute avec les
-- droits de son propriétaire, qui possède aussi ces helpers : les appels
-- internes passent donc indépendamment des GRANT d'anon/authenticated.
-- Côté client, add_confidence_credit n'apparaît que dans un commentaire de
-- src/lib/confidenceRules.js (miroir JS de la logique serveur), jamais dans
-- un .rpc().
-- ============================================================================

-- ── 1. Helpers du moteur de confiance : usage interne uniquement ───────────
REVOKE EXECUTE ON FUNCTION public.add_confidence_credit(uuid, uuid, text, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_confidence_rate(uuid) FROM anon, authenticated;

-- ── 2. Fonctions de trigger : jamais destinées à un appel direct ───────────
-- Elles retournent `trigger` : un appel via PostgREST échouerait de toute
-- façon, mais elles n'ont aucune raison d'être exposées. Le retrait du GRANT
-- n'empêche pas les triggers de se déclencher (la permission est vérifiée à
-- la création du trigger, pas à chaque exécution).
REVOKE EXECUTE ON FUNCTION public.record_initial_level() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_level_change() FROM anon, authenticated;

-- ── 3. Maintenance : n'appartient pas à la surface d'API publique ──────────
-- Personne ne l'appelle aujourd'hui (ni le client, ni un workflow, et pg_cron
-- n'est pas installé) — les résultats en attente n'expirent donc jamais
-- automatiquement, ce qui reste à traiter séparément. Un futur cron passera
-- par le rôle postgres/service, non concerné par ces GRANT.
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_results() FROM anon, authenticated;

-- ── 4. search_path figé sur les SECURITY DEFINER qui en manquaient ─────────
-- Sans search_path explicite, une fonction SECURITY DEFINER résout ses noms
-- de tables selon le search_path de l'appelant : quiconque peut créer un
-- objet dans un schéma consulté avant `public` peut détourner la fonction et
-- s'exécuter en tant que postgres. Ici le risque est déjà atténué (ni anon ni
-- authenticated n'ont CREATE sur public ou extensions), mais figer le
-- search_path est la défense correcte et ne coûte rien.
ALTER FUNCTION public.expire_old_pending_results() SET search_path = public;
ALTER FUNCTION public.get_player_stats(uuid)       SET search_path = public;

-- Fonctions de trigger en SECURITY INVOKER : pas d'élévation de privilège
-- possible, mais même traitement par cohérence.
ALTER FUNCTION public.ensure_single_primary_photo()       SET search_path = public;
ALTER FUNCTION public.auto_primary_first_photo()          SET search_path = public;
ALTER FUNCTION public.protect_sensitive_profile_columns() SET search_path = public;
ALTER FUNCTION public.sync_profile_stats()                SET search_path = public;

-- ── Volontairement conservé : get_player_stats reste ouvert ────────────────
-- Elle est réellement appelée par le client (src/hooks/usePlayerStats.js) et
-- ne renvoie que matches_played / wins / streak — des agrégats déjà affichés
-- sur chaque carte joueur. La révoquer à anon risquerait de casser la
-- navigation en mode invité pour une donnée non sensible.
