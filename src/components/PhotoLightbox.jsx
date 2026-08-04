import { motion, AnimatePresence } from 'motion/react';

// Visualiseur plein écran pour une photo cliquée. Le parent doit toujours
// monter <PhotoLightbox src={...} onClose={...} /> (jamais dans un `&&` du
// parent) : c'est AnimatePresence qui gère l'ouverture/fermeture en interne,
// ce qui permet l'animation de sortie quand `src` repasse à null.
export function PhotoLightbox({ src, onClose }) {
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          key="lightbox-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.img
            src={src} alt=""
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
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
