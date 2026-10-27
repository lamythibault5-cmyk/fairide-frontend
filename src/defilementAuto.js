// LE DÉFILEMENT AUTOMATIQUE NE REPREND JAMAIS LA MAIN AU CLIENT (fondateur, 2026-10-17 : « je reviens du panier, je
// descends, et ça me ramène en haut — comme le bug de Maestro ; est-ce qu'on peut le régler partout ? »).
//
// Trois endroits replacent la page tout seuls, PLUSIEURS FOIS de suite, parce qu'un seul scrollTo ne suffit pas pendant
// que la page se construit (squelettes, données, images, barre d'adresse de Safari qui change la hauteur) :
//   - ScrollRestorer.jsx : en haut à chaque nouvelle page, ou à la position quittée au retour arrière ;
//   - remonter.js : en haut quand l'étape d'un formulaire change sans changer d'adresse ;
//   - RestaurantMenu.jsx : la position d'avant un vrai rechargement (F5).
// Chacun avait sa propre façon de s'arrêter, et le retour arrière n'en avait AUCUNE : pendant 1,5 s, chaque reprise
// ramenait la page à l'ancienne position, par-dessus le doigt du client. C'était le saut « en revenant du panier ».
//
// Une seule règle maintenant, ici : on réapplique `action` aux délais donnés TANT QUE la personne n'a rien fait. Elle
// reprend la main dès qu'elle touche l'écran, fait défiler à la molette ou au trackpad, appuie sur une touche ou clique
// (barre de défilement comprise) — ou dès que la page a bougé d'elle-même entre deux reprises (élan d'un défilement au
// doigt, glissement de la barre) : on ne la replace plus. Renvoie de quoi tout annuler (nettoyage d'un effet React).
const GESTES = ['touchstart', 'touchmove', 'wheel', 'keydown', 'pointerdown'];
// Au-delà de cet écart entre la position laissée par la reprise précédente et la position actuelle, c'est la personne
// qui a bougé la page (une image qui se charge plus haut décale de bien moins, et l'ancrage du navigateur compense).
const ECART_GESTE = 40;

// `immediat` : une première fois tout de suite, avant l'affichage (appel depuis un useLayoutEffect).
export function repeterTantQueLibre(action, delais, { immediat = false } = {}) {
  if (typeof window === 'undefined') return () => {};
  let lache = false;
  let laisse = null;
  const lacher = () => { lache = true; };
  if (immediat) { action(); laisse = window.scrollY; }
  GESTES.forEach((g) => window.addEventListener(g, lacher, { passive: true, capture: true }));
  const minuteurs = delais.map((d) => setTimeout(() => {
    if (lache) return;
    if (laisse !== null && Math.abs(window.scrollY - laisse) > ECART_GESTE) { lache = true; return; }
    action();
    laisse = window.scrollY;
  }, d));
  const fin = setTimeout(() => GESTES.forEach((g) => window.removeEventListener(g, lacher, { capture: true })), Math.max(0, ...delais) + 50);
  return () => {
    minuteurs.forEach(clearTimeout);
    clearTimeout(fin);
    GESTES.forEach((g) => window.removeEventListener(g, lacher, { capture: true }));
  };
}

// REJOINDRE UNE POSITION QUE LA PAGE N'A PAS ENCORE (fondateur, 2026-10-27 : « je descends dans Mon compte, je passe sur
// l'accueil, je reviens à Mon compte… et parfois je ne suis plus où j'étais »). repeterTantQueLibre s'arrêtait à 1,5 s :
// quand les données de la page arrivaient plus tard (téléphone, réseau lent), elle était encore trop courte, le navigateur
// rabotait la position et on restait plus haut. Son écart de 40 px prenait aussi pour un geste le saut qu'un squelette
// remplacé par le vrai contenu fait faire à la page. Ici, la cible est réappliquée à chaque changement de hauteur de la
// page, jusqu'au bout de `patience` — et rien dès le premier geste. Pas d'arrêt dès qu'elle est atteinte : atteinte sur une
// page à moitié chargée, la suite arrivait AU-DESSUS, le navigateur gardait sous les yeux ce qui l'était, et Mon compte
// du commerce finissait 700 px plus bas que l'endroit quitté (essai réseau lent, 2026-10-27).
// `auBout` est appelé une fois, quelle que soit la fin. Renvoie de quoi tout annuler (nettoyage d'un effet React).
// 10 s : certains écrans attendent deux réponses l'une après l'autre (Mon compte du commerce : sa fiche, puis le commerce) ;
// sur un réseau lent, 5 s ne suffisaient pas.
export function rejoindre(cible, { delais = [0, 100, 300, 600, 1000, 1500], patience = 10000, auBout } = {}) {
  if (typeof window === 'undefined') return () => {};
  let fini = false;
  let minuteurs = [];
  let limite = 0;
  let observateur = null;
  const aller = () => { if (!fini) window.scrollTo(0, cible); };
  const finir = () => {
    if (fini) return;
    fini = true;
    minuteurs.forEach(clearTimeout);
    clearTimeout(limite);
    observateur?.disconnect();
    GESTES.forEach((g) => window.removeEventListener(g, finir, { capture: true }));
    auBout?.();
  };
  GESTES.forEach((g) => window.addEventListener(g, finir, { passive: true, capture: true }));
  aller();
  if (typeof ResizeObserver !== 'undefined') {
    observateur = new ResizeObserver(aller);
    observateur.observe(document.body);
  }
  minuteurs = delais.map((d) => setTimeout(aller, d));
  limite = setTimeout(finir, patience);
  return finir;
}

export function enHaut() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
