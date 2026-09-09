import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AssigneeSelect from '../../components/admin/AssigneeSelect';
import { ErrorCard, Pager, RecordLink, ResultCount, SelectBox, SelectionBar, selectionColumn, useSelection } from '../../components/admin/AdminListTools';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  fmtDate, fmtDateTime, useDebouncedValue, downloadCsv,
  TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, TASK_DUE_STATE_LABELS, TASK_TARGET_TYPE_LABELS
} from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 25;
const MODES = (tr) => [{ key: 'list', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }, { key: 'kanban', icon: '▦', label: tr('adminKanban.kanban') }];

// Lien vers la fiche à laquelle la tâche est rattachée (commande, restaurant, livreur, prospect…).
function LienCible({ t }) {
  if (!t.targetType) return null;
  return <RecordLink type={t.targetType} id={t.targetId} name={t.targetName} label={`${TASK_TARGET_TYPE_LABELS[t.targetType] || t.targetType} ${t.targetName || ''}`.trim()} />;
}

export default function AdminTasksPage() {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState('');
  const [due, setDue] = useState(searchParams.get('due') || '');
  const [assignee, setAssignee] = useState('');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [qInput, setQInput] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  // `?id=` (lien depuis la page Carte, une fiche prospect…) ouvre directement la tâche.
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);
  const [mode, setMode] = useViewMode('tasks');
  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1');
  const { sort, toggle } = useTableSort('dueAt', 'asc');
  const sel = useSelection(data?.rows);
  const [bulk, setBulk] = useState(null); // { type: 'done' | 'assign', email? }
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkEmail, setBulkEmail] = useState('');

  function loadOverview() {
    api('/admin/tasks/overview', { token }).then(setOverview).catch((e) => toast(e.message));
  }
  useEffect(loadOverview, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (searchParams.get('id') || searchParams.get('new')) { const next = Object.fromEntries([...searchParams.entries()]); delete next.id; delete next.new; setSearchParams(next, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setData(null); setErreur(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (due) params.set('due', due);
    if (myTasksOnly && user?.email) params.set('assignedToEmail', user.email);
    else if (assignee) params.set('assignedToEmail', assignee);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/tasks?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }
  useEffect(load, [status, priority, due, myTasksOnly, assignee, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, priority, due, myTasksOnly, assignee, q]);

  function refreshAll() { load(); loadOverview(); }

  async function quickComplete(t, e) {
    e.stopPropagation();
    try {
      await api(`/admin/tasks/${t.id}/status`, { method: 'PATCH', token, body: { status: 'fait' } });
      refreshAll();
    } catch (err) {
      toast(err.message);
    }
  }

  // Actions groupées (POST /admin/tasks/bulk { ids, status? | assignedTo? }).
  async function runBulk() {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      const body = { ids: sel.ids };
      if (bulk.type === 'done') body.status = 'fait';
      if (bulk.type === 'assign') body.assignedTo = bulk.email || null;
      const r = await api('/admin/tasks/bulk', { method: 'POST', token, body });
      toast(tr('adminCommon.bulkDone', { n: r?.updated ?? sel.count }));
      sel.clear(); refreshAll();
    } catch (e) { toast(e.message); } finally { setBulkBusy(false); setBulk(null); }
  }

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`taches-${Date.now()}.csv`, data.rows, [
      { label: tr('adminCommon.title'), get: (t) => t.title }, { label: tr('adminCommon.priority'), get: (t) => t.priority }, { label: tr('adminCommon.status'), get: (t) => t.status },
      { label: tr('adminCommon.owner'), get: (t) => t.assignedToEmail || '' }, { label: tr('adminCommon.dueDate'), get: (t) => (t.dueAt ? fmtDateTime(t.dueAt) : '') },
      { label: tr('adminTasks.linkedRecord'), get: (t) => (t.targetType ? `${TASK_TARGET_TYPE_LABELS[t.targetType]} ${t.targetName || ''}` : '') },
      { label: tr('adminTasks.createdOn'), get: (t) => fmtDateTime(t.createdAt) }
    ]);
  }

  const colonnes = [
    selectionColumn(sel, tr('adminCommon.select')),
    { key: 'title', label: tr('adminCommon.title'), get: (t) => <b>{t.title}</b>, sortValue: (t) => t.title },
    { key: 'status', label: tr('adminCommon.status'), get: (t) => <span className="pill" style={{ color: TASK_STATUS_LABELS[t.status]?.color }}>{TASK_STATUS_LABELS[t.status]?.label}</span>, sortValue: (t) => TASK_STATUSES.indexOf(t.status) },
    { key: 'priority', label: tr('adminCommon.priority'), get: (t) => <span style={{ color: TASK_PRIORITY_LABELS[t.priority]?.color }}>{TASK_PRIORITY_LABELS[t.priority]?.label}</span>, sortValue: (t) => ({ low: 0, medium: 1, high: 2 }[t.priority] ?? 0) },
    { key: 'dueAt', label: tr('adminCommon.dueDate'), get: (t) => (t.dueAt ? <span style={{ color: t.dueState === 'overdue' ? 'var(--red)' : t.dueState === 'due_soon' ? 'var(--gold-deep)' : 'inherit' }}>{fmtDateTime(t.dueAt)}</span> : '—'), sortValue: (t) => t.dueAt || 9e15 },
    { key: 'assignedToEmail', label: tr('adminCommon.owner'), get: (t) => t.assignedToEmail || '—', sortValue: (t) => t.assignedToEmail || '' },
    { key: 'target', label: tr('adminTasks.linkedRecord'), get: (t) => (t.targetType ? <LienCible t={t} /> : '—'), sortValue: (t) => `${t.targetType || ''} ${t.targetName || ''}` },
    { key: 'createdAt', label: tr('adminTasks.createdOn'), get: (t) => fmtDate(t.createdAt), sortValue: (t) => t.createdAt }
  ];

  return (
    <div>
      <AdminPageHeader module="tasks" actions={
        <>
          <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} />
          <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          <button className="btn-teal" onClick={() => setShowCreate(true)}>{tr('adminTasks.newTaskBtn')}</button>
        </>
      } />

      {!overview && <SkeletonCards count={1} />}
      {overview && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{overview.total}</div><div className="label">{tr('adminCommon.tasks')}</div></div>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setDue('overdue')}><div className="num" style={{ color: overview.overdue > 0 ? 'var(--red)' : 'inherit' }}>{overview.overdue}</div><div className="label">{tr('adminCommon.late')}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setDue('due_soon')}><div className="num" style={{ color: overview.dueSoon > 0 ? 'var(--gold-deep)' : 'inherit' }}>{overview.dueSoon}</div><div className="label">{tr('adminTasks.dueWithin', { n: overview.dueSoonHours })}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setStatus('a_faire')}><div className="num">{overview.todo}</div><div className="label">{tr('adminTasks.todo')}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setStatus('en_cours')}><div className="num">{overview.inProgress}</div><div className="label">{tr('adminTasks.inProgress')}</div></button>
        </div>
      )}

      <div className="admin-control-panel">
        <input placeholder={tr('adminCommon.phSearchTitle')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <ResultCount n={data?.rows?.length || 0} total={data?.total} />
      </div>
      <div className="admin-control-panel">
        <div className="role-pick" style={{ margin: 0, flexWrap: 'wrap' }}>
          {[{ key: '', label: tr('adminTasks.allStatuses') }, ...TASK_STATUSES.map((s) => ({ key: s, label: TASK_STATUS_LABELS[s].label }))].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">{tr('adminCommon.allPriorities')}</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="role-pick" style={{ margin: 0 }}>
          {[{ key: '', label: tr('adminTasks.allDue') }, { key: 'overdue', label: tr('adminTasks.overdueF') }, { key: 'due_soon', label: tr('adminTasks.dueSoonF') }].map((f) => (
            <div key={f.key || 'all'} className={`chip${due === f.key ? ' active' : ''}`} onClick={() => setDue(f.key)}>{f.label}</div>
          ))}
        </div>
        <AssigneeSelect value={assignee} onChange={(v) => { setAssignee(v); if (v) setMyTasksOnly(false); }} emptyLabel={tr('adminTasks.allAssignees')} style={{ maxWidth: 220 }} />
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={myTasksOnly} onChange={(e) => { setMyTasksOnly(e.target.checked); if (e.target.checked) setAssignee(''); }} /> {tr('adminTasks.myTasks')}
        </label>
      </div>

      <SelectionBar sel={sel}>
        <AssigneeSelect value={bulkEmail} onChange={setBulkEmail} emptyLabel={tr('adminTasks.chooseAssignee')} style={{ maxWidth: 220 }} />
        <button type="button" className="btn-outline" disabled={!bulkEmail} onClick={() => setBulk({ type: 'assign', email: bulkEmail })}>{tr('adminTasks.bulkAssign')}</button>
        <button type="button" className="btn-outline" onClick={() => setBulk({ type: 'done' })}>{tr('adminTasks.bulkDone')}</button>
      </SelectionBar>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminTasks.noneForFilter')}</div>}
      {data && mode === 'kanban' && data.rows.length > 0 && (
        <KanbanBoard
          columns={TASK_STATUSES.map((st) => ({ key: st, label: TASK_STATUS_LABELS[st].label, color: TASK_STATUS_LABELS[st].color === 'inherit' ? 'var(--line)' : TASK_STATUS_LABELS[st].color }))}
          items={data.rows}
          columnOf={(t) => t.status}
          onOpen={(t) => setSelectedId(t.id)}
          onMove={async (t, st) => { try { await api(`/admin/tasks/${t.id}/status`, { method: 'PATCH', token, body: { status: st } }); refreshAll(); } catch (err) { toast(err.message); } }}
          emptyLabel={tr('adminKanban.empty')}
          renderCard={(t) => (
            <>
              <b>{t.title}</b>
              <div className="small"><span style={{ color: TASK_PRIORITY_LABELS[t.priority]?.color }}>{TASK_PRIORITY_LABELS[t.priority]?.label}</span>{t.assignedToEmail ? ` · ${t.assignedToEmail}` : ''}</div>
              {t.dueAt && <div className="small" style={{ color: t.dueState === 'overdue' ? 'var(--red)' : undefined }}>⏰ {fmtDateTime(t.dueAt)}</div>}
            </>
          )}
        />
      )}
      {data && mode === 'table' && data.rows.length > 0 && (
        <AdminDataTable columns={colonnes} rows={data.rows} sort={sort} onSort={toggle} onRowClick={(t) => setSelectedId(t.id)} rowClassName={(t) => (sel.isSelected(t.id) ? 'is-selected' : '')} emptyLabel={tr('adminTasks.noneForFilter')} />
      )}
      {data && mode === 'list' && data.rows.map((t) => (
        <div className={`card order-card-clickable${sel.isSelected(t.id) ? ' is-selected' : ''}`} key={t.id} onClick={() => setSelectedId(t.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <SelectBox sel={sel} id={t.id} label={tr('adminCommon.select')} />
              {t.status !== 'fait' && t.status !== 'annulee' && (
                <button className="btn-outline" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => quickComplete(t, e)}>{tr('adminTasks.done')}</button>
              )}
              <b>{t.title}</b>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {t.dueState && <span className="pill" style={{ color: TASK_DUE_STATE_LABELS[t.dueState].color }}>{TASK_DUE_STATE_LABELS[t.dueState].label}</span>}
              <span className="pill" style={{ color: TASK_STATUS_LABELS[t.status]?.color }}>{TASK_STATUS_LABELS[t.status]?.label}</span>
            </div>
          </div>
          <div className="small">
            <span style={{ color: TASK_PRIORITY_LABELS[t.priority]?.color }}>{TASK_PRIORITY_LABELS[t.priority]?.label}</span>
            {t.targetType && <> · <LienCible t={t} /></>}
            {t.assignedToEmail && tr('adminTasks.assignedSuffix', { email: t.assignedToEmail })}
          </div>
          {t.dueAt && <div className="small" style={{ opacity: 0.6 }}>{tr('adminTasks.dueOn', { date: fmtDateTime(t.dueAt) })}</div>}
        </div>
      ))}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={setPage} />

      <ConfirmDialog open={!!bulk} title={bulk?.type === 'done' ? tr('adminTasks.bulkDoneTitle', { n: sel.count }) : tr('adminTasks.bulkAssignTitle', { n: sel.count, email: bulk?.email || '' })} loading={bulkBusy} onConfirm={runBulk} onCancel={() => setBulk(null)} />
      {selectedId && <TaskDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={refreshAll} />}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refreshAll(); }} />}
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim()) { toast(tr('adminCommon.toastTitleRequired')); return; }
    setSaving(true);
    try {
      await api('/admin/tasks', { method: 'POST', token, body: { title: title.trim(), notes: notes.trim() || undefined, dueAt: dueAt || undefined, priority, assignedToEmail: assignedToEmail || undefined } });
      toast(tr('adminCommon.toastTaskCreated'));
      onCreated();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <RecordDrawer title={tr('adminCommon.newTask')} onClose={onClose} width={520}
      footer={<div className="row" style={{ gap: 8 }}><button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.create')}</button><button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button></div>}>
      <div className="field"><label>{tr('adminCommon.title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="field"><label>{tr('adminCommon.notes')}</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.dueDate')}</label><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}>
          <label>{tr('adminCommon.priority')}</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">{tr('adminCommon.low')}</option><option value="medium">{tr('adminCommon.medium')}</option><option value="high">{tr('adminCommon.high')}</option>
          </select>
        </div>
      </div>
      <div className="field"><label>{tr('adminCommon.ownerOptional')}</label><AssigneeSelect value={assignedToEmail} onChange={setAssignedToEmail} /></div>
    </RecordDrawer>,
    document.body
  );
}

