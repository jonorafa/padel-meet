import { useState, useRef } from 'react'
import { COURT, PadelSlider, initialsAvatar } from '../components/CourtUI'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import { I18N } from '../data/courtData'

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

// ── Chip button helper ────────────────────────────────────────────────────────
// Défini au niveau module (et non dans le render) : un composant recréé à chaque
// rendu est vu par React comme un TYPE différent, ce qui démonte/remonte le
// <button> — le focus clavier est perdu à chaque frappe dans le formulaire.
const Chip = ({ active, onClick, children, dark }) => {
  const card   = dark ? COURT.darkCard   : COURT.creamDark
  const ink    = dark ? COURT.darkText   : COURT.ink
  const border = dark ? COURT.darkBorder : `${COURT.green}28`
  return (
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
}

/**
 * Full-screen profile editing — COURT design system
 * Sections: photos, bio (FR/EN/HE), preference tags
 */
export function ProfileEditScreen({ onClose = () => {}, dark = false }) {
  const { user, profile, saveProfile } = useAuth()
  const { lang } = usePrefs()
  const t = I18N[lang] || I18N.fr

  // Une seule photo : celle affichée sur le profil (profiles.photo_url).
  // La galerie multi-photos a été retirée — le glisser-déposer pour réordonner
  // ne fonctionnait pas correctement, et l'app n'a jamais montré qu'une seule
  // photo aux autres joueurs de toute façon (PlayerCard/DetailedProfileModal
  // lisent uniquement photo_url).
  const [photoUrl, setPhotoUrl]         = useState(profile?.photo_url || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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
    { pts: 30, done: !!photoUrl },
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
    if (!photoUrl)                  return lang === 'he' ? 'הוסף תמונה לפרופיל שלך' : lang === 'en' ? 'Add a profile photo' : 'Ajoute ta photo de profil'
    if (!formData.name?.trim())     return lang === 'he' ? 'הוסף את שמך המלא' : lang === 'en' ? 'Add your full name' : 'Ajoute ton nom complet'
    if (bioWordCount === 0)          return lang === 'he' ? 'כתוב ביוגרפיה' : lang === 'en' ? 'Write a bio to introduce yourself' : 'Écris ta bio pour te présenter'
    if (bioWordCount < 10)           return lang === 'he' ? 'הוסף לפחות 10 מילים לביוגרפיה' : lang === 'en' ? 'Add at least 10 words to your bio' : 'Ajoute au moins 10 mots dans ta bio'
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
    if (!file || !user) return
    e.target.value = ''   // reset so same file can be re-picked
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop lourd (max 5 Mo).')
      return
    }
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file)
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const path = `photos/${user.id}/${stamp}.jpg`
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) throw new Error('URL publique introuvable')
      const { error: saveErr } = await saveProfile({ photo_url: url })
      if (saveErr) throw saveErr
      setPhotoUrl(url)
    } catch (err) {
      setError(err.message || "Échec de l'envoi de la photo")
    } finally {
      setUploadingPhoto(false)
    }
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

  // ── Styles des libellés ─────────────────────────────────────────
  // Simples objets de style (et non des composants définis dans le render) :
  // le <h2>/<label> reste alors le même nœud DOM d'un rendu à l'autre.
  const sectionTitleStyle = {
    fontFamily: 'Spectral, serif', fontSize: 17, fontWeight: 700,
    color: ink, margin: '0 0 12px',
  }
  const fieldLabelStyle = {
    display: 'block', fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
    color: muted, margin: '0 0 8px',
  }

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
            <h2 style={sectionTitleStyle}>{lang === 'he' ? 'שם מלא' : lang === 'en' ? 'Full name' : 'Nom complet'}</h2>
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

          {/* ── Photo ─────────────────────────────────────────── */}
          <section>
            <h2 style={sectionTitleStyle}>{t.photos}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                style={{
                  width: 84, height: 84, borderRadius: 16, flexShrink: 0,
                  background: photoUrl ? `url(${photoUrl}) center/cover` : `url(${initialsAvatar(formData.name)}) center/cover`,
                  border: `1px solid ${border}`, cursor: uploadingPhoto ? 'wait' : 'pointer',
                  opacity: uploadingPhoto ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{
                    padding: '9px 16px', borderRadius: 10, cursor: uploadingPhoto ? 'wait' : 'pointer',
                    background: COURT.green, color: COURT.cream, border: 'none',
                    fontFamily: 'Mulish', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {uploadingPhoto
                    ? (lang === 'he' ? 'מעלה…' : lang === 'en' ? 'Uploading…' : 'Envoi…')
                    : photoUrl
                      ? (lang === 'he' ? 'החלף תמונה' : lang === 'en' ? 'Change photo' : 'Changer la photo')
                      : (lang === 'he' ? 'הוסף תמונה' : lang === 'en' ? 'Add a photo' : 'Ajouter une photo')}
                </button>
                <p style={{ fontFamily: 'Mulish', fontSize: 11.5, color: muted, margin: '8px 0 0', lineHeight: 1.4 }}>
                  {lang === 'he'
                    ? 'תמונה אחת בלבד — זו שהשחקנים האחרים יראו בפרופיל שלך.'
                    : lang === 'en'
                      ? 'A single photo — the one other players will see on your profile.'
                      : 'Une seule photo — c\'est celle que les autres joueurs verront sur ton profil.'}
                </p>
              </div>
            </div>

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
            <h2 style={sectionTitleStyle}>{t.bio}</h2>

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
            <h2 style={sectionTitleStyle}>{t.preferences || 'Préférences'}</h2>

            {/* Dominant Hand */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t.dominantHand || 'Main dominante'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['left', 'right'].map(hand => (
                  <Chip dark={dark} key={hand} active={formData.dominant_hand === hand} onClick={() => handleInputChange('dominant_hand', hand)}>
                    {t[hand] || hand}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Preferred Side */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t.preferredSide || 'Côté préféré'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: 'forehand', label: lang === 'he' ? 'שמאל' : lang === 'en' ? 'Left' : 'Gauche' },
                  { v: 'backhand', label: lang === 'he' ? 'ימין' : lang === 'en' ? 'Right' : 'Droite' },
                ].map(({ v, label }) => (
                  <Chip dark={dark} key={v} active={formData.preferred_side === v} onClick={() => handleInputChange('preferred_side', v)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Play Style */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t.playStyle || 'Style de jeu'}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['aggressive', 'defensive', 'all-court'].map(style => (
                  <Chip dark={dark} key={style} active={formData.play_style === style} onClick={() => handleInputChange('play_style', style)}>
                    {t[style] || style}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Motivation */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t.motivation || 'Motivation'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['fun', 'improve', 'compete'].map(mot => (
                  <Chip dark={dark} key={mot} active={formData.motivation === mot} onClick={() => handleInputChange('motivation', mot)}>
                    {t[mot] || mot}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: 4 }}>
              <label style={fieldLabelStyle}>
                {t.playFrequency || 'Fréquence de jeu'} : {formData.frequency}× / {lang === 'he' ? 'שבוע' : lang === 'en' ? 'week' : 'sem.'}
              </label>
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
          disabled={saving || uploadingPhoto}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            background: COURT.green, border: `0.5px solid ${COURT.green}`,
            fontFamily: 'Mulish', fontSize: 15, fontWeight: 700, color: COURT.cream,
            cursor: (saving || uploadingPhoto) ? 'not-allowed' : 'pointer',
            opacity: (saving || uploadingPhoto) ? 0.6 : 1,
          }}
        >
          {saving ? t.saving : t.saveProfile}
        </button>
      </div>
    </div>
  )
}
