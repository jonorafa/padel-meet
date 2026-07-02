-- ============================================================================
-- PADEL MEET — Migration 020 : Back-office modération (rôle admin)
-- ============================================================================
-- La table reports (015) n'était consultable que par le signaleur lui-même ;
-- la modération supposait la service_role (aucune interface n'existait).
-- On introduit un rôle admin minimal pour consulter et traiter les
-- signalements directement depuis l'app (écran /admin) :
--   • profiles.is_admin (défaut FALSE)
--   • is_app_admin() — SECURITY DEFINER pour éviter la récursion RLS
--   • policies : les admins lisent TOUS les reports et peuvent changer status
--
-- Idempotent — ré-exécutable.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Vérifie si l'utilisateur courant est admin. SECURITY DEFINER : lit profiles
-- sans repasser par la RLS (évite toute récursion policy → profiles → policy).
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), FALSE)
$$;

-- Les admins voient tous les signalements (les users gardent reports_select_own)
DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT USING (public.is_app_admin());

-- Les admins peuvent traiter un signalement (changer status)
DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Compte fondateur = admin
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'jonathanbens10@gmail.com';
