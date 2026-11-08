import { useEffect, useRef, useState } from 'react';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import Icone from '../Icone';
import { imgProps } from '../../images';
import { RouteArrets, prenomLivreur } from '../../orderStatus';
import { CLES_ARRETS, etapesAttente, lignesCochees, modeAttente, mouvementReduit, useEtatAttente } from '../../attenteCommande';
import './attente.css';

/* LES ÉCRANS DE L'ATTENTE « PAYER → UN LIVREUR A ACCEPTÉ » (fondateur, 2026-11-08, maquettes/retours-08-11/attente-v2.html : « Oui,
 * construis-la », 5 arrêts, grande carte d'ondes, son initiale arrive dans les ondes, site pareil que l'app). Sous le bandeau iris
 * et sa route (RouteCommande), dans la feuille : la liste qui se coche (paiement, envoi, le commerce confirme, on cherche un
 * livreur), puis, dès que la course part aux livreurs, la grande carte d'ondes autour de la photo du commerce ; un livreur
 * accepte : ses initiales arrivent dans les ondes, puis le suivi normal reprend sous la même route.
 * La règle (une ligne ne se coche que quand c'est vraiment fait) et le pas à pas sont dans src/attenteCommande.js. */

// La route du bandeau, telle que l'horloge de l'attente la place (useEtatAttente).
export function RouteArretsAttente({ arrets, position, enRoute = false }) {
  const { t } = useLanguage();
  return <RouteArrets labels={arrets.map((k) => t(CLES_ARRETS[k]))} fait={position.fait} place={position.place} enRoute={enRoute} />;
}

/* La route du bandeau d'une commande du client, du paiement à la fin : le vélo y avance d'un état à la fois et ne recule jamais.
 * À l'ouverture de l'appli sur une commande jamais vue dans la session, seuls les deux derniers pas sont rejoués. */
export function RouteCommande({ order }) {
  const { arrets, position } = useEtatAttente(order);
  return <RouteArretsAttente arrets={arrets} position={position} enRoute={order?.status === 'livraison'} />;
}

// La liste qui se coche. `coches` : les lignes cochées à l'écran ; la suivante tourne, sa phrase dessous (le délai, seulement là).
export function ListeAttente({ etapes, coches }) {
  return (
    <ul className="at-liste" aria-live="polite">
      {etapes.map((e, k) => (
        <li key={e.cle} className={k < coches ? 'fait' : k === coches ? 'en-cours' : ''}>
          <span className="at-coche" aria-hidden="true"><Icone nom="valider" taille={13} /></span>
          <span className="at-texte"><b>{e.titre}</b>{k === coches && e.sous && <small>{e.sous}</small>}</span>
        </li>
      ))}
    </ul>
  );
}

const initiales = (nom) => String(nom || '').replace(/\./g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');

function PhotoCentre({ order }) {
  const [casse, setCasse] = useState(false);
  return (
    <span className="at-centre">
      {order.restaurantCoverUrl && !casse
        ? <img {...imgProps(order.restaurantCoverUrl, 96)} alt="" decoding="async" onError={() => setCasse(true)} />
        : <b>{(order.restaurantName || '').trim().charAt(0).toUpperCase()}</b>}
    </span>
  );
}

/* La grande carte d'ondes pendant qu'on cherche un livreur, et deux phrases vraies qui alternent (la course est partie aux
 * livreurs disponibles ; l'heure après laquelle on peut annuler, remboursé). `trouve` : ses initiales arrivent dans les ondes. */
const PHRASE_MS = 3600;
export function RadarLivreurs({ order, trouve = false }) {
  const { t } = useLanguage();
  const limite = order.noCourierCancelAt
    ? t('orders.noCourier_limite', { time: new Date(order.noCourierCancelAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
    : null;
  const phrases = [t('attente.radarRecu'), limite].filter(Boolean);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (trouve || phrases.length < 2 || mouvementReduit()) return undefined;
    const id = setInterval(() => setK((x) => x + 1), PHRASE_MS);
    return () => clearInterval(id);
  }, [trouve, phrases.length]);
  return (
    <div className={`at-radar${trouve ? ' trouve' : ''}`} role="status">
      <div className="at-carte" aria-hidden="true">
        <span className="at-onde" /><span className="at-onde" /><span className="at-onde" />
        <PhotoCentre order={order} />
        <span className="at-livreur">{initiales(order.driverName)}</span>
      </div>
      <div className="at-radar-texte">
        <b>{trouve ? t('attente.trouve', { name: order.driverName }) : t('attente.radarTitre')}</b>
        <span key={trouve ? 'trouve' : k % phrases.length} className="at-phrase">
          {trouve ? t('attente.trouvePasse', { name: prenomLivreur(order), restaurant: order.restaurantName }) : phrases[k % phrases.length]}
        </span>
      </div>
    </div>
  );
}

/* Sous le bandeau du suivi : la liste tant que le commerce doit confirmer ; la course partie aux livreurs, « On cherche un
 * livreur » tourne un instant puis la carte d'ondes prend sa place ; un livreur accepte : ses initiales dans les ondes quelques
 * secondes, puis le suivi normal (le livreur, Détails…). */
const ONDES_APRES_MS = 1100;
const TROUVE_MS = 4000;
export function AttenteSuivi({ order }) {
  const { t } = useLanguage();
  const mode = modeAttente(order);
  const { etapes, enLigne } = etapesAttente(order, t);
  const { vu } = useEtatAttente(order);
  const coches = lignesCochees(vu, enLigne);
  const iLivreur = etapes.findIndex((e) => e.cle === 'livreur');
  const surLivreur = mode === 'recherche' && iLivreur >= 0 && coches >= iLivreur;
  const [ondes, setOndes] = useState(surLivreur);
  useEffect(() => {
    if (!surLivreur || ondes) return undefined;
    const id = setTimeout(() => setOndes(true), ONDES_APRES_MS);
    return () => clearTimeout(id);
  }, [surLivreur, ondes]);
  const cherchait = useRef(mode === 'recherche');
  const [trouve, setTrouve] = useState(false);
  useEffect(() => {
    if (mode === 'recherche') { cherchait.current = true; return undefined; }
    if (!cherchait.current || !order.driverId) return undefined;
    cherchait.current = false;
    setTrouve(true);
    const id = setTimeout(() => setTrouve(false), TROUVE_MS);
    return () => clearTimeout(id);
  }, [mode, order.driverId]);
  if (trouve) return <div className="at-bloc"><RadarLivreurs order={order} trouve /></div>;
  if (mode === 'confirmation' || (mode === 'recherche' && !ondes)) return <div className="at-bloc"><ListeAttente etapes={etapes} coches={coches} /></div>;
  if (mode === 'recherche') return <div className="at-bloc"><RadarLivreurs order={order} /></div>;
  return null;
}
