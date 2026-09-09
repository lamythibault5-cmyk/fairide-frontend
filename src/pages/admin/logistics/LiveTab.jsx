import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { ORDER_STATUS_LABELS } from '../adminUtils';
import { useApiData, LoadState, KpiCard, Freshness, useAutoRefresh, fmtTime, minutesDepuis } from './common';
import LiveMap from './LiveMap';

// Onglet En direct : livraisons en cours (nouveau → livraison) sur une carte (livreurs, restaurants,
// points de livraison) et en liste, retards en évidence. Rafraîchi toutes les 20 s.
export default function LiveTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const live = useApiData(() => api('/admin/logistics/live', { token }), []);
  useAutoRefresh(live.reload, 20000);

  const orders = useMemo(() => [...(live.data?.orders || [])].sort((a, b) => (Number(b.late) - Number(a.late)) || a.createdAt - b.createdAt), [live.data]);

  // Points de la carte : un marqueur par livreur (dernière position parmi ses commandes), par restaurant
  // (dédoublonné par nom) et par point de livraison.
  const points = useMemo(() => {
    const livreurs = new Map();
    const restos = new Map();
    const out = [];
    for (const o of orders) {
      if (o.driverId && o.driverLat !== null && o.driverLng !== null) {
        const prev = livreurs.get(o.driverId);
        if (!prev || (o.driverUpdatedAt || 0) > (prev.updatedAt || 0)) {
          livreurs.set(o.driverId, { id: `d-${o.driverId}`, kind: 'driver', lat: o.driverLat, lng: o.driverLng, label: o.driverName || tr('adminCommon.driver'), sub: `${o.restaurantName} → ${o.commune}`, late: o.late, updatedAt: o.driverUpdatedAt });
        }
      }
      if (o.restaurantLat !== null && o.restaurantLng !== null && !restos.has(o.restaurantName)) {
        restos.set(o.restaurantName, { id: `r-${o.restaurantName}`, kind: 'restaurant', lat: o.restaurantLat, lng: o.restaurantLng, label: o.restaurantName, sub: o.commune });
      }
      if (o.clientLat !== null && o.clientLng !== null) {
        out.push({ id: `c-${o.id}`, kind: 'client', lat: o.clientLat, lng: o.clientLng, label: `#${o.id.slice(0, 8)}`, sub: o.clientCity || o.commune });
      }
    }
    return [...livreurs.values(), ...restos.values(), ...out];
  }, [orders, tr]);

  return (
    <LoadState state={live} skeleton={3}>
      {(d) => {
        const late = orders.filter((o) => o.late).length;
        const sansLivreur = orders.filter((o) => !o.driverId).length;
        return (
          <>
            <Freshness at={d.generatedAt} onRefresh={live.reload} loading={live.loading} />
            <div className="stat-grid">
              <KpiCard value={orders.length} label={tr('adminLogistics.kpiInProgress')} highlight />
              <KpiCard value={late} label={tr('adminLogistics.kpiLate')} warn={late > 0} />
              <KpiCard value={sansLivreur} label={tr('adminLogistics.kpiUnassigned')} warn={sansLivreur > 0} />
              <KpiCard value={orders.filter((o) => o.status === 'livraison').length} label={tr('adminLogistics.statusDelivering')} />
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminLogistics.mapTitle')}</h3>
              {points.length === 0 && <p className="small lg-muted" style={{ margin: '0 0 8px' }}>{tr('adminLogistics.noPositions')}</p>}
              <LiveMap points={points} height={points.length ? 420 : 240} />
              <div className="lg-legend">
                <span><i style={{ background: 'var(--iris)' }} /> {tr('adminLogistics.legendDriver')}</span>
                <span><i style={{ background: 'var(--red)' }} /> {tr('adminLogistics.legendDriverLate')}</span>
                <span><i style={{ background: 'var(--gold, #E8B04B)' }} /> {tr('adminLogistics.legendRestaurant')}</span>
                <span><i style={{ background: 'var(--ink)' }} /> {tr('adminLogistics.legendClient')}</span>
              </div>
            </div>

            <div className="card">
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminLogistics.listTitle')} <span className="pill">{orders.length}</span></h3>
              {orders.length === 0 && <div className="empty" style={{ padding: '24px 0' }}>{tr('adminLogistics.emptyLive')}</div>}
              {orders.length > 0 && (
                <div className="lg-live-list">
                  {orders.map((o) => {
                    const pos = minutesDepuis(o.driverUpdatedAt);
                    return (
                      <div key={o.id} className={`lg-live-card${o.late ? ' late' : ''}`}>
                        <div className="head">
                          <b>{o.restaurantName}</b>
                          <span className="row" style={{ gap: 4 }}>
                            {o.late && <span className="lg-pill late">{tr('adminLogistics.lateBadge')}</span>}
                            {o.isTest && <span className="lg-pill test">{tr('adminLogistics.testBadge')}</span>}
                          </span>
                        </div>
                        <div className="meta">
                          <span className={`lg-pill ${o.status === 'livraison' ? 'delivering' : 'online'}`}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
                          <span>{o.commune}{o.clientCity && o.clientCity !== o.commune ? ` → ${o.clientCity}` : ''}</span>
                        </div>
                        <div className="meta">
                          <span>{tr('adminLogistics.createdAt', { time: fmtTime(o.createdAt) })}</span>
                          {o.estimatedDeliveryAt && <span>· {tr('adminLogistics.etaAt', { time: fmtTime(o.estimatedDeliveryAt) })}</span>}
                        </div>
                        <div className="meta">
                          <span>🚴 {o.driverName || <span className="lg-muted">{tr('adminCommon.noDriver')}</span>}</span>
                          {pos !== null && <span className="lg-muted">· {tr('adminLogistics.positionAgo', { n: pos })}</span>}
                        </div>
                        <Link to={`/admin/orders?q=${encodeURIComponent(o.id)}`} className="admin-record-link">#{o.id.slice(0, 8)} → {tr('adminLogistics.viewOrder')}</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      }}
    </LoadState>
  );
}
