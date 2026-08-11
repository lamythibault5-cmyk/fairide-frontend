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
  { value: 'Mexicain', emoji: '🌮' },
  { value: 'Libanais', emoji: '🧆' },
  { value: 'Fried Chicken', emoji: '🍗' },
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
      { name: 'Chocolate Chip Cookie', price: 3, desc: '' },
      { name: 'Oreo Milkshake', price: 5.9, desc: '' },
      { name: 'Vanilla Milkshake', price: 5.5, desc: '' }
    ],
    boisson: [
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Fanta', price: 2.8, desc: '' },
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Homemade Lemonade', price: 4, desc: '' }
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
      { name: 'Aranciata San Pellegrino', price: 3.5, desc: '' },
      { name: 'Limonata San Pellegrino', price: 3.5, desc: '' },
      { name: 'Italian Lemon Iced Tea', price: 3.5, desc: '' }
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
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Japanese Green Tea', price: 3.5, desc: '' },
      { name: 'Lychee Drink', price: 3.5, desc: '' },
      { name: 'Mango Drink', price: 3.5, desc: '' }
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
      { name: 'Ramune Original', price: 3.9, desc: '' },
      { name: 'Ramune Lychee', price: 3.9, desc: '' },
      { name: 'Japanese Green Tea', price: 3.5, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' }
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
      { name: 'Jarritos Lime', price: 3.9, desc: '' },
      { name: 'Jarritos Mango', price: 3.9, desc: '' },
      { name: 'Jarritos Guava', price: 3.9, desc: '' },
      { name: 'Homemade Limeade', price: 4, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' }
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
      { name: 'Ayran', price: 3, desc: '' },
      { name: 'Homemade Lemon Mint', price: 4.5, desc: '' },
      { name: 'Coca-Cola', price: 2.8, desc: '' },
      { name: 'Coca-Cola Zero', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' }
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
      { name: 'Homemade Lemonade', price: 4, desc: '' },
      { name: 'Ginger Shot', price: 3, desc: '' },
      { name: 'Green Smoothie', price: 5.5, desc: '' },
      { name: 'Mango Smoothie', price: 5.5, desc: '' },
      { name: 'Kombucha', price: 4.5, desc: '' },
      { name: 'Coconut Water', price: 3.9, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' }
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
      { name: 'Limonata', price: 3.5, desc: '' },
      { name: 'Aranciata', price: 3.5, desc: '' },
      { name: 'Peach Iced Tea', price: 3.5, desc: '' }
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
      { name: 'Still Water', price: 2.5, desc: '' }
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
      { name: 'Fanta', price: 2.5, desc: '' },
      { name: 'Ice Tea', price: 2.5, desc: '' },
      { name: 'Spa Reine', price: 2.2, desc: '' }
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
  // --- Burgers (spécifique avant générique) ---
  { keywords: ['double cheeseburger', 'double smash', 'double burger', 'double chicken burger'], image: 'https://images.unsplash.com/photo-1550317138-10000687a72b?w=300&q=80' },
  { keywords: ['bacon cheeseburger', 'bacon burger'], image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=300&q=80' },
  { keywords: ['bbq bacon', 'bbq burger', 'bbq chicken burger'], image: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=300&q=80' },
  { keywords: ['crispy chicken burger', 'spicy chicken burger', 'chicken burger', 'poulycroc', 'original chicken burger'], image: 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=300&q=80' },
  { keywords: ['veggie burger', 'vegetarian burger'], image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=300&q=80' },
  { keywords: ['smash burger'], image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300&q=80' },
  { keywords: ['blue cheese burger', 'truffle burger', 'oklahoma onion burger', 'avocado chicken burger', 'bicky'], image: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=300&q=80' },
  { keywords: ['cheeseburger', 'burger', 'hamburger'], image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&q=80' },

  // --- Fries & sides ---
  { keywords: ['sweet potato fries'], image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=300&q=80' },
  { keywords: ['loaded cheese fries', 'cheese fries', 'bacon & cheese fries', 'frites cheddar', 'cajun fries'], image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=300&q=80' },
  { keywords: ['onion rings'], image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=300&q=80' },
  { keywords: ['nuggets'], image: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=300&q=80' },
  { keywords: ['wings', 'ailes'], image: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=300&q=80' },
  { keywords: ['coleslaw'], image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80' },
  { keywords: ['frites', 'french fries', 'fries'], image: 'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?w=300&q=80' },

  // --- Pizzas (par variante) ---
  { keywords: ['margherita', 'marinara', 'napoli', 'napoletana'], image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&q=80' },
  { keywords: ['pepperoni', 'diavola', 'spicy pizza'], image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=300&q=80' },
  { keywords: ['quattro formaggi', 'quattro stagioni', 'capricciosa', 'parma', 'mortadella'], image: 'https://images.unsplash.com/photo-1571066811602-716837d681de?w=300&q=80' },
  { keywords: ['burrata pizza', 'pizza burrata', 'tartufata', 'truffle pizza'], image: 'https://images.unsplash.com/photo-1548369937-47519962c11a?w=300&q=80' },
  { keywords: ['calzone', 'pizza vegetariana', 'pizza hawaïenne', 'pizza tonno', 'pizza regina', 'pizza prosciutto'], image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=300&q=80' },
  { keywords: ['pizza'], image: 'https://images.unsplash.com/photo-1600028068383-ea11a7a101f3?w=300&q=80' },

  // --- Pâtes (par variante) ---
  { keywords: ['carbonara'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
  { keywords: ['bolognese', 'bolognaise', 'ragù', 'ragu'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['arrabbiata', 'amatriciana', 'vodka'], image: 'https://images.unsplash.com/photo-1608219992759-8d74ed8d76eb?w=300&q=80' },
  { keywords: ['pesto'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['gnocchi'], image: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?w=300&q=80' },
  { keywords: ['ravioli'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['lasagne', 'lasagna'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['pâtes', 'pate', 'pasta', 'tagliatelle', 'linguine', 'rigatoni', 'fettuccine', 'penne'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
  { keywords: ['risotto'], image: 'https://images.unsplash.com/photo-1608219992759-8d74ed8d76eb?w=300&q=80' },

  // --- Entrées italiennes ---
  { keywords: ['focaccia'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['garlic bread'], image: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=300&q=80' },
  { keywords: ['bruschetta'], image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=300&q=80' },
  { keywords: ['carpaccio'], image: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=300&q=80' },
  { keywords: ['burrata', 'caprese', 'antipasti'], image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=300&q=80' },
  { keywords: ['arancini'], image: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=300&q=80' },

  // --- Sushi / Japonais ---
  { keywords: ['nigiri', 'sashimi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['california roll'], image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=300&q=80' },
  { keywords: ['spicy salmon roll', 'spicy tuna roll', 'salmon avocado roll', 'crispy chicken roll', 'shrimp tempura roll', 'dragon roll'], image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&q=80' },
  { keywords: ['maki'], image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&q=80' },
  { keywords: ['salmon box', 'california box', 'sushi mix', 'salmon lovers', 'sushi deluxe', 'veggie box', 'chirashi', 'sushi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['gyoza'], image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=300&q=80' },
  { keywords: ['wakame'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&q=80' },
  { keywords: ['miso'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' },
  { keywords: ['ramune'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },

  // --- Asiatique / Wok ---
  { keywords: ['spring rolls', 'rouleaux de printemps', 'nems', 'nem'], image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=300&q=80' },
  { keywords: ['shrimp tempura', 'tempura crevette', 'tempura'], image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&q=80' },
  { keywords: ['edamame'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['satay'], image: 'https://images.unsplash.com/photo-1548940740-204726a19be3?w=300&q=80' },
  { keywords: ['pad thai'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['fried rice', 'riz cantonais', 'riz sauté', 'riz gras'], image: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=300&q=80' },
  { keywords: ['teriyaki'], image: 'https://images.unsplash.com/photo-1548940740-204726a19be3?w=300&q=80' },
  { keywords: ['sweet & sour', 'general tao'], image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&q=80' },
  { keywords: ['thai green curry', 'thai red curry', 'curry vert', 'curry rouge'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['singapore noodles', 'noodles', 'bo bun'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['mango sticky rice'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['coconut tapioca'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['lychee'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },

  // --- Mexicain ---
  { keywords: ['burrito bowl', 'vegan bowl', 'shrimp bowl'], image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=300&q=80' },
  { keywords: ['burrito'], image: 'https://images.unsplash.com/photo-1613514785940-daed07799d9b?w=300&q=80' },
  { keywords: ['tacos'], image: 'https://images.unsplash.com/photo-1571091655789-405eb7a3a3a8?w=300&q=80' },
  { keywords: ['loaded nachos', 'nachos'], image: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=300&q=80' },
  { keywords: ['guacamole'], image: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=300&q=80' },
  { keywords: ['mexican rice', 'black beans'], image: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=300&q=80' },
  { keywords: ['quesadilla'], image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&q=80' },
  { keywords: ['churros'], image: 'https://images.unsplash.com/photo-1624300629298-e9de39c13be5?w=300&q=80' },
  { keywords: ['tres leches'], image: 'https://images.unsplash.com/photo-1611250188496-e966043a0629?w=300&q=80' },
  { keywords: ['jarritos', 'limeade'], image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300&q=80' },

  // --- Libanais / Méditerranéen ---
  { keywords: ['hummus beiruti', 'hummus'], image: 'https://images.unsplash.com/photo-1622542796254-5b9c46ab0d2f?w=300&q=80' },
  { keywords: ['moutabal', 'baba ganoush'], image: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb8?w=300&q=80' },
  { keywords: ['labneh'], image: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=300&q=80' },
  { keywords: ['tabbouleh', 'tabboulé', 'fattoush'], image: 'https://images.unsplash.com/photo-1594179047519-f347310d3322?w=300&q=80' },
  { keywords: ['falafel'], image: 'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=300&q=80' },
  { keywords: ['kebbeh'], image: 'https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=300&q=80' },
  { keywords: ['halloumi'], image: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=300&q=80' },
  { keywords: ['shawarma'], image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=300&q=80' },
  { keywords: ['mixed grill', 'mezze'], image: 'https://images.unsplash.com/photo-1608835291093-394b0c943a75?w=300&q=80' },
  { keywords: ['kafta'], image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=300&q=80' },
  { keywords: ['mouhalabieh'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['kunafa', 'künefe'], image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&q=80' },
  { keywords: ['dates & nuts', 'dates'], image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&q=80' },
  { keywords: ['ayran', 'salgam'], image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80' },

  // --- Healthy / Poke / Bowls ---
  { keywords: ['salmon poke', 'spicy salmon poke'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['tuna poke', 'spicy tuna poke'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80' },
  { keywords: ['teriyaki chicken poke', 'crispy chicken poke'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80' },
  { keywords: ['shrimp poke'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },
  { keywords: ['tofu poke', 'vegan poke', 'build your own poke', 'poke'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['caesar', 'césar'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80' },
  { keywords: ['mediterranean bowl', 'avocado quinoa bowl', 'protein chicken bowl', 'falafel bowl'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80' },
  { keywords: ['açai', 'acai'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },
  { keywords: ['chia pudding'], image: 'https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=300&q=80' },
  { keywords: ['banana bread'], image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=300&q=80' },
  { keywords: ['ginger shot'], image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=300&q=80' },
  { keywords: ['green smoothie', 'mango smoothie', 'smoothie'], image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=300&q=80' },
  { keywords: ['kombucha'], image: 'https://images.unsplash.com/photo-1478144592103-25e218a04891?w=300&q=80' },
  { keywords: ['coconut water'], image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=300&q=80' },
  { keywords: ['toast avocat', 'avocado'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },

  // --- Fried Chicken / Wings ---
  { keywords: ['crispy tenders', 'tenders'], image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&q=80' },
  { keywords: ['hot wings'], image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&q=80' },
  { keywords: ['chicken bucket'], image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&q=80' },
  { keywords: ['mac & cheese', 'mac and cheese'], image: 'https://images.unsplash.com/photo-1569058242252-623df46b5025?w=300&q=80' },

  // --- Belge / Friterie ---
  { keywords: ['fricadelle', 'mexicano', 'viandelle', 'boulette'], image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&q=80' },
  { keywords: ['croquette de fromage', 'croquette de crevettes', 'croquette'], image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=300&q=80' },
  { keywords: ['gaufre'], image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&q=80' },
  { keywords: ['mousse au chocolat'], image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=300&q=80' },
  { keywords: ['tarte au sucre'], image: 'https://images.unsplash.com/photo-1580217593608-61931cefc821?w=300&q=80' },
  { keywords: ['sauce andalouse', 'samouraï', 'samourai', 'ketchup', 'mayonnaise', 'tartare', 'brazil'], image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80' },
  { keywords: ['moules'], image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=300&q=80' },

  // --- Génériques (fallback) ---
  { keywords: ['kebab', 'durum', 'chawarma', 'grillades', 'grill'], image: 'https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=300&q=80' },
  { keywords: ['sandwich', 'panini', 'wrap'], image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&q=80' },
  { keywords: ['glace', 'mochi', 'sorbet'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['cheesecake'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['brownie'], image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80' },
  { keywords: ['tiramisu', 'tiramisù'], image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&q=80' },
  { keywords: ['panna cotta', 'cannoli'], image: 'https://images.unsplash.com/photo-1626803775151-61d756612f97?w=300&q=80' },
  { keywords: ['chocolat', 'cookie', 'gâteau', 'gateau', 'tarte', 'baklava', 'fondant'], image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80' },
  { keywords: ['milkshake'], image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300&q=80' },
  { keywords: ['coca', 'soda', 'fanta', 'sprite', 'ice tea', 'iced tea', 'limonade', 'lemonade', 'limeade', 'energy drink'], image: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=300&q=80' },
  { keywords: ['eau plate', 'eau pétillante', 'eau petillante', 'still water', 'sparkling water', "san pellegrino", 'acqua panna', 'spa reine'], image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&q=80' },
  { keywords: ['café', 'cafe', 'expresso', 'espresso'], image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80' },
  { keywords: ['bière', 'biere'], image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80' },
  { keywords: ['vin', 'prosecco', 'chianti', 'limoncello'], image: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=300&q=80' },
  { keywords: ['jus', 'aranciata', 'lemonata'], image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&q=80' },
  { keywords: ['thé', 'the', 'tea'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },
  { keywords: ['pain', 'croissant', 'viennoiserie', 'éclair', 'eclair', 'cramique', 'financier', 'cannelé', 'canele', 'muffin'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&q=80' },
  { keywords: ['poulet', 'chicken', 'beignet'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=300&q=80' },
  { keywords: ['riz', 'curry', 'cantonais'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['saumon', 'salmon', 'poisson', 'thon', 'tuna', 'shrimp', 'crevette'], image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=300&q=80' },
  { keywords: ['chips', 'cacahuète', 'cacahuete', 'bretzel', 'apéro', 'apero', 'olives', 'biltong'], image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80' },
  { keywords: ['légume', 'legume', 'quiche'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['salade', 'bowl', 'buddha'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&q=80' },
  { keywords: ['soupe', 'soup'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' }
];

export function defaultItemImage(item) {
  const name = (item?.name || '').toLowerCase();
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.image;
  }
  return categoryImage(item?.category) || '';
}
