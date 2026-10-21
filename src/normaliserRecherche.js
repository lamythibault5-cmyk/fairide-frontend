// UNE SEULE FAÇON DE COMPARER UN MOT CHERCHÉ (audit du 19/10, discovery-21). La page Recherche ôtait les accents mais pas
// l'apostrophe typographique d'un iPhone (« L’arbre » ne trouvait pas « L'arbre à pain ») ni les ligatures (« boeuf » ne
// trouvait pas « bœuf ») ; la recherche dans la carte d'un commerce et le filtre de la liste ne retiraient même pas les
// accents (« creme brulee » ne trouvait rien). Les trois passent désormais par ici.
export function normaliserRecherche(texte) {
  return String(texte ?? '')
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Le texte contient-il la requête (déjà normalisée ou pas) ?
export function contientRecherche(texte, requete) {
  const q = normaliserRecherche(requete);
  return !q || normaliserRecherche(texte).includes(q);
}
