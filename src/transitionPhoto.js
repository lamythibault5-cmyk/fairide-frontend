/* PASSER D'UN ÉCRAN À L'AUTRE DANS L'APP (fondateur, 2026-10-23, réponses à maquettes/transitions-appli/transitions-appli.html ;
 * app native seulement, lancé par demarrerNatif dans natif.js ; iPhone et Android).
 *
 * Ce qui se passe :
 *   1. AVANCER : le nouvel écran arrive de la droite, l'ancien recule de 30 % et s'assombrit (350 ms) ; RECULER : l'inverse.
 *      Tout passe par l'historique du routeur (envelopperNavigations, i18n/historiqueLangue.js) : un lien, un navigate(), le
 *      bouton Retour d'Android. Seule une navigation qui suit un vrai toucher glisse (moins de 400 ms) : une redirection, un
 *      changement d'adresse sur le même écran, une page ouverte en feuille (state.fond) ou un onglet (DashboardSidebar,
 *      `replace`) passent sans transition. Le geste de retour d'iOS (bord gauche, FairideViewController.swift) fait sa propre
 *      animation : il ne passe pas par ici (le retour par glissement en JavaScript a été retiré, PR #217).
 *   2. LA PHOTO VOYAGE (version « partout ») : une carte qui mène à la fiche d'un commerce (liste, Recherche, Favoris, Carte)
 *      donne sa photo à la fiche, qui grandit jusqu'en haut au lieu de glisser ; un plat touché donne sa photo à sa feuille
 *      (ouvrirAvecPhoto, RestaurantMenu.jsx). Le reste de l'écran se fond.
 *   3. LA CROIX ET ‹ RECULENT : quand l'écran d'avant est celui où ils mènent (une fiche pour ‹ du panier, n'importe quel
 *      écran pour la croix d'une fiche), on revient dessus au lieu de l'ouvrir une seconde fois : la liste revient là où on
 *      l'a laissée (ScrollRestorer, retour POP) et la photo rentre dans sa carte. Sans écran d'avant (lien partagé), la croix
 *      et ‹ font ce qu'ils faisaient.
 *   4. LE BOUT DE LA PAGE REBONDIT EN BAS SEULEMENT : `pres-du-bas` sur <html> dès qu'on a passé la moitié de la page
 *      (styles.css › « Le bout de la page ») ; en haut, le rebond se battrait avec « tirer pour actualiser ».
 *
 * Comment : l'API View Transitions (iPhone iOS 18+, Android avec une WebView récente). Sans elle, ou si le téléphone demande
 * moins de mouvement, l'écran change d'un coup, comme avant ; les points 3 et 4 marchent quand même.
 *
 * HISTORIQUE DE CE FICHIER (la photo seule, 2026-10-19 à 10-23) :
 *   - on attendait jusqu'à 450 ms que la carte ou la fiche existe : 150 ms maintenant, la liste et la fiche déjà lues
 *     s'affichent dès la première image (cacheDonnees.js) ;
 *   - l'arrondi de la photo venait de son parent, que la capture ne voit pas : la photo voyageait en rectangle. Le cadre de la
 *     transition passe maintenant de l'arrondi de départ à celui d'arrivée (--photo-rayon-depart / --photo-rayon-arrivee) ;
 *   - la carte d'arrivée, en chargement paresseux, refaisait son fondu : chargée tout de suite et décodée avant la capture ;
 *   - MINUTEUR, PAS requestAnimationFrame (app iPhone, 4 à 10 s pour ouvrir une fiche) : pendant la mise à jour d'une View
 *     Transition le navigateur suspend le rendu, rAF ne se déclenchait plus. Mesuré : 4 150 ms avant, 420 ms après. */
import { flushSync } from 'react-dom';
import { mouvementReduit } from './gestes';
import { envelopperNavigations, cheminPrecedent } from './i18n/historiqueLangue';
import { cheminSansPrefixe } from './i18n/routing';

const NOM = 'photo-commerce';
const NOM_PLAT = 'photo-plat';
const FICHE = /^(?:\/(?:nl|en))?\/restaurants\/([^/]+)$/;
const TOUCHER_RECENT_MS = 400;

let enVol = null; // { id, src, at } : la photo de la carte touchée, pour le squelette et la couverture de la fiche

export function photoEnVol(id) {
  return enVol && String(enVol.id) === String(id) ? enVol.src : null;
}

// La fiche s'ouvre-t-elle par la photo qui grandit ? Alors elle ne rejoue pas sa propre entrée (RestaurantMenu.jsx). Dix
// secondes : au-delà, la fiche attendait ses données derrière son squelette, et c'est un nouvel affichage.
export function entreeParPhoto(id) {
  return !!enVol && String(enVol.id) === String(id) && performance.now() - enVol.at < 10000;
}

