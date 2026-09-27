/* Déclinaison belge de la marque — le vélo « 5a » aux couleurs du drapeau, SANS TUILE : roue arrière
   noire, roue avant rouge, tubes jaunes, sur fond transparent (fichier du fondateur
   fairide-be-5a-mark-transparent.svg, dossier « Fairide Logo & Color Brainstorm », 2026-09-27).
   Même géométrie que BrandMark.jsx, au chiffre près.

   Posée AU-DESSUS du titre de la bannière d'accueil, en grand (Landing.jsx) : elle y ouvre la page
   au lieu d'être un cachet dans le coin. Elle remplace le bol tricolore (« fairide be 15a »).

   CADRAGE : viewBox 26 50 80 40, et non le « 26 50 80 32 » du fichier fourni, qui coupait le bas des
   roues (roue centrée en y = 44 + 29 = 73, rayon 12,5 + demi-trait 2,5 → bas à 88). Le dessin est
   en paysage, 2 : 1 — la hauteur vaut la moitié de la largeur.

   Couleurs du drapeau telles que livrées, PAS les jetons de la charte (--red, --orange…) : ce sont
   des couleurs de statut qui dérivent avec elle, et un drapeau ne suit pas la charte.

   CONTRASTE, À SAVOIR : sur l'iris, la roue noire est à ~2:1 — le README du fondateur le dit
   lui-même (« black wheel disappears on dark »). Le jaune et le rouge portent la lecture ; si la
   roue noire doit ressortir, c'est la version sur tuile qu'il faut, pas un noir éclairci.

   Pas d'animation : c'est un cachet, pas le logo qui s'annonce. */
const NOIR = '#141414';
const JAUNE = '#FDDA24';
const ROUGE = '#EF3340';

export default function BelgianMark({ width = 120, title }) {
  return (
    <span className="be-mark" style={{ width, height: width / 2 }} title={title}>
      <svg viewBox="26 50 80 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || 'Fairide'} shapeRendering="geometricPrecision">
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
