export const CATEGORIES = [
  { value: 'entree', label: 'Entrées', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=200&q=80' },
  { value: 'plat', label: 'Plats', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80' },
  { value: 'dessert', label: 'Desserts', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&q=80' },
  { value: 'boisson', label: 'Boissons', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&q=80' }
];

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function categoryImage(value) {
  return CATEGORIES.find((c) => c.value === value)?.image || '';
}

export const COMMUNES = [
  'Anderlecht', 'Auderghem', 'Berchem-Sainte-Agathe', 'Bruxelles', 'Etterbeek', 'Evere',
  'Forest', 'Ganshoren', 'Ixelles', 'Jette', 'Koekelberg', 'Molenbeek-Saint-Jean',
  'Saint-Gilles', 'Saint-Josse-ten-Noode', 'Schaerbeek', 'Uccle', 'Watermael-Boitsfort',
  'Woluwe-Saint-Lambert', 'Woluwe-Saint-Pierre'
];

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
  { value: 'Boulangerie', emoji: '🥐' },
  { value: 'Supermarché', emoji: '🛒' },
  { value: 'Night Shop', emoji: '🌙' },
  { value: 'Autre', emoji: '🍽️' }
];

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
  Pizza: {
    entree: [
      { name: 'Bruschetta', price: 5.5, desc: 'Tomates, basilic, ail' },
      { name: 'Salade César', price: 6, desc: '' }
    ],
    plat: [
      { name: 'Pizza Margherita', price: 11, desc: 'Tomate, mozzarella, basilic' },
      { name: 'Pizza Pepperoni', price: 12.5, desc: '' },
      { name: 'Pizza Quatre Fromages', price: 13, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu', price: 5.5, desc: '' },
      { name: 'Panna cotta', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'San Pellegrino 33cl', price: 3.5, desc: '' }
    ]
  },
  Burgers: {
    entree: [
      { name: 'Onion rings', price: 5, desc: '' },
      { name: 'Nuggets (6 pièces)', price: 6, desc: '' }
    ],
    plat: [
      { name: 'Cheeseburger', price: 10.5, desc: 'Avec frites' },
      { name: 'Bacon Burger', price: 12, desc: 'Avec frites' },
      { name: 'Veggie Burger', price: 10, desc: 'Avec frites' }
    ],
    dessert: [
      { name: 'Milkshake vanille', price: 5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Ice Tea 33cl', price: 3, desc: '' }
    ]
  },
  Sushi: {
    entree: [
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Soupe miso', price: 4, desc: '' }
    ],
    plat: [
      { name: 'California Roll (8 pcs)', price: 9, desc: '' },
      { name: 'Saumon Nigiri (6 pcs)', price: 10, desc: '' },
      { name: 'Maki Avocat (8 pcs)', price: 7.5, desc: '' }
    ],
    dessert: [
      { name: 'Mochi glacé', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Thé vert glacé', price: 3, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  Italien: {
    entree: [
      { name: 'Bruschetta', price: 5.5, desc: '' },
      { name: 'Antipasti mixte', price: 8, desc: '' }
    ],
    plat: [
      { name: 'Pâtes Carbonara', price: 11.5, desc: '' },
      { name: 'Lasagne maison', price: 12.5, desc: '' },
      { name: 'Risotto champignons', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Eau pétillante 50cl', price: 2.5, desc: '' },
      { name: 'Coca-Cola 33cl', price: 3, desc: '' }
    ]
  },
  Belge: {
    entree: [
      { name: 'Croquettes au fromage', price: 6, desc: '' },
      { name: 'Soupe du jour', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Frites & Carbonade', price: 13, desc: '' },
      { name: 'Moules-frites', price: 16, desc: '' },
      { name: 'Vol-au-vent', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Gaufre de Liège', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Bière blonde 33cl', price: 3.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  Asiatique: {
    entree: [
      { name: 'Nems (4 pièces)', price: 5, desc: '' },
      { name: 'Soupe Tom Yum', price: 6, desc: '' }
    ],
    plat: [
      { name: 'Nouilles sautées au poulet', price: 11, desc: '' },
      { name: 'Riz cantonais', price: 9.5, desc: '' },
      { name: 'Curry vert thaï', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Beignets de banane', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé au jasmin', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  Healthy: {
    entree: [
      { name: 'Soupe de légumes', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Buddha bowl quinoa', price: 11.5, desc: '' },
      { name: 'Salade César poulet', price: 10.5, desc: '' },
      { name: 'Wrap avocat & poulet', price: 9.5, desc: '' }
    ],
    dessert: [
      { name: 'Salade de fruits frais', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé orange', price: 4, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  'Végétarien': {
    entree: [
      { name: 'Houmous & pain pita', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Curry de légumes', price: 10.5, desc: '' },
      { name: 'Falafel bowl', price: 10, desc: '' },
      { name: 'Burger végétarien', price: 11, desc: '' }
    ],
    dessert: [
      { name: 'Brownie vegan', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé pomme', price: 4, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' }
    ]
  },
  'Kebab & Grill': {
    entree: [
      { name: 'Frites maison', price: 4, desc: '' }
    ],
    plat: [
      { name: 'Kebab poulet', price: 8.5, desc: '' },
      { name: 'Assiette mixte grillades', price: 13, desc: '' },
      { name: 'Chawarma bœuf', price: 9, desc: '' }
    ],
    dessert: [
      { name: 'Baklava (2 pièces)', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Ayran', price: 2.5, desc: '' },
      { name: 'Coca-Cola 33cl', price: 3, desc: '' }
    ]
  },
  Boulangerie: {
    entree: [
      { name: 'Sandwich jambon-fromage', price: 4.5, desc: '' },
      { name: 'Sandwich poulet-crudités', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Quiche lorraine', price: 4, desc: 'La part' },
      { name: 'Tarte salée aux légumes', price: 4, desc: 'La part' }
    ],
    dessert: [
      { name: 'Croissant', price: 1.5, desc: '' },
      { name: 'Pain au chocolat', price: 1.6, desc: '' },
      { name: 'Éclair au chocolat', price: 3, desc: '' }
    ],
    boisson: [
      { name: 'Café', price: 2, desc: '' },
      { name: 'Jus d\'orange 25cl', price: 2.5, desc: '' }
    ]
  },
  'Supermarché': {
    entree: [
      { name: 'Chips nature 150g', price: 2, desc: '' },
      { name: 'Cacahuètes salées', price: 2.5, desc: '' }
    ],
    plat: [
      { name: 'Plat préparé du jour', price: 5.5, desc: '' },
      { name: 'Pizza surgelée', price: 4, desc: '' },
      { name: 'Pâtes fraîches', price: 3.5, desc: '' }
    ],
    dessert: [
      { name: 'Tablette de chocolat', price: 2.5, desc: '' },
      { name: 'Paquet de biscuits', price: 2, desc: '' }
    ],
    boisson: [
      { name: 'Eau plate 1.5L', price: 1.5, desc: '' },
      { name: 'Pack de sodas 6x33cl', price: 5, desc: '' },
      { name: 'Jus de fruits 1L', price: 2.5, desc: '' }
    ]
  },
  'Night Shop': {
    entree: [
      { name: 'Chips 150g', price: 2.5, desc: '' },
      { name: 'Mix apéro', price: 3, desc: '' }
    ],
    plat: [
      { name: 'Sandwich thon', price: 4, desc: '' },
      { name: 'Panini jambon-fromage', price: 4.5, desc: '' }
    ],
    dessert: [
      { name: 'Barre chocolatée', price: 1.5, desc: '' },
      { name: 'Bonbons', price: 2, desc: '' }
    ],
    boisson: [
      { name: 'Bière 33cl', price: 2.5, desc: '' },
      { name: 'Energy drink 25cl', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 1.5, desc: '' }
    ]
  }
};

export function getStarterTemplate(cuisineType) {
  return TYPE_TEMPLATES[cuisineType] || GENERIC_TEMPLATE;
}

const KEYWORD_IMAGES = [
  { keywords: ['pizza'], image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&q=80' },
  { keywords: ['burger'], image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&q=80' },
  { keywords: ['sushi', 'maki', 'nigiri', 'sashimi', 'california roll', 'dragon roll'], image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&q=80' },
  { keywords: ['pâtes', 'pate', 'pasta', 'lasagne', 'carbonara', 'risotto', 'spaghetti', 'nouilles'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
  { keywords: ['salade', 'bowl', 'buddha'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&q=80' },
  { keywords: ['soupe', 'miso', 'tom yum'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' },
  { keywords: ['frites', 'onion rings', 'nuggets'], image: 'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?w=300&q=80' },
  { keywords: ['kebab', 'durum', 'chawarma', 'grillades', 'grill', 'mixed grill'], image: 'https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=300&q=80' },
  { keywords: ['sandwich', 'panini', 'wrap'], image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&q=80' },
  { keywords: ['glace', 'mochi', 'sorbet'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['chocolat', 'brownie', 'cookie', 'tiramisu', 'panna cotta', 'gâteau', 'gateau', 'tarte', 'brownie', 'baklava'], image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80' },
  { keywords: ['coca', 'soda', 'fanta', 'ice tea', 'limonade', 'ayran', 'energy drink'], image: 'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=300&q=80' },
  { keywords: ['eau plate', 'eau pétillante', 'eau petillante', "san pellegrino"], image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&q=80' },
  { keywords: ['café', 'cafe', 'expresso', 'espresso'], image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80' },
  { keywords: ['bière', 'biere'], image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80' },
  { keywords: ['vin'], image: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=300&q=80' },
  { keywords: ['jus'], image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&q=80' },
  { keywords: ['pain', 'croissant', 'viennoiserie', 'éclair', 'eclair'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&q=80' },
  { keywords: ['poulet', 'chicken', 'nem', 'beignet'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=300&q=80' },
  { keywords: ['riz', 'curry', 'cantonais'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['saumon', 'poisson', 'thon'], image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=300&q=80' },
  { keywords: ['chips', 'cacahuète', 'cacahuete', 'nachos', 'bretzel', 'apéro', 'apero', 'olives', 'biltong'], image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80' },
  { keywords: ['légume', 'legume', 'houmous', 'falafel', 'edamame', 'quiche'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' }
];

export function defaultItemImage(item) {
  const name = (item?.name || '').toLowerCase();
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.image;
  }
  return categoryImage(item?.category) || '';
}
