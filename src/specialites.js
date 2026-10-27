/* LES SPÉCIALITÉS ET LEURS FAMILLES (fondateur, 2026-10-22, maquettes/categories-commerce/categories-commerce.html).
 *
 * Les commerces ne trouvaient pas leur catégorie : 35 types à plat, rien pour un congolais, un turc, une crêperie (« congo »
 * dans la recherche de l'app ne trouvait que « Autre », et un commerce « Autre » n'est dans aucun filtre). Deux niveaux :
 *   - les SPÉCIALITÉS (~150), que le commerce choisit : jusqu'à 7, la première est son type principal
 *     (restaurants.cuisine), les autres ses types en plus (restaurants.extra_cuisines) ;
 *   - les FAMILLES (19), que le client voit dans la bande de l'accueil, « Par envie » et la carte. Une spécialité est
 *     rangée dans une ou plusieurs familles (un « Grec » est en Orient ET en Europe) ; la famille se déduit, rien n'est
 *     stocké. Une spécialité saisie à la main (« Je ne trouve pas ») n'a pas de famille, comme « Autre » avant.
 *
 * La VALEUR d'une spécialité est son nom français : c'est elle qui est enregistrée, comme avant. Les 35 types d'avant
 * (RESTAURANT_TYPES, menuCategories.js) en font tous partie sous le même nom : aucun commerce inscrit ne change. Leur
 * libellé traduit est `menuCategories.cuisine.<valeur>` (restaurantTypeLabel), celui d'une famille
 * `menuCategories.famille.<clé>` (et `familleCourt` pour la bande). Les `mots` sont ce que les gens tapent (pays, plats,
 * orthographes) : la recherche les lit avec le libellé traduit et le nom des familles.
 *
 * Copie côté serveur, à garder pareille : fairide-backend/specialitesCommerce.js (photo de couverture par famille,
 * casse des noms, devinette du type depuis le site). */
import { restaurantTypeLabel } from './menuCategories';

// [clé, illustration (public/cuisines/<x>.webp et cuisines-2d/), fond pastel, icône (Icone.jsx) ailleurs que sur la bande].
export const FAMILLES = [
  ['pizza', 'pizza', '#FFE6D8', 'pizza'],
  ['burger', 'burger', '#FFF0D2', 'burger'],
  ['snack', 'friterie', '#FFF5CF', 'frites'],
  ['kebab', 'kebab', '#F7E7DA', 'restaurants'],
  ['sandwich', 'sandwichs', '#F4F0DC', 'restaurants'],
  ['japon', 'sushi', '#FFE3E3', 'poisson'],
  ['asie', 'asiatique', '#FDE6E1', 'bol'],
  ['inde', 'indien', '#FFF0D6', 'bol'],
  ['orient', 'libanais', '#ECF4D8', 'restaurants'],
  ['maghreb', 'marocain', '#E6F2EE', 'bol'],
  ['afrique', 'africain', '#F8E6D6', 'bol'],
  ['ameriques', 'mexicain', '#FFF0CF', 'restaurants'],
  ['europe', 'belge', '#FFF0CC', 'frites'],
  ['healthy', 'healthy', '#E3F5DD', 'feuille'],
  ['poisson', 'poisson', '#E1EEFA', 'poisson'],
  ['cafe', 'brunch', '#FFF1D9', 'tasse'],
  ['sucre', 'desserts', '#FDE7F1', 'tasse'],
  ['boulangerie', 'boulangerie', '#FBEEDB', 'commerce'],
  ['courses', 'supermarche', '#E4EEFB', 'sac']
].map(([cle, illustration, fond, icone]) => ({ cle, illustration, fond, icone }));
const FAMILLE = Object.fromEntries(FAMILLES.map((f) => [f.cle, f]));

