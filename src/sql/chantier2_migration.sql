-- Chantier 2: Profil Détaillé — Database Schema
-- Creates profile_photos table for multi-photo gallery support

-- 1. Create profile_photos table
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, storage_path),
  CONSTRAINT max_photos_per_user CHECK (
    (SELECT COUNT(*) FROM profile_photos WHERE user_id = profiles.id) <= 10
  )
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_is_primary ON profile_photos(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_profile_photos_display_order ON profile_photos(user_id, display_order);

-- 3. Add motivation field to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS motivation VARCHAR(50) CHECK (motivation IN ('fun', 'improve', 'compete'));

-- 4. Verify existing bio fields exist (should be there from schema.sql)
-- bio_fr, bio_en, bio_he are TEXT columns created in schema.sql

-- 5. Enable RLS on profile_photos
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy: Users can read any photo (photos are public)
CREATE POLICY IF NOT EXISTS "Profile photos are public" ON profile_photos
  FOR SELECT USING (true);

-- 7. RLS Policy: Users can insert their own photos
CREATE POLICY IF NOT EXISTS "Users can insert own photos" ON profile_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. RLS Policy: Users can update their own photos
CREATE POLICY IF NOT EXISTS "Users can update own photos" ON profile_photos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. RLS Policy: Users can delete their own photos
CREATE POLICY IF NOT EXISTS "Users can delete own photos" ON profile_photos
  FOR DELETE USING (auth.uid() = user_id);

-- 10. Create function to ensure only one primary photo per user
CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE profile_photos SET is_primary = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for primary photo enforcement
DROP TRIGGER IF NOT EXISTS trigger_ensure_single_primary_photo ON profile_photos;
CREATE TRIGGER trigger_ensure_single_primary_photo
  BEFORE INSERT OR UPDATE ON profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_photo();

-- 12. Create function to auto-set first photo as primary
CREATE OR REPLACE FUNCTION auto_primary_first_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_photos
    WHERE user_id = NEW.user_id AND is_primary = TRUE
  ) THEN
    NEW.is_primary := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Create trigger for auto-primary
DROP TRIGGER IF NOT EXISTS trigger_auto_primary_first_photo ON profile_photos;
CREATE TRIGGER trigger_auto_primary_first_photo
  BEFORE INSERT ON profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION auto_primary_first_photo();
