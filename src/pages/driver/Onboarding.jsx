import { useEffect, useMemo, useRef, useState, useId, cloneElement, isValidElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiUpload, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { dateOuverturePaiements } from '../../launch';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import CourierUsageBar, { niveauxAlerte, libelleNiveaux, euroPlafond } from '../../components/CourierUsageBar';

// Parcours d'inscription du livreur, en étapes : statut (économie collaborative / étudiant-indépendant /
// indépendant), identité vérifiée (Stripe Identity aujourd'hui, itsme/eID dès le contrat itsme, ou dépôt
// manuel), infos et documents propres au statut, contrat signé, paiements Stripe, puis envoi à la
// validation Fairide. Une fois validé, la même page montre les compteurs (plafond P2P, brut / précompte /
// net de l'année), les notifications, le renouvellement annuel et le changement de statut, libre à tout
// moment (le dossier repasse alors en vérification).
// Rien ici n'impose d'horaire, de quota de courses ni de taux d'acceptation : le livreur choisit ses
// courses. Aucun montant légal n'est écrit dans ce fichier : tout vient de `legal` (configuration fiscale).
const ETAPES = ['statut', 'identite', 'infos', 'contrat', 'paiement', 'envoi'];
const MANQUES_PAR_ETAPE = {
  statut: ['statut'], identite: ['identite', 'document_identity_card'],
  infos: ['date_naissance', 'registre_national', 'iban', 'zone', 'vehicule', 'permis_immatriculation', 'ecole', 'caisse', 'attestation_honneur_p2p', 'age_minimum', 'consentements_p2p', 'bce', 'tva', 'tva_numero', 'siege', 'document_school_certificate', 'document_social_insurance_fund', 'document_liability_insurance', 'document_bce_extract', 'document_profile_photo', 'document_driving_licence', 'document_vehicle_registration', 'document_vehicle_insurance'],
  contrat: ['contrat'], paiement: [], envoi: ['statut_non_verifie']
};
// « statut_non_verifie » n'est pas une action du livreur : c'est Fairide qui vérifie. Il n'empêche
// donc pas d'envoyer le dossier, il est simplement affiché à titre d'information.
const MANQUES_INFORMATIFS = ['statut_non_verifie'];
const STATUTS = ['p2p', 'student_independent', 'independent'];
const EMOJI_STATUT = { p2p: '🤝', student_independent: '🎓', independent: '🧑‍💼' };
// Caisses d'assurances sociales agréées en Belgique (noms propres, pas de traduction).
const CAISSES = ['Liantis', 'Acerta', 'Xerius', 'Partena', 'Securex', 'UCM', 'Group S', 'Caisse nationale auxiliaire'];
// Attestations d'assurance : date d'échéance demandée, Fairide rappelle le renouvellement.
const AVEC_ECHEANCE = ['liability_insurance', 'vehicle_insurance'];
const euro = euroPlafond;
// Taux stocké en fraction (0.107) affiché en pourcentage (« 10,7 ») ; « — » si la configuration ne le donne pas.
const pctTexte = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })}`);
const euroOuTiret = (x) => (x == null || x === '' ? '—' : euro(x));
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

  const manques = d?.missing ?? [];
  const premiereIncomplete = useMemo(() => {
    if (!d) return 'statut';
    for (const e of ETAPES) if (MANQUES_PAR_ETAPE[e].some((m) => manques.includes(m) && !MANQUES_INFORMATIFS.includes(m))) return e;
    return 'envoi';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  const courante = etape || premiereIncomplete;

  async function action(fn, ok) {
    setBusy(true);
    try { const r = await fn(); if (r && r.courier) setD(r); else await charger(); if (ok) toast(ok); return true; } catch (e) { toast(e.message); return false; } finally { setBusy(false); }
  }

  if (!d) return <SkeletonCards count={3} />;
  const c = d.courier; const legal = d.legal ?? {};
  const valide = c.lifecycleStatus === 'approved';
  const etapeOk = (e) => !MANQUES_PAR_ETAPE[e].some((m) => manques.includes(m) && !MANQUES_INFORMATIFS.includes(m));
  const enDossier = c.lifecycleStatus === 'draft' || c.lifecycleStatus === 'rejected';
  const allerAuChangement = () => { document.getElementById('changement-statut')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="courier-onboarding">
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('courierOnboarding.title')}</h2>

      {/* État du dossier */}
      <EtatDossier d={d} t={t} onChangeStatus={allerAuChangement} />

      <Notifications t={t} token={token} />

      {enDossier && (
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
      {!enDossier && <ChangementStatut d={d} t={t} token={token} action={action} busy={busy} onChanged={() => { setEtape('statut'); refreshUser?.(); }} />}
      <p className="small" style={{ marginTop: 16, opacity: 0.75 }}>{t('courierOnboarding.legalFooter', { year: legal.year ?? new Date().getFullYear() })} · <Link to="/driver">{t('courierOnboarding.backToDashboard')}</Link></p>
    </div>
  );
}

function EtatDossier({ d, t, onChangeStatus }) {
  const c = d.courier; const legal = d.legal ?? {};
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
          {c.lifecycleStatus === 'approved' && (
            <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>{c.statusVerifiedAt ? `✅ ${t('courierOnboarding.statusVerified', { date: new Date(c.statusVerifiedAt).toLocaleDateString(getLocale()) })}` : `⏳ ${t('courierOnboarding.statusNotVerified')}`}</p>
          )}
          {c.lifecycleStatus === 'blocked_threshold' && (
            <>
              <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.blockedExplain', { year: legal.year ?? new Date().getFullYear() })}</p>
              <button type="button" className="btn-gold" style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }} onClick={onChangeStatus}>🔄 {t('courierOnboarding.blockedGoStatus')}</button>
            </>
          )}
        </div>
        {c.submittedAt && <span className="small">{t('courierOnboarding.submittedOn', { date: new Date(c.submittedAt).toLocaleDateString(getLocale()) })}</span>}
      </div>
    </div>
  );
}

// Les trois cartes de statut, chiffres tirés de la configuration fiscale de l'année (`legal`).
function EtapeStatut({ d, t, busy, onChoose }) {
  const legal = d.legal ?? {}; const p2pOk = !!d.flags?.p2pEnabled;
  const age = legal.adultMinAge ?? '—';
  const cartes = [
    { key: 'p2p', soon: !p2pOk,
      plafond: t('courierOnboarding.cmpP2pCeiling', { amount: euroOuTiret(legal.p2pAnnualCeilingGross), year: legal.year ?? '' }),
      retenue: t('courierOnboarding.cmpP2pWithholding', { rate: pctTexte(legal.p2pWithholdingRate) }),
      social: t('courierOnboarding.cmpP2pSocial'), tva: t('courierOnboarding.cmpP2pVat'), demarches: t('courierOnboarding.cmpP2pSteps'),
      age: t('courierOnboarding.cmpAge', { age }) },
    { key: 'student_independent',
      plafond: t('courierOnboarding.cmpStuCeiling', { ceiling: euroOuTiret(legal.studentIndependentCeiling) }),
      retenue: t('courierOnboarding.cmpStuWithholding'),
      social: t('courierOnboarding.cmpStuSocial', { exemption: euroOuTiret(legal.studentIndependentExemption) }),
      tva: t('courierOnboarding.cmpStuVat', { max: euroOuTiret(legal.franchiseMaxTurnover) }), demarches: t('courierOnboarding.cmpStuSteps'),
      age: t('courierOnboarding.cmpStuAge', { age }) },
    { key: 'independent',
      plafond: t('courierOnboarding.cmpIndCeiling'), retenue: t('courierOnboarding.cmpIndWithholding'),
      social: t('courierOnboarding.cmpIndSocial', { rate: `${pctTexte(legal.independentSocialRate)} %`, exemption: euroOuTiret(legal.independentComplementaryExemption) }),
      tva: t('courierOnboarding.cmpIndVat', { max: euroOuTiret(legal.franchiseMaxTurnover) }), demarches: t('courierOnboarding.cmpIndSteps'),
      age: t('courierOnboarding.cmpAge', { age }) }
  ];
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.chooseStatus')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.chooseStatusHelp')}</p>
      <div className="courier-compare">
        {cartes.map((k) => (
          <div key={k.key} className={`courier-compare-card${d.courier.statusType === k.key ? ' active' : ''}${k.soon ? ' soon' : ''}`}>
            <div className="courier-compare-head"><span style={{ fontSize: 26 }}>{EMOJI_STATUT[k.key]}</span><b>{t(`courierOnboarding.status_${k.key}`)}</b></div>
            <p className="small">{t(`courierOnboarding.status_${k.key}_desc`)}</p>
            <dl className="courier-compare-list">
              <dt>{t('courierOnboarding.cmpCeiling')}</dt><dd>{k.plafond}</dd>
              <dt>{t('courierOnboarding.cmpWithholding')}</dt><dd>{k.retenue}</dd>
              <dt>{t('courierOnboarding.cmpSocial')}</dt><dd>{k.social}</dd>
              <dt>{t('courierOnboarding.cmpVat')}</dt><dd>{k.tva}</dd>
              <dt>{t('courierOnboarding.cmpSteps')}</dt><dd>{k.demarches}</dd>
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
  const toast = useToast();
  const id = d.courier.identity ?? {}; const prov = d.identityProviders ?? {};
  const fichier = useRef(null);
  async function demarrer(provider) {
    await action(async () => {
      const r = await api('/couriers/me/identity/start', { method: 'POST', token, body: { provider } });
      if (r.url) { window.location.href = r.url; return null; }
      return null;
    });
  }
  async function deposer(e) {
    const files = [...(e.target.files || [])].slice(0, 4); e.target.value = ''; if (!files.length) return;
    for (const f of files) { const ok = await action(() => apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType: 'identity_card' } }), null); if (!ok) break; }
    toast(files.length > 1 ? t('courierOnboarding.toastDocsUploaded', { n: files.length }) : t('courierOnboarding.toastDocUploaded'));
  }
  const carte = (d.documents ?? []).filter((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType));
  const [autreMoyen, setAutreMoyen] = useState(false);
  const recue = id.status !== 'verified' && carte.length > 0 && !autreMoyen;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.identityTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.identityHelp')}</p>
      {recue ? (
        <div className="courier-ok">✅ {t('courierOnboarding.identityReceived', { n: carte.length })}
          <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.identityReceivedHelp')}</p>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => { fichier.current?.click(); }}>📎 {t('courierOnboarding.identityAddFile')}</button>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setAutreMoyen(true)}>{t('courierOnboarding.identityOtherWay')}</button>
          </div>
          <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />
        </div>
      ) : id.status === 'verified' ? (
        <div className="courier-ok">✅ {t('courierOnboarding.identityVerified', { name: `${id.firstName || ''} ${id.lastName || ''}`.trim(), provider: t(`courierOnboarding.provider_${id.provider}`) })}
          {id.nameMatchAccount === false && <p className="small" style={{ color: 'var(--red)', margin: '6px 0 0' }}>⚠️ {t('courierOnboarding.nameMismatch')}</p>}
        </div>
      ) : (
        <div className="courier-providers">
          <div className={`courier-provider courier-provider-itsme${prov.itsme ? '' : ' soon'}`}>
            <b>📱 {t('courierOnboarding.provider_itsme')} <span className="pill" style={{ marginLeft: 6 }}>{t('courierOnboarding.itsmeRecommended')}</span></b>
            <p className="small">{t('courierOnboarding.itsmeLastCheck')}</p>
            <p className="small">{t('courierOnboarding.itsmeHelp')}</p>
            {prov.itsme ? <button type="button" className="btn-gold" disabled={busy} onClick={() => demarrer('itsme')}>{t('courierOnboarding.identityStartItsme')}</button> : <span className="small courier-soon">🔒 {t('courierOnboarding.itsmeSoon')}</span>}
          </div>
          <div className="courier-provider">
            <b>🪪 {t('courierOnboarding.provider_stripe_identity')}</b>
            <p className="small">{t('courierOnboarding.stripeIdentityHelp')}</p>
            <button type="button" className="btn-teal" disabled={busy || !prov.stripe_identity} onClick={() => demarrer('stripe_identity')}>{id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('courierOnboarding.identityStart')}</button>
            {id.status === 'processing' && <p className="small">⏳ {t('courierOnboarding.identityProcessing')}</p>}
            {id.status === 'failed' && <p className="small" style={{ color: 'var(--red)' }}>{t('courierOnboarding.identityFailed')}</p>}
          </div>
          <div className="courier-provider">
            <b>📄 {t('courierOnboarding.provider_manual')}</b>
            <p className="small">{t('courierOnboarding.manualHelp')}</p>
            <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />
            <button type="button" className="btn-outline" disabled={busy} onClick={async () => { if (id.provider !== 'manual') await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } })); fichier.current?.click(); }}>{t('courierOnboarding.manualUpload')}</button>
            {carte.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}>✅ {t('courierOnboarding.manualUploaded', { n: carte.length })}</p>}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={onNext}>{t('courierOnboarding.next')}</button></div>
    </div>
  );
}

function Champ({ label, children, help }) {
  // L'ASSOCIATION SE FAIT ICI, UNE FOIS. Ce composant enveloppe les champs de l'inscription livreur,
  // et son étiquette était posée à côté du champ sans aucun lien : un lecteur d'écran annonçait
  // « zone de texte » sans dire laquelle, sur un parcours d'inscription entier. Plutôt que de répéter
  // un id à chaque appel, l'identifiant est fabriqué ici et injecté dans l'enfant.
  //
  // useId donne une valeur par instance, donc deux Champ sur la même page ne se marchent pas
  // dessus. Un enfant qui porte déjà un id garde le sien, et un enfant qui n'est pas un élément
  // unique (fragment, tableau) est laissé tel quel : mieux vaut ne rien faire que produire un
  // htmlFor qui pointe dans le vide.
  const id = useId();
  const enfantUnique = isValidElement(children) && !children.props.id;
  const champ = enfantUnique ? cloneElement(children, { id }) : children;
  return (
    <div className="field">
      {enfantUnique ? <label htmlFor={id}>{label}</label> : <span className="titre-groupe">{label}</span>}
      {champ}
      {help && <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{help}</p>}
    </div>
  );
}

// Champs BCE / TVA, communs à l'étudiant-indépendant et à l'indépendant.
function ChampsEntreprise({ c, f, set, t, legal }) {
  return (
    <>
      <Champ label={t('courierOnboarding.fBce')} help={c.independent?.companyVerified ? `✅ ${t('courierOnboarding.bceVerified')}` : t('courierOnboarding.bceHelp')}><input aria-label="0123.456.789" value={f.companyNumber} onChange={set('companyNumber')} placeholder="0123.456.789" /></Champ>
      <Champ label={t('courierOnboarding.fVatStatus')}>
        <select value={f.vatStatus} onChange={set('vatStatus')}><option value="">-</option><option value="franchise">{t('courierOnboarding.vatFranchise', { max: euroOuTiret(legal.franchiseMaxTurnover) })}</option><option value="assujetti">{t('courierOnboarding.vatNormal')}</option></select>
      </Champ>
      {f.vatStatus === 'assujetti' && <Champ label={t('courierOnboarding.fVatNumber')}><input aria-label="BE0123456789" value={f.vatNumber} onChange={set('vatNumber')} placeholder="BE0123456789" /></Champ>}
    </>
  );
}

function ChampCaisse({ f, set, t }) {
  const connue = !f.socialInsuranceFund || CAISSES.includes(f.socialInsuranceFund);
  return (
    <Champ label={t('courierOnboarding.fSocialInsuranceFund')} help={t('courierOnboarding.fSocialInsuranceFundHelp')}>
      <select value={f.socialInsuranceFund} onChange={set('socialInsuranceFund')}>
        <option value="">-</option>
        {CAISSES.map((x) => <option key={x} value={x}>{x}</option>)}
        {!connue && <option value={f.socialInsuranceFund}>{f.socialInsuranceFund}</option>}
      </select>
    </Champ>
  );
}

function EtapeInfos({ d, t, busy, token, action, onNext }) {
  const toast = useToast();
  const c = d.courier; const legal = d.legal ?? {}; const th = d.thresholds ?? {};
  const [f, setF] = useState({ birthDate: c.birthDate ?? '', nationalNumber: '', iban: c.iban ?? '', zone: c.zone ?? '', vehicleType: c.vehicleType ?? '', licenceNumber: c.licenceNumber ?? '', licencePlate: c.licencePlate ?? '', bagOption: c.bag?.option || '',
    schoolName: c.student?.school ?? '', academicYear: c.student?.academicYear ?? '',
    socialInsuranceFund: c.socialInsuranceFund ?? c.student?.socialInsuranceFund ?? '',
    p2pHonourDeclared: !!c.p2pHonourDeclaredAt,
    p2pNonProfessional: !!c.p2p?.nonProfessionalDeclared, p2pWithholdingConsent: !!c.p2p?.withholdingConsent, p2pTaxConsent: !!c.p2p?.taxDataConsent,
    companyNumber: c.independent?.companyNumber ?? '', vatStatus: c.independent?.vatStatus ?? '', vatNumber: c.independent?.vatNumber ?? '', legalName: c.independent?.legalName ?? '', seatAddress: c.independent?.seatAddress ?? '',
    incomeExternalDeclared: th.incomeExternalDeclared ?? th.grossIncomeExternalDeclared ?? 0 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const [expiry, setExpiry] = useState('');
  const fichiers = useRef({});
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);

  async function enregistrer() {
    const body = { ...f };
    if (!body.nationalNumber) delete body.nationalNumber;
    if (!body.bagOption) delete body.bagOption;
    // L'attestation sur l'honneur ne s'envoie qu'une fois, cochée : le serveur l'horodate.
    if (!body.p2pHonourDeclared || c.p2pHonourDeclaredAt) delete body.p2pHonourDeclared;
    for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body }), t('courierOnboarding.toastSaved'));
    if (ok) setF((x) => ({ ...x, nationalNumber: '' }));
    return ok;
  }
  async function deposer(docType, e) {
    const files = [...(e.target.files || [])].slice(0, 6); e.target.value = ''; if (!files.length) return;
    for (const file of files) {
      const ok = await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType, expiresAt: AVEC_ECHEANCE.includes(docType) ? expiry : undefined } }), files.length === 1 ? t('courierOnboarding.toastDocUploaded') : null);
      if (!ok) break;
    }
    if (files.length > 1) toast(t('courierOnboarding.toastDocsUploaded', { n: files.length }));
  }
  // Photo de profil pour tous, pièces du statut, puis permis / immatriculation / assurance pour un véhicule motorisé.
  const docsRequis = [...new Set([...(d.commonDocuments ?? ['profile_photo']), ...(d.requiredDocuments?.[c.statusType] ?? []), ...(motorise ? (d.motorizedDocuments ?? ['driving_licence', 'vehicle_registration', 'vehicle_insurance']) : [])])];
  const docsDe = (type) => (d.documents ?? []).filter((x) => x.docType === type);

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.infosTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.infosHelp')}</p>
      <div className="courier-grid">
        <Champ label={t('courierOnboarding.fBirthDate')}><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Champ>
        <Champ label={t('courierOnboarding.fNrn')} help={c.hasNationalNumber ? t('courierOnboarding.nrnStored', { masked: c.nationalNumberMasked }) : t('courierOnboarding.nrnHelp')}>
          <input aria-label="85.07.30-033.28" inputMode="numeric" value={f.nationalNumber} onChange={set('nationalNumber')} placeholder="85.07.30-033.28" />
        </Champ>
        <Champ label={t('courierOnboarding.fIban')}><input aria-label="BE68 5390 0754 7034" value={f.iban} onChange={set('iban')} placeholder="BE68 5390 0754 7034" /></Champ>
        <Champ label={t('courierOnboarding.fZone')}>
          <select value={f.zone} onChange={set('zone')}><option value="">-</option>{(d.zones ?? []).map((z) => <option key={z} value={z}>{z}</option>)}</select>
        </Champ>
        <Champ label={t('courierOnboarding.fVehicle')}>
          <select value={f.vehicleType} onChange={set('vehicleType')}><option value="">-</option>{(d.vehicles ?? []).map((v) => <option key={v} value={v}>{t(`courierOnboarding.vehicle_${v}`)}</option>)}</select>
        </Champ>
        {motorise && (<>
          <Champ label={t('courierOnboarding.fLicence')}><input value={f.licenceNumber} onChange={set('licenceNumber')} /></Champ>
          <Champ label={t('courierOnboarding.fPlate')}><input aria-label="1-ABC-123" value={f.licencePlate} onChange={set('licencePlate')} placeholder="1-ABC-123" /></Champ>
        </>)}
        <Champ label={t('courierOnboarding.fBag')} help={['none', 'due'].includes(c.bag?.depositStatus || 'none') ? t('courierOnboarding.fBagHelp', { amount: c.bag?.depositAmount || 40 }) : t(`courierOnboarding.bagDeposit_${c.bag.depositStatus}`, { amount: c.bag?.depositAmount || 40 })}>
          <select value={f.bagOption} onChange={set('bagOption')} disabled={!['none', 'due'].includes(c.bag?.depositStatus || 'none')}>
            <option value="">-</option>
            <option value="own">{t('auth.bag_own')}</option>
            <option value="fairide">{t('auth.bag_fairide')}</option>
          </select>
        </Champ>
      </div>

      {c.statusType === 'p2p' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🤝 {t('courierOnboarding.p2pSection')}</h4>
        <Champ label={t('courierOnboarding.fIncomeExternal')} help={t('courierOnboarding.fIncomeExternalHelp', { amount: euroOuTiret(legal.p2pAnnualCeilingGross) })}><input type="number" min="0" step="0.01" value={f.incomeExternalDeclared} onChange={set('incomeExternalDeclared')} /></Champ>
        <h5 style={{ margin: '10px 0 4px' }}>{t('courierOnboarding.fHonour')}</h5>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pHonourDeclared} disabled={!!c.p2pHonourDeclaredAt} onChange={set('p2pHonourDeclared')} /> <span>{t('courierOnboarding.fHonourText')}</span></label>
        {c.p2pHonourDeclaredAt && <p className="small" style={{ margin: '2px 0 6px', opacity: 0.8 }}>✅ {t('courierOnboarding.honourDeclaredAt', { date: new Date(c.p2pHonourDeclaredAt).toLocaleDateString(getLocale()) })}</p>}
        <label className="service-option"><input type="checkbox" checked={!!f.p2pNonProfessional} onChange={set('p2pNonProfessional')} /> <span>{t('courierOnboarding.p2pNonPro')}</span></label>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pWithholdingConsent} onChange={set('p2pWithholdingConsent')} /> <span>{t('courierOnboarding.p2pWithholding', { rate: pctTexte(legal.p2pWithholdingRate) })}</span></label>
        <label className="service-option"><input type="checkbox" checked={!!f.p2pTaxConsent} onChange={set('p2pTaxConsent')} /> <span>{t('courierOnboarding.p2pTax')}</span></label>
      </>)}

      {c.statusType === 'student_independent' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🎓 {t('courierOnboarding.stuIndepSection')}</h4>
        <div className="courier-grid">
          <Champ label={t('courierOnboarding.fSchool')}><input value={f.schoolName} onChange={set('schoolName')} /></Champ>
          <Champ label={t('courierOnboarding.fAcademicYear')}><input aria-label="2026-2027" value={f.academicYear} onChange={set('academicYear')} placeholder="2026-2027" /></Champ>
          <ChampCaisse f={f} set={set} t={t} />
          <ChampsEntreprise c={c} f={f} set={set} t={t} legal={legal} />
        </div>
        {legal.studentParentsCeiling != null && <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>ℹ️ {t('courierOnboarding.studentParentsInfo', { amount: euro(legal.studentParentsCeiling) })}</p>}
      </>)}

      {c.statusType === 'independent' && (<>
        <h4 style={{ margin: '14px 0 6px' }}>🧑‍💼 {t('courierOnboarding.indepSection')}</h4>
        <div className="courier-grid">
          <ChampsEntreprise c={c} f={f} set={set} t={t} legal={legal} />
          <ChampCaisse f={f} set={set} t={t} />
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
                  {x.rejectedReason && <span style={{ color: 'var(--red)' }}> · {x.rejectedReason}</span>}
                  {!x.verifiedAt && <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => action(() => api(`/couriers/me/documents/${x.id}`, { method: 'DELETE', token }))}>{t('courierOnboarding.docDelete')}</button>}
                </div>
              ))}
            </div>
            <div className="courier-doc-actions">
              {AVEC_ECHEANCE.includes(type) && <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} title={t('courierOnboarding.docExpiryLabel')} />}
              <input ref={(el) => { fichiers.current[type] = el; }} type="file" multiple={type !== 'profile_photo'} accept={type === 'profile_photo' ? 'image/*' : 'application/pdf,image/*'} style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
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
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const c = d.courier;
  const [nom, setNom] = useState(`${c.identity?.firstName || ''} ${c.identity?.lastName || ''}`.trim() || d.user?.name || '');
  const [accepte, setAccepte] = useState(false);
  const versionCourante = d.contractVersions?.[c.statusType];
  const ancien = (d.contracts ?? []).find((k) => k.contractType === c.statusType);
  const signe = ancien && (!versionCourante || ancien.version === versionCourante) ? ancien : null;
  const apercu = () => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed'));
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.contractTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t(`courierOnboarding.contract_${STATUTS.includes(c.statusType) ? c.statusType : 'independent'}`)}</p>
      {signe ? (
        <div className="courier-ok">✅ {t('courierOnboarding.contractSigned', { date: new Date(signe.signedAt).toLocaleString(getLocale()), version: signe.version })}
          <div className="small" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{t('courierOnboarding.contractHash')} <code>{signe.documentHash.slice(0, 16)}…</code> · <button type="button" className="btn-ghost" style={{ padding: '0 6px' }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/${signe.id}/pdf`, token, t('courierOnboarding.previewFailed'))}>PDF</button></div>
        </div>
      ) : (
        <>
          {ancien && <p className="small" style={{ margin: '0 0 8px' }}>🆕 {t('driverTerms.newVersion', { version: versionCourante, old: ancien.version })}</p>}
          <button type="button" className="btn-outline" onClick={apercu}>📄 {t('courierOnboarding.contractPreview')}</button>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor={idsA11y + '-typedname'}>{t('courierOnboarding.typedName')}</label>
            <input id={idsA11y + '-typedname'} value={nom} onChange={(e) => setNom(e.target.value)} />
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
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('courierOnboarding.paymentLater', { date: dateOuverturePaiements(getLocale()) })}</p>
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={onNext}>{t('courierOnboarding.next')}</button></div>
    </div>
  );
}

