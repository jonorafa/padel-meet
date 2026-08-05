// Compresse une image via canvas (max ~1200px côté long, qualité 0.82).
// Utilisé par tous les points d'upload de photo de profil (avatar unique).
export async function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else                 { width  = Math.round(width  * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression échouée')),
        'image/jpeg', quality
      );
    };
    img.onerror = () => reject(new Error('Image invalide'));
    reader.readAsDataURL(file);
  });
}
