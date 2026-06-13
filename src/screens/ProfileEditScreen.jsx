import { useState, useRef } from 'react'
import { COURT, PadelSlider } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useProfilePhotos } from '../hooks/useProfilePhotos'
import { I18N } from '../data/courtData'
import { PhotoGalleryEditor } from '../components/PhotoGalleryEditor'

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/**
 * Full-screen profile editing — COURT design system
 * Sections: photos, bio (FR/EN/HE), preference tags
 */
export function ProfileEditScreen({ onClose = () => {}, dark = false }) {
  const { user, profile, saveProfile } = useAuth()
  const { lang } = usePrefs()
  const { photos, uploadPhoto, deletePhoto, setPrimaryPhoto, reorderPhotos, loading: photosLoading } = useProfilePhotos(user?.id)
  const t = I18N[lang] || I18N.fr

  const [formData, setFormData] = useState({
    name:           profile?.name           || '',
    bio_fr:         profile?.bio_fr         || '',
    bio_en:         profile?.bio_en         || '',
    bio_he:         profile?.bio_he         || '',
    dominant_hand:  profile?.dominant_hand  || 'right',
    preferred_side: profile?.preferred_side || 'forehand',
    play_style:     profile?.play_style     || 'aggressive',
    motivation:     profile?.motivation     || 'fun',
    frequency:      profile?.frequency      || 3,
  })

  const bioKey = lang === 'he' ? 'bio_he' : lang === 'en' ? 'bio_en' : 'bio_fr'
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  const fileInputRef = useRef(null)

  // ── Profile completion score (live, from real data) ─────────────
  const longestBio = [formData.bio_fr, formData.bio_en, formData.bio_he]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || ''

  const bioWordCount = longestBio.trim().split(/\s+/).filter(Boolean).length

  const completionItems = [
    { pts: 15, done: !!formData.name?.trim() },
    { pts: 20, done: photos.length >= 1 },
    { pts: 10, done: photos.length >= 3 },
    { pts: 20, done: bioWordCount >= 1 },
    { pts: 20, done: bioWordCount >= 10 },
    { pts: 15, done: !!(formData.dominant_hand && formData.preferred_side && formData.play_style && formData.motivation) },
  ]
  const completionScore = completionItems.reduce((s, c) => s + (c.done ? c.pts : 0), 0)

  const completionTitle =
    completionScore >= 100 ? (lang === 'he' ? 'פרופיל מושלם !' : lang === 'en' ? 'Profile complete!' : 'Profil complet !')
    : completionScore >= 80  ? (lang === 'he' ? 'הפרופיל כמעט שלם' : lang === 'en' ? 'Almost complete' : 'Profil presque complet')
    : completionScore >= 60  ? (lang === 'he' ? 'פרופיל טוב' : lang === 'en' ? 'Good progress' : 'Profil bien avancé')
    : completionScore >= 40  ? (lang === 'he' ? 'בתהליך' : lang === 'en' ? 'In progress' : 'Profil en cours')
    :                          (lang === 'he' ? 'התחל פרופיל' : lang === 'en' ? 'Start your profile' : 'Commence ton profil')

  const completionHint = (() => {
    if (photos.length === 0)        return lang === 'he' ? 'הוסף תמונה לפרופיל שלך' : lang === 'en' ? 'Add a profile photo' : 'Ajoute ta première photo'
    if (!formData.name?.trim())     return lang === 'he' ? 'הוסף את שמך המלא' : lang === 'en' ? 'Add your full name' : 'Ajoute ton nom complet'
    if (bioWordCount === 0)          return lang === 'he' ? 'כתוב ביוגרפיה' : lang === 'en' ? 'Write a bio to introduce yourself' : 'Écris ta bio pour te présenter'
    if (bioWordCount < 10)           return lang === 'he' ? 'הוסף לפחות 10 מילים לביוגרפיה' : lang === 'en' ? 'Add at least 10 words to your bio' : 'Ajoute au moins 10 mots dans ta bio'
    if (photos.length < 3)          return lang === 'he' ? 'הוסף עוד תמונות' : lang === 'en' ? 'Add more photos to stand out' : 'Ajoute plus de photos pour te démarquer'
    return lang === 'he' ? 'הפרופיל שלך מושלם !' : lang === 'en' ? 'Your profile is perfect!' : 'Ton profil est parfait !'
  })()

  // ── Colors ──────────────────────────────────────────────────────
  const bg     = dark ? COURT.darkBg   : COURT.cream
  const card   = dark ? COURT.darkCard : COURT.creamDark
  const ink    = dark ? COURT.darkText : COURT.ink
  const muted  = dark ? COURT.darkMuted: COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}28`

  // ── Handlers ────────────────────────────────────────────────────
  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // reset so same file can be re-picked
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop lourd (max 5 Mo).')
      return
    }
    const result = await uploadPhoto(file)
    if (!result) setError("Échec de l'envoi de la photo")
  }

  const handleInputChange = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handleBioChange = (text) => setFormData(prev => ({ ...prev, [bioKey]: text }))

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      // Also save full_name in sync with name
      const payload = { ...formData }
      if (payload.name) payload.full_name = payload.name
      const { error: saveError } = await saveProfile(payload)
      if (saveError) {
        setError(saveError.message || 'Échec de la sauvegarde')
      } else {
        setSuccess(true)
        setTimeout(() => onClose(), 1000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const currentBio = formData[bioKey] || ''

  // ── Chip button helper ──────────────────────────────────────────
  const Chip = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
        background: active ? COURT.green : card,
        color:      active ? COURT.cream : ink,
        border: `0.5px solid ${active ? COURT.green : border}`,
        transition: 'background 0.15s, color 0.15s',
      }}
    >{children}</button>
  )

  // ── Section heading helper ──────────────────────────────────────
  const SectionTitle = ({ children }) => (
    <h2 style={{
      fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 700,
      color: ink, margin: '0 0 12px',
    }}>{children}</h2>
  )

  const FieldLabel = ({ children }) => (
    <label style={{
      display: 'block', fontFamily: 'Mulish', fontSize: 12, fontWeight: 600,
      color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px',
    }}>{children}</label>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column', background: bg,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: `0.5px solid ${border}`,
      }}>
        <button
          onClick={onClose}
          style={{
            width: 40, height: 40, borderRadius: 10, border: `0.5px solid ${border}`,
            background: card, color: ink, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeftIcon />
        </button>
        <h1 style={{
          fontFamily: 'Spectral, serif', fontSize: 18, fontWeight: 700,
          color: ink, margin: 0,
        }}>
          {t.editProfile}
        </h1>
        <button
          onClick={onClose}
          style={{
            width: 40, height: 40, borderRadius: 10, border: `0.5px solid ${border}`,
            background: card, color: ink, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <XIcon />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', background: bg }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Profile completion banner ──────────────────────── */}
          {(() => {
            const r = 22, cx = 30, cy = 30
            const circum = 2 * Math.PI * r
            const fill   = (completionScore / 100) * circum
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: COURT.green,
                borderRadius: 16, padding: '14px 18px',
                boxShadow: `0 2px 12px ${COURT.green}40`,
              }}>
                {/* Circular progress */}
                <svg width="60" height="60" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
                  {/* Track */}
                  <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke="rgba(255,255,255,0.22)" strokeWidth="4.5" />
                  {/* Fill */}
                  <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke={COURT.gold} strokeWidth="4.5"
                    strokeDasharray={`${fill} ${circum - fill}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${cx} ${cy})`} />
                  {/* Percentage text */}
                  <text x={cx} y={cy + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="13" fontWeight="700" fontFamily="Mulish">
                    {completionScore}%
                  </text>
                </svg>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'Spectral, serif',
                    fontSize: 17, fontWeight: 700, fontStyle: 'italic',
                    color: '#fff', margin: '0 0 3px', lineHeight: 1.2,
                  }}>{completionTitle}</p>
                  <p style={{
                    fontFamily: 'Mulish', fontSize: 13,
                    color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.4,
                  }}>{completionHint}</p>
                </div>
              </div>
            )
          })()}

          {/* ── Nom complet ───────────────────────────────────── */}
          <section>
            <SectionTitle>{lang === 'he' ? 'שם מלא' : lang === 'en' ? 'Full name' : 'Nom complet'}</SectionTitle>
            <input
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder={lang === 'he' ? 'שם פרטי שם משפחה' : lang === 'en' ? 'First Last' : 'Prénom Nom'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 10,
                background: card, color: ink,
                border: `1px solid ${border}`,
                fontFamily: 'Mulish', fontSize: 15, outline: 'none',
              }}
            />
          </section>

          {/* ── Photos ────────────────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{
                fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 700,
                color: ink, margin: 0,
              }}>{t.photos}</h2>
              <span style={{ fontFamily: 'Mulish', fontSize: 12, color: muted }}>{photos.length}/10</span>
            </div>

            <PhotoGalleryEditor
              photos={photos}
              onDelete={deletePhoto}
              onSetPrimary={setPrimaryPhoto}
              onReorder={reorderPhotos}
              onAdd={(!photosLoading && !saving && photos.length < 10) ? () => fileInputRef.current?.click() : null}
              dark={dark}
            />

            {/* Hidden file input triggered by the gallery's add slot */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </section>

          {/* ── Bio ───────────────────────────────────────────── */}
          <section>
            <SectionTitle>{t.bio}</SectionTitle>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={currentBio}
                onChange={(e) => handleBioChange(e.target.value)}
                maxLength={280}
                placeholder={t.bioPlaceholder}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10, resize: 'none',
                  fontFamily: 'Mulish', fontSize: 14, lineHeight: 1.6,
                  background: card, color: ink,
                  border: `1px solid ${border}`,
                  outline: 'none',
                }}
              />
              <p style={{
                fontFamily: 'Mulish', fontSize: 11, color: muted,
                textAlign: 'right', margin: '4px 0 0',
              }}>
                {currentBio.length}/280
              </p>
            </div>
          </section>

          {/* ── Preferences ───────────────────────────────────── */}
          <section>
            <SectionTitle>{t.preferences || 'Préférences'}</SectionTitle>

            {/* Dominant Hand */}
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{t.dominantHand || 'Main dominante'}</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {['left', 'right'].map(hand => (
                  <Chip key={hand} active={formData.dominant_hand === hand} onClick={() => handleInputChange('dominant_hand', hand)}>
                    {t[hand] || hand}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Preferred Side */}
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{t.preferredSide || 'Côté préféré'}</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: 'forehand', label: lang === 'he' ? 'שמאל' : lang === 'en' ? 'Left' : 'Gauche' },
                  { v: 'backhand', label: lang === 'he' ? 'ימין' : lang === 'en' ? 'Right' : 'Droite' },
                ].map(({ v, label }) => (
                  <Chip key={v} active={formData.preferred_side === v} onClick={() => handleInputChange('preferred_side', v)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Play Style */}
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{t.playStyle || 'Style de jeu'}</FieldLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['aggressive', 'defensive', 'all-court'].map(style => (
                  <Chip key={style} active={formData.play_style === style} onClick={() => handleInputChange('play_style', style)}>
                    {t[style] || style}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Motivation */}
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{t.motivation || 'Motivation'}</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {['fun', 'improve', 'compete'].map(mot => (
                  <Chip key={mot} active={formData.motivation === mot} onClick={() => handleInputChange('motivation', mot)}>
                    {t[mot] || mot}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: 4 }}>
              <FieldLabel>
                {t.playFrequency || 'Fréquence de jeu'} : {formData.frequency}× / {lang === 'he' ? 'שבוע' : lang === 'en' ? 'week' : 'sem.'}
              </FieldLabel>
              <PadelSlider
                min={0} max={7} step={1}
                value={formData.frequency}
                onChange={(v) => handleInputChange('frequency', v)}
                dark={dark}
                leftLabel="0" rightLabel="7"
              />
            </div>
          </section>

          {/* ── Messages ──────────────────────────────────────── */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: `${COURT.red}15`, border: `1px solid ${COURT.red}40`,
            }}>
              <p style={{ fontFamily: 'Mulish', fontSize: 13, color: COURT.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {success && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: `${COURT.green}18`, border: `1px solid ${COURT.green}50`,
            }}>
              <p style={{ fontFamily: 'Mulish', fontSize: 13, color: COURT.green, margin: 0 }}>
                {t.profileUpdated}
              </p>
            </div>
          )}

          <div style={{ height: 4 }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `0.5px solid ${border}`,
        padding: '12px 16px',
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={onClose}
          disabled={saving}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            background: card, border: `0.5px solid ${border}`,
            fontFamily: 'Mulish', fontSize: 15, fontWeight: 600, color: ink,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
          }}
        >
          {t.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || photosLoading}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            background: COURT.green, border: `0.5px solid ${COURT.green}`,
            fontFamily: 'Mulish', fontSize: 15, fontWeight: 700, color: COURT.cream,
            cursor: (saving || photosLoading) ? 'not-allowed' : 'pointer',
            opacity: (saving || photosLoading) ? 0.6 : 1,
          }}
        >
          {saving ? t.saving : t.saveProfile}
        </button>
      </div>
    </div>
  )
}
