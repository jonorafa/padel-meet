import { useState, useRef } from 'react'
import { COURT, PadelBall, Ornament } from '../components/CourtUI'
import { useAuth }   from '../context/AuthContext'
import { supabase }  from '../lib/supabase'
import { Sentry }    from '../sentry'
import { SUB_REGIONS } from '../data/courtData'

// ─── Labels i18n ─────────────────────────────────────────────────────────────
const L = {
  fr: {
    title:       'Mon profil',
    subtitle:    'Complète ton profil pour rejoindre le club.',
    fullName:    'Nom complet',
    fullNamePh:  'Prénom Nom',
    onlyRequired: 'Seul le nom est obligatoire — le reste est facultatif.',
    photo:       'Photo de profil',
    changePhoto: 'Changer photo',
    optional:    'optionnel',
    height:      'Taille',
    heightPh:    'cm',
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
    required:    'Ton nom est le seul champ obligatoire.',
    uploadError: "Échec de l'envoi de la photo. Réessaie.",
  },
  en: {
    title:       'My profile',
    subtitle:    'Complete your profile to join the club.',
    fullName:    'Full name',
    fullNamePh:  'First Last',
    onlyRequired: 'Only your name is required — everything else is optional.',
    photo:       'Profile photo',
    changePhoto: 'Change',
    optional:    'optional',
    height:      'Height',
    heightPh:    'cm',
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
    required:    'Your name is the only required field.',
    uploadError: 'Photo upload failed. Please try again.',
  },
  he: {
    title:       'הפרופיל שלי',
    subtitle:    'השלם את הפרופיל שלך כדי להצטרף למועדון.',
    fullName:    'שם מלא',
    fullNamePh:  'שם פרטי שם משפחה',
    onlyRequired: 'רק השם שלך נדרש — כל השאר אופציונלי.',
    photo:       'תמונת פרופיל',
    changePhoto: 'שנה',
    optional:    'אופציונלי',
    height:      'גובה',
    heightPh:    'ס"מ',
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
    required:    'השם שלך הוא השדה היחיד הנדרש.',
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
  const [height,          setHeight]          = useState('')  // cm, optionnel
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
      Sentry.captureException(err)
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
    // Pseudo : on réutilise celui choisi à l'inscription (stocké dans
    // user_metadata.username via AuthScreen). Fallback = génération auto à partir
    // du nom — utilisé pour les comptes Google (qui n'ont pas saisi de pseudo).
    const chosenUsername = user?.user_metadata?.username || generateUsername(fullName)
    const { error } = await saveProfile({
      username:       chosenUsername,
      name:           fullName.trim(),
      full_name:      fullName.trim(),
      photo_url:      avatar,
      height:         height ? Number(height) : null,
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

  // ── Complétion réelle : une fraction sur les champs du formulaire, pas un
  // indicateur à 3 crans arbitraire. Chaque champ rempli compte pour 1/9 —
  // le pourcentage monte quand on remplit, descend (redescendrait) si on vide.
  // Seul le nom est nécessaire pour soumettre ; les 8 autres sont facultatifs
  // mais comptent quand même dans le %, pour que « profil complet » ait un
  // sens réel plutôt que de refléter seulement les 3 champs obligatoires
  // d'avant (qui, eux, ne l'étaient déjà plus vraiment côté produit).
  const fieldsFilled = [
    fullName.trim().length >= 2,
    !!height,
    !!avatar,
    !!hand,
    !!side,
    !!style,
    !!motivation,
    frequency > 0,
    !!(region && city),
  ]
  const completionPct = Math.round((fieldsFilled.filter(Boolean).length / fieldsFilled.length) * 100)

  // Coches par bloc — purement informatives (« cette section est entièrement
  // remplie »), ne bloquent jamais la soumission.
  const aboutComplete = fullName.trim().length >= 2 && !!height
  const playComplete  = !!hand && !!side && !!style && !!motivation && frequency > 0 && !!region && !!city
  const photoComplete = !!avatar

  const canSubmit = fullName.trim().length >= 2 && !submitting

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Header avec progression ── */}
      <div style={{ padding: '28px 24px 16px', textAlign: 'center', flexShrink: 0 }}>
        <Ornament width={50} style={{ margin: '0 auto 8px', display: 'block' }} />
        <div style={{
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontStyle: rtl ? 'normal' : 'italic',
          fontSize: 26, color: ink, fontWeight: 500,
        }}>
          {t.title}
        </div>
        <div style={{
          fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 4, marginBottom: 4,
        }}>
          {lang === 'en' ? 'Profile' : lang === 'he' ? 'פרופיל' : 'Profil'} {completionPct}%
        </div>
        {/* Barre de progression continue — un vrai pourcentage de champs remplis,
            pas 3 crans fixes. Monte à chaque champ rempli (nom compris), même
            facultatif. */}
        <div style={{ width: 160, height: 5, borderRadius: 3, background: border, margin: '0 auto 8px', overflow: 'hidden' }}>
          <div style={{ width: `${completionPct}%`, height: '100%', background: COURT.green, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, fontStyle: 'italic' }}>
          {t.onlyRequired}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 40px' }}>

        {/* ── Bloc 1 : Toi ── */}
        <div style={{
          background: dark ? `${COURT.darkCard}80` : `${COURT.cream}40`,
          border: `0.5px solid ${border}`,
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <div style={{
              fontFamily: 'Mulish', fontSize: 16, fontWeight: 600, color: ink, letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {lang === 'en' ? 'About' : lang === 'he' ? 'אודות' : 'Toi'}
            </div>
            {aboutComplete && (
              <div style={{ fontSize: 16 }}>✓</div>
            )}
          </div>

          {/* Full name — seul champ obligatoire du formulaire */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 4 }}>
              {t.fullName} <span style={{ color: COURT.rust }}>*</span>
            </div>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder={t.fullNamePh}
              style={inputStyle}
            />
          </div>

          {/* Height — optionnel, affiché sur la carte de swipe à côté de l'âge */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 4 }}>
              {t.height} <span style={{ fontStyle: 'italic' }}>({t.optional})</span>
            </div>
            <input
              type="number" inputMode="numeric" min="100" max="250"
              value={height}
              onChange={e => setHeight(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder={lang === 'en' ? 'e.g. 178' : lang === 'he' ? 'למשל 178' : 'ex. 178'}
              style={{ ...inputStyle, width: 120 }}
            />
            <span style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginInlineStart: 8 }}>{t.heightPh}</span>
          </div>

          {/* Dominant hand */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
              {t.hand} <span style={{ fontStyle: 'italic' }}>({t.optional})</span>
            </div>
            <ChipGroup
              value={hand}
              onChange={setHand}
              options={[{ v: 'left', label: t.left }, { v: 'right', label: t.right }]}
              dark={dark}
            />
          </div>
        </div>

        {/* ── Bloc 2 : Ton jeu ── */}
        <div style={{
          background: dark ? `${COURT.darkCard}80` : `${COURT.cream}40`,
          border: `0.5px solid ${border}`,
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{
                fontFamily: 'Mulish', fontSize: 16, fontWeight: 600, color: ink, letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {lang === 'en' ? 'Your game' : lang === 'he' ? 'המשחק שלך' : 'Ton jeu'}
              </div>
              <span style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, fontStyle: 'italic', textTransform: 'none' }}>
                ({t.optional})
              </span>
            </div>
            {playComplete && (
              <div style={{ fontSize: 16 }}>✓</div>
            )}
          </div>

          {/* Preferred side */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 8 }}>
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
              {t.frequency}
            </div>
            <ChipGroup
              value={frequency}
              onChange={setFrequency}
              options={[1, 2, 3, 4, 5].map(n => ({ v: n, label: `${n} ${t.perWeek}` }))}
              dark={dark}
            />
          </div>

          {/* Region */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 8 }}>
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

          {/* City */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
              {t.subRegion}
            </div>
            <ChipGroup
              value={city}
              onChange={setCity}
              options={(SUB_REGIONS[region] || []).map(c => ({ v: c, label: c }))}
              dark={dark}
            />
          </div>
        </div>

        {/* ── Bloc 3 : Ta photo ── */}
        <div style={{
          background: dark ? `${COURT.darkCard}80` : `${COURT.cream}40`,
          border: `0.5px solid ${border}`,
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{
                fontFamily: 'Mulish', fontSize: 16, fontWeight: 600, color: ink, letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {lang === 'en' ? 'Your photo' : lang === 'he' ? 'התמונה שלך' : 'Ta photo'}
              </div>
              <span style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, fontStyle: 'italic', textTransform: 'none' }}>
                ({t.optional})
              </span>
            </div>
            {photoComplete && (
              <div style={{ fontSize: 16 }}>✓</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                <span style={{ fontFamily: 'Pinyon Script, Pinyon Fallback, cursive', fontSize: 34, color: COURT.cream }}>
                  {fullName.charAt(0) || 'P'}
                </span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Mulish', fontSize: 13, color: COURT.green, textDecoration: 'underline',
              }}
            >
              {avatar ? t.changePhoto : t.photo}
            </button>
            {uploadError ? (
              <div style={{
                marginTop: 6, fontFamily: 'Mulish', fontSize: 13,
                color: '#e53e3e', fontStyle: 'italic',
                textAlign: 'center', maxWidth: 260,
              }}>
                {uploadError}
              </div>
            ) : !avatar && (
              <div style={{
                marginTop: 6, fontFamily: 'Mulish', fontSize: 13,
                color: stone, fontStyle: 'italic',
              }}>
                ({t.optional})
              </div>
            )}
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleAvatarUpload(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Form error */}
        {formError && (
          <div style={{ fontFamily: 'Mulish', fontSize: 13, color: '#e53e3e', textAlign: 'center', marginBottom: 12 }}>
            {formError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '16px',
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
          {canSubmit
            ? t.submit
            : (lang === 'en' ? 'Enter your name to continue' : lang === 'he' ? 'הזן את שמך כדי להמשיך' : 'Indique ton nom pour continuer')}
        </button>

      </div>
    </div>
  )
}
