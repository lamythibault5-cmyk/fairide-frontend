import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, totalDepuisEntetes } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AssigneeSelect, { useAdmins } from '../../components/admin/AssigneeSelect';
import ReasonDialog from '../../components/admin/ReasonDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ErrorCard, Pager, ResultCount } from '../../components/admin/AdminListTools';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { fmtDate, fmtDateTime, downloadCsv, useDebouncedValue, pct, CRM_STAGES, CRM_STAGE_LABELS, CRM_PRIORITY_LABELS, TASK_STATUS_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 100;
const periodTypes = (tr) => [{ key: 'month', label: tr('adminCommon.month') }, { key: 'quarter', label: tr('adminCommon.quarter') }, { key: 'year', label: tr('adminCommon.year') }];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const relanceEnRetard = (p) => p.nextFollowUpAt && p.nextFollowUpAt < Date.now() && !['actif', 'perdu'].includes(p.stage);

export default function AdminCrmPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [prospects, setProspects] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(search, 350);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1');
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [pendingLoss, setPendingLoss] = useState(null); // { id, name }
  const [mode, setMode] = useViewMode('crm', 'kanban');
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [priorite, setPriorite] = useState('');
  const [owner, setOwner] = useState('');
  const [relanceRetard, setRelanceRetard] = useState(searchParams.get('overdue') === '1');
  const { sort, toggle } = useTableSort('nextFollowUpAt', 'asc');
  const admins = useAdmins();

  // Recherche, étape et responsable sont filtrés par le serveur (GET /admin/crm/prospects?q&stage&ownerEmail
  // &limit&offset, total dans X-Total-Count) ; priorité et « relance en retard » affinent la page.
  function load() {
    setProspects(null); setErreur(null);
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (q) params.set('q', q);
    if (stage) params.set('stage', stage);
    if (owner) params.set('ownerEmail', owner);
    api(`/admin/crm/prospects?${params.toString()}`, { token, withHeaders: true })
      .then(({ data, headers }) => { const rows = data?.rows || (Array.isArray(data) ? data : []); setProspects(rows); setTotal(totalDepuisEntetes(headers, rows) || data?.total || rows.length); })
      .catch((e) => setErreur(e.message));
  }
  useEffect(load, [q, stage, owner, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [q, stage, owner]);

  useEffect(() => {
    setStats(null);
    const params = new URLSearchParams();
    params.set('period', periodType);
    if (periodType === 'month') params.set('month', month);
    else params.set('year', year);
    api(`/admin/crm/stats?${params.toString()}`, { token }).then(setStats).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, month, year]);

  const owners = useMemo(() => [...new Set([...(admins || []).map((a) => a.email), ...(prospects || []).map((p) => p.ownerEmail)].filter(Boolean))].sort(), [prospects, admins]);
  const filtered = (prospects || []).filter((p) => (!priorite || p.priority === priorite) && (!relanceRetard || relanceEnRetard(p)));
  const linkedRestaurantIds = useMemo(() => new Set((prospects || []).filter((p) => p.convertedRestaurantId).map((p) => p.convertedRestaurantId)), [prospects]);

  async function changeStage(prospect, nouvelleEtape) {
    if (nouvelleEtape === 'perdu') { setPendingLoss({ id: prospect.id, name: prospect.name }); return; }
    try {
      await api(`/admin/crm/prospects/${prospect.id}/stage`, { method: 'PATCH', token, body: { stage: nouvelleEtape } });
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmLoss(lossReason) {
    try {
      await api(`/admin/crm/prospects/${pendingLoss.id}/stage`, { method: 'PATCH', token, body: { stage: 'perdu', lossReason } });
      setPendingLoss(null);
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  function exportCsv() {
    if (!filtered.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`prospects-${Date.now()}.csv`, filtered, [
      { label: tr('adminCommon.name'), get: (p) => p.name }, { label: tr('adminCommon.commune'), get: (p) => p.commune || '' }, { label: tr('adminCommon.cuisine'), get: (p) => p.cuisine || '' },
      { label: tr('adminCrm.colStage'), get: (p) => p.stage }, { label: tr('adminCommon.priority'), get: (p) => p.priority }, { label: tr('adminCrm.colOwner'), get: (p) => p.ownerEmail || '' },
      { label: tr('adminCrm.contact'), get: (p) => p.contactName || '' }, { label: tr('adminCommon.email'), get: (p) => p.contactEmail || '' }, { label: tr('adminCommon.phone'), get: (p) => p.contactPhone || '' },
      { label: tr('adminCrm.source'), get: (p) => p.source || '' }, { label: tr('adminCrm.colNextFollowUp'), get: (p) => (p.nextFollowUpAt ? fmtDate(p.nextFollowUpAt) : '') }, { label: tr('adminCrm.colCreated'), get: (p) => (p.createdAt ? fmtDate(p.createdAt) : '') }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="crm" actions={
        <>
          <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={[{ key: 'kanban', icon: '▦', label: tr('adminKanban.kanban') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }]} />
          <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          <button className="btn-teal" onClick={() => setShowCreate(true)}>{tr('adminCrm.newProspectBtn')}</button>
        </>
      } />

      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0 }}>
          {periodTypes(tr).map((p) => <div key={p.key} className={`chip${periodType === p.key ? ' active' : ''}`} onClick={() => setPeriodType(p.key)}>{p.label}</div>)}
        </div>
        {periodType === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 160 }} />}
        {periodType === 'year' && <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 100 }} />}
      </div>

      {!stats && <SkeletonCards count={1} />}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{pct(stats.conversionRate, 1)}</div><div className="label">{tr('adminCrm.conversionRate')}</div></div>
          <div className="stat-card"><div className="num">{stats.avgDaysToConversion !== null ? `${stats.avgDaysToConversion} j` : '—'}</div><div className="label">{tr('adminCrm.avgTimeToSign')}</div></div>
          <div className="stat-card"><div className="num">{stats.converted}</div><div className="label">{tr('adminCrm.newPartners')}</div></div>
          <div className="stat-card"><div className="num">{stats.newProspects}</div><div className="label">{tr('adminCrm.newProspects')}</div></div>
        </div>
      )}

      {stats && stats.byOwner.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('adminCrm.salesPerformance')}</h3>
          {stats.byOwner.map((o) => (
            <div key={o.ownerEmail} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
              <span className="small">{o.ownerEmail}</span>
              <span className="small">{tr('adminCrm.convertedOf', { converted: o.converted, total: o.total })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-control-panel">
        <input placeholder={tr('adminCrm.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">{tr('adminCrm.allStages')}</option>
          {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
        </select>
        <select value={priorite} onChange={(e) => setPriorite(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">{tr('adminCommon.allPriorities')}</option>
          {Object.entries(CRM_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">{tr('adminCrm.allOwners')}</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={relanceRetard} onChange={(e) => setRelanceRetard(e.target.checked)} /> {tr('adminCrm.filterFollowUpOverdue')}
        </label>
        <ResultCount n={filtered.length} total={total} />
      </div>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!prospects && !erreur && <SkeletonCards count={4} />}
      {prospects && filtered.length === 0 && <div className="empty">{tr('adminKanban.empty')}</div>}
      {prospects && mode === 'table' && filtered.length > 0 && (
        <AdminDataTable
          columns={[
            { key: 'name', label: tr('adminCommon.name'), get: (p) => <b>{p.name}</b>, sortValue: (p) => p.name },
            { key: 'commune', label: tr('adminCommon.commune'), get: (p) => p.commune || '—' },
            { key: 'cuisine', label: tr('adminCommon.cuisine'), get: (p) => p.cuisine || '—' },
            { key: 'stage', label: tr('adminCrm.colStage'), get: (p) => <span className="pill teal">{CRM_STAGE_LABELS[p.stage]}</span>, sortValue: (p) => CRM_STAGES.indexOf(p.stage) },
            { key: 'priority', label: tr('adminCommon.priority'), get: (p) => <span style={{ color: CRM_PRIORITY_LABELS[p.priority]?.color }}>{CRM_PRIORITY_LABELS[p.priority]?.label}</span>, sortValue: (p) => ({ low: 0, medium: 1, high: 2 }[p.priority] ?? 0) },
            { key: 'ownerEmail', label: tr('adminCrm.colOwner'), get: (p) => p.ownerEmail || '—' },
            { key: 'nextFollowUpAt', label: tr('adminCrm.colNextFollowUp'), get: (p) => (p.nextFollowUpAt ? <span style={{ color: relanceEnRetard(p) ? 'var(--red)' : 'inherit' }}>{fmtDate(p.nextFollowUpAt)}</span> : '—'), sortValue: (p) => p.nextFollowUpAt || 9e15 },
            { key: 'createdAt', label: tr('adminCrm.colCreated'), get: (p) => (p.createdAt ? fmtDate(p.createdAt) : '—'), sortValue: (p) => p.createdAt || 0 }
          ]}
          rows={filtered} sort={sort} onSort={toggle} onRowClick={(p) => setSelectedId(p.id)} emptyLabel={tr('adminKanban.empty')}
        />
      )}
      {prospects && mode === 'kanban' && filtered.length > 0 && (
        <KanbanBoard
          columns={CRM_STAGES.filter((s) => !stage || s === stage).map((s) => ({ key: s, label: CRM_STAGE_LABELS[s], color: s === 'actif' ? '#3FB950' : s === 'perdu' ? 'var(--red)' : 'var(--iris)' }))}
          items={filtered}
          columnOf={(p) => p.stage}
          onOpen={(p) => setSelectedId(p.id)}
          onMove={(p, s) => changeStage(p, s)}
          emptyLabel={tr('adminKanban.empty')}
          renderCard={(p) => (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ display: 'inline' }}>{p.name}</b>
                <span className="small" style={{ color: CRM_PRIORITY_LABELS[p.priority]?.color }}>{CRM_PRIORITY_LABELS[p.priority]?.label}</span>
              </div>
              <div className="small">{[p.commune, p.cuisine].filter(Boolean).join(' · ')}</div>
              {p.ownerEmail && <div className="small" style={{ opacity: 0.7 }}>👤 {p.ownerEmail}</div>}
              {p.nextFollowUpAt && (
                <div className="small" style={{ color: relanceEnRetard(p) ? 'var(--red)' : 'inherit' }}>
                  {tr('adminCrm.followUpOn', { date: fmtDate(p.nextFollowUpAt) })}
                </div>
              )}
            </>
          )}
        />
      )}
      {mode === 'kanban' && prospects && filtered.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}>{tr('adminKanban.dragHint')}</p>}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {selectedId && (
        <ProspectDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} onDeleted={() => { setSelectedId(null); load(); }} onLoss={(p) => setPendingLoss({ id: p.id, name: p.name })} linkedRestaurantIds={linkedRestaurantIds} />
      )}
      {showCreate && <CreateProspectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      <ReasonDialog
        open={!!pendingLoss}
        title={pendingLoss ? tr('adminCrm.confirmLost', { name: pendingLoss.name }) : ''}
        label={tr('adminCrm.lossReason')}
        placeholder={tr('adminCrm.phLossReason')}
        confirmLabel={tr('adminCrm.markLost')}
        danger
        onConfirm={confirmLoss}
        onCancel={() => setPendingLoss(null)}
      />
    </div>
  );
}

function ChampsProspect({ form, setForm, tr }) {
  return (
    <>
      <div className="field"><label>{tr('adminCrm.restaurantName')}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.municipality')}</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCrm.cuisine')}</label><input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} /></div>
      </div>
      <div className="field"><label>{tr('adminCrm.contact')}</label><input placeholder={tr('adminCrm.phContactName')} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.email')}</label><input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.phone')}</label><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>{tr('adminCommon.priority')}</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">{tr('adminCommon.low')}</option><option value="medium">{tr('adminCommon.medium')}</option><option value="high">{tr('adminCommon.high')}</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCrm.salesOwner')}</label><AssigneeSelect value={form.ownerEmail} onChange={(v) => setForm({ ...form, ownerEmail: v })} /></div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCrm.source')}</label><input placeholder={tr('adminCrm.phSource')} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
        {form.nextFollowUpAt !== undefined && <div className="field" style={{ flex: 1 }}><label>{tr('adminCrm.nextFollowUp')}</label><input type="date" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} /></div>}
      </div>
    </>
  );
}

