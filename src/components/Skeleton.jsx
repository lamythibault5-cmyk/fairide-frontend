/* LE CHARGEMENT EN BANDEAU ET FEUILLE (fondateur, 2026-10-19, audit « Look and feel », propositions A + B). Avant : trois
 * cartes grises sur du blanc, puis le bandeau iris arrivait d'un coup — l'écran sautait. Maintenant :
 *   - SkeletonCards : des lignes à la forme des vraies lignes (vignette, deux traits), teinte iris pâle qui miroite, au lieu
 *     des cartes grises. Partout où les données se font attendre, y compris dans une feuille déjà affichée ;
 *   - SqueletteEcran : l'écran entier qui attend, bandeau iris compris. Avec `titre` (proposition A : on sait quel écran
 *     s'ouvre), le vrai titre est là dès la première image ; sans (proposition B : le titre vient des données, un commerce,
 *     une commande), des barres blanches translucides miroitent à sa place. Le vélo lime roule sur la route tant que ça
 *     charge. La fiche d'un commerce, qui commence par sa photo, a son propre squelette (SqueletteFiche, plus bas).
 * Styles : « Chargement en bandeau et feuille » dans styles.css. Le vélo roule aussi sur la route des bandeaux déjà affichés
 * tant que leur feuille contient un squelette (même bloc, :has). */
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { experienceApp } from '../natif';
import { useBordAbord } from '../bordAbord';

export function SkeletonCards({ count = 3 }) {
  const { t } = useLanguage();
  // Les lignes grises restent muettes, mais l'attente est dite (audit du 19/10, CROSS-93) : tout aria-hidden, un lecteur
  // d'écran ne trouvait rien sur la page pendant le chargement.
  return (
    <div className="sq-lignes">
      <span className="sr-only" role="status">{t('accountUi.loading')}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sq-ligne" aria-hidden="true">
          <span className="skeleton sq-vignette" />
          <span className="sq-traits"><i className="skeleton" /><i className="skeleton" /></span>
        </div>
      ))}
    </div>
  );
}

/* CHAQUE ÉCRAN ATTEND AVEC SA PROPRE FORME (fondateur, 2026-11-12, capture d'Instagram : « ce qui doit se charger ressemble
 * au squelette »). Avant, l'accueil, Mes commandes, Mes favoris et la fiche d'un commerce montraient tous les mêmes lignes
 * (vignette carrée, deux traits) : rien ne disait ce qui arrivait, et l'écran sautait quand les vraies cartes, d'une tout
 * autre forme, les remplaçaient. Chaque squelette ci-dessous reprend les mesures de ce qu'il annonce (souvent ses classes
 * mêmes : .rest-card.rc, .fav-grille, .une-rail…), pour que le contenu se pose à sa place sans rien pousser.
 * Styles : « Squelettes à la forme de l'écran » dans styles.css. SkeletonCards reste pour les listes de lignes. */
function Annonce() {
  const { t } = useLanguage();
  return <span className="sr-only" role="status">{t('accountUi.loading')}</span>;
}
// Un trait de texte : `l` sa longueur, `h` l'épaisseur du trait, `ligne` la hauteur de la ligne de texte qu'il remplace.
function Trait({ l, h = 11, ligne = h + 6, className = '' }) {
  return <i className={`skeleton sq-trait ${className}`} style={{ width: l, height: h, marginBlock: (ligne - h) / 2 }} />;
}
// Le titre d'une rangée : sa tuile d'icône iris pâle, puis le texte.
function TitreRangee({ l }) {
  return <div className="sq-rangee-titre"><span className="skeleton sq-tuile" /><Trait l={l} h={15} ligne={28} /></div>;
}
function CarteCommerce() {
  return (
    <div className="rest-card rc sq-carte">
      {/* .rc-media : la même proportion que la photo (16/10, 4/3 dans les rangées qui défilent). */}
      <span className="rc-media skeleton sq-carte-photo" />
      <div className="rc-corps">
        <Trait l="68%" h={14} ligne={20} />
        <Trait l="84%" h={10} ligne={16} />
        <Trait l="56%" h={10} ligne={18} />
        <Trait l="52%" h={18} ligne={22} className="sq-carte-badge" />
      </div>
    </div>
  );
}