const disponible = () => typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
const html = () => document.documentElement;

// L'arrondi de la photo dans sa carte : celui du premier parent arrondi qui la coupe (la carte), en haut seulement quand le
// texte de la carte est dessous, aux quatre coins quand la photo remplit la carte. La fiche : bord à bord, carrée.
function rayonDe(img) {
  let el = img;
  for (let i = 0; el && i < 5; i += 1, el = el.parentElement) {
    const cs = getComputedStyle(el);
    const r = cs.borderTopLeftRadius;
    if (r && r !== '0px' && (el === img || cs.overflow !== 'visible')) {
      const enBas = Math.abs(el.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom) < 3;
      return enBas ? r : `${r} ${r} 0px 0px`;
    }
    if (el.matches?.('a[href]')) break;
  }
  return '0px';
}
function poserRayons(depart, arrivee) {
  const s = html().style;
  s.setProperty('--photo-rayon-depart', depart);
  s.setProperty('--photo-rayon-arrivee', arrivee);
}

// Attend qu'un élément apparaisse (au plus `ms`). MINUTEUR, PAS requestAnimationFrame : voir l'historique plus haut.
function attendre(trouver, ms = 150) {
  return new Promise((resolve) => {
    const debut = performance.now();
    const tour = () => {
      const el = trouver();
      if (el || performance.now() - debut > ms) resolve(el || null);
      else setTimeout(tour, 16);
    };
    tour();
  });
}

const nommer = (el, nom = NOM) => { if (el) el.style.viewTransitionName = nom; };
const denommer = (el) => { if (el) el.style.viewTransitionName = ''; };
const photoChargee = (img) => !!img && img.complete && img.naturalWidth > 0 && img.getClientRects().length > 0;
const idFiche = (chemin) => { const m = String(chemin || '').match(FICHE); return m ? decodeURIComponent(m[1]) : null; };

let dernierToucher = -Infinity;
let enCours = null;      // la transition qui joue : une seule à la fois
let photoAller = null;   // { img, id } : la carte touchée qui mène à une fiche
let photoRetour = null;  // { id } : la fiche qu'on quitte, dont la couverture rentre dans sa carte

/* Une transition d'écran. `sens` : 'avance' | 'recule'. `faire` : la navigation elle-même. */
function lancer(sens, faire) {
  const racine = html();
  const page = document.querySelector('.page-fade');
  const aller = sens === 'avance' ? photoAller : null;
  const retour = sens === 'recule' ? photoRetour : null;
  photoAller = null; photoRetour = null;
  let depart = null;
  if (aller && photoChargee(aller.img)) {
    depart = aller.img;
    enVol = { id: aller.id, src: depart.currentSrc || depart.src, at: performance.now() };
    poserRayons(rayonDe(depart), '0px');
  } else if (retour) {
    const couverture = document.querySelector('img.fiche-couverture');
    if (photoChargee(couverture)) { depart = couverture; poserRayons('0px', '0px'); }
  }
  const genre = depart ? 'vt-photo' : sens === 'avance' ? 'vt-avance' : 'vt-recule';
  racine.classList.add(genre);
  nommer(depart);
  let arrivee = null;
  const t = document.startViewTransition(async () => {
    denommer(depart);
    faire();
    // L'écran suivant : un nouveau conteneur de page (Layout.jsx, la clé change avec l'adresse). Un retour passe par
    // popstate, un peu plus tard qu'un aller.
    await attendre(() => { const p = document.querySelector('.page-fade'); return p && p !== page ? p : null; }, sens === 'recule' ? 250 : 180);
    if (!depart) return;
    if (aller) {
      // La photo d'arrivée : celle du squelette, ou la couverture déjà affichée si les données étaient en cache.
      arrivee = await attendre(() => document.querySelector('.sq-photo-img, img.fiche-couverture'));
    } else {
      // Le retour : la photo de la carte de ce commerce, dans l'écran retrouvé (liste, Recherche, Favoris, Carte).
      arrivee = await attendre(() => [...document.querySelectorAll('a[href] img')]
        .find((img) => idFiche(new URL(img.closest('a').href).pathname) === retour.id));
      if (arrivee) {
        // Souvent en chargement paresseux : chargée tout de suite et décodée (au plus 100 ms), sinon la capture serait vide.
        arrivee.loading = 'eager';
        arrivee.classList.add('rc-photo--vue');
        await Promise.race([arrivee.decode().catch(() => {}), new Promise((r) => { setTimeout(r, 100); })]);
        poserRayons('0px', rayonDe(arrivee));
      }
    }
    nommer(arrivee);
  });
  enCours = t;
  t.finished.finally(() => {
    racine.classList.remove(genre);
    denommer(arrivee);
    document.querySelectorAll('.sq-photo-img, img.fiche-couverture').forEach(denommer);
    if (enCours === t) enCours = null;
  });
}

