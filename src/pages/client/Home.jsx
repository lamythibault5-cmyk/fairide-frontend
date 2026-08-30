import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { DeliveryTiming, ProgressBar, deliveryInstructionLabel, statusLabel, formatOrderItem, orderTypeColor, orderTypeLabel } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';

const ACTIVE_STATUSES = ['nouveau', 'preparation', 'pret', 'livraison'];

export default function ClientHome() {
  const { token, user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const { setRightSlot } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/orders/mine', { token }).then(setOrders).catch((e) => toast(e.message)).finally(() => setLoading(false));
    api('/restaurants/favorites/mine', { token }).then((r) => setFavoriteCount(r.length)).catch(() => {});
    const interval = setInterval(() => {
      api('/orders/mine', { token }).then(setOrders).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrder = orders.find((o) => ACTIVE_STATUSES.includes(o.status));

  useEffect(() => {
    setRightSlot(
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Raccourcis</h3>
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat-card highlight"><div className="num">{Number(user?.balance || 0).toFixed(2)}€</div><div className="label">{t('account.balance')}</div></div>
          <div className="stat-card"><div className="num">{favoriteCount}</div><div className="label">{t('nav.favorites')}</div></div>
        </div>
        <Link to="/favorites" className="btn-ghost btn-block" style={{ marginBottom: 8, textAlign: 'center' }}>❤️ {t('nav.favorites')}</Link>
        <Link to="/orders" className="btn-ghost btn-block" style={{ textAlign: 'center' }}>📦 {t('nav.orders')}</Link>
      </div>
    );
    return () => setRightSlot(null);
  }, [user?.balance, favoriteCount, t, setRightSlot]);

  if (loading) return <SkeletonCards count={2} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Bienvenue{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h2>

      {activeOrder ? (
        <div className={`card order-type-${orderTypeColor(activeOrder)}`}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{activeOrder.restaurantName}</b>
            <span className={`status-badge status-${activeOrder.status}`}>{statusLabel(activeOrder.status, activeOrder.orderType, t)}</span>
          </div>
          <div className={`order-type-badge order-type-badge-${orderTypeColor(activeOrder)}`}>{orderTypeLabel(activeOrder, t)}</div>
          <ProgressBar status={activeOrder.status} orderType={activeOrder.orderType} />
          <DeliveryTiming order={activeOrder} />
          <div className="small" style={{ margin: '6px 0' }}>{activeOrder.items.length > 0 ? activeOrder.items.map(formatOrderItem).join(', ') : t('orders.reservationNoOrder')}</div>
          {activeOrder.orderType === 'delivery' && <div className="small">📍 {activeOrder.address}</div>}
          {activeOrder.deliveryInstructions && (
            <div className="small">{deliveryInstructionLabel(activeOrder.deliveryInstructions, t)}{activeOrder.deliveryNote ? ` — ${activeOrder.deliveryNote}` : ''}</div>
          )}
          {activeOrder.driverName && (
            <div className="small">{t('orders.driver', { name: activeOrder.driverName, phone: activeOrder.driverPhone ? ` · ${activeOrder.driverPhone}` : '' })}</div>
          )}
          {activeOrder.status === 'livraison' && activeOrder.restaurantLat && activeOrder.deliveryLat && (
            <div style={{ margin: '10px 0' }}>
              <DeliveryTrackingMap
                restaurantLat={activeOrder.restaurantLat} restaurantLng={activeOrder.restaurantLng}
                deliveryLat={activeOrder.deliveryLat} deliveryLng={activeOrder.deliveryLng}
                driverLat={activeOrder.driverLat} driverLng={activeOrder.driverLng}
                lastUpdatedAt={activeOrder.driverLocationUpdatedAt}
              />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                {activeOrder.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
              </div>
            </div>
          )}
          {activeOrder.paid && activeOrder.deliveryCode && (
            <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '8px 0' }}>
              <div className="small" style={{ marginBottom: 2 }}>
                {activeOrder.orderType === 'pickup' && t('orders.codeShowRestaurant')}
                {activeOrder.orderType === 'dine_in' && t('orders.codeShowArrival')}
                {activeOrder.orderType === 'delivery' && t('orders.codeGiveDriver')}
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: 'var(--ink)' }}>{activeOrder.deliveryCode}</div>
            </div>
          )}
          <Link to="/orders" className="small" style={{ display: 'block', textAlign: 'right', marginTop: 8 }}>Voir toutes mes commandes →</Link>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <p style={{ margin: '0 0 14px' }}>Pas de commande en cours. De quoi as-tu envie aujourd'hui ?</p>
          <Link to="/restaurants" className="btn-teal">🍽️ Parcourir les restaurants</Link>
        </div>
      )}
    </div>
  );
}
