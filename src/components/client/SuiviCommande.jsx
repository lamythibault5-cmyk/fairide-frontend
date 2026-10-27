import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import useCommandeEnCours, { commandeSuivie } from '../../hooks/useCommandeEnCours';
import { STEPS, PICKUP_STEPS, titreSuivi, orderTypeLabel } from '../../orderStatus';
import { imgProps } from '../../images';
import { vibrer } from '../../gestes';
import Icone from '../Icone';

/* LA COMMANDE EN COURS, SUR TOUS LES ÉCRANS (fondateur, 2026-10-26, version A3 de maquettes/commande-en-cours). La pastille
 * de l'onglet Commandes et la cloche ont été retirées le même jour : il fallait toucher « Notifications » pour effacer un
 * chiffre. Celui qui regarde les commerces pendant que sa pizza cuit voit à la place une bande au-dessus des onglets : la
 * photo du commerce dans un anneau qui se remplit à chaque étape, le commerce, l'étape (les phrases de Mes commandes). Lime
 * quand c'est à lui d'agir (prête à emporter). Un toucher ouvre Mes commandes. Rien à effacer :
 *   - récupérée ou livrée : « Bon appétit ! » quelques secondes, puis elle part ;
 *   - refusée ou annulée : en rouge jusqu'à ce qu'il ouvre Mes commandes (vu, mémorisé sur l'appareil), six heures au plus.
 * Pas sur Mes commandes (tout y est déjà), ni dans le panier et le paiement, ni sous une fenêtre ouverte (client-ui.css). */
const VUS = 'fairide_suivi_vus';
const ARRET = ['refuse', 'annule'];
// Seule une commande suivie (une de ces étapes) qui passe à « livrée » laisse « Bon appétit ! ».
const EN_COURS_AVANT = new Set(['nouveau', 'preparation', 'pret', 'livraison']);
const SIX_HEURES = 6 * 3600 * 1000;
const DUREE_FIN = 6000;

function lireVus() {
  try { return new Set(JSON.parse(localStorage.getItem(VUS) || '[]')); } catch { return new Set(); }
}
function noterVus(ids) {
  try { localStorage.setItem(VUS, JSON.stringify([...ids].slice(-50))); } catch { /* stockage indisponible : elle repartira dans six heures */ }
}
const aToi = (o) => o.status === 'pret' && o.orderType === 'pickup';

