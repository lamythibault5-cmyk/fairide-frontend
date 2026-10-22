// Passerelle entre les mots d'OpenStreetMap (tag « cuisine » et type d'établissement, en anglais, libres) et
// les spécialités de Fairide (specialites.js, depuis le 2026-10-22 : « turkish » donne Turc et plus Kebab & Grill). Une
// fiche trouvée sur le web arrive avec « pizza;italian » ou « fast_food » : on en tire la spécialité la plus probable, que
// le restaurateur peut changer d'un clic. Rien de savant : le premier mot connu l'emporte (les plus précis d'abord :
// « fish_and_chips » avant « fish », « korean » avant « bbq »), rien à défaut.
const CORRESPONDANCES = [
  ['pizza', 'Pizza'], ['burger', 'Burgers'], ['sushi', 'Sushi'], ['ramen', 'Ramen'], ['japanese', 'Japonais'], ['poke', 'Poke Bowl'],
  ['pasta', 'Pâtes'], ['italian', 'Italien'], ['friterie', 'Friterie'], ['fries', 'Friterie'], ['belgian', 'Belge'], ['french', 'Français'],
  ['thai', 'Thaïlandais'], ['vietnamese', 'Vietnamien'], ['dim_sum', 'Dim sum'], ['chinese', 'Chinois'], ['korean', 'Coréen'], ['indonesian', 'Indonésien'],
  ['pakistani', 'Pakistanais'], ['nepalese', 'Népalais & Tibétain'], ['afghan', 'Afghan'], ['indian', 'Indien'], ['asian', 'Asiatique'],
  ['turkish', 'Turc'], ['greek', 'Grec'], ['shawarma', 'Shawarma'], ['falafel', 'Falafel'], ['kebab', 'Kebab & Grill'],
  ['steak_house', 'Steakhouse'], ['bbq', 'Barbecue'], ['barbecue', 'Barbecue'], ['grill', 'Grillades'],
  ['tex-mex', 'Tex-Mex'], ['mexican', 'Mexicain'], ['peruvian', 'Péruvien'], ['brazilian', 'Brésilien'], ['argentin', 'Argentin'], ['caribbean', 'Antillais'],
  ['lebanese', 'Libanais'], ['syrian', 'Syrien'], ['persian', 'Iranien'], ['iranian', 'Iranien'], ['armenian', 'Arménien'],
  ['moroccan', 'Marocain'], ['tunisian', 'Tunisien'], ['algerian', 'Algérien'],
  ['congolese', 'Congolais'], ['senegalese', 'Sénégalais'], ['cameroon', 'Camerounais'], ['ethiopian', 'Éthiopien & Érythréen'], ['eritrean', 'Éthiopien & Érythréen'],
  ['african', 'Africain'], ['portuguese', 'Portugais'], ['spanish', 'Espagnol'], ['tapas', 'Espagnol'], ['polish', 'Polonais'], ['georgian', 'Géorgien'],
  ['wings', 'Chicken wings'], ['chicken', 'Fried Chicken'], ['hot_dog', 'Hot-dog'], ['bagel', 'Bagels'],
  ['coffee', 'Coffee Shop'], ['cafe', 'Coffee Shop'], ['bakery', 'Boulangerie'], ['pastry', 'Pâtisserie'], ['butcher', 'Boucherie'],
  ['supermarket', 'Supermarché'], ['convenience', 'Night Shop'], ['greengrocer', 'Primeur'], ['cheese', 'Fromagerie'], ['deli', 'Épicerie fine'],
  ['crepe', 'Crêpes'], ['waffle', 'Gaufres'], ['donut', 'Cookies & Donuts'], ['chocolate', 'Chocolatier'], ['ice_cream', 'Glacier'], ['dessert', 'Desserts & Glaces'],
  ['breakfast', 'Petit-déjeuner & Brunch'], ['brunch', 'Petit-déjeuner & Brunch'], ['juice', 'Jus & Smoothies'], ['sandwich', 'Sandwichs & Salades'], ['salad', 'Bar à salades'],
  ['fish_and_chips', 'Fish & chips'], ['seafood', 'Poisson & Fruits de mer'], ['fish', 'Poisson & Fruits de mer'], ['vegan', 'Vegan'], ['vegetarian', 'Végétarien'],
  ['healthy', 'Healthy'], ['bubble_tea', 'Bubble Tea']
];

export function cuisineDepuisOsm(cuisine, type) {
  const mots = `${cuisine || ''};${type || ''}`.toLowerCase();
  for (const [mot, valeur] of CORRESPONDANCES) if (mots.includes(mot)) return valeur;
  return null;
}
