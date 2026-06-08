import { useState, useRef } from 'react'
import { COURT, PadelBall, Ornament } from '../components/CourtUI'
import { useAuth }   from '../context/AuthContext'
import { supabase }  from '../lib/supabase'
import { SUB_REGIONS } from '../data/courtData'

// ─── Labels i18n ─────────────────────────────────────────────────────────────
const L = {
  fr: {
    title:       'Mon profil',
    subtitle:    'Complète ton profil pour rejoindre le club.',
    fullName:    'Nom complet',
    fullNamePh:  'Prénom Nom',
    photo:       'Photo de profil',
    changePhoto: 'Changer photo',
    hand:        'Main dominante',
    right:       'Droitier',
    left:        'Gaucher',
    side:        'Côté préféré',
    forehand:    'Gauche',
    backhand:    'Droite',
    style:       'Style de jeu',
    aggressive:  'Offensif',
    defensive:   'Défensif',
    allcourt:    'Polyvalent',
    motivation:  'Ta motivation',
    fun:         'Le plaisir',
    improve:     'Progresser',
    compete:     'Compétition',
    frequency:   'Fréquence de jeu',
    perWeek:     '× / sem.',
    region:      'Région',
    subRegion:   'Où habites-tu ?',
    submit:      'Entrer au club',
    required:    'Remplis tous les champs.',
    photoRequired: 'Ajoutez une photo pour continuer',
    uploadError: "Échec de l'envoi de la photo. Réessaie.",
  },
  en: {
    title:       'My profile',
    subtitle:    'Complete your profile to join the club.',
    fullName:    'Full name',
    fullNamePh:  'First Last',
    photo:       'Profile photo',
    changePhoto: 'Change',
    hand:        'Dominant hand',
    right:       'Right-handed',
    left:        'Left-handed',
    side:        'Preferred side',
    forehand:    'Left',
    backhand:    'Right',
    style:       'Play style',
    aggressive:  'Aggressive',
    defensive:   'Defensive',
    allcourt:    'All-court',
    motivation:  'Your motivation',
    fun:         'For fun',
    improve:     'Improve',
    compete:     'Compete',
    frequency:   'Play frequency',
    perWeek:     '× / week',
    region:      'Region',
    subRegion:   'Where do you live?',
    submit:      'Enter the club',
    required:    'Please fill in all fields.',
    photoRequired: 'Add a photo to continue',
    uploadError: 'Photo upload failed. Please try again.',
  },
  he: {
    title:       'הפרופיל שלי',
    subtitle:    'השלם את הפרופיל שלך כדי להצטרף למועדון.',
    fullName:    'שם מלא',
    fullNamePh:  'שם פרטי שם משפחה',
    photo:       'תמונת פרופיל',
    changePhoto: 'שנה',
    hand:        'יד דומיננטית',
    right:       'ימני',
    left:        'שמאלי',
    side:        'צד מועדף',
    forehand:    'שמאל',
    backhand:    'ימין',
    style:       'סגנון משחק',
    aggressive:  'תוקפני',
    defensive:   'הגנתי',
    allcourt:    'רב-גוני',
    motivation:  'המוטיבציה שלך',
    fun:         'הנאה',
    improve:     'שיפור',
    compete:     'תחרות',
    frequency:   'תדירות משחק',
    perWeek:     '× / שבוע',
    region:      'אזור',
    subRegion:   'איפה אתה גר?',
    submit:      'כניסה למועדון',
    required:    'אנא מלא את כל השדות.',
    photoRequired: 'הוסף תמונה כדי להמשיך',
    uploadError: 'העלאת התמונה נכשלה. נסה שוב.',
  },
}

