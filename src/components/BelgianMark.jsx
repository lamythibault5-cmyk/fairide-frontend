/* Déclinaison belge de la marque — le vélo « 5a » aux couleurs du drapeau (fichier du fondateur
   fairide-be-5a-tile-iris.svg, 2026-09-27) : roue arrière noire, roue avant rouge, tubes jaunes,
   sur la tuile iris. Même géométrie que BrandMark.jsx, au chiffre près.

   Elle remplace le bol tricolore (« fairide be 15a ») en même temps que le vélo a remplacé le bol
   dans BrandMark. Même rôle : un cachet dans le coin de la bannière d'accueil qui dit « Fairide, et
   Fairide est belge » en une seule forme — pas un drapeau générique.

   Couleurs du drapeau telles que livrées, PAS les jetons de la charte (--red, --orange…) : ce sont
   des couleurs de statut qui dérivent avec elle, et un drapeau ne suit pas la charte.

   La tuile est iris sur une bannière iris : elle se fond dans le fond, seul le vélo se détache.
   C'est le fichier fourni ; la roue noire y est à faible contraste, et c'est assumé — le jaune et le
   rouge portent la lecture.

   Pas d'animation : la marque belge est un cachet posé dans un coin, pas le logo qui s'annonce. */
const NOIR = '#141414';
const JAUNE = '#FDDA24';
const ROUGE = '#EF3340';

export default function BelgianMark({ size = 34, title }) {
  return (
    <span className="be-mark" style={{ width: size, height: size }} title={title}>
      <svg viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || 'Fairide'} shapeRendering="geometricPrecision">
        <rect width="132" height="132" rx="32" fill="#3B2FB5" />
        <g transform="translate(28 44)" fill="none" strokeWidth="5">
          <circle cx="15" cy="29" r="12.5" stroke={NOIR} />
          <circle cx="61" cy="29" r="12.5" stroke={ROUGE} />
        </g>
        <g transform="translate(28 44)" fill={JAUNE}>
          <rect x="16" y="8" width="44" height="5" rx="2.5" />
          <rect x="13" y="20" width="28" height="5" rx="2.5" transform="rotate(42 27 22.5)" />
        </g>
      </svg>
    </span>
  );
}
