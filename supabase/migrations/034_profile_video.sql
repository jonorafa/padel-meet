-- ============================================================================
-- Migration 034 : vidéo de profil (extrait d'un point), optionnelle
-- ============================================================================
-- Un court extrait vidéo en dit plus long sur le niveau réel d'un joueur que
-- n'importe quelle caractéristique écrite. Affiché sur la carte de swipe sous
-- forme de vignette, lu en plein écran au tap.
--
-- Trois colonnes plutôt qu'une table dédiée (contrairement à profile_photos,
-- qui est une galerie) : une seule vidéo par profil, pas d'ordre ni de
-- notion de "primary" à gérer.
--   • video_url          : URL publique de la vidéo
--   • video_poster_url   : vignette JPEG extraite d'une image de la vidéo au
--                          moment de l'envoi. Indispensable : elle permet
--                          d'afficher la carte sans télécharger la vidéo
--                          (3 cartes sont montées simultanément dans la pile),
--                          et sert de repli si le navigateur du lecteur ne
--                          sait pas décoder le format.
--   • video_storage_path : chemin storage, pour pouvoir supprimer l'ancien
--                          fichier lors d'un remplacement.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_url          text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_poster_url   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_storage_path text;

COMMENT ON COLUMN public.profiles.video_url        IS 'Extrait vidéo d''un point (optionnel) — URL publique.';
COMMENT ON COLUMN public.profiles.video_poster_url IS 'Vignette JPEG extraite de la vidéo à l''envoi — évite de charger la vidéo dans la pile de swipe.';

-- ── Bucket dédié ───────────────────────────────────────────────────────────
-- Séparé de profile-photos : la limite de taille (5 Mo) et les types MIME y
-- sont réglés pour des images. 50 Mo couvre largement un extrait de ~15 s,
-- tout en écartant l'envoi d'un film entier. Le client valide en plus la
-- DURÉE (≤ 20 s), qu'une limite de taille seule ne garantit pas.
--
-- video/quicktime est accepté car c'est le format natif des iPhone (.mov).
-- Réserve connue : ces fichiers sont souvent encodés en HEVC, que plusieurs
-- navigateurs ne savent pas décoder — d'où la vignette, qui reste affichée
-- quoi qu'il arrive.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-videos', 'profile-videos', true, 52428800,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = EXCLUDED.public;

-- ── RLS storage : chacun n'écrit que dans son propre dossier ───────────────
-- Calquées sur les policies profile_photos_owner_* existantes : chemin
-- `videos/{uid}/...`, le second segment devant être l'uid de l'appelant.
-- Pas de policy SELECT : le bucket est public, la lecture passe par le CDN.
DROP POLICY IF EXISTS profile_videos_owner_insert ON storage.objects;
DROP POLICY IF EXISTS profile_videos_owner_update ON storage.objects;
DROP POLICY IF EXISTS profile_videos_owner_delete ON storage.objects;

CREATE POLICY profile_videos_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-videos'
    AND (storage.foldername(name))[1] = 'videos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );

CREATE POLICY profile_videos_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-videos'
    AND (storage.foldername(name))[1] = 'videos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-videos'
    AND (storage.foldername(name))[1] = 'videos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );

CREATE POLICY profile_videos_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-videos'
    AND (storage.foldername(name))[1] = 'videos'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );
