import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { money, fmtDateTime, downloadCsv, useDebouncedValue, ORDER_STATUS_LABELS, ORDER_STATUSES, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const filters = (tr) => [
  { key: '', label: tr('adminCommon.allF') },
  ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] })),
  { key: 'noDriver', label: tr('adminCommon.noDriver') },
  { key: 'refunded', label: tr('adminOrders.filterRefunded') },
  { key: 'late', label: tr('adminCommon.late') }
];

const PAGE_SIZE = 50;
const KANBAN_COLORS = { nouveau: 'var(--orange)', preparation: 'var(--blue)', pret: 'var(--iris)', livraison: 'var(--purple)', livre: '#3FB950', refuse: 'var(--red)', annule: 'var(--ink-faint)' };

export default function AdminOrdersPage() {
  const { t: tr } = useLanguage();
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
  const [mode, setMode] = useViewMode('orders');
  const [kanbanMove, setKanbanMove] = useState(null); // { order, status }

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
    if (!orders || !orders.length) { toast(tr('adminCommon.nothingToExport')); return; }
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
      { label: tr('adminOrders.colDueRestaurant'), get: (o) => o.restaurantDue },
      { label: tr('adminOrders.colDueDriver'), get: (o) => o.driverDue }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="orders" />
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input placeholder={tr('adminOrders.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1 }} />
        <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria'), list: tr('adminKanban.list'), kanban: tr('adminKanban.kanban') }} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {filters(tr).map((f) => (
          <div key={f.key || 'all'} className={`chip${activeFilter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
        ))}
      </div>

      {!orders && <SkeletonCards count={4} />}
      {orders && orders.length === 0 && <div className="empty">{tr('adminOrders.noneForFilter')}</div>}
      {orders && mode === 'kanban' && (
        <KanbanBoard
          columns={ORDER_STATUSES.filter((st) => !activeFilter || !ORDER_STATUSES.includes(activeFilter) || st === activeFilter).map((st) => ({ key: st, label: ORDER_STATUS_LABELS[st] || st, color: KANBAN_COLORS[st] }))}
          items={orders}
          columnOf={(o) => o.status}
          onOpen={openOrder}
          onMove={(o, st) => setKanbanMove({ order: o, status: st })}
          emptyLabel={tr('adminKanban.empty')}
          renderCard={(o) => (
            <>
              <b>{o.restaurantName}</b>
              <div className="small">{o.clientName}{o.driverName ? ` · 🛵 ${o.driverName}` : ''}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{fmtDateTime(o.createdAt)}</span><b style={{ display: 'inline' }}>{money(o.total)}</b></div>
            </>
          )}
        />
      )}
      {orders && mode === 'list' && orders.map((o) => (
        <div className="card order-card-clickable" key={o.id} onClick={() => openOrder(o)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div className="small">
            {o.clientName} → {o.driverName ? tr('adminOrders.deliveredBy', { name: o.driverName }) : (o.orderType === 'delivery' ? tr('adminOrders.noDriverAssigned') : tr('adminOrders.takeaway'))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
            <span className="small">
              {tr('adminOrders.moneyLine', { paid: o.paid ? tr('adminCommon.paidBadge') : tr('adminCommon.unpaidBadge'), commission: money(o.commission), share: money(o.deliveryFairideShare), revenue: money(o.fairideTotalRevenue) })}
              {o.hasRefund && <span style={{ color: 'var(--red)' }}> {tr('adminOrders.refundedSuffix')}</span>}
            </span>
            <b>{money(o.total)}</b>
          </div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(o.createdAt)}</div>
        </div>
      ))}
      {total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(total / PAGE_SIZE) })} {tr('adminOrders.ordersCount', { n: total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}

      <ConfirmDialog
        open={!!kanbanMove}
        title={tr('adminOrders.confirmChangeStatus')}
        message={kanbanMove ? tr('adminOrders.confirmChangeStatusBody', { from: kanbanMove.order.status, to: kanbanMove.status }) : ''}
        danger={kanbanMove?.status === 'annule'}
        onConfirm={async () => {
          try { await api(`/admin/orders/${kanbanMove.order.id}/status`, { method: 'PATCH', token, body: { status: kanbanMove.status } }); toast(tr('adminOrders.toastStatusChanged')); load(); }
          catch (e) { toast(e.message); } finally { setKanbanMove(null); }
        }}
        onCancel={() => setKanbanMove(null)}
      />
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
  const { t: tr } = useLanguage();
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
      title: tr('adminOrders.confirmChangeStatus'),
      message: tr('adminOrders.confirmChangeStatusBody', { from: detail.status, to: newStatus }),
      successMessage: tr('adminOrders.toastStatusChanged'),
      run: () => api(`/admin/orders/${selected.id}/status`, { method: 'PATCH', token, body: { status: newStatus } })
    });
  }

  function askCancel() {
    setConfirmAction({
      title: tr('adminOrders.confirmCancel'),
      message: tr('adminOrders.confirmCancelBody'),
      danger: true,
      successMessage: tr('adminOrders.toastCancelled'),
      run: () => api(`/admin/orders/${selected.id}/status`, { method: 'PATCH', token, body: { status: 'annule' } })
    });
  }

  function askReassign() {
    const driver = drivers?.find((d) => d.id === newDriverId);
    if (!driver) { toast(tr('adminCommon.toastChooseDriver')); return; }
    setConfirmAction({
      title: tr('adminOrders.confirmReassign'),
      message: `Nouveau livreur : ${driver.name}.`,
      successMessage: tr('adminOrders.toastReassigned'),
      run: () => api(`/admin/orders/${selected.id}/driver`, { method: 'PATCH', token, body: { driverId: driver.id } })
    });
  }

  function askRefund() {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) { toast(tr('adminOrders.toastInvalidAmount')); return; }
    setConfirmAction({
      title: tr('adminOrders.confirmRefund'),
      message: tr('adminOrders.confirmRefundBody', { amount: amount.toFixed(2), who: refundResponsibility }),
      danger: true,
      successMessage: tr('adminOrders.toastRefunded'),
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
        {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
        {detail && (
          <>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminOrders.clientLine', { name: detail.clientName, phone: detail.clientPhone ? ` · ${detail.clientPhone}` : '' })}</p>
            {detail.driverName && <p className="small" style={{ margin: '2px 0' }}>{tr('adminOrders.driverLine', { name: detail.driverName, phone: detail.driverPhone ? ` · ${detail.driverPhone}` : '' })}</p>}
            {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}{detail.commune ? `, ${detail.commune}` : ''}</p>}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminOrders.items')}</h4>
            {(detail.items || []).map((it, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{it.qty}× {it.name}</span>
                <span className="small">{money(it.price * it.qty - (it.discount || 0))}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.foodSubtotal')}</span><span className="small">{money(detail.subtotal)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.delivery')}</span><span className="small">{money(detail.deliveryFee)}</span></div>
            {detail.tipAmount > 0 && <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.tip')}</span><span className="small">{money(detail.tipAmount)}</span></div>}
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">{tr('adminOrders.totalPaid')}</b><b className="small">{money(detail.total)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.restoCommission')}</span><span className="small">{money(detail.commission)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.deliveryShare')}</span><span className="small">{money(detail.deliveryFairideShare)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">{tr('adminOrders.totalRevenue')}</b><b className="small">{money(detail.fairideTotalRevenue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.dueRestaurant')}</span><span className="small">{money(detail.restaurantDue)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminOrders.dueDriver')}</span><span className="small">{money(detail.driverDue)}</span></div>
            {(detail.refunds || []).length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>{tr('adminCommon.refunds')}</h4>
                {detail.refunds.map((r) => (
                  <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{r.reason || r.responsibility}</span>
                    <span className="small">{money(r.amount)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminOrders.timeline')}</h4>
            {(detail.timeline || []).map((step, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{step.label}</span>
                <span className="small" style={{ opacity: 0.6 }}>{fmtDateTime(step.at)}</span>
              </div>
            ))}

            {entries && entries.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>{tr('adminOrders.entries')}</h4>
                {entries.map((e) => (
                  <div key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[e.entryType] || e.entryType} — {e.accountCode}</span>
                    <span className="small">{e.debit > 0 ? `-${money(e.debit)}` : money(e.credit)}</span>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminOrders.adminActions')}</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ maxWidth: 180 }}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
              <button className="btn-outline" disabled={newStatus === detail.status} onClick={askStatusChange}>{tr('adminOrders.changeStatus')}</button>
              <button className="btn-danger-ghost" onClick={askCancel}>{tr('adminOrders.cancelOrder')}</button>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={newDriverId} onChange={(e) => setNewDriverId(e.target.value)} onFocus={loadDrivers} style={{ maxWidth: 220 }}>
                <option value="">{tr('adminOrders.reassignTo')}</option>
                {drivers && drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.activityStatus})</option>)}
              </select>
              <button className="btn-outline" disabled={!newDriverId} onClick={askReassign}>{tr('adminOrders.reassign')}</button>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="number" step="0.01" placeholder={tr('adminOrders.refundedAmount')} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} style={{ maxWidth: 140 }} />
              <select value={refundResponsibility} onChange={(e) => setRefundResponsibility(e.target.value)} style={{ maxWidth: 140 }}>
                <option value="restaurant">{tr('adminCommon.resto')}</option>
                <option value="driver">{tr('adminCommon.driver')}</option>
                <option value="fairide">{tr('adminCommon.fairide')}</option>
              </select>
              <input placeholder={tr('adminOrders.phReason')} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
              <button className="btn-danger-ghost" onClick={askRefund}>{tr('adminOrders.refund')}</button>
            </div>

            <div className="divider" />
            <div className="row" style={{ gap: 8 }}>
              <CreateTicketButton linkType="linkedOrderId" linkId={selected.id} label={`Commande ${selected.restaurantName}`} />
              <CreateTaskButton targetType="order" targetId={selected.id} label={`Commande ${selected.restaurantName}`} />
            </div>
            <div className="divider" />
            <AdminNotesPanel targetType="order" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
            <div className="divider" />
            <AdminActionHistory actions={detail.actions} />
          </>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
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
