import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel } from '../../orderStatus';
import { getScheduleDateOptions, getScheduleTimeOptions } from '../../scheduleUtils';
import { useLanguage } from '../../context/LanguageContext';

// Page dédiée affichée après le clic sur "Commander" depuis le panier : le client y choisit
// livraison/à emporter, vérifie ses informations, puis valide avant de passer au paiement.
export default function Checkout() {
  const { token, user, refreshUser } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  // Arrivée via "Réserver une table" depuis la page du restaurant : réservation seule, sans articles
  // au panier — le client valide juste ses infos de réservation, envoyées au restaurant sans paiement.
  const reservationOnly = !!location.state?.reservationOnly;

  const [restaurant, setRestaurant] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('sonner');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [useBalance, setUseBalance] = useState(true);
  const [fulfillmentType, setFulfillmentType] = useState(reservationOnly ? 'dine_in' : 'delivery');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(reservationOnly ? getScheduleDateOptions()[0].value : '');
  const [scheduleTime, setScheduleTime] = useState('');
  const [dateOptions] = useState(getScheduleDateOptions);
  const [partySize, setPartySize] = useState(2);
  const [reservationName, setReservationName] = useState(user.name || '');
  const [placing, setPlacing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pendingOrderRef = useRef(null);

  const restaurantId = cart.restaurantId;

  useEffect(() => {
    if (!restaurantId || (cart.count === 0 && !reservationOnly)) {
      navigate('/restaurants');
      return;
    }
    api(`/restaurants/${restaurantId}`).then(setRestaurant).catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    if (pendingOrder && pendingOrderRef.current) {
      pendingOrderRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pendingOrder]);

  if (notFound) return <div className="empty">{t('checkout.notAvailable')}</div>;
  if (!restaurant) return <SkeletonCards count={2} />;

  const totals = cart.totals(restaurant.menu);
  // À emporter : pas de frais de livraison/système, contrairement à l'estimation par défaut de cart.totals().
  const estimatedTotalBeforeBalance = fulfillmentType === 'delivery' ? totals.total : totals.subtotal;
  const estimatedTotal = Math.max(0, estimatedTotalBeforeBalance - (useBalance ? Math.min(user.balance || 0, estimatedTotalBeforeBalance) : 0));
  const scheduleTimeOptions = scheduleDate ? getScheduleTimeOptions(scheduleDate) : [];
  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  const isPureReservation = pendingOrder?.orderType === 'dine_in' && pendingOrder.items.length === 0;

  function selectFulfillment(type) {
    setFulfillmentType(type);
    if (type === 'dine_in') {
      setScheduleEnabled(false);
      if (!scheduleDate) setScheduleDate(dateOptions[0].value);
      setScheduleTime('');
    } else {
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
    }
  }

  async function placeOrder() {
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast(t('checkout.toastAddressRequired'));
      return;
    }
    if (fulfillmentType === 'dine_in') {
      if (!scheduleDate || !scheduleTime) {
        toast(t('checkout.toastReservationDateTimeRequired'));
        return;
      }
      if (!partySize || partySize < 1) {
        toast(t('checkout.toastPartySizeRequired'));
        return;
      }
      if (!reservationName.trim()) {
        toast(t('checkout.toastReservationNameRequired'));
        return;
      }
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast(t('checkout.toastScheduledDateTimeRequired'));
      return;
    }
    const isScheduled = fulfillmentType === 'dine_in' || scheduleEnabled;
    const scheduledForISO = isScheduled ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString() : null;
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
    setPlacing(true);
    try {
      // Les frais de livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande
      // créée côté serveur — on affiche donc le total exact avant de rediriger vers le paiement.
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId, items, orderType: fulfillmentType,
          scheduledFor: scheduledForISO,
          ...(fulfillmentType === 'delivery' ? {
            addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
            addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
            deliveryInstructions, deliveryNote: deliveryNote.trim()
          } : {}),
          ...(fulfillmentType === 'dine_in' ? { partySize: Number(partySize), reservationName: reservationName.trim() } : {}),
          useBalance
        }
      });
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      setDeliveryConfirmed(false);
      setPendingOrder(order);
    } catch (e) {
      toast(e.message);
    } finally {
      setPlacing(false);
    }
  }

  async function confirmAndPay() {
    setPaying(true);
    try {
      const pay = await api(`/payments/checkout/${pendingOrder.id}`, { method: 'POST', token });
      // Le panier n'est vidé qu'une fois le paiement confirmé, pas dès la création de la commande —
      // sinon "Annuler" laisserait le client avec un panier vide, sans possibilité de reformuler son
      // choix (livraison/à emporter, planification) sans tout rajouter au panier.
      cart.clear();
      if (pay.simulated) {
        toast(isPureReservation ? t('checkout.toastReservationSent') : t('checkout.toastOrderPaid'));
        navigate('/orders');
      } else {
        window.location.href = pay.checkoutUrl;
      }
    } catch (e) {
      toast(e.message);
      setPaying(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${pendingOrder.id}/cancel`, { method: 'PATCH', token });
      toast(t('checkout.toastOrderCancelled'));
      setPendingOrder(null);
      if (pendingOrder.balanceUsed > 0) refreshUser().catch(() => {});
    } catch (e) {
      toast(e.message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <Link to={`/restaurants/${restaurantId}`} className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10 }}>&larr; {restaurant.name}</Link>

      {!pendingOrder && (
        <>
          {cart.count > 0 && (
          <div className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('checkout.yourOrder')}</h3>
            {Object.entries(cart.lines).map(([lineKey, line]) => {
              const item = restaurant.menu.find((m) => m.id === line.itemId);
              if (!item) return null;
              return (
                <div key={lineKey} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
                  <span>
                    {line.qty}× {item.name}
                    {line.optionsSnapshot?.length > 0 && (
                      <span className="small" style={{ display: 'block' }}>{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                    )}
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, -1)}>−</button>
                    <span>{line.qty}</span>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, 1)}>+</button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>{t('common.subtotal')}</span><span>{totals.rawSubtotal.toFixed(2)}€</span></div>
              {totals.discountedItems.map((d, i) => (
                <div className="line" key={i}><span>🏷️ {d.name} ({d.label})</span><span>-{d.discount.toFixed(2)}€</span></div>
              ))}
              {fulfillmentType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')} ({t('checkout.fromPrefix')})</span><span>{totals.deliveryFee.toFixed(2)}€</span></div>
                  <div className="line"><span>{t('checkout.serviceFeeLine')} ({t('checkout.fromPrefix')})</span><span>{totals.serviceFee.toFixed(2)}€</span></div>
                </>
              )}
              <div className="line"><span>{t('checkout.commissionLine')}</span><span>{totals.commission.toFixed(2)}€</span></div>
              {useBalance && user.balance > 0 && (
                <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{Math.min(user.balance, estimatedTotalBeforeBalance).toFixed(2)}€</span></div>
              )}
              <div className="line total"><span>{t('checkout.estimatedTotal')}</span><span>{estimatedTotal.toFixed(2)}€</span></div>
            </div>
            {user.balance > 0 && (
              <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                <span className="small">{t('checkout.useBalance', { amount: Number(user.balance).toFixed(2) })}</span>
              </label>
            )}
          </div>
          )}

          <div className="card">
            <div className="field">
              <label>{cart.count === 0 ? t('checkout.yourReservation') : t('checkout.howToGet')}</label>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className={fulfillmentType === 'dine_in' ? 'btn-gold' : 'btn-outline'} style={{ flex: 1 }} onClick={() => selectFulfillment('dine_in')}>{t('orderStatus.orderType.dineIn')}</button>
                {cart.count > 0 && (
                  <>
                    <button type="button" className={fulfillmentType === 'delivery' ? 'btn-gold' : 'btn-outline'} style={{ flex: 1 }} onClick={() => selectFulfillment('delivery')}>{t('orderStatus.orderType.delivery')}</button>
                    <button type="button" className={fulfillmentType === 'pickup' ? 'btn-gold' : 'btn-outline'} style={{ flex: 1 }} onClick={() => selectFulfillment('pickup')}>{t('orderStatus.orderType.pickup')}</button>
                  </>
                )}
              </div>
            </div>
            {fulfillmentType === 'delivery' && (
              <>
                <div className="field">
                  <label>{t('auth.street')}</label>
                  <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('checkout.streetPlaceholder')} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t('auth.number')}</label>
                    <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder={t('checkout.numberPlaceholder')} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t('auth.postalCode')}</label>
                    <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder={t('checkout.postalPlaceholder')} />
                  </div>
                </div>
                <div className="field">
                  <label>{t('auth.city')}</label>
                  <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder={t('checkout.cityPlaceholder')} />
                </div>
                <div className="field">
                  <label>{t('checkout.atDelivery')}</label>
                  <select value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)}>
                    {DELIVERY_INSTRUCTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{deliveryInstructionLabel(o.value, t)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('checkout.driverNote')}</label>
                  <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder={t('checkout.driverNotePlaceholder')} />
                </div>
              </>
            )}
            {fulfillmentType === 'pickup' && (
              <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.pickupSelf', { name: restaurant.name, address: restaurant.address ? `, ${restaurant.address}` : '' })}</p>
            )}
            {fulfillmentType === 'dine_in' && (
              <>
                <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.dineInHere', { name: restaurant.name, address: restaurant.address ? `, ${restaurant.address}` : '' })}</p>
                <div className="field">
                  <label>{t('checkout.reservationDateTime')}</label>
                  <div className="row" style={{ gap: 8 }}>
                    <select
                      value={scheduleDate}
                      onChange={(e) => { setScheduleDate(e.target.value); setScheduleTime(''); }}
                      style={{ flex: 1 }}
                    >
                      {dateOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    <select
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">{t('checkout.timePlaceholder')}</option>
                      {scheduleTimeOptions.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                    </select>
                  </div>
                  {scheduleTimeOptions.length === 0 && (
                    <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{t('checkout.noSlotsToday')}</p>
                  )}
                  {scheduledPreview && (
                    <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.reservationForPreview', { preview: scheduledPreview })}</p>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t('checkout.partySize')}</label>
                    <input
                      type="number" min="1" max="30"
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label>{t('checkout.reservationName')}</label>
                    <input value={reservationName} onChange={(e) => setReservationName(e.target.value)} placeholder={t('checkout.reservationNamePlaceholder')} />
                  </div>
                </div>
              </>
            )}
            {fulfillmentType !== 'dine_in' && (
              <div className="field">
                <label className="row" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={scheduleEnabled}
                    onChange={(e) => {
                      setScheduleEnabled(e.target.checked);
                      if (e.target.checked) { setScheduleDate(dateOptions[0].value); setScheduleTime(''); }
                      else { setScheduleDate(''); setScheduleTime(''); }
                    }}
                  />
                  <span>{t('checkout.scheduleLater')}</span>
                </label>
                {scheduleEnabled && (
                  <>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <select
                        value={scheduleDate}
                        onChange={(e) => { setScheduleDate(e.target.value); setScheduleTime(''); }}
                        style={{ flex: 1 }}
                      >
                        {dateOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <select
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">{t('checkout.timePlaceholder')}</option>
                        {scheduleTimeOptions.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                      </select>
                    </div>
                    {scheduleTimeOptions.length === 0 && (
                      <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{t('checkout.noSlotsToday')}</p>
                    )}
                    {scheduledPreview && (
                      <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.scheduledPreview', { preview: scheduledPreview })}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="cart-bar">
            <Link to={`/restaurants/${restaurantId}`} className="btn-ghost">{t('checkout.addDish')}</Link>
            <span>{cart.count > 0 ? t('checkout.itemsCountFrom', { count: cart.count, total: estimatedTotal.toFixed(2) }) : t('checkout.reservationNoOrder')}</span>
            <button className="btn-gold" disabled={placing} onClick={placeOrder}>
              {placing ? '...' : cart.count === 0 ? t('checkout.sendReservation') : t('checkout.validateInfo')}
            </button>
          </div>
        </>
      )}

      {pendingOrder && (
        <div className="card" ref={pendingOrderRef}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{isPureReservation ? t('checkout.confirmReservationTitle') : t('checkout.confirmOrderTitle')}</h3>
          {pendingOrder.orderType === 'delivery' && !pendingOrder.scheduledFor && (
            <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.deliveryFeeNote')}</p>
          )}

          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', margin: '0 0 14px' }}>
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 8px' }}>
              <input
                type="checkbox"
                checked={deliveryConfirmed}
                onChange={(e) => setDeliveryConfirmed(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span className="small" style={{ fontWeight: 600 }}>
                {pendingOrder.orderType === 'delivery' && t('checkout.confirmDeliveryInfo')}
                {pendingOrder.orderType === 'pickup' && t('checkout.confirmPickupSelf')}
                {pendingOrder.orderType === 'dine_in' && t('checkout.confirmReservation')}
              </span>
            </label>
            {pendingOrder.orderType === 'delivery' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.addressLabel')}</b> {pendingOrder.address}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.atDeliveryColon')}</b> {deliveryInstructionLabel(pendingOrder.deliveryInstructions, t)}</p>
                {pendingOrder.deliveryNote && <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.driverNoteColon')}</b> {pendingOrder.deliveryNote}</p>}
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.scheduledDeliveryFor')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.estimatedArrival')}</b> {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
            {pendingOrder.orderType === 'pickup' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.pickupAtColon')}</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.readyForColon')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.pickupEstimateColon')}</b> {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
            {pendingOrder.orderType === 'dine_in' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.tableAtColon')}</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.reservedNameOfColon')}</b> {pendingOrder.reservationName}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.partySizeColon')}</b> {pendingOrder.partySize}</p>
                {pendingOrder.scheduledFor && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.reservedForColon')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
          </div>

          {!isPureReservation && (
            <div className="breakdown">
              <div className="line"><span>{t('common.subtotal')}</span><span>{pendingOrder.subtotal.toFixed(2)}€</span></div>
              {pendingOrder.promoDiscount > 0 && <div className="line"><span>{t('checkout.promoLine', { label: pendingOrder.promoLabel })}</span><span>-{pendingOrder.promoDiscount.toFixed(2)}€</span></div>}
              {pendingOrder.orderType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')}</span><span>{pendingOrder.deliveryFee.toFixed(2)}€</span></div>
                  <div className="line"><span>{t('checkout.serviceFeeLine')}</span><span>{pendingOrder.serviceFee.toFixed(2)}€</span></div>
                </>
              )}
              {pendingOrder.balanceUsed > 0 && <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{pendingOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>{t('checkout.totalToPay')}</span><span>{pendingOrder.total.toFixed(2)}€</span></div>
            </div>
          )}

          {!deliveryConfirmed && (
            <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>{t('checkout.confirmCheckboxWarning')}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn-gold" disabled={paying || cancelling || !deliveryConfirmed} onClick={confirmAndPay}>
              {paying ? '...' : isPureReservation ? t('checkout.sendReservation') : t('checkout.confirmAndPay')}
            </button>
            <button className="btn-ghost" disabled={paying || cancelling} onClick={cancelOrder}>{cancelling ? '...' : t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
