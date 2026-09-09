import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import AssigneeSelect from '../../components/admin/AssigneeSelect';
import RecordDrawer from '../../components/admin/RecordDrawer';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { ErrorCard, Pager, RecordLink, ResultCount, SelectBox, SelectionBar, selectionColumn, useSelection } from '../../components/admin/AdminListTools';
import {
  pct, fmtDateTime, downloadCsv, useDebouncedValue,
  TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUSES
} from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import KanbanBoard, { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';

const PAGE_SIZE = 25;
const MODES = (tr) => [{ key: 'list', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }, { key: 'kanban', icon: '▦', label: tr('adminKanban.kanban') }];
const periodTypes = (tr) => [{ key: 'month', label: tr('adminCommon.month') }, { key: 'quarter', label: tr('adminCommon.quarter') }, { key: 'year', label: tr('adminCommon.year') }];
const slaDepasse = (t) => !!(t.slaDueAt && !t.resolvedAt && t.slaDueAt < Date.now() && !['resolu', 'ferme'].includes(t.status));

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Fiches liées à un ticket : client, livreur, restaurant, commande — chacune ouvre son application.
function LiensTicket({ t, tr }) {
  const liens = [
    t.linkedClientName || t.linkedClientId ? <RecordLink key="c" type="client" id={t.linkedClientId} name={t.linkedClientName} label={tr('adminSupport.linkedClient', { name: t.linkedClientName || '' })} /> : null,
    t.linkedDriverName || t.linkedDriverId ? <RecordLink key="d" type="driver" id={t.linkedDriverId} name={t.linkedDriverName} label={tr('adminSupport.linkedDriver', { name: t.linkedDriverName || '' })} /> : null,
    t.linkedRestaurantName || t.linkedRestaurantId ? <RecordLink key="r" type="restaurant" id={t.linkedRestaurantId} name={t.linkedRestaurantName} label={tr('adminSupport.linkedRestaurant', { name: t.linkedRestaurantName || '' })} /> : null,
    t.linkedOrderId ? <RecordLink key="o" type="order" id={t.linkedOrderId} label={tr('adminSupport.linkedOrder', { id: String(t.linkedOrderId).slice(0, 8) })} /> : null
  ].filter(Boolean);
  if (!liens.length) return null;
  return <div className="admin-record-links">{liens}</div>;
}

function Tags({ tags, actif, onPick }) {
  if (!tags || !tags.length) return null;
  return <span className="admin-tags">{tags.map((tag) => <button key={tag} type="button" className={`admin-tag${actif === tag ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onPick?.(actif === tag ? '' : tag); }}>#{tag}</button>)}</span>;
}

export default function AdminSupportPage() {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState(searchParams.get('tag') || '');
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [slaOnly, setSlaOnly] = useState(searchParams.get('sla') === '1');
  const [mine, setMine] = useState(false);
  const [qInput, setQInput] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);
  const [mode, setMode] = useViewMode('support');
  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1');
  const { sort, toggle } = useTableSort('slaDueAt', 'asc');
  const sel = useSelection(data?.rows);
  const [bulk, setBulk] = useState(null); // { type: 'close' | 'assign', email? }
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkEmail, setBulkEmail] = useState('');

  const periodParams = new URLSearchParams();
  periodParams.set('period', periodType);
  if (periodType === 'month') periodParams.set('month', month); else periodParams.set('year', year);

  useEffect(() => {
    setStats(null);
    api(`/admin/support/stats?${periodParams.toString()}`, { token }).then(setStats).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, month, year]);

  function load() {
    setData(null); setErreur(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    if (escalatedOnly) params.set('escalated', '1');
    if (mine && user?.email) params.set('assignedToEmail', user.email);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/support/tickets?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }
  useEffect(load, [status, priority, category, tag, escalatedOnly, mine, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, priority, category, tag, escalatedOnly, mine, q]);
  // Ouverture directe par l'adresse (?id=…) consommée une seule fois.
  useEffect(() => { if (searchParams.get('id')) { const next = Object.fromEntries([...searchParams.entries()]); delete next.id; setSearchParams(next, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = useMemo(() => (data?.rows || []).filter((t) => !slaOnly || slaDepasse(t)), [data, slaOnly]);
  const tagsConnus = useMemo(() => [...new Set((data?.rows || []).flatMap((t) => t.tags || []))].sort(), [data]);

  function exportCsv() {
    if (!lignes.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`tickets-${Date.now()}.csv`, lignes, [
      { label: 'N°', get: (t) => t.ticketNumber }, { label: tr('adminCommon.subject'), get: (t) => t.subject },
      { label: tr('adminCommon.category'), get: (t) => TICKET_CATEGORY_LABELS[t.category] }, { label: tr('adminCommon.priority'), get: (t) => t.priority },
      { label: tr('adminCommon.status'), get: (t) => t.status }, { label: tr('adminSupport.assignedTo'), get: (t) => t.assignedToEmail || '' },
      { label: tr('adminSupport.tags'), get: (t) => (t.tags || []).join(' ') },
      { label: tr('adminSupport.requester'), get: (t) => t.requesterName || '' }, { label: tr('adminCommon.email'), get: (t) => t.requesterEmail || '' },
      { label: tr('adminSupport.createdOn'), get: (t) => fmtDateTime(t.createdAt) }, { label: tr('adminSupport.slaCol'), get: (t) => (t.slaDueAt ? fmtDateTime(t.slaDueAt) : '') }, { label: tr('adminSupport.resolvedOn'), get: (t) => (t.resolvedAt ? fmtDateTime(t.resolvedAt) : '') }
    ]);
  }

  // Actions groupées (POST /admin/support/tickets/bulk { ids, status? | assignedToEmail? }).
  async function runBulk() {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      const body = { ids: sel.ids };
      if (bulk.type === 'close') body.status = 'ferme';
      if (bulk.type === 'assign') body.assignedToEmail = bulk.email || null;
      const r = await api('/admin/support/tickets/bulk', { method: 'POST', token, body });
      toast(tr('adminCommon.bulkDone', { n: r?.updated ?? sel.count }));
      sel.clear(); load();
    } catch (e) { toast(e.message); } finally { setBulkBusy(false); setBulk(null); }
  }

  const colonnes = [
    selectionColumn(sel, tr('adminCommon.select')),
    { key: 'ticketNumber', label: 'N°', get: (t) => <span style={{ fontFamily: 'monospace' }}>{t.ticketNumber}</span>, sortValue: (t) => t.ticketNumber },
    { key: 'subject', label: tr('adminCommon.subject'), get: (t) => <><b>{t.subject}</b>{t.escalated ? ' ⚠️' : ''}<div><Tags tags={t.tags} actif={tag} onPick={setTag} /></div></>, sortValue: (t) => t.subject },
    { key: 'status', label: tr('adminCommon.status'), get: (t) => <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>, sortValue: (t) => TICKET_STATUSES.indexOf(t.status) },
    { key: 'priority', label: tr('adminCommon.priority'), get: (t) => <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span>, sortValue: (t) => ({ low: 0, medium: 1, high: 2, urgent: 3 }[t.priority] ?? 0) },
    { key: 'category', label: tr('adminCommon.category'), get: (t) => TICKET_CATEGORY_LABELS[t.category], sortValue: (t) => t.category },
    { key: 'requester', label: tr('adminSupport.requester'), get: (t) => t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—', sortValue: (t) => t.requesterName || '' },
    { key: 'assignedToEmail', label: tr('adminSupport.assignedTo'), get: (t) => t.assignedToEmail || '—', sortValue: (t) => t.assignedToEmail || '' },
    { key: 'slaDueAt', label: tr('adminSupport.slaCol'), get: (t) => (t.slaDueAt ? <span style={{ color: slaDepasse(t) ? 'var(--red)' : 'inherit' }}>{fmtDateTime(t.slaDueAt)}{slaDepasse(t) ? ' ⚠️' : ''}</span> : '—'), sortValue: (t) => (t.resolvedAt || ['resolu', 'ferme'].includes(t.status) ? 9e15 : (t.slaDueAt || 9e15 - 1)) },
    { key: 'updatedAt', label: tr('adminCouriers.colUpdated'), get: (t) => fmtDateTime(t.updatedAt), sortValue: (t) => t.updatedAt }
  ];

  return (
    <div>
      <AdminPageHeader module="support" actions={
        <>
          <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} />
          <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          <button className="btn-teal" onClick={() => setShowCreate(true)}>{tr('adminSupport.newTicketBtn')}</button>
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
          <div className="stat-card highlight"><div className="num">{stats.created}</div><div className="label">{tr('adminSupport.ticketsCreated')}</div></div>
          <div className="stat-card"><div className="num">{stats.resolved}</div><div className="label">{tr('adminSupport.ticketsResolved')}</div></div>
          <div className="stat-card"><div className="num">{pct(stats.resolutionRate, 0)}</div><div className="label">{tr('adminSupport.resolutionRate')}</div></div>
          <div className="stat-card"><div className="num">{stats.avgResolutionHours !== null ? `${stats.avgResolutionHours} h` : '—'}</div><div className="label">{tr('adminSupport.avgResolutionTime')}</div></div>
          <button type="button" className={`stat-card${slaOnly ? ' highlight' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setSlaOnly((v) => !v)}><div className="num" style={{ color: stats.slaBreached > 0 ? 'var(--red)' : 'inherit' }}>{stats.slaBreached}</div><div className="label">{tr('adminSupport.slaBreached')}</div></button>
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

      <div className="admin-control-panel">
        <input placeholder={tr('adminSupport.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <ResultCount n={lignes.length} total={data?.total} />
      </div>
      <div className="admin-control-panel">
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
          <input type="checkbox" checked={slaOnly} onChange={(e) => setSlaOnly(e.target.checked)} /> {tr('adminSupport.slaOnly')}
        </label>
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {tr('adminSupport.myTickets')}
        </label>
      </div>
      {(tag || tagsConnus.length > 0) && (
        <div className="admin-control-panel">
          <span className="small">{tr('adminSupport.tags')} :</span>
          {tag && !tagsConnus.includes(tag) && <button type="button" className="admin-tag active" onClick={() => setTag('')}>#{tag} ✕</button>}
          <Tags tags={tagsConnus} actif={tag} onPick={setTag} />
        </div>
      )}

      <SelectionBar sel={sel}>
        <AssigneeSelect value={bulkEmail} onChange={setBulkEmail} emptyLabel={tr('adminSupport.chooseAssignee')} style={{ maxWidth: 220 }} />
        <button type="button" className="btn-outline" disabled={!bulkEmail} onClick={() => setBulk({ type: 'assign', email: bulkEmail })}>{tr('adminSupport.bulkAssign')}</button>
        <button type="button" className="btn-danger-ghost" onClick={() => setBulk({ type: 'close' })}>{tr('adminSupport.bulkClose')}</button>
      </SelectionBar>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={4} />}
      {data && lignes.length === 0 && <div className="empty">{tr('adminSupport.noneForFilter')}</div>}
      {data && mode === 'kanban' && lignes.length > 0 && (
        <KanbanBoard
          columns={TICKET_STATUSES.map((st) => ({ key: st, label: TICKET_STATUS_LABELS[st].label, color: TICKET_STATUS_LABELS[st].color === 'inherit' ? 'var(--line)' : TICKET_STATUS_LABELS[st].color }))}
          items={lignes}
          columnOf={(t) => t.status}
          onOpen={(t) => setSelectedId(t.id)}
          onMove={async (t, st) => { try { await api(`/admin/support/tickets/${t.id}/status`, { method: 'PATCH', token, body: { status: st } }); load(); } catch (err) { toast(err.message); } }}
          emptyLabel={tr('adminKanban.empty')}
          renderCard={(t) => (
            <>
              <b>{t.subject}</b>
              <div className="small">{t.ticketNumber} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span>{t.escalated ? ' · ⚠️' : ''}{slaDepasse(t) ? ` · ${tr('adminSupport.slaShort')}` : ''}</div>
              <div className="small">{t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—'}</div>
            </>
          )}
        />
      )}
      {data && mode === 'table' && lignes.length > 0 && (
        <AdminDataTable columns={colonnes} rows={lignes} sort={sort} onSort={toggle} onRowClick={(t) => setSelectedId(t.id)} rowClassName={(t) => (sel.isSelected(t.id) ? 'is-selected' : '')} emptyLabel={tr('adminSupport.noneForFilter')} />
      )}
      {data && mode === 'list' && lignes.map((t) => (
        <div className={`card order-card-clickable${sel.isSelected(t.id) ? ' is-selected' : ''}`} key={t.id} onClick={() => setSelectedId(t.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="admin-card-select"><SelectBox sel={sel} id={t.id} label={tr('adminCommon.select')} /><b>{t.subject}</b></span>
            <div className="row" style={{ gap: 6 }}>
              {slaDepasse(t) && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminSupport.slaShort')}</span>}
              {t.escalated && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminSupport.escalated')}</span>}
              <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>
            </div>
          </div>
          <div className="small">{t.ticketNumber} · {TICKET_CATEGORY_LABELS[t.category]} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span></div>
          <div className="small">{t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—'}{t.assignedToEmail ? tr('adminSupport.assignedSuffix', { email: t.assignedToEmail }) : ''}</div>
          <Tags tags={t.tags} actif={tag} onPick={setTag} />
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(t.updatedAt)}</div>
        </div>
      ))}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={setPage} />

      <ConfirmDialog open={!!bulk} title={bulk?.type === 'close' ? tr('adminSupport.bulkCloseTitle', { n: sel.count }) : tr('adminSupport.bulkAssignTitle', { n: sel.count, email: bulk?.email || '' })} message={bulk?.type === 'close' ? tr('adminSupport.bulkCloseBody') : ''} danger={bulk?.type === 'close'} loading={bulkBusy} onConfirm={runBulk} onCancel={() => setBulk(null)} />
      {selectedId && <TicketDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} onPickTag={(x) => { setTag(x); setSelectedId(null); }} />}
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ subject: '', message: '', category: 'autre', priority: 'medium', requesterName: '', requesterEmail: '', requesterPhone: '', assignedToEmail: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.subject.trim() || !form.message.trim()) { toast(tr('adminCommon.toastSubjectMessageRequired')); return; }
    setSaving(true);
    try {
      const t = await api('/admin/support/tickets', { method: 'POST', token, body: { ...form, assignedToEmail: form.assignedToEmail || undefined } });
      toast(tr('adminSupport.toastCreated', { n: t.ticketNumber }));
      onCreated();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <RecordDrawer title={tr('adminCommon.newTicket')} onClose={onClose} width={520}
      footer={<div className="row" style={{ gap: 8 }}><button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : tr('adminCommon.create')}</button><button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button></div>}>
      <div className="field"><label>{tr('adminCommon.subject')}</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} autoFocus /></div>
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
      <div className="field"><label>{tr('adminSupport.assignedTo')}</label><AssigneeSelect value={form.assignedToEmail} onChange={(v) => setForm({ ...form, assignedToEmail: v })} /></div>
      <div className="field"><label>{tr('adminSupport.requesterName')}</label><input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.email')}</label><input value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} /></div>
        <div className="field" style={{ flex: 1 }}><label>{tr('adminCommon.phone')}</label><input value={form.requesterPhone} onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })} /></div>
      </div>
    </RecordDrawer>,
    document.body
  );
}

// Fiche ticket dans le tiroir commun : Aperçu (message, fiches liées, pièces jointes), Répondre, Actions
// (statut, escalade, tâche), Suivi (notes, historique). Escalade et résolution demandent leur motif /
// note via ReasonDialog.
function TicketDrawer({ id, onClose, onChanged, onPickTag }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [notes, setNotes] = useState(null);
  const [actions, setActions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [cannedReplies, setCannedReplies] = useState(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCannedManager, setShowCannedManager] = useState(false);
  const [onglet, setOnglet] = useState('apercu');
  const [confirm, setConfirm] = useState(null);

  function load() {
    setErreur(null);
    api(`/admin/support/tickets/${id}`, { token }).then(setT).catch((e) => setErreur(e.message));
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

  async function assign(email) {
    try { await api(`/admin/support/tickets/${id}`, { method: 'PATCH', token, body: { assignedToEmail: email || null } }); load(); onChanged(); } catch (e) { toast(e.message); }
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

  async function confirmResolve(resolutionNote) {
    try {
      await api(`/admin/support/tickets/${id}/status`, { method: 'PATCH', token, body: { status: 'resolu', resolutionNote: resolutionNote || undefined } });
      setShowResolve(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmEscalate(reason) {
    try {
      await api(`/admin/support/tickets/${id}/escalate`, { method: 'PATCH', token, body: { escalated: true, reason } });
      setShowEscalate(false);
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
    <RecordDrawer
      title={t?.subject || '…'}
      subtitle={t ? `${t.ticketNumber} · ${TICKET_CATEGORY_LABELS[t.category]}${t.assignedToEmail ? tr('adminSupport.assignedSuffix', { email: t.assignedToEmail }) : ''}` : ''}
      badge={t ? <><span className="pill" style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span><span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span></> : null}
      tabs={[
        { key: 'apercu', label: tr('adminCommon.tabOverview'), count: t ? t.attachments.length : null },
        { key: 'repondre', label: tr('adminSupport.tabReply') },
        { key: 'actions', label: tr('adminCommon.tabActions') },
        { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: notes ? notes.length : null }
      ]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={640}
    >
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!t && !erreur && <div className="small">{tr('adminCommon.loading')}</div>}
      {t && onglet === 'apercu' && !editing && (
        <>
          {t.slaDueAt && <p className="small" style={{ margin: '2px 0', color: slaDepasse(t) ? 'var(--red)' : 'inherit' }}>{tr('adminSupport.slaLine', { due: fmtDateTime(t.slaDueAt), first: t.firstResponseAt ? tr('adminSupport.firstReplySuffix', { date: fmtDateTime(t.firstResponseAt) }) : '' })}</p>}
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminSupport.requesterLine', { name: t.requesterName || '—', email: t.requesterEmail ? ` · ${t.requesterEmail}` : '', phone: t.requesterPhone ? ` · ${t.requesterPhone}` : '' })}</p>
          <LiensTicket t={t} tr={tr} />
          {t.tags.length > 0 && <div style={{ marginTop: 4 }}><Tags tags={t.tags} onPick={onPickTag} /></div>}
          {t.escalated && <p className="small" style={{ margin: '4px 0', color: 'var(--red)' }}>{tr('adminSupport.escalatedReason', { reason: t.escalatedReason })}</p>}
          {t.resolutionNote && <p className="small" style={{ margin: '4px 0' }}>{tr('adminSupport.resolutionLine', { note: t.resolutionNote })}</p>}
          <div className="divider" />
          <div style={{ background: 'var(--cream-dim)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', fontSize: 13 }}>{t.message}</div>
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminSupport.attachments')}</h4>
          {t.attachments.length === 0 && <div className="small" style={{ opacity: 0.6 }}>{tr('adminSupport.noAttachments')}</div>}
          {t.attachments.map((a) => (
            <div key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
              <a href={a.fileUrl} target="_blank" rel="noreferrer" className="small">📎 {a.filename}</a>
              <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setConfirm({ title: tr('adminSupport.confirmDeleteAttachment', { name: a.filename }), danger: true, run: () => removeAttachment(a.id) })}>{tr('adminCommon.delete')}</button>
            </div>
          ))}
          <label className="btn-outline" style={{ display: 'inline-block', padding: '6px 14px', fontSize: 13, marginTop: 6, cursor: 'pointer' }}>
            {uploading ? '...' : tr('adminSupport.addAttachment')}
            <input type="file" onChange={uploadAttachment} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <div className="divider" />
          <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
        </>
      )}
      {t && onglet === 'apercu' && editing && form && (
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
          <div className="field"><label>{tr('adminSupport.assignedTo')}</label><AssigneeSelect value={form.assignedToEmail} onChange={(v) => setForm({ ...form, assignedToEmail: v })} /></div>
          <div className="field"><label>{tr('adminSupport.tags')}</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      {t && onglet === 'repondre' && (
        <>
          <h4 className="drawer-section-title">{tr('adminSupport.replyToRequester')}</h4>
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
              <textarea rows={6} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={tr('adminSupport.phReply')} style={{ width: '100%' }} />
              <button className="btn-teal" style={{ marginTop: 6 }} disabled={sending || !replyText.trim()} onClick={sendReply}>{sending ? '...' : tr('adminSupport.sendReply')}</button>
            </>
          )}
        </>
      )}
      {t && onglet === 'actions' && (
        <>
          <h4 className="drawer-section-title">{tr('adminSupport.assignedTo')}</h4>
          <AssigneeSelect value={t.assignedToEmail || ''} onChange={assign} style={{ maxWidth: 320 }} />
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.status')}</h4>
          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {TICKET_STATUSES.map((s) => (
              <button key={s} className={s === t.status ? 'btn-teal' : 'btn-outline'} disabled={s === t.status} onClick={() => changeStatus(s)}>{TICKET_STATUS_LABELS[s].label}</button>
            ))}
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {!t.escalated ? <button className="btn-danger-ghost" onClick={() => setShowEscalate(true)}>{tr('adminSupport.escalate')}</button> : <button className="btn-outline" onClick={() => setConfirm({ title: tr('adminSupport.deescalate'), run: deescalate })}>{tr('adminSupport.deescalate')}</button>}
            <CreateTaskButton targetType="ticket" targetId={id} label={t.subject} />
          </div>
        </>
      )}
      {t && onglet === 'suivi' && (
        <>
          <AdminNotesPanel targetType="ticket" targetId={id} notes={notes} onAdded={load} showChannel />
          <div className="divider" />
          <AdminActionHistory actions={actions} />
        </>
      )}

      <ReasonDialog open={showEscalate} title={tr('adminSupport.escalateThis')} placeholder={tr('adminSupport.phReason')} confirmLabel={tr('adminSupport.escalate')} danger onConfirm={confirmEscalate} onCancel={() => setShowEscalate(false)} />
      <ReasonDialog open={showResolve} title={tr('adminSupport.markResolved')} label={tr('adminSupport.resolutionNoteLabel')} placeholder={tr('adminSupport.phResolution')} required={false} confirmLabel={tr('adminSupport.markResolvedShort')} onConfirm={confirmResolve} onCancel={() => setShowResolve(false)} />
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} onConfirm={async () => { const c = confirm; setConfirm(null); await c.run(); }} onCancel={() => setConfirm(null)} />
      {showCannedManager && (
        <CannedRepliesManager cannedReplies={cannedReplies} onChanged={loadCannedReplies} onClose={() => setShowCannedManager(false)} />
      )}
    </RecordDrawer>,
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
  const [aSupprimer, setASupprimer] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function remove() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await api(`/admin/support/canned-replies/${aSupprimer.id}`, { method: 'DELETE', token });
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally { setBusy(false); setASupprimer(null); }
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
            <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setASupprimer(c)}>{tr('adminCommon.delete')}</button>
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
      <ConfirmDialog open={!!aSupprimer} title={aSupprimer ? tr('adminSupport.confirmDeleteCanned', { title: aSupprimer.title }) : ''} message={tr('adminCommon.irreversible')} danger loading={busy} onConfirm={remove} onCancel={() => setASupprimer(null)} />
    </div>,
    document.body
  );
}
