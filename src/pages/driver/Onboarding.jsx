import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiUpload, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';

// Parcours d'inscription du livreur, en étapes : statut (étudiant / économie collaborative / indépendant),
// identité vérifiée (Stripe Identity aujourd'hui, itsme/eID dès le contrat itsme, ou dépôt manuel), infos et
// documents propres au statut, contrat signé, paiements Stripe, puis envoi à la validation Fairide.
// Une fois validé, la même page montre les compteurs légaux (heures étudiant / revenus P2P), les alertes,
// le renouvellement annuel et la demande de changement de statut.
const ETAPES = ['statut', 'identite', 'infos', 'contrat', 'paiement', 'envoi'];
const MANQUES_PAR_ETAPE = {
  statut: ['statut'], identite: ['identite', 'document_identity_card'],
  infos: ['date_naissance', 'registre_national', 'iban', 'zone', 'vehicule', 'permis_immatriculation', 'ecole', 'student_at_work_heures', 'age_minimum', 'consentements_p2p', 'bce', 'tva', 'tva_numero', 'siege', 'document_school_certificate', 'document_student_at_work', 'document_social_insurance_fund', 'document_liability_insurance'],
  contrat: ['contrat'], paiement: [], envoi: []
};
const euro = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;
// Un PDF protégé par le jeton ne peut pas être un simple lien : on le télécharge puis on l'ouvre.
async function ouvrirPdf(url, token, messageErreur) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(messageErreur);
    const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (e) { alert(e.message); }
}

