-- ============================================================================
-- PADEL MEET — Migration 022 : Traçabilité du consentement RGPD/PPL
-- ============================================================================
-- Le consentement était jusqu'ici passif : un texte "en continuant tu
-- acceptes..." sans case à cocher, et accepted_terms_at horodaté
-- automatiquement au premier saveProfile() — ce qui prouve une date mais pas
-- un acte de consentement positif (RGPD art. 7, PPL Amendment 13).
--
-- Cette migration ajoute consent_version pour tracer QUELLE version des CGU/
-- Privacy Policy a été acceptée. accepted_terms_at (colonne déjà existante)
-- change de sens : elle enregistre désormais l'instant réel du clic sur la
-- case à cocher (cf AuthScreen.jsx / AuthContext.jsx), pas le premier appel
-- serveur qui a suivi.
--
-- Idempotent — ré-exécutable.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

COMMENT ON COLUMN public.profiles.consent_version IS
  'Version des CGU/Privacy Policy acceptée activement via checkbox, ex. 2026-08';

COMMENT ON COLUMN public.profiles.accepted_terms_at IS
  'Horodatage de l''action positive de consentement (checkbox cochée), pas du premier saveProfile()';