// Fiche tâche dans le tiroir commun : détails et fiche liée, changement de statut, réassignation,
// édition, suppression confirmée.
function TaskDrawer({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setErreur(null);
    api(`/admin/tasks/${id}`, { token }).then(setT).catch((e) => setErreur(e.message));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setForm({
      title: t.title, notes: t.notes || '', assignedToEmail: t.assignedToEmail || '',
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 16) : '', priority: t.priority
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/tasks/${id}`, { method: 'PATCH', token, body: form });
      toast(tr('adminTasks.toastUpdated'));
      setEditing(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status) {
    try {
      await api(`/admin/tasks/${id}/status`, { method: 'PATCH', token, body: { status } });
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function assign(email) {
    try { await api(`/admin/tasks/${id}`, { method: 'PATCH', token, body: { assignedToEmail: email || null } }); load(); onChanged(); } catch (e) { toast(e.message); }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/admin/tasks/${id}`, { method: 'DELETE', token });
      toast(tr('adminTasks.toastDeleted'));
      onChanged();
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false); setConfirmDelete(false);
    }
  }

  return createPortal(
    <RecordDrawer
      title={t?.title || '…'}
      subtitle={t ? `${TASK_PRIORITY_LABELS[t.priority]?.label || ''}${t.assignedToEmail ? tr('adminTasks.assignedSuffix', { email: t.assignedToEmail }) : ''}` : ''}
      badge={t ? <>{t.dueState && <span className="pill" style={{ color: TASK_DUE_STATE_LABELS[t.dueState].color }}>{TASK_DUE_STATE_LABELS[t.dueState].label}</span>}<span className="pill" style={{ color: TASK_STATUS_LABELS[t.status]?.color }}>{TASK_STATUS_LABELS[t.status]?.label}</span></> : null}
      onClose={onClose} width={560}
    >
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!t && !erreur && <div className="small">{tr('adminCommon.loading')}</div>}
      {t && !editing && (
        <>
          {t.targetType && <div className="admin-record-links"><LienCible t={t} /></div>}
          <DrawerRow label={tr('adminCommon.dueDate')} value={t.dueAt ? <span style={{ color: t.dueState === 'overdue' ? 'var(--red)' : t.dueState === 'due_soon' ? 'var(--gold-deep)' : 'inherit' }}>{fmtDateTime(t.dueAt)}</span> : '—'} strong />
          <DrawerRow label={tr('adminTasks.createdOn')} value={tr('adminTasks.createdBy', { email: t.createdByEmail, date: fmtDate(t.createdAt) })} />
          {t.completedAt && <DrawerRow label={tr('adminTasks.completedOnLabel')} value={fmtDateTime(t.completedAt)} />}
          {t.notes && <p className="small" style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{t.notes}</p>}

          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.owner')}</h4>
          <AssigneeSelect value={t.assignedToEmail || ''} onChange={assign} style={{ maxWidth: 320 }} />
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.status')}</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {TASK_STATUSES.map((s) => (
              <button key={s} className={s === t.status ? 'btn-teal' : 'btn-outline'} disabled={s === t.status} onClick={() => changeStatus(s)}>{TASK_STATUS_LABELS[s].label}</button>
            ))}
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
            <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDelete(true)}>{tr('adminCommon.delete')}</button>
          </div>
        </>
      )}
      {t && editing && form && (
        <div>
          <div className="field"><label>{tr('adminCommon.title')}</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>{tr('adminCommon.notes')}</label><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.dueDate')}</label><input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}>
              <label>{tr('adminCommon.priority')}</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">{tr('adminCommon.low')}</option><option value="medium">{tr('adminCommon.medium')}</option><option value="high">{tr('adminCommon.high')}</option>
              </select>
            </div>
          </div>
          <div className="field"><label>{tr('adminCommon.owner')}</label><AssigneeSelect value={form.assignedToEmail} onChange={(v) => setForm({ ...form, assignedToEmail: v })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={tr('adminCommon.confirmDeleteTask')}
        message={tr('adminCommon.irreversible')}
        danger
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </RecordDrawer>,
    document.body
  );
}