export default function Onboarding() {
  const { t } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState(null);
  const [etape, setEtape] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = async () => { const r = await api('/couriers/me', { token }); setD(r); return r; };
  useEffect(() => {
    (async () => {
      try {
        let r = await charger();
        if (params.get('identity') === 'retour') { r = await api('/couriers/me/identity/refresh', { method: 'POST', token }); setD(r); params.delete('identity'); setParams(params, { replace: true }); }
        if (params.get('identity') === 'ok') { toast(t('courierOnboarding.identityOk')); params.delete('identity'); setParams(params, { replace: true }); }
        if (params.get('identity') === 'erreur') { toast(t('courierOnboarding.identityFailed')); params.delete('identity'); setParams(params, { replace: true }); }
      } catch (e) { toast(e.message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const premiereIncomplete = useMemo(() => {
    if (!d) return 'statut';
    for (const e of ETAPES) if (MANQUES_PAR_ETAPE[e].some((m) => d.missing.includes(m))) return e;
    return 'envoi';
  }, [d]);
  const courante = etape || premiereIncomplete;

  async function action(fn, ok) {
    setBusy(true);
    try { const r = await fn(); if (r && r.courier) setD(r); else await charger(); if (ok) toast(ok); return true; } catch (e) { toast(e.message); return false; } finally { setBusy(false); }
  }

  if (!d) return <SkeletonCards count={3} />;
  const c = d.courier; const legal = d.legal;
  const valide = c.lifecycleStatus === 'approved';
  const etapeOk = (e) => !MANQUES_PAR_ETAPE[e].some((m) => d.missing.includes(m));

  return (
    <div className="courier-onboarding">
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('courierOnboarding.title')}</h2>

      {/* État du dossier */}
      <EtatDossier d={d} t={t} onRefresh={charger} token={token} toast={toast} busy={busy} setBusy={setBusy} />

      {(c.lifecycleStatus === 'draft' || c.lifecycleStatus === 'rejected') && (
        <>
          <div className="courier-steps" role="tablist">
            {ETAPES.map((e, i) => (
              <button key={e} type="button" role="tab" aria-selected={courante === e} className={`courier-step${courante === e ? ' active' : ''}${etapeOk(e) ? ' done' : ''}`} onClick={() => setEtape(e)}>
                <span className="courier-step-num">{etapeOk(e) ? '✓' : i + 1}</span><span>{t(`courierOnboarding.step_${e}`)}</span>
              </button>
            ))}
          </div>

          {courante === 'statut' && <EtapeStatut d={d} t={t} busy={busy} onChoose={(statusType) => action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType } }), t('courierOnboarding.toastStatusSaved')).then((ok) => ok && setEtape('identite'))} />}
          {courante === 'identite' && <EtapeIdentite d={d} t={t} busy={busy} token={token} action={action} onNext={() => setEtape('infos')} />}
          {courante === 'infos' && <EtapeInfos d={d} t={t} busy={busy} token={token} action={action} onNext={() => setEtape('contrat')} />}
          {courante === 'contrat' && <EtapeContrat d={d} t={t} busy={busy} token={token} action={action} onNext={() => setEtape('paiement')} />}
          {courante === 'paiement' && <EtapePaiement d={d} t={t} busy={busy} token={token} user={user} onNext={() => setEtape('envoi')} />}
          {courante === 'envoi' && <EtapeEnvoi d={d} t={t} busy={busy} onSubmit={() => action(() => api('/couriers/me/submit', { method: 'POST', token }), t('courierOnboarding.toastSubmitted')).then(() => refreshUser?.())} onGoTo={setEtape} />}
        </>
      )}

      {(valide || c.lifecycleStatus === 'blocked_threshold' || c.lifecycleStatus === 'pending_review' || c.lifecycleStatus === 'suspended') && (
        <Compteurs d={d} t={t} token={token} action={action} busy={busy} />
      )}
      {(valide || c.lifecycleStatus === 'blocked_threshold') && <ChangementStatut d={d} t={t} token={token} action={action} busy={busy} />}
      <p className="small" style={{ marginTop: 16, opacity: 0.75 }}>{t('courierOnboarding.legalFooter', { year: legal.year })} · <Link to="/driver">{t('courierOnboarding.backToDashboard')}</Link></p>
    </div>
  );
}

function EtatDossier({ d, t }) {
  const c = d.courier;
  const libelle = t(`courierOnboarding.lifecycle_${c.lifecycleStatus}`);
  const tone = { draft: '', pending_review: 'warn', approved: 'ok', rejected: 'danger', suspended: 'danger', blocked_threshold: 'danger' }[c.lifecycleStatus] || '';
  return (
    <div className={`card courier-state ${tone}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <b>{libelle}</b>
          {c.statusType && <span className="pill teal" style={{ marginLeft: 8 }}>{t(`courierOnboarding.status_${c.statusType}`)}</span>}
          <p className="small" style={{ margin: '4px 0 0' }}>{t(`courierOnboarding.lifecycle_${c.lifecycleStatus}_help`)}</p>
          {c.lifecycleStatus === 'rejected' && c.reviewReason && <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{t('courierOnboarding.rejectedReason', { reason: c.reviewReason })}</p>}
          {c.needsRenewal && <p className="small" style={{ margin: '6px 0 0', color: 'var(--gold-deep)' }}>⚠️ {t('courierOnboarding.renewalNeeded')}</p>}
        </div>
        {c.submittedAt && <span className="small">{t('courierOnboarding.submittedOn', { date: new Date(c.submittedAt).toLocaleDateString(getLocale()) })}</span>}
      </div>
    </div>
  );
}

function EtapeStatut({ d, t, busy, onChoose }) {
  const legal = d.legal; const p2pOk = d.flags.p2pEnabled;
  const cartes = [
    { key: 'student', emoji: '🎓', plafond: t('courierOnboarding.cmpStudentCap', { h: legal.studentMaxHours }), fiscal: t('courierOnboarding.cmpStudentTax', { rate: (legal.studentSolidarityRate * 100).toFixed(2) }), docs: t('courierOnboarding.cmpStudentDocs'), delai: t('courierOnboarding.cmpDelayStudent'), age: t('courierOnboarding.cmpAge', { age: legal.studentMinAge }) },
    { key: 'p2p', emoji: '🤝', plafond: t('courierOnboarding.cmpP2pCap', { amount: euro(legal.p2pMaxGross), year: legal.year }), fiscal: t('courierOnboarding.cmpP2pTax', { rate: (legal.p2pWithholdingRate * 100).toFixed(1) }), docs: t('courierOnboarding.cmpP2pDocs'), delai: t('courierOnboarding.cmpDelayP2p'), age: t('courierOnboarding.cmpAge', { age: 18 }), soon: !p2pOk },
    { key: 'independent', emoji: '🧑‍💼', plafond: t('courierOnboarding.cmpIndepCap'), fiscal: t('courierOnboarding.cmpIndepTax', { max: euro(legal.franchiseMaxTurnover) }), docs: t('courierOnboarding.cmpIndepDocs'), delai: t('courierOnboarding.cmpDelayIndep'), age: t('courierOnboarding.cmpAge', { age: 18 }) }
  ];
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.chooseStatus')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.chooseStatusHelp')}</p>
      <div className="courier-compare">
        {cartes.map((k) => (
          <div key={k.key} className={`courier-compare-card${d.courier.statusType === k.key ? ' active' : ''}${k.soon ? ' soon' : ''}`}>
            <div className="courier-compare-head"><span style={{ fontSize: 26 }}>{k.emoji}</span><b>{t(`courierOnboarding.status_${k.key}`)}</b></div>
            <p className="small">{t(`courierOnboarding.status_${k.key}_desc`)}</p>
            <dl className="courier-compare-list">
              <dt>{t('courierOnboarding.cmpCap')}</dt><dd>{k.plafond}</dd>
              <dt>{t('courierOnboarding.cmpTax')}</dt><dd>{k.fiscal}</dd>
              <dt>{t('courierOnboarding.cmpDocs')}</dt><dd>{k.docs}</dd>
              <dt>{t('courierOnboarding.cmpDelay')}</dt><dd>{k.delai}</dd>
              <dt>{t('courierOnboarding.cmpAgeLabel')}</dt><dd>{k.age}</dd>
            </dl>
            {k.soon ? (
              <div className="small courier-soon">🔒 {t('courierOnboarding.p2pSoon')}</div>
            ) : (
              <button type="button" className={d.courier.statusType === k.key ? 'btn-outline' : 'btn-teal'} disabled={busy} onClick={() => onChoose(k.key)}>
                {d.courier.statusType === k.key ? t('courierOnboarding.chosen') : t('courierOnboarding.choose')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EtapeIdentite({ d, t, busy, token, action, onNext }) {
  const id = d.courier.identity; const prov = d.identityProviders;
  const fichier = useRef(null);
  async function demarrer(provider) {
    await action(async () => {
      const r = await api('/couriers/me/identity/start', { method: 'POST', token, body: { provider } });
      if (r.url) { window.location.href = r.url; return null; }
      return null;
    });
  }
  async function deposer(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    await action(() => apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType: 'identity_card' } }), t('courierOnboarding.toastDocUploaded'));
  }
  const carte = d.documents.filter((x) => x.docType === 'identity_card');
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.identityTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.identityHelp')}</p>
      {id.status === 'verified' ? (
        <div className="courier-ok">✅ {t('courierOnboarding.identityVerified', { name: `${id.firstName} ${id.lastName}`.trim(), provider: t(`courierOnboarding.provider_${id.provider}`) })}
          {id.nameMatchAccount === false && <p className="small" style={{ color: 'var(--red)', margin: '6px 0 0' }}>⚠️ {t('courierOnboarding.nameMismatch')}</p>}
        </div>
      ) : (
        <div className="courier-providers">
          <div className="courier-provider">
            <b>🪪 {t('courierOnboarding.provider_stripe_identity')}</b>
            <p className="small">{t('courierOnboarding.stripeIdentityHelp')}</p>
            <button type="button" className="btn-teal" disabled={busy || !prov.stripe_identity} onClick={() => demarrer('stripe_identity')}>{id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('courierOnboarding.identityStart')}</button>
            {id.status === 'processing' && <p className="small">⏳ {t('courierOnboarding.identityProcessing')}</p>}
            {id.status === 'failed' && <p className="small" style={{ color: 'var(--red)' }}>{t('courierOnboarding.identityFailed')}</p>}
          </div>
          <div className={`courier-provider${prov.itsme ? '' : ' soon'}`}>
            <b>📱 {t('courierOnboarding.provider_itsme')}</b>
            <p className="small">{t('courierOnboarding.itsmeHelp')}</p>
            {prov.itsme ? <button type="button" className="btn-teal" disabled={busy} onClick={() => demarrer('itsme')}>{t('courierOnboarding.identityStartItsme')}</button> : <span className="small courier-soon">🔒 {t('courierOnboarding.itsmeSoon')}</span>}
          </div>
          <div className="courier-provider">
            <b>📄 {t('courierOnboarding.provider_manual')}</b>
            <p className="small">{t('courierOnboarding.manualHelp')}</p>
            <input ref={fichier} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />
            <button type="button" className="btn-outline" disabled={busy} onClick={async () => { if (d.courier.identity.provider !== 'manual') await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } })); fichier.current?.click(); }}>{t('courierOnboarding.manualUpload')}</button>
            {carte.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}>✅ {t('courierOnboarding.manualUploaded', { n: carte.length })}</p>}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={onNext}>{t('courierOnboarding.next')}</button></div>
    </div>
  );
}

function Champ({ label, children, help }) {
  return <div className="field"><label>{label}</label>{children}{help && <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{help}</p>}</div>;
}

function EtapeInfos({ d, t, busy, token, action, onNext }) {
  const c = d.courier; const legal = d.legal;
  const [f, setF] = useState({ birthDate: c.birthDate, nationalNumber: '', iban: c.iban, zone: c.zone, vehicleType: c.vehicleType, licenceNumber: c.licenceNumber, licencePlate: c.licencePlate,
    schoolName: c.student.school, academicYear: c.student.academicYear, fullTimeSchooling: c.student.fullTimeSchooling, studentHoursRemaining: c.student.hoursRemainingDeclared ?? '',
    p2pNonProfessional: c.p2p.nonProfessionalDeclared, p2pWithholdingConsent: c.p2p.withholdingConsent, p2pTaxConsent: c.p2p.taxDataConsent,
    companyNumber: c.independent.companyNumber, vatStatus: c.independent.vatStatus, vatNumber: c.independent.vatNumber, legalName: c.independent.legalName, seatAddress: c.independent.seatAddress,
    hoursExternalDeclared: d.thresholds.hoursExternalDeclared, incomeExternalDeclared: d.thresholds.grossIncomeExternalDeclared });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const [expiry, setExpiry] = useState('');
  const fichiers = useRef({});
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);

  async function enregistrer() {
    const body = { ...f };
    if (!body.nationalNumber) delete body.nationalNumber;
    if (body.studentHoursRemaining === '') delete body.studentHoursRemaining;
    for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body }), t('courierOnboarding.toastSaved'));
    if (ok) setF((x) => ({ ...x, nationalNumber: '' }));
    return ok;
  }
  async function deposer(docType, e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType, expiresAt: docType === 'liability_insurance' ? expiry : undefined } }), t('courierOnboarding.toastDocUploaded'));
  }
  const docsRequis = [...(d.requiredDocuments[c.statusType] || []), ...(motorise ? ['driving_licence', 'vehicle_registration'] : [])];
  const docsDe = (type) => d.documents.filter((x) => x.docType === type);

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.infosTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.infosHelp')}</p>
      <div className="courier-grid">
        <Champ label={t('courierOnboarding.fBirthDate')}><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Champ>
        <Champ label={t('courierOnboarding.fNrn')} help={c.hasNationalNumber ? t('courierOnboarding.nrnStored', { masked: c.nationalNumberMasked }) : t('courierOnboarding.nrnHelp')}>
          <input inputMode="numeric" value={f.nationalNumber} onChange={set('nationalNumber')} placeholder="85.07.30-033.28" />
        </Champ>
        <Champ label={t('courierOnboarding.fIban')}><input value={f.iban} onChange={set('iban')} placeholder="BE68 5390 0754 7034" /></Champ>
        <Champ label={t('courierOnboarding.fZone')}>
          <select value={f.zone} onChange={set('zone')}><option value="">—</option>{d.zones.map((z) => <option key={z} value={z}>{z}</option>)}</select>
        </Champ>
        <Champ label={t('courierOnboarding.fVehicle')}>
          <select value={f.vehicleType} onChange={set('vehicleType')}><option value="">—</option>{d.vehicles.map((v) => <option key={v} value={v}>{t(`courierOnboarding.vehicle_${v}`)}</option>)}</select>
        </Champ>
        {motorise && (<>
          <Champ label={t('courierOnboarding.fLicence')}><input value={f.licenceNumber} onChange={set('licenceNumber')} /></Champ>
          <Champ label={t('courierOnboarding.fPlate')}><input value={f.licencePlate} onChange={set('licencePlate')} placeholder="1-ABC-123" /></Champ>
        </>)}
      </div>

      {c.statusType === 'student' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🎓 {t('courierOnboarding.studentSection')}</h4>
        <div className="courier-grid">
          <Champ label={t('courierOnboarding.fSchool')}><input value={f.schoolName} onChange={set('schoolName')} /></Champ>
          <Champ label={t('courierOnboarding.fAcademicYear')}><input value={f.academicYear} onChange={set('academicYear')} placeholder="2026-2027" /></Champ>
          <Champ label={t('courierOnboarding.fStudentHours')} help={t('courierOnboarding.fStudentHoursHelp', { h: legal.studentMaxHours })}><input type="number" min="0" max="1000" value={f.studentHoursRemaining} onChange={set('studentHoursRemaining')} /></Champ>
          <Champ label={t('courierOnboarding.fHoursExternal')} help={t('courierOnboarding.fHoursExternalHelp')}><input type="number" min="0" max="2000" value={f.hoursExternalDeclared} onChange={set('hoursExternalDeclared')} /></Champ>
        </div>
        <label className="service-option"><input type="checkbox" checked={!!f.fullTimeSchooling} onChange={set('fullTimeSchooling')} /> <span>{t('courierOnboarding.fFullTime')}</span></label>
        <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>ℹ️ {t('courierOnboarding.studentParentsInfo', { amount: euro(legal.studentParentsCeiling) })}</p>
      </>)}

      {c.statusType === 'p2p' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🤝 {t('courierOnboarding.p2pSection')}</h4>
        <Champ label={t('courierOnboarding.fIncomeExternal')} help={t('courierOnboarding.fIncomeExternalHelp', { amount: euro(legal.p2pMaxGross) })}><input type="number" min="0" step="0.01" value={f.incomeExternalDeclared} onChange={set('incomeExternalDeclared')} /></Champ>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pNonProfessional} onChange={set('p2pNonProfessional')} /> <span>{t('courierOnboarding.p2pNonPro')}</span></label>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pWithholdingConsent} onChange={set('p2pWithholdingConsent')} /> <span>{t('courierOnboarding.p2pWithholding', { rate: (legal.p2pWithholdingRate * 100).toFixed(1) })}</span></label>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pTaxConsent} onChange={set('p2pTaxConsent')} /> <span>{t('courierOnboarding.p2pTax')}</span></label>
      </>)}

      {c.statusType === 'independent' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🧑‍💼 {t('courierOnboarding.indepSection')}</h4>
        <div className="courier-grid">
          <Champ label={t('courierOnboarding.fBce')} help={c.independent.companyVerified ? `✅ ${t('courierOnboarding.bceVerified')}` : t('courierOnboarding.bceHelp')}><input value={f.companyNumber} onChange={set('companyNumber')} placeholder="0123.456.789" /></Champ>
          <Champ label={t('courierOnboarding.fVatStatus')}>
            <select value={f.vatStatus} onChange={set('vatStatus')}><option value="">—</option><option value="franchise">{t('courierOnboarding.vatFranchise', { max: euro(legal.franchiseMaxTurnover) })}</option><option value="assujetti">{t('courierOnboarding.vatNormal')}</option></select>
          </Champ>
          {f.vatStatus === 'assujetti' && <Champ label={t('courierOnboarding.fVatNumber')}><input value={f.vatNumber} onChange={set('vatNumber')} placeholder="BE0123456789" /></Champ>}
          <Champ label={t('courierOnboarding.fLegalName')}><input value={f.legalName} onChange={set('legalName')} /></Champ>
          <Champ label={t('courierOnboarding.fSeat')}><input value={f.seatAddress} onChange={set('seatAddress')} /></Champ>
        </div>
      </>)}

      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-teal" disabled={busy} onClick={enregistrer}>{busy ? '…' : t('courierOnboarding.save')}</button>
      </div>

      {docsRequis.length > 0 && (<>
        <h4 style={{ margin: '16px 0 6px' }}>📎 {t('courierOnboarding.docsTitle')}</h4>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('courierOnboarding.docsHelp')}</p>
        {docsRequis.map((type) => (
          <div key={type} className="courier-doc">
            <div>
              <b>{t(`courierOnboarding.doc_${type}`)}</b>
              <p className="small" style={{ margin: '2px 0 0' }}>{t(`courierOnboarding.doc_${type}_help`)}</p>
              {docsDe(type).map((x) => (
                <div key={x.id} className="small" style={{ marginTop: 4 }}>
                  {x.verifiedAt ? '✅' : x.rejectedReason ? '❌' : '⏳'} <a href={x.fileUrl} target="_blank" rel="noreferrer">{t('courierOnboarding.docView')}</a>
                  {x.expiresAt && ` · ${t('courierOnboarding.docExpires', { date: new Date(x.expiresAt).toLocaleDateString(getLocale()) })}`}
                  {x.rejectedReason && <span style={{ color: 'var(--red)' }}> — {x.rejectedReason}</span>}
                  {!x.verifiedAt && <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => action(() => api(`/couriers/me/documents/${x.id}`, { method: 'DELETE', token }))}>{t('courierOnboarding.docDelete')}</button>}
                </div>
              ))}
            </div>
            <div className="courier-doc-actions">
              {type === 'liability_insurance' && <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} title={t('courierOnboarding.docExpiryLabel')} />}
              <input ref={(el) => { fichiers.current[type] = el; }} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
              <button type="button" className="btn-outline" disabled={busy} onClick={() => fichiers.current[type]?.click()}>{docsDe(type).length ? t('courierOnboarding.docReplace') : t('courierOnboarding.docUpload')}</button>
            </div>
          </div>
        ))}
      </>)}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={async () => { if (await enregistrer()) onNext(); }}>{t('courierOnboarding.saveAndNext')}</button></div>
    </div>
  );
}

function EtapeContrat({ d, t, busy, token, action, onNext }) {
  const c = d.courier;
  const [nom, setNom] = useState(`${c.identity.firstName} ${c.identity.lastName}`.trim() || d.user?.name || '');
  const [accepte, setAccepte] = useState(false);
  const signe = d.contracts.find((k) => k.contractType === c.statusType);
  const apercu = () => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed'));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.contractTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t(`courierOnboarding.contract_${c.statusType || 'student'}`)}</p>
      {signe ? (
        <div className="courier-ok">✅ {t('courierOnboarding.contractSigned', { date: new Date(signe.signedAt).toLocaleString(getLocale()), version: signe.version })}
          <div className="small" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{t('courierOnboarding.contractHash')} <code>{signe.documentHash.slice(0, 16)}…</code> · <button type="button" className="btn-ghost" style={{ padding: '0 6px' }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/${signe.id}/pdf`, token, t('courierOnboarding.previewFailed'))}>PDF</button></div>
        </div>
      ) : (
        <>
          <button type="button" className="btn-outline" onClick={apercu}>📄 {t('courierOnboarding.contractPreview')}</button>
          <div className="field" style={{ marginTop: 12 }}>
            <label>{t('courierOnboarding.typedName')}</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <label className="service-option"><input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} /> <span>{t('courierOnboarding.acceptContract')}</span></label>
          <p className="small" style={{ margin: '6px 0 10px', opacity: 0.8 }}>{t('courierOnboarding.signatureHelp')}</p>
          <button type="button" className="btn-gold" disabled={busy || !accepte || !nom.trim()} onClick={() => action(() => api('/couriers/me/contract/sign', { method: 'POST', token, body: { typedName: nom.trim(), accepted: accepte } }), t('courierOnboarding.toastSigned'))}>{t('courierOnboarding.sign')}</button>
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-outline" onClick={onNext}>{t('courierOnboarding.next')}</button></div>
    </div>
  );
}