// [valeur, familles (la première est la sienne : son dessin, sa place dans la liste), mots tapés, illustration propre].
export const SPECIALITES = [
  ['Pizza', 'pizza', 'pizzeria', 'pizza'], ['Italien', 'pizza', 'italie trattoria osteria', 'italien'], ['Pâtes', 'pizza', 'pasta spaghetti lasagne carbonara bolognaise'],
  ['Pizza à la part', 'pizza', 'al taglio slice part'], ['Piadina & Focaccia', 'pizza sandwich', 'piadina focaccia'],
  ['Burgers', 'burger', 'burger hamburger cheeseburger', 'burger'], ['Smash burger', 'burger', 'smash'],
  ['Fried Chicken', 'burger', 'poulet frit chicken tenders nuggets', 'poulet'], ['Chicken wings', 'burger', 'ailes ailerons wings'],
  ['Poulet rôti', 'burger', 'rotisserie rôtisserie poulet broche'], ['Hot-dog', 'burger snack', 'hotdog hot dog'],
  ['Friterie', 'snack europe', 'frites fritkot friture frituur baraque', 'friterie'], ['Snack', 'snack', 'fast food snack'],
  ['Tacos français', 'snack', "o'tacos otacos french tacos"], ['Mitraillette', 'snack europe', 'mitraillette'], ['Wraps', 'snack sandwich', 'wrap'],
  ['Panini & Croques', 'snack sandwich', 'panini croque monsieur toast'],
  ['Kebab & Grill', 'kebab', 'kebab kebap', 'kebab'], ['Döner & Dürüm', 'kebab orient', 'doner durum'], ['Pitta', 'kebab orient', 'pita pitta'],
  ['Grillades', 'kebab', 'grill brochettes viande'], ['Barbecue', 'kebab ameriques', 'bbq smokehouse ribs'], ['Steakhouse', 'kebab europe', 'steak viande entrecote'],
  ['Sandwichs & Salades', 'sandwich', 'sandwicherie sandwich salade broodjes', 'sandwichs'], ['Bagels', 'sandwich cafe', 'bagel'],
  ['Bar à salades', 'sandwich healthy', 'salade salad bar'],
  ['Sushi', 'japon poisson', 'maki sashimi california', 'sushi'], ['Japonais', 'japon asie', 'japon izakaya donburi gyoza'], ['Ramen', 'japon asie', 'nouilles', 'ramen'],
  ['Udon & Soba', 'japon asie', 'udon soba'], ['Poke Bowl', 'japon healthy', 'poke poké', 'poke'], ['Bento & Onigiri', 'japon', 'bento onigiri'],
  ['Asiatique', 'asie', 'asie asian', 'asiatique'], ['Chinois', 'asie', 'chine cantonais sichuan', 'chinois'], ['Dim sum', 'asie', 'dimsum raviolis dumplings'],
  ['Wok', 'asie', 'nouilles sautees'], ['Bao', 'asie', 'bao buns'], ['Thaïlandais', 'asie', 'thai pad', 'thai'],
  ['Vietnamien', 'asie', 'vietnam pho bo bun banh mi', 'vietnamien'], ['Coréen', 'asie', 'coree korean bibimbap', 'coreen'],
  ['Indonésien', 'asie', 'indonesie nasi goreng'], ['Malaisien', 'asie', 'malaisie'], ['Philippin', 'asie', 'philippines'],
  ['Cambodgien & Laotien', 'asie', 'cambodge laos'], ['Taïwanais', 'asie', 'taiwan'], ['Hot pot & Fondue chinoise', 'asie', 'hotpot fondue'],
  ['Indien', 'inde', 'inde curry tandoori biryani naan', 'indien'], ['Pakistanais', 'inde', 'pakistan'], ['Népalais & Tibétain', 'inde', 'nepal tibet momo'],
  ['Sri lankais', 'inde', 'sri lanka'], ['Bangladais', 'inde', 'bangladesh'], ['Afghan', 'inde orient', 'afghanistan'],
  ['Libanais', 'orient', 'liban houmous', 'libanais'], ['Turc', 'orient kebab', 'turquie pide lahmacun'], ['Grec', 'orient europe', 'grece gyros souvlaki'],
  ['Syrien', 'orient', 'syrie'], ['Iranien', 'orient', 'iran persan'], ['Irakien', 'orient', 'irak'], ['Kurde', 'orient', 'kurdistan'], ['Arménien', 'orient', 'armenie'],
  ['Égyptien', 'orient', 'egypte koshari'], ['Falafel', 'orient healthy', 'falafel'], ['Shawarma', 'orient kebab', 'chawarma'], ['Mezze', 'orient', 'meze mezze'],
  ['Marocain', 'maghreb', 'maroc', 'marocain'], ['Algérien', 'maghreb', 'algerie'], ['Tunisien', 'maghreb', 'tunisie'], ['Couscous', 'maghreb', 'couscous'],
  ['Tajine', 'maghreb', 'tagine'],
  ['Africain', 'afrique', 'afrique', 'africain'], ['Congolais', 'afrique', 'congo rdc kinshasa matonge pondu fufu'], ['Camerounais', 'afrique', 'cameroun ndole'],
  ['Sénégalais', 'afrique', 'senegal thieb yassa mafe'], ['Ivoirien', 'afrique', "cote d'ivoire abidjan attieke alloco"], ['Nigérian', 'afrique', 'nigeria jollof'],
  ['Ghanéen', 'afrique', 'ghana'], ['Malien', 'afrique', 'mali'], ['Guinéen', 'afrique', 'guinee conakry'], ['Rwandais & Burundais', 'afrique', 'rwanda burundi'],
  ['Éthiopien & Érythréen', 'afrique', 'ethiopie erythree injera'], ['Somalien', 'afrique', 'somalie'], ['Angolais', 'afrique', 'angola'],
  ['Cap-verdien', 'afrique', 'cap vert'], ['Togolais & Béninois', 'afrique', 'togo benin'], ['Burkinabé', 'afrique', 'burkina faso'],
  ['Braise africaine', 'afrique kebab', 'poisson braise poulet braise grillades'],
  ['Mexicain', 'ameriques', 'mexique taco tacos quesadilla', 'mexicain'], ['Tex-Mex', 'ameriques', 'texmex nachos'], ['Burritos', 'ameriques', 'burrito bowl'],
  ['Américain', 'ameriques burger', 'usa diner'], ['Brésilien', 'ameriques', 'bresil'], ['Péruvien', 'ameriques', 'perou ceviche'],
  ['Argentin', 'ameriques kebab', 'argentine empanadas asado'], ['Colombien & Vénézuélien', 'ameriques', 'colombie venezuela arepas'],
  ['Antillais', 'ameriques', 'antilles caraibes caribeen creole guadeloupe martinique'], ['Haïtien', 'ameriques', 'haiti'],
  ['Jamaïcain', 'ameriques', 'jamaique jerk'], ['Cubain', 'ameriques', 'cuba'],
  ['Belge', 'europe', 'belgique carbonnade boulettes stoemp vol-au-vent', 'belge'], ['Cuisine Familiale', 'europe', 'famille partager grandes portions', 'familiale'],
  ['Français', 'europe', 'france bistrot'], ['Brasserie', 'europe', 'brasserie'], ['Espagnol', 'europe', 'espagne tapas paella', 'espagnol'],
  ['Portugais', 'europe', 'portugal bifana'], ['Polonais', 'europe', 'pologne pierogi'], ['Roumain', 'europe', 'roumanie'], ['Ukrainien', 'europe', 'ukraine bortsch'],
  ['Géorgien', 'europe', 'georgie khachapuri'], ['Balkans', 'europe', 'bosnie serbie croatie albanie cevapi burek'], ['Britannique', 'europe', 'anglais english'],
  ['Moules-frites', 'europe poisson', 'moules'],
  ['Healthy', 'healthy', 'sain', 'healthy'], ['Cuisine Saine', 'healthy', 'sain assiette', 'saine'], ['Végétarien', 'healthy', 'vege veggie', 'vegetarien'],
  ['Vegan', 'healthy', 'vegan vegetalien plant based'], ['Bowls', 'healthy', 'bowl buddha'], ['Jus & Smoothies', 'healthy cafe', 'jus smoothie detox'],
  ['Açaí', 'healthy sucre', 'acai'],
  ['Poisson & Fruits de mer', 'poisson', 'fruits de mer crevettes', 'poisson'], ['Fish & chips', 'poisson europe', 'fish and chips'],
  ['Huîtres & Crustacés', 'poisson', 'huitres homard crabe'],
  ['Petit-déjeuner & Brunch', 'cafe', 'brunch petit dejeuner oeufs', 'brunch'], ['Coffee Shop', 'cafe', 'cafe coffee latte', 'cafe'],
  ['Bubble Tea', 'cafe sucre', 'boba', 'bubbletea'], ['Salon de thé', 'cafe', 'the tea'], ['Pancakes', 'cafe sucre', 'pancake'],
  ['Desserts & Glaces', 'sucre', 'dessert glace', 'desserts'], ['Glacier', 'sucre', 'glaces gelato'], ['Gaufres', 'sucre europe', 'gaufre liege bruxelles'],
  ['Crêpes', 'sucre', 'creperie galettes'], ['Cookies & Donuts', 'sucre', 'cookie donut doughnut'], ['Chocolatier', 'sucre', 'chocolat pralines'],
  ['Churros', 'sucre', 'churros'], ['Cheesecake & Gâteaux', 'sucre boulangerie', 'gateau cheesecake tiramisu'],
  ['Pâtisserie orientale', 'sucre orient boulangerie', 'baklava'], ['Milkshakes', 'sucre', 'milkshake'],
  ['Boulangerie', 'boulangerie', 'pain boulanger bakkerij', 'boulangerie'], ['Pâtisserie', 'boulangerie sucre', 'gateaux'],
  ['Viennoiseries', 'boulangerie cafe', 'croissant'], ['Boulangerie du monde', 'boulangerie', 'turque marocaine portugaise polonaise'],
  ['Supermarché', 'courses', 'supermarche courses', 'supermarche'], ['Night Shop', 'courses', 'nightshop epicerie de nuit', 'nightshop'],
  ['Boucherie', 'courses', 'boucher viande halal slagerij', 'boucherie'], ['Épicerie', 'courses', 'alimentation'], ['Épicerie fine', 'courses', 'delicatessen'],
  ['Épicerie du monde', 'courses', 'africaine asiatique orientale exotique'], ['Traiteur', 'courses europe', 'plats prepares'],
  ['Fromagerie', 'courses', 'fromage'], ['Primeur', 'courses', 'fruits legumes'], ['Poissonnerie', 'courses poisson', 'poisson frais'],
  ['Produits bio', 'courses healthy', 'bio']
].map(([value, familles, mots, illustration]) => ({ value, familles: familles.split(' '), mots, illustration: illustration || FAMILLE[familles.split(' ')[0]].illustration }));

