import { experienceApp } from '../../natif';
import RouteVelo from './RouteVelo';
import '../../ecran-livreur.css';
import '../../site-livreur.css';

/* L'EN-TÊTE DES PAGES SECONDAIRES DU LIVREUR, SUR LE SITE (fondateur, 2026-10-16, mockups/site-ordinateur.html) : Carte,
 * Factures, Avis et le dossier prennent le bandeau iris du tableau de bord et des gains (titre, une phrase, le vélo arrêté
 * sur sa route) et leur contenu passe dans la feuille blanche, à largeur de lecture sur un ordinateur (site-livreur.css).
 *
 * L'APP NE CHANGE PAS : dans l'app, la page garde exactement son rendu d'avant — le titre de section, l'intro éventuelle
 * (`introApp`) et le contenu, dans le même conteneur (`classe`). Le style de l'app vit dans ecran-livreur.css et ailleurs ;
 * rien de ce fichier ne s'y applique.
 *   titre    : le titre de la page (h1 sur le site, h2.section-title dans l'app, comme avant) ;
 *   sous     : la phrase du bandeau, sur le site seulement ;
 *   introApp : ce que la page affichait sous son titre dans l'app (MapPage), rendu tel quel là-bas ;
 *   classe   : la classe du conteneur d'origine (courier-onboarding, carte-page…), gardée sur le site aussi. */
export default function PageLivreur({ titre, sous, introApp = null, classe = '', large = false, children }) {
  if (experienceApp()) {
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
      <section className="ecl-bandeau">
        <h1 className="ecl-b-titre">{titre}</h1>
        {sous && <p className="ecl-b-sous">{sous}</p>}
        <RouteVelo position={86} />
      </section>
      <div className="ecl-feuille">{children}</div>
    </div>
  );
}
