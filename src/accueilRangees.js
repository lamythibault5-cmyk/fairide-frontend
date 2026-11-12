/* L'ACCUEIL PLEIN (fondateur, 2026-11-12, maquettes/accueil-plein/accueil-plein.html, sections 3 et 4 ; réponses du
 * questionnaire : 1 oui, 2 oui, 3 « Tous les commerces » en grandes cartes, 4 commandables d'abord dans « À la une » et
 * « Tous » seulement, 4 bis bandes de distance + chacun son tour, 5 « Déjà sur fairride » retiré, 6 titre touchable sans
 * nombre, 7 site pareil).
 *
 * Ce qui n'allait pas (mesuré sur la vraie liste du 12/11, client à Flagey) : 20 à 21 des 29 commerces publics n'apparaissaient
 * nulle part sur l'accueil (« Autour de toi » coupé à 15, « À découvrir » = 8 tirés au sort), et les mêmes 2-3 commerces
 * ouverts les plus proches étaient premiers de plusieurs rangées (Sushi Wa et Bambini en tête d'« Autour de toi » ET
 * d'« À découvrir ») : chaque rangée triait pareil sans regarder ce que les rangées du dessus montraient déjà.
 *
 * Les règles, dans cet ordre, pour chaque rangée :
 *   1. les ouverts d'abord (fondateur, 2026-10-25), toujours ;
 *   2. le plus proche d'abord, par BANDES de distance (BANDES_KM ; sans position, l'anneau de communes de « manger local ») :
 *      un commerce ne passe jamais devant un commerce d'une bande plus proche (fondateur, 2026-11-12 : « si la personne est
 *      près de Snack bodrum, on ne lui dit pas de commander à Molenbeek ») ;
 *   3. dans une bande, chacun son tour : l'ordre change à chaque visite (règle du 06/10 : personne n'a payé pour cette rangée,
 *      personne n'y est avantagé par l'ordre) ; « À la une » et « Autour de toi » n'ont pas de tour, leur titre promet le
 *      plus proche ;
 *   4. UNE TÊTE PAR RANGÉE : les cartes vues sans glisser (TETE_N) vont à des commerces qui ne sont pas déjà premiers plus haut
 *      dans la page — mais seulement à l'intérieur d'un même groupe (ouverture, bande) : la règle ne fait jamais venir un
 *      commerce de plus loin. Quand un voisin est le seul ouvert de plusieurs catégories, il mène donc plusieurs rangées
 *      (DeliSpice, 4 rangées à Woluwe le soir) : c'est voulu, le local d'abord.
 * Une position payée garde sa place, marquée « Sponsorisé » (misesEnAvant.js › epingler, appelé après) : la règle range les
 * autres autour. /classement (conformite.ranking_*) décrit exactement ceci : le changer avec ce fichier.
 *
 * Essayé et pas retenu (section 4 de la maquette, 200 visites simulées × 5 adresses × 2 heures) : les commandables avant les
 * « Carte seule » dans TOUTES les rangées (les 8 commerces signés revenaient en tête de tout, PIZZA MARHABA HALAL premier de
 * 3 rangées) ; ne compter que les 3 premières spécialités pour les rangées (Café Joyeux et L'arbre à pain tombaient à zéro). */

// Les bandes de distance (km) : moins de 1,5 · 1,5 à 3 · 3 à 5 · 5 à 8 · plus loin.
export const BANDES_KM = [1.5, 3, 5, 8];
// Les cartes vues sans glisser au téléphone : deux.
export const TETE_N = 2;

/* LES RANGÉES PAR ENVIE : une par catégorie de la bande (categoriesClient, specialites.js) qui a au moins ENVIE_MIN commerces,
 * la plus fournie d'abord, ENVIES_MAX au plus, PAR_RANGEE_ENVIE cartes chacune (le titre touchable ouvre la catégorie
 * entière). Pas de rangée pour :
 *   - les courses (leur rangée existe déjà) ;
 *   - une catégorie trop vague pour une envie : « Europe » (elle vient de « Belge ») mettait Café Joyeux à côté d'un kebab,
 *     « Cuisine familiale » ne dit pas ce qu'on mange ;
 *   - les régimes (végé, vegan, sans gluten, halal) : ce sont des déclarations, pas des envies, et les mentions
 *     alimentaires sont masquées aux clients (dietary.js › MENTIONS_ALIMENTAIRES) ;
 *   - une catégorie dont plus de la moitié des commerces sont déjà dans une rangée gardée (« Glaces » et « Desserts »
 *     avaient les 4 mêmes) : deux rangées presque pareilles feraient la page répétitive, le contraire du but. */
