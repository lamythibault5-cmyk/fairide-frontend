/* LA BARRE D'ÉTAT SUIT LE BANDEAU (fondateur, 2026-10-19, audit « Look and feel » 6d ; app seulement, lancé par natif.js).
 * Tant qu'un bandeau iris passe sous la barre d'état, elle reste iris, icônes blanches. Quand le bandeau s'est replié en
 * défilant (ou qu'un écran commence en blanc), elle devient blanche, icônes sombres. Avant, elle restait iris partout sur
 * Android : une bande iris collée en haut d'une page blanche.
 *
 * Comment : on regarde ce qui est peint juste sous la barre (elementFromPoint au milieu, à 2 px du haut de la vue web) et on
 * remonte jusqu'au premier fond opaque. Iris ou iris foncé → iris ; tout le reste → blanc. Une fois par image au plus
 * (requestAnimationFrame), et seulement quand la couleur change : la barre ne clignote pas, le greffon n'est pas sollicité
 * à chaque pixel de défilement. iPhone : la barre est transparente, seule la couleur des icônes change. */

const IRIS = new Set(['59,47,181', '42,33,133']);

function fondSousLaBarre() {
  let el = document.elementFromPoint(window.innerWidth / 2, 2);
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

export function suivreBarreEtat({ StatusBar, Style, android }) {
  let iris = null;
  let image = 0;
  let retard = 0;
  const appliquer = () => {
    image = 0;
    const fond = fondSousLaBarre();
    const estIris = fond !== null && IRIS.has(fond);
    if (estIris === iris) return;
    iris = estIris;
    // Style.Dark = icônes claires (sur l'iris), Style.Light = icônes sombres (sur le blanc).
    StatusBar.setStyle({ style: estIris ? Style.Dark : Style.Light }).catch(() => {});
    if (android) StatusBar.setBackgroundColor({ color: estIris ? '#3B2FB5' : '#FFFFFF' }).catch(() => {});
  };
  const demander = () => { if (!image) image = requestAnimationFrame(appliquer); };
  // Après un changement d'écran ou l'ouverture d'une feuille, les animations finissent un peu plus tard : un second regard.
  const demanderApres = () => { demander(); clearTimeout(retard); retard = setTimeout(demander, 450); };
  // `capture` : les feuilles et les sous-écrans défilent dans leur propre conteneur, pas dans la fenêtre.
  window.addEventListener('scroll', demander, { capture: true, passive: true });
  window.addEventListener('resize', demanderApres);
  new MutationObserver(demanderApres).observe(document.body, { childList: true, subtree: true });
  demanderApres();
}
