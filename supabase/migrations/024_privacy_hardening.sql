-- ============================================================================
-- PADEL MEET — Migration 024 : durcissement données personnelles
-- ============================================================================
-- Trois problèmes trouvés à l'audit du 2026-08-09, tous sur des données
-- personnelles :
--   a) profiles.email exposée publiquement et inutile
--   b) photos jamais nettoyées à la suppression de compte
--   c) consentement RGPD dont le fallback client fabriquait une fausse preuve
--   d) policy de listing storage jamais utilisée par le code
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- a) Suppression de la colonne email
--
-- La policy "Profiles are viewable by everyone" (001) est USING (true) : tout
-- visiteur non authentifié pouvait lire l'email de tous les utilisateurs. Or
-- la colonne était ÉCRITE (AuthContext.saveProfile) mais LUE nulle part —
-- vérifié par recherche exhaustive sur src/ : la seule autre occurrence,
-- MatchScreen (formulaire de contact), lit `user.email` de l'objet auth.users,
-- pas cette colonne. C'est un artefact de la création initiale du profil par
-- le Dashboard Supabase (cf. note en tête de 001), jamais un besoin produit.
--
-- La policy SELECT reste volontairement USING (true) : l'app a un vrai mode
-- invité (usePlayers.js, chemin `if (!user)`) qui doit lire les profils sans
-- session. La restreindre à TO authenticated casserait ce mode. On retire la
-- donnée sensible plutôt que l'accès — l'email n'a jamais eu à être là.
-- auth.users.email n'est PAS touché : c'est la source d'authentification.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;


-- ─────────────────────────────────────────────────────────────────────────────
-- b) Nettoyage du storage à la suppression de compte
--
-- delete_user_account() (007) supprimait profiles (cascade FK) puis
-- auth.users, mais ne touchait jamais storage.objects : après une suppression
-- de compte RGPD, les photos du bucket profile-photos restaient accessibles
-- publiquement, par URL directe, indéfiniment. Le bucket est `public: true`,
-- donc ces URL ne nécessitent aucune authentification.
--
-- Corps repris à l'identique de la 007 (même DECLARE, même contrôle
-- d'authentification, même ordre profiles → auth.users, SECURITY DEFINER,
-- SET search_path = public), avec le seul DELETE storage ajouté AVANT la
-- suppression du profil, dans la même transaction : si la suppression des
-- objets échoue, rien n'est supprimé du tout, plutôt qu'un profil effacé
-- laissant des photos orphelines et impossibles à retrouver.
--
-- Le chemin filtré correspond exactement à celui construit par les trois
-- points d'upload du code (SetupProfileScreen, MatchScreen, ProfileEditScreen) :
-- `photos/<uid>/<fichier>`.
--
-- SECURITY DEFINER : la fonction s'exécute avec les droits de son
-- propriétaire, qui a déjà accès à storage.objects (elle accède déjà à
-- auth.users, plus restreint) — aucun GRANT supplémentaire nécessaire.
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Photos du bucket profile-photos — AVANT la suppression du profil, pour
  -- que tout échoue ensemble plutôt que de laisser des fichiers orphelins.
  DELETE FROM storage.objects
  WHERE bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = uid::text;

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

