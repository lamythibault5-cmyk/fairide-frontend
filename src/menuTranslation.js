// Choix du texte d'un plat selon la langue affichée.
//
// L'API renvoie chaque plat avec son texte d'origine (name/desc, tels que le restaurateur les a
// écrits) et un objet `translations` contenant les deux autres langues — voir attachMenu dans
// routes/restaurants.js côté backend. Le client choisit donc localement, et changer de langue ne
// déclenche aucun rechargement de la carte.
//
// Repli sur le texte d'origine dans trois cas, tous normaux :
//   — la langue demandée EST celle dans laquelle la carte est écrite (pas de traduction, par
//     construction) ;
//   — la carte n'a jamais été traduite (le restaurateur n'a pas encore cliqué sur le bouton) ;
//   — la traduction existe mais est vide, typiquement une description que le restaurateur a
//     laissée vide à la source.
// Mieux vaut afficher le plat dans la mauvaise langue que de laisser un blanc : un client ne peut
// pas commander ce qu'il ne voit pas.
export function localizedItem(item, language) {
  const tr = item?.translations?.[language];
  const name = tr?.name?.trim() ? tr.name : (item?.name || '');
  const desc = tr?.desc?.trim() ? tr.desc : (item?.desc || '');
  return { name, desc };
}

// Vrai si la traduction affichée ne correspond plus au texte source. Sert uniquement à l'écran du
// restaurateur, pour signaler « à retraduire » sans rien effacer.
export function hasTranslation(item, language) {
  return Boolean(item?.translations?.[language]?.name?.trim());
}