/* LES CATÉGORIES DU CLIENT, COMME UBER EATS (fondateur, 2026-10-27 : « plus de boutons sous la bande », « un seul restaurant
 * suffit », « toutes les catégories ont un dessin », « tacos, burritos, tex-mex, c'est la même chose », puis « on ne peut pas
 * juste copier Uber Eats ? » avec la bande d'Uber Eats à Bruxelles en captures). La bande de la liste, « Par envie » de la
 * Recherche et le filtre de la carte montrent ces catégories, à plat (plus de rangée de spécialités dessous), dès qu'un
 * commerce en est. Ce sont celles d'Uber Eats, avec ce qui manque à Bruxelles chez lui (Kebab, Afrique,
 * Libanais, Maghreb, Europe), sans ce qui n'est pas un repas (Halloween, fleurs, animaux, pharmacie). Salades est dans
 * Healthy, Wings dans Poulet, Hawaïen dans Poke, Street food dans Kebab.
 *
 * HALAL, VÉGÉ, VEGAN, SANS GLUTEN (fondateur, 2026-10-27 : « un bouton clair à l'inscription ; s'il clique oui, il est dans la
 * catégorie ») : ce que TOUT le commerce est, déclaré par lui (RegimesCommerce.jsx ; halalAll, vegetarianAll, veganAll,
 * glutenFreeAll, backend migrations 042 et 094). Un commerce vegan est aussi dans Végé.
 *
 * Le commerce choisit toujours des spécialités rangées en familles (ChoixSpecialites, inchangé), et le serveur n'en sait rien :
 * rien n'est stocké. Une spécialité va dans les catégories qui la citent ; sinon dans celles qui prennent une de ses familles.
 * [clé, illustration, familles prises, spécialités citées, déclarations du commerce]. Chaque catégorie a SON dessin (public/cuisines et cuisines-2d,
 * Fluent Emoji), jamais celui d'une autre. Libellés `menuCategories.categorie.<clé>` / `categorieCourt`.
 *
 * DANS L'ORDRE DE CE QU'ON VEUT LE PLUS SOUVENT (fondateur, 2026-10-27 : « pourquoi commencer par le petit-déj ? pizza,
 * burger, indien, sushi, poulet frit, fast-food, thaï, petit-déj ») : ces huit en tête, puis le reste à peu près par demande
 * à Bruxelles. Depuis le même jour, la bande se range au nombre de commerces (categoriesClient, plus bas) : cet ordre ne
 * fait plus que départager deux catégories à égalité, et compte pour `deSpecialite` (la première catégorie qui cite une
 * spécialité) : Turc va dans Kebab, avant Libanais. Les tuiles par défaut de SearchPage, sans liste chargée, le suivent aussi. */
