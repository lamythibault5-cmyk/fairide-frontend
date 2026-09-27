/* Marque Fairide — le vélo « 5a » : deux roues, le tube supérieur et le tube de selle, lime sur une
   tuile iris (fichiers du fondateur fairide-5a-tile-lime.svg, 2026-09-27).

   HISTORIQUE, pour ne pas refaire le détour. Le vélo était la marque jusqu'au 2026-09-18, remplacé
   ce jour-là par le bol « Swept plume » (commit 2ab796e). Le fondateur a demandé le retour au vélo le
   2026-09-27. La géométrie ci-dessous est celle du fichier fourni, au chiffre près — c'est aussi
   celle de public/icons/icon.svg. Si un chiffre bouge ici, il bouge dans les icônes, le splash
   (index.html) et la marque belge (BelgianMark.jsx).

   Le dessin vit dans une boîte 76 × 42 (roues r=12,5 centrées en (15; 29) et (61; 29), trait 5),
   posée en (28; 44) dans la tuile de 132.

   SANS TUILE, LA MARQUE EST EN PAYSAGE : la hauteur vaut size × 42/82. C'est pour ça que l'en-tête
   la demande à 78 px de large (Layout.jsx) — un vélo de 44 px de large, la taille du bol carré,
   n'y pèserait que 22 px de haut.

   LE DESSIN EST LE MÊME À TOUTE TAILLE : pas de moyeux (le fondateur les a retirés, 2026-09-27 —
   « pas de point dans les roues »), et pas de version simplifiée en petit. Ses propres fichiers
   (« Fairide Logo & Color Brainstorm », favicon 16/32/48 compris) gardent le tube de selle partout ;
   c'est donc la référence, pas l'ancienne déclinaison « roues + tube supérieur » sous 28 px.

   Animation d'apparition, jouée UNE fois (classes bm-* sous .mark-anime, styles.css) : les roues se
   tracent, puis les tubes. `animer={false}` pour un rendu figé. */
export default function BrandMark({ size = 34, tile = true, color, animer = true }) {
  const trait = color || (tile ? '#C8F03C' : '#3B2FB5');
  const hauteur = tile ? size : Math.round((size * 42) / 82);

  return (
    <span className={`mark${animer ? ' mark-anime' : ''}`} style={{ width: size, height: hauteur }}>
      <svg viewBox={tile ? '0 0 132 132' : '-3 5 82 42'} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fairide" shapeRendering="geometricPrecision">
        {tile && <rect width="132" height="132" rx="32" fill="#3B2FB5" />}
        <g transform={tile ? 'translate(28 44)' : undefined}>
          <g fill="none" stroke={trait} strokeWidth="5" strokeLinecap="round">
            <circle className="bm-roue" cx="15" cy="29" r="12.5" />
            <circle className="bm-roue bm-roue-avant" cx="61" cy="29" r="12.5" />
          </g>
          <g fill={trait}>
            <rect className="bm-tube bm-tube-haut" x="16" y="8" width="44" height="5" rx="2.5" />
            {/* Le <g> porte la rotation, le <rect> l'animation : une transformation CSS sur le
                rect écraserait l'attribut rotate et coucherait le tube à l'horizontale. */}
            <g transform="rotate(42 27 22.5)"><rect className="bm-tube bm-tube-selle" x="13" y="20" width="28" height="5" rx="2.5" /></g>
          </g>
        </g>
      </svg>
    </span>
  );
}
