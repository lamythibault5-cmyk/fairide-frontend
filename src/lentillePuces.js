// LA LENTILLE DES CUISINES (fondateur, 2026-10-16, proposition A de maquettes/tous-les-ecrans/tous-les-ecrans.html), dans l'app seulement.
// Chargé avec import() par TeteListe.jsx : le site n'en télécharge rien, comme barreVerre.js pour la barre d'onglets.
//
// La cuisine choisie est sous la même lentille de verre que l'onglet de la barre d'onglets (la bande elle-même n'a plus de
// cadre depuis le 2026-10-25, maquettes/barre-cuisines). Le CSS la fait glisser d'une pastille à l'autre ; ici, ce qu'il ne sait pas faire :
//   - APPUYER sur la cuisine choisie fait grossir la lentille (classe lt-puces--appui) ;
//   - GLISSER la promène sous le doigt, d'une cuisine à l'autre, et au lâcher on choisit la plus proche. On ne capture
//     le pointeur qu'après 6 px : un simple toucher reste le clic du bouton. Au doigt (2026-10-24) : un glissé tout de suite
//     fait défiler la bande (ecran-liste.css) ; un doigt TENU 250 ms attrape la lentille, depuis n'importe quelle cuisine ;
//   - le CONTOUR IRIS du dessin sous le doigt et de la cuisine choisie (2026-10-25, poserContours plus bas) ;
//   - la RÉFRACTION des bords sur Chromium, avec les filtres de barreVerre.js — plus sur Android depuis le 2026-10-20
//     (trop coûteuse sur un téléphone moyen, voir refractionPossible), où la bande garde le flou simple.
import { vibrer } from './gestes';
import { poserFiltre, refractionPossible, suivreTaille } from './barreVerre';

const SEUIL_GLISSE = 6;
// Au doigt : tenir 250 ms attrape la lentille ; partir de plus de 8 px avant, c'est un défilement.
const TENUE = 250;
const SEUIL_DOIGT = 8;
// Au doigt, le contour attend 80 ms : un coup de doigt qui fait défiler la bande ne l'allume pas (iOS fait pareil dans une liste).
const DELAI_CONTOUR = 80;

/* LE CONTOUR DU DESSIN (fondateur, 2026-10-25, A de maquettes/appui-iris/appui-iris.html). Le dessin de chaque cuisine a un
   fond transparent : on épaissit sa silhouette de 2 px (feMorphology), on la peint en iris et on repose le dessin dessus. Iris
   plein, sans reflet (fondateur, le même jour : « pas de reflet », essayé une heure). Le dessin est AU-DESSUS de la lentille de
   verre : le flou et la saturation de celle-ci ne touchent pas le contour, qui reste l'iris de --iris (mesuré dans l'app). Posé
   une fois dans la page ; ecran-liste.css ne s'en sert qu'une fois la classe lt-puces--contour posée (un filtre url() absent
   peut masquer l'élément). */
