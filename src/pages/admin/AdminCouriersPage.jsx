import { useEffect, useMemo, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api, apiDownload } from '../../api';
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
import useEtatPage from '../../hooks/useEtatPage';
import urlSure from '../../urlSure';

// Dossiers livreurs (statuts économie collaborative / étudiant-indépendant / indépendant) : file de
// validation, pièces, identité, gains (brut / précompte / net par année et trimestre), contrats, journal ;
// configuration fiscale par année, drapeau P2P (journalisé), précompte retenu par mois, exports DAC7 et
// 281.29, journal d'audit. Aucun montant légal n'est écrit ici : tout vient de /admin/fiscal-config.
const euro = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString(getLocale()) : '-');
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const STATUTS = ['p2p', 'student_independent', 'independent'];
const ONGLETS = ['dossiers', 'parametres', 'precompte', 'exports', 'journal'];
const couleurCycle = (s) => (s === 'approved' ? 'var(--teal-deep)' : ['rejected', 'suspended', 'blocked_threshold'].includes(s) ? 'var(--red)' : 'inherit');
// Le plafond ne concerne que l'économie collaborative : les autres statuts n'en ont pas.
const pctPlafond = (r) => (r.statusType === 'p2p' && r.situation && r.situation.type === 'income' ? Math.round(Number(r.situation.pct || 0) * 100) : null);

// apiDownload et non un fetch à la main : c'est ce qui branche ces exports (précompte, DAC7) sur le
// traitement centralisé du 401. Une session expirée renvoie désormais vers la connexion au lieu
// d'afficher « Téléchargement impossible » sur une page devenue inerte.
const telecharger = (path, token, filename) => apiDownload(path, { token, filename });

