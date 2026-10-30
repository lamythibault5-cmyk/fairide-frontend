import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icone from './Icone';
import BrandMark from './BrandMark';
import { experienceApp, reculVersEcranVu } from '../natif';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import '../ecran-general.css';

/* LES ÉCRANS GÉNÉRAUX EN BANDEAU IRIS ET FEUILLE BLANCHE (fondateur, 2026-10-19, section 4 de finitions-appli.html :
 * « Nouveau mot de passe » dessiné, Valider ma carte et Aide dans la même famille). Des pages qu'on ouvre depuis un e-mail,
 * souvent sans être connecté : elles vivent dans trois cadres, et le bandeau s'y comporte différemment (ecran-general.css).
 *   - Dans l'app (connecté ou non) et sur le site connecté (coquille à barre latérale) : bandeau iris, feuille blanche.
 *   - Sur le site pour un visiteur, sous l'en-tête iris des visiteurs : PAS de second bandeau iris (fondateur, 2026-10-16,
 *     « double bannière, trop lourd ») — le titre passe en encre sur le blanc, comme la connexion (CadreConnexion.jsx).
 * Les deux outils du site (.site-bande, .site-feuille, .site-col--lecture de site-cadre.css) font la largeur et les marges ;
 * ce fichier n'ajoute que la tuile de la marque, le retour rond et les règles des deux autres cadres.
 * Rien du parcours de commande n'est importé ici (EcranCommande.jsx tire ses deux feuilles de style) : ResetPassword.jsx est
 * dans le premier chargement du site, ce fichier aussi. */

const APPLI = experienceApp();

/* `retour` : { vers, etat, libelle } — un lien (Aide → Mon compte). Sans lui, dans l'app connectée, le bandeau porte le
 * « Retour » que Layout pose au-dessus des pages hors des espaces (même geste : page précédente, sinon l'accueil) ; celui de
 * Layout s'efface (ecran-general.css) mais reste dans la page, où le bouton Retour d'Android le trouve (data-retour-natif).
 * `marque` : la tuile du vélo, jamais un lien (fondateur, 2026-10-15). `icone` : une tuile d'icône à la place. */
export function BandeauGeneral({ titre, sous, marque = false, icone = null, retour = null, children }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const retourAppli = !retour && APPLI && !!user;
  const haut = useRef(null);
  const [horsEcran, setHorsEcran] = useState(false);
  /* LE ‹ RESTE À PORTÉE (fondateur, 2026-10-27 : « s'il veut ressortir, il se sent perdu »). Le rond du bandeau part vers le
   * haut avec la page : au milieu de l'Aide (Edenred, un souci, l'adresse de livraison…), plus aucune sortie à l'écran. Dans
   * l'app, dès qu'il est sorti de l'écran, le même ‹ flotte en haut à gauche, en verre clair puisqu'il est alors sur le blanc
   * de la feuille. Sur le site, la barre latérale ou l'en-tête restent là : rien ne change. */
  useEffect(() => {
    if (!APPLI || !(retour || retourAppli) || !haut.current || typeof IntersectionObserver === 'undefined') return undefined;
    // -64 px : passé sous l'heure et la batterie, il est déjà hors de portée du pouce.
    const obs = new IntersectionObserver(([e]) => setHorsEcran(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    obs.observe(haut.current);
    return () => obs.disconnect();
  }, [retour, retourAppli]);
  const rond = (classe) => (retour ? (
    <Link to={retour.vers} state={retour.etat} className={classe} aria-label={retour.libelle} title={retour.libelle}>
      <Icone nom="retour" taille={18} />
    </Link>
  ) : (
    <button type="button" className={classe} aria-label={t('appli.retour')} title={t('appli.retour')}
      onClick={() => (reculVersEcranVu() ? navigate(-1) : navigate('/'))}>
      <Icone nom="retour" taille={18} />
    </button>
  ));
  return (
    <header className="site-bande gn-bandeau">
      {horsEcran && rond('gn-rond gn-rond--flottant')}
      <div className="site-col site-col--lecture">
        {(retour || retourAppli || marque || icone) && (
          <div className="gn-haut" ref={haut}>
            {/* Celui qui flotte le remplace, il ne s'y ajoute pas : à 60 px du haut, le ‹ du bandeau est encore à moitié
                visible sous l'heure, et l'Aide en montrait deux l'un sur l'autre (fondateur, 2026-10-28). */}
            {(retour || retourAppli) && rond(horsEcran ? 'gn-rond gn-rond--cache' : 'gn-rond')}
            {/* Avec un retour, la tuile s'efface : deux pastilles côte à côte se disputaient le coin. */}
            {marque && !retour && !retourAppli && <span className="gn-tuile gn-tuile--marque" aria-hidden="true"><BrandMark size={28} tile={false} color="#C8F03C" animer={false} /></span>}
            {icone && !retour && !retourAppli && <span className="gn-tuile" aria-hidden="true"><Icone nom={icone} taille={20} /></span>}
          </div>
        )}
        <h1 className="site-bande-titre gn-titre">{titre}</h1>
        {sous && <p className="site-bande-sous gn-sous">{sous}</p>}
        {children}
      </div>
    </header>
  );
}

export function FeuilleGenerale({ children }) {
  return <div className="site-feuille gn-feuille"><div className="site-col site-col--lecture">{children}</div></div>;
}

// Le titre de section de la feuille (petites capitales grises, comme le panier et Mon compte).
export function SectionGenerale({ id, children }) {
  return <h2 className="gn-section" id={id}>{children}</h2>;
}
