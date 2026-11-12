/* LES DESSINS GOURMANDS (fondateur, 2026-11-12, maquettes/plus-gourmand/plus-gourmand-2.html, tour 7 : « beaucoup » partout).
 * Les portes d'entrée (accueil de l'app, page d'accueil du site) disaient « prix gonflés » sans montrer à manger. On pose dans le
 * bleu vide les dessins 3D de la barre des cuisines (public/gourmand : Fluent Emoji 3D de Microsoft, licence MIT, en 256 px ;
 * public/cuisines n'a que des copies de 112 px, floues à ces tailles). Ce sont des images décoratives, pas des emojis tapés :
 * la règle « pas d'emoji » tient (design.md, « Les dessins gourmands »).
 *
 * Les règles de placement viennent des sept tours de la maquette : jamais à côté de la phrase choc ni sur ce qui se lit (barre
 * d'adresse, carte des prix, boutons), jamais sur la route où roule le vélo, jamais coupés par un bord, penchés, tailles variées,
 * en grappe plutôt qu'en ligne. Sur le site : rien plus bas que le bandeau sur téléphone, et seulement les marges sur
 * l'ordinateur (« trop » au tour 5). Les CSS donnent la zone de chaque groupe et cachent ce qui ne tient pas : styles.css
 * (« Les dessins gourmands ») pour l'app, site-accueil.css pour le site. */

// Accueil de l'app, entre le titre et le vélo. [nom, x, y, taille, angle, seulement si la zone est haute] : x et y sont des
// fractions de la place libre (largeur ou hauteur de la zone moins la taille du dessin), relevées sur 390 × 844 (zone de
// 346 × 194 px) ; au-delà de 0 → 1, le dessin déborde un peu de la colonne, jamais de l'écran.
const ACCUEIL = [
  ['burger', 0.015, 0.39, 72, -14], ['asiatique', 0.56, 0.47, 80, 9], ['belge', 1.03, 0.37, 70, -18], ['pizza', 0.8, 0.88, 62, 20],
  ['desserts', -0.04, 0.94, 58, 20, true], ['sushi', 1.04, 0.83, 52, 12, true], ['mexicain', 0.26, 0.85, 52, -16, true], ['chinois', 0.3, 0.35, 46, 12, true],
];
// Les autres écrans à bandeau iris de l'accueil : deux petits dessins au bord droit, à hauteur du titre (places dans le CSS).
const BORD = [['pizza', 48, 18], ['burger', 42, -14]];
// Site, téléphone : la grappe en haut à droite du bandeau, à côté du badge et du titre (places dans le CSS).
const SITE_TEL = [['pizza', 52, -16], ['burger', 44, 14], ['sushi', 28, -22]];
// Site, ordinateur : les marges seulement. [nom, côté, fraction de la marge (0 = contre le contenu), hauteur en fraction de
// la page, taille, angle], relevés sur fairride.be à 1440 px (marge de 152 px, page de 2 773 px).
const SITE_MARGES = [
  ['pizza', 'd', 0.64, 0.023, 100, -16], ['burger', 'd', 0.5, 0.13, 84, 12], ['belge', 'g', 0.62, 0.131, 80, -14], ['chinois', 'g', 0.5, 0.028, 50, 14],
  ['mexicain', 'g', 0.62, 0.329, 64, 18], ['pizza', 'd', 0.62, 0.427, 78, 12], ['kebab', 'g', 0.57, 0.645, 70, -16],
  ['asiatique', 'd', 0.67, 0.767, 70, 14], ['sushi', 'g', 0.61, 0.907, 56, -18],
];

function Dessin({ nom, taille, angle, classe = '', style }) {
  return (
    <img className={`gourmand ${classe}`} src={`/gourmand/${nom}.webp`} alt="" width={taille} height={taille} draggable="false"
      decoding="async" style={{ '--t': `${taille}px`, '--a': `${angle}deg`, ...style }} />
  );
}

export function GourmandAccueil() {
  return (
    <div className="bv-gourmand" aria-hidden="true">
      {ACCUEIL.map(([nom, x, y, t, a, plus], i) => (
        <Dessin key={i} nom={nom} taille={t} angle={a} classe={plus ? 'bv-gourmand-plus' : ''} style={{ '--x': x, '--y': y }} />
      ))}
    </div>
  );
}

export function GourmandBord() {
  return (
    <div className="bv-gourmand-bord" aria-hidden="true">
      {BORD.map(([nom, t, a], i) => <Dessin key={i} nom={nom} taille={t} angle={a} />)}
    </div>
  );
}

export function GourmandSite() {
  return (
    <>
      <div className="sa-gourmand-tel" aria-hidden="true">
        {SITE_TEL.map(([nom, t, a], i) => <Dessin key={i} nom={nom} taille={t} angle={a} />)}
      </div>
      <div className="sa-gourmand-marges" aria-hidden="true">
        {SITE_MARGES.map(([nom, cote, f, y, t, a], i) => (
          <Dessin key={i} nom={nom} taille={t} angle={a} classe={cote === 'g' ? 'gauche' : 'droite'} style={{ '--f': f, '--y': y }} />
        ))}
      </div>
    </>
  );
}