function CreateProspectModal({ onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', commune: '', cuisine: '', contactName: '', contactEmail: '', contactPhone: '', priority: 'medium', ownerEmail: '', source: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.name.trim()) { toast(tr('adminCrm.toastNameRequired')); return; }
    setSaving(true);
    try {
      await api('/admin/crm/prospects', { method: 'POST', token, body: form });
      toast(tr('adminCrm.toastCreated'));
      onCreated();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <RecordDrawer title={tr('adminCrm.newProspect')} onClose={onClose} width={520}
      footer={<div className="row" style={{ gap: 8 }}><button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.create')}</button><button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button></div>}>
      <ChampsProspect form={form} setForm={setForm} tr={tr} />
    </RecordDrawer>,
    document.body
  );
}

// Fiche prospect dans le tiroir commun : Infos (coordonnées, étape, actions), Suivi (tâches, relance,
// conversion) et Notes (notes internes, historique des actions).
function ProspectDrawer({ id, onClose, onChanged, onDeleted, onLoss, linkedRestaurantIds }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [notes, setNotes] = useState(null);
  const [actions, setActions] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [restaurants, setRestaurants] = useState(null);
  const [convertRestaurantId, setConvertRestaurantId] = useState('');
  const [converting, setConverting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [onglet, setOnglet] = useState('infos');

  function load() {
    setErreur(null);
    api(`/admin/crm/prospects/${id}`, { token }).then(setP).catch((e) => setErreur(e.message));
    api(`/admin/notes?targetType=crm_prospect&targetId=${id}`, { token }).then(setNotes).catch(() => {});
    api(`/admin/actions?targetType=crm_prospect&targetId=${id}`, { token }).then(setActions).catch(() => {});
    api(`/admin/tasks?targetType=crm_prospect&targetId=${id}&limit=10`, { token }).then((r) => setTasks(r.rows)).catch(() => setTasks([]));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setForm({
      name: p.name, commune: p.commune || '', cuisine: p.cuisine || '', contactName: p.contactName || '',
      contactEmail: p.contactEmail || '', contactPhone: p.contactPhone || '', priority: p.priority,
      ownerEmail: p.ownerEmail || '', source: p.source || '', nextFollowUpAt: p.nextFollowUpAt ? new Date(p.nextFollowUpAt).toISOString().slice(0, 10) : ''
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/crm/prospects/${id}`, { method: 'PATCH', token, body: form });
      toast(tr('adminCrm.toastUpdated'));
      setEditing(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(stage) {
    if (stage === 'perdu') { onLoss(p); return; }
    try { await api(`/admin/crm/prospects/${id}/stage`, { method: 'PATCH', token, body: { stage } }); load(); onChanged(); } catch (e) { toast(e.message); }
  }

  function openConvert() {
    setShowConvert(true);
    if (!restaurants) api('/admin/restaurants?limit=1000&sort=name', { token }).then((l) => setRestaurants(Array.isArray(l) ? l : [])).catch((e) => toast(e.message));
  }

  async function convert() {
    if (!convertRestaurantId) { toast(tr('adminCommon.toastChooseRestaurant')); return; }
    setConverting(true);
    try {
      await api(`/admin/crm/prospects/${id}/convert`, { method: 'POST', token, body: { restaurantId: convertRestaurantId } });
      toast(tr('adminCrm.toastConverted'));
      setShowConvert(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setConverting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/admin/crm/prospects/${id}`, { method: 'DELETE', token });
      toast(tr('adminCrm.toastDeleted'));
      onDeleted();
    } catch (e) { toast(e.message); } finally { setDeleting(false); setConfirmDelete(false); }
  }

  return createPortal(
    <RecordDrawer
      title={p?.name || '…'}
      subtitle={p ? [p.commune, p.cuisine].filter(Boolean).join(' · ') : ''}
      badge={p ? <span className="pill teal">{CRM_STAGE_LABELS[p.stage]}</span> : null}
      tabs={[
        { key: 'infos', label: tr('adminCrm.tabInfos') },
        { key: 'suivi', label: tr('adminCrm.tabFollowUp'), count: tasks ? tasks.length : null },
        { key: 'notes', label: tr('adminCommon.notes'), count: notes ? notes.length : null }
      ]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={620}
    >
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!p && !erreur && <div className="small">{tr('adminCommon.loading')}</div>}
      {p && onglet === 'infos' && !editing && (
        <>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminCrm.contactLine', { name: p.contactName || '—', email: p.contactEmail ? ` · ${p.contactEmail}` : '', phone: p.contactPhone ? ` · ${p.contactPhone}` : '' })}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminCrm.priorityLine', { priority: CRM_PRIORITY_LABELS[p.priority]?.label, owner: p.ownerEmail || '—', source: p.source || '—' })}</p>
          {p.nextFollowUpAt && <p className="small" style={{ margin: '2px 0', color: relanceEnRetard(p) ? 'var(--red)' : 'inherit' }}>{tr('adminCrm.nextFollowUpLine', { date: fmtDate(p.nextFollowUpAt) })}</p>}
          {p.stage === 'perdu' && p.lossReason && <p className="small" style={{ margin: '2px 0', color: 'var(--red)' }}>{tr('adminCrm.lossReasonLine', { reason: p.lossReason })}</p>}
          {p.convertedRestaurantId && <p className="small" style={{ margin: '2px 0' }}>{tr('adminCrm.convertedLine', { name: p.convertedRestaurantName, date: fmtDate(p.convertedAt) })} · <Link to="/admin/restaurants" state={{ presetSearch: p.convertedRestaurantName }} className="admin-record-link">→ {tr('adminCommon.restaurant')}</Link></p>}
          <p className="small" style={{ margin: '2px 0', opacity: 0.6 }}>{tr('adminCrm.createdOn', { date: fmtDate(p.createdAt) })}</p>
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCrm.colStage')}</h4>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {CRM_STAGES.map((s) => <button key={s} type="button" className={s === p.stage ? 'btn-teal' : 'btn-outline'} style={{ padding: '4px 10px', fontSize: 12 }} disabled={s === p.stage} onClick={() => changeStage(s)}>{CRM_STAGE_LABELS[s]}</button>)}
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
            {!p.convertedRestaurantId && <button className="btn-teal" onClick={openConvert}>{tr('adminCrm.convert')}</button>}
            <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDelete(true)}>{tr('adminCommon.delete')}</button>
          </div>
        </>
      )}
      {p && onglet === 'infos' && editing && form && (
        <div>
          <ChampsProspect form={form} setForm={setForm} tr={tr} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      {p && onglet === 'suivi' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <CreateTaskButton targetType="crm_prospect" targetId={id} label={p.name} />
            <Link to={`/admin/tasks?q=${encodeURIComponent(p.name)}`} className="admin-record-link">→ {tr('adminCommon.tasks')}</Link>
          </div>
          <h4 className="drawer-section-title">{tr('adminCommon.tasks')}</h4>
          {!tasks && <div className="small">{tr('adminCommon.loading')}</div>}
          {tasks && tasks.length === 0 && <div className="small">{tr('adminCommon.noTasks')}</div>}
          {tasks && tasks.map((tk) => (
            <DrawerRow key={tk.id} label={<Link to={`/admin/tasks?id=${tk.id}`} className="admin-record-link">{tk.title}</Link>} value={<span style={{ color: TASK_STATUS_LABELS[tk.status]?.color }}>{TASK_STATUS_LABELS[tk.status]?.label}{tk.dueAt ? ` · ${fmtDateTime(tk.dueAt)}` : ''}</span>} />
          ))}
          <div className="divider" />
          <DrawerRow label={tr('adminCrm.nextFollowUp')} value={p.nextFollowUpAt ? fmtDate(p.nextFollowUpAt) : '—'} strong />
          <DrawerRow label={tr('adminCrm.colOwner')} value={p.ownerEmail || '—'} />
        </>
      )}
      {p && onglet === 'notes' && (
        <>
          <AdminNotesPanel targetType="crm_prospect" targetId={id} notes={notes} onAdded={load} showChannel />
          <div className="divider" />
          <AdminActionHistory actions={actions} />
        </>
      )}

      {showConvert && createPortal(
        <div className="modal-overlay" onClick={() => setShowConvert(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>{tr('adminCrm.convert')}</h3>
            <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCrm.chooseRealRestaurant')}</p>
            <select value={convertRestaurantId} onChange={(e) => setConvertRestaurantId(e.target.value)}>
              <option value="">{tr('adminCommon.choose')}</option>
              {restaurants && restaurants.filter((r) => !linkedRestaurantIds.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowConvert(false)}>{tr('adminCommon.cancel')}</button>
              <button className="btn-gold" disabled={converting || !convertRestaurantId} onClick={convert}>{converting ? '...' : tr('adminCrm.convertShort')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog open={confirmDelete} title={p ? tr('adminCrm.confirmDelete', { name: p.name }) : ''} message={tr('adminCrm.deleteBody')} danger loading={deleting} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </RecordDrawer>,
    document.body
  );
}
