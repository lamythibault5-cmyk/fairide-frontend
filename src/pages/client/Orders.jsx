import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { DeliveryTiming, ProgressBar, deliveryInstructionLabel, statusLabel, formatOrderItem, orderTypeColor, orderTypeLabel } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsInput } from '../../components/Stars';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';

function ReviewForm({ order, token, toast, onDone, t }) {
  const [foodRating, setFoodRating] = useState(5);
  const [foodComment, setFoodComment] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(order.driverName ? 5 : 0);
  const [deliveryComment, setDeliveryComment] = useState('');
  const [tipChoice, setTipChoice] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api(`/orders/${order.id}/review`, {
        method: 'POST', token,
        body: {
          foodRating, foodComment: foodComment.trim(),
          deliveryRating: order.driverName ? deliveryRating : undefined,
          deliveryComment: order.driverName ? deliveryComment.trim() : undefined
        }
      });
      const tip = tipInput.trim() ? +Number(tipInput).toFixed(2) : tipChoice;
      if (order.driverName && tip > 0) {
        await api(`/orders/${order.id}/tip`, { method: 'PATCH', token, body: { tip } });
        const pay = await api(`/payments/tip-checkout/${order.id}`, { method: 'POST', token });
        if (pay.simulated) {
          toast(t('review.toastThanksTip'));
          onDone();
        } else {
          window.location.href = pay.checkoutUrl;
        }
        return;
      }
      toast(t('review.toastThanks'));
      onDone();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: 14, marginTop: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="small" style={{ marginBottom: 4 }}>{t('review.foodRatingLabel')}</div>
        <StarsInput value={foodRating} onChange={setFoodRating} />
        <input value={foodComment} onChange={(e) => setFoodComment(e.target.value)} placeholder={t('review.foodCommentPlaceholder')} style={{ marginTop: 6 }} />
      </div>
      {order.driverName && (
        <div style={{ marginBottom: 10 }}>
          <div className="small" style={{ marginBottom: 4 }}>{t('review.deliveryRatingLabel')}</div>
          <StarsInput value={deliveryRating} onChange={setDeliveryRating} />
          <input value={deliveryComment} onChange={(e) => setDeliveryComment(e.target.value)} placeholder={t('review.deliveryCommentPlaceholder')} style={{ marginTop: 6 }} />
        </div>
      )}
      {order.driverName && (
        <div style={{ marginBottom: 12 }}>
          <div className="small" style={{ marginBottom: 4, fontWeight: 600 }}>{t('review.tipPrompt', { name: order.driverName })}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map((amount) => (
              <button
                key={amount}
                type="button"
                className={tipChoice === amount && !tipInput.trim() ? 'btn-gold' : 'btn-ghost'}
                onClick={() => { setTipChoice(amount); setTipInput(''); }}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {amount === 0 ? t('review.tipNone') : `${amount}€`}
              </button>
            ))}
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder={t('review.tipOtherPlaceholder')}
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              style={{ width: 110, padding: '6px 10px', fontSize: 13 }}
            />
          </div>
        </div>
      )}
      <button className="btn-teal" disabled={saving} onClick={submit}>{saving ? '...' : t('review.send')}</button>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    api('/orders/mine', { token }).then(setOrders).catch((e) => toast(e.message)).finally(() => setLoading(false));
    const interval = setInterval(() => {
      api('/orders/mine', { token }).then(setOrders).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le client peut annuler tant que la commande n'est pas payée, quel que soit son statut par ailleurs.
  async function cancelOrder(orderId) {
    setCancellingId(orderId);
    try {
      const updated = await api(`/orders/${orderId}/cancel`, { method: 'PATCH', token });
      setOrders((prev) => prev.map((x) => (x.id === orderId ? updated : x)));
      toast(t('orders.toastCancelled'));
    } catch (e) {
      toast(e.message);
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) return <div><h2 className="section-title" style={{ marginTop: 0 }}>{t('orders.title')}</h2><SkeletonCards count={3} /></div>;
  if (orders.length === 0) return <div className="empty">{t('orders.empty')}</div>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('orders.title')}</h2>
      {orders.map((o) => (
        <div className={`card order-type-${orderTypeColor(o)}`} key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>
          </div>
          <div className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o, t)}</div>
          <ProgressBar status={o.status} orderType={o.orderType} />
          <DeliveryTiming order={o} />
          <div className="small" style={{ margin: '6px 0' }}>{o.items.length > 0 ? o.items.map(formatOrderItem).join(', ') : t('orders.reservationNoOrder')}</div>
          {o.orderType === 'pickup' && (
            <div className="small">{t('orders.pickupAt', { name: o.restaurantName, address: o.restaurantAddress ? `, ${o.restaurantAddress}` : '' })}</div>
          )}
          {o.orderType === 'dine_in' && (
            <div className="small">{t('orders.dineInAt', { name: o.restaurantName, address: o.restaurantAddress ? `, ${o.restaurantAddress}` : '', count: o.partySize, reservationName: o.reservationName })}</div>
          )}
          {o.orderType === 'delivery' && (
            <div className="small">📍 {o.address}</div>
          )}
          {o.deliveryInstructions && (
            <div className="small">{deliveryInstructionLabel(o.deliveryInstructions, t)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
          )}
          {o.driverName && (
            <div className="small">{t('orders.driver', { name: o.driverName, phone: o.driverPhone ? ` · ${o.driverPhone}` : '' })}</div>
          )}
          {o.status === 'livraison' && o.restaurantLat && o.deliveryLat && (
            <div style={{ margin: '10px 0' }}>
              <DeliveryTrackingMap
                restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                driverLat={o.driverLat} driverLng={o.driverLng}
              />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                {o.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
              </div>
            </div>
          )}
          {o.paid && o.deliveryCode && o.status !== 'livre' && o.status !== 'refuse' && (
            <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '8px 0' }}>
              <div className="small" style={{ marginBottom: 2 }}>
                {o.orderType === 'pickup' && t('orders.codeShowRestaurant')}
                {o.orderType === 'dine_in' && t('orders.codeShowArrival')}
                {o.orderType === 'delivery' && t('orders.codeGiveDriver')}
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: 'var(--ink)' }}>{o.deliveryCode}</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="small">{o.paid ? t('orders.paid') : t('orders.paymentPending')}</span>
            <b>{o.total.toFixed(2)}€</b>
          </div>

          {!o.paid && o.status !== 'annule' && o.status !== 'refuse' && (
            <button
              className="btn-ghost"
              style={{ marginTop: 8, color: 'var(--red)' }}
              disabled={cancellingId === o.id}
              onClick={() => cancelOrder(o.id)}
            >
              {cancellingId === o.id ? '...' : t('orders.cancelOrder')}
            </button>
          )}

          {o.status === 'livre' && !o.reviewed && reviewingId !== o.id && (
            <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setReviewingId(o.id)}>{t('orders.leaveReview')}</button>
          )}
          {o.status === 'livre' && o.reviewed && (
            <div className="small" style={{ marginTop: 8, color: 'var(--teal-deep)' }}>{t('orders.reviewSent')}</div>
          )}
          {reviewingId === o.id && (
            <ReviewForm
              order={o} token={token} toast={toast} t={t}
              onDone={() => { setReviewingId(null); setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, reviewed: true } : x))); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