// Compresse une image en JPEG (max 1600 px, qualité 0.82). Gère les gros
// fichiers et NORMALISE le type vers image/jpeg — indispensable car le bucket
// n'accepte que jpeg/png/webp ≤ 5 Mo (un HEIC d'iPhone brut serait rejeté).
function compressToJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image illisible (format non supporté ?)'))
      img.onload = () => {
        let { width, height } = img
        const max = 1600
        if (width > height && width > max) { height = (height * max) / width; width = max }
        else if (height > max)            { width = (width * max) / height; height = max }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée'))),
          'image/jpeg',
          0.82,
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ─── Chip group ───────────────────────────────────────────────────────────────
function ChipGroup({ value, onChange, options, dark }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt.v
        return (
          <button key={opt.v} onClick={() => onChange(opt.v)} style={{
            flex: 1, minWidth: 80, padding: '10px 8px',
            background: active ? COURT.green : (dark ? COURT.darkCard : COURT.cream),
            color:      active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
            border:     `0.5px solid ${dark ? COURT.darkBorder : COURT.green + '60'}`,
            borderRadius: 10, cursor: 'pointer',
            fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 14,
            transition: 'all 0.2s',
          }}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Court side picker ────────────────────────────────────────────────────────
function CourtHalfSVG({ side, active }) {
  const color  = active ? COURT.cream : COURT.green
  const fillHL = active ? `${COURT.cream}35` : `${COURT.green}22`
  return (
    <svg width="68" height="44" viewBox="0 0 68 44">
      {/* Court outline */}
      <rect x="1.5" y="1.5" width="65" height="41" rx="3" fill="none" stroke={color} strokeWidth="1" opacity="0.45" />
      {/* Net — vertical centre */}
      <line x1="34" y1="1.5" x2="34" y2="42.5" stroke={color} strokeWidth="2" opacity="0.9" />
      {/* Service lines */}
      <line x1="1.5" y1="22" x2="33" y2="22" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <line x1="35" y1="22" x2="66.5" y2="22" stroke={color} strokeWidth="0.7" opacity="0.35" />
      {/* Glass walls (short sides) */}
      <line x1="1.5" y1="1.5" x2="1.5" y2="42.5" stroke={color} strokeWidth="2" opacity="0.5" />
      <line x1="66.5" y1="1.5" x2="66.5" y2="42.5" stroke={color} strokeWidth="2" opacity="0.5" />
      {/* Highlighted half */}
      <rect
        x={side === 'left' ? 2.5 : 35} y="2.5"
        width="31" height="39" rx="2"
        fill={fillHL}
      />
      {/* Player position circle */}
      <circle cx={side === 'left' ? 17 : 51} cy="22" r="4" fill={color} opacity="0.85" />
    </svg>
  )
}

function CourtSidePicker({ value, onChange, dark, leftLabel, rightLabel }) {
  const sides = [
    { v: 'forehand', label: leftLabel,  side: 'left'  },
    { v: 'backhand', label: rightLabel, side: 'right' },
  ]
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {sides.map(s => {
        const active = value === s.v
        return (
          <button key={s.v} onClick={() => onChange(s.v)} style={{
            flex: 1, height: 128, borderRadius: 14,
            background: active ? COURT.green : (dark ? COURT.darkCard : '#ede8d6'),
            border: `1px solid ${active ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '40')}`,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
          }}>
            <CourtHalfSVG side={s.side} active={active} />
            <span style={{
              fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 18,
              color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
              fontWeight: active ? 600 : 400,
            }}>
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── SetupProfileScreen ───────────────────────────────────────────────────────
export default function SetupProfileScreen({ lang, dark, level, onDone }) {
  const { user, saveProfile }  = useAuth()
  const fileRef                = useRef()

  // Pre-fill from Google profile if available
  const googleName  = user?.user_metadata?.full_name  || ''
  const googlePhoto = user?.user_metadata?.avatar_url || ''

  const [fullName,        setFullName]        = useState(googleName)
  const [avatar,          setAvatar]          = useState(googlePhoto)
  const [avatarPath,      setAvatarPath]      = useState('')   // chemin storage (pour créer la ligne galerie après submit)
  const [uploadError,     setUploadError]     = useState('')
  const [hand,            setHand]            = useState('right')
  const [side,            setSide]            = useState('forehand')
  const [style,           setStyle]           = useState('all-court')
  const [motivation,      setMotivation]      = useState('fun')
  const [frequency,       setFrequency]       = useState(2)
  const [region,          setRegion]          = useState('Israël')
  const [city,            setCity]            = useState(SUB_REGIONS['Israël'][0])
  const [uploading,       setUploading]       = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [formError,       setFormError]       = useState('')

  /** Génère un username unique à partir du nom complet. */
  const generateUsername = (name) => {
    const base = name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // enlève les accents
      .replace(/[^a-z0-9]/g, '')                          // garde lettres/chiffres
      .slice(0, 14) || 'player'
    return `${base}_${Date.now().toString(36).slice(-4)}`
  }

  const t   = L[lang] || L.en
  const rtl = lang === 'he'

  const bg     = dark ? COURT.darkBg    : COURT.cream
  const ink    = dark ? COURT.darkText  : COURT.ink
  const stone  = dark ? COURT.darkMuted : COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}40`

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: 10,
    background: dark ? '#1a2820' : COURT.cream,
    border:     `0.5px solid ${border}`,
    fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
    fontStyle:  rtl ? 'normal' : 'italic',
    fontSize: 15, color: ink, outline: 'none',
    WebkitAppearance: 'none',
  }

  // ── Avatar upload ────────────────────────────────────────────────────────
  // Upload vers le bucket `profile-photos` (le seul qui existe) au chemin
  // `photos/{uid}/...` exigé par la RLS storage. On compresse en JPEG d'abord,
  // et surtout on REMONTE les erreurs (l'ancienne version les avalait → spinner
  // qui tournait dans le vide).
  const handleAvatarUpload = async (file) => {
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const blob = await compressToJpeg(file)
      const storagePath = `photos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`
      const { error } = await supabase.storage
        .from('profile-photos')
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(storagePath)
      setAvatar(data?.publicUrl || '')
      setAvatarPath(storagePath)
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setUploadError(err?.message ? `${t.uploadError} (${err.message})` : t.uploadError)
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('')
    if (!fullName.trim()) { setFormError(t.required); return }
    setSubmitting(true)
    const { error } = await saveProfile({
      username:       generateUsername(fullName),
      name:           fullName.trim(),
      full_name:      fullName.trim(),
      photo_url:      avatar,
      dominant_hand:  hand,
      preferred_side: side,
      play_style:     style,
      motivation,
      frequency,
      region,
      city,
      level,
    })
    if (error) { setSubmitting(false); setFormError(error.message); return }

    // Le profil existe maintenant → on peut créer la ligne galerie (FK vers
    // profiles). Le trigger SQL la marque automatiquement comme primary.
    // Non-bloquant : l'avatar marche déjà via photo_url même si ça échoue.
    if (avatarPath) {
      const { error: photoErr } = await supabase.from('profile_photos').insert({
        user_id:      user.id,
        url:          avatar,
        storage_path: avatarPath,
      })
      if (photoErr) console.warn('[onboarding] insert galerie non-bloquant:', photoErr.message)
    }

    setSubmitting(false)
    onDone()
  }

  const canSubmit = fullName.trim().length >= 2 && !!avatar && !submitting

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '32px 24px 12px', textAlign: 'center', flexShrink: 0 }}>
        <Ornament width={50} style={{ margin: '0 auto 8px', display: 'block' }} />
        <div style={{
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 26, color: ink, fontWeight: 500,
        }}>
          {t.title}
        </div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 12, color: stone, marginTop: 4,
        }}>
          {t.subtitle}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 40px' }}>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: 40, overflow: 'hidden', cursor: 'pointer',
              border:  `2px solid ${COURT.gold}60`,
              background: avatar ? 'transparent' : COURT.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {uploading ? (
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2px solid ${COURT.cream}40`, borderTopColor: COURT.cream,
                animation: 'spin 0.7s linear infinite',
              }} />
            ) : avatar ? (
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: 'Pinyon Script, cursive', fontSize: 34, color: COURT.cream }}>
                {fullName.charAt(0) || 'P'}
              </span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Mulish', fontSize: 11, color: COURT.green, textDecoration: 'underline',
            }}
          >
            {avatar ? t.changePhoto : t.photo}
          </button>
          {uploadError ? (
            <div style={{
              marginTop: 4, fontFamily: 'Mulish', fontSize: 11,
              color: '#e53e3e', fontStyle: 'italic',
              textAlign: 'center', maxWidth: 260,
            }}>
              {uploadError}
            </div>
          ) : !avatar && (
            <div style={{
              marginTop: 4, fontFamily: 'Mulish', fontSize: 11,
              color: COURT.purple, fontStyle: 'italic',
            }}>
              {L[lang]?.photoRequired || 'Ajoutez une photo'}
            </div>
          )}
          <input
            ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleAvatarUpload(e.target.files?.[0])}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Full name */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.fullName}
            </div>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder={t.fullNamePh}
              style={inputStyle}
            />
          </div>

          {/* Dominant hand */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.hand}
            </div>
            <ChipGroup
              value={hand}
              onChange={setHand}
              options={[{ v: 'left', label: t.left }, { v: 'right', label: t.right }]}
              dark={dark}
            />
          </div>

          {/* Preferred side */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.side}
            </div>
            <CourtSidePicker
              value={side}
              onChange={setSide}
              leftLabel={t.forehand}
              rightLabel={t.backhand}
              dark={dark}
            />
          </div>

          {/* Play style */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.style}
            </div>
            <ChipGroup
              value={style}
              onChange={setStyle}
              options={[
                { v: 'aggressive', label: t.aggressive },
                { v: 'defensive',  label: t.defensive  },
                { v: 'all-court',  label: t.allcourt   },
              ]}
              dark={dark}
            />
          </div>

          {/* Motivation */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.motivation}
            </div>
            <ChipGroup
              value={motivation}
              onChange={setMotivation}
              options={[
                { v: 'fun',     label: t.fun     },
                { v: 'improve', label: t.improve },
                { v: 'compete', label: t.compete },
              ]}
              dark={dark}
            />
          </div>

          {/* Frequency */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.frequency}
            </div>
            <ChipGroup
              value={frequency}
              onChange={setFrequency}
              options={[1, 2, 3, 4, 5].map(n => ({ v: n, label: `${n} ${t.perWeek}` }))}
              dark={dark}
            />
          </div>

          {/* Country */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.region}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ v: 'France', flag: '🇫🇷' }, { v: 'Israël', flag: '🇮🇱' }].map(({ v, flag }) => {
                const active = region === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setRegion(v); setCity(SUB_REGIONS[v][0]) }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                      background: active ? COURT.green : (dark ? '#1a2820' : COURT.cream),
                      border: `0.5px solid ${active ? COURT.green : (dark ? COURT.darkBorder : COURT.green + '60')}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{flag}</span>
                    <span style={{
                      fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 16,
                      color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
                      fontWeight: active ? 600 : 400,
                    }}>{v}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sub-region (city) */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t.subRegion}
            </div>
            <ChipGroup
              value={city}
              onChange={setCity}
              options={(SUB_REGIONS[region] || []).map(c => ({ v: c, label: c }))}
              dark={dark}
            />
          </div>

          {/* Form error */}
          {formError && (
            <div style={{ fontFamily: 'Mulish', fontSize: 12, color: '#e53e3e', textAlign: 'center' }}>
              {formError}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              marginTop: 8, width: '100%', padding: '16px',
              background: canSubmit ? COURT.green : `${COURT.green}55`,
              color: COURT.cream,
              border: `0.5px solid ${COURT.gold}60`,
              borderRadius: 12,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
              fontStyle: rtl ? 'normal' : 'italic',
              fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.2s',
            }}
          >
            {submitting ? (
              <div style={{
                width: 17, height: 17, borderRadius: '50%',
                border: `2px solid ${COURT.cream}40`, borderTopColor: COURT.cream,
                animation: 'spin 0.7s linear infinite',
              }} />
            ) : (
              <PadelBall size={18} shadow={false} />
            )}
            {t.submit}
          </button>

        </div>
      </div>
    </div>
  )
}
