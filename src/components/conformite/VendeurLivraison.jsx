import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../ConfirmDialog';

/* Qui vend la livraison (décision du 23/09/2026, G4).
 *
 * Le client achète la livraison au livreur indépendant qui accepte la course, pas à Fairide. Tant
 * qu'aucun livreur ne l'a acceptée, on le dit (« nommé dès qu'il accepte ») ; ensuite on montre ce que
 * le serveur a figé sur la commande (orders.courier_seller_snapshot) : prénom et initiale, numéro
 * d'entreprise, régime TVA. Jamais le nom complet — c'est ce que la notice promet aux livreurs.
 *
 * Refuser le livreur : sans frais, tant que la commande n'est pas partie (statuts « preparation » et
 * « pret », comme PATCH /orders/:id/decline-courier). La course repart dans la liste ; le livreur n'en
 * subit rien. ConfirmDialog et non window.confirm, supprimé dans les PWA installées. */
export default function VendeurLivraison({ order, token, onUpdated }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [demande, setDemande] = useState(false);
  const [occupe, setOccupe] = useState(false);
  if (order.orderType !== 'delivery' || ['livre', 'annule'].includes(order.status)) return null;
  const v = order.courierSeller;
  const refusable = !!order.driverName && ['preparation', 'pret'].includes(order.status);

  async function refuser() {
    setOccupe(true);
    try {
      const maj = await api(`/orders/${order.id}/decline-courier`, { method: 'PATCH', token });
      toast(t('conformite.declineCourierDone'));
      onUpdated(maj);
    } catch (e) { toast(e.message, 'erreur'); }
    finally { setOccupe(false); setDemande(false); }
  }

  if (!v) {
    if (order.driverName) return null; // commande antérieure au modèle : pas d'instantané, le badge suffit
    return <p className="small" style={{ margin: '6px 0', color: 'var(--ink-soft)' }}>{t('conformite.courierPending')}</p>;
  }
  return (
    <div className="small" style={{ margin: '6px 0', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)' }}>
      <div><b>{t('conformite.courierSellerTitle')}</b> : {v.displayName}</div>
      <div>{t('conformite.courierSellerStatus')}</div>
      <div style={{ color: 'var(--ink-soft)' }}>
        {[v.companyNumber ? t('conformite.courierCompany', { n: v.companyNumber }) : null, v.vatRegime === 'normal' ? t('conformite.courierVatNormal') : t('conformite.courierVatFranchise')].filter(Boolean).join(' · ')}
      </div>
      {refusable && (
        <button type="button" className="btn-ghost" style={{ marginTop: 4, padding: '4px 0', color: 'var(--red)' }} disabled={occupe} onClick={() => setDemande(true)}>
          {t('conformite.declineCourier')}
        </button>
      )}
      <ConfirmDialog open={demande} title={t('conformite.declineCourierConfirmTitle')} message={t('conformite.declineCourierConfirmBody')}
        confirmLabel={t('conformite.declineCourier')} danger loading={occupe} onConfirm={refuser} onCancel={() => setDemande(false)} />
    </div>
  );
}
