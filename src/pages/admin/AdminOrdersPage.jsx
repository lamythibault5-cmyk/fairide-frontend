import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { money, fmtDateTime, downloadCsv, useDebouncedValue, ORDER_STATUS_LABELS, ORDER_STATUSES, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';

const filters = (tr) => [
  { key: '', label: tr('adminCommon.allF') },
  ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] })),
  { key: 'noDriver', label: tr('adminCommon.noDriver') },
  { key: 'refunded', label: tr('adminOrders.filterRefunded') },
  { key: 'late', label: tr('adminCommon.late') }
];

const PAGE_SIZE = 50;
const TYPE_LABELS = (tr) => ({ delivery: tr('adminOrders.typeDelivery'), pickup: tr('adminOrders.typePickup'), dine_in: tr('adminOrders.typeDineIn') });
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
  const [groupBy, setGroupBy] = useState('');
  const { sort, toggle } = useTableSort('createdAt');
  const EXTRA = ['type', 'from', 'to', 'min', 'max'];
  function setParam(k, v) { const next = Object.fromEntries([...searchParams.entries()]); if (v) next[k] = v; else delete next[k]; setSearchParams(next); }

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
    if (searchParams.get('type')) params.set('orderType', searchParams.get('type'));
    if (searchParams.get('from')) params.set('dateFrom', searchParams.get('from'));
    if (searchParams.get('to')) params.set('dateTo', searchParams.get('to'));
    if (searchParams.get('min')) params.set('minAmount', searchParams.get('min'));
    if (searchParams.get('max')) params.set('maxAmount', searchParams.get('max'));
    if (q) params.set('q', q);
    api(`/admin/orders?${params.toString()}`, { token }).then((r) => { setOrders(r.rows); setTotal(r.total); }).catch((e) => toast(e.message));
  }

  useEffect(load, [searchParams.toString(), q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [searchParams.toString(), q]);

  function setFilter(key) {
    const next = {};
    if (q) next.q = q;
    for (const k of EXTRA) if (searchParams.get(k)) next[k] = searchParams.get(k);
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
        <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={[{ key: 'list', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }, { key: 'kanban', icon: '▦', label: tr('adminKanban.kanban') }]} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        {filters(tr).map((f) => (
          <div key={f.key || 'all'} className={`chip${activeFilter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
        ))}
      </div>
      <div className="admin-control-panel">
        <select value={searchParams.get('type') || ''} onChange={(e) => setParam('type', e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">{tr('adminOrders.typeAll')}</option>
          <option value="delivery">{tr('adminOrders.typeDelivery')}</option>
          <option value="pickup">{tr('adminOrders.typePickup')}</option>
          <option value="dine_in">{tr('adminOrders.typeDineIn')}</option>
        </select>
        <label className="small admin-inline-field">{tr('adminOrders.dateFrom')} <input type="date" value={searchParams.get('from') || ''} onChange={(e) => setParam('from', e.target.value)} /></label>
        <label className="small admin-inline-field">{tr('adminOrders.dateTo')} <input type="date" value={searchParams.get('to') || ''} onChange={(e) => setParam('to', e.target.value)} /></label>
        <label className="small admin-inline-field">{tr('adminOrders.minAmount')} <input type="number" min={0} step={1} value={searchParams.get('min') || ''} onChange={(e) => setParam('min', e.target.value)} style={{ width: 80 }} /></label>
        <label className="small admin-inline-field">{tr('adminOrders.maxAmount')} <input type="number" min={0} step={1} value={searchParams.get('max') || ''} onChange={(e) => setParam('max', e.target.value)} style={{ width: 80 }} /></label>
        {EXTRA.some((k) => searchParams.get(k)) && <button type="button" className="btn-ghost" onClick={() => { const next = Object.fromEntries([...searchParams.entries()]); for (const k of EXTRA) delete next[k]; setSearchParams(next); }}>✕ {tr('adminOrders.clearFilters')}</button>}
        {mode === 'table' && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="restaurant">{tr('adminCommon.groupBy')} : {tr('adminCommon.restaurant')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="day">{tr('adminCommon.groupBy')} : {tr('adminOrders.groupDay')}</option>
            <option value="type">{tr('adminCommon.groupBy')} : {tr('adminCommon.type')}</option>
          </select>
        )}
        <span className="small" style={{ marginLeft: 'auto' }}>{tr('adminOrders.ordersCount', { n: total })}</span>
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
      {orders && mode === 'table' && orders.length > 0 && (
        <AdminDataTable
          columns={[
            { key: 'createdAt', label: tr('adminCommon.date'), get: (o) => fmtDateTime(o.createdAt), sortValue: (o) => o.createdAt },
            { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (o) => <b>{o.restaurantName}</b>, sortValue: (o) => o.restaurantName },
            { key: 'clientName', label: tr('adminCommon.client'), get: (o) => o.clientName },
            { key: 'driverName', label: tr('adminCommon.driver'), get: (o) => o.driverName || '—' },
            { key: 'orderType', label: tr('adminCommon.type'), get: (o) => TYPE_LABELS(tr)[o.orderType] || o.orderType },
            { key: 'status', label: tr('adminCommon.status'), get: (o) => <span className={`status-badge status-${o.status}`}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>, sortValue: (o) => o.status },
            { key: 'paid', label: tr('adminOrders.colPaid'), get: (o) => (o.paid ? '✅' : '⏳'), sortValue: (o) => (o.paid ? 1 : 0), align: 'right' },
            { key: 'total', label: tr('adminCommon.total'), get: (o) => money(o.total), sortValue: (o) => o.total, align: 'right', sum: true },
            { key: 'fairideTotalRevenue', label: tr('adminOrders.colFairide'), get: (o) => money(o.fairideTotalRevenue), sortValue: (o) => o.fairideTotalRevenue, align: 'right', sum: true }
          ]}
          rows={orders} sort={sort} onSort={toggle} onRowClick={openOrder} showTotals format={{ total: money, fairideTotalRevenue: money }}
          groupBy={groupBy === 'restaurant' ? { get: (o) => o.restaurantName } : groupBy === 'status' ? { get: (o) => ORDER_STATUS_LABELS[o.status] || o.status } : groupBy === 'day' ? { get: (o) => new Date(o.createdAt).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' }) } : groupBy === 'type' ? { get: (o) => TYPE_LABELS(tr)[o.orderType] || o.orderType } : null}
          emptyLabel={tr('adminOrders.noneForFilter')}
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
  const [onglet, setOnglet] = useState('apercu');

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
      toast(confirmAction.successMessage || tr('adminCommon.doneToast'));
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
      message: tr('adminOrders.newDriverMsg', { name: driver.name }),
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
    <RecordDrawer
      title={selected.restaurantName}
      subtitle={detail ? tr('adminOrders.clientLine', { name: detail.clientName, phone: detail.clientPhone ? ` · ${detail.clientPhone}` : '' }) : ''}
      badge={<span className={`status-badge status-${selected.status}`}>{ORDER_STATUS_LABELS[selected.status] || selected.status}</span>}
      tabs={[
        { key: 'apercu', label: tr('adminCommon.tabOverview') },
        { key: 'historique', label: tr('adminCommon.tabTimeline') },
        { key: 'actions', label: tr('adminCommon.tabActions') },
        { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: detail?.notes ? detail.notes.length : null }
      ]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={640}
    >
      {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
      {detail && onglet === 'apercu' && (
        <>
          {detail.driverName && <p className="small" style={{ margin: '2px 0' }}>{tr('adminOrders.driverLine', { name: detail.driverName, phone: detail.driverPhone ? ` · ${detail.driverPhone}` : '' })}</p>}
          {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}{detail.commune ? `, ${detail.commune}` : ''}</p>}
          <p className="small" style={{ margin: '2px 0' }}>{TYPE_LABELS(tr)[detail.orderType] || detail.orderType} · {fmtDateTime(detail.createdAt)}</p>
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminOrders.items')}</h4>
          {(detail.items || []).length === 0 && <div className="small">{tr('adminOrders.noItems')}</div>}
          {(detail.items || []).map((it, i) => <DrawerRow key={i} label={`${it.qty}× ${it.name}`} value={money(it.price * it.qty - (it.discount || 0))} />)}
          <div className="divider" />
          <DrawerRow label={tr('adminOrders.foodSubtotal')} value={money(detail.subtotal)} />
          <DrawerRow label={tr('adminOrders.delivery')} value={money(detail.deliveryFee)} />
          {detail.tipAmount > 0 && <DrawerRow label={tr('adminOrders.tip')} value={money(detail.tipAmount)} />}
          <DrawerRow label={tr('adminOrders.totalPaid')} value={money(detail.total)} strong />
          <DrawerRow label={tr('adminOrders.restoCommission')} value={money(detail.commission)} />
          <DrawerRow label={tr('adminOrders.deliveryShare')} value={money(detail.deliveryFairideShare)} />
          <DrawerRow label={tr('adminOrders.totalRevenue')} value={money(detail.fairideTotalRevenue)} strong />
          <DrawerRow label={tr('adminOrders.dueRestaurant')} value={money(detail.restaurantDue)} />
          <DrawerRow label={tr('adminOrders.dueDriver')} value={money(detail.driverDue)} />
          {(detail.refunds || []).length > 0 && (
            <>
              <div className="divider" />
              <h4 className="drawer-section-title" style={{ color: 'var(--red)' }}>{tr('adminCommon.refunds')}</h4>
              {detail.refunds.map((r) => <DrawerRow key={r.id} label={r.reason || r.responsibility} value={money(r.amount)} />)}
            </>
          )}
        </>
      )}
      {detail && onglet === 'historique' && (
        <>
          <h4 className="drawer-section-title">{tr('adminOrders.timeline')}</h4>
          {(detail.timeline || []).length === 0 && <div className="small">—</div>}
          {(detail.timeline || []).map((step, i) => <DrawerRow key={i} label={step.label} value={fmtDateTime(step.at)} />)}
          {entries && entries.length > 0 && (
            <>
              <div className="divider" />
              <h4 className="drawer-section-title">{tr('adminOrders.entries')}</h4>
              {entries.map((e) => <DrawerRow key={e.id} label={`${ACCOUNTING_ENTRY_TYPE_LABELS[e.entryType] || e.entryType} — ${e.accountCode}`} value={e.debit > 0 ? `-${money(e.debit)}` : money(e.credit)} />)}
            </>
          )}
        </>
      )}
      {detail && onglet === 'actions' && (
        <>
          <h4 className="drawer-section-title">{tr('adminOrders.adminActions')}</h4>
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
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminOrders.refund')}</h4>
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
        </>
      )}
      {detail && onglet === 'suivi' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <CreateTicketButton linkType="linkedOrderId" linkId={selected.id} label={tr('adminOrders.orderLabel', { name: selected.restaurantName })} />
            <CreateTaskButton targetType="order" targetId={selected.id} label={tr('adminOrders.orderLabel', { name: selected.restaurantName })} />
          </div>
          <AdminNotesPanel targetType="order" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
          <div className="divider" />
          <AdminActionHistory actions={detail.actions} />
        </>
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        danger={confirmAction?.danger}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
    </RecordDrawer>,
    document.body
  );
}