const LISTE_CATEGORIES = [
  ['pizza', 'pizza', [], ['Pizza', 'Pizza à la part']],
  ['burgers', 'burger', ['burger'], []],
  ['indien', 'indien', ['inde'], []],
  ['sushi', 'sushi', [], ['Sushi']],
  ['poulet', 'poulet', [], ['Fried Chicken', 'Chicken wings', 'Poulet rôti']],
  ['fastfood', 'friterie', ['snack'], []],
  ['thai', 'thai', [], ['Thaïlandais']],
  ['petitdej', 'brunch', [], ['Petit-déjeuner & Brunch', 'Pancakes']],
  ['kebab', 'kebab', ['kebab'], ['Turc']],
  ['asiatique', 'asiatique', ['asie'], []],
  ['japonais', 'ramen', ['japon'], []],
  ['chinois', 'chinois', [], ['Chinois', 'Dim sum']],
  ['italien', 'italien', ['pizza'], []],
  ['mexicain', 'mexicain', [], ['Mexicain', 'Tex-Mex', 'Burritos', 'Tacos français']],
  ['halal', 'halal', [], [], ['halalAll']],
  ['libanais', 'libanais', ['orient'], ['Turc']],
  ['maghreb', 'marocain', ['maghreb'], []],
  ['poke', 'poke', [], ['Poke Bowl']],
  ['healthy', 'healthy', ['healthy'], []],
  ['sandwichs', 'sandwichs', ['sandwich'], []],
  ['glaces', 'desserts', [], ['Glacier', 'Desserts & Glaces', 'Milkshakes']],
  ['desserts', 'cookie', ['sucre'], ['Desserts & Glaces']],
  ['boulangerie', 'boulangerie', ['boulangerie'], []],
  ['cafe', 'cafe', ['cafe'], []],
  ['bubbletea', 'bubbletea', [], ['Bubble Tea']],
  ['coreen', 'coreen', [], ['Coréen']],
  ['vietnamien', 'vietnamien', [], ['Vietnamien']],
  ['grec', 'grec', [], ['Grec']],
  ['americain', 'hotdog', [], ['Américain', 'Hot-dog', 'Steakhouse']],
  ['bbq', 'bbq', [], ['Barbecue', 'Grillades', 'Argentin']],
  ['poisson', 'poisson', ['poisson'], []],
  ['europe', 'belge', ['europe'], []],
  ['afrique', 'africain', ['afrique'], []],
  ['latino', 'latino', ['ameriques'], ['Argentin']],
  ['familiale', 'familiale', [], ['Cuisine Familiale']],
  ['smoothies', 'smoothie', [], ['Jus & Smoothies']],
  ['vege', 'vegetarien', [], ['Végétarien', 'Vegan'], ['vegetarianAll', 'veganAll']],
  ['vegan', 'vegan', [], ['Vegan'], ['veganAll']],
  ['sansgluten', 'sansgluten', [], [], ['glutenFreeAll']],
  ['courses', 'supermarche', ['courses'], []]
];
export const CATEGORIES_CLIENT = LISTE_CATEGORIES.map(([cle, illustration, familles, specialites, declarations = []]) => {
  const sienne = FAMILLE[familles[0] || SPECIALITES.find((s) => s.value === specialites[0])?.familles[0] || 'healthy'];
  return { cle, illustration, familles, specialites, declarations, fond: sienne.fond, icone: sienne.icone };
});
const CITEES = new Map();
CATEGORIES_CLIENT.forEach((c) => c.specialites.forEach((s) => CITEES.set(s, [...(CITEES.get(s) || []), c.cle])));
const categoriesDeSpecialite = (s) => CITEES.get(s.value) || CATEGORIES_CLIENT.filter((c) => c.familles.some((f) => s.familles.includes(f))).map((c) => c.cle);

