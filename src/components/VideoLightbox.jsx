import { motion, AnimatePresence } from 'motion/react';

// Visualiseur plein écran pour l'extrait vidéo d'un joueur. Même contrat que
// PhotoLightbox : le parent monte TOUJOURS <VideoLightbox src={...} />, jamais
// derrière un `&&`, car c'est AnimatePresence qui gère l'ouverture/fermeture
// (sinon l'animation de sortie ne peut pas jouer).
//
// `poster` s'affiche instantanément pendant que la vidéo se charge — et reste
// visible si le navigateur ne sait pas décoder le fichier (cas des .mov HEVC
// filmés par iPhone, que Chrome ne lit pas).
export function VideoLightbox({ src, poster, onClose }) {
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
            src={src}
            poster={poster || undefined}
            controls
            autoPlay
            loop
            playsInline          /* iOS : lit en place au lieu d'ouvrir le lecteur système */
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '85vh', borderRadius: 8, background: '#000' }}
          />
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
