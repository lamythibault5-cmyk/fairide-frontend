// LE VERRE QUI RÉPOND AU DOIGT (fondateur, 2026-10-24 : version B de maquettes/verre-appui/verre-appui.html, « iOS 26 »).
// Chargé avec import() par demarrerNatif (natif.js) : l'app seulement, le site n'en télécharge rien.
//
// Ce que fait le verre « interactif » d'Apple (iOS 26, glassEffect(.regular.interactive())), et ce que le CSS seul ne sait pas
// faire : dès que le doigt POSE (avant tout clic), le contrôle grossit ; une lumière se tient sous le doigt et le suit ; le verre
// se penche de quelques pixels vers lui ; au lâcher, un ressort le ramène avec un petit rebond. Un ressort plutôt qu'une
// transition : il repart de la taille affichée, et un nouvel appui le rattrape en plein vol (« Designing Fluid Interfaces »).
//
// Réglages de la version B :
//   - un BOUTON (retours, cœur, recherche, croix, « + », pastilles…) grossit de 50 % (fondateur, 2026-10-25 : « pas les barres,
//     mais plus que 12, peut-être 50 % » ; 8 % dans la maquette, puis 12 %). Une BARRE (onglets, bande des sections, panier, Livraison /
//     À emporter) garde son petit grossissement : 3,5 % à partir de 300 px, un peu plus si elle est plus courte ;
//   - se penche de 2 px (petit) à 3 px (barre) vers le doigt ;
//   - ressort à la pose : amortissement .85, réponse .2 s ; au lâcher : .55, .4 s (un rebond franc d'environ 1 %, posé en .45 s).
// Les cartes et les rangées ne sont pas du verre : elles gardent leur enfoncement (transitions-appli.css, réponse 4).
//
// `scale` et `translate` (propriétés à part, pas `transform`) : elles s'ajoutent aux transformations propres à chaque contrôle
// (le panier centré par translateX(-50 %), la barre qui « pousse » à un changement d'onglet) au lieu de les remplacer.

/* Les contrôles en verre de l'app. Un appui sur un élément à l'intérieur fait réagir tout le contrôle (toute la barre d'onglets,
   toute la bande des sections d'une fiche : réponse 3 du questionnaire). La bande des cuisines n'en est plus (2026-10-25,
   maquettes/barre-cuisines : plus de cadre, comme Uber Eats) : seule sa lentille est du verre, et lentillePuces.js la fait grossir. */
const VERRE = [
  '.dashboard-nav', '.category-quicknav--verre', '.panier-pilule',
  // Tous les ronds d'en-tête (la croix d'une fiche, le ‹ d'une sous-page de Mon compte) et tous les cœurs (la fiche, les cartes
  // de la liste, Mes favoris) — fondateur, 2026-10-25 : « ça ne marche pas pour le retour de Favoris, ni les cœurs ».
  '.flux-bouton', '.favorite-heart', '.fiche-appli .fiche-modes',
  '.fiche-appli .fiche-infos-lien', '.fiche-appli .fiche-apercu-plus', '.plat-pas', '.ec-pas',
  '.carte-page .carte-reinit', '.carte-page .carte-pastilles .cuisine-chip', '.carte-fiche-fermer',
  // Les pastilles au-dessus de la liste (« Ouvert », commune, mot cherché), en verre depuis le 2026-10-26 (maquettes/filtre-ouvert).
  '.liste-filtres .cuisine-chip',
  // Le verre partout (2026-10-26, maquettes/verre-partout) : pastilles de choix, boutons secondaires, boutons iris, raccourcis de
  // Mon compte. Les interrupteurs n'y sont pas : leur rond s'étire déjà à l'appui.
  '.ec-pourboire .cuisine-chip', '.recherche-pastille', '.resa-filtres button', '.btn-outline', '.alerte-compacte-son', '.eg-bouton-iris',
  '.tracking-expand-btn', '.ec-pilule-blanche', '.btn-teal', '.compte-raccourci',
  // Les retours, en verre eux aussi (réponse 5) : le ‹ rond sur les bandeaux iris, « ← Retour » et « ← Mon compte ».
  '.ec-rond', '.gn-rond', '.bv-rond', '.dashboard-retour', '.retour-compte', '.cs-retour', '.ec-b-retour', '.ecl-b-retour',
  // La croix de la fiche d'un plat et le ‹ des pages ouvertes en feuille depuis Mon compte (Mes favoris, Mes commandes, Mes
  // factures… : PageFeuille.jsx) — ronds iris à filet blanc, des retours eux aussi.
  '.plat-fermer', '.page-feuille-fermer'
].join(', ');
// Les barres, qui ne grossissent qu'un peu (la barre d'onglets était « bien », fondateur 2026-10-24) ; tout le reste est un bouton.
const BARRES = '.dashboard-nav, .category-quicknav--verre, .panier-pilule, .fiche-appli .fiche-modes';
/* Les boutons du 2026-10-26 peuvent être larges : à 150 %, « + Ajouter des articles » (354 px) sortirait de l'écran. Au-delà de
   120 px, ils grossissent comme une barre, selon leur taille (8 % à 160 px, 3,5 % à partir de 300 px) ; en dessous (« Activer »,
   « Lire »), comme un bouton. Les contrôles d'avant gardent leur réglage. */