// Les catégories d'un commerce, par toutes ses spécialités et ce qu'il a déclaré.
const categoriesDe = (r) => new Set([
  ...cuisinesCommerce(r).map(specialite).filter(Boolean).flatMap(categoriesDeSpecialite),
  ...CATEGORIES_CLIENT.filter((c) => c.declarations.some((d) => r?.[d] === true)).map((c) => c.cle)
]);

// Les catégories de cette liste de commerces : `liste` (celles qui en ont au moins un, plus `garder`, celle déjà choisie),
// `de(r)` (celles d'un commerce) et `deSpecialite(valeur)` (la première où se trouve une spécialité).
// LA BANDE SUIT CE QU'ON A (fondateur, 2026-10-27) : les courses d'abord, puis la catégorie qui a le plus de commerces
// jusqu'à celle qui en a le moins ; à égalité, l'ordre de LISTE_CATEGORIES. Ce dernier ne sert donc plus qu'à départager
// et à `deSpecialite`.
const EN_TETE = ['courses'];
export function categoriesClient(restaurants, { garder = '' } = {}) {
  const compte = new Map();
  restaurants.forEach((r) => categoriesDe(r).forEach((cle) => compte.set(cle, (compte.get(cle) || 0) + 1)));
  const rang = (c) => (EN_TETE.includes(c.cle) ? -1 : 0);
  return {
    liste: CATEGORIES_CLIENT.filter((c) => compte.has(c.cle) || c.cle === garder)
      .sort((a, b) => rang(a) - rang(b) || (compte.get(b.cle) || 0) - (compte.get(a.cle) || 0)),
    de: categoriesDe,
    deSpecialite: (valeur) => { const s = specialite(valeur); return s ? categoriesDeSpecialite(s)[0] || '' : ''; }
  };
}

