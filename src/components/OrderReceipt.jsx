import { orderTypeLabel, deliveryInstructionLabel } from '../orderStatus';
import { useLanguage, getLocale } from '../context/LanguageContext';

function formatDateTime(ms) {
  return new Date(ms).toLocaleString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Bon de livraison imprimable, pensé pour être glissé/scotché sur le sac avant que le livreur ne
// l'emporte : identifie la commande pour le livreur ET sert de reçu pour le client à l'ouverture du
// sac. Toujours monté hors de tout ancêtre `.no-print` (voir OrdersPage.jsx) — cette contrainte est ce
// qui permet à `.receipt-print` de rester le SEUL élément visible à l'impression (voir styles.css).
// N'affiche jamais l'adresse de livraison : inutile ici (le livreur l'a déjà dans son appli) et ce
// serait l'adresse d'un particulier visible par n'importe qui pendant tout le trajet.
export default function OrderReceipt({ order, restaurant }) {
  const { t } = useLanguage();
  if (!order) return null;
  const vatNumber = restaurant?.vatNumber;
  const companyNumber = restaurant?.companyNumber;

  return (
    <div className="receipt-print">
      <h3 style={{ textAlign: 'center' }}>{restaurant?.legalName || restaurant?.name}</h3>
      {restaurant?.address && <p className="receipt-center">{restaurant.address}</p>}
      {(vatNumber || companyNumber) && (
        <p className="receipt-center">
          {vatNumber && <>TVA {vatNumber}</>}
          {vatNumber && companyNumber && ' · '}
          {companyNumber && <>{t('receipt.companyNumber', { n: companyNumber })}</>}
        </p>
      )}
      <div className="receipt-divider" />
      <p className="receipt-center"><b>{t('receipt.orderNumber', { id: order.id.slice(0, 8) })}</b></p>
      <p className="receipt-center">{formatDateTime(order.createdAt)} · {orderTypeLabel(order)}</p>
      <div className="receipt-divider" />
      <p style={{ margin: '4px 0' }}>
        <b>{order.orderType === 'dine_in' ? order.reservationName : order.clientName}</b>
        {order.clientPhone && <> · {order.clientPhone}</>}
      </p>
      {order.orderType === 'dine_in' && <p style={{ margin: '4px 0' }}>Table pour {order.partySize} personne{order.partySize > 1 ? 's' : ''}</p>}
      {order.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}>{t('receipt.instruction', { label: deliveryInstructionLabel(order.deliveryInstructions, t) })}</p>}
      {order.deliveryNote && <p className="small" style={{ margin: '4px 0' }}>{t('receipt.note', { note: order.deliveryNote })}</p>}
      <div className="receipt-divider" />
      {/* Réservation de table sans plat : sans ce cas, le reçu affichait une liste vide puis un
          « Total payé 0.00€ », qui se lit comme une commande impayée. */}
      {order.items.length === 0 && (
        <p className="receipt-center" style={{ margin: '8px 0' }}>
          <b>{t('receipt.reservationNoOrder')}</b><br />{t('receipt.willOrderOnSite')}
        </p>
      )}
      {order.items.map((i) => (
        <div key={i.itemId} className="receipt-line" style={{ alignItems: 'flex-start' }}>
          <span>
            {i.qty}× {i.name}
            {i.options?.length > 0 && <span className="small" style={{ display: 'block' }}>{i.options.map((o) => o.name).join(', ')}</span>}
          </span>
          <span>{(i.price * i.qty - (i.discount || 0)).toFixed(2)}€</span>
        </div>
      ))}
      {order.items.length > 0 && <>
      <div className="receipt-divider" />
      <div className="receipt-line"><span>{t('receipt.subtotal')}</span><span>{order.subtotal.toFixed(2)}€</span></div>
      {order.promoDiscount > 0 && <div className="receipt-line"><span>{t('receipt.promo', { label: order.promoLabel })}</span><span>-{order.promoDiscount.toFixed(2)}€</span></div>}
      {order.orderType === 'delivery' && <div className="receipt-line"><span>{t('receipt.delivery')}</span><span>{order.deliveryFee.toFixed(2)}€</span></div>}
      {order.serviceFee > 0 && <div className="receipt-line"><span>{t('receipt.serviceFee')}</span><span>{order.serviceFee.toFixed(2)}€</span></div>}
      {order.balanceUsed > 0 && <div className="receipt-line"><span>{t('receipt.balanceUsed')}</span><span>-{order.balanceUsed.toFixed(2)}€</span></div>}
      <div className="receipt-divider" />
      <div className="receipt-line receipt-total"><span>{t('receipt.totalPaid')}</span><span>{order.total.toFixed(2)}€</span></div>
      <p className="receipt-center" style={{ margin: '4px 0' }}>{order.paid ? t('receipt.paidVia') : t('receipt.unpaid')}</p>
      </>}
      <div className="receipt-divider" />
      <p className="receipt-note">
        {t('receipt.disclaimer')}
      </p>
      <p className="receipt-center" style={{ marginTop: 10 }}>{t('receipt.thanks')}</p>
    </div>
  );
}