function EtapePaiement({ d, t, busy, token, user, onNext }) {
  const [connecting, setConnecting] = useState(false); const [erreur, setErreur] = useState('');
  const statut = d.user?.stripeConnectStatus || user?.stripeConnectStatus;
  async function connecter() {
    setConnecting(true); setErreur('');
    try { const r = await api('/auth/me/connect/onboard', { method: 'POST', token }); window.location.href = r.url; } catch (e) { setErreur(e.message); setConnecting(false); }
  }
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.paymentTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.paymentHelp')}</p>
      {statut === 'active' ? <div className="courier-ok">✅ {t('courierOnboarding.paymentActive')}</div> : (
        <>
          <button type="button" className="btn-teal" disabled={connecting || busy} onClick={connecter}>{connecting ? '…' : t('courierOnboarding.paymentStart')}</button>
          {erreur && <p className="small" style={{ margin: '8px 0 0' }}>{erreur}</p>}
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('courierOnboarding.paymentLater')}</p>
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={onNext}>{t('courierOnboarding.next')}</button></div>
    </div>
  );
}

function EtapeEnvoi({ d, t, busy, onSubmit, onGoTo }) {
  const manque = d.missing;
  const etapeDe = (m) => Object.keys(MANQUES_PAR_ETAPE).find((e) => MANQUES_PAR_ETAPE[e].includes(m)) || 'infos';
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.submitTitle')}</h3>
      {manque.length === 0 ? (
        <>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.submitReady')}</p>
          <button type="button" className="btn-gold" disabled={busy} onClick={onSubmit}>{busy ? '…' : t('courierOnboarding.submit')}</button>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('courierOnboarding.submitMissing')}</p>
          <ul className="courier-missing">
            {manque.map((m) => <li key={m}><button type="button" className="btn-ghost" style={{ padding: '2px 6px' }} onClick={() => onGoTo(etapeDe(m))}>{t(`courierOnboarding.missing_${m}`)}</button></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function Compteurs({ d, t, token, action, busy }) {
  const c = d.courier; const s = d.situation; const legal = d.legal; const th = d.thresholds;
  const [ext, setExt] = useState(c.statusType === 'student' ? th.hoursExternalDeclared : th.grossIncomeExternalDeclared);
  if (!s || s.type === 'none') {
    return c.statusType === 'independent' ? <div className="card"><h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📊 {t('courierOnboarding.countersTitle')}</h3><p className="small" style={{ margin: 0 }}>{t('courierOnboarding.indepNoCap', { year: legal.year })}</p></div> : null;
  }
  const pct = Math.min(100, Math.round(s.pct * 100));
  const tone = pct >= 100 ? 'danger' : pct >= 95 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📊 {t('courierOnboarding.countersTitle')} {legal.year}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{s.type === 'hours' ? t('courierOnboarding.hoursUsed', { used: s.used, max: s.max }) : t('courierOnboarding.incomeUsed', { used: euro(s.used), max: euro(s.max) })}</p>
      <div className={`courier-bar ${tone}`}><div style={{ width: `${pct}%` }} /></div>
      <p className="small" style={{ margin: '6px 0 0' }}>{pct} %{pct >= 80 && pct < 100 ? ` — ⚠️ ${t('courierOnboarding.alertNear')}` : ''}{pct >= 100 ? ` — 🚫 ${t('courierOnboarding.alertBlocked')}` : ''}</p>
      {c.statusType === 'p2p' && <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.withholdingSoFar', { amount: euro(th.withholdingTotal) })}</p>}
      <div className="row" style={{ gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
          <label>{s.type === 'hours' ? t('courierOnboarding.fHoursExternal') : t('courierOnboarding.fIncomeExternal')}</label>
          <input type="number" min="0" value={ext} onChange={(e) => setExt(e.target.value)} />
        </div>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => action(() => api('/couriers/me', { method: 'PATCH', token, body: s.type === 'hours' ? { hoursExternalDeclared: ext } : { incomeExternalDeclared: ext } }), t('courierOnboarding.toastSaved'))}>{t('courierOnboarding.save')}</button>
      </div>
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('courierOnboarding.countersHelp')}</p>
    </div>
  );
}

function ChangementStatut({ d, t, token, action, busy }) {
  const c = d.courier; const [cible, setCible] = useState(c.statusType === 'independent' ? 'student' : 'independent'); const [raison, setRaison] = useState('');
  const [ouvert, setOuvert] = useState(c.lifecycleStatus === 'blocked_threshold');
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>🔄 {t('courierOnboarding.changeStatusTitle')}</h3>
        <button type="button" className="btn-ghost" onClick={() => setOuvert((v) => !v)}>{ouvert ? t('courierOnboarding.hide') : t('courierOnboarding.open')}</button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>{c.lifecycleStatus === 'blocked_threshold' ? t('courierOnboarding.changeStatusBlocked') : t('courierOnboarding.changeStatusHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('courierOnboarding.newStatus')}</label>
              <select value={cible} onChange={(e) => setCible(e.target.value)}>{['student', 'p2p', 'independent'].filter((x) => x !== c.statusType).map((x) => <option key={x} value={x}>{t(`courierOnboarding.status_${x}`)}</option>)}</select>
            </div>
            <div className="field" style={{ margin: 0, flex: '1 1 220px' }}><label>{t('courierOnboarding.reason')}</label><input value={raison} onChange={(e) => setRaison(e.target.value)} /></div>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => action(() => api('/couriers/me/request-status-change', { method: 'POST', token, body: { statusType: cible, reason: raison } }), t('courierOnboarding.toastChangeRequested'))}>{t('courierOnboarding.requestChange')}</button>
          </div>
          {c.statusType === 'student' && c.lifecycleStatus === 'blocked_threshold' && <p className="small" style={{ margin: '8px 0 0' }}>{t('courierOnboarding.ordinaryOption')}</p>}
        </div>
      )}
    </div>
  );
}
