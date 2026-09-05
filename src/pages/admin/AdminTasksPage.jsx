import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
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

export default function AdminTasksPage() {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [due, setDue] = useState('');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [qInput, setQInput] = useState(location.state?.presetSearch || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useViewMode('tasks');
  const [showCreate, setShowCreate] = useState(() => new URLSearchParams(location.search).get('new') === '1');

  function loadOverview() {
    api('/admin/tasks/overview', { token }).then(setOverview).catch((e) => toast(e.message));
  }
  useEffect(loadOverview, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setData(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (due) params.set('due', due);
    if (myTasksOnly && user?.email) params.set('assignedToEmail', user.email);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/tasks?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [status, priority, due, myTasksOnly, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, priority, due, myTasksOnly, q]);

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

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`taches-${Date.now()}.csv`, data.rows, [
      { label: 'Titre', get: (t) => t.title }, { label: tr('adminCommon.priority'), get: (t) => t.priority }, { label: 'Statut', get: (t) => t.status },
      { label: 'Responsable', get: (t) => t.assignedToEmail || '' }, { label: 'Échéance', get: (t) => (t.dueAt ? fmtDateTime(t.dueAt) : '') },
      { label: tr('adminTasks.linkedRecord'), get: (t) => (t.targetType ? `${TASK_TARGET_TYPE_LABELS[t.targetType]} ${t.targetName || ''}` : '') },
      { label: tr('adminTasks.createdOn'), get: (t) => fmtDateTime(t.createdAt) }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="tasks" />

      {!overview && <SkeletonCards count={1} />}
      {overview && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{overview.total}</div><div className="label">{tr('adminCommon.tasks')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: overview.overdue > 0 ? 'var(--red)' : 'inherit' }}>{overview.overdue}</div><div className="label">{tr('adminCommon.late')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: overview.dueSoon > 0 ? 'var(--gold-deep)' : 'inherit' }}>{overview.dueSoon}</div><div className="label">{tr('adminTasks.dueWithin', { n: overview.dueSoonHours })}</div></div>
          <div className="stat-card"><div className="num">{overview.todo}</div><div className="label">{tr('adminTasks.todo')}</div></div>
          <div className="stat-card"><div className="num">{overview.inProgress}</div><div className="label">{tr('adminTasks.inProgress')}</div></div>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder={tr('adminCommon.phSearchTitle')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria'), list: tr('adminKanban.list'), kanban: tr('adminKanban.kanban') }} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button className="btn-teal" onClick={() => setShowCreate(true)}>{tr('adminTasks.newTaskBtn')}</button>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={myTasksOnly} onChange={(e) => setMyTasksOnly(e.target.checked)} /> {tr('adminTasks.myTasks')}
        </label>
      </div>

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminTasks.noneForFilter')}</div>}
      {data && mode === 'kanban' && (
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
      {data && mode === 'list' && data.rows.map((t) => (
        <div className="card order-card-clickable" key={t.id} onClick={() => setSelectedId(t.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
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
            {t.targetType && ` · ${TASK_TARGET_TYPE_LABELS[t.targetType]} ${t.targetName || ''}`}
            {t.assignedToEmail && tr('adminTasks.assignedSuffix', { email: t.assignedToEmail })}
          </div>
          {t.dueAt && <div className="small" style={{ opacity: 0.6 }}>{tr('adminTasks.dueOn', { date: fmtDateTime(t.dueAt) })}</div>}
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE), n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}

      {selectedId && <TaskDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={refreshAll} />}
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
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 10px' }}>{tr('adminCommon.newTask')}</h3>
        <div className="field"><label>{tr('adminCommon.title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
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
        <div className="field"><label>{tr('adminCommon.ownerOptional')}</label><input value={assignedToEmail} onChange={(e) => setAssignedToEmail(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.create')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TaskDetailModal({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    api(`/admin/tasks/${id}`, { token }).then(setT).catch((e) => toast(e.message));
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

  async function remove() {
    try {
      await api(`/admin/tasks/${id}`, { method: 'DELETE', token });
      toast(tr('adminTasks.toastDeleted'));
      onChanged();
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmDelete(false);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {!t && <div className="small">{tr('adminCommon.loading')}</div>}
        {t && !editing && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: '0 0 8px' }}>{t.title}</h3>
              <span className="pill" style={{ color: TASK_STATUS_LABELS[t.status]?.color }}>{TASK_STATUS_LABELS[t.status]?.label}</span>
            </div>
            <p className="small" style={{ margin: '2px 0' }}><span style={{ color: TASK_PRIORITY_LABELS[t.priority]?.color }}>{TASK_PRIORITY_LABELS[t.priority]?.label}</span>{t.assignedToEmail ? tr('adminTasks.assignedSuffix', { email: t.assignedToEmail }) : ''}</p>
            {t.targetType && <p className="small" style={{ margin: '2px 0' }}>{tr('adminTasks.linkedTo', { type: TASK_TARGET_TYPE_LABELS[t.targetType], name: t.targetName || '' })}</p>}
            {t.dueAt && <p className="small" style={{ margin: '2px 0', color: t.dueState === 'overdue' ? 'var(--red)' : t.dueState === 'due_soon' ? 'var(--gold-deep)' : 'inherit' }}>{tr('adminTasks.dueOn', { date: fmtDateTime(t.dueAt) })}</p>}
            {t.notes && <p className="small" style={{ margin: '6px 0' }}>{t.notes}</p>}
            <p className="small" style={{ margin: '2px 0', opacity: 0.6 }}>{tr('adminTasks.createdBy', { email: t.createdByEmail, date: fmtDate(t.createdAt) })}</p>
            {t.completedAt && <p className="small" style={{ margin: '2px 0' }}>{tr('adminTasks.completedOn', { date: fmtDateTime(t.completedAt) })}</p>}

            <div className="divider" />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
              {TASK_STATUSES.filter((s) => s !== t.status).map((s) => (
                <button key={s} className="btn-outline" onClick={() => changeStatus(s)}>{TASK_STATUS_LABELS[s].label}</button>
              ))}
              <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>{tr('adminCommon.delete')}</button>
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
            <div className="field"><label>{tr('adminCommon.owner')}</label><input value={form.assignedToEmail} onChange={(e) => setForm({ ...form, assignedToEmail: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={tr('adminCommon.confirmDeleteTask')}
        message={tr('adminCommon.irreversible')}
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>,
    document.body
  );
}
