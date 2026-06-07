import { useState, useRef } from 'react'
import { COURT } from './CourtUI'

const UploadIcon = ({ color }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

/**
 * File upload zone — COURT design system
 * Drag-drop + click, validates type/size, shows preview
 *
 * Props:
 * - onUpload: Callback(file) called with selected file
 * - disabled: Boolean
 * - multiple: Boolean (UI only — one upload per call)
 * - dark: Boolean
 */
export function PhotoUploadField({
  onUpload = () => {},
  disabled = false,
  multiple = false,
  dark = false,
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSize = 5 * 1024 * 1024

  const validateFile = (file) => {
    setError(null)
    if (!validTypes.includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG ou WebP.')
      return false
    }
    if (file.size > maxSize) {
      setError('Fichier trop lourd (max 5 Mo).')
      return false
    }
    return true
  }

  const handleFileSelect = (file) => {
    if (!validateFile(file)) return
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
    onUpload(file)
  }

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const prevent = (e) => { e.preventDefault(); e.stopPropagation() }

  const handleDrop = (e) => {
    prevent(e)
    setIsDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  // Dynamic zone colors
  const zoneBg = disabled
    ? (dark ? `${COURT.darkCard}` : COURT.creamDark)
    : isDragActive
      ? (dark ? `${COURT.green}22` : `${COURT.green}10`)
      : (dark ? COURT.darkCard : COURT.cream)

  const zoneBorder = disabled
    ? (dark ? COURT.darkBorder : `${COURT.stone}50`)
    : isDragActive
      ? COURT.green
      : (dark ? COURT.darkBorder : `${COURT.green}55`)

  return (
    <div style={{ width: '100%' }}>
      {/* Drop zone */}
      <div
        onDragEnter={(e) => { prevent(e); setIsDragActive(true) }}
        onDragLeave={(e) => { prevent(e); setIsDragActive(false) }}
        onDragOver={prevent}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${zoneBorder}`,
          borderRadius: 12,
          padding: '22px 16px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: zoneBg,
          opacity: disabled ? 0.5 : 1,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={validTypes.join(',')}
          onChange={handleChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <UploadIcon color={dark ? COURT.darkMuted : COURT.green} />
        </div>
        <p style={{
          fontFamily: 'Mulish', fontSize: 14, fontWeight: 600, margin: '0 0 4px',
          color: dark ? COURT.darkText : COURT.ink,
        }}>
          Glissez ou appuyez pour ajouter
        </p>
        <p style={{ fontFamily: 'Mulish', fontSize: 12, margin: 0, color: dark ? COURT.darkMuted : COURT.stone }}>
          JPEG, PNG ou WebP · Max 5 Mo
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '1 / 1',
            borderRadius: 12, overflow: 'hidden',
            background: dark ? COURT.darkBg : COURT.creamDark,
          }}>
            <img
              src={preview}
              alt="Aperçu"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPreview(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: COURT.red, color: '#fff', border: 'none',
                  width: 28, height: 28, borderRadius: '50%',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            )}
          </div>
          <p style={{
            fontFamily: 'Mulish', fontSize: 12, marginTop: 6,
            color: dark ? COURT.darkMuted : COURT.stone,
          }}>
            Prêt à envoyer ✓
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 8,
          background: `${COURT.red}15`, border: `1px solid ${COURT.red}40`,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ color: COURT.red, fontSize: 16, flexShrink: 0 }}>⚠</span>
          <p style={{ fontFamily: 'Mulish', fontSize: 13, color: COURT.red, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  )
}
