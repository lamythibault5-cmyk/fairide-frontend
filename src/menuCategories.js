export const CATEGORIES = [
  { value: 'entree', label: 'Entrées', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=200&q=80' },
  { value: 'plat', label: 'Plats', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80' },
  { value: 'dessert', label: 'Desserts', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&q=80' },
  { value: 'boisson', label: 'Boissons', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&q=80' }
];

// Ne traduit que les 4 catégories par défaut (clés internes stables) — une section personnalisée
// tapée par le restaurateur (ex. "Nos spécialités") est stockée telle quelle et doit s'afficher
// telle quelle, pas comme une clé i18n cassée (menuCategories.category.Nos spécialités).
export function categoryLabel(value, t) {
  const isDefault = CATEGORIES.some((c) => c.value === value);
  if (t && isDefault) return t(`menuCategories.category.${value}`);
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

// Sections personnalisées (tapées par le restaurateur, ou — surtout — issues de la lecture automatique
// d'une carte importée : voir menuImport.js côté backend, dont le prompt reprend explicitement le nom
// de section tel qu'écrit sur le document, ex. "Pizzas", "Nos Burgers", "Vins") : aucune correspondance
// exacte avec les 4 catégories internes, mais on peut souvent deviner le bon type de photo à partir du
// nom plutôt que de renvoyer '' — sans ça, defaultItemImage() ci-dessous finissait sur une image cassée
// (<img src="">, sans garde contrairement à l'icône d'en-tête de section) pour tout plat importé dont
// le nom ne matchait aucun mot-clé, un bug concret sur les menus importés signalé par le restaurateur.
const CATEGORY_HINT_DESSERT = /dessert|sucr|glace|pâtisserie|patisserie|gâteau|gateau/iu;
const CATEGORY_HINT_DRINK = /boisson|breuvage|soft|vin\b|vins\b|bière|biere|cocktail|café|the\b|thé|jus\b|eau\b|cave/iu;
const CATEGORY_HINT_ENTREE = /entrée|entree|apéritif|aperitif|salade|starter|mise en bouche/iu;

export function categoryImage(value) {
  const known = CATEGORIES.find((c) => c.value === value)?.image;
  if (known) return known;
  const v = (value || '').toLowerCase();
  if (CATEGORY_HINT_DESSERT.test(v)) return CATEGORIES.find((c) => c.value === 'dessert').image;
  if (CATEGORY_HINT_DRINK.test(v)) return CATEGORIES.find((c) => c.value === 'boisson').image;
  if (CATEGORY_HINT_ENTREE.test(v)) return CATEGORIES.find((c) => c.value === 'entree').image;
  return CATEGORIES.find((c) => c.value === 'plat').image;
}

// Sous-sections de la catégorie "Boissons", déduites du nom du produit — aucun champ supplémentaire
// à gérer côté restaurateur, cohérent avec le reste du menu qui reste piloté par le seul champ "category".
export const BOISSON_SUBCATEGORIES = [
  { value: 'froide', label: 'Boissons froides' },
  { value: 'chaude', label: 'Boissons chaudes' },
  { value: 'alcool', label: 'Alcool' }
];

export function boissonSubcategoryLabel(value, t) {
  if (t) return t(`menuCategories.boisson.${value}`);
  return BOISSON_SUBCATEGORIES.find((s) => s.value === value)?.label || value;
}

// \b ne fonctionne pas de façon fiable autour des lettres accentuées en JS (ex: "café", "thé",
// "saké" ne matchaient pas \bcafé\b) — on utilise donc des frontières explicites basées sur \p{L}.
function wordRegex(words) {
  return new RegExp(`(?<![\\p{L}])(?:${words.join('|')})(?![\\p{L}])`, 'iu');
}

const NON_ALCOHOL_HINT_REGEX = /sans alcool/i;
const ALCOHOL_REGEX = wordRegex(['bière', 'biere', 'vin', 'vins', 'cava', 'prosecco', 'chianti', 'cidre', 'rhum', 'vodka', 'whisky', 'whiskey', 'gin', 'tequila', 'limoncello', 'cocktail', 'trappiste', 'saké', 'sake', 'champagne', 'porto', 'pastis', 'mojito', 'sangria', 'liqueur']);
const COLD_HINT_REGEX = /(glacé|glace|iced|ice\b|froid|cold|fuze|smoothie|frappé|frappe|slush)/i;
const HOT_WORD_REGEX = /chaud/i;
const HOT_KEYWORDS_REGEX = new RegExp(wordRegex(['café', 'expresso', 'espresso', 'cappuccino', 'latte', 'macchiato', 'mocha', 'chai', 'thé', 'the', 'americano', 'infusion']).source + '|flat white', 'iu');

export function boissonSubcategory(name) {
  const n = name || '';
  if (!NON_ALCOHOL_HINT_REGEX.test(n) && ALCOHOL_REGEX.test(n)) return 'alcool';
  if (HOT_WORD_REGEX.test(n) && !COLD_HINT_REGEX.test(n)) return 'chaude';
  if (COLD_HINT_REGEX.test(n)) return 'froide';
  if (HOT_KEYWORDS_REGEX.test(n)) return 'chaude';
  return 'froide';
}

// Regroupe les plats d'une section par sous-section (item.subsection, texte libre saisi par le
// restaurateur — ex: "Boissons froides" au sein de la section "Boissons") : les plats sans sous-section
// restent groupés ensemble sans en-tête (affichage à plat, comme avant cette fonctionnalité). Pour la
// section "boisson" par défaut spécifiquement, un plat sans sous-section manuelle retombe sur l'ancienne
// classification automatique par mot-clé (boissonSubcategory) pour ne pas perdre ce regroupement déjà
// utile sur les menus existants qui n'ont jamais rempli ce nouveau champ.
export function groupBySubsection(items, sectionName, t) {
  const groups = [];
  const indexByKey = {};
  items.forEach((item) => {
    let key = (item.subsection || '').trim();
    let label = key;
    if (!key && sectionName === 'boisson') {
      const inferred = boissonSubcategory(item.name);
      key = `__boisson_${inferred}`;
      label = boissonSubcategoryLabel(inferred, t);
    }
    if (indexByKey[key] === undefined) {
      indexByKey[key] = groups.length;
      groups.push({ key, label, items: [] });
    }
    groups[indexByKey[key]].items.push(item);
  });
  return groups;
}

export const COMMUNES = [
  'Anderlecht', 'Auderghem', 'Berchem-Sainte-Agathe', 'Bruxelles', 'Etterbeek', 'Evere',
  'Forest', 'Ganshoren', 'Ixelles', 'Jette', 'Koekelberg', 'Molenbeek-Saint-Jean',
  'Saint-Gilles', 'Saint-Josse-ten-Noode', 'Schaerbeek', 'Uccle', 'Watermael-Boitsfort',
  'Woluwe-Saint-Lambert', 'Woluwe-Saint-Pierre'
];

// Communes limitrophes (les 19 communes de la Région de Bruxelles-Capitale) — sert à afficher
// d'abord les commerces de la commune du client, puis ceux des communes voisines, de proche en
// proche (voir communeRingDistance ci-dessous).
export const COMMUNE_ADJACENCY = {
  'Anderlecht': ['Molenbeek-Saint-Jean', 'Bruxelles', 'Saint-Gilles', 'Forest'],
  'Auderghem': ['Watermael-Boitsfort', 'Woluwe-Saint-Pierre', 'Ixelles', 'Bruxelles', 'Etterbeek'],
  'Berchem-Sainte-Agathe': ['Ganshoren', 'Koekelberg', 'Molenbeek-Saint-Jean', 'Jette'],
  'Bruxelles': ['Schaerbeek', 'Evere', 'Woluwe-Saint-Lambert', 'Woluwe-Saint-Pierre', 'Auderghem', 'Ixelles', 'Saint-Gilles', 'Anderlecht', 'Molenbeek-Saint-Jean', 'Jette', 'Ganshoren', 'Koekelberg', 'Etterbeek', 'Saint-Josse-ten-Noode'],
  'Etterbeek': ['Bruxelles', 'Ixelles', 'Woluwe-Saint-Pierre', 'Auderghem', 'Saint-Josse-ten-Noode'],
  'Evere': ['Bruxelles', 'Schaerbeek', 'Woluwe-Saint-Lambert'],
  'Forest': ['Anderlecht', 'Saint-Gilles', 'Uccle'],
  'Ganshoren': ['Berchem-Sainte-Agathe', 'Koekelberg', 'Jette', 'Bruxelles'],
  'Ixelles': ['Bruxelles', 'Etterbeek', 'Auderghem', 'Watermael-Boitsfort', 'Uccle', 'Saint-Gilles'],
  'Jette': ['Berchem-Sainte-Agathe', 'Ganshoren', 'Bruxelles', 'Molenbeek-Saint-Jean'],
  'Koekelberg': ['Berchem-Sainte-Agathe', 'Ganshoren', 'Molenbeek-Saint-Jean', 'Bruxelles'],
  'Molenbeek-Saint-Jean': ['Berchem-Sainte-Agathe', 'Koekelberg', 'Bruxelles', 'Anderlecht', 'Jette'],
  'Saint-Gilles': ['Bruxelles', 'Anderlecht', 'Forest', 'Uccle', 'Ixelles'],
  'Saint-Josse-ten-Noode': ['Bruxelles', 'Schaerbeek', 'Etterbeek'],
  'Schaerbeek': ['Bruxelles', 'Evere', 'Saint-Josse-ten-Noode', 'Woluwe-Saint-Lambert'],
  'Uccle': ['Forest', 'Saint-Gilles', 'Ixelles', 'Watermael-Boitsfort'],
  'Watermael-Boitsfort': ['Auderghem', 'Ixelles', 'Uccle', 'Woluwe-Saint-Pierre'],
  'Woluwe-Saint-Lambert': ['Bruxelles', 'Evere', 'Schaerbeek', 'Woluwe-Saint-Pierre'],
  'Woluwe-Saint-Pierre': ['Bruxelles', 'Woluwe-Saint-Lambert', 'Auderghem', 'Etterbeek', 'Watermael-Boitsfort']
};

// Distance en "anneaux" entre deux communes via le graphe de voisinage (0 = même commune, 1 =
// limitrophe, 2 = voisin d'un voisin, etc.) — recherche en largeur (BFS), le graphe est petit (19
// nœuds) donc pas besoin de mémoïsation. Retourne Infinity si la commune est inconnue/non reliée.
export function communeRingDistance(from, to) {
  if (!from || !to) return Infinity;
  if (from === to) return 0;
  const visited = new Set([from]);
  let frontier = [from];
  let ring = 0;
  while (frontier.length) {
    ring += 1;
    const next = [];
    for (const c of frontier) {
      for (const n of COMMUNE_ADJACENCY[c] || []) {
        if (n === to) return ring;
        if (!visited.has(n)) { visited.add(n); next.push(n); }
      }
    }
    frontier = next;
  }
  return Infinity;
}

// Même formule que geocode.js côté backend (haversineDistanceKm) — dupliquée ici plutôt qu'importée
// car ce fichier tourne aussi bien côté client (calcul instantané, sans aller-retour serveur) que serveur.
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const RESTAURANT_TYPES = [
  { value: 'Pizza', emoji: '🍕' },
  { value: 'Burgers', emoji: '🍔' },
  { value: 'Sushi', emoji: '🍣' },
  { value: 'Italien', emoji: '🍝' },
  { value: 'Belge', emoji: '🍟' },
  { value: 'Asiatique', emoji: '🥡' },
  { value: 'Healthy', emoji: '🥗' },
  { value: 'Végétarien', emoji: '🌱' },
  { value: 'Kebab & Grill', emoji: '🥙' },
  { value: 'Mexicain', emoji: '🌮' },
  { value: 'Libanais', emoji: '🧆' },
  { value: 'Espagnol', emoji: '🥘' },
  { value: 'Fried Chicken', emoji: '🍗' },
  { value: 'Coffee Shop', emoji: '☕' },
  { value: 'Boulangerie', emoji: '🥐' },
  { value: 'Boucherie', emoji: '🥩' },
  { value: 'Supermarché', emoji: '🛒' },
  { value: 'Night Shop', emoji: '🌙' },
  { value: 'Poke Bowl', emoji: '🥣' },
  { value: 'Thaïlandais', emoji: '🌶️' },
  { value: 'Indien', emoji: '🍛' },
  { value: 'Vietnamien', emoji: '🍜' },
  { value: 'Chinois', emoji: '🥟' },
  { value: 'Desserts & Glaces', emoji: '🍨' },
  { value: 'Petit-déjeuner & Brunch', emoji: '🥞' },
  { value: 'Sandwichs & Salades', emoji: '🥪' },
  { value: 'Africain', emoji: '🍲' },
  { value: 'Poisson & Fruits de mer', emoji: '🐟' },
  { value: 'Friterie', emoji: '🍟' },
  { value: 'Coréen', emoji: '🍚' },
  { value: 'Marocain', emoji: '🕌' },
  { value: 'Bubble Tea', emoji: '🧋' },
  { value: 'Ramen', emoji: '🍥' },
  { value: 'Autre', emoji: '🍽️' }
];

export function restaurantTypeLabel(value, t) {
  if (t) return t(`menuCategories.cuisine.${value}`);
  return value;
}

const GENERIC_TEMPLATE = {
  entree: [
    { name: 'Salade verte', price: 5, desc: 'Salade de saison, vinaigrette maison' },
    { name: 'Soupe du jour', price: 6, desc: '' }
  ],
  plat: [
    { name: 'Plat du jour', price: 12, desc: 'Suggestion du chef' },
    { name: 'Pâtes du moment', price: 10.5, desc: '' }
  ],
  dessert: [
    { name: 'Tiramisu', price: 5.5, desc: '' },
    { name: 'Brownie', price: 4.5, desc: '' }
  ],
  boisson: [
    { name: 'Eau plate 50cl', price: 2, desc: '' },
    { name: 'Coca-Cola 33cl', price: 3, desc: '' },
    { name: 'Ice Tea 33cl', price: 3, desc: '' }
  ]
};

const TYPE_TEMPLATES = {
  // Suppléments (menu frites+boisson, sweet potato fries, steak/fromage/bacon en plus) gérés via le
  // groupe d'options "Suppléments burger" (voir ensureBurgerGroups dans routes/restaurants.js).
  Burgers: {
    plat: [
      { name: 'Classic', price: 11.5, desc: 'Bœuf 150g, cheddar, salade, tomate, oignon, pain brioché' },
      { name: 'Bacon cheese', price: 13, desc: 'Bœuf 150g, bacon, cheddar, pain brioché' },
      { name: 'Double', price: 15.5, desc: 'Double bœuf 150g, cheddar, pain brioché' },
      { name: 'Blue cheese', price: 13.5, desc: 'Bœuf 150g, blue cheese, oignons caramélisés' },
      { name: 'BBQ', price: 13.5, desc: 'Bœuf 150g, bacon, onion rings, sauce BBQ' },
      { name: 'Truffe', price: 14.5, desc: 'Bœuf 150g, parmesan, roquette, mayo truffe' },
      { name: 'Chicken crispy', price: 12, desc: 'Poulet croustillant, pain brioché' },
      { name: 'Chicken hot honey', price: 12.5, desc: 'Poulet croustillant, sauce hot honey' },
      { name: 'Veggie', price: 11.5, desc: 'Galette de légumes, pain brioché' },
      { name: 'Vegan', price: 12.5, desc: 'Steak végétal, pain brioché' },
      { name: 'Burger du mois', price: 14, desc: '' },
      { name: 'Mini burger + frites + jus', price: 8.5, desc: 'Menu enfant' },
      { name: 'Fish burger', price: 13, desc: 'Poisson pané, sauce tartare, pain brioché' }
    ],
    entree: [
      { name: 'Frites', price: 3.5, desc: '' },
      { name: 'Frites cheddar bacon', price: 6, desc: '' },
      { name: 'Onion rings', price: 4.5, desc: '' },
      { name: 'Nuggets (6 pcs)', price: 5, desc: '' },
      { name: 'Coleslaw', price: 3, desc: '' },
      { name: 'Chili cheese fries', price: 6.5, desc: '' },
      { name: 'Cheese sticks (5 pcs)', price: 5.5, desc: 'Bâtonnets de mozzarella panés' }
    ],
    dessert: [
      { name: 'Milkshake', price: 5.5, desc: 'Vanille, fraise, chocolat ou Oreo — au choix' },
      { name: 'Brownie', price: 4.5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Apple pie', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Limonade maison', price: 3.5, desc: '' },
      { name: 'Bière artisanale', price: 4.5, desc: '' },
      { name: 'Thé glacé pêche', price: 3, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' },
      { name: 'Jus d\'orange pressé', price: 4, desc: '' }
    ]
  },
  // Carte type pizzeria italienne (pâte fine 30cm, options taille/pâte/suppléments gérées via les
  // groupes d'options "Taille"/"Suppléments pizza", pas comme des lignes de menu séparées).
  Pizza: {
    plat: [
      { name: 'Margherita', price: 9.5, desc: 'Base tomate, mozzarella, pâte fine' },
      { name: 'Napoletana', price: 11, desc: 'Base tomate, mozzarella, anchois, câpres, olives' },
      { name: 'Prosciutto', price: 11.5, desc: 'Base tomate, mozzarella, jambon' },
      { name: 'Funghi', price: 11, desc: 'Base tomate, mozzarella, champignons' },
      { name: 'Prosciutto e funghi', price: 12, desc: 'Base tomate, mozzarella, jambon, champignons' },
      { name: 'Diavola', price: 12, desc: 'Base tomate, mozzarella, salami piquant' },
      { name: 'Hawaï', price: 11.5, desc: 'Base tomate, mozzarella, jambon, ananas' },
      { name: 'Végétarienne', price: 12, desc: 'Base tomate, mozzarella, poivrons, champignons, oignons, olives, courgettes' },
      { name: 'Tonno', price: 12, desc: 'Base tomate, mozzarella, thon, oignons rouges, olives' },
      { name: 'Capricciosa', price: 12.5, desc: 'Base tomate, mozzarella, jambon, champignons, artichauts, olives' },
      { name: 'Quattro stagioni', price: 12.5, desc: 'Base tomate, mozzarella' },
      { name: 'Quattro formaggi', price: 13, desc: 'Base tomate, mozzarella, gorgonzola, parmesan, chèvre' },
      { name: 'Calzone', price: 12.5, desc: 'Jambon, champignons, œuf' },
      { name: 'Bufalina', price: 14, desc: 'Mozzarella di bufala, tomates cerises, basilic' },
      { name: 'Parma', price: 14.5, desc: 'Roquette, jambon de Parme, copeaux de parmesan' },
      { name: 'Bolognese (pizza)', price: 12.5, desc: 'Sauce bolognaise, oignons' },
      { name: 'Kebab (pizza)', price: 13, desc: "Viande kebab, oignons, sauce à l'ail" },
      { name: 'Poulet curry (pizza)', price: 13, desc: 'Poulet, ananas, sauce curry' },
      { name: 'Tartufo', price: 15, desc: 'Crème, champignons, huile de truffe' },
      { name: 'Chèvre-miel', price: 13.5, desc: 'Crème, chèvre, miel, noix' },
      { name: 'Frutti di mare', price: 15, desc: 'Crevettes, calamars, moules' },
      { name: 'Merguez', price: 13, desc: 'Merguez, poivrons, harissa' },
      { name: 'Fromages et jambon fumé', price: 14, desc: 'Scamorza, speck' },
      { name: 'Spaghetti bolognese', price: 11.5, desc: 'Portion généreuse, parmesan' },
      { name: 'Penne arrabbiata', price: 10.5, desc: 'Portion généreuse, parmesan' },
      { name: 'Tagliatelle carbonara', price: 12.5, desc: 'Portion généreuse, parmesan' },
      { name: 'Penne quatre fromages', price: 12, desc: 'Portion généreuse, parmesan' },
      { name: 'Lasagne maison', price: 12.5, desc: 'Portion généreuse, parmesan' },
      { name: 'Penne poulet-champignons', price: 12.5, desc: 'Portion généreuse, parmesan' },
      { name: 'Ravioli ricotta-épinards', price: 13, desc: 'Portion généreuse, parmesan' },
      { name: 'Menu solo', price: 12.5, desc: '1 pizza classique + 1 boisson 33cl' },
      { name: 'Menu duo', price: 24, desc: '2 pizzas classiques + 2 boissons 33cl' },
      { name: 'Menu famille', price: 39, desc: '2 pizzas 40cm + 1 bouteille 1,5L' }
    ],
    entree: [
      { name: 'Bruschetta (3 pcs)', price: 6, desc: '' },
      { name: "Pain à l'ail", price: 4.5, desc: '' },
      { name: 'Focaccia romarin', price: 5, desc: '' },
      { name: 'Mozzarella sticks (6 pcs)', price: 6, desc: '' },
      { name: 'Salade César', price: 11, desc: '' },
      { name: 'Salade caprese', price: 10, desc: '' },
      { name: 'Salade chèvre chaud', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu maison', price: 5.5, desc: '' },
      { name: 'Panna cotta', price: 5, desc: '' },
      { name: 'Calzone Nutella', price: 7, desc: '' },
      { name: 'Glace 2 boules', price: 4, desc: '' }
    ],
    // Variantes au même prix regroupées en un seul item + choix via option (voir ensurePizzaDrinkGroups
    // dans routes/restaurants.js) plutôt qu'une ligne de menu par saveur.
    boisson: [
      { name: 'Softs 33cl', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite, Ice Tea, San Pellegrino Aranciata ou Limonata — au choix' },
      { name: 'Eau 50cl', price: 2, desc: '' },
      { name: 'Bouteille 1,5L', price: 4, desc: '' },
      { name: 'Bière 33cl', price: 3, desc: 'Peroni ou Jupiler — au choix' },
      { name: 'Vin 25cl', price: 5.5, desc: 'Rouge ou blanc — au choix' },
      { name: 'Café', price: 2, desc: 'Espresso ou café allongé — au choix' }
    ]
  },
  // Carte type traiteur asiatique (wok/thaï-viet-chinois), prix réalistes 2026. Le "Bière 33cl" est
  // un choix de marque au même prix (pas un vrai groupe d'options), comme "Softs" ailleurs dans ce fichier.
  Asiatique: {
    entree: [
      { name: 'Nems poulet (4 pcs)', price: 6.5, desc: '' },
      { name: 'Rouleaux de printemps (2 pcs)', price: 6, desc: '' },
      { name: 'Gyoza (5 pcs)', price: 6.5, desc: '' },
      { name: 'Samoussas (3 pcs)', price: 6, desc: '' },
      { name: 'Beignets de crevettes (4 pcs)', price: 7, desc: '' },
      { name: 'Soupe tom yum', price: 7.5, desc: '' },
      { name: 'Soupe miso', price: 4.5, desc: '' },
      { name: 'Salade de papaye verte', price: 8, desc: '' }
    ],
    plat: [
      { name: 'Phở bœuf', price: 14.5, desc: '' },
      { name: 'Phở poulet', price: 13.5, desc: '' },
      { name: 'Bo bun (bœuf, nems)', price: 14.5, desc: '' },
      { name: 'Ramen poulet', price: 14, desc: '' },
      { name: 'Poulet légumes sauce soja', price: 13.5, desc: '' },
      { name: 'Bœuf aux oignons', price: 15, desc: '' },
      { name: 'Crevettes basilic thaï', price: 16, desc: '' },
      { name: 'Canard laqué', price: 16.5, desc: '' },
      { name: 'Tofu légumes', price: 12.5, desc: '' },
      { name: 'Pad thaï poulet', price: 14, desc: '' },
      { name: 'Pad thaï crevettes', price: 15.5, desc: '' },
      { name: 'Curry vert poulet', price: 14.5, desc: '' },
      { name: 'Curry rouge crevettes', price: 16, desc: '' },
      { name: 'Curry massaman bœuf', price: 15.5, desc: '' },
      { name: 'Riz cantonnais', price: 11.5, desc: '' },
      { name: 'Riz sauté crevettes', price: 13.5, desc: '' },
      { name: 'Nouilles sautées poulet', price: 12.5, desc: '' },
      { name: 'Menu midi (entrée + plat)', price: 15.5, desc: '' },
      { name: 'Menu duo (2 entrées + 2 plats + riz)', price: 42, desc: 'À partager, 2 personnes' }
    ],
    dessert: [
      { name: 'Perles de coco (2 pcs)', price: 4.5, desc: '' },
      { name: 'Banane frite au miel', price: 5, desc: '' },
      { name: 'Mango sticky rice', price: 6.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé jasmin', price: 2.5, desc: '' },
      { name: 'Bubble tea', price: 5.5, desc: '' },
      { name: 'Bière 33cl', price: 4, desc: 'Singha ou Tsingtao — au choix' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  Sushi: {
    plat: [
      { name: 'Sushi Saumon ×2', price: 4.5, desc: '' },
      { name: 'Sushi Thon ×2', price: 5.5, desc: '' },
      { name: 'Sushi Crevette ×2', price: 4.5, desc: '' },
      { name: 'Sushi Daurade ×2', price: 5, desc: '' },
      { name: 'Sushi Anguille ×2', price: 6, desc: '' },
      { name: 'Sashimi Saumon ×6', price: 9.5, desc: '' },
      { name: 'Sashimi Thon ×6', price: 12, desc: '' },
      { name: 'Sashimi Mixte ×6', price: 11, desc: '' },
      { name: 'Maki Saumon ×6', price: 5, desc: '' },
      { name: 'Maki Thon ×6', price: 6, desc: '' },
      { name: 'Maki Concombre ×6', price: 4, desc: '' },
      { name: 'Maki Avocat ×6', price: 4, desc: '' },
      { name: 'Maki Saumon Avocat ×6', price: 5.5, desc: '' },
      { name: 'California Roll Saumon Avocat ×8', price: 9.5, desc: '' },
      { name: 'California Roll Crevette Tempura ×8', price: 10.5, desc: '' },
      { name: 'California Roll Poulet Croustillant ×8', price: 9.5, desc: '' },
      { name: 'California Roll Végétarien ×8', price: 8.5, desc: '' },
      { name: 'Spring Rolls Saumon Avocat Cheese ×6', price: 8.5, desc: '' },
      { name: 'Spring Rolls Thon Mangue ×6', price: 9.5, desc: '' },
      { name: 'Poke Bowl Saumon', price: 14.5, desc: '' },
      { name: 'Poke Bowl Thon', price: 15.5, desc: '' },
      { name: 'Chirashi Saumon', price: 16, desc: '' },
      { name: 'Poulet Teriyaki Riz', price: 13.5, desc: '' },
      { name: 'Plateau Solo (16 pcs)', price: 18.5, desc: '' },
      { name: 'Plateau Duo (32 pcs)', price: 34, desc: '' },
      { name: 'Plateau Family (54 pcs)', price: 58, desc: '' }
    ],
    entree: [
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Soupe miso', price: 4, desc: '' },
      { name: 'Gyoza poulet (5 pcs)', price: 6.5, desc: '' },
      { name: 'Salade wakame', price: 5.5, desc: '' },
      { name: 'Tempura crevettes (4 pcs)', price: 8.5, desc: '' }
    ],
    dessert: [
      { name: 'Mochi (2 pcs)', price: 4.5, desc: '' },
      { name: 'Perles de coco', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Thé vert', price: 2.5, desc: '' },
      { name: 'Bière Asahi', price: 4, desc: '' },
      { name: 'Saké', price: 6, desc: '' }
    ]
  },
  // Les suppléments tacos/burritos (guacamole/fromage/jalapeños) sont gérés via le groupe d'options
  // "Suppléments" (voir migration de seed — attaché aux tacos et burritos, pas aux fajitas/enchiladas).
  Mexicain: {
    plat: [
      { name: 'Tacos Poulet mariné', price: 11.5, desc: '' },
      { name: 'Tacos Carnitas (porc confit)', price: 12.5, desc: '' },
      { name: 'Tacos Barbacoa (bœuf)', price: 13, desc: '' },
      { name: 'Tacos Crevettes', price: 14, desc: '' },
      { name: 'Tacos Champignons-haricots noirs', price: 10.5, desc: '' },
      { name: 'Tacos Pastor (porc ananas)', price: 12.5, desc: '' },
      { name: 'Burrito Poulet', price: 12.5, desc: '' },
      { name: 'Burrito Bœuf', price: 13.5, desc: '' },
      { name: 'Burrito Végétarien', price: 11.5, desc: '' },
      { name: 'Burrito Bowl (sans tortilla)', price: 12.5, desc: '' },
      { name: 'Fajitas poulet (à composer)', price: 17.5, desc: '' },
      { name: 'Fajitas bœuf', price: 19, desc: '' },
      { name: 'Fajitas crevettes', price: 19.5, desc: '' },
      { name: 'Enchiladas poulet', price: 15.5, desc: '' },
      { name: 'Chili con carne riz', price: 14, desc: '' },
      { name: 'Menu midi (2 tacos + boisson)', price: 13.5, desc: '' }
    ],
    entree: [
      { name: 'Guacamole & totopos', price: 8.5, desc: '' },
      { name: 'Nachos supreme (fromage, jalapeños, pico de gallo)', price: 10.5, desc: '' },
      { name: 'Nachos pulled pork', price: 12.5, desc: '' },
      { name: 'Quesadilla fromage', price: 8, desc: '' },
      { name: 'Quesadilla poulet', price: 10, desc: '' },
      { name: 'Elote (maïs grillé)', price: 5.5, desc: '' }
    ],
    dessert: [
      { name: 'Churros dulce de leche', price: 6.5, desc: '' },
      { name: 'Tres leches', price: 6, desc: '' },
      { name: 'Flan mexicain', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Margarita', price: 9, desc: '' },
      { name: 'Margarita fruits', price: 9.5, desc: '' },
      { name: 'Mojito', price: 8.5, desc: '' },
      { name: 'Bière 33cl', price: 4, desc: 'Corona ou Modelo — au choix' },
      { name: 'Jarritos', price: 3.5, desc: '' },
      { name: 'Agua fresca', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Tequila / mezcal (shot)', price: 5, desc: '' }
    ]
  },
  // Carte type levantine (Liban/Syrie) — mezzés, sandwichs, grillades.
  Libanais: {
    entree: [
      { name: 'Houmous', price: 5.5, desc: '' },
      { name: 'Moutabbal', price: 6, desc: '' },
      { name: 'Taboulé', price: 6, desc: '' },
      { name: 'Fattouch', price: 6.5, desc: '' },
      { name: 'Falafel (6 pcs)', price: 6, desc: '' },
      { name: 'Kibbeh (3 pcs)', price: 7.5, desc: '' },
      { name: 'Sambousek fromage (4 pcs)', price: 6.5, desc: '' },
      { name: 'Warak enab (feuilles de vigne)', price: 6.5, desc: '' },
      { name: 'Mouhammara', price: 6.5, desc: '' },
      { name: 'Mezzé végétarien (6 pièces)', price: 22, desc: 'À partager' },
      { name: 'Mezzé royal (10 pièces)', price: 38, desc: 'À partager' }
    ],
    plat: [
      { name: 'Sandwich falafel', price: 6.5, desc: '' },
      { name: 'Sandwich shawarma poulet', price: 7.5, desc: '' },
      { name: 'Sandwich shawarma viande', price: 8, desc: '' },
      { name: 'Sandwich kafta', price: 8, desc: '' },
      { name: 'Sandwich halloumi grillé', price: 7.5, desc: '' },
      { name: 'Assiette shawarma poulet', price: 14.5, desc: '' },
      { name: 'Assiette shawarma viande', price: 15.5, desc: '' },
      { name: 'Kafta grillée', price: 15.5, desc: '' },
      { name: 'Chich taouk', price: 15, desc: '' },
      { name: 'Grillades mixtes', price: 18.5, desc: '' },
      { name: 'Fatteh poulet', price: 13.5, desc: '' },
      { name: 'Assiette végétarienne', price: 13, desc: '' }
    ],
    dessert: [
      { name: 'Baklava (4 pcs)', price: 5, desc: '' },
      { name: 'Halawet el jibn', price: 5.5, desc: '' },
      { name: 'Namoura', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Ayran', price: 2.5, desc: '' },
      { name: 'Jus de grenade', price: 4, desc: '' },
      { name: 'Thé à la menthe', price: 2.5, desc: '' },
      { name: 'Café arabe', price: 2.5, desc: '' },
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  // Bowls : base (quinoa/riz complet/salade) au choix + suppléments (protéine/avocat/œuf) gérés via
  // les groupes d'options "Base du bowl"/"Suppléments healthy" (voir ensureHealthyGroups).
  Healthy: {
    plat: [
      { name: 'Bowl poulet grillé avocat', price: 13.5, desc: '' },
      { name: 'Bowl saumon teriyaki', price: 15, desc: '' },
      { name: 'Bowl falafel houmous', price: 12.5, desc: '' },
      { name: 'Bowl tofu curry', price: 12.5, desc: '' },
      { name: 'Bowl bœuf sésame', price: 14.5, desc: '' },
      { name: 'Buddha bowl', price: 12.5, desc: '' },
      { name: 'Salade César light', price: 11.5, desc: '' },
      { name: 'Salade chèvre chaud noix miel', price: 12, desc: '' },
      { name: 'Salade halloumi grenade', price: 12.5, desc: '' },
      { name: 'Salade poulet mangue', price: 12.5, desc: '' },
      { name: 'Wrap poulet avocat', price: 9.5, desc: '' },
      { name: 'Wrap végétarien', price: 8.5, desc: '' },
      { name: 'Wrap saumon fumé', price: 10.5, desc: '' },
      { name: 'Curry de légumes riz', price: 12, desc: '' },
      { name: 'Dahl de lentilles', price: 11, desc: '' }
    ],
    entree: [
      { name: 'Soupe du jour', price: 5.5, desc: '' },
      { name: 'Porridge fruits', price: 6.5, desc: '' },
      { name: 'Chia pudding', price: 6, desc: '' },
      { name: 'Açaí bowl', price: 9.5, desc: '' },
      { name: 'Yaourt granola', price: 6.5, desc: '' },
      { name: 'Skyr fruits rouges', price: 6, desc: '' }
    ],
    dessert: [
      { name: 'Energy balls (3 pcs)', price: 3.5, desc: '' },
      { name: 'Banana bread', price: 4, desc: '' },
      { name: 'Cookie protéiné', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé', price: 4.5, desc: '' },
      { name: 'Smoothie', price: 6, desc: '' },
      { name: 'Kombucha', price: 4.5, desc: '' },
      { name: 'Eau infusée', price: 2.5, desc: '' },
      { name: 'Café', price: 2.8, desc: '' },
      { name: 'Matcha latte', price: 5, desc: '' }
    ]
  },
  // Carte type trattoria, prix réalistes 2026.
  Italien: {
    entree: [
      { name: 'Burrata tomates cerises', price: 12.5, desc: '' },
      { name: 'Carpaccio de bœuf', price: 13.5, desc: '' },
      { name: 'Vitello tonnato', price: 13, desc: '' },
      { name: 'Bruschetta (3 pcs)', price: 7.5, desc: '' },
      { name: 'Arancini (3 pcs)', price: 8.5, desc: '' },
      { name: 'Planche antipasti misti (2 pers.)', price: 19, desc: '' },
      { name: 'Légumes grillés', price: 5.5, desc: '' },
      { name: 'Roquette parmesan', price: 5, desc: '' },
      { name: 'Frites', price: 4, desc: '' }
    ],
    plat: [
      { name: 'Spaghetti carbonara (guanciale, pecorino)', price: 14.5, desc: '' },
      { name: 'Tagliatelle bolognese', price: 14, desc: '' },
      { name: 'Penne arrabbiata', price: 12.5, desc: '' },
      { name: 'Linguine vongole', price: 17.5, desc: '' },
      { name: 'Gnocchi gorgonzola', price: 14.5, desc: '' },
      { name: 'Ravioli ricotta épinards, beurre sauge', price: 15, desc: '' },
      { name: 'Tagliatelle scampis', price: 17, desc: '' },
      { name: 'Risotto champignons', price: 15.5, desc: '' },
      { name: 'Risotto scampis', price: 18, desc: '' },
      { name: 'Lasagne maison', price: 14.5, desc: '' },
      { name: 'Pâtes à la truffe', price: 19, desc: '' },
      { name: 'Saltimbocca alla romana', price: 21, desc: '' },
      { name: 'Escalope milanaise', price: 19.5, desc: '' },
      { name: 'Osso buco', price: 23, desc: '' },
      { name: 'Filet de bar grillé', price: 22, desc: '' },
      { name: 'Tagliata de bœuf, roquette, parmesan', price: 24.5, desc: '' },
      { name: 'Menu midi (entrée + plat, semaine)', price: 19.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu maison', price: 6.5, desc: '' },
      { name: 'Panna cotta', price: 6, desc: '' },
      { name: 'Affogato', price: 5.5, desc: '' },
      { name: 'Cannoli (2 pcs)', price: 6, desc: '' }
    ],
    boisson: [
      { name: 'Vin au verre', price: 5.5, desc: '' },
      { name: 'Bouteille de vin maison (75cl)', price: 22, desc: '' },
      { name: 'Peroni 33cl', price: 3.5, desc: '' },
      { name: 'Aperol Spritz', price: 8.5, desc: '' },
      { name: 'Limoncello', price: 4.5, desc: '' },
      { name: 'Espresso', price: 2.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  // Wings vendues avec un choix de sauce obligatoire (nature/BBQ/buffalo/hot honey) géré via le groupe
  // d'options "Choix de sauce wings" (voir ensureChickenGroups dans routes/restaurants.js).
  'Fried Chicken': {
    plat: [
      { name: 'Poulet frit 3 pcs', price: 7.5, desc: '' },
      { name: 'Poulet frit 6 pcs', price: 13, desc: '' },
      { name: 'Poulet frit 12 pcs', price: 24, desc: '' },
      { name: 'Poulet frit Bucket 20 pcs', price: 36, desc: '' },
      { name: 'Tenders 4 pcs', price: 7, desc: '' },
      { name: 'Tenders 8 pcs', price: 12.5, desc: '' },
      { name: 'Tenders Bucket 16 pcs', price: 22, desc: '' },
      { name: 'Wings 6 pcs', price: 7.5, desc: 'Nature, BBQ, buffalo ou hot honey — au choix' },
      { name: 'Wings 12 pcs', price: 13.5, desc: 'Nature, BBQ, buffalo ou hot honey — au choix' },
      { name: 'Wings 24 pcs', price: 24, desc: 'Nature, BBQ, buffalo ou hot honey — au choix' },
      { name: 'Burger Chicken Crispy', price: 9.5, desc: '' },
      { name: 'Burger Spicy Chicken', price: 10, desc: '' },
      { name: 'Burger Double Crispy', price: 12.5, desc: '' },
      { name: 'Burger Chicken Hot Honey', price: 10.5, desc: '' },
      { name: 'Wrap Tenders', price: 8.5, desc: '' },
      { name: 'Wrap Spicy', price: 9, desc: '' },
      { name: 'Bowl poulet riz coleslaw', price: 12, desc: '' },
      { name: 'Menu Burger + frites + boisson', price: 14, desc: '' },
      { name: 'Menu Tenders 4 pcs + frites + boisson', price: 12, desc: '' },
      { name: 'Menu famille (12 pcs + 2 grandes frites + 1,5L)', price: 39, desc: '' }
    ],
    entree: [
      { name: 'Frites', price: 3.5, desc: '' },
      { name: 'Coleslaw', price: 3, desc: '' },
      { name: 'Corn on the cob', price: 3.5, desc: '' },
      { name: 'Mac & cheese', price: 5, desc: '' },
      { name: 'Onion rings', price: 4.5, desc: '' },
      { name: 'Sauces', price: 0.8, desc: '' }
    ],
    dessert: [
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Milkshake', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau', price: 2, desc: '' }
    ]
  },
  // Taverne belge traditionnelle. Le "Steak frites, sauce au choix" a un groupe d'options "Choix de
  // sauce" (voir ensureTaverneGroups dans routes/restaurants.js).
  Belge: {
    entree: [
      { name: 'Croquettes de fromage (2 pcs)', price: 9.5, desc: '' },
      { name: 'Croquettes de crevettes grises (2 pcs)', price: 14, desc: '' },
      { name: 'Tomate crevettes', price: 16, desc: '' },
      { name: 'Toast cannibale', price: 12.5, desc: '' },
      { name: 'Soupe du jour', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Boulets sauce lapin, frites', price: 15.5, desc: '' },
      { name: 'Vol-au-vent, frites', price: 16.5, desc: '' },
      { name: 'Carbonnades flamandes, frites', price: 17.5, desc: '' },
      { name: 'Stoemp saucisses', price: 15, desc: '' },
      { name: 'Filet américain préparé, frites', price: 16.5, desc: '' },
      { name: 'Chicons au gratin', price: 15.5, desc: '' },
      { name: 'Waterzooi de poulet', price: 17, desc: '' },
      { name: 'Moules marinière, frites', price: 24, desc: '' },
      { name: 'Steak frites', price: 21, desc: 'Sauce au choix' },
      { name: 'Lapin à la kriek', price: 18.5, desc: '' },
      { name: 'Spaghetti bolognaise', price: 13.5, desc: '' },
      { name: 'Croque-monsieur', price: 9.5, desc: '' },
      { name: 'Croque-madame', price: 10.5, desc: '' },
      { name: 'Plat du jour (midi, semaine)', price: 14, desc: '' }
    ],
    dessert: [
      { name: 'Dame blanche', price: 7.5, desc: '' },
      { name: 'Gaufre de Bruxelles chantilly', price: 6.5, desc: '' },
      { name: 'Mousse au chocolat', price: 6.5, desc: '' },
      { name: 'Tarte du jour', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Jupiler 25cl', price: 3, desc: '' },
      { name: 'Duvel', price: 4.8, desc: '' },
      { name: 'Chimay', price: 5, desc: '' },
      { name: 'Kriek', price: 4.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Café', price: 2.8, desc: '' },
      { name: 'Vin au verre', price: 5, desc: '' }
    ]
  },
  // Les suppléments (halloumi/œuf poché/avocat) sont gérés via le groupe d'options "Suppléments"
  // (voir migration de seed — attaché aux bowls/curry/burgers/tarte). Le "Café" a un groupe "Lait"
  // (Avoine/Amande, +0,50€), même logique que le "Softs" desc-only ailleurs mais avec supplément payant.
  'Végétarien': {
    entree: [
      { name: 'Soupe du jour', price: 6, desc: '' },
      { name: 'Houmous pain plat', price: 7, desc: '' },
      { name: 'Burrata rôtie aux légumes', price: 11.5, desc: '' },
      { name: 'Croquettes de champignons (2 pcs)', price: 9, desc: '' },
      { name: 'Tempura de légumes', price: 8.5, desc: '' }
    ],
    plat: [
      { name: 'Buddha bowl (quinoa, avocat, falafel, houmous)', price: 14, desc: '' },
      { name: 'Curry de légumes, lait de coco, riz', price: 14.5, desc: '' },
      { name: 'Dahl de lentilles, naan', price: 13.5, desc: '' },
      { name: 'Risotto aux champignons', price: 15.5, desc: '' },
      { name: 'Lasagne végétarienne', price: 14, desc: '' },
      { name: 'Burger végétarien (galette maison, frites)', price: 14.5, desc: '' },
      { name: 'Burger vegan (steak végétal, frites)', price: 15, desc: '' },
      { name: 'Chili sin carne, riz', price: 13, desc: '' },
      { name: 'Gnocchis épinards gorgonzola', price: 14.5, desc: '' },
      { name: 'Assiette mezze végétarien', price: 15, desc: '' },
      { name: 'Tarte du jour, salade', price: 12.5, desc: '' },
      { name: 'Menu midi (plat du jour + soupe)', price: 16, desc: '' },
      { name: 'Poke bowl végétarien', price: 13.5, desc: '' }
    ],
    dessert: [
      { name: 'Cheesecake vegan', price: 6, desc: '' },
      { name: 'Moelleux chocolat', price: 6.5, desc: '' },
      { name: 'Crumble aux pommes', price: 5.5, desc: '' },
      { name: 'Energy balls (3 pcs)', price: 3.5, desc: '' },
      { name: 'Tiramisu vegan', price: 6, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé', price: 4.5, desc: '' },
      { name: 'Smoothie', price: 6, desc: '' },
      { name: 'Kombucha', price: 4.5, desc: '' },
      { name: 'Vin bio au verre', price: 5.5, desc: '' },
      { name: 'Bière bio', price: 4, desc: '' },
      { name: 'Café', price: 2.8, desc: '' },
      { name: 'Matcha latte', price: 5, desc: '' }
    ]
  },
  // Carte type snack turc bruxellois (dürüms, pitas, mitraillettes, assiettes, tacos, burgers),
  // prix réalistes zone Woluwe 2026. Les crudités/sauces au choix sont gérées via les groupes
  // d'options "Crudités"/"Sauces" (voir ensureCondimentGroupsForItem dans routes/restaurants.js),
  // pas comme des lignes de menu séparées.
  'Kebab & Grill': {
    entree: [
      { name: 'Petite frite', price: 3, desc: '' },
      { name: 'Grande frite', price: 3.8, desc: '' },
      { name: 'Fricadelle', price: 2.5, desc: '' },
      { name: 'Cervelas', price: 2.5, desc: '' },
      { name: 'Boulet', price: 3, desc: '' },
      { name: 'Mexicano', price: 3, desc: '' },
      { name: 'Chicken nuggets (6 pcs)', price: 4.5, desc: '' },
      { name: 'Bucket poulet 12 pcs', price: 12, desc: '' },
      { name: 'Bucket poulet 20 pcs', price: 18, desc: '' },
      { name: 'Portion falafel (6 pcs)', price: 4.5, desc: '' }
    ],
    plat: [
      { name: 'Dürüm poulet', price: 8.5, desc: 'Galette, viande au choix, crudités, sauce · suppl. fromage +1€, avec frites +1,50€' },
      { name: 'Dürüm kebab (agneau/veau)', price: 8.5, desc: 'Galette, viande au choix, crudités, sauce · suppl. fromage +1€, avec frites +1,50€' },
      { name: 'Dürüm mixte', price: 9, desc: 'Galette, viande au choix, crudités, sauce · suppl. fromage +1€, avec frites +1,50€' },
      { name: 'Dürüm adana', price: 9.5, desc: 'Galette, viande au choix, crudités, sauce · suppl. fromage +1€, avec frites +1,50€' },
      { name: 'Dürüm falafel', price: 8, desc: 'Galette, crudités, sauce · suppl. fromage +1€, avec frites +1,50€' },
      { name: 'Pita poulet', price: 7, desc: 'Pain pita, viande, crudités, sauce · suppl. fromage +1€' },
      { name: 'Pita kebab', price: 7, desc: 'Pain pita, viande, crudités, sauce · suppl. fromage +1€' },
      { name: 'Pita mixte', price: 7.5, desc: 'Pain pita, viande, crudités, sauce · suppl. fromage +1€' },
      { name: 'Pita falafel', price: 6.5, desc: 'Pain pita, crudités, sauce · suppl. fromage +1€' },
      { name: 'Mitraillette fricadelle', price: 7.5, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Mitraillette poulet', price: 8.5, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Mitraillette kebab', price: 8.5, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Mitraillette boulette', price: 8, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Mitraillette hamburger', price: 8, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Mitraillette mixte', price: 9.5, desc: 'Demi-baguette, frites, viande, sauce' },
      { name: 'Assiette poulet', price: 13.5, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette kebab', price: 13.5, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette adana', price: 14.5, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette köfte', price: 14, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette brochette poulet', price: 14.5, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette mixte', price: 15.5, desc: "Viande, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Assiette falafel', price: 12.5, desc: "Falafel, frites ou riz, salade, sauce à l'ail, pain" },
      { name: 'Tacos M (1 viande)', price: 9.5, desc: 'Galette pressée, frites, viande, sauce fromagère · suppl. viande +1,50€' },
      { name: 'Tacos L (2 viandes)', price: 11.5, desc: 'Galette pressée, frites, viande, sauce fromagère · suppl. viande +1,50€' },
      { name: 'Tacos XL (3 viandes)', price: 13.5, desc: 'Galette pressée, frites, viande, sauce fromagère · suppl. viande +1,50€' },
      { name: 'Cheeseburger', price: 6.5, desc: '' },
      { name: 'Double cheeseburger', price: 8.5, desc: '' },
      { name: 'Burger poulet crispy', price: 7.5, desc: '' },
      { name: 'Burger Bodrum (steak, cheddar, oignons grillés)', price: 9, desc: '' },
      { name: 'Menu dürüm + frites + boisson (11h30-15h)', price: 12, desc: '' },
      { name: 'Menu pita + frites + boisson (11h30-15h)', price: 10.5, desc: '' },
      { name: 'Menu tacos M + boisson (11h30-15h)', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Baklava (3 pièces)', price: 3.5, desc: '' },
      { name: 'Sütlaç (riz au lait)', price: 3, desc: '' },
      { name: 'Künefe', price: 5, desc: '' }
    ],
    // Variantes au même prix regroupées en un seul item + choix via option (voir ensureSnackDrinkGroups
    // dans routes/restaurants.js) plutôt qu'une ligne de menu par saveur.
    boisson: [
      { name: 'Softs 33cl', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau 50cl', price: 2, desc: 'Plate ou pétillante — au choix' },
      { name: 'Ayran', price: 2, desc: '' },
      { name: 'Uludağ', price: 2.5, desc: '' },
      { name: 'Red Bull', price: 3, desc: '' },
      { name: 'Thé turc', price: 1.5, desc: '' },
      { name: 'Café', price: 2, desc: '' }
    ]
  },
  // Lait végétal (avoine/amande, +0,50€) géré via le groupe d'options "Lait" attaché aux boissons à
  // base de lait (voir ensureCafeGroups dans routes/restaurants.js).
  'Coffee Shop': {
    entree: [
      { name: 'Cookie', price: 3.5, desc: '' },
      { name: 'Banana bread', price: 4, desc: '' },
      { name: 'Cinnamon roll', price: 4.5, desc: '' },
      { name: 'Carrot cake', price: 5, desc: '' },
      { name: 'Croissant', price: 2.5, desc: '' }
    ],
    plat: [
      { name: 'Avocado toast', price: 9.5, desc: '' },
      { name: 'Granola bowl', price: 8.5, desc: '' },
      { name: 'Toast burrata tomates', price: 10.5, desc: '' },
      { name: 'Croque', price: 8.5, desc: '' },
      { name: 'Bagel saumon', price: 10.5, desc: '' },
      { name: 'Formule brunch (week-end)', price: 22, desc: 'Plat salé + sucré + boisson' }
    ],
    dessert: [],
    boisson: [
      { name: 'Espresso', price: 2.5, desc: '' },
      { name: 'Americano', price: 3, desc: '' },
      { name: 'Cappuccino', price: 3.8, desc: '' },
      { name: 'Flat White', price: 4, desc: '' },
      { name: 'Latte', price: 4.2, desc: '' },
      { name: 'Iced Latte', price: 4.5, desc: '' },
      { name: 'Cold Brew', price: 4.5, desc: '' },
      { name: 'Matcha Latte', price: 5, desc: '' },
      { name: 'Iced Matcha Latte', price: 5.5, desc: '' },
      { name: 'Strawberry Matcha', price: 6, desc: '' },
      { name: 'Hojicha Latte', price: 5, desc: '' },
      { name: 'Chai Latte', price: 4.5, desc: '' },
      { name: 'Golden Latte', price: 4.8, desc: '' },
      { name: 'Chocolat chaud', price: 4.2, desc: '' },
      { name: 'Thé en feuilles', price: 3.5, desc: 'Vert, noir ou infusion — au choix' },
      { name: 'Limonade maison', price: 4, desc: '' },
      { name: 'Jus pressé', price: 4.5, desc: '' },
      { name: 'Kombucha', price: 4.5, desc: '' },
      { name: 'Smoothie', price: 6, desc: '' }
    ]
  },
  Boulangerie: {
    entree: [
      { name: 'Sandwich jambon fromage', price: 4.5, desc: '' },
      { name: 'Sandwich poulet curry', price: 5, desc: '' },
      { name: 'Sandwich américain préparé', price: 5, desc: '' },
      { name: 'Sandwich thon mayonnaise', price: 4.8, desc: '' },
      { name: 'Club poulet crudités', price: 5.5, desc: '' },
      { name: 'Sandwich végétarien', price: 4.8, desc: '' }
    ],
    plat: [
      { name: 'Baguette', price: 1.3, desc: '' },
      { name: 'Baguette tradition', price: 1.6, desc: '' },
      { name: 'Pain blanc / gris 800g', price: 3.2, desc: '' },
      { name: 'Pain de campagne', price: 4.2, desc: '' },
      { name: 'Pain aux céréales', price: 4.5, desc: '' },
      { name: "Pain d'épeautre", price: 5, desc: '' },
      { name: 'Pistolet (pièce)', price: 0.6, desc: '' }
    ],
    dessert: [
      { name: 'Croissant', price: 1.6, desc: '' },
      { name: 'Pain au chocolat', price: 1.8, desc: '' },
      { name: 'Couque aux raisins', price: 2, desc: '' },
      { name: 'Couque suisse', price: 2.2, desc: '' },
      { name: 'Chausson aux pommes', price: 2.3, desc: '' },
      { name: 'Cramique (tranche)', price: 1.5, desc: '' },
      { name: 'Craquelin', price: 2.5, desc: '' },
      { name: 'Éclair', price: 3.2, desc: '' },
      { name: 'Tarte au riz (part)', price: 3, desc: '' },
      { name: 'Merveilleux', price: 3.8, desc: '' },
      { name: 'Tarte aux fruits (part)', price: 3.8, desc: '' },
      { name: 'Boule de Berlin', price: 2.2, desc: '' },
      { name: 'Gaufre de Liège', price: 2.5, desc: '' },
      { name: 'Cookie', price: 2, desc: '' },
      { name: 'Tarte au riz entière (6-8 pers.)', price: 16, desc: '' },
      { name: 'Tarte aux pommes entière (6-8 pers.)', price: 18, desc: '' },
      { name: 'Tarte aux fraises entière (6-8 pers.)', price: 24, desc: '' }
    ],
    boisson: [
      { name: 'Café à emporter', price: 2.2, desc: '' },
      { name: "Jus d'orange pressé", price: 3.5, desc: '' },
      { name: 'Softs', price: 2.2, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  'Supermarché': {
    entree: [
      { name: 'Chips nature 150g', price: 2, desc: '' },
      { name: 'Cacahuètes salées', price: 2.5, desc: '' },
      { name: 'Chips paprika 150g', price: 2, desc: '' },
      { name: 'Olives marinées 200g', price: 3, desc: '' },
      { name: 'Houmous nature 200g', price: 2.8, desc: '' },
      { name: 'Crackers apéro 100g', price: 2.2, desc: '' },
      { name: 'Mix apéro noix 150g', price: 3.5, desc: '' },
      { name: 'Saucisson sec', price: 4, desc: '' },
      { name: 'Biltong bœuf séché', price: 4.5, desc: '' }
    ],
    plat: [
      { name: 'Plat préparé du jour', price: 5.5, desc: '' },
      { name: 'Pizza surgelée', price: 4, desc: '' },
      { name: 'Pâtes fraîches', price: 3.5, desc: '' },
      { name: 'Plat préparé poulet-riz', price: 5.8, desc: '' },
      { name: 'Soupe en brique', price: 2.5, desc: '' },
      { name: 'Sandwich jambon-fromage', price: 3.8, desc: '' },
      { name: 'Salade composée', price: 4.2, desc: '' },
      { name: 'Riz basmati 1kg', price: 3, desc: '' },
      { name: 'Conserve ravioli', price: 2.3, desc: '' },
      { name: 'Œufs (6)', price: 2.6, desc: '' },
      { name: 'Pâtes penne 500g', price: 1.8, desc: '' }
    ],
    dessert: [
      { name: 'Tablette de chocolat', price: 2.5, desc: '' },
      { name: 'Paquet de biscuits', price: 2, desc: '' },
      { name: 'Yaourt aux fruits (4)', price: 2.8, desc: '' },
      { name: 'Glace vanille 1L', price: 4.5, desc: '' },
      { name: 'Donut chocolat', price: 1.8, desc: '' },
      { name: 'Barres céréales (6)', price: 3, desc: '' },
      { name: 'Fruits secs mélangés 200g', price: 3.2, desc: '' },
      { name: 'Compote pomme (4)', price: 2.4, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 1.5L', price: 2.2, desc: '' },
      { name: 'Coca-Cola Zero 1.5L', price: 2.2, desc: '' },
      { name: 'Sprite 1.5L', price: 2.2, desc: '' },
      { name: 'Eau plate 1.5L', price: 1.5, desc: '' },
      { name: 'Eau pétillante 1.5L', price: 1.4, desc: '' },
      { name: 'Pack de sodas 6x33cl', price: 5, desc: '' },
      { name: 'Jus de fruits 1L', price: 2.5, desc: '' },
      { name: 'Café moulu 250g', price: 4.2, desc: '' },
      { name: 'Lait demi-écrémé 1L', price: 1.3, desc: '' },
      { name: 'Thé glacé 1.5L', price: 2.2, desc: '' }
    ]
  },
  // Assortiment type night shop bruxellois, prix majorés vs. supermarché. Le tabac (cigarettes, tabac
  // à rouler, feuilles/filtres) est volontairement exclu : sa vente à distance est interdite en
  // Belgique. Chaque produit reste sa propre ligne (pas de regroupement en options comme pour les
  // restaurants) — en night shop le client choisit un SKU précis sur l'étagère, pas une préparation.
  'Night Shop': {
    entree: [
      { name: "Chips Lay's 45g", price: 1.8, desc: '' },
      { name: "Chips Lay's 175-250g", price: 4, desc: '' },
      { name: 'Pringles', price: 4.5, desc: '' },
      { name: 'Doritos', price: 4, desc: '' },
      { name: 'Cacahuètes / mix apéro', price: 3, desc: '' },
      { name: 'Tuc', price: 2.5, desc: '' },
      { name: 'Beef jerky', price: 5, desc: '' },
      { name: 'Papier toilette (4 rouleaux)', price: 4, desc: '' },
      { name: 'Mouchoirs', price: 1.5, desc: '' },
      { name: 'Dentifrice', price: 3.5, desc: '' },
      { name: 'Brosse à dents', price: 2.5, desc: '' },
      { name: 'Déodorant', price: 4.5, desc: '' },
      { name: 'Gel douche', price: 4, desc: '' },
      { name: 'Serviettes hygiéniques / tampons', price: 4.5, desc: '' },
      { name: 'Préservatifs (3)', price: 5, desc: '' },
      { name: 'Briquet', price: 1.5, desc: '' },
      { name: 'Chargeur USB', price: 8, desc: '' },
      { name: 'Câble téléphone', price: 8, desc: '' },
      { name: 'Piles AA (4)', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Pain de mie', price: 3, desc: '' },
      { name: 'Lait 1L', price: 2, desc: '' },
      { name: 'Œufs (6)', price: 3, desc: '' },
      { name: 'Beurre', price: 4, desc: '' },
      { name: 'Fromage tranches', price: 4, desc: '' },
      { name: 'Jambon', price: 4, desc: '' },
      { name: 'Pâtes 500g', price: 2.5, desc: '' },
      { name: 'Sauce tomate', price: 3, desc: '' },
      { name: 'Riz', price: 3, desc: '' },
      { name: 'Nutella 400g', price: 5.5, desc: '' },
      { name: 'Céréales', price: 5, desc: '' },
      { name: 'Café moulu', price: 6.5, desc: '' },
      { name: 'Sucre / farine', price: 2.5, desc: '' },
      { name: 'Huile 1L', price: 5, desc: '' },
      { name: 'Conserves (thon, maïs)', price: 3, desc: '' }
    ],
    dessert: [
      { name: 'Barres choco (Mars, Snickers, Kinder Bueno)', price: 1.8, desc: '' },
      { name: "Tablette Côte d'Or", price: 3.5, desc: '' },
      { name: 'Haribo', price: 3, desc: '' },
      { name: "M&M's pochon", price: 4, desc: '' },
      { name: 'Biscuits (Oreo, Prince)', price: 3, desc: '' },
      { name: "Glace Ben & Jerry's 465ml", price: 8.5, desc: '' },
      { name: 'Magnum (pièce)', price: 3, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 2, desc: '' },
      { name: 'Coca-Cola Zero 33cl', price: 2, desc: '' },
      { name: 'Coca-Cola 1,5L', price: 4.5, desc: '' },
      { name: 'Fanta 33cl', price: 2, desc: '' },
      { name: 'Sprite 33cl', price: 2, desc: '' },
      { name: 'Ice Tea 33cl', price: 2, desc: '' },
      { name: 'Red Bull 25cl', price: 3, desc: '' },
      { name: 'Monster 50cl', price: 3.5, desc: '' },
      { name: 'Eau plate 50cl', price: 1.5, desc: '' },
      { name: 'Eau pétillante 50cl', price: 1.5, desc: '' },
      { name: 'Eau 1,5L', price: 2.5, desc: '' },
      { name: 'Jus (Looza, Minute Maid) 33cl', price: 2.5, desc: '' },
      { name: 'Capri-Sun', price: 1.5, desc: '' },
      { name: 'Jupiler 33cl', price: 2, desc: '' },
      { name: 'Jupiler 50cl', price: 2.8, desc: '' },
      { name: 'Cara Pils 50cl', price: 1.8, desc: '' },
      { name: 'Duvel 33cl', price: 3.5, desc: '' },
      { name: 'Chimay bleue 33cl', price: 4, desc: '' },
      { name: 'Kriek / Chouffe 33cl', price: 3.5, desc: '' },
      { name: 'Leffe 33cl', price: 3, desc: '' },
      { name: 'Desperados 33cl', price: 3.5, desc: '' },
      { name: 'Corona 35,5cl', price: 3.5, desc: '' },
      { name: 'Pack Jupiler 6 × 33cl', price: 10, desc: '' },
      { name: 'Vin rouge / blanc / rosé', price: 10, desc: 'Entrée de gamme' },
      { name: 'Vin correct', price: 15, desc: '' },
      { name: 'Prosecco', price: 12, desc: '' },
      { name: 'Vodka 70cl', price: 20, desc: '' },
      { name: 'Whisky 70cl', price: 26.5, desc: 'JW Red, Jameson' },
      { name: 'Gin 70cl', price: 24, desc: '' },
      { name: 'Rhum 70cl', price: 22, desc: '' },
      { name: 'Jägermeister 70cl', price: 22, desc: '' },
      { name: 'Mignonnettes', price: 3, desc: '' }
    ]
  },
  Boucherie: {
    entree: [
      { name: 'Jambon cuit (100g)', price: 2.2, desc: '' },
      { name: "Jambon d'Ardenne (100g)", price: 3.5, desc: '' },
      { name: 'Salami (100g)', price: 2, desc: '' },
      { name: 'Pâté de campagne (100g)', price: 1.8, desc: '' },
      { name: 'Boudin blanc / noir (pièce)', price: 2, desc: '' },
      { name: 'Sauce maison (pot)', price: 3.5, desc: '' },
      { name: 'Frites fraîches (kg)', price: 3, desc: '' },
      { name: 'Œufs (6)', price: 2.5, desc: '' }
    ],
    plat: [
      { name: 'Haché porc et veau (kg)', price: 12.9, desc: '' },
      { name: 'Haché de bœuf (kg)', price: 15.9, desc: '' },
      { name: 'Steak de bœuf (kg)', price: 24.9, desc: '' },
      { name: 'Entrecôte (kg)', price: 32.9, desc: '' },
      { name: 'Filet pur de porc (kg)', price: 16.9, desc: '' },
      { name: 'Côtes de porc (kg)', price: 11.9, desc: '' },
      { name: 'Filet de poulet (kg)', price: 13.9, desc: '' },
      { name: 'Cuisses de poulet (kg)', price: 7.9, desc: '' },
      { name: "Gigot d'agneau (kg)", price: 22.9, desc: '' },
      { name: 'Rôti de bœuf (kg)', price: 24.9, desc: '' },
      { name: 'Filet américain préparé (100g)', price: 2.2, desc: '' },
      { name: 'Saucisses maison (pièce)', price: 1.5, desc: '' },
      { name: 'Merguez (pièce)', price: 1.3, desc: '' },
      { name: 'Boulettes (pièce)', price: 1.2, desc: '' },
      { name: 'Brochettes marinées (pièce)', price: 3.5, desc: '' },
      { name: 'Cordon bleu (pièce)', price: 3.8, desc: '' },
      { name: 'Oiseaux sans tête (pièce)', price: 3.5, desc: '' },
      { name: 'Vol-au-vent (portion)', price: 8.5, desc: '' },
      { name: 'Boulets sauce tomate (portion)', price: 8, desc: '' },
      { name: 'Lasagne (portion)', price: 8.5, desc: '' },
      { name: 'Carbonnades (portion)', price: 9.5, desc: '' },
      { name: 'Stoemp carottes (portion)', price: 6, desc: '' },
      { name: 'Salade de pâtes (portion)', price: 5, desc: '' }
    ],
    dessert: [],
    boisson: []
  },
  // Bar à tapas espagnol.
  Espagnol: {
    entree: [
      { name: 'Pan con tomate', price: 4.5, desc: '' },
      { name: 'Jamón ibérico (50g)', price: 12, desc: '' },
      { name: 'Manchego', price: 7.5, desc: '' },
      { name: 'Olives marinées', price: 3.5, desc: '' },
      { name: 'Boquerones', price: 6.5, desc: '' },
      { name: 'Salmorejo', price: 6, desc: '' },
      { name: 'Patatas bravas', price: 6, desc: '' },
      { name: 'Tortilla', price: 6.5, desc: '' },
      { name: 'Croquetas jamón (4 pcs)', price: 7, desc: '' },
      { name: 'Gambas al ajillo', price: 11, desc: '' },
      { name: 'Chorizo al vino', price: 7.5, desc: '' },
      { name: 'Calamares a la romana', price: 9.5, desc: '' },
      { name: 'Pimientos de padrón', price: 6.5, desc: '' },
      { name: 'Albóndigas', price: 8, desc: '' },
      { name: 'Pulpo a la gallega', price: 14, desc: '' }
    ],
    plat: [
      { name: 'Paella valenciana (par pers., min. 2 pers.)', price: 18, desc: '' },
      { name: 'Paella marisco (par pers.)', price: 21, desc: '' },
      { name: 'Fideuá (par pers.)', price: 18, desc: '' },
      { name: 'Secreto ibérico', price: 22, desc: '' },
      { name: 'Sélection 6 tapas', price: 32, desc: '' },
      { name: 'Sélection 10 tapas', price: 52, desc: '' }
    ],
    dessert: [
      { name: 'Crema catalana', price: 6, desc: '' },
      { name: 'Churros con chocolate', price: 6.5, desc: '' },
      { name: 'Tarta de Santiago', price: 6, desc: '' }
    ],
    boisson: [
      { name: 'Sangria 50cl', price: 12, desc: '' },
      { name: 'Tinto de verano', price: 5, desc: '' },
      { name: 'Bière 33cl', price: 3.5, desc: 'Estrella ou Mahou — au choix' },
      { name: 'Vin Rioja (verre)', price: 5.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  'Poke Bowl': {
    plat: [
      { name: 'Poke bowl saumon', price: 13.5, desc: '' },
      { name: 'Poke bowl thon', price: 14, desc: '' },
      { name: 'Poke bowl crevettes', price: 13, desc: '' },
      { name: 'Poke bowl saumon avocat mangue', price: 14.5, desc: '' },
      { name: 'Poke bowl poulet teriyaki', price: 12.5, desc: '' },
      { name: 'Poke bowl bœuf épicé', price: 14.5, desc: '' },
      { name: 'Poke bowl tofu edamame', price: 11.5, desc: '' },
      { name: 'Poke bowl végétarien', price: 11, desc: '' },
      { name: 'Poke bowl double saumon', price: 16.5, desc: '' }
    ],
    entree: [
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Salade de wakame', price: 5, desc: '' },
      { name: 'Soupe miso', price: 4, desc: '' },
      { name: 'Gyoza légumes (4 pcs)', price: 5.5, desc: '' },
      { name: 'Gyoza poulet (4 pcs)', price: 6, desc: '' }
    ],
    dessert: [
      { name: 'Mochi (3 pcs)', price: 4.5, desc: '' },
      { name: 'Cheesecake matcha', price: 5, desc: '' },
      { name: 'Salade de fruits frais', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé glacé maison', price: 3.5, desc: '' },
      { name: 'Eau de coco', price: 4, desc: '' },
      { name: 'Limonade au yuzu', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  Thaïlandais: {
    entree: [
      { name: 'Nems poulet (4 pcs)', price: 6, desc: '' },
      { name: 'Rouleaux de printemps frais (2 pcs)', price: 5.5, desc: '' },
      { name: 'Salade de papaye verte (som tam)', price: 7, desc: '' },
      { name: 'Soupe tom yum crevettes', price: 7.5, desc: '' },
      { name: 'Beignets de crevettes (5 pcs)', price: 6.5, desc: '' },
      { name: 'Satay de poulet (4 brochettes)', price: 7, desc: 'Sauce cacahuète' }
    ],
    plat: [
      { name: 'Pad thaï poulet', price: 13.5, desc: '' },
      { name: 'Pad thaï crevettes', price: 15, desc: '' },
      { name: 'Pad thaï tofu', price: 12.5, desc: '' },
      { name: 'Curry vert poulet', price: 14, desc: '' },
      { name: 'Curry rouge bœuf', price: 15.5, desc: '' },
      { name: 'Curry massaman agneau', price: 16, desc: '' },
      { name: 'Riz sauté au basilic, poulet (pad kra pao)', price: 13, desc: '' },
      { name: 'Nouilles sautées aux légumes', price: 11.5, desc: '' },
      { name: 'Canard laqué au curry rouge', price: 17, desc: '' },
      { name: "Bœuf sauté à l'ail et poivre", price: 15, desc: '' }
    ],
    dessert: [
      { name: 'Riz gluant à la mangue', price: 6.5, desc: '' },
      { name: 'Beignets de banane', price: 4.5, desc: '' },
      { name: 'Glace au coco', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé thaï glacé', price: 4, desc: '' },
      { name: 'Eau de coco', price: 4, desc: '' },
      { name: 'Bière Singha', price: 4.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  Indien: {
    entree: [
      { name: 'Samoussas légumes (3 pcs)', price: 5.5, desc: '' },
      { name: 'Samoussas agneau (3 pcs)', price: 6.5, desc: '' },
      { name: 'Pakoras de légumes', price: 5.5, desc: '' },
      { name: 'Papadums (assortiment)', price: 3.5, desc: '' },
      { name: 'Soupe mulligatawny', price: 5.5, desc: '' },
      { name: 'Naan nature', price: 3, desc: '' },
      { name: "Naan à l'ail", price: 3.5, desc: '' },
      { name: 'Naan au fromage', price: 4, desc: '' }
    ],
    plat: [
      { name: 'Butter chicken', price: 15, desc: '' },
      { name: 'Tikka masala poulet', price: 15, desc: '' },
      { name: "Curry d'agneau", price: 17, desc: '' },
      { name: 'Aloo gobi (curry pommes de terre chou-fleur)', price: 12.5, desc: '' },
      { name: 'Biryani poulet', price: 15.5, desc: '' },
      { name: 'Biryani agneau', price: 17.5, desc: '' },
      { name: 'Dahl de lentilles', price: 11.5, desc: '' },
      { name: 'Saag paneer', price: 13, desc: '' },
      { name: 'Vindaloo poulet', price: 15, desc: 'Épicé' },
      { name: 'Korma agneau', price: 17, desc: '' },
      { name: 'Riz basmati', price: 3.5, desc: '' }
    ],
    dessert: [
      { name: 'Gulab jamun (2 pcs)', price: 4.5, desc: '' },
      { name: 'Kulfi (glace indienne)', price: 5, desc: '' },
      { name: 'Riz au lait à la cardamome', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Lassi mangue', price: 4.5, desc: '' },
      { name: 'Lassi salé', price: 4, desc: '' },
      { name: 'Chai latte', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  Vietnamien: {
    entree: [
      { name: 'Nems (rouleaux impériaux, 4 pcs)', price: 6, desc: '' },
      { name: 'Rouleaux de printemps frais (2 pcs)', price: 5.5, desc: '' },
      { name: 'Salade de papaye verte au bœuf séché', price: 7.5, desc: '' },
      { name: 'Soupe won ton', price: 6.5, desc: '' },
      { name: 'Beignets de crevettes (5 pcs)', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Phở bœuf', price: 13.5, desc: '' },
      { name: 'Phở poulet', price: 12.5, desc: '' },
      { name: 'Bún bò Huế', price: 14, desc: 'Soupe épicée au bœuf' },
      { name: 'Bo bun bœuf grillé', price: 13.5, desc: '' },
      { name: 'Bo bun nems', price: 12.5, desc: '' },
      { name: 'Bánh mì poulet', price: 8, desc: '' },
      { name: 'Bánh mì porc grillé', price: 8.5, desc: '' },
      { name: 'Bánh mì tofu', price: 7.5, desc: '' },
      { name: 'Cơm tấm (porc grillé, riz brisé)', price: 13, desc: '' },
      { name: 'Riz sauté au porc', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Chè (dessert coco et haricots)', price: 4.5, desc: '' },
      { name: 'Beignets de banane', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Café vietnamien glacé (cà phê sữa đá)', price: 4, desc: '' },
      { name: 'Thé glacé', price: 3.5, desc: '' },
      { name: 'Eau de coco', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  Chinois: {
    entree: [
      { name: 'Dim sum vapeur mixte (6 pcs)', price: 8, desc: '' },
      { name: 'Raviolis vapeur au porc (6 pcs)', price: 7, desc: '' },
      { name: 'Nems poulet (4 pcs)', price: 6, desc: '' },
      { name: 'Rouleaux de printemps (4 pcs)', price: 5.5, desc: '' },
      { name: 'Soupe wonton', price: 6, desc: '' },
      { name: 'Soupe aigre-piquante', price: 6, desc: '' }
    ],
    plat: [
      { name: 'Canard laqué (portion)', price: 16.5, desc: '' },
      { name: 'Poulet General Tao', price: 13.5, desc: '' },
      { name: 'Bœuf aux oignons sauce noire', price: 14.5, desc: '' },
      { name: 'Porc aigre-doux', price: 12.5, desc: '' },
      { name: 'Nouilles sautées cantonaises', price: 11.5, desc: '' },
      { name: 'Riz cantonais', price: 9.5, desc: '' },
      { name: 'Crevettes sauce piquante', price: 15, desc: '' },
      { name: 'Tofu mapo', price: 11, desc: 'Épicé' },
      { name: 'Chow mein légumes', price: 10.5, desc: '' }
    ],
    dessert: [
      { name: 'Beignets à la banane', price: 4.5, desc: '' },
      { name: 'Glace au litchi', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé au jasmin', price: 3, desc: '' },
      { name: 'Thé oolong', price: 3, desc: '' },
      { name: 'Bière Tsingtao', price: 4.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' }
    ]
  },
  'Desserts & Glaces': {
    dessert: [
      { name: 'Glace boule (1 parfum)', price: 2.8, desc: '' },
      { name: 'Glace boule (2 parfums)', price: 4.5, desc: '' },
      { name: 'Glace boule (3 parfums)', price: 5.8, desc: '' },
      { name: 'Coupe glacée gourmande', price: 7.5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Cookie double chocolat', price: 3.5, desc: '' },
      { name: 'Donut glaçage classique', price: 3.2, desc: '' },
      { name: 'Donut garni (Nutella, caramel...)', price: 4, desc: '' },
      { name: 'Gaufre de Liège nature', price: 3.5, desc: '' },
      { name: 'Gaufre de Liège chocolat', price: 4.5, desc: '' },
      { name: 'Gaufre de Bruxelles sucre', price: 4, desc: '' },
      { name: 'Crêpe sucre', price: 3, desc: '' },
      { name: 'Crêpe Nutella', price: 4.5, desc: '' },
      { name: 'Crêpe Nutella banane chantilly', price: 5.5, desc: '' },
      { name: 'Milkshake vanille', price: 5.5, desc: '' },
      { name: 'Milkshake chocolat', price: 5.5, desc: '' },
      { name: 'Milkshake fraise', price: 5.5, desc: '' },
      { name: 'Part de cheesecake', price: 5, desc: '' },
      { name: 'Part de tarte aux fruits', price: 4.5, desc: '' },
      { name: 'Fondant au chocolat', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Chocolat chaud', price: 4, desc: '' },
      { name: 'Chocolat chaud chantilly', price: 4.8, desc: '' },
      { name: 'Café', price: 2.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  'Petit-déjeuner & Brunch': {
    entree: [
      { name: 'Viennoiserie au choix', price: 2.5, desc: 'Croissant, pain au chocolat ou pain aux raisins' },
      { name: 'Granola yaourt fruits', price: 6.5, desc: '' },
      { name: 'Porridge fruits rouges', price: 6.5, desc: '' },
      { name: 'Toast avocat', price: 8.5, desc: '' },
      { name: 'Toast avocat œuf poché', price: 10, desc: '' }
    ],
    plat: [
      { name: 'Pancakes nature (3 pcs)', price: 8, desc: '' },
      { name: "Pancakes sirop d'érable fruits rouges", price: 10, desc: '' },
      { name: 'Œufs brouillés bacon', price: 10.5, desc: '' },
      { name: 'Œufs Bénédicte', price: 12.5, desc: '' },
      { name: 'Œufs au plat toast', price: 9, desc: '' },
      { name: 'Omelette fromage jambon', price: 10, desc: '' },
      { name: 'Bagel saumon fumé', price: 11.5, desc: '' },
      { name: 'Croque-monsieur', price: 8.5, desc: '' },
      { name: 'Formule brunch complète', price: 22, desc: 'Salé + sucré + boisson chaude + jus' }
    ],
    dessert: [
      { name: 'Waffle sucre', price: 4, desc: '' },
      { name: 'Salade de fruits frais', price: 5, desc: '' },
      { name: 'Yaourt maison miel granola', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Café', price: 2.8, desc: '' },
      { name: 'Cappuccino', price: 3.8, desc: '' },
      { name: 'Thé', price: 3, desc: '' },
      { name: "Jus d'orange pressé", price: 4.5, desc: '' },
      { name: 'Smoothie fruits', price: 6, desc: '' },
      { name: 'Chocolat chaud', price: 4, desc: '' }
    ]
  },
  'Sandwichs & Salades': {
    entree: [
      { name: 'Soupe du jour', price: 5, desc: '' },
      { name: 'Salade verte', price: 4, desc: '' },
      { name: 'Salade de tomates mozzarella', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Sandwich jambon fromage', price: 5.5, desc: '' },
      { name: 'Sandwich poulet crudités', price: 6.5, desc: '' },
      { name: 'Sandwich thon mayonnaise', price: 6, desc: '' },
      { name: 'Sandwich végétarien', price: 5.5, desc: '' },
      { name: 'Sandwich saumon fumé', price: 7.5, desc: '' },
      { name: 'Club sandwich', price: 8.5, desc: '' },
      { name: 'Wrap poulet César', price: 7.5, desc: '' },
      { name: 'Wrap falafel houmous', price: 7, desc: '' },
      { name: 'Wrap thon', price: 7, desc: '' },
      { name: 'Salade César poulet', price: 11.5, desc: '' },
      { name: 'Salade grecque', price: 10.5, desc: '' },
      { name: 'Salade niçoise', price: 11.5, desc: '' },
      { name: 'Salade chèvre chaud', price: 11.5, desc: '' },
      { name: 'Salade quinoa avocat', price: 11, desc: '' },
      { name: 'Bagel saumon fromage frais', price: 9.5, desc: '' }
    ],
    dessert: [
      { name: 'Cookie', price: 2.5, desc: '' },
      { name: 'Muffin', price: 3, desc: '' },
      { name: 'Salade de fruits', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Jus pressé', price: 4, desc: '' },
      { name: 'Café', price: 2.5, desc: '' }
    ]
  },
  Africain: {
    entree: [
      { name: 'Accras de morue (5 pcs)', price: 6.5, desc: '' },
      { name: 'Beignets de crevettes (pastels, 5 pcs)', price: 6.5, desc: '' },
      { name: 'Salade avocat mangue', price: 6, desc: '' },
      { name: "Soupe à l'arachide", price: 6, desc: '' }
    ],
    plat: [
      { name: 'Mafé poulet', price: 14.5, desc: 'Sauce arachide, riz' },
      { name: 'Mafé bœuf', price: 15.5, desc: 'Sauce arachide, riz' },
      { name: 'Thiéboudienne (riz au poisson)', price: 15, desc: '' },
      { name: 'Yassa poulet', price: 14, desc: 'Sauce oignons citron, riz' },
      { name: 'Alloco (bananes plantains frites)', price: 6.5, desc: '' },
      { name: 'Attiéké poisson braisé', price: 15.5, desc: '' },
      { name: 'Poulet braisé (poulet DG)', price: 16, desc: 'Bananes plantains, légumes' },
      { name: 'Riz gras', price: 13.5, desc: 'Riz au gras, sauce tomate, viande' },
      { name: 'Sauce graine riz', price: 14.5, desc: '' },
      { name: 'Kedjenou de poulet', price: 15, desc: 'Mijoté aux légumes' },
      { name: 'Foutou sauce claire', price: 14.5, desc: '' }
    ],
    dessert: [
      { name: "Gâteau à l'ananas", price: 4.5, desc: '' },
      { name: 'Beignets sucrés', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Bissap (hibiscus)', price: 3.5, desc: '' },
      { name: 'Gingembre maison', price: 3.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  'Poisson & Fruits de mer': {
    entree: [
      { name: 'Soupe de poisson', price: 7.5, desc: '' },
      { name: 'Croquettes de crevettes grises (2 pcs)', price: 8, desc: '' },
      { name: 'Carpaccio de saumon', price: 10.5, desc: '' },
      { name: 'Calamars frits', price: 9.5, desc: '' },
      { name: 'Plateau de moules marinière (mise en bouche)', price: 8, desc: '' }
    ],
    plat: [
      { name: 'Fish & chips (cabillaud)', price: 15.5, desc: '' },
      { name: 'Moules marinière frites', price: 19.5, desc: '' },
      { name: 'Moules à la crème frites', price: 20.5, desc: '' },
      { name: 'Cabillaud grillé légumes', price: 18.5, desc: '' },
      { name: 'Saumon grillé légumes', price: 19, desc: '' },
      { name: 'Sole meunière', price: 24, desc: '' },
      { name: 'Waterzooi de poisson', price: 19.5, desc: '' },
      { name: 'Plateau de fruits de mer (1 pers.)', price: 32, desc: '' },
      { name: 'Paella de fruits de mer', price: 19.5, desc: '' },
      { name: "Scampis à l'ail", price: 21, desc: '' },
      { name: 'Croquettes de crevettes grises, frites', price: 16.5, desc: '' }
    ],
    dessert: [
      { name: 'Tarte au riz', price: 3.5, desc: '' },
      { name: 'Mousse au chocolat', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Vin blanc (verre)', price: 5.5, desc: '' },
      { name: 'Bière blanche', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  Friterie: {
    entree: [
      { name: 'Petite frites', price: 3, desc: '' },
      { name: 'Moyenne frites', price: 4, desc: '' },
      { name: 'Grande frites', price: 5, desc: '' },
      { name: 'Frites XXL', price: 6, desc: '' },
      { name: 'Frites fromage', price: 5.5, desc: '' },
      { name: 'Frites sauce maison', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Fricadelle', price: 2.8, desc: '' },
      { name: 'Mitraillette fricadelle', price: 7.5, desc: 'Baguette, frites, fricadelle, sauce au choix' },
      { name: 'Boulet sauce lapin', price: 4.5, desc: '' },
      { name: 'Croquette de fromage', price: 3, desc: '' },
      { name: 'Croquette de crevettes', price: 4, desc: '' },
      { name: 'Bitterballen (6 pcs)', price: 5.5, desc: '' },
      { name: 'Cervelas', price: 3, desc: '' },
      { name: 'Berlinerworst', price: 3, desc: '' },
      { name: 'Kipcorn', price: 3.2, desc: '' },
      { name: 'Loempia', price: 3, desc: '' },
      { name: 'Bicky Burger', price: 6.5, desc: '' },
      { name: 'Chicken nuggets (6 pcs)', price: 5, desc: '' },
      { name: 'Viandelle', price: 2.8, desc: '' },
      { name: 'Mexicano', price: 3, desc: '' },
      { name: 'Curryworst', price: 3.5, desc: '' },
      { name: 'Frikandel spécial', price: 3.8, desc: '' },
      { name: 'Brochette de poulet', price: 5, desc: '' },
      { name: 'Merguez', price: 3.5, desc: '' },
      { name: 'Saucisse de Frankfort', price: 3, desc: '' },
      { name: 'Boulet sauce tomate', price: 4.5, desc: '' }
    ],
    dessert: [
      { name: 'Beignet', price: 2.5, desc: '' },
      { name: 'Gaufre de Bruxelles', price: 3.5, desc: '' },
      { name: 'Gaufre de Liège', price: 3.5, desc: '' },
      { name: 'Churros', price: 4, desc: '' },
      { name: 'Glace (cornet)', price: 2.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.5, desc: '' },
      { name: 'Fanta', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Ice Tea', price: 2.5, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' },
      { name: 'Eau pétillante', price: 1.8, desc: '' },
      { name: 'Jupiler 25cl', price: 3, desc: '' },
      { name: 'Chimay bleue', price: 4, desc: '' },
      { name: "Jus d'orange pressé", price: 3.5, desc: '' },
      { name: 'Milkshake', price: 4.5, desc: '' }
    ]
  },
  'Coréen': {
    entree: [
      { name: 'Kimchi maison', price: 4.5, desc: '' },
      { name: 'Mandu (raviolis, 6 pcs)', price: 6.5, desc: '' },
      { name: "Pajeon (galette d'oignons verts)", price: 7, desc: '' },
      { name: 'Manduguk (soupe de raviolis)', price: 7.5, desc: '' },
      { name: 'Tteokbokki', price: 7.5, desc: '' },
      { name: 'Japchae (nouilles sautées)', price: 8, desc: '' },
      { name: 'Kimbap saumon (8 pcs)', price: 8.5, desc: '' },
      { name: 'Kimbap légumes (8 pcs)', price: 7.5, desc: '' },
      { name: 'Soupe miso coréenne', price: 5, desc: '' },
      { name: 'Salade de concombre épicée', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Bibimbap bœuf', price: 15.5, desc: '' },
      { name: 'Bibimbap poulet', price: 14.5, desc: '' },
      { name: 'Bibimbap végétarien', price: 13.5, desc: '' },
      { name: 'Bulgogi bœuf', price: 16.5, desc: '' },
      { name: 'Bulgogi poulet', price: 15, desc: '' },
      { name: 'Poulet frit coréen (yangnyeom)', price: 14, desc: '' },
      { name: 'Poulet frit coréen (soy garlic)', price: 14, desc: '' },
      { name: 'Kimchi jjigae (ragoût de kimchi)', price: 13.5, desc: '' },
      { name: 'Sundubu jjigae (tofu épicé)', price: 13, desc: '' },
      { name: 'Japchae bœuf', price: 15, desc: '' },
      { name: 'Galbi (côtes de bœuf marinées)', price: 19.5, desc: '' },
      { name: 'Ramyun épicé', price: 11.5, desc: '' },
      { name: 'Poulet katsu coréen', price: 14.5, desc: '' },
      { name: 'Riz frit kimchi', price: 12.5, desc: '' },
      { name: 'Bibim guksu (nouilles froides épicées)', price: 13, desc: '' },
      { name: 'Soondae (boudin coréen)', price: 9.5, desc: '' }
    ],
    dessert: [
      { name: 'Bingsu (glace pilée)', price: 7, desc: '' },
      { name: 'Hotteok (crêpe fourrée)', price: 4, desc: '' },
      { name: 'Mochi coréen', price: 5, desc: '' },
      { name: 'Patbingsu fruits', price: 7.5, desc: '' },
      { name: 'Yakgwa (biscuit au miel)', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé vert coréen', price: 3, desc: '' },
      { name: 'Sikhye (boisson de riz)', price: 3.5, desc: '' },
      { name: 'Soju', price: 8, desc: '' },
      { name: 'Makgeolli', price: 7, desc: '' },
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' },
      { name: 'Thé aux graines grillées', price: 3, desc: '' },
      { name: 'Café glacé coréen', price: 4, desc: '' },
      { name: 'Yuja tea (thé au citron coréen)', price: 4, desc: '' }
    ]
  },
  Marocain: {
    entree: [
      { name: 'Harira', price: 5.5, desc: '' },
      { name: "Zaalouk (caviar d'aubergines)", price: 5, desc: '' },
      { name: 'Briouates viande (3 pcs)', price: 6.5, desc: '' },
      { name: 'Briouates fromage (3 pcs)', price: 6, desc: '' },
      { name: 'Salade marocaine', price: 5.5, desc: '' },
      { name: 'Pastilla au poulet', price: 8.5, desc: '' },
      { name: 'Houmous marocain', price: 5, desc: '' },
      { name: 'Olives marinées', price: 3.5, desc: '' },
      { name: 'Pain marocain (khobz)', price: 2, desc: '' },
      { name: "Soupe de poisson à la marocaine", price: 6, desc: '' }
    ],
    plat: [
      { name: 'Tajine poulet citron confit', price: 16.5, desc: '' },
      { name: 'Tajine agneau pruneaux', price: 19.5, desc: '' },
      { name: 'Tajine bœuf abricots', price: 18, desc: '' },
      { name: 'Tajine kefta œufs', price: 15.5, desc: '' },
      { name: 'Couscous royal', price: 19, desc: '' },
      { name: 'Couscous végétarien', price: 14.5, desc: '' },
      { name: 'Couscous poulet', price: 16, desc: '' },
      { name: "Méchoui d'agneau", price: 22, desc: '' },
      { name: 'Brochettes kefta', price: 14.5, desc: '' },
      { name: 'Brochettes poulet', price: 14, desc: '' },
      { name: 'Brochettes agneau', price: 16.5, desc: '' },
      { name: 'Rfissa', price: 17.5, desc: '' },
      { name: 'Chorba', price: 6, desc: '' },
      { name: 'Msemen fourré', price: 5, desc: '' },
      { name: 'Tanjia', price: 20, desc: '' },
      { name: 'Poulet aux olives', price: 16, desc: '' }
    ],
    dessert: [
      { name: 'Cornes de gazelle (4 pcs)', price: 5, desc: '' },
      { name: 'Chebakia', price: 4.5, desc: '' },
      { name: 'Baklava marocain', price: 5, desc: '' },
      { name: 'Sellou', price: 4.5, desc: '' },
      { name: "Salade d'oranges à la cannelle", price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Thé à la menthe', price: 3, desc: '' },
      { name: "Jus d'avocat", price: 5, desc: '' },
      { name: 'Jus de fraise', price: 4.5, desc: '' },
      { name: 'Limonade marocaine', price: 3.5, desc: '' },
      { name: 'Café marocain', price: 2.8, desc: '' },
      { name: 'Lben (lait fermenté)', price: 3, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' },
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea — au choix' },
      { name: "Jus d'orange pressé", price: 3.5, desc: '' }
    ]
  },
  'Bubble Tea': {
    entree: [
      { name: 'Nems végétariens (3 pcs)', price: 5, desc: '' },
      { name: 'Beignets de crevettes (4 pcs)', price: 6, desc: '' },
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Chips crevettes', price: 3, desc: '' },
      { name: 'Mochi glacé (3 pcs)', price: 5.5, desc: '' },
      { name: 'Takoyaki (5 pcs)', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Bao bun poulet', price: 6, desc: '' },
      { name: 'Bao bun porc', price: 6, desc: '' },
      { name: 'Bowl de riz teriyaki', price: 9.5, desc: '' },
      { name: 'Wrap teriyaki poulet', price: 8, desc: '' }
    ],
    dessert: [
      { name: 'Mochi assortiment (6 pcs)', price: 7, desc: '' },
      { name: 'Waffle taiyaki', price: 5, desc: '' },
      { name: 'Crêpe glacée', price: 5.5, desc: '' },
      { name: 'Gaufre bubble waffle', price: 6, desc: '' }
    ],
    boisson: [
      { name: 'Bubble tea taro', price: 5.5, desc: '' },
      { name: 'Bubble tea matcha', price: 5.5, desc: '' },
      { name: 'Bubble tea thé noir classique', price: 5, desc: '' },
      { name: 'Bubble tea thé vert', price: 5, desc: '' },
      { name: 'Bubble tea fraise', price: 5.5, desc: '' },
      { name: 'Bubble tea mangue', price: 5.5, desc: '' },
      { name: 'Bubble tea passion', price: 5.5, desc: '' },
      { name: 'Bubble tea lychee', price: 5.5, desc: '' },
      { name: 'Bubble tea chocolat', price: 5.5, desc: '' },
      { name: 'Bubble tea caramel', price: 5.5, desc: '' },
      { name: 'Bubble tea brown sugar', price: 6, desc: '' },
      { name: 'Bubble tea coco', price: 5.5, desc: '' },
      { name: 'Bubble tea melon', price: 5.5, desc: '' },
      { name: 'Bubble tea myrtille', price: 5.5, desc: '' },
      { name: 'Milk tea classique', price: 4.5, desc: '' },
      { name: 'Thai milk tea', price: 5, desc: '' },
      { name: 'Matcha latte glacé', price: 5.5, desc: '' },
      { name: 'Fruit tea pêche', price: 5, desc: '' },
      { name: 'Fruit tea mangue-passion', price: 5, desc: '' },
      { name: 'Smoothie taro', price: 6, desc: '' },
      { name: 'Smoothie mangue', price: 6, desc: '' },
      { name: 'Slush fraise', price: 5.5, desc: '' },
      { name: 'Slush myrtille', price: 5.5, desc: '' },
      { name: 'Thé glacé jasmin', price: 4, desc: '' },
      { name: 'Thé glacé oolong', price: 4, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' }
    ]
  },
  Ramen: {
    entree: [
      { name: 'Gyoza poulet (6 pcs)', price: 6.5, desc: '' },
      { name: 'Gyoza légumes (6 pcs)', price: 6, desc: '' },
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Karaage (poulet frit japonais)', price: 7, desc: '' },
      { name: 'Takoyaki (6 pcs)', price: 6.5, desc: '' },
      { name: 'Salade wakame', price: 5.5, desc: '' },
      { name: 'Soupe miso', price: 4.5, desc: '' },
      { name: 'Tempura crevettes (4 pcs)', price: 8, desc: '' },
      { name: 'Tempura légumes', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Ramen shoyu poulet', price: 14.5, desc: '' },
      { name: 'Ramen miso porc', price: 15.5, desc: '' },
      { name: 'Ramen tonkotsu', price: 16, desc: '' },
      { name: 'Ramen shoyu végétarien', price: 13.5, desc: '' },
      { name: 'Ramen curry japonais', price: 15, desc: '' },
      { name: 'Udon bœuf', price: 14.5, desc: '' },
      { name: 'Udon légumes', price: 12.5, desc: '' },
      { name: 'Yakisoba poulet', price: 13.5, desc: '' },
      { name: 'Yakisoba bœuf', price: 14.5, desc: '' },
      { name: 'Katsu curry poulet', price: 15, desc: '' },
      { name: 'Katsu curry porc', price: 15.5, desc: '' },
      { name: 'Donburi saumon', price: 15.5, desc: '' },
      { name: 'Donburi bœuf teriyaki', price: 15.5, desc: '' },
      { name: 'Onigiri saumon (2 pcs)', price: 5.5, desc: '' },
      { name: 'Onigiri thon mayo (2 pcs)', price: 5.5, desc: '' },
      { name: 'Chirashi don', price: 18.5, desc: '' },
      { name: 'Riz au curry japonais', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Mochi glacé (3 pcs)', price: 5.5, desc: '' },
      { name: 'Dorayaki', price: 4, desc: '' },
      { name: 'Cheesecake matcha', price: 5.5, desc: '' },
      { name: 'Purin (flan japonais)', price: 4.5, desc: '' },
      { name: 'Taiyaki', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé vert japonais', price: 3, desc: '' },
      { name: 'Ramune (soda japonais)', price: 3.5, desc: '' },
      { name: 'Saké chaud', price: 6.5, desc: '' },
      { name: 'Saké froid', price: 6.5, desc: '' },
      { name: 'Bière Asahi', price: 4.5, desc: '' },
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Eau plate', price: 1.8, desc: '' },
      { name: 'Thé oolong glacé', price: 3.5, desc: '' },
      { name: 'Calpis', price: 3.5, desc: '' }
    ]
  }
};

export function getStarterTemplate(cuisineType) {
  return TYPE_TEMPLATES[cuisineType] || GENERIC_TEMPLATE;
}

// Menu complet : tous les produits du template, toutes catégories confondues.
export function fullTemplateItems(cuisineType) {
  const template = getStarterTemplate(cuisineType);
  const items = [];
  Object.entries(template).forEach(([cat, list]) => {
    list.forEach((it) => items.push({ ...it, category: cat }));
  });
  return items;
}

// Menu rapide : un sous-ensemble du template (les premiers produits de chaque catégorie).
export function quickTemplateItems(cuisineType, capPerCategory = 3) {
  const template = getStarterTemplate(cuisineType);
  const items = [];
  Object.entries(template).forEach(([cat, list]) => {
    list.slice(0, capPerCategory).forEach((it) => items.push({ ...it, category: cat }));
  });
  return items;
}

// Boissons et desserts standards Fairide, proposables en un clic sur n'importe quel type de commerce.
export const CLASSIC_DRINKS = [
  { name: 'Coca-Cola', price: 2.8 },
  { name: 'Coca-Cola Zero', price: 2.8 },
  { name: 'Fanta Orange', price: 2.8 },
  { name: 'Sprite', price: 2.8 },
  { name: 'Fuze Tea Pêche', price: 3.0 },
  { name: 'Eau plate', price: 2.5 },
  { name: 'Eau pétillante', price: 2.5 },
  { name: 'Limonade maison', price: 4.0 },
  { name: "Jus d'orange", price: 3.5 },
  { name: 'Jus de pomme', price: 3.5 }
];

export const CLASSIC_DESSERTS = [
  { name: 'Tiramisu', price: 6.0 },
  { name: 'Fondant au chocolat', price: 6.5 },
  { name: 'Cheesecake', price: 6.0 },
  { name: 'Mousse au chocolat', price: 5.5 },
  { name: 'Brownie au chocolat', price: 4.5 },
  { name: 'Cookie aux pépites de chocolat', price: 3.5 },
  { name: 'Crème brûlée', price: 6.0 },
  { name: 'Panna cotta', price: 5.5 },
  { name: 'Tarte aux pommes', price: 5.5 },
  { name: 'Salade de fruits frais', price: 5.0 }
];

// Évite les doublons : un produit "classique" est déjà présent si son nom recoupe un plat existant.
export function missingClassicItems(existingMenu, classicList) {
  const existingNames = existingMenu.map((i) => i.name.toLowerCase());
  return classicList.filter((c) => {
    const n = c.name.toLowerCase();
    return !existingNames.some((en) => en.includes(n) || n.includes(en));
  });
}

const KEYWORD_IMAGES = [
  // --- Burgers (spécifique avant générique) ---
  { keywords: ['double cheeseburger', 'double smash', 'double burger', 'double chicken burger'], image: 'https://images.unsplash.com/photo-1550317138-10000687a72b?w=300&q=80' },
  { keywords: ['bacon cheeseburger', 'bacon burger'], image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=300&q=80' },
  { keywords: ['bbq bacon', 'bbq burger', 'bbq chicken burger'], image: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=300&q=80' },
  { keywords: ['crispy chicken burger', 'spicy chicken burger', 'chicken burger', 'poulycroc', 'original chicken burger'], image: 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=300&q=80' },
  { keywords: ['veggie burger', 'vegetarian burger'], image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=300&q=80' },
  { keywords: ['smash burger'], image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80' },
  { keywords: ['blue cheese burger', 'truffle burger', 'oklahoma onion burger', 'avocado chicken burger', 'bicky'], image: 'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=300&q=80' },
  { keywords: ['cheeseburger', 'burger', 'hamburger'], image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&q=80' },

  // --- Fries & sides ---
  { keywords: ['sweet potato fries'], image: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c23?w=300&q=80' },
  { keywords: ['loaded cheese fries', 'cheese fries', 'bacon & cheese fries', 'frites cheddar', 'cajun fries'], image: 'https://images.unsplash.com/photo-1666304752980-678d5c35c911?w=300&q=80' },
  { keywords: ['onion rings'], image: 'https://images.unsplash.com/photo-1652209911920-2700fcbd5011?w=300&q=80' },
  { keywords: ['nuggets'], image: 'https://images.unsplash.com/photo-1619881590738-a111d176d906?w=300&q=80' },
  { keywords: ['wings', 'ailes'], image: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=300&q=80' },
  { keywords: ['coleslaw'], image: 'https://images.unsplash.com/photo-1573403707491-38a4ea19edc1?w=300&q=80' },
  { keywords: ['frite', 'french fries', 'fries'], images: ['https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&q=80', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=300&q=80', 'https://images.unsplash.com/photo-1666304752980-678d5c35c911?w=300&q=80'] },

  // --- Pizzas (par variante) ---
  { keywords: ['margherita', 'marinara', 'napoli', 'napoletana'], image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&q=80' },
  { keywords: ['pepperoni', 'diavola', 'spicy pizza'], image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=300&q=80' },
  { keywords: ['quattro formaggi', 'quattro stagioni', 'capricciosa', 'parma', 'mortadella'], image: 'https://images.unsplash.com/photo-1571066811602-716837d681de?w=300&q=80' },
  { keywords: ['burrata pizza', 'pizza burrata', 'tartufata', 'truffle pizza'], image: 'https://images.unsplash.com/photo-1548369937-47519962c11a?w=300&q=80' },
  { keywords: ['calzone', 'pizza vegetariana', 'vegetariana', 'pizza hawaïenne', 'pizza tonno', 'pizza regina', 'prosciutto'], image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=300&q=80' },
  { keywords: ['pizza'], image: 'https://images.unsplash.com/photo-1600028068383-ea11a7a101f3?w=300&q=80' },

  // --- Pâtes (par variante) ---
  { keywords: ['carbonara'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
  { keywords: ['bolognese', 'bolognaise', 'ragù', 'ragu'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['arrabbiata', 'amatriciana', 'vodka'], image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=300&q=80' },
  { keywords: ['pesto'], image: 'https://images.unsplash.com/photo-1567608285969-48e4bbe0d399?w=300&q=80' },
  { keywords: ['gnocchi'], image: 'https://images.unsplash.com/photo-1616170687881-32188ae1b6d7?w=300&q=80' },
  { keywords: ['ravioli'], image: 'https://images.unsplash.com/photo-1628885363743-fbf9c98d4196?w=300&q=80' },
  { keywords: ['lasagne', 'lasagna'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['pâtes', 'pate', 'pasta', 'tagliatelle', 'linguine', 'rigatoni', 'fettuccine', 'penne', 'spaghetti'], images: ['https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80', 'https://images.unsplash.com/photo-1628885363743-fbf9c98d4196?w=300&q=80', 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=300&q=80'] },
  { keywords: ['risotto'], image: 'https://images.unsplash.com/photo-1682428617976-f25633ed8469?w=300&q=80' },

  // --- Entrées italiennes ---
  { keywords: ['focaccia'], image: 'https://images.unsplash.com/photo-1619452357216-e88ca8119eeb?w=300&q=80' },
  { keywords: ['garlic bread'], image: 'https://images.unsplash.com/photo-1573140401552-3fab0b24306f?w=300&q=80' },
  { keywords: ['bruschetta'], image: 'https://images.unsplash.com/photo-1506280754576-f6fa8a873550?w=300&q=80' },
  { keywords: ['carpaccio', 'tataki'], image: 'https://images.unsplash.com/photo-1727243866425-3bf2cbf7480a?w=300&q=80' },
  { keywords: ['corn on the cob', 'corn on cob', 'épi de maïs'], image: 'https://images.unsplash.com/photo-1653886764193-db9e5a93d215?w=300&q=80' },
  { keywords: ['burrata', 'caprese', 'antipasti'], image: 'https://images.unsplash.com/photo-1623855244697-5d8fbe9c7892?w=300&q=80' },
  { keywords: ['arancini'], image: 'https://images.unsplash.com/photo-1632778140142-d62dee6e124c?w=300&q=80' },
  { keywords: ['vitello tonnato', 'osso buco', 'saltimbocca'], image: 'https://images.unsplash.com/photo-1773417325310-cc9c9bef75e7?w=300&q=80' },
  { keywords: ['affogato'], image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&q=80' },
  { keywords: ['gelato'], image: 'https://images.unsplash.com/photo-1572837663132-76c0ccd9cb6f?w=300&q=80' },

  // --- Sushi / Japonais ---
  { keywords: ['nigiri', 'sashimi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['california roll'], image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=300&q=80' },
  { keywords: ['philadelphia roll', 'unagi roll', 'vegetable roll'], image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=300&q=80' },
  { keywords: ['rainbow roll', 'ebi roll', 'futomaki'], image: 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=300&q=80' },
  { keywords: ['spicy salmon roll', 'spicy tuna roll', 'salmon avocado roll', 'crispy chicken roll', 'shrimp tempura roll', 'dragon roll'], image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&q=80' },
  { keywords: ['maki'], image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&q=80' },
  { keywords: ['salmon box', 'california box', 'sushi mix', 'salmon lovers', 'sushi deluxe', 'veggie box', 'chirashi', 'sushi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['gyoza'], image: 'https://images.unsplash.com/photo-1738681336104-608b4e7dc3b0?w=300&q=80' },
  { keywords: ['wakame'], image: 'https://images.unsplash.com/photo-1690789627117-eb8d3b6a46f4?w=300&q=80' },
  { keywords: ['miso'], image: 'https://images.unsplash.com/photo-1680137248903-7af5d51a3350?w=300&q=80' },
  { keywords: ['dorayaki'], image: 'https://images.unsplash.com/photo-1626497132810-f38eb29c5385?w=300&q=80' },
  { keywords: ['saké', 'sake chaud'], image: 'https://images.unsplash.com/photo-1664477407933-dd42ed0c6c62?w=300&q=80' },
  { keywords: ['ramune'], image: 'https://images.unsplash.com/photo-1663870316229-cb3986d34e8c?w=300&q=80' },

  // --- Asiatique / Wok ---
  { keywords: ['spring rolls', 'rouleaux de printemps', 'nems', 'nem'], image: 'https://images.unsplash.com/photo-1679310290259-78d9eaa32700?w=300&q=80' },
  { keywords: ['shrimp tempura', 'tempura crevette', 'tempura'], image: 'https://images.unsplash.com/photo-1579887829114-282b4fa31072?w=300&q=80' },
  { keywords: ['edamame'], image: 'https://images.unsplash.com/photo-1649257171206-37625b1f3b2f?w=300&q=80' },
  { keywords: ['satay'], image: 'https://images.unsplash.com/photo-1772855386828-a18ff9a12584?w=300&q=80' },
  { keywords: ['pad thai', 'pad thaï'], image: 'https://images.unsplash.com/photo-1746973645769-c11eb0a81025?w=300&q=80' },
  { keywords: ['fried rice', 'riz cantonais', 'riz sauté'], image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&q=80' },
  { keywords: ['teriyaki'], image: 'https://images.unsplash.com/photo-1609183480237-ccbb2d7c5772?w=300&q=80' },
  { keywords: ['sweet & sour', 'general tao', 'bœuf aux oignons', 'boeuf aux oignons'], image: 'https://images.unsplash.com/photo-1664138788119-bd4f073259d5?w=300&q=80' },
  { keywords: ['thai green curry', 'thai red curry', 'curry vert', 'curry rouge'], image: 'https://images.unsplash.com/photo-1716959669858-11d415bdead6?w=300&q=80' },
  { keywords: ['singapore noodles', 'noodles', 'bo bun', 'nouilles'], images: ['https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80', 'https://images.unsplash.com/photo-1609183480237-ccbb2d7c5772?w=300&q=80', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&q=80'] },
  { keywords: ['mango sticky rice'], image: 'https://images.unsplash.com/photo-1711161988375-da7eff032e45?w=300&q=80' },
  { keywords: ['coconut tapioca'], image: 'https://images.unsplash.com/photo-1601654847092-712aff26313c?w=300&q=80' },
  { keywords: ['lychee'], image: 'https://images.unsplash.com/photo-1597975371270-cf80e4f54921?w=300&q=80' },
  { keywords: ['tom yum'], image: 'https://images.unsplash.com/photo-1628430043175-0e8820df47c3?w=300&q=80' },
  { keywords: ['bao'], image: 'https://images.unsplash.com/photo-1675096000167-4b8a276b6187?w=300&q=80' },
  { keywords: ['papaye verte', 'mangue verte'], image: 'https://images.unsplash.com/photo-1648421331147-9fcfab29536e?w=300&q=80' },
  { keywords: ['canard laqué', 'canard laque'], image: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=300&q=80' },
  { keywords: ['mi krob'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['bubble tea'], image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=300&q=80' },
  { keywords: ['nouilles froides'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['eau de coco'], image: 'https://images.unsplash.com/photo-1603779046675-2eccbab9b982?w=300&q=80' },

  // --- Mexicain ---
  { keywords: ['burrito bowl', 'vegan bowl', 'shrimp bowl'], image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=300&q=80' },
  { keywords: ['burrito'], image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=300&q=80' },
  { keywords: ['tacos'], image: 'https://images.unsplash.com/photo-1665541719551-655b587161e4?w=300&q=80' },
  { keywords: ['loaded nachos', 'nachos'], image: 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=300&q=80' },
  { keywords: ['guacamole'], image: 'https://images.unsplash.com/photo-1600728256404-aaa448921ad9?w=300&q=80' },
  { keywords: ['mexican rice', 'black beans'], image: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=300&q=80' },
  { keywords: ['quesadilla'], image: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=300&q=80' },
  { keywords: ['churros'], image: 'https://images.unsplash.com/photo-1624371414361-e670edf4898d?w=300&q=80' },
  { keywords: ['tres leches'], image: 'https://images.unsplash.com/photo-1557925923-33b27f891f88?w=300&q=80' },
  { keywords: ['jarritos'], image: 'https://images.unsplash.com/photo-1632852521784-d85d5b62dd62?w=300&q=80' },

  // --- Libanais / Méditerranéen ---
  { keywords: ['hummus beiruti', 'hummus', 'houmous'], image: 'https://images.unsplash.com/photo-1673960854897-749f9d9ebafc?w=300&q=80' },
  { keywords: ['moutabal', 'baba ganoush'], image: 'https://images.unsplash.com/photo-1627308595127-d9acf19107ce?w=300&q=80' },
  { keywords: ['labneh'], image: 'https://images.unsplash.com/photo-1641494587136-eec74f1944ae?w=300&q=80' },
  { keywords: ['tabbouleh', 'tabboulé', 'taboulé', 'fattoush'], image: 'https://images.unsplash.com/photo-1594040815645-5442fb6d48f6?w=300&q=80' },
  { keywords: ['falafel'], image: 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=300&q=80' },
  { keywords: ['kebbeh'], image: 'https://images.unsplash.com/photo-1663004940335-8e7d8f1a093c?w=300&q=80' },
  { keywords: ['halloumi'], image: 'https://images.unsplash.com/photo-1598511796432-32663d0875bd?w=300&q=80' },
  { keywords: ['shawarma'], image: 'https://images.unsplash.com/photo-1719282431565-3b30bb7d2658?w=300&q=80' },
  { keywords: ['mixed grill', 'mezze', 'meze'], image: 'https://images.unsplash.com/photo-1743674453093-592bed88018e?w=300&q=80' },
  { keywords: ['kafta'], image: 'https://images.unsplash.com/photo-1719282431565-3b30bb7d2658?w=300&q=80' },
  { keywords: ['mouhalabieh'], image: 'https://images.unsplash.com/photo-1600676626897-eb2fb18a21e0?w=300&q=80' },
  { keywords: ['kunafa', 'künefe', 'kunefe'], image: 'https://images.unsplash.com/photo-1619860862294-1e96abc03d5b?w=300&q=80' },
  { keywords: ['dates & nuts', 'dates'], image: 'https://images.unsplash.com/photo-1648288718348-4b6d53755716?w=300&q=80' },
  { keywords: ['ayran'], image: 'https://images.unsplash.com/photo-1558113583-d75f23fcb8a9?w=300&q=80' },

  // --- Turc / Kebab (spécifique) ---
  { keywords: ['iskender'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['lahmacun'], image: 'https://images.unsplash.com/photo-1741166985167-14b7178f15b7?w=300&q=80' },
  { keywords: ['pide'], image: 'https://images.unsplash.com/photo-1628281161295-269ade51d28d?w=300&q=80' },
  { keywords: ['böreks', 'boreks', 'sigara böregi', 'sigara boregi', 'cigares au fromage'], image: 'https://images.unsplash.com/photo-1767124559112-088d7d1cc000?w=300&q=80' },
  { keywords: ['adana', 'beyti', 'kofte', 'köfte'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['shish taouk', 'shish', 'brochette'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['loukoum'], image: 'https://images.unsplash.com/photo-1555148484-324aae683a86?w=300&q=80' },
  { keywords: ['sütlaç', 'sutlac', 'riz au lait'], image: 'https://images.unsplash.com/photo-1590055619273-44b5b6ce52e8?w=300&q=80' },
  { keywords: ['salgam', 'şalgam'], image: 'https://images.unsplash.com/photo-1542518392-13317b1ee2a2?w=300&q=80' },
  { keywords: ['thé turc'], image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=300&q=80' },

  // --- Cuisine africaine / ivoirienne ---
  { keywords: ['mafé', 'mafe'], image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=300&q=80' },
  { keywords: ['alloco', 'manioc'], image: 'https://images.unsplash.com/photo-1762884601729-0eeeafbdfb8a?w=300&q=80' },
  { keywords: ['thieboudienne', 'thiéboudienne'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&q=80' },
  { keywords: ['yassa'], image: 'https://images.unsplash.com/photo-1603496987351-f84a3ba5ec85?w=300&q=80' },
  { keywords: ['attiéké', 'attieke'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['kedjenou'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['riz gras', 'sauce graine'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['accras', 'pastels', 'beignets de crevettes'], image: 'https://images.unsplash.com/photo-1696265498747-efc4c0dd7b98?w=300&q=80' },
  { keywords: ['bissap'], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&q=80' },
  { keywords: ['gâteau à l\'ananas', 'gateau ananas'], image: 'https://images.unsplash.com/photo-1643910509872-78bc24a2bc53?w=300&q=80' },

  // --- Healthy / Poke / Bowls ---
  { keywords: ['salmon poke', 'spicy salmon poke'], image: 'https://images.unsplash.com/photo-1604259596863-57153177d40b?w=300&q=80' },
  { keywords: ['tuna poke', 'spicy tuna poke'], image: 'https://images.unsplash.com/photo-1597958792579-bd3517df6399?w=300&q=80' },
  { keywords: ['teriyaki chicken poke', 'crispy chicken poke'], image: 'https://images.unsplash.com/photo-1602881916963-5daf2d97c06e?w=300&q=80' },
  { keywords: ['shrimp poke'], image: 'https://images.unsplash.com/photo-1780805663576-48cdd496138d?w=300&q=80' },
  { keywords: ['tofu poke', 'vegan poke', 'build your own poke', 'poke'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['caesar', 'césar'], image: 'https://images.unsplash.com/photo-1512852939750-1305098529bf?w=300&q=80' },
  { keywords: ['mediterranean bowl', 'avocado quinoa bowl', 'protein chicken bowl', 'falafel bowl'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80' },
  { keywords: ['açai', 'acai'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },
  { keywords: ['chia'], image: 'https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=300&q=80' },
  { keywords: ['yaourt', 'yoghurt', 'yogurt', 'compote'], image: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=300&q=80' },
  { keywords: ['energy balls', 'barres céréales', 'barres cereales'], image: 'https://images.unsplash.com/photo-1678554500191-3885a6fbf8c2?w=300&q=80' },
  { keywords: ['galettes de quinoa', 'quinoa'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['perles de coco'], image: 'https://images.unsplash.com/photo-1596723455658-72ebb0d12edd?w=300&q=80' },
  { keywords: ['banana bread'], image: 'https://images.unsplash.com/photo-1569762404472-026308ba6b64?w=300&q=80' },
  { keywords: ['ginger shot'], image: 'https://images.unsplash.com/photo-1678890565859-a2dadf52a48f?w=300&q=80' },
  { keywords: ['green smoothie', 'mango smoothie', 'smoothie'], image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300&q=80' },
  { keywords: ['kombucha'], image: 'https://images.unsplash.com/photo-1783099993801-c31173919b72?w=300&q=80' },
  { keywords: ['coconut water'], image: 'https://images.unsplash.com/photo-1588413336019-dd5d3beddf55?w=300&q=80' },
  { keywords: ['toast avocat', 'avocado'], image: 'https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=300&q=80' },

  // --- Fried Chicken / Wings ---
  { keywords: ['crispy tenders', 'tenders'], image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&q=80' },
  { keywords: ['hot wings'], image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&q=80' },
  { keywords: ['chicken bucket'], image: 'https://images.unsplash.com/photo-1652957392622-17e7c96f1369?w=300&q=80' },
  { keywords: ['mac & cheese', 'mac and cheese'], image: 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=300&q=80' },
  { keywords: ['mozzarella sticks', 'jalapeño poppers', 'jalapeno poppers'], image: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300&q=80' },
  { keywords: ['donut'], image: 'https://images.unsplash.com/photo-1570727624862-3008fe67a6be?w=300&q=80' },
  { keywords: ['chili sin carne', 'chili con carne'], image: 'https://images.unsplash.com/photo-1666819632298-fe15dc7d4c34?w=300&q=80' },
  { keywords: ['popcorn'], image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=300&q=80' },
  { keywords: ['bonbons', 'chewing-gum', 'chewing gum'], image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&q=80' },
  { keywords: ['cocktail prêt', 'cocktail pret'], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&q=80' },
  { keywords: ['biltong'], image: 'https://images.unsplash.com/photo-1652209695374-7a91c243f12f?w=300&q=80' },

  // --- Belge / Friterie ---
  { keywords: ['fricadelle', 'mexicano', 'viandelle', 'boulette'], image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=300&q=80' },
  { keywords: ['croquette de fromage', 'croquette de crevettes', 'croquette'], image: 'https://images.unsplash.com/photo-1713517915303-ae3b3429f939?w=300&q=80' },
  { keywords: ['gaufre'], image: 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?w=300&q=80' },
  { keywords: ['mousse au chocolat'], image: 'https://images.unsplash.com/photo-1563801802091-1576649a2602?w=300&q=80' },
  { keywords: ['tarte au sucre'], image: 'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?w=300&q=80' },
  { keywords: ['sauce andalouse', 'andalouse', 'samouraï', 'samourai', 'ketchup', 'mayonnaise', 'tartare', 'brazil', 'barbecue', 'aigre-douce', 'cajun'], image: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300&q=80' },
  { keywords: ['moules'], image: 'https://images.unsplash.com/photo-1600265721436-734abbfe2137?w=300&q=80' },

  // --- Génériques (fallback) ---
  { keywords: ['kebab', 'durum', 'chawarma', 'grillades', 'grill'], images: ['https://images.unsplash.com/photo-1532636875304-0c89119d9b4d?w=300&q=80', 'https://images.unsplash.com/photo-1719282431565-3b30bb7d2658?w=300&q=80', 'https://images.unsplash.com/photo-1743674453093-592bed88018e?w=300&q=80'] },
  // "wrap" séparé de "sandwich/panini/croque" : forme et photo totalement différentes (galette roulée
  // vs pain tranché) — une des 3 photos de l'ancien pool commun (1553979459) s'est avérée être un
  // burger empilé, pas un sandwich, et faussait "Wrap poulet avocat"/"Wrap végétarien".
  { keywords: ['wrap'], image: 'https://images.unsplash.com/photo-1752095809096-f09d22c466c5?w=300&q=80' },
  { keywords: ['sandwich', 'panini', 'croque'], images: ['https://images.unsplash.com/photo-1612392061787-2d078b3e573c?w=300&q=80', 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?w=300&q=80'] },
  { keywords: ['hot-dog', 'hot dog'], image: 'https://images.unsplash.com/photo-1612392061787-2d078b3e573c?w=300&q=80' },
  { keywords: ['glace', 'mochi', 'sorbet', 'sundae', 'cornet'], images: ['https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80', 'https://images.unsplash.com/photo-1572837663132-76c0ccd9cb6f?w=300&q=80'] },
  { keywords: ['cheesecake'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['fondant au chocolat', 'chocolate fondant', 'fondant chocolat'], image: 'https://images.unsplash.com/photo-1673551490812-eaee2e9bf0ef?w=300&q=80' },
  { keywords: ['crème brûlée', 'creme brulee'], image: 'https://images.unsplash.com/photo-1676300184943-09b2a08319a3?w=300&q=80' },
  { keywords: ['cookie aux pépites', 'chocolate chip cookie'], image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300&q=80' },
  { keywords: ['tarte aux pommes', 'apple pie', 'apple tart'], image: 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=300&q=80' },
  { keywords: ['brownie'], image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&q=80' },
  { keywords: ['tiramisu', 'tiramisù'], image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&q=80' },
  { keywords: ['panna cotta', 'cannoli'], image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&q=80' },
  { keywords: ['chocolat chaud', 'hot chocolate'], image: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=300&q=80' },
  { keywords: ['chocolat', 'cioccolato', 'cookie', 'biscuit', 'gâteau', 'gateau', 'cake', 'tarte', 'baklava', 'fondant'], images: ['https://images.unsplash.com/photo-1517427294546-5aa121f68e8a?w=300&q=80', 'https://images.unsplash.com/photo-1643910509872-78bc24a2bc53?w=300&q=80', 'https://images.unsplash.com/photo-1676300184943-09b2a08319a3?w=300&q=80'] },
  { keywords: ['milkshake'], image: 'https://images.unsplash.com/photo-1619158403521-ed9795026d47?w=300&q=80' },
  { keywords: ['fanta'], image: 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=300&q=80' },
  { keywords: ['sprite'], image: 'https://images.unsplash.com/photo-1621330716555-5cad596c4562?w=300&q=80' },
  { keywords: ['fuze tea', 'peach iced tea', 'thé glacé pêche', 'ice tea pêche'], image: 'https://images.unsplash.com/photo-1601390395693-364c0e22031a?w=300&q=80' },
  { keywords: ['ice tea', 'iced tea', 'thé glacé', 'the glace'], image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=300&q=80' },
  { keywords: ['limonade', 'lemonade', 'limeade', 'citronnade', 'limonata', 'lemon mint'], image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=300&q=80' },
  { keywords: ['energy drink'], image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&q=80' },
  { keywords: ['root beer'], image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=300&q=80' },
  { keywords: ['coca-cola zero', 'coca zero', 'coke zero'], image: 'https://images.unsplash.com/photo-1543253687-c931c8e01820?w=300&q=80' },
  { keywords: ['coca', 'soda cola'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },
  { keywords: ['softs'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },
  { keywords: ['eau pétillante', 'eau petillante', 'eau gazeuse', 'sparkling water', "san pellegrino", 'acqua panna', 'spa reine'], image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&q=80' },
  { keywords: ['eau plate', 'still water', 'eau citronnée'], image: 'https://images.unsplash.com/photo-1534616042650-80f5c9b61f09?w=300&q=80' },
  { keywords: ['latte matcha', 'matcha latte'], image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&q=80' },
  { keywords: ['lait d\'amande', 'lait demi', 'lait entier', 'lait ', 'milk', 'fristi'], image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&q=80' },
  { keywords: ['café', 'cafe', 'expresso', 'espresso'], image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80' },
  { keywords: ['bière', 'biere'], image: 'https://images.unsplash.com/photo-1618183479302-1e0aa382c36b?w=300&q=80' },
  { keywords: ['vin', 'prosecco', 'chianti', 'limoncello'], image: 'https://images.unsplash.com/photo-1587920710219-f6f9804dc10d?w=300&q=80' },
  { keywords: ["jus d'orange", 'orange juice', 'jus pressé orange', 'tropicana'], image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300&q=80' },
  { keywords: ['jus de pomme', 'apple juice', 'jus pressé pomme'], image: 'https://images.unsplash.com/photo-1727989815707-1b9e8f376775?w=300&q=80' },
  { keywords: ['jus', 'aranciata', 'lemonata', 'mango drink', 'pack sodas', 'pack de sodas'], image: 'https://images.unsplash.com/photo-1622597467821-df79dcb4f94d?w=300&q=80' },
  { keywords: ['thé', 'the', 'tea'], image: 'https://images.unsplash.com/photo-1573784540576-21ddeff9479b?w=300&q=80' },
  { keywords: ['pain', 'croissant', 'viennoiserie', 'éclair', 'eclair', 'cramique', 'financier', 'cannelé', 'canele', 'muffin', 'baguette', 'chausson'], image: 'https://images.unsplash.com/photo-1623334044303-241021148842?w=300&q=80' },
  { keywords: ['poulet', 'chicken'], image: 'https://images.unsplash.com/photo-1763219802762-1d34ee0907c5?w=300&q=80' },
  { keywords: ['beignet'], image: 'https://images.unsplash.com/photo-1570727624862-3008fe67a6be?w=300&q=80' },
  { keywords: ['riz', 'curry', 'cantonais'], images: ['https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80', 'https://images.unsplash.com/photo-1716959669858-11d415bdead6?w=300&q=80', 'https://images.unsplash.com/photo-1682428617976-f25633ed8469?w=300&q=80'] },
  { keywords: ['saumon', 'salmon', 'poisson', 'thon', 'tuna', 'shrimp', 'crevette'], image: 'https://images.unsplash.com/photo-1641898378716-1f38ec04bb0f?w=300&q=80' },
  { keywords: ['chips', 'cacahuète', 'cacahuete', 'bretzel', 'apéro', 'apero', 'olives', 'saucisson', 'fruits secs'], image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=300&q=80' },
  { keywords: ['légume', 'legume', 'quiche'], image: 'https://images.unsplash.com/photo-1650844010413-3f24dc1c182b?w=300&q=80' },
  { keywords: ['œufs', 'oeufs', 'eggs'], image: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=300&q=80' },
  { keywords: ['salade de fruits', 'fruit salad', 'pommes'], image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=300&q=80' },
  { keywords: ['salade', 'bowl', 'buddha'], images: ['https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=300&q=80', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80', 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=300&q=80'] },
  { keywords: ['soupe', 'soup', 'velouté', 'veloute'], image: 'https://images.unsplash.com/photo-1578861256505-d3be7cb037d3?w=300&q=80' }
];

const U = (id) => `https://images.unsplash.com/photo-${id}?w=300&q=80`;

// Images assignées par nom exact de plat : garantit qu'au sein d'un même menu, deux plats différents
// n'affichent jamais la même photo. Deux restos avec le même plat (même nom) partagent volontairement
// la même image — c'est le comportement voulu, pas un doublon. Sert de première passe avant le
// matching par mot-clé (KEYWORD_IMAGES) ci-dessus, qui reste le filet de sécurité pour les plats
// que le restaurateur tape lui-même et qui ne figurent pas dans les menus de démarrage.
const ITEM_IMAGE_OVERRIDES = {
  // --- Pizza (désambiguïsation des variantes qui partageaient toutes la même photo) ---
  'quattro stagioni': U('1671106681075-5a7233268cbd'),
  'capricciosa': U('1585238342024-78d387f4a707'),
  'parma': U('1662805525084-79fd48e09e0b'),
  'mortadella & pistacchio': U('1558138838-6d6290c056c4'),
  'prosciutto e funghi': U('1617470702892-e01504297e84'),
  'vegetariana': U('1613564834361-9436948817d1'),
  'calzone': U('1753656681797-3234c89d6d4d'),
  'marinara': U('1594007654729-407eedc4be65'),
  'napoli': U('1707551624156-bb6369857026'),
  'bruschetta al pomodoro': U('1594978583693-8dfdfc93f052'),
  'antipasti italiani': U('1536739782508-c2388552aad3'),
  'acqua panna': U('1523362628745-0c100150b504'),
  'aranciata san pellegrino': U('1689066117649-0ca9762fc92c'),
  'cannoli siciliani': U('1749767138348-2e5bf1cbcef2'),
  'cannoli': U('1749767138348-2e5bf1cbcef2'),

  // --- Italien (entrées qui partageaient toutes la même photo "burrata") ---
  'caprese': U('1630230596637-28f416b537ff'),
  'antipasti': U('1598309141235-06d295271f81'),
  'bruschetta': U('1572695157366-5e585ab2b69f'),

  // --- Sushi (nigiri/box/mix qui partageaient toutes la même photo) ---
  'tuna nigiri ×2': U('1772285268647-11deb0bdbe29'),
  'salmon box': U('1693082146027-2062d794f305'),
  'california box': U('1653122024993-31e02aedb1ac'),
  'sushi mix': U('1636425730695-febe95eda12e'),
  'mochi coconut': U('1763469024755-a19c6a13ef11'),

  // --- Sandwichs (Boulangerie / Night Shop — jusqu'à 9 plats partageaient la même photo) ---
  'sandwich jambon-fromage': U('1647505794572-0a6d945d664d'),
  // Même plat que ci-dessus mais orthographié sans tiret dans le menu type Boulangerie (voir
  // menuCategories.js) — l'ancien override ne matchait jamais cette variante exacte, la faisant
  // retomber sur le pool générique sandwich/panini/croque partagé avec 2 autres plats du même menu.
  'sandwich jambon fromage': U('1647505794572-0a6d945d664d'),
  'panini jambon-fromage': U('1647505794572-0a6d945d664d'),
  'sandwich poulet-crudités': U('1650134973671-fc0bf931be92'),
  'sandwich poulet': U('1650134973671-fc0bf931be92'),
  'sandwich thon-crudités': U('1558985250-27a406d64cb3'),
  'sandwich végétarien': U('1528736235302-52922df5c122'),
  'sandwich saumon-fromage frais': U('1606503136331-ece171077d82'),
  'wrap poulet curry': U('1626700051175-6818013e1d4f'),
  'croque-monsieur': U('1531664412848-9610afed156c'),
  'panini poulet': U('1559054663-e8d23213f55c'),
  'formule sandwich + boisson': U('1553909489-cd47e0907980'),
  'pack soirée (sandwich, chips & boisson)': U('1553909489-cd47e0907980'),
  'sandwich thon': U('1528735602780-2552fd46c7af'),
  'sandwich thon mayonnaise': U('1528735602780-2552fd46c7af'),
  'sandwich poulet curry': U('1475090169767-40ed8d18f67d'),
  'sandwich américain préparé': U('1716535233357-822bcc293573'),
  'club poulet crudités': U('1567234669003-dce7a7a88821'),

  // --- Apéro / chips (Supermarché / Night Shop — jusqu'à 8 produits partageaient la même photo) ---
  'chips nature 150g': U('1647764430080-6000fbe7efee'),
  'chips 150g': U('1736883624742-61826190b91a'),
  'cacahuètes salées': U('1596503799872-5c5f052c27b9'),
  'chips paprika 150g': U('1641693148759-843d17ceac24'),
  'olives marinées 200g': U('1786175705114-8757e45fae8b'),
  'olives marinées': U('1786175705114-8757e45fae8b'),
  'crackers apéro 100g': U('1701341404788-b85484ca379e'),
  'mix apéro noix 150g': U('1616252576862-bd9abd7467f9'),
  'mix apéro': U('1701341964637-94945a277fe0'),
  'saucisson sec': U('1764436988814-4eff7322ee9c'),
  'fruits secs mélangés 200g': U('1600189020840-e9918c25269d'),

  // --- Boulangerie (viennoiseries et tartes qui partageaient toutes la même photo) ---
  'pain aux raisins': U('1587297057428-b802128d1229'),
  'chausson aux pommes': U('1576502647622-50e6a6f1c931'),
  'muffin myrtille': U('1607958996333-41aef7caefaa'),
  'financier amande': U('1638518909918-27910011e4d6'),
  'cannelé': U('1593353994452-97b4560c50c2'),
  'baguette tradition': U('1586765501019-cbe3973ef8fa'),
  'tarte flamiche': U('1633205772834-c0b9943c5a54'),
  'formule quiche + salade': U('1767065584079-87834f242fe9'),
  'pain au chocolat': U('1613929231151-d7571591259e'),
  'éclair au chocolat': U('1774119649906-c82806125e23'),
  'cookie pépites': U('1499636136210-6f4ee915583e'),
  'tarte citron meringuée': U('1519915028121-7d3463d20b13'),

  // --- Sushi (rolls et maki qui partageaient tous la même photo) ---
  'cucumber maki ×6': U('1728691190534-e1e8c564014e'),
  'salmon maki ×6': U('1617196034738-26c5f7c977ce'),
  'tuna maki ×6': U('1712725214706-e564b8dd1bbe'),
  'spicy tuna roll ×8': U('1633478062482-790e3b5dd810'),
  'salmon avocado roll ×8': U('1646196603168-ed92068477c3'),
  'crispy chicken roll ×8': U('1625668742946-4ade4980c01e'),
  'shrimp tempura roll ×8': U('1580822184713-fc5400e7fe10'),

  // --- Asiatique (nouilles/teriyaki/gyoza qui partageaient toutes la même photo) ---
  'chicken teriyaki noodles': U('1619371042685-827b1c646923'),
  'beef teriyaki noodles': U('1619371000980-ec90e765eb32'),
  'chicken teriyaki': U('1695606452836-c3c6e62d407b'),
  'beef teriyaki': U('1732988978816-ce0c78c79f4c'),
  'shrimp pad thai': U('1559314809-0d155014e29e'),
  'vegetable pad thai': U('1645762854117-35d7f2d78b2d'),
  'spicy chicken noodles': U('1707546944460-dda9069b9c1e'),
  'singapore noodles': U('1713934895383-f4be7dd735a1'),
  'chicken gyoza': U('1638502338747-f7f368214cce'),
  'vegetable gyoza': U('1551638059-d1fb82606c4a'),
  'chicken spring rolls': U('1669340781012-ae89fbac9fc3'),
  'gyoza chicken': U('1638502338747-f7f368214cce'),
  'gyoza vegetable': U('1551638059-d1fb82606c4a'),

  // --- Mexicain (burritos et tacos qui partageaient tous la même photo) ---
  'beef burrito': U('1671572579845-52270341950f'),
  'pulled pork burrito': U('1731090389603-d63060ee08a6'),
  'spicy chicken burrito': U('1731090389457-7e62135a657f'),
  'veggie burrito': U('1731090389462-351421240be9'),
  'vegan burrito': U('1722239315206-95b344366a62'),
  'beef tacos ×3': U('1768716575089-7ba787da9afb'),
  'pulled pork tacos ×3': U('1746648858213-c7b5d2e34265'),
  'shrimp tacos ×3': U('1768716697811-75b2ce9c5b54'),
  'veggie tacos ×3': U('1768716575003-2f7450b1344a'),

  // --- Kebab & Grill (kebabs, durums et menus qui partageaient tous la même photo) ---
  'menu kebab poulet (frites & boisson)': U('1676471980189-08de3e001215'),
  'menu durum bœuf (frites & boisson)': U('1719282431723-9d0f4370d4bc'),
  'menu mixed grill (frites & boisson)': U('1702827487086-9ab8a573d825'),
  'menu adana (frites & boisson)': U('1580121676785-ea9ca33e3fb2'),
  'assiette mixte grillades': U('1750190624608-57ceddba8d69'),
  'cigares au fromage (5pcs)': U('1747045142479-8c29f86307cd'),
  'chawarma bœuf': U('1777199298385-07e46ccc2004'),
  'durum végétarien': U('1743187363021-2a89f881937f'),
  'durum poulet': U('1719282431565-3b30bb7d2658'),
  'adana kebab': U('1730082460730-573793ec7c8f'),
  'shish taouk': U('1629450748686-c86699b710ac'),
  'beyti kebab': U('1676300186554-671b04fed976'),
  'kofte grillé': U('1733860539640-cfb176102773'),

  // --- City Burger (menu générique 83 produits — variantes qui partageaient toutes la même photo) ---
  'hamburger': U('1568901346375-23c9450c58cd'),
  'cheeseburger': U('1551782450-a2132b4ba21d'),
  'royal cheddar burger': U('1713330801172-03f8d1c0dde7'),
  'menu royal cheddar burger': U('1713330801172-03f8d1c0dde7'),
  'filet de poisson pané burger': U('1551782450-17144efb9c50'),
  'menu filet de poisson pané burger': U('1551782450-17144efb9c50'),
  'filet de poisson deluxe burger': U('1615297928064-24977384d0da'),
  'menu filet de poisson deluxe burger': U('1615297928064-24977384d0da'),
  'poulet crispy burger': U('1637710847214-f91d99669e18'),
  'menu poulet crispy burger': U('1637710847214-f91d99669e18'),
  'burger végétarien deluxe': U('1655895176036-bf1a11326e5c'),
  'menu burger végétarien deluxe': U('1655895176036-bf1a11326e5c'),
  'crispy bacon deluxe': U('1606149059549-6042addafc5a'),
  'menu crispy bacon deluxe': U('1606149059549-6042addafc5a'),
  'double crispy bacon deluxe': U('1513185158878-8d8c2a2a3da3'),
  'menu double crispy bacon deluxe': U('1513185158878-8d8c2a2a3da3'),
  'le généreux bacon cheddar': U('1692737349870-e3bfc704ebf9'),
  'menu le généreux bacon cheddar': U('1692737349870-e3bfc704ebf9'),
  'le généreux double bacon cheddar': U('1520073201527-6b044ba2ca9f'),
  'menu le généreux double bacon cheddar': U('1520073201527-6b044ba2ca9f'),
  'double philly cheese': U('1734769853702-c7444c039c8c'),
  'menu double philly cheese': U('1734769853702-c7444c039c8c'),
  'peppery cheese': U('1566217688581-b2191944c2f9'),

  // --- Boucherie ---
  "jambon d'ardenne": U('1602491950780-1c5411ecfdf6'),
  'pâté de campagne': U('1462837019796-6f0204b48d95'),
  'terrine de canard': U('1694460263761-c93d3759f4b3'),
  'rillettes de porc': U('1694460265637-5beb1d12a92e'),
  'salade de museau': U('1663250540918-42681cb3aa91'),
  'fromage de tête': U('1552166539-ade937e98ed7'),
  'boudin blanc': U('1552913903-2cffa1962dc7'),
  'entrecôte de bœuf': U('1690983325551-b922137727be'),
  'filet pur de bœuf': U('1690983323238-0b91789e1b5a'),
  "côte à l'os": U('1603048297172-c92544798d5a'),
  'steak haché pur bœuf': U('1610622930110-3c076902312a'),
  'escalope de poulet fermier': U('1612654198172-241d8540e1dc'),
  'cuisse de poulet fermier': U('1722928566022-8a6f179eab9e'),
  'filet de porc': U('1602470521006-59ab77068b0d'),
  "côtelettes d'agneau": U('1690983329845-638ec321647d'),
  'saucisses de toulouse': U('1585325701165-351af916e581'),
  'merguez': U('1598401863352-3de5501f4890'),
  'boudin noir': U('1624772398061-bbfa87ec6b5a'),
  'chipolatas': U('1591989330748-777649e84466'),
  'vol-au-vent maison': U('1756137949222-e36c028dfedf'),
  'carbonade flamande': U('1445979323117-80453f573b71'),
  'lapin à la bière': U('1596797038530-2c107229654b'),
  'steak tartare préparé': U('1785517605613-e55a1470305d'),
  'vin blanc': U('1579721333016-b58535cc0dc3'),

  // --- Burgers / Fried Chicken (variantes qui partageaient toutes la même photo) ---
  'spicy chicken burger': U('1705131186176-1c7cdb830815'),
  'avocado chicken burger': U('1596649299486-4cdea56fd59d'),
  'truffle burger': U('1609167830220-7164aa360951'),
  'oklahoma onion burger': U('1611698529094-6a518c46a0de'),
  'chicken burger menu': U('1609167830240-fc81e9cfd9bf'),
  'double smash burger': U('1572802419224-296b0aeee0d9'),
  'bbq bacon burger': U('1610614819513-58e34989848b'),
  'bacon & cheese fries': U('1743193711514-4f7bc5d78d4d'),
  'oreo milkshake': U('1641665271888-575e46923776'),

  // --- Asiatique ---
  'thai green curry chicken': U('1761315412830-2f59480377b0'),
  'thai red curry beef': U('1761314037211-63fff18c5187'),
  'beef fried rice': U('1578160112054-954a67602b88'),
  'vegetable fried rice': U('1765872690457-2b1d2b8ca6d8'),
  'spicy edamame': U('1724705341631-8f62faaf9014'),

  // --- Sushi ---
  'salmon lovers': U('1607301406259-dfb186e15de8'),
  'sushi deluxe': U('1737501844370-e59fb449880d'),
  'veggie box': U('1564489563601-c53cfc451e93'),

  // --- Mexicain ---
  'beef burrito bowl': U('1602881916963-5daf2d97c06e'),
  'vegan bowl': U('1623428187969-5da2dcea5ebf'),
  'spicy shrimp bowl': U('1602881917760-7379db593981'),
  'nachos & guacamole': U('1680350681703-5879c3be90d3'),
  'loaded nachos': U('1513456852971-30c0b8199d4d'),
  'black beans': U('1647545401750-6dd5539879ac'),
  'quesadilla cheese': U('1719957770167-bb66133ba808'),
  'churros & chocolate': U('1779119512166-a3a01cd81a91'),

  // --- Libanais ---
  'beef shawarma': U('1665989215795-f67f4723087d'),
  'kafta wrap': U('1653983194833-7a10838b12f4'),
  'chicken shawarma plate': U('1670164745494-30747c120652'),
  'beef shawarma plate': U('1736928634472-abd43ed645a9'),
  'kafta plate': U('1603360946369-dc9bb6258143'),
  'falafel wrap': U('1664455289851-e13c0f803cc0'),
  'falafel plate': U('1701688596783-231b3764ef67'),
  'vegetarian mezze': U('1670165088604-5a39f5c1be51'),
  'mixed mezze': U('1718801594068-a7b7c5aeccb4'),
  'hummus beiruti': U('1637949385162-e416fb15b2ce'),
  'baba ganoush': U('1700481947515-7a162cbe4df7'),
  'fattoush': U('1581570378868-0a0a8656fb77'),
  'halloumi wrap': U('1748955308143-5055af50bba6'),
  'jallab': U('1630184799082-05623dbdc7f7'),
  'tamarind juice': U('1613518972312-267f92ae4aa2'),

  // --- Healthy ---
  'spicy salmon poke': U('1780805663865-c9ab052da2e4'),
  'tofu poke': U('1771154141872-e5ad3905a385'),
  'vegan poke': U('1670944316338-40c256cb144e'),
  'build your own poke': U('1661257711676-79a0fc533569'),
  'mediterranean bowl': U('1608480695771-c4bb16a829d1'),
  'avocado quinoa bowl': U('1556040221-a1efce785fcc'),
  'protein chicken bowl': U('1626204983652-f43427142ce1'),
  'avocado side': U('1602292705803-518f65289bc8'),
  'açai bowl': U('1654923064926-be7e64267a31'),
  'spicy tuna poke': U('1768326119231-bf064c1b8fdf'),

  // --- Italien ---
  'linguine gamberi': U('1498579150354-977475b7ea0b'),
  'truffle tagliatelle': U('1616299915952-04c803388e5f'),
  'tagliatelle al ragù': U('1597131628347-c769fc631754'),
  'lasagna bolognese': U('1709429790175-b02bb1b19207'),
  'penne amatriciana': U('1516100882582-96c3a05fe590'),
  'rigatoni alla vodka': U('1606853181531-a3a54d2ad57b'),
  'ravioli ricotta & spinach': U('1623073119837-076224785565'),
  'tiramisù pistachio': U('1785960160511-aa7ed5af05e1'),

  // --- Fried Chicken ---
  '5 crispy tenders': U('1605291581926-df4bf7ee3e89'),
  '8 crispy tenders': U('1619019187211-adf2f6119afd'),
  '5 tenders menu': U('1627662236973-4fd8358fa206'),
  '10 hot wings': U('1771252399544-43dc3d11a21b'),
  '15 hot wings': U('1517984055083-fd6e1e788e54'),
  '8 wings menu': U('1663430218462-8024770c830e'),

  // --- Belge ---
  'fricadelle spéciale': U('1675523300593-667579c8488a'),
  'mexicano': U('1785929163609-dfddfcb0e8c0'),
  'viandelle': U('1738599935343-991708a2895b'),
  'boulette': U('1760304396110-8dc2b644fd05'),
  'croquette de crevettes': U('1764337290548-5e116a0030d0'),
  'poulycroc': U('1671522635501-f03491b207e6'),
  'frites sauce andalouse & oignons': U('1763208385612-fbbf89e4a5ed'),
  'frites cheddar bacon': U('1762284513031-3d7ad15562bc'),
  'andalouse': U('1779939855509-58261716ec8c'),
  'samouraï': U('1779939855596-8506096e2ebe'),
  'brazil': U('1731415101106-3eb6031aad74'),
  'tartare': U('1777199264017-84af9308a41f'),
  'ketchup': U('1633253037293-91cdfb8cecff'),

  // --- Végétarien ---
  'curry de pois chiches': U('1582576163090-09d3b6f8a969'),
  'galettes de quinoa': U('1607095597425-6f61dee8ab7e'),
  'wrap houmous légumes': U('1752095809096-f09d22c466c5'),
  'nems tofu croustillant': U('1515022376298-7333f33e704b'),
  'salade de betteraves': U('1649597357231-4e721665af6e'),
  'menu burger végétarien (frites & boisson)': U('1763689389824-dd2cea2e5772'),
  'tarte crumble pommes vegan': U('1772547103123-823bfb230fb0'),

  // --- Boissons (variantes qui partageaient toutes la même photo) ---
  'jarritos mango': U('1623065422902-30a2d299bbe4'),
  'jarritos guava': U('1681250918992-14488ad03a6f'),
  'homemade limeade': U('1621263764928-df1444c5e859'),
  'green smoothie': U('1633096013004-e2cb4023b560'),
  'mango smoothie': U('1604298331663-de303fbc7059'),
  'ramune lychee': U('1785950179234-7aee375c02f7'),

  // --- Coffee Shop ---
  'americano': U('1514432324607-a09d9b4aefdd'),
  'cappuccino': U('1670404161009-29548c027d06'),
  'café latte': U('1506372023823-741c83b836fe'),
  'flat white': U('1497636577773-f1231844b336'),
  'caramel macchiato': U('1570517130750-10c67ffdde09'),
  'mocha': U('1619286310410-a95de97b0aec'),
  'cold brew': U('1562878424-0da674456d33'),
  'iced latte': U('1620360289100-030b032e5a27'),
  'iced matcha latte': U('1631679263367-9095fca628de'),
  'chai latte': U('1636920272028-c27f1ae474c3'),
  'croissant': U('1587912001191-0cd4f14fd89e'),
  'carrot cake': U('1676300186098-9b5ae9916e3c'),
  'cinnamon roll': U('1585190775852-3e6bb2b80184'),
  'banana bread': U('1621955629759-5a2d9f99c4e7'),
  'bagel saumon': U('1613152834645-875f24eb961c'),
  'club sandwich': U('1567234669003-dce7a7a88821'),
  'panini poulet pesto': U('1621852004158-f3bc188ace2d'),
  'granola bowl': U('1612182062572-e29c5dfb5eb4'),

  // --- Supermarché (produits qui partageaient tous la même photo) ---
  'pâtes penne 500g': U('1737718952107-be42ec98a028'),
  'compote pomme (4)': U('1745964276896-96f8e8eb0e4e'),
  'jus de fruits 1l': U('1647776145663-84951b6c6c9f'),

  // --- Night Shop ---
  'pistaches salées 150g': U('1707548686201-b6d960b55f54'),
  'noix de cajou 150g': U('1641718087616-859c6754efb9'),
  'chips barbecue 150g': U('1621447504864-d8686e12698c'),
  'bretzels salés 150g': U('1632116766245-ac9ff0e59ceb'),
  'popcorn salé': U('1512149177596-f817c7ef5d4c'),
  'fromage apéro': U('1606913084605-1064d2aa86b8'),
  'pizza surgelée margherita': U('1499778003268-cbafc6d08bab'),
  'pizza surgelée 4 fromages': U('1732223229355-95a1433404bf'),
  'lasagnes surgelées': U('1697569455521-ad50a87664ca'),
  'frites surgelées 1kg': U('1688978181542-87a886a16fbe'),
  'cordon bleu surgelé': U('1615322681853-52a81fb318ac'),
  'barre chocolatée': U('1678303054611-ba9fbbebf3fa'),
  'tablette de chocolat': U('1610450949065-1f2841536c88'),
  'muffin chocolat': U('1611614010348-7df489604fe3'),
  'cookies (3)': U('1557310717-d6bea9f36682'),
  'bonbons': U('1582058091505-f87a2e55a40f'),
  'chewing-gum': U('1565098772267-60af42b81ef2'),
  'popcorn sucré': U('1574201742421-fffd6af7a680'),
  'pot de glace 500ml': U('1534706936160-d5ee67737249'),
  'bière spéciale 33cl': U('1632173517757-1e87c79de596'),
  'bière sans alcool 33cl': U('1681422695061-9023e14a28c1'),
  'cidre 33cl': U('1482987001459-9c8a37b21dd3'),
  'vin rouge 25cl': U('1553361371-9b22f78e8b1d'),
  'vin blanc 25cl': U('1597905722448-a1df7c00000a'),
  'cava': U('1613477581402-306fa9dc6b95'),
  'whisky': U('1615887023544-3a566f29d822'),
  'vodka': U('1591704951890-0862b2e98acb'),
  'rhum': U('1652284917571-e6475a979ea5'),
  'chinotto': U('1554866585-cd94860890b7'),
  'boza': U('1619158403521-ed9795026d47'),
  'horchata': U('1619158403521-ed9795026d47'),
  'box à partager': U('1608039755401-742074f0548d'),

  // --- Corrections de doublons/incohérences détectées par audit (mots-clés qui matchaient un plat
  // sans rapport : "Chianti" → chia pudding, "Vinaigrette" → vin, "grillé" végé/poulet → photo kebab,
  // "beignet de banane" → poulet, "tarte salée" → dessert, "frites & boisson" → frites au lieu de falafel) ---
  'chianti (verre)': U('1587920710219-f6f9804dc10d'),
  'menu falafel wrap (frites & boisson)': U('1593001872095-7d5b3868fb1d'),
  'cacahuètes grillées': U('1599490659213-e2b9527bd087'),
  'tofu grillé légumes': U('1512621776951-a57141f2eefd'),
  'bowl tofu grillé': U('1512621776951-a57141f2eefd'),
  'assiette végétarienne grillée': U('1512621776951-a57141f2eefd'),
  'poulet grillé légumes vapeur': U('1762631934518-f75e233413ca'),
  'beignets de banane': U('1570727624862-3008fe67a6be'),
  'beignets à la banane': U('1570727624862-3008fe67a6be'),
  'beignets sucrés': U('1714545049821-9eddecf6e20d'),
  'petit milkshake chocolat': U('1619158403521-ed9795026d47'),
  'tarte salée aux légumes': U('1650844010413-3f24dc1c182b'),
  'menu tarte salée aux légumes': U('1650844010413-3f24dc1c182b'),

  // --- Nouvelle carte snack turc (dürüms/pitas/mitraillettes/tacos) ---
  'red bull': U('1570526427001-9d80d114054d'),

  // --- Nouvelle carte pizzeria : plats dont le nom matche par erreur un tout autre type de plat
  // ("Bolognese"/"Kebab"/"Poulet curry" sont des PIZZAS, pas des pâtes/kebabs/currys ; "Calzone
  // Nutella" est un DESSERT, pas une pizza salée) ---
  'bolognese (pizza)': U('1534308983496-4fabb1a015ee'),
  'kebab (pizza)': U('1637438333468-2ea466032288'),
  'poulet curry (pizza)': U('1615719413546-198b25453f85'),
  'calzone nutella': U('1673551490812-eaee2e9bf0ef'),
  "pain à l'ail": U('1573140401552-3fab0b24306f'),

  // --- Nouvelles cartes sushi/healthy/chicken/belge/burgers/boulangerie/boucherie/café/libanais/
  // espagnol : plateaux sushi sans photo dédiée + "vino" collision avec le mot-clé "vin" ---
  'plateau solo (16 pcs)': U('1709984110217-57d7d18e5299'),
  'plateau duo (32 pcs)': U('1625938145312-c18f06f53be0'),
  'plateau family (54 pcs)': U('1562802378-063ec186a863'),
  'sashimi thon ×6': U('1625248464253-1b528c1ab7e0'),
  'sashimi mixte ×6': U('1607246749106-0a2b287f7245'),
  'california roll saumon avocat ×8': U('1696091811927-6b9552931f70'),
  'spring rolls thon mangue ×6': U('1648146298904-d58a8c79e0a7'),
  'chich taouk': U('1629450748686-c86699b710ac'),
  // --- Sushi à la pièce (×2/×6) : retombaient tous sur la même photo de plateau géant (via le mot-clé
  // générique "sushi"), trompeur pour une commande de 2 pièces — chaque poisson a maintenant sa
  // propre photo de nigiri/sashimi (doublon signalé par le restaurateur, 2026-08). ---
  'sushi saumon ×2': U('1744360515510-db7bf0f6def8'),
  'sushi thon ×2': U('1779298177750-b9d3f20d4350'),
  'sushi crevette ×2': U('1569945393177-ffe6dc868c0d'),
  'sushi daurade ×2': U('1621590183062-bca4b1667268'),
  'sushi anguille ×2': U('1763627719044-5d1d6a6b809c'),
  'sashimi saumon ×6': U('1641898378716-1f38ec04bb0f'),

  // --- Night shop : marques de bière qui ne contiennent pas le mot "bière" donc ne matchent aucun
  // mot-clé (retombaient sur une photo générique de boisson) — re-signalé 2026-08 : la rotation sur 4
  // photos (précédente) laissait encore des paires identiques dans un même menu de 9 marques. Chaque
  // marque a maintenant sa propre photo distincte (aucune répétition), vérifiée individuellement. ---
  'jupiler 33cl': U('1618885472179-5e474019f2a9'),
  'jupiler 50cl': U('1619760078865-ee0f4c6586ee'),
  'cara pils 50cl': U('1636391945755-4e260dd880cb'),
  'duvel 33cl': U('1761926184403-72c14dc44409'),
  'chimay bleue 33cl': U('1644085159285-5fd924740cb3'),
  'kriek / chouffe 33cl': U('1571613316887-6f8d5cbf7ef7'),
  'leffe 33cl': U('1535958636474-b021ee887b13'),
  'desperados 33cl': U('1700151561995-5313146bb997'),
  'corona 35,5cl': U('1597822738124-151fb72dcb79'),
  'pack jupiler 6 × 33cl': U('1608270586620-248524c67de9'),
  // "Prosecco" partageait la photo de vin rouge (verres) — remplacé par une vraie bouteille de mousseux.
  'prosecco': U('1761757225438-711aa1bbf8d9'),

  // --- Italien (trattoria) : "grillé" retombe sur le mot-clé générique kebab/grill, "peroni" ne
  // contient pas "bière" donc ne matche aucun mot-clé ---
  'filet de bar grillé': U('1641898378716-1f38ec04bb0f'),
  'légumes grillés': U('1650844010413-3f24dc1c182b'),
  'peroni 33cl': U('1618183479302-1e0aa382c36b'),

  // --- Asiatique (wok) : accent sur "phở"/"pad thaï" empêche le match des mots-clés (sans accent),
  // + corrections doublons (nems/rouleaux de printemps, phở bœuf/poulet, pad thaï poulet/crevettes,
  // poulet légumes/ramen poulet via le mot-clé générique 'poulet', curry vert/rouge, riz sauté/cantonnais) ---
  'rouleaux de printemps (2 pcs)': U('1594020292985-216a72a2c7ce'),
  'phở bœuf': U('1555126634-323283e090fa'),
  'phở poulet': U('1503764654157-72d979d9af2f'),
  'poulet légumes sauce soja': U('1628025114288-1693ac3bcac1'),
  'pad thaï poulet': U('1746973645769-c11eb0a81025'),
  'pad thaï crevettes': U('1559314809-0d155014e29e'),
  'curry rouge crevettes': U('1720949579179-b4d04403f548'),
  'riz sauté crevettes': U('1609570324378-ec0c4c9b6ba8'),
  'banane frite au miel': U('1570727624862-3008fe67a6be'),

  // --- Végétarien : "tarte" seul retombe sur la photo générique de dessert (gâteau au chocolat) ---
  'tarte du jour, salade': U('1650844010413-3f24dc1c182b'),

  // --- Mexicain : "grillé" (maïs) retombe sur le mot-clé générique kebab/grill ---
  'elote (maïs grillé)': U('1653886764193-db9e5a93d215'),

  // --- Charcuterie : aucun mot-clé ne matchait, retombait sur la photo générique "Entrées" (une
  // soupe verte) — signalé par le restaurateur sur "Jambon d'Ardenne". Les 5 produits partageaient
  // ensuite tous la même photo de plateau charcuterie/fromage (doublon signalé par le restaurateur,
  // 2026-08) — chacun a maintenant sa propre photo distincte, vérifiée visuellement. ---
  'jambon cuit (100g)': U('1607756794535-ba48a526b73a'),
  "jambon d'ardenne (100g)": U('1524438418049-ab2acb7aa48f'),
  'salami (100g)': U('1768758922609-fd805f703507'),
  'pâté de campagne (100g)': U('1750874694155-0cb4cec1d196'),
  'boudin blanc / noir (pièce)': U('1624772398061-bbfa87ec6b5a'),
  'jamón ibérico (50g)': U('1524438418049-ab2acb7aa48f'),
  'chorizo al vino': U('1754572058122-771d8cb264d2'),

  // --- Autres entrées Boucherie / Fried Chicken retombant sur la même photo générique "Entrées" ---
  'sauce maison (pot)': U('1605940374327-ca3508431b42'),
  'sauces': U('1518013431117-eb1465fa5752'),
  'toast cannibale': U('1727243866425-3bf2cbf7480a'),
  'samoussas (3 pcs)': U('1572098873382-f8e4bf925781'),
  'cervelas': U('1612392061787-2d078b3e573c'),

  // --- Libanais : orthographes qui ne matchent pas les mots-clés existants (accents/variantes),
  // + quelques mezzés sans mot-clé dédié + corrections doublons (moutabbal/mouhammara, taboulé/
  // fattouch, falafel/sandwich falafel/assiette végétarienne, warak enab/mezzé x2, et surtout le
  // mot-clé "kafta" qui pointait par erreur vers la même photo que "shawarma" — collision à 6) ---
  'moutabbal': U('1627308595127-d9acf19107ce'),
  'mouhammara': U('1612192666510-e7ccf6e5f359'),
  'taboulé': U('1498048615146-6a435b1e65a4'),
  'fattouch': U('1594040815645-5442fb6d48f6'),
  'kibbeh (3 pcs)': U('1663004940335-8e7d8f1a093c'),
  'sambousek fromage (4 pcs)': U('1767124559112-088d7d1cc000'),
  'falafel (6 pcs)': U('1786174045057-89e6449f47d9'),
  'sandwich falafel': U('1681072530653-db8fe2538631'),
  'warak enab (feuilles de vigne)': U('1743674453093-592bed88018e'),
  'mezzé végétarien (6 pièces)': U('1767114915974-3481fa23cbb0'),
  'mezzé royal (10 pièces)': U('1748540459503-19efc015143b'),
  'sandwich shawarma poulet': U('1719282431565-3b30bb7d2658'),
  'sandwich shawarma viande': U('1719282431723-9d0f4370d4bc'),
  'sandwich kafta': U('1748955307113-992406078fee'),
  'assiette shawarma poulet': U('1670165088604-5a39f5c1be51'),
  'assiette shawarma viande': U('1670164745516-06547b04520a'),
  'kafta grillée': U('1659275798977-6eee03f687a2'),
  'namoura': U('1590429878071-1fabde685deb'),

  // --- Desserts & Glaces : corrections doublons — les 3 tailles de glace boule partageaient la même
  // photo, pareil pour cookie/cookie double chocolat/part de tarte (pool 'cookie'), les 2 donuts
  // (mot-clé générique 'donut'), les 3 gaufres (mot-clé générique 'gaufre'), les 2 milkshakes (mot-clé
  // générique 'milkshake') et les 2 chocolats chauds (mot-clé 'chocolat chaud') ---
  'glace boule (2 parfums)': U('1579954115563-e72bf1381629'),
  'glace boule (3 parfums)': U('1646321155308-96c1b84e4685'),
  'cookie double chocolat': U('1634188023615-7e08901193b6'),
  'part de tarte aux fruits': U('1636894435570-c3c400dfac53'),
  'donut garni (nutella, caramel...)': U('1685779923180-b78b6b8231b9'),
  'gaufre de liège chocolat': U('1675194588436-9c76aa85795d'),
  'gaufre de bruxelles sucre': U('1639471045701-b11e96875a7e'),
  'milkshake fraise': U('1579954115545-a95591f28bfc'),
  'chocolat chaud chantilly': U('1700488629510-bf60790ff9fc'),

  // --- Espagnol : cuisine sans mot-clé dédié, toutes les entrées retombaient sur la photo générique ---
  'pan con tomate': U('1656423521731-9665583f100c'),
  'manchego': U('1623855244697-5d8fbe9c7892'),
  'boquerones': U('1641898378716-1f38ec04bb0f'),
  'salmorejo': U('1578861256505-d3be7cb037d3'),
  'patatas bravas': U('1573080496219-bb080dd4f877'),
  'tortilla': U('1518569656558-1f25e69d93d7'),
  'calamares a la romana': U('1652209911920-2700fcbd5011'),
  'pimientos de padrón': U('1650844010413-3f24dc1c182b'),
  'albóndigas': U('1529042410759-befb1204b468'),
  'pulpo a la gallega': U('1535980156496-87fc2cfcb832'),

  // --- Night Shop : snacks/hygiène/gadgets sans mot-clé dédié — 7 snacks partageaient la même photo
  // de chips (Doritos/Tuc/Cacahuètes/Beef jerky n'ont pourtant pas la forme de chips) et 7 produits
  // d'hygiène partageaient tous une photo de brosse à dents (Déodorant/Gel douche/Serviettes/
  // Préservatifs n'y ressemblent pas) — chaque produit a maintenant sa propre photo vérifiée
  // (doublons + incohérences signalés par le restaurateur, 2026-08). ---
  'pringles': U('1599490659213-e2b9527bd087'),
  "chips lay's 175-250g": U('1621447504864-d8686e12698c'),
  "chips lay's 45g": U('1694101493127-eca6dfef5011'),
  'coca-cola 1,5l': U('1648569883125-d01072540b4c'),
  'vin correct': U('1561461056-77634126673a'),
  'doritos': U('1754088605508-4148fefd8a43'),
  'tuc': U('1781820222136-894190cc3fdb'),
  'cacahuètes / mix apéro': U('1742524252643-d1f3fddd8cca'),
  'beef jerky': U('1652209695374-7a91c243f12f'),
  'papier toilette (4 rouleaux)': U('1584556812952-905ffd0c611a'),
  'mouchoirs': U('1609840112990-4265448268d1'),
  'dentifrice': U('1594178990090-ca641059a506'),
  'brosse à dents': U('1550985543-f1ea83691cd8'),
  'déodorant': U('1700225195176-39ebd9cd5550'),
  'gel douche': U('1673847401561-fcd75a7888c5'),
  'serviettes hygiéniques / tampons': U('1764312270936-adb508140a6d'),
  'préservatifs (3)': U('1698376621004-70ce754157d1'),
  'briquet': U('1575908539629-62b3f98d7b3a'),
  'chargeur usb': U('1492107376256-4026437926cd'),
  'câble téléphone': U('1557767382-97b28f5488e7'),
  'piles aa (4)': U('1576834975354-ee694be1f0d1'),

  // --- Healthy : dernier orphelin retombant sur la photo générique "Entrées" (+ corrections doublons
  // et item ajouté pour atteindre 30 plats) ---
  'porridge fruits': U('1571212515416-fef01fc43637'),
  'buddha bowl': U('1505576633757-0ac1084af824'),
  'curry de légumes riz': U('1695720247911-817755ad7d02'),
  'yaourt granola': U('1612182062572-e29c5dfb5eb4'),
  'skyr fruits rouges': U('1571230389215-b34a89739ef1'),

  // --- Végétarien : corrections doublons (soupe du jour/menu midi, houmous/buddha bowl, burger
  // végétarien/vegan tombaient tous sur la même image générique) + 2 items ajoutés pour atteindre 30 ---
  'soupe du jour': U('1605909388460-74ec8b204127'),
  'houmous pain plat': U('1697126248475-a537cc5cce28'),
  'burger végétarien (galette maison, frites)': U('1661529515642-fef696c86f64'),
  'poke bowl végétarien': U('1606757819934-d61a9f7279d5'),
  'tiramisu vegan': U('1714385905983-6f8e06fffae1'),

  // ===== Deuxième passe : mêmes incohérences que ci-dessus, mais pour les catégories Plats/
  // Desserts/Boissons (ex. "Filet américain préparé" affichait un poke bowl — photo générique "Plats"). =====

  // --- Pizza : variantes nommées sans le mot "pizza", ne matchaient aucun mot-clé — puis re-signalé
  // en 2026-08 : deux groupes de 5 et 7 pizzas/menus différents partageaient chacun UNE seule de ces
  // photos (copier-coller au lieu de différencier). Chaque variante a maintenant sa propre photo
  // vérifiée (téléchargée puis inspectée), y compris "menu solo/duo/famille" et "eau 50cl"/"bouteille
  // 1,5l" — même un même plat à quantité différente ne doit plus partager sa photo avec une autre. ---
  'napoletana': U('1660309770197-350a0167b178'),
  'funghi': U('1717883235373-ef10b2a745a3'),
  'hawaï': U('1565299624946-b28f40a0ae38'),
  'végétarienne': U('1613564834361-9436948817d1'),
  'tonno': U('1639397753197-bab733459943'),
  'bufalina': U('1548369937-47519962c11a'),
  'tartufo': U('1566843972223-8fc2316bfa9e'),
  'chèvre-miel': U('1593560708920-61dd98c46a4e'),
  'frutti di mare': U('1652952561151-97e82f26c336'),
  'fromages et jambon fumé': U('1732223229355-95a1433404bf'),
  'menu solo': U('1651981075280-9a9e01acbff0'),
  'menu duo': U('1516697073-419b2bd079db'),
  'menu famille': U('1599462620592-8e17c48eed70'),
  'penne quatre fromages': U('1612152328178-4a6c83d96429'),
  'penne poulet-champignons': U('1607116667981-ff148a14e975'),
  'eau 50cl': U('1534616042650-80f5c9b61f09'),
  'bouteille 1,5l': U('1616118132534-381148898bb4'),

  // --- Burgers : variantes nommées sans le mot "burger" (+ items ajoutés pour atteindre 30 plats) ---
  'classic': U('1571091718767-18b5b1457add'),
  'bacon cheese': U('1586190848861-99aa4a171e90'),
  'double': U('1550317138-10000687a72b'),
  'blue cheese': U('1610440042657-612c34d95e9f'),
  'bbq': U('1610614819513-58e34989848b'),
  'truffe': U('1596956470007-2bf6095e7e16'),
  'veggie': U('1520072959219-c595dc870360'),
  'vegan': U('1610970878459-a0e464d7592b'),
  'burger du mois': U('1568901346375-23c9450c58cd'),
  'mini burger + frites + jus': U('1619290463523-6d18f6a6b220'),
  'chicken crispy': U('1551782450-a2132b4ba21d'),
  'chicken hot honey': U('1703219342329-fce8488cf443'),
  'fish burger': U('1615297928064-24977384d0da'),
  'chili cheese fries': U('1639744210631-209fce3e256c'),
  'cheese sticks (5 pcs)': U('1734774924912-dcbb467f8599'),
  'apple pie': U('1572383672419-ab35444a6934'),
  'thé glacé pêche': U('1601390395693-364c0e22031a'),

  // --- Italien (plats sans mot-clé) : re-signalé 2026-08, 5 plats de viande différents partageaient
  // cette même photo (Vitello tonnato/Saltimbocca/Escalope milanaise/Osso buco/Tagliata) — chacun a
  // maintenant sa propre photo vérifiée. ---
  'vitello tonnato': U('1640346060848-ad6921833885'),
  'saltimbocca alla romana': U('1625940947539-6d4702b302a2'),
  'escalope milanaise': U('1649463509344-e2d2db8e4686'),
  'osso buco': U('1769773183948-d24e3c5a2b82'),
  'tagliata de bœuf, roquette, parmesan': U('1588168333986-5078d3ae3976'),
  'menu midi (entrée + plat, semaine)': U('1551183053-bf91a1d81141'),
  'spaghetti carbonara (guanciale, pecorino)': U('1633337474564-1d9478ca4e2e'),
  'roquette parmesan': U('1511994714008-b6d68a8b32a2'),
  'tagliatelle bolognese': U('1621996346565-e3dbc646d9a9'),
  'lasagne maison': U('1646077978608-65ed63765302'),
  'penne arrabbiata': U('1676300184847-4ee4030409c0'),
  'pâtes à la truffe': U('1608219992759-8d74ed8d76eb'),
  'linguine vongole': U('1581073598026-26753e28b782'),
  'ravioli ricotta épinards, beurre sauge': U('1778850620699-79ba3ff60bf0'),
  'tagliatelle scampis': U('1522666257812-173fdc2d11fe'),
  'risotto champignons': U('1609770424775-39ec362f2d94'),
  'risotto scampis': U('1601579112759-761ccbaa8bde'),
  'panna cotta': U('1452968011964-24f8831c43c3'),
  'cannoli (2 pcs)': U('1749767138348-2e5bf1cbcef2'),
  'vin au verre': U('1553361371-9b22f78e8b1d'),
  'bouteille de vin maison (75cl)': U('1593548615309-5a45c504f994'),
  'limoncello': U('1656057088883-546495ba6945'),
  'burrata tomates cerises': U('1623855244697-5d8fbe9c7892'),
  'planche antipasti misti (2 pers.)': U('1708593679370-0523990e8922'),

  // --- Belge : plats + bières sans mot-clé dédié ---
  'stoemp saucisses': U('1650844010413-3f24dc1c182b'),
  'chicons au gratin': U('1650844010413-3f24dc1c182b'),
  'lapin à la kriek': U('1773417325310-cc9c9bef75e7'),
  'plat du jour (midi, semaine)': U('1543353071-873f17a7a088'),
  'dame blanche': U('1541014741259-de529411b96a'),
  'jupiler 25cl': U('1618183479302-1e0aa382c36b'),
  'duvel': U('1703564803611-36f9358b5b03'),
  'chimay': U('1691419775322-1864f752dbac'),
  'kriek': U('1703564803569-2a9063d5cf06'),

  // --- Asiatique / Healthy / Végétarien ---
  'menu midi (entrée + plat)': U('1543353071-873f17a7a088'),
  'dahl de lentilles': U('1716959669858-11d415bdead6'),
  'eau infusée': U('1534616042650-80f5c9b61f09'),
  'dahl de lentilles, naan': U('1716959669858-11d415bdead6'),
  // "Riz cantonnais"/"Riz cantonais" (Asiatique a une coquille avec un double n, Chinois l'orthographe
  // correcte — les deux gardées) retombaient sur le pool générique riz/curry (soupe ou risotto selon le
  // hash) au lieu d'un vrai riz sauté — override dédié vers une vraie photo de riz cantonais.
  'riz cantonnais': U('1603133872878-684f208fb84b'),
  'riz cantonais': U('1603133872878-684f208fb84b'),
  // "Nouilles sautées poulet" pouvait retomber sur une photo de riz frit (pool "nouilles"/"bo bun")
  // au lieu de nouilles — override dédié.
  'nouilles sautées poulet': U('1609183480237-ccbb2d7c5772'),
  // "Curry massaman bœuf" partageait la même photo de soupe verte que "Curry rouge crevettes" — les
  // deux affichaient un doublon identique côte à côte.
  'curry massaman bœuf': U('1560963859-6f618d786177'),
  // "Bo bun (bœuf, nems)"/"Bo bun nems" contiennent "nems" qui matchait par erreur le mot-clé
  // "rouleaux de printemps/nems" avant d'atteindre le mot-clé "bo bun" plus bas dans la liste —
  // affichait des rouleaux de printemps au lieu d'un bol de bo bun.
  'bo bun (bœuf, nems)': U('1605311572312-a926afe51604'),
  'bo bun nems': U('1605311572312-a926afe51604'),
  // "Thé jasmin" utilisait une photo authentique mais quasi entièrement noire (mise en scène très
  // sombre) — illisible à la taille d'une vignette de menu, remplacée par une photo claire.
  'thé jasmin': U('1611162458324-aae1eb4129a4'),
  // "Wrap poulet avocat"/"Wrap végétarien" : l'une des 3 photos du pool générique sandwich/wrap
  // était en réalité un burger empilé — chaque wrap a maintenant sa propre vraie photo de wrap roulé.
  'wrap poulet avocat': U('1752095809096-f09d22c466c5'),
  'wrap végétarien': U('1626700051175-6818013e1d4f'),
  'wrap saumon fumé': U('1559054663-e8d23213f55c'),

  'uludağ': U('1622597467821-df79dcb4f94d'),

  // --- Mexicain : cocktails/plats sans mot-clé dédié + corrections doublons (tacos pastor/menu midi
  // tombaient sur le mot-clé générique 'tacos', enchiladas sur le mot-clé générique 'poulet', nachos
  // pulled pork sur le mot-clé générique 'nachos', quesadilla poulet sur le mot-clé générique
  // 'quesadilla', et les 4 boissons partageaient toutes la même photo) ---
  'fajitas bœuf': U('1664138788119-bd4f073259d5'),
  'flan mexicain': U('1676300184943-09b2a08319a3'),
  'tacos pastor (porc ananas)': U('1579888944880-d98341245702'),
  'menu midi (2 tacos + boisson)': U('1574782091246-c65ed4510300'),
  'enchiladas poulet': U('1636777408340-e053c0b5ba2a'),
  'nachos pulled pork': U('1655017976676-61a3bcdabac6'),
  'quesadilla poulet': U('1673990349292-ed2dfa7988c9'),
  'margarita': U('1516684163977-84cc7de8c7c8'),
  'margarita fruits': U('1556855810-ac404aa91e85'),
  'mojito': U('1653542772393-71ffa417b1c4'),
  'agua fresca': U('1622597467821-df79dcb4f94d'),
  'tequila / mezcal (shot)': U('1529671434436-8fbb37410056'),

  // --- Libanais : plat + desserts sans mot-clé dédié ---
  'assiette végétarienne': U('1593001872095-7d5b3868fb1d'),
  'halawet el jibn': U('1643910509872-78bc24a2bc53'),

  // --- Espagnol : cuisine entière sans mot-clé, suite (plats/desserts/boissons) + corrections doublons
  // (les 3 paellas, les 2 tapas, gambas/boquerones, et sangria/tinto/vin rioja partageaient tous une
  // même photo entre eux) ---
  'paella valenciana (par pers., min. 2 pers.)': U('1694685367640-05d6624e57f1'),
  'paella marisco (par pers.)': U('1623961990059-28356e226a77'),
  'fideuá (par pers.)': U('1572337712872-ac1b3d9ca7d6'),
  'secreto ibérico': U('1532636875304-0c89119d9b4d'),
  'sélection 6 tapas': U('1671180401158-8d9d060d4966'),
  'sélection 10 tapas': U('1682988779823-bccfe4261c49'),
  'gambas al ajillo': U('1619860705619-1e0ba34091e0'),
  'crema catalana': U('1676300184943-09b2a08319a3'),
  'tarta de santiago': U('1517427294546-5aa121f68e8a'),
  'sangria 50cl': U('1587920710219-f6f9804dc10d'),
  'tinto de verano': U('1563227812-0ea4c22e6cc8'),
  'vin rioja (verre)': U('1780675520350-917559e364c0'),

  // --- Fried Chicken ---
  'eau': U('1534616042650-80f5c9b61f09'),
  // "Poulet frit" (3/6/12 pcs + Bucket) contient "poulet" et retombait sur la photo générique
  // poulet/chicken — qui montrait (avant fix ci-dessus) une poitrine de poulet CRUE, absurde pour un
  // produit frit. Override dédié vers une vraie photo de poulet frit doré.
  'poulet frit 3 pcs': U('1742936401708-dd1b132f06db'),
  'poulet frit 12 pcs': U('1426869981800-95ebf51ce900'),
  // --- Fried Chicken : corrections doublons — 3pcs/6pcs partageaient la même photo, pareil pour
  // 12pcs/bucket 20pcs, tous les tenders (générique 'tenders'), tous les wings (générique 'wings'),
  // bowl poulet/coleslaw (générique 'coleslaw'), et frites/menu tenders+frites (pool 'frite') ---
  'poulet frit 6 pcs': U('1586793783658-261cddf883ef'),
  'poulet frit bucket 20 pcs': U('1588923930957-81c81fd6262b'),
  'tenders 8 pcs': U('1605291581926-df4bf7ee3e89'),
  'tenders bucket 16 pcs': U('1647724394693-2c93af726785'),
  'wrap tenders': U('1626700051175-6818013e1d4f'),
  'wings 12 pcs': U('1762631934523-f91b18cbf81d'),
  'wings 24 pcs': U('1585703900468-13c7a978ad86'),
  'bowl poulet riz coleslaw': U('1682566509568-ded8649b26bb'),
  'frites': U('1607329773021-91a5dbd5986f'),

  // --- Coffee Shop : boissons spécialité sans mot-clé exact — "Golden Latte"/"Strawberry Matcha"/
  // "Hojicha Latte" partageaient tous la même photo de matcha vert (doublon + couleur trompeuse : le
  // golden latte doit être doré/curcuma, le strawberry matcha rose, le hojicha brun torréfié) ---
  'formule brunch (week-end)': U('1603046891726-36bfd957e0bf'),
  'latte': U('1509042239860-f550ce710b93'),
  'strawberry matcha': U('1744920666512-506c732c20f3'),
  'hojicha latte': U('1506372023823-741c83b836fe'),
  'golden latte': U('1778449303540-3274878cdc85'),

  // --- Boulangerie : jusqu'à 16 plats (pains, viennoiseries, tartes) retombaient tous sur l'unique
  // photo générique du mot-clé pain/croissant/viennoiserie (1623334044303), certains via cet override
  // qui ne faisait alors que dupliquer ce même générique au lieu de le différencier — chaque plat a
  // maintenant sa propre photo vérifiée (téléchargée puis inspectée), 2026-08. ---
  'baguette': U('1568471173242-461f0a730452'),
  'pain blanc / gris 800g': U('1509440159596-0249088772ff'),
  'pain de campagne': U('1509440159596-0249088772ff'),
  'pain aux céréales': U('1509440159596-0249088772ff'),
  "pain d'épeautre": U('1509440159596-0249088772ff'),
  'pistolet (pièce)': U('1549438247-223f2db1dd29'),
  'cramique (tranche)': U('1546309919-812d3b094670'),
  'éclair': U('1774119649906-c82806125e23'),
  'couque aux raisins': U('1509365465985-25d11c17e812'),
  'couque suisse': U('1591538001662-0d5a25234305'),
  'craquelin': U('1622941367239-8acd68fa946d'),
  'merveilleux': U('1519915028121-7d3463d20b13'),
  'boule de berlin': U('1570727624862-3008fe67a6be'),
  'tarte au riz (part)': U('1637273483570-10e72651892e'),
  'tarte au riz entière (6-8 pers.)': U('1637273483570-10e72651892e'),
  'tarte aux fruits (part)': U('1614174486496-344ef3e9d870'),
  'tarte aux fraises entière (6-8 pers.)': U('1503485838016-53579610c389'),

  // --- Boucherie (plats) : viandes crues au poids + préparations, signalé par le restaurateur sur
  // "Filet américain préparé" qui affichait un poke bowl (photo générique "Plats"), puis re-signalé
  // pour la photo de viande crue répétée à l'identique sur 8 produits différents : chaque item a
  // maintenant sa propre photo distincte (vérifiée via alt-text Unsplash, pas de doublon) ---
  'haché porc et veau (kg)': U('1764620931673-ba46205f2e4e'),
  'haché de bœuf (kg)': U('1602470520992-3f0796acddc8'),
  'entrecôte (kg)': U('1690983325551-b922137727be'),
  'filet pur de porc (kg)': U('1690983321750-ad6f6d59a84b'),
  'côtes de porc (kg)': U('1613454320437-0c228c8b1723'),
  "gigot d'agneau (kg)": U('1690983322025-aab4f95a0269'),
  'rôti de bœuf (kg)': U('1690983330536-3b0089d07cf9'),
  'steak de bœuf (kg)': U('1723893905879-0e309c2a8e06'),
  'filet américain préparé (100g)': U('1785517605613-e55a1470305d'),
  'saucisses maison (pièce)': U('1612392061787-2d078b3e573c'),
  'merguez (pièce)': U('1743674453093-592bed88018e'),
  'cordon bleu (pièce)': U('1626645738196-c2a7c87a8f58'),
  'oiseaux sans tête (pièce)': U('1588347818036-558601350947'),
  'filet de poulet (kg)': U('1672787153652-b3b9d92f3e8c'),
  'cuisses de poulet (kg)': U('1682991136736-a2b44623eeba'),
  'vol-au-vent (portion)': U('1716959669858-11d415bdead6'),
  'boulets sauce tomate (portion)': U('1543353071-873f17a7a088'),
  'carbonnades (portion)': U('1682428617976-f25633ed8469'),
  'stoemp carottes (portion)': U('1650844010413-3f24dc1c182b'),

  // --- Supermarché / Autre ---
  'plat préparé du jour': U('1543353071-873f17a7a088'),
  'plat du jour': U('1543353071-873f17a7a088'),

  // --- Night Shop : épicerie/snacks/boissons sans mot-clé dédié ---
  // "pain de mie" contient "pain" et retombait sinon sur le seau de viennoiseries du mot-clé générique
  // (KEYWORD_IMAGES) — pain de mie tranché ≠ croissant, d'où cet override dédié.
  'pain de mie': U('1598373182133-52452f7691ef'),
  'beurre': U('1603596311044-f19158b61f28'),
  'fromage tranches': U('1589985270826-4b7bb135bc9d'),
  'jambon': U('1754572058122-771d8cb264d2'),
  'sauce tomate': U('1715733593146-93c3461765b8'),
  'nutella 400g': U('1641538207883-712b6f77b42d'),
  'céréales': U('1521483451569-e33803c0330c'),
  // "riz" (produit brut en épicerie) contournait le mot-clé générique riz/curry/cantonais (plat cuisiné) —
  // override dédié pour un vrai visuel de riz cru en épicerie plutôt qu'un plat en sauce.
  'riz': U('1586201375761-83865001e31c'),
  // "sucre / farine" partageait par erreur la photo de croissants ci-dessus (via 'beurre').
  'sucre / farine': U('1761222191837-4448599c09fc'),
  'huile 1l': U('1518013431117-eb1465fa5752'),
  // "conserves (thon, maïs)" contenait "thon" et retombait sur la photo générique poisson/saumon —
  // override dédié pour un vrai visuel de boîtes de conserve.
  'conserves (thon, maïs)': U('1653174577821-9ab410d92d44'),
  'barres choco (mars, snickers, kinder bueno)': U('1621939514649-280e2ee25f60'),
  "tablette côte d'or": U('1627647227768-705244233b56'),
  'haribo': U('1582058091505-f87a2e55a40f'),
  "m&m's pochon": U('1632689462345-c202ee1427c8'),
  'magnum (pièce)': U('1541014741259-de529411b96a'),
  'red bull 25cl': U('1570526427001-9d80d114054d'),
  'monster 50cl': U('1622543925917-763c34d1a86e'),
  'eau 1,5l': U('1616118132534-381148898bb4'),
  'capri-sun': U('1706881811931-12e3692a20b2'),
  'whisky 70cl': U('1615887023544-3a566f29d822'),
  // "Gin"/"Jägermeister"/"Mignonnettes" partageaient tous la photo de verres de vin rouge — des
  // spiritueux qui n'ont rien à voir visuellement, chacun a maintenant sa propre bouteille.
  'gin 70cl': U('1735416031163-863c7cf824bb'),
  'rhum 70cl': U('1652284917571-e6475a979ea5'),
  'vodka 70cl': U('1591704951890-0862b2e98acb'),
  'jägermeister 70cl': U('1727989806974-43836c555326'),
  'mignonnettes': U('1570649462630-2eec4e6bcd6d'),

  // --- City Burger : condiment sans mot-clé dédié, retombait sur la photo générique "Entrées" ---
  'vinaigrette miel-moutarde': U('1518013431117-eb1465fa5752'),

  // --- Plats retombant sur la photo générique de catégorie faute de mot-clé dédié — chaque photo
  // vérifiée individuellement (téléchargée puis inspectée) pour confirmer qu'elle représente bien
  // le plat précis, pas juste "un plat" de la même cuisine. Quatre plats n'ont pas trouvé de photo
  // fiable malgré la recherche (naan au fromage, chè, crêpe sucre nature, foutou sauce claire,
  // bún bò huế) — laissés sur le générique plutôt que d'afficher une photo trompeuse. ---
  "bœuf sauté à l'ail et poivre": U('1715963301679-993721387552'),
  'samoussas agneau (3 pcs)': U('1714799263348-41c7245cd714'),
  'papadums (assortiment)': U('1760047536700-0868c9525b0f'),
  'naan nature': U('1640625314547-aee9a7696589'),
  "naan à l'ail": U('1756821752957-00bfcadc3748'),
  'biryani agneau': U('1631515243349-e0cb75fb8d3a'),
  'saag paneer': U('1767114915936-745dd372f1d8'),
  'korma agneau': U('1603894584373-5ac82b2ae398'),
  'gulab jamun (2 pcs)': U('1593701461250-d7b22dfd3a77'),
  'lassi mangue': U('1623065422902-30a2d299bbe4'),
  'lassi salé': U('1630409346699-79481a79db52'),
  'bánh mì tofu': U('1710532774170-9844f837ae54'),
  'dim sum vapeur mixte (6 pcs)': U('1641928944645-0435da9e6e9d'),
  'porc aigre-doux': U('1775039983749-aa6003c8ecf9'),
  'tofu mapo': U('1769065647078-f067eb768035'),
  'coupe glacée gourmande': U('1635491231222-8e524584da52'),
  'crêpe nutella': U('1515467837915-15c4777ba46a'),
  'crêpe nutella banane chantilly': U('1734056650036-7002ede7b8f8'),
  'porridge fruits rouges': U('1686344234276-dc3ac6f284ff'),
  'omelette fromage jambon': U('1630684789447-2484443c6c1b'),
  'formule brunch complète': U('1716667282961-057120e35183'),
  'waffle sucre': U('1562376552-0d160a2f238d'),
  'gingembre maison': U('1631029098074-be99eb2b425c'),
  'calamars frits': U('1763467940825-d067fb3baf22'),
  'sole meunière': U('1763867641066-cd26a5f11105'),
  'paella de fruits de mer': U('1779119390078-16f56e4c35bc'),
  "scampis à l'ail": U('1758972572427-fc3d4193bbd2'),

  // --- Deuxième audit diversité (2026-08) : plusieurs plats différents au sein d'une même carte
  // affichaient la même photo 3 à 6 fois d'affilée. Réutilise des photos déjà vérifiées ailleurs dans
  // ce fichier pour les mêmes types de plats (variantes anglaises du menu City Burger/générique),
  // plutôt que de dupliquer une recherche déjà faite. ---
  // Sushi : 5 makis différents (saumon/thon/concombre/avocat/saumon-avocat) partageaient tous la photo
  // générique "maki".
  'maki saumon ×6': U('1617196034738-26c5f7c977ce'),
  'maki thon ×6': U('1712725214706-e564b8dd1bbe'),
  'maki concombre ×6': U('1728691190534-e1e8c564014e'),
  'maki saumon avocat ×6': U('1646196603168-ed92068477c3'),
  // 4 California rolls différents partageaient tous la même photo (le saumon-avocat a maintenant sa
  // propre photo, définie plus haut, pour ne plus la partager avec Maki saumon avocat non plus).
  'california roll crevette tempura ×8': U('1580822184713-fc5400e7fe10'),
  'california roll poulet croustillant ×8': U('1625668742946-4ade4980c01e'),
  'california roll végétarien ×8': U('1564489563601-c53cfc451e93'),
  // Mexicain : 6 tacos différents (poulet/carnitas/barbacoa/crevettes/champignons/pastor) partageaient
  // tous la même photo générique "tacos".
  'tacos carnitas (porc confit)': U('1746648858213-c7b5d2e34265'),
  'tacos barbacoa (bœuf)': U('1768716575089-7ba787da9afb'),
  'tacos crevettes': U('1768716697811-75b2ce9c5b54'),
  'tacos champignons-haricots noirs': U('1768716575003-2f7450b1344a'),
  // 3 burritos différents (poulet/bœuf/végétarien) partageaient tous la même photo générique "burrito".
  'burrito poulet': U('1731090389457-7e62135a657f'),
  'burrito bœuf': U('1671572579845-52270341950f'),
  'burrito végétarien': U('1731090389462-351421240be9'),
  // Poke Bowl : 4 poke bowls différents (saumon/thon/crevettes/saumon avocat mangue) partageaient tous
  // la même photo générique "poke".
  'poke bowl saumon': U('1604259596863-57153177d40b'),
  'poke bowl thon': U('1597958792579-bd3517df6399'),
  'poke bowl crevettes': U('1780805663576-48cdd496138d'),
  'poke bowl saumon avocat mangue': U('1780805663865-c9ab052da2e4'),
  // Fried Chicken : 4 burgers au poulet (Crispy/Spicy/Double Crispy/Hot Honey) retombaient sur la
  // photo générique "burger" (bœuf) au lieu d'un vrai burger au poulet.
  'burger chicken crispy': U('1607013251379-e6eecfffe234'),
  'burger spicy chicken': U('1705131186176-1c7cdb830815'),
  'burger double crispy': U('1637710847214-f91d99669e18'),
  'burger chicken hot honey': U('1609167830240-fc81e9cfd9bf'),
  // Thaïlandais : "Curry massaman agneau" partageait la même photo de soupe verte que "Curry vert
  // poulet"/"Curry rouge bœuf" juste au-dessus.
  'curry massaman agneau': U('1560963859-6f618d786177'),

  // --- Friterie (nouveau type de resto, 2026-08) : chaque snack/frite/gaufre vérifié individuellement. ---
  'petite frites': U('1585109649139-366815a0d713'),
  'moyenne frites': U('1556710986-4a70434a76c0'),
  'grande frites': U('1541592106381-b31e9677c0e5'),
  'frites xxl': U('1605262157780-8910063b2bf9'),
  'frites fromage': U('1666304752980-678d5c35c911'),
  'frites sauce maison': U('1763208385612-fbbf89e4a5ed'),
  'boulet sauce lapin': U('1543353071-873f17a7a088'),
  'boulet sauce tomate': U('1716959669858-11d415bdead6'),
  'bitterballen (6 pcs)': U('1727303600939-b63d2ffc53d6'),
  'berlinerworst': U('1585325701165-351af916e581'),
  'saucisse de frankfort': U('1591989330748-777649e84466'),
  'kipcorn': U('1528826134410-fd8d3f21789d'),
  'curryworst': U('1682428617976-f25633ed8469'),
  'loempia': U('1679310290259-78d9eaa32700'),
  'frikandel spécial': U('1691480241974-92481cef09ff'),
  'gaufre de bruxelles': U('1639471045701-b11e96875a7e'),
  'gaufre de liège': U('1675194588436-9c76aa85795d'),

  // --- Coréen (nouveau type de resto, 2026-08) : chaque plat vérifié individuellement. ---
  'kimchi maison': U('1583224964978-2257b960c3d3'),
  "pajeon (galette d'oignons verts)": U('1650844010413-3f24dc1c182b'),
  'manduguk (soupe de raviolis)': U('1578861256505-d3be7cb037d3'),
  'mandu (raviolis, 6 pcs)': U('1638502338747-f7f368214cce'),
  'tteokbokki': U('1635363638580-c2809d049eee'),
  'bibimbap bœuf': U('1543353071-873f17a7a088'),
  'bibimbap végétarien': U('1600335895229-6e75511892c8'),
  'bibimbap poulet': U('1716959669858-11d415bdead6'),
  'bulgogi bœuf': U('1689832832238-7d04910c63d9'),
  'bulgogi poulet': U('1763219802762-1d34ee0907c5'),
  'poulet frit coréen (yangnyeom)': U('1742936401708-dd1b132f06db'),
  'poulet frit coréen (soy garlic)': U('1426869981800-95ebf51ce900'),
  'kimchi jjigae (ragoût de kimchi)': U('1682428617976-f25633ed8469'),
  'sundubu jjigae (tofu épicé)': U('1560963859-6f618d786177'),
  'japchae bœuf': U('1583032015879-e5022cb87c3b'),
  'galbi (côtes de bœuf marinées)': U('1532636875304-0c89119d9b4d'),
  'ramyun épicé': U('1619371042685-827b1c646923'),
  'poulet katsu coréen': U('1626645738196-c2a7c87a8f58'),
  'riz frit kimchi': U('1600688654899-379ec76aca42'),
  'bibim guksu (nouilles froides épicées)': U('1732988978816-ce0c78c79f4c'),
  'soondae (boudin coréen)': U('1743674453093-592bed88018e'),
  'bingsu (glace pilée)': U('1771209802058-3b40ce534905'),
  'hotteok (crêpe fourrée)': U('1570727624862-3008fe67a6be'),
  'mochi coréen': U('1541014741259-de529411b96a'),
  'patbingsu fruits': U('1659300823062-76c520cdc1a4'),
  'yakgwa (biscuit au miel)': U('1499636136210-6f4ee915583e'),
  'salade de concombre épicée': U('1597958792579-bd3517df6399'),
  'kimbap légumes (8 pcs)': U('1693082146027-2062d794f305'),
  'soju': U('1544145945-f90425340c7e'),
  'makgeolli': U('1550583724-b2692b85b150'),
  'sikhye (boisson de riz)': U('1621263764928-df1444c5e859'),
  'thé vert coréen': U('1573784540576-21ddeff9479b'),
  'thé aux graines grillées': U('1499638673689-79a0b5115d87'),
  'yuja tea (thé au citron coréen)': U('1601390395693-364c0e22031a'),

  // --- Marocain (nouveau type de resto, 2026-08) : chaque plat vérifié individuellement. ---
  'harira': U('1578861256505-d3be7cb037d3'),
  "zaalouk (caviar d'aubergines)": U('1650844010413-3f24dc1c182b'),
  'briouates viande (3 pcs)': U('1638502338747-f7f368214cce'),
  'briouates fromage (3 pcs)': U('1551638059-d1fb82606c4a'),
  'pastilla au poulet': U('1763219802762-1d34ee0907c5'),
  'tajine poulet citron confit': U('1682285843664-ea9b067c5831'),
  'tajine agneau pruneaux': U('1541518763669-27fef04b14ea'),
  'tajine bœuf abricots': U('1643019237176-8ae0859f1123'),
  'tajine kefta œufs': U('1608500218861-01091cdc501e'),
  'couscous royal': U('1661083098412-054431ab7112'),
  'couscous végétarien': U('1600335895229-6e75511892c8'),
  'couscous poulet': U('1716959669858-11d415bdead6'),
  "méchoui d'agneau": U('1532636875304-0c89119d9b4d'),
  'brochettes kefta': U('1719282431565-3b30bb7d2658'),
  'brochettes poulet': U('1743674453093-592bed88018e'),
  'brochettes agneau': U('1529006557810-274b9b2fc783'),
  'rfissa': U('1512621776951-a57141f2eefd'),
  'chorba': U('1543339308-43e59d6b73a6'),
  'msemen fourré': U('1633205772834-c0b9943c5a54'),
  'tanjia': U('1682428617976-f25633ed8469'),
  'poulet aux olives': U('1543353071-873f17a7a088'),
  'cornes de gazelle (4 pcs)': U('1588066455450-a7cb853c7892'),
  'chebakia': U('1499636136210-6f4ee915583e'),
  'baklava marocain': U('1643910509872-78bc24a2bc53'),
  'sellou': U('1517427294546-5aa121f68e8a'),
  "salade d'oranges à la cannelle": U('1519996529931-28324d5a630e'),
  'salade marocaine': U('1682370207954-c8a9cccaabb4'),
  'soupe de poisson à la marocaine': U('1641898378716-1f38ec04bb0f'),
  "jus d'avocat": U('1622597467821-df79dcb4f94d'),
  'jus de fraise': U('1619158403521-ed9795026d47'),
  'limonade marocaine': U('1621263764928-df1444c5e859'),
  'lben (lait fermenté)': U('1550583724-b2692b85b150'),

  // --- Bubble Tea (nouveau type de resto, 2026-08) : 13 parfums de bubble tea répartis sur 4 photos
  // distinctes — re-signalé 2026-08 : chacun des 14 parfums a maintenant sa propre photo vérifiée
  // (aucun partage), certains via une vraie photo du fruit plutôt qu'une tasse quand aucune photo de
  // gobelet suffisamment distincte n'a été trouvée (lychee, coco, melon). ---
  'bubble tea taro': U('1774979300628-12e379acea7b'),
  'bubble tea matcha': U('1717603545586-208c9d67fcbe'),
  'bubble tea thé noir classique': U('1639927663411-35f23bb792b7'),
  'bubble tea thé vert': U('1599536837271-f3e08bd0fac5'),
  'bubble tea fraise': U('1622268348720-507f204d29b4'),
  'bubble tea mangue': U('1747016861831-ed2903bccb69'),
  'bubble tea passion': U('1723742479315-bb20d13225dd'),
  'bubble tea lychee': U('1597975371270-cf80e4f54921'),
  'bubble tea chocolat': U('1525803377221-4f6ccdaa5133'),
  'bubble tea caramel': U('1662047102608-a6f2e492411f'),
  'bubble tea brown sugar': U('1756132541105-3e16e8ea0697'),
  'bubble tea coco': U('1597636319015-1fce74db8798'),
  'bubble tea melon': U('1773487742962-987ec2f20bad'),
  'bubble tea myrtille': U('1575159249868-df58bf5e09ec'),
  'nems végétariens (3 pcs)': U('1679310290259-78d9eaa32700'),
  'beignets de crevettes (4 pcs)': U('1579887829114-282b4fa31072'),
  'chips crevettes': U('1599490659213-e2b9527bd087'),
  'mochi glacé (3 pcs)': U('1541014741259-de529411b96a'),
  'takoyaki (5 pcs)': U('1571066811602-716837d681de'),
  'bao bun poulet': U('1675096000167-4b8a276b6187'),
  'bao bun porc': U('1609183480237-ccbb2d7c5772'),
  'bowl de riz teriyaki': U('1543353071-873f17a7a088'),
  'wrap teriyaki poulet': U('1752095809096-f09d22c466c5'),
  'mochi assortiment (6 pcs)': U('1572837663132-76c0ccd9cb6f'),
  'waffle taiyaki': U('1488477181946-6428a0291777'),
  'crêpe glacée': U('1515467837915-15c4777ba46a'),
  'gaufre bubble waffle': U('1562376552-0d160a2f238d'),
  'milk tea classique': U('1550583724-b2692b85b150'),
  'thai milk tea': U('1509042239860-f550ce710b93'),
  'fruit tea pêche': U('1573784540576-21ddeff9479b'),
  'fruit tea mangue-passion': U('1600271886742-f049cd451bba'),
  'smoothie taro': U('1610970881699-44a5587cabec'),
  'smoothie mangue': U('1619158403521-ed9795026d47'),
  'slush fraise': U('1544145945-f90425340c7e'),
  'slush myrtille': U('1621330716555-5cad596c4562'),
  'thé glacé jasmin': U('1499638673689-79a0b5115d87'),
  'thé glacé oolong': U('1601390395693-364c0e22031a'),

  // --- Ramen (nouveau type de resto, 2026-08) : chaque plat vérifié individuellement. ---
  'gyoza poulet (6 pcs)': U('1638502338747-f7f368214cce'),
  'gyoza légumes (6 pcs)': U('1551638059-d1fb82606c4a'),
  'karaage (poulet frit japonais)': U('1742936401708-dd1b132f06db'),
  'takoyaki (6 pcs)': U('1571066811602-716837d681de'),
  'salade wakame': U('1600335895229-6e75511892c8'),
  'soupe miso': U('1578861256505-d3be7cb037d3'),
  'tempura crevettes (4 pcs)': U('1579887829114-282b4fa31072'),
  'tempura légumes': U('1650844010413-3f24dc1c182b'),
  'ramen shoyu poulet': U('1526318896980-cf78c088247c'),
  'ramen miso porc': U('1638866281450-3933540af86a'),
  'ramen tonkotsu': U('1772217261042-0175d0b2fcb0'),
  'ramen shoyu végétarien': U('1569718212165-3a8278d5f624'),
  'ramen curry japonais': U('1560963859-6f618d786177'),
  'udon bœuf': U('1631709497146-a239ef373cf1'),
  'udon légumes': U('1555126634-323283e090fa'),
  'yakisoba poulet': U('1619371042685-827b1c646923'),
  'yakisoba bœuf': U('1732988978816-ce0c78c79f4c'),
  'katsu curry poulet': U('1569050467447-ce54b3bbc37d'),
  'katsu curry porc': U('1723208841184-3d91ba244c60'),
  'donburi saumon': U('1543353071-873f17a7a088'),
  'donburi bœuf teriyaki': U('1682428617976-f25633ed8469'),
  'onigiri saumon (2 pcs)': U('1633053408159-1f54f4978ff9'),
  'onigiri thon mayo (2 pcs)': U('1562158074-d16650a22f83'),
  'chirashi don': U('1553621042-f6e147245754'),
  'riz au curry japonais': U('1426869981800-95ebf51ce900'),
  'dorayaki': U('1602351447937-745cb720612f'),
  'cheesecake matcha': U('1533134242443-d4fd215305ad'),
  'purin (flan japonais)': U('1673551490812-eaee2e9bf0ef'),
  'taiyaki': U('1488477181946-6428a0291777'),
  'thé vert japonais': U('1573784540576-21ddeff9479b'),
  'ramune (soda japonais)': U('1624517452488-04869289c4ca'),
  'saké chaud': U('1664477407933-dd42ed0c6c62'),
  'saké froid': U('1544145945-f90425340c7e'),
  'thé oolong glacé': U('1601390395693-364c0e22031a'),
  'calpis': U('1550583724-b2692b85b150'),

  // --- Kebab & Grill : re-signalé 2026-08, jusqu'à 5 formats/protéines différents partageaient la
  // même photo au sein d'un même menu (ex. Dürüm/Pita/Mitraillette/Assiette "mixte" ×5). Chaque plat a
  // maintenant sa propre photo vérifiée, y compris les variantes de taille/quantité (Petite/Grande
  // frite, Bucket 12/20 pcs) — plus aucune photo n'est partagée entre deux plats différents. ---
  'petite frite': U('1615485290836-4ebcebf44aaf'),
  'grande frite': U('1630431341973-02e1b662ec35'),
  'boulet': U('1760304396110-8dc2b644fd05'),
  'bucket poulet 12 pcs': U('1742936401708-dd1b132f06db'),
  'bucket poulet 20 pcs': U('1426869981800-95ebf51ce900'),
  'portion falafel (6 pcs)': U('1701688596783-231b3764ef67'),
  'dürüm poulet': U('1631021967255-898a52176fea'),
  'dürüm kebab (agneau/veau)': U('1760888548893-bc2f7e09e972'),
  'dürüm mixte': U('1664455248787-bed872761fa2'),
  'dürüm adana': U('1653983194833-7a10838b12f4'),
  'dürüm falafel': U('1719282666354-38af51d0ba24'),
  'pita poulet': U('1734974121561-11aee7d3cebd'),
  'pita kebab': U('1745126009946-1b35b1a16fec'),
  'pita mixte': U('1633321702518-7feccafb94d5'),
  'pita falafel': U('1699728088614-7d1d4277414b'),
  'mitraillette fricadelle': U('1702119614788-bae35a7be313'),
  'mitraillette poulet': U('1511421585906-57a6e6dc3a2f'),
  'mitraillette kebab': U('1753798130695-3c060be80e83'),
  'mitraillette boulette': U('1699728088621-38d201c24ac3'),
  'mitraillette hamburger': U('1719282431723-9d0f4370d4bc'),
  'mitraillette mixte': U('1676471980189-08de3e001215'),
  'assiette poulet': U('1781728000201-148498667cc8'),
  'assiette kebab': U('1710913585547-3fc546b6ddd0'),
  'assiette adana': U('1773620494047-50cb58f59bc5'),
  'assiette köfte': U('1644364935906-792b2245a2c0'),
  'assiette brochette poulet': U('1729370146699-d552925ab445'),
  'assiette mixte': U('1719282431565-3b30bb7d2658'),
  'assiette falafel': U('1786174045057-89e6449f47d9'),
  'tacos m (1 viande)': U('1621334953222-c60c19143b0a'),
  'tacos l (2 viandes)': U('1621334953333-ba703fcb434d'),
  'tacos xl (3 viandes)': U('1626700051175-6818013e1d4f'),
  'menu tacos m + boisson (11h30-15h)': U('1613319300832-a105da5bd34e'),
  'menu dürüm + frites + boisson (11h30-15h)': U('1580121676785-ea9ca33e3fb2'),
  'menu pita + frites + boisson (11h30-15h)': U('1743674453093-592bed88018e'),
  'burger poulet crispy': U('1609167830240-fc81e9cfd9bf')
};

// Choix stable (pas aléatoire) d'une photo dans un pool `images`, basé sur le nom du plat — deux plats
// différents dans le même groupe générique (ex: "kebab"/"durum") affichent donc des photos différentes,
// mais un même nom de plat garde toujours la même photo (y compris d'un resto à l'autre, comportement voulu).
// Le multiplicateur 31 seul dégénère en simple somme de caractères pour un modulo comme 3 (31 % 3 === 1),
// ce qui donnait une très mauvaise répartition sur les petits pools — l'étape de mixage final (type
// Murmur) corrige cette dégénérescence.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function defaultItemImage(item) {
  const name = (item?.name || '').toLowerCase().trim();
  if (ITEM_IMAGE_OVERRIDES[name]) return ITEM_IMAGE_OVERRIDES[name];
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) {
      if (entry.images) return entry.images[hashSeed(name) % entry.images.length];
      return entry.image;
    }
  }
  // categoryImage() ci-dessus renvoie toujours une image non vide désormais (dernier repli sur
  // 'plat') — jamais de <img src=""> cassée, même pour un plat importé sans mot-clé reconnu.
  return categoryImage(item?.category);
}
