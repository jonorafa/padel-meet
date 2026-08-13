import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Visualiseur plein écran pour l'extrait vidéo d'un joueur. Même contrat que
// PhotoLightbox : le parent monte TOUJOURS <VideoLightbox src={...} />, jamais
// derrière un `&&`, car c'est AnimatePresence qui gère l'ouverture/fermeture
// (sinon l'animation de sortie ne peut pas jouer).
//
// `poster` s'affiche instantanément pendant que la vidéo se charge — et reste
// visible si le navigateur ne sait pas décoder le fichier.
export function VideoLightbox({ src, poster, onClose }) {
  const videoRef = useRef(null);
  // true quand on a dû couper le son pour que la lecture démarre : on propose
  // alors un bouton pour le réactiver (là, c'est un geste utilisateur, donc
  // toujours autorisé).
  const [sonCoupe, setSonCoupe] = useState(false);

  // Une seule tentative de démarrage par vidéo ouverte : sans ce garde,
  // l'événement `canplay` (qui peut se répéter) relancerait la lecture alors
  // que l'utilisateur vient peut-être de mettre en pause lui-même.
  const dejaTente = useRef(false);

  // Nouvelle vidéo ouverte → on réautorise une tentative de démarrage.
  useEffect(() => { dejaTente.current = false; }, [src]);

  // iOS (et Chrome mobile) REFUSENT la lecture automatique d'une vidéo avec
  // son : `autoplay` seul laissait la vidéo figée sur sa première image, avec
  // l'icône de lecture du système par-dessus — d'où l'impression que « la
  // vidéo n'est pas cliquable ». On tente donc AVEC le son (cas idéal, un
  // point de padel s'entend), et on ne se rabat sur le mode muet que si le
  // navigateur a refusé : mieux vaut une vidéo qui démarre sans son qu'une
  // vidéo qui ne démarre pas du tout.
  //
  // Déclenché sur `canplay`, jamais au montage : appelée pendant que la vidéo
  // se charge encore (readyState 0), la seconde tentative — celle en mode
  // muet — se faisait rejeter en AbortError, et la vidéo restait figée alors
  // même que le repli avait bien été appliqué (vérifié en simulant la
  // politique iOS : le son se coupait, mais la lecture ne partait pas).
  const tenterLecture = async () => {
    const el = videoRef.current;
    if (!el || dejaTente.current) return;
    dejaTente.current = true;
    setSonCoupe(false);   // repart d'un état propre à chaque vidéo ouverte
    try {
      el.muted = false;
      await el.play();
    } catch {
      const el2 = videoRef.current;
      if (!el2) return;
      el2.muted = true;
      setSonCoupe(true);
      // Si même le mode muet échoue (réglages système, économie d'énergie),
      // les contrôles natifs restent visibles : l'utilisateur garde la main.
      try { await el2.play(); } catch { /* non bloquant */ }
    }
  };

  const activerLeSon = (e) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setSonCoupe(false);
    el.play().catch(() => {});
  };

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          key="video-lightbox-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.video
            ref={videoRef}
            src={src}
            poster={poster || undefined}
            controls
            playsInline          /* iOS : lit en place au lieu d'ouvrir le lecteur système */
            loop
            preload="auto"       /* la vidéo est ouverte pour être vue : on la charge vraiment */
            onCanPlay={tenterLecture}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '85vh', borderRadius: 8, background: '#000' }}
          />

          {sonCoupe && (
            <button
              onClick={activerLeSon}
              style={{
                position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 22,
                background: 'rgba(255,255,255,0.16)', border: '0.5px solid rgba(255,255,255,0.3)',
                color: '#fff', fontFamily: 'Mulish', fontSize: 14, cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
              Activer le son
            </button>
          )}

          <button onClick={onClose} aria-label="Fermer" style={{
            position: 'absolute', top: 20, right: 20,
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', fontSize: 20, cursor: 'pointer',
          }}>×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