/* LE PLAT TOUCHÉ DONNE SA PHOTO À SA FEUILLE (RestaurantMenu.jsx, addToCart). `ouvrir` monte la feuille (un setState) : il
 * est joué dans la transition, la feuille arrive en fondu pendant que la photo grandit jusqu'à sa place. */
let dernierPlat = null; // la photo du dernier plat touché, notée au clic (installerTransitionsEcrans)
export function ouvrirAvecPhoto(ouvrir) {
  const img = dernierPlat; dernierPlat = null;
  if (!disponible() || enCours || mouvementReduit() || !photoChargee(img)) { ouvrir(); return; }
  const racine = html();
  racine.classList.add('vt-feuille');
  poserRayons(rayonDe(img), '0px');
  nommer(img, NOM_PLAT);
  let arrivee = null;
  const t = document.startViewTransition(async () => {
    denommer(img);
    flushSync(ouvrir);
    arrivee = await attendre(() => document.querySelector('.plat-feuille .plat-photo img'));
    if (arrivee) poserRayons(rayonDe(img), getComputedStyle(arrivee).borderTopLeftRadius || '0px');
    nommer(arrivee, NOM_PLAT);
  });
  enCours = t;
  t.finished.finally(() => { racine.classList.remove('vt-feuille'); denommer(arrivee); if (enCours === t) enCours = null; });
}

/* LE BOUT DE LA PAGE (point 4) : le rebond n'est permis qu'une fois passée la moitié de la page. Une classe posée au
 * franchissement seulement, au plus une fois par image. */
function installerBasDePage() {
  let image = 0;
  let pres = null;
  const regarder = () => {
    image = 0;
    const se = document.scrollingElement || document.documentElement;
    const reste = se.scrollHeight - window.innerHeight;
    const p = reste > 40 && window.scrollY > reste / 2;
    if (p === pres) return;
    pres = p;
    html().classList.toggle('pres-du-bas', p);
  };
  const demander = () => { if (!image) image = requestAnimationFrame(regarder); };
  window.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  window.addEventListener('popstate', demander);
  regarder();
}

export function installerTransitionsEcrans(historique) {
  const vt = disponible();
  installerBasDePage();

  // Un vrai toucher (et la cible de ce qu'il ouvre) : noté AVANT que le lien ou le bouton agisse, en capture.
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey) return;
    dernierToucher = performance.now();
    const cible = e.target;
    // Un plat de la carte : sa photo, pour sa feuille (ouvrirAvecPhoto).
    const plat = cible.closest?.('.plat-cliquable');
    dernierPlat = plat ? plat.querySelector('img.plat-photo') : null;

    const lien = cible.closest?.('a[href]');
    if (!lien || e.defaultPrevented) return;
    const url = new URL(lien.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const ici = historique.location.pathname;

    // 3. La croix d'une fiche ou ‹ d'un écran du paiement : reculer si l'écran d'avant est celui-là.
    const croix = lien.closest('.flux-entete');
    const fleche = lien.matches('.ec-haut .ec-rond');
    if (croix || fleche) {
      const avant = cheminPrecedent();
      const memeEcran = avant && (avant === cheminSansPrefixe(url.pathname) || (!!idFiche(avant) && !!idFiche(url.pathname)));
      if (avant && (croix || memeEcran)) {
        e.preventDefault();
        if (idFiche(ici)) photoRetour = { id: idFiche(ici) };
        historique.back({ geste: true });
        return;
      }
    }

    // 2. Une carte qui mène à la fiche d'un commerce, depuis un écran qui n'est pas une fiche : sa photo voyage.
    const versFiche = idFiche(url.pathname);
    if (vt && versFiche && !idFiche(ici)) {
      const img = lien.querySelector('img');
      photoAller = photoChargee(img) ? { img, id: versFiche } : null;
      // Si aucune navigation ne suit (lien vers la connexion, aperçu…), l'intention s'efface.
      setTimeout(() => { photoAller = null; }, TOUCHER_RECENT_MS);
    }
  }, true);

  if (!vt) return;
  html().classList.add('vt');
  envelopperNavigations((sens, faire, cible, { geste = false } = {}) => {
    const touche = geste || performance.now() - dernierToucher < TOUCHER_RECENT_MS;
    const memeEcran = cible && cible.pathname === historique.location.pathname;
    const feuille = !!cible?.state?.fond;
    if (!touche || memeEcran || feuille || enCours || mouvementReduit() || document.visibilityState !== 'visible') { faire(); return; }
    lancer(sens, faire);
  });
}
