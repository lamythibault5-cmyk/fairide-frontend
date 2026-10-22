// LA LENTILLE DES CUISINES (fondateur, 2026-10-16, proposition A de maquettes/tous-les-ecrans/tous-les-ecrans.html), dans l'app seulement.
// Chargé avec import() par TeteListe.jsx : le site n'en télécharge rien, comme barreVerre.js pour la barre d'onglets.
//
// La bande des pastilles de cuisine est du même verre que la barre d'onglets, et la cuisine choisie est sous la même
// lentille. Le CSS la fait glisser d'une pastille à l'autre ; ici, ce qu'il ne sait pas faire :
//   - APPUYER sur la cuisine choisie fait grossir la lentille (classe lt-puces--appui) ;
//   - GLISSER la promène sous le doigt, d'une cuisine à l'autre, et au lâcher on choisit la plus proche. On ne capture
//     le pointeur qu'après 6 px : un simple toucher reste le clic du bouton, et la bande défile toujours de côté quand on
//     part d'une autre pastille (touch-action: pan-x sur les autres, none sur la choisie) ;
//   - la RÉFRACTION des bords sur Chromium, avec les filtres de barreVerre.js — plus sur Android depuis le 2026-10-20
//     (trop coûteuse sur un téléphone moyen, voir refractionPossible), où la bande garde le flou simple.
import { vibrer } from './gestes';
import { poserFiltre, refractionPossible, suivreTaille } from './barreVerre';

const SEUIL_GLISSE = 6;

/* `bande` : .lt-puces ; `piste` : .lt-piste (elle défile avec les pastilles) ; `lentille` : .lt-lentille.
   `choisir(valeur)` : la cuisine lâchée sous la lentille. Rend la fonction qui débranche. */
export function brancherLentillePuces(bande, piste, lentille, choisir) {
  let geste = null;
  const cuisines = () => [...piste.querySelectorAll('.lt-puce[data-cuisine]')];
  const plusProche = (x) => {
    let meilleure = null; let d = Infinity;
    for (const p of cuisines()) {
      const c = p.offsetLeft + p.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleure = p; }
    }
    return meilleure;
  };

  const appui = (e) => {
    if (e.button > 0) return;
    const puce = e.target.closest?.('.lt-puce[data-cuisine]');
    if (!puce || !puce.classList.contains('on')) return;
    geste = { x0: e.clientX, id: e.pointerId, glisse: false, survol: null };
    bande.classList.add('lt-puces--appui');
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    if (!geste.glisse) {
      if (Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      piste.setPointerCapture(e.pointerId);
      bande.classList.add('lt-puces--glisse');
    }
    const x = e.clientX - piste.getBoundingClientRect().left;
    const l = lentille.offsetWidth;
    const y = lentille.dataset.y || 6;
    lentille.style.transform = `translate(${Math.max(6, Math.min(piste.scrollWidth - 6 - l, x - l / 2))}px, ${y}px)`;
    const puce = plusProche(x);
    if (puce !== geste.survol) {
      geste.survol?.classList.remove('lt-puce--survol');
      puce?.classList.add('lt-puce--survol');
      geste.survol = puce;
      vibrer('selection');
    }
  };
  const fin = (e, annule) => {
    if (!geste || (e && e.pointerId !== geste.id)) return;
    const { glisse, survol } = geste;
    survol?.classList.remove('lt-puce--survol');
    bande.classList.remove('lt-puces--appui', 'lt-puces--glisse');
    geste = null;
    if (!glisse) return; // un simple toucher : le clic du bouton fait le reste
    // La lentille revient à la place que TeteListe lui a donnée, ou part vers la cuisine lâchée (nouveau rendu).
    lentille.style.transform = `translate(${lentille.dataset.x || 0}px, ${lentille.dataset.y || 6}px)`;
    if (!annule && survol && !survol.classList.contains('on')) { vibrer('moyen'); choisir(survol.dataset.cuisine); }
  };
  const lache = (e) => fin(e, false);
  const annule = (e) => fin(e, true);

  piste.addEventListener('pointerdown', appui);
  piste.addEventListener('pointermove', bouge);
  piste.addEventListener('pointerup', lache);
  piste.addEventListener('pointercancel', annule);
  piste.addEventListener('lostpointercapture', annule);

  let debrancherTaille = null;
  if (refractionPossible()) {
    bande.classList.add('lt-puces--refraction');
    debrancherTaille = suivreTaille([bande, lentille], () => { poserFiltre(bande, '--verre-bande', 18, false); poserFiltre(lentille, '--verre-lentille', 22, true); });
  }

  return () => {
    piste.removeEventListener('pointerdown', appui);
    piste.removeEventListener('pointermove', bouge);
    piste.removeEventListener('pointerup', lache);
    piste.removeEventListener('pointercancel', annule);
    piste.removeEventListener('lostpointercapture', annule);
    debrancherTaille?.();
  };
}
