import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { ErrorCard, Pager, RecordLink, ResultCount, SelectBox, SelectionBar, selectionColumn, useSelection } from '../../components/admin/AdminListTools';
import {
  fmtDate, fmtDateTime, useDebouncedValue, downloadCsv,
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DOCUMENT_VERIFICATION_LABELS, DOCUMENT_EXPIRY_LABELS, DOCUMENT_TARGET_TYPE_LABELS
} from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';

const PAGE_SIZE = 25;
const TARGET_TYPES_WITH_PICKER = { restaurant: '/admin/restaurants', driver: '/admin/drivers', client: '/admin/clients' };
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];

// Lien vers la fiche concernée par un document (restaurant, livreur, client, commande, prospect…).
function LienCible({ d }) {
  return <RecordLink type={d.targetType} id={d.targetId} name={d.targetName} label={`${DOCUMENT_TARGET_TYPE_LABELS[d.targetType] || d.targetType} ${d.targetName || ''}`.trim()} />;
}

export default function AdminDocumentsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [targetType, setTargetType] = useState(searchParams.get('targetType') || '');
  const [documentType, setDocumentType] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(searchParams.get('verification') || '');
  const [expiry, setExpiry] = useState(searchParams.get('expiry') || '');
  const [qInput, setQInput] = useState(location.state?.presetSearch || searchParams.get('q') || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);
  const [showUpload, setShowUpload] = useState(false);
  const [mode, setMode] = useViewMode('documents', 'cards');
  const { sort, toggle } = useTableSort('createdAt');
  const sel = useSelection(data?.rows);
  const [bulk, setBulk] = useState(null); // 'valide' | 'rejete'
  const [bulkBusy, setBulkBusy] = useState(false);

  function loadOverview() {
    api('/admin/documents/overview', { token }).then(setOverview).catch((e) => toast(e.message));
  }
  useEffect(loadOverview, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (searchParams.get('id')) { const next = Object.fromEntries([...searchParams.entries()]); delete next.id; setSearchParams(next, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setData(null); setErreur(null);
    const params = new URLSearchParams();
    if (targetType) params.set('targetType', targetType);
    if (documentType) params.set('documentType', documentType);
    if (verificationStatus) params.set('verificationStatus', verificationStatus);
    if (expiry) params.set('expiry', expiry);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/documents?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }
  useEffect(load, [targetType, documentType, verificationStatus, expiry, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [targetType, documentType, verificationStatus, expiry, q]);

  function refreshAll() { load(); loadOverview(); }

  // Vérification en lot (POST /admin/documents/bulk-verify { ids, verification, reason? }) : le rejet
  // exige un motif, inscrit dans les notes de chaque document par le serveur.
  async function runBulk(reason) {
    setBulkBusy(true);
    try {
      const r = await api('/admin/documents/bulk-verify', { method: 'POST', token, body: { ids: sel.ids, verification: bulk, reason: reason || undefined } });
      toast(tr('adminCommon.bulkDone', { n: r?.updated ?? sel.count }));
      sel.clear(); refreshAll();
    } catch (e) { toast(e.message); } finally { setBulkBusy(false); setBulk(null); }
  }

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`documents-${Date.now()}.csv`, data.rows, [
      { label: tr('adminDocs.colTitle'), get: (d) => d.title }, { label: tr('adminCommon.type'), get: (d) => DOCUMENT_TYPE_LABELS[d.documentType] || d.documentType },
      { label: tr('adminDocs.colTarget'), get: (d) => `${DOCUMENT_TARGET_TYPE_LABELS[d.targetType] || d.targetType} ${d.targetName || ''}`.trim() },
      { label: tr('adminDocs.colVerification'), get: (d) => d.verificationStatus }, { label: tr('adminDocs.colExpiry'), get: (d) => (d.expiresAt ? fmtDate(d.expiresAt) : '') },
      { label: tr('adminDocs.colAdded'), get: (d) => fmtDateTime(d.createdAt) }, { label: 'URL', get: (d) => d.fileUrl || '' }
    ]);
  }

  const colonnes = [
    selectionColumn(sel, tr('adminCommon.select')),
    { key: 'title', label: tr('adminDocs.colTitle'), get: (d) => <b>{d.title}</b>, sortValue: (d) => d.title },
    { key: 'documentType', label: tr('adminCommon.type'), get: (d) => DOCUMENT_TYPE_LABELS[d.documentType] || d.documentType },
    { key: 'targetName', label: tr('adminDocs.colTarget'), get: (d) => <LienCible d={d} />, sortValue: (d) => `${d.targetType} ${d.targetName || ''}` },
    { key: 'verificationStatus', label: tr('adminDocs.colVerification'), get: (d) => <span className="pill" style={{ color: DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.color }}>{DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.label}</span>, sortValue: (d) => d.verificationStatus },
    { key: 'expiresAt', label: tr('adminDocs.colExpiry'), get: (d) => (d.expiresAt ? <span style={{ color: DOCUMENT_EXPIRY_LABELS[d.expiryState]?.color }}>{fmtDate(d.expiresAt)}</span> : '—'), sortValue: (d) => d.expiresAt || 9e15 },
    { key: 'createdAt', label: tr('adminDocs.colAdded'), get: (d) => fmtDateTime(d.createdAt), sortValue: (d) => d.createdAt }
  ];

  return (
    <div>
      <AdminPageHeader module="documents" actions={
        <>
          <ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} />
          <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          <button className="btn-teal" onClick={() => setShowUpload(true)}>{tr('adminDocs.addDocumentBtn')}</button>
        </>
      } />

      {!overview && <SkeletonCards count={1} />}
      {overview && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{overview.total}</div><div className="label">{tr('adminCommon.documents')}</div></div>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setExpiry('expired')}><div className="num" style={{ color: overview.expired > 0 ? 'var(--red)' : 'inherit' }}>{overview.expired}</div><div className="label">{tr('adminDocs.expired')}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setExpiry('expiring_soon')}><div className="num" style={{ color: overview.expiringSoon > 0 ? 'var(--gold-deep)' : 'inherit' }}>{overview.expiringSoon}</div><div className="label">{tr('adminDocs.expiringWithin', { n: overview.expiryWarningDays })}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setVerificationStatus('en_attente')}><div className="num">{overview.pendingVerification}</div><div className="label">{tr('adminDocs.pendingVerification')}</div></button>
        </div>
      )}

      <div className="admin-control-panel">
        <input placeholder={tr('adminCommon.phSearchTitle')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <ResultCount n={data?.rows?.length || 0} total={data?.total} />
      </div>
      <div className="admin-control-panel">
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">{tr('adminDocs.allTargets')}</option>
          {Object.entries(DOCUMENT_TARGET_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">{tr('adminDocs.allTypes')}</option>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">{tr('adminDocs.allVerifications')}</option>
          {Object.entries(DOCUMENT_VERIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="role-pick" style={{ margin: 0 }}>
          {[{ key: '', label: tr('adminDocs.allExpiry') }, { key: 'expired', label: tr('adminDocs.expiredF') }, { key: 'expiring_soon', label: tr('adminDocs.expiringSoonF') }, { key: 'valid', label: tr('adminDocs.validF') }].map((f) => (
            <div key={f.key || 'all'} className={`chip${expiry === f.key ? ' active' : ''}`} onClick={() => setExpiry(f.key)}>{f.label}</div>
          ))}
        </div>
      </div>

      <SelectionBar sel={sel}>
        <button type="button" className="btn-outline" onClick={() => setBulk('valide')}>{tr('adminDocs.bulkValidate')}</button>
        <button type="button" className="btn-danger-ghost" onClick={() => setBulk('rejete')}>{tr('adminDocs.bulkReject')}</button>
      </SelectionBar>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminDocs.noneForFilter')}</div>}
      {data && mode === 'table' && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} onRowClick={(d) => setSelectedId(d.id)} rowClassName={(d) => (sel.isSelected(d.id) ? 'is-selected' : '')} emptyLabel={tr('adminDocs.noneForFilter')} columns={colonnes} />
      )}
      {data && mode === 'cards' && data.rows.map((d) => (
        <div className={`card order-card-clickable${sel.isSelected(d.id) ? ' is-selected' : ''}`} key={d.id} onClick={() => setSelectedId(d.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="admin-card-select"><SelectBox sel={sel} id={d.id} label={tr('adminCommon.select')} /><b>{d.title}</b></span>
            <div className="row" style={{ gap: 6 }}>
              {d.expiryState && <span className="pill" style={{ color: DOCUMENT_EXPIRY_LABELS[d.expiryState].color }}>{DOCUMENT_EXPIRY_LABELS[d.expiryState].label}</span>}
              <span className="pill" style={{ color: DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.color }}>{DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.label}</span>
            </div>
          </div>
          <div className="small">{DOCUMENT_TYPE_LABELS[d.documentType]} · <LienCible d={d} /></div>
          <div className="small" style={{ opacity: 0.6 }}>
            {d.expiresAt ? tr('adminDocs.expiresOnPrefix', { date: fmtDate(d.expiresAt) }) : ''}{tr('adminDocs.addedOn', { date: fmtDateTime(d.createdAt) })}
          </div>
        </div>
      ))}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={setPage} />

      <ConfirmDialog open={bulk === 'valide'} title={tr('adminDocs.bulkValidateTitle', { n: sel.count })} message={tr('adminDocs.validateBody')} loading={bulkBusy} onConfirm={() => runBulk()} onCancel={() => setBulk(null)} />
      <ReasonDialog open={bulk === 'rejete'} title={tr('adminDocs.bulkRejectTitle', { n: sel.count })} message={tr('adminDocs.rejectBody')} label={tr('adminDocs.rejectReason')} placeholder={tr('adminDocs.phRejectReason')} confirmLabel={tr('adminDocs.reject')} danger loading={bulkBusy} onConfirm={runBulk} onCancel={() => setBulk(null)} />
      {selectedId && <DocumentDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={refreshAll} />}
      {showUpload && <UploadDocumentModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); refreshAll(); }} />}
    </div>
  );
}

