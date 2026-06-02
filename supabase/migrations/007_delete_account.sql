-- ============================================================================
-- Migration 007 : Fonction de suppression de compte (RGPD)
-- ============================================================================
-- Supprime en une transaction atomique :
--   1. Toutes les données liées à l'utilisateur (cascade automatique via FK)
--   2. L'entrée dans auth.users (l'email et les métadonnées d'auth)
--
-- Appelée côté client via : supabase.rpc('delete_user_account')
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire de la fonction
-- (postgres / service_role), qui a accès à auth.users.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Vérifie que l'utilisateur est bien authentifié
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- La suppression du profil cascade automatiquement via les FK ON DELETE CASCADE :
  --   → swipes (swiper_id, target_id)
  --   → matches (player1_id, player2_id)
  --     → messages (match_id)
  --   → notifications (user_id)
  --   → match_history (player_id)
  --   → peer_evaluations (via matches)
  DELETE FROM public.profiles WHERE id = uid;

  -- Supprime l'entrée auth (email, hash du mot de passe, tokens, metadata)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Autorise les utilisateurs authentifiés à appeler cette fonction
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
