import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate } from './adminUtils';

const ACTIVITY_LABELS = {
  disponible: { label: '🟢 Disponible', color: 'var(--teal-deep)' },
  en_livraison: { label: '🟡 En livraison', color: 'var(--gold-deep)' },
  offline: { label: '⚫ Hors ligne', color: 'inherit' }
};

export default function AdminDriversPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDriver(d) {
    setSelected(d);
    setDetail(null);
    api(`/admin/drivers/${d.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/drivers/${id}/status`, { method: 'PATCH', token, body: { status } });
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, adminStatus: status } : d)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Livreur approuvé.' : status === 'blocked' ? 'Livreur bloqué.' : 'Statut mis à jour.');
    } catch (e) {
      toast(e.message);
    }
  }

  const filtered = filterBySearch(drivers, search, (d) => [d.name, d.email, d.phone]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Livreurs</h2>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Chercher un(e) livreur..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
      </div>
      {!drivers && <SkeletonCards count={3} />}
      {drivers && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((d) => {
        const act = ACTIVITY_LABELS[d.activityStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(d.email) ? ' card-test-account' : ''}`} key={d.id} onClick={() => openDriver(d)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{d.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(d.email) && <TestBadge />}
                <span className="pill" style={{ color: act?.color }}>{act?.label}</span>
                <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                  {d.adminStatus === 'approved' ? '✅ Approuvé' : d.adminStatus === 'blocked' ? '🚫 Bloqué' : '🕐 En attente'}
                </span>
              </div>
            </div>
            <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}{d.linkedRestaurantName ? ` · lié à ${d.linkedRestaurantName}` : ''}</div>
            <div className="small">
              {d.deliveriesCount} livraison(s) · {money(d.revenue)} de revenus · {(d.cancellationRate * 100).toFixed(0)}% annulation
              {d.reviewCount > 0 ? ` · ${d.avgRating.toFixed(1)}★ (${d.reviewCount} avis)` : ' · pas encore d\'avis'}
            </div>
            <div className="small" style={{ opacity: 0.6 }}>Taux d'acceptation et temps moyen de livraison : non mesurables (pas de données historisées).</div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {d.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(d.id, 'approved')}>Approuver</button>}
              {d.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(d.id, 'blocked')}>Bloquer</button>}
            </div>
          </div>
        );
      })}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)} · Stripe Connect : {detail.stripeConnectStatus || '—'}</p>
                {(detail.payoutIban || detail.payoutAccountHolder) && (
                  <p className="small" style={{ margin: '2px 0' }}>💳 {detail.payoutAccountHolder || '(titulaire non renseigné)'} — {detail.payoutIban || '(IBAN non renseigné)'}</p>
                )}
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Livraisons terminées</span><b className="small">{detail.deliveriesCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Revenus</span><b className="small">{money(detail.revenue)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Taux d'annulation</span><b className="small">{(detail.cancellationRate * 100).toFixed(0)}%</b></div>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
                {(detail.orders || []).length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
                {(detail.orders || []).map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.restaurantName} → {o.clientName}</span>
                    <span className={`status-badge status-${o.status}`}>{o.status}</span>
                  </div>
                ))}
              </>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
