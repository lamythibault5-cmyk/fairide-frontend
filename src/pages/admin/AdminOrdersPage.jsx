import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import { money, fmtDateTime, downloadCsv, useDebouncedValue, ORDER_STATUS_LABELS, ORDER_STATUSES, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';

const FILTERS = [
  { key: '', label: 'Toutes' },
  ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] })),
  { key: 'noDriver', label: 'Sans livreur' },
  { key: 'refunded', label: 'Remboursées' },
  { key: 'late', label: 'En retard' }
];

const PAGE_SIZE = 50;

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [qInput, setQInput] = useState(searchParams.get('q') || '');
  const q = useDebouncedValue(qInput, 350);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const activeFilter = searchParams.get('status')
    || (searchParams.get('noDriver') ? 'noDriver' : searchParams.get('refunded') ? 'refunded' : searchParams.get('late') ? 'late' : '');

  function load() {
    setOrders(null);
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    const status = searchParams.get('status');
    if (status) params.set('status', status);
    if (searchParams.get('noDriver')) params.set('noDriver', '1');
    if (searchParams.get('refunded')) params.set('refunded', '1');
    if (searchParams.get('late')) params.set('late', '1');
    if (searchParams.get('restaurantId')) params.set('restaurantId', searchParams.get('restaurantId'));
    if (searchParams.get('driverId')) params.set('driverId', searchParams.get('driverId'));
    if (searchParams.get('clientId')) params.set('clientId', searchParams.get('clientId'));
    if (q) params.set('q', q);
    api(`/admin/orders?${params.toString()}`, { token }).then((r) => { setOrders(r.rows); setTotal(r.total); }).catch((e) => toast(e.message));
  }

  useEffect(load, [searchParams.toString(), q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [searchParams.toString(), q]);

  function setFilter(key) {
    const next = {};
    if (q) next.q = q;
    if (key === 'noDriver') next.noDriver = '1';
    else if (key === 'refunded') next.refunded = '1';
    else if (key === 'late') next.late = '1';
    else if (key) next.status = key;
    setSearchParams(next);
  }

  function openOrder(o) {
    setSelected(o);
    setDetail(null);
    api(`/admin/orders/${o.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function refreshDetail() {
    if (selected) api(`/admin/orders/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!orders || !orders.length) { toast('Rien à exporter.'); return; }
    downloadCsv(`commandes-${Date.now()}.csv`, orders, [
      { label: 'ID', get: (o) => o.id },
      { label: 'Date', get: (o) => fmtDateTime(o.createdAt) },
      { label: 'Restaurant', get: (o) => o.restaurantName },
      { label: 'Client', get: (o) => o.clientName },
      { label: 'Livreur', get: (o) => o.driverName || '' },
      { label: 'Statut', get: (o) => o.status },
      { label: 'Sous-total', get: (o) => o.subtotal },
      { label: 'Livraison', get: (o) => o.deliveryFee },
      { label: 'Total', get: (o) => o.total },
      { label: 'Commission resto', get: (o) => o.commission },
      { label: 'Part Fairide livraison', get: (o) => o.deliveryFairideShare },
      { label: 'Revenu Fairide', get: (o) => o.fairideTotalRevenue },
      { label: 'Dû restaurant', get: (o) => o.restaurantDue },
      { label: 'Dû livreur', get: (o) => o.driverDue }
    ]);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Commandes</h2>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input placeholder="Rechercher par ID, nom, téléphone..." value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>⬇️ CSV</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <div key={f.key || 'all'} className={`chip${activeFilter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
        ))}
      </div>

      {!orders && <SkeletonCards count={4} />}
      {orders && orders.length === 0 && <div className="empty">Aucune commande pour ce filtre.</div>}
      {orders && orders.map((o) => (
        <div className="card order-card-clickable" key={o.id} onClick={() => openOrder(o)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div className="small">
            {o.clientName} → {o.driverName ? `livré par ${o.driverName}` : (o.orderType === 'delivery' ? 'sans livreur assigné' : 'à emporter')}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
            <span className="small">
              {o.paid ? '✅ Payée' : '⏳ Non payée'} · commission {money(o.commission)} · part livraison {money(o.deliveryFairideShare)} · revenu Fairide {money(o.fairideTotalRevenue)}
              {o.hasRefund && <span style={{ color: 'var(--red)' }}> · remboursée</span>}
            </span>
            <b>{money(o.total)}</b>
          </div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(o.createdAt)}</div>
        </div>
      ))}
      {total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
          <span className="small">Page {page + 1} / {Math.ceil(total / PAGE_SIZE)} ({total} commandes)</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
        </div>
      )}

      {selected && (
        <OrderDetailModal
          selected={selected}
          detail={detail}
          onClose={() => setSelected(null)}
          onChanged={() => { refreshDetail(); load(); }}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ selected, detail, onClose, onChanged }) {
  const { token } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [newDriverId, setNewDriverId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundResponsibility, setRefundResponsibility] = useState('restaurant');
  const [refundReason, setRefundReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type, run }
  const [busy, setBusy] = useState(false);

  const [entries, setEntries] = useState(null);

  useEffect(() => { setNewStatus(detail?.status || ''); }, [detail?.status]);
  useEffect(() => {
    setEntries(null);
    api(`/admin/accounting/journal?orderId=${selected.id}&limit=50`, { token }).then((r) => setEntries(r.rows)).catch(() => setEntries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  function loadDrivers() {
    if (drivers) return;
    api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
  }

  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try {
      await confirmAction.run();
      toast(confirmAction.successMessage || 'Fait.');
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  function askStatusChange() {
    setConfirmAction({
      title: 'Changer le statut ?',
      message: `Statut actuel : ${detail.status} → ${newStatus}. Cette action est manuelle et ne suit pas le flux normal resto/livreur.`,
      successMessage: 'Statut modifié.',
      run: () => api(`/admin/orders/${selected.id}/status`, { method: 'PATCH', token, body: { status: newStatus } })
    });
  }

  function askCancel() {
    setConfirmAction({
      title: 'Annuler cette commande ?',
      message: "Le statut passera à \"Annulée\". Pense à faire un remboursement séparément si nécessaire.",
      danger: true,
      successMessage: 'Commande annulée.',
      run: () => api(`/admin/orders/${selected.id}/status`, { method: 'PATCH', token, body: { status: 'annule' } })
    });
  }

  function askReassign() {
    const driver = drivers?.find((d) => d.id === newDriverId);
    if (!driver) { toast('Choisis un livreur.'); return; }
    setConfirmAction({
      title: 'Réassigner le livreur ?',
      message: `Nouveau livreur : ${driver.name}.`,
      successMessage: 'Livreur réassigné.',
      run: () => api(`/admin/orders/${selected.id}/driver`, { method: 'PATCH', token, body: { driverId: driver.id } })
    });
  }

  function askRefund() {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) { toast('Montant invalide.'); return; }
    setConfirmAction({
      title: 'Rembourser cette commande ?',
      message: `${amount.toFixed(2)}€ à la charge de : ${refundResponsibility}. Cette action déclenche un vrai remboursement Stripe.`,
      danger: true,
      successMessage: 'Remboursement effectué.',
      run: () => api(`/admin/orders/${selected.id}/refund`, { method: 'POST', token, body: { amount, responsibility: refundResponsibility, reason: refundReason.trim() || undefined } })
    });
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: '0 0 8px' }}>{selected.restaurantName}</h3>
          <span className={`status-badge status-${selected.status}`}>{ORDER_STATUS_LABELS[selected.status] || selected.status}</span>
        </div>
        {!detail && <div className="small">Chargement...</div>}
        {detail && (
          <>
            <p className="small" style={{ margin: '2px 0' }}>Client : {detail.clientName}{detail.clientPhone ? ` · ${detail.clientPhone}` : ''}</p>
            {detail.driverName && <p className="small" style={{ margin: '2px 0' }}>Livreur : {detail.driverName}{detail.driverPhone ? ` · ${detail.driverPhone}` : ''}</p>}
            {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}{detail.commune ? `, ${detail.commune}` : ''}</p>}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Articles</h4>
            {(detail.items || []).map((it, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{it.qty}× {it.name}</span>
                <span className="small">{money(it.price * it.qty - (it.discount || 0))}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Sous-total plats</span><span className="small">{money(detail.subtotal)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Livraison</span><span className="small">{money(detail.deliveryFee)}</span></div>
            {detail.tipAmount > 0 && <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Pourboire</span><span className="small">{money(detail.tipAmount)}</span></div>}
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Total payé</b><b className="small">{money(detail.total)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commission restaurant (10%)</span><span className="small">{money(detail.commission)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Part Fairide livraison (10%)</span><span className="small">{money(detail.deliveryFairideShare)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Revenu Fairide total</b><b className="small">{money(detail.fairideTotalRevenue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dû au restaurant</span><span className="small">{money(detail.restaurantDue)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dû au livreur</span><span className="small">{money(detail.driverDue)}</span></div>
            {(detail.refunds || []).length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>Remboursements</h4>
                {detail.refunds.map((r) => (
                  <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{r.reason || r.responsibility}</span>
                    <span className="small">{money(r.amount)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Timeline</h4>
            {(detail.timeline || []).map((step, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{step.label}</span>
                <span className="small" style={{ opacity: 0.6 }}>{fmtDateTime(step.at)}</span>
              </div>
            ))}

            {entries && entries.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Écritures comptables</h4>
                {entries.map((e) => (
                  <div key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[e.entryType] || e.entryType} — {e.accountCode}</span>
                    <span className="small">{e.debit > 0 ? `-${money(e.debit)}` : money(e.credit)}</span>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Actions admin</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ maxWidth: 180 }}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
              <button className="btn-outline" disabled={newStatus === detail.status} onClick={askStatusChange}>Changer le statut</button>
              <button className="btn-danger-ghost" onClick={askCancel}>Annuler la commande</button>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={newDriverId} onChange={(e) => setNewDriverId(e.target.value)} onFocus={loadDrivers} style={{ maxWidth: 220 }}>
                <option value="">Réassigner à...</option>
                {drivers && drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.activityStatus})</option>)}
              </select>
              <button className="btn-outline" disabled={!newDriverId} onClick={askReassign}>Réassigner</button>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="number" step="0.01" placeholder="Montant remboursé" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} style={{ maxWidth: 140 }} />
              <select value={refundResponsibility} onChange={(e) => setRefundResponsibility(e.target.value)} style={{ maxWidth: 140 }}>
                <option value="restaurant">Resto</option>
                <option value="driver">Livreur</option>
                <option value="fairide">Fairide</option>
              </select>
              <input placeholder="Raison (optionnel)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
              <button className="btn-danger-ghost" onClick={askRefund}>Rembourser</button>
            </div>

            <div className="divider" />
            <AdminNotesPanel targetType="order" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
            <div className="divider" />
            <AdminActionHistory actions={detail.actions} />
          </>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        danger={confirmAction?.danger}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
    </div>,
    document.body
  );
}
