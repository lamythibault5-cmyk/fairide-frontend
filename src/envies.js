// Les « envies » choisies à l'accueil de l'application (pages/app/Bienvenue.jsx, écran « Tu as envie de quoi ? ») et les
// commerces qui y répondent : l'écran de résultats de l'accueil les met en tête. Elles sont gardées sous `familles` dans le
// téléphone (bienvenue.js), jamais envoyées.
//
// RIEN AILLEURS DEPUIS LE 2026-10-26 (fondateur : « l'écran est juste pour le plaisir, il ne doit rien changer »). La page
// Restaurants les lisait (2026-10-13 → 10-26) : rangée « Tes envies » en haut, familles cochées en tête de la bande des
// cuisines avec un point lime. Tout le monde y voit maintenant la même page.
import { famillesCommerce } from './specialites';

// Le commerce sert-il au moins une de ces familles ?
export function repondAuxEnvies(r, familles) {
  if (!familles.length) return false;
  const siennes = famillesCommerce(r);
  return familles.some((f) => siennes.has(f));
}