function UploadDocumentModal({ onClose, onUploaded, presetTargetType, presetTargetId, presetTargetLabel }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [targetType, setTargetType] = useState(presetTargetType || 'restaurant');
  const [entities, setEntities] = useState(null);
  const [targetId, setTargetId] = useState(presetTargetId || '');
  const [documentType, setDocumentType] = useState('autre');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (presetTargetId) return;
    setEntities(null);
    setTargetId('');
    const path = TARGET_TYPES_WITH_PICKER[targetType];
    if (!path) return;
    api(`${path}?limit=1000&sort=name`, { token }).then((l) => setEntities(Array.isArray(l) ? l : (l?.rows || []))).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType]);

  async function upload() {
    if (!targetId) { toast(tr('adminDocs.toastChooseTarget')); return; }
    if (!title.trim()) { toast(tr('adminCommon.toastTitleRequired')); return; }
    if (!file) { toast(tr('adminDocs.toastFileRequired')); return; }
    setUploading(true);
    try {
      await apiUpload('/admin/documents', {
        file, token, fieldName: 'file',
        fields: { targetType, targetId, documentType, title: title.trim(), expiresAt, notes }
      });
      toast(tr('adminDocs.toastAdded'));
      onUploaded();
    } catch (e) {
      toast(e.message);
    } finally {
      setUploading(false);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 10px' }}>{tr('adminDocs.addDocument')}</h3>
        {!presetTargetId && (
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{tr('adminDocs.targetType')}</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                {Object.entries(DOCUMENT_TARGET_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{tr('adminDocs.target')}</label>
              {TARGET_TYPES_WITH_PICKER[targetType] ? (
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">{tr('adminCommon.choose')}</option>
                  {entities && entities.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              ) : (
                <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder={tr('adminDocs.phTargetId')} />
              )}
            </div>
          </div>
        )}
        {presetTargetId && <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminDocs.linkedTo', { label: presetTargetLabel })}</p>}
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{tr('adminDocs.documentType')}</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>{tr('adminDocs.expiryOptional')}</label><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
        </div>
        <div className="field"><label>{tr('adminCommon.title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>{tr('adminDocs.notesOptional')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="field"><label>{tr('adminDocs.file')}</label><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={uploading} onClick={upload}>{uploading ? '...' : tr('adminCommon.addPlain')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Fiche document dans le tiroir commun : aperçu et lien vers la fiche concernée, vérification (validation
// confirmée, rejet avec motif), édition, suppression confirmée.
function DocumentDrawer({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [rejet, setRejet] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setErreur(null);
    api(`/admin/documents/${id}`, { token }).then(setD).catch((e) => setErreur(e.message));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setForm({ title: d.title, documentType: d.documentType, expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : '', notes: d.notes || '' });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/documents/${id}`, { method: 'PATCH', token, body: form });
      toast(tr('adminDocs.toastUpdated'));
      setEditing(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Validation / rejet : par la route « en lot » (un seul id), qui journalise et inscrit le motif ;
  // retour « en attente » : simple PATCH.
  async function verifier(status, reason) {
    setBusy(true);
    try {
      if (status === 'en_attente') await api(`/admin/documents/${id}`, { method: 'PATCH', token, body: { verificationStatus: status } });
      else await api('/admin/documents/bulk-verify', { method: 'POST', token, body: { ids: [id], verification: status, reason: reason || undefined } });
      toast(tr('adminCommon.toastStatusUpdated'));
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally { setBusy(false); setConfirm(null); setRejet(false); }
  }
  function askVerification(status) {
    if (status === d.verificationStatus) return;
    if (status === 'rejete') { setRejet(true); return; }
    setConfirm({ title: status === 'valide' ? tr('adminDocs.confirmValidate') : tr('adminDocs.confirmPending'), message: status === 'valide' ? tr('adminDocs.validateBody') : '', run: () => verifier(status) });
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/admin/documents/${id}`, { method: 'DELETE', token });
      toast(tr('adminDocs.toastDeleted'));
      onChanged();
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false); setConfirm(null);
    }
  }

  return createPortal(
    <RecordDrawer
      title={d?.title || '…'}
      subtitle={d ? `${DOCUMENT_TYPE_LABELS[d.documentType]} · ${DOCUMENT_TARGET_TYPE_LABELS[d.targetType]} ${d.targetName || ''}` : ''}
      badge={d ? <span className="pill" style={{ color: DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.color }}>{DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.label}</span> : null}
      actions={d ? <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>{tr('adminDocs.viewFile')}</a> : null}
      onClose={onClose} width={560}
    >
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!d && !erreur && <div className="small">{tr('adminCommon.loading')}</div>}
      {d && !editing && (
        <>
          <div className="admin-record-links"><LienCible d={d} /></div>
          <DrawerRow label={tr('adminDocs.colExpiry')} value={d.expiresAt ? <span style={{ color: DOCUMENT_EXPIRY_LABELS[d.expiryState]?.color }}>{fmtDate(d.expiresAt)} {d.expiryState ? `· ${DOCUMENT_EXPIRY_LABELS[d.expiryState].label}` : ''}</span> : '—'} strong />
          <DrawerRow label={tr('adminDocs.colAdded')} value={tr('adminDocs.addedBy', { email: d.uploadedByEmail, date: fmtDateTime(d.createdAt) })} />
          {d.notes && <p className="small" style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{d.notes}</p>}

          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminDocs.verification')}</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(DOCUMENT_VERIFICATION_LABELS).map(([k, v]) => (
              <button key={k} className={d.verificationStatus === k ? 'btn-teal' : 'btn-outline'} style={{ padding: '4px 10px', fontSize: 12, borderColor: v.color !== 'inherit' && d.verificationStatus !== k ? v.color : undefined }} disabled={busy || d.verificationStatus === k} onClick={() => askVerification(k)}>
                {v.label}
              </button>
            ))}
          </div>

          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
            <CreateTaskButton targetType="document" targetId={id} label={d.title} />
            <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => setConfirm({ title: tr('adminCommon.confirmDeleteDocument'), message: tr('adminCommon.irreversible'), danger: true, run: remove })}>{tr('adminCommon.delete')}</button>
          </div>
        </>
      )}
      {d && editing && form && (
        <div>
          <div className="field"><label>{tr('adminCommon.title')}</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{tr('adminCommon.type')}</label>
              <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminDocs.expiry')}</label><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
          </div>
          <div className="field"><label>{tr('adminCommon.notes')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} loading={busy} onConfirm={() => confirm.run()} onCancel={() => setConfirm(null)} />
      <ReasonDialog open={rejet} title={tr('adminDocs.confirmReject')} message={tr('adminDocs.rejectBody')} label={tr('adminDocs.rejectReason')} placeholder={tr('adminDocs.phRejectReason')} confirmLabel={tr('adminDocs.reject')} danger loading={busy} onConfirm={(reason) => verifier('rejete', reason)} onCancel={() => setRejet(false)} />
    </RecordDrawer>,
    document.body
  );
}

export { UploadDocumentModal };
