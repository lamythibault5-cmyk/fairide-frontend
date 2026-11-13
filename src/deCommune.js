/* « DE » DEVANT UN NOM DE COMMUNE, EN FRANÇAIS (revue avant GO du 13/11/2026, client-avant 1). « les commerces de Ixelles » :
 * devant une voyelle, le français élide (« d'Ixelles », « d'Etterbeek », « d'Uccle », « d'Anderlecht », « d'Auderghem »,
 * « d'Evere »). Le texte porte donc la préposition dans sa variable ({deC} : « les commerces {deC} et alentours ») et le code
 * la calcule ici. Devant un h, pas d'élision : les noms de lieux belges en h (Haren, Hal, Herstal, Hannut…) ont un h aspiré
 * (« de Haren ») ; un nom à h muet serait à ajouter ici s'il en vient un. Seul fr.js lit {deC} : le néerlandais et l'anglais
 * gardent {c}. */
export function deCommune(nom) {
  const n = String(nom || '').trim();
  if (!n) return 'de';
  // NFD : « Écaussinnes », « Îles » commencent aussi par une voyelle une fois l'accent séparé.
  return 'aeiouy'.includes(n.normalize('NFD').charAt(0).toLowerCase()) ? `d'${n}` : `de ${n}`;
}
