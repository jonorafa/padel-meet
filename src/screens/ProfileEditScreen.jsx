import { useState } from 'react'
import { COURT, PadelSlider } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useProfilePhotos } from '../hooks/useProfilePhotos'
import { I18N } from '../data/courtData'
import { PhotoGalleryEditor } from '../components/PhotoGalleryEditor'
import { PhotoUploadField } from '../components/PhotoUploadField'

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

  const [currentBioLang, setCurrentBioLang] = useState('fr')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  // ── Colors ──────────────────────────────────────────────────────
  const bg     = dark ? COURT.darkBg   : COURT.cream
  const card   = dark ? COURT.darkCard : COURT.creamDark
  const ink    = dark ? COURT.darkText : COURT.ink
  const muted  = dark ? COURT.darkMuted: COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}28`

  // ── Handlers ────────────────────────────────────────────────────
  const handlePhotoUpload = async (file) => {
    const result = await uploadPhoto(file)
    if (!result) setError('Échec de l\'envoi de la photo')
  }

  const handleInputChange = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handleBioChange = (text) => {
    const key = currentBioLang === 'fr' ? 'bio_fr' : currentBioLang === 'en' ? 'bio_en' : 'bio_he'
    setFormData(prev => ({ ...prev, [key]: text }))
  }

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

  const currentBio = formData[currentBioLang === 'fr' ? 'bio_fr' : currentBioLang === 'en' ? 'bio_en' : 'bio_he'] || ''

  // ── Chip button helper ──────────────────────────────────────────
  const Chip = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
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
      fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 700,
      color: ink, margin: '0 0 12px',
    }}>{children}</h2>
  )

  const FieldLabel = ({ children }) => (
    <label style={{
      display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
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
          fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700,
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
                fontFamily: 'Inter', fontSize: 15, outline: 'none',
              }}
            />
          </section>

          {/* ── Photos ────────────────────────────────────────── */}
          <section>
            <SectionTitle>{t.photos}</SectionTitle>

            {photos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: muted, margin: '0 0 10px' }}>
                  {t.managePhotos}
                </p>
                <PhotoGalleryEditor
                  photos={photos}
                  onDelete={deletePhoto}
                  onSetPrimary={setPrimaryPhoto}
                  onReorder={reorderPhotos}
                  dark={dark}
                />
              </div>
            )}

            <p style={{ fontFamily: 'Inter', fontSize: 13, color: muted, margin: '0 0 10px' }}>
              {photos.length === 0 ? t.addYourFirstPhoto : t.addMorePhotos} ({photos.length}/10)
            </p>
            <PhotoUploadField
              onUpload={handlePhotoUpload}
              disabled={photosLoading || saving}
              dark={dark}
            />
          </section>

          {/* ── Bio ───────────────────────────────────────────── */}
          <section>
            <SectionTitle>{t.bio}</SectionTitle>

            {/* Language tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['fr', 'en', 'he'].map(lc => (
                <button
                  key={lc}
                  onClick={() => setCurrentBioLang(lc)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Inter', fontSize: 13, fontWeight: 700,
                    background: currentBioLang === lc ? COURT.green : card,
                    color:      currentBioLang === lc ? COURT.cream  : ink,
                    border: `0.5px solid ${currentBioLang === lc ? COURT.green : border}`,
                    letterSpacing: '0.06em',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >{lc.toUpperCase()}</button>
              ))}
            </div>

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
                  fontFamily: 'Inter', fontSize: 14, lineHeight: 1.6,
                  background: card, color: ink,
                  border: `1px solid ${border}`,
                  outline: 'none',
                }}
              />
              <p style={{
                fontFamily: 'Inter', fontSize: 11, color: muted,
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
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: COURT.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {success && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: `${COURT.green}18`, border: `1px solid ${COURT.green}50`,
            }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: COURT.green, margin: 0 }}>
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
            fontFamily: 'Inter', fontSize: 15, fontWeight: 600, color: ink,
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
            fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: COURT.cream,
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
