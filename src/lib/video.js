// Validation et préparation d'un extrait vidéo de profil (un point de padel).
//
// Le navigateur ne sait pas ré-encoder une vidéo sans embarquer un
// transcodeur lourd (ffmpeg.wasm, ~30 Mo) : on ne CORRIGE donc pas les
// fichiers trop lourds ou trop longs, on les REFUSE avec un message clair.
// La compression est laissée à l'app photo du téléphone, qui la fait bien.

export const MAX_VIDEO_BYTES   = 50 * 1024 * 1024; // aligné sur le bucket (50 Mo)
export const MAX_VIDEO_SECONDS = 20;               // un point de padel, pas un match

const MSG = {
  fr: {
    tooBig:     'Vidéo trop lourde (max 50 Mo). Réduis la qualité ou raccourcis l’extrait.',
    tooLong:    (d) => `Vidéo trop longue (${Math.round(d)} s, max ${MAX_VIDEO_SECONDS} s). Garde juste un point.`,
    unreadable: 'Format vidéo non lisible. Essaie un fichier MP4.',
    noFrame:    'Impossible d’extraire une image de la vidéo. Essaie un fichier MP4.',
  },
  en: {
    tooBig:     'Video too large (max 50 MB). Lower the quality or trim the clip.',
    tooLong:    (d) => `Video too long (${Math.round(d)}s, max ${MAX_VIDEO_SECONDS}s). Keep a single point.`,
    unreadable: 'Unreadable video format. Try an MP4 file.',
    noFrame:    'Could not extract a frame from the video. Try an MP4 file.',
  },
  he: {
    tooBig:     'הסרטון כבד מדי (מקסימום 50 מ״ב). הקטן את האיכות או קצר את הקטע.',
    tooLong:    (d) => `הסרטון ארוך מדי (${Math.round(d)} שניות, מקסימום ${MAX_VIDEO_SECONDS}). השאר נקודה אחת.`,
    unreadable: 'פורמט וידאו לא נתמך. נסה קובץ MP4.',
    noFrame:    'לא ניתן לחלץ תמונה מהסרטון. נסה קובץ MP4.',
  },
};

/** Charge la vidéo hors écran et attend ses métadonnées (durée, dimensions). */
function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;          // iOS : sans ça, lecture plein écran forcée
    v.src = url;
    v.onloadedmetadata = () => resolve({ video: v, url });
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('UNREADABLE')); };
  });
}

/**
 * Extrait une image de la vidéo et la renvoie en JPEG.
 * Sert de vignette sur la carte de swipe : la vidéo elle-même n'est alors
 * jamais téléchargée tant que personne ne la lance (3 cartes sont montées
 * en même temps dans la pile), et la vignette reste visible même si le
 * navigateur du lecteur ne sait pas décoder le format (cas des .mov HEVC).
 */
function captureFrame(video, maxDim = 640, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Une image un peu après le début : la toute première est souvent noire
    // (fondu d'ouverture, capteur qui s'ajuste).
    const target = Math.min(1, (video.duration || 2) / 4);
    const draw = () => {
      let w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return reject(new Error('NO_FRAME'));
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else        { w = Math.round(w * (maxDim / h)); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('NO_FRAME')),
        'image/jpeg', quality
      );
    };
    video.onseeked = draw;
    video.onerror  = () => reject(new Error('NO_FRAME'));
    try { video.currentTime = target; } catch { reject(new Error('NO_FRAME')); }
  });
}

/**
 * Valide un fichier vidéo et en extrait la vignette.
 * @returns {Promise<{ file: File, poster: Blob, duration: number }>}
 * @throws  {Error} message déjà traduit, affichable tel quel
 */
export async function prepareVideo(file, lang = 'fr') {
  const m = MSG[lang] || MSG.fr;

  // Taille d'abord : inutile de décoder un fichier qu'on va refuser.
  if (file.size > MAX_VIDEO_BYTES) throw new Error(m.tooBig);

  let loaded;
  try {
    loaded = await loadVideo(file);
  } catch {
    throw new Error(m.unreadable);
  }
  const { video, url } = loaded;

  try {
    const duration = video.duration;
    // Infinity/NaN arrive sur certains conteneurs mal formés : on ne bloque
    // pas là-dessus, la limite de taille du bucket sert de garde-fou.
    if (Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS) {
      throw new Error(m.tooLong(duration));
    }
    let poster;
    try {
      poster = await captureFrame(video);
    } catch {
      throw new Error(m.noFrame);
    }
    return { file, poster, duration: Number.isFinite(duration) ? duration : 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