-- Inchangé depuis la 007 — répété ici car CREATE OR REPLACE ne touche pas aux
-- privilèges, mais le GRANT est idempotent et documente l'exposition RPC.
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- c) Contrainte de cohérence du consentement
--
-- accepted_terms_at et consent_version doivent être tous deux renseignés ou
-- tous deux NULL. Un accepted_terms_at seul est exactement la fausse preuve
-- que la 022 cherchait à éliminer : une date sans version de CGU n'atteste
-- d'aucun consentement à un contenu identifiable (RGPD art. 7, PPL Am. 13).
-- Le patch client de ce chantier supprime le dernier fallback qui pouvait
-- produire cet état ; cette contrainte l'empêche de revenir.
--
-- ⚠️ ÉCART ASSUMÉ AVEC LE PROMPT : `ALTER TABLE ... ADD CONSTRAINT IF NOT
-- EXISTS` n'existe pas en PostgreSQL (contrairement à ADD COLUMN IF NOT
-- EXISTS et DROP CONSTRAINT IF EXISTS). Écrit tel quel, ce bloc lèverait une
-- erreur de syntaxe et la migration ne serait pas ré-exécutable. Le bloc DO
-- ci-dessous obtient le résultat voulu — idempotent et valide.
--
-- ÉCHEC : lignes existantes incohérentes, correction de données nécessaire
-- avant application, cf. rapport.
--
-- Constaté par interrogation EN LECTURE SEULE du projet Tokyo le 2026-08-10
-- (aucune écriture, aucune migration appliquée) :
--   • 47 profils au total : 30 démos + 17 réels
--   • 2 profils RÉELS (non démos) ont accepted_terms_at renseigné
--   • la colonne consent_version N'EXISTE PAS encore sur ce projet : la
--     migration 022 n'y est pas appliquée (schema_migrations s'arrête à 021)
--
-- Conséquence : dès que la 022 ajoutera consent_version (NULL pour tous), ces
-- 2 lignes auront accepted_terms_at NON NULL et consent_version NULL — donc
-- (accepted_terms_at IS NULL) = FALSE <> TRUE = (consent_version IS NULL).
-- La contrainte échouerait, et avec elle toute la migration 024.
--
-- Ces 2 lignes sont de VRAIES preuves de consentement de comptes réels,
-- antérieures à la 022 : elles attestent d'une date sans version de CGU. Les
-- corriger demande une décision produit (leur assigner rétroactivement une
-- version de CGU qu'ils n'ont pas explicitement acceptée ? effacer la date et
-- redemander le consentement ?) — pas un choix technique à faire ici. Aucune
-- donnée n'est modifiée.
--
-- POUR ACTIVER cette contrainte, dans l'ordre :
--   1. appliquer la migration 022 (ajoute consent_version)
--   2. décider du sort des 2 lignes, puis les traiter explicitement
--   3. vérifier que le compte est retombé à zéro :
--        SELECT COUNT(*) FROM public.profiles
--        WHERE (accepted_terms_at IS NULL) <> (consent_version IS NULL);
--   4. décommenter le bloc DO ci-dessous et le rejouer
--
-- Sur un projet NEUF (le futur projet EU, sans données), ces 2 lignes
-- n'existeront pas : le bloc peut y être décommenté d'emblée, à condition que
-- la 022 soit appliquée avant.
-- ─────────────────────────────────────────────────────────────────────────────
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'consent_coherence'
--       AND conrelid = 'public.profiles'::regclass
--   ) THEN
--     ALTER TABLE public.profiles
--       ADD CONSTRAINT consent_coherence
--       CHECK ((accepted_terms_at IS NULL) = (consent_version IS NULL));
--   END IF;
-- END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- d) Retrait de la policy de listing storage
--
-- "profile_photos_public_read" (003) autorisait SELECT sur storage.objects
-- pour `public`, c'est-à-dire lister TOUS les fichiers du bucket sans
-- authentification (chemins complets, donc UUID de tous les utilisateurs
-- ayant une photo). Aucun appel du code ne l'utilise : recherche exhaustive
-- sur src/, on ne trouve que .upload() et getPublicUrl(), jamais .list().
--
-- getPublicUrl() continue de fonctionner sans cette policy : le bucket est
-- `public: true` (003), et la route /storage/v1/object/public/<bucket>/<path>
-- sert les fichiers sans passer par RLS. Seul le LISTING est retiré ; les
-- photos déjà référencées par profiles.photo_url restent affichables, y
-- compris en mode invité.
--
-- Les trois policies owner_insert / owner_update / owner_delete (003) sont
-- conservées : elles régissent l'écriture, pas la lecture.
--
-- Déjà retirée manuellement sur le projet EU — cette migration la retire
-- aussi sur Tokyo et met l'état sous contrôle de version.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;


-- ============================================================================
-- ✅ Migration 024 terminée
-- ============================================================================
