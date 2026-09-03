/* Marque Fairide — le cadre de vélo, direction « The frame ».
   Géométrie normalisée sur une boîte 76 × 44 (roues r=12,5 aux centres x=15 et x=61, tube supérieur
   de 44 de long, tube de selle incliné à 42°), posée au centre d'une tuile carrée de 132. Le trait
   fait 5 unités, soit 6,6% de la largeur du cadre — c'est ce rapport, pas la valeur absolue, qui
   fait tenir le dessin à toutes les tailles.

   Sous ~28px les deux tubes se rejoignent en une tache illisible : en dessous de ce seuil on ne
   garde que les deux roues et le tube supérieur, ce qui reste identifiable comme un vélo. */
/* Sans tuile, le viewBox se resserre sur le vélo seul.

   Avec la tuile, le dessin occupe 76 unités sur 132 : à petite taille d'affichage le trait
   devient sub-pixellaire et la marque tourne à la tache. Le filigrane de l'en-tête en faisait
   la démonstration — 18px de côté, soit un trait de 0,7px, parfaitement illisible.

   En retirant la tuile on peut cadrer sur le dessin (3 unités de marge de chaque côté, comme
   la bannière) : le vélo occupe alors toute la largeur de l'élément et son trait retrouve les
   6,6 % réglementaires. La boîte n'est plus carrée mais au rapport du dessin, d'où la hauteur
   calculée plutôt que reprise de `size`. */
export default function BrandMark({ size = 34, tile = true, color }) {
  const stroke = color || (tile ? '#C8F03C' : '#3B2FB5');
  const small = size < 28;
  const height = tile ? size : Math.round((size * 42) / 82);

  return (
    <span className="mark" style={{ width: size, height }}>
      <svg viewBox={tile ? '0 0 132 132' : '-3 5 82 42'} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fairide">
        {tile && <rect width="132" height="132" rx="32" fill="#3B2FB5" />}
        <g transform={tile ? 'translate(28 44)' : undefined}>
          <g fill="none" stroke={stroke} strokeWidth="5">
            <circle cx="15" cy="29" r="12.5" />
            <circle cx="61" cy="29" r="12.5" />
          </g>
          <g fill={stroke}>
            <rect x="16" y="8" width="44" height="5" rx="2.5" />
            {!small && <rect x="13" y="20" width="28" height="5" rx="2.5" transform="rotate(42 27 22.5)" />}
          </g>
        </g>
      </svg>
    </span>
  );
}