// L'accueil (RestaurantList) : « À la une » (la grande carte et ses points), puis une rangée de cartes de commerce. `grand` :
// le site sur ordinateur, trois grandes cartes de front et une grille (sl-grille).
export function SqueletteAccueil({ grand = false }) {
  return (
    <div className="sq-accueil sq-entre">
      <Annonce />
      <div aria-hidden="true">
        <section className="liste-section">
          <TitreRangee l="46%" />
          <div className="une-rail sq-une-rail">
            {Array.from({ length: grand ? 3 : 2 }, (_, i) => <span key={i} className="skeleton sq-une" />)}
          </div>
          {!grand && <div className="une-points"><i className="on" /><i /><i /><i /></div>}
        </section>
        {[0, 1].map((n) => (
          <section key={n} className="liste-section">
            <TitreRangee l={n ? '38%' : '52%'} />
            <div className={grand ? 'rest-grid sl-grille' : 'rest-grid rest-grid-scroll sq-rangee'}>
              {Array.from({ length: grand ? 4 : 3 }, (_, i) => <CarteCommerce key={i} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// Les pastilles des cuisines en tête de l'accueil (TeteListe), tant que la liste n'est pas lue : le rond du dessin, le nom.
export function PucesCuisineVides() {
  return Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="lt-puce sq-puce" aria-hidden="true">
      <span className="skeleton sq-puce-rond" />
      <Trait l={[38, 46, 34, 44, 40, 36][i]} h={9} ligne={15} />
    </span>
  ));
}

// Mes commandes (Orders) : le titre « Commandes passées », puis des cartes de commande (photo du commerce, nom, total,
// statut, « Commander à nouveau »). Sur ordinateur, les mêmes morceaux en lignes de tableau.
export function SqueletteCommandes({ count = 3 }) {
  return (
    <div className="sq-commandes sq-entre">
      <Annonce />
      <div aria-hidden="true">
        <div className="sq-commandes-titre"><span className="skeleton sq-horloge" /><Trait l="52%" h={17} ligne={26} /></div>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="sq-commande">
            <span className="skeleton sq-commande-photo" />
            <span className="sq-commande-nom"><Trait l={['62%', '48%', '56%'][i % 3]} h={13} ligne={19} /><Trait l="74%" h={10} ligne={16} /></span>
            <Trait l={52} h={13} ligne={19} className="sq-commande-total" />
            <Trait l={58} h={10} ligne={16} className="sq-commande-articles" />
            <span className="skeleton sq-commande-statut" />
            <span className="sq-commande-actions"><span className="skeleton sq-commande-bouton" /><Trait l={54} h={11} ligne={16} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mes favoris (Favorites) : la grille de deux colonnes de .fav-grille, photo arrondie puis nom et deux lignes.
export function SqueletteFavoris({ count = 4 }) {
  return (
    <div className="sq-entre">
      <Annonce />
      <div className="fav-grille" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="fav-carte">
            <span className="skeleton sq-fav-photo" />
            <Trait l={['72%', '58%', '66%', '52%'][i % 4]} h={13} ligne={19} />
            <Trait l="60%" h={10} ligne={17} />
            <Trait l="34%" h={10} ligne={17} />
            <Trait l="92%" h={9} ligne={17} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* La fiche d'un commerce (RestaurantMenu, FicheCommerce) : sa photo, puis dans la feuille le nom, les pastilles (cuisine,
 * commune, Infos), la description, le choix du mode, et l'aperçu de la carte (des tuiles de plats). `src` : la photo de la
 * carte touchée dans la liste (transitionPhoto.js), qui arrive en grandissant, déjà chargée. */
export function SqueletteFiche({ src = null }) {
  // Sur le site, la photo d'un bord à l'autre comme la fiche elle-même (même mesure) : rien ne se décale à l'arrivée.
  const racine = useRef(null);
  useBordAbord(racine, !experienceApp());
  return (
    <div className="sq-ecran sq-fiche" aria-busy="true" ref={racine}>
      <div className="skeleton sq-photo" aria-hidden="true">{src && <img src={src} alt="" className="sq-photo-img" />}</div>
      <div className="sq-feuille">
        <Annonce />
        <div className="sq-entre" aria-hidden="true">
          <Trait l="62%" h={24} ligne={34} />
          <div className="sq-fiche-pastilles">{[52, 62, 58].map((l, i) => <span key={i} className="skeleton sq-pastille" style={{ width: l }} />)}</div>
          <Trait l="82%" h={11} ligne={20} />
          <span className="skeleton sq-fiche-mode" />
          <Trait l="44%" h={16} ligne={26} className="sq-fiche-sous-titre" />
          <div className="sq-fiche-plats">
            {[0, 1, 2].map((i) => (
              <span key={i} className="sq-fiche-plat">
                <span className="skeleton sq-fiche-plat-photo" />
                <Trait l={['80%', '66%', '74%'][i]} h={11} ligne={18} />
                <Trait l="38%" h={10} ligne={16} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Le vélo « 5a » de la marque (BrandMark.jsx, sans tuile), à la couleur du texte : lime sur le bandeau.
function Velo() {
  return (
    <svg viewBox="-3 5 82 42" width="36" height="18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

export function SqueletteEcran({ titre, haut, lignes = 4 }) {
  return (
    <div className="sq-ecran" aria-busy="true">
      <div className="sq-bandeau">
        <div className="sq-haut">{haut ? <span>{haut}</span> : <span className="skeleton skeleton--iris" style={{ width: '42%' }} aria-hidden="true" />}</div>
        {titre ? <h1 className="sq-titre">{titre}</h1> : <span className="skeleton skeleton--iris sq-titre-barre" aria-hidden="true" />}
        {!titre && <span className="skeleton skeleton--iris sq-sous-barre" aria-hidden="true" />}
        <div className="sq-route" aria-hidden="true"><span className="sq-velo"><Velo /></span></div>
      </div>
      <div className="sq-feuille"><SkeletonCards count={lignes} /></div>
    </div>
  );
}

/* UNE ATTENTE QUI DIT CE QUI SE PASSE, PAR-DESSUS TOUT L'ÉCRAN (fondateur, 2026-10-20, test de l'app Android : « très lent
 * après avoir appuyé sur payer »). Entre l'appui et la page de paiement, il y a la commande à créer, le paiement à
 * préparer, puis le navigateur intégré à ouvrir : deux à quatre secondes sur un téléphone moyen, pendant lesquelles le
 * bouton ne montrait que « … ». L'écran de chargement de l'app (bandeau iris, vélo lime qui roule, feuille blanche) le
 * remplace aussitôt, avec le titre `titre`. Rendu dans <body> (comme EcranPlein) : posé dans la page, `.page-fade` en
 * faisait le repère de son `position: fixed`. */
export function EcranAttente({ titre }) {
  return createPortal(
    <div className="sq-attente" role="status" aria-live="polite">
      <SqueletteEcran titre={titre} lignes={3} />
    </div>,
    document.body
  );
}
