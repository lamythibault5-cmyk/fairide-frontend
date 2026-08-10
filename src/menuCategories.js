export const CATEGORIES = [
  { value: 'entree', label: 'Entrées' },
  { value: 'plat', label: 'Plats' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'boisson', label: 'Boissons' }
];

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
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
