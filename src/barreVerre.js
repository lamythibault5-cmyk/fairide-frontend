// LA BARRE D'ONGLETS EN VERRE (fondateur, 2026-10-16, version 2 de maquettes/barre-onglets-verre/barre-onglets-verre.html), dans l'app seulement.
// Chargé avec import() par useCurseurOnglets.js : le site ne télécharge rien de tout ceci.
//
// Deux choses que le CSS seul ne sait pas faire :
//
// 1. LA LENTILLE SUIT LE DOIGT. Appuyer sur la barre fait grossir la pastille (classe --appui, styles.css) ; glisser la
//    promène d'un onglet à l'autre, et au lâcher on ouvre l'onglet le plus proche. Un simple toucher reste un clic
//    normal sur le lien : on ne capture le pointeur qu'une fois le glissé commencé (6 px), et alors le clic du
//    navigateur tombe sur la barre (ancêtre commun), pas sur l'onglet de départ — c'est nous qui cliquons le bon.
//
// 2. LA RÉFRACTION. Le texte qui passe sous les bords de la barre et de la lentille se courbe, comme à travers un verre
//    bombé : un filtre SVG (carte de déplacement) dans `backdrop-filter`. Seul Chromium sait le faire ; Safari (iPhone)
//    garde le flou, les reflets et l'irisation, sans la courbure — et Android aussi depuis le 2026-10-20 (trop coûteux
//    sur un téléphone moyen, voir refractionPossible).
import { vibrer } from './gestes';

const SEUIL_GLISSE = 6;

/* Carte de déplacement d'un rectangle arrondi : rouge = décalage horizontal, vert = vertical, 128 = rien. Le cœur reste
   net ; près du bord, le fond est tiré vers l'intérieur. Une carte par taille, gardée. */
