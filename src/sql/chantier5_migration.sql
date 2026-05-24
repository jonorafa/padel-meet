-- ============================================================================
-- CHANTIER 5 — Storage bucket pour les photos de profil
-- ============================================================================
-- Crée le bucket `profile-photos` PUBLIC en lecture, avec des RLS strictes :
--   • SELECT : tout le monde (les photos sont publiques, comme sur Hinge/Tinder)
--   • INSERT : un utilisateur ne peut écrire QUE dans son propre dossier
--                  (chemin attendu : photos/<auth.uid>/<filename>)
--   • UPDATE / DELETE : un utilisateur ne peut modifier QUE ses propres fichiers
--
-- Idempotent : ré-exécutable sans casser l'existant.
-- ============================================================================

-- 1. Crée (ou ignore si déjà existant) le bucket public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,                                                  -- public read
  5242880,                                               -- 5 MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp']         -- formats acceptés
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Nettoie les anciennes policies si elles existent (idempotence)
DROP POLICY IF EXISTS "profile_photos_public_read"     ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_insert"    ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_update"    ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_delete"    ON storage.objects;

-- 3. SELECT public : n'importe qui peut voir les photos (pour les feed swipe)
CREATE POLICY "profile_photos_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

-- 4. INSERT : l'utilisateur connecté ne peut uploader QUE dans
--    `photos/<son auth.uid>/...`
--    Ça empêche un user A d'uploader dans le dossier d'un user B.
CREATE POLICY "profile_photos_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 5. UPDATE : idem, l'utilisateur ne peut modifier que ses propres fichiers
CREATE POLICY "profile_photos_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 6. DELETE : pareil
CREATE POLICY "profile_photos_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================================
-- FIN
--
-- Vérifie ensuite manuellement dans Supabase Dashboard :
--   • Storage → buckets → "profile-photos" existe et est "public"
--   • Storage → policies → 4 policies créées ci-dessus
--
-- Pour tester :
--   • Connecté en tant qu'utilisateur X :
--     - upload photos/<X>/avatar.jpg → ✅
--     - upload photos/<Y>/avatar.jpg → ❌ (refusé par RLS)
--   • Anonyme :
--     - GET sur n'importe quelle URL publique → ✅
-- ============================================================================
