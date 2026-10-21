import { useId } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';

// REMBOURSER EN ANNULANT (audit du 19/10/2026, admin-18). Annuler une commande payée depuis la console la laissait encaissée
// tant que personne ne pensait au bouton « Rembourser », commande par commande. Le choix est maintenant dans la fenêtre
// d'annulation : rembourser en entier (par défaut, comme une annulation normale), une partie, ou rien, et qui le porte.
// Le serveur fait le remboursement (PATCH /admin/orders/:id/status, champ refund, via remboursement.js).
// `valeur` : { mode: 'full' | 'partial' | 'none', amount: '', responsibility: 'restaurant' | 'driver' | 'fairide' }.
// `reste` : ce qui reste remboursable sur la commande ; absent en lot (chaque commande payée en ligne est remboursée en entier).
export default function ChoixRemboursement({ valeur, onChange, reste = null }) {
  const { t: tr } = useLanguage();
  const id = useId();
  const poser = (champ, v) => onChange({ ...valeur, [champ]: v });
  const enLot = reste === null;
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
      <legend className="field-intitule">{tr('adminOrders.cancelRefundTitle')}</legend>
      <label className="row" style={{ gap: 6, alignItems: 'center' }}>
        <input type="radio" name={id + '-mode'} checked={valeur.mode === 'full'} onChange={() => poser('mode', 'full')} />
        {enLot ? tr('adminOrders.cancelRefundFullBulk') : tr('adminOrders.cancelRefundFull', { amount: euros(reste) })}
      </label>
      {!enLot && (
        <label className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="radio" name={id + '-mode'} checked={valeur.mode === 'partial'} onChange={() => poser('mode', 'partial')} />
          {tr('adminOrders.cancelRefundPartial')}
          {valeur.mode === 'partial' && (
            <input type="number" step="0.01" min="0.01" max={reste} value={valeur.amount} onChange={(e) => poser('amount', e.target.value)} aria-label={tr('adminOrders.refundedAmount')} style={{ maxWidth: 110 }} />
          )}
        </label>
      )}
      <label className="row" style={{ gap: 6, alignItems: 'center' }}>
        <input type="radio" name={id + '-mode'} checked={valeur.mode === 'none'} onChange={() => poser('mode', 'none')} />
        {tr('adminOrders.cancelRefundNone')}
      </label>
      {valeur.mode !== 'none' && (
        <label className="small admin-inline-field" htmlFor={id + '-charge'} style={{ marginTop: 6 }}>
          {tr('adminOrders.cancelRefundBorneBy')}{' '}
          <select id={id + '-charge'} value={valeur.responsibility} onChange={(e) => poser('responsibility', e.target.value)} style={{ maxWidth: 160 }}>
            <option value="restaurant">{tr('adminCommon.resto')}</option>
            <option value="driver">{tr('adminCommon.driver')}</option>
            <option value="fairide">{tr('adminCommon.fairide')}</option>
          </select>
        </label>
      )}
    </fieldset>
  );
}

