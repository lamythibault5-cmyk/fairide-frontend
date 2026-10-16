import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icone from './Icone';
import { useLanguage } from '../context/LanguageContext';
import '../ecran-commande.css';
import '../site-commande.css';

/* LE PARCOURS DE COMMANDE EN BANDEAU IRIS (fondateur, 2026-10-16, « Proposition » de mockups/tous-les-ecrans.html :
 * Panier, Paiement, Commande confirmée). Même famille que l'accueil de l'app (.bv-bandeau) et le suivi 1C : l'en-tête est
 * un bandeau iris (retour, commerce, grand titre, route en pointillés où roule le vélo de la marque, en lime) et le reste
 * monte dans une feuille blanche aux coins ronds. Sur le site comme dans l'app : seul le verre de la barre du bas est
 * réservé à l'app (html.appli, ecran-commande.css). Rien à télécharger de plus : du SVG et du CSS. */

// Le vélo « 5a » de la marque (BrandMark.jsx, sans tuile), à la couleur du texte.
export function VeloMarque({ largeur = 36 }) {
  return (
    <svg viewBox="-3 5 82 42" width={largeur} height={Math.round((largeur * 42) / 82)} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

/* La route du bandeau : pointillés, et le vélo qui arrive de `depart` (%) jusqu'à `position` (%). Avec `etapes`, les
 * libellés du parcours dessous (Panier · Paiement · Suivi), l'étape `actuelle` en gras. Décorative : l'écran dit déjà
 * où l'on est par son titre. */
export function RouteCommande({ position, depart = 0, etapes = null, actuelle = 0 }) {
  return (
    <div className="ec-route-bloc" aria-hidden="true">
      <div className="ec-route">
        <span className="ec-route-voie" />
        <span className="ec-route-velo" style={{ left: `${position}%`, '--ec-depart': `${depart}%` }}><VeloMarque /></span>
      </div>
      {etapes && (
        <div className="ec-route-libs">
          {etapes.map((e, k) => <span key={e} className={k < actuelle ? 'fait' : k === actuelle ? 'actuel' : undefined}>{e}</span>)}
        </div>
      )}
    </div>
  );
}

/* L'en-tête iris. `vers` : le retour d'un pas (un lien, comme EnteteFlux — jamais navigate(-1)). `haut` : la ligne du
 * commerce, à droite du retour. */
export function BandeauCommande({ vers, libelleRetour, haut, titre, sous, children, className = '' }) {
  return (
    <div className={`ec-bandeau ${className}`}>
      {/* .ec-col : la colonne du site sur ordinateur (site-commande.css) ; partout ailleurs `display: contents`, comme absente. */}
      <div className="ec-col">
      {(vers || haut) && (
        <div className="ec-haut">
          {vers && <Link to={vers} className="ec-rond" aria-label={libelleRetour} title={libelleRetour}><Icone nom="retour" taille={18} /></Link>}
          {haut && <span className="ec-haut-texte">{haut}</span>}
        </div>
      )}
      {titre && <h1 className="ec-titre">{titre}</h1>}
      {sous && <p className="ec-sous">{sous}</p>}
      {children}
      </div>
    </div>
  );
}

export function FeuilleCommande({ children, className = '' }) {
  return <div className={`ec-feuille ${className}`}><div className="ec-col">{children}</div></div>;
}

/* LA ROUTE PANIER → PAIEMENT → SUIVI DU SITE (2026-10-16, « Proposition » de mockups/site-ordinateur.html, section 5). Les
 * mêmes arrêts que le suivi d'une commande (RouteSuivi, orderStatus.jsx, classes .route-suivi de client-ui.css) : les étapes
 * passées gardent leur coche lime, et le vélo arrive en roulant de l'arrêt précédent jusqu'à l'étape de l'écran. L'app garde
 * sa route sans arrêts (RouteCommande) : rien n'y change. Décorative comme elle : le titre de l'écran dit déjà où l'on est. */
export function RouteEtapes({ actuelle }) {
  const { t } = useLanguage();
  const etapes = [t('ecranCommande.etapePanier'), t('checkout.headerTitle'), t('ecranCommande.etapeSuivi')];
  // Départ : l'arrêt d'avant (le bord de la route pour le panier), puis l'étape de l'écran deux images plus tard — les
  // transitions de .rs-velo et .rs-fait font rouler le vélo. Sans mouvement (prefers-reduced-motion), il est déjà arrivé.
  const [place, setPlace] = useState(actuelle === 0 ? -0.5 : actuelle - 1);
  const [roule, setRoule] = useState(false);
  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => { setPlace(actuelle); setRoule(true); }); });
    const fin = setTimeout(() => setRoule(false), 1300);
    return () => { cancelAnimationFrame(id); clearTimeout(fin); };
  }, [actuelle]);
  const pas = 100 / etapes.length;
  return (
    <div className="sc-route" aria-hidden="true">
      <div className="route-suivi">
        <span className="rs-voie" style={{ left: `${pas / 2}%`, right: `${pas / 2}%` }} />
        <i className="rs-fait" style={{ left: `${pas / 2}%`, width: `${Math.max(0, place) * pas}%` }} />
        {etapes.map((e, k) => (
          <span key={e} className={`rs-arret${k < actuelle ? ' fait' : k === actuelle ? ' actuel' : ''}`} style={{ left: `${(k + 0.5) * pas}%` }}>
            {k < actuelle && <Icone nom="valider" taille={12} />}
          </span>
        ))}
        <span className={`rs-velo${roule ? ' roule' : ''}`} style={{ left: `${(place + 0.5) * pas}%` }}><VeloMarque largeur={42} /></span>
      </div>
      <ol className="rs-libs" style={{ gridTemplateColumns: `repeat(${etapes.length}, 1fr)` }}>
        {etapes.map((e, k) => <li key={e} className={k < actuelle ? 'fait' : k === actuelle ? 'actuel' : ''}>{e}</li>)}
      </ol>
    </div>
  );
}

/* Un nombre qui change rejoue une petite animation (la barre du bas qui « gélifie » quand le total bouge) : deux classes
 * identiques qui alternent, pour que le navigateur reparte de zéro sans démonter l'élément (le bouton garde son focus). */
function useRebond(valeur) {
  const [n, setN] = useState(0);
  const avant = useRef(valeur);
  useEffect(() => {
    if (avant.current === valeur) return;
    avant.current = valeur;
    setN((x) => x + 1);
  }, [valeur]);
  return n === 0 ? '' : n % 2 ? ' ec-rebond-a' : ' ec-rebond-b';
}

/* La barre du bas (panier, paiement) : `.cart-bar` comme avant (aplat iris collé en bas sur le site), en verre dans l'app.
 * Elle « gélifie » quand le montant change ; les chiffres, eux, roulent (ChiffresRoulants). */
export function BarreCommande({ montant, className = '', children }) {
  const rebond = useRebond(montant);
  return <div className={`cart-bar co-barre ec-barre ${className}${rebond}`}>{children}</div>;
}

/* La case d'un choix unique, en carte : icône dans sa tuile, libellé, et la coche lime qui saute sur le choix retenu. */
export function OptionCommande({ on, icone, titre, sous, onClick }) {
  return (
    <button type="button" className={`ec-option${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="ec-option-tuile"><Icone nom={icone} taille={20} /></span>
      <span className="ec-option-texte">{titre}{sous && <small>{sous}</small>}</span>
      <span className="ec-case">{on && <Icone nom="valider" taille={14} />}</span>
    </button>
  );
}