export const ENVIE_MIN = 4;
export const ENVIES_MAX = 6;
export const PAR_RANGEE_ENVIE = 10;
const SANS_RANGEE = ['courses', 'europe', 'familiale', 'vege', 'vegan', 'sansgluten', 'halal'];

export function rangeesEnvies(commerces, categories, { exclure = [] } = {}) {
  const gardees = [];
  for (const c of categories.liste) {
    if (gardees.length >= ENVIES_MAX) break;
    if (SANS_RANGEE.includes(c.cle) || exclure.includes(c.cle)) continue;
    const liste = commerces.filter((r) => categories.de(r).has(c.cle));
    if (liste.length < ENVIE_MIN) continue;
    if (gardees.some((g) => liste.filter((r) => g.liste.includes(r)).length > liste.length / 2)) continue;
    gardees.push({ cle: c.cle, illustration: c.illustration, liste });
  }
  return gardees;
}

// Un tirage stable par visite (même formule que `melanger` d'avant dans RestaurantList.jsx) : la graine est tirée une fois
// par visite de la page, sinon chaque rafraîchissement rebattrait les cartes sous les yeux du client.
export function poidsVisite(graine, id) {
  let h = 2166136261;
  const s = `${graine}:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Un rangement pour UNE page : `tetes` se remplit rangée après rangée, dans l'ordre où la page les montre. À recréer à chaque
 * rendu (les rangées dépendent de l'heure, de la liste et de l'adresse).
 *   - distanceDe(r) : km depuis l'adresse du client, ou null (pas de position, ou commerce sans coordonnées) ;
 *   - avecPosition : le client a une position (sinon on range par anneau de communes, `rang`) ;
 *   - rang(r) : anneau de communes autour de la sienne (0 = la sienne), Infinity si inconnu ;
 *   - estOuvert(r), peutCommander(r) : ouvert à ses horaires ; ouvert ET commandable maintenant (peutCommander.js). */
export function creerRangement({ distanceDe, avecPosition, rang, graine, estOuvert, peutCommander }) {
  const bande = (r) => {
    if (avecPosition) {
      const km = distanceDe(r);
      if (km == null) return BANDES_KM.length + 1; // sans coordonnées : après tout le monde, mais toujours montré
      const i = BANDES_KM.findIndex((b) => km < b);
      return i < 0 ? BANDES_KM.length : i;
    }
    const a = rang(r);
    return Number.isFinite(a) ? a : 99;
  };
  const tour = (r) => poidsVisite(graine, r.id);
  // Rangée à thème : la bande la plus proche d'abord, chacun son tour dans la bande.
  const parBandeEtTour = (liste) => [...liste].sort((a, b) => bande(a) - bande(b) || tour(a) - tour(b));
  // Ouvert (0) ou fermé (2) ; dans « Tous » : ouvert et commandable (0), ouvert « Carte seule » ou pas encore commandable (1), fermé (2).
  const niveauOuvert = (r) => (estOuvert(r) ? 0 : 2);
  const niveauCommande = (r) => (!estOuvert(r) ? 2 : peutCommander(r) ? 0 : 1);
  const tetes = new Set();

  /* La règle de tête. `liste` arrive dans l'ordre propre de la rangée (distance, tour, prix…) ; on la regroupe par
   * (niveau, bande) — `parBande: false` pour une rangée qui n'est pas rangée par distance (prix de livraison) —, et dans
   * chaque groupe ceux qui ne sont encore premiers nulle part passent devant, sans changer l'ordre entre eux. Les `n`
   * premiers deviennent des têtes pour la suite de la page. */
  function uneTete(liste, { n = TETE_N, commande = false, parBande = true } = {}) {
    const niveau = commande ? niveauCommande : niveauOuvert;
    const cle = (r) => niveau(r) * 1000 + (parBande ? bande(r) : 0);
    const groupes = [...new Set(liste.map(cle))].sort((a, b) => a - b);
    const range = groupes.flatMap((g) => {
      const x = liste.filter((r) => cle(r) === g);
      return [...x.filter((r) => !tetes.has(r.id)), ...x.filter((r) => tetes.has(r.id))];
    });
    range.slice(0, n).forEach((r) => tetes.add(r.id));
    return range;
  }
  // Une rangée qu'on ne réordonne pas (À la une, Courses, Healthy…) : ses premières cartes comptent quand même comme têtes.
  function retenir(liste, n = TETE_N) {
    liste.slice(0, n).forEach((r) => tetes.add(r.id));
    return liste;
  }
  return { bande, parBandeEtTour, uneTete, retenir };
}
