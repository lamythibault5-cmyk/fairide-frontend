import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DeliveryTiming, ProgressBar, statusLabel, orderTypeLabel } from '../orderStatus';
import DriverBadge from './DriverBadge';
import DeliveryTrackingMap from './DeliveryTrackingMap';
import Icone from './Icone';

// Le suivi d'une commande en cours, en panneau, pour les écrans qui ne sont pas « Mes commandes ».
//
// POURQUOI IL EXISTE. Jouer en attendant sa livraison obligeait à faire un aller-retour pour savoir
// où elle en était : on quittait le jeu, on lisait le suivi, on revenait — et la partie était
// perdue. Le fondateur l'a dit tel quel : « je dois pas repartir en arrière pour voir ma commande,
// je peux la voir en train de jouer au jeu. » Donc le suivi vient au joueur.
//
// CE QU'IL MONTRE, ET RIEN DE PLUS : le commerce, l'étape où en est la commande (reçue, en
// préparation, prête, en route), l'heure d'arrivée estimée quand le serveur la donne, le livreur
// quand il est assigné, et sa position en direct pendant la livraison. Pas de boutons d'action —
// annuler, noter, payer un acompte restent sur « Mes commandes », leur page. Ici on regarde.
//
// Il ne rend RIEN quand aucune commande n'est en cours : un panneau vide à côté d'un jeu serait du
// bruit, et le terrain récupère alors toute la largeur.
const EN_COURS = ['nouveau', 'preparation', 'pret', 'livraison'];

export default function SuiviEnCours() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [commandes, setCommandes] = useState([]);

  useEffect(() => {
    if (!token) return undefined;
    function lire() {
      api('/orders/mine', { token })
        .then((c) => setCommandes((c || []).filter((o) => EN_COURS.includes(o.status))))
        .catch(() => {});
    }
    lire();
    // 20 s : le même rythme que « Mes commandes ». Plus court userait la batterie pendant une
    // partie pour une information qui bouge à l'échelle de la minute.
    const id = setInterval(lire, 20000);
    return () => clearInterval(id);
  }, [token]);

  if (commandes.length === 0) return null;
  // La plus récente : on en attend rarement deux, et deux panneaux à côté d'un jeu ne tiendraient
  // pas. Les autres restent sur « Mes commandes », vers où mène le lien en pied de panneau.
  const o = commandes[0];
  const enRoute = o.status === 'livraison' && o.restaurantLat && o.deliveryLat;

  return (
    <aside className="suivi-panneau" aria-label={t('games.orderTitle')}>
      <div className="suivi-panneau-tete">
        <b>{o.restaurantName}</b>
        <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>
      </div>
      <p className="small suivi-panneau-type">{orderTypeLabel(o, t)}</p>

      <ProgressBar status={o.status} orderType={o.orderType} />
      <DeliveryTiming order={o} />

      {o.driverName && (
        <div className="suivi-panneau-livreur">
          <DriverBadge name={o.driverName} phone={o.driverPhone} photoUrl={o.driverPhotoUrl} size={36} />
        </div>
      )}

      {enRoute && (
        <>
          <div className="suivi-panneau-carte">
            <DeliveryTrackingMap
              restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
              deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
              driverLat={o.driverLat} driverLng={o.driverLng}
              lastUpdatedAt={o.driverLocationUpdatedAt}
              height={210}
            />
          </div>
          <p className="small suivi-panneau-note">
            {o.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
          </p>
        </>
      )}

      {/* Le code de retrait : c'est la seule chose du suivi qu'on doit avoir sous la main au moment
          où l'on frappe à la porte, et la chercher ailleurs pendant qu'un livreur attend n'a pas
          de sens. */}
      {o.paid && o.deliveryCode && (
        <div className="suivi-panneau-code">
          <span className="small">{t('orders.codeGiveDriver')}</span>
          <b>{o.deliveryCode}</b>
        </div>
      )}

      <Link to="/orders" className="suivi-panneau-lien">
        <Icone nom="commandes" taille={15} />{t('games.seeOrder')}
      </Link>
    </aside>
  );
}
