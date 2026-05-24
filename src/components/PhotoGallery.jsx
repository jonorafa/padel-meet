import { useState, useRef } from 'react'
import { COURT } from './CourtUI'

/**
 * Photo carousel component — COURT design system
 * Supports arrow buttons, swipe navigation, thumbnail strip, primary badge
 *
 * Props:
 * - photos: Array of photo objects { id, url, is_primary }
 * - editable: Boolean - if true, shows delete / set-primary buttons
 * - onPhotosChange: Callback(action, photoId) when photos are modified
 * - dark: Boolean - dark mode flag
 */
export function PhotoGallery({
  photos = [],
  editable = false,
  onPhotosChange = null,
  dark = false,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = useRef(0)

  if (!photos || photos.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', aspectRatio: '1 / 1', borderRadius: 12,
        background: dark ? COURT.darkCard : COURT.creamDark,
      }}>
        <p style={{ fontFamily: 'Inter', color: dark ? COURT.darkMuted : COURT.stone }}>
          Aucune photo
        </p>
      </div>
    )
  }

  const currentPhoto = photos[currentIndex]
  const isPrimary = currentPhoto?.is_primary

  const handlePrevious = () =>
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length)
  const handleNext = () =>
    setCurrentIndex(prev => (prev + 1) % photos.length)

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX
  }
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (diff > 50) handleNext()
    else if (diff < -50) handlePrevious()
  }

  const handleDeletePhoto = (photoId, e) => {
    e.stopPropagation()
    onPhotosChange?.('delete', photoId)
  }
  const handleSetPrimary = (photoId, e) => {
    e.stopPropagation()
    onPhotosChange?.('setPrimary', photoId)
  }

  const navBtnStyle = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.52)', color: '#fff', border: 'none',
    width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
    fontSize: 20, fontWeight: 300, display: 'flex', alignItems: 'center',
    justifyContent: 'center', lineHeight: 1, paddingBottom: 1,
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Main image */}
      <div
        style={{
          position: 'relative', width: '100%', aspectRatio: '1 / 1',
          borderRadius: 12, overflow: 'hidden', background: '#0a0a0a',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentPhoto?.id}
          src={currentPhoto?.url}
          alt={`Photo ${currentIndex + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Primary badge */}
        {isPrimary && !editable && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: COURT.green, color: COURT.cream,
            padding: '3px 9px', borderRadius: 6,
            fontSize: 11, fontWeight: 700, fontFamily: 'Inter', letterSpacing: '0.05em',
          }}>
            ★ Principale
          </div>
        )}

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <button onClick={handlePrevious} style={{ ...navBtnStyle, left: 10 }}>‹</button>
            <button onClick={handleNext} style={{ ...navBtnStyle, right: 10 }}>›</button>
          </>
        )}

        {/* Counter */}
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '2px 8px', borderRadius: 8,
          fontSize: 11, fontFamily: 'Inter', letterSpacing: '0.03em',
        }}>
          {currentIndex + 1} / {photos.length}
        </div>

        {/* Editable mode actions */}
        {editable && (
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
            {!isPrimary && photos.length > 1 && (
              <button
                onClick={(e) => handleSetPrimary(currentPhoto.id, e)}
                style={{
                  background: COURT.green, color: COURT.cream, border: 'none',
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 15, fontWeight: 700,
                }}
              >★</button>
            )}
            <button
              onClick={(e) => handleDeletePhoto(currentPhoto.id, e)}
              style={{
                background: COURT.red, color: '#fff', border: 'none',
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                fontSize: 14, fontWeight: 700,
              }}
            >✕</button>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setCurrentIndex(index)}
              style={{
                flexShrink: 0, width: 58, height: 58, borderRadius: 8,
                overflow: 'hidden', padding: 0, background: 'none',
                border: `2px solid ${index === currentIndex ? COURT.gold : 'transparent'}`,
                opacity: index === currentIndex ? 1 : 0.55,
                cursor: 'pointer',
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
            >
              <img
                src={photo.url}
                alt={`Vignette ${index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
