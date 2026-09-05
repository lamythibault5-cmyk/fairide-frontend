import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AdminDataTable, { useTableSort, sortRows } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, downloadCsv } from './adminUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';

const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const J30 = 30 * 86400000; const J7 = 7 * 86400000;

export default function AdminClientsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [onglet, setOnglet] = useState('apercu');
  const [mode, setMode] = useViewMode('clients', 'cards');
  const [filtre, setFiltre] = useState('all');
  const [groupBy, setGroupBy] = useState('');
  const { sort, toggle } = useTableSort('totalSpent');

  useEffect(() => {
    api('/admin/clients', { token }).then(setClients).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openClient(c) {
    setOnglet('apercu');
    setSelected(c);
    setDetail(null);
    api(`/admin/clients/${c.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/clients/${id}/status`, { method: 'PATCH', token, body: { status } });
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, adminStatus: status } : c)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'blocked' ? tr('adminClients.toastSuspended') : tr('adminClients.toastReactivated'));
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(c) {
    setConfirmAction({ title: tr('adminCommon.confirmSuspend', { name: c.name }), message: tr('adminClients.suspendBody'), danger: true, run: () => setStatus(c.id, 'blocked') });
  }
  async function deleteClient(c) {
    const r = await api(`/admin/clients/${c.id}`, { method: 'DELETE', token });
    setClients((prev) => prev.filter((x) => x.id !== c.id));
    if (selected?.id === c.id) { setSelected(null); setDetail(null); }
    toast(tr('adminClients.toastDeleted', { n: r.deletedOrders || 0 }));
  }
  function askDelete(c) {
    setConfirmAction({ title: tr('adminClients.confirmDelete', { name: c.name }), message: tr('adminClients.deleteBody', { email: c.email }), danger: true, run: () => deleteClient(c).catch((e) => toast(e.message)) });
  }
  function askReactivate(c) {
    setConfirmAction({ title: tr('adminClients.confirmReactivate', { name: c.name }), run: () => setStatus(c.id, 'approved') });
  }
  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/clients/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!clients || !clients.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`clients-${Date.now()}.csv`, clients, [
      { label: 'Nom', get: (c) => c.name },
      { label: 'Email', get: (c) => c.email },
      { label: tr('adminCommon.phone'), get: (c) => c.phone },
      { label: tr('adminCommon.registeredOn'), get: (c) => fmtDate(c.createdAt) },
      { label: 'Commandes', get: (c) => c.orderCount },
      { label: 'Annulations', get: (c) => c.cancelledCount },
      { label: tr('adminCommon.totalSpent'), get: (c) => c.totalSpent },
      { label: 'Panier moyen', get: (c) => c.avgBasket },
      { label: tr('adminClients.colFrequency'), get: (c) => c.purchaseFrequency },
      { label: tr('adminCommon.lastOrder'), get: (c) => c.lastOrderAt ? fmtDate(c.lastOrderAt) : '' },
      { label: 'Solde', get: (c) => c.balance },
      { label: 'Statut', get: (c) => c.adminStatus }
    ]);
  }

  const filtered = filterBySearch(clients, search, (c) => [c.name, c.email, c.phone]);
  const maintenant = Date.now();
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (c) => <><b>{c.name}</b>{isTestAccount(c.email) && <TestBadge />}</>, sortValue: (c) => c.name },
    { key: 'email', label: tr('adminCommon.email'), get: (c) => c.email },
    { key: 'phone', label: tr('adminCommon.phone'), get: (c) => c.phone || '—' },
    { key: 'orderCount', label: tr('adminCommon.orders'), get: (c) => c.orderCount, align: 'right', sum: true },
    { key: 'cancelledCount', label: tr('adminCommon.cancellations'), get: (c) => c.cancelledCount, align: 'right', sum: true },
    { key: 'totalSpent', label: tr('adminCommon.spent'), get: (c) => money(c.totalSpent), sortValue: (c) => c.totalSpent, align: 'right', sum: true },
    { key: 'avgBasket', label: tr('adminCommon.avgBasket'), get: (c) => money(c.avgBasket), sortValue: (c) => c.avgBasket, align: 'right' },
    { key: 'purchaseFrequency', label: tr('adminCommon.frequency'), get: (c) => c.purchaseFrequency, align: 'right' },
    { key: 'lastOrderAt', label: tr('adminCommon.lastOrder'), get: (c) => (c.lastOrderAt ? fmtDate(c.lastOrderAt) : '—'), sortValue: (c) => c.lastOrderAt || 0 },
    { key: 'balance', label: tr('adminCommon.balanceCol'), get: (c) => money(c.balance), sortValue: (c) => c.balance, align: 'right', sum: true },
    { key: 'adminStatus', label: tr('adminCommon.status'), get: (c) => (c.adminStatus === 'blocked' ? <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.suspended')}</span> : <span className="pill teal">{tr('adminClients.activeBadge')}</span>), sortValue: (c) => c.adminStatus },
    { key: 'createdAt', label: tr('adminCommon.registeredOn'), get: (c) => fmtDate(c.createdAt), sortValue: (c) => c.createdAt }
  ];
  const groupes = {
    status: { get: (c) => (c.adminStatus === 'blocked' ? tr('adminClients.suspended') : tr('adminClients.activeBadge')) },
    month: { get: (c) => new Date(c.createdAt).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' }) },
    tier: { get: (c) => (c.totalSpent >= 200 ? tr('adminClients.tierTop') : c.totalSpent >= 50 ? tr('adminClients.tierRegular') : c.orderCount > 0 ? tr('adminClients.tierOccasional') : tr('adminClients.tierNone')) }
  };
  const visibles = useMemo(() => sortRows((filtered || []).filter((c) => {
    if (filtre === 'active30') return c.lastOrderAt && maintenant - c.lastOrderAt <= J30;
    if (filtre === 'new7') return maintenant - c.createdAt <= J7;
    if (filtre === 'blocked') return c.adminStatus === 'blocked';
    if (filtre === 'refunds') return c.refundCount > 0;
    return true;
  }), colonnes, sort), [filtered, filtre, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => (clients || []).reduce((a, c) => ({ new7: a.new7 + (maintenant - c.createdAt <= J7 ? 1 : 0), active30: a.active30 + (c.lastOrderAt && maintenant - c.lastOrderAt <= J30 ? 1 : 0), spent: a.spent + c.totalSpent, orders: a.orders + c.orderCount }), { new7: 0, active30: 0, spent: 0, orders: 0 }), [clients]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <AdminPageHeader module="clients" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />
      {clients && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{clients.length}</div><div className="label">{tr('adminClients.kpiTotal')}</div></div>
          <div className="stat-card"><div className="num">{kpi.new7}</div><div className="label">{tr('adminClients.kpiNew')}</div></div>
          <div className="stat-card"><div className="num">{kpi.active30}</div><div className="label">{tr('adminClients.kpiActive')}</div></div>
          <div className="stat-card"><div className="num">{kpi.orders}</div><div className="label">{tr('adminCommon.orders')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.spent)}</div><div className="label">{tr('adminClients.kpiSpent')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.orders ? kpi.spent / kpi.orders : 0)}</div><div className="label">{tr('adminCommon.avgBasket')}</div></div>
        </div>
      )}
      <div className="admin-control-panel">
        <input placeholder={tr('adminClients.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allM')], ['active30', tr('adminClients.filterActive30')], ['new7', tr('adminClients.filterNew7')], ['refunds', tr('adminClients.filterRefunds')], ['blocked', tr('adminClients.filterBlocked')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}</div>
          ))}
        </div>
        {mode === 'table' && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="month">{tr('adminCommon.groupBy')} : {tr('adminClients.groupMonth')}</option>
            <option value="tier">{tr('adminCommon.groupBy')} : {tr('adminClients.groupTier')}</option>
          </select>
        )}
        <span className="small">{tr('adminCommon.countOf', { n: visibles.length, total: (clients || []).length })}</span>
      </div>
      {!clients && <SkeletonCards count={3} />}
      {clients && visibles.length === 0 && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {clients && mode === 'table' && visibles.length > 0 && (
        <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} groupBy={groupBy ? groupes[groupBy] : null} onRowClick={openClient}
          rowClassName={(c) => (isTestAccount(c.email) ? 'row-test-account' : '')} showTotals format={{ totalSpent: money, balance: money }} emptyLabel={tr('adminCommon.noResults')} />
      )}
      {clients && mode === 'cards' && visibles.map((c) => (
        <div className={`card order-card-clickable${isTestAccount(c.email) ? ' card-test-account' : ''}`} key={c.id} onClick={() => openClient(c)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.name}</b>
            <div className="row" style={{ gap: 6 }}>
              {isTestAccount(c.email) && <TestBadge />}
              {c.adminStatus === 'blocked' && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.suspended')}</span>}
              {c.refundCount > 0 && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.refundsCount', { n: c.refundCount })}</span>}
            </div>
          </div>
          <div className="small">{c.email}{c.phone ? ` · ${c.phone}` : ''}{tr('adminClients.registeredSuffix', { date: fmtDate(c.createdAt) })}</div>
          <div className="small">
            {tr('adminFinance.ordersCount', { n: c.orderCount })}{c.cancelledCount > 0 ? tr('adminClients.cancelledSuffix', { n: c.cancelledCount }) : ''}{tr('adminClients.spentLine', { spent: money(c.totalSpent), basket: money(c.avgBasket) })}
          </div>
          <div className="small">
            {tr('adminClients.ordersPerMonth', { n: c.purchaseFrequency })} · {c.lastOrderAt ? tr('adminClients.lastOrderOn', { date: fmtDate(c.lastOrderAt) }) : tr('adminClients.noOrder')}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {c.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(c)}>{tr('adminCommon.suspend')}</button>}
            {c.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(c)}>{tr('adminCommon.reactivate')}</button>}
            <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={() => askDelete(c)}>{tr('adminClients.deleteAccount')}</button>
          </div>
        </div>
      ))}

      {selected && createPortal(
        <RecordDrawer
          title={selected.name}
          subtitle={detail ? `${detail.email}${detail.phone ? ` · ${detail.phone}` : ''}` : ''}
          badge={selected.adminStatus === 'blocked' ? <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.suspended')}</span> : <span className="pill teal">{tr('adminClients.activeBadge')}</span>}
          tabs={[
            { key: 'apercu', label: tr('adminCommon.tabOverview') },
            { key: 'commandes', label: tr('adminCommon.tabOrders'), count: detail?.orders ? detail.orders.length : null },
            { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: detail?.notes ? detail.notes.length : null }
          ]}
          tab={onglet} onTab={setOnglet} onClose={() => setSelected(null)} width={620}
        >
          {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
          {detail && onglet === 'apercu' && (
            <>
              {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}</p>}
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminClients.registeredBalance', { date: fmtDate(detail.createdAt) })} <b>{money(detail.balance)}</b></p>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>{tr('adminCommon.suspend')}</button>}
                {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>{tr('adminCommon.reactivate')}</button>}
                <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => askDelete(detail)}>{tr('adminClients.deleteAccount')}</button>
              </div>
              <div className="divider" />
              <h4 className="drawer-section-title">{tr('adminRestos.keyFigures')}</h4>
              <DrawerRow label={tr('adminCommon.orders')} value={detail.orderCount} strong />
              <DrawerRow label={tr('adminClients.cancellations')} value={detail.cancelledCount} strong />
              <DrawerRow label={tr('adminCommon.totalSpent')} value={money(detail.totalSpent)} strong />
              <DrawerRow label={tr('adminCommon.avgBasket')} value={money(detail.avgBasket)} strong />
              <DrawerRow label={tr('adminClients.purchaseFrequency')} value={tr('adminClients.ordersPerMonth', { n: detail.purchaseFrequency })} strong />
              <DrawerRow label={tr('adminCommon.lastOrder')} value={detail.lastOrderAt ? fmtDate(detail.lastOrderAt) : '—'} strong />
              {(detail.refunds || []).length > 0 && (
                <>
                  <div className="divider" />
                  <h4 className="drawer-section-title" style={{ color: 'var(--red)' }}>{tr('adminCommon.refunds')}</h4>
                  {detail.refunds.map((r) => <DrawerRow key={r.id} label={`${r.restaurantName} — ${r.reason || r.responsibility}`} value={money(r.amount)} />)}
                </>
              )}
            </>
          )}
          {detail && onglet === 'commandes' && (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.recentOrders')}</h4>
                <Link to={`/admin/orders?clientId=${selected.id}`} className="small">{tr('adminRestos.seeAll')}</Link>
              </div>
              {(detail.orders || []).length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
              {(detail.orders || []).map((o) => <DrawerRow key={o.id} label={o.restaurantName} value={money(o.total)} />)}
            </>
          )}
          {detail && onglet === 'suivi' && (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <CreateTicketButton linkType="linkedClientId" linkId={selected.id} label={detail.name} />
                <CreateTaskButton targetType="client" targetId={selected.id} label={detail.name} />
              </div>
              <AdminNotesPanel targetType="client" targetId={selected.id} notes={detail.notes} onAdded={refreshDetail} />
              <div className="divider" />
              <AdminActionHistory actions={detail.actions} />
            </>
          )}
        </RecordDrawer>,
        document.body
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
    </div>
  );
}
