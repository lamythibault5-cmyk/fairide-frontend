import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AdminDataTable, { useTableSort, sortRows } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, LoadMore, ResultCount } from '../../components/admin/AdminListTools';
import useServerList from '../../hooks/useServerList';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { UploadDocumentModal } from './AdminDocumentsPage';
import { estCompteTest, estCompteReel, estCompteSupprime, DeletedBadge, TestBadge, TestToggleButton, money, fmtDate, pct, downloadCsv, useDebouncedValue, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS, NatureChips, natureOk, ProfilLine } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const activityLabels = (tr) => ({
  disponible: { label: tr('adminDrivers.available'), color: 'var(--teal-deep)' },
  en_livraison: { label: tr('adminDrivers.delivering'), color: 'var(--gold-deep)' },
  offline: { label: tr('adminDrivers.offline'), color: 'inherit' }
});

const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const PAGE_SIZE = 100;
const TRIS_SERVEUR = ['created_desc', 'created_asc', 'name', 'revenue', 'orders'];
const STATUT_ADMIN = (tr) => ({ pending: tr('adminDrivers.filterPending'), approved: tr('adminDrivers.filterApproved'), blocked: tr('adminDrivers.filterBlocked') });
const VAT_LABELS = (tr) => ({ franchise: tr('adminDrivers.vatFranchise'), assujetti: tr('adminDrivers.vatSubject') });
// Dossier coursier (statut légal, véhicule, zone) en une ligne ; le détail complet est dans Dossiers livreurs.
function courierLine(d, tr) {
  if (!d.courier) return tr('adminDrivers.noCourierFile');
  const c = d.courier;
  return [c.statusType ? tr(`courierOnboarding.status_${c.statusType}`) : tr('adminDrivers.statusNotChosen'), c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : null, c.zone || null, c.lifecycleStatus ? tr(`courierOnboarding.lifecycle_${c.lifecycleStatus}`) : null].filter(Boolean).join(' · ');
}