function EtapeEnvoi({ d, t, busy, onSubmit, onGoTo }) {
  const manque = (d.missing ?? []).filter((m) => !MANQUES_INFORMATIFS.includes(m));
  const infos = (d.missing ?? []).filter((m) => MANQUES_INFORMATIFS.includes(m));
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
      {infos.map((m) => <p key={m} className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>ℹ️ {t(`courierOnboarding.missing_${m}`)}</p>)}
    </div>
  );
}

// Compteurs de l'année : pour l'économie collaborative, la jauge du plafond (ce qu'il reste), le brut,
// le précompte retenu et le net versé, plus le champ « déjà gagné ailleurs » qui compte dans le plafond ;
// pour les autres statuts, brut et net seulement, avec un rappel du seuil qui les concerne.
function Compteurs({ d, t, token, action, busy }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const c = d.courier; const s = d.situation; const legal = d.legal ?? {}; const th = d.thresholds ?? {};
  const [ext, setExt] = useState(th.incomeExternalDeclared ?? th.grossIncomeExternalDeclared ?? 0);
  const annee = th.year ?? legal.year ?? new Date().getFullYear();
  const p2p = c.statusType === 'p2p';
  const niveaux = niveauxAlerte(legal);
  const et = getLocale().startsWith('fr') ? 'et' : getLocale().startsWith('nl') ? 'en' : 'and';
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📊 {t('courierOnboarding.countersTitle')} {annee}</h3>
      {p2p && s && s.type === 'income' && <CourierUsageBar situation={s} legal={legal} t={t} year={annee} />}
      <div className="stat-grid" style={{ marginTop: 10, marginBottom: 8 }}>
        <div className="stat-card"><div className="num">{euro(th.grossTotal)}</div><div className="label">{t('courierOnboarding.grossYear')}</div></div>
        {p2p && <div className="stat-card"><div className="num">{euro(th.withholdingTotal)}</div><div className="label">{t('courierOnboarding.withholdingYear')}</div></div>}
        <div className="stat-card highlight"><div className="num">{euro(th.netTotal ?? (Number(th.grossTotal || 0) - Number(th.withholdingTotal || 0)))}</div><div className="label">{t('courierOnboarding.netYear')}</div></div>
        <div className="stat-card"><div className="num">{th.deliveries ?? 0}</div><div className="label">{t('courierOnboarding.deliveriesYear')}</div></div>
      </div>
      {c.statusType === 'student_independent' && <p className="small" style={{ margin: '0 0 6px' }}>ℹ️ {t('courierOnboarding.thresholdInfoStudentIndependent', { exemption: euroOuTiret(legal.studentIndependentExemption), ceiling: euroOuTiret(legal.studentIndependentCeiling) })}</p>}
      {c.statusType === 'independent' && <p className="small" style={{ margin: '0 0 6px' }}>ℹ️ {t('courierOnboarding.thresholdInfoIndependent', { rate: `${pctTexte(legal.independentSocialRate)} %`, exemption: euroOuTiret(legal.independentComplementaryExemption) })}</p>}
      {p2p && (
        <>
          <div className="row" style={{ gap: 8, alignItems: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
              <label htmlFor={idsA11y + '-fincomeexternal'}>{t('courierOnboarding.fIncomeExternal')}</label>
              <input id={idsA11y + '-fincomeexternal'} type="number" min="0" step="0.01" value={ext} onChange={(e) => setExt(e.target.value)} />
            </div>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => action(() => api('/couriers/me', { method: 'PATCH', token, body: { incomeExternalDeclared: ext } }), t('courierOnboarding.toastSaved'))}>{t('courierOnboarding.save')}</button>
          </div>
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('courierOnboarding.countersHelp', { levels: libelleNiveaux(niveaux, et) })}</p>
        </>
      )}
      <p className="small" style={{ margin: '8px 0 0' }}><Link to="/driver/earnings">{t('courierOnboarding.seeEarnings')}</Link></p>
    </div>
  );
}

