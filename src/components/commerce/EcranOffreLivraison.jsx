import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import BoutonEnregistrer from './BoutonEnregistrer';

// Mon commerce › Livraison offerte : le commerce prend à sa charge tout ou partie du tarif de livraison,
// affiché comme une offre sur sa fiche (RestaurantList.jsx). Le livreur et Fairide ne sont jamais
// affectés — le détail du calcul est dans routes/orders.js côté serveur. Route à part
// (PATCH /delivery-discount), d'où un enregistrement propre à cet écran.
export default function EcranOffreLivraison({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [gratuite, setGratuite] = useState(!!restaurant.freeDelivery);
  const [remise, setRemise] = useState(String(restaurant.deliveryFeeDiscount || 0));
  const [aPartirDe, setAPartirDe] = useState(restaurant.freeDeliveryMinOrder != null);
  const [minimum, setMinimum] = useState(restaurant.freeDeliveryMinOrder != null ? String(restaurant.freeDeliveryMinOrder) : '20');
  const [enCours, setEnCours] = useState(false);

  async function valider() {
    const montant = Number(remise);
    if (!gratuite && (Number.isNaN(montant) || montant < 0 || montant > 50)) { toast(t('editResto.toastAmount0_50')); return; }
    let min = null;
    if (!gratuite && aPartirDe) {
      min = Number(minimum);
      if (Number.isNaN(min) || min < 5 || min > 200) { toast(t('editResto.toastAmount5_200')); return; }
    }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/delivery-discount`, {
        method: 'PATCH', token,
        body: { freeDelivery: gratuite, deliveryFeeDiscount: gratuite ? 0 : montant, freeDeliveryMinOrder: min }
      });
      await loadDashboard(restoId);
      toast(t('editResto.toastOfferUpdated'));
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <SousEcran titre={t('editResto.rowDeliveryOffer')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={gratuite} onChange={(e) => setGratuite(e.target.checked)} />
        <span>{t('editResto.freeDelivery')}</span>
      </label>
      {!gratuite && (
        <>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor={ids + '-remise'}>{t('editResto.fixedDiscount')}</label>
            <input id={ids + '-remise'} type="number" inputMode="decimal" min="0" max="50" step="0.5" value={remise} onChange={(e) => setRemise(e.target.value)} placeholder={t('editResto.phEx2')} />
          </div>
          <label className="row" style={{ gap: 8, margin: '12px 0', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={aPartirDe} onChange={(e) => setAPartirDe(e.target.checked)} />
            <span>{t('editResto.freeDeliveryFrom')}</span>
          </label>
          {aPartirDe && (
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor={ids + '-min'}>{t('editResto.minOrderAmount')}</label>
              <input id={ids + '-min'} type="number" inputMode="decimal" min="5" max="200" step="1" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder={t('editResto.phEx25')} />
            </div>
          )}
        </>
      )}
    </SousEcran>
  );
}