const LARGES = '.btn-outline, .btn-teal, .eg-bouton-iris, .alerte-compacte-son, .tracking-expand-btn, .compte-raccourci';
const SEUIL_LARGE = 120;

/* Ceux qui défilent de côté : le doigt qui part les faire défiler ne doit pas les faire gonfler. Ils attendent 70 ms (le
   « delaysContentTouches » des vues qui défilent sur iOS) ; un défilement qui démarre avant annule l'appui (pointercancel). */
const DEFILENT = '.category-quicknav--verre, .carte-pastilles .cuisine-chip, .dashboard-nav.admin';
const ATTENTE_DEFILE = 70;

const BOUTON = 0.5;
const PETIT = 0.12; // une barre courte (le panier replié en bulle)
const BARRE = 0.035;
const PENCHE = [2, 3];
const APPUI = [0.85, 0.2];
const LACHE = [0.55, 0.4];
const SUIVI = [0.8, 0.22];

const borne = (x, a, b) => Math.max(a, Math.min(b, x));
// Entre « petit » et « barre » selon la taille : jusqu'à 64 px c'est un rond, à partir de 300 px une barre.
const selonTaille = (taille, [p, b]) => p + (b - p) * borne((taille - 64) / 236, 0, 1);

/* Le ressort d'Apple (ressort.js) : amortissement 1 = sans rebond, < 1 = rebondit ; réponse en secondes. */
const ressort = (x) => ({ x, v: 0, cible: x, amort: 1, rep: 0.3 });
function regler(r, cible, [amort, rep]) { r.cible = cible; r.amort = amort; r.rep = rep; }
function avancer(r, dt) {
  const k = (2 * Math.PI / r.rep) ** 2;
  const c = (4 * Math.PI * r.amort) / r.rep;
  r.v += (-k * (r.x - r.cible) - c * r.v) * dt;
  r.x += r.v * dt;
}
const auRepos = (r) => Math.abs(r.x - r.cible) < 2e-4 && Math.abs(r.v) < 2e-3;

const etats = new Map(); // élément → { s, tx, ty, appuye, ... }
let tourne = false;
let avant = 0;
function boucle(t) {
  const dt = Math.min((t - (avant || t)) / 1000 || 1 / 60, 1 / 30);
  avant = t;
  // Pas fins (1/240 s) : à 60 images par seconde, un ressort vif sauterait sa cible.
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  for (const [el, e] of etats) {
    // Le contrôle a quitté la page (le toucher a ouvert un autre écran) : on l'oublie.
    if (!el.isConnected) { etats.delete(el); continue; }
    const rs = [e.s, e.tx, e.ty];
    for (let i = 0; i < n; i++) rs.forEach((r) => avancer(r, dt / n));
    el.style.scale = e.s.x.toFixed(4);
    el.style.translate = `${e.tx.x.toFixed(2)}px ${e.ty.x.toFixed(2)}px`;
    if (!e.appuye && rs.every(auRepos)) {
      el.style.scale = ''; el.style.translate = '';
      if (e.zAvant !== undefined) el.style.zIndex = e.zAvant;
      el.classList.remove('verre-presse');
      etats.delete(el);
    }
  }
  if (etats.size) requestAnimationFrame(boucle); else { tourne = false; avant = 0; }
}
function lancer(el, e) { etats.set(el, e); if (!tourne) { tourne = true; requestAnimationFrame(boucle); } }

