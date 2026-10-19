import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { imgProps, cacherImageCassee } from '../../images';
import { prenom, pourboire } from './clientCommande';

/* LE LIVREUR, UNE PERSONNE (audit design 2, section 2, fondateur 2026-10-19). Une fois la course prise, la carte de la
 * commande montre qui vient la chercher : sa photo (ou son initiale), son prénom, où il en est, et son pourboire quand le
 * client en a laissé un (il le touche en entier : contrat livreur, pricing tipFairideRate 0).
 *
 * Ce qu'on NE dit PAS, faute de donnée honnête : ni « dans 6 min » (le commerce ne reçoit pas la position du livreur, et la
 * politique de géolocalisation lui promet qu'elle n'est pas enregistrée sur le trajet vers le commerce), ni « à vélo » / « à
 * scooter » (le véhicule n'arrive pas jusqu'au commerce : GET /orders/restaurant/:id ne l'envoie pas). Ce qu'on sait :
 * pris, arrivé et depuis quand (courierWaitingSince), parti livrer. Aucune note, aucun classement : rien qui compare. */
export default function LivreurCommande({ order: o, classe = '' }) {
  const { t } = useLanguage();
  if (o.orderType !== 'delivery' || !o.driverId || !['preparation', 'pret', 'livraison'].includes(o.status)) return null;
  const nom = prenom(o.driverName || o.courierSeller?.displayName) || t('serviceCommerce.livreur');
  const photo = o.driverPhotoUrl || o.courierSeller?.photoUrl || null;
  const attente = o.courierWaitingSince && o.status !== 'livraison' ? Math.max(0, Math.floor((Date.now() - o.courierWaitingSince) / 60000)) : null;
  const texte = o.status === 'livraison' ? t('serviceCommerce.livreurLivre', { name: nom })
    : attente !== null ? (attente > 0 ? t('serviceCommerce.livreurLaDepuis', { name: nom, n: attente }) : t('serviceCommerce.livreurLa', { name: nom }))
      : t('serviceCommerce.livreurArrive', { name: nom });
  const tip = pourboire(o);
  return (
    <div className={`ec-livreur${classe ? ` ${classe}` : ''}`}>
      <span className="ec-livreur-avatar" aria-hidden="true">
        {photo ? <img {...imgProps(photo, 40)} alt="" onError={cacherImageCassee} /> : nom.charAt(0).toUpperCase()}
      </span>
      <span className="ec-livreur-texte">
        <span className={attente !== null ? 'ec-livreur-la' : undefined}>{texte}</span>
        {tip > 0 && <small>{t('serviceCommerce.pourboireLivreur', { amount: euros(tip), name: nom })}</small>}
      </span>
    </div>
  );
}