const ID_CONTOUR = 'lt-contour';
function poserContours() {
  if (document.getElementById(ID_CONTOUR)) return;
  const iris = getComputedStyle(document.documentElement).getPropertyValue('--iris').trim() || '#3B2FB5';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs><filter id="${ID_CONTOUR}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">`
    + '<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="gros"/>'
    + `<feFlood flood-color="${iris}"/><feComposite in2="gros" operator="in" result="bord"/>`
    + '<feMerge><feMergeNode in="bord"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  document.body.appendChild(svg);
}

/* `bande` : .lt-puces ; `piste` : .lt-piste (elle défile avec les pastilles) ; `lentille` : .lt-lentille.
   `choisir(valeur)` : la cuisine lâchée sous la lentille. Rend la fonction qui débranche. */
export function brancherLentillePuces(bande, piste, lentille, choisir) {
  let geste = null;
  poserContours();
  bande.classList.add('lt-puces--contour');
  // La cuisine touchée prend le contour (lt-puce--touchee) ; pendant qu'on promène la lentille, c'est celle qu'elle couvre (lt-puce--survol).
  let touchee = null;
  let minuteurTouche = 0;
  const toucher = (puce) => {
    clearTimeout(minuteurTouche);
    if (touchee === puce) return;
    touchee?.classList.remove('lt-puce--touchee');
    puce?.classList.add('lt-puce--touchee');
    touchee = puce;
  };
  const relacher = () => toucher(null);
  const cuisines = () => [...piste.querySelectorAll('.lt-puce[data-cuisine]')];
  const plusProche = (x) => {
    let meilleure = null; let d = Infinity;
    for (const p of cuisines()) {
      const c = p.offsetLeft + p.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleure = p; }
    }
    return meilleure;
  };
  // La lentille sous le doigt (x : écran) ; la cuisine la plus proche s'allume, avec un petit tic.
  const promener = (clientX) => {
    const x = clientX - piste.getBoundingClientRect().left;
    const l = lentille.offsetWidth;
    const y = lentille.dataset.y || 6;
    lentille.style.transform = `translate(${Math.max(6, Math.min(piste.scrollWidth - 6 - l, x - l / 2))}px, ${y}px)`;
    const puce = plusProche(x);
    if (puce !== geste.survol) {
      toucher(null);
      geste.survol?.classList.remove('lt-puce--survol');
      puce?.classList.add('lt-puce--survol');
      geste.survol = puce;
      vibrer('choix');
    }
  };

  const appui = (e) => {
    if (e.button > 0) return;
    const puce = e.target.closest?.('.lt-puce[data-cuisine]');
    if (!puce) return;
    if (e.pointerType === 'touch') { toucher(null); minuteurTouche = setTimeout(() => toucher(puce), DELAI_CONTOUR); } else toucher(puce);
    if (e.pointerType === 'touch') {
      /* AU DOIGT : TENIR, PUIS GLISSER (fondateur, 2026-10-24 : « je pose le doigt, puis je glisse, et la pastille ne suit
         pas »). Un coup de doigt tout de suite fait toujours défiler la bande. Un doigt qui reste posé TENUE ms sans bouger
         attrape la lentille : elle grossit, vient sous lui et le suit, et la bande ne défile plus tant qu'on la tient
         (touchmove annulé, plus bas). Lâché sans avoir bougé : le clic du bouton, comme un toucher. */
      const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, id: e.pointerId, doigt: true, tenu: false, glisse: false, survol: null };
      g.minuteur = setTimeout(() => {
        if (geste !== g) return;
        g.tenu = true;
        // Rien de choisi (plus de « Tous », 2026-10-27) : la lentille, effacée, naît sur la cuisine tenue au lieu de glisser
        // depuis la dernière place (ou de n'avoir aucune taille, jamais posée).
        if (!lentille.classList.contains('lt-lentille--vue')) {
          lentille.style.transition = 'none';
          lentille.style.width = `${puce.offsetWidth}px`;
          lentille.style.height = `${puce.offsetHeight}px`;
          lentille.style.transform = `translate(${puce.offsetLeft}px, ${puce.offsetTop}px)`;
          lentille.dataset.y = String(puce.offsetTop);
          void lentille.offsetWidth;
          lentille.style.transition = '';
        }
        bande.classList.add('lt-puces--appui');
        promener(g.x);
      }, TENUE);
      geste = g;
      return;
    }
    // Souris, stylet : depuis la cuisine choisie, dès 6 px.
    if (!puce.classList.contains('on')) return;
    geste = { x0: e.clientX, id: e.pointerId, doigt: false, tenu: true, glisse: false, survol: null };
    bande.classList.add('lt-puces--appui');
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    geste.x = e.clientX;
    if (!geste.tenu) {
      // Le doigt part avant d'avoir tenu : c'est un défilement, on le laisse faire.
      if (Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) > SEUIL_DOIGT) { clearTimeout(geste.minuteur); geste = null; relacher(); }
      return;
    }
    if (!geste.glisse) {
      if (!geste.doigt && Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      piste.setPointerCapture(e.pointerId);
      bande.classList.add('lt-puces--glisse');
    }
    promener(e.clientX);
  };
  const fin = (e, annule) => {
    if (!geste || (e && e.pointerId !== geste.id)) return;
    const { glisse, tenu, survol } = geste;
    clearTimeout(geste.minuteur);
    survol?.classList.remove('lt-puce--survol');
    bande.classList.remove('lt-puces--appui', 'lt-puces--glisse');
    geste = null;
    // La lentille revient à la place que TeteListe lui a donnée, ou part vers la cuisine lâchée (nouveau rendu). Sans cuisine
    // choisie, elle s'efface là où elle est.
    if (tenu && lentille.classList.contains('lt-lentille--vue')) lentille.style.transform = `translate(${lentille.dataset.x || 0}px, ${lentille.dataset.y || 6}px)`;
    if (!glisse) return; // un simple toucher, ou tenu sans bouger : le clic du bouton fait le reste
    if (!annule && survol && !survol.classList.contains('on')) { vibrer('seuil'); choisir(survol.dataset.cuisine); }
  };
  const lache = (e) => fin(e, false);
  const annule = (e) => fin(e, true);
  // Seule la perte de NOTRE capture annule (barreVerre.js : celle du bouton touché, capturé d'office au doigt, remontait ici).
  const perdu = (e) => { if (e.target === piste) fin(e, true); };
  // Lentille tenue au doigt : la bande ne défile pas sous elle.
  const bloque = (e) => { if (geste?.doigt && geste.tenu && e.cancelable) e.preventDefault(); };

  piste.addEventListener('pointerdown', appui);
  piste.addEventListener('pointermove', bouge);
  piste.addEventListener('pointerup', lache);
  piste.addEventListener('pointercancel', annule);
  // Le contour s'éteint au lâcher, même sans geste en cours (souris sur une autre cuisine que la choisie, défilement au doigt).
  piste.addEventListener('pointerup', relacher);
  piste.addEventListener('pointercancel', relacher);
  piste.addEventListener('lostpointercapture', perdu);
  piste.addEventListener('touchmove', bloque, { passive: false });

  let debrancherTaille = null;
  if (refractionPossible()) {
    bande.classList.add('lt-puces--refraction');
    debrancherTaille = suivreTaille([lentille], () => poserFiltre(lentille, '--verre-lentille', 22, true));
  }

  return () => {
    piste.removeEventListener('pointerdown', appui);
    piste.removeEventListener('pointermove', bouge);
    piste.removeEventListener('pointerup', lache);
    piste.removeEventListener('pointercancel', annule);
    piste.removeEventListener('pointerup', relacher);
    piste.removeEventListener('pointercancel', relacher);
    piste.removeEventListener('lostpointercapture', perdu);
    relacher();
    bande.classList.remove('lt-puces--contour');
    piste.removeEventListener('touchmove', bloque);
    debrancherTaille?.();
  };
}