export default function SuiviCommande() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const commandes = useCommandeEnCours(pathname);
  const [vus, setVus] = useState(lireVus);
  const [fin, setFin] = useState(null);

  // Sur Mes commandes, les refus et annulations sont vus : la bande rouge ne revient pas.
  useEffect(() => {
    if (pathname !== '/orders') return;
    const arretees = commandes.filter((o) => ARRET.includes(o.status)).map((o) => o.id);
    if (!arretees.some((id) => !vus.has(id))) return;
    const suivants = new Set([...vus, ...arretees]);
    noterVus(suivants);
    setVus(suivants);
  }, [pathname, commandes, vus]);

  /* Ce qui a changé depuis la dernière lecture. Une commande suivie qui passe à « livrée » laisse « Bon appétit ! » quelques
   * secondes. Hors de Mes commandes (qui vibre déjà de son côté), le téléphone dit le sens comme là-bas : acceptée, prête à
   * emporter ou livrée → « succès » ; refusée ou annulée → « attention ». Le premier chargement ne vibre pas. */
  const avant = useRef(null);
  useEffect(() => {
    const precedents = avant.current;
    avant.current = new Map(commandes.map((o) => [o.id, o.status]));
    if (!precedents) return;
    const changees = commandes.filter((o) => precedents.has(o.id) && precedents.get(o.id) !== o.status);
    const livree = changees.find((o) => o.status === 'livre' && EN_COURS_AVANT.has(precedents.get(o.id)));
    if (livree) setFin({ commande: livree, part: false });
    if (pathname === '/orders' || !changees.length) return;
    if (changees.some((o) => ARRET.includes(o.status))) vibrer('attention');
    else if (changees.some((o) => (precedents.get(o.id) === 'nouveau' && o.status !== 'nouveau') || o.status === 'livre' || aToi(o))) vibrer('succes');
  }, [commandes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fin) return undefined;
    const partir = setTimeout(() => setFin((f) => f && { ...f, part: true }), DUREE_FIN);
    const effacer = setTimeout(() => setFin(null), DUREE_FIN + 400);
    return () => { clearTimeout(partir); clearTimeout(effacer); };
  }, [fin?.commande?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Laquelle montrer : un refus pas encore vu, puis une commande prête à venir chercher, puis la plus récente en cours,
  // puis « Bon appétit ! ».
  const refus = commandes.find((o) => ARRET.includes(o.status) && !vus.has(o.id) && Date.now() - new Date(o.createdAt).getTime() < SIX_HEURES);
  const enCours = commandes.filter(commandeSuivie);
  const commande = refus || enCours.find(aToi) || enCours[0] || fin?.commande || null;
  const visible = !!commande && pathname !== '/orders';

  // Place réservée sous le contenu tant que la bande est là, comme pour la barre du panier (FloatingCart).
  useEffect(() => {
    if (!visible) return undefined;
    document.documentElement.classList.add('avec-suivi-commande');
    return () => document.documentElement.classList.remove('avec-suivi-commande');
  }, [visible]);
  if (!visible) return null;

  const etapes = commande.orderType === 'delivery' ? STEPS : PICKUP_STEPS;
  const arretee = commande === refus;
  const finie = !arretee && commande.status === 'livre';
  const part = arretee || finie ? 1 : (etapes.indexOf(commande.status) + 1) / etapes.length;
  const tour = 2 * Math.PI * 21;

  let haut;
  let bas;
  if (arretee) {
    haut = commande.paymentMode === 'on_site' ? t('orders.suiviRienPaye') : t('orders.suiviRembourse');
    bas = t(commande.status === 'refuse' ? 'orders.suiviRefuse' : 'orders.suiviAnnule', { name: commande.restaurantName });
  } else {
    haut = `${commande.restaurantName} · ${orderTypeLabel(commande, t)}`;
    bas = finie ? t(commande.orderType === 'pickup' ? 'orders.suiviFiniEmporter' : 'orders.suiviFiniLivre') : titreSuivi(commande, t);
  }

  const classes = ['suivi-commande'];
  if (arretee) classes.push('suivi-commande--refus');
  else if (aToi(commande)) classes.push('suivi-commande--a-toi');
  if (finie && fin?.part) classes.push('suivi-commande--part');
  return (
    <Link to="/orders" className={classes.join(' ')} aria-label={`${haut} · ${bas}`}>
      <span className="suivi-commande-rond" aria-hidden="true">
        <svg className="suivi-commande-anneau" viewBox="0 0 46 46">
          <circle className="fond" cx="23" cy="23" r="21" />
          <circle className="avance" cx="23" cy="23" r="21" strokeDasharray={`${part * tour} ${tour}`} />
        </svg>
        <PhotoRonde key={commande.id} commande={commande} />
        {arretee && <span className="suivi-commande-croix"><Icone nom="croix" taille={11} /></span>}
      </span>
      <span className="suivi-commande-texte">
        <small>{haut}</small>
        <b>{bas}</b>
      </span>
      <span className="suivi-commande-chevron" aria-hidden="true" />
    </Link>
  );
}

// La photo du commerce, celle des commandes passées (PhotoCommerce, Mes commandes) ; l'initiale s'il n'en a pas.
function PhotoRonde({ commande }) {
  const [casse, setCasse] = useState(false);
  return (
    <span className="suivi-commande-photo">
      {commande.restaurantCoverUrl && !casse
        ? <img {...imgProps(commande.restaurantCoverUrl, 68)} alt="" decoding="async" onError={() => setCasse(true)} />
        : (commande.restaurantName || '').trim().charAt(0).toUpperCase()}
    </span>
  );
}