export default function AdminCouriersPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useEtatPage('filtre', 'pending_review');
  const [typeFiltre, setTypeFiltre] = useEtatPage('type', 'all');
  const [nature, setNature] = useEtatPage('nature', 'all');
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selection, setSelection] = useState(null);
  const [onglet, setOnglet] = useEtatPage('onglet', 'dossiers');
  const [mode, setMode] = useViewMode('couriers', 'table');
  const { sort, toggle } = useTableSort('updatedAt');

  const load = () => { setErreur(null); return api('/admin/couriers', { token }).then(setData).catch((e) => setErreur(e.message)); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lifecycle = (s) => tr(`courierOnboarding.lifecycle_${s}`);
  const statut = (s) => (s && STATUTS.includes(s) ? tr(`courierOnboarding.status_${s}`) : s || '-');
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b>{estCompteTest(r) && <TestBadge />}<div className="small">{r.email}</div></>, sortValue: (r) => r.name },
    { key: 'statusType', label: tr('adminCouriers.colStatus'), get: (r) => <>{statut(r.statusType)}{r.statusVerifiedAt ? ' ✅' : ''}</>, sortValue: (r) => r.statusType || '' },
    { key: 'lifecycleStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: couleurCycle(r.lifecycleStatus) }}>{lifecycle(r.lifecycleStatus)}</span>, sortValue: (r) => r.lifecycleStatus },
    { key: 'identity', label: tr('adminCouriers.colIdentity'), get: (r) => (r.identity?.status === 'verified' ? <span className={`pill ${r.identity.provider === 'itsme' ? 'listing-on' : ''}`}>✅ {tr(`adminCouriers.provider_${r.identity.provider || 'manual'}`)}</span> : r.identity?.status === 'pending' ? '⏳' : '-'), sortValue: (r) => (r.identity?.status === 'verified' ? (r.identity.provider === 'itsme' ? 2 : 1) : 0) },
    { key: 'situation', label: tr('adminCouriers.colCap'), get: (r) => (pctPlafond(r) != null ? `${pctPlafond(r)} %` : '-'), sortValue: (r) => (pctPlafond(r) ?? -1), align: 'right' },
    { key: 'gross', label: tr('adminCouriers.colGross'), get: (r) => euro(r.grossTotal ?? 0), sortValue: (r) => Number(r.grossTotal || 0), align: 'right' },
    { key: 'zone', label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || '-'} · ${r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}`, sortValue: (r) => r.zone || '' },
    { key: 'updatedAt', label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt), sortValue: (r) => r.updatedAt }
  ];
  const lignes = useMemo(() => sortRows(filterBySearch((data?.rows ?? []).filter((r) => (filtre === 'all' || r.lifecycleStatus === filtre) && (typeFiltre === 'all' || r.statusType === typeFiltre) && natureOk(nature, r)), search, (r) => [r.name, r.email, r.zone, r.statusType]), colonnes, sort), [data, filtre, typeFiltre, nature, search, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const nbReels = useMemo(() => (data?.rows ?? []).filter((r) => estCompteReel(r)).length, [data]);
  const nbSupprimes = useMemo(() => (data?.rows ?? []).filter((r) => estCompteSupprime(r)).length, [data]);

  function exportCsv() {
    if (!lignes.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`dossiers-livreurs-${Date.now()}.csv`, lignes, [
      { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.email'), get: (r) => r.email },
      { label: tr('adminCouriers.colStatus'), get: (r) => r.statusType || '' }, { label: tr('adminCommon.status'), get: (r) => r.lifecycleStatus },
      { label: tr('adminCouriers.colIdentity'), get: (r) => r.identity?.status || '' }, { label: tr('adminCouriers.colCap'), get: (r) => (pctPlafond(r) ?? '') },
      { label: tr('adminCouriers.colGross'), get: (r) => Number(r.grossTotal || 0).toFixed(2) }, { label: tr('adminCouriers.colWithholding'), get: (r) => Number(r.withholdingTotal || 0).toFixed(2) },
      { label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || ''} ${r.vehicleType || ''}`.trim() },
      { label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt) }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="couriers" actions={<><ViewTabs onglet={onglet} setOnglet={setOnglet} tr={tr} />{onglet === 'dossiers' && <><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>}</>} />
      {onglet === 'parametres' && <Parametres tr={tr} token={token} toast={toast} />}
      {onglet === 'precompte' && <Precompte tr={tr} token={token} toast={toast} />}
      {onglet === 'exports' && <Exports tr={tr} token={token} toast={toast} />}
      {onglet === 'journal' && <JournalAudit tr={tr} token={token} />}
      {onglet === 'dossiers' && (
        <>
          {data && (
            <div className="stat-grid">
              <div className="stat-card highlight"><div className="num">{(data.rows ?? []).length}</div><div className="label">{tr('adminCouriers.kpiAll')}</div></div>
              <div className="stat-card"><div className="num">{nbReels}</div><div className="label">{tr('adminCouriers.kpiReal')}</div></div>
              {['pending_review', 'approved', 'blocked_threshold', 'rejected', 'draft'].map((s) => (
                <button key={s} type="button" className={`stat-card${filtre === s ? ' highlight' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setFiltre(filtre === s ? 'all' : s)}>
                  <div className="num">{data.counts?.[s] || 0}</div><div className="label">{lifecycle(s)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="admin-control-panel">
            <input aria-label={tr('adminCouriers.phSearch')} placeholder={tr('adminCouriers.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <div className="role-pick" style={{ margin: 0 }}>
              {['all', 'pending_review', 'approved', 'suspended', 'blocked_threshold', 'rejected', 'draft'].map((s) => <div key={s} className={`chip${filtre === s ? ' active' : ''}`} onClick={() => setFiltre(s)}>{s === 'all' ? tr('adminCommon.allM') : lifecycle(s)}</div>)}
            </div>
            {/* Les trois statuts légaux */}
            <div className="role-pick" style={{ margin: 0 }}>
              {['all', ...STATUTS].map((s) => <div key={s} className={`chip${typeFiltre === s ? ' active' : ''}`} onClick={() => setTypeFiltre(s)}>{s === 'all' ? tr('adminCommon.allM') : statut(s)}</div>)}
            </div>
            <NatureChips nature={nature} onChange={setNature} realCount={nbReels} deletedCount={nbSupprimes} labels={{ all: tr('adminCommon.allM'), real: tr('adminCommon.filterRealAccounts'), test: tr('adminCommon.filterTestAccounts'), deleted: tr('adminCommon.filterDeletedAccounts') }} />
            <ResultCount n={lignes.length} total={(data?.rows ?? []).length} />
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
              <div className="small">🪪 {statut(r.statusType)}{r.statusVerifiedAt ? ' ✅' : ''} · {r.identity?.status === 'verified' ? `✅ ${tr('adminCouriers.colIdentity')}` : r.identity?.status === 'pending' ? `⏳ ${tr('adminCouriers.colIdentity')}` : `· ${tr('adminCouriers.colIdentity')}`}{pctPlafond(r) != null ? ` · ${tr('adminCouriers.colCap')} ${pctPlafond(r)} %` : ''} · {tr('adminCouriers.colGross')} {euro(r.grossTotal ?? 0)}</div>
              <div className="small">🛵 {r.zone || '-'} · {r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}</div>
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
      {ONGLETS.map((o) => <div key={o} className={`chip${onglet === o ? ' active' : ''}`} onClick={() => setOnglet(o)}>{tr(`adminCouriers.tab_${o}`)}</div>)}
    </div>
  );
}

// Fiche d'un dossier dans le tiroir commun de l'ERP (onglets Dossier / Documents / Gains / Décision /
// Journal). Toutes les décisions passent par une confirmation, avec motif quand le serveur l'exige.
function DossierDrawer({ id, tr, token, toast, onClose, onChanged }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const [d, setD] = useState(null); const [erreur, setErreur] = useState(null); const [busy, setBusy] = useState(false); const [nouveauStatut, setNouveauStatut] = useState('independent');
  const [onglet, setOnglet] = useState('dossier');
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [motifDialog, setMotifDialog] = useState(null); // { title, message, label, danger, confirmLabel, required, run(reason) }
  const load = () => { setErreur(null); return api(`/admin/couriers/${id}`, { token }).then(setD).catch((e) => setErreur(e.message)); };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function agir(fn, ok) { setBusy(true); try { await fn(); if (ok) toast(ok); await load(); onChanged(); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  const statut = (x) => (x && STATUTS.includes(x) ? tr(`courierOnboarding.status_${x}`) : x || '-');
  const c = d?.courier; const s = d?.situation;
  const documents = d?.documents ?? []; const events = d?.events ?? []; const contracts = d?.contracts ?? []; const missing = d?.missing ?? [];
  const gains = d?.earnings ?? { byYear: [], byQuarter: [] };

  const drawer = (contenu) => createPortal(
    <RecordDrawer
      title={d?.user?.name || '…'}
      subtitle={d ? `${d.user?.email || ''}${d.user?.phone ? ` · ${d.user.phone}` : ''}` : ''}
      badge={c ? <span className="pill" style={{ color: couleurCycle(c.lifecycleStatus) }}>{tr(`courierOnboarding.lifecycle_${c.lifecycleStatus}`)}</span> : null}
      tabs={d ? [
        { key: 'dossier', label: tr('adminCouriers.tabFile') },
        { key: 'documents', label: tr('adminCommon.tabDocuments'), count: documents.length },
        { key: 'gains', label: tr('adminCouriers.secEarnings') },
        { key: 'decision', label: tr('adminCouriers.secDecision') },
        { key: 'journal', label: tr('adminCommon.tabTimeline'), count: events.length }
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
  const identite = c.identity ?? {};
  const entreprise = c.independent ?? {};
  const caisse = c.socialInsuranceFund ?? c.student?.socialInsuranceFund ?? '';
  return drawer(
    <>
      {onglet === 'dossier' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secStatus')}</h4>
          <DrawerRow label={tr('adminCouriers.colStatus')} value={`${statut(c.statusType)}${c.statusVerifiedAt ? ` · ✅ ${tr('adminCouriers.statusVerifiedAt')} ${fmt(c.statusVerifiedAt)}` : ` · ${tr('adminCouriers.statusNotVerified')}`}`} strong />
          <DrawerRow label={tr('adminCouriers.zoneVehicle')} value={`${c.zone || '-'} · ${c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : '-'}${c.licencePlate ? ` · ${c.licencePlate}` : ''}`} />
          <DrawerRow label="IBAN" value={c.iban || (c.payoutIbanKnown ? '••••' : '-')} />
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
          {c.statusType === 'student_independent' && <DrawerRow label={tr('adminCouriers.studentIndependent')} value={`${c.student?.school || '-'} · ${c.student?.academicYear || '-'} · ${tr('adminCouriers.caisse')} ${caisse || '-'}`} />}
          {['student_independent', 'independent'].includes(c.statusType) && <DrawerRow label={tr('adminCouriers.company')} value={`${entreprise.legalName || '-'} · BCE ${entreprise.companyNumber || '-'} · ${entreprise.vatStatus === 'assujetti' ? (entreprise.vatNumber || '-') : tr('courierOnboarding.vatFranchiseShort')} ${entreprise.companyVerified ? '✅' : ''}${c.statusType === 'independent' ? ` · ${tr('adminCouriers.caisse')} ${caisse || '-'}` : ''}`} />}
          {c.statusType === 'p2p' && <DrawerRow label={tr('adminCouriers.consents')} value={`${c.p2pHonourDeclaredAt ? '✅' : '❌'} ${tr('adminCouriers.honour')}${c.p2pHonourDeclaredAt ? ` (${fmt(c.p2pHonourDeclaredAt)})` : ''} · ${c.p2p?.nonProfessionalDeclared ? '✅' : '❌'} ${tr('adminCouriers.nonPro')} · ${c.p2p?.withholdingConsent ? '✅' : '❌'} ${tr('adminCouriers.withholding')} · ${c.p2p?.taxDataConsent ? '✅' : '❌'} ${tr('adminCouriers.taxData')}`} />}
          {c.requestedStatusType && <p className="small" style={{ color: 'var(--gold-deep)' }}>🔄 {tr('adminCouriers.requestedChange', { to: statut(c.requestedStatusType), reason: d.requestedStatusReason || '-' })}</p>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secIdentity')}</h4>
          <DrawerRow label={tr('adminCommon.status')} value={identite.status === 'verified' ? `✅ ${tr(`adminCouriers.provider_${identite.provider || 'manual'}`)}${identite.provider === 'itsme' ? ` — ${tr('adminCouriers.itsmeTrusted')}` : ''}` : `${identite.status || '-'}${identite.provider ? ` (${identite.provider})` : ''}`} />
          <DrawerRow label={tr('adminCouriers.verifiedName')} value={`${identite.firstName || ''} ${identite.lastName || ''}`.trim() || '-'} />
          <DrawerRow label={tr('adminCouriers.nameMatch')} value={`${tr('adminCouriers.account')} ${identite.nameMatchAccount == null ? '-' : identite.nameMatchAccount ? '✅' : '❌'} · Stripe ${identite.nameMatchStripe == null ? '-' : identite.nameMatchStripe ? '✅' : '❌'}`} />
          {identite.status !== 'verified' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="btn-outline" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markIdentityOk'), message: tr('adminCouriers.identityOkBody'), run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: true, firstName: d.user?.name?.split(' ')[0], lastName: d.user?.name?.split(' ').slice(1).join(' ') } }), tr('adminCouriers.toastIdentityOk')) })}>{tr('adminCouriers.markIdentityOk')}</button>
              <button className="btn-danger-ghost" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markIdentityKo'), message: tr('adminCouriers.identityKoBody'), danger: true, run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: false } })) })}>{tr('adminCouriers.markIdentityKo')}</button>
            </div>
          )}
          {['student_independent', 'independent'].includes(c.statusType) && !entreprise.companyVerified && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markCompanyOk'), run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { companyVerified: true } }), tr('adminCouriers.toastCompanyOk')) })}>{tr('adminCouriers.markCompanyOk')}</button>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secContracts', { n: contracts.length })}</h4>
          {contracts.map((k) => <div key={k.id} className="small">✍️ {statut(k.contractType)} {k.version}, {new Date(k.signedAt).toLocaleString(getLocale())}, {k.typedName}, <code>{(k.documentHash || '').slice(0, 12)}…</code>{k.pdfUrl && <>-<a href={urlSure(k.pdfUrl)} target="_blank" rel="noreferrer">PDF</a></>}</div>)}
          {contracts.length === 0 && <p className="small">-</p>}
        </>
      )}
      {onglet === 'documents' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secDocs', { n: documents.length })}</h4>
          {documents.length === 0 && <p className="small">-</p>}
          {documents.map((x) => (
            <div key={x.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
              <span className="small">{x.verifiedAt ? '✅' : x.rejectedReason ? '❌' : '⏳'} <a href={urlSure(x.fileUrl)} target="_blank" rel="noreferrer">{tr(`courierOnboarding.doc_${x.docType}`)}{x.side ? ` (${x.side})` : ''}</a>{x.expiresAt ? ` · ${tr('courierOnboarding.docExpires', { date: fmt(x.expiresAt) })}` : ''}{x.rejectedReason ? ` · ${x.rejectedReason}` : ''}</span>
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
      {onglet === 'gains' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secEarnings')}</h4>
          {c.statusType === 'p2p' && s && s.type === 'income' && <DrawerRow label={tr('adminCouriers.colCap')} value={`${euro(s.used)} / ${euro(s.max)} (${Math.round(Number(s.pct || 0) * 100) } %)${s.bloque ? ' 🚫' : ''}`} strong />}
          {c.statusType === 'p2p' && <DrawerRow label={tr('adminCouriers.declaredExternalIncome')} value={euro(d.thresholds?.incomeExternalDeclared ?? d.thresholds?.grossIncomeExternalDeclared ?? 0)} />}
          <DrawerRow label={tr('adminCouriers.withholdingTotal')} value={euro(d.thresholds?.withholdingTotal ?? 0)} />
          <DrawerRow label={tr('adminCouriers.statusVerifiedAt')} value={c.statusVerifiedAt ? `✅ ${new Date(c.statusVerifiedAt).toLocaleString(getLocale())}` : tr('adminCouriers.statusNotVerified')} />
          {c.statusDocuments != null && (
            <>
              <p className="small" style={{ margin: '6px 0 2px' }}><b>{tr('adminCouriers.statusDocuments')}</b></p>
              {(Array.isArray(c.statusDocuments) ? c.statusDocuments : Object.entries(c.statusDocuments).map(([k, v]) => ({ type: k, ...((v && typeof v === 'object') ? v : { value: v }) }))).map((x, i) => (
                <div key={i} className="small" style={{ opacity: 0.85 }}>{x.type || x.docType || '-'}{x.verifiedAt ? ' ✅' : ''}{x.value != null && typeof x.value !== 'object' ? ` : ${String(x.value)}` : ''}</div>
              ))}
            </>
          )}
          <h4 className="drawer-section-title" style={{ marginTop: 12 }}>{tr('adminCouriers.earningsByYear')}</h4>
          {(gains.byYear ?? []).length === 0 && <p className="small">{tr('adminCouriers.noEarnings')}</p>}
          {(gains.byYear ?? []).length > 0 && (
            <table className="admin-table" style={{ width: '100%' }}>
              <thead><tr><th>{tr('adminCouriers.colYear')}</th><th>{tr('adminCouriers.colCount')}</th><th>{tr('adminCouriers.colGross')}</th><th>{tr('adminCouriers.colWithholding')}</th><th>{tr('adminCouriers.colNet')}</th></tr></thead>
              <tbody>{gains.byYear.map((y) => <tr key={y.year}><td>{y.year}</td><td>{y.deliveries ?? 0}</td><td>{euro(y.gross)}</td><td>{euro(y.withholding)}</td><td><b>{euro(y.net)}</b></td></tr>)}</tbody>
            </table>
          )}
          {(gains.byQuarter ?? []).length > 0 && (
            <>
              <h4 className="drawer-section-title" style={{ marginTop: 12 }}>{tr('adminCouriers.earningsByQuarter')}</h4>
              <table className="admin-table" style={{ width: '100%' }}>
                <thead><tr><th>{tr('adminCouriers.colQuarter')}</th><th>{tr('adminCouriers.colCount')}</th><th>{tr('adminCouriers.colGross')}</th><th>{tr('adminCouriers.colWithholding')}</th><th>{tr('adminCouriers.colNet')}</th></tr></thead>
                <tbody>{gains.byQuarter.map((q) => <tr key={`${q.year}-${q.quarter}`}><td>{q.year} T{q.quarter}</td><td>{q.count ?? 0}</td><td>{euro(q.gross)}</td><td>{euro(q.withholding)}</td><td><b>{euro(q.net)}</b></td></tr>)}</tbody>
              </table>
            </>
          )}
        </>
      )}
      {onglet === 'decision' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secDecision')}</h4>
          {missing.length > 0 && <p className="small" style={{ margin: '0 0 8px', color: 'var(--gold-deep)' }}>{tr('adminCouriers.missingList')} {missing.map((m) => tr(`courierOnboarding.missing_${m}`)).join(', ')}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {c.lifecycleStatus !== 'approved' && <button className="btn-teal" disabled={busy || (missing.length > 0 && c.lifecycleStatus !== 'suspended')} title={missing.length ? tr('adminCouriers.missingHint', { n: missing.length }) : ''} onClick={() => setMotifDialog({ title: c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve'), message: tr('adminCouriers.approveBody'), required: false, confirmLabel: c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: c.lifecycleStatus === 'suspended' ? 'reactivate' : 'approved', reason: reason || undefined } }), tr('adminCouriers.toastApproved')) })}>{c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve')}</button>}
            {c.lifecycleStatus === 'pending_review' && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.reject'), message: tr('adminCouriers.rejectBody'), danger: true, confirmLabel: tr('adminCouriers.reject'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'rejected', reason } }), tr('adminCouriers.toastRejected')) })}>{tr('adminCouriers.reject')}</button>}
            {['approved', 'blocked_threshold'].includes(c.lifecycleStatus) && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.suspend'), message: tr('adminCouriers.suspendBody'), danger: true, required: false, confirmLabel: tr('adminCouriers.suspend'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'suspended', reason: reason || undefined } })) })}>{tr('adminCouriers.suspend')}</button>}
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-changestatusto'}>{tr('adminCouriers.changeStatusTo')}</label><select id={idsA11y + '-changestatusto'} value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)}>{STATUTS.map((x) => <option key={x} value={x}>{statut(x)}</option>)}</select></div>
            <button className="btn-outline" disabled={busy || nouveauStatut === c.statusType} onClick={() => setConfirm({ title: tr('adminCouriers.changeStatus'), message: tr('adminCouriers.changeStatusConfirm'), danger: true, run: () => agir(() => api(`/admin/couriers/${id}/status-type`, { method: 'PATCH', token, body: { statusType: nouveauStatut } }), tr('adminCouriers.toastStatusChanged')) })}>{tr('adminCouriers.changeStatus')}</button>
          </div>
        </>
      )}
      {onglet === 'journal' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secLog')}</h4>
          {events.length === 0 && <p className="small">-</p>}
          <div className="small">{events.map((e, i) => <div key={i} style={{ padding: '2px 0' }}>{new Date(e.created_at || e.createdAt).toLocaleString(getLocale())}, <b>{e.event || e.action}</b> {e.details && Object.keys(e.details).length ? <span style={{ opacity: 0.7 }}>{JSON.stringify(e.details).slice(0, 120)}</span> : null}</div>)}</div>
        </>
      )}
    </>
  );
}

// Configuration fiscale par année (/admin/fiscal-config) + drapeau P2P. Les taux sont stockés en fraction
// (0.107) et saisis en pourcentage (10,7) ; les niveaux d'alerte en texte « 70,90 ».
const CHAMPS_FISCAUX = [
  ['p2pAnnualCeilingGross', '€'], ['p2pWithholdingRate', '%'], ['p2pAlertLevels', 'liste'], ['p2pForfaitRate', '%'],
  ['studentParentsCeiling', '€'], ['franchiseMaxTurnover', '€'],
  ['independentSocialRate', '%'], ['independentComplementaryExemption', '€'], ['independentMinQuarterly', '€'], ['independentStarterQuarterly', '€'],
  ['studentIndependentExemption', '€'], ['studentIndependentCeiling', '€'], ['adultMinAge', 'ans']
];
function versFormulaire(row) {
  const f = {};
  for (const [k, u] of CHAMPS_FISCAUX) {
    const v = row?.[k];
    if (u === '%') f[k] = v == null ? '' : String(Math.round(Number(v) * 100 * 10000) / 10000);
    else if (u === 'liste') f[k] = Array.isArray(v) ? v.join(',') : (v ?? '');
    else f[k] = v ?? '';
  }
  return f;
}
function versApi(f) {
  const body = {};
  for (const [k, u] of CHAMPS_FISCAUX) {
    const v = f[k];
    if (v === '' || v == null) continue;
    if (u === '%') body[k] = Number(String(v).replace(',', '.')) / 100;
    else if (u === 'liste') body[k] = String(v).split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
    else body[k] = Number(String(v).replace(',', '.'));
  }
  return body;
}

function Parametres({ tr, token, toast }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const [lignes, setLignes] = useState(null); const [flags, setFlags] = useState(null); const [busy, setBusy] = useState(false); const [erreur, setErreur] = useState(null);
  const an = new Date().getFullYear(); const [annee, setAnnee] = useState(an); const [f, setF] = useState(null);
  const [confirmP2p, setConfirmP2p] = useState(false);
  const charger = () => { setErreur(null); Promise.all([api('/admin/fiscal-config', { token }), api('/admin/flags', { token })]).then(([l, fl]) => { setLignes(Array.isArray(l) ? l : (l?.rows ?? [])); setFlags(fl ?? {}); }).catch((e) => setErreur(e.message)); };
  useEffect(charger, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!lignes) return;
    const l = lignes.find((x) => Number(x.year) === Number(annee));
    // Année inconnue : formulaire pré-rempli d'après l'année la plus récente, pour ne pas partir de zéro.
    setF(versFormulaire(l ?? [...lignes].sort((a, b) => b.year - a.year)[0] ?? null));
  }, [lignes, annee]);
  const derniere = useMemo(() => (lignes?.length ? Math.max(...lignes.map((x) => Number(x.year))) : an), [lignes, an]);
  const existe = !!lignes?.find((x) => Number(x.year) === Number(annee));
  async function sauver() {
    setBusy(true);
    try { await api(`/admin/fiscal-config/${annee}`, { method: 'PUT', token, body: versApi(f) }); toast(tr('adminCouriers.toastThresholdsSaved')); const l = await api('/admin/fiscal-config', { token }); setLignes(Array.isArray(l) ? l : (l?.rows ?? [])); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  function preparerSuivante() {
    const source = lignes.find((x) => Number(x.year) === derniere);
    setAnnee(derniere + 1); setF(versFormulaire(source ?? null)); toast(tr('adminCouriers.toastYearCreated', { year: derniere + 1 }));
  }
  async function basculerP2p() { setBusy(true); try { setFlags(await api('/admin/flags', { method: 'PATCH', token, body: { p2p_enabled: !flags.p2p_enabled } })); } catch (e) { toast(e.message); } finally { setBusy(false); setConfirmP2p(false); } }
  if (erreur) return <ErrorCard message={erreur} onRetry={charger} />;
  if (!lignes || !flags) return <SkeletonCards count={2} />;
  const p2pActif = !!(flags.p2p_enabled ?? flags.p2pEnabled);
  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🤝 {tr('adminCouriers.p2pFlagTitle')}</h3>
        <p className="small" style={{ margin: '0 0 6px' }}>{tr('adminCouriers.p2pFlagHelp')}</p>
        <p className="small" style={{ margin: '0 0 10px', opacity: 0.75 }}>📝 {tr('adminCouriers.p2pJournaled')}</p>
        <button className={p2pActif ? 'btn-danger-ghost' : 'btn-teal'} disabled={busy} onClick={() => setConfirmP2p(true)}>{p2pActif ? tr('adminCouriers.p2pDisable') : tr('adminCouriers.p2pEnable')}</button>
        <ConfirmDialog open={confirmP2p} title={p2pActif ? tr('adminCouriers.p2pDisable') : tr('adminCouriers.p2pEnable')} message={`${tr('adminCouriers.p2pFlagHelp')} ${tr('adminCouriers.p2pJournaled')}`} danger={p2pActif} loading={busy} onConfirm={basculerP2p} onCancel={() => setConfirmP2p(false)} />
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>⚖️ {tr('adminCouriers.fiscalTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.fiscalHelp')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ maxWidth: 160, margin: 0 }}><label htmlFor={idsA11y + '-year'}>{tr('adminCouriers.year')}</label><input id={idsA11y + '-year'} type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} /></div>
          <button className="btn-outline" disabled={busy} onClick={preparerSuivante}>➕ {tr('adminCouriers.createNextYear', { year: derniere + 1, from: derniere })}</button>
        </div>
        {f && (
          <div className="courier-grid" style={{ marginTop: 10 }}>
            {CHAMPS_FISCAUX.map(([k, u]) => (
              <div key={k} className="field">
                <label htmlFor={`bareme-${k}`}>{tr(`adminCouriers.th_${k}`)}{u === 'liste' ? '' : ` (${u})`}</label>
                <input id={`bareme-${k}`} type={u === 'liste' ? 'text' : 'number'} step="any" inputMode={u === 'liste' ? 'text' : 'decimal'} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} placeholder={u === 'liste' ? '70,90' : undefined} />
              </div>
            ))}
          </div>
        )}
        <button className="btn-teal" disabled={busy || !f} onClick={sauver}>{tr('adminCouriers.saveYear', { year: annee })}{existe ? '' : ' ✨'}</button>
        <p className="small" style={{ margin: '10px 0 0' }}>{tr('adminCouriers.yearsConfigured')} {lignes.map((l) => l.year).sort().join(', ') || '-'}</p>
        {existe && lignes.find((x) => Number(x.year) === Number(annee))?.updatedAt && <p className="small" style={{ margin: '4px 0 0', opacity: 0.7 }}>{tr('adminCouriers.colUpdated')} {new Date(lignes.find((x) => Number(x.year) === Number(annee)).updatedAt).toLocaleString(getLocale())}</p>}
      </div>
    </>
  );
}

// Précompte retenu par mois et par livreur (économie collaborative), avec les exports fiscaux de l'année.
function Precompte({ tr, token, toast }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear()); const [mois, setMois] = useState(now.getMonth() + 1);
  const [d, setD] = useState(null); const [erreur, setErreur] = useState(null);
  const charger = () => { setErreur(null); setD(null); api(`/admin/couriers/withholding?year=${annee}&month=${mois}`, { token }).then(setD).catch((e) => setErreur(e.message)); };
  useEffect(charger, [annee, mois]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (path, nom) => telecharger(path, token, nom).catch((e) => toast(e.message));
  const parLivreur = d?.byCourier ?? [];
  const mm = String(mois).padStart(2, '0');
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🧾 {tr('adminCouriers.withholdingTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.withholdingHelp')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-month'}>{tr('adminCouriers.month')}</label><select id={idsA11y + '-month'} value={mois} onChange={(e) => setMois(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString(getLocale(), { month: 'long' })}</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-year'}>{tr('adminCouriers.year')}</label><input id={idsA11y + '-year'} type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 110 }} /></div>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/withholding?year=${annee}&month=${mois}&format=csv`, `precompte-${annee}-${mm}.csv`)}>⬇️ {tr('adminCouriers.csvMonth')}</button>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/281-29?year=${annee}`, `fiches-281-29-${annee}.csv`)}>⬇️ {tr('adminCouriers.sheets281', { year: annee })}</button>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/dac7?year=${annee}`, `dac7-${annee}.csv`)}>⬇️ {tr('adminCouriers.dac7Year', { year: annee })}</button>
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!d && !erreur && <SkeletonCards count={1} />}
      {d && parLivreur.length === 0 && <div className="empty" style={{ marginTop: 10 }}>{tr('adminCouriers.noWithholding')}</div>}
      {d && parLivreur.length > 0 && (
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="admin-table">
            <thead><tr><th>{tr('adminCouriers.colCourier')}</th><th>{tr('adminCouriers.colLines')}</th><th>{tr('adminCouriers.colGross')}</th><th>{tr('adminCouriers.colWithholding')}</th><th>{tr('adminCouriers.colNet')}</th></tr></thead>
            <tbody>
              {parLivreur.map((r) => <tr key={r.courierId}><td><b>{r.name}</b><div className="small">{r.email}</div></td><td>{r.lines ?? 0}</td><td>{euro(r.gross)}</td><td>{euro(r.withholding)}</td><td>{euro(r.net)}</td></tr>)}
            </tbody>
            <tfoot><tr><td><b>{tr('adminCouriers.total')}</b></td><td>{d.count ?? parLivreur.reduce((a, r) => a + Number(r.lines || 0), 0)}</td><td>{euro(parLivreur.reduce((a, r) => a + Number(r.gross || 0), 0))}</td><td><b>{euro(d.total ?? parLivreur.reduce((a, r) => a + Number(r.withholding || 0), 0))}</b></td><td>{euro(parLivreur.reduce((a, r) => a + Number(r.net || 0), 0))}</td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Exports({ tr, token, toast }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const [annee, setAnnee] = useState(new Date().getFullYear()); const [trim, setTrim] = useState('');
  const go = (path, nom) => telecharger(path, token, nom).catch((e) => toast(e.message));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📤 {tr('adminCouriers.exportsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.exportsHelp')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-year-2'}>{tr('adminCouriers.year')}</label><input id={idsA11y + '-year-2'} type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ width: 110 }} /></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-quarter'}>{tr('adminCouriers.quarter')}</label><select id={idsA11y + '-quarter'} value={trim} onChange={(e) => setTrim(e.target.value)}><option value="">{tr('adminCouriers.allQuarters')}</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}</select></div>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/dac7?year=${annee}${trim ? `&quarter=${trim}` : ''}`, `dac7-${annee}${trim ? `-T${trim}` : ''}.csv`)}>⬇️ DAC7</button>
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/281-29?year=${annee}`, `fiches-281-29-${annee}.csv`)}>⬇️ 281.29</button>
      </div>
    </div>
  );
}

// Journal d'audit des actions sensibles (/admin/audit-log) : qui, quoi, sur quoi, avant → après.
function JournalAudit({ tr, token }) {
  const [lignes, setLignes] = useState(null); const [erreur, setErreur] = useState(null);
  const charger = () => { setErreur(null); api('/admin/audit-log?limit=200', { token }).then((r) => setLignes(Array.isArray(r) ? r : (r?.rows ?? []))).catch((e) => setErreur(e.message)); };
  useEffect(charger, []); // eslint-disable-line react-hooks/exhaustive-deps
  const court = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📝 {tr('adminCouriers.auditTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.auditHelp')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!lignes && !erreur && <SkeletonCards count={1} />}
      {lignes && lignes.length === 0 && <div className="empty">{tr('adminCouriers.auditNone')}</div>}
      {lignes && lignes.length > 0 && (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>{tr('adminCouriers.colWhen')}</th><th>{tr('adminCouriers.colActor')}</th><th>{tr('adminCouriers.colAction')}</th><th>{tr('adminCouriers.colTarget')}</th><th>{tr('adminCouriers.colDetails')}</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{l.createdAt ? new Date(l.createdAt).toLocaleString(getLocale()) : '-'}</td>
                  <td className="small">{l.actorName || l.actorId || '-'}</td>
                  <td><b>{l.action}</b></td>
                  <td className="small">{court(l.target)}</td>
                  <td className="small" style={{ maxWidth: 380, overflowWrap: 'anywhere', opacity: 0.8 }}>{court(l.before).slice(0, 160)}{l.before != null || l.after != null ? ' → ' : ''}{court(l.after).slice(0, 160)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
