import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { money } from './adminUtils';

const PERIODS = [
  { key: '', label: 'Tout' },
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' }
];

export default function AdminFinancePage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams();
    if (period) {
      const from = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString();
      params.set('from', from);
    }
    api(`/admin/finance?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Finance</h2>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {PERIODS.map((p) => (
          <div key={p.key || 'all'} className={`chip${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</div>
        ))}
      </div>

      {!data && <SkeletonCards count={3} />}
      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card highlight"><div className="num">{money(data.gmv)}</div><div className="label">GMV</div></div>
            <div className="stat-card"><div className="num">{money(data.commission)}</div><div className="label">Commissions Fairide ({(data.commissionRate * 100).toFixed(0)}%)</div></div>
            <div className="stat-card"><div className="num">{money(data.serviceFee)}</div><div className="label">Frais de service</div></div>
            <div className="stat-card highlight"><div className="num">{money(data.fairideRevenue)}</div><div className="label">Revenus Fairide</div></div>
            <div className="stat-card"><div className="num">{money(data.restaurantDue)}</div><div className="label">Montants dus restaurants</div></div>
            <div className="stat-card"><div className="num">{money(data.driverDue)}</div><div className="label">Montants dus livreurs</div></div>
            <div className="stat-card"><div className="num">{data.paidOrderCount}</div><div className="label">Commandes payées</div></div>
          </div>

          <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>Remboursements</h3>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Total remboursé ({data.refunds.count})</span><b>{money(data.refunds.total)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">À charge restaurant</span><span className="small">{money(data.refunds.byResponsibility.restaurant)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">À charge livreur</span><span className="small">{money(data.refunds.byResponsibility.driver)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">À charge Fairide</span><span className="small">{money(data.refunds.byResponsibility.fairide)}</span></div>
          </div>

          <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>Top restaurants (commission générée)</h3>
          {data.topRestaurants.length === 0 && <div className="empty">Aucune donnée pour cette période.</div>}
          {data.topRestaurants.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{r.name}</b>
                <span className="small">{r.orderCount} commande(s)</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <span className="small">CA {money(r.gmv)}</span>
                <b className="small">{money(r.commission)} commission</b>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
