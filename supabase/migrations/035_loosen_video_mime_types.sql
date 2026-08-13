-- ============================================================================
-- Migration 035 : bucket profile-videos — retire la liste blanche de types MIME
-- ============================================================================
-- Le bucket n'acceptait que video/mp4, video/quicktime, video/webm. Un
-- téléphone (Android notamment) peut légitimement déclarer un type MIME hors
-- de cette liste pour une vidéo par ailleurs parfaitement valide
-- (video/3gpp, video/x-m4v, etc.) — le client fait déjà `videoFile.type ||
-- 'video/mp4'`, mais ce repli ne joue que si le type est VIDE, pas s'il est
-- simplement absent de cette liste. Dans ce cas l'upload est rejeté par le
-- bucket lui-même, côté serveur, sans lien avec le code de préparation vidéo
-- (déjà corrigé en migration/commit précédents pour le chargement des
-- métadonnées).
--
-- Le filtrage réel reste assuré ailleurs :
--   • file_size_limit (50 Mo, inchangé) ;
--   • prepareVideo() côté client, qui rejette tout fichier que le navigateur
--     ne sait pas charger comme vidéo (durée non lisible, timeout) ;
--   • l'input file du formulaire, accept="video/*".
-- Un utilisateur de mauvaise foi pourrait forcer l'upload d'un fichier non
-- vidéo via les devtools — il resterait plafonné à 50 Mo et n'apparaîtrait
-- jamais comme vignette lisible nulle part dans l'app.
-- ============================================================================

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'profile-videos';
