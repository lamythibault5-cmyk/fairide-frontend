import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const { t } = useLanguage();

  useEffect(() => {
    // Un restaurateur en mode aperçu n'a pas de vraies commandes client (403 côté API) — liste vide
    // silencieuse plutôt qu'un message d'erreur trompeur, voir MapPage.jsx pour le même filet.
    const isPreviewingRestaurant = previewMode && role === 'restaurant';
    api('/orders/mine', { token }).then(setOrders).catch((e) => { if (!isPreviewingRestaurant) toast(e.message); }).finally(() => setLoading(false));
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

  // Acompte laissé en attente (le client a quitté la page de paiement) : on rouvre le paiement d'ici.
  async function payDeposit(orderId) {
    setCancellingId(orderId);
    try {
      const pay = await api(`/payments/deposit-checkout/${orderId}`, { method: 'POST', token });
      if (pay.simulated) {
        const orders = await api('/orders/mine', { token });
        setOrders(orders);
        toast(pay.message);
      } else {
        window.location.href = pay.checkoutUrl;
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setCancellingId(null);
    }
  }

  // ?type=dine_in n'ouvre pas une autre page : les réservations SONT des commandes, rangées dans
  // la même liste. Le filtre ne fait que la restreindre, pour que « Mes réservations » depuis Mon
  // compte n'oblige pas à retrouver ses tables au milieu de ses livraisons.
  const typeFiltre = searchParams.get('type');
  const listeAffichee = typeFiltre ? orders.filter((o) => o.orderType === typeFiltre) : orders;
  const titre = typeFiltre === 'dine_in' ? t('orders.myReservations') : t('orders.title');
  // Rappel à l'écran, en plus de l'e-mail de la veille : les tables confirmées qui commencent dans les
  // 24 prochaines heures.
  const maintenant = Date.now();
  const rappels = orders.filter((o) => o.orderType === 'dine_in' && o.status === 'preparation' && o.scheduledFor && o.scheduledFor > maintenant && o.scheduledFor - maintenant <= 24 * 3600000);

  if (loading) return <div><h2 className="section-title" style={{ marginTop: 0 }}>{titre}</h2><SkeletonCards count={3} /></div>;
  if (listeAffichee.length === 0) {
    return (
      <div>
        <h2 className="section-title" style={{ marginTop: 0 }}>{titre}</h2>
      {/* Commandes et réservations partagent la barre du bas : la bascule remplace l'ancienne rangée
          « Mes réservations » de Mon compte, qui n'était qu'un lien vers ce même filtre. */}
      <div className="row" style={{ gap: 8, margin: '-6px 0 14px' }}>
        <button type="button" className={typeFiltre ? 'btn-outline' : 'btn-teal'} style={{ padding: '6px 14px' }} onClick={() => setSearchParams({})}>{t('orders.filterAll')}</button>
        <button type="button" className={typeFiltre === 'dine_in' ? 'btn-teal' : 'btn-outline'} style={{ padding: '6px 14px' }} onClick={() => setSearchParams({ type: 'dine_in' })}>{t('orders.filterReservations')}</button>
      </div>
        <div className="empty">
          {typeFiltre === 'dine_in'
            ? t('orders.noReservations')
            : t('orders.empty')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{titre}</h2>
      {/* Commandes et réservations partagent la barre du bas : la bascule remplace l'ancienne rangée
          « Mes réservations » de Mon compte, qui n'était qu'un lien vers ce même filtre. */}
      <div className="row" style={{ gap: 8, margin: '-6px 0 14px' }}>
        <button type="button" className={typeFiltre ? 'btn-outline' : 'btn-teal'} style={{ padding: '6px 14px' }} onClick={() => setSearchParams({})}>{t('orders.filterAll')}</button>
        <button type="button" className={typeFiltre === 'dine_in' ? 'btn-teal' : 'btn-outline'} style={{ padding: '6px 14px' }} onClick={() => setSearchParams({ type: 'dine_in' })}>{t('orders.filterReservations')}</button>
      </div>
      {rappels.map((o) => {
        const jour = new Date(o.scheduledFor).toLocaleDateString(getLocale(), { timeZone: 'Europe/Brussels' }) === new Date().toLocaleDateString(getLocale(), { timeZone: 'Europe/Brussels' }) ? t('orders.reminderToday') : t('orders.reminderTomorrow');
        return (
          <div key={`rappel-${o.id}`} className="card orders-reminder" role="status">
            <b>📅 {t('orders.reminderBanner', { name: o.restaurantName, when: jour, time: new Date(o.scheduledFor).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }), n: o.partySize })}</b>
            {o.deliveryCode && <span className="small"> · {t('orders.reminderCode', { code: o.deliveryCode })}</span>}
          </div>
        );
      })}
      {listeAffichee.map((o) => (
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
                lastUpdatedAt={o.driverLocationUpdatedAt}
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
              <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 6, color: 'var(--ink)' }}>{o.deliveryCode}</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            {o.orderType === 'dine_in' && o.items.length === 0 ? (
              <span className="small">
                {o.reservationDepositAmount > 0
                  ? t('orders.deposit', { amount: `${o.reservationDepositAmount.toFixed(2)}€`, status: t(`orders.depositStatus_${o.reservationDepositStatus}`) })
                  : t('orders.noPrepayment')}
              </span>
            ) : (
              <>
                <span className="small">{o.paid ? t('orders.paid') : t('orders.paymentPending')}</span>
                <b>{o.total.toFixed(2)}€</b>
              </>
            )}
          </div>
          {o.orderType === 'dine_in' && o.items.length > 0 && o.reservationDepositAmount > 0 && (
            <div className="small">{t('orders.deposit', { amount: `${o.reservationDepositAmount.toFixed(2)}€`, status: t(`orders.depositStatus_${o.reservationDepositStatus}`) })}</div>
          )}

          {/* Une réservation s'annule en ligne jusqu'au délai du restaurant (acompte rendu) ; après, on
              l'appelle. Une commande classique, tant qu'elle n'est pas payée. */}
          {o.orderType === 'dine_in' && !['annule', 'refuse', 'livre'].includes(o.status) && (
            <>
              {o.reservationDepositStatus === 'pending' && o.reservationDepositAmount > 0 && (
                <button className="btn-gold" style={{ marginTop: 8 }} disabled={cancellingId === o.id} onClick={() => payDeposit(o.id)}>
                  {t('orders.payDeposit')} — {o.reservationDepositAmount.toFixed(2)}€
                </button>
              )}
              {o.reservationCancelDeadline && Date.now() < o.reservationCancelDeadline && (
                <div className="small" style={{ marginTop: 6 }}>{t('orders.cancelUntil', { date: new Date(o.reservationCancelDeadline).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</div>
              )}
              {(!o.reservationCancelDeadline || Date.now() < o.reservationCancelDeadline) ? (
                <button className="btn-ghost" style={{ marginTop: 4, color: 'var(--red)' }} disabled={cancellingId === o.id} onClick={() => cancelOrder(o.id)}>
                  {cancellingId === o.id ? '...' : t('orders.cancelReservation')}
                </button>
              ) : (
                <div className="small" style={{ marginTop: 6 }}>{t('orders.cancelClosed')}</div>
              )}
            </>
          )}
          {o.orderType !== 'dine_in' && !o.paid && o.status !== 'annule' && o.status !== 'refuse' && (
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
