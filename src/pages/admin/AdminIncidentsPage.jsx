import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import PeriodPicker, { usePeriod } from '../../components/admin/PeriodPicker';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { ErrorCard, Pager, ResultCount } from '../../components/admin/AdminListTools';
import { SkeletonCards } from '../../components/Skeleton';
import { money, fmtDateTime, downloadCsv, useDebouncedValue } from './adminUtils';
import IncidentDrawer, { IncPill } from './incidents/IncidentDrawer';
import PartnersTab from './incidents/PartnersTab';
import NewIncidentForm from './incidents/NewIncidentForm';
import { INCIDENT_TYPES, RESPONSIBILITIES, STATUSES, PRIORITIES, typeLabel, respLabel, statusLabel, priorityLabel, estOuvert } from './incidents/labels';
import '../../admin-incidents.css';

const PAGE_SIZE = 25;
const TABS = ['list', 'partners', 'new'];

// Application « Incidents & litiges » : liste des dossiers (KPI, période, filtres, fiche latérale),
// classement des partenaires à problèmes, création d'un dossier depuis une commande.
export default function AdminIncidentsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { period, setPeriod, queryString } = usePeriod({ allowAll: true });
  const [tab, setTab] = useState(() => (searchParams.get('new') === '1' ? 'new' : (TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'list')));
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [responsibility, setResponsibility] = useState(searchParams.get('responsibility') || '');
  const [priority, setPriority] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === '1');
  const [partner, setPartner] = useState(null); // { key: 'restaurantId' | 'driverId' | 'clientId', id, name }
  const [qInput, setQInput] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);
  const { sort, toggle } = useTableSort('createdAt', 'desc');

  const charger = useCallback(() => {
    setErreur(null);
    const params = new URLSearchParams(queryString);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (responsibility) params.set('responsibility', responsibility);
    if (priority) params.set('priority', priority);
    if (overdueOnly) params.set('overdue', '1');
    if (partner) params.set(partner.key, partner.id);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/incidents?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }, [queryString, status, type, responsibility, priority, overdueOnly, partner, q, page, token]);

  useEffect(() => { setData(null); charger(); }, [charger]);
  useEffect(() => { setPage(0); }, [queryString, status, type, responsibility, priority, overdueOnly, partner, q]);
  // Ouverture directe par l'adresse (?id=…, ?new=1) consommée une seule fois.
  useEffect(() => {
    if (!searchParams.get('id') && !searchParams.get('new')) return;
    const next = Object.fromEntries([...searchParams.entries()]); delete next.id; delete next.new;
    setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.items || [];
  const kpis = data?.kpis;
  const filtresActifs = !!(status || type || responsibility || priority || overdueOnly || partner || q);

  function reinitialiser() {
    setStatus(''); setType(''); setResponsibility(''); setPriority(''); setOverdueOnly(false); setPartner(null); setQInput('');
  }

  function exporter() {
    if (!items.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`incidents-${Date.now()}.csv`, items, [
      { label: tr('adminCommon.date'), get: (i) => fmtDateTime(i.createdAt) },
      { label: tr('adminIncidents.orderId'), get: (i) => i.orderId },
      { label: tr('adminCommon.type'), get: (i) => typeLabel(tr, i.type) },
      { label: tr('adminIncidents.responsibility'), get: (i) => respLabel(tr, i.responsibility) },
      { label: tr('adminCommon.status'), get: (i) => statusLabel(tr, i.status) },
      { label: tr('adminCommon.priority'), get: (i) => priorityLabel(tr, i.priority) },
      { label: tr('adminCommon.amount'), get: (i) => (i.amount === null ? '' : Number(i.amount).toFixed(2)) },
      { label: tr('adminCommon.restaurant'), get: (i) => i.restaurantName || '' },
      { label: tr('adminCommon.client'), get: (i) => i.clientName || '' },
      { label: tr('adminCommon.driver'), get: (i) => i.driverName || '' },
      { label: tr('adminIncidents.assignedTo'), get: (i) => i.assignedTo || '' },
      { label: tr('adminIncidents.dueAt'), get: (i) => fmtDateTime(i.dueAt) },
      { label: tr('adminIncidents.overdue'), get: (i) => (i.overdue ? '1' : '') },
      { label: tr('adminIncidents.description'), get: (i) => i.description },
      { label: tr('adminIncidents.resolution'), get: (i) => i.resolution }
    ]);
  }

  const colonnes = useMemo(() => [
    { key: 'createdAt', label: tr('adminCommon.date'), get: (i) => <span className="small">{fmtDateTime(i.createdAt)}</span>, sortValue: (i) => i.createdAt, width: 130 },
    { key: 'order', label: tr('adminIncidents.colOrder'), get: (i) => <span className="inc-cell-order"><code>#{i.orderShort}</code><span className="small">{i.restaurantName || '-'}{i.clientName ? ` → ${i.clientName}` : ''}</span></span>, sortValue: (i) => i.restaurantName || '' },
    { key: 'type', label: tr('adminCommon.type'), get: (i) => <IncPill kind="type" value={i.type} label={typeLabel(tr, i.type)} />, sortValue: (i) => i.type },
    { key: 'responsibility', label: tr('adminIncidents.responsibility'), get: (i) => <IncPill kind="resp" value={i.responsibility} label={respLabel(tr, i.responsibility)} />, sortValue: (i) => i.responsibility },
    { key: 'status', label: tr('adminCommon.status'), get: (i) => <><IncPill kind="st" value={i.status} label={statusLabel(tr, i.status)} />{i.overdue && <span className="inc-overdue">{tr('adminIncidents.overdue')}</span>}</>, sortValue: (i) => `${i.overdue ? '0' : '1'}-${i.status}` },
    { key: 'priority', label: tr('adminCommon.priority'), get: (i) => <IncPill kind="prio" value={i.priority} label={priorityLabel(tr, i.priority)} />, sortValue: (i) => ({ high: 3, normal: 2, low: 1 }[i.priority] || 0) },
    { key: 'amount', label: tr('adminCommon.amount'), get: (i) => (i.amount === null || i.amount === undefined ? '-' : money(i.amount)), sortValue: (i) => i.amount || 0, align: 'right' },
    { key: 'description', label: tr('adminIncidents.description'), get: (i) => <span className="inc-cell-desc small" title={i.description}>{i.description || '-'}</span>, sortValue: (i) => i.description },
    { key: 'assignedTo', label: tr('adminIncidents.assignedTo'), get: (i) => <span className="small">{i.assignedTo || '-'}</span>, sortValue: (i) => i.assignedTo || '' },
    { key: 'dueAt', label: tr('adminIncidents.dueAt'), get: (i) => <span className="small" style={i.overdue ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{estOuvert(i) ? fmtDateTime(i.dueAt) : '-'}</span>, sortValue: (i) => (estOuvert(i) ? i.dueAt : 0) }
  ], [tr]);

  const onglets = [
    { key: 'list', label: tr('adminIncidents.tabIncidents'), count: kpis?.open },
    { key: 'partners', label: tr('adminIncidents.tabPartners') },
    { key: 'new', label: tr('adminIncidents.tabNew') }
  ];

  return (
    <div>
      <AdminPageHeader module="incidents" actions={<button type="button" className="btn-gold" onClick={() => setTab('new')}>{tr('adminIncidents.newIncidentButton')}</button>} />

      <nav className="fin-tabs" aria-label={tr('adminIncidents.tabsAria')}>
        {onglets.map((o) => (
          <div key={o.key} role="tab" aria-selected={tab === o.key} className={`chip${tab === o.key ? ' active' : ''}`} onClick={() => setTab(o.key)}>
            {o.label}{o.count ? <span className="pill">{o.count}</span> : null}
          </div>
        ))}
      </nav>

      {tab !== 'new' && <PeriodPicker period={period} onChange={setPeriod} allowAll />}

      {tab === 'list' && (
        <>
          {kpis ? (
            <>
              <div className="stat-grid">
                <button type="button" className={`stat-card inc-kpi-btn${status === 'open_all' ? ' highlight active' : ''}`} onClick={() => setStatus(status === 'open_all' ? '' : 'open_all')}>
                  <div className="num">{kpis.open}</div><div className="label">{tr('adminIncidents.kpiOpen')}</div>
                </button>
                <button type="button" className={`stat-card inc-kpi-btn${kpis.overdue > 0 ? ' inc-danger' : ''}${overdueOnly ? ' active' : ''}`} onClick={() => setOverdueOnly((v) => !v)}>
                  <div className="num">{kpis.overdue}</div><div className="label">{tr('adminIncidents.kpiOverdue')}</div>
                </button>
                <div className="stat-card"><div className="num">{kpis.inPeriod}</div><div className="label">{tr('adminIncidents.kpiInPeriod')}</div></div>
                <div className="stat-card"><div className="num">{kpis.resolved}</div><div className="label">{tr('adminIncidents.kpiResolved')}</div></div>
                <div className="stat-card highlight"><div className="num">{money(kpis.refundedAmount)}</div><div className="label">{tr('adminIncidents.kpiRefunded')}</div></div>
              </div>
              <div className="inc-kpi-breakdown" aria-label={tr('adminIncidents.breakdownAria')}>
                {INCIDENT_TYPES.filter((t) => kpis.byType?.[t] > 0).map((t) => (
                  <span key={t} role="button" tabIndex={0} className={`pill${type === t ? ' active' : ''}`} onClick={() => setType(type === t ? '' : t)} onKeyDown={(e) => { if (e.key === 'Enter') setType(type === t ? '' : t); }}>
                    {typeLabel(tr, t)} <b>{kpis.byType[t]}</b>
                  </span>
                ))}
                <span className="sep" />
                {RESPONSIBILITIES.filter((r) => kpis.byResponsibility?.[r] > 0).map((r) => (
                  <span key={r} role="button" tabIndex={0} className={`pill${responsibility === r ? ' active' : ''}`} onClick={() => setResponsibility(responsibility === r ? '' : r)} onKeyDown={(e) => { if (e.key === 'Enter') setResponsibility(responsibility === r ? '' : r); }}>
                    {respLabel(tr, r)} <b>{kpis.byResponsibility[r]}</b>
                  </span>
                ))}
              </div>
            </>
          ) : (!erreur && <div className="stat-grid"><SkeletonCards count={5} /></div>)}

          <div className="fin-toolbar">
            <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={tr('adminIncidents.searchPlaceholder')} aria-label={tr('adminIncidents.searchPlaceholder')} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('adminCommon.status')}>
              <option value="">{tr('adminCommon.allStatuses')}</option>
              <option value="open_all">{tr('adminIncidents.filterOpenAll')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(tr, s)}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label={tr('adminCommon.type')}>
              <option value="">{tr('adminIncidents.allTypes')}</option>
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(tr, t)}</option>)}
            </select>
            <select value={responsibility} onChange={(e) => setResponsibility(e.target.value)} aria-label={tr('adminIncidents.responsibility')}>
              <option value="">{tr('adminIncidents.allResponsibilities')}</option>
              {RESPONSIBILITIES.map((r) => <option key={r} value={r}>{respLabel(tr, r)}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label={tr('adminCommon.priority')}>
              <option value="">{tr('adminCommon.allPriorities')}</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(tr, p)}</option>)}
            </select>
            <div className="role-pick" style={{ margin: 0 }}>
              <div className={`chip${overdueOnly ? ' active' : ''}`} onClick={() => setOverdueOnly((v) => !v)}>{tr('adminIncidents.filterOverdue')}</div>
            </div>
            {partner && <span className="pill teal">{tr('adminIncidents.filterPartner', { name: partner.name })} <button type="button" className="btn-ghost" style={{ padding: '0 4px' }} onClick={() => setPartner(null)} aria-label={tr('adminCommon.close')}>✕</button></span>}
            <span className="spacer" />
            {data && <ResultCount n={items.length} total={data.total} />}
            {filtresActifs && <button type="button" className="btn-ghost" onClick={reinitialiser}>{tr('adminIncidents.resetFilters')}</button>}
            <button type="button" className="btn-ghost" onClick={exporter}>{tr('adminCommon.csv')}</button>
          </div>

          {erreur && <ErrorCard message={erreur} onRetry={charger} />}
          {!erreur && !data && <SkeletonCards count={4} />}
          {data && (
            <>
              <AdminDataTable
                columns={colonnes} rows={items} sort={sort} onSort={toggle}
                onRowClick={(i) => setSelectedId(i.id)}
                rowClassName={(i) => `${i.overdue ? 'inc-row-overdue' : ''} ${estOuvert(i) ? '' : 'inc-row-closed'}`}
                emptyLabel={filtresActifs ? tr('adminCommon.nothingForFilter') : tr('adminIncidents.emptyList')}
              />
              <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
            </>
          )}
        </>
      )}

      {tab === 'partners' && (
        <PartnersTab
          queryString={queryString}
          onPickRestaurant={(r) => { setPartner({ key: 'restaurantId', id: r.id, name: r.name }); setTab('list'); }}
          onPickDriver={(d) => { setPartner({ key: 'driverId', id: d.id, name: d.name }); setTab('list'); }}
        />
      )}

      {tab === 'new' && (
        <NewIncidentForm
          presetOrderId={searchParams.get('orderId') || ''}
          onCreated={(inc) => { setTab('list'); charger(); setSelectedId(inc.id); }}
          onCancel={() => setTab('list')}
        />
      )}

      {selectedId && (
        <IncidentDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={charger}
          onDeleted={() => { setSelectedId(null); charger(); }}
        />
      )}
    </div>
  );
}
