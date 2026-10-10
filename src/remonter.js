// REMONTER EN HAUT QUAND L'ÉTAPE CHANGE SANS CHANGER D'ADRESSE (simulation du 10 oct. 2026).
//
// ScrollRestorer.jsx remonte en haut à chaque changement de PAGE (de chemin). Mais l'inscription (Auth.jsx) et la
// création d'un commerce (CreationCommerce.jsx) sont des formulaires en plusieurs étapes sur une seule adresse : le
// restaurateur remplissait l'étape 1, touchait « Continuer » tout en bas, et l'étape 2 s'ouvrait… défilée tout en bas,
// sous ses propres champs. Un commerce testeur s'y est perdu. Même chose pour l'arrivée sur /dashboard depuis /dashboard
// après la création (même chemin : ScrollRestorer ne bouge pas, et le défilement « smooth » d'origine s'interrompait
// dès que la page changeait de hauteur).
//
// Mêmes reprises échelonnées que ScrollRestorer : la nouvelle étape arrive parfois en plusieurs temps (données,
// images, barre d'adresse de Safari). On lâche dès que la personne touche ou fait défiler.
const DELAIS = [0, 50, 150, 300, 500];

function enHaut() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function remonterEnHaut() {
  if (typeof window === 'undefined') return;
  let annule = false;
  const lacher = () => { annule = true; };
  window.addEventListener('touchstart', lacher, { passive: true, once: true });
  window.addEventListener('wheel', lacher, { passive: true, once: true });
  DELAIS.forEach((d) => setTimeout(() => { if (!annule) enHaut(); }, d));
  setTimeout(() => {
    window.removeEventListener('touchstart', lacher);
    window.removeEventListener('wheel', lacher);
  }, DELAIS[DELAIS.length - 1] + 50);
}
