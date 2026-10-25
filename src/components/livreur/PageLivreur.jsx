import { Link } from 'react-router-dom';
import { experienceApp } from '../../natif';
import { useLanguage } from '../../context/LanguageContext';
import RouteVelo from './RouteVelo';
import '../../ecran-livreur.css';
import '../../site-livreur.css';

/* L'EN-TÊTE DES PAGES SECONDAIRES DU LIVREUR (fondateur, 2026-10-16, maquettes/site-ordinateur/site-ordinateur.html) : Carte et Factures
 * (le dossier jusqu'au 2026-10-25, qui a désormais son propre bandeau, DossierAppli.jsx ; la page Avis, retirée le 22/10/2026) prennent le bandeau iris du tableau de bord et des gains (titre, une phrase, le vélo arrêté sur sa route)
 * et leur contenu passe dans la feuille blanche, à largeur de lecture sur un ordinateur (site-livreur.css).
 *
 * DANS L'APP, SUR DEMANDE (fondateur, 2026-10-19, section 4 de finitions-appli.html) : Carte et Factures passent aussi au
 * bandeau et à la feuille dans l'app (`bandeauApp`). Les autres pages gardent dans l'app leur rendu d'avant — le titre de
 * section, l'intro éventuelle (`introApp`) et le contenu, dans le même conteneur (`classe`).
 *   titre       : le titre de la page (h1 sur le bandeau, h2.section-title dans l'app sans bandeau) ;
 *   sous        : la phrase du bandeau ;
 *   introApp    : ce que la page affichait sous son titre dans l'app sans bandeau, rendu tel quel là-bas ;
 *   classe      : la classe du conteneur d'origine (carte-page…), gardée partout ;
 *   retourCompte: « ← Mon compte » passe sur le bandeau ; celui que Layout pose au-dessus de la page s'efface
 *                 (ecran-livreur.css), et dans une page en feuille c'est le rond ‹ de la feuille qui sert. */
export default function PageLivreur({ titre, sous, introApp = null, classe = '', large = false, bandeauApp = false, retourCompte = false, children }) {
  const { t } = useLanguage();
  if (experienceApp() && !bandeauApp) {
    return (
      <div className={classe || undefined}>
        <h2 className="section-title" style={{ marginTop: 0 }}>{titre}</h2>
        {introApp}
        {children}
      </div>
    );
  }
  return (
    <div className={`ecl ecl-page${large ? ' ecl-page-large' : ''}${classe ? ` ${classe}` : ''}`}>
      <section className={`ecl-bandeau${retourCompte ? ' ecl-bandeau--retour' : ''}`}>
        {retourCompte && (
          <div className="ecl-b-haut">
            <Link to="/account" state={{ restaurerDefilement: true }} className="ecl-b-retour">{t('nav.backToAccount')}</Link>
          </div>
        )}
        <h1 className="ecl-b-titre">{titre}</h1>
        {sous && <p className="ecl-b-sous">{sous}</p>}
        <RouteVelo position={86} />
      </section>
      <div className="ecl-feuille">{children}</div>
    </div>
  );
}
