import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, apiDownload } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort, sortRows } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, ResultCount } from '../../components/admin/AdminListTools';
import ConfirmDialog from '../../components/ConfirmDialog';
import ControlesSelfie from '../../components/admin/ControlesSelfie';
import DecisionDialog from '../../components/admin/DecisionDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import { estCompteReel, estCompteSupprime, estCompteTest, TestBadge, DeletedBadge, NatureChips, natureOk, filterBySearch, downloadCsv } from './adminUtils';
import useEtatPage from '../../hooks/useEtatPage';
import useDialogue from '../../hooks/useDialogue';
import ouvrirDocument, { ouvrirLienFrais } from '../../ouvrirDocument';
import { euros } from '../../prixPlat';
import { libelleManque } from '../../conformite';
import Icone from '../../components/Icone';

// Dossiers livreurs (statuts économie collaborative / étudiant-indépendant / indépendant) : file de
// validation, pièces, identité, gains (brut / précompte / net par année et trimestre), contrats, journal ;
// configuration fiscale par année, export DAC7, journal d'audit (plus de drapeau, précompte ni 281.29 P2P — CODE-12). Aucun montant légal n'est écrit ici : tout vient de /admin/fiscal-config.
const euro = (n) => euros(Number(n || 0));
const fmt = (d) => (d ? new Date(d).toLocaleDateString(getLocale()) : '-');
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
// CODE-12 : deux statuts, plus d'onglet « précompte » (il n'existait que pour l'économie collaborative, retirée).
const STATUTS = ['student_independent', 'independent'];
const ONGLETS = ['dossiers', 'controles', 'parametres', 'exports', 'journal'];
const couleurCycle = (s) => (s === 'approved' ? 'var(--teal-deep)' : ['rejected', 'suspended', 'blocked_threshold'].includes(s) ? 'var(--red)' : 'inherit');

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
  // Arrivé d'un livreur (« Ouvrir le dossier ») : tous les dossiers, sinon un brouillon serait caché par le filtre « à valider ».
  const [filtre, setFiltre] = useEtatPage('filtre', location.state?.presetSearch ? 'all' : 'pending_review', { forcer: !!location.state?.presetSearch });
  const [typeFiltre, setTypeFiltre] = useEtatPage('type', 'all');
  const [nature, setNature] = useEtatPage('nature', 'all');
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selection, setSelection] = useState(null);
  // ?onglet=controles : « selfie(s) à vérifier » de l'accueil ouvre l'onglet des contrôles (audit du 19/10, admin-69).
  const [params] = useSearchParams();
  const [onglet, setOnglet] = useEtatPage('onglet', params.get('onglet') || 'dossiers', { forcer: !!params.get('onglet') });
  const [mode, setMode] = useViewMode('couriers', 'table');
  const { sort, toggle } = useTableSort('updatedAt');

  const load = () => {
    setErreur(null);
    // PRÊT À ROULER, OU CE QUI MANQUE (règle du bouton GO, pretLancement.js) : à côté de chaque nom.
    api('/admin/launch/readiness', { token }).then((r) => setPrets(new Map((r.livreurs || []).map((l) => [l.userId, l])))).catch(() => {});
    return api('/admin/couriers', { token }).then(setData).catch((e) => setErreur(e.message));
  };
  const [prets, setPrets] = useState(() => new Map());
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Arrivé depuis Livreurs « Ouvrir le dossier » : si la recherche pré-remplie ne trouve qu'un dossier, il s'ouvre
  // (audit du 19/10, admin-87 : il fallait encore un clic sur la seule ligne de la liste).
  const ouvertAuto = useRef(false);
  useEffect(() => {
    if (ouvertAuto.current || !data || !location.state?.presetSearch) return;
    ouvertAuto.current = true;
    const q = String(location.state.presetSearch).toLowerCase();
    const trouves = (data.rows ?? []).filter((r) => [r.name, r.email].some((v) => String(v || '').toLowerCase().includes(q)));
    if (trouves.length === 1) setSelection(trouves[0].id);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const lifecycle = (s) => tr(`courierOnboarding.lifecycle_${s}`);
  const statut = (s) => (s && STATUTS.includes(s) ? tr(`courierOnboarding.status_${s}`) : s || '-');
  const pretDe = (r) => prets.get(r.userId);
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b>{estCompteTest(r) && <TestBadge />}<div className="small">{r.email}</div></>, sortValue: (r) => r.name },
    { key: 'pret', label: tr('adminCouriers.colReady'), get: (r) => {
      const p = pretDe(r);
      if (!p) return '-';
      const bloquant = (p.manques || []).find((m) => m.niveau === 'bloquant');
      return p.pret
        ? <span className="pill" style={{ color: 'var(--green)' }}><Icone nom="valider" taille={14} className="icone-texte" />{' '}{tr('adminCouriers.ready')}</span>
        : <span className="small" title={(p.manques || []).filter((m) => m.niveau === 'bloquant').map((m) => m.label).join(' · ')}>{tr('adminCouriers.missingFirst', { what: bloquant?.label || '' })}</span>;
    }, sortValue: (r) => (pretDe(r)?.pret ? 0 : 1) },
    // INSCRIPTION EXPRESS (2026-10-22) : le serveur valide seul un dossier tout vert ; sinon il dit ce que l'équipe doit regarder.
    { key: 'aRegarder', label: tr('adminCouriers.exARegarder'), get: (r) => (r.teamChecks?.length
      ? <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{r.teamChecks.map((p) => <span key={p} className="pill" style={{ color: 'var(--red)' }}>{tr(`adminCouriers.exPoint_${p}`)}</span>)}</span>
      : r.autoApprovedAt ? <span className="pill" style={{ color: 'var(--green)' }}><Icone nom="valider" taille={14} className="icone-texte" />{' '}{tr('adminCouriers.exAuto')}</span> : '-'),
      sortValue: (r) => (r.teamChecks?.length ? 0 : 1) },
    { key: 'statusType', label: tr('adminCouriers.colStatus'), get: (r) => <>{statut(r.statusType)}{r.statusVerifiedAt ? <Icone nom="valider" taille={16} className="icone-texte" /> : ''}</>, sortValue: (r) => r.statusType || '' },
    { key: 'lifecycleStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: couleurCycle(r.lifecycleStatus) }}>{lifecycle(r.lifecycleStatus)}</span>, sortValue: (r) => r.lifecycleStatus },
    { key: 'identity', label: tr('adminCouriers.colIdentity'), get: (r) => (r.identity?.status === 'verified' ? <span className="pill"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{tr(`adminCouriers.provider_${r.identity.provider || 'manual'}`)}</span> : r.identity?.status === 'pending' ? <Icone nom="horloge" taille={16} className="icone-texte" /> : '-'), sortValue: (r) => (r.identity?.status === 'verified' ? 1 : 0) },
    { key: 'gross', label: tr('adminCouriers.colGross'), get: (r) => euro(r.grossTotal ?? 0), sortValue: (r) => Number(r.grossTotal || 0), align: 'right' },
    { key: 'zone', label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || '-'} · ${r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}`, sortValue: (r) => r.zone || '' },
    { key: 'updatedAt', label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt), sortValue: (r) => r.updatedAt }
  ];
  const lignes = useMemo(() => sortRows(filterBySearch((data?.rows ?? []).filter((r) => (filtre === 'all' || (filtre === 'a_regarder' ? r.teamChecks?.length > 0 : r.lifecycleStatus === filtre)) && (typeFiltre === 'all' || r.statusType === typeFiltre) && natureOk(nature, r)), rechercheTel(search), (r) => [r.name, r.email, r.zone, r.statusType, telNational(r.phone)]), colonnes, sort), [data, filtre, typeFiltre, nature, search, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const nbReels = useMemo(() => (data?.rows ?? []).filter((r) => estCompteReel(r)).length, [data]);
  const nbARegarder = useMemo(() => (data?.rows ?? []).filter((r) => r.teamChecks?.length > 0).length, [data]);
  const nbSupprimes = useMemo(() => (data?.rows ?? []).filter((r) => estCompteSupprime(r)).length, [data]);

  function exportCsv() {
    if (!lignes.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`dossiers-livreurs-${Date.now()}.csv`, lignes, [
      { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.email'), get: (r) => r.email },
      { label: tr('adminCouriers.colStatus'), get: (r) => r.statusType || '' }, { label: tr('adminCommon.status'), get: (r) => r.lifecycleStatus },
      { label: tr('adminCouriers.colIdentity'), get: (r) => r.identity?.status || '' },
      { label: tr('adminCouriers.colGross'), get: (r) => Number(r.grossTotal || 0).toFixed(2) },
      { label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || ''} ${r.vehicleType || ''}`.trim() },
      { label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt) }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="couriers" actions={<><ViewTabs onglet={onglet} setOnglet={setOnglet} tr={tr} />{onglet === 'dossiers' && <><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>}</>} />
      {onglet === 'controles' && <ControlesSelfie token={token} toast={toast} />}
      {onglet === 'parametres' && <Parametres tr={tr} token={token} toast={toast} />}
      {onglet === 'exports' && <Exports tr={tr} token={token} toast={toast} />}
      {onglet === 'journal' && <JournalAudit tr={tr} token={token} />}
      {onglet === 'dossiers' && (
        <>
          {data && (
            <div className="stat-grid">
              <div className="stat-card highlight"><div className="num">{(data.rows ?? []).length}</div><div className="label">{tr('adminCouriers.kpiAll')}</div></div>
              <div className="stat-card"><div className="num">{nbReels}</div><div className="label">{tr('adminCouriers.kpiReal')}</div></div>
              {/* Ce que l'équipe a à regarder (inscription express) : un clic filtre la liste. */}
              <button type="button" className={`stat-card${filtre === 'a_regarder' ? ' highlight' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFiltre(filtre === 'a_regarder' ? 'all' : 'a_regarder')}>
                <div className="num" style={nbARegarder ? { color: 'var(--red)' } : undefined}>{nbARegarder}</div><div className="label">{tr('adminCouriers.exARegarder')}</div>
              </button>
              {['pending_review', 'approved', 'suspended', 'rejected', 'draft'].map((s) => (
                <button key={s} type="button" className={`stat-card${filtre === s ? ' highlight' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFiltre(filtre === s ? 'all' : s)}>
                  <div className="num">{data.counts?.[s] || 0}</div><div className="label">{lifecycle(s)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="admin-control-panel">
            <input aria-label={tr('adminCouriers.phSearch')} placeholder={tr('adminCouriers.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <div className="role-pick" style={{ margin: 0 }}>
              {['all', 'a_regarder', 'pending_review', 'approved', 'suspended', 'rejected', 'draft'].map((s) => <div key={s} className={`chip${filtre === s ? ' active' : ''}`} onClick={() => setFiltre(s)}>{s === 'all' ? tr('adminCommon.allM') : s === 'a_regarder' ? tr('adminCouriers.exARegarder') : lifecycle(s)}</div>)}
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
          {/* Plus de pourcentage de plafond sur les fiches (audit du 19/10, admin-07) : pctPlafond avait disparu avec le régime
              P2P (CODE-12) mais restait appelé ici, et la vue Fiches, mémorisée, plantait toute la page à chaque ouverture. */}
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
              <div className="small"><Icone nom="document" taille={16} className="icone-texte" />{' '}{statut(r.statusType)}{r.statusVerifiedAt ? <Icone nom="valider" taille={16} className="icone-texte" /> : ''} · {tr('adminCouriers.colIdentity')} {r.identity?.status === 'verified' ? tr('adminCouriers.identityStateVerified') : r.identity?.status === 'pending' ? tr('adminCouriers.identityStatePending') : r.identity?.status === 'failed' ? tr('adminCouriers.identityStateFailed') : tr('adminCouriers.identityStateNone')} · {tr('adminCouriers.colGross')} {euro(r.grossTotal ?? 0)}</div>
              <div className="small"><Icone nom="scooter" taille={16} className="icone-texte" />{' '}{r.zone || '-'} · {r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '-'}</div>
              <div className="small" style={{ opacity: 0.6 }}>{tr('adminCouriers.colUpdated')} {fmt(r.updatedAt)}</div>
            </div>
          ))}
          {selection && <DossierDrawer id={selection} tr={tr} token={token} toast={toast} onClose={() => setSelection(null)} onChanged={load} />}
        </>
      )}
    </div>
  );
}

/* « À REGARDER » (inscription express, 2026-10-22). Le serveur valide seul un dossier tout vert (routes/couriers.js ›
 * avancerDossier) ; sinon il dit ce que l'équipe doit regarder (d.teamChecks), et seulement ça. Un bouton par point ; quand
 * c'était le dernier, le dossier se valide aussitôt (réponse « validated ») et l'équipe le lit dans un message. Un dossier
 * validé sans personne le dit, avec la photo de profil qui reste à regarder. */
function ARegarder({ d, tr, token, busy, agir, onDocuments }) {
  const c = d.courier; const id = c.identity ?? {};
  const points = d.teamChecks ?? [];
  const photo = (d.documents ?? []).find((x) => x.docType === 'profile_photo' && !x.rejectedReason);
  if (!points.length && !d.autoApprovedAt) return null;
  const verifier = (corps, ok) => agir(() => api(`/admin/couriers/${c.id}/verify`, { method: 'PATCH', token, body: corps }), ok);
  const chiffres = String(c.independent?.companyNumber || '').replace(/\D/g, '');
  const registre = d.companyRegistry;
  const piece = id.documentType ? `${tr(`adminCouriers.exPiece_${id.documentType}`)}${id.documentCountry ? ` · ${id.documentCountry}` : ''}` : tr('adminCouriers.exPieceInconnue');
  const ligne = (cle, texte, actions) => (
    <div key={cle} className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
      <b>{tr(`adminCouriers.exPoint_${cle}`)}</b>
      <div className="small" style={{ margin: '2px 0 6px' }}>{texte}</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{actions}</div>
    </div>
  );
  return (
    <>
      {d.autoApprovedAt && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
          <b><Icone nom="valider" taille={16} className="icone-texte" />{' '}{tr('adminCouriers.exAutoLe', { date: fmt(d.autoApprovedAt) })}</b>
          {photo && !photo.verifiedAt && <div className="small" style={{ margin: '2px 0 6px' }}>{tr('adminCouriers.exPhotoARegarder')}</div>}
          {photo && !photo.verifiedAt && <button className="btn-outline" onClick={onDocuments}>{tr('adminCouriers.exVoirDocuments')}</button>}
        </div>
      )}
      {points.length > 0 && <h4 className="drawer-section-title" style={{ color: 'var(--red)' }}>{tr('adminCouriers.exARegarder')}</h4>}
      {points.includes('bce') && ligne('bce',
        tr('adminCouriers.exBceDetail', { num: c.independent?.companyNumber || '-', registre: !registre ? tr('adminCouriers.exRegistrePasLu') : registre.valid ? tr('adminCouriers.exRegistreValide', { name: registre.name }) : registre.valid === false ? tr('adminCouriers.exRegistreAbsent') : tr('adminCouriers.exRegistrePasLu'), nom: `${id.firstName || ''} ${id.lastName || ''}`.trim() || '-' }),
        <>
          {chiffres.length === 10 && <a className="btn-outline" href={`https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=${chiffres}`} target="_blank" rel="noopener noreferrer">{tr('adminCouriers.exOuvrirBce')}</a>}
          <button className="btn-teal" disabled={busy} onClick={() => verifier({ companyVerified: true }, tr('adminCouriers.toastCompanyOk'))}>{tr('adminCouriers.exBceOk')}</button>
        </>)}
      {points.includes('nationalite') && ligne('nationalite',
        tr('adminCouriers.exNatDetail', { declaree: c.nationalityGroup ? tr(`conformite.nationality_${c.nationalityGroup}`) : '-', piece }),
        <button className="btn-teal" disabled={busy} onClick={() => verifier({ nationalityVerified: true }, tr('adminCouriers.exNatToast'))}>{tr('adminCouriers.exNatOk')}</button>)}
      {points.includes('titre_sejour') && ligne('titre_sejour', tr('adminCouriers.exSejourDetail'), <button className="btn-outline" onClick={onDocuments}>{tr('adminCouriers.exVoirDocuments')}</button>)}
      {points.includes('identite') && ligne('identite', tr('adminCouriers.exIdentiteDetail'), <button className="btn-outline" onClick={onDocuments}>{tr('adminCouriers.exVoirDocuments')}</button>)}
    </>
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
export function DossierDrawer({ id, tr, token, toast, onClose, onChanged }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const [d, setD] = useState(null); const [erreur, setErreur] = useState(null); const [busy, setBusy] = useState(false); const [nouveauStatut, setNouveauStatut] = useState('independent');
  const [onglet, setOnglet] = useState('dossier');
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [motifDialog, setMotifDialog] = useState(null); // { title, message, label, danger, confirmLabel, required, run(reason) }
  const [decisionLivreur, setDecisionLivreur] = useState(false); // suspension motivée (B7, D6)
  const [identiteOk, setIdentiteOk] = useState(false); // identité vérifiée par l'équipe : comment, et le nom de la pièce (admin-42)
  const [demandeInfo, setDemandeInfo] = useState(false); // « Demander une info » (admin-70)
  const load = () => { setErreur(null); return api(`/admin/couriers/${id}`, { token }).then(setD).catch((e) => setErreur(e.message)); };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // `validated` : le geste de l'équipe était le dernier point à regarder, le serveur a validé le dossier (inscription express).
  async function agir(fn, ok) { setBusy(true); try { const r = await fn(); if (ok) toast(ok); if (r?.validated) toast(tr('adminCouriers.exValide'), 'succes'); await load(); onChanged(); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); } }
  const statut = (x) => (x && STATUTS.includes(x) ? tr(`courierOnboarding.status_${x}`) : x || '-');
  /* Le PDF d'un contrat signé n'a qu'une adresse signée de 5 minutes (audit sécurité 2026-10-31, décision d'Owen) et le
     tiroir reste souvent ouvert plus longtemps : le clic relit le dossier et ouvre l'adresse fraîche de ce contrat. */
  const ouvrirContrat = (contratId) => ouvrirLienFrais({
    toast,
    messageErreur: tr('courierOnboarding.docUnavailable'),
    lire: async () => {
      const frais = await api(`/admin/couriers/${id}`, { token });
      setD(frais);
      return frais?.contracts?.find((k) => k.id === contratId)?.pdfUrl;
    }
  });
  // Validation du dossier. Le serveur refuse (409 DOSSIER_INCOMPLET) tant qu'une pièce requise ou l'identité n'est pas
  // vérifiée : on montre alors ce qui bloque et on propose de valider quand même, avec un motif obligatoire (tracé).
  const libelleBlocage = (b) => (b === 'identite_non_verifiee' ? tr('adminCouriers.blockIdentity')
    : b.startsWith('document_non_verifie_') ? tr('adminCouriers.blockDocUnverified', { doc: tr(`courierOnboarding.doc_${b.slice(21)}`) })
      : libelleManque(b, tr));
  async function validerDossier(reason, force) {
    setBusy(true);
    try {
      await api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'approved', reason: reason || undefined, force: force || undefined } });
      toast(tr('adminCouriers.toastApproved')); await load(); onChanged();
    } catch (e) {
      if (e.code === 'DOSSIER_INCOMPLET' && !force) {
        setMotifDialog({ title: tr('adminCouriers.forceTitle'), message: tr('adminCouriers.forceBody', { points: (e.data?.blocking || []).map(libelleBlocage).join(', ') }), danger: true, confirmLabel: tr('adminCouriers.forceConfirm'), run: (motif) => validerDossier(motif, true) });
      } else toast(e.message, 'erreur');
    } finally { setBusy(false); }
  }
  const c = d?.courier;
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
      <ReasonDialog open={!!motifDialog} title={motifDialog?.title} message={motifDialog?.message} label={motifDialog?.label} placeholder={motifDialog?.placeholder} required={motifDialog?.required !== false} danger={motifDialog?.danger} confirmLabel={motifDialog?.confirmLabel} loading={busy}
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
          <ARegarder d={d} tr={tr} token={token} busy={busy} agir={agir} onDocuments={() => setOnglet('documents')} />
          <h4 className="drawer-section-title">{tr('adminCouriers.secStatus')}</h4>
          <DrawerRow label={tr('adminCouriers.colStatus')} value={`${statut(c.statusType)}${c.statusVerifiedAt ? ` · ${tr('adminCouriers.statusVerifiedAt')} ${fmt(c.statusVerifiedAt)}` : ` · ${tr('adminCouriers.statusNotVerified')}`}`} strong />
          <DrawerRow label={tr('adminCouriers.zoneVehicle')} value={`${c.zone || '-'} · ${c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : '-'}${c.licencePlate ? ` · ${c.licencePlate}` : ''}`} />
          {/* Demandé à l'inscription (2026-10-05) : autres plateformes et communes de préférence. */}
          <DrawerRow label={tr('adminCouriers.otherPlatforms')} value={c.otherPlatforms?.works === true
            ? ((c.otherPlatforms.list || []).map((p) => (p === 'autre' && c.otherPlatforms.note ? `${tr('auth.platform_autre')} (${c.otherPlatforms.note})` : tr(`auth.platform_${p}`))).join(', ') || tr('adminCouriers.platformsYesUnnamed'))
            : c.otherPlatforms?.works === false ? tr('adminCouriers.platformsNone') : tr('adminCouriers.notAnswered')} />
          <DrawerRow label={tr('adminCouriers.preferredZones')} value={(c.preferredZones || []).length ? c.preferredZones.join(', ') : tr('adminCouriers.notAnswered')} />
          <DrawerRow label="IBAN" value={c.iban || (c.payoutIbanKnown ? '••••' : '-')} />
          <DrawerRow label={tr('adminCouriers.bag')} value={c.bag?.option ? `${tr(`auth.bag_${c.bag.option}`)}${c.bag.option === 'fairide' ? ` · ${tr(`adminCouriers.bagDeposit_${c.bag.depositStatus}`, { amount: Number(c.bag.depositAmount || 40).toFixed(0) })} (${Number(c.bag.depositAmount || 40).toFixed(0)} €)` : ''}${c.bag.note ? ` · ${c.bag.note}` : ''}` : '-'} />
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
          {['student_independent', 'independent'].includes(c.statusType) && <DrawerRow label={tr('adminCouriers.company')} value={`${entreprise.legalName || '-'} · BCE ${entreprise.companyNumber || '-'} · ${entreprise.vatStatus === 'assujetti' ? (entreprise.vatNumber || '-') : tr('courierOnboarding.vatFranchiseShort')} ${entreprise.companyVerified ? ' ✓' : ''}${c.statusType === 'independent' ? ` · ${tr('adminCouriers.caisse')} ${caisse || '-'}` : ''}`} />}
          {c.requestedStatusType && <p className="small" style={{ color: 'var(--gold-deep)' }}><Icone nom="melanger" taille={16} className="icone-texte" />{' '}{tr('adminCouriers.requestedChange', { to: statut(c.requestedStatusType), reason: d.requestedStatusReason || '-' })}</p>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secIdentity')}</h4>
          <DrawerRow label={tr('adminCommon.status')} value={identite.status === 'verified' ? `${tr(`adminCouriers.provider_${identite.provider || 'manual'}`)}` : `${identite.status || '-'}${identite.provider ? ` (${identite.provider})` : ''}`} />
          {identite.rejectedReason && <DrawerRow label={tr('adminCouriers.identityKoReason')} value={identite.rejectedReason} />}
          <DrawerRow label={tr('adminCouriers.verifiedName')} value={`${identite.firstName || ''} ${identite.lastName || ''}`.trim() || '-'} />
          <DrawerRow label={tr('adminCouriers.nameMatch')} value={`${tr('adminCouriers.account')} ${identite.nameMatchAccount == null ? '-' : identite.nameMatchAccount ? '✓' : '✗'} · Stripe ${identite.nameMatchStripe == null ? '-' : identite.nameMatchStripe ? '✓' : '✗'}`} />
          {identite.status !== 'verified' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {/* Comment (en personne / sur la pièce déposée) et le nom tel qu'il figure sur la pièce (audit du 19/10, admin-42) :
                  c'était le nom du compte, et « manuel » même après un rendez-vous, si bien que le selfie restait demandé. */}
              <button className="btn-outline" disabled={busy} onClick={() => setIdentiteOk(true)}>{tr('adminCouriers.markIdentityOk')}</button>
              {/* Refus motivé : le motif part au livreur par e-mail et notification, et s'affiche dans son dossier (admin-43). */}
              <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.markIdentityKo'), message: tr('adminCouriers.identityKoBody'), label: tr('adminCouriers.identityKoReason'), danger: true, confirmLabel: tr('adminCouriers.markIdentityKo'), run: (reason) => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: false, reason } }), tr('adminCouriers.toastIdentityRefused')) })}>{tr('adminCouriers.markIdentityKo')}</button>
            </div>
          )}
          {identiteOk && (
            <IdentiteVerifieeDialog tr={tr} busy={busy} identite={identite} nomCompte={d.user?.name || ''}
              aDesPieces={documents.some((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && !x.rejectedReason)}
              onCancel={() => setIdentiteOk(false)}
              onConfirm={(corps) => { setIdentiteOk(false); agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: true, ...corps } }), tr('adminCouriers.toastIdentityOk')); }} />
          )}
          {identite.status !== 'verified' && (
            <details className="small" style={{ marginTop: 8 }}>
              <summary>{tr('adminCouriers.howCheckIdentity')}</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {['checkFace', 'checkName', 'checkExpiry', 'checkDocType'].map((k) => <li key={k}>{tr(`adminCouriers.${k}`)}</li>)}
              </ul>
            </details>
          )}
          {['student_independent', 'independent'].includes(c.statusType) && !entreprise.companyVerified && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.markCompanyOk'), run: () => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { companyVerified: true } }), tr('adminCouriers.toastCompanyOk')) })}>{tr('adminCouriers.markCompanyOk')}</button>}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCouriers.secContracts', { n: contracts.length })}</h4>
          {contracts.map((k) => <div key={k.id} className="small"><Icone nom="crayon" taille={16} className="icone-texte" />{' '}{statut(k.contractType)} {k.version}, {new Date(k.signedAt).toLocaleString(getLocale())}, {k.typedName}, <code>{(k.documentHash || '').slice(0, 12)}…</code>{k.pdfUrl && <>-<button type="button" className="lien-bouton" onClick={() => ouvrirContrat(k.id)}>PDF</button></>}</div>)}
          {contracts.length === 0 && <p className="small">-</p>}
        </>
      )}
      {onglet === 'documents' && (
        <>
          {/* DISPENSE DE CARTE PROFESSIONNELLE (audit du 19/10, admin-08). Hors EEE, un titre de séjour qui autorise
              l'activité indépendante dispense de la carte ; le livreur peut la DEMANDER, seule l'équipe l'ACCORDE (avec
              motif). Ce contrôle manquait : l'approbation renvoyait vers une case absente, et le livreur ne pouvait jamais
              rouler. Accordée, elle débloque l'approbation et les courses ; retirée, la carte redevient exigée. */}
          {c.nationalityGroup === 'THIRD' && (
            <>
              <h4 className="drawer-section-title">{tr('adminCouriers.secExemption')}</h4>
              <DrawerRow label={tr('adminCouriers.exemptionClaim')} value={c.selfEmploymentClaimedAt ? tr('adminCouriers.exemptionClaimedOn', { date: fmt(c.selfEmploymentClaimedAt) }) : tr('adminCouriers.exemptionNotClaimed')} />
              <DrawerRow label={tr('adminCouriers.exemptionDecision')} strong
                value={c.selfEmploymentByResidence ? tr('adminCouriers.exemptionGranted', { by: c.selfEmploymentByResidenceBy || '-', reason: c.selfEmploymentByResidenceReason || '-' }) : tr('adminCouriers.exemptionNotGranted')} />
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0 12px' }}>
                {!c.selfEmploymentByResidence && <button className="btn-outline" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.grantExemption'), message: tr('adminCouriers.grantExemptionBody'), label: tr('adminCouriers.grantExemptionReason'), placeholder: tr('adminCouriers.phGrantExemptionReason'), confirmLabel: tr('adminCouriers.grantExemption'), run: (reason) => agir(() => api(`/admin/couriers/${id}/self-employment-residence`, { method: 'PATCH', token, body: { value: true, reason } }), tr('adminCouriers.toastExemptionGranted')) })}>{tr('adminCouriers.grantExemption')}</button>}
                {c.selfEmploymentByResidence && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.withdrawExemption'), message: tr('adminCouriers.withdrawExemptionBody'), label: tr('adminCouriers.withdrawExemptionReason'), danger: true, confirmLabel: tr('adminCouriers.withdrawExemption'), run: (reason) => agir(() => api(`/admin/couriers/${id}/self-employment-residence`, { method: 'PATCH', token, body: { value: false, reason } }), tr('adminCouriers.toastExemptionWithdrawn')) })}>{tr('adminCouriers.withdrawExemption')}</button>}
              </div>
            </>
          )}
          <h4 className="drawer-section-title">{tr('adminCouriers.secDocs', { n: documents.length })}</h4>
          {documents.length === 0 && <p className="small">-</p>}
          {/* Hors UE/EEE : ce que Stripe ne vérifie pas — le titre de séjour et le droit d'exercer comme indépendant. */}
          {documents.some((x) => ['residence_permit', 'professional_card'].includes(x.docType)) && (
            <details className="small" style={{ margin: '0 0 8px' }}>
              <summary>{tr('adminCouriers.howCheckNonEu')}</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {['checkPermitName', 'checkPermitExpiry', 'checkProCard', 'checkInDoubt'].map((k) => <li key={k}>{tr(`adminCouriers.${k}`)}</li>)}
              </ul>
            </details>
          )}
          {documents.map((x) => (
            <div key={x.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
              <span className="small">{x.verifiedAt ? <Icone nom="valider" taille={16} className="icone-texte" /> : x.rejectedReason ? <Icone nom="croix" taille={16} className="icone-texte" /> : <Icone nom="horloge" taille={16} className="icone-texte" />} <button type="button" className="lien-bouton" onClick={() => ouvrirDocument({ url: x.prive ? null : x.fileUrl, lien: `/admin/couriers/${id}/documents/${x.id}/lien`, token, toast, messageErreur: tr('courierOnboarding.docUnavailable') })}>{tr(`courierOnboarding.doc_${x.docType}`)}{x.side ? ` (${x.side})` : ''}</button>{x.expiresAt ? ` · ${tr('courierOnboarding.docExpires', { date: fmt(x.expiresAt) })}` : ''}{x.rejectedReason ? ` · ${x.rejectedReason}` : ''}</span>
              {!x.verifiedAt && (
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn-outline btn-sm" disabled={busy} onClick={() => setConfirm({ title: tr('adminCouriers.acceptDoc', { doc: tr(`courierOnboarding.doc_${x.docType}`) }), run: () => agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: true } })) })}>✓ {tr('adminCouriers.accept')}</button>
                  <button className="btn-danger-ghost btn-sm" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.rejectDoc', { doc: tr(`courierOnboarding.doc_${x.docType}`) }), label: tr('adminCouriers.rejectDocPrompt'), danger: true, confirmLabel: tr('adminCouriers.reject'), run: (r) => agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: false, rejectedReason: r } })) })}>✗ {tr('adminCouriers.refuseShort')}</button>
                </span>
              )}
            </div>
          ))}
        </>
      )}
      {onglet === 'gains' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secEarnings')}</h4>
          <DrawerRow label={tr('adminCouriers.statusVerifiedAt')} value={c.statusVerifiedAt ? `${new Date(c.statusVerifiedAt).toLocaleString(getLocale())}` : tr('adminCouriers.statusNotVerified')} />
          {c.statusDocuments != null && (
            <>
              <p className="small" style={{ margin: '6px 0 2px' }}><b>{tr('adminCouriers.statusDocuments')}</b></p>
              {(Array.isArray(c.statusDocuments) ? c.statusDocuments : Object.entries(c.statusDocuments).map(([k, v]) => ({ type: k, ...((v && typeof v === 'object') ? v : { value: v }) }))).map((x, i) => (
                <div key={i} className="small" style={{ opacity: 0.85 }}>{x.type || x.docType || '-'}{x.verifiedAt ? <Icone nom="valider" taille={16} className="icone-texte" /> : ''}{x.value != null && typeof x.value !== 'object' ? ` : ${String(x.value)}` : ''}</div>
              ))}
            </>
          )}
          <h4 className="drawer-section-title" style={{ marginTop: 12 }}>{tr('adminCouriers.earningsByYear')}</h4>
          {(gains.byYear ?? []).length === 0 && <p className="small">{tr('adminCouriers.noEarnings')}</p>}
          {(gains.byYear ?? []).length > 0 && (
            <div className="table-scroll"><table className="admin-table" style={{ width: '100%' }}>
              <thead><tr><th>{tr('adminCouriers.colYear')}</th><th>{tr('adminCouriers.colCount')}</th><th>{tr('adminCouriers.colGross')}</th><th>{tr('adminCouriers.colWithholding')}</th><th>{tr('adminCouriers.colNet')}</th></tr></thead>
              <tbody>{gains.byYear.map((y) => <tr key={y.year}><td>{y.year}</td><td>{y.deliveries ?? 0}</td><td>{euro(y.gross)}</td><td>{euro(y.withholding)}</td><td><b>{euro(y.net)}</b></td></tr>)}</tbody>
            </table></div>
          )}
          {(gains.byQuarter ?? []).length > 0 && (
            <>
              <h4 className="drawer-section-title" style={{ marginTop: 12 }}>{tr('adminCouriers.earningsByQuarter')}</h4>
              <div className="table-scroll"><table className="admin-table" style={{ width: '100%' }}>
                <thead><tr><th>{tr('adminCouriers.colQuarter')}</th><th>{tr('adminCouriers.colCount')}</th><th>{tr('adminCouriers.colGross')}</th><th>{tr('adminCouriers.colWithholding')}</th><th>{tr('adminCouriers.colNet')}</th></tr></thead>
                <tbody>{gains.byQuarter.map((q) => <tr key={`${q.year}-${q.quarter}`}><td>{q.year} T{q.quarter}</td><td>{q.count ?? 0}</td><td>{euro(q.gross)}</td><td>{euro(q.withholding)}</td><td><b>{euro(q.net)}</b></td></tr>)}</tbody>
              </table></div>
            </>
          )}
        </>
      )}
      {onglet === 'decision' && (
        <>
          <h4 className="drawer-section-title">{tr('adminCouriers.secDecision')}</h4>
          {missing.length > 0 && <p className="small" style={{ margin: '0 0 8px', color: 'var(--gold-deep)' }}>{tr('adminCouriers.missingList')} {missing.map((m) => libelleManque(m, tr)).join(', ')}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {/* RÉACTIVER = RÉTABLIR LA DÉCISION (audit du 19/10, admin-37) : le serveur lève le dossier du registre et envoie
                le motif au livreur ; il est donc obligatoire. Approuver reste sans motif (sauf validation forcée). */}
            {c.lifecycleStatus === 'suspended' && <button className="btn-teal" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.reactivate'), message: tr('adminCouriers.reactivateBody'), label: tr('adminCouriers.reactivateReason'), confirmLabel: tr('adminCouriers.reactivate'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'reactivate', reason } }), tr('adminCouriers.toastReactivated')) })}>{tr('adminCouriers.reactivate')}</button>}
            {!['approved', 'suspended'].includes(c.lifecycleStatus) && <button className="btn-teal" disabled={busy || missing.length > 0} title={missing.length ? tr('adminCouriers.missingHint', { n: missing.length }) : ''} onClick={() => setMotifDialog({ title: tr('adminCouriers.approve'), message: tr('adminCouriers.approveBody'), required: false, confirmLabel: tr('adminCouriers.approve'), run: (reason) => validerDossier(reason, false) })}>{tr('adminCouriers.approve')}</button>}
            {/* Validé par erreur (audit du 19/10, admin-71) : retour « à valider » avec un motif, avant toute course. */}
            {c.lifecycleStatus === 'approved' && <button className="btn-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.unapprove'), message: tr('adminCouriers.unapproveBody'), label: tr('adminCouriers.unapproveReason'), confirmLabel: tr('adminCouriers.unapprove'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'unapprove', reason } }), tr('adminCouriers.toastUnapproved')) })}>{tr('adminCouriers.unapprove')}</button>}
            {/* Demander une info sans rien refuser (audit du 19/10, admin-70), comme pour un commerce : message dans
                Mon compte › Messages, et par e-mail ; le livreur répond au même endroit. */}
            {c.userId && <button className="btn-outline" disabled={busy} onClick={() => setDemandeInfo(true)}>{tr('adminCouriers.askInfo')}</button>}
            {c.lifecycleStatus === 'pending_review' && <button className="btn-danger-ghost" disabled={busy} onClick={() => setMotifDialog({ title: tr('adminCouriers.reject'), message: tr('adminCouriers.rejectBody'), danger: true, confirmLabel: tr('adminCouriers.reject'), run: (reason) => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'rejected', reason } }), tr('adminCouriers.toastRejected')) })}>{tr('adminCouriers.reject')}</button>}
            {/* Suspension (B7, D6) : décision humaine motivée, exposé des motifs envoyé, réexamen sous 14 jours. */}
            {['approved', 'blocked_threshold'].includes(c.lifecycleStatus) && <button className="btn-danger-ghost" disabled={busy} onClick={() => setDecisionLivreur(true)}>{tr('adminCouriers.suspend')}</button>}
            <DecisionDialog open={decisionLivreur} cible={c.name || ''} targetType="courier" loading={busy}
              onCancel={() => setDecisionLivreur(false)}
              onConfirm={async (payload) => { setDecisionLivreur(false); await agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'suspended', ...payload } }), tr(payload.measure === 'termination' ? 'adminCouriers.toastTerminated' : 'adminCouriers.toastSuspended')); }} />
            <ReasonDialog open={demandeInfo} title={tr('adminCouriers.askInfoTitle', { name: d.user?.name || '' })} message={tr('adminCouriers.askInfoBody')} label={tr('adminCouriers.askInfoLabel')} multiline confirmLabel={tr('adminCouriers.askInfoSend')} loading={busy}
              onCancel={() => setDemandeInfo(false)}
              onConfirm={(texte) => { setDemandeInfo(false); agir(() => api('/admin/messages/threads', { method: 'POST', token, body: { userId: c.userId, subject: tr('adminCouriers.askInfoSubject'), body: texte, notifyByEmail: true } }), tr('adminCouriers.askInfoSent')); }} />
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
          <div className="small">{events.map((e, i) => <div key={i} style={{ padding: '2px 0' }}>{new Date(e.created_at || e.createdAt).toLocaleString(getLocale())}, <b>{libelleEvenement(e.event || e.action, tr)}</b> {detailsLisibles(e.details) ? <span style={{ opacity: 0.7 }}>{detailsLisibles(e.details)}</span> : null}</div>)}</div>
        </>
      )}
    </>
  );
}

