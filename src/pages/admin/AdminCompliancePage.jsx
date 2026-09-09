import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { ErrorCard, Pager, ResultCount } from '../../components/admin/AdminListTools';
import { fmtDate, fmtDateTime, downloadPdf, useDebouncedValue } from './adminUtils';
import '../../admin-compliance.css';

// Application « Conformité & RGPD » : registre des demandes des personnes concernées (délai légal d'un
// mois), export / suppression des données d'un compte, suivi des versions de contrats des partenaires,
// exports fiscaux (DAC7, 281.29) et politique de rétention. Backend : routes/adminCompliance.js.
const PAGE_SIZE = 25;
const TABS = ['requests', 'contracts', 'exports', 'retention'];
const TYPES = ['access', 'delete', 'rectify', 'portability', 'objection'];
const STATUSES = ['received', 'in_progress', 'done', 'rejected'];
const CHANNELS = ['email', 'form', 'phone', 'other'];
const STATUS_COLORS = { received: 'var(--gold-deep)', in_progress: 'var(--teal)', done: '#2e7d32', rejected: 'var(--red)' };

function StatusPill({ status, tr }) {
  return <span className="compliance-status" style={{ color: STATUS_COLORS[status] || 'inherit' }}>{tr(`adminCompliance.status_${status}`)}</span>;
}

