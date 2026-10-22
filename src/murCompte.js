import { cheminFiche } from './adresseFiche';

// Ouvrir la carte d'un commerce depuis Fairide demande un compte (fondateur, 2026-09-27 pour la liste ; étendu le
// 2026-10-20 à la recherche et à la rangée « Découvrir » d'une fiche, qui laissaient passer un visiteur sans compte).
// Une seule règle pour tous ces liens : connecté, on va à la fiche ; sinon à la connexion, la fiche en `from`, et
// Auth.jsx (ou ConnexionAppli) y ramène une fois connecté ou inscrit.
// La ROUTE /restaurants/:id reste publique (App.jsx) : un lien partagé, un moteur de recherche ou une page prérendue y
// mènent toujours directement. Seuls les clics faits DANS Fairide passent par ici.
// `nom` : le nom du commerce, dit sur la page de connexion (« Pour voir la carte de … », audit du 19/10, LIVE-23).
// `commerce` : le commerce lui-même (le lien prend son adresse lisible, adresseFiche.js) ou son seul identifiant.
export function lienFiche(user, commerce, nom) {
  const fiche = cheminFiche(commerce);
  return user ? { to: fiche, state: undefined } : { to: '/login?audience=client', state: { from: fiche, ...(nom ? { commerce: nom } : {}) } };
}
