// Les « envies » choisies à l'accueil de l'application (pages/app/Bienvenue.jsx, écran « Tu as envie de quoi ? ») et les
// commerces qui y répondent. Sorti de Bienvenue.jsx le 2026-10-13 pour que la liste des commerces (RestaurantList.jsx,
// rangée « Tes envies » et ordre de la bande des cuisines) range avec exactement la même table que l'écran de résultats de
// l'accueil : deux tables séparées auraient fini par ne plus dire la même chose.
//
// DES FAMILLES DEPUIS LE 2026-10-25 (fondateur, version A de maquettes/onboarding-gouts/onboarding-gouts.html) : l'écran
// revient après la position, avec les vraies familles de specialites.js (celles qui ont un commerce qui livre chez toi).
// Elles sont gardées sous `familles` dans le téléphone (bienvenue.js), jamais envoyées. L'ancien écran (2026-10-11 → 10-22)
// gardait 6 envies larges sous `envies` : un téléphone qui y avait répondu les garde, traduites en familles par
// FAMILLES_PAR_ENVIE (un « sucre » d'alors couvrait aussi café et boulangerie, d'où une clé à part).
import { famillesCommerce, FAMILLES } from './specialites';
import { lireBienvenue } from './bienvenue';

export const FAMILLES_PAR_ENVIE = {
  snack: ['snack', 'kebab', 'sandwich'],
  pizza: ['pizza'],
  burger: ['burger'],
  monde: ['japon', 'asie', 'inde', 'orient', 'maghreb', 'afrique', 'ameriques'],
  healthy: ['healthy'],
  sucre: ['cafe', 'sucre', 'boulangerie']
};
const CLES = new Set(FAMILLES.map((f) => f.cle));

// Les familles choisies sur ce téléphone, dans l'ordre où elles ont été cochées ; [] si l'accueil n'a rien demandé.
export function lireEnvies() {
  const b = lireBienvenue();
  if (Array.isArray(b.familles)) return b.familles.filter((f) => CLES.has(f));
  if (Array.isArray(b.envies)) return [...new Set(b.envies.flatMap((e) => FAMILLES_PAR_ENVIE[e] || []))];
  return [];
}

// Le commerce sert-il au moins une de ces familles ?
export function repondAuxEnvies(r, familles) {
  if (!familles.length) return false;
  const siennes = famillesCommerce(r);
  return familles.some((f) => siennes.has(f));
}
