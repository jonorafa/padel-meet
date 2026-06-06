import { useState } from 'react'
import { COURT } from './CourtUI'

/**
 * Grid photo gallery editor — COURT design system
 * 3-column grid, drag-to-reorder (first = primary), delete, inline add slot
 *
 * Props:
 * - photos: Array { id, url, is_primary }
 * - onDelete: Callback(photoId)
 * - onSetPrimary: Callback(photoId) [kept for API compat]
 * - onReorder: Callback(newPhotoIds[])
 * - onAdd: Callback() | null — called when the add slot is clicked; null hides the slot
 * - dark: Boolean
 */
export function PhotoGalleryEditor({
  photos = [],
  onDelete = () => {},
  onSetPrimary = () => {},
  onReorder = () => {},
  onAdd = null,
  dark = false,
}) {
  const [draggedIndex, setDraggedIndex]   = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }
  const handleDrop = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null); setDragOverIndex(null); return
    }
    const next = [...photos]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(index, 0, moved)
    setDraggedIndex(null); setDragOverIndex(null)
    onReorder(next.map(p => p.id))
  }
  const handleDragEnd = () => { setDraggedIndex(null); setDragOverIndex(null) }

  const muted = dark ? COURT.darkMuted : COURT.stone

  return (
    <div>
      {/* Hint — only shown when there are photos to drag */}
      {photos.length > 0 && (
        <p style={{
          fontFamily: 'Inter', fontSize: 12.5, color: muted,
          margin: '0 0 10px', fontStyle: 'italic', textAlign: 'center',
        }}>
          Glissez pour réordonner · la 1<sup style={{ fontSize: 9 }}>re</sup> est votre photo principale
        </p>
      )}

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {photos.map((photo, index) => {
          const isDragging = draggedIndex === index
          const isOver     = dragOverIndex === index && draggedIndex !== index

          return (
            <div
              key={photo.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e)  => handleDragOver(e, index)}
              onDrop={(e)      => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                position: 'relative',
                aspectRatio: '3 / 4',
                borderRadius: 14,
                overflow: 'hidden',
                cursor: 'grab',
                opacity: isDragging ? 0.3 : 1,
                outline: isOver ? `2.5px solid ${COURT.gold}` : 'none',
                outlineOffset: '-2px',
                background: dark ? COURT.darkCard : COURT.creamDark,
                transition: 'opacity 0.15s',
                flexShrink: 0,
              }}
            >
              <img
                src={photo.url}
                alt={`Photo ${index + 1}`}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* × button — top right */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.93)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 5px rgba(0,0,0,0.22)',
                  padding: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke={COURT.red} strokeWidth="2" strokeLinecap="round"/>
                  <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke={COURT.red} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Badge — bottom left */}
              {index === 0 ? (
                /* "★ Principale" gold pill for first photo */
                <div style={{
                  position: 'absolute', bottom: 10, left: 10,
                  background: COURT.gold,
                  color: '#fff',
                  borderRadius: 20, padding: '4px 9px',
                  fontFamily: 'Inter', fontSize: 11.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 3,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                  letterSpacing: '0.01em',
                }}>
                  ★ Principale
                </div>
              ) : (
                /* Numbered dark circle for subsequent photos */
                <div style={{
                  position: 'absolute', bottom: 10, left: 10,
                  background: 'rgba(0,0,0,0.58)',
                  color: '#fff',
                  borderRadius: 6,
                  width: 22, height: 22,
                  fontFamily: 'Inter', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {index + 1}
                </div>
              )}
            </div>
          )
        })}

        {/* Add slot — dashed placeholder */}
        {onAdd !== null && (
          <div
            onClick={onAdd}
            style={{
              aspectRatio: '3 / 4',
              borderRadius: 14,
              border: `2px dashed ${dark ? COURT.darkBorder : `${COURT.green}50`}`,
              background: dark ? `${COURT.darkCard}70` : `${COURT.green}06`,
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? `${COURT.darkCard}` : `${COURT.green}10`}
            onMouseLeave={e => e.currentTarget.style.background = dark ? `${COURT.darkCard}70` : `${COURT.green}06`}
          >
            <span style={{
              fontFamily: 'Inter', fontSize: 28, fontWeight: 300, lineHeight: 1,
              color: dark ? COURT.darkMuted : COURT.stone,
            }}>+</span>
            <span style={{
              fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
              color: dark ? COURT.darkMuted : COURT.stone,
            }}>Ajouter</span>
          </div>
        )}
      </div>
    </div>
  )
}
