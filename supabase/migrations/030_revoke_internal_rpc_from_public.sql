-- ============================================================================
-- Migration 030 : la 029 était inopérante — révocation sur PUBLIC
-- ============================================================================
-- La migration 029 révoquait EXECUTE sur les helpers internes « FROM anon,
-- authenticated ». Vérification faite après application : l'appel anonyme à
-- add_confidence_credit passait toujours (il atteignait son INSERT et
-- échouait sur une contrainte de clé étrangère — donc bien exécuté, pas
-- refusé). L'ACL le confirmait :
--
--   {=X/postgres, postgres=X/postgres, service_role=X/postgres}
--     ^^^ bénéficiaire vide = PUBLIC
--
-- CREATE FUNCTION accorde EXECUTE à PUBLIC par défaut. La 029 a bien retiré
-- les droits explicites d'anon et authenticated, mais tous deux continuaient
-- d'hériter via PUBLIC. Révoquer sur un rôle ne perce pas un droit accordé
-- à PUBLIC — il faut viser PUBLIC lui-même.
--
-- Même piège que la migration 021 : REVOKE colonne par colonne y était resté
-- sans effet parce qu'un GRANT au niveau table couvrait déjà tout. Dans les
-- deux cas, un REVOKE ciblé ne défait pas un GRANT plus large.
--
-- postgres (propriétaire) et service_role gardent leur droit explicite : les
-- appels internes depuis confirm_match_result et submit_peer_evaluation, qui
-- s'exécutent en SECURITY DEFINER sous postgres, ne sont pas affectés.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.add_confidence_credit(uuid, uuid, text, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_confidence_rate(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_initial_level()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_level_change()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_results()     FROM PUBLIC;
