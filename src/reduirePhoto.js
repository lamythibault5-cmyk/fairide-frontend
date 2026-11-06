/* RÉDUIRE UNE PHOTO AVANT L'ENVOI (G122, 2026-11-06). Une photo de téléphone pèse souvent 3 à 8 Mo : longue à envoyer sur le
 * réseau mobile d'un livreur, et trop lourde pour le relais fairride.be/api (Vercel refuse plus de 4,5 Mo, voir API_DIRECT
 * dans api.js), qui est le seul chemin quand un réseau bloque Railway. Redessinée en JPEG, 1600 px au plus grand côté, elle
 * tient en quelques centaines de Ko et reste nette (un sac devant une porte). Au moindre souci (format que le navigateur ne
 * sait pas lire, vieux téléphone), la photo d'origine part telle quelle : la réduction ne doit jamais empêcher l'envoi. */
export async function reduirePhoto(fichier, { coteMax = 1600, qualite = 0.8, seuil = 1024 * 1024 } = {}) {
  if (!fichier || fichier.size <= seuil || typeof document === 'undefined') return fichier;
  try {
    const image = await lireImage(fichier);
    const echelle = Math.min(1, coteMax / Math.max(image.width, image.height));
    const largeur = Math.max(1, Math.round(image.width * echelle));
    const hauteur = Math.max(1, Math.round(image.height * echelle));
    const toile = document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
    image.close?.();
    const blob = await new Promise((ok) => toile.toBlob(ok, 'image/jpeg', qualite));
    if (!blob || blob.size >= fichier.size) return fichier;
    const nom = String(fichier.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return typeof File === 'function' ? new File([blob], nom, { type: 'image/jpeg' }) : blob;
  } catch {
    return fichier;
  }
}

// createImageBitmap tourne la photo selon son EXIF (une photo prise en portrait reste en portrait) ; à défaut, une <img>,
// que les navigateurs récents tournent aussi.
async function lireImage(fichier) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(fichier, { imageOrientation: 'from-image' }); } catch { /* repli ci-dessous */ }
  }
  const url = URL.createObjectURL(fichier);
  try {
    return await new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = ko;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
