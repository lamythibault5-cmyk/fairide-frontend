import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import { cheminPrecedent } from '../../i18n/historiqueLangue';
import { RouteVelo } from '../TeteListe';
import '../../ecran-liste.css';
import '../../ecran-commerce.css';

/* LE BANDEAU IRIS ET LA FEUILLE BLANCHE DES ÉCRANS DU COMMERCE (fondateur, 2026-10-16, « Proposition » de la partie
   Commerce de maquettes/tous-les-ecrans/tous-les-ecrans.html ; styles dans ecran-commerce.css). Mon commerce, Commandes, Ma carte et
   Statistiques commencent par <BandeauCommerce> (nom, titre, ce qui se règle d'un geste) puis mettent le reste dans
   <FeuilleCommerce>. DashboardLayout ne pose alors plus le nom du commerce au-dessus de la page (`avecBandeau`). */
/* LA ROUTE DU VÉLO SOUS LE TITRE (fondateur, 2026-10-27, maquettes/ecrans-pro : « commerce et livreur aussi soignés que le
   client ») : comme sous les bandeaux du client (Mes commandes, Mes factures, Favoris : RouteVelo de TeteListe.jsx, styles dans
   ecran-liste.css), le vélo roule quand la page défile. App et site sur téléphone ; l'ordinateur garde son bandeau. `route` à
   false quand le bandeau a déjà la sienne (les étapes de la mise en ligne, EditPage). */
export function BandeauCommerce({ children, retour = false, route = true }) {
  const ordinateur = useSiteLarge(900);
  return (
    <header className={`ec-bandeau${retour ? ' ec-bandeau--retour' : ''}`}>
      {children}
      {route && !ordinateur && <RouteVelo roule className="ec-b-route" />}
    </header>
  );
}

/* LE RETOUR LÀ D'OÙ L'ON VIENT (fondateur, 2026-10-27, réponse 9 de maquettes/ecrans-pro). Statistiques, Promotions et
   Factures s'ouvrent depuis les tuiles de l'accueil Commerce (CeSoir.jsx) comme depuis Mon compte, mais leur retour disait
   toujours « ← Mon compte » et changeait d'onglet. Il dit maintenant l'onglet d'avant et y RECULE (la page revient à sa
   place, l'historique ne s'allonge pas), comme le ‹ du panier client (useReculerVers, EcranCommande.jsx). Écran d'avant
   inconnu (rechargement, lien direct) : Commerce. */
// Le nom court de l'onglet, celui de la barre du bas (DashboardSidebar.jsx) : « ← Commerce », « ← Menu », « ← Commandes ».
const ONGLETS_COMMERCE = { '/dashboard': 'nav.court.myBusiness', '/dashboard/menu': 'nav.court.myMenu', '/dashboard/orders': 'nav.court.orders' };
export function RetourCommerce() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const avant = (cheminPrecedent() || '').split('?')[0].replace(/\/$/, '');
  const cle = ONGLETS_COMMERCE[avant];
  // Écran d'avant inconnu : Commerce, où vivent les tuiles et (sur téléphone) Mon compte depuis le 2026-10-27.
  if (!cle) return <Link to="/dashboard" className="ec-b-retour">{`← ${t('nav.court.myBusiness')}`}</Link>;
  const reculer = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate(-1);
  };
  return <Link to={avant} onClick={reculer} className="ec-b-retour">{`← ${t(cle)}`}</Link>;
}

export function FeuilleCommerce({ children }) {
  return <div className="ec-feuille">{children}</div>;
}

// Le vélo de la marque (BrandMark), en `currentColor` : lime sur le bandeau.
export function VeloMarque({ largeur = 38 }) {
  return (
    <svg viewBox="-3 5 82 42" width={largeur} height={Math.round((largeur * 42) / 82)} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

export function CocheTrait({ taille = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/* Un choix parmi quelques valeurs, dont le POUCE glisse d'une option à l'autre avec un ressort (temps de préparation,
   période des statistiques). Le pouce est mesuré sur le bouton choisi ; il ne s'anime qu'une fois posé la première fois
   (sinon il partirait du bord gauche à chaque affichage). `lime` : pouce lime sur le bandeau iris. */
export function SegmentGlisse({ options, valeur, onChange, libelle, lime = false, disabled = false }) {
  const boite = useRef(null);
  const [pouce, setPouce] = useState(null);
  useLayoutEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const poser = () => {
      const on = el.querySelector('button.on');
      if (on) setPouce((p) => ({ x: on.offsetLeft, l: on.offsetWidth, pret: p !== null }));
    };
    poser();
    const ro = new ResizeObserver(poser);
    ro.observe(el);
    return () => ro.disconnect();
  }, [valeur, options.length]);
  return (
    <div ref={boite} className={`ec-segment${lime ? ' ec-segment--lime' : ''}`} role="group" aria-label={libelle}>
      <span className={`ec-segment-pouce${pouce?.pret ? ' pret' : ''}`} aria-hidden="true"
        style={pouce ? { width: pouce.l, transform: `translateX(${pouce.x}px)` } : undefined} />
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === valeur ? 'on' : ''} aria-pressed={o.value === valeur}
          disabled={disabled} onClick={() => o.value !== valeur && onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
