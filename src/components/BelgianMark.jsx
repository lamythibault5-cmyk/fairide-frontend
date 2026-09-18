/* Déclinaison belge de la marque — le bol fumant, la vapeur aux couleurs du drapeau.

   Même idée qu'avant (un bol, trois traits de vapeur noir-jaune-rouge), redessinée au propre le
   2026-09-18 à la demande du fondateur (« plus grand, plus propre, plus esthétique, même logo ») :
   - la vapeur est faite de TROIS ARCS CONCENTRIQUES, même centre, même ouverture (de 200° à 340°),
     même épaisseur, espacés régulièrement — là où les anciennes courbes partaient chacune dans
     leur direction et se lisaient comme un gribouillis à petite taille ;
   - l'ordre du drapeau se lit du bol vers l'extérieur : noir, jaune, rouge ;
   - le bol est un demi-disque plein avec un rebord épais, légèrement incliné (−8°) pour garder un
     peu de vie sans casser la symétrie des arcs ;
   - le tout est posé sur une pastille ronde translucide : elle donne un cadre à la marque dans le
     coin de la bannière et éclaircit le fond sous le trait noir, qui restait sinon à ~2:1 sur l'iris.

   DEUX TONS. `sombre` (défaut) : bol blanc, pastille blanche translucide, pour les fonds foncés
   (la bannière iris). `clair` : bol noir, pastille noire très légère, pour les fonds clairs. Le
   trait noir de la vapeur est noir dans les deux tons — c'est la première bande du drapeau.

   Pas d'animation ici, volontairement : les classes bm-* de styles.css ne s'activent que sous un
   parent `.mark-anime`. La marque belge est un cachet posé dans un coin, pas le logo qui s'annonce. */

/* Couleurs officielles du drapeau — ce ne sont PAS les jetons de la charte (--red, --orange…),
   qui sont des couleurs de statut. Un drapeau ne suit pas la charte : il est ce qu'il est. */
const NOIR = '#141414';
const JAUNE = '#FDDA24';
const ROUGE = '#EF3340';

// Arc de cercle de centre (cx, cy) et de rayon r, de `de` à `a` degrés (0° à droite, sens horaire à l'écran).
function arc(cx, cy, r, de, a) {
  const p = (deg) => { const t = (deg * Math.PI) / 180; return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`; };
  return `M${p(de)} A${r} ${r} 0 0 1 ${p(a)}`;
}

export default function BelgianMark({ size = 34, ton = 'sombre', title }) {
  const corps = ton === 'clair' ? NOIR : '#FFFFFF';
  const pastille = ton === 'clair' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.14)';
  const liseré = ton === 'clair' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.35)';
  // Vapeur : trois arcs de même ouverture, du bol vers l'extérieur.
  const CX = 50; const CY = 52;
  const ARCS = [[12, NOIR], [19.5, JAUNE], [27, ROUGE]];

  return (
    <span className="be-mark" style={{ width: size, height: size }} title={title}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || 'Fairide'} shapeRendering="geometricPrecision">
        <circle cx="50" cy="50" r="48" fill={pastille} stroke={liseré} strokeWidth="1.5" />
        <g fill="none" strokeWidth="5" strokeLinecap="round">
          {ARCS.map(([r, couleur]) => <path key={couleur} d={arc(CX, CY, r, 200, 340)} stroke={couleur} />)}
        </g>
        <g transform="rotate(-8 50 60)">
          <path d="M23 60 A27 27 0 0 0 77 60 Z" fill={corps} />
          <path d="M19 60 H81" stroke={corps} strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </span>
  );
}
