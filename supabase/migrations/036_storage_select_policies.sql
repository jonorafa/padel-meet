-- ============================================================================
-- Migration 036 : policies SELECT manquantes sur storage.objects
-- ============================================================================
-- CORRIGE : « new row violates row-level security policy » sur TOUT upload —
-- photo comme vidéo. Aucun fichier n'avait jamais pu être envoyé depuis la
-- création du bucket profile-photos (storage.objects était vide, tous buckets
-- confondus) ; le seul photo_url en base est une URL d'avatar Google, jamais
-- un fichier uploadé.
--
-- Cause, prouvée par isolation (même utilisateur, même jeton, même chemin,
-- seul l'en-tête change) :
--   POST /storage/v1/object/...                    → HTTP 200
--   POST /storage/v1/object/... + x-upsert: true   → « new row violates RLS »
--
-- Les deux écrans d'upload appellent .upload(..., { upsert: true }), ce qui
-- fait envoyer `x-upsert: true` à storage-api, qui exécute alors un
-- INSERT ... ON CONFLICT DO UPDATE. Pour ce type de requête, PostgreSQL doit
-- pouvoir LIRE la ligne en conflit — il exige donc une policy SELECT, même
-- quand aucune ligne n'existe encore et qu'aucun conflit ne se produit.
--
-- La migration 034 avait délibérément omis cette policy :
--   « Pas de policy SELECT : le bucket est public, la lecture passe par le CDN. »
-- Le raisonnement est juste pour la lecture publique des fichiers (le CDN ne
-- passe pas par RLS), mais il ne couvre pas ce cas : ici c'est l'ÉCRITURE qui
-- a besoin du droit de lecture, côté base.
--
-- On restreint la lecture au propriétaire (mêmes conditions que insert/update
-- /delete) plutôt que de l'ouvrir à tous : cette policy sert au chemin
-- d'écriture, pas à la diffusion publique, qui continue de passer par le CDN
-- sans RLS.
-- ============================================================================

DROP POLICY IF EXISTS profile_videos_owner_select ON storage.objects;
DROP POLICY IF EXISTS profile_photos_owner_select ON storage.objects;

CREATE POLICY profile_videos_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-videos'
    AND (storage.foldername(name))[1] = 'videos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );

CREATE POLICY profile_photos_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );
