import Icone from './Icone';

// Un plat SANS PHOTO dans le Panier : les tuiles « Un dessert ou une boisson avec ça ? » (UpsellPanier.jsx) et la vignette de
// chaque ligne (PanierPage.jsx). Choix du fondateur le 26/10 (maquettes/suggestions-sans-photo, version B) : un rectangle gris
// avec de petits couverts avait l'air d'une photo qui n'a pas chargé.
//
// LE DESSIN dit ce que c'est (une canette, une glace en pot, une part de gâteau…), d'après le nom du plat et son genre (la
// rangée des desserts ou des boissons, ou la section du plat). Sans indice, le dessin générique du genre.
//
// LA COULEUR vient seulement d'un goût ÉCRIT dans le nom (cola, citron, vanille, chocolat…), jamais devinée : « Kulfi » ou
// « Pot de glace » restent iris. Les couleurs sont des jetons --gout-* (styles.css), choisies par l'attribut data-gout.
//
// Ce n'est pas la carte : là, un plat sans photo n'a pas de vignette du tout (docs/agents/design.md, « Dishes without a
// photo »). Ici la tuile garde sa place d'image pour que la rangée reste alignée avec les plats qui ont une photo.

const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function dessin(nom, genre) {
  const n = sansAccent(nom);
  if (genre === 'boisson') {
    if (/coca|\bcola|fanta|sprite|ice ?tea|lipton|schweppes|tropico|oasis|pepsi|7 ?up|red ?bull|canette|33 ?cl/.test(n)) return 'canette';
    if (/\beau\b|\bspa\b|water|chaudfontaine|50 ?cl|1[,.]5 ?l|bouteille/.test(n)) return 'bouteille';
    if (/cafe|espresso|cappuccino|\bthe\b|latte|lungo|chocolat chaud/.test(n)) return 'tasse';
    return 'verre';
  }
  if (genre === 'dessert') {
    if (/cornet/.test(n)) return 'cornet';
    if (/magnum|kulfi|twister|solero|esquimau|batonnet/.test(n)) return 'batonnet';
    if (/haagen|glace|sorbet|boule/.test(n)) return 'potGlace';
    if (/mousse|panna|creme|dame blanche|coupe|verrine|rasmal|riz au lait/.test(n)) return 'verrine';
    if (/gulab|jamun/.test(n)) return 'bol';
    return 'gateau';
  }
  if (/pizza|margherita|calzone/.test(n)) return 'pizza';
  if (/burger/.test(n)) return 'burger';
  if (/frites/.test(n)) return 'frites';
  if (/salade|soupe|bowl|poke/.test(n)) return 'bol';
  return 'restaurants';
}

// Dans l'ordre : « Coca-Cola Zero » est du cola, « Häagen-Dazs Caramel Speculoos » du caramel. « \bcola » : « chocolat » contient
// « cola », et « Mousse chocolat » sortait rouge.
const GOUTS = [
  ['cola', /coca|\bcola|pepsi/],
  ['orange', /fanta|orange|tropico|oasis|abricot/],
  ['citron', /sprite|citron|lemon|7 ?up|schweppes|agrum|\blime\b/],
  ['peche', /ice ?tea|peche/],
  ['eau', /\beau\b|\bspa\b|water|gazeuse/],
  ['cacao', /cafe|espresso|lungo|cappuccino|chocolat|tiramisu|oreo|kinder|cacao|brownie/],
  ['fraise', /fraise|strawberry|framboise|fruits rouges|cerise/],
  ['caramel', /caramel|speculoos|miel/],
  ['vanille', /vanill|creme|panna/],
  ['vert', /pistach|menthe|\bmint|matcha/],
  ['mangue', /mangue|mango|passion/],
  ['lait', /lassi|ayran|yaourt/]
];
function gout(nom) {
  const n = sansAccent(nom);
  return GOUTS.find(([, motif]) => motif.test(n))?.[0];
}

export default function VignetteSansPhoto({ nom, genre, taille = 36, className = '' }) {
  return (
    <span className={`vignette-sans-photo ${className}`} data-gout={gout(nom)} aria-hidden="true">
      <Icone nom={dessin(nom, genre)} taille={taille} />
    </span>
  );
}
