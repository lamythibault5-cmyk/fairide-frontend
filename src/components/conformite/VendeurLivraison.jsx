import { useLanguage } from '../../context/LanguageContext';

/* Qui vend la livraison (décision du 23/09/2026, G4).
 *
 * Le client achète la livraison au livreur indépendant qui accepte la course, pas à Fairide. Tant
 * qu'aucun livreur ne l'a acceptée, on le dit (« nommé dès qu'il accepte ») ; ensuite on montre ce que
 * le serveur a figé sur la commande (orders.courier_seller_snapshot) : prénom et initiale, numéro
 * d'entreprise, régime TVA. Jamais le nom complet — c'est ce que la notice promet aux livreurs.
 *
 * Plus de « Refuser ce livreur » (fondateur, 2026-10-19) : un client ne choisit pas son livreur et ne peut plus le refuser.
 * La livraison reste vendue par le livreur au client ; seul le refus est parti (PATCH /orders/:id/decline-courier répond
 * 410 aux anciennes versions de l'application, et la notice de transparence des livreurs ne le promet plus).
 *
 * Commande refusée par le commerce ou annulée : plus personne ne sera nommé, la phrase « il sera nommé ici » serait fausse.
 * De même tant qu'elle n'est ni payée ni envoyée au commerce (audit du 19/10, AO-13) : aucun livreur ne la verra avant. */
export default function VendeurLivraison({ order }) {
  const { t } = useLanguage();
  if (order.orderType !== 'delivery' || ['livre', 'annule', 'refuse'].includes(order.status)) return null;
  if (order.status === 'nouveau' && !order.paid) return null;
  const v = order.courierSeller;

  if (!v) {
    if (order.driverName) return null; // commande antérieure au modèle : pas d'instantané, le badge suffit
    return <p className="small vendeur-livraison-attente">{t('conformite.courierPending')}</p>;
  }
  return (
    <div className="small vendeur-livraison">
      <div><b>{t('conformite.courierSellerTitle')}</b> : {v.displayName}</div>
      <div>{t('conformite.courierSellerStatus')}</div>
      <div style={{ color: 'var(--ink-soft)' }}>
        {[v.companyNumber ? t('conformite.courierCompany', { n: v.companyNumber }) : null, v.vatRegime === 'normal' ? t('conformite.courierVatNormal') : t('conformite.courierVatFranchise')].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}
