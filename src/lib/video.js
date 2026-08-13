// Validation et préparation d'un extrait vidéo de profil (un point de padel).
//
// Le navigateur ne sait pas ré-encoder une vidéo sans embarquer un
// transcodeur lourd (ffmpeg.wasm, ~30 Mo) : on ne CORRIGE donc pas les
// fichiers trop lourds ou trop longs, on les REFUSE avec un message clair.
// La compression est laissée à l'app photo du téléphone, qui la fait bien.

export const MAX_VIDEO_BYTES   = 50 * 1024 * 1024; // aligné sur le bucket (50 Mo)
export const MAX_VIDEO_SECONDS = 20;               // un point de padel, pas un match

// `profiles` ne stocke qu'UN chemin storage (video_storage_path) — pas de
// colonne séparée pour la vignette. Les deux fichiers sont écrits côte à côte
// sous le même "stamp" (voir buildVideoPaths), donc le chemin de la vignette
// se retrouve en dérivant celui de la vidéo plutôt qu'en ajoutant une colonne.
// Les DEUX sites d'écriture (SetupProfileScreen, ProfileEditScreen) doivent
// utiliser cette même fonction pour rester cohérents entre eux.
export function buildVideoPaths(userId, ext) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    videoPath:  `videos/${userId}/${stamp}.${ext}`,
    posterPath: `videos/${userId}/${stamp}-poster.jpg`,
  };
}

export function posterPathFromVideoPath(videoPath) {
  if (!videoPath) return null;
  return videoPath.replace(/\.[^./]+$/, '-poster.jpg');
}

const MSG = {
  fr: {
    tooBig:     'Vidéo trop lourde (max 50 Mo). Réduis la qualité ou raccourcis l’extrait.',
    tooLong:    (d) => `Vidéo trop longue (${Math.round(d)} s, max ${MAX_VIDEO_SECONDS} s). Garde juste un point.`,
    unreadable: 'Vidéo illisible par ce navigateur. Réessaie, ou essaie un fichier MP4.',
  },
  en: {
    tooBig:     'Video too large (max 50 MB). Lower the quality or trim the clip.',
    tooLong:    (d) => `Video too long (${Math.round(d)}s, max ${MAX_VIDEO_SECONDS}s). Keep a single point.`,
    unreadable: 'This browser can’t read that video. Try again, or use an MP4 file.',
  },
  he: {
    tooBig:     'הסרטון כבד מדי (מקסימום 50 מ״ב). הקטן את האיכות או קצר את הקטע.',
    tooLong:    (d) => `הסרטון ארוך מדי (${Math.round(d)} שניות, מקסימום ${MAX_VIDEO_SECONDS}). השאר נקודה אחת.`,
    unreadable: 'הדפדפן לא הצליח לקרוא את הסרטון. נסה שוב, או קובץ MP4.',
  },
};

// Beaucoup de moteurs mobiles (Safari iOS en tête) ne chargent les métadonnées
// d'un <video> de façon fiable QUE s'il est attaché au DOM — un élément créé
// via document.createElement() et jamais inséré peut rester bloqué
// indéfiniment sans jamais déclencher loadedmetadata ni error. C'était le bug
// réel derrière "Format vidéo non lisible" : le fichier était parfaitement
// lisible, l'élément qui devait le lire n'était juste jamais monté.
function attachHidden(el) {
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(el);
  return () => el.remove();
}

/** Charge la vidéo (attachée hors écran) et attend ses métadonnées (durée, dimensions). */
function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;          // iOS : sans ça, lecture plein écran forcée
    const detach = attachHidden(v);

    let settled = false;
    const finish = (ok, err) => {
      if (settled) return;
      settled = true;
      if (ok) resolve({ video: v, url, cleanup: detach });
      else { detach(); URL.revokeObjectURL(url); reject(err || new Error('UNREADABLE')); }
    };

    // Trois événements plutôt qu'un seul : selon le moteur, l'un peut ne
    // jamais se déclencher pour un fichier pourtant valide (observé avec le
    // .mov HEVC produit par défaut par l'appareil photo iPhone). Le premier
    // qui arrive suffit — `duration` est déjà disponible dès loadedmetadata.
    v.addEventListener('loadedmetadata', () => finish(true));
    v.addEventListener('loadeddata',     () => finish(true));
    v.addEventListener('canplay',        () => finish(true));
    v.addEventListener('error',          () => finish(false));
    // Filet de sécurité : si aucun des trois ne se déclenche (fichier
    // réellement corrompu, ou moteur qui n'émet même pas `error`), on ne
    // laisse pas l'utilisateur bloqué indéfiniment sur un bouton qui tourne.
    setTimeout(() => finish(false, new Error('TIMEOUT')), 8000);

    v.src = url;
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
  return new Promise((resolve) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 2;
    const target = Math.min(Math.max(duration / 4, 0), Math.max(duration - 0.1, 0));

    const draw = () => {
      let w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) { resolve(null); return; }
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else        { w = Math.round(w * (maxDim / h)); h = maxDim; }
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || null), 'image/jpeg', quality);
      } catch {
        resolve(null); // ex. SecurityError sur certains moteurs — jamais bloquant
      }
    };

    let done = false;
    const once = () => { if (!done) { done = true; draw(); } };
    video.addEventListener('seeked', once, { once: true });
    // Filet : si `seeked` ne se déclenche jamais (encore le .mov HEVC), on
    // dessine quand même l'état courant plutôt que d'attendre pour rien —
    // au pire l'image n'est pas exactement à `target`, au mieux ça marche.
    setTimeout(once, 1200);
    try { video.currentTime = target; } catch { once(); }
  });
}

/** Vignette de repli : fond vert + triangle de lecture, mêmes teintes que
 * l'app (dupliquées ici plutôt qu'importées de CourtUI — ce module ne dépend
 * d'aucun contexte React). Utilisée uniquement quand une vidéo par ailleurs
 * valide (taille/durée OK) n'a livré aucune image exploitable : mieux vaut
 * une vignette générique que bloquer l'envoi pour de bon. */
function placeholderPoster(width = 320, height = 180) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1F5C3F';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.16;
  ctx.fillStyle = 'rgba(245,241,232,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy - r);
  ctx.lineTo(cx - r * 0.6, cy + r);
  ctx.lineTo(cx + r, cy);
  ctx.closePath();
  ctx.fill();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
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
  const { video, url, cleanup } = loaded;

  try {
    const duration = video.duration;
    // Infinity/NaN arrive sur certains conteneurs mal formés : on ne bloque
    // pas là-dessus, la limite de taille du bucket sert de garde-fou.
    if (Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS) {
      throw new Error(m.tooLong(duration));
    }
    // L'extraction d'image peut échouer même sur une vidéo par ailleurs
    // valide (durée/taille correctes) — vignette de repli plutôt que blocage :
    // l'objectif est que l'envoi aboutisse, pas d'avoir la vignette parfaite.
    const poster = (await captureFrame(video)) || (await placeholderPoster());
    return { file, poster, duration: Number.isFinite(duration) ? duration : 0 };
  } finally {
    cleanup();
    URL.revokeObjectURL(url);
  }
}
