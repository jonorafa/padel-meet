-- ============================================================================
-- PADEL MEET — Migration 021 : Verrouille les colonnes profiles sensibles
-- ============================================================================
-- FAILLE : la policy RLS "Users can update own profile" (auth.uid() = id) ne
-- restreint que la LIGNE, pas les COLONNES. is_admin, confidence_rate,
-- matches_played et wins sont donc modifiables par n'importe quel utilisateur
-- connecté via un simple PATCH REST (ou la console du navigateur) sur sa
-- propre ligne — sans jamais passer par une RPC.
--
-- Tentative initiale (REVOKE UPDATE (colonnes) ... FROM authenticated, anon)
-- inefficace : authenticated/anon ont un GRANT UPDATE au niveau TABLE
-- (role_table_grants), qui autorise déjà toutes les colonnes. Un REVOKE
-- colonne par colonne ne retire rien tant que le GRANT table-level subsiste
-- (vérifié en prod : les privilèges colonne restaient inchangés après le
-- premier REVOKE). Passer en liste blanche (REVOKE table-level puis GRANT
-- colonne par colonne) obligerait à lister les ~35 autres colonnes que
-- saveProfile() réécrit à chaque upsert — risque de régression inutile.
--
-- Solution retenue : trigger BEFORE INSERT OR UPDATE qui reverte ces 4
-- colonnes à leur valeur sûre (OLD.* en update, valeur par défaut en insert)
-- UNIQUEMENT quand l'appelant est authenticated/anon. Les fonctions serveur
-- (add_confidence_credit, confirm_match_result, submit_match_result,
-- submit_peer_evaluation, recompute_confidence_rate — toutes SECURITY
-- DEFINER, propriétaire postgres, vérifié) s'exécutent avec
-- current_user = postgres pendant toute leur durée, y compris pour les
-- triggers déclenchés par leurs propres UPDATE — ce garde-fou ne les
-- affecte donc pas.
--
-- Vérifié avant d'écrire cette migration (aucune régression) :
--   - is_admin             : jamais écrit côté client (grep confirmé), lu
--                            uniquement (profile?.is_admin, AdminScreen.jsx)
--   - confidence_rate      : jamais écrit côté client, uniquement via
--                            add_confidence_credit()/recompute_confidence_rate()
--   - matches_played/wins  : jamais écrits côté client (aucun insert direct
--                            dans match_history — toujours via
--                            submit_match_result/confirm_match_result),
--                            maintenus par le trigger trg_sync_profile_stats
--                            (lui-même pas SECURITY DEFINER, mais ne
--                            s'exécute que dans le contexte déjà élevé des
--                            RPC ci-dessus, jamais sous authenticated direct)
--
-- `level` est délibérément EXCLU de cette migration : contrairement aux 4
-- colonnes ci-dessus, il est aujourd'hui écrit directement par le client au
-- premier quiz (SetupProfileScreen) et à la réévaluation mensuelle
-- (MatchScreen), via saveProfile() → upsert(). Le bloquer sans remplacement
-- casserait l'onboarding. Nécessite une RPC dédiée (chantier séparé).
--
-- Idempotent — ré-exécutable (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.is_admin        := OLD.is_admin;
      NEW.confidence_rate := OLD.confidence_rate;
      NEW.matches_played  := OLD.matches_played;
      NEW.wins            := OLD.wins;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.is_admin        := FALSE;
      NEW.confidence_rate := 50;
      NEW.matches_played  := 0;
      NEW.wins            := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_columns();
