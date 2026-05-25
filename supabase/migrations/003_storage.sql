-- ============================================================================
-- PADEL MEET — Migration 003 : Storage bucket profile-photos
-- ============================================================================
-- Bucket public en lecture, avec RLS strictes sur les dossiers.
-- Chemin attendu pour les uploads : photos/<auth.uid>/<filename>
-- ============================================================================

-- Crée ou met à jour le bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Nettoie les anciennes policies (idempotence)
DROP POLICY IF EXISTS "profile_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;

-- Lecture publique (feed swipe)
CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-photos');

-- Upload uniquement dans son propre dossier : photos/<uid>/...
CREATE POLICY "profile_photos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "profile_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
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

CREATE POLICY "profile_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================================
-- ✅ Migration 003 terminée
-- ============================================================================
