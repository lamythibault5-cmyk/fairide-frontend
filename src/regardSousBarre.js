/* CE QUI PASSE SOUS UNE BARRE, REGARDÉ SANS ALOURDIR LE DÉFILEMENT (2026-10-20, test de l'app Android : « pas fluide »).
 * Partagé par la barre d'état (barreEtat.js) et la barre d'app sans compte (hooks/useBarreSurIris.js), qui deviennent iris
 * au-dessus d'un bandeau iris et blanches ailleurs. Chacune regardait À CHAQUE IMAGE de défilement (elementFromPoint, puis
 * getComputedStyle en remontant les parents : une mise en page forcée par image) et relançait deux minuteurs à chaque
 * changement du DOM, si bien qu'une liste qui se dessine ou un chiffre qui roule les faisait travailler en continu.
 * Maintenant : pendant un défilement, un regard toutes les 120 ms au plus, et un dernier à l'arrêt (le bandeau qui se
 * replie se voit au plus 120 ms plus tard, ce qui ne se remarque pas) ; après des changements du DOM, un regard par rafale,
 * puis un second 450 ms plus tard, quand les animations d'entrée sont finies. */

export const IRIS = new Set(['59,47,181', '42,33,133']);

// Le premier fond opaque sous le point (milieu de l'écran, hauteur `y`), en remontant les parents ; « r,v,b » ou null.
export function fondSous(y) {
  let el = document.elementFromPoint(window.innerWidth / 2, y);
  while (el && el !== document.documentElement) {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, v, b, a = 1] = m[1].split(',').map((x) => Number(x.trim()));
      // Un voile translucide (fond d'une feuille, verre) ne compte pas : on regarde ce qu'il laisse voir dessous.
      if (a >= 0.9) return `${r},${v},${b}`;
    }
    el = el.parentElement;
  }
  return null;
}

const PAS_DEFILEMENT_MS = 120;

/* Appelle `regarder` quand ce qui passe sous la barre a pu changer. Rend la fonction qui débranche. */
export function surveillerSousBarre(regarder) {
  let image = 0;
  let dernier = 0;
  let fin = 0;
  let retard = 0;
  let rafale = 0;
  const maintenant = () => { image = 0; dernier = performance.now(); regarder(); };
  const demander = () => { if (!image) image = requestAnimationFrame(maintenant); };
  const surDefilement = () => {
    clearTimeout(fin);
    fin = setTimeout(demander, PAS_DEFILEMENT_MS);
    if (performance.now() - dernier >= PAS_DEFILEMENT_MS) demander();
  };
  // Changement d'écran, feuille ouverte, données arrivées : la page change sans défilement ; un second regard après les animations.
  const apresChangement = () => { demander(); clearTimeout(retard); retard = setTimeout(demander, 450); };
  // Une rafale de mutations (React qui dessine une liste) ne coûte qu'un minuteur, posé à la première.
  const surMutation = () => { if (!rafale) rafale = setTimeout(() => { rafale = 0; apresChangement(); }, 60); };
  // `capture` : les feuilles et les sous-écrans défilent dans leur propre conteneur, pas dans la fenêtre.
  window.addEventListener('scroll', surDefilement, { capture: true, passive: true });
  window.addEventListener('resize', apresChangement);
  const obs = new MutationObserver(surMutation);
  obs.observe(document.body, { childList: true, subtree: true });
  apresChangement();
  return () => {
    cancelAnimationFrame(image); clearTimeout(fin); clearTimeout(retard); clearTimeout(rafale);
    window.removeEventListener('scroll', surDefilement, { capture: true });
    window.removeEventListener('resize', apresChangement);
    obs.disconnect();
  };
}
