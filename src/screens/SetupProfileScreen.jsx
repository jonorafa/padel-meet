import { useState, useRef } from 'react'
import { COURT, PadelBall, Ornament } from '../components/CourtUI'
import { useAuth }   from '../context/AuthContext'
import { supabase }  from '../lib/supabase'
import { Sentry }    from '../sentry'
import { SUB_REGIONS, ISRAEL_CITIES } from '../data/courtData'
import { prepareVideo, MAX_VIDEO_SECONDS, buildVideoPaths, safeExtFromFilename, storageContentType } from '../lib/video'

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
    height:      'Taille',
    heightPh:    'cm',
    video:       'Extrait vidéo',
    videoHint:   'Un point filmé (max 20 s). C’est ce qui montre le mieux ton niveau.',
    addVideo:    'Ajouter une vidéo',
    changeVideo: 'Changer la vidéo',
    removeVideo: 'Retirer',
    videoSending:'Envoi de la vidéo…',
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
    otherCity:   'Autre ville',
    submit:      'Entrer au club',
    required:    'Ton nom est le seul champ obligatoire.',
    uploadError: "Échec de l'envoi de la photo. Réessaie.",
    sessionNotReady: "Ta connexion n'est pas encore prête. Attends un instant et réessaie.",
  },
  en: {
    title:       'My profile',
    subtitle:    'Complete your profile to join the club.',
    fullName:    'Full name',
    fullNamePh:  'First Last',
    onlyRequired: 'Only your name is required — everything else is optional.',
    photo:       'Profile photo',
    changePhoto: 'Change',
    height:      'Height',
    heightPh:    'cm',
    video:       'Video clip',
    videoHint:   'One filmed point (max 20s). It shows your level better than anything else.',
    addVideo:    'Add a video',
    changeVideo: 'Change video',
    removeVideo: 'Remove',
    videoSending:'Uploading video…',
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
    otherCity:   'Other city',
    submit:      'Enter the club',
    required:    'Your name is the only required field.',
    uploadError: 'Photo upload failed. Please try again.',
    sessionNotReady: "Your connection isn't ready yet. Wait a moment and try again.",
  },
  he: {
    title:       'הפרופיל שלי',
    subtitle:    'השלם את הפרופיל שלך כדי להצטרף למועדון.',
    fullName:    'שם מלא',
    fullNamePh:  'שם פרטי שם משפחה',
    onlyRequired: 'רק השם שלך נדרש — כל השאר אופציונלי.',
    photo:       'תמונת פרופיל',
    changePhoto: 'שנה',
    height:      'גובה',
    heightPh:    'ס"מ',
    video:       'קטע וידאו',
    videoHint:   'נקודה אחת מצולמת (עד 20 שניות). זה מה שמראה הכי טוב את הרמה שלך.',
    addVideo:    'הוסף וידאו',
    changeVideo: 'החלף וידאו',
    removeVideo: 'הסר',
    videoSending:'מעלה וידאו…',
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
    otherCity:   'עיר אחרת',
    submit:      'כניסה למועדון',
    required:    'השם שלך הוא השדה היחיד הנדרש.',
    uploadError: 'העלאת התמונה נכשלה. נסה שוב.',
    // Traduction non relue par un locuteur natif.
    sessionNotReady: 'החיבור שלך עדיין לא מוכן. חכה רגע ונסה שוב.',
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
function ChipGroup({ value, onChange, options, dark, lang }) {
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
            fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 14,
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

function CourtSidePicker({ value, onChange, dark, leftLabel, rightLabel, lang }) {
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
              fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 18,
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
  const videoRef               = useRef()

  // Pre-fill from Google profile if available
  const googleName  = user?.user_metadata?.full_name  || ''
  const googlePhoto = user?.user_metadata?.avatar_url || ''

  const [fullName,        setFullName]        = useState(googleName)
  const [avatar,          setAvatar]          = useState(googlePhoto)
  const [avatarPath,      setAvatarPath]      = useState('')   // chemin storage (pour créer la ligne galerie après submit)
  const [uploadError,     setUploadError]     = useState('')
  const [height,          setHeight]          = useState('')  // cm, optionnel
  // Extrait vidéo (optionnel) — envoyé au moment du choix, pas au submit
  const [videoUrl,        setVideoUrl]        = useState('')
  const [videoPoster,     setVideoPoster]     = useState('')
  const [videoPath,       setVideoPath]       = useState('')
  const [videoUploading,  setVideoUploading]  = useState(false)
  const [videoError,      setVideoError]      = useState('')
  const [hand,            setHand]            = useState('right')
  const [side,            setSide]            = useState('forehand')
  const [style,           setStyle]           = useState('all-court')
  const [motivation,      setMotivation]      = useState('fun')
  const [frequency,       setFrequency]       = useState(2)
  const [region,          setRegion]          = useState('Israël')
  const [city,            setCity]            = useState(ISRAEL_CITIES[0])
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

  // Villes proposées en chips : les 6 villes israéliennes, ou les sous-régions
  // pour la France (inchangé — la France n'a pas de liste de villes dédiée).
  const villesProposees = region === 'Israël' ? ISRAEL_CITIES : (SUB_REGIONS[region] || [])

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

  // ── Extrait vidéo ────────────────────────────────────────────────────────
  // Envoi immédiat (comme la photo) : au submit, seules les URL sont écrites
  // dans profiles. prepareVideo valide taille/durée et extrait la vignette —
  // c'est elle qui rend la carte de swipe affichable sans charger la vidéo.
  const handleVideoUpload = async (file) => {
    if (!file) return
    setVideoError('')
    setVideoUploading(true)
    try {
      // getSession() (par opposition à lire `user` du state React) rafraîchit
      // activement un token sur le point d'expirer avant de le renvoyer — le
      // client Supabase l'appelle de toute façon en interne avant CHAQUE
      // requête, mais retombe SILENCIEUSEMENT sur la clé anon si elle renvoie
      // une session vide (bug observé : "new row violates row-level security
      // policy" sans autre explication). En l'appelant nous-mêmes ici, une
      // session expirée a une vraie chance de se rafraîchir avant l'upload —
      // et si elle est réellement absente, on le sait tout de suite avec un
      // message clair, plutôt que de laisser filer une requête anon vouée à
      // l'échec côté RLS.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t.sessionNotReady)

      const { file: videoFile, poster } = await prepareVideo(file, lang)
      const ext = safeExtFromFilename(videoFile.name)
      const { videoPath: vPath, posterPath: pPath } = buildVideoPaths(user.id, ext)

      const { error: vErr } = await supabase.storage
        .from('profile-videos')
        .upload(vPath, videoFile, { contentType: storageContentType(videoFile), upsert: true })
      if (vErr) throw vErr

      // Vignette dans le même bucket : mêmes règles RLS, un seul dossier à
      // nettoyer si la vidéo est remplacée.
      const { error: pErr } = await supabase.storage
        .from('profile-videos')
        .upload(pPath, poster, { contentType: 'image/jpeg', upsert: true })
      if (pErr) throw pErr

      const { data: vPub } = supabase.storage.from('profile-videos').getPublicUrl(vPath)
      const { data: pPub } = supabase.storage.from('profile-videos').getPublicUrl(pPath)
      setVideoUrl(vPub?.publicUrl || '')
      setVideoPoster(pPub?.publicUrl || '')
      setVideoPath(vPath)
    } catch (err) {
      console.error('Video upload failed:', err)
      Sentry.captureException(err)
      // prepareVideo lève déjà un message traduit et lisible : on l'affiche tel
      // quel plutôt que de le noyer dans un libellé générique.
      setVideoError(err?.message || t.uploadError)
    } finally {
      setVideoUploading(false)
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
      video_url:          videoUrl    || null,
      video_poster_url:   videoPoster || null,
      video_storage_path: videoPath   || null,
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
  // indicateur à 3 crans arbitraire. Chaque champ rempli compte pour 1/10 —
  // le pourcentage monte quand on remplit, descend (redescendrait) si on vide.
  // Seul le nom est nécessaire pour soumettre ; les autres sont facultatifs
  // mais comptent quand même dans le %, pour que « profil complet » ait un
  // sens réel plutôt que de refléter seulement les 3 champs obligatoires
  // d'avant (qui, eux, ne l'étaient déjà plus vraiment côté produit).
  const fieldsFilled = [
    fullName.trim().length >= 2,
    !!height,
    !!avatar,
    !!videoUrl,
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
  const photoComplete = !!avatar && !!videoUrl

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
        <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone }}>
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
              {t.height}
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
              {t.hand}
            </div>
            <ChipGroup
              value={hand}
              onChange={setHand}
              options={[{ v: 'left', label: t.left }, { v: 'right', label: t.right }]}
              dark={dark} lang={lang}
            />
          </div>
        </div>

        {/* ── Bloc 2 : Photo & vidéo ── */}
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
              {lang === 'en' ? 'Photo & video' : lang === 'he' ? 'תמונה ווידאו' : 'Photo & vidéo'}
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
                color: '#e53e3e', fontStyle: lang === 'he' ? 'normal' : 'italic',
                textAlign: 'center', maxWidth: 260,
              }}>
                {uploadError}
              </div>
            ) : null}
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleAvatarUpload(e.target.files?.[0])}
            />
          </div>

          {/* ── Extrait vidéo ── */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${border}` }}>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 2 }}>
              {t.video}
            </div>
            {/* La limite affichée vient de la constante partagée avec la
                validation : impossible d'annoncer une durée et d'en refuser
                une autre. */}
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 10, lineHeight: 1.4 }}>
              {t.videoHint.replace('20 s', `${MAX_VIDEO_SECONDS} s`).replace('20s', `${MAX_VIDEO_SECONDS}s`).replace('20 שניות', `${MAX_VIDEO_SECONDS} שניות`)}
            </div>

            {videoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Vignette extraite de la vidéo à l'envoi */}
                <div style={{
                  position: 'relative', width: 96, height: 64, borderRadius: 8, overflow: 'hidden',
                  background: `url(${videoPoster}) center/cover`, border: `0.5px solid ${border}`,
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.25)',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <button onClick={() => videoRef.current?.click()} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'Mulish', fontSize: 13, color: COURT.green, textDecoration: 'underline',
                  }}>{t.changeVideo}</button>
                  <button
                    onClick={() => { setVideoUrl(''); setVideoPoster(''); setVideoPath(''); setVideoError('') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontFamily: 'Mulish', fontSize: 13, color: COURT.rust, textDecoration: 'underline',
                    }}>{t.removeVideo}</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => videoRef.current?.click()}
                disabled={videoUploading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 10,
                  background: dark ? COURT.darkCard : COURT.cream,
                  border: `0.5px solid ${COURT.green}60`,
                  color: dark ? COURT.darkText : COURT.green,
                  fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 14,
                  cursor: videoUploading ? 'wait' : 'pointer', opacity: videoUploading ? 0.6 : 1,
                }}
              >
                {videoUploading ? (
                  <>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: `2px solid ${COURT.green}40`, borderTopColor: COURT.green,
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    {t.videoSending}
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" />
                    </svg>
                    {t.addVideo}
                  </>
                )}
              </button>
            )}

            {videoError && (
              <div style={{
                marginTop: 8, fontFamily: 'Mulish', fontSize: 13,
                color: '#e53e3e', fontStyle: lang === 'he' ? 'normal' : 'italic', lineHeight: 1.4,
              }}>
                {videoError}
              </div>
            )}

            <input
              ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*"
              style={{ display: 'none' }}
              onChange={e => { handleVideoUpload(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
        </div>

        {/* ── Bloc 3 : Ton jeu ── */}
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
              {lang === 'en' ? 'Your game' : lang === 'he' ? 'המשחק שלך' : 'Ton jeu'}
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
              dark={dark} lang={lang}
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
              dark={dark} lang={lang}
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
              dark={dark} lang={lang}
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
              dark={dark} lang={lang}
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
                    onClick={() => { setRegion(v); setCity(v === 'Israël' ? ISRAEL_CITIES[0] : SUB_REGIONS[v][0]) }}
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
                      fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 16,
                      color: active ? COURT.cream : (dark ? COURT.darkText : COURT.green),
                      fontWeight: active ? 600 : 400,
                    }}>{v}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* City — en Israël : 6 villes + champ libre pour les autres.
              Le champ libre n'écrase pas le matching : profileSubRegion()
              retombe sur la sous-région via VILLE_VERS_SOUS_REGION, et rend
              null pour une ville inconnue — compatibility.js s'abstient alors
              au lieu de deviner, exactement comme pour un profil français. */}
          <div>
            <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginBottom: 6 }}>
              {t.subRegion}
            </div>
            <ChipGroup
              value={villesProposees.includes(city) ? city : null}
              onChange={setCity}
              options={villesProposees.map(c => ({ v: c, label: c }))}
              dark={dark} lang={lang}
            />
            <input
              value={villesProposees.includes(city) ? '' : city}
              onChange={e => setCity(e.target.value)}
              placeholder={t.otherCity}
              style={{ ...inputStyle, marginTop: 8 }}
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
