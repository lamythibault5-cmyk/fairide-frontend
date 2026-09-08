// Passerelle entre les mots d'OpenStreetMap (tag « cuisine » et type d'établissement, en anglais, libres) et
// les types de commerce de Fairide (menuCategories.RESTAURANT_TYPES). Une fiche trouvée sur le web arrive
// avec « pizza;italian » ou « fast_food » : on en tire le type le plus probable, que le restaurateur peut
// changer d'un clic. Rien de savant : le premier mot connu l'emporte, « Autre » à défaut.
const CORRESPONDANCES = [
  ['pizza', 'Pizza'], ['burger', 'Burgers'], ['sushi', 'Sushi'], ['japanese', 'Sushi'], ['ramen', 'Ramen'], ['poke', 'Poke Bowl'],
  ['italian', 'Italien'], ['pasta', 'Italien'], ['friterie', 'Friterie'], ['fries', 'Friterie'], ['belgian', 'Belge'],
  ['thai', 'Thaïlandais'], ['vietnamese', 'Vietnamien'], ['chinese', 'Chinois'], ['korean', 'Coréen'], ['indian', 'Indien'], ['asian', 'Asiatique'],
  ['kebab', 'Kebab & Grill'], ['turkish', 'Kebab & Grill'], ['grill', 'Kebab & Grill'], ['mexican', 'Mexicain'], ['lebanese', 'Libanais'], ['syrian', 'Libanais'],
  ['moroccan', 'Marocain'], ['african', 'Africain'], ['spanish', 'Espagnol'], ['tapas', 'Espagnol'], ['chicken', 'Fried Chicken'],
  ['coffee', 'Coffee Shop'], ['cafe', 'Coffee Shop'], ['bakery', 'Boulangerie'], ['pastry', 'Boulangerie'], ['butcher', 'Boucherie'],
  ['supermarket', 'Supermarché'], ['convenience', 'Night Shop'], ['ice_cream', 'Desserts & Glaces'], ['dessert', 'Desserts & Glaces'],
  ['breakfast', 'Petit-déjeuner & Brunch'], ['brunch', 'Petit-déjeuner & Brunch'], ['sandwich', 'Sandwichs & Salades'], ['salad', 'Sandwichs & Salades'],
  ['seafood', 'Poisson & Fruits de mer'], ['fish', 'Poisson & Fruits de mer'], ['vegan', 'Végétarien'], ['vegetarian', 'Végétarien'],
  ['healthy', 'Healthy'], ['bubble_tea', 'Bubble Tea']
];

export function cuisineDepuisOsm(cuisine, type) {
  const mots = `${cuisine || ''};${type || ''}`.toLowerCase();
  for (const [mot, valeur] of CORRESPONDANCES) if (mots.includes(mot)) return valeur;
  return null;
}
