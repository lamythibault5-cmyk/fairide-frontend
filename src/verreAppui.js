// LE VERRE QUI RÉPOND AU DOIGT (fondateur, 2026-10-24 : version B de maquettes/verre-appui/verre-appui.html, « iOS 26 »).
// Chargé avec import() par demarrerNatif (natif.js) : l'app seulement, le site n'en télécharge rien.
//
// Ce que fait le verre « interactif » d'Apple (iOS 26, glassEffect(.regular.interactive())), et ce que le CSS seul ne sait pas
// faire : dès que le doigt POSE (avant tout clic), le contrôle grossit ; une lumière se tient sous le doigt et le suit ; le verre
// se penche de quelques pixels vers lui ; au lâcher, un ressort le ramène avec un petit rebond. Un ressort plutôt qu'une
// transition : il repart de la taille affichée, et un nouvel appui le rattrape en plein vol (« Designing Fluid Interfaces »).
//
// Réglages de la version B :
//   - grossit de 12 % pour un petit bouton (≤ 64 px), de 3,5 % pour une barre (≥ 300 px), entre les deux selon la taille. 8 % dans
//     la maquette ; 12 % après l'essai sur l'iPhone (fondateur, 2026-10-24 : la barre est bien, les ronds « un peu plus gros ») ;
//   - se penche de 2 px (petit) à 3 px (barre) vers le doigt ;
//   - ressort à la pose : amortissement .85, réponse .2 s ; au lâcher : .55, .4 s (un rebond franc d'environ 1 %, posé en .45 s).
// Les cartes et les rangées ne sont pas du verre : elles gardent leur enfoncement (transitions-appli.css, réponse 4).
//
// `scale` et `translate` (propriétés à part, pas `transform`) : elles s'ajoutent aux transformations propres à chaque contrôle
// (le panier centré par translateX(-50 %), la barre qui « pousse » à un changement d'onglet) au lieu de les remplacer.

/* Les contrôles en verre de l'app. Un appui sur un élément à l'intérieur fait réagir tout le contrôle (toute la barre d'onglets,
   toute la bande des cuisines : réponse 3 du questionnaire). */
const VERRE = [
  '.dashboard-nav', '.lt-puces', '.category-quicknav--verre', '.panier-pilule',
  '.fiche-appli .flux-entete--flottant .flux-bouton', '.fiche-appli .favorite-heart--rond', '.fiche-appli .fiche-modes',
  '.fiche-appli .fiche-infos-lien', '.fiche-appli .fiche-apercu-plus', '.plat-pas', '.ec-pas',
  '.carte-page .carte-reinit', '.carte-page .carte-pastilles .cuisine-chip', '.carte-fiche-fermer',
  // Les retours, en verre eux aussi (réponse 5) : le ‹ rond sur les bandeaux iris, « ← Retour » et « ← Mon compte ».
  '.ec-rond', '.gn-rond', '.bv-rond', '.dashboard-retour', '.retour-compte', '.cs-retour', '.ec-b-retour', '.ecl-b-retour',
  // La croix de la fiche d'un plat (ronde, iris à filet blanc) : un retour, elle aussi.
  '.plat-fermer'
].join(', ');

/* Ceux qui défilent de côté : le doigt qui part les faire défiler ne doit pas les faire gonfler. Ils attendent 70 ms (le
   « delaysContentTouches » des vues qui défilent sur iOS) ; un défilement qui démarre avant annule l'appui (pointercancel). */
const DEFILENT = '.lt-puces, .category-quicknav--verre, .carte-pastilles .cuisine-chip, .dashboard-nav.admin';
const ATTENTE_DEFILE = 70;

const PETIT = 0.12;
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
    regler(e.s, 1 + selonTaille(c.taille, [PETIT, BARRE]), APPUI);
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
