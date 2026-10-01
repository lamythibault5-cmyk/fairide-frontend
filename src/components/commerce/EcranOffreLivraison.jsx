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
  // Commerce qui livre lui-même : il fixe ses frais à 100 % (vide = tarif Fairide, forfait + distance).
  const livreLuiMeme = restaurant.deliveryMode === 'own';
  const [fraisPropres, setFraisPropres] = useState(restaurant.ownDeliveryFee != null ? String(restaurant.ownDeliveryFee) : '');

  async function valider() {
    const montant = Number(remise);
    if (!gratuite && (Number.isNaN(montant) || montant < 0 || montant > 50)) { toast(t('editResto.toastAmount0_50')); return; }
    let min = null;
    if (!gratuite && aPartirDe) {
      min = Number(minimum);
      if (Number.isNaN(min) || min < 5 || min > 200) { toast(t('editResto.toastAmount5_200')); return; }
    }
    const propre = fraisPropres.trim() === '' ? null : Number(fraisPropres.replace(',', '.'));
    if (livreLuiMeme && propre !== null && (Number.isNaN(propre) || propre < 0 || propre > 20)) { toast(t('editResto.ownFeeInvalid')); return; }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/delivery-discount`, {
        method: 'PATCH', token,
        body: { freeDelivery: gratuite, deliveryFeeDiscount: gratuite ? 0 : montant, freeDeliveryMinOrder: min, ...(livreLuiMeme ? { ownDeliveryFee: propre } : {}) }
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
      {livreLuiMeme ? (
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor={ids + '-propres'}>{t('editResto.ownFeeLabel')}</label>
          <input id={ids + '-propres'} type="number" inputMode="decimal" min="0" max="20" step="0.5" value={fraisPropres} onChange={(e) => setFraisPropres(e.target.value)} placeholder="4,50" />
          <p className="small" style={{ margin: '4px 0 0' }}>{t('editResto.ownFeeHelp')}</p>
        </div>
      ) : (
        <p className="small" style={{ margin: '0 0 12px', padding: '8px 10px', borderRadius: 8, background: 'var(--cream-dim)' }}>{t('editResto.offerHowItWorks')}</p>
      )}
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
