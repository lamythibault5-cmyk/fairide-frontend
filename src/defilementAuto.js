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
// `cible` : une position, ou une fonction qui la calcule à chaque reprise (le repère ci-dessous) et renvoie null tant que la
// page ne l'a pas encore — on attend alors en haut, jamais à la hauteur laissée par l'écran d'avant.
// `auBout` est appelé une fois, quelle que soit la fin. Renvoie de quoi tout annuler (nettoyage d'un effet React).
// 10 s : certains écrans attendent deux réponses l'une après l'autre (Mon compte du commerce : sa fiche, puis le commerce) ;
// sur un réseau lent, 5 s ne suffisaient pas.
export function rejoindre(cible, { delais = [0, 100, 300, 600, 1000, 1500], patience = 10000, auBout } = {}) {
  if (typeof window === 'undefined') return () => {};
  let fini = false;
  let minuteurs = [];
  let limite = 0;
  let observateur = null;
  const aller = () => {
    if (fini) return;
    const y = typeof cible === 'function' ? cible() : cible;
    if (y === null) { if (window.scrollY !== 0) enHaut(); return; }
    window.scrollTo(0, y);
  };
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

/* LE REPÈRE : CE QU'ON AVAIT SOUS LES YEUX, PAS UN NOMBRE DE PIXELS (fondateur, 2026-10-27 : chaque onglet retrouve sa
 * place, mais « je ne dois jamais arriver au milieu d'un texte » — design.md, règle 5). Une position en pixels ne dit pas CE
 * qu'il y avait à l'écran : une étape signée entre-temps, une rubrique repliée, une liste plus courte, et la même hauteur
 * tombe au milieu d'autre chose. On garde donc le titre (ou la rangée de Mon compte) le plus bas du premier tiers de
 * l'écran, son texte et sa hauteur sous le haut de l'écran ; au retour, ce même titre revient à la même hauteur. S'il
 * n'existe plus, l'onglet s'ouvre en haut. Les titres d'une barre collée en haut (bandeau, en-tête) ne comptent pas : ils
 * sont toujours au même endroit, ils ne disent rien de l'endroit où l'on était. */
const REPERES = 'h1, h2, h3, h4, .account-link-row, [data-repere]';
// Une rangée de Mon compte par son titre seul : sa ligne du dessous change (non-lus, adresse, solde) sans que la rangée change.
const texteRepere = (el) => ((el.matches('.account-link-row') && el.querySelector('b')) || el).textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
function dansUneBarreCollee(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === 'sticky' || p === 'fixed') return true;
  }
  return false;
}

// Appelé au fil du défilement (au plus toutes les 150 ms, ScrollRestorer.jsx) : seul le repère retenu passe le contrôle de
// barre collée, pas chacun des titres de la page.
export function noterRepere() {
  const limite = window.innerHeight / 3;
  const candidats = [...document.querySelectorAll(REPERES)]
    .map((el) => ({ el, haut: el.getBoundingClientRect().top }))
    .filter(({ el, haut }) => haut <= limite && el.offsetParent !== null && texteRepere(el))
    .sort((a, b) => b.haut - a.haut);
  const choisi = candidats.find(({ el }) => !dansUneBarreCollee(el));
  if (!choisi) return null;
  const texte = texteRepere(choisi.el);
  // Deux rangées au même texte (« Modifier », « Voir ») : le rang parmi elles les départage.
  const rang = [...document.querySelectorAll(REPERES)].filter((el) => texteRepere(el) === texte).indexOf(choisi.el);
  return { texte, rang, decalage: Math.round(choisi.haut) };
}

// La position où remettre le repère, ou null s'il n'est pas (encore) dans la page.
export function positionDuRepere({ texte, rang, decalage }) {
  const memes = [...document.querySelectorAll(REPERES)].filter((el) => el.offsetParent !== null && texteRepere(el) === texte);
  const el = memes[rang] || memes[0];
  if (!el) return null;
  return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - decalage));
}