/* IDENTITÉ VÉRIFIÉE PAR L'ÉQUIPE (audit du 19/10, admin-42, LIVE-06). Deux questions avant d'enregistrer :
 *   - comment : « En personne » (rendez-vous, pièce comparée au visage → provider 'in_person' : le selfie n'est plus
 *     demandé, comme après Stripe Identity) ou « Sur la pièce déposée » ('manual' : le selfie reste demandé pour comparer) ;
 *     choisi d'avance selon ce que le livreur a demandé (rendez-vous) ou déposé ;
 *   - le prénom et le nom tels qu'ils figurent sur la pièce, préremplis depuis le compte, à corriger : c'est ce nom que
 *     la concordance compare au compte et à Stripe (avant : le nom du compte coupé au premier espace, toujours concordant). */
function IdentiteVerifieeDialog({ tr, busy, identite, nomCompte, aDesPieces, onConfirm, onCancel }) {
  const ids = useId();
  const racine = useRef(null);
  useDialogue(racine, onCancel); // Échap, focus dans la fenêtre, fond figé
  const mots = nomCompte.trim().split(/\s+/).filter(Boolean);
  const [fournisseur, setFournisseur] = useState(identite.provider === 'manual' || (identite.provider !== 'in_person' && aDesPieces) ? 'manual' : 'in_person');
  const [prenom, setPrenom] = useState(identite.firstName || mots[0] || '');
  const [nom, setNom] = useState(identite.lastName || mots.slice(1).join(' '));
  const pret = prenom.trim() && nom.trim();
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box admin-reason-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }} role="dialog" aria-modal="true" aria-labelledby={`${ids}-titre`} ref={racine} tabIndex={-1}>
        <h3 id={`${ids}-titre`} style={{ margin: '0 0 8px' }}>{tr('adminCouriers.markIdentityOk')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{tr('adminCouriers.identityOkBody')}</p>
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="small" style={{ marginBottom: 6 }}><b>{tr('adminCouriers.identityHow')}</b></legend>
          {[['in_person', 'identityHowInPerson'], ['manual', 'identityHowDocument']].map(([v, cle]) => (
            <label key={v} className="row small" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', margin: '0 0 4px' }}>
              <input type="radio" name={`${ids}-comment`} style={{ width: 'auto' }} checked={fournisseur === v} onChange={() => setFournisseur(v)} />
              <span>{tr(`adminCouriers.${cle}`)}</span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor={`${ids}-prenom`}>{tr('adminCouriers.identityFirstName')}</label>
          <input id={`${ids}-prenom`} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-nom`}>{tr('adminCouriers.identityLastName')}</label>
          <input id={`${ids}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>{tr('adminCommon.cancel')}</button>
          <button type="button" className="btn-gold" disabled={busy || !pret} onClick={() => onConfirm({ provider: fournisseur, firstName: prenom.trim(), lastName: nom.trim() })}>{busy ? '...' : tr('adminCouriers.markIdentityOk')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Configuration fiscale par année (/admin/fiscal-config). Les taux sont stockés en fraction (0.205) et saisis en
// pourcentage (20,5). (Plus de plafond, précompte ni drapeau P2P : économie collaborative retirée, CODE-12.)
const CHAMPS_FISCAUX = [
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
  const [lignes, setLignes] = useState(null); const [busy, setBusy] = useState(false); const [erreur, setErreur] = useState(null);
  const an = new Date().getFullYear(); const [annee, setAnnee] = useState(an); const [f, setF] = useState(null);
  const charger = () => { setErreur(null); api('/admin/fiscal-config', { token }).then((l) => setLignes(Array.isArray(l) ? l : (l?.rows ?? []))).catch((e) => setErreur(e.message)); };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    try { await api(`/admin/fiscal-config/${annee}`, { method: 'PUT', token, body: versApi(f) }); toast(tr('adminCouriers.toastThresholdsSaved')); const l = await api('/admin/fiscal-config', { token }); setLignes(Array.isArray(l) ? l : (l?.rows ?? [])); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  function preparerSuivante() {
    const source = lignes.find((x) => Number(x.year) === derniere);
    setAnnee(derniere + 1); setF(versFormulaire(source ?? null)); toast(tr('adminCouriers.toastYearCreated', { year: derniere + 1 }));
  }
  if (erreur) return <ErrorCard message={erreur} onRetry={charger} />;
  if (!lignes) return <SkeletonCards count={2} />;
  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}><Icone nom="balance" taille={16} className="icone-texte" />{' '}{tr('adminCouriers.fiscalTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.fiscalHelp')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ maxWidth: 160, margin: 0 }}><label htmlFor={idsA11y + '-year'}>{tr('adminCouriers.year')}</label><input id={idsA11y + '-year'} type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} /></div>
          <button className="btn-outline" disabled={busy} onClick={preparerSuivante}>{tr('adminCouriers.createNextYear', { year: derniere + 1, from: derniere })}</button>
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
        <button className="btn-teal" disabled={busy || !f} onClick={sauver}>{tr('adminCouriers.saveYear', { year: annee })}{existe ? '' : <Icone nom="etoile" taille={16} className="icone-texte" />}</button>
        <p className="small" style={{ margin: '10px 0 0' }}>{tr('adminCouriers.yearsConfigured')} {lignes.map((l) => l.year).sort().join(', ') || '-'}</p>
        {existe && lignes.find((x) => Number(x.year) === Number(annee))?.updatedAt && <p className="small" style={{ margin: '4px 0 0', opacity: 0.7 }}>{tr('adminCouriers.colUpdated')} {new Date(lignes.find((x) => Number(x.year) === Number(annee)).updatedAt).toLocaleString(getLocale())}</p>}
      </div>
    </>
  );
}

// Précompte retenu par mois et par livreur (économie collaborative), avec les exports fiscaux de l'année.
function Exports({ tr, token, toast }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const go = (path, nom) => telecharger(path, token, nom).catch((e) => toast(e.message, 'erreur'));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{tr('adminCouriers.exportsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.exportsHelp')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}><label htmlFor={idsA11y + '-year-2'}>{tr('adminCouriers.year')}</label><input id={idsA11y + '-year-2'} type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ width: 110 }} /></div>
        {/* Plus de choix du trimestre (audit du 19/10, admin-73) : le serveur exporte toujours l'année entière, et le fichier
            s'appelait « T3 » quand même. DAC7 se déclare par année. */}
        <button className="btn-outline" onClick={() => go(`/admin/couriers/export/dac7?year=${annee}`, `dac7-${annee}.csv`)}><Icone nom="telecharger" taille={16} className="icone-texte" />{' '}DAC7</button>
      </div>
    </div>
  );
}

