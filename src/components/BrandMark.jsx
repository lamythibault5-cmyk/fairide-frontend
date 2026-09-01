/* Marque Fairide — le cadre de vélo, direction « The frame ».
   Géométrie normalisée sur une boîte 76 × 44 (roues r=12,5 aux centres x=15 et x=61, tube supérieur
   de 44 de long, tube de selle incliné à 42°), posée au centre d'une tuile carrée de 132. Le trait
   fait 5 unités, soit 6,6% de la largeur du cadre — c'est ce rapport, pas la valeur absolue, qui
   fait tenir le dessin à toutes les tailles.

   Sous ~28px les deux tubes se rejoignent en une tache illisible : en dessous de ce seuil on ne
   garde que les deux roues et le tube supérieur, ce qui reste identifiable comme un vélo. */
export default function BrandMark({ size = 34, tile = true, color }) {
  const stroke = color || (tile ? '#C8F03C' : '#3B2FB5');
  const small = size < 28;

  return (
    <span className="mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fairide">
        {tile && <rect width="132" height="132" rx="32" fill="#3B2FB5" />}
        <g transform="translate(28 44)">
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
