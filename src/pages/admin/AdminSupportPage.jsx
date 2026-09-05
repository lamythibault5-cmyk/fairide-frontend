import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import {
  pct, fmtDateTime, downloadCsv, useDebouncedValue,
  TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUSES
} from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';

const PAGE_SIZE = 25;
const periodTypes = (tr) => [{ key: 'month', label: tr('adminCommon.month') }, { key: 'quarter', label: tr('adminCommon.quarter') }, { key: 'year', label: tr('adminCommon.year') }];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminSupportPage() {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [mine, setMine] = useState(false);
  const [qInput, setQInput] = useState(location.state?.presetSearch || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useViewMode('support');
  const [showCreate, setShowCreate] = useState(() => new URLSearchParams(location.search).get('new') === '1');

  const periodParams = new URLSearchParams();
  periodParams.set('period', periodType);
  if (periodType === 'month') periodParams.set('month', month); else periodParams.set('year', year);

  useEffect(() => {
    setStats(null);
    api(`/admin/support/stats?${periodParams.toString()}`, { token }).then(setStats).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, month, year]);

  function load() {
    setData(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (category) params.set('category', category);
    if (escalatedOnly) params.set('escalated', '1');
    if (mine && user?.email) params.set('assignedToEmail', user.email);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/support/tickets?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [status, priority, category, escalatedOnly, mine, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, priority, category, escalatedOnly, mine, q]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`tickets-${Date.now()}.csv`, data.rows, [
      { label: 'N°', get: (t) => t.ticketNumber }, { label: 'Sujet', get: (t) => t.subject },
      { label: tr('adminCommon.category'), get: (t) => TICKET_CATEGORY_LABELS[t.category] }, { label: tr('adminCommon.priority'), get: (t) => t.priority },
      { label: 'Statut', get: (t) => t.status }, { label: tr('adminSupport.assignedTo'), get: (t) => t.assignedToEmail || '' },
      { label: tr('adminSupport.requester'), get: (t) => t.requesterName || '' }, { label: 'Email', get: (t) => t.requesterEmail || '' },
      { label: tr('adminSupport.createdOn'), get: (t) => fmtDateTime(t.createdAt) }, { label: tr('adminSupport.resolvedOn'), get: (t) => (t.resolvedAt ? fmtDateTime(t.resolvedAt) : '') }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="support" />

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
          <div className="stat-card highlight"><div className="num">{stats.created}</div><div className="label">{tr('adminSupport.ticketsCreated')}</div></div>
          <div className="stat-card"><div className="num">{stats.resolved}</div><div className="label">{tr('adminSupport.ticketsResolved')}</div></div>
          <div className="stat-card"><div className="num">{pct(stats.resolutionRate, 0)}</div><div className="label">{tr('adminSupport.resolutionRate')}</div></div>
          <div className="stat-card"><div className="num">{stats.avgResolutionHours !== null ? `${stats.avgResolutionHours} h` : '—'}</div><div className="label">{tr('adminSupport.avgResolutionTime')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: stats.slaBreached > 0 ? 'var(--red)' : 'inherit' }}>{stats.slaBreached}</div><div className="label">{tr('adminSupport.slaBreached')}</div></div>
        </div>
      )}
      {stats && stats.byCategory.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('adminSupport.topCategories')}</h3>
          {stats.byCategory.map((c) => (
            <div key={c.category} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
              <span className="small">{TICKET_CATEGORY_LABELS[c.category]}</span>
              <span className="small">{c.total}</span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder={tr('adminSupport.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria'), list: tr('adminKanban.list'), kanban: tr('adminKanban.kanban') }} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button className="btn-teal" onClick={() => setShowCreate(true)}>{tr('adminSupport.newTicketBtn')}</button>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0, flexWrap: 'wrap' }}>
          {[{ key: '', label: tr('adminSupport.allStatuses') }, ...TICKET_STATUSES.map((s) => ({ key: s, label: TICKET_STATUS_LABELS[s].label }))].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">{tr('adminCommon.allPriorities')}</option>
          {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">{tr('adminSupport.allCategories')}</option>
          {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
        </select>
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={escalatedOnly} onChange={(e) => setEscalatedOnly(e.target.checked)} /> {tr('adminSupport.escalatedOnly')}
        </label>
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {tr('adminSupport.myTickets')}
        </label>
      </div>

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminSupport.noneForFilter')}</div>}
      {data && mode === 'kanban' && (
        <KanbanBoard
          columns={TICKET_STATUSES.map((st) => ({ key: st, label: TICKET_STATUS_LABELS[st].label, color: TICKET_STATUS_LABELS[st].color === 'inherit' ? 'var(--line)' : TICKET_STATUS_LABELS[st].color }))}
          items={data.rows}
          columnOf={(t) => t.status}
          onOpen={(t) => setSelectedId(t.id)}
          onMove={async (t, st) => { try { await api(`/admin/support/tickets/${t.id}/status`, { method: 'PATCH', token, body: { status: st } }); load(); } catch (err) { toast(err.message); } }}
          emptyLabel={tr('adminKanban.empty')}
          renderCard={(t) => (
            <>
              <b>{t.subject}</b>
              <div className="small">{t.ticketNumber} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span>{t.escalated ? ' · ⚠️' : ''}</div>
              <div className="small">{t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—'}</div>
            </>
          )}
        />
      )}
      {data && mode === 'list' && data.rows.map((t) => (
        <div className="card order-card-clickable" key={t.id} onClick={() => setSelectedId(t.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{t.subject}</b>
            <div className="row" style={{ gap: 6 }}>
              {t.escalated && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminSupport.escalated')}</span>}
              <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>
            </div>
          </div>
          <div className="small">{t.ticketNumber} · {TICKET_CATEGORY_LABELS[t.category]} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span></div>
          <div className="small">{t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—'}{t.assignedToEmail ? tr('adminSupport.assignedSuffix', { email: t.assignedToEmail }) : ''}</div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(t.updatedAt)}</div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE), n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}

      {selectedId && <TicketDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ subject: '', message: '', category: 'autre', priority: 'medium', requesterName: '', requesterEmail: '', requesterPhone: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.subject.trim() || !form.message.trim()) { toast(tr('adminCommon.toastSubjectMessageRequired')); return; }
    setSaving(true);
    try {
      const t = await api('/admin/support/tickets', { method: 'POST', token, body: form });
      toast(tr('adminSupport.toastCreated', { n: t.ticketNumber }));
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
        <h3 style={{ margin: '0 0 10px' }}>{tr('adminCommon.newTicket')}</h3>
        <div className="field"><label>{tr('adminCommon.subject')}</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div className="field"><label>{tr('adminCommon.message')}</label><textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{tr('adminCommon.category')}</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{tr('adminCommon.priority')}</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>{tr('adminSupport.requesterName')}</label><input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.email')}</label><input value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.phone')}</label><input value={form.requesterPhone} onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.create')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TicketDetailModal({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [notes, setNotes] = useState(null);
  const [actions, setActions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [cannedReplies, setCannedReplies] = useState(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCannedManager, setShowCannedManager] = useState(false);

  function load() {
    api(`/admin/support/tickets/${id}`, { token }).then(setT).catch((e) => toast(e.message));
    api(`/admin/notes?targetType=ticket&targetId=${id}`, { token }).then(setNotes).catch(() => {});
    api(`/admin/actions?targetType=ticket&targetId=${id}`, { token }).then(setActions).catch(() => {});
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  function loadCannedReplies() {
    api('/admin/support/canned-replies', { token }).then(setCannedReplies).catch(() => {});
  }
  useEffect(loadCannedReplies, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setForm({ subject: t.subject, category: t.category, priority: t.priority, assignedToEmail: t.assignedToEmail || '', tags: (t.tags || []).join(', ') });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/support/tickets/${id}`, { method: 'PATCH', token, body: { ...form, tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean) } });
      toast(tr('adminSupport.toastUpdated'));
      setEditing(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status) {
    if (status === 'resolu') { setShowResolve(true); return; }
    try {
      await api(`/admin/support/tickets/${id}/status`, { method: 'PATCH', token, body: { status } });
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmResolve() {
    try {
      await api(`/admin/support/tickets/${id}/status`, { method: 'PATCH', token, body: { status: 'resolu', resolutionNote: resolutionNote.trim() || undefined } });
      setShowResolve(false); setResolutionNote('');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmEscalate() {
    if (!escalateReason.trim()) { toast(tr('adminCommon.toastReasonRequired')); return; }
    try {
      await api(`/admin/support/tickets/${id}/escalate`, { method: 'PATCH', token, body: { escalated: true, reason: escalateReason.trim() } });
      setShowEscalate(false); setEscalateReason('');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function deescalate() {
    try {
      await api(`/admin/support/tickets/${id}/escalate`, { method: 'PATCH', token, body: { escalated: false } });
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api(`/admin/support/tickets/${id}/reply`, { method: 'POST', token, body: { text: replyText.trim() } });
      toast(tr('adminSupport.toastReplySent'));
      setReplyText('');
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setSending(false);
    }
  }

  async function uploadAttachment(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await apiUpload(`/admin/support/tickets/${id}/attachments`, { file, token, fieldName: 'file' });
      load();
    } catch (err) {
      toast(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removeAttachment(attachmentId) {
    try {
      await api(`/admin/support/tickets/${id}/attachments/${attachmentId}`, { method: 'DELETE', token });
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        {!t && <div className="small">{tr('adminCommon.loading')}</div>}
        {t && !editing && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 4px' }}>{t.subject}</h3>
              <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>
            </div>
            <p className="small" style={{ margin: '2px 0', fontFamily: 'monospace' }}>{t.ticketNumber}</p>
            <p className="small" style={{ margin: '2px 0' }}>{TICKET_CATEGORY_LABELS[t.category]} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span>{t.assignedToEmail ? tr('adminSupport.assignedSuffix', { email: t.assignedToEmail }) : ''}</p>
            {t.slaDueAt && <p className="small" style={{ margin: '2px 0', color: !t.resolvedAt && t.slaDueAt < Date.now() ? 'var(--red)' : 'inherit' }}>{tr('adminSupport.slaLine', { due: fmtDateTime(t.slaDueAt), first: t.firstResponseAt ? tr('adminSupport.firstReplySuffix', { date: fmtDateTime(t.firstResponseAt) }) : '' })}</p>}
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminSupport.requesterLine', { name: t.requesterName || '—', email: t.requesterEmail ? ` · ${t.requesterEmail}` : '', phone: t.requesterPhone ? ` · ${t.requesterPhone}` : '' })}</p>
            {(t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || t.linkedOrderId) && (
              <p className="small" style={{ margin: '2px 0' }}>
                {tr('adminSupport.linkedLine', { list: [t.linkedClientName && tr('adminSupport.linkedClient', { name: t.linkedClientName }), t.linkedDriverName && tr('adminSupport.linkedDriver', { name: t.linkedDriverName }), t.linkedRestaurantName && tr('adminSupport.linkedRestaurant', { name: t.linkedRestaurantName }), t.linkedOrderId && tr('adminSupport.linkedOrder', { id: t.linkedOrderId.slice(0, 8) })].filter(Boolean).join(' · ') })}
              </p>
            )}
            {t.tags.length > 0 && <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{t.tags.map((tag) => <span key={tag} className="pill">{tag}</span>)}</div>}
            {t.escalated && <p className="small" style={{ margin: '4px 0', color: 'var(--red)' }}>{tr('adminSupport.escalatedReason', { reason: t.escalatedReason })}</p>}
            {t.resolutionNote && <p className="small" style={{ margin: '4px 0' }}>{tr('adminSupport.resolutionLine', { note: t.resolutionNote })}</p>}
            <div className="divider" />
            <div style={{ background: 'var(--cream-dim)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', fontSize: 13 }}>{t.message}</div>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminSupport.attachments')}</h4>
            {t.attachments.length === 0 && <div className="small" style={{ opacity: 0.6 }}>{tr('adminSupport.noAttachments')}</div>}
            {t.attachments.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="small">📎 {a.filename}</a>
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeAttachment(a.id)}>{tr('adminCommon.delete')}</button>
              </div>
            ))}
            <label className="btn-outline" style={{ display: 'inline-block', padding: '6px 14px', fontSize: 13, marginTop: 6, cursor: 'pointer' }}>
              {uploading ? '...' : tr('adminSupport.addAttachment')}
              <input type="file" onChange={uploadAttachment} style={{ display: 'none' }} disabled={uploading} />
            </label>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminCommon.actions')}</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
              {TICKET_STATUSES.filter((s) => s !== t.status).map((s) => (
                <button key={s} className="btn-outline" onClick={() => changeStatus(s)}>{TICKET_STATUS_LABELS[s].label}</button>
              ))}
              {!t.escalated ? <button className="btn-danger-ghost" onClick={() => setShowEscalate(true)}>{tr('adminSupport.escalate')}</button> : <button className="btn-outline" onClick={deescalate}>{tr('adminSupport.deescalate')}</button>}
              <CreateTaskButton targetType="ticket" targetId={id} label={t.subject} />
            </div>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminSupport.replyToRequester')}</h4>
            {!t.requesterEmail && <div className="small" style={{ opacity: 0.6 }}>{tr('adminSupport.noContactEmail')}</div>}
            {t.requesterEmail && (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  {cannedReplies && cannedReplies.length > 0 && (
                    <select onChange={(e) => { if (e.target.value) setReplyText(cannedReplies.find((c) => c.id === e.target.value)?.body || ''); }} defaultValue="">
                      <option value="">{tr('adminSupport.insertCanned')}</option>
                      {cannedReplies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setShowCannedManager(true)}>{tr('adminSupport.manageCanned')}</button>
                </div>
                <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={tr('adminSupport.phReply')} />
                <button className="btn-teal" style={{ marginTop: 6 }} disabled={sending || !replyText.trim()} onClick={sendReply}>{sending ? '...' : '✉️ Envoyer'}</button>
              </>
            )}

            <div className="divider" />
            <AdminNotesPanel targetType="ticket" targetId={id} notes={notes} onAdded={load} showChannel />
            <div className="divider" />
            <AdminActionHistory actions={actions} />
          </>
        )}
        {t && editing && form && (
          <div>
            <div className="field"><label>{tr('adminCommon.subject')}</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{tr('adminCommon.category')}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{tr('adminCommon.priority')}</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>{tr('adminSupport.assignedToEmail')}</label><input value={form.assignedToEmail} onChange={(e) => setForm({ ...form, assignedToEmail: e.target.value })} /></div>
            <div className="field"><label>{tr('adminSupport.tags')}</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>

      {showEscalate && createPortal(
        <div className="modal-overlay" onClick={() => setShowEscalate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>{tr('adminSupport.escalateThis')}</h3>
            <input placeholder={tr('adminSupport.phReason')} value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} autoFocus style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-danger-ghost" onClick={confirmEscalate}>{tr('adminSupport.escalate')}</button>
              <button className="btn-ghost" onClick={() => setShowEscalate(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCannedManager && (
        <CannedRepliesManager cannedReplies={cannedReplies} onChanged={loadCannedReplies} onClose={() => setShowCannedManager(false)} />
      )}

      {showResolve && createPortal(
        <div className="modal-overlay" onClick={() => setShowResolve(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>{tr('adminSupport.markResolved')}</h3>
            <input placeholder={tr('adminSupport.phResolution')} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} autoFocus style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-teal" onClick={confirmResolve}>{tr('adminSupport.markResolvedShort')}</button>
              <button className="btn-ghost" onClick={() => setShowResolve(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}

function CannedRepliesManager({ cannedReplies, onChanged, onClose }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim() || !body.trim()) { toast(tr('adminSupport.toastTitleText')); return; }
    setSaving(true);
    try {
      await api('/admin/support/canned-replies', { method: 'POST', token, body: { title: title.trim(), body: body.trim() } });
      setTitle(''); setBody('');
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await api(`/admin/support/canned-replies/${id}`, { method: 'DELETE', token });
      onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 10px' }}>{tr('adminSupport.cannedReplies')}</h3>
        {(!cannedReplies || cannedReplies.length === 0) && <div className="small" style={{ opacity: 0.6, marginBottom: 10 }}>{tr('adminSupport.noCanned')}</div>}
        {cannedReplies && cannedReplies.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--cream-dim)' }}>
            <div>
              <b className="small">{c.title}</b>
              <div className="small" style={{ opacity: 0.6 }}>{c.body.slice(0, 60)}{c.body.length > 60 ? '...' : ''}</div>
            </div>
            <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => remove(c.id)}>{tr('adminCommon.delete')}</button>
          </div>
        ))}
        <div className="divider" />
        <div className="field"><label>{tr('adminCommon.title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('adminSupport.phCannedTitle')} /></div>
        <div className="field"><label>{tr('adminSupport.text')}</label><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.addPlain')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
