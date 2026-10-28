/* LES MENUS DE DÉMARRAGE, HORS DU PREMIER CHARGEMENT (audit du 28/10). Ces tables vivaient dans menuCategories.js, que la
   liste et la fiche des clients importent : 1 500 lignes de plats d'exemple partaient chez chaque visiteur,
   alors qu'elles ne servent plus qu'au sélecteur de photos du commerçant (galleryImages.js, chargé à la demande). Même remède
   que galleryImages.js le 24/10 : le fichier à part, importé par lui seul. Les commentaires du backend qui parlent des
   « templates de menuCategories.js » (server.js) désignent ce fichier-ci. */

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
      { name: 'Milkshake', price: 5.5, desc: 'Vanille, fraise, chocolat ou Oreo, au choix' },
      { name: 'Brownie', price: 4.5, desc: '' },
      { name: 'Cookie', price: 3, desc: '' },
      { name: 'Apple pie', price: 4.5, desc: '' }
    ],
    boisson: [
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs 33cl', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite, Ice Tea, San Pellegrino Aranciata ou Limonata, au choix' },
      { name: 'Eau 50cl', price: 2, desc: '' },
      { name: 'Bouteille 1,5L', price: 4, desc: '' },
      { name: 'Bière 33cl', price: 3, desc: 'Peroni ou Jupiler · au choix' },
      { name: 'Vin 25cl', price: 5.5, desc: 'Rouge ou blanc, au choix' },
      { name: 'Café', price: 2, desc: 'Espresso ou café allongé · au choix' }
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
      { name: 'Bière 33cl', price: 4, desc: 'Singha ou Tsingtao · au choix' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Bière 33cl', price: 4, desc: 'Corona ou Modelo · au choix' },
      { name: 'Jarritos', price: 3.5, desc: '' },
      { name: 'Agua fresca', price: 4, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Wings 6 pcs', price: 7.5, desc: 'Nature, BBQ, buffalo ou hot honey, au choix' },
      { name: 'Wings 12 pcs', price: 13.5, desc: 'Nature, BBQ, buffalo ou hot honey, au choix' },
      { name: 'Wings 24 pcs', price: 24, desc: 'Nature, BBQ, buffalo ou hot honey, au choix' },
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs 33cl', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
      { name: 'Eau 50cl', price: 2, desc: 'Plate ou pétillante · au choix' },
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
      { name: 'Thé en feuilles', price: 3.5, desc: 'Vert, noir ou infusion, au choix' },
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
      { name: 'Softs', price: 2.2, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Bière 33cl', price: 3.5, desc: 'Estrella ou Mahou, au choix' },
      { name: 'Vin Rioja (verre)', price: 5.5, desc: '' },
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' }
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.8, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
      { name: 'Softs', price: 2.5, desc: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite ou Ice Tea, au choix' },
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
