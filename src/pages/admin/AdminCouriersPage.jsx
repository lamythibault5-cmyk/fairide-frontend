import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, API_BASE } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort, sortRows } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, ResultCount } from '../../components/admin/AdminListTools';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import { estCompteReel, estCompteSupprime, estCompteTest, TestBadge, DeletedBadge, NatureChips, natureOk, filterBySearch, downloadCsv } from './adminUtils';

// Dossiers livreurs (statuts étudiant / P2P / indépendant) : file de validation, pièces, identité,
// compteurs légaux, contrats, journal ; paramètres légaux par année, drapeau P2P, exports DAC7 et 281.29.
const euro = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString(getLocale()) : '-');
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const couleurCycle = (s) => (s === 'approved' ? 'var(--teal-deep)' : ['rejected', 'suspended', 'blocked_threshold'].includes(s) ? 'var(--red)' : 'inherit');

async function telecharger(path, token, filename) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Téléchargement impossible.'); }
  const blob = await res.blob(); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function AdminCouriersPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('pending_review');
  const [nature, setNature] = useState('all');
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selection, setSelection] = useState(null);
  const [onglet, setOnglet] = useState('dossiers');
  const [mode, setMode] = useViewMode('couriers', 'table');
  const { sort, toggle } = useTableSort('updatedAt');

  const load = () => { setErreur(null); return api('/admin/couriers', { token }).then(setData).catch((e) => setErreur(e.message)); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lifecycle = (s) => tr(`courierOnboarding.lifecycle_${s}`);
  const statut = (s) => (s ? tr(`courierOnboarding.status_${s}`) : '-');
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b>{estCompteTest(r) && <TestBadge />}<div className="small">{r.email}</div></>, sortValue: (r) => r.name },
    { key: 'statusType', label: tr('adminCouriers.colStatus'), get: (r) => statut(r.statusType), sortValue: (r) => r.statusType || '' },
    { key: 'lifecycleStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: couleurCycle(r.lifecycleStatus) }}>{lifecycle(r.lifecycleStatus)}</span>, sortValue: (r) => r.lifecycleStatus },
    { key: 'identity', label: tr('adminCouriers.colIdentity'), get: (r) => (r.identity?.status === 'verified' ? `✅ ${r.identity.provider || ''}` : r.identity?.status === 'pending' ? '⏳' : '-'), sortValue: (r) => r.identity?.status || '' },
    { key: 'situation', label: tr('adminCouriers.colCap'), get: (r) => (r.situation && r.situation.type !== 'none' ? `${Math.round(r.situation.pct * 100)} %` : '-'), sortValue: (r) => (r.situation ? r.situation.pct : -1), align: 'right' },
    { key: 'zone', label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || '-'} · ${r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}`, sortValue: (r) => r.zone || '' },
    { key: 'requested', label: tr('adminCouriers.colRequested'), get: (r) => (r.requestedStatusType ? `→ ${statut(r.requestedStatusType)}` : ''), sortValue: (r) => r.requestedStatusType || '' },
    { key: 'updatedAt', label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt), sortValue: (r) => r.updatedAt }
  ];
  const lignes = useMemo(() => sortRows(filterBySearch((data?.rows || []).filter((r) => (filtre === 'all' || r.lifecycleStatus === filtre) && natureOk(nature, r)), search, (r) => [r.name, r.email, r.zone, r.statusType]), colonnes, sort), [data, filtre, nature, search, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const nbReels = useMemo(() => (data?.rows || []).filter((r) => estCompteReel(r)).length, [data]);
  const nbSupprimes = useMemo(() => (data?.rows || []).filter((r) => estCompteSupprime(r)).length, [data]);

  function exportCsv() {
    if (!lignes.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`dossiers-livreurs-${Date.now()}.csv`, lignes, [
      { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.email'), get: (r) => r.email },
      { label: tr('adminCouriers.colStatus'), get: (r) => r.statusType || '' }, { label: tr('adminCommon.status'), get: (r) => r.lifecycleStatus },
      { label: tr('adminCouriers.colIdentity'), get: (r) => r.identity?.status || '' }, { label: tr('adminCouriers.colCap'), get: (r) => (r.situation && r.situation.type !== 'none' ? Math.round(r.situation.pct * 100) : '') },
      { label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || ''} ${r.vehicleType || ''}`.trim() }, { label: tr('adminCouriers.colRequested'), get: (r) => r.requestedStatusType || '' },
      { label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt) }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="couriers" actions={<><ViewTabs onglet={onglet} setOnglet={setOnglet} tr={tr} />{onglet === 'dossiers' && <><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>}</>} />
      {onglet === 'parametres' && <Parametres tr={tr} token={token} toast={toast} />}
      {onglet === 'exports' && <Exports tr={tr} token={token} toast={toast} />}
      {onglet === 'dossiers' && (
        <>
          {data && (
            <div className="stat-grid">
              <div className="stat-card highlight"><div className="num">{(data.rows || []).length}</div><div className="label">{tr('adminCouriers.kpiAll')}</div></div>
              <div className="stat-card"><div className="num">{nbReels}</div><div className="label">{tr('adminCouriers.kpiReal')}</div></div>
              {['pending_review', 'approved', 'blocked_threshold', 'rejected', 'draft'].map((s) => (
                <button key={s} type="button" className={`stat-card${filtre === s ? ' highlight' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setFiltre(filtre === s ? 'all' : s)}>
                  <div className="num">{data.counts[s] || 0}</div><div className="label">{lifecycle(s)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="admin-control-panel">
            <input placeholder={tr('adminCouriers.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <div className="role-pick" style={{ margin: 0 }}>
              {['all', 'pending_review', 'approved', 'suspended', 'blocked_threshold', 'rejected', 'draft'].map((s) => <div key={s} className={`chip${filtre === s ? ' active' : ''}`} onClick={() => setFiltre(s)}>{s === 'all' ? tr('adminCommon.allM') : lifecycle(s)}</div>)}
            </div>
            <NatureChips nature={nature} onChange={setNature} realCount={nbReels} deletedCount={nbSupprimes} labels={{ all: tr('adminCommon.allM'), real: tr('adminCommon.filterRealAccounts'), test: tr('adminCommon.filterTestAccounts'), deleted: tr('adminCommon.filterDeletedAccounts') }} />
            <ResultCount n={lignes.length} total={(data?.rows || []).length} />
          </div>
          {erreur && <ErrorCard message={erreur} onRetry={load} />}
          {!data && !erreur && <SkeletonCards count={3} />}
          {data && lignes.length === 0 && <div className="empty">{tr('adminCouriers.none')}</div>}
          {data && mode === 'table' && lignes.length > 0 && (
            <AdminDataTable rows={lignes} sort={sort} onSort={toggle} onRowClick={(r) => setSelection(r.id)} columns={colonnes} rowClassName={(r) => (estCompteTest(r) ? 'row-test-account' : '')} emptyLabel={tr('adminCouriers.none')} />
          )}
          {data && mode === 'cards' && lignes.map((r) => (
            <div key={r.id} className={`card order-card-clickable${estCompteTest(r) ? ' card-test-account' : ''}`} onClick={() => setSelection(r.id)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{r.name}</b>
                <div className="row" style={{ gap: 6 }}>
                  {estCompteSupprime(r) ? <DeletedBadge /> : estCompteTest(r) && <TestBadge />}
                  <span className="pill" style={{ color: couleurCycle(r.lifecycleStatus) }}>{lifecycle(r.lifecycleStatus)}</span>
                </div>
              </div>
              <div className="small">{r.email}</div>
              <div className="small">🪪 {statut(r.statusType)} · {r.identity?.status === 'verified' ? `✅ ${tr('adminCouriers.colIdentity')}` : r.identity?.status === 'pending' ? `⏳ ${tr('adminCouriers.colIdentity')}` : `· ${tr('adminCouriers.colIdentity')}`}{r.situation && r.situation.type !== 'none' ? ` · ${tr('adminCouriers.colCap')} ${Math.round(r.situation.pct * 100)} %` : ''}</div>
              <div className="small">🛵 {r.zone || '-'} · {r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}{r.requestedStatusType ? ` · → ${statut(r.requestedStatusType)}` : ''}</div>
              <div className="small" style={{ opacity: 0.6 }}>{tr('adminCouriers.colUpdated')} {fmt(r.updatedAt)}</div>
            </div>
          ))}
          {selection && <DossierDrawer id={selection} tr={tr} token={token} toast={toast} onClose={() => setSelection(null)} onChanged={load} />}
        </>
      )}
    </div>
  );
}

function ViewTabs({ onglet, setOnglet, tr }) {
  return (
    <div className="role-pick" style={{ margin: 0 }}>
      {['dossiers', 'parametres', 'exports'].map((o) => <div key={o} className={`chip${onglet === o ? ' active' : ''}`} onClick={() => setOnglet(o)}>{tr(`adminCouriers.tab_${o}`)}</div>)}
    </div>
  );
}

// Fiche d'un dossier dans le tiroir commun de l'ERP (onglets Dossier / Documents / Plafonds / Décision /
// Journal). Toutes les décisions passent par une confirmation, avec motif quand le serveur l'exige.
function DossierDrawer({ id, tr, token, toast, onClose, onChanged }) {
  const { t } = useLanguage();
  const [d, setD] = useState(null); const [erreur, setErreur] = useState(null); const [busy, setBusy] = useState(false); const [nouveauStatut, setNouveauStatut] = useState('independent');
  const [onglet, setOnglet] = useState('dossier');
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [motifDialog, setMotifDialog] = useState(null); // { title, message, label, danger, confirmLabel, required, run(reason) }
  const load = () => { setErreur(null); return api(`/admin/couriers/${id}`, { token }).then(setD).catch((e) => setErreur(e.message)); };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function agir(fn, ok) { setBusy(true); try { await fn(); if (ok) toast(ok); await load(); onChanged(); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  const statut = (x) => (x ? tr(`courierOnboarding.status_${x}`) : '-');
  const c = d?.courier; const s = d?.situation;

  const drawer = (contenu) => createPortal(
    <RecordDrawer
      title={d?.user?.name || '…'}
      subtitle={d ? `${d.user?.email || ''}${d.user?.phone ? ` · ${d.user.phone}` : ''}` : ''}
      badge={c ? <span className="pill" style={{ color: couleurCycle(c.lifecycleStatus) }}>{tr(`courierOnboarding.lifecycle_${c.lifecycleStatus}`)}</span> : null}
      tabs={d ? [
        { key: 'dossier', label: tr('adminCouriers.tabFile') },
        { key: 'documents', label: tr('adminCommon.tabDocuments'), count: d.documents.length },
        { key: 'plafonds', label: tr('adminCouriers.secCaps') },
        { key: 'decision', label: tr('adminCouriers.secDecision') },
        { key: 'journal', label: tr('adminCommon.tabTimeline'), count: d.events.length }
      ] : null}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={680}
    >
      {contenu}
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} loading={busy}
        onConfirm={async () => { const c2 = confirm; setConfirm(null); await c2.run(); }} onCancel={() => setConfirm(null)} />
      <ReasonDialog open={!!motifDialog} title={motifDialog?.title} message={motifDialog?.message} label={motifDialog?.label} required={motifDialog?.required !== false} danger={motifDialog?.danger} confirmLabel={motifDialog?.confirmLabel} loading={busy}
        onConfirm={async (reason) => { const m = motifDialog; setMotifDialog(null); await m.run(reason); }} onCancel={() => setMotifDialog(null)} />
    </RecordDrawer>,
    document.body
  );

  if (erreur) return drawer(<ErrorCard message={erreur} onRetry={load} />);
  if (!d) return drawer(<SkeletonCards count={2} />);
  return drawer(
    <>
      {onglet === 'dossier' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secStatus')}</h4>
          <DrawerRow label={tr('adminCouriers.colStatus')} value={statut(c.statusType)} strong />
          <DrawerRow label={tr('adminCouriers.zoneVehicle')} value={`${c.zone || '-'} · ${c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : '-'}${c.licencePlate ? ` · ${c.licencePlate}` : ''}`} />
          <DrawerRow label="IBAN" value={c.iban || '-'} />
          <DrawerRow label={tr('adminCouriers.bag')} value={c.bag?.option ? `${tr(`auth.bag_${c.bag.option}`)}${c.bag.option === 'fairide' ? ` · ${tr(`adminCouriers.bagDeposit_${c.bag.depositStatus}`)} (${Number(c.bag.depositAmount || 40).toFixed(0)} €)` : ''}${c.bag.note ? ` · ${c.bag.note}` : ''}` : '-'} />
          {c.bag?.option === 'fairide' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {c.bag.depositStatus === 'due' && <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.bagMarkPaid'), message: tr('adminCouriers.bagMarkPaidBody', { amount: Number(c.bag.depositAmount || 40).toFixed(0) }), run: () => agir(() => api(`/admin/couriers/${c.id}/bag`, { method: 'PATCH', token, body: { depositStatus: 'paid' } }), tr('adminCommon.toastStatusUpdated')) })}>{tr('adminCouriers.bagMarkPaid')}</button>}
              {c.bag.depositStatus === 'paid' && <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.bagMarkReturned'), message: tr('adminCouriers.bagMarkReturnedBody'), run: () => agir(() => api(`/admin/couriers/${c.id}/bag`, { method: 'PATCH', token, body: { depositStatus: 'returned' } }), tr('adminCommon.toastStatusUpdated')) })}>{tr('adminCouriers.bagMarkReturned')}</button>}
              {c.bag.depositStatus === 'paid' && <button className="btn-danger-ghost" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.bagMarkKept'), message: tr('adminCouriers.bagMarkKeptBody', { amount: Number(c.bag.depositAmount || 40).toFixed(0) }), danger: true, run: () => agir(() => api(`/admin/couriers/${c.id}/bag`, { method: 'PATCH', token, body: { depositStatus: 'kept' } }), tr('adminCommon.toastStatusUpdated')) })}>{tr('adminCouriers.bagMarkKept')}</button>}
              {c.bag.depositStatus === 'returned' && <button className="btn-teal" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.bagMarkRefunded'), message: tr('adminCouriers.bagMarkRefundedBody', { amount: Number(c.bag.depositAmount || 40).toFixed(0) }), run: () => agir(() => api(`/admin/couriers/${c.id}/bag`, { method: 'PATCH', token, body: { depositStatus: 'refunded' } }), tr('adminCommon.toastStatusUpdated')) })}>{tr('adminCouriers.bagMarkRefunded')}</button>}
            </div>
          )}
          <DrawerRow label={tr('courierOnboarding.fBirthDate')} value={c.birthDate || '-'} />
          <DrawerRow label={tr('courierOnboarding.fNrn')} value={c.nationalNumberMasked || '-'} />
          {c.statusType === 'student' && <DrawerRow label={tr('adminCouriers.student')} value={`${c.student.school || '-'} · ${c.student.academicYear || '-'} · Student@work ${c.student.hoursRemainingDeclared ?? '-'} h`} />}
          {c.statusType === 'independent' && <DrawerRow label={tr('adminCouriers.company')} value={`${c.independent.legalName || '-'} · BCE ${c.independent.companyNumber || '-'} · ${c.independent.vatStatus === 'assujetti' ? c.independent.vatNumber : tr('courierOnboarding.vatFranchiseShort')} ${c.independent.companyVerified ? '✅' : ''}`} />}
          {c.statusType === 'p2p' && <DrawerRow label={tr('adminCouriers.consents')} value={`${c.p2p.nonProfessionalDeclared ? '✅' : '❌'} ${tr('adminCouriers.nonPro')} · ${c.p2p.withholdingConsent ? '✅' : '❌'} ${tr('adminCouriers.withholding')} · ${c.p2p.taxDataConsent ? '✅' : '❌'} ${tr('adminCouriers.taxData')}`} />}
          {d.requestedStatusType && <p className="small" style={{ color: 'var(--gold-deep)' }}>🔄 {tr('adminCouriers.requestedChange', { to: statut(d.requestedStatusType), reason: d.requestedStatusReason || '-' })}</p>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secIdentity')}</h4>
          <DrawerRow label={tr('adminCommon.status')} value={`${c.identity.status}${c.identity.provider ? ` (${c.identity.provider})` : ''}`} />
          <DrawerRow label={tr('adminCouriers.verifiedName')} value={`${c.identity.firstName} ${c.identity.lastName}`.trim() || '-'} />
          <DrawerRow label={tr('adminCouriers.nameMatch')} value={`${tr('adminCouriers.account')} ${c.identity.nameMatchAccount === null ? '-' : c.identity.nameMatchAccount ? '✅' : '❌'} · Stripe ${c.identity.nameMatchStripe === null ? '-' : c.identity.nameMatchStripe ? '✅' : '❌'}`} />
          {c.identity.status !== 'verified' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markIdentityOk'), message: tr('adminCouriers.identityOkBody'), run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: true, firstName: d.user?.name?.split(' ')[0], lastName: d.user?.name?.split(' ').slice(1).join(' ') } }), tr('adminCouriers.toastIdentityOk')) })}>{tr('adminCouriers.markIdentityOk')}</button>
              <button className="btn-danger-ghost" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markIdentityKo'), message: tr('adminCouriers.identityKoBody'), danger: true, run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: false } })) })}>{tr('adminCouriers.markIdentityKo')}</button>
            </div>
          )}
          {c.statusType === 'independent' && !c.independent.companyVerified && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markCompanyOk'), run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { companyVerified: true } }), tr('adminCouriers.toastCompanyOk')) })}>{tr('adminCouriers.markCompanyOk')}</button>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secContracts', { n: d.contracts.length })}</h4>
          {d.contracts.map((k) => <div key={k.id} className="small">✍️ {tr(`courierOnboarding.status_${k.contractType}`)} {k.version}, {new Date(k.signedAt).toLocaleString(getLocale())}, {k.typedName}, <code>{k.documentHash.slice(0, 12)}…</code>{k.pdfUrl && <>-<a href={k.pdfUrl} target="_blank" rel="noreferrer">PDF</a></>}</div>)}
          {d.contracts.length === 0 && <p className="small">-</p>}
        </>
      )}
      {onglet === 'documents' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secDocs', { n: d.documents.length })}</h4>
          {d.documents.length === 0 && <p className="small">-</p>}
          {d.documents.map((x) => (
            <div key={x.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
              <span className="small">{x.verifiedAt ? '✅' : x.rejectedReason ? '❌' : '⏳'} <a href={x.fileUrl} target="_blank" rel="noreferrer">{tr(`courierOnboarding.doc_${x.docType}`)}{x.side ? ` (${x.side})` : ''}</a>{x.expiresAt ? ` · ${tr('courierOnboarding.docExpires', { date: fmt(x.expiresAt) })}` : ''}{x.rejectedReason ? ` · ${x.rejectedReason}` : ''}</span>
              {!x.verifiedAt && (
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn-outline" style={{ padding: '2px 10px', fontSize: 12 }} disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.acceptDoc', { doc: tr(`courierOnboarding.doc_${x.docType}`) }), run: () => agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: true } })) })}>✓ {tr('adminCouriers.accept')}</button>
                  <button className="btn-danger-ghost" style={{ padding: '2px 10px', fontSize: 12 }} disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.rejectDoc', { doc: tr(`courierOnboarding.doc_${x.docType}`) }), label: tr('adminCouriers.rejectDocPrompt'), danger: true, confirmLabel: tr('adminCouriers.reject'), run: (r) => agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: false, rejectedReason: r } })) })}>✗ {tr('adminCouriers.refuseShort')}</button>
                </span>
              )}
            </div>
          ))}
        </>
      )}
      {onglet === 'plafonds' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secCaps')}</h4>
          {s && s.type !== 'none' ? <DrawerRow label={tr('adminCouriers.capUsed')} value={`${s.type === 'hours' ? `${s.used} h / ${s.max} h` : `${euro(s.used)} / ${euro(s.max)}`} (${Math.round(s.pct * 100)} %)`} strong /> : <p className="small">{tr('adminCouriers.noCap')}</p>}
          <DrawerRow label={tr('adminCouriers.declaredExternal')} value={`${d.thresholds.hoursExternalDeclared} h · ${euro(d.thresholds.grossIncomeExternalDeclared)}`} />
          <DrawerRow label={tr('adminCouriers.withholdingTotal')} value={euro(d.thresholds.withholdingTotal)} />
          {d.payouts.length > 0 && <div className="small" style={{ marginTop: 4 }}>{d.payouts.map((p) => <div key={`${p.year}-${p.quarter}`}>{p.year} T{p.quarter} : {p.courses} {tr('adminCommon.deliveries').toLowerCase()} · {tr('adminCouriers.gross')} {euro(p.gross)} · {tr('adminCouriers.withheld')} {euro(p.withholding)} · {tr('adminCouriers.net')} {euro(p.net)} · {p.hours.toFixed(1)} h</div>)}</div>}
          {c.statusType === 'student' && c.lifecycleStatus === 'blocked_threshold' && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.acceptOrdinary'), message: tr('adminCouriers.acceptOrdinaryBody'), run: () => agir(() => api(`/admin/couriers/${id}/status-type`, { method: 'PATCH', token, body: { acceptOrdinaryContributions: true } }), tr('adminCouriers.toastOrdinary')) })}>{tr('adminCouriers.acceptOrdinary')}</button>}
        </>
      )}
      {onglet === 'decision' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secDecision')}</h4>
          {d.missing.length > 0 && <p className="small" style={{ margin: '0 0 8px', color: 'var(--gold-deep)' }}>{tr('adminCouriers.missingList')} {d.missing.map((m) => tr(`courierOnboarding.missing_${m}`)).join(', ')}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {c.lifecycleStatus !== 'approved' && <button className="btn-teal" disabled={busy || (d.missing.length > 0 && c.lifecycleStatus !== 'suspended')} title={d.missing.length ? tr('adminCouriers.missingHint', { n: d.missing.length }) : ''} onClick={() => setMotifDialog({ title: c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve'), message: tr('adminCouriers.approveBody'), required: false, confirmLabel: c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: c.lifecycleStatus === 'suspended' ? 'reactivate' : 'approved', reason: reason || undefined } }), tr('adminCouriers.toastApproved')) })}>{c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve')}</button>}
            {c.lifecycleStatus === 'pending_review' && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.reject'), message: tr('adminCouriers.rejectBody'), danger: true, confirmLabel: tr('adminCouriers.reject'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'rejected', reason } }), tr('adminCouriers.toastRejected')) })}>{tr('adminCouriers.reject')}</button>}
            {['approved', 'blocked_threshold'].includes(c.lifecycleStatus) && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.suspend'), message: tr('adminCouriers.suspendBody'), danger: true, required: false, confirmLabel: tr('adminCouriers.suspend'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'suspended', reason: reason || undefined } })) })}>{tr('adminCouriers.suspend')}</button>}
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}><label>{tr('adminCouriers.changeStatusTo')}</label><select value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)}>{['student', 'p2p', 'independent'].map((x) => <option key={x} value={x}>{statut(x)}</option>)}</select></div>
            <button className="btn-outline" disabled={busy || nouveauStatut === c.statusType} onClick={() => setConfirm({ title: tr('adminCouriers.changeStatus'), message: tr('adminCouriers.changeStatusConfirm'), danger: true, run: () => agir(() => api(`/admin/couriers/${id}/status-type`, { method: 'PATCH', token, body: { statusType: nouveauStatut } }), tr('adminCouriers.toastStatusChanged')) })}>{tr('adminCouriers.changeStatus')}</button>
          </div>
        </>
      )}
      {onglet === 'journal' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secLog')}</h4>
          {d.events.length === 0 && <p className="small">-</p>}
          <div className="small">{d.events.map((e, i) => <div key={i} style={{ padding: '2px 0' }}>{new Date(e.created_at).toLocaleString(getLocale())}, <b>{e.event}</b> {e.details && Object.keys(e.details).length ? <span style={{ opacity: 0.7 }}>{JSON.stringify(e.details).slice(0, 120)}</span> : null}</div>)}</div>
        </>
      )}
    </>
  );
}

function Parametres({ tr, token, toast }) {
  const [lignes, setLignes] = useState(null); const [flags, setFlags] = useState(null); const [busy, setBusy] = useState(false); const [erreur, setErreur] = useState(null);
  const an = new Date().getFullYear(); const [annee, setAnnee] = useState(an); const [f, setF] = useState(null);
  const [confirmP2p, setConfirmP2p] = useState(false);
  const charger = () => { setErreur(null); Promise.all([api('/admin/legal-thresholds', { token }), api('/admin/flags', { token })]).then(([l, fl]) => { setLignes(l); setFlags(fl); }).catch((e) => setErreur(e.message)); };
  useEffect(charger, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const l = (lignes || []).find((x) => x.year === Number(annee)) || (lignes || [])[0]; if (l) setF({ p2pMaxGross: l.p2p_max_gross, studentMaxHours: l.student_max_hours, studentSolidarityRate: l.student_solidarity_rate, studentSolidarityEmployerRate: l.student_solidarity_employer_rate, studentOrdinaryRate: l.student_ordinary_rate, studentOrdinaryEmployerRate: l.student_ordinary_employer_rate, p2pWithholdingRate: l.p2p_withholding_rate, studentParentsCeiling: l.student_parents_ceiling, studentMinAge: l.student_min_age, franchiseMaxTurnover: l.franchise_max_turnover }); }, [lignes, annee]);
  const champs = [['p2pMaxGross', '€'], ['studentMaxHours', 'h'], ['studentSolidarityRate', 'taux'], ['studentSolidarityEmployerRate', 'taux'], ['studentOrdinaryRate', 'taux'], ['studentOrdinaryEmployerRate', 'taux'], ['p2pWithholdingRate', 'taux'], ['studentParentsCeiling', '€'], ['studentMinAge', 'ans'], ['franchiseMaxTurnover', '€']];
  async function sauver() { setBusy(true); try { await api(`/admin/legal-thresholds/${annee}`, { method: 'PUT', token, body: f }); toast(tr('adminCouriers.toastThresholdsSaved')); setLignes(await api('/admin/legal-thresholds', { token })); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  async function basculerP2p() { setBusy(true); try { setFlags(await api('/admin/flags', { method: 'PATCH', token, body: { p2p_enabled: !flags.p2p_enabled } })); } catch (e) { toast(e.message); } finally { setBusy(false); setConfirmP2p(false); } }
  if (erreur) return <ErrorCard message={erreur} onRetry={charger} />;
  if (!lignes || !flags) return <SkeletonCards count={2} />;
  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🤝 {tr('adminCouriers.p2pFlagTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.p2pFlagHelp')}</p>
        <button className={flags.p2p_enabled ? 'btn-danger-ghost' : 'btn-teal'} disabled={busy} onClick={() => setConfirmP2p(true)}>{flags.p2p_enabled ? tr('adminCouriers.p2pDisable') : tr('adminCouriers.p2pEnable')}</button>
        <ConfirmDialog open={confirmP2p} title={flags.p2p_enabled ? tr('adminCouriers.p2pDisable') : tr('adminCouriers.p2pEnable')} message={tr('adminCouriers.p2pFlagHelp')} danger={!!flags.p2p_enabled} loading={busy} onConfirm={basculerP2p} onCancel={() => setConfirmP2p(false)} />
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>⚖️ {tr('adminCouriers.thresholdsTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.thresholdsHelp')}</p>
        <div className="field" style={{ maxWidth: 160 }}><label>{tr('adminCouriers.year')}</label><input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} /></div>
        {f && (
          <div className="courier-grid">
            {champs.map(([k, u]) => <div key={k} className="field"><label>{tr(`adminCouriers.th_${k}`)} ({u})</label><input type="number" step="any" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>)}
          </div>
        )}
        <button className="btn-teal" disabled={busy || !f} onClick={sauver}>{tr('adminCouriers.saveYear', { year: annee })}</button>
        <p className="small" style={{ margin: '10px 0 0' }}>{tr('adminCouriers.yearsConfigured')} {lignes.map((l) => l.year).join(', ')}</p>
      </div>
    </>
  );
}

function Exports({ tr, token, toast }) {
  const [annee, setAnnee] = useState(new Date().getFullYear()); const [trim, setTrim] = useState('');
  const go = (path, nom) => telecharger(path, token, nom).catch((e) => toast(e.message));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📤 {tr('adminCouriers.exportsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.exportsHelp')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}><label>{tr('adminCouriers.year')}</label><input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ width: 110 }} /></div>
        <div className="field" style={{ margin: 0 }}><label>{tr('adminCouriers.quarter')}</label><select value={trim} onChange={(e) => setTrim(e.target.value)}><option value="">{tr('adminCouriers.allQuarters')}</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}</select></div>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/dac7?year=${annee}${trim ? `&quarter=${trim}` : ''}`, `dac7-${annee}${trim ? `-T${trim}` : ''}.csv`)}>⬇️ DAC7</button>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/281-29?year=${annee}`, `fiches-281-29-${annee}.csv`)}>⬇️ 281.29</button>
      </div>
    </div>
  );
}