// Notifications non lues du livreur (alertes de plafond, blocage, changement de statut), avec « lu ».
function Notifications({ t, token }) {
  const [liste, setListe] = useState([]);
  const charger = () => api('/couriers/me/notifications', { token }).then((r) => setListe((Array.isArray(r) ? r : r?.notifications ?? []).filter((n) => !n.readAt))).catch(() => {});
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  async function lire(ids) {
    try { await api('/couriers/me/notifications/read', { method: 'PATCH', token, body: ids ? { ids } : {} }); } catch { /* silencieux : la liste est rechargée */ }
    charger();
  }
  if (!liste.length) return null;
  const texte = (n) => {
    const p = n.payload ?? {};
    const v = { level: p.level ?? '', year: p.year ?? '', used: euro(p.used), max: euro(p.max), remaining: euro(p.remaining) };
    if (n.kind === 'threshold_alert') return t('courierOnboarding.notif_threshold_alert', v);
    if (n.kind === 'threshold_blocked') return t('courierOnboarding.notif_threshold_blocked', v);
    if (n.kind === 'status_changed') return t('courierOnboarding.notif_status_changed');
    return p.message || n.kind || t('courierOnboarding.notif_other');
  };
  return (
    <div className="card courier-state warn">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b>🔔 {t('courierOnboarding.notificationsTitle')} ({liste.length})</b>
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => lire(null)}>{t('courierOnboarding.markAllRead')}</button>
      </div>
      {liste.map((n) => (
        <div key={n.id} className="row small" style={{ justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span>{n.createdAt ? `${new Date(n.createdAt).toLocaleDateString(getLocale())} · ` : ''}{texte(n)}</span>
          <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => lire([n.id])}>{t('courierOnboarding.markRead')}</button>
        </div>
      ))}
    </div>
  );
}