export default function AdminCompliancePage() {
  const { t: tr } = useLanguage();
  const [onglet, setOnglet] = useState('requests');
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <AdminPageHeader module="compliance" actions={
        <button className="btn-teal" onClick={() => { setOnglet('requests'); setShowCreate(true); }}>{tr('adminCompliance.newRequest')}</button>
      } />
      <div className="role-pick compliance-tabs" role="tablist">
        {TABS.map((k) => (
          <div key={k} role="tab" aria-selected={onglet === k} className={`chip${onglet === k ? ' active' : ''}`} onClick={() => setOnglet(k)}>{tr(`adminCompliance.tab_${k}`)}</div>
        ))}
      </div>
      {onglet === 'requests' && <RequestsTab refreshKey={refreshKey} />}
      {onglet === 'contracts' && <ContractsTab />}
      {onglet === 'exports' && <ExportsTab />}
      {onglet === 'retention' && <RetentionTab />}
      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Onglet « Demandes RGPD »
// ---------------------------------------------------------------------------------------------------------
function RequestsTab({ refreshKey }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('');
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [selected, setSelected] = useState(null);
  const { sort, toggle } = useTableSort('dueAt', 'asc');

  function load() {
    setData(null); setErreur(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/compliance/requests?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }
  useEffect(load, [status, type, q, page, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [status, type, q]);

  const kpis = data?.kpis;
  const colonnes = [
    { key: 'email', label: tr('adminCommon.email'), get: (r) => <><b>{r.userName || r.email}</b>{r.userName && <div className="small" style={{ opacity: 0.7 }}>{r.email}</div>}</>, sortValue: (r) => r.userName || r.email },
    { key: 'userRole', label: tr('adminCompliance.colAccount'), get: (r) => (r.userRole ? tr(`adminCompliance.role_${r.userRole}`) : tr('adminCompliance.noAccount')), sortValue: (r) => r.userRole || '' },
    { key: 'type', label: tr('adminCommon.type'), get: (r) => tr(`adminCompliance.type_${r.type}`), sortValue: (r) => r.type },
    { key: 'status', label: tr('adminCommon.status'), get: (r) => <StatusPill status={r.status} tr={tr} />, sortValue: (r) => r.status },
    { key: 'channel', label: tr('adminCompliance.colChannel'), get: (r) => tr(`adminCompliance.channel_${r.channel}`), sortValue: (r) => r.channel },
    { key: 'createdAt', label: tr('adminCompliance.colReceived'), get: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
    { key: 'dueAt', label: tr('adminCommon.dueDate'), get: (r) => <>{fmtDate(r.dueAt)}{r.overdue && <span className="compliance-overdue">{tr('adminCompliance.overdue')}</span>}</>, sortValue: (r) => r.dueAt },
    { key: 'handledBy', label: tr('adminCompliance.colHandler'), get: (r) => r.handledBy || '—', sortValue: (r) => r.handledBy || '' }
  ];

  return (
    <div>
      {!data && !erreur && <SkeletonCards count={1} />}
      {kpis && (
        <div className="stat-grid compliance-kpis">
          <button type="button" className="stat-card highlight" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setStatus('open')}><div className="num">{kpis.open}</div><div className="label">{tr('adminCompliance.kpiOpen')}</div></button>
          <button type="button" className={`stat-card${kpis.overdue > 0 ? ' is-alert' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setStatus('overdue')}><div className="num">{kpis.overdue}</div><div className="label">{tr('adminCompliance.kpiOverdue')}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setStatus('done')}><div className="num">{kpis.done30d}</div><div className="label">{tr('adminCompliance.kpiDone30d')}</div></button>
          <div className="stat-card"><div className="num">{kpis.avgDays === null || kpis.avgDays === undefined ? '—' : kpis.avgDays}</div><div className="label">{tr('adminCompliance.kpiAvgDays')}</div></div>
        </div>
      )}

      <div className="compliance-filters">
        <input type="search" placeholder={tr('adminCompliance.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('adminCommon.status')}>
          <option value="">{tr('adminCommon.allStatuses')}</option>
          <option value="open">{tr('adminCompliance.filterOpen')}</option>
          <option value="overdue">{tr('adminCompliance.filterOverdue')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{tr(`adminCompliance.status_${s}`)}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label={tr('adminCommon.type')}>
          <option value="">{tr('adminCompliance.allTypes')}</option>
          {TYPES.map((k) => <option key={k} value={k}>{tr(`adminCompliance.type_${k}`)}</option>)}
        </select>
        <ResultCount n={data?.items?.length || 0} total={data?.total} />
      </div>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={3} />}
      {data && data.items.length === 0 && <div className="empty">{tr('adminCompliance.noRequests')}</div>}
      {data && data.items.length > 0 && (
        <AdminDataTable rows={data.items} sort={sort} onSort={toggle} onRowClick={(r) => setSelected(r)} rowClassName={(r) => (r.overdue ? 'is-overdue' : '')} emptyLabel={tr('adminCompliance.noRequests')} columns={colonnes} />
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={setPage} />

      {selected && <RequestDrawer initial={selected} onClose={() => setSelected(null)} onChanged={(r) => { if (r) setSelected(r); load(); }} />}
    </div>
  );
}

// Fiche d'une demande : aperçu, puis traitement (statut, notes, responsable) et actions — accusé de
// réception, export JSON des données, suppression définitive du compte, clôture ou rejet motivé.
function RequestDrawer({ initial, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [r, setR] = useState(initial);
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ status: initial.status, notes: initial.notes || '', handledBy: initial.handledBy || '' });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, danger, confirmLabel, run }
  const [rejet, setRejet] = useState(false);

  useEffect(() => { setR(initial); setForm({ status: initial.status, notes: initial.notes || '', handledBy: initial.handledBy || '' }); }, [initial]);

  function appliquer(next) { setR(next); setForm({ status: next.status, notes: next.notes || '', handledBy: next.handledBy || '' }); onChanged(next); }

  async function patch(body, message) {
    setBusy(true);
    try {
      const next = await api(`/admin/compliance/requests/${r.id}`, { method: 'PATCH', token, body });
      appliquer(next);
      toast(message || tr('adminCommon.toastStatusUpdated'));
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); setRejet(false); }
  }

  async function accuser() {
    setBusy(true);
    try {
      const res = await api(`/admin/compliance/requests/${r.id}/acknowledge`, { method: 'POST', token });
      if (res.request) appliquer(res.request);
      toast(res.sent ? tr('adminCompliance.toastAckSent') : tr('adminCompliance.toastAckNotSent'));
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  async function exporter() {
    setBusy(true);
    try {
      await downloadPdf(`/admin/compliance/requests/${r.id}/export`, token, `donnees-${r.id}.json`);
      toast(tr('adminCompliance.toastExported'));
      onChanged(null);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  async function supprimerCompte() {
    setBusy(true);
    try {
      const res = await api(`/admin/compliance/requests/${r.id}/delete`, { method: 'POST', token });
      if (res.request) appliquer(res.request);
      toast(tr('adminCompliance.toastAccountDeleted'));
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  const tabs = [{ key: 'overview', label: tr('adminCommon.tabOverview') }, { key: 'process', label: tr('adminCompliance.tabProcess') }];
  const ouverte = r.status === 'received' || r.status === 'in_progress';

  return createPortal(
    <RecordDrawer
      title={r.userName || r.email}
      subtitle={`${tr(`adminCompliance.type_${r.type}`)} · ${tr('adminCompliance.receivedOn', { date: fmtDate(r.createdAt) })}`}
      badge={<>{r.overdue && <span className="compliance-overdue">{tr('adminCompliance.overdue')}</span>}<StatusPill status={r.status} tr={tr} /></>}
      tabs={tabs} tab={tab} onTab={setTab} onClose={onClose} width={600}
    >
      {tab === 'overview' && (
        <>
          <DrawerRow label={tr('adminCommon.email')} value={r.email} strong />
          <DrawerRow label={tr('adminCompliance.colAccount')} value={r.userId ? `${r.userName || ''} · ${tr(`adminCompliance.role_${r.userRole}`)}` : tr('adminCompliance.noAccount')} />
          <DrawerRow label={tr('adminCommon.type')} value={tr(`adminCompliance.type_${r.type}`)} />
          <DrawerRow label={tr('adminCompliance.colChannel')} value={tr(`adminCompliance.channel_${r.channel}`)} />
          <DrawerRow label={tr('adminCompliance.colReceived')} value={fmtDateTime(r.createdAt)} />
          <DrawerRow label={tr('adminCommon.dueDate')} value={<>{fmtDate(r.dueAt)}{r.overdue && <span className="compliance-overdue">{tr('adminCompliance.overdue')}</span>}</>} strong={r.overdue} />
          {r.doneAt && <DrawerRow label={tr('adminCompliance.closedOn')} value={fmtDateTime(r.doneAt)} />}
          <DrawerRow label={tr('adminCompliance.colHandler')} value={r.handledBy || '—'} />
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.message')}</h4>
          {r.message ? <div className="compliance-message">{r.message}</div> : <p className="small" style={{ opacity: 0.7 }}>{tr('adminCompliance.noMessage')}</p>}
          {r.notes && (
            <>
              <h4 className="drawer-section-title">{tr('adminCommon.notes')}</h4>
              <div className="compliance-message">{r.notes}</div>
            </>
          )}
        </>
      )}
      {tab === 'process' && (
        <div className="compliance-form">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{tr('adminCommon.status')}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{tr(`adminCompliance.status_${s}`)}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>{tr('adminCompliance.colHandler')}</label>
              <input value={form.handledBy} onChange={(e) => setForm({ ...form, handledBy: e.target.value })} placeholder={tr('adminCompliance.phHandler')} />
            </div>
          </div>
          <div className="field">
            <label>{tr('adminCommon.notes')}</label>
            <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={tr('adminCompliance.phNotes')} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={busy} onClick={() => patch({ status: form.status, notes: form.notes, handledBy: form.handledBy }, tr('adminCompliance.toastSaved'))}>{busy ? '...' : tr('adminCommon.save')}</button>
          </div>

          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.actions')}</h4>
          <div className="compliance-actions">
            <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCompliance.ackTitle'), message: tr('adminCompliance.ackBody', { email: r.email }), confirmLabel: tr('adminCompliance.ackBtn'), run: accuser })}>{tr('adminCompliance.ackBtn')}</button>
            <button className="btn-outline" disabled={busy || !r.userId} title={!r.userId ? tr('adminCompliance.noAccount') : undefined} onClick={exporter}>{tr('adminCompliance.exportBtn')}</button>
            {ouverte && <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCompliance.doneTitle'), message: tr('adminCompliance.doneBody'), confirmLabel: tr('adminCompliance.doneBtn'), run: () => patch({ status: 'done' }, tr('adminCompliance.toastDone')) })}>{tr('adminCompliance.doneBtn')}</button>}
            {ouverte && <button className="btn-outline" disabled={busy} style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setRejet(true)}>{tr('adminCompliance.rejectBtn')}</button>}
            <button className="btn-danger-ghost" disabled={busy || !r.userId} title={!r.userId ? tr('adminCompliance.noAccount') : undefined} onClick={() => setConfirm({ title: tr('adminCompliance.deleteTitle'), message: tr('adminCompliance.deleteBody', { email: r.email }), confirmLabel: tr('adminCompliance.deleteBtn'), danger: true, run: supprimerCompte })}>{tr('adminCompliance.deleteBtn')}</button>
          </div>
          <p className="small" style={{ opacity: 0.7, marginTop: 10 }}>{tr('adminCompliance.exportHint')}</p>
        </div>
      )}
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.confirmLabel} danger={confirm?.danger} loading={busy} onConfirm={() => confirm.run()} onCancel={() => setConfirm(null)} />
      <ReasonDialog open={rejet} title={tr('adminCompliance.rejectTitle')} message={tr('adminCompliance.rejectBody')} label={tr('adminCommon.reasonLabel')} placeholder={tr('adminCompliance.phRejectReason')} confirmLabel={tr('adminCompliance.rejectBtn')} danger loading={busy}
        onConfirm={(reason) => patch({ status: 'rejected', notes: `${form.notes ? `${form.notes}\n` : ''}${tr('adminCompliance.rejectNotePrefix')} ${reason}` }, tr('adminCompliance.toastRejected'))} onCancel={() => setRejet(false)} />
    </RecordDrawer>,
    document.body
  );
}

// Saisie manuelle d'une demande reçue par e-mail, téléphone ou courrier.
function CreateRequestModal({ onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', type: 'access', channel: 'email', message: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function creer() {
    if (!form.email.trim()) { toast(tr('adminCompliance.toastEmailRequired')); return; }
    setSaving(true);
    try {
      await api('/admin/compliance/requests', { method: 'POST', token, body: form });
      toast(tr('adminCompliance.toastCreated'));
      onCreated();
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box compliance-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 10px' }}>{tr('adminCompliance.newRequestTitle')}</h3>
        <div className="field"><label>{tr('adminCommon.email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nom@exemple.be" /></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>{tr('adminCommon.type')}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((k) => <option key={k} value={k}>{tr(`adminCompliance.type_${k}`)}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>{tr('adminCompliance.colChannel')}</label>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((k) => <option key={k} value={k}>{tr(`adminCompliance.channel_${k}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>{tr('adminCompliance.requestText')}</label><textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <div className="field"><label>{tr('adminCompliance.internalNotes')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={creer}>{saving ? '...' : tr('adminCommon.create')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------------------------------------
// Onglet « Contrats »
// ---------------------------------------------------------------------------------------------------------
function ContractsTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [remind, setRemind] = useState(null); // 'couriers' | 'restaurants'
  const [busy, setBusy] = useState(false);
  const { sort, toggle } = useTableSort('name', 'asc');

  function load() { setData(null); setErreur(null); api('/admin/compliance/contracts', { token }).then(setData).catch((e) => setErreur(e.message)); }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function rappeler() {
    setBusy(true);
    try {
      const r = await api('/admin/compliance/contracts/remind', { method: 'POST', token, body: { target: remind } });
      toast(tr('adminCompliance.toastReminded', { n: r.notified }));
    } catch (e) { toast(e.message); } finally { setBusy(false); setRemind(null); }
  }

  const outdatedCouriers = data ? data.outdated.filter((o) => o.kind === 'courier').length : 0;
  const outdatedRestaurants = data ? data.outdated.filter((o) => o.kind === 'restaurant').length : 0;
  const colonnes = [
    { key: 'kind', label: tr('adminCommon.type'), get: (o) => (o.kind === 'courier' ? `${tr('adminCommon.driver')} · ${tr(`adminCompliance.courier_${o.subtype}`)}` : tr('adminCommon.restaurant')), sortValue: (o) => `${o.kind} ${o.subtype || ''}` },
    { key: 'name', label: tr('adminCommon.name'), get: (o) => <b>{o.name}</b>, sortValue: (o) => o.name },
    { key: 'email', label: tr('adminCommon.email'), get: (o) => o.email },
    { key: 'version', label: tr('adminCompliance.colSigned'), get: (o) => (o.version ? <span style={{ color: 'var(--gold-deep)' }}>{o.version}</span> : <span style={{ color: 'var(--red)' }}>{tr('adminCompliance.unsigned')}</span>), sortValue: (o) => o.version || '' },
    { key: 'expected', label: tr('adminCompliance.colExpected'), get: (o) => o.expected }
  ];

  return (
    <div>
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={4} />}
      {data && (
        <>
          <div className="compliance-grid">
            {data.couriers.map((c) => (
              <div key={c.type} className="compliance-contract-card">
                <h4>{tr(`adminCompliance.courier_${c.type}`)}</h4>
                <span className="compliance-version">{tr('adminCompliance.currentVersion')} : {c.currentVersion}</span>
                <div className="compliance-counts">
                  <div><b>{c.signedCurrent}</b><span>{tr('adminCompliance.upToDate')}</span></div>
                  <div className={c.signedOld > 0 ? 'warn' : ''}><b>{c.signedOld}</b><span>{tr('adminCompliance.oldVersion')}</span></div>
                  <div className={c.unsigned > 0 ? 'bad' : ''}><b>{c.unsigned}</b><span>{tr('adminCompliance.unsigned')}</span></div>
                </div>
              </div>
            ))}
            <div className="compliance-contract-card">
              <h4>{tr('adminCommon.restaurants')}</h4>
              <span className="compliance-version">{tr('adminCompliance.currentVersion')} : {data.restaurants.currentVersion}</span>
              <div className="compliance-counts">
                <div><b>{data.restaurants.onCurrent}</b><span>{tr('adminCompliance.upToDate')}</span></div>
                <div className={data.restaurants.onOld > 0 ? 'warn' : ''}><b>{data.restaurants.onOld}</b><span>{tr('adminCompliance.oldVersion')}</span></div>
                <div className={data.restaurants.none > 0 ? 'bad' : ''}><b>{data.restaurants.none}</b><span>{tr('adminCompliance.unsigned')}</span></div>
              </div>
            </div>
          </div>

          <div className="admin-control-panel">
            <b>{tr('adminCompliance.outdatedTitle', { n: data.outdatedTotal ?? data.outdated.length })}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" disabled={outdatedCouriers === 0} onClick={() => setRemind('couriers')}>{tr('adminCompliance.remindCouriers')}</button>
              <button className="btn-outline" disabled={outdatedRestaurants === 0} onClick={() => setRemind('restaurants')}>{tr('adminCompliance.remindRestaurants')}</button>
            </div>
          </div>
          {data.outdated.length === 0 && <div className="empty">{tr('adminCompliance.allUpToDate')}</div>}
          {data.outdated.length > 0 && <AdminDataTable rows={data.outdated} sort={sort} onSort={toggle} columns={colonnes} emptyLabel={tr('adminCompliance.allUpToDate')} />}
          <p className="small" style={{ opacity: 0.7, marginTop: 10 }}>{tr('adminCompliance.contractsHint')}</p>
        </>
      )}
      <ConfirmDialog open={!!remind} title={tr('adminCompliance.remindTitle')} message={tr('adminCompliance.remindBody', { n: remind === 'couriers' ? outdatedCouriers : outdatedRestaurants })} confirmLabel={tr('adminCompliance.remindConfirm')} loading={busy} onConfirm={rappeler} onCancel={() => setRemind(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Onglet « Exports légaux » : DAC7 et fiches 281.29 (routes CSV existantes), seuils légaux par année.
// ---------------------------------------------------------------------------------------------------------
function ExportsTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const anneeCourante = new Date().getFullYear();
  const annees = Array.from({ length: 5 }, (_, i) => anneeCourante - i);
  const [year, setYear] = useState(anneeCourante - 1);
  const [quarter, setQuarter] = useState('');
  const [busy, setBusy] = useState(null);

  function load() { setData(null); setErreur(null); api('/admin/compliance/legal-exports', { token }).then(setData).catch((e) => setErreur(e.message)); }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function telecharger(item) {
    setBusy(item.key);
    try {
      const params = new URLSearchParams({ year });
      if (item.params.includes('quarter') && quarter) params.set('quarter', quarter);
      const nom = `${item.filename.replace('{year}', year)}`.replace('.csv', quarter && item.params.includes('quarter') ? `-T${quarter}.csv` : '.csv');
      await downloadPdf(`${item.path}?${params.toString()}`, token, nom);
    } catch (e) { toast(e.message); } finally { setBusy(null); }
  }

  const pct = (n) => `${(Number(n) * 100).toFixed(2).replace('.', ',')} %`;
  const eur = (n) => `${Number(n).toLocaleString('fr-BE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

  return (
    <div>
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={2} />}
      {data && (
        <>
          <div className="compliance-filters">
            <label className="small">{tr('adminCommon.year')}</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{annees.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <label className="small">{tr('adminCompliance.quarter')}</label>
            <select value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              <option value="">{tr('adminCompliance.wholeYear')}</option>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
            </select>
          </div>
          <div className="compliance-grid">
            {data.items.map((item) => (
              <div key={item.key} className="compliance-export-card">
                <h4>{item.key === 'dac7' ? tr('adminCompliance.dac7Label') : tr('adminCompliance.f28129Label')}</h4>
                <p className="small" style={{ margin: 0 }}>{item.key === 'dac7' ? tr('adminCompliance.dac7Desc') : tr('adminCompliance.f28129Desc')}</p>
                <div className="row">
                  <button className="btn-teal" disabled={busy === item.key} onClick={() => telecharger(item)}>{busy === item.key ? '...' : tr('adminCompliance.downloadCsv', { year })}</button>
                  {item.params.includes('quarter') && quarter && <span className="small">T{quarter}</span>}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ margin: '18px 0 8px' }}>{tr('adminCompliance.thresholdsTitle')}</h3>
          {data.thresholds.length === 0 && <div className="empty">{tr('adminCompliance.noThresholds')}</div>}
          {data.thresholds.length > 0 && (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{tr('adminCommon.year')}</th>
                    <th>{tr('adminCompliance.thP2pMax')}</th>
                    <th>{tr('adminCompliance.thP2pWithholding')}</th>
                    <th>{tr('adminCompliance.thStudentHours')}</th>
                    <th>{tr('adminCompliance.thStudentSolidarity')}</th>
                    <th>{tr('adminCompliance.thStudentOrdinary')}</th>
                    <th>{tr('adminCompliance.thParentsCeiling')}</th>
                    <th>{tr('adminCompliance.thMinAge')}</th>
                    <th>{tr('adminCompliance.thFranchise')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thresholds.map((t) => (
                    <tr key={t.year}>
                      <td><b>{t.year}</b></td>
                      <td>{eur(t.p2pMaxGross)}</td>
                      <td>{pct(t.p2pWithholdingRate)}</td>
                      <td>{t.studentMaxHours} h</td>
                      <td>{pct(t.studentSolidarityRate)} / {pct(t.studentSolidarityEmployerRate)}</td>
                      <td>{pct(t.studentOrdinaryRate)} / {pct(t.studentOrdinaryEmployerRate)}</td>
                      <td>{eur(t.studentParentsCeiling)}</td>
                      <td>{t.studentMinAge}</td>
                      <td>{eur(t.franchiseMaxTurnover)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small" style={{ opacity: 0.7, marginTop: 10 }}>{tr('adminCompliance.thresholdsHint')}</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Onglet « Rétention » : volumes concernés par la politique de conservation, et la politique elle-même.
// ---------------------------------------------------------------------------------------------------------
function RetentionTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  function load() { setData(null); setErreur(null); api('/admin/compliance/retention', { token }).then(setData).catch((e) => setErreur(e.message)); }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = data ? [
    { key: 'deletedAccounts', n: data.deletedAccounts },
    { key: 'anonymisedAccounts', n: data.anonymisedAccounts },
    { key: 'ticketsOlderThan3y', n: data.ticketsOlderThan3y },
    { key: 'documentsExpired', n: data.documentsExpired },
    { key: 'gameScoresOlderThan1y', n: data.gameScoresOlderThan1y },
    { key: 'ordersOlderThan7y', n: data.ordersOlderThan7y },
    { key: 'privacyRequestsOlderThan5y', n: data.privacyRequestsOlderThan5y }
  ] : [];

  return (
    <div>
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!data && !erreur && <SkeletonCards count={2} />}
      {data && (
        <div className="compliance-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>{tr('adminCompliance.retentionCounts')}</h3>
            <div className="table-scroll">
              <table className="admin-table">
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.key}>
                      <td>{tr(`adminCompliance.ret_${l.key}`)}</td>
                      <td style={{ textAlign: 'right' }}><b style={{ color: l.n > 0 && l.key !== 'deletedAccounts' && l.key !== 'anonymisedAccounts' ? 'var(--gold-deep)' : 'inherit' }}>{l.n}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small" style={{ opacity: 0.7, marginTop: 10 }}>{tr('adminCompliance.retentionHint')}</p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>{tr('adminCompliance.retentionPolicy')}</h3>
            <ul className="compliance-policy">
              {data.policy.map((p) => (
                <li key={p.key}>
                  <span>{p.label}</span>
                  <b>{p.months === null ? tr('adminCompliance.whileActive') : tr('adminCompliance.months', { n: p.months })}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