function lumiere(el) {
  let l = el.querySelector(':scope > verre-lueur');
  if (!l) { l = document.createElement('verre-lueur'); l.setAttribute('aria-hidden', 'true'); el.appendChild(l); }
  return l;
}

export function installerVerreAppui() {
  const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let courant = null; // { el, id, minuteur, etat }

  const placer = (c, x, y) => {
    const r = c.rect;
    const lx = x - r.left; const ly = y - r.top;
    c.el.style.setProperty('--verre-x', `${lx}px`);
    c.el.style.setProperty('--verre-y', `${ly}px`);
    if (mouvementReduit?.matches || !c.e) return;
    const pen = selonTaille(c.taille, PENCHE);
    const dx = borne((lx - r.width / 2) / (r.width / 2), -1, 1);
    const dy = borne((ly - r.height / 2) / (r.height / 2), -1, 1);
    regler(c.e.tx, dx * pen, SUIVI); regler(c.e.ty, dy * pen * 0.6, SUIVI);
  };

  const gonfler = (c) => {
    if (c.gonfle) return;
    c.gonfle = true;
    c.el.classList.add('verre-presse', 'verre-lumiere');
    if (mouvementReduit?.matches) return;
    const e = etats.get(c.el) || { s: ressort(1), tx: ressort(0), ty: ressort(0) };
    e.appuye = true;
    const barre = c.el.matches(BARRES) || (c.el.offsetWidth >= SEUIL_LARGE && c.el.matches(LARGES));
    regler(e.s, 1 + (barre ? selonTaille(c.taille, [PETIT, BARRE]) : BOUTON), APPUI);
    // À 150 %, un bouton déborde sur son voisin (la recherche sur le cœur) : il passe devant lui le temps de l'appui.
    if (!barre && e.zAvant === undefined) {
      const st = getComputedStyle(c.el);
      if (st.position !== 'static') { e.zAvant = c.el.style.zIndex; c.el.style.zIndex = String((parseInt(st.zIndex, 10) || 0) + 1); }
    }
    c.e = e;
    // Tout de suite, sans attendre la première image : sinon l'enfoncement des boutons (96 %, transitions-appli.css) se voyait une image.
    c.el.style.scale = e.s.x.toFixed(4);
    placer(c, c.x, c.y);
    lancer(c.el, e);
  };

  const relacher = (c) => {
    c.el.classList.remove('verre-lumiere');
    if (!c.e) { c.el.classList.remove('verre-presse'); return; }
    c.e.appuye = false;
    regler(c.e.s, 1, LACHE); regler(c.e.tx, 0, LACHE); regler(c.e.ty, 0, LACHE);
    lancer(c.el, c.e);
  };

  const pose = (ev) => {
    if (ev.button > 0 || courant) return;
    const el = ev.target.closest?.(VERRE);
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
    const rect = el.getBoundingClientRect();
    const c = { el, id: ev.pointerId, rect, taille: Math.max(rect.width, rect.height), x: ev.clientX, y: ev.clientY, gonfle: false, e: null };
    lumiere(el).style.setProperty('--verre-r', `${Math.round(Math.min(c.taille * 0.9, 120))}px`);
    courant = c;
    if (el.matches(DEFILENT)) c.minuteur = setTimeout(() => gonfler(c), ATTENTE_DEFILE);
    else gonfler(c);
  };
  const bouge = (ev) => {
    const c = courant;
    if (!c || ev.pointerId !== c.id) return;
    c.x = ev.clientX; c.y = ev.clientY;
    if (c.gonfle) placer(c, c.x, c.y);
  };
  const fin = (ev, annule) => {
    const c = courant;
    if (!c || ev.pointerId !== c.id) return;
    courant = null;
    clearTimeout(c.minuteur);
    if (!c.gonfle) {
      // Un défilement est parti avant les 70 ms : rien ne bouge. Un toucher bref : le petit rebond quand même.
      if (annule) return;
      gonfler(c);
      setTimeout(() => relacher(c), 60);
      return;
    }
    relacher(c);
  };

  document.addEventListener('pointerdown', pose, { capture: true, passive: true });
  document.addEventListener('pointermove', bouge, { capture: true, passive: true });
  document.addEventListener('pointerup', (ev) => fin(ev, false), { capture: true, passive: true });
  document.addEventListener('pointercancel', (ev) => fin(ev, true), { capture: true, passive: true });
}
