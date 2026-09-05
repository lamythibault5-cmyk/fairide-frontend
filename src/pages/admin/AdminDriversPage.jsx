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
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, pct, downloadCsv, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const activityLabels = (tr) => ({
  disponible: { label: tr('adminDrivers.available'), color: 'var(--teal-deep)' },
  en_livraison: { label: tr('adminDrivers.delivering'), color: 'var(--gold-deep)' },
  offline: { label: tr('adminDrivers.offline'), color: 'inherit' }
});

const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const STATUT_ADMIN = (tr) => ({ pending: tr('adminDrivers.filterPending'), approved: tr('adminDrivers.filterApproved'), blocked: tr('adminDrivers.filterBlocked') });
const VAT_LABELS = (tr) => ({ franchise: tr('adminDrivers.vatFranchise'), assujetti: tr('adminDrivers.vatSubject') });

export default function AdminDriversPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [drivers, setDrivers] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('drivers', 'cards');
  const [filtre, setFiltre] = useState('all');
  const [activite, setActivite] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const { sort, toggle } = useTableSort('deliveriesCount');
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [onglet, setOnglet] = useState('apercu');

  useEffect(() => {
    api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDocuments(driverId) {
    setDocuments(null);
    api(`/admin/documents?targetType=driver&targetId=${driverId}&limit=10`, { token }).then((r) => setDocuments(r.rows)).catch(() => setDocuments([]));
  }

  function openDriver(d) {
    setOnglet('apercu');
    setSelected(d);
    setDetail(null);
    api(`/admin/drivers/${d.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
    loadDocuments(d.id);
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/drivers/${id}/status`, { method: 'PATCH', token, body: { status } });
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, adminStatus: status } : d)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? tr('adminDrivers.toastApproved') : status === 'blocked' ? tr('adminDrivers.toastSuspended') : tr('adminCommon.toastStatusUpdated'));
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(d) {
    setConfirmAction({ title: tr('adminCommon.confirmSuspend', { name: d.name }), message: tr('adminDrivers.suspendBody'), danger: true, run: () => setStatus(d.id, 'blocked') });
  }
  function askReactivate(d) {
    setConfirmAction({ title: tr('adminDrivers.confirmReactivate', { name: d.name }), run: () => setStatus(d.id, 'approved') });
  }
  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/drivers/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!drivers || !drivers.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`livreurs-${Date.now()}.csv`, drivers, [
      { label: 'Nom', get: (d) => d.name },
      { label: 'Email', get: (d) => d.email },
      { label: tr('adminCommon.phone'), get: (d) => d.phone },
      { label: 'Statut', get: (d) => d.adminStatus },
      { label: tr('adminDrivers.activity'), get: (d) => d.activityStatus },
      { label: 'Livraisons', get: (d) => d.deliveriesCount },
      { label: 'Revenus', get: (d) => d.revenue },
      { label: "Taux d'annulation", get: (d) => d.cancellationRate },
      { label: 'Temps moyen livraison (min)', get: (d) => d.avgDeliveryMinutes }
    ]);
  }

  const filtered = filterBySearch(drivers, search, (d) => [d.name, d.email, d.phone]);
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (d) => <><b>{d.name}</b>{isTestAccount(d.email) && <TestBadge />}</>, sortValue: (d) => d.name },
    { key: 'email', label: tr('adminCommon.email'), get: (d) => d.email },
    { key: 'adminStatus', label: tr('adminCommon.status'), get: (d) => <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>{STATUT_ADMIN(tr)[d.adminStatus] || d.adminStatus}</span>, sortValue: (d) => d.adminStatus },
    { key: 'activityStatus', label: tr('adminCommon.activity'), get: (d) => <span className="pill" style={{ color: activityLabels(tr)[d.activityStatus]?.color }}>{activityLabels(tr)[d.activityStatus]?.label}</span>, sortValue: (d) => d.activityStatus },
    { key: 'vatStatus', label: tr('adminCommon.vat'), get: (d) => VAT_LABELS(tr)[d.vatStatus] || '—', sortValue: (d) => d.vatStatus || '' },
    { key: 'deliveriesCount', label: tr('adminCommon.deliveries'), get: (d) => d.deliveriesCount, align: 'right', sum: true },
    { key: 'revenue', label: tr('adminCommon.revenue'), get: (d) => money(d.revenue), sortValue: (d) => d.revenue, align: 'right', sum: true },
    { key: 'cancellationRate', label: tr('adminCommon.cancellationRate'), get: (d) => pct(d.cancellationRate), sortValue: (d) => d.cancellationRate, align: 'right' },
    { key: 'avgDeliveryMinutes', label: tr('adminCommon.avgTime'), get: (d) => (d.avgDeliveryMinutes !== null ? `${d.avgDeliveryMinutes} min` : '—'), sortValue: (d) => d.avgDeliveryMinutes, align: 'right' },
    { key: 'avgRating', label: tr('adminCommon.rating'), get: (d) => (d.reviewCount > 0 ? `${d.avgRating.toFixed(1)}★ (${d.reviewCount})` : '—'), sortValue: (d) => (d.reviewCount > 0 ? d.avgRating : null), align: 'right' },
    { key: 'createdAt', label: tr('adminCommon.registeredOn'), get: (d) => fmtDate(d.createdAt), sortValue: (d) => d.createdAt }
  ];
  const groupes = {
    status: { get: (d) => STATUT_ADMIN(tr)[d.adminStatus] || d.adminStatus }, activity: { get: (d) => activityLabels(tr)[d.activityStatus]?.label || d.activityStatus },
    vat: { get: (d) => VAT_LABELS(tr)[d.vatStatus] || tr('adminDrivers.vatUnknown') }
  };
  const visibles = useMemo(() => sortRows((filtered || []).filter((d) => (filtre === 'all' || d.adminStatus === filtre) && (!activite || d.activityStatus === activite)), colonnes, sort), [filtered, filtre, activite, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => (drivers || []).reduce((a, d) => ({ pending: a.pending + (d.adminStatus === 'pending' ? 1 : 0), available: a.available + (d.activityStatus === 'disponible' && d.adminStatus === 'approved' ? 1 : 0), delivering: a.delivering + (d.activityStatus === 'en_livraison' ? 1 : 0), deliveries: a.deliveries + d.deliveriesCount, revenue: a.revenue + d.revenue }), { pending: 0, available: 0, delivering: 0, deliveries: 0, revenue: 0 }), [drivers]);

  return (
    <div>
      <AdminPageHeader module="drivers" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />
      {drivers && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{drivers.length}</div><div className="label">{tr('adminDrivers.kpiTotal')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: kpi.pending > 0 ? 'var(--gold-deep)' : undefined }}>{kpi.pending}</div><div className="label">{tr('adminDrivers.kpiPending')}</div></div>
          <div className="stat-card"><div className="num">{kpi.available}</div><div className="label">{tr('adminDrivers.kpiAvailable')}</div></div>
          <div className="stat-card"><div className="num">{kpi.delivering}</div><div className="label">{tr('adminDrivers.kpiDelivering')}</div></div>
          <div className="stat-card"><div className="num">{kpi.deliveries}</div><div className="label">{tr('adminCommon.deliveries')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.revenue)}</div><div className="label">{tr('adminDrivers.kpiRevenue')}</div></div>
        </div>
      )}
      <div className="admin-control-panel">
        <input placeholder={tr('adminDrivers.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allM')], ['pending', tr('adminDrivers.filterPending')], ['approved', tr('adminDrivers.filterApproved')], ['blocked', tr('adminDrivers.filterBlocked')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}{k === 'pending' && kpi.pending > 0 ? ` (${kpi.pending})` : ''}</div>
          ))}
        </div>
        <select value={activite} onChange={(e) => setActivite(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">{tr('adminDrivers.allActivities')}</option>
          {Object.entries(activityLabels(tr)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {mode === 'table' && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="activity">{tr('adminCommon.groupBy')} : {tr('adminCommon.activity')}</option>
            <option value="vat">{tr('adminCommon.groupBy')} : {tr('adminCommon.vat')}</option>
          </select>
        )}
        <span className="small">{tr('adminCommon.countOf', { n: visibles.length, total: (drivers || []).length })}</span>
      </div>
      {!drivers && <SkeletonCards count={3} />}
      {drivers && visibles.length === 0 && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {drivers && mode === 'table' && visibles.length > 0 && (
        <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} groupBy={groupBy ? groupes[groupBy] : null} onRowClick={openDriver}
          rowClassName={(d) => (isTestAccount(d.email) ? 'row-test-account' : '')} showTotals format={{ revenue: money }} emptyLabel={tr('adminCommon.noResults')} />
      )}
      {drivers && mode === 'cards' && visibles.map((d) => {
        const act = activityLabels(tr)[d.activityStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(d.email) ? ' card-test-account' : ''}`} key={d.id} onClick={() => openDriver(d)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{d.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(d.email) && <TestBadge />}
                <span className="pill" style={{ color: act?.color }}>{act?.label}</span>
                <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                  {d.adminStatus === 'approved' ? tr('adminDrivers.approved') : d.adminStatus === 'blocked' ? tr('adminDrivers.filterBlocked') : tr('adminDrivers.pendingBadge')}
                </span>
              </div>
            </div>
            <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}{d.linkedRestaurantName ? tr('adminDrivers.linkedToSuffix', { name: d.linkedRestaurantName }) : ''}</div>
            <div className="small">
              {tr('adminDrivers.statsLine', { n: d.deliveriesCount, revenue: money(d.revenue), cancel: pct(d.cancellationRate) })}
              {d.reviewCount > 0 ? tr('adminDrivers.ratingSuffix', { rating: d.avgRating.toFixed(1), n: d.reviewCount }) : tr('adminDrivers.noReviewsSuffix')}
            </div>
            <div className="small" style={{ opacity: 0.6 }}>
              {d.avgDeliveryMinutes !== null ? tr('adminDrivers.avgMinutes', { n: d.avgDeliveryMinutes }) : tr('adminDrivers.notMeasuredYet')}{tr('adminDrivers.acceptanceNotMeasurable')}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {d.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(d.id, 'approved')}>{tr('adminCommon.approve')}</button>}
              {d.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(d)}>{tr('adminCommon.suspend')}</button>}
              {d.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(d)}>{tr('adminCommon.reactivate')}</button>}
            </div>
          </div>
        );
      })}

      {selected && createPortal(
        <RecordDrawer
          title={selected.name}
          subtitle={detail ? `${detail.email}${detail.phone ? ` · ${detail.phone}` : ''}` : ''}
          badge={<span className="pill" style={{ color: selected.adminStatus === 'approved' ? 'var(--teal-deep)' : selected.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>{STATUT_ADMIN(tr)[selected.adminStatus] || selected.adminStatus}</span>}
          tabs={[
            { key: 'apercu', label: tr('adminCommon.tabOverview') },
            { key: 'commandes', label: tr('adminCommon.tabOrders'), count: detail?.orders ? detail.orders.length : null },
            { key: 'documents', label: tr('adminCommon.tabDocuments'), count: documents ? documents.length : null },
            { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: detail?.notes ? detail.notes.length : null }
          ]}
          tab={onglet} onTab={setOnglet} onClose={() => setSelected(null)} width={640}
        >
          {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
          {detail && onglet === 'apercu' && (
            <>
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminDrivers.registeredStripe', { date: fmtDate(detail.createdAt), status: detail.stripeConnectStatus || '—' })}</p>
              {(detail.payoutIban || detail.payoutAccountHolder) && (
                <p className="small" style={{ margin: '2px 0' }}>💳 {detail.payoutAccountHolder || tr('adminDrivers.holderMissing')} — {detail.payoutIban || tr('adminDrivers.ibanMissing')}</p>
              )}
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminCommon.vat')} : {VAT_LABELS(tr)[detail.vatStatus] || tr('adminDrivers.vatUnknown')}{detail.vatNumber ? ` · ${detail.vatNumber}` : ''}</p>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                {detail.adminStatus !== 'approved' && <button className="btn-teal" onClick={() => setStatus(detail.id, 'approved')}>{tr('adminCommon.approve')}</button>}
                {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>{tr('adminCommon.suspend')}</button>}
                {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>{tr('adminCommon.reactivate')}</button>}
              </div>
              <div className="divider" />
              <h4 className="drawer-section-title">{tr('adminRestos.keyFigures')}</h4>
              <DrawerRow label={tr('adminDrivers.completedDeliveries')} value={detail.deliveriesCount} strong />
              <DrawerRow label={tr('adminCommon.cancellationRate')} value={pct(detail.cancellationRate)} strong />
              <DrawerRow label={tr('adminDrivers.avgDeliveryTime')} value={detail.avgDeliveryMinutes !== null ? tr('adminDrivers.avgMinutes', { n: detail.avgDeliveryMinutes }) : tr('adminDrivers.notMeasuredYet')} strong />
              <div className="divider" />
              <h4 className="drawer-section-title">{tr('adminDrivers.driverFinance')}</h4>
              <DrawerRow label={tr('adminDrivers.totalDeliveryFees')} value={money(detail.deliveryFeesTotal)} />
              <DrawerRow label={tr('adminDrivers.fairideShare')} value={money(detail.fairideShareOnThose)} />
              <DrawerRow label={tr('adminDrivers.driverShare')} value={money(detail.deliveryFeesTotal)} strong />
              <DrawerRow label={tr('adminDrivers.adjustments')} value={`-${money(detail.adjustments)}`} />
              <DrawerRow label={tr('adminDrivers.duePaid')} value={money(detail.revenue)} strong />
            </>
          )}
          {detail && onglet === 'commandes' && (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.recentOrders')}</h4>
                <Link to={`/admin/orders?driverId=${selected.id}`} className="small">{tr('adminRestos.seeAll')}</Link>
              </div>
              {(detail.orders || []).length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
              {(detail.orders || []).map((o) => (
                <div key={o.id} className="drawer-row">
                  <span className="small">{o.restaurantName} → {o.clientName}</span>
                  <span className={`status-badge status-${o.status}`}>{o.status}</span>
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
                  presetTargetType="driver" presetTargetId={selected.id} presetTargetLabel={detail.name}
                  onClose={() => setShowUploadDoc(false)} onUploaded={() => { setShowUploadDoc(false); loadDocuments(selected.id); }}
                />
              )}
            </>
          )}
          {detail && onglet === 'suivi' && (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <CreateTicketButton linkType="linkedDriverId" linkId={selected.id} label={detail.name} />
                <CreateTaskButton targetType="driver" targetId={selected.id} label={detail.name} />
              </div>
              <AdminNotesPanel targetType="driver" targetId={selected.id} notes={detail.notes} onAdded={refreshDetail} />
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
