/* Marque Fairide — « Swept plume » (FairRide-logo-spec.md). Un bol penché dont la vapeur est
   rabattue vers l'arrière : le plat ET la course dans une seule forme continue. Elle remplace le
   cadre de vélo, qui disait la livraison mais jamais la nourriture, et qui à petite taille se
   lisait « lunettes » avant « vélo ».

   Toute la géométrie vit dans une boîte 96 × 96, littéralement celle de la spec — c'est la
   référence commune à ce composant, à public/icons/icon.svg, à public/favicon.svg, au splash de
   index.html et à la bannière d'accueil (Landing.jsx). Si un chiffre bouge ici, il bouge partout :
   la spec est la source, pas ce fichier.

   Le bol est un demi-disque r=27 centré en (53, 58) ; le rebord une barre de 7 unités de x=21 à
   x=85 ; l'ensemble est incliné de −11° autour de (54, 58) par un <g> parent. La rotation reste un
   attribut SVG et non une transformation CSS, pour que l'animation d'apparition (qui, elle, est en
   CSS) ne l'écrase pas — c'est la même précaution que prenait l'ancien tube de selle.

   Les trois traits de vapeur descendent en opacité 1 / 0,78 / 0,55 : la vapeur s'efface en
   traînant derrière le bol. Jamais les recolorer séparément, jamais les renverser à droite. */

/* Sous 32px les trois traits de vapeur se collent en une bavure indistincte. En dessous de ce
   seuil on passe à la déclinaison « favicon » de la spec — un seul trait, épaisseurs portées de
   6/7 à 9, bol non incliné — qui est la SEULE simplification approuvée. C'est le cas du pied de
   page (28), de la barre latérale (30), de Auth (26) et du mockup téléphone (22). */

/* Le dessin est vectoriel : net à toute densité d'écran, il n'y a pas de version « haute
   résolution » à fournir. `geometricPrecision` demande au navigateur la géométrie exacte plutôt
   que la vitesse, et les extrémités rondes font le trait propre à grande taille.

   Animation d'apparition : le logo « se dessine » UNE fois quand il arrive à l'écran — le rebord
   se trace, le bol descend depuis le rebord, puis les trois traits de vapeur partent vers
   l'arrière — et reste ensuite immobile. Pas de boucle. Pilotée par les classes `bm-*` et
   `.mark-anime` (voir « Logo animé » dans styles.css) ; `animer={false}` pour un rendu figé
   (aperçus, impressions) ; prefers-reduced-motion la coupe en CSS.

   `pathLength="100"` sur les tracés : le tracé au stroke-dashoffset marche alors avec une seule
   valeur pour TOUS les chemins, quelle que soit leur longueur réelle. Sans ça il faudrait
   remesurer chaque courbe à la main — et les remesurer encore à la moindre retouche. */

/* Sans tuile, le viewBox se resserre sur le dessin seul (marge de 2 unités sur les quatre côtés,
   calculée sur l'étendue réelle traits compris) : la marque occupe alors toute la largeur de
   l'élément au lieu des 67% qu'elle laisse dans la tuile, et son trait garde son épaisseur
   apparente à petite taille. Les deux déclinaisons n'ont pas la même étendue, d'où deux viewBox.
   La boîte est carrée dans les deux cas — contrairement au vélo, qui était en paysage : les
   appels qui posaient une largeur de 78px ont été revus en conséquence. */
const VUE_PLEINE = '11 9 79 79';
const VUE_SIMPLE = '12 19 76 76';

export default function BrandMark({ size = 34, tile = true, color, animer = true }) {
  const trait = color || (tile ? '#C8F03C' : '#3B2FB5');
  const simple = size < 32;

  const dessin = simple ? (
    /* Déclinaison ≤32px : `translate(48 50) scale(0.84) translate(-48 -48)` recentre et resserre
       le dessin épaissi pour qu'il tienne dans la même boîte 96 que la version pleine. */
    <g transform="translate(48 50) scale(0.84) translate(-48 -48)" fill="none">
      <path className="bm-vapeur bm-vapeur-1" pathLength="100" d="M58 44 C52 26 30 20 12 24" stroke={trait} strokeWidth="9" strokeLinecap="round" />
      <path className="bm-bol" d="M18 64 A32 32 0 0 0 82 64 Z" fill={trait} />
      <path className="bm-rebord" pathLength="100" d="M12 64 H88" stroke={trait} strokeWidth="9" strokeLinecap="round" />
    </g>
  ) : (
    <g fill="none">
      <path className="bm-vapeur bm-vapeur-1" pathLength="100" d="M52 40 C46 26 30 24 16 28" stroke={trait} strokeWidth="6" strokeLinecap="round" />
      <path className="bm-vapeur bm-vapeur-2" pathLength="100" d="M66 38 C62 20 42 14 24 15" stroke={trait} strokeWidth="6" strokeLinecap="round" opacity="0.78" />
      <path className="bm-vapeur bm-vapeur-3" pathLength="100" d="M76 42 C76 33 68 27 58 25" stroke={trait} strokeWidth="6" strokeLinecap="round" opacity="0.55" />
      <g transform="rotate(-11 54 58)">
        <path className="bm-bol" d="M26 58 A27 27 0 0 0 80 58 Z" fill={trait} />
        <path className="bm-rebord" pathLength="100" d="M21 58 H85" stroke={trait} strokeWidth="7" strokeLinecap="round" />
      </g>
    </g>
  );

  return (
    <span className={`mark${animer ? ' mark-anime' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox={tile ? '0 0 132 132' : (simple ? VUE_SIMPLE : VUE_PLEINE)} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fairide" shapeRendering="geometricPrecision">
        {tile && <rect width="132" height="132" rx="32" fill="#3B2FB5" />}
        {/* Dans la tuile : 96 × 0,9167 = 88 unités, soit 67% du côté, et 22 unités de marge partout. */}
        {tile ? <g transform="translate(22 22) scale(0.9167)">{dessin}</g> : dessin}
      </svg>
    </span>
  );
}
