// Les « envies » choisies à l'accueil de l'application (pages/app/Bienvenue.jsx, écran « Une envie en particulier ? », retiré le
// 2026-10-22 pour raccourcir l'accueil : les envies déjà données sur un téléphone servent encore à la rangée « Vos envies »),
// et les cuisines qui y répondent. Sorti de Bienvenue.jsx le 2026-10-13 pour que la liste des commerces
// (RestaurantList.jsx, rangée « Vos envies ») range avec exactement la même table que l'écran de résultats de l'accueil :
// deux tables séparées auraient fini par ne plus dire la même chose.
//
// PAR FAMILLES DEPUIS LE 2026-10-22 (specialites.js) : une table de noms de cuisines ne connaissait pas les ~110
// spécialités ajoutées ce jour-là (un congolais ne répondait pas à « cuisines du monde »). Chaque envie est un groupe de
// familles ; un commerce y répond par n'importe laquelle de ses spécialités. Un commerce peut répondre à plusieurs envies.
import { famillesCommerce } from './specialites';

export const FAMILLES_PAR_ENVIE = {
  snack: ['snack', 'kebab', 'sandwich'],
  pizza: ['pizza'],
  burger: ['burger'],
  monde: ['japon', 'asie', 'inde', 'orient', 'maghreb', 'afrique', 'ameriques'],
  healthy: ['healthy'],
  sucre: ['cafe', 'sucre', 'boulangerie']
};

// Le commerce répond-il à au moins une des envies ?
export function repondAuxEnvies(r, envies) {
  const familles = famillesCommerce(r);
  return envies.some((e) => (FAMILLES_PAR_ENVIE[e] || []).some((f) => familles.has(f)));
}