// Ce que tout le commerce est (RegimesCommerce.jsx), tel que l'API le lit et l'écrit : la fiche, l'inscription, PATCH /:id/diet.
export const REGIMES_COMMERCE = ['halalAll', 'vegetarianAll', 'veganAll', 'glutenFreeAll'];
export const regimesDe = (r) => Object.fromEntries(REGIMES_COMMERCE.map((cle) => [cle, r?.[cle] === true]));

export function libelleCategorie(cle, t, { court = false } = {}) {
  return t(`menuCategories.${court ? 'categorieCourt' : 'categorie'}.${cle}`);
}

// Ce que le commerce peut choisir en tout : le type principal et 6 autres (restaurants.extra_cuisines, 6 au plus).
export const MAX_SPECIALITES = 7;

// Recherche insensible à la casse, aux accents et à la ponctuation (« Döner » = « doner », « o'tacos » = « o tacos »).
export function sansAccents(texte) {
  return String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const PAR_VALEUR = new Map(SPECIALITES.map((s) => [s.value.toLowerCase(), s]));
// Anciens noms encore en base (le type « Sandwicherie » a été renommé, voir schema.sql).
PAR_VALEUR.set('sandwicherie', PAR_VALEUR.get('sandwichs & salades'));

// La spécialité d'une valeur enregistrée (casse indifférente), ou null : saisie à la main, « Autre ».
export function specialite(valeur) {
  return PAR_VALEUR.get(String(valeur || '').trim().toLowerCase()) || null;
}

// Les cuisines d'un commerce : la principale puis les autres (la liste publique porte aussi `cuisines`, déjà dans cet ordre).
export function cuisinesCommerce(r) {
  return (r?.cuisines || [r?.cuisine, ...(r?.extraCuisines || [])]).filter(Boolean);
}

// Les familles d'un commerce, par toutes ses spécialités. Vide pour un commerce saisi à la main seulement.
export function famillesCommerce(r) {
  return new Set(cuisinesCommerce(r).flatMap((c) => specialite(c)?.familles || []));
}

export function famille(cle) {
  return FAMILLE[cle] || null;
}

export function libelleFamille(cle, t, { court = false } = {}) {
  return t(`menuCategories.${court ? 'familleCourt' : 'famille'}.${cle}`);
}

// Le dessin d'une valeur (le sien ou celui de sa famille), null pour une spécialité saisie à la main.
export function illustrationSpecialite(valeur) {
  return specialite(valeur)?.illustration || null;
}

// L'icône à trait (Icone.jsx) d'une valeur : celle de sa famille, « restaurants » à défaut.
export function iconeSpecialite(valeur) {
  const s = specialite(valeur);
  return (s && FAMILLE[s.familles[0]].icone) || 'restaurants';
}

// LA RECHERCHE QUI COMPREND : chaque mot tapé doit commencer un mot du libellé (français et traduit), des mots tapés
// d'habitude ou du nom d'une de ses familles. « congo » trouve Congolais, « pho » Vietnamien, « afrique » toute l'Afrique.
// Les spécialités dont le libellé commence par la recherche passent devant.
const cacheCles = new Map();
function clesDe(s, t) {
  const libelle = restaurantTypeLabel(s.value, t);
  const cle = `${s.value}|${libelle}|${libelleFamille(s.familles[0], t)}`; // la langue change les deux
  if (!cacheCles.has(cle)) {
    cacheCles.set(cle, sansAccents([s.value, libelle, s.mots, ...s.familles.map((f) => libelleFamille(f, t))].join(' ')).split(' '));
  }
  return cacheCles.get(cle);
}
export function chercherSpecialites(recherche, t) {
  const debut = sansAccents(recherche);
  const mots = debut.split(' ').filter(Boolean);
  if (!mots.length) return [];
  const commence = (s) => (sansAccents(restaurantTypeLabel(s.value, t)).startsWith(debut) ? 0 : 1);
  return SPECIALITES.filter((s) => { const cles = clesDe(s, t); return mots.every((m) => cles.some((c) => c.startsWith(m))); })
    .sort((a, b) => commence(a) - commence(b));
}