export default function AdminDriversPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(search, 350);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('drivers', 'cards');
  const filtre = searchParams.get('status') || 'all';
  const [nature, setNature] = useState('all');
  // Type de livreur (statut légal du dossier coursier) : student | p2p | independent | none (pas encore choisi).
  const [typeLivreur, setTypeLivreur] = useState('all');
  const TYPES_LIVREUR = ['student', 'p2p', 'independent'];
  const typeDe = (d) => d.courier?.statusType || 'none';
  const libelleType = (k) => (k === 'none' ? tr('adminDrivers.statusNotChosen') : tr(`courierOnboarding.status_${k}`));
  const emojiType = (k) => ({ student: '🎓', p2p: '🤝', independent: '💼' }[k] || '❔');
  const [activite, setActivite] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [triServeur, setTriServeur] = useState('created_desc');
  const { sort, toggle } = useTableSort('deliveriesCount');
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [onglet, setOnglet] = useState('apercu');
  const setFiltre = (k) => { const next = Object.fromEntries([...searchParams.entries()]); if (k && k !== 'all') next.status = k; else delete next.status; setSearchParams(next); };

  const liste = useServerList('/admin/drivers', { q, sort: triServeur, pageSize: PAGE_SIZE, extra: { adminStatus: ['pending', 'approved', 'blocked'].includes(filtre) ? filtre : '' } });
  const { rows: drivers, setRows: setDrivers, total, loading, error, reload: load, loadMore } = liste;

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
      setDrivers((prev) => (prev || []).map((d) => (d.id === id ? { ...d, adminStatus: status } : d)));
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
  function askApprove(d) {
    setConfirmAction({ title: tr('adminDrivers.confirmApprove', { name: d.name }), message: tr('adminDrivers.approveBody'), run: () => setStatus(d.id, 'approved') });
  }
  // Suppression définitive (DELETE /admin/drivers/:id) : refusée par le serveur si une course est en cours.
  async function deleteDriver(d) {
    const r = await api(`/admin/drivers/${d.id}`, { method: 'DELETE', token });
    setDrivers((prev) => (prev || []).filter((x) => x.id !== d.id));
    if (selected?.id === d.id) { setSelected(null); setDetail(null); }
    toast(tr('adminDrivers.toastDeleted', { n: r.detachedDeliveries ?? r.orders ?? 0 }));
  }
  function askDelete(d) {
    setConfirmAction({ title: tr('adminDrivers.confirmDelete', { name: d.name }), message: tr('adminDrivers.deleteBody', { email: d.email || '' }), danger: true, run: () => deleteDriver(d).catch((e) => toast(e.message)) });
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
    if (!visibles.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`livreurs-${Date.now()}.csv`, visibles, [
      { label: tr('adminCommon.name'), get: (d) => d.name },
      { label: tr('adminCommon.email'), get: (d) => d.email },
      { label: tr('adminCommon.phone'), get: (d) => d.phone },
      { label: tr('adminCommon.municipality'), get: (d) => [d.postalCode, d.city].filter(Boolean).join(' ') },
      { label: tr('adminCommon.language'), get: (d) => d.language },
      { label: tr('adminCommon.accountKind'), get: (d) => (estCompteTest(d) ? 'test' : 'réel') },
      { label: tr('adminDrivers.courierStatus'), get: (d) => d.courier?.statusType || '' },
      { label: tr('adminDrivers.vehicle'), get: (d) => d.courier?.vehicleType || '' },
      { label: tr('adminCommon.status'), get: (d) => d.adminStatus },
      { label: tr('adminDrivers.activity'), get: (d) => d.activityStatus },
      { label: tr('adminCommon.deliveries'), get: (d) => d.deliveriesCount },
      { label: tr('adminCommon.revenue'), get: (d) => d.revenue },
      { label: tr('adminCommon.cancellationRate'), get: (d) => d.cancellationRate },
      { label: tr('adminCommon.avgTime'), get: (d) => d.avgDeliveryMinutes }
    ]);
  }

  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (d) => <><b>{d.name}</b>{estCompteTest(d) && <TestBadge />}</>, sortValue: (d) => d.name },
    { key: 'email', label: tr('adminCommon.email'), get: (d) => d.email },
    { key: 'adminStatus', label: tr('adminCommon.status'), get: (d) => <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>{STATUT_ADMIN(tr)[d.adminStatus] || d.adminStatus}</span>, sortValue: (d) => d.adminStatus },
    { key: 'activityStatus', label: tr('adminCommon.activity'), get: (d) => <span className="pill" style={{ color: activityLabels(tr)[d.activityStatus]?.color }}>{activityLabels(tr)[d.activityStatus]?.label}</span>, sortValue: (d) => d.activityStatus },
    { key: 'courierStatus', label: tr('adminDrivers.courierStatus'), get: (d) => (d.courier?.statusType ? tr(`courierOnboarding.status_${d.courier.statusType}`) : '-'), sortValue: (d) => d.courier?.statusType || '' },
    { key: 'vehicle', label: tr('adminDrivers.vehicle'), get: (d) => (d.courier?.vehicleType ? tr(`courierOnboarding.vehicle_${d.courier.vehicleType}`) : '-'), sortValue: (d) => d.courier?.vehicleType || '' },
    { key: 'city', label: tr('adminCommon.municipality'), get: (d) => [d.postalCode, d.city].filter(Boolean).join(' ') || '-', sortValue: (d) => d.city || '' },
    { key: 'vatStatus', label: tr('adminCommon.vat'), get: (d) => VAT_LABELS(tr)[d.vatStatus] || '-', sortValue: (d) => d.vatStatus || '' },
    { key: 'deliveriesCount', label: tr('adminCommon.deliveries'), get: (d) => d.deliveriesCount, align: 'right', sum: true },
    { key: 'revenue', label: tr('adminCommon.revenue'), get: (d) => money(d.revenue), sortValue: (d) => d.revenue, align: 'right', sum: true },
    { key: 'cancellationRate', label: tr('adminCommon.cancellationRate'), get: (d) => pct(d.cancellationRate), sortValue: (d) => d.cancellationRate, align: 'right' },
    { key: 'avgDeliveryMinutes', label: tr('adminCommon.avgTime'), get: (d) => (d.avgDeliveryMinutes !== null ? `${d.avgDeliveryMinutes} min` : '-'), sortValue: (d) => d.avgDeliveryMinutes, align: 'right' },
    { key: 'avgRating', label: tr('adminCommon.rating'), get: (d) => (d.reviewCount > 0 ? `${Number(d.avgRating).toFixed(1)}★ (${d.reviewCount})` : '-'), sortValue: (d) => (d.reviewCount > 0 ? d.avgRating : null), align: 'right' },
    { key: 'createdAt', label: tr('adminCommon.registeredOn'), get: (d) => fmtDate(d.createdAt), sortValue: (d) => d.createdAt }
  ];
  const groupes = {
    status: { get: (d) => STATUT_ADMIN(tr)[d.adminStatus] || d.adminStatus }, activity: { get: (d) => activityLabels(tr)[d.activityStatus]?.label || d.activityStatus },
    vat: { get: (d) => VAT_LABELS(tr)[d.vatStatus] || tr('adminDrivers.vatUnknown') },
    courierType: { get: (d) => `${emojiType(typeDe(d))} ${libelleType(typeDe(d))}` }
  };
  // Vue fiches : découpe en sections quand un regroupement est choisi (l'ordre des types est fixe : étudiants, P2P, indépendants, non choisi).
  function sectionsCartes(liste, groupe) {
    if (!groupe) return [[null, liste]];
    const ordre = (d) => (groupBy === 'courierType' ? ['student', 'p2p', 'independent', 'none'].indexOf(typeDe(d)) : 0);
    const m = new Map();
    [...liste].sort((a, b) => ordre(a) - ordre(b)).forEach((d) => { const k = groupe.get(d); if (!m.has(k)) m.set(k, []); m.get(k).push(d); });
    return [...m.entries()];
  }
  const visibles = useMemo(() => sortRows((drivers || []).filter((d) => natureOk(nature, d) && (!activite || d.activityStatus === activite) && (typeLivreur === 'all' || typeDe(d) === typeLivreur)), colonnes, sort), [drivers, nature, activite, typeLivreur, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => (drivers || []).reduce((a, d) => ({ real: a.real + (estCompteReel(d) ? 1 : 0), deleted: a.deleted + (estCompteSupprime(d) ? 1 : 0), pending: a.pending + (d.adminStatus === 'pending' ? 1 : 0), available: a.available + (d.activityStatus === 'disponible' && d.adminStatus === 'approved' ? 1 : 0), delivering: a.delivering + (d.activityStatus === 'en_livraison' ? 1 : 0), deliveries: a.deliveries + d.deliveriesCount, revenue: a.revenue + d.revenue }), { real: 0, deleted: 0, pending: 0, available: 0, delivering: 0, deliveries: 0, revenue: 0 }), [drivers]);
  const tousCharges = drivers && drivers.length >= total;

  return (
    <div>
      <AdminPageHeader module="drivers" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />
      {drivers && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{total}</div><div className="label">{tr('adminDrivers.kpiTotal')}</div></div>
          <div className="stat-card"><div className="num">{kpi.real}</div><div className="label">{tr('adminDrivers.kpiReal')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: kpi.pending > 0 ? 'var(--gold-deep)' : undefined }}>{kpi.pending}</div><div className="label">{tr('adminDrivers.kpiPending')}</div></div>
          <div className="stat-card"><div className="num">{kpi.available}</div><div className="label">{tr('adminDrivers.kpiAvailable')}</div></div>
          <div className="stat-card"><div className="num">{kpi.delivering}</div><div className="label">{tr('adminDrivers.kpiDelivering')}</div></div>
          <div className="stat-card"><div className="num">{kpi.deliveries}</div><div className="label">{tr('adminCommon.deliveries')}</div></div>
          <div className="stat-card"><div className="num">{money(kpi.revenue)}</div><div className="label">{tr('adminDrivers.kpiRevenue')}</div></div>
        </div>
      )}
      {drivers && !tousCharges && <p className="small" style={{ margin: '-8px 0 12px', opacity: 0.7 }}>{tr('adminCommon.kpiOnLoaded', { n: drivers.length, total })}</p>}
      <div className="admin-control-panel">
        <input placeholder={tr('adminDrivers.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allM')], ['pending', tr('adminDrivers.filterPending')], ['approved', tr('adminDrivers.filterApproved')], ['blocked', tr('adminDrivers.filterBlocked')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}{k === 'pending' && kpi.pending > 0 ? ` (${kpi.pending})` : ''}</div>
          ))}
        </div>
        <div className="role-pick" style={{ margin: 0 }} role="group" aria-label={tr('adminDrivers.courierStatus')}>
          {['all', ...TYPES_LIVREUR, 'none'].map((k) => {
            const n = k === 'all' ? (drivers || []).length : (drivers || []).filter((d) => typeDe(d) === k).length;
            if (k === 'none' && n === 0) return null;
            return <div key={k} className={`chip${typeLivreur === k ? ' active' : ''}`} onClick={() => setTypeLivreur(k)}>{k === 'all' ? tr('adminDrivers.allTypes') : `${emojiType(k)} ${libelleType(k)}`}{drivers ? ` (${n})` : ''}</div>;
          })}
        </div>
        <NatureChips nature={nature} onChange={setNature} realCount={kpi.real} deletedCount={kpi.deleted} labels={{ all: tr('adminCommon.allM'), real: tr('adminCommon.filterRealAccounts'), test: tr('adminCommon.filterTestAccounts'), deleted: tr('adminCommon.filterDeletedAccounts') }} />
        <select value={activite} onChange={(e) => setActivite(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">{tr('adminDrivers.allActivities')}</option>
          {Object.entries(activityLabels(tr)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={triServeur} onChange={(e) => setTriServeur(e.target.value)} style={{ maxWidth: 200 }} title={tr('adminCommon.sortServer')}>
          {TRIS_SERVEUR.map((k) => <option key={k} value={k}>{tr('adminCommon.sortBy')} : {tr(`adminCommon.sort_${k}`)}</option>)}
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="courierType">{tr('adminCommon.groupBy')} : {tr('adminDrivers.courierType')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="activity">{tr('adminCommon.groupBy')} : {tr('adminCommon.activity')}</option>
            <option value="vat">{tr('adminCommon.groupBy')} : {tr('adminCommon.vat')}</option>
        </select>
        <ResultCount n={visibles.length} total={total} />
      </div>
      {error && <ErrorCard message={error} onRetry={load} />}
      {!drivers && !error && <SkeletonCards count={3} />}
      {drivers && visibles.length === 0 && !error && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {drivers && mode === 'table' && visibles.length > 0 && (
        <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} groupBy={groupBy ? groupes[groupBy] : null} onRowClick={openDriver}
          rowClassName={(d) => (estCompteTest(d) ? 'row-test-account' : '')} showTotals format={{ revenue: money }} emptyLabel={tr('adminCommon.noResults')} />
      )}
      {drivers && mode === 'cards' && sectionsCartes(visibles, groupBy ? groupes[groupBy] : null).map(([titre, liste]) => (
        <div key={titre || 'tous'}>
          {titre && <h4 className="drawer-section-title" style={{ margin: '14px 0 8px' }}>{titre} <span className="small" style={{ opacity: 0.7 }}>({liste.length})</span></h4>}
          {liste.map((d) => {
        const act = activityLabels(tr)[d.activityStatus];
        return (
          <div className={`card order-card-clickable${estCompteTest(d) ? ' card-test-account' : ''}`} key={d.id} onClick={() => openDriver(d)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{d.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {estCompteSupprime(d) ? <DeletedBadge /> : estCompteTest(d) && <TestBadge />}
                <span className="pill" style={{ color: act?.color }}>{act?.label}</span>
                <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                  {d.adminStatus === 'approved' ? tr('adminDrivers.approved') : d.adminStatus === 'blocked' ? tr('adminDrivers.filterBlocked') : tr('adminDrivers.pendingBadge')}
                </span>
              </div>
            </div>
            <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}{d.linkedRestaurantName ? tr('adminDrivers.linkedToSuffix', { name: d.linkedRestaurantName }) : ''}</div>
            <ProfilLine u={d} tr={tr} />
            <div className="small">🛵 {courierLine(d, tr)}</div>
            <div className="small">
              {tr('adminDrivers.statsLine', { n: d.deliveriesCount, revenue: money(d.revenue), cancel: pct(d.cancellationRate) })}
              {d.reviewCount > 0 ? tr('adminDrivers.ratingSuffix', { rating: Number(d.avgRating).toFixed(1), n: d.reviewCount }) : tr('adminDrivers.noReviewsSuffix')}
            </div>
            <div className="small" style={{ opacity: 0.6 }}>
              {d.avgDeliveryMinutes !== null ? tr('adminDrivers.avgMinutes', { n: d.avgDeliveryMinutes }) : tr('adminDrivers.notMeasuredYet')}{tr('adminDrivers.acceptanceNotMeasurable')}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
              {d.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askApprove(d)}>{tr('adminCommon.approve')}</button>}
              {d.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(d)}>{tr('adminCommon.suspend')}</button>}
              {d.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(d)}>{tr('adminCommon.reactivate')}</button>}
              <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={() => askDelete(d)}>{tr('adminDrivers.deleteAccount')}</button>
            </div>
          </div>
        );
          })}
        </div>
      ))}
      {drivers && <LoadMore loaded={drivers.length} total={total} loading={loading} onMore={loadMore} />}

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
              <ProfilLine u={detail} tr={tr} />
              <p className="small" style={{ margin: '2px 0' }}>🛵 {courierLine(detail, tr)}{detail.courier && <> · <Link to="/admin/couriers" state={{ presetSearch: detail.email }} className="small">{tr('adminDrivers.openCourierFile')}</Link></>}</p>
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminDrivers.registeredStripe', { date: fmtDate(detail.createdAt), status: detail.stripeConnectStatus || '-' })}</p>
              {(detail.payoutIban || detail.payoutAccountHolder) && (
                <p className="small" style={{ margin: '2px 0' }}>💳 {detail.payoutAccountHolder || tr('adminDrivers.holderMissing')}, {detail.payoutIban || tr('adminDrivers.ibanMissing')}</p>
              )}
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminCommon.vat')} : {VAT_LABELS(tr)[detail.vatStatus] || tr('adminDrivers.vatUnknown')}{detail.vatNumber ? ` · ${detail.vatNumber}` : ''}</p>
              <p className="small" style={{ margin: '2px 0' }}>{tr('adminDrivers.companyNumber')} : {detail.companyNumber || '-'}</p>
              <p className="small" style={{ margin: '2px 0', opacity: 0.7 }}>{tr('adminCommon.privacyNote')}</p>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {detail.adminStatus !== 'approved' && <button className="btn-teal" onClick={() => askApprove(detail)}>{tr('adminCommon.approve')}</button>}
                <TestToggleButton userId={detail.id} isTest={estCompteTest(detail)} token={token} api={api} toast={toast} tr={tr} onChanged={() => { refreshDetail(); load(); }} />
                {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>{tr('adminCommon.suspend')}</button>}
                {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>{tr('adminCommon.reactivate')}</button>}
                <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => askDelete(detail)}>{tr('adminDrivers.deleteAccount')}</button>
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
