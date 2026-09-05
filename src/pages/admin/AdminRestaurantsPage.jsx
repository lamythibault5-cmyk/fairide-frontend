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
import { UploadDocumentModal } from './AdminDocumentsPage';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, pct, downloadCsv, BUSINESS_STATUS_LABELS, INVOICE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const STATUT_ADMIN = (tr) => ({ pending: tr('adminRestos.filterPending'), approved: tr('adminRestos.filterApproved'), blocked: tr('adminRestos.filterBlocked') });

export default function AdminRestaurantsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('restaurants', 'cards');
  const [filtre, setFiltre] = useState('all');
  const [commune, setCommune] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const { sort, toggle } = useTableSort('revenue');

  useEffect(() => {
    api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRestaurant(r) {
    setSelected(r);
    setDetail(null);
    setOrders(null);
    api(`/admin/restaurants/${r.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
    api(`/admin/orders?restaurantId=${r.id}&limit=20`, { token }).then((res) => setOrders(res.rows)).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/restaurants/${id}/status`, { method: 'PATCH', token, body: { status } });
      setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, adminStatus: status } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? tr('adminRestos.toastApproved') : status === 'blocked' ? tr('adminRestos.toastSuspended') : tr('adminCommon.toastStatusUpdated'));
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(r) {
    setConfirmAction({ title: tr('adminCommon.confirmSuspend', { name: r.name }), message: tr('adminRestos.suspendBody'), danger: true, run: () => setStatus(r.id, 'blocked') });
  }
  function askReactivate(r) {
    setConfirmAction({ title: tr('adminRestos.confirmReactivate', { name: r.name }), run: () => setStatus(r.id, 'approved') });
  }
  async function deleteRestaurant(r) {
    const res = await api(`/admin/restaurants/${r.id}`, { method: 'DELETE', token, body: { deleteOwner: true } });
    setRestaurants((prev) => prev.filter((x) => x.id !== r.id));
    if (selected?.id === r.id) { setSelected(null); setDetail(null); }
    toast(res.ownerDeleted ? tr('adminRestos.toastDeletedWithOwner', { n: res.deletedOrders, email: res.ownerEmail || '' }) : tr('adminRestos.toastDeleted', { n: res.deletedOrders }));
  }
  function askDelete(r) {
    setConfirmAction({ title: tr('adminRestos.confirmDelete', { name: r.name }), message: tr('adminRestos.deleteBody', { email: r.ownerEmail || '' }), danger: true, run: () => deleteRestaurant(r).catch((e) => toast(e.message)) });
  }

  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/restaurants/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!restaurants || !restaurants.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`restaurants-${Date.now()}.csv`, restaurants, [
      { label: 'Nom', get: (r) => r.name },
      { label: 'Commune', get: (r) => r.commune },
      { label: 'Cuisine', get: (r) => r.cuisine },
      { label: 'Statut', get: (r) => r.businessStatus },
      { label: 'Responsable', get: (r) => r.responsibleName },
      { label: 'Email', get: (r) => r.ownerEmail },
      { label: tr('adminCommon.phone'), get: (r) => r.ownerPhone },
      { label: tr('adminRestos.companyNumber'), get: (r) => r.companyNumber },
      { label: 'TVA', get: (r) => r.vatNumber },
      { label: 'Commandes', get: (r) => r.orderCount },
      { label: 'CA', get: (r) => r.revenue },
      { label: tr('adminRestos.commissionGenerated'), get: (r) => r.commissionGenerated },
      { label: 'Panier moyen', get: (r) => r.avgBasket },
      { label: "Taux d'annulation", get: (r) => r.cancellationRate },
      { label: "Taux d'acceptation", get: (r) => r.acceptanceRate },
      { label: tr('adminRestos.colAvgPrep'), get: (r) => r.avgPrepMinutes }
    ]);
  }

  const filtered = filterBySearch(restaurants, search, (r) => [r.name, r.commune, r.cuisine, r.ownerEmail]);
  const communes = useMemo(() => [...new Set((restaurants || []).map((r) => r.commune).filter(Boolean))].sort(), [restaurants]);
  const cuisines = useMemo(() => [...new Set((restaurants || []).map((r) => r.cuisine).filter(Boolean))].sort(), [restaurants]);
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b>{isTestAccount(r.ownerEmail) && <TestBadge />}</>, sortValue: (r) => r.name },
    { key: 'commune', label: tr('adminCommon.commune'), get: (r) => r.commune },
    { key: 'cuisine', label: tr('adminCommon.cuisine'), get: (r) => r.cuisine },
    { key: 'businessStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: BUSINESS_STATUS_LABELS[r.businessStatus]?.color }}>{BUSINESS_STATUS_LABELS[r.businessStatus]?.label}</span>, sortValue: (r) => r.businessStatus },
    { key: 'rating', label: tr('adminCommon.rating'), get: (r) => `${r.rating.toFixed(1)}★`, sortValue: (r) => r.rating, align: 'right' },
    { key: 'orderCount', label: tr('adminCommon.orders'), get: (r) => r.orderCount, align: 'right', sum: true },
    { key: 'revenue', label: 'CA', get: (r) => money(r.revenue), sortValue: (r) => r.revenue, align: 'right', sum: true },
    { key: 'commissionGenerated', label: tr('adminCommon.commission'), get: (r) => money(r.commissionGenerated), sortValue: (r) => r.commissionGenerated, align: 'right', sum: true },
    { key: 'avgBasket', label: tr('adminCommon.avgBasket'), get: (r) => money(r.avgBasket), sortValue: (r) => r.avgBasket, align: 'right' },
    { key: 'cancellationRate', label: tr('adminCommon.cancellationRate'), get: (r) => pct(r.cancellationRate), sortValue: (r) => r.cancellationRate, align: 'right' },
    { key: 'createdAt', label: tr('adminCommon.registeredOn'), get: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt }
  ];
  const groupes = {
    commune: { get: (r) => r.commune || '—' }, cuisine: { get: (r) => r.cuisine || '—' },
    status: { get: (r) => STATUT_ADMIN(tr)[r.adminStatus] || r.adminStatus }, business: { get: (r) => BUSINESS_STATUS_LABELS[r.businessStatus]?.label || r.businessStatus }
  };
  const visibles = useMemo(() => sortRows((filtered || []).filter((r) => (filtre === 'all' || r.adminStatus === filtre) && (!commune || r.commune === commune) && (!cuisine || r.cuisine === cuisine)), colonnes, sort), [filtered, filtre, commune, cuisine, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => (restaurants || []).reduce((a, r) => ({ pending: a.pending + (r.adminStatus === 'pending' ? 1 : 0), orders: a.orders + r.orderCount, revenue: a.revenue + r.revenue, commission: a.commission + r.commissionGenerated }), { pending: 0, orders: 0, revenue: 0, commission: 0 }), [restaurants]);

  return (
    <div>
      <AdminPageHeader module="restaurants" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />
      {restaurants && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{restaurants.length}</div><div className="label">{tr('adminRestos.kpiTotal')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: kpi.pending > 0 ? 'var(--gold-deep)' : undefined }}>{kpi.pending}</div><div className="label">{tr('adminRestos.kpiPending')}</div></div>
          <div className="stat-card"><div className="num">{kpi.orders}</div><div className="label">{tr('adminCommon.paidOrders')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.revenue)}</div><div className="label">{tr('adminRestos.kpiRevenue')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.commission)}</div><div className="label">{tr('adminRestos.kpiCommission')}</div></div>
        </div>
      )}
      <div className="admin-control-panel">
        <input placeholder={tr('adminRestos.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allM')], ['pending', tr('adminRestos.filterPending')], ['approved', tr('adminRestos.filterApproved')], ['blocked', tr('adminRestos.filterBlocked')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}{k === 'pending' && kpi.pending > 0 ? ` (${kpi.pending})` : ''}</div>
          ))}
        </div>
        <select value={commune} onChange={(e) => setCommune(e.target.value)} style={{ maxWidth: 170 }}><option value="">{tr('adminRestos.allCommunes')}</option>{communes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} style={{ maxWidth: 170 }}><option value="">{tr('adminRestos.allCuisines')}</option>{cuisines.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        {mode === 'table' && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="commune">{tr('adminCommon.groupBy')} : {tr('adminCommon.commune')}</option>
            <option value="cuisine">{tr('adminCommon.groupBy')} : {tr('adminCommon.cuisine')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="business">{tr('adminCommon.groupBy')} : {tr('adminRestos.groupBusiness')}</option>
          </select>
        )}
        <span className="small">{tr('adminCommon.countOf', { n: visibles.length, total: (restaurants || []).length })}</span>
      </div>
      {!restaurants && <SkeletonCards count={3} />}
      {restaurants && visibles.length === 0 && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {restaurants && mode === 'table' && visibles.length > 0 && (
        <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} groupBy={groupBy ? groupes[groupBy] : null} onRowClick={openRestaurant}
          rowClassName={(r) => (isTestAccount(r.ownerEmail) ? 'row-test-account' : '')} showTotals format={{ revenue: money, commissionGenerated: money }} emptyLabel={tr('adminCommon.noResults')} />
      )}
      {restaurants && mode === 'cards' && visibles.map((r) => {
        const biz = BUSINESS_STATUS_LABELS[r.businessStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(r.ownerEmail) ? ' card-test-account' : ''}`} key={r.id} onClick={() => openRestaurant(r)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(r.ownerEmail) && <TestBadge />}
                <span className="pill" style={{ color: biz?.color }}>{biz?.label}</span>
              </div>
            </div>
            <div className="small">{r.commune} · {r.cuisine} · {r.rating.toFixed(1)}★</div>
            <div className="small">{tr('adminRestos.ownerLine', { name: r.responsibleName || r.ownerEmail, phone: r.phone ? ` · ${r.phone}` : '' })}</div>
            {(r.companyNumber || r.vatNumber) && <div className="small">{tr('adminRestos.companyNumber')} {r.companyNumber || '—'} · TVA {r.vatNumber || '—'}</div>}
            <div className="small">
              {tr('adminRestos.statsLine', { n: r.orderCount, revenue: money(r.revenue), commission: money(r.commissionGenerated), basket: money(r.avgBasket) })}
            </div>
            <div className="small">
              {tr('adminRestos.ratesLine', { cancel: pct(r.cancellationRate), accept: pct(r.acceptanceRate), prep: r.avgPrepMinutes !== null ? tr('adminRestos.prepMinutes', { n: r.avgPrepMinutes }) : tr('adminRestos.prepNotMeasured') })}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {r.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(r.id, 'approved')}>{tr('adminCommon.approve')}</button>}
              {r.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(r)}>{tr('adminCommon.suspend')}</button>}
              {r.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(r)}>{tr('adminCommon.reactivate')}</button>}
              <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={() => askDelete(r)}>{tr('adminRestos.deleteRestaurant')}</button>
            </div>
          </div>
        );
      })}

      {selected && (
        <RestaurantDetailModal
          selected={selected} detail={detail} orders={orders}
          onClose={() => setSelected(null)}
          onSuspend={() => askSuspend(detail)}
          onReactivate={() => askReactivate(detail)}
          onDelete={() => askDelete(detail)}
          onChanged={refreshDetail}
        />
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

function RestaurantDetailModal({ selected, detail, orders, onClose, onSuspend, onReactivate, onDelete, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState(null);
  const [crmProspect, setCrmProspect] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [onglet, setOnglet] = useState('apercu');

  function loadDocuments() {
    setDocuments(null);
    api(`/admin/documents?targetType=restaurant&targetId=${selected.id}&limit=10`, { token }).then((r) => setDocuments(r.rows)).catch(() => setDocuments([]));
  }

  useEffect(() => {
    setInvoices(null);
    api(`/admin/invoices?restaurantId=${selected.id}&limit=5`, { token }).then((r) => setInvoices(r.rows)).catch(() => setInvoices([]));
    setCrmProspect(null);
    api(`/admin/crm/prospects?restaurantId=${selected.id}&limit=1`, { token }).then((r) => setCrmProspect(r.rows[0] || null)).catch(() => {});
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  function startEdit() {
    setForm({
      name: detail.name, commune: detail.commune, responsibleName: detail.responsibleName,
      companyNumber: detail.companyNumber, vatNumber: detail.vatNumber, legalName: detail.legalName
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/restaurants/${selected.id}`, { method: 'PATCH', token, body: form });
      toast(tr('adminRestos.toastUpdated'));
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  const biz = detail ? BUSINESS_STATUS_LABELS[detail.businessStatus] : null;
  return createPortal(
    <RecordDrawer
      title={selected.name}
      subtitle={detail ? `${detail.commune}${detail.neighborhood ? ` (${detail.neighborhood})` : ''} · ${detail.cuisine} · ${detail.rating.toFixed(1)}★` : ''}
      badge={biz ? <span className="pill" style={{ color: biz.color }}>{biz.label}</span> : null}
      actions={<a href={`/restaurants/${selected.id}`} target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>{tr('adminRestos.viewPage')}</a>}
      tabs={[
        { key: 'apercu', label: tr('adminCommon.tabOverview') },
        { key: 'commandes', label: tr('adminCommon.tabOrders'), count: orders ? orders.length : null },
        { key: 'finance', label: tr('adminCommon.tabFinance'), count: invoices ? invoices.length : null },
        { key: 'documents', label: tr('adminCommon.tabDocuments'), count: documents ? documents.length : null },
        { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: detail?.notes ? detail.notes.length : null }
      ]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={680}
    >
      {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
      {detail && onglet === 'apercu' && !editing && (
        <>
          <p className="small" style={{ margin: '2px 0' }}>📍 {[detail.addressStreet, detail.addressNumber].filter(Boolean).join(' ')}{detail.addressCity ? `, ${detail.addressPostalCode} ${detail.addressCity}` : detail.address}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.ownerEmailLine', { name: detail.responsibleName || '—', email: detail.email, phone: detail.phone ? ` · ${detail.phone}` : '' })}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.legalLine', { legal: detail.legalName || '—', n: detail.companyNumber || '—', vat: detail.vatNumber || '—' })}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.subscriptionLine', { sub: detail.subscriptionStatus, mode: detail.deliveryMode })}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminCommon.registeredOnDate', { date: fmtDate(detail.createdAt) })}</p>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn-outline" onClick={startEdit}>{tr('adminRestos.editInfo')}</button>
            {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={onSuspend}>{tr('adminCommon.suspend')}</button>}
            {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={onReactivate}>{tr('adminCommon.reactivate')}</button>}
            <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={onDelete}>{tr('adminRestos.deleteRestaurant')}</button>
          </div>
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminRestos.keyFigures')}</h4>
          <DrawerRow label={tr('adminCommon.paidOrders')} value={detail.orderCount} strong />
          <DrawerRow label={tr('adminRestos.foodRevenue')} value={money(detail.revenue)} strong />
          <DrawerRow label={tr('adminRestos.commissionGenerated')} value={money(detail.commissionGenerated)} strong />
          <DrawerRow label={tr('adminRestos.netDue')} value={money(detail.netAmountDue)} strong />
          <DrawerRow label={tr('adminRestos.refundsCharged')} value={money(detail.refundsTotal)} strong />
          <DrawerRow label={tr('adminCommon.avgBasket')} value={money(detail.avgBasket)} strong />
          <DrawerRow label={tr('adminCommon.cancellationRate')} value={pct(detail.cancellationRate)} strong />
          <DrawerRow label={tr('adminRestos.acceptanceRate')} value={pct(detail.acceptanceRate)} strong />
          <DrawerRow label={tr('adminRestos.avgPrepTime')} value={detail.avgPrepMinutes !== null ? tr('adminRestos.prepMinutes', { n: detail.avgPrepMinutes }) : tr('adminRestos.prepNotMeasured')} strong />
        </>
      )}
      {detail && onglet === 'apercu' && editing && form && (
        <div>
          <div className="field"><label>{tr('adminCommon.name')}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>{tr('adminCommon.municipality')}</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
          <div className="field"><label>{tr('adminCommon.owner')}</label><input value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} /></div>
          <div className="field"><label>{tr('adminRestos.legalName')}</label><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminRestos.companyNumber')}</label><input value={form.companyNumber} onChange={(e) => setForm({ ...form, companyNumber: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label>TVA</label><input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      {detail && onglet === 'commandes' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.recentOrders')}</h4>
            <Link to={`/admin/orders?restaurantId=${selected.id}`} className="small">{tr('adminRestos.seeAll')}</Link>
          </div>
          {!orders && <div className="small">{tr('adminCommon.loading')}</div>}
          {orders && orders.length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
          {orders && orders.map((o) => (
            <div key={o.id} className="drawer-row">
              <span className="small">{fmtDate(o.createdAt)} · {o.clientName}{o.driverName ? tr('adminRestos.deliveredBySuffix', { name: o.driverName }) : ''}</span>
              <span className="row" style={{ gap: 8 }}><b className="small">{money(o.total)}</b><span className={`status-badge status-${o.status}`}>{o.status}</span></span>
            </div>
          ))}
        </>
      )}
      {detail && onglet === 'finance' && (
        <>
          {crmProspect && (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminRestos.commercialOrigin')}</h4>
                <Link to="/admin/crm" state={{ presetSearch: crmProspect.name }} className="small">{tr('adminRestos.viewInCrm')}</Link>
              </div>
              <div className="small">{tr('adminRestos.crmOwnerLine', { owner: crmProspect.ownerEmail || '—', source: crmProspect.source || '—' })}</div>
              <div className="small">{tr('adminRestos.convertedOn', { date: fmtDate(crmProspect.convertedAt) })}</div>
              <div className="divider" />
            </>
          )}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminRestos.invoices')}</h4>
            <Link to="/admin/invoices" state={{ restaurantId: selected.id }} className="small">{tr('adminRestos.seeAll')}</Link>
          </div>
          {!invoices && <div className="small">{tr('adminCommon.loading')}</div>}
          {invoices && invoices.length === 0 && <div className="small">{tr('adminRestos.noInvoices')}</div>}
          {invoices && invoices.map((inv) => (
            <div key={inv.id} className="drawer-row">
              <span className="small" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
              <span className="small">{money(inv.totalTtc)} · <span style={{ color: INVOICE_STATUS_LABELS[inv.status]?.color }}>{INVOICE_STATUS_LABELS[inv.status]?.label}</span></span>
            </div>
          ))}
        </>
      )}
      {detail && onglet === 'documents' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.documents')}</h4>
            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowUploadDoc(true)}>{tr('adminCommon.add')}</button>
          </div>
          {!documents && <div className="small">{tr('adminCommon.loading')}</div>}
          {documents && documents.length === 0 && <div className="small">{tr('adminCommon.noDocuments')}</div>}
          {documents && documents.map((doc) => (
            <div key={doc.id} className="drawer-row">
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="small">📎 {doc.title}</a>
              <span className="small">
                {doc.expiryState && <span style={{ color: DOCUMENT_EXPIRY_LABELS[doc.expiryState].color, marginRight: 6 }}>{DOCUMENT_EXPIRY_LABELS[doc.expiryState].label}</span>}
                {DOCUMENT_TYPE_LABELS[doc.documentType]}
              </span>
            </div>
          ))}
          {showUploadDoc && (
            <UploadDocumentModal
              presetTargetType="restaurant" presetTargetId={selected.id} presetTargetLabel={detail.name}
              onClose={() => setShowUploadDoc(false)} onUploaded={() => { setShowUploadDoc(false); loadDocuments(); }}
            />
          )}
        </>
      )}
      {detail && onglet === 'suivi' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <CreateTicketButton linkType="linkedRestaurantId" linkId={selected.id} label={detail.name} />
            <CreateTaskButton targetType="restaurant" targetId={selected.id} label={detail.name} />
          </div>
          <AdminNotesPanel targetType="restaurant" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
          <div className="divider" />
          <AdminActionHistory actions={detail.actions} />
        </>
      )}
    </RecordDrawer>,
    document.body
  );
}
