import { useState } from 'react'
import { COURT } from './CourtUI'

const GripIcon = ({ color }) => (
  <svg width="16" height="20" viewBox="0 0 16 20" fill={color}>
    <circle cx="5" cy="4" r="1.5" />
    <circle cx="5" cy="10" r="1.5" />
    <circle cx="5" cy="16" r="1.5" />
    <circle cx="11" cy="4" r="1.5" />
    <circle cx="11" cy="10" r="1.5" />
    <circle cx="11" cy="16" r="1.5" />
  </svg>
)

/**
 * Reorderable photo list — COURT design system
 * Drag-to-reorder, delete, and set primary photo
 *
 * Props:
 * - photos: Array { id, url, is_primary }
 * - onDelete: Callback(photoId)
 * - onSetPrimary: Callback(photoId)
 * - onReorder: Callback(newPhotoIds[])
 * - dark: Boolean
 */
export function PhotoGalleryEditor({
  photos = [],
  onDelete = () => {},
  onSetPrimary = () => {},
  onReorder = () => {},
  dark = false,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const next = [...photos]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(index, 0, moved)
    setDraggedIndex(null)
    onReorder(next.map(p => p.id))
  }

  if (photos.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '24px 0', borderRadius: 10,
        background: dark ? COURT.darkCard : COURT.creamDark,
      }}>
        <p style={{ fontFamily: 'Inter', color: dark ? COURT.darkMuted : COURT.stone }}>
          Aucune photo
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {photos.map((photo, index) => {
        const isDragging = draggedIndex === index
        return (
          <div
            key={photo.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={() => setDraggedIndex(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: isDragging
                ? (dark ? COURT.darkBorder : COURT.creamDark)
                : (dark ? COURT.darkCard : COURT.cream),
              border: `0.5px solid ${dark ? COURT.darkBorder : `${COURT.green}28`}`,
              opacity: isDragging ? 0.45 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Drag handle */}
            <div style={{ cursor: 'grab', flexShrink: 0, paddingTop: 1 }}>
              <GripIcon color={dark ? COURT.darkMuted : `${COURT.stone}80`} />
            </div>

            {/* Thumbnail */}
            <div style={{
              width: 56, height: 56, borderRadius: 8, overflow: 'hidden',
              flexShrink: 0, background: COURT.ink,
            }}>
              <img
                src={photo.url}
                alt={`Photo ${index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'Inter', fontSize: 13, fontWeight: 600, margin: 0,
                color: dark ? COURT.darkText : COURT.ink,
              }}>
                Photo {index + 1}
              </p>
              {photo.is_primary && (
                <p style={{
                  fontFamily: 'Inter', fontSize: 11, fontWeight: 700,
                  color: COURT.gold, margin: '3px 0 0',
                }}>
                  ★ Photo principale
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!photo.is_primary && photos.length > 1 && (
                <button
                  onClick={() => onSetPrimary(photo.id)}
                  title="Définir comme principale"
                  style={{
                    width: 34, height: 34, borderRadius: 8, border: `1px solid ${COURT.gold}60`,
                    background: `${COURT.gold}18`, color: COURT.gold,
                    cursor: 'pointer', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >★</button>
              )}
              <button
                onClick={() => onDelete(photo.id)}
                title="Supprimer"
                style={{
                  width: 34, height: 34, borderRadius: 8, border: `1px solid ${COURT.red}50`,
                  background: `${COURT.red}12`, color: COURT.red,
                  cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
