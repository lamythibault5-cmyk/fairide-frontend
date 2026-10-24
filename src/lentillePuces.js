// LA LENTILLE DES CUISINES (fondateur, 2026-10-16, proposition A de maquettes/tous-les-ecrans/tous-les-ecrans.html), dans l'app seulement.
// Chargé avec import() par TeteListe.jsx : le site n'en télécharge rien, comme barreVerre.js pour la barre d'onglets.
//
// La bande des pastilles de cuisine est du même verre que la barre d'onglets, et la cuisine choisie est sous la même
// lentille. Le CSS la fait glisser d'une pastille à l'autre ; ici, ce qu'il ne sait pas faire :
//   - APPUYER sur la cuisine choisie fait grossir la lentille (classe lt-puces--appui) ;
//   - GLISSER la promène sous le doigt, d'une cuisine à l'autre, et au lâcher on choisit la plus proche. On ne capture
//     le pointeur qu'après 6 px : un simple toucher reste le clic du bouton. Au doigt (2026-10-24) : un glissé tout de suite
//     fait défiler la bande (ecran-liste.css) ; un doigt TENU 250 ms attrape la lentille, depuis n'importe quelle cuisine ;
//   - la RÉFRACTION des bords sur Chromium, avec les filtres de barreVerre.js — plus sur Android depuis le 2026-10-20
//     (trop coûteuse sur un téléphone moyen, voir refractionPossible), où la bande garde le flou simple.
import { vibrer } from './gestes';
import { poserFiltre, refractionPossible, suivreTaille } from './barreVerre';

const SEUIL_GLISSE = 6;
// Au doigt : tenir 250 ms attrape la lentille ; partir de plus de 8 px avant, c'est un défilement.
const TENUE = 250;
const SEUIL_DOIGT = 8;

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
  // La lentille sous le doigt (x : écran) ; la cuisine la plus proche s'allume, avec un petit tic.
  const promener = (clientX) => {
    const x = clientX - piste.getBoundingClientRect().left;
    const l = lentille.offsetWidth;
    const y = lentille.dataset.y || 6;
    lentille.style.transform = `translate(${Math.max(6, Math.min(piste.scrollWidth - 6 - l, x - l / 2))}px, ${y}px)`;
    const puce = plusProche(x);
    if (puce !== geste.survol) {
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
    if (e.pointerType === 'touch') {
      /* AU DOIGT : TENIR, PUIS GLISSER (fondateur, 2026-10-24 : « je pose le doigt, puis je glisse, et la pastille ne suit
         pas »). Un coup de doigt tout de suite fait toujours défiler la bande. Un doigt qui reste posé TENUE ms sans bouger
         attrape la lentille : elle grossit, vient sous lui et le suit, et la bande ne défile plus tant qu'on la tient
         (touchmove annulé, plus bas). Lâché sans avoir bougé : le clic du bouton, comme un toucher. */
      const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, id: e.pointerId, doigt: true, tenu: false, glisse: false, survol: null };
      g.minuteur = setTimeout(() => {
        if (geste !== g) return;
        g.tenu = true;
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
      if (Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) > SEUIL_DOIGT) { clearTimeout(geste.minuteur); geste = null; }
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
    // La lentille revient à la place que TeteListe lui a donnée, ou part vers la cuisine lâchée (nouveau rendu).
    if (tenu) lentille.style.transform = `translate(${lentille.dataset.x || 0}px, ${lentille.dataset.y || 6}px)`;
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
  piste.addEventListener('lostpointercapture', perdu);
  piste.addEventListener('touchmove', bloque, { passive: false });

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
    piste.removeEventListener('lostpointercapture', perdu);
    piste.removeEventListener('touchmove', bloque);
    debrancherTaille?.();
  };
}
