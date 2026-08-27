import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import {
  pct, fmtDateTime, downloadCsv, useDebouncedValue,
  TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUSES
} from './adminUtils';

const PAGE_SIZE = 25;
const PERIOD_TYPES = [{ key: 'month', label: 'Mois' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Année' }];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminSupportPage() {
  const { token } = useAuth();
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
  const [qInput, setQInput] = useState(location.state?.presetSearch || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

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
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/support/tickets?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [status, priority, category, escalatedOnly, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, priority, category, escalatedOnly, q]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast('Rien à exporter.'); return; }
    downloadCsv(`tickets-${Date.now()}.csv`, data.rows, [
      { label: 'N°', get: (t) => t.ticketNumber }, { label: 'Sujet', get: (t) => t.subject },
      { label: 'Catégorie', get: (t) => TICKET_CATEGORY_LABELS[t.category] }, { label: 'Priorité', get: (t) => t.priority },
      { label: 'Statut', get: (t) => t.status }, { label: 'Assigné à', get: (t) => t.assignedToEmail || '' },
      { label: 'Requérant', get: (t) => t.requesterName || '' }, { label: 'Email', get: (t) => t.requesterEmail || '' },
      { label: 'Créé le', get: (t) => fmtDateTime(t.createdAt) }, { label: 'Résolu le', get: (t) => (t.resolvedAt ? fmtDateTime(t.resolvedAt) : '') }
    ]);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Support / Helpdesk</h2>

      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0 }}>
          {PERIOD_TYPES.map((p) => <div key={p.key} className={`chip${periodType === p.key ? ' active' : ''}`} onClick={() => setPeriodType(p.key)}>{p.label}</div>)}
        </div>
        {periodType === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 160 }} />}
        {periodType === 'year' && <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 100 }} />}
      </div>

      {!stats && <SkeletonCards count={1} />}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{stats.created}</div><div className="label">Tickets créés</div></div>
          <div className="stat-card"><div className="num">{stats.resolved}</div><div className="label">Tickets résolus</div></div>
          <div className="stat-card"><div className="num">{pct(stats.resolutionRate, 0)}</div><div className="label">Taux de résolution</div></div>
          <div className="stat-card"><div className="num">{stats.avgResolutionHours !== null ? `${stats.avgResolutionHours} h` : '—'}</div><div className="label">Temps moyen de résolution</div></div>
          <div className="stat-card"><div className="num" style={{ color: stats.slaBreached > 0 ? 'var(--red)' : 'inherit' }}>{stats.slaBreached}</div><div className="label">SLA dépassés (ouverts)</div></div>
        </div>
      )}
      {stats && stats.byCategory.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Catégories les plus fréquentes</h3>
          {stats.byCategory.map((c) => (
            <div key={c.category} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
              <span className="small">{TICKET_CATEGORY_LABELS[c.category]}</span>
              <span className="small">{c.total}</span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Chercher (n°, sujet, requérant)..." value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-outline" onClick={exportCsv}>⬇️ CSV</button>
        <button className="btn-teal" onClick={() => setShowCreate(true)}>+ Nouveau ticket</button>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0, flexWrap: 'wrap' }}>
          {[{ key: '', label: 'Tous statuts' }, ...TICKET_STATUSES.map((s) => ({ key: s, label: TICKET_STATUS_LABELS[s].label }))].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">Toutes priorités</option>
          {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">Toutes catégories</option>
          {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
        </select>
        <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={escalatedOnly} onChange={(e) => setEscalatedOnly(e.target.checked)} /> Escaladés uniquement
        </label>
      </div>

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">Aucun ticket pour ce filtre.</div>}
      {data && data.rows.map((t) => (
        <div className="card order-card-clickable" key={t.id} onClick={() => setSelectedId(t.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{t.subject}</b>
            <div className="row" style={{ gap: 6 }}>
              {t.escalated && <span className="pill" style={{ color: 'var(--red)' }}>⚠️ Escaladé</span>}
              <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>
            </div>
          </div>
          <div className="small">{t.ticketNumber} · {TICKET_CATEGORY_LABELS[t.category]} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span></div>
          <div className="small">{t.requesterName || t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || '—'}{t.assignedToEmail ? ` · assigné à ${t.assignedToEmail}` : ''}</div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(t.updatedAt)}</div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
          <span className="small">Page {page + 1} / {Math.ceil(data.total / PAGE_SIZE)} ({data.total})</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
        </div>
      )}

      {selectedId && <TicketDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ subject: '', message: '', category: 'autre', priority: 'medium', requesterName: '', requesterEmail: '', requesterPhone: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.subject.trim() || !form.message.trim()) { toast('Sujet et message requis.'); return; }
    setSaving(true);
    try {
      const t = await api('/admin/support/tickets', { method: 'POST', token, body: form });
      toast(`Ticket ${t.ticketNumber} créé.`);
      onCreated();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ margin: '0 0 10px' }}>Nouveau ticket</h3>
        <div className="field"><label>Sujet</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div className="field"><label>Message</label><textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Catégorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Priorité</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Nom du requérant</label><input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>Email</label><input value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>Téléphone</label><input value={form.requesterPhone} onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : 'Créer'}</button>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TicketDetailModal({ id, onClose, onChanged }) {
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
      toast('Ticket mis à jour.');
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
    if (!escalateReason.trim()) { toast('Motif requis.'); return; }
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
      toast('Réponse envoyée.');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        {!t && <div className="small">Chargement...</div>}
        {t && !editing && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 4px' }}>{t.subject}</h3>
              <span className="pill" style={{ color: TICKET_STATUS_LABELS[t.status]?.color }}>{TICKET_STATUS_LABELS[t.status]?.label}</span>
            </div>
            <p className="small" style={{ margin: '2px 0', fontFamily: 'monospace' }}>{t.ticketNumber}</p>
            <p className="small" style={{ margin: '2px 0' }}>{TICKET_CATEGORY_LABELS[t.category]} · <span style={{ color: TICKET_PRIORITY_LABELS[t.priority]?.color }}>{TICKET_PRIORITY_LABELS[t.priority]?.label}</span>{t.assignedToEmail ? ` · assigné à ${t.assignedToEmail}` : ''}</p>
            {t.slaDueAt && <p className="small" style={{ margin: '2px 0', color: !t.resolvedAt && t.slaDueAt < Date.now() ? 'var(--red)' : 'inherit' }}>SLA : réponse attendue avant le {fmtDateTime(t.slaDueAt)}{t.firstResponseAt ? ` (première réponse le ${fmtDateTime(t.firstResponseAt)})` : ''}</p>}
            <p className="small" style={{ margin: '2px 0' }}>Requérant : {t.requesterName || '—'}{t.requesterEmail ? ` · ${t.requesterEmail}` : ''}{t.requesterPhone ? ` · ${t.requesterPhone}` : ''}</p>
            {(t.linkedClientName || t.linkedDriverName || t.linkedRestaurantName || t.linkedOrderId) && (
              <p className="small" style={{ margin: '2px 0' }}>
                Lié à : {[t.linkedClientName && `Client ${t.linkedClientName}`, t.linkedDriverName && `Livreur ${t.linkedDriverName}`, t.linkedRestaurantName && `Restaurant ${t.linkedRestaurantName}`, t.linkedOrderId && `Commande #${t.linkedOrderId.slice(0, 8)}`].filter(Boolean).join(' · ')}
              </p>
            )}
            {t.tags.length > 0 && <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{t.tags.map((tag) => <span key={tag} className="pill">{tag}</span>)}</div>}
            {t.escalated && <p className="small" style={{ margin: '4px 0', color: 'var(--red)' }}>⚠️ Escaladé : {t.escalatedReason}</p>}
            {t.resolutionNote && <p className="small" style={{ margin: '4px 0' }}>Résolution : {t.resolutionNote}</p>}
            <div className="divider" />
            <div style={{ background: 'var(--cream-dim)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', fontSize: 13 }}>{t.message}</div>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Pièces jointes</h4>
            {t.attachments.length === 0 && <div className="small" style={{ opacity: 0.6 }}>Aucune pièce jointe.</div>}
            {t.attachments.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="small">📎 {a.filename}</a>
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeAttachment(a.id)}>Supprimer</button>
              </div>
            ))}
            <label className="btn-outline" style={{ display: 'inline-block', padding: '6px 14px', fontSize: 13, marginTop: 6, cursor: 'pointer' }}>
              {uploading ? '...' : '+ Ajouter une pièce jointe'}
              <input type="file" onChange={uploadAttachment} style={{ display: 'none' }} disabled={uploading} />
            </label>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Actions</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={startEdit}>✏️ Modifier</button>
              {TICKET_STATUSES.filter((s) => s !== t.status).map((s) => (
                <button key={s} className="btn-outline" onClick={() => changeStatus(s)}>{TICKET_STATUS_LABELS[s].label}</button>
              ))}
              {!t.escalated ? <button className="btn-danger-ghost" onClick={() => setShowEscalate(true)}>Escalader</button> : <button className="btn-outline" onClick={deescalate}>Désescalader</button>}
            </div>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Répondre au requérant</h4>
            {!t.requesterEmail && <div className="small" style={{ opacity: 0.6 }}>Aucun email de contact — ajoute-en un via "Modifier".</div>}
            {t.requesterEmail && (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  {cannedReplies && cannedReplies.length > 0 && (
                    <select onChange={(e) => { if (e.target.value) setReplyText(cannedReplies.find((c) => c.id === e.target.value)?.body || ''); }} defaultValue="">
                      <option value="">Insérer une réponse enregistrée...</option>
                      {cannedReplies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setShowCannedManager(true)}>Gérer les réponses enregistrées</button>
                </div>
                <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Réponse envoyée par email au requérant..." />
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
            <div className="field"><label>Sujet</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Catégorie</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Priorité</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Assigné à (email admin)</label><input value={form.assignedToEmail} onChange={(e) => setForm({ ...form, assignedToEmail: e.target.value })} /></div>
            <div className="field"><label>Tags (séparés par virgule)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : 'Enregistrer'}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>

      {showEscalate && createPortal(
        <div className="modal-overlay" onClick={() => setShowEscalate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>Escalader ce ticket</h3>
            <input placeholder="Motif (requis)" value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} autoFocus style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-danger-ghost" onClick={confirmEscalate}>Escalader</button>
              <button className="btn-ghost" onClick={() => setShowEscalate(false)}>Annuler</button>
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
            <h3 style={{ margin: '0 0 8px' }}>Marquer comme résolu</h3>
            <input placeholder="Note de résolution (optionnel)" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} autoFocus style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-teal" onClick={confirmResolve}>Marquer résolu</button>
              <button className="btn-ghost" onClick={() => setShowResolve(false)}>Annuler</button>
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
  const { token } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim() || !body.trim()) { toast('Titre et texte requis.'); return; }
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 style={{ margin: '0 0 10px' }}>Réponses enregistrées</h3>
        {(!cannedReplies || cannedReplies.length === 0) && <div className="small" style={{ opacity: 0.6, marginBottom: 10 }}>Aucune réponse enregistrée pour l'instant.</div>}
        {cannedReplies && cannedReplies.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--cream-dim)' }}>
            <div>
              <b className="small">{c.title}</b>
              <div className="small" style={{ opacity: 0.6 }}>{c.body.slice(0, 60)}{c.body.length > 60 ? '...' : ''}</div>
            </div>
            <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => remove(c.id)}>Supprimer</button>
          </div>
        ))}
        <div className="divider" />
        <div className="field"><label>Titre</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Retard de livraison" /></div>
        <div className="field"><label>Texte</label><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : 'Ajouter'}</button>
          <button className="btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
