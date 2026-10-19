import { Link, useOutletContext } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { experienceApp } from '../../natif';
import { BandeauCommerce, FeuilleCommerce } from './BandeauCommerce';

// Vrai sur le site, faux dans l'app (native ou écran d'accueil) : constant pour toute la session.
export const SITE = !experienceApp();

/* LE BANDEAU DES AUTRES PAGES DU COMMERCE, SUR LE SITE (2026-10-16, mockups/site-ordinateur.html, lot « pro ») :
 * Promotions, Avis, Factures, Guide et Aperçu client prennent la même famille que Mon commerce et Commandes — « ← Mon
 * compte » et le nom sur le bandeau iris, le titre et sa phrase d'introduction, puis la feuille blanche avec les blocs
 * communs du tableau de bord (DashboardLayout les lui passe, `communs`) et la page elle-même. `lecture` : largeur de
 * lecture (760 px) plutôt que large (1 120 px). Dans l'app rien ne change : un simple <div>, la page garde son titre.
 *
 * `appli` (fondateur, 2026-10-19, section 4 de finitions-appli.html) : Promotions, Avis et Factures prennent le bandeau et
 * la feuille DANS L'APP aussi. DashboardLayout les compte alors parmi ses pages au bandeau (PAGES_BANDEAU), pour que les
 * blocs communs arrivent dans la feuille et non au-dessus de l'iris. `sous` peut être un nœud (les étoiles des avis) ;
 * `classe` vise une page dans ecran-commerce.css (l'impression des factures, par exemple). */
export default function CadreSite({ titre, sous, lecture = false, appli = false, classe = '', children }) {
  const { t } = useLanguage();
  const { restaurant, communs } = useOutletContext() || {};
  if (!SITE && !appli) return <div className={classe || undefined}>{children}</div>;
  return (
    <div className={`sp-page${lecture ? ' sp-page--lecture' : ''}${classe ? ` ${classe}` : ''}`}>
      <BandeauCommerce retour>
        <div className="ec-b-haut">
          <Link to="/account" state={{ restaurerDefilement: true }} className="ec-b-retour">{t('nav.backToAccount')}</Link>
          {restaurant?.name && <span><b>{restaurant.name}</b></span>}
        </div>
        <h1 className="ec-b-titre">{titre}</h1>
        {sous && <div className="ec-b-sous">{sous}</div>}
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        {children}
      </FeuilleCommerce>
    </div>
  );
}
