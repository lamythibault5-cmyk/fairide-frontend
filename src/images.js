// Images servies par Cloudinary : on demande au CDN la bonne taille et le bon format plutôt que de livrer
// l'original (souvent 2 000 px et 800 ko) dans une vignette de 56 px. `f_auto` choisit AVIF/WebP selon le
// navigateur, `q_auto` règle la compression, `w_` la largeur, `c_limit` ne dépasse jamais l'original.
// Les autres hébergeurs (Unsplash, photos de démonstration) : Unsplash accepte `w=` ; le reste est rendu tel quel.
const CLOUDINARY = /\/image\/upload\/(?!.*(f_auto|w_\d))/;

export function imageUrl(url, largeur) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('res.cloudinary.com') && CLOUDINARY.test(url)) {
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${largeur}/`);
  }
  if (url.includes('images.unsplash.com')) {
    try { const u = new URL(url); u.searchParams.set('w', String(largeur)); u.searchParams.set('q', '75'); u.searchParams.set('auto', 'format'); return u.toString(); } catch { return url; }
  }
  return url;
}

// srcset pour une image affichée à `largeurAffichee` px : 1×, 2× et une variante intermédiaire.
export function imageSrcSet(url, largeurAffichee) {
  if (!url || typeof url !== 'string' || !(url.includes('res.cloudinary.com') || url.includes('images.unsplash.com'))) return undefined;
  const largeurs = [...new Set([largeurAffichee, Math.round(largeurAffichee * 1.5), largeurAffichee * 2])];
  return largeurs.map((w) => `${imageUrl(url, w)} ${w}w`).join(', ');
}

// Attributs prêts à étaler sur <img> : src optimisé, srcset, sizes.
export function imgProps(url, largeurAffichee, sizes) {
  return { src: imageUrl(url, largeurAffichee * 2), srcSet: imageSrcSet(url, largeurAffichee), sizes: sizes || `${largeurAffichee}px` };
}
