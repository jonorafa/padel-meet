import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook for managing user profile photos
 * Handles upload, delete, reorder, and fetch operations
 *
 * Lorsque `userId` est l'utilisateur courant, ce hook sync automatiquement
 * `profiles.photo_url` (le champ legacy utilisé pour l'avatar) avec la photo
 * primary de la galerie, et déclenche un refresh de `AuthContext.profile`
 * pour propager le nouvel avatar à toute l'app.
 */
export function useProfilePhotos(userId) {
  const { user: authUser, refreshProfile } = useAuth()
  const isCurrentUser = !!authUser && authUser.id === userId

  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch user's photos from database
  const fetchPhotos = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('profile_photos')
        .select('id, url, storage_path, is_primary, display_order, created_at')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })

      if (queryError) throw queryError
      setPhotos(data || [])

      // Self-heal : si le profil de l'user courant a un photo_url désynchronisé
      // de la photo primary (ex : photos uploadées avant le fix de sync), on
      // rattrape silencieusement. Réservé à l'user courant (RLS bloquerait sinon).
      if (isCurrentUser && data && data.length > 0) {
        const primaryFromGallery = data.find(p => p.is_primary)
        const expectedUrl = primaryFromGallery?.url ?? data[0]?.url ?? null
        const { data: prof } = await supabase
          .from('profiles')
          .select('photo_url')
          .eq('id', userId)
          .maybeSingle()
        if (prof && expectedUrl && prof.photo_url !== expectedUrl) {
          await supabase
            .from('profiles')
            .update({ photo_url: expectedUrl })
            .eq('id', userId)
          refreshProfile?.()
        }
      }
    } catch (err) {
      console.error('Error fetching photos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, isCurrentUser, refreshProfile])

  // Load photos on mount or when userId changes
  useEffect(() => {
    fetchPhotos()
  }, [userId, fetchPhotos])

  /**
   * Sync `profiles.photo_url` (legacy avatar field, used everywhere across the app)
   * with the current primary photo from `profile_photos`.
   * Called after every mutation that can change the primary photo (upload / delete / setPrimary).
   * If there are no photos left, `photo_url` is set to NULL.
   */
  const syncPrimaryToProfile = useCallback(async () => {
    if (!userId || !isCurrentUser) return
    try {
      const { data: primary } = await supabase
        .from('profile_photos')
        .select('url')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle()

      await supabase
        .from('profiles')
        .update({ photo_url: primary?.url ?? null })
        .eq('id', userId)

      // Propage le nouvel avatar à toute l'app via AuthContext
      refreshProfile?.()
    } catch (err) {
      // Non-blocking — the gallery itself works, only the legacy avatar may be stale
      console.warn('[syncPrimaryToProfile] non-bloquant:', err)
    }
  }, [userId, isCurrentUser, refreshProfile])

  // Compress image to ~500KB using Canvas API
  const compressImage = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        const img = new Image()

        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img

          // Calculate new dimensions if image is too large
          const maxWidth = 2000
          const maxHeight = 2000
          if (width > height && width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          } else if (height > maxWidth) {
            width = (width * maxHeight) / height
            height = maxHeight
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // Compress to JPEG with quality 0.8
          canvas.toBlob(
            (blob) => {
              resolve(blob)
            },
            'image/jpeg',
            0.8
          )
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = event.target.result
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [])

  // Upload photo to Supabase Storage and create DB record
  const uploadPhoto = useCallback(async (file) => {
    if (!userId) {
      setError('User ID required')
      return null
    }

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images allowed')
      return null
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return null
    }

    // Check photo limit
    if (photos.length >= 10) {
      setError('Maximum 10 photos per user')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      // Compress image
      const compressedBlob = await compressImage(file)

      // Generate storage path
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const timestamp = Date.now()
      const storagePath = `photos/${userId}/${timestamp}-${Math.random().toString(36).slice(2, 9)}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(storagePath, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(storagePath)

      const publicUrl = data?.publicUrl

      // Create database record
      const { data: photoRecord, error: dbError } = await supabase
        .from('profile_photos')
        .insert({
          user_id: userId,
          url: publicUrl,
          storage_path: storagePath,
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Add to local state
      setPhotos(prev => [...prev, photoRecord])

      // Sync legacy avatar field (used everywhere in the app)
      // — the SQL trigger auto-marks the first photo as primary, so this catches it
      await syncPrimaryToProfile()

      return photoRecord
    } catch (err) {
      console.error('Error uploading photo:', err)
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [userId, photos.length, compressImage, syncPrimaryToProfile])

  // Delete photo from Storage and DB
  const deletePhoto = useCallback(async (photoId) => {
    try {
      setLoading(true)
      setError(null)

      // Find photo to get storage path
      const photoToDelete = photos.find(p => p.id === photoId)
      if (!photoToDelete) throw new Error('Photo not found')

      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('profile-photos')
        .remove([photoToDelete.storage_path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('profile_photos')
        .delete()
        .eq('id', photoId)

      if (dbError) throw dbError

      // Update local state
      setPhotos(prev => {
        const updated = prev.filter(p => p.id !== photoId)
        // If deleted photo was primary, set new first photo as primary
        if (photoToDelete.is_primary && updated.length > 0) {
          // The trigger will handle this, but we can optimize locally
          return updated.map((p, i) => ({
            ...p,
            is_primary: i === 0,
          }))
        }
        return updated
      })

      // Sync legacy avatar field — covers the case where we removed the primary
      // (and another photo just got promoted) OR where we removed the last photo (→ null)
      await syncPrimaryToProfile()
    } catch (err) {
      console.error('Error deleting photo:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [photos, syncPrimaryToProfile])

  // Set a photo as primary
  const setPrimaryPhoto = useCallback(async (photoId) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('profile_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) throw error

      // Update local state
      setPhotos(prev =>
        prev.map(p => ({
          ...p,
          is_primary: p.id === photoId,
        }))
      )

      // Sync legacy avatar field with the newly promoted primary
      await syncPrimaryToProfile()
    } catch (err) {
      console.error('Error setting primary photo:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [syncPrimaryToProfile])

  // Reorder photos
  const reorderPhotos = useCallback(async (newOrder) => {
    try {
      setLoading(true)
      setError(null)

      // Update display_order for all photos
      const updates = newOrder.map((photoId, index) => ({
        id: photoId,
        display_order: index,
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('profile_photos')
          .update({ display_order: update.display_order })
          .eq('id', update.id)

        if (error) throw error
      }

      // Update local state
      const reorderedPhotos = newOrder
        .map(id => photos.find(p => p.id === id))
        .filter(Boolean)
        .map((p, i) => ({ ...p, display_order: i }))

      setPhotos(reorderedPhotos)
    } catch (err) {
      console.error('Error reordering photos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [photos])

  // Refetch photos from database
  const refetch = useCallback(() => {
    fetchPhotos()
  }, [fetchPhotos])

  return {
    photos,
    loading,
    error,
    uploadPhoto,
    deletePhoto,
    setPrimaryPhoto,
    reorderPhotos,
    refetch,
  }
}
