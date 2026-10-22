import { useId } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { MOTIFS_ANNULATION, chargeDuMotif } from './remboursementAnnulation';

// REMBOURSER EN ANNULANT (audit du 19/10/2026, admin-18). Annuler une commande payée depuis la console la laissait encaissée
// tant que personne ne pensait au bouton « Rembourser », commande par commande. Le choix est maintenant dans la fenêtre
// d'annulation : rembourser en entier (par défaut, comme une annulation normale), une partie, ou rien, et qui le porte.
// Le serveur fait le remboursement (PATCH /admin/orders/:id/status, champ refund, via remboursement.js).
// `valeur` : { mode: 'full' | 'partial' | 'none', amount: '', responsibility: 'restaurant' | 'driver' | 'fairide', reasonCode }.
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
      {/* LE MOTIF DIT QUI PORTE LE REMBOURSEMENT (fondateur, 2026-10-21, décision 3) : motif du côté du commerce → le
          commerce, tout le reste → Fairide. Choisir un motif pose la proposition ; l'équipe peut la changer juste dessous.
          Le serveur garde le motif avec le remboursement et refuse une annulation remboursée sans motif. */}
      {valeur.mode !== 'none' && (
        <div className="small admin-inline-field" style={{ marginTop: 6 }}>
          <label htmlFor={id + '-motif'}>{tr('adminOrders.cancelReasonLabel')}</label>{' '}
          <select id={id + '-motif'} value={valeur.reasonCode || ''} style={{ maxWidth: 240 }}
            onChange={(e) => onChange({ ...valeur, reasonCode: e.target.value, responsibility: chargeDuMotif(e.target.value) || valeur.responsibility })}>
            <option value="" disabled>{tr('adminOrders.cancelReasonChoose')}</option>
            <optgroup label={tr('adminOrders.cancelReasonGroupShop')}>
              {MOTIFS_ANNULATION.filter(([, c]) => c === 'restaurant').map(([code]) => <option key={code} value={code}>{tr(`adminOrders.cancelReason_${code}`)}</option>)}
            </optgroup>
            <optgroup label={tr('adminOrders.cancelReasonGroupOther')}>
              {MOTIFS_ANNULATION.filter(([, c]) => c !== 'restaurant').map(([code]) => <option key={code} value={code}>{tr(`adminOrders.cancelReason_${code}`)}</option>)}
            </optgroup>
          </select>
          {valeur.reasonCode && <p className="small" style={{ margin: '4px 0 0', opacity: 0.75 }}>{tr(`adminOrders.cancelReasonRule_${chargeDuMotif(valeur.reasonCode)}`)}</p>}
        </div>
      )}
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

