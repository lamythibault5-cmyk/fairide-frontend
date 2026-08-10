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
      { name: 'Salade César', price: 6, desc: '' },
      { name: 'Salade Caprese', price: 6, desc: '' },
      { name: 'Burrata & tomates confites', price: 7.5, desc: '' },
      { name: 'Focaccia maison', price: 4.5, desc: '' },
      { name: 'Antipasti trio', price: 8, desc: '' },
      { name: 'Arancini (4 pièces)', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Pizza Margherita', price: 11, desc: 'Tomate, mozzarella, basilic' },
      { name: 'Pizza Pepperoni', price: 12.5, desc: '' },
      { name: 'Pizza Quatre Fromages', price: 13, desc: '' },
      { name: 'Pizza Diavola', price: 12.5, desc: '' },
      { name: 'Pizza Vegetariana', price: 11, desc: '' },
      { name: 'Pizza Prosciutto', price: 13, desc: '' },
      { name: 'Pizza Bufala', price: 13.5, desc: '' },
      { name: 'Pizza Napoletana', price: 11.5, desc: '' },
      { name: 'Calzone ricotta-épinards', price: 12.5, desc: '' },
      { name: 'Pizza Tonno', price: 12, desc: '' },
      { name: 'Pizza Hawaïenne', price: 11.5, desc: '' },
      { name: 'Pizza Regina', price: 12.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu', price: 5.5, desc: '' },
      { name: 'Panna cotta', price: 5, desc: '' },
      { name: 'Cannoli sicilien', price: 5, desc: '' },
      { name: 'Gelato pistache', price: 4.5, desc: '' },
      { name: 'Affogato', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'San Pellegrino 33cl', price: 3.5, desc: '' },
      { name: 'Chianti (verre)', price: 5.5, desc: '' },
      { name: 'Limonade artisanale', price: 3.5, desc: '' },
      { name: 'Espresso', price: 2.2, desc: '' }
    ]
  },
  Burgers: {
    entree: [
      { name: 'Onion rings', price: 5, desc: '' },
      { name: 'Nuggets (6 pièces)', price: 6, desc: '' },
      { name: 'Mozzarella sticks (5pcs)', price: 5.5, desc: '' },
      { name: 'Coleslaw', price: 3.5, desc: '' },
      { name: 'Sweet potato fries', price: 4.5, desc: '' },
      { name: 'Jalapeño poppers (6pcs)', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Cheeseburger', price: 10.5, desc: 'Avec frites' },
      { name: 'Bacon Burger', price: 12, desc: 'Avec frites' },
      { name: 'Veggie Burger', price: 10, desc: 'Avec frites' },
      { name: 'Chicken Burger', price: 10.5, desc: '' },
      { name: 'Fish Burger', price: 10, desc: '' },
      { name: 'BBQ Burger', price: 11.5, desc: '' },
      { name: 'Mushroom Swiss Burger', price: 11, desc: '' },
      { name: 'Double Bacon Burger', price: 13, desc: '' },
      { name: 'Chili Cheese Burger', price: 11.5, desc: '' },
      { name: 'Pulled Pork Burger', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Milkshake vanille', price: 5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Donut glacé', price: 3, desc: '' },
      { name: 'Apple pie', price: 4.5, desc: '' },
      { name: 'Milkshake chocolat', price: 5, desc: '' },
      { name: 'Milkshake fraise', price: 5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Ice Tea 33cl', price: 3, desc: '' },
      { name: 'Root beer', price: 3.5, desc: '' },
      { name: 'Limonade citron', price: 3, desc: '' },
      { name: 'Sprite 33cl', price: 3, desc: '' }
    ]
  },
  Sushi: {
    entree: [
      { name: 'Edamame', price: 4.5, desc: '' },
      { name: 'Soupe miso', price: 4, desc: '' },
      { name: 'Gyoza (5 pièces)', price: 6, desc: '' },
      { name: 'Salade wakame', price: 4.5, desc: '' },
      { name: 'Tataki de bœuf', price: 8, desc: '' },
      { name: 'Tempura crevette (4pcs)', price: 7, desc: '' },
      { name: 'Salade de choux épicée', price: 4, desc: '' }
    ],
    plat: [
      { name: 'California Roll (8 pcs)', price: 9, desc: '' },
      { name: 'Saumon Nigiri (6 pcs)', price: 10, desc: '' },
      { name: 'Maki Avocat (8 pcs)', price: 7.5, desc: '' },
      { name: 'Spicy Tuna Roll (8pcs)', price: 9.5, desc: '' },
      { name: 'Tempura Roll (8pcs)', price: 9, desc: '' },
      { name: 'Rainbow Roll (8pcs)', price: 11, desc: '' },
      { name: 'Philadelphia Roll (8pcs)', price: 9.5, desc: '' },
      { name: 'Sashimi saumon (6pcs)', price: 11, desc: '' },
      { name: 'Chirashi bowl', price: 13, desc: '' },
      { name: 'Poke bowl saumon', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Mochi glacé', price: 5, desc: '' },
      { name: 'Dorayaki', price: 4, desc: '' },
      { name: 'Cheesecake matcha', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé vert glacé', price: 3, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Saké chaud', price: 6, desc: '' },
      { name: 'Ramune', price: 3.5, desc: '' }
    ]
  },
  Italien: {
    entree: [
      { name: 'Bruschetta', price: 5.5, desc: '' },
      { name: 'Antipasti mixte', price: 8, desc: '' },
      { name: 'Caprese', price: 6, desc: '' },
      { name: 'Vitello tonnato', price: 8.5, desc: '' },
      { name: 'Carpaccio de bœuf', price: 9, desc: '' },
      { name: 'Focaccia maison', price: 4.5, desc: '' }
    ],
    plat: [
      { name: 'Pâtes Carbonara', price: 11.5, desc: '' },
      { name: 'Lasagne maison', price: 12.5, desc: '' },
      { name: 'Risotto champignons', price: 12, desc: '' },
      { name: 'Gnocchi gorgonzola', price: 12, desc: '' },
      { name: 'Penne arrabbiata', price: 10.5, desc: '' },
      { name: 'Ravioli ricotta-épinards', price: 12.5, desc: '' },
      { name: 'Spaghetti aux fruits de mer', price: 15.5, desc: '' },
      { name: 'Fettuccine Alfredo', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Tiramisu', price: 5.5, desc: '' },
      { name: 'Cannoli', price: 5, desc: '' },
      { name: 'Panna cotta fruits rouges', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Eau pétillante 50cl', price: 2.5, desc: '' },
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Prosecco (verre)', price: 5.5, desc: '' },
      { name: 'Espresso', price: 2.2, desc: '' },
      { name: 'Chianti (verre)', price: 5.5, desc: '' }
    ]
  },
  Belge: {
    entree: [
      { name: 'Croquettes au fromage', price: 6, desc: '' },
      { name: 'Soupe du jour', price: 5, desc: '' },
      { name: 'Tomate aux crevettes grises', price: 9, desc: '' },
      { name: 'Salade liégeoise', price: 7, desc: '' },
      { name: 'Croquettes de crevettes (2pcs)', price: 8, desc: '' },
      { name: 'Fricadelle sauce curry', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Frites & Carbonade', price: 13, desc: '' },
      { name: 'Moules-frites', price: 16, desc: '' },
      { name: 'Vol-au-vent', price: 12, desc: '' },
      { name: 'Waterzooi de poulet', price: 15, desc: '' },
      { name: 'Boulets sauce lapin', price: 14, desc: '' },
      { name: 'Filet américain frites', price: 12.5, desc: '' },
      { name: 'Chicons au gratin', price: 11, desc: '' },
      { name: 'Carbonnades flamandes', price: 14.5, desc: '' }
    ],
    dessert: [
      { name: 'Gaufre de Liège', price: 4.5, desc: '' },
      { name: 'Speculoos tiramisu', price: 5.5, desc: '' },
      { name: 'Cramique', price: 3, desc: '' },
      { name: 'Tarte au riz', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Bière blonde 33cl', price: 3.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Bière trappiste 33cl', price: 4, desc: '' },
      { name: 'Kriek 25cl', price: 3.5, desc: '' },
      { name: 'Café liégeois', price: 5, desc: '' }
    ]
  },
  Asiatique: {
    entree: [
      { name: 'Nems (4 pièces)', price: 5, desc: '' },
      { name: 'Soupe Tom Yum', price: 6, desc: '' },
      { name: 'Rouleaux de printemps (4pcs)', price: 5, desc: '' },
      { name: 'Bao vapeur (2pcs)', price: 6, desc: '' },
      { name: 'Salade de papaye verte', price: 6, desc: '' },
      { name: 'Soupe wonton', price: 5.5, desc: '' }
    ],
    plat: [
      { name: 'Nouilles sautées au poulet', price: 11, desc: '' },
      { name: 'Riz cantonais', price: 9.5, desc: '' },
      { name: 'Curry vert thaï', price: 12, desc: '' },
      { name: 'Riz sauté aux crevettes', price: 11, desc: '' },
      { name: 'Bœuf aux oignons', price: 12, desc: '' },
      { name: 'Poulet General Tao', price: 11.5, desc: '' },
      { name: 'Pad Thaï crevettes', price: 12, desc: '' },
      { name: 'Bo bun bœuf', price: 11.5, desc: '' }
    ],
    dessert: [
      { name: 'Beignets de banane', price: 4.5, desc: '' },
      { name: 'Perles de coco', price: 4, desc: '' },
      { name: 'Glace au thé vert', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Thé au jasmin', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Bubble tea taro', price: 5, desc: '' },
      { name: 'Eau de coco', price: 3.5, desc: '' }
    ]
  },
  Healthy: {
    entree: [
      { name: 'Soupe de légumes', price: 5, desc: '' },
      { name: 'Velouté de courgette', price: 5, desc: '' },
      { name: 'Chips de kale', price: 4, desc: '' },
      { name: 'Houmous & bâtonnets carotte', price: 5, desc: '' },
      { name: 'Toast avocat', price: 6.5, desc: '' }
    ],
    plat: [
      { name: 'Buddha bowl quinoa', price: 11.5, desc: '' },
      { name: 'Salade César poulet', price: 10.5, desc: '' },
      { name: 'Wrap avocat & poulet', price: 9.5, desc: '' },
      { name: 'Bowl saumon avocat', price: 13, desc: '' },
      { name: 'Wrap falafel', price: 9, desc: '' },
      { name: 'Salade quinoa mangue', price: 10.5, desc: '' },
      { name: 'Bowl poke tofu', price: 11, desc: '' },
      { name: 'Curry de lentilles', price: 10, desc: '' },
      { name: 'Poulet grillé légumes vapeur', price: 12, desc: '' }
    ],
    dessert: [
      { name: 'Salade de fruits frais', price: 4.5, desc: '' },
      { name: 'Energy balls (3pcs)', price: 3.5, desc: '' },
      { name: 'Pudding chia', price: 4.5, desc: '' },
      { name: 'Yaourt grec & miel', price: 4, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé orange', price: 4, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Smoothie vert', price: 5, desc: '' },
      { name: 'Kombucha', price: 4, desc: '' },
      { name: 'Latte matcha', price: 4.5, desc: '' }
    ]
  },
  'Végétarien': {
    entree: [
      { name: 'Houmous & pain pita', price: 5.5, desc: '' },
      { name: 'Soupe miso vegan', price: 4.5, desc: '' },
      { name: 'Rouleaux de printemps tofu', price: 5, desc: '' },
      { name: 'Chips de patate douce', price: 4, desc: '' },
      { name: 'Salade de betteraves', price: 5, desc: '' }
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
      { name: 'Pâtes vegan au pesto', price: 10.5, desc: '' }
    ],
    dessert: [
      { name: 'Brownie vegan', price: 4.5, desc: '' },
      { name: 'Cookie vegan', price: 3, desc: '' },
      { name: 'Cheesecake vegan citron', price: 5, desc: '' },
      { name: 'Muffin vegan', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Jus pressé pomme', price: 4, desc: '' },
      { name: 'Eau plate 50cl', price: 2, desc: '' },
      { name: 'Lait d\'amande chaud', price: 3.5, desc: '' },
      { name: 'Kombucha', price: 4, desc: '' },
      { name: 'Jus vert détox', price: 4.5, desc: '' }
    ]
  },
  'Kebab & Grill': {
    entree: [
      { name: 'Frites maison', price: 4, desc: '' },
      { name: 'Falafel (6 pièces)', price: 5, desc: '' },
      { name: 'Böreks fromage (3pcs)', price: 5.5, desc: '' },
      { name: 'Houmous & pita', price: 5, desc: '' },
      { name: 'Taboulé', price: 4.5, desc: '' },
      { name: 'Salade turque', price: 5, desc: '' }
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
      { name: 'Durum végétarien', price: 8, desc: '' }
    ],
    dessert: [
      { name: 'Baklava (2 pièces)', price: 3.5, desc: '' },
      { name: 'Künefe', price: 5.5, desc: '' },
      { name: 'Loukoum assortiment', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Ayran', price: 2.5, desc: '' },
      { name: 'Coca-Cola 33cl', price: 3, desc: '' },
      { name: 'Salgam', price: 3, desc: '' },
      { name: 'Thé turc', price: 2.5, desc: '' },
      { name: 'Citronnade', price: 3.5, desc: '' }
    ]
  },
  Boulangerie: {
    entree: [
      { name: 'Sandwich jambon-fromage', price: 4.5, desc: '' },
      { name: 'Sandwich poulet-crudités', price: 5, desc: '' },
      { name: 'Sandwich thon-crudités', price: 4.5, desc: '' },
      { name: 'Sandwich végétarien', price: 4.5, desc: '' },
      { name: 'Wrap poulet curry', price: 5, desc: '' }
    ],
    plat: [
      { name: 'Quiche lorraine', price: 4, desc: 'La part' },
      { name: 'Tarte salée aux légumes', price: 4, desc: 'La part' },
      { name: 'Quiche saumon-épinards', price: 4.2, desc: '' },
      { name: 'Croque-monsieur', price: 5, desc: '' },
      { name: 'Tarte flamiche', price: 4.2, desc: '' },
      { name: 'Panini poulet', price: 5, desc: '' }
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
      { name: 'Tarte citron meringuée', price: 3.5, desc: '' }
    ],
    boisson: [
      { name: 'Café', price: 2, desc: '' },
      { name: 'Jus d\'orange 25cl', price: 2.5, desc: '' },
      { name: 'Chocolat chaud', price: 3, desc: '' },
      { name: 'Thé Earl Grey', price: 2.2, desc: '' },
      { name: 'Jus de pomme 25cl', price: 2.5, desc: '' }
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
      { name: 'Saucisson sec', price: 4, desc: '' }
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
      { name: 'Œufs (6)', price: 2.6, desc: '' }
    ],
    dessert: [
      { name: 'Tablette de chocolat', price: 2.5, desc: '' },
      { name: 'Paquet de biscuits', price: 2, desc: '' },
      { name: 'Yaourt aux fruits (4)', price: 2.8, desc: '' },
      { name: 'Glace vanille 1L', price: 4.5, desc: '' },
      { name: 'Donut chocolat', price: 1.8, desc: '' },
      { name: 'Barres céréales (6)', price: 3, desc: '' },
      { name: 'Fruits secs mélangés 200g', price: 3.2, desc: '' }
    ],
    boisson: [
      { name: 'Eau plate 1.5L', price: 1.5, desc: '' },
      { name: 'Pack de sodas 6x33cl', price: 5, desc: '' },
      { name: 'Jus de fruits 1L', price: 2.5, desc: '' },
      { name: 'Eau pétillante 1.5L', price: 1.4, desc: '' },
      { name: 'Café moulu 250g', price: 4.2, desc: '' },
      { name: 'Lait demi-écrémé 1L', price: 1.3, desc: '' }
    ]
  },
  'Night Shop': {
    entree: [
      { name: 'Chips 150g', price: 2.5, desc: '' },
      { name: 'Mix apéro', price: 3, desc: '' },
      { name: 'Cacahuètes grillées', price: 2.5, desc: '' },
      { name: 'Nachos & sauce fromage', price: 4, desc: '' },
      { name: 'Bretzels salés', price: 2.8, desc: '' },
      { name: 'Olives marinées', price: 3, desc: '' },
      { name: 'Biltong bœuf séché', price: 4.5, desc: '' }
    ],
    plat: [
      { name: 'Sandwich thon', price: 4, desc: '' },
      { name: 'Panini jambon-fromage', price: 4.5, desc: '' },
      { name: 'Sandwich thon-crudités', price: 4, desc: '' },
      { name: 'Sandwich poulet', price: 4.2, desc: '' },
      { name: 'Wrap kebab', price: 5, desc: '' },
      { name: 'Hot-dog', price: 4, desc: '' },
      { name: 'Pizza part chaude', price: 3.5, desc: '' },
      { name: 'Nouilles instantanées', price: 2.2, desc: '' }
    ],
    dessert: [
      { name: 'Barre chocolatée', price: 1.5, desc: '' },
      { name: 'Bonbons', price: 2, desc: '' },
      { name: 'Muffin chocolat', price: 2.5, desc: '' },
      { name: 'Glace bâtonnet', price: 2, desc: '' },
      { name: 'Cookies (3)', price: 2.2, desc: '' },
      { name: 'Popcorn sucré', price: 2.5, desc: '' }
    ],
    boisson: [
      { name: 'Bière 33cl', price: 2.5, desc: '' },
      { name: 'Energy drink 25cl', price: 2.5, desc: '' },
      { name: 'Eau plate 50cl', price: 1.5, desc: '' },
      { name: 'Bière spéciale 33cl', price: 3, desc: '' },
      { name: 'Vin rouge 25cl', price: 4.5, desc: '' },
      { name: 'Soda cola 50cl', price: 2.2, desc: '' },
      { name: 'Ice tea 50cl', price: 2.2, desc: '' }
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
