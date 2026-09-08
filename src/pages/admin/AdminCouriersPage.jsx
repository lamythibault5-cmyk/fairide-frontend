import { useEffect, useMemo, useState } from 'react';
import { api, API_BASE } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';

// Dossiers livreurs (statuts étudiant / P2P / indépendant) : file de validation, pièces, identité,
// compteurs légaux, contrats, journal ; paramètres légaux par année, drapeau P2P, exports DAC7 et 281.29.
const euro = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString(getLocale()) : '—');

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
  const [data, setData] = useState(null);
  const [filtre, setFiltre] = useState('pending_review');
  const [selection, setSelection] = useState(null);
  const [onglet, setOnglet] = useState('dossiers');
  const { sort, toggle } = useTableSort('updatedAt');

  const load = () => api('/admin/couriers', { token }).then(setData).catch((e) => toast(e.message));
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = useMemo(() => (data?.rows || []).filter((r) => filtre === 'all' || r.lifecycleStatus === filtre), [data, filtre]);
  const lifecycle = (s) => tr(`courierOnboarding.lifecycle_${s}`);
  const statut = (s) => (s ? tr(`courierOnboarding.status_${s}`) : '—');

  return (
    <div>
      <AdminPageHeader module="couriers" actions={<ViewTabs onglet={onglet} setOnglet={setOnglet} tr={tr} />} />
      {onglet === 'parametres' && <Parametres tr={tr} token={token} toast={toast} />}
      {onglet === 'exports' && <Exports tr={tr} token={token} toast={toast} />}
      {onglet === 'dossiers' && (
        <>
          {data && (
            <div className="stat-grid">
              {['pending_review', 'approved', 'blocked_threshold', 'rejected', 'draft'].map((s) => (
                <button key={s} type="button" className={`stat-card${filtre === s ? ' highlight' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setFiltre(filtre === s ? 'all' : s)}>
                  <div className="num">{data.counts[s] || 0}</div><div className="label">{lifecycle(s)}</div>
                </button>
              ))}
            </div>
          )}
          {!data && <SkeletonCards count={3} />}
          {data && lignes.length === 0 && <div className="empty">{tr('adminCouriers.none')}</div>}
          {data && lignes.length > 0 && (
            <AdminDataTable rows={lignes} sort={sort} onSort={toggle} onRowClick={(r) => setSelection(r.id)} columns={[
              { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b><div className="small">{r.email}</div></>, sortValue: (r) => r.name },
              { key: 'statusType', label: tr('adminCouriers.colStatus'), get: (r) => statut(r.statusType), sortValue: (r) => r.statusType || '' },
              { key: 'lifecycleStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: r.lifecycleStatus === 'approved' ? 'var(--teal-deep)' : ['rejected', 'suspended', 'blocked_threshold'].includes(r.lifecycleStatus) ? 'var(--red)' : 'inherit' }}>{lifecycle(r.lifecycleStatus)}</span>, sortValue: (r) => r.lifecycleStatus },
              { key: 'identity', label: tr('adminCouriers.colIdentity'), get: (r) => (r.identity.status === 'verified' ? `✅ ${r.identity.provider || ''}` : r.identity.status === 'pending' ? '⏳' : '—') },
              { key: 'situation', label: tr('adminCouriers.colCap'), get: (r) => (r.situation && r.situation.type !== 'none' ? `${Math.round(r.situation.pct * 100)} %` : '—'), sortValue: (r) => (r.situation ? r.situation.pct : -1), align: 'right' },
              { key: 'zone', label: tr('adminCouriers.colZone'), get: (r) => `${r.zone || '—'} · ${r.vehicleType ? tr(`courierOnboarding.vehicle_${r.vehicleType}`) : '—'}` },
              { key: 'requested', label: tr('adminCouriers.colRequested'), get: (r) => (r.requestedStatusType ? `→ ${statut(r.requestedStatusType)}` : '') },
              { key: 'updatedAt', label: tr('adminCouriers.colUpdated'), get: (r) => fmt(r.updatedAt), sortValue: (r) => r.updatedAt }
            ]} />
          )}
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

function DossierDrawer({ id, tr, token, toast, onClose, onChanged }) {
  const [d, setD] = useState(null); const [busy, setBusy] = useState(false); const [motif, setMotif] = useState(''); const [nouveauStatut, setNouveauStatut] = useState('independent');
  const load = () => api(`/admin/couriers/${id}`, { token }).then(setD).catch((e) => toast(e.message));
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function agir(fn, ok) { setBusy(true); try { await fn(); if (ok) toast(ok); await load(); onChanged(); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  if (!d) return null;
  const c = d.courier; const s = d.situation;
  const statut = (x) => (x ? tr(`courierOnboarding.status_${x}`) : '—');
  return (
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div><h3 style={{ margin: 0 }}>{d.user?.name}</h3><div className="small">{d.user?.email} · {d.user?.phone}</div></div>
          <span className="pill">{tr(`courierOnboarding.lifecycle_${c.lifecycleStatus}`)}</span>
        </div>
        <div className="divider" />
        <Section titre={tr('adminCouriers.secStatus')}>
          <Ligne k={tr('adminCouriers.colStatus')} v={statut(c.statusType)} />
          <Ligne k={tr('adminCouriers.zoneVehicle')} v={`${c.zone || '—'} · ${c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : '—'}${c.licencePlate ? ` · ${c.licencePlate}` : ''}`} />
          <Ligne k="IBAN" v={c.iban || '—'} />
          <Ligne k={tr('courierOnboarding.fBirthDate')} v={c.birthDate || '—'} />
          <Ligne k={tr('courierOnboarding.fNrn')} v={c.nationalNumberMasked || '—'} />
          {c.statusType === 'student' && <Ligne k={tr('adminCouriers.student')} v={`${c.student.school || '—'} · ${c.student.academicYear || '—'} · Student@work ${c.student.hoursRemainingDeclared ?? '—'} h`} />}
          {c.statusType === 'independent' && <Ligne k={tr('adminCouriers.company')} v={`${c.independent.legalName || '—'} · BCE ${c.independent.companyNumber || '—'} · ${c.independent.vatStatus === 'assujetti' ? c.independent.vatNumber : tr('courierOnboarding.vatFranchiseShort')} ${c.independent.companyVerified ? '✅' : ''}`} />}
          {c.statusType === 'p2p' && <Ligne k={tr('adminCouriers.consents')} v={`${c.p2p.nonProfessionalDeclared ? '✅' : '❌'} ${tr('adminCouriers.nonPro')} · ${c.p2p.withholdingConsent ? '✅' : '❌'} ${tr('adminCouriers.withholding')} · ${c.p2p.taxDataConsent ? '✅' : '❌'} ${tr('adminCouriers.taxData')}`} />}
          {d.requestedStatusType && <p className="small" style={{ color: 'var(--gold-deep)' }}>🔄 {tr('adminCouriers.requestedChange', { to: statut(d.requestedStatusType), reason: d.requestedStatusReason || '—' })}</p>}
        </Section>
        <Section titre={tr('adminCouriers.secIdentity')}>
          <Ligne k={tr('adminCommon.status')} v={`${c.identity.status}${c.identity.provider ? ` (${c.identity.provider})` : ''}`} />
          <Ligne k={tr('adminCouriers.verifiedName')} v={`${c.identity.firstName} ${c.identity.lastName}`.trim() || '—'} />
          <Ligne k={tr('adminCouriers.nameMatch')} v={`${tr('adminCouriers.account')} ${c.identity.nameMatchAccount === null ? '—' : c.identity.nameMatchAccount ? '✅' : '❌'} · Stripe ${c.identity.nameMatchStripe === null ? '—' : c.identity.nameMatchStripe ? '✅' : '❌'}`} />
          {c.identity.status !== 'verified' && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="btn-outline" disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: true, firstName: d.user?.name?.split(' ')[0], lastName: d.user?.name?.split(' ').slice(1).join(' ') } }), tr('adminCouriers.toastIdentityOk'))}>{tr('adminCouriers.markIdentityOk')}</button>
              <button className="btn-danger-ghost" disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { identityVerified: false } }))}>{tr('adminCouriers.markIdentityKo')}</button>
            </div>
          )}
          {c.statusType === 'independent' && !c.independent.companyVerified && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/verify`, { method: 'PATCH', token, body: { companyVerified: true } }), tr('adminCouriers.toastCompanyOk'))}>{tr('adminCouriers.markCompanyOk')}</button>}
        </Section>
        <Section titre={tr('adminCouriers.secDocs', { n: d.documents.length })}>
          {d.documents.length === 0 && <p className="small">—</p>}
          {d.documents.map((x) => (
            <div key={x.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
              <span className="small">{x.verifiedAt ? '✅' : x.rejectedReason ? '❌' : '⏳'} <a href={x.fileUrl} target="_blank" rel="noreferrer">{tr(`courierOnboarding.doc_${x.docType}`)}</a>{x.expiresAt ? ` · ${tr('courierOnboarding.docExpires', { date: fmt(x.expiresAt) })}` : ''}{x.rejectedReason ? ` — ${x.rejectedReason}` : ''}</span>
              {!x.verifiedAt && (
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: true } }))}>✓</button>
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} disabled={busy} onClick={() => { const r = window.prompt(tr('adminCouriers.rejectDocPrompt')); if (r !== null) agir(() => api(`/admin/couriers/${id}/documents/${x.id}`, { method: 'PATCH', token, body: { verified: false, rejectedReason: r } })); }}>✗</button>
                </span>
              )}
            </div>
          ))}
        </Section>
        <Section titre={tr('adminCouriers.secCaps')}>
          {s && s.type !== 'none' ? <Ligne k={tr('adminCouriers.capUsed')} v={`${s.type === 'hours' ? `${s.used} h / ${s.max} h` : `${euro(s.used)} / ${euro(s.max)}`} (${Math.round(s.pct * 100)} %)`} /> : <p className="small">{tr('adminCouriers.noCap')}</p>}
          <Ligne k={tr('adminCouriers.declaredExternal')} v={`${d.thresholds.hoursExternalDeclared} h · ${euro(d.thresholds.grossIncomeExternalDeclared)}`} />
          <Ligne k={tr('adminCouriers.withholdingTotal')} v={euro(d.thresholds.withholdingTotal)} />
          {d.payouts.length > 0 && <div className="small" style={{ marginTop: 4 }}>{d.payouts.map((p) => <div key={`${p.year}-${p.quarter}`}>{p.year} T{p.quarter} : {p.courses} {tr('adminCommon.deliveries').toLowerCase()} · {tr('adminCouriers.gross')} {euro(p.gross)} · {tr('adminCouriers.withheld')} {euro(p.withholding)} · {tr('adminCouriers.net')} {euro(p.net)} · {p.hours.toFixed(1)} h</div>)}</div>}
          {c.statusType === 'student' && c.lifecycleStatus === 'blocked_threshold' && <button className="btn-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/status-type`, { method: 'PATCH', token, body: { acceptOrdinaryContributions: true } }), tr('adminCouriers.toastOrdinary'))}>{tr('adminCouriers.acceptOrdinary')}</button>}
        </Section>
        <Section titre={tr('adminCouriers.secContracts', { n: d.contracts.length })}>
          {d.contracts.map((k) => <div key={k.id} className="small">✍️ {tr(`courierOnboarding.status_${k.contractType}`)} {k.version} — {new Date(k.signedAt).toLocaleString(getLocale())} — {k.typedName} — <code>{k.documentHash.slice(0, 12)}…</code>{k.pdfUrl && <> — <a href={k.pdfUrl} target="_blank" rel="noreferrer">PDF</a></>}</div>)}
          {d.contracts.length === 0 && <p className="small">—</p>}
        </Section>
        <Section titre={tr('adminCouriers.secDecision')}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input placeholder={tr('adminCouriers.reasonPh')} value={motif} onChange={(e) => setMotif(e.target.value)} style={{ flex: '1 1 200px' }} />
            {c.lifecycleStatus !== 'approved' && <button className="btn-teal" disabled={busy || (d.missing.length > 0 && c.lifecycleStatus !== 'suspended')} title={d.missing.length ? tr('adminCouriers.missingHint', { n: d.missing.length }) : ''} onClick={() => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: c.lifecycleStatus === 'suspended' ? 'reactivate' : 'approved' } }), tr('adminCouriers.toastApproved'))}>{c.lifecycleStatus === 'suspended' ? tr('adminCouriers.reactivate') : tr('adminCouriers.approve')}</button>}
            {c.lifecycleStatus === 'pending_review' && <button className="btn-danger-ghost" disabled={busy || !motif.trim()} onClick={() => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'rejected', reason: motif } }), tr('adminCouriers.toastRejected'))}>{tr('adminCouriers.reject')}</button>}
            {['approved', 'blocked_threshold'].includes(c.lifecycleStatus) && <button className="btn-danger-ghost" disabled={busy} onClick={() => agir(() => api(`/admin/couriers/${id}/review`, { method: 'PATCH', token, body: { decision: 'suspended', reason: motif } }))}>{tr('adminCouriers.suspend')}</button>}
          </div>
          {d.missing.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}>{tr('adminCouriers.missingList')} {d.missing.map((m) => tr(`courierOnboarding.missing_${m}`)).join(', ')}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}><label>{tr('adminCouriers.changeStatusTo')}</label><select value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)}>{['student', 'p2p', 'independent'].map((x) => <option key={x} value={x}>{statut(x)}</option>)}</select></div>
            <button className="btn-outline" disabled={busy || nouveauStatut === c.statusType} onClick={() => { if (window.confirm(tr('adminCouriers.changeStatusConfirm'))) agir(() => api(`/admin/couriers/${id}/status-type`, { method: 'PATCH', token, body: { statusType: nouveauStatut } }), tr('adminCouriers.toastStatusChanged')); }}>{tr('adminCouriers.changeStatus')}</button>
          </div>
        </Section>
        <Section titre={tr('adminCouriers.secLog')}>
          <div className="small" style={{ maxHeight: 160, overflow: 'auto' }}>{d.events.map((e, i) => <div key={i}>{new Date(e.created_at).toLocaleString(getLocale())} — <b>{e.event}</b> {e.details && Object.keys(e.details).length ? <span style={{ opacity: 0.7 }}>{JSON.stringify(e.details).slice(0, 120)}</span> : null}</div>)}</div>
        </Section>
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>
    </div>
  );
}
function Section({ titre, children }) { return <><h4 style={{ margin: '10px 0 6px' }}>{titre}</h4>{children}</>; }
function Ligne({ k, v }) { return <div className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '2px 0' }}><span className="small" style={{ opacity: 0.7 }}>{k}</span><span className="small" style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span></div>; }

