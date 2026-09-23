import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { DAY_KEYS, formatDaySchedule } from '../../openingHours';
import LigneCompte from '../../components/LigneCompte';
import EcranIdentite from '../../components/commerce/EcranIdentite';
import EcranContact from '../../components/commerce/EcranContact';
import EcranAdresse from '../../components/commerce/EcranAdresse';
import EcranHoraires from '../../components/commerce/EcranHoraires';
import EcranFermetures from '../../components/commerce/EcranFermetures';
import EcranLegal from '../../components/commerce/EcranLegal';
import EcranLivreurs from '../../components/commerce/EcranLivreurs';
import EcranOffreLivraison from '../../components/commerce/EcranOffreLivraison';
import EcranTypeCommerce from '../../components/commerce/EcranTypeCommerce';
import EcranSuppression from '../../components/commerce/EcranSuppression';

// « Mon commerce » : une rangée par sujet, qui dit l'état actuel, et un sous-écran pour le changer.
//
// POURQUOI (2026-09-23). C'était un seul formulaire de 33 champs — nom, entreprise, AFSCA, alcool,
// téléphones, e-mails, site, adresse, description, photos, horaires, fermetures, type, suppression,
// livreurs, remise sur la livraison — avec un seul « Enregistrer » au milieu, qui renvoyait tout et
// refusait un changement d'horaires tant que le n° de TVA manquait. Le motif est celui du paiement
// (components/SousEcran.jsx, Checkout.jsx), repris d'Uber Eats : chaque rangée résume une décision déjà
// prise (« Av. Louise 12, 1050 Ixelles ») et n'ouvre que ce qu'on veut corriger. Chaque sous-écran
// n'envoie que ses propres champs (voir commerce/useEnregistrerCommerce.js).
//
// Un sous-écran est monté à l'ouverture et démonté à la fermeture : ses champs partent de `restaurant`
// une seule fois, et le rafraîchissement du tableau de bord toutes les 15 s n'efface plus une saisie.
const ECRANS = {
  identite: EcranIdentite, contact: EcranContact, adresse: EcranAdresse, horaires: EcranHoraires,
  fermetures: EcranFermetures, legal: EcranLegal, livraison: EcranLivreurs, offre: EcranOffreLivraison,
  type: EcranTypeCommerce, suppression: EcranSuppression
};

function aujourdhuiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EditPage() {
  const { t } = useLanguage();
  const { restaurant, drivers, restoId, loadDashboard } = useOutletContext();
  const [ouvert, setOuvert] = useState(null);

  if (!restaurant) return null;
  const r = restaurant;
  const aCompleter = t('editResto.toComplete');

  const adresse = [[r.addressStreet, r.addressNumber].filter(Boolean).join(' '), [r.addressPostalCode, r.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const contact = [r.phone, r.email].filter(Boolean).join(' · ');
  const horairesDuJour = r.hours ? formatDaySchedule(r.hours, DAY_KEYS[new Date().getDay()], t) : null;
  const iso = aujourdhuiIso();
  const fermeturesAVenir = (r.closures || []).filter((c) => !c.endDate || c.endDate >= iso).length;
  const legalManquant = !r.legalName || !r.companyNumber || !r.vatNumber || !r.responsibleName;
  const offre = r.freeDelivery ? t('editResto.offerFree')
    : r.freeDeliveryMinOrder != null ? t('editResto.offerFromMin', { amount: r.freeDeliveryMinOrder })
    : Number(r.deliveryFeeDiscount) > 0 ? t('editResto.offerDiscount', { amount: r.deliveryFeeDiscount })
    : t('editResto.offerNone');

  const Ecran = ouvert ? ECRANS[ouvert] : null;
  const ligne = (cle, props) => <LigneCompte {...props} onClick={() => setOuvert(cle)} />;

  return (
    <div>
      <div className="card account-groupe" aria-label={t('editResto.groupShop')}>
        {ligne('identite', { icone: 'commerce', titre: t('editResto.rowIdentity'), sous: r.name })}
        {ligne('adresse', { icone: 'position', titre: t('editResto.address'), sous: adresse || aCompleter, accent: adresse ? undefined : 'warn' })}
        {ligne('horaires', { icone: 'horloge', titre: t('editResto.openingHours'), sous: horairesDuJour ? t('editResto.todayHours', { hours: horairesDuJour }) : aCompleter, accent: r.hours ? undefined : 'warn' })}
        {ligne('fermetures', { icone: 'porte', titre: t('editResto.rowClosures'), sous: fermeturesAVenir ? t('editResto.closuresCount', { n: fermeturesAVenir }) : t('editResto.closuresNone') })}
        {ligne('contact', { icone: 'telephone', titre: t('editResto.rowContact'), sous: contact || aCompleter })}
      </div>

      <div className="card account-groupe" aria-label={t('editResto.delivery')}>
        {ligne('livraison', { icone: 'scooter', titre: t('editResto.delivery'), sous: r.deliveryMode === 'own' ? t('editResto.deliveryOwn', { n: drivers.length }) : t('editResto.deliveryPool') })}
        {ligne('offre', { icone: 'etiquette', titre: t('editResto.rowDeliveryOffer'), sous: offre })}
      </div>

      <div className="card account-groupe" aria-label={t('editResto.rowLegal')}>
        {ligne('legal', { icone: 'document', titre: t('editResto.rowLegal'), sous: legalManquant ? aCompleter : `BCE ${r.companyNumber}`, accent: legalManquant ? 'warn' : undefined })}
        {ligne('type', { icone: 'restaurants', titre: t('editResto.rowType'), sous: r.cuisine })}
        {ligne('suppression', { icone: 'interdit', titre: t('editResto.deleteTitle'), danger: true })}
      </div>

      {Ecran && <Ecran restaurant={r} drivers={drivers} restoId={restoId} loadDashboard={loadDashboard} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
