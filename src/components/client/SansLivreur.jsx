import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';

// Commande en livraison toujours sans livreur (plan de test LIV-1, 2 octobre 2026). Avant : « attend qu'un livreur passe »,
// sans limite et sans issue. Le client sait maintenant jusqu'à quand on cherche, puis peut annuler, remboursé en entier
// (POST /orders/:id/no-courier-cancel : Fairide paie, le commerce garde son dû).
export default function SansLivreur({ order, token, toast, onUpdated }) {
  const { t } = useLanguage();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { const id = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(id); }, []);
  if (!order.noCourierCancelAt) return null;
  const possible = maintenant >= order.noCourierCancelAt;
  const heure = new Date(order.noCourierCancelAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

  async function annuler() {
    setEnCours(true);
    try {
      const maj = await api(`/orders/${order.id}/no-courier-cancel`, { method: 'POST', token });
      toast(t('orders.noCourier_cancelled'));
      onUpdated(maj);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false); setConfirmer(false);
    }
  }

  return (
    <div className="small" style={{ marginTop: 8 }} role="status">
      {possible ? t('orders.noCourier_stillNone') : t('orders.noCourier_searching', { time: heure })}
      {possible && (
        <div style={{ marginTop: 6 }}>
          <button type="button" className="btn-outline" disabled={enCours} onClick={() => setConfirmer(true)}>{t('orders.noCourier_cancelButton')}</button>
        </div>
      )}
      <ConfirmDialog open={confirmer} title={t('orders.noCourier_cancelTitle')} message={t('orders.noCourier_cancelText')} confirmLabel={t('orders.noCourier_cancelButton')}
        loading={enCours} onCancel={() => setConfirmer(false)} onConfirm={annuler} />
    </div>
  );
}
