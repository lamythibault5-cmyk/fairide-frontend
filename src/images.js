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

/* PHOTOS DÉJÀ VUES PENDANT CETTE VISITE (2026-10-20, test de l'app Android). Les photos des cartes apparaissent en fondu
   (photo-apparait, styles.css) pour ne pas surgir d'un bloc gris au premier chargement. Mais au RETOUR sur la liste, la
   même photo, déjà dans le cache du navigateur, refaisait son fondu depuis le transparent : la carte vers laquelle la
   photo de la fiche revient (transitionPhoto.js) était vide le temps du fondu. Une photo déjà affichée une fois ne fond
   plus. Mémoire de la page seulement (un Set), rien d'écrit. */
const photosVues = new Set();
export function photoVue(url) { return !!url && photosVues.has(url); }
export function retenirPhotoVue(url) { if (url) photosVues.add(url); }

/* LE FONDU D'UNE PHOTO PART QUAND ELLE ARRIVE (2026-10-23, voir « Fondu d'apparition des photos » dans styles.css). Un seul
   écouteur pour toute la page (l'événement `load` d'une image ne remonte pas, il se capte) : une photo de carte, de plat ou
   de fiche qui finit de charger reçoit `photo-arrivee`, qui joue le fondu une fois. Une photo paresseuse loin sous l'écran
   ne charge (et ne fond) qu'en approchant : les fondus s'étalent au lieu de partir tous ensemble. Une photo de carte déjà
   vue pendant la visite (rc-photo--vue) n'a toujours pas de fondu. Appelé une fois par main.jsx. */
const PHOTOS_EN_FONDU = 'img.rc-photo, .plat-photo img, img.dish-thumb-lg, .plat-visuel img.plat-photo';
export function installerFonduPhotos() {
  if (typeof document === 'undefined') return;
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img?.tagName === 'IMG' && img.matches(PHOTOS_EN_FONDU)) img.classList.add('photo-arrivee');
  }, true);
}

// Image qui ne charge pas (photo retirée d'Unsplash, lien mort) : on retire la balise plutôt que de laisser l'icône
// cassée et le texte de remplacement au milieu de la carte — le fond (dégradé, couleur) reste, la fiche se lit.
export function cacherImageCassee(e) {
  const img = e.currentTarget; if (!img) return;
  img.removeAttribute('srcset'); img.style.display = 'none'; img.setAttribute('aria-hidden', 'true');
  img.closest('.card, .discover-tile, .hero-preview-card, .trust-card, .fiche-entete')?.classList.add('sans-image');
}