function Parametres({ tr, token, toast }) {
  const [lignes, setLignes] = useState(null); const [flags, setFlags] = useState(null); const [busy, setBusy] = useState(false);
  const an = new Date().getFullYear(); const [annee, setAnnee] = useState(an); const [f, setF] = useState(null);
  useEffect(() => { api('/admin/legal-thresholds', { token }).then(setLignes).catch((e) => toast(e.message)); api('/admin/flags', { token }).then(setFlags).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const l = (lignes || []).find((x) => x.year === Number(annee)) || (lignes || [])[0]; if (l) setF({ p2pMaxGross: l.p2p_max_gross, studentMaxHours: l.student_max_hours, studentSolidarityRate: l.student_solidarity_rate, studentSolidarityEmployerRate: l.student_solidarity_employer_rate, studentOrdinaryRate: l.student_ordinary_rate, studentOrdinaryEmployerRate: l.student_ordinary_employer_rate, p2pWithholdingRate: l.p2p_withholding_rate, studentParentsCeiling: l.student_parents_ceiling, studentMinAge: l.student_min_age, franchiseMaxTurnover: l.franchise_max_turnover }); }, [lignes, annee]);
  const champs = [['p2pMaxGross', '€'], ['studentMaxHours', 'h'], ['studentSolidarityRate', 'taux'], ['studentSolidarityEmployerRate', 'taux'], ['studentOrdinaryRate', 'taux'], ['studentOrdinaryEmployerRate', 'taux'], ['p2pWithholdingRate', 'taux'], ['studentParentsCeiling', '€'], ['studentMinAge', 'ans'], ['franchiseMaxTurnover', '€']];
  async function sauver() { setBusy(true); try { await api(`/admin/legal-thresholds/${annee}`, { method: 'PUT', token, body: f }); toast(tr('adminCouriers.toastThresholdsSaved')); setLignes(await api('/admin/legal-thresholds', { token })); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  async function basculerP2p() { setBusy(true); try { setFlags(await api('/admin/flags', { method: 'PATCH', token, body: { p2p_enabled: !flags.p2p_enabled } })); } catch (e) { toast(e.message); } finally { setBusy(false); } }
  if (!lignes || !flags) return <SkeletonCards count={2} />;
  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🤝 {tr('adminCouriers.p2pFlagTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminCouriers.p2pFlagHelp')}</p>
        <button className={flags.p2p_enabled ? 'btn-danger-ghost' : 'btn-teal'} disabled={busy} onClick={basculerP2p}>{flags.p2p_enabled ? tr('adminCouriers.p2pDisable') : tr('adminCouriers.p2pEnable')}</button>
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
