export const CATEGORIES = [
  { value: 'entree', label: 'Entrées', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=200&q=80' },
  { value: 'plat', label: 'Plats', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80' },
  { value: 'dessert', label: 'Desserts', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&q=80' },
  { value: 'boisson', label: 'Boissons', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&q=80' }
];

export function categoryLabel(value, t) {
  if (t) return t(`menuCategories.category.${value}`);
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function categoryImage(value) {
  return CATEGORIES.find((c) => c.value === value)?.image || '';
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
  { value: 'Fried Chicken', emoji: '🍗' },
  { value: 'Coffee Shop', emoji: '☕' },
  { value: 'Boulangerie', emoji: '🥐' },
  { value: 'Boucherie', emoji: '🥩' },
  { value: 'Supermarché', emoji: '🛒' },
  { value: 'Night Shop', emoji: '🌙' },
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
  Burgers: {
    plat: [
      { name: 'Classic Cheeseburger', price: 9.9, desc: '' },
      { name: 'Double Cheeseburger', price: 12.9, desc: '' },
      { name: 'Bacon Burger', price: 12.5, desc: '' },
      { name: 'BBQ Bacon Burger', price: 13.5, desc: '' },
      { name: 'Crispy Chicken Burger', price: 11.5, desc: '' },
      { name: 'Spicy Chicken Burger', price: 11.9, desc: '' },
      { name: 'Avocado Chicken Burger', price: 12.9, desc: '' },
      { name: 'Blue Cheese Burger', price: 13.5, desc: '' },
      { name: 'Truffle Burger', price: 14.9, desc: '' },
      { name: 'Veggie Burger', price: 10.9, desc: '' },
      { name: 'Double Smash Burger', price: 13.9, desc: '' },
      { name: 'Oklahoma Onion Burger', price: 12.5, desc: '' }
    ],
    entree: [
      { name: 'French Fries', price: 3.5, desc: '' },
      { name: 'Sweet Potato Fries', price: 4.5, desc: '' },
      { name: 'Loaded Cheese Fries', price: 6.5, desc: '' },
      { name: 'Bacon & Cheese Fries', price: 7, desc: '' },
      { name: 'Onion Rings', price: 4.5, desc: '' },
      { name: 'Chicken Nuggets', price: 6.5, desc: '' },
      { name: 'Chicken Wings', price: 7.9, desc: '' },
      { name: 'Coleslaw', price: 3.5, desc: '' }
    ],
    dessert: [
      { name: 'Chocolate Brownie', price: 4.5, desc: '' },
      { name: 'New York Cheesecake', price: 5.5, desc: '' },
      { name: 'Chocolate Chip Cookie', price: 3, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Fanta', price: 2.8, desc: '' },
      { name: 'Homemade Lemonade', price: 4, desc: '' },
      { name: 'Root Beer', price: 3.2, desc: '' },
      { name: 'Oreo Milkshake', price: 5.9, desc: '' },
      { name: 'Vanilla Milkshake', price: 5.5, desc: '' },
      { name: 'Iced Tea', price: 3, desc: '' }
    ]
  },
  Pizza: {
    plat: [
      { name: 'Margherita', price: 10.5, desc: '' },
      { name: 'Marinara', price: 9.5, desc: '' },
      { name: 'Prosciutto', price: 12.5, desc: '' },
      { name: 'Prosciutto e Funghi', price: 13.5, desc: '' },
      { name: 'Diavola', price: 13.5, desc: '' },
      { name: 'Quattro Formaggi', price: 14, desc: '' },
      { name: 'Quattro Stagioni', price: 14.5, desc: '' },
      { name: 'Capricciosa', price: 14.5, desc: '' },
      { name: 'Parma', price: 15.5, desc: '' },
      { name: 'Burrata (pizza)', price: 15.9, desc: '' },
      { name: 'Tartufata', price: 16.5, desc: '' },
      { name: 'Vegetariana', price: 13.5, desc: '' },
      { name: 'Napoli', price: 12.9, desc: '' },
      { name: 'Calzone', price: 14.5, desc: '' },
      { name: 'Mortadella & Pistacchio', price: 16.5, desc: '' }
    ],
    entree: [
      { name: 'Focaccia', price: 5.5, desc: '' },
      { name: 'Garlic Bread', price: 5, desc: '' },
      { name: 'Burrata', price: 8.9, desc: '' },
      { name: 'Bruschetta al Pomodoro', price: 7.5, desc: '' },
      { name: 'Antipasti Italiani', price: 11.9, desc: '' },
      { name: 'Arancini', price: 7.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisù', price: 6.5, desc: '' },
      { name: 'Panna Cotta', price: 6, desc: '' },
      { name: 'Cannoli Siciliani', price: 6.5, desc: '' },
      { name: 'Torta al Cioccolato', price: 6.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'San Pellegrino', price: 3, desc: '' },
      { name: 'Acqua Panna', price: 3, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Aranciata San Pellegrino', price: 3.5, desc: '' },
      { name: 'Limonata San Pellegrino', price: 3.5, desc: '' },
      { name: 'Italian Lemon Iced Tea', price: 3.5, desc: '' },
      { name: 'Peach Iced Tea', price: 3.5, desc: '' },
      { name: 'Chinotto', price: 3, desc: '' }
    ]
  },
  Asiatique: {
    entree: [
      { name: 'Vegetable Spring Rolls', price: 5.5, desc: '' },
      { name: 'Chicken Spring Rolls', price: 6, desc: '' },
      { name: 'Chicken Gyoza', price: 6.5, desc: '' },
      { name: 'Vegetable Gyoza', price: 6, desc: '' },
      { name: 'Shrimp Tempura', price: 8.5, desc: '' },
      { name: 'Edamame', price: 5, desc: '' },
      { name: 'Spicy Edamame', price: 5.5, desc: '' },
      { name: 'Chicken Satay', price: 7.5, desc: '' }
    ],
    plat: [
      { name: 'Chicken Pad Thai', price: 13.5, desc: '' },
      { name: 'Shrimp Pad Thai', price: 15, desc: '' },
      { name: 'Vegetable Pad Thai', price: 12.5, desc: '' },
      { name: 'Chicken Fried Rice', price: 12.9, desc: '' },
      { name: 'Beef Fried Rice', price: 13.9, desc: '' },
      { name: 'Vegetable Fried Rice', price: 11.9, desc: '' },
      { name: 'Chicken Teriyaki Noodles', price: 13.5, desc: '' },
      { name: 'Beef Teriyaki Noodles', price: 14.5, desc: '' },
      { name: 'Spicy Chicken Noodles', price: 13.9, desc: '' },
      { name: 'Singapore Noodles', price: 14.5, desc: '' },
      { name: 'Chicken Teriyaki', price: 14.5, desc: '' },
      { name: 'Beef Teriyaki', price: 15.5, desc: '' },
      { name: 'Sweet & Sour Chicken', price: 13.9, desc: '' },
      { name: 'Thai Green Curry Chicken', price: 14.5, desc: '' },
      { name: 'Thai Red Curry Beef', price: 15.5, desc: '' },
      { name: 'Vegetable Curry', price: 12.9, desc: '' }
    ],
    dessert: [
      { name: 'Mango Sticky Rice', price: 6.5, desc: '' },
      { name: 'Mochi Ice Cream', price: 5.9, desc: '' },
      { name: 'Coconut Tapioca', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Japanese Green Tea', price: 3.5, desc: '' },
      { name: 'Lychee Drink', price: 3.5, desc: '' },
      { name: 'Mango Drink', price: 3.5, desc: '' },
      { name: 'Thai Iced Tea', price: 3.5, desc: '' },
      { name: 'Bubble Tea', price: 4.5, desc: '' }
    ]
  },
  Sushi: {
    plat: [
      { name: 'Salmon Nigiri ×2', price: 5.5, desc: '' },
      { name: 'Tuna Nigiri ×2', price: 6, desc: '' },
      { name: 'Avocado Maki ×6', price: 5, desc: '' },
      { name: 'Cucumber Maki ×6', price: 4.5, desc: '' },
      { name: 'Salmon Maki ×6', price: 5.5, desc: '' },
      { name: 'Tuna Maki ×6', price: 6, desc: '' },
      { name: 'California Roll ×8', price: 8.5, desc: '' },
      { name: 'Spicy Salmon Roll ×8', price: 9, desc: '' },
      { name: 'Spicy Tuna Roll ×8', price: 9.5, desc: '' },
      { name: 'Salmon Avocado Roll ×8', price: 9, desc: '' },
      { name: 'Crispy Chicken Roll ×8', price: 9.5, desc: '' },
      { name: 'Shrimp Tempura Roll ×8', price: 10.5, desc: '' },
      { name: 'Salmon Box', price: 17.9, desc: '' },
      { name: 'California Box', price: 18.9, desc: '' },
      { name: 'Sushi Mix', price: 21.9, desc: '' },
      { name: 'Salmon Lovers', price: 23.9, desc: '' },
      { name: 'Sushi Deluxe', price: 27.5, desc: '' },
      { name: 'Veggie Box', price: 16.5, desc: '' }
    ],
    entree: [
      { name: 'Edamame', price: 5, desc: '' },
      { name: 'Gyoza Chicken', price: 6.5, desc: '' },
      { name: 'Gyoza Vegetable', price: 6, desc: '' },
      { name: 'Wakame Salad', price: 5.5, desc: '' },
      { name: 'Miso Soup', price: 4.5, desc: '' },
      { name: 'Shrimp Tempura', price: 8.5, desc: '' }
    ],
    dessert: [
      { name: 'Mochi Mango', price: 5.5, desc: '' },
      { name: 'Mochi Coconut', price: 5.5, desc: '' },
      { name: 'Matcha Cheesecake', price: 6.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Ramune Original', price: 3.9, desc: '' },
      { name: 'Ramune Lychee', price: 3.9, desc: '' },
      { name: 'Japanese Green Tea', price: 3.5, desc: '' },
      { name: 'Matcha Latte', price: 4, desc: '' },
      { name: 'Bubble Tea', price: 4.5, desc: '' }
    ]
  },
  Mexicain: {
    plat: [
      { name: 'Chicken Burrito', price: 12.5, desc: '' },
      { name: 'Beef Burrito', price: 13.5, desc: '' },
      { name: 'Pulled Pork Burrito', price: 13.5, desc: '' },
      { name: 'Spicy Chicken Burrito', price: 12.9, desc: '' },
      { name: 'Veggie Burrito', price: 11.5, desc: '' },
      { name: 'Vegan Burrito', price: 11.9, desc: '' },
      { name: 'Chicken Tacos ×3', price: 11.5, desc: '' },
      { name: 'Beef Tacos ×3', price: 12.5, desc: '' },
      { name: 'Pulled Pork Tacos ×3', price: 12.5, desc: '' },
      { name: 'Shrimp Tacos ×3', price: 14, desc: '' },
      { name: 'Veggie Tacos ×3', price: 10.9, desc: '' },
      { name: 'Chicken Burrito Bowl', price: 12.5, desc: '' },
      { name: 'Beef Burrito Bowl', price: 13.5, desc: '' },
      { name: 'Vegan Bowl', price: 11.9, desc: '' },
      { name: 'Spicy Shrimp Bowl', price: 14.5, desc: '' }
    ],
    entree: [
      { name: 'Nachos', price: 5.5, desc: '' },
      { name: 'Nachos & Guacamole', price: 7.5, desc: '' },
      { name: 'Loaded Nachos', price: 9.5, desc: '' },
      { name: 'Guacamole & Tortilla Chips', price: 6.5, desc: '' },
      { name: 'Mexican Rice', price: 4, desc: '' },
      { name: 'Black Beans', price: 4, desc: '' },
      { name: 'Quesadilla Chicken', price: 8.5, desc: '' },
      { name: 'Quesadilla Cheese', price: 7, desc: '' }
    ],
    dessert: [
      { name: 'Churros', price: 5.5, desc: '' },
      { name: 'Churros & Chocolate', price: 6.5, desc: '' },
      { name: 'Tres Leches Cake', price: 6, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Jarritos Lime', price: 3.9, desc: '' },
      { name: 'Jarritos Mango', price: 3.9, desc: '' },
      { name: 'Jarritos Guava', price: 3.9, desc: '' },
      { name: 'Homemade Limeade', price: 4, desc: '' },
      { name: 'Horchata', price: 4, desc: '' }
    ]
  },
  Libanais: {
    entree: [
      { name: 'Hummus', price: 6.5, desc: '' },
      { name: 'Hummus Beiruti', price: 7, desc: '' },
      { name: 'Moutabal', price: 6.5, desc: '' },
      { name: 'Baba Ganoush', price: 7, desc: '' },
      { name: 'Labneh', price: 6, desc: '' },
      { name: 'Tabbouleh', price: 7.5, desc: '' },
      { name: 'Fattoush', price: 7.5, desc: '' },
      { name: 'Falafel ×4', price: 6.5, desc: '' },
      { name: 'Kebbeh ×3', price: 7.5, desc: '' },
      { name: 'Halloumi Grillé', price: 8, desc: '' }
    ],
    plat: [
      { name: 'Chicken Shawarma', price: 9.5, desc: '' },
      { name: 'Beef Shawarma', price: 10.5, desc: '' },
      { name: 'Falafel Wrap', price: 8.5, desc: '' },
      { name: 'Halloumi Wrap', price: 9.5, desc: '' },
      { name: 'Kafta Wrap', price: 10, desc: '' },
      { name: 'Chicken Shawarma Plate', price: 15.5, desc: '' },
      { name: 'Beef Shawarma Plate', price: 16.5, desc: '' },
      { name: 'Mixed Grill', price: 19.5, desc: '' },
      { name: 'Kafta Plate', price: 16, desc: '' },
      { name: 'Falafel Plate', price: 13.5, desc: '' },
      { name: 'Vegetarian Mezze', price: 17.5, desc: '' },
      { name: 'Mixed Mezze', price: 19.5, desc: '' }
    ],
    dessert: [
      { name: 'Baklava', price: 5.5, desc: '' },
      { name: 'Mouhalabieh', price: 5.5, desc: '' },
      { name: 'Lebanese Kunafa', price: 6.5, desc: '' },
      { name: 'Dates & Nuts', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Ayran', price: 3, desc: '' },
      { name: 'Homemade Lemon Mint', price: 4.5, desc: '' },
      { name: 'Thé à la menthe', price: 2.8, desc: '' },
      { name: 'Jallab', price: 4, desc: '' },
      { name: 'Tamarind Juice', price: 4, desc: '' }
    ]
  },
  Healthy: {
    plat: [
      { name: 'Salmon Poke', price: 14.5, desc: '' },
      { name: 'Spicy Salmon Poke', price: 15, desc: '' },
      { name: 'Tuna Poke', price: 15.5, desc: '' },
      { name: 'Spicy Tuna Poke', price: 16, desc: '' },
      { name: 'Teriyaki Chicken Poke', price: 13.5, desc: '' },
      { name: 'Crispy Chicken Poke', price: 13.9, desc: '' },
      { name: 'Shrimp Poke', price: 14.9, desc: '' },
      { name: 'Tofu Poke', price: 12.5, desc: '' },
      { name: 'Vegan Poke', price: 12.5, desc: '' },
      { name: 'Build Your Own Poke', price: 13.5, desc: '' },
      { name: 'Caesar Chicken Bowl', price: 13.5, desc: '' },
      { name: 'Mediterranean Bowl', price: 12.9, desc: '' },
      { name: 'Avocado Quinoa Bowl', price: 12.5, desc: '' },
      { name: 'Protein Chicken Bowl', price: 14.5, desc: '' },
      { name: 'Falafel Bowl', price: 12.9, desc: '' }
    ],
    entree: [
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Avocado Side', price: 3.5, desc: '' },
      { name: 'Wakame', price: 4.5, desc: '' },
      { name: 'Sweet Potato Fries', price: 4.5, desc: '' },
      { name: 'Miso Soup', price: 4, desc: '' },
      { name: 'Hummus & Veggies', price: 5.5, desc: '' }
    ],
    dessert: [
      { name: 'Açai Bowl', price: 7.5, desc: '' },
      { name: 'Chia Pudding', price: 5.5, desc: '' },
      { name: 'Banana Bread', price: 4.5, desc: '' },
      { name: 'Protein Chocolate Brownie', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Ginger Shot', price: 3, desc: '' },
      { name: 'Green Smoothie', price: 5.5, desc: '' },
      { name: 'Mango Smoothie', price: 5.5, desc: '' },
      { name: 'Kombucha', price: 4.5, desc: '' },
      { name: 'Coconut Water', price: 3.9, desc: '' }
    ]
  },
  Italien: {
    plat: [
      { name: 'Spaghetti Carbonara', price: 13.5, desc: '' },
      { name: 'Spaghetti Bolognese', price: 13.5, desc: '' },
      { name: 'Penne Arrabbiata', price: 12, desc: '' },
      { name: 'Penne Amatriciana', price: 13, desc: '' },
      { name: 'Tagliatelle al Ragù', price: 14.5, desc: '' },
      { name: 'Linguine Pesto', price: 13, desc: '' },
      { name: 'Linguine Gamberi', price: 16.5, desc: '' },
      { name: 'Truffle Tagliatelle', price: 17.5, desc: '' },
      { name: 'Rigatoni alla Vodka', price: 14.5, desc: '' },
      { name: 'Lasagna Bolognese', price: 14.5, desc: '' },
      { name: 'Gnocchi Gorgonzola', price: 14, desc: '' },
      { name: 'Ravioli Ricotta & Spinach', price: 15, desc: '' }
    ],
    entree: [
      { name: 'Burrata', price: 8.9, desc: '' },
      { name: 'Bruschetta', price: 7, desc: '' },
      { name: 'Focaccia', price: 5.5, desc: '' },
      { name: 'Carpaccio', price: 11.5, desc: '' },
      { name: 'Arancini', price: 7.5, desc: '' },
      { name: 'Caprese', price: 8.5, desc: '' },
      { name: 'Antipasti', price: 12.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisù Classico', price: 6.5, desc: '' },
      { name: 'Tiramisù Pistachio', price: 7, desc: '' },
      { name: 'Panna Cotta', price: 6, desc: '' },
      { name: 'Cannoli', price: 6.5, desc: '' },
      { name: 'Chocolate Fondant', price: 6.5, desc: '' },
      { name: 'Lemon Cake', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'San Pellegrino', price: 3, desc: '' },
      { name: 'Acqua Panna', price: 3, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Limonata', price: 3.5, desc: '' },
      { name: 'Aranciata', price: 3.5, desc: '' },
      { name: 'Peach Iced Tea', price: 3.5, desc: '' },
      { name: 'Chinotto', price: 3, desc: '' },
      { name: 'Espresso', price: 2, desc: '' }
    ]
  },
  'Fried Chicken': {
    plat: [
      { name: '3 Crispy Tenders', price: 7.5, desc: '' },
      { name: '5 Crispy Tenders', price: 10.5, desc: '' },
      { name: '8 Crispy Tenders', price: 14.5, desc: '' },
      { name: '6 Hot Wings', price: 8.5, desc: '' },
      { name: '10 Hot Wings', price: 12.5, desc: '' },
      { name: '15 Hot Wings', price: 17.5, desc: '' },
      { name: 'Original Chicken Burger', price: 10.5, desc: '' },
      { name: 'Spicy Chicken Burger', price: 11, desc: '' },
      { name: 'Honey BBQ Chicken Burger', price: 11.5, desc: '' },
      { name: 'Double Chicken Burger', price: 13.5, desc: '' },
      { name: 'Chicken Burger Menu', price: 14.5, desc: '' },
      { name: 'Spicy Burger Menu', price: 15, desc: '' },
      { name: '5 Tenders Menu', price: 14.5, desc: '' },
      { name: '8 Wings Menu', price: 14.5, desc: '' },
      { name: 'Chicken Bucket', price: 22.9, desc: '' }
    ],
    entree: [
      { name: 'French Fries', price: 3.5, desc: '' },
      { name: 'Cajun Fries', price: 4, desc: '' },
      { name: 'Sweet Potato Fries', price: 4.5, desc: '' },
      { name: 'Mac & Cheese', price: 5, desc: '' },
      { name: 'Coleslaw', price: 3.5, desc: '' },
      { name: 'Onion Rings', price: 4.5, desc: '' },
      { name: 'Corn on the Cob', price: 3.5, desc: '' }
    ],
    dessert: [
      { name: 'Chocolate Brownie', price: 4.5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Cheesecake', price: 5.5, desc: '' },
      { name: 'Churros', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Fanta', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Homemade Iced Tea', price: 3.5, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Root Beer', price: 3.2, desc: '' },
      { name: 'Vanilla Milkshake', price: 5.5, desc: '' },
      { name: 'Homemade Lemonade', price: 4, desc: '' }
    ]
  },
  Belge: {
    entree: [
      { name: 'Petite Frite', price: 3, desc: '' },
      { name: 'Grande Frite', price: 4, desc: '' },
      { name: 'Frites Cheddar', price: 5.5, desc: '' },
      { name: 'Frites Cheddar Bacon', price: 6.5, desc: '' },
      { name: 'Frites Sauce Andalouse & Oignons', price: 5, desc: '' },
      { name: 'Mayonnaise', price: 1, desc: '' },
      { name: 'Andalouse', price: 1, desc: '' },
      { name: 'Samouraï', price: 1, desc: '' },
      { name: 'Brazil', price: 1, desc: '' },
      { name: 'Tartare', price: 1, desc: '' },
      { name: 'Ketchup', price: 1, desc: '' }
    ],
    plat: [
      { name: 'Fricadelle', price: 3, desc: '' },
      { name: 'Fricadelle Spéciale', price: 4, desc: '' },
      { name: 'Mexicano', price: 3.5, desc: '' },
      { name: 'Poulycroc', price: 3.5, desc: '' },
      { name: 'Viandelle', price: 3.5, desc: '' },
      { name: 'Boulette', price: 3.5, desc: '' },
      { name: 'Croquette de fromage', price: 3, desc: '' },
      { name: 'Croquette de crevettes', price: 5, desc: '' },
      { name: 'Nuggets ×6', price: 5.5, desc: '' },
      { name: 'Hamburger', price: 6.5, desc: '' },
      { name: 'Cheeseburger', price: 7, desc: '' },
      { name: 'Bacon Cheeseburger', price: 8, desc: '' },
      { name: 'Double Cheeseburger', price: 9.5, desc: '' },
      { name: 'Chicken Burger', price: 7.5, desc: '' },
      { name: 'Bicky Burger', price: 6.5, desc: '' }
    ],
    dessert: [
      { name: 'Gaufre de Liège', price: 4, desc: '' },
      { name: 'Mousse au chocolat', price: 4.5, desc: '' },
      { name: 'Tarte au sucre', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2.2, desc: '' },
      { name: 'Spa Reine', price: 2.2, desc: '' },
      { name: 'Fanta', price: 2.5, desc: '' },
      { name: 'Ice Tea', price: 2.5, desc: '' },
      { name: 'Bière Jupiler', price: 3, desc: '' },
      { name: 'Vin rouge', price: 5, desc: '' },
      { name: 'Chocolat chaud', price: 3, desc: '' }
    ]
  },
  'Végétarien': {
    entree: [
      { name: 'Houmous & pain pita', price: 5.5, desc: '' },
      { name: 'Soupe miso vegan', price: 4.5, desc: '' },
      { name: 'Rouleaux de printemps tofu', price: 5, desc: '' },
      { name: 'Chips de patate douce', price: 4, desc: '' },
      { name: 'Salade de betteraves', price: 5, desc: '' },
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Bruschetta tomate-basilic', price: 5, desc: '' },
      { name: 'Nems tofu croustillant', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Curry de légumes', price: 10.5, desc: '' },
      { name: 'Falafel bowl', price: 10, desc: '' },
      { name: 'Burger végétarien', price: 11, desc: '' },
      { name: 'Curry de pois chiches', price: 10, desc: '' },
      { name: 'Risotto champignons vegan', price: 11.5, desc: '' },
      { name: 'Buddha bowl vegan', price: 11, desc: '' },
      { name: 'Wrap houmous légumes', price: 8.5, desc: '' },
      { name: 'Chili sin carne', price: 10, desc: '' },
      { name: 'Pâtes vegan au pesto', price: 10.5, desc: '' },
      { name: 'Lasagne végétarienne', price: 11.5, desc: '' },
      { name: 'Galettes de quinoa', price: 10, desc: '' },
      { name: 'Curry vert thaï vegan', price: 11, desc: '' },
      { name: 'Menu Burger Végétarien (frites & boisson)', price: 14.5, desc: '' },
      { name: 'Menu Falafel Wrap (frites & boisson)', price: 13.5, desc: '' }
    ],
    dessert: [
      { name: 'Brownie vegan', price: 4.5, desc: '' },
      { name: 'Cookie vegan', price: 3, desc: '' },
      { name: 'Cheesecake vegan citron', price: 5, desc: '' },
      { name: 'Muffin vegan', price: 3.5, desc: '' },
      { name: 'Tarte crumble pommes vegan', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Eau pétillante 50cl', price: 2, desc: '' },
      { name: 'Jus pressé pomme', price: 4, desc: '' },
      { name: 'Lait d\'amande chaud', price: 3.5, desc: '' },
      { name: 'Kombucha', price: 4, desc: '' },
      { name: 'Jus vert détox', price: 4.5, desc: '' },
      { name: 'Smoothie mangue', price: 5, desc: '' }
    ]
  },
  'Kebab & Grill': {
    entree: [
      { name: 'Frites maison', price: 4, desc: '' },
      { name: 'Falafel (6 pièces)', price: 5, desc: '' },
      { name: 'Böreks fromage (3pcs)', price: 5.5, desc: '' },
      { name: 'Houmous & pita', price: 5, desc: '' },
      { name: 'Taboulé', price: 4.5, desc: '' },
      { name: 'Salade turque', price: 5, desc: '' },
      { name: 'Cigares au fromage (5pcs)', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Kebab poulet', price: 8.5, desc: '' },
      { name: 'Assiette mixte grillades', price: 13, desc: '' },
      { name: 'Chawarma bœuf', price: 9, desc: '' },
      { name: 'Iskender kebab', price: 13, desc: '' },
      { name: 'Adana kebab', price: 12.5, desc: '' },
      { name: 'Lahmacun', price: 6, desc: '' },
      { name: 'Pide au fromage', price: 9, desc: '' },
      { name: 'Shish taouk', price: 11.5, desc: '' },
      { name: 'Durum végétarien', price: 8, desc: '' },
      { name: 'Durum poulet', price: 9, desc: '' },
      { name: 'Beyti kebab', price: 12, desc: '' },
      { name: 'Kofte grillé', price: 10.5, desc: '' },
      { name: 'Menu Kebab Poulet (frites & boisson)', price: 12.5, desc: '' },
      { name: 'Menu Durum Bœuf (frites & boisson)', price: 13, desc: '' },
      { name: 'Menu Mixed Grill (frites & boisson)', price: 17, desc: '' },
      { name: 'Menu Adana (frites & boisson)', price: 16, desc: '' }
    ],
    dessert: [
      { name: 'Baklava (2 pièces)', price: 3.5, desc: '' },
      { name: 'Künefe', price: 5.5, desc: '' },
      { name: 'Loukoum assortiment', price: 3.5, desc: '' },
      { name: 'Sütlaç (riz au lait turc)', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Coca-Cola Zero', price: 3, desc: '' },
      { name: 'Sprite', price: 3, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Eau pétillante 50cl', price: 2, desc: '' },
      { name: 'Ayran', price: 2.5, desc: '' },
      { name: 'Salgam', price: 3, desc: '' },
      { name: 'Thé turc', price: 2.5, desc: '' },
      { name: 'Citronnade', price: 3.5, desc: '' },
      { name: 'Boza', price: 3.5, desc: '' }
    ]
  },
  'Coffee Shop': {
    entree: [
      { name: 'Granola Bowl', price: 5.5, desc: 'Yaourt, fruits frais, miel' },
      { name: 'Yaourt Grec & Miel', price: 4.5, desc: '' },
      { name: 'Salade de Fruits Frais', price: 4.8, desc: '' },
      { name: 'Energy Balls (3)', price: 3.5, desc: '' }
    ],
    plat: [
      { name: 'Avocado Toast', price: 7.5, desc: '' },
      { name: 'Bagel Saumon', price: 8.5, desc: '' },
      { name: 'Club Sandwich', price: 7.9, desc: '' },
      { name: 'Panini Poulet Pesto', price: 6.9, desc: '' },
      { name: 'Wrap Poulet Curry', price: 6.5, desc: '' },
      { name: 'Quiche du jour', price: 5.5, desc: '' }
    ],
    dessert: [
      { name: 'Croissant', price: 1.8, desc: '' },
      { name: 'Pain au chocolat', price: 1.9, desc: '' },
      { name: 'Muffin myrtille', price: 3.2, desc: '' },
      { name: 'Cookie pépites', price: 2.8, desc: '' },
      { name: 'Carrot Cake', price: 4.5, desc: '' },
      { name: 'New York Cheesecake', price: 4.8, desc: '' },
      { name: 'Cinnamon Roll', price: 3.9, desc: '' },
      { name: 'Banana Bread', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Espresso', price: 2.2, desc: '' },
      { name: 'Americano', price: 2.8, desc: '' },
      { name: 'Cappuccino', price: 3.5, desc: '' },
      { name: 'Café Latte', price: 3.8, desc: '' },
      { name: 'Flat White', price: 3.9, desc: '' },
      { name: 'Caramel Macchiato', price: 4.5, desc: '' },
      { name: 'Mocha', price: 4.5, desc: '' },
      { name: 'Cold Brew', price: 4.2, desc: '' },
      { name: 'Iced Latte', price: 4.2, desc: '' },
      { name: 'Matcha Latte', price: 4.5, desc: '' },
      { name: 'Iced Matcha Latte', price: 4.8, desc: '' },
      { name: 'Chai Latte', price: 4.2, desc: '' },
      { name: 'Thé Earl Grey', price: 2.8, desc: '' },
      { name: 'Chocolat chaud', price: 3.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2.2, desc: '' },
      { name: 'Eau pétillante 50cl', price: 2.2, desc: '' }
    ]
  },
  Boulangerie: {
    entree: [
      { name: 'Sandwich jambon-fromage', price: 4.5, desc: '' },
      { name: 'Sandwich poulet-crudités', price: 5, desc: '' },
      { name: 'Sandwich thon-crudités', price: 4.5, desc: '' },
      { name: 'Sandwich végétarien', price: 4.5, desc: '' },
      { name: 'Sandwich saumon-fromage frais', price: 5.5, desc: '' },
      { name: 'Wrap poulet curry', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Quiche lorraine', price: 4, desc: 'La part' },
      { name: 'Tarte salée aux légumes', price: 4, desc: 'La part' },
      { name: 'Quiche saumon-épinards', price: 4.2, desc: '' },
      { name: 'Croque-monsieur', price: 5, desc: '' },
      { name: 'Tarte flamiche', price: 4.2, desc: '' },
      { name: 'Panini poulet', price: 5, desc: '' },
      { name: 'Formule Sandwich + Boisson', price: 6.5, desc: '' },
      { name: 'Formule Quiche + Salade', price: 7.5, desc: '' }
    ],
    dessert: [
      { name: 'Croissant', price: 1.5, desc: '' },
      { name: 'Pain au chocolat', price: 1.6, desc: '' },
      { name: 'Éclair au chocolat', price: 3, desc: '' },
      { name: 'Pain aux raisins', price: 1.8, desc: '' },
      { name: 'Chausson aux pommes', price: 2.2, desc: '' },
      { name: 'Muffin myrtille', price: 2.8, desc: '' },
      { name: 'Cookie pépites', price: 2, desc: '' },
      { name: 'Financier amande', price: 2, desc: '' },
      { name: 'Cannelé', price: 2.2, desc: '' },
      { name: 'Tarte citron meringuée', price: 3.5, desc: '' },
      { name: 'Baguette tradition', price: 1.4, desc: '' },
      { name: 'Tarte aux pommes', price: 3, desc: 'La part' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Eau pétillante 50cl', price: 2, desc: '' },
      { name: 'Café', price: 2, desc: '' },
      { name: 'Jus d\'orange 25cl', price: 2.5, desc: '' },
      { name: 'Chocolat chaud', price: 3, desc: '' },
      { name: 'Thé Earl Grey', price: 2.2, desc: '' },
      { name: 'Café Latte', price: 3, desc: '' }
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
  'Night Shop': {
    entree: [
      { name: 'Chips nature 150g', price: 2.2, desc: '' },
      { name: 'Chips paprika 150g', price: 2.2, desc: '' },
      { name: 'Chips barbecue 150g', price: 2.2, desc: '' },
      { name: 'Cacahuètes salées 200g', price: 2.8, desc: '' },
      { name: 'Pistaches salées 150g', price: 3.5, desc: '' },
      { name: 'Noix de cajou 150g', price: 3.8, desc: '' },
      { name: 'Mix apéro noix 150g', price: 3.5, desc: '' },
      { name: 'Bretzels salés 150g', price: 2.8, desc: '' },
      { name: 'Crackers apéro 100g', price: 2.5, desc: '' },
      { name: 'Olives marinées 200g', price: 3.2, desc: '' },
      { name: 'Nachos & sauce fromage', price: 4.5, desc: '' },
      { name: 'Popcorn salé', price: 2.8, desc: '' },
      { name: 'Saucisson sec', price: 4.2, desc: '' },
      { name: 'Biltong bœuf séché', price: 4.8, desc: '' },
      { name: 'Fromage apéro', price: 3.5, desc: '' },
      { name: 'Fruits secs mélangés 200g', price: 3.8, desc: '' }
    ],
    plat: [
      { name: 'Sandwich thon', price: 4.2, desc: '' },
      { name: 'Sandwich poulet', price: 4.5, desc: '' },
      { name: 'Sandwich thon-crudités', price: 4.2, desc: '' },
      { name: 'Panini jambon-fromage', price: 4.8, desc: '' },
      { name: 'Wrap kebab', price: 5.5, desc: '' },
      { name: 'Hot-dog', price: 4.2, desc: '' },
      { name: 'Pizza part chaude', price: 3.8, desc: '' },
      { name: 'Nouilles instantanées', price: 2.5, desc: '' },
      { name: 'Pack Soirée (sandwich, chips & boisson)', price: 8.5, desc: '' },
      { name: 'Pizza surgelée margherita', price: 4.5, desc: '' },
      { name: 'Pizza surgelée 4 fromages', price: 5.2, desc: '' },
      { name: 'Lasagnes surgelées', price: 5.5, desc: '' },
      { name: 'Frites surgelées 1kg', price: 3.2, desc: '' },
      { name: 'Nuggets de poulet surgelés', price: 4.8, desc: 'Les 12' },
      { name: 'Cordon bleu surgelé', price: 5.5, desc: 'Les 2' },
      { name: 'Pâtes bolognaise', price: 4.8, desc: 'Plat préparé' },
      { name: 'Riz cantonais', price: 4.5, desc: 'Plat préparé' },
      { name: 'Soupe en brique', price: 2.8, desc: '' },
      { name: 'Quiche lorraine', price: 4.2, desc: 'La part' },
      { name: 'Croque-monsieur', price: 4.8, desc: '' }
    ],
    dessert: [
      { name: 'Barre chocolatée', price: 1.8, desc: '' },
      { name: 'Tablette de chocolat', price: 3.2, desc: '' },
      { name: 'Bonbons', price: 2.2, desc: '' },
      { name: 'Chewing-gum', price: 1.5, desc: '' },
      { name: 'Muffin chocolat', price: 2.8, desc: '' },
      { name: 'Cookies (3)', price: 2.5, desc: '' },
      { name: 'Donut glacé', price: 2.2, desc: '' },
      { name: 'Gaufre de Liège', price: 2.8, desc: '' },
      { name: 'Popcorn sucré', price: 2.8, desc: '' },
      { name: 'Glace bâtonnet', price: 2.5, desc: '' },
      { name: 'Pot de glace 500ml', price: 5.5, desc: '' },
      { name: 'Yaourt à boire', price: 1.8, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 50cl', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero 50cl', price: 2.5, desc: '' },
      { name: 'Sprite 50cl', price: 2.5, desc: '' },
      { name: 'Fanta Orange 50cl', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 1.8, desc: '' },
      { name: 'Eau pétillante 50cl', price: 1.8, desc: '' },
      { name: 'Ice tea 50cl', price: 2.5, desc: '' },
      { name: "Jus d'orange 33cl", price: 2.8, desc: '' },
      { name: 'Jus multifruits 33cl', price: 2.8, desc: '' },
      { name: 'Energy drink 25cl', price: 2.8, desc: '' },
      { name: 'Bière 33cl', price: 2.8, desc: '' },
      { name: 'Bière spéciale 33cl', price: 3.5, desc: '' },
      { name: 'Bière sans alcool 33cl', price: 2.8, desc: '' },
      { name: 'Cidre 33cl', price: 3.2, desc: '' },
      { name: 'Vin rouge 25cl', price: 4.8, desc: '' },
      { name: 'Vin blanc 25cl', price: 4.8, desc: '' },
      { name: 'Cava', price: 6.5, desc: 'La mini-bouteille' },
      { name: 'Whisky', price: 5.5, desc: 'La mini-bouteille (5cl)' },
      { name: 'Vodka', price: 5.5, desc: 'La mini-bouteille (5cl)' },
      { name: 'Rhum', price: 5.5, desc: 'La mini-bouteille (5cl)' }
    ]
  },
  Boucherie: {
    entree: [
      { name: "Jambon d'Ardenne", price: 4.5, desc: 'La tranche' },
      { name: 'Pâté de campagne', price: 4, desc: 'Les 150g' },
      { name: 'Terrine de canard', price: 5.5, desc: 'Les 150g' },
      { name: 'Rillettes de porc', price: 4, desc: 'Les 150g' },
      { name: 'Salade de museau', price: 4.5, desc: 'Les 200g' },
      { name: 'Fromage de tête', price: 4.5, desc: 'Les 150g' },
      { name: 'Saucisson sec', price: 4, desc: '' },
      { name: 'Boudin blanc', price: 5, desc: 'Les 2 pièces' }
    ],
    plat: [
      { name: 'Entrecôte de bœuf', price: 9.5, desc: 'Prix au kilo' },
      { name: 'Filet pur de bœuf', price: 14.5, desc: 'Prix au kilo' },
      { name: "Côte à l'os", price: 12.5, desc: 'Prix au kilo' },
      { name: 'Steak haché pur bœuf', price: 6, desc: 'Les 2 pièces' },
      { name: 'Escalope de poulet fermier', price: 7, desc: 'Prix au kilo' },
      { name: 'Cuisse de poulet fermier', price: 5, desc: 'Prix au kilo' },
      { name: 'Filet de porc', price: 6.5, desc: 'Prix au kilo' },
      { name: "Côtelettes d'agneau", price: 11.5, desc: 'Prix au kilo' },
      { name: 'Saucisses de Toulouse', price: 5.5, desc: 'Les 4 pièces' },
      { name: 'Merguez', price: 5.5, desc: 'Les 6 pièces' },
      { name: 'Boudin noir', price: 4.5, desc: 'Les 2 pièces' },
      { name: 'Chipolatas', price: 5, desc: 'Les 6 pièces' },
      { name: 'Vol-au-vent maison', price: 8.5, desc: 'Prêt à réchauffer' },
      { name: 'Carbonade flamande', price: 9, desc: 'Prête à réchauffer' },
      { name: 'Lapin à la bière', price: 10.5, desc: 'Prêt à réchauffer' },
      { name: 'Steak tartare préparé', price: 9.5, desc: '' }
    ],
    dessert: [
      { name: 'Tarte au riz', price: 3.5, desc: 'La part' },
      { name: 'Mousse au chocolat', price: 3.5, desc: '' },
      { name: 'Panna Cotta', price: 3.5, desc: '' },
      { name: 'Tiramisu', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.5, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.5, desc: '' },
      { name: 'Sprite', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Eau pétillante 50cl', price: 2, desc: '' },
      { name: 'Vin rouge', price: 8, desc: 'La bouteille' },
      { name: 'Vin blanc', price: 8, desc: 'La bouteille' },
      { name: 'Bière trappiste', price: 3, desc: '' },
      { name: 'Jus de pomme', price: 2.5, desc: '' },
      { name: 'Jus d\'orange', price: 2.5, desc: '' }
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
  { keywords: ['frite', 'french fries', 'fries'], image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&q=80' },

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
  { keywords: ['pâtes', 'pate', 'pasta', 'tagliatelle', 'linguine', 'rigatoni', 'fettuccine', 'penne', 'spaghetti'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
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
  { keywords: ['pad thai'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['fried rice', 'riz cantonais', 'riz sauté', 'riz gras'], image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&q=80' },
  { keywords: ['teriyaki'], image: 'https://images.unsplash.com/photo-1609183480237-ccbb2d7c5772?w=300&q=80' },
  { keywords: ['sweet & sour', 'general tao', 'bœuf aux oignons', 'boeuf aux oignons'], image: 'https://images.unsplash.com/photo-1664138788119-bd4f073259d5?w=300&q=80' },
  { keywords: ['thai green curry', 'thai red curry', 'curry vert', 'curry rouge'], image: 'https://images.unsplash.com/photo-1716959669858-11d415bdead6?w=300&q=80' },
  { keywords: ['singapore noodles', 'noodles', 'bo bun', 'nouilles'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
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
  { keywords: ['jarritos', 'limeade'], image: 'https://images.unsplash.com/photo-1632852521784-d85d5b62dd62?w=300&q=80' },

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
  { keywords: ['kombucha'], image: 'https://images.unsplash.com/photo-1651495079340-fb4cf8bae955?w=300&q=80' },
  { keywords: ['coconut water'], image: 'https://images.unsplash.com/photo-1588413336019-dd5d3beddf55?w=300&q=80' },
  { keywords: ['toast avocat', 'avocado'], image: 'https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=300&q=80' },

  // --- Fried Chicken / Wings ---
  { keywords: ['crispy tenders', 'tenders'], image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&q=80' },
  { keywords: ['hot wings'], image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&q=80' },
  { keywords: ['chicken bucket'], image: 'https://images.unsplash.com/photo-1652957392622-17e7c96f1369?w=300&q=80' },
  { keywords: ['mac & cheese', 'mac and cheese'], image: 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=300&q=80' },
  { keywords: ['mozzarella sticks', 'jalapeño poppers', 'jalapeno poppers'], image: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300&q=80' },
  { keywords: ['apple pie'], image: 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=300&q=80' },
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
  { keywords: ['kebab', 'durum', 'chawarma', 'grillades', 'grill'], image: 'https://images.unsplash.com/photo-1532636875304-0c89119d9b4d?w=300&q=80' },
  { keywords: ['sandwich', 'panini', 'wrap', 'croque'], image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&q=80' },
  { keywords: ['hot-dog', 'hot dog'], image: 'https://images.unsplash.com/photo-1612392061787-2d078b3e573c?w=300&q=80' },
  { keywords: ['glace', 'mochi', 'sorbet', 'sundae', 'cornet'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['cheesecake'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['fondant au chocolat', 'chocolate fondant', 'fondant chocolat'], image: 'https://images.unsplash.com/photo-1673551490812-eaee2e9bf0ef?w=300&q=80' },
  { keywords: ['crème brûlée', 'creme brulee'], image: 'https://images.unsplash.com/photo-1676300184943-09b2a08319a3?w=300&q=80' },
  { keywords: ['cookie aux pépites', 'chocolate chip cookie'], image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300&q=80' },
  { keywords: ['tarte aux pommes', 'apple pie', 'apple tart'], image: 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=300&q=80' },
  { keywords: ['brownie'], image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&q=80' },
  { keywords: ['tiramisu', 'tiramisù'], image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&q=80' },
  { keywords: ['panna cotta', 'cannoli'], image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&q=80' },
  { keywords: ['chocolat chaud', 'hot chocolate'], image: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=300&q=80' },
  { keywords: ['chocolat', 'cioccolato', 'cookie', 'biscuit', 'gâteau', 'gateau', 'cake', 'tarte', 'baklava', 'fondant'], image: 'https://images.unsplash.com/photo-1517427294546-5aa121f68e8a?w=300&q=80' },
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
  { keywords: ['poulet', 'chicken', 'beignet'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=300&q=80' },
  { keywords: ['riz', 'curry', 'cantonais'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['saumon', 'salmon', 'poisson', 'thon', 'tuna', 'shrimp', 'crevette'], image: 'https://images.unsplash.com/photo-1641898378716-1f38ec04bb0f?w=300&q=80' },
  { keywords: ['chips', 'cacahuète', 'cacahuete', 'bretzel', 'apéro', 'apero', 'olives', 'biltong', 'saucisson', 'fruits secs'], image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=300&q=80' },
  { keywords: ['légume', 'legume', 'quiche'], image: 'https://images.unsplash.com/photo-1650844010413-3f24dc1c182b?w=300&q=80' },
  { keywords: ['œufs', 'oeufs', 'eggs'], image: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=300&q=80' },
  { keywords: ['salade de fruits', 'fruit salad', 'pommes'], image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=300&q=80' },
  { keywords: ['salade', 'bowl', 'buddha'], image: 'https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=300&q=80' },
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
  'vinaigrette miel-moutarde': categoryImage('entree'),
  'menu falafel wrap (frites & boisson)': U('1593001872095-7d5b3868fb1d'),
  'cacahuètes grillées': U('1599490659213-e2b9527bd087'),
  'tofu grillé légumes': U('1512621776951-a57141f2eefd'),
  'bowl tofu grillé': U('1512621776951-a57141f2eefd'),
  'assiette végétarienne grillée': U('1512621776951-a57141f2eefd'),
  'poulet grillé légumes vapeur': U('1517686469429-8bdb88b9f907'),
  'beignets de banane': U('1570727624862-3008fe67a6be'),
  'petit milkshake chocolat': U('1619158403521-ed9795026d47'),
  'tarte salée aux légumes': U('1650844010413-3f24dc1c182b'),
  'menu tarte salée aux légumes': U('1650844010413-3f24dc1c182b')
};

export function defaultItemImage(item) {
  const name = (item?.name || '').toLowerCase().trim();
  if (ITEM_IMAGE_OVERRIDES[name]) return ITEM_IMAGE_OVERRIDES[name];
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.image;
  }
  return categoryImage(item?.category) || '';
}
