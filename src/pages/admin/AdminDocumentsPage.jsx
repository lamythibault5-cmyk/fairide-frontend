import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import {
  fmtDate, fmtDateTime, useDebouncedValue,
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DOCUMENT_VERIFICATION_LABELS, DOCUMENT_EXPIRY_LABELS, DOCUMENT_TARGET_TYPE_LABELS
} from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const PAGE_SIZE = 25;
const TARGET_TYPES_WITH_PICKER = { restaurant: '/admin/restaurants', driver: '/admin/drivers', client: '/admin/clients' };

export default function AdminDocumentsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [overview, setOverview] = useState(null);
  const [targetType, setTargetType] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qInput, setQInput] = useState(location.state?.presetSearch || '');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  function loadOverview() {
    api('/admin/documents/overview', { token }).then(setOverview).catch((e) => toast(e.message));
  }
  useEffect(loadOverview, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setData(null);
    const params = new URLSearchParams();
    if (targetType) params.set('targetType', targetType);
    if (documentType) params.set('documentType', documentType);
    if (verificationStatus) params.set('verificationStatus', verificationStatus);
    if (expiry) params.set('expiry', expiry);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/documents?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [targetType, documentType, verificationStatus, expiry, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [targetType, documentType, verificationStatus, expiry, q]);

  function refreshAll() { load(); loadOverview(); }

  return (
    <div>
      <AdminPageHeader module="documents" />

      {!overview && <SkeletonCards count={1} />}
      {overview && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{overview.total}</div><div className="label">{tr('adminCommon.documents')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: overview.expired > 0 ? 'var(--red)' : 'inherit' }}>{overview.expired}</div><div className="label">{tr('adminDocs.expired')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: overview.expiringSoon > 0 ? 'var(--gold-deep)' : 'inherit' }}>{overview.expiringSoon}</div><div className="label">{tr('adminDocs.expiringWithin', { n: overview.expiryWarningDays })}</div></div>
          <div className="stat-card"><div className="num">{overview.pendingVerification}</div><div className="label">{tr('adminDocs.pendingVerification')}</div></div>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder={tr('adminCommon.phSearchTitle')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-teal" onClick={() => setShowUpload(true)}>{tr('adminDocs.addDocumentBtn')}</button>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminDocs.noneForFilter')}</div>}
      {data && data.rows.map((d) => (
        <div className="card order-card-clickable" key={d.id} onClick={() => setSelectedId(d.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{d.title}</b>
            <div className="row" style={{ gap: 6 }}>
              {d.expiryState && <span className="pill" style={{ color: DOCUMENT_EXPIRY_LABELS[d.expiryState].color }}>{DOCUMENT_EXPIRY_LABELS[d.expiryState].label}</span>}
              <span className="pill" style={{ color: DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.color }}>{DOCUMENT_VERIFICATION_LABELS[d.verificationStatus]?.label}</span>
            </div>
          </div>
          <div className="small">{DOCUMENT_TYPE_LABELS[d.documentType]} · {DOCUMENT_TARGET_TYPE_LABELS[d.targetType]} {d.targetName || ''}</div>
          <div className="small" style={{ opacity: 0.6 }}>
            {d.expiresAt ? tr('adminDocs.expiresOnPrefix', { date: fmtDate(d.expiresAt) }) : ''}{tr('adminDocs.addedOn', { date: fmtDateTime(d.createdAt) })}
          </div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE), n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}

      {selectedId && <DocumentDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={refreshAll} />}
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
    api(path, { token }).then(setEntities).catch((e) => toast(e.message));
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
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

function DocumentDetailModal({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    api(`/admin/documents/${id}`, { token }).then(setD).catch((e) => toast(e.message));
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

  async function setVerification(status) {
    try {
      await api(`/admin/documents/${id}`, { method: 'PATCH', token, body: { verificationStatus: status } });
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    }
  }

  async function remove() {
    try {
      await api(`/admin/documents/${id}`, { method: 'DELETE', token });
      toast(tr('adminDocs.toastDeleted'));
      onChanged();
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmDelete(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {!d && <div className="small">{tr('adminCommon.loading')}</div>}
        {d && !editing && (
          <>
            <h3 style={{ margin: '0 0 8px' }}>{d.title}</h3>
            <p className="small" style={{ margin: '2px 0' }}>{DOCUMENT_TYPE_LABELS[d.documentType]} · {DOCUMENT_TARGET_TYPE_LABELS[d.targetType]} {d.targetName || ''}</p>
            {d.expiresAt && <p className="small" style={{ margin: '2px 0', color: d.expiryState === 'expired' ? 'var(--red)' : d.expiryState === 'expiring_soon' ? 'var(--gold-deep)' : 'inherit' }}>{tr('adminDocs.expiresOn', { date: fmtDate(d.expiresAt) })}</p>}
            {d.notes && <p className="small" style={{ margin: '2px 0' }}>{d.notes}</p>}
            <p className="small" style={{ margin: '2px 0', opacity: 0.6 }}>{tr('adminDocs.addedBy', { email: d.uploadedByEmail, date: fmtDateTime(d.createdAt) })}</p>
            <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ display: 'inline-block', marginTop: 6, padding: '6px 14px', fontSize: 13 }}>{tr('adminDocs.viewFile')}</a>

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminDocs.verification')}</h4>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(DOCUMENT_VERIFICATION_LABELS).map(([k, v]) => (
                <button key={k} className="btn-outline" style={{ padding: '4px 10px', fontSize: 12, opacity: d.verificationStatus === k ? 1 : 0.6, borderColor: v.color !== 'inherit' ? v.color : undefined }} onClick={() => setVerification(k)}>
                  {v.label}
                </button>
              ))}
            </div>

            <div className="divider" />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-outline" onClick={startEdit}>{tr('adminCommon.edit')}</button>
              <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>{tr('adminCommon.delete')}</button>
              <CreateTaskButton targetType="document" targetId={id} label={d.title} />
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
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={tr('adminCommon.confirmDeleteDocument')}
        message={tr('adminCommon.irreversible')}
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>,
    document.body
  );
}

export { UploadDocumentModal };
