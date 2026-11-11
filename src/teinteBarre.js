// LA TEINTE DE LA BARRE D'ONGLETS (fondateur, 2026-11-11, réponse 1 A de maquettes/barre-ios26/barre-ios26.html). Comme sur
// iOS 26, la barre passe en verre fumé, icônes blanches, au-dessus d'un fond sombre (les cartes iris « Demandés près de toi »,
// un bandeau iris), et redevient claire sur le blanc. Dans l'app seulement : chargé avec import() par DashboardSidebar.jsx.
//
// ON NE LIT AUCUN PIXEL. Six points sous la barre (à 20, 50 et 80 % de la largeur de l'écran, au tiers et aux deux tiers de sa
// hauteur) : sous chacun, le premier élément qui a une couleur de fond décide. Sombre s'il est foncé (luminance < 0,42 : l'iris l'est, le
// lilas pâle non). Une photo, une tuile de carte ou une image de fond comptent comme claires : leur luminosité ne se lirait
// qu'en les redessinant, trop cher. La barre est sombre dès que la moitié des points le sont.
//
// JAMAIS À CHAQUE IMAGE. Pendant un défilement (la page, ou une rangée qui défile de côté), une lecture toutes les 150 ms au
// plus, puis une dernière 120 ms après l'arrêt ; et à chaque changement de page (`relire`). Une lecture : six
// elementsFromPoint et quelques getComputedStyle.
const PAS = 150;
const SEUIL = 0.42;

function fonce(el, barre) {
  for (let n = el, i = 0; n && i < 10; n = n.parentElement, i++) {
    if (barre.contains(n)) return false;
    if (/^(IMG|VIDEO|CANVAS|PICTURE)$/.test(n.tagName)) return false;
    const s = getComputedStyle(n);
    if (s.backgroundImage && s.backgroundImage.includes('url(')) return false;
    const m = /rgba?\(([^)]+)\)/.exec(s.backgroundColor);
    if (!m) continue;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (!(a >= 0.5)) continue;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < SEUIL;
  }
  return false;
}

/* `barre` : l'élément de la barre (.dashboard-sidebar) ; `poser(sombre)` n'est appelé que quand la teinte change.
   Rend { relire, debrancher }. */
export function suivreTeinte(barre, poser) {
  let etat = null;
  let minuteur = 0;
  let fin = 0;
  let derniere = 0;

  const lire = () => {
    minuteur = 0;
    derniere = performance.now();
    const nav = barre.querySelector('.dashboard-nav');
    if (!nav || !nav.offsetHeight) return;
    const r = nav.getBoundingClientRect();
    const largeur = window.innerWidth;
    let sombres = 0;
    // Deux lignes (au tiers et aux deux tiers de la hauteur) : une carte iris qui ne couvre que le bas de la barre compte déjà.
    for (const fy of [0.3, 0.7]) {
      for (const fx of [0.2, 0.5, 0.8]) {
        const sous = document.elementsFromPoint(largeur * fx, r.top + r.height * fy).find((e) => !barre.contains(e));
        if (sous && fonce(sous, barre)) sombres += 1;
      }
    }
    const sombre = sombres >= 3;
    if (sombre !== etat) { etat = sombre; poser(sombre); }
  };
  const surDefilement = () => {
    clearTimeout(fin);
    fin = setTimeout(lire, 120);
    if (minuteur) return;
    minuteur = setTimeout(lire, Math.max(0, PAS - (performance.now() - derniere)));
  };
  window.addEventListener('scroll', surDefilement, { passive: true, capture: true });
  window.addEventListener('resize', surDefilement, { passive: true });

  // Après un changement de page : tout de suite, puis quand le contenu (chargé après coup) a pris sa place.
  let suites = [];
  const relire = () => {
    suites.forEach(clearTimeout);
    suites = [0, 400, 1200].map((ms) => setTimeout(lire, ms));
  };
  relire();

  return {
    relire,
    debrancher() {
      window.removeEventListener('scroll', surDefilement, { capture: true });
      window.removeEventListener('resize', surDefilement);
      clearTimeout(minuteur); clearTimeout(fin); suites.forEach(clearTimeout);
    }
  };
}