// Journal du dossier (audit du 19/10, admin-87) : un libellé par événement plutôt que « review_reactivate {"reason":null} ».
// Un code inconnu reste affiché tel quel ; les détails en clair, sans les valeurs vides.
function libelleEvenement(code, tr) {
  const v = tr(`adminCouriers.event_${code}`);
  return v === `adminCouriers.event_${code}` ? code : v;
}
function detailsLisibles(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k} : ${String(v).slice(0, 80)}`).join(' · ').slice(0, 200);
}

// Un livreur au téléphone (audit du 19/10, admin-11 / C16) : son numéro, comparé sans indicatif ni 0 de tête ni
// séparateurs, pour que « 0470 12 34 56 », « +32470123456 » et « 470123456 » le retrouvent tous.
function telNational(v) { return String(v || '').replace(/\D/g, '').replace(/^(00)?32/, '').replace(/^0/, ''); }
function rechercheTel(q) { return /^[\d\s+()./-]{6,}$/.test(String(q || '').trim()) ? telNational(q) : q; }

// Journal d'audit des actions sensibles (/admin/audit-log) : qui, quoi, sur quoi, avant → après.
// Le serveur répond { entries } avec actorEmail (routes/couriers.js) : la page lisait rows et actorName, et restait vide
// — GO, approbations forcées, drapeaux invisibles (audit du 19/10, admin-36).
function JournalAudit({ tr, token }) {
  const [lignes, setLignes] = useState(null); const [erreur, setErreur] = useState(null);
  const charger = () => { setErreur(null); api('/admin/audit-log?limit=200', { token }).then((r) => setLignes(Array.isArray(r) ? r : (r?.entries ?? r?.rows ?? []))).catch((e) => setErreur(e.message)); };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const court = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}><Icone nom="document" taille={16} className="icone-texte" />{' '}{tr('adminCouriers.auditTitle')}</h3>
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
                  <td className="small">{l.actorEmail || l.actorName || l.actorId || '-'}</td>
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
