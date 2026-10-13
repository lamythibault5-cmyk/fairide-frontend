// Les « envies » choisies à l'accueil de l'application (pages/app/Bienvenue.jsx, écran « Une envie en particulier ? »),
// et les cuisines qui y répondent. Sorti de Bienvenue.jsx le 2026-10-13 pour que la liste des commerces
// (RestaurantList.jsx, rangée « Vos envies ») range avec exactement la même table que l'écran de résultats de l'accueil :
// deux tables séparées auraient fini par ne plus dire la même chose.
//
// La table ne suffit pas à elle seule (RESTAURANT_TYPES) : la liste publique porte aussi des cuisines saisies
// librement (« Ramen », « Marocain », « Cuisine Saine »…), d'où les synonymes. Un commerce peut répondre à plusieurs envies.
export const CUISINES_PAR_ENVIE = {
  snack: ['Kebab & Grill', 'Friterie', 'Belge', 'Fried Chicken', 'Sandwichs & Salades'],
  pizza: ['Pizza', 'Italien'],
  burger: ['Burgers'],
  monde: ['Asiatique', 'Sushi', 'Ramen', 'Mexicain', 'Libanais', 'Marocain', 'Espagnol', 'Thaïlandais', 'Indien', 'Vietnamien', 'Chinois', 'Africain', 'Coréen'],
  healthy: ['Healthy', 'Cuisine Saine', 'Végétarien', 'Poke Bowl', 'Sandwichs & Salades'],
  sucre: ['Coffee Shop', 'Boulangerie', 'Bubble Tea', 'Desserts & Glaces', 'Petit-déjeuner & Brunch']
};

// Le commerce répond-il à au moins une des envies ? `r.cuisines` (plusieurs) quand la liste les porte, sinon `r.cuisine`.
export function repondAuxEnvies(r, envies) {
  const cuisines = r.cuisines || [r.cuisine, ...(r.extraCuisines || [])].filter(Boolean);
  return envies.some((e) => (CUISINES_PAR_ENVIE[e] || []).some((c) => cuisines.includes(c)));
}