// Changement de statut en libre-service : le dossier repasse en vérification (documents du nouveau
// statut, nouveau contrat), d'où la confirmation. Le P2P n'est proposé que lorsqu'il est activé.
function ChangementStatut({ d, t, token, action, busy, onChanged }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const c = d.courier;
  const choix = STATUTS.filter((x) => x !== c.statusType && (x !== 'p2p' || d.flags?.p2pEnabled));
  const [cible, setCible] = useState(choix.includes('independent') ? 'independent' : choix[0] || '');
  const [ouvert, setOuvert] = useState(c.lifecycleStatus === 'blocked_threshold');
  const [confirm, setConfirm] = useState(false);
  async function changer() {
    setConfirm(false);
    const ok = await action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType: cible } }), t('courierOnboarding.toastStatusChanged'));
    if (ok) onChanged?.();
  }
  return (
    <div className="card" id="changement-statut">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>🔄 {t('courierOnboarding.changeStatusTitle')}</h3>
        <button type="button" className="btn-ghost" onClick={() => setOuvert((v) => !v)}>{ouvert ? t('courierOnboarding.hide') : t('courierOnboarding.open')}</button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>{c.lifecycleStatus === 'blocked_threshold' ? t('courierOnboarding.changeStatusBlocked') : t('courierOnboarding.changeStatusHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={idsA11y + '-newstatus'}>{t('courierOnboarding.newStatus')}</label>
              <select id={idsA11y + '-newstatus'} value={cible} onChange={(e) => setCible(e.target.value)}>{choix.map((x) => <option key={x} value={x}>{EMOJI_STATUT[x]} {t(`courierOnboarding.status_${x}`)}</option>)}</select>
            </div>
            <button type="button" className="btn-outline" disabled={busy || !cible} onClick={() => setConfirm(true)}>{t('courierOnboarding.changeStatusBtn')}</button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} title={t('courierOnboarding.changeStatusConfirmTitle')} message={t('courierOnboarding.changeStatusConfirmBody', { status: cible ? t(`courierOnboarding.status_${cible}`) : '' })} confirmLabel={t('courierOnboarding.changeStatusBtn')} loading={busy} onConfirm={changer} onCancel={() => setConfirm(false)} />
    </div>
  );
}
