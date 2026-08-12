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
  { value: 'Boucherie', emoji: '🥩' },
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
      { name: 'Sprite', price: 2.8, desc: '' },
      { name: 'Still Water', price: 2.5, desc: '' },
      { name: 'Sparkling Water', price: 2.5, desc: '' },
      { name: 'Fanta', price: 2.8, desc: '' },
      { name: 'Homemade Lemonade', price: 4, desc: '' },
      { name: 'Root Beer', price: 3.2, desc: '' },
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
      { name: 'Chips 150g', price: 2.5, desc: '' },
      { name: 'Mix apéro', price: 3, desc: '' },
      { name: 'Cacahuètes grillées', price: 2.5, desc: '' },
      { name: 'Nachos & sauce fromage', price: 4, desc: '' },
      { name: 'Bretzels salés', price: 2.8, desc: '' },
      { name: 'Olives marinées', price: 3, desc: '' },
      { name: 'Biltong bœuf séché', price: 4.5, desc: '' },
      { name: 'Popcorn salé', price: 2.5, desc: '' }
    ],
    plat: [
      { name: 'Sandwich thon', price: 4, desc: '' },
      { name: 'Panini jambon-fromage', price: 4.5, desc: '' },
      { name: 'Sandwich thon-crudités', price: 4, desc: '' },
      { name: 'Sandwich poulet', price: 4.2, desc: '' },
      { name: 'Wrap kebab', price: 5, desc: '' },
      { name: 'Hot-dog', price: 4, desc: '' },
      { name: 'Pizza part chaude', price: 3.5, desc: '' },
      { name: 'Nouilles instantanées', price: 2.2, desc: '' },
      { name: 'Pack Soirée (sandwich, chips & boisson)', price: 8, desc: '' }
    ],
    dessert: [
      { name: 'Barre chocolatée', price: 1.5, desc: '' },
      { name: 'Bonbons', price: 2, desc: '' },
      { name: 'Muffin chocolat', price: 2.5, desc: '' },
      { name: 'Glace bâtonnet', price: 2, desc: '' },
      { name: 'Cookies (3)', price: 2.2, desc: '' },
      { name: 'Popcorn sucré', price: 2.5, desc: '' },
      { name: 'Donut glacé', price: 2, desc: '' }
    ],
    boisson: [
      { name: 'Soda cola 50cl', price: 2.2, desc: '' },
      { name: 'Coca-Cola Zero 50cl', price: 2.2, desc: '' },
      { name: 'Sprite 50cl', price: 2.2, desc: '' },
      { name: 'Eau plate 50cl', price: 1.5, desc: '' },
      { name: 'Eau pétillante 50cl', price: 1.5, desc: '' },
      { name: 'Bière 33cl', price: 2.5, desc: '' },
      { name: 'Bière spéciale 33cl', price: 3, desc: '' },
      { name: 'Energy drink 25cl', price: 2.5, desc: '' },
      { name: 'Vin rouge 25cl', price: 4.5, desc: '' },
      { name: 'Ice tea 50cl', price: 2.2, desc: '' }
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
  { keywords: ['frite', 'french fries', 'fries'], image: 'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?w=300&q=80' },

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
  { keywords: ['arrabbiata', 'amatriciana', 'vodka'], image: 'https://images.unsplash.com/photo-1608219992759-8d74ed8d76eb?w=300&q=80' },
  { keywords: ['pesto'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['gnocchi'], image: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?w=300&q=80' },
  { keywords: ['ravioli'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['lasagne', 'lasagna'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['pâtes', 'pate', 'pasta', 'tagliatelle', 'linguine', 'rigatoni', 'fettuccine', 'penne', 'spaghetti'], image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&q=80' },
  { keywords: ['risotto'], image: 'https://images.unsplash.com/photo-1608219992759-8d74ed8d76eb?w=300&q=80' },

  // --- Entrées italiennes ---
  { keywords: ['focaccia'], image: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=300&q=80' },
  { keywords: ['garlic bread'], image: 'https://images.unsplash.com/photo-1573140401552-3fab0b24306f?w=300&q=80' },
  { keywords: ['bruschetta'], image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=300&q=80' },
  { keywords: ['carpaccio', 'tataki'], image: 'https://images.unsplash.com/photo-1727243866425-3bf2cbf7480a?w=300&q=80' },
  { keywords: ['corn on the cob', 'corn on cob', 'épi de maïs'], image: 'https://images.unsplash.com/photo-1653886764193-db9e5a93d215?w=300&q=80' },
  { keywords: ['burrata', 'caprese', 'antipasti'], image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=300&q=80' },
  { keywords: ['arancini'], image: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=300&q=80' },
  { keywords: ['vitello tonnato', 'osso buco', 'saltimbocca'], image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80' },
  { keywords: ['affogato'], image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&q=80' },
  { keywords: ['gelato'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },

  // --- Sushi / Japonais ---
  { keywords: ['nigiri', 'sashimi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['california roll'], image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=300&q=80' },
  { keywords: ['philadelphia roll', 'unagi roll', 'vegetable roll'], image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=300&q=80' },
  { keywords: ['rainbow roll', 'ebi roll', 'futomaki'], image: 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=300&q=80' },
  { keywords: ['spicy salmon roll', 'spicy tuna roll', 'salmon avocado roll', 'crispy chicken roll', 'shrimp tempura roll', 'dragon roll'], image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&q=80' },
  { keywords: ['maki'], image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&q=80' },
  { keywords: ['salmon box', 'california box', 'sushi mix', 'salmon lovers', 'sushi deluxe', 'veggie box', 'chirashi', 'sushi'], image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&q=80' },
  { keywords: ['gyoza'], image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=300&q=80' },
  { keywords: ['wakame'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&q=80' },
  { keywords: ['miso'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' },
  { keywords: ['dorayaki'], image: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=300&q=80' },
  { keywords: ['saké', 'sake chaud'], image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300&q=80' },
  { keywords: ['ramune'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },

  // --- Asiatique / Wok ---
  { keywords: ['spring rolls', 'rouleaux de printemps', 'nems', 'nem'], image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=300&q=80' },
  { keywords: ['shrimp tempura', 'tempura crevette', 'tempura'], image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&q=80' },
  { keywords: ['edamame'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['satay'], image: 'https://images.unsplash.com/photo-1548940740-204726a19be3?w=300&q=80' },
  { keywords: ['pad thai'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['fried rice', 'riz cantonais', 'riz sauté', 'riz gras'], image: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=300&q=80' },
  { keywords: ['teriyaki'], image: 'https://images.unsplash.com/photo-1548940740-204726a19be3?w=300&q=80' },
  { keywords: ['sweet & sour', 'general tao', 'bœuf aux oignons', 'boeuf aux oignons'], image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&q=80' },
  { keywords: ['thai green curry', 'thai red curry', 'curry vert', 'curry rouge'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['singapore noodles', 'noodles', 'bo bun', 'nouilles'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['mango sticky rice'], image: 'https://images.unsplash.com/photo-1711161988375-da7eff032e45?w=300&q=80' },
  { keywords: ['coconut tapioca'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['lychee'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },
  { keywords: ['tom yum'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' },
  { keywords: ['bao'], image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=300&q=80' },
  { keywords: ['papaye verte', 'mangue verte'], image: 'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=300&q=80' },
  { keywords: ['canard laqué', 'canard laque'], image: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=300&q=80' },
  { keywords: ['mi krob'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['bubble tea'], image: 'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=300&q=80' },
  { keywords: ['nouilles froides'], image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&q=80' },
  { keywords: ['eau de coco'], image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=300&q=80' },

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
  { keywords: ['hummus beiruti', 'hummus', 'houmous'], image: 'https://images.unsplash.com/photo-1622542796254-5b9c46ab0d2f?w=300&q=80' },
  { keywords: ['moutabal', 'baba ganoush'], image: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb8?w=300&q=80' },
  { keywords: ['labneh'], image: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=300&q=80' },
  { keywords: ['tabbouleh', 'tabboulé', 'taboulé', 'fattoush'], image: 'https://images.unsplash.com/photo-1594179047519-f347310d3322?w=300&q=80' },
  { keywords: ['falafel'], image: 'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=300&q=80' },
  { keywords: ['kebbeh'], image: 'https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=300&q=80' },
  { keywords: ['halloumi'], image: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=300&q=80' },
  { keywords: ['shawarma'], image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=300&q=80' },
  { keywords: ['mixed grill', 'mezze', 'meze'], image: 'https://images.unsplash.com/photo-1608835291093-394b0c943a75?w=300&q=80' },
  { keywords: ['kafta'], image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=300&q=80' },
  { keywords: ['mouhalabieh'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['kunafa', 'künefe', 'kunefe'], image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&q=80' },
  { keywords: ['dates & nuts', 'dates'], image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&q=80' },
  { keywords: ['ayran'], image: 'https://images.unsplash.com/photo-1558113583-d75f23fcb8a9?w=300&q=80' },

  // --- Turc / Kebab (spécifique) ---
  { keywords: ['iskender'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['lahmacun'], image: 'https://images.unsplash.com/photo-1741166985167-14b7178f15b7?w=300&q=80' },
  { keywords: ['pide'], image: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=300&q=80' },
  { keywords: ['böreks', 'boreks', 'sigara böregi', 'sigara boregi', 'cigares au fromage'], image: 'https://images.unsplash.com/photo-1628281161295-269ade51d28d?w=300&q=80' },
  { keywords: ['adana', 'beyti', 'kofte', 'köfte'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['shish taouk', 'shish', 'brochette'], image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&q=80' },
  { keywords: ['loukoum'], image: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=300&q=80' },
  { keywords: ['sütlaç', 'sutlac', 'riz au lait'], image: 'https://images.unsplash.com/photo-1590055619273-44b5b6ce52e8?w=300&q=80' },
  { keywords: ['salgam', 'şalgam'], image: 'https://images.unsplash.com/photo-1542518392-13317b1ee2a2?w=300&q=80' },
  { keywords: ['thé turc'], image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=300&q=80' },

  // --- Cuisine africaine / ivoirienne ---
  { keywords: ['mafé', 'mafe'], image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=300&q=80' },
  { keywords: ['alloco', 'manioc'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80' },
  { keywords: ['thieboudienne', 'thiéboudienne'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&q=80' },
  { keywords: ['yassa'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=300&q=80' },
  { keywords: ['attiéké', 'attieke'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['kedjenou'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['riz gras', 'sauce graine'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['accras', 'pastels', 'beignets de crevettes'], image: 'https://images.unsplash.com/photo-1696265498747-efc4c0dd7b98?w=300&q=80' },
  { keywords: ['bissap'], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&q=80' },
  { keywords: ['gâteau à l\'ananas', 'gateau ananas'], image: 'https://images.unsplash.com/photo-1621236378699-8597faf6a176?w=300&q=80' },

  // --- Healthy / Poke / Bowls ---
  { keywords: ['salmon poke', 'spicy salmon poke'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['tuna poke', 'spicy tuna poke'], image: 'https://images.unsplash.com/photo-1597958792579-bd3517df6399?w=300&q=80' },
  { keywords: ['teriyaki chicken poke', 'crispy chicken poke'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80' },
  { keywords: ['shrimp poke'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },
  { keywords: ['tofu poke', 'vegan poke', 'build your own poke', 'poke'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=80' },
  { keywords: ['caesar', 'césar'], image: 'https://images.unsplash.com/photo-1512852939750-1305098529bf?w=300&q=80' },
  { keywords: ['mediterranean bowl', 'avocado quinoa bowl', 'protein chicken bowl', 'falafel bowl'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80' },
  { keywords: ['açai', 'acai'], image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&q=80' },
  { keywords: ['chia'], image: 'https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=300&q=80' },
  { keywords: ['yaourt', 'yoghurt', 'yogurt', 'compote'], image: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=300&q=80' },
  { keywords: ['energy balls', 'barres céréales', 'barres cereales'], image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=300&q=80' },
  { keywords: ['galettes de quinoa', 'quinoa'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['perles de coco'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
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
  { keywords: ['mozzarella sticks', 'jalapeño poppers', 'jalapeno poppers'], image: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300&q=80' },
  { keywords: ['apple pie'], image: 'https://images.unsplash.com/photo-1621236378699-8597faf6a176?w=300&q=80' },
  { keywords: ['donut'], image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300&q=80' },
  { keywords: ['chili sin carne', 'chili con carne'], image: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?w=300&q=80' },
  { keywords: ['popcorn'], image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=300&q=80' },
  { keywords: ['bonbons', 'chewing-gum', 'chewing gum'], image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&q=80' },
  { keywords: ['cocktail prêt', 'cocktail pret'], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&q=80' },
  { keywords: ['biltong'], image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80' },

  // --- Belge / Friterie ---
  { keywords: ['fricadelle', 'mexicano', 'viandelle', 'boulette'], image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&q=80' },
  { keywords: ['croquette de fromage', 'croquette de crevettes', 'croquette'], image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=300&q=80' },
  { keywords: ['gaufre'], image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&q=80' },
  { keywords: ['mousse au chocolat'], image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=300&q=80' },
  { keywords: ['tarte au sucre'], image: 'https://images.unsplash.com/photo-1580217593608-61931cefc821?w=300&q=80' },
  { keywords: ['sauce andalouse', 'andalouse', 'samouraï', 'samourai', 'ketchup', 'mayonnaise', 'tartare', 'brazil'], image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80' },
  { keywords: ['moules'], image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=300&q=80' },

  // --- Génériques (fallback) ---
  { keywords: ['kebab', 'durum', 'chawarma', 'grillades', 'grill'], image: 'https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=300&q=80' },
  { keywords: ['sandwich', 'panini', 'wrap', 'croque'], image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&q=80' },
  { keywords: ['hot-dog', 'hot dog'], image: 'https://images.unsplash.com/photo-1612392061787-2d078b3e573c?w=300&q=80' },
  { keywords: ['glace', 'mochi', 'sorbet'], image: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=300&q=80' },
  { keywords: ['cheesecake'], image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&q=80' },
  { keywords: ['fondant au chocolat', 'chocolate fondant', 'fondant chocolat'], image: 'https://images.unsplash.com/photo-1673551490812-eaee2e9bf0ef?w=300&q=80' },
  { keywords: ['crème brûlée', 'creme brulee'], image: 'https://images.unsplash.com/photo-1676300184943-09b2a08319a3?w=300&q=80' },
  { keywords: ['cookie aux pépites', 'chocolate chip cookie'], image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300&q=80' },
  { keywords: ['tarte aux pommes', 'apple pie', 'apple tart'], image: 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=300&q=80' },
  { keywords: ['brownie'], image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&q=80' },
  { keywords: ['tiramisu', 'tiramisù'], image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&q=80' },
  { keywords: ['panna cotta', 'cannoli'], image: 'https://images.unsplash.com/photo-1626803775151-61d756612f97?w=300&q=80' },
  { keywords: ['chocolat chaud', 'hot chocolate'], image: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=300&q=80' },
  { keywords: ['chocolat', 'cioccolato', 'cookie', 'biscuit', 'gâteau', 'gateau', 'cake', 'tarte', 'baklava', 'fondant'], image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80' },
  { keywords: ['milkshake'], image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300&q=80' },
  { keywords: ['fanta'], image: 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=300&q=80' },
  { keywords: ['sprite'], image: 'https://images.unsplash.com/photo-1629654613528-5d0a2e4166de?w=300&q=80' },
  { keywords: ['fuze tea', 'peach iced tea', 'thé glacé pêche', 'ice tea pêche'], image: 'https://images.unsplash.com/photo-1601390395693-364c0e22031a?w=300&q=80' },
  { keywords: ['ice tea', 'iced tea', 'thé glacé', 'the glace'], image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=300&q=80' },
  { keywords: ['limonade', 'lemonade', 'limeade', 'citronnade', 'limonata', 'lemon mint'], image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=300&q=80' },
  { keywords: ['energy drink'], image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&q=80' },
  { keywords: ['root beer'], image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=300&q=80' },
  { keywords: ['coca', 'soda cola'], image: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=300&q=80' },
  { keywords: ['eau pétillante', 'eau petillante', 'sparkling water', "san pellegrino", 'acqua panna', 'spa reine'], image: 'https://images.unsplash.com/photo-1571167530149-c72f2e00cc22?w=300&q=80' },
  { keywords: ['eau plate', 'still water', 'eau citronnée'], image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=300&q=80' },
  { keywords: ['latte matcha', 'matcha latte'], image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&q=80' },
  { keywords: ['lait d\'amande', 'lait demi', 'lait entier', 'lait ', 'milk'], image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&q=80' },
  { keywords: ['café', 'cafe', 'expresso', 'espresso'], image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80' },
  { keywords: ['bière', 'biere'], image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80' },
  { keywords: ['vin', 'prosecco', 'chianti', 'limoncello'], image: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=300&q=80' },
  { keywords: ["jus d'orange", 'orange juice', 'jus pressé orange'], image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300&q=80' },
  { keywords: ['jus de pomme', 'apple juice', 'jus pressé pomme'], image: 'https://images.unsplash.com/photo-1727989815707-1b9e8f376775?w=300&q=80' },
  { keywords: ['jus', 'aranciata', 'lemonata', 'mango drink', 'pack sodas', 'pack de sodas'], image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&q=80' },
  { keywords: ['thé', 'the', 'tea'], image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=80' },
  { keywords: ['pain', 'croissant', 'viennoiserie', 'éclair', 'eclair', 'cramique', 'financier', 'cannelé', 'canele', 'muffin', 'baguette', 'chausson'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&q=80' },
  { keywords: ['poulet', 'chicken', 'beignet'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=300&q=80' },
  { keywords: ['riz', 'curry', 'cantonais'], image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=300&q=80' },
  { keywords: ['saumon', 'salmon', 'poisson', 'thon', 'tuna', 'shrimp', 'crevette'], image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=300&q=80' },
  { keywords: ['chips', 'cacahuète', 'cacahuete', 'bretzel', 'apéro', 'apero', 'olives', 'biltong', 'saucisson', 'fruits secs'], image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80' },
  { keywords: ['légume', 'legume', 'quiche'], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&q=80' },
  { keywords: ['œufs', 'oeufs', 'eggs'], image: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=300&q=80' },
  { keywords: ['salade de fruits', 'fruit salad'], image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=300&q=80' },
  { keywords: ['salade', 'bowl', 'buddha'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&q=80' },
  { keywords: ['soupe', 'soup', 'velouté', 'veloute'], image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=80' }
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
  'parma': U('1550401728-539ebf40d9e9'),
  'mortadella & pistacchio': U('1716237388431-c6e5f4b754c7'),
  'prosciutto e funghi': U('1617470702892-e01504297e84'),
  'vegetariana': U('1621998257812-20849f2491f3'),
  'calzone': U('1753656681797-3234c89d6d4d'),
  'marinara': U('1559183533-ee5f4826d3db'),
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
  'tuna nigiri ×2': U('1617196034796-73dfa7b1fd56'),
  'salmon box': U('1709984110217-57d7d18e5299'),
  'california box': U('1653122024993-31e02aedb1ac'),
  'sushi mix': U('1636425730695-febe95eda12e'),

  // --- Sandwichs (Boulangerie / Night Shop — jusqu'à 9 plats partageaient la même photo) ---
  'sandwich jambon-fromage': U('1481070414801-51fd732d7184'),
  'panini jambon-fromage': U('1481070414801-51fd732d7184'),
  'sandwich poulet-crudités': U('1554433607-66b5efe9d304'),
  'sandwich poulet': U('1554433607-66b5efe9d304'),
  'sandwich thon-crudités': U('1655279562015-047c3da9a271'),
  'sandwich végétarien': U('1528736235302-52922df5c122'),
  'sandwich saumon-fromage frais': U('1539252554453-80ab65ce3586'),
  'wrap poulet curry': U('1496113269490-84ffe1a410cb'),
  'croque-monsieur': U('1540713434306-58505cf1b6fc'),
  'panini poulet': U('1559054663-e8d23213f55c'),
  'formule sandwich + boisson': U('1553909489-cd47e0907980'),
  'pack soirée (sandwich, chips & boisson)': U('1553909489-cd47e0907980'),
  'sandwich thon': U('1528735602780-2552fd46c7af'),

  // --- Apéro / chips (Supermarché / Night Shop — jusqu'à 8 produits partageaient la même photo) ---
  'chips nature 150g': U('1647764430080-6000fbe7efee'),
  'chips 150g': U('1736883624742-61826190b91a'),
  'cacahuètes salées': U('1626697556426-8a55a8af4999'),
  'chips paprika 150g': U('1641693148759-843d17ceac24'),
  'olives marinées 200g': U('1786175705114-8757e45fae8b'),
  'olives marinées': U('1786175705114-8757e45fae8b'),
  'crackers apéro 100g': U('1708746333890-8e775f97f0a6'),
  'mix apéro noix 150g': U('1616252576862-bd9abd7467f9'),
  'mix apéro': U('1701341964637-94945a277fe0'),
  'saucisson sec': U('1764436988814-4eff7322ee9c'),
  'fruits secs mélangés 200g': U('1600189020840-e9918c25269d'),

  // --- Boulangerie (viennoiseries et tartes qui partageaient toutes la même photo) ---
  'pain aux raisins': U('1498099916438-d96f52d0c7ff'),
  'chausson aux pommes': U('1530610476181-d83430b64dcd'),
  'muffin myrtille': U('1702742322469-36315505728f'),
  'financier amande': U('1635348965813-fa7d0dfb99d2'),
  'cannelé': U('1483695028939-5bb13f8648b0'),
  'baguette tradition': U('1587912001191-0cd4f14fd89e'),
  'tarte flamiche': U('1564354273277-c6d4b8532100'),
  'pain au chocolat': U('1715187985248-84b03aabe629'),
  'éclair au chocolat': U('1701551706185-eeb97b17de55'),
  'cookie pépites': U('1499636136210-6f4ee915583e'),
  'tarte citron meringuée': U('1683806627629-a7edf7262176'),

  // --- Sushi (rolls et maki qui partageaient tous la même photo) ---
  'cucumber maki ×6': U('1579871494447-9811cf80d66c'),
  'salmon maki ×6': U('1582450871972-ab5ca641643d'),
  'tuna maki ×6': U('1635526910429-051cf1ed127e'),
  'spicy tuna roll ×8': U('1633478062482-790e3b5dd810'),
  'salmon avocado roll ×8': U('1730900737644-e146f78db8e7'),
  'crispy chicken roll ×8': U('1648146299257-080ffe5968f8'),
  'shrimp tempura roll ×8': U('1580822184713-fc5400e7fe10'),

  // --- Asiatique (nouilles/teriyaki/gyoza qui partageaient toutes la même photo) ---
  'chicken teriyaki noodles': U('1619371042685-827b1c646923'),
  'beef teriyaki noodles': U('1619371000980-ec90e765eb32'),
  'chicken teriyaki': U('1695606452836-c3c6e62d407b'),
  'beef teriyaki': U('1732988978816-ce0c78c79f4c'),
  'shrimp pad thai': U('1619371067654-315ebd0f0087'),
  'vegetable pad thai': U('1732988978863-ea51837b5f54'),
  'spicy chicken noodles': U('1707546944460-dda9069b9c1e'),
  'singapore noodles': U('1645500498403-970672caf43e'),
  'chicken gyoza': U('1638502338747-f7f368214cce'),
  'vegetable gyoza': U('1551638059-d1fb82606c4a'),
  'chicken spring rolls': U('1638502521795-89107ac5e246'),
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
  'menu durum bœuf (frites & boisson)': U('1594489883219-010b0e5eeb9d'),
  'menu mixed grill (frites & boisson)': U('1653982960203-c8361d7bed96'),
  'menu adana (frites & boisson)': U('1620167789273-d66c723fe754'),
  'assiette mixte grillades': U('1532636875304-0c89119d9b4d'),
  'chawarma bœuf': U('1620167790054-de54f34308bb'),
  'durum végétarien': U('1748955308143-5055af50bba6'),
  'durum poulet': U('1644364935906-792b2245a2c0'),
  'adana kebab': U('1565560665129-4831aa15206c'),
  'shish taouk': U('1629450748686-c86699b710ac'),
  'beyti kebab': U('1676300186554-671b04fed976'),
  'kofte grillé': U('1733860539640-cfb176102773'),

  // --- City Burger (menu générique 83 produits — variantes qui partageaient toutes la même photo) ---
  'hamburger': U('1568901346375-23c9450c58cd'),
  'cheeseburger': U('1551782450-a2132b4ba21d'),
  'royal cheddar burger': U('1606755962773-d324e0a13086'),
  'menu royal cheddar burger': U('1606755962773-d324e0a13086'),
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
  'double philly cheese': U('1703219342329-fce8488cf443'),
  'menu double philly cheese': U('1703219342329-fce8488cf443'),
  'peppery cheese': U('1566217688581-b2191944c2f9'),

  // --- Boucherie ---
  "jambon d'ardenne": U('1460122109654-7e46ab4fc9b9'),
  'pâté de campagne': U('1462837019796-6f0204b48d95'),
  'terrine de canard': U('1694460263761-c93d3759f4b3'),
  'rillettes de porc': U('1694460265637-5beb1d12a92e'),
  'salade de museau': U('1663250540918-42681cb3aa91'),
  'fromage de tête': U('1571513062809-2ac71eab2656'),
  'boudin blanc': U('1552913903-2cffa1962dc7'),
  'entrecôte de bœuf': U('1690983325551-b922137727be'),
  'filet pur de bœuf': U('1690983323238-0b91789e1b5a'),
  "côte à l'os": U('1603048297172-c92544798d5a'),
  'steak haché pur bœuf': U('1690983330536-3b0089d07cf9'),
  'escalope de poulet fermier': U('1588347818036-558601350947'),
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

  // --- Burgers / Fried Chicken (variantes qui partageaient toutes la même photo) ---
  'spicy chicken burger': U('1610440042657-612c34d95e9f'),
  'avocado chicken burger': U('1596649299486-4cdea56fd59d'),
  'truffle burger': U('1609167830220-7164aa360951'),
  'oklahoma onion burger': U('1611698529094-6a518c46a0de'),
  'chicken burger menu': U('1609167830240-fc81e9cfd9bf'),

  // --- Asiatique ---
  'thai green curry chicken': U('1761315412830-2f59480377b0'),
  'thai red curry beef': U('1761314037211-63fff18c5187'),
  'beef fried rice': U('1578160112054-954a67602b88'),
  'vegetable fried rice': U('1765872690457-2b1d2b8ca6d8'),

  // --- Sushi ---
  'salmon lovers': U('1607301406259-dfb186e15de8'),
  'sushi deluxe': U('1737501844370-e59fb449880d'),
  'veggie box': U('1568899466260-b6d4e061856f'),

  // --- Mexicain ---
  'beef burrito bowl': U('1582169296194-e4d644c48063'),
  'vegan bowl': U('1666799529588-29608a22beb5'),
  'spicy shrimp bowl': U('1726801869046-11ef5bb18adc'),
  'nachos & guacamole': U('1680350681703-5879c3be90d3'),
  'loaded nachos': U('1551020690-d3a2c9defc27'),

  // --- Libanais ---
  'beef shawarma': U('1665989215795-f67f4723087d'),
  'kafta wrap': U('1653983194833-7a10838b12f4'),
  'chicken shawarma plate': U('1670164745494-30747c120652'),
  'beef shawarma plate': U('1736928634472-abd43ed645a9'),
  'kafta plate': U('1670164745513-f4fd1684d780'),
  'falafel wrap': U('1664455289851-e13c0f803cc0'),
  'falafel plate': U('1670164747019-3b4d77128a71'),
  'vegetarian mezze': U('1670165088604-5a39f5c1be51'),
  'mixed mezze': U('1718801594068-a7b7c5aeccb4'),

  // --- Healthy ---
  'spicy salmon poke': U('1780805663865-c9ab052da2e4'),
  'tofu poke': U('1771154141872-e5ad3905a385'),
  'vegan poke': U('1606756790138-261d2b21cd75'),
  'build your own poke': U('1661257711676-79a0fc533569'),
  'mediterranean bowl': U('1579887829494-5b736888265a'),
  'avocado quinoa bowl': U('1556040221-a1efce785fcc'),
  'protein chicken bowl': U('1626204983652-f43427142ce1'),
  'avocado side': U('1602292705803-518f65289bc8'),
  'açai bowl': U('1565299572355-c129dd338fc5'),

  // --- Italien ---
  'linguine gamberi': U('1498579150354-977475b7ea0b'),
  'truffle tagliatelle': U('1616299915952-04c803388e5f'),
  'tagliatelle al ragù': U('1597131628347-c769fc631754'),
  'lasagna bolognese': U('1633337474564-1d9478ca4e2e'),
  'penne amatriciana': U('1599984615649-3307ec0ef478'),
  'rigatoni alla vodka': U('1664214649080-52c879182270'),
  'ravioli ricotta & spinach': U('1587206668283-c21d974993c3'),

  // --- Fried Chicken ---
  '5 crispy tenders': U('1605291581926-df4bf7ee3e89'),
  '8 crispy tenders': U('1619019187211-adf2f6119afd'),
  '5 tenders menu': U('1627662236973-4fd8358fa206'),
  '10 hot wings': U('1771252399544-43dc3d11a21b'),
  '15 hot wings': U('1517984055083-fd6e1e788e54'),
  '8 wings menu': U('1663430218462-8024770c830e'),

  // --- Belge ---
  'fricadelle spéciale': U('1713517915303-ae3b3429f939'),
  'mexicano': U('1785929163609-dfddfcb0e8c0'),
  'viandelle': U('1738599935343-991708a2895b'),
  'boulette': U('1760304396110-8dc2b644fd05'),

  // --- Végétarien ---
  'curry de pois chiches': U('1582576163090-09d3b6f8a969'),
  'galettes de quinoa': U('1644946762933-8716dd20d0b1'),

  // --- Boissons (variantes qui partageaient toutes la même photo) ---
  'jarritos mango': U('1632852521784-d85d5b62dd62'),
  'jarritos guava': U('1688079305282-77bce3f5d253'),
  'homemade limeade': U('1473425990767-8324e48b48b5'),
  'green smoothie': U('1583577612013-4fecf7bf8f13'),
  'mango smoothie': U('1604298331663-de303fbc7059'),
  'ramune lychee': U('1663870316229-cb3986d34e8c')
};

export function defaultItemImage(item) {
  const name = (item?.name || '').toLowerCase().trim();
  if (ITEM_IMAGE_OVERRIDES[name]) return ITEM_IMAGE_OVERRIDES[name];
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.image;
  }
  return categoryImage(item?.category) || '';
}
