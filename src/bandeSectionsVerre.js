// LA BANDE DES SECTIONS EN VERRE (fiche d'un commerce dans l'app, fondateur 2026-10-16, « Fiche d'un commerce » de
// maquettes/tous-les-ecrans/tous-les-ecrans.html). Chargé avec import() par CategoryQuickNav dans l'app seulement : le site n'en télécharge rien.
//
// La lentille se pose sur la section qu'on lit (CategoryQuickNav la déplace au défilement). Ici, le geste de la barre
// d'onglets (barreVerre.js) : appuyer sur la section allumée fait grossir la lentille ; glisser la promène d'une section à
// l'autre, et au lâcher on saute à la plus proche. Un simple toucher reste un clic normal. Le glissé ne part QUE de la
// section allumée (touch-action: none sur elle seule, ecran-fiche.css) : ailleurs, le doigt fait défiler la bande de côté.
import { vibrer } from './gestes';

const SEUIL_GLISSE = 6;

/* Branche la bande. Rend la fonction qui débranche. `rangee` : .category-quicknav-sections (qui défile de côté) ;
   `lentille` : sa .quicknav-lentille ; `barre` : .category-quicknav, qui reçoit les classes d'état. */
export function brancherBandeSections(barre, rangee, lentille) {
  let geste = null;
  const boutons = () => [...rangee.querySelectorAll('button')];
  // Position dans le contenu de la rangée (elle défile de côté) : offsetLeft des boutons, pas l'écran.
  const xDans = (e) => e.clientX - rangee.getBoundingClientRect().left + rangee.scrollLeft;
  const plusProche = (x) => {
    let meilleur = null; let d = Infinity;
    for (const b of boutons()) {
      const c = b.offsetLeft + b.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleur = b; }
    }
    return meilleur;
  };

  const appui = (e) => {
    if (e.button > 0) return;
    const b = e.target.closest?.('button');
    if (!b || !b.classList.contains('active')) return;
    geste = { x0: e.clientX, id: e.pointerId, glisse: false, survol: null };
    barre.classList.add('category-quicknav--appui');
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    if (!geste.glisse) {
      if (Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      rangee.setPointerCapture(e.pointerId);
      barre.classList.add('category-quicknav--glisse');
    }
    const x = xDans(e);
    const l = lentille.offsetWidth;
    const max = rangee.scrollWidth - l;
    lentille.style.transform = `translateX(${Math.max(0, Math.min(max, x - l / 2))}px)`;
    const b = plusProche(x);
    if (b !== geste.survol) {
      geste.survol?.classList.remove('quicknav-survol');
      b?.classList.add('quicknav-survol');
      geste.survol = b;
      vibrer('selection');
    }
  };
  const fin = () => {
    barre.classList.remove('category-quicknav--appui', 'category-quicknav--glisse');
    geste?.survol?.classList.remove('quicknav-survol');
  };
  const lache = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    const { glisse, survol } = geste;
    fin();
    geste = null;
    if (!glisse) return; // un simple toucher : le clic du bouton fait le reste
    // Le clic du navigateur tombe sur la rangée (le pointeur est capturé) : c'est nous qui cliquons la bonne section.
    // Autre section : CategoryQuickNav y repose la lentille. Même section : elle revient à sa place de repos.
    if (survol && !survol.classList.contains('active')) { vibrer('moyen'); survol.click(); }
    else if (lentille.dataset.repos) lentille.style.transform = lentille.dataset.repos;
  };
  const annule = () => {
    if (!geste) return;
    fin();
    geste = null;
    if (lentille.dataset.repos) lentille.style.transform = lentille.dataset.repos;
  };

  rangee.addEventListener('pointerdown', appui);
  rangee.addEventListener('pointermove', bouge);
  rangee.addEventListener('pointerup', lache);
  rangee.addEventListener('pointercancel', annule);
  rangee.addEventListener('lostpointercapture', annule);
  return () => {
    rangee.removeEventListener('pointerdown', appui);
    rangee.removeEventListener('pointermove', bouge);
    rangee.removeEventListener('pointerup', lache);
    rangee.removeEventListener('pointercancel', annule);
    rangee.removeEventListener('lostpointercapture', annule);
  };
}
