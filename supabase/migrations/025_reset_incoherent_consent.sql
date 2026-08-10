-- ============================================================================
-- PADEL MEET — Migration 025 : réinitialisation du consentement incohérent
-- ============================================================================
-- 2 comptes réels (Tokyo) ont accepted_terms_at renseigné sans consent_version,
-- antérieurs à la migration 022. Décision produit : redemander le consentement
-- plutôt que fabriquer une version rétroactive non explicitement acceptée.
-- Au prochain login, l'écran de consentement (chantier 4) leur sera représenté.
--
-- Ne PAS rejouer aveuglément sur un autre projet : le WHERE ne cible que l'état
-- exact constaté sur Tokyo le 2026-08-11, confirmé en lecture seule avant
-- écriture (cf. chantier 5) :
--
--   id                                    accepted_terms_at          consent_version
--   89f806cc-c00b-46b0-8b2e-86fa4a72c306  2026-08-03 10:06:12.516+00 NULL
--   97d8ee52-cfcc-4a40-b62a-15b8785242a4  2026-08-03 21:42:39.93+00  NULL
--
-- Contrôle croisé effectué : 2 lignes incohérentes DANS LES DEUX SENS, donc
-- aucun cas inverse (consent_version renseigné sans date) — le WHERE ci-dessous
-- couvre bien la totalité des lignes à corriger.
--
-- Le projet EU n'est PAS concerné : base neuve, sans ces lignes.
--
-- Idempotent — après application, plus aucune ligne ne satisfait le WHERE.
-- ============================================================================

UPDATE public.profiles
SET accepted_terms_at = NULL
WHERE accepted_terms_at IS NOT NULL AND consent_version IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Contrainte de cohérence du consentement — déplacée depuis la migration 024,
-- où elle était commentée (marqueur « -- ÉCHEC : ») précisément à cause des
-- 2 lignes ci-dessus. Elles étant corrigées, la contrainte peut être posée.
--
-- accepted_terms_at et consent_version doivent être tous deux renseignés ou
-- tous deux NULL : un accepted_terms_at seul est une date sans preuve de la
-- version de CGU acceptée, ce que la 022 cherchait à éliminer (RGPD art. 7,
-- PPL Am. 13). Le patch client du chantier 4 a supprimé le dernier fallback
-- qui pouvait produire cet état ; cette contrainte l'empêche de revenir.
--
-- Bloc DO plutôt que « ADD CONSTRAINT IF NOT EXISTS » : cette dernière syntaxe
-- n'existe pas en PostgreSQL, contrairement à ADD COLUMN IF NOT EXISTS et
-- DROP CONSTRAINT IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consent_coherence'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT consent_coherence
      CHECK ((accepted_terms_at IS NULL) = (consent_version IS NULL));
  END IF;
END $$;


-- ============================================================================
-- ✅ Migration 025 terminée
-- ============================================================================
