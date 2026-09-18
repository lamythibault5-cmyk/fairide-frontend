/* Déclinaison belge de la marque — « fairide be 15a ».

   C'est le bol de BrandMark, à la géométrie près : même demi-disque r=27 centré en (53; 58), même
   rebord de 7 unités, même inclinaison de −11° autour de (54; 58), mêmes trois courbes de vapeur.
   Seules les couleurs changent : la vapeur porte le tricolore dans l'ordre du drapeau — noir, jaune,
   rouge — au lieu du dégradé d'opacité lime. C'est ce qui remplace le petit drapeau à trois bandes
   qui flottait dans le coin de la bannière d'accueil : un drapeau générique disait « Belgique »,
   celui-ci dit « Fairide, et Fairide est belge », en une seule forme.

   Pourquoi un composant à part et non une option de BrandMark : BrandMark prend UNE couleur et la
   pose partout. Ici il en faut trois, différentes par trait, et la règle « le lime ne vit que sur
   l'iris » ne s'applique pas — ce ne sont pas les couleurs de la marque mais celles du drapeau.
   Mélanger les deux logiques dans un même composant rendrait la prop `color` ambiguë.

   DEUX TONS, et le choix n'est pas cosmétique — mais il ne porte plus que sur le bol et son rebord.
   `sombre` (défaut) les met en blanc, pour les fonds foncés ; `clair` en #141414, pour les fonds
   clairs. Sur l'iris de la bannière, un bol noir tomberait à ~2:1 de contraste et se lirait comme
   une tache : c'est pour ça que l'accueil demande `sombre`. Ne pas inverser sans regarder le fond.

   Le premier trait de vapeur, lui, est noir dans les DEUX tons, puisque le noir est la première
   bande du drapeau (demande du fondateur). Sur l'iris il est donc, lui aussi, à ~2:1 : il se lit
   comme un trait sombre et non comme un trait coloré. C'est assumé — le jaune et le rouge portent
   la lecture, le bol blanc porte la forme, et le noir vient fermer le tricolore. Si un jour ce
   trait doit ressortir sur fond foncé, la sortie n'est pas de l'éclaircir (ce ne serait plus le
   drapeau) mais de poser la marque sur une pastille claire.

   Pas d'animation ici, volontairement : les classes bm-* de styles.css ne s'activent que sous un
   parent `.mark-anime`. La marque belge est un cachet posé dans un coin, pas le logo qui s'annonce. */

/* Couleurs officielles du drapeau telles que livrées dans brand/belgian/ — ce ne sont PAS les
   jetons de la charte (--red, --orange…), qui sont des couleurs de statut et dérivent avec elle.
   Un drapeau ne suit pas la charte : il est ce qu'il est. */
const NOIR = '#141414';
const JAUNE = '#FDDA24';
const ROUGE = '#EF3340';

export default function BelgianMark({ size = 34, ton = 'sombre', title }) {
  /* Le bol et son rebord seuls prennent la couleur qui tranche sur le fond. Les trois traits de
     vapeur, eux, sont maintenant noir-jaune-rouge en propre : le troisième ne suit plus le bol. */
  const corps = ton === 'clair' ? NOIR : '#FFFFFF';

  return (
    <span className="be-mark" style={{ width: size, height: size }} title={title}>
      {/* Même cadrage que BrandMark sans tuile : traits compris, le dessin occupe x[13; 88] et
          y[12; 85], d'où 2 unités de marge sur les quatre côtés. */}
      <svg viewBox="11 9 79 79" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || 'Fairide'} shapeRendering="geometricPrecision">
        <g fill="none">
          {/* Noir, jaune, rouge — l'ordre du drapeau, dans l'ordre des trois traits. */}
          <path d="M52 40 C46 26 30 24 16 28" stroke={NOIR} strokeWidth="6" strokeLinecap="round" />
          <path d="M66 38 C62 20 42 14 24 15" stroke={JAUNE} strokeWidth="6" strokeLinecap="round" />
          <path d="M76 42 C76 33 68 27 58 25" stroke={ROUGE} strokeWidth="6" strokeLinecap="round" />
          <g transform="rotate(-11 54 58)">
            <path d="M26 58 A27 27 0 0 0 80 58 Z" fill={corps} />
            <path d="M21 58 H85" stroke={corps} strokeWidth="7" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </span>
  );
}
