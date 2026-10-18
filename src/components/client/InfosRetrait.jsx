import { Link } from 'react-router-dom';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import Icone from '../Icone';
import { euros } from '../../prixPlat';

/* LE RETRAIT D'UNE COMMANDE À EMPORTER (audit du 18/10/2026 ; fondateur : « après une commande non récupérée, seulement
 * en ligne »). Tout ce qu'il faut pour aller la chercher, au même endroit — l'écran de confirmation (OrderResult.jsx) et la
 * carte de la commande (Mes commandes) :
 *   - quand elle sera prête (heure estimée par le serveur : temps de préparation du commerce, ou l'heure programmée) ;
 *   - où (adresse), avec « Itinéraire » (Google Maps) et « Appeler » quand le commerce montre son numéro ;
 *   - payée sur place : le montant à payer au comptoir et ce que le commerce accepte ;
 *   - payée sur place : ce qui arrive si on ne vient pas.
 * Mêmes rangées que le récapitulatif de la confirmation (.ec-recap, ecran-commande.css) : icône iris, texte, petite ligne.
 * `compact` (carte de Mes commandes) : la carte dit déjà l'heure, l'adresse et le montant ; on n'ajoute que ce qui lui
 * manquait — Itinéraire, Appeler, ce que le commerce accepte, et la règle du non-retrait. */
const LIBELLES_PAIEMENT = { especes: 'payEspeces', bancontact: 'payBancontact', carte: 'payCarte', payconiq: 'payPayconiq', titres_repas: 'payTitresRepas' };
const heure = (ms) => new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

export function lienItineraire(order) {
  const point = order.restaurantLat != null && order.restaurantLng != null ? `${order.restaurantLat},${order.restaurantLng}` : null;
  const cible = point || order.restaurantAddress;
  return cible ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cible)}` : null;
}

export default function InfosRetrait({ order, compact = false }) {
  const { t } = useLanguage();
  // Pas encore partie au commerce (paid = false) : rien à aller chercher.
  if (!order || order.orderType !== 'pickup' || !order.paid || !['nouveau', 'preparation', 'pret'].includes(order.status)) return null;
  const surPlace = order.paymentMode === 'on_site';
  const itineraire = lienItineraire(order);
  const moyens = (order.restaurantPaymentsOnSite || []).map((p) => t(`restaurantMenu.${LIBELLES_PAIEMENT[p] || 'payCarte'}`)).join(', ');

  const quand = order.status === 'pret'
    ? { titre: t('retrait.readyNow'), detail: null }
    : order.estimatedDeliveryAt
      ? { titre: t(order.scheduledFor ? 'retrait.readyScheduled' : 'retrait.readyAt', { time: heure(order.estimatedDeliveryAt) }), detail: order.status === 'nouveau' ? t('retrait.waitingShop') : null }
      : { titre: t('retrait.waitingShop'), detail: null };

  const boutons = (itineraire || order.restaurantPhone) && (
    <span className="retrait-actions">
      {itineraire && <a href={itineraire} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><Icone nom="boussole" taille={16} />{t('retrait.directions')}</a>}
      {order.restaurantPhone && <a href={`tel:${order.restaurantPhone.replace(/\s/g, '')}`} className="btn-outline btn-sm"><Icone nom="telephone" taille={16} />{t('retrait.call')}</a>}
    </span>
  );
  const regle = surPlace && <p className="retrait-note"><Icone nom="alerte" taille={14} className="icone-texte" />{' '}{t('retrait.noShowRule')}</p>;

  if (compact) {
    return (
      <div className="retrait retrait--compact">
        {boutons}
        {surPlace && moyens && <p className="retrait-note">{t('retrait.accepted', { list: moyens })}</p>}
        {regle}
      </div>
    );
  }

  return (
    <div className="ec-recap retrait">
      <div className="ec-recap-ligne">
        <Icone nom="horloge" taille={20} />
        <span className="ec-recap-texte"><b>{quand.titre}</b>{quand.detail && <small>{quand.detail}</small>}</span>
      </div>
      {(order.restaurantAddress || boutons) && (
        <div className="ec-recap-ligne retrait-lieu">
          <Icone nom="position" taille={20} />
          <span className="ec-recap-texte">
            {/* Le nom du commerce est déjà dans la première rangée du récapitulatif : ici, l'adresse seule. */}
            <b>{order.restaurantAddress || order.restaurantName}</b>
            {boutons}
          </span>
        </div>
      )}
      {surPlace && (
        <div className="ec-recap-ligne">
          <Icone nom="euro" taille={20} />
          <span className="ec-recap-texte"><b>{t('retrait.payAtCounter')}</b>{moyens && <small>{t('retrait.accepted', { list: moyens })}</small>}</span>
          <b className="ec-recap-montant">{euros(Number(order.total))}</b>
        </div>
      )}
      {regle}
    </div>
  );
}

/* « UN SOUCI ? » SUR CHAQUE COMMANDE (audit du 18/10/2026). Avant, rien avant « en route » : une commande refusée, en
 * retard ou introuvable au comptoir n'offrait aucune porte de sortie. Appeler le commerce (quand son numéro est public) ou
 * l'aide de Fairide. Le signalement d'un problème après la livraison (SignalerProbleme) reste à sa place. */
export function AideCommande({ order }) {
  const { t } = useLanguage();
  return (
    <div className="aide-commande">
      <span className="aide-commande-titre">{t('retrait.helpTitle')}</span>
      {order.restaurantPhone && <a href={`tel:${order.restaurantPhone.replace(/\s/g, '')}`} className="aide-commande-lien"><Icone nom="telephone" taille={16} />{t('retrait.callShop')}</a>}
      <Link to="/aide" className="aide-commande-lien"><Icone nom="bouee" taille={16} />{t('retrait.helpFairide')}</Link>
    </div>
  );
}
