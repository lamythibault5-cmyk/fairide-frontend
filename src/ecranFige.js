/* L'ÉCRAN D'AVANT, FIGÉ, POUR LE VOIR DERRIÈRE LA FICHE QU'ON TIRE (fondateur, 2026-10-27, version A de
 * maquettes/fiche-tirer/fiche-tirer.html ; app seulement). Utilisé par TirerFicheVersCarte.jsx.
 *
 * Pourquoi une copie et pas l'écran lui-même. La fiche d'un commerce REMPLACE la liste (c'est sa propre adresse) et vit
 * dans le défilement de la fenêtre : bande des sections, ronds collants, restauration du défilement. L'ouvrir en feuille
 * par-dessus une liste gardée vivante (comme les pages de feuilles.js) lui donnerait son propre défilement et casserait
 * tout cela. Au moment où l'on touche la carte (transitionPhoto.js, en capture, avant que la navigation parte), on copie
 * donc l'écran tel qu'il est : #root entier, la barre d'onglets et les bandes fixes comprises, avec sa position de
 * défilement. Derrière la fiche qu'on tire, c'est cette image qu'on voit ; au lâcher, la fiche rentre dans la carte de la
 * copie, puis on recule pour de vrai, sous la copie, qui s'efface quand la vraie liste est revenue à la même place.
 *
 * Ce que la copie ne doit pas emporter : les `id` (getElementById trouverait le double), les `name` (une radio cochée de
 * la copie décocherait la vraie, même groupe), les noms de transition de vue (deux fois le même nom annule la transition).
 * Les éléments collants (`sticky`) ne collent plus dans une copie qui ne défile pas : on mesure où ils collent dans
 * l'original et on les y remet en `relative`. Les `fixed` restent où ils sont : le calque qui porte la copie a un
 * `transform`, il devient leur repère, et il a la taille de l'écran. */

let fige = null; // { noeud, carte, chemin, defilement, fond, a }

// `lien` : la carte touchée (un <a> vers la fiche). `chemin` : l'adresse de l'écran, sans préfixe de langue.
export function figerEcran(lien, chemin) {
  fige = null;
  const racine = document.getElementById('root');
  if (!racine || !racine.contains(lien)) return;
  const tous = racine.querySelectorAll('*');
  const collants = [];
  const defiles = []; // [rang, gauche, haut] : une copie ne garde pas où défilait une bande (« À découvrir », cuisines)
  tous.forEach((el, i) => {
    if (getComputedStyle(el).position === 'sticky') collants.push(el);
    if (el.scrollLeft || el.scrollTop) defiles.push([i, el.scrollLeft, el.scrollTop]);
  });
  // Où ils collent, puis où ils seraient sans coller : deux mesures, aucune image dessinée entre les deux.
  const colles = collants.map((el) => el.getBoundingClientRect());
  const avant = collants.map((el) => el.style.position);
  collants.forEach((el) => { el.style.position = 'static'; });
  const libres = collants.map((el) => el.getBoundingClientRect());
  collants.forEach((el, i) => { el.style.position = avant[i]; });

  const noeud = racine.cloneNode(true);
  const copies = noeud.querySelectorAll('*');
  const rang = (el) => Array.prototype.indexOf.call(tous, el);
  collants.forEach((el, i) => {
    const c = copies[rang(el)];
    if (!c) return;
    c.style.position = 'relative';
    c.style.top = `${colles[i].top - libres[i].top}px`;
    c.style.left = `${colles[i].left - libres[i].left}px`;
  });
  noeud.removeAttribute('id');
  for (const c of copies) {
    if (c.id) c.removeAttribute('id');
    if (c.hasAttribute('name')) c.removeAttribute('name');
    if (c.style.viewTransitionName) c.style.viewTransitionName = '';
  }
  fige = {
    noeud, carte: copies[rang(lien)] || null, chemin, defilement: window.scrollY,
    defiles: defiles.map(([i, gauche, haut]) => [copies[i], gauche, haut]).filter(([c]) => c),
    fond: getComputedStyle(document.body).backgroundColor, a: performance.now()
  };
}

// Une fois la copie dans la page (un défilement ne s'applique qu'à un élément affiché) : les bandes reprennent leur place.
export function replacerDefilements(f) {
  for (const [c, gauche, haut] of f.defiles) { c.scrollLeft = gauche; c.scrollTop = haut; }
}

// La fiche qui s'ouvre prend la copie. Prise pour la première fois plus de 3 s après le toucher, ce n'est pas celle de
// cette ouverture (la fiche attendait ses données, ou s'est ouverte autrement).
export function prendreEcranFige() {
  const f = fige; fige = null;
  if (!f || !f.carte || (!f.prise && performance.now() - f.a > 3000)) return null;
  f.prise = true;
  return f;
}

// La fiche se démonte : la copie est rendue, puis jetée au tour suivant — sauf si la même fiche la reprend aussitôt
// (React, en développement, monte deux fois chaque composant).
export function rendreEcranFige(f) {
  fige = f;
  setTimeout(() => { if (fige === f) fige = null; }, 0);
}