const cartes = new Map();
function carteDeplacement(l, h) {
  const rayon = Math.min(l, h) / 2;
  const bord = Math.min(l, h) * 0.42;
  const cle = `${l}x${h}`;
  if (cartes.has(cle)) return cartes.get(cle);
  const toile = document.createElement('canvas');
  toile.width = l; toile.height = h;
  const ctx = toile.getContext('2d');
  const img = ctx.createImageData(l, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const qx = Math.abs(x + 0.5 - l / 2) - (l / 2 - rayon);
      const qy = Math.abs(y + 0.5 - h / 2) - (h / 2 - rayon);
      const dehors = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon;
      const t = Math.max(0, Math.min(1, 1 + dehors / bord));
      const nx = Math.sign(x + 0.5 - l / 2) * Math.max(qx, 0);
      const ny = Math.sign(y + 0.5 - h / 2) * Math.max(qy, 0);
      const n = Math.hypot(nx, ny) || 1;
      const i = (y * l + x) * 4;
      img.data[i] = 128 - (nx / n) * t * t * 127;
      img.data[i + 1] = 128 - (ny / n) * t * t * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = toile.toDataURL();
  cartes.set(cle, url);
  return url;
}

let defs = null;
let compteur = 0;
// Un filtre par élément, réécrit quand sa taille change (servi aussi à la bande des cuisines, lentillePuces.js). `irise` : trois forces, une par couleur (bords arc-en-ciel).
export function poserFiltre(el, variable, echelle, irise) {
  const l = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (!l || !h) return;
  if (el.dataset.verreTaille === `${l}x${h}`) return;
  el.dataset.verreTaille = `${l}x${h}`;
  if (!defs) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }
  const id = el.dataset.verreFiltre || `verre-${++compteur}`;
  el.dataset.verreFiltre = id;
  const dep = (s, res) => `<feDisplacementMap in="SourceGraphic" in2="carte" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="${res}"/>`;
  const corps = irise
    ? `${dep(echelle, 'r')}${dep(echelle * 1.12, 'v')}${dep(echelle * 1.24, 'b')}`
      + '<feColorMatrix in="r" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r2"/>'
      + '<feColorMatrix in="v" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="v2"/>'
      + '<feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b2"/>'
      + '<feBlend in="r2" in2="v2" mode="screen" result="rv"/><feBlend in="rv" in2="b2" mode="screen"/>'
    : dep(echelle, 'fin');
  defs.querySelector(`#${id}`)?.remove();
  defs.insertAdjacentHTML('beforeend',
    `<filter id="${id}" x="0" y="0" width="${l}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
    + `<feImage href="${carteDeplacement(l, h)}" x="0" y="0" width="${l}" height="${h}" result="carte" preserveAspectRatio="none"/>${corps}</filter>`);
  el.style.setProperty(variable, `url(#${id})`);
}

// Chromium : la réfraction marche. Safari / WKWebView : non, on s'en passe.
// PAS SUR ANDROID (fondateur, 2026-10-20, test de l'app sur un Android de milieu de gamme : « l'app n'est pas fluide »). La
// carte de déplacement est recalculée pixel par pixel à chaque changement de taille, et le filtre SVG dans backdrop-filter
// est refait par le GPU à chaque image où quelque chose passe dessous — c'est-à-dire pendant tout défilement. Android garde
// le verre au flou simple (reflets, irisation, lentille qui suit le doigt), comme l'iPhone. Reste : Chromium sur ordinateur
// (site ajouté à l'écran d'accueil).
export const refractionPossible = () => /Chrome\/|Chromium/.test(navigator.userAgent) && !/Edg\/|Firefox|Android/.test(navigator.userAgent);

/* La carte d'un élément qui change de taille n'est refaite qu'une fois la taille posée : la barre d'onglets passe en
   compacte à chaque changement de sens du défilement (styles.css, .dashboard-sidebar--compacte), et la refaire à chaque
   image de cette transition, c'était une carte calculée pixel par pixel par image. Rend la fonction qui débranche. */
export function suivreTaille(elements, filtrer) {
  filtrer();
  if (typeof ResizeObserver === 'undefined') return () => {};
  let minuteur = 0;
  const observateur = new ResizeObserver(() => { clearTimeout(minuteur); minuteur = setTimeout(filtrer, 220); });
  elements.forEach((el) => observateur.observe(el));
  return () => { clearTimeout(minuteur); observateur.disconnect(); };
}

/* Branche la barre. Rend la fonction qui débranche. `nav` : .dashboard-nav ; `curseur` : sa .nav-curseur. */
export function brancherBarreVerre(nav, curseur) {
  // La console admin défile de côté dans sa barre : le glissé y garderait la main sur ce défilement.
  const glissable = !nav.classList.contains('admin');
  let geste = null;

  const liens = () => [...nav.querySelectorAll(':scope > .dashboard-nav-link')];
  const plusProche = (x) => {
    let meilleur = null; let d = Infinity;
    for (const lien of liens()) {
      const c = lien.offsetLeft + lien.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleur = lien; }
    }
    return meilleur;
  };

  const allumer = (lien) => {
    geste.survol?.classList.remove('dashboard-nav-link--survol');
    lien?.classList.add('dashboard-nav-link--survol');
    geste.survol = lien;
  };
  // La lentille revient à la place que useCurseurOnglets lui a donnée (l'onglet de la page).
  const remettre = () => { curseur.style.transform = `translate(${curseur.dataset.x || 0}px, ${curseur.dataset.y || 6}px)`; };
  const appui = (e) => {
    if (e.button > 0) return;
    geste = { x0: e.clientX, id: e.pointerId, glisse: false, survol: null };
    nav.classList.add('dashboard-nav--appui');
    /* AU CONTACT, LA LENTILLE VIENT SOUS LE DOIGT (fondateur, 2026-10-25, maquettes/appui-iris/appui-iris.html) et l'icône
       qu'elle couvre se remplit (styles.css, dashboard-nav-link--survol) : avant, elle grossissait là où elle était et ne
       partait qu'au lâcher. Pas dans la barre de la console admin, qui défile. */
    const lien = glissable && e.target.closest?.('.dashboard-nav-link');
    if (lien && lien.parentElement === nav) {
      curseur.style.transform = `translate(${lien.offsetLeft}px, ${curseur.dataset.y || 6}px)`;
      allumer(lien);
    }
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id || !glissable) return;
    if (!geste.glisse) {
      if (Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      nav.setPointerCapture(e.pointerId);
      nav.classList.add('dashboard-nav--glisse');
    }
    const x = e.clientX - nav.getBoundingClientRect().left;
    const largeur = curseur.offsetWidth;
    const min = 6; const max = nav.clientWidth - 6 - largeur;
    curseur.style.transform = `translate(${Math.max(min, Math.min(max, x - largeur / 2))}px, ${curseur.dataset.y || 6}px)`;
    const lien = plusProche(x);
    if (lien !== geste.survol) {
      allumer(lien);
      vibrer('choix');
    }
  };
  /* L'onglet lâché reste allumé (plein, sous la lentille) jusqu'à ce que sa page le rende actif : React Router change de page
     dans une transition, donc pas tout de suite — et pas avant que le code de la page soit chargé. Sans ça, l'icône se vidait
     entre le lâcher et la nouvelle page, puis se remplissait de nouveau. Au bout de 2 s sans changement, on rend la main. */
  const attendre = (lien) => {
    const debut = performance.now();
    const voir = () => {
      if (geste?.survol === lien) return; // un nouvel appui l'a repris
      if (lien.classList.contains('active') || geste || performance.now() - debut > 2000) {
        lien.classList.remove('dashboard-nav-link--survol');
        if (!geste && !lien.classList.contains('active')) remettre();
        return;
      }
      requestAnimationFrame(voir);
    };
    requestAnimationFrame(voir);
  };
  const lache = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    const { glisse, survol } = geste;
    nav.classList.remove('dashboard-nav--appui', 'dashboard-nav--glisse');
    geste = null;
    // Même onglet (ou à côté des onglets) : la lentille revient à la place que useCurseurOnglets lui avait donnée.
    if (!survol || survol.classList.contains('active')) { survol?.classList.remove('dashboard-nav-link--survol'); remettre(); return; }
    // Un simple toucher : le clic du lien, qui suit ce pointerup, fait le reste. Après un glissé, c'est nous qui cliquons.
    if (glisse) {
      curseur.style.transform = `translate(${survol.offsetLeft}px, ${curseur.dataset.y || 6}px)`;
      vibrer('seuil');
      survol.click();
    }
    attendre(survol);
  };
  const annule = () => {
    if (!geste) return;
    geste.survol?.classList.remove('dashboard-nav-link--survol');
    nav.classList.remove('dashboard-nav--appui', 'dashboard-nav--glisse');
    geste = null;
    remettre();
  };
  /* La capture perdue par un ENFANT n'est pas la fin du geste (fondateur, 2026-10-24 : « je touche Mon compte, je glisse vers
     Recherche, la pastille reste sur Compte »). Au doigt, le navigateur capture d'office le pointeur sur l'élément touché
     (l'icône) ; quand le glissé commence, setPointerCapture le reprend pour la barre, et l'icône reçoit un lostpointercapture
     qui remontait jusqu'ici et annulait le glissé après 6 px. Seule la perte de NOTRE capture compte. */
  const perdu = (e) => { if (e.target === nav) annule(); };

  // Un lien se « traîne » par défaut (glisser-déposer du navigateur) : ce glissé-là annulait le nôtre (pointercancel).
  const pasDeTraine = (e) => e.preventDefault();
  nav.addEventListener('dragstart', pasDeTraine);
  nav.addEventListener('pointerdown', appui);
  nav.addEventListener('pointermove', bouge);
  nav.addEventListener('pointerup', lache);
  nav.addEventListener('pointercancel', annule);
  nav.addEventListener('lostpointercapture', perdu);

  let debrancherTaille = null;
  if (refractionPossible()) {
    nav.classList.add('dashboard-nav--refraction');
    debrancherTaille = suivreTaille([nav, curseur], () => { poserFiltre(nav, '--verre-barre', 18, false); poserFiltre(curseur, '--verre-lentille', 26, true); });
  }

  return () => {
    nav.removeEventListener('dragstart', pasDeTraine);
    nav.removeEventListener('pointerdown', appui);
    nav.removeEventListener('pointermove', bouge);
    nav.removeEventListener('pointerup', lache);
    nav.removeEventListener('pointercancel', annule);
    nav.removeEventListener('lostpointercapture', perdu);
    debrancherTaille?.();
  };
}
