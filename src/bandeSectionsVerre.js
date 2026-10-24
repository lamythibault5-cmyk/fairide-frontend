// LA BANDE DES SECTIONS EN VERRE (fiche d'un commerce dans l'app, fondateur 2026-10-16, « Fiche d'un commerce » de
// maquettes/tous-les-ecrans/tous-les-ecrans.html). Chargé avec import() par CategoryQuickNav dans l'app seulement : le site n'en télécharge rien.
//
// La lentille se pose sur la section qu'on lit (CategoryQuickNav la déplace au défilement). Ici, le geste de la barre
// d'onglets (barreVerre.js) : appuyer sur la section allumée fait grossir la lentille ; glisser la promène d'une section à
// l'autre, et au lâcher on saute à la plus proche. Un simple toucher reste un clic normal. À la souris, le glissé part de la
// section allumée ; au doigt (2026-10-24), un glissé tout de suite fait défiler la bande, et un doigt TENU 250 ms attrape la
// lentille depuis n'importe quelle section, puis la promène.
import { vibrer } from './gestes';

const SEUIL_GLISSE = 6;
// Au doigt : tenir 250 ms attrape la lentille ; partir de plus de 8 px avant, c'est un défilement.
const TENUE = 250;
const SEUIL_DOIGT = 8;

/* Branche la bande. Rend la fonction qui débranche. `rangee` : .category-quicknav-sections (qui défile de côté) ;
   `lentille` : sa .quicknav-lentille ; `barre` : .category-quicknav, qui reçoit les classes d'état. */
export function brancherBandeSections(barre, rangee, lentille) {
  let geste = null;
  const boutons = () => [...rangee.querySelectorAll('button')];
  // Position dans le contenu de la rangée (elle défile de côté) : offsetLeft des boutons, pas l'écran.
  const xDans = (clientX) => clientX - rangee.getBoundingClientRect().left + rangee.scrollLeft;
  const plusProche = (x) => {
    let meilleur = null; let d = Infinity;
    for (const b of boutons()) {
      const c = b.offsetLeft + b.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleur = b; }
    }
    return meilleur;
  };
  // La lentille sous le doigt ; la section la plus proche s'allume, avec un petit tic.
  const promener = (clientX) => {
    const x = xDans(clientX);
    const l = lentille.offsetWidth;
    const max = rangee.scrollWidth - l;
    lentille.style.transform = `translateX(${Math.max(0, Math.min(max, x - l / 2))}px)`;
    const b = plusProche(x);
    if (b !== geste.survol) {
      geste.survol?.classList.remove('quicknav-survol');
      b?.classList.add('quicknav-survol');
      geste.survol = b;
      vibrer('choix');
    }
  };

  const appui = (e) => {
    if (e.button > 0) return;
    const b = e.target.closest?.('button');
    if (!b) return;
    if (e.pointerType === 'touch') {
      /* AU DOIGT : TENIR, PUIS GLISSER (fondateur, 2026-10-24, comme la bande des cuisines, lentillePuces.js). Un coup de doigt
         tout de suite fait défiler la bande ; un doigt posé TENUE ms sans bouger attrape la lentille, et la bande ne défile
         plus tant qu'on la tient (touchmove annulé, plus bas). */
      const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, id: e.pointerId, doigt: true, tenu: false, glisse: false, survol: null };
      g.minuteur = setTimeout(() => {
        if (geste !== g) return;
        g.tenu = true;
        barre.classList.add('category-quicknav--appui');
        promener(g.x);
      }, TENUE);
      geste = g;
      return;
    }
    // Souris, stylet : depuis la section allumée, dès 6 px.
    if (!b.classList.contains('active')) return;
    geste = { x0: e.clientX, id: e.pointerId, doigt: false, tenu: true, glisse: false, survol: null };
    barre.classList.add('category-quicknav--appui');
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    geste.x = e.clientX;
    if (!geste.tenu) {
      // Le doigt part avant d'avoir tenu : c'est un défilement, on le laisse faire.
      if (Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) > SEUIL_DOIGT) { clearTimeout(geste.minuteur); geste = null; }
      return;
    }
    if (!geste.glisse) {
      if (!geste.doigt && Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      rangee.setPointerCapture(e.pointerId);
      barre.classList.add('category-quicknav--glisse');
    }
    promener(e.clientX);
  };
  const fin = () => {
    clearTimeout(geste?.minuteur);
    barre.classList.remove('category-quicknav--appui', 'category-quicknav--glisse');
    geste?.survol?.classList.remove('quicknav-survol');
  };
  const lache = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    const { glisse, tenu, survol } = geste;
    fin();
    geste = null;
    if (!glisse) {
      // Un simple toucher, ou tenu sans bouger : le clic du bouton fait le reste ; la lentille revient d'abord à sa place.
      if (tenu && lentille.dataset.repos) lentille.style.transform = lentille.dataset.repos;
      return;
    }
    // Le clic du navigateur tombe sur la rangée (le pointeur est capturé) : c'est nous qui cliquons la bonne section.
    // Autre section : CategoryQuickNav y repose la lentille. Même section : elle revient à sa place de repos.
    if (survol && !survol.classList.contains('active')) { vibrer('seuil'); survol.click(); }
    else if (lentille.dataset.repos) lentille.style.transform = lentille.dataset.repos;
  };
  const annule = () => {
    if (!geste) return;
    const { tenu } = geste;
    fin();
    geste = null;
    if (tenu && lentille.dataset.repos) lentille.style.transform = lentille.dataset.repos;
  };
  // Seule la perte de NOTRE capture annule (barreVerre.js : celle du bouton touché, capturé d'office au doigt, remontait ici).
  const perdu = (e) => { if (e.target === rangee) annule(); };
  // Lentille tenue au doigt : la bande ne défile pas sous elle.
  const bloque = (e) => { if (geste?.doigt && geste.tenu && e.cancelable) e.preventDefault(); };

  rangee.addEventListener('pointerdown', appui);
  rangee.addEventListener('pointermove', bouge);
  rangee.addEventListener('pointerup', lache);
  rangee.addEventListener('pointercancel', annule);
  rangee.addEventListener('lostpointercapture', perdu);
  rangee.addEventListener('touchmove', bloque, { passive: false });
  return () => {
    rangee.removeEventListener('pointerdown', appui);
    rangee.removeEventListener('pointermove', bouge);
    rangee.removeEventListener('pointerup', lache);
    rangee.removeEventListener('pointercancel', annule);
    rangee.removeEventListener('lostpointercapture', perdu);
    rangee.removeEventListener('touchmove', bloque);
  };
}
