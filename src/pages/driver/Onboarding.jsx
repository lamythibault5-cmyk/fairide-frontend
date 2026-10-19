import { allerAuPaiement, experienceApp } from '../../natif';
import { MANQUES_INFORMATIFS, MANQUES_APRES_ENVOI, ERREURS_IDENTITE, CAISSES, AVEC_ECHEANCE, ECHEANCE_REQUISE, documentsRequis, corpsInfos, infosDepuisDossier, ouvrirPdf } from './dossierCommun';
import DossierAppli from './DossierAppli';
import PageLivreur from '../../components/livreur/PageLivreur';
import SacLivraison from '../../components/SacLivraison';
import { useEffect, useMemo, useRef, useState, useId, cloneElement, isValidElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiUpload, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { dateOuverturePaiements, paiementsOuverts } from '../../launch';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { euros } from '../../prixPlat';
import GuideIndependant from '../../components/livreur/GuideIndependant';
import ouvrirDocument from '../../ouvrirDocument';
import { EtapeNotices, ConsentementBiometrique } from '../../components/conformite/LivreurConformite';
import { TarifMinimum, DocumentsVente } from '../../components/conformite/EspaceVendeurLivreur';
import { libelleManque } from '../../conformite';
import { defilement } from '../../gestes';
import Icone from '../../components/Icone';

// Parcours d'inscription du livreur, en étapes : statut (économie collaborative / étudiant-indépendant /
// indépendant), identité vérifiée (Stripe Identity, ou dépôt manuel — itsme a été retiré le 4 oct. 2026 : jamais
// raccordé, il s'affichait « recommandé, bientôt » sans contrat prévu), infos et documents propres au statut, contrat signé, paiements Stripe, puis envoi à la
// validation Fairide. Une fois validé, la même page montre les compteurs (brut /
// net de l'année), les notifications, le renouvellement annuel et le changement de statut, libre à tout
// moment (le dossier repasse alors en vérification).
// Rien ici n'impose d'horaire, de quota de courses ni de taux d'acceptation : le livreur choisit ses
// courses. Aucun montant légal n'est écrit dans ce fichier : tout vient de `legal` (configuration fiscale).
// « notices » (backlog B4, B8) : notice des systèmes automatisés, politique de géolocalisation, DAC7.
// « notices » et « contrat » ne font plus qu'une étape, « engagements » : une case pour tout (12 oct. 2026).
const ETAPES = ['statut', 'identite', 'infos', 'engagements', 'paiement', 'envoi'];
const MANQUES_PAR_ETAPE = {
  statut: ['statut'], identite: ['identite', 'document_identity_card'],
  infos: ['nationalite', 'titre_sejour', 'carte_professionnelle', 'date_naissance', 'registre_national', 'zone', 'vehicule', 'permis_immatriculation', 'ecole', 'caisse', 'statut', 'age_minimum', 'bce', 'tva', 'tva_numero', 'siege', 'document_school_certificate', 'document_social_insurance_fund', 'document_liability_insurance', 'document_bce_extract', 'document_profile_photo', 'document_driving_licence', 'document_vehicle_registration', 'document_vehicle_insurance'],
  engagements: ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur', 'contrat'],
  paiement: [], envoi: ['statut_non_verifie']
};
// Deux statuts (CODE-12, DEC-19 : plus d'économie collaborative, régime fermé aux livreurs de plateformes).
const STATUTS = ['student_independent', 'independent'];
const EMOJI_STATUT = { student_independent: 'guide', independent: 'mallette' }; // noms d'icônes (Icone.jsx)
const euro = (n) => euros(Number(n || 0));
// Taux stocké en fraction (0.107) affiché en pourcentage (« 10,7 ») ; « — » si la configuration ne le donne pas.
const pctTexte = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })}`);
const euroOuTiret = (x) => (x == null || x === '' ? '—' : euro(x));
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
        if (params.get('identity') === 'ok') { toast(t('courierOnboarding.identityOk'), 'succes'); params.delete('identity'); setParams(params, { replace: true }); }
        if (params.get('identity') === 'erreur') { toast(t('courierOnboarding.identityFailed'), 'erreur'); params.delete('identity'); setParams(params, { replace: true }); }
        // Retour de Stripe lancé depuis le dossier (EtapePaiement) : on relit le statut du compte de paiement et on
        // reprend à l'envoi du dossier, au lieu de laisser le livreur chercher où il en était.
        if (params.get('connect') !== 'return' && (r?.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'pending') {
          // Filet : compte Stripe resté « en attente » (onglet fermé avant le retour, activation un peu après) — relu ici aussi.
          await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
          await refreshUser?.().catch(() => {});
          r = await charger();
        }
        if (params.get('connect') === 'return') {
          await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
          await refreshUser?.().catch(() => {});
          r = await charger();
          params.delete('connect'); setParams(params, { replace: true });
          setEtape('envoi');
        }
      } catch (e) { toast(e.message, 'erreur'); }
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
    try { const r = await fn(); if (r && r.courier) setD(r); else await charger(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, 'erreur'); return false; } finally { setBusy(false); }
  }

  if (!d) return <SkeletonCards count={3} />;
  const c = d.courier; const legal = d.legal ?? {};
  const valide = c.lifecycleStatus === 'approved';
  // « Paiements » et « Envoi » n'ont pas de champ obligatoire : sans cette règle, ils s'affichaient cochés (✓) dès le premier
  // écran, alors que rien n'était fait (test au téléphone, 12 oct. 2026). Payé = compte Stripe actif ; envoyé = dossier soumis.
  const etapeOk = (e) => {
    if (e === 'paiement') return (d.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'active';
    if (e === 'envoi') return !['draft', 'rejected'].includes(c.lifecycleStatus);
    return !MANQUES_PAR_ETAPE[e].some((m) => manques.includes(m) && !MANQUES_INFORMATIFS.includes(m));
  };
  const enDossier = c.lifecycleStatus === 'draft' || c.lifecycleStatus === 'rejected';
  if (experienceApp() && enDossier) {
    return <DossierAppli d={d} charger={charger} token={token} user={user} busy={busy} action={action} refreshUser={refreshUser} etapeDemandee={etape} />;
  }
  const allerAuChangement = () => { document.getElementById('changement-statut')?.scrollIntoView({ behavior: defilement(), block: 'start' }); };

  return (
    // Site : le bandeau iris de l'espace livreur (PageLivreur.jsx) ; app (dossier validé ou envoyé) : comme avant.
    <PageLivreur classe="courier-onboarding" titre={t('courierOnboarding.title')} sous={t('siteLivreur.dossierSous')}>

      {/* État du dossier */}
      <EtatDossier d={d} t={t} onChangeStatus={allerAuChangement} />
      {/* GUIDÉ, PAS UN FORMULAIRE À ONGLETS (12 oct. 2026). Le dossier s'ouvrait sur un long texte et six onglets : le
          livreur ne savait pas par où commencer. En tête, désormais, une seule carte : l'étape à faire, combien il en reste,
          un bouton. Les onglets restent pour revenir en arrière ; « Avant de commencer » est replié juste en dessous. */}
      {enDossier && (() => {
        const restantes = ETAPES.filter((e) => !etapeOk(e));
        const prochaine = restantes[0];
        if (!prochaine) return null;
        const nom = (prochaine === 'engagements' ? t('conformite.engagementsStep') : t(`courierOnboarding.step_${prochaine}`)).replace(/^\d+\.\s*/, '');
        return (
          <div className="card prochaine-etape">
            <span className="small">{t('courierOnboarding.nextStepCount', { n: restantes.length })}</span>
            <b>{t('courierOnboarding.nextStepTitle', { step: nom })}</b>
            {courante !== prochaine && <button type="button" className="btn-gold" onClick={() => setEtape(prochaine)}>{t('courierOnboarding.nextStepGo')}</button>}
          </div>
        );
      })()}
      <details className="card avant-de-commencer">
        <summary>{t('courierOnboarding.beforeTitle')}</summary>
        <AvantDeCommencer c={c} t={t} pricing={d.pricing} replie />
      </details>

      <Notifications t={t} token={token} />

      {/* Dossier envoyé (ou validé) et une pièce refusée par l'équipe : les étapes sont masquées hors brouillon, le livreur
          n'avait aucun moyen de la remplacer (audit UX du 15/10/2026). Il est prévenu par e-mail et notification ; ici, la
          pièce, le motif, et le bouton pour en déposer une autre. */}
      {!enDossier && <PiecesARemplacer d={d} t={t} token={token} busy={busy} action={action} />}
      {!enDossier && manques.includes('bce') && <NumeroEntrepriseEnAttente t={t} token={token} busy={busy} action={action} />}

      {/* Livreur déjà validé : les notices (B4, B8) doivent être relues quand leur texte change, sinon le
          serveur refuse la prochaine course (NOTICES_A_ACCEPTER). Les étapes ci-dessous ne s'affichent
          qu'en dossier brouillon : sans ce bloc, un livreur validé n'aurait aucun moyen de les accepter. */}
      {!enDossier && MANQUES_PAR_ETAPE.engagements.some((m) => m !== 'contrat' && manques.includes(m)) && (
        <EtapeNotices token={token} busy={busy} action={action} onNext={() => charger()} />
      )}

      {enDossier && (
        <>
          {/* L'EN-TÊTE DE L'ACCUEIL DE L'APP (2026-10-13, plan UX) : retour rond, barre de progression, « Étape n sur 6 ».
              La rangée de six onglets numérotés se lisait comme un formulaire à remplir dans le désordre ; la barre dit
              où l'on en est d'un coup d'œil. Chaque segment reste un onglet cliquable (et lu par un lecteur d'écran)
              pour revenir sur une étape. */}
          {(() => {
            const rang = ETAPES.indexOf(courante);
            const nomEtape = (e) => (e === 'engagements' ? t('conformite.engagementsStep') : t(`courierOnboarding.step_${e}`)).replace(/^\d+\.\s*/, '');
            return (
              <>
                <div className="courier-etape-tete">
                  <button type="button" className="courier-etape-retour" disabled={rang <= 0} onClick={() => setEtape(ETAPES[rang - 1])} aria-label={t('courierOnboarding.stepBack')} title={t('courierOnboarding.stepBack')}>
                    <Icone nom="retour" taille={18} />
                  </button>
                  <div className="courier-steps" role="tablist">
                    {ETAPES.map((e) => (
                      <button key={e} type="button" role="tab" aria-selected={courante === e} className={`courier-step${courante === e ? ' active' : ''}${etapeOk(e) ? ' done' : ''}`} onClick={() => setEtape(e)}>
                        <span className="sr-only">{nomEtape(e)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="courier-etape-titre"><span>{t('courierOnboarding.stepOf', { n: rang + 1, total: ETAPES.length })}</span> · <b>{nomEtape(courante)}</b></p>
              </>
            );
          })()}

          {courante === 'statut' && <EtapeStatut d={d} t={t} busy={busy} onChoose={(statusType) => action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType } }), t('courierOnboarding.toastStatusSaved')).then((ok) => ok && setEtape('identite'))} />}
          {courante === 'identite' && <EtapeIdentite d={d} t={t} busy={busy} token={token} action={action} onNext={() => setEtape('infos')} />}
          {courante === 'infos' && <EtapeInfos d={d} t={t} busy={busy} token={token} action={action} onNext={() => setEtape('engagements')} />}
          {courante === 'engagements' && (
            <EtapeNotices token={token} busy={busy} action={action} onNext={() => { charger(); setEtape('paiement'); }}
              contrat={{
                aSigner: manques.includes('contrat'),
                nom: `${c.identity?.firstName || ''} ${c.identity?.lastName || ''}`.trim() || d.user?.name || '',
                onApercu: () => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed'))
              }} />
          )}
          {courante === 'paiement' && <EtapePaiement d={d} t={t} busy={busy} token={token} user={user} action={action} onNext={() => setEtape('envoi')} />}
          {courante === 'envoi' && <EtapeEnvoi d={d} t={t} busy={busy} onSubmit={() => action(() => api('/couriers/me/submit', { method: 'POST', token }), t('courierOnboarding.toastSubmitted')).then(() => refreshUser?.())} onGoTo={setEtape} />}
        </>
      )}

      {(valide || c.lifecycleStatus === 'blocked_threshold' || c.lifecycleStatus === 'pending_review' || c.lifecycleStatus === 'suspended') && (
        <Compteurs d={d} t={t} />
      )}
      {/* Le tarif minimum se règle dans l'étape « Paiements » (fondateur, 2026-10-06 : il s'affichait sous chaque étape) ;
          ses documents de vente, une fois qu'il a pu livrer. */}
      {(valide || c.lifecycleStatus === 'suspended' || c.lifecycleStatus === 'blocked_threshold') && <DocumentsVente token={token} />}
      {!enDossier && <ChangementStatut d={d} t={t} token={token} action={action} busy={busy} onChanged={() => { setEtape('statut'); refreshUser?.(); }} />}
      <p className="small" style={{ marginTop: 16, opacity: 0.75 }}>{t('courierOnboarding.legalFooter', { year: legal.year ?? new Date().getFullYear() })} · <Link to="/driver">{t('courierOnboarding.backToDashboard')}</Link></p>
    </PageLivreur>
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
          {c.needsRenewal && <p className="small" style={{ margin: '6px 0 0', color: 'var(--gold-deep)' }}><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.renewalNeeded')}</p>}
          {c.lifecycleStatus === 'approved' && (
            <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>{c.statusVerifiedAt ? `${t('courierOnboarding.statusVerified', { date: new Date(c.statusVerifiedAt).toLocaleDateString(getLocale()) })}` : `${t('courierOnboarding.statusNotVerified')}`}</p>
          )}
          {c.lifecycleStatus === 'blocked_threshold' && (
            <>
              <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.blockedExplain', { year: legal.year ?? new Date().getFullYear() })}</p>
              <button type="button" className="btn-gold btn-sm" style={{ marginTop: 8 }} onClick={onChangeStatus}><Icone nom="melanger" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.blockedGoStatus')}</button>
            </>
          )}
        </div>
        {c.submittedAt && <span className="small">{t('courierOnboarding.submittedOn', { date: new Date(c.submittedAt).toLocaleDateString(getLocale()) })}</span>}
      </div>
    </div>
  );
}

// Les deux cartes de statut, chiffres tirés de la configuration fiscale de l'année (`legal`).
function EtapeStatut({ d, t, busy, onChoose }) {
  const legal = d.legal ?? {};
  const age = legal.adultMinAge ?? '—';
  const cartes = [
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
      {/* CODE-16 : comment devenir (étudiant-)indépendant, avant de choisir son statut. */}
      <GuideIndependant legal={legal} />
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.chooseStatus')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.chooseStatusHelp')}</p>
      <div className="courier-compare">
        {cartes.map((k) => (
          <div key={k.key} className={`courier-compare-card${d.courier.statusType === k.key ? ' active' : ''}`}>
            <div className="courier-compare-head"><Icone nom={EMOJI_STATUT[k.key]} taille={26} /><b>{t(`courierOnboarding.status_${k.key}`)}</b></div>
            <p className="small">{t(`courierOnboarding.status_${k.key}_desc`)}</p>
            <dl className="courier-compare-list">
              <dt>{t('courierOnboarding.cmpCeiling')}</dt><dd>{k.plafond}</dd>
              <dt>{t('courierOnboarding.cmpWithholding')}</dt><dd>{k.retenue}</dd>
              <dt>{t('courierOnboarding.cmpSocial')}</dt><dd>{k.social}</dd>
              <dt>{t('courierOnboarding.cmpVat')}</dt><dd>{k.tva}</dd>
              <dt>{t('courierOnboarding.cmpSteps')}</dt><dd>{k.demarches}</dd>
              <dt>{t('courierOnboarding.cmpAgeLabel')}</dt><dd>{k.age}</dd>
            </dl>
            <button type="button" className={d.courier.statusType === k.key ? 'btn-outline' : 'btn-teal'} disabled={busy} onClick={() => onChoose(k.key)}>
              {d.courier.statusType === k.key ? t('courierOnboarding.chosen') : t('courierOnboarding.choose')}
            </button>
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
  const [consentement, setConsentement] = useState(null);
  async function demarrer(provider) {
    await action(async () => {
      try {
        const r = await api('/couriers/me/identity/start', { method: 'POST', token, body: { provider } });
        // Stripe Identity dans le navigateur intégré de l'app (allerAuPaiement), retour au dossier à la fermeture.
        if (r.url) { await allerAuPaiement(r.url, { retour: '/driver/onboarding' }); return null; }
      } catch (e) {
        // B1 : le selfie exige un consentement biométrique séparé — on l'affiche au lieu de l'erreur.
        if (e.code === 'CONSENTEMENT_BIOMETRIQUE_REQUIS') { setConsentement(e.data?.consent || null); return null; }
        throw e;
      }
      return null;
    });
  }
  async function deposer(e) {
    const files = [...(e.target.files || [])].slice(0, 4); e.target.value = ''; if (!files.length) return;
    for (const f of files) { const ok = await action(() => apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType: 'identity_card' } }), null); if (!ok) break; }
    toast(files.length > 1 ? t('courierOnboarding.toastDocsUploaded', { n: files.length }) : t('courierOnboarding.toastDocUploaded'));
  }
  // Une pièce refusée par l'équipe ne compte pas (avant : coche verte « reçue, rien à refaire » sur une pièce refusée).
  const carte = (d.documents ?? []).filter((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && !x.rejectedReason);
  const refusee = carte.length === 0 ? (d.documents ?? []).find((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && x.rejectedReason) : null;
  const [autreMoyen, setAutreMoyen] = useState(false);
  const recue = id.status !== 'verified' && carte.length > 0 && !autreMoyen;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.identityTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.identityHelp')}</p>
      {recue ? (
        <div className="courier-ok"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.identityReceived', { n: carte.length })}
          <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.identityReceivedHelp')}</p>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { fichier.current?.click(); }}><Icone nom="lien" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.identityAddFile')}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAutreMoyen(true)}>{t('courierOnboarding.identityOtherWay')}</button>
          </div>
          <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />
        </div>
      ) : id.status === 'verified' ? (
        <div className="courier-ok"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.identityVerified', { name: `${id.firstName || ''} ${id.lastName || ''}`.trim(), provider: t(`courierOnboarding.provider_${id.provider}`) })}
          {id.nameMatchAccount === false && <p className="small" style={{ color: 'var(--red)', margin: '6px 0 0' }}><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.nameMismatch')}</p>}
        </div>
      ) : (
        <div className="courier-providers">
          {refusee && <p className="small texte-erreur" role="alert"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.identityRejected', { reason: refusee.rejectedReason })}</p>}
          <div className="courier-provider">
            <b><Icone nom="document" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.provider_stripe_identity')}</b>
            <p className="small">{t('courierOnboarding.stripeIdentityHelp')}</p>
            <button type="button" className="btn-teal" disabled={busy || !prov.stripe_identity} onClick={() => demarrer('stripe_identity')}>{id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('courierOnboarding.identityStart')}</button>
            {id.status === 'processing' && <p className="small"><Icone nom="horloge" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.identityProcessing')}</p>}
            {id.status === 'failed' && <p className="small texte-erreur">{t('courierOnboarding.identityFailed')}{ERREURS_IDENTITE.includes(id.error) && <> {t(`courierOnboarding.identityError_${id.error}`)}</>}</p>}
          </div>
          <div className="courier-provider">
            <b><Icone nom="document" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.provider_manual')}</b>
            <p className="small">{t('courierOnboarding.manualHelp')}</p>
            <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />
            <button type="button" className="btn-outline" disabled={busy} onClick={async () => { if (id.provider !== 'manual') await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } })); fichier.current?.click(); }}>{t('courierOnboarding.manualUpload')}</button>
            {carte.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.manualUploaded', { n: carte.length })}</p>}
          </div>
          {/* Contrôle en personne (CODE-14) : pour qui refuse la vérification biométrique — l'équipe fixe un rendez-vous. */}
          <div className="courier-provider">
            <b><Icone nom="contrat" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.provider_in_person')}</b>
            <p className="small">{t('courierOnboarding.inPersonHelp')}</p>
            {id.provider === 'in_person' && id.status === 'pending'
              ? <p className="small" style={{ margin: 0 }}><Icone nom="horloge" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.inPersonRequested')}</p>
              : <button type="button" className="btn-outline" disabled={busy || !prov.in_person} onClick={() => action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'in_person' } }), t('courierOnboarding.inPersonRequested'))}>{t('courierOnboarding.inPersonRequest')}</button>}
          </div>
        </div>
      )}
      {/* « Suivant » n'est le bouton lime qu'une fois l'identité lancée : avant, c'étaient les trois façons de la vérifier qu'il
          fallait voir, et le lime poussait à passer l'étape sans rien faire (audit du 15/10/2026). */}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className={id.status === 'verified' || id.status === 'processing' || (id.provider === 'manual' && carte.length > 0) || (id.provider === 'in_person' && id.status === 'pending') ? 'btn-gold' : 'btn-outline'} onClick={onNext}>{t('courierOnboarding.next')}</button></div>
      <ConsentementBiometrique consent={consentement} token={token} onFermer={() => setConsentement(null)}
        onAccepte={() => { setConsentement(null); demarrer('stripe_identity'); }}
        onManuel={async () => { setConsentement(null); await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } })); fichier.current?.click(); }} />
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
      <Champ label={t('courierOnboarding.fBce')} help={c.independent?.companyVerified ? `${t('courierOnboarding.bceVerified')}` : t('courierOnboarding.bceHelp')}><input aria-label="0123.456.789" value={f.companyNumber} onChange={set('companyNumber')} placeholder="0123.456.789" /></Champ>
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
  const c = d.courier; const legal = d.legal ?? {};
  const [f, setF] = useState(() => infosDepuisDossier(c));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  // Une date par pièce (elle était partagée : la date d'un permis partait avec l'assurance déposée ensuite).
  const [echeances, setEcheances] = useState({});
  const [partie, setPartie] = useState(0);
  const fichiers = useRef({});
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);

  // Silencieux : appelé à chaque « Continuer », un toast « Enregistré » par écran ne dirait rien de plus
  // que le passage à l'écran suivant. Une erreur, elle, s'affiche toujours (voir action()).
  async function enregistrer() {
    // Oui / non en texte dans le formulaire, booléen pour le serveur ; vide = pas encore répondu, rien n'est envoyé.
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body: corpsInfos(f) }));
    if (ok) setF((x) => ({ ...x, nationalNumber: '' }));
    return ok;
  }
  async function deposer(docType, e) {
    const files = [...(e.target.files || [])].slice(0, 6); e.target.value = ''; if (!files.length) return;
    const expiry = echeances[docType] || '';
    for (const file of files) {
      const ok = await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType, expiresAt: AVEC_ECHEANCE.includes(docType) ? expiry || undefined : undefined } }), files.length === 1 ? t('courierOnboarding.toastDocUploaded') : null);
      if (!ok) break;
    }
    if (files.length > 1) toast(t('courierOnboarding.toastDocsUploaded', { n: files.length }), 'succes');
  }
  // Photo de profil pour tous, pièces du statut, puis permis / immatriculation / assurance pour un véhicule motorisé.
  // Hors EEE (B2) : titre de séjour (avec échéance) et carte professionnelle d'indépendant.
  const horsEee = f.nationalityGroup === 'THIRD';
  const docsRequis = documentsRequis(d, { statusType: c.statusType, motorise, horsEee });
  const docsDe = (type) => (d.documents ?? []).filter((x) => x.docType === type);

  // L'ÉTAPE EN QUATRE ÉCRANS (2026-09-23). Elle tenait sur une seule page : identité administrative,
  // courses, champs du statut et pièces à déposer, avec deux boutons (« Enregistrer », puis « Enregistrer
  // et continuer ») qui faisaient presque la même chose. Même principe que l'inscription : un sujet par
  // écran, un seul bouton. « Continuer » enregistre l'écran avant de passer au suivant, et un écran sans
  // objet pour le statut (pas de section statut, aucune pièce requise) n'existe simplement pas.
  const titreStatut = { student_independent: `${t('courierOnboarding.stuIndepSection')}`, independent: `${t('courierOnboarding.indepSection')}` }[c.statusType];
  const parties = ['perso', 'course', ...(titreStatut ? ['statut'] : []), ...(docsRequis.length ? ['documents'] : [])];
  const cle = parties[Math.min(partie, parties.length - 1)];
  const titres = { perso: t('courierOnboarding.partPersonal'), course: t('courierOnboarding.partRides'), statut: titreStatut, documents: `${t('courierOnboarding.docsTitle')}` };
  const rang = parties.indexOf(cle);
  async function continuer() {
    // Les pièces se déposent une à une, à l'envoi du fichier : l'écran des documents n'a rien à enregistrer.
    if (cle !== 'documents' && !(await enregistrer())) return;
    if (rang < parties.length - 1) { setPartie(rang + 1); window.scrollTo({ top: 0 }); } else onNext();
  }

  return (
    <div className="card">
      <div className="auth-step-head">
        <h3>{titres[cle]}</h3>
        <div className="auth-step-bar"><span style={{ width: `${((rang + 1) / parties.length) * 100}%` }} /></div>
      </div>
      {cle === 'perso' && (<>
        <div className="courier-grid">
          <Champ label={t('conformite.fNationality')} help={horsEee ? t('conformite.fNationalityThirdHelp') : null}>
            <select value={f.nationalityGroup} onChange={set('nationalityGroup')}>
              <option value="">-</option>
              {['BE', 'EEA_CH', 'THIRD'].map((n) => <option key={n} value={n}>{t(`conformite.nationality_${n}`)}</option>)}
            </select>
          </Champ>
          <Champ label={t('courierOnboarding.fBirthDate')}><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Champ>
          <Champ label={t('courierOnboarding.fNrn')} help={c.hasNationalNumber ? t('courierOnboarding.nrnStored', { masked: c.nationalNumberMasked }) : t('courierOnboarding.nrnHelp')}>
            <input aria-label="85.07.30-033.28" inputMode="numeric" value={f.nationalNumber} onChange={set('nationalNumber')} placeholder="85.07.30-033.28" />
          </Champ>
          {/* Plus d'IBAN ici (12 oct. 2026) : il se donne une seule fois, à Stripe, à l'étape « Paiements ». */}
        </div>
      </>)}
      {cle === 'course' && (<>
        <div className="courier-grid">
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
          {/* Venu de l'inscription (12 oct. 2026) : décide d'une ou deux courses à la fois (routes/orders.js). */}
          <Champ label={t('auth.platformsTitle')} help={t('auth.platformsHelp')}>
            <select value={f.worksOtherPlatforms} onChange={set('worksOtherPlatforms')}>
              <option value="">-</option>
              <option value="no">{t('auth.platformsNo')}</option>
              <option value="yes">{t('auth.platformsYes')}</option>
            </select>
          </Champ>
          <div className="sac-dessin" style={{ gridColumn: '1 / -1' }}>
            <SacLivraison size={84} />
            <p className="small" style={{ margin: 0 }}>{t('auth.bagDrawing')}</p>
          </div>
          <Champ label={t('courierOnboarding.fBag')} help={['none', 'due'].includes(c.bag?.depositStatus || 'none') ? t('courierOnboarding.fBagHelp', { amount: c.bag?.depositAmount || 40 }) : t(`courierOnboarding.bagDeposit_${c.bag.depositStatus}`, { amount: c.bag?.depositAmount || 40 })}>
            <select value={f.bagOption} onChange={set('bagOption')} disabled={!['none', 'due'].includes(c.bag?.depositStatus || 'none')}>
              <option value="">-</option>
              <option value="own">{t('auth.bag_own')}</option>
              <option value="fairide">{t('auth.bag_fairide')}</option>
            </select>
          </Champ>
        </div>

      </>)}
      {cle === 'statut' && (<>
        {c.statusType === 'student_independent' && (<>
          <div className="courier-grid">
            <Champ label={t('courierOnboarding.fSchool')}><input value={f.schoolName} onChange={set('schoolName')} /></Champ>
            <Champ label={t('courierOnboarding.fAcademicYear')}><input aria-label="2026-2027" value={f.academicYear} onChange={set('academicYear')} placeholder="2026-2027" /></Champ>
            <ChampCaisse f={f} set={set} t={t} />
            <ChampsEntreprise c={c} f={f} set={set} t={t} legal={legal} />
          </div>
          {legal.studentParentsCeiling != null && <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>{t('courierOnboarding.studentParentsInfo', { amount: euro(legal.studentParentsCeiling) })}</p>}
        </>)}

        {c.statusType === 'independent' && (<>
          <div className="courier-grid">
            <ChampsEntreprise c={c} f={f} set={set} t={t} legal={legal} />
            <ChampCaisse f={f} set={set} t={t} />
            <Champ label={t('courierOnboarding.fLegalName')}><input value={f.legalName} onChange={set('legalName')} /></Champ>
            <Champ label={t('courierOnboarding.fSeat')}><input value={f.seatAddress} onChange={set('seatAddress')} /></Champ>
          </div>
        </>)}

      </>)}
      {cle === 'documents' && (<>
        {docsRequis.length > 0 && (<>
          {docsRequis.map((type) => (
            <div key={type} className="courier-doc">
              <div>
                <b>{t(`courierOnboarding.doc_${type}`)}</b>
                <p className="small" style={{ margin: '2px 0 0' }}>{t(`courierOnboarding.doc_${type}_help`)}</p>
                {docsDe(type).map((x) => (
                  <div key={x.id} className="small" style={{ marginTop: 4 }}>
                    {x.verifiedAt ? <Icone nom="valider" taille={16} className="icone-texte" /> : x.rejectedReason ? <Icone nom="croix" taille={16} className="icone-texte" /> : <Icone nom="horloge" taille={16} className="icone-texte" />} <button type="button" className="lien-bouton" onClick={() => ouvrirDocument({ url: x.prive ? null : x.fileUrl, lien: `/couriers/me/documents/${x.id}/lien`, token, toast, messageErreur: t('courierOnboarding.docUnavailable') })}>{t('courierOnboarding.docView')}</button>
                    {x.expiresAt && ` · ${t('courierOnboarding.docExpires', { date: new Date(x.expiresAt).toLocaleDateString(getLocale()) })}`}
                    {x.rejectedReason && <span className="texte-erreur"> · {x.rejectedReason}</span>}
                    {!x.verifiedAt && <button type="button" className="btn-ghost btn-sm" onClick={() => action(() => api(`/couriers/me/documents/${x.id}`, { method: 'DELETE', token }))}>{t('courierOnboarding.docDelete')}</button>}
                  </div>
                ))}
                {/* DISPENSE DEMANDÉE (audit UX du 15/10/2026, backend migration 038). Réfugié, résident de longue durée, famille
                    d'un citoyen européen… : le titre de séjour suffit. Seule l'équipe pouvait le noter ; le dossier restait bloqué
                    sans issue. La case permet d'envoyer le dossier ; la dispense n'est accordée que par l'équipe, et aucune course
                    n'est possible avant (couriers.peutPrendreCourse). */}
                {type === 'professional_card' && (c.selfEmploymentByResidence ? (
                  <p className="small" style={{ margin: '6px 0 0' }}><Icone nom="valider" taille={16} className="icone-texte" /> {t('courierOnboarding.proCardExemptGranted')}</p>
                ) : (
                  <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                    <input type="checkbox" style={{ width: 'auto', marginTop: 2 }} checked={!!c.selfEmploymentClaimedAt} disabled={busy}
                      onChange={(e) => action(() => api('/couriers/me', { method: 'PATCH', token, body: { selfEmploymentClaim: e.target.checked } }))} />
                    <span>{t('courierOnboarding.proCardExemptClaim')}</span>
                  </label>
                ))}
              </div>
              <div className="courier-doc-actions">
                {AVEC_ECHEANCE.includes(type) && (
                  <label className="courier-doc-echeance small">
                    {t(ECHEANCE_REQUISE.includes(type) ? 'courierOnboarding.docExpiryRequiredLabel' : 'courierOnboarding.docExpiryLabel')}
                    <input type="date" value={echeances[type] || ''} onChange={(e) => setEcheances((x) => ({ ...x, [type]: e.target.value }))} />
                  </label>
                )}
                <input ref={(el) => { fichiers.current[type] = el; }} type="file" multiple={!['profile_photo', 'selfie'].includes(type)} accept={['profile_photo', 'selfie'].includes(type) ? 'image/*' : 'application/pdf,image/*'} capture={type === 'selfie' ? 'user' : undefined} style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
                <button type="button" className="btn-outline" disabled={busy} onClick={() => {
                  if (ECHEANCE_REQUISE.includes(type) && !echeances[type]) { toast(t('courierOnboarding.docExpiryFirst'), 'erreur'); return; }
                  fichiers.current[type]?.click();
                }}>{docsDe(type).length ? t('courierOnboarding.docReplace') : t('courierOnboarding.docUpload')}</button>
              </div>
            </div>
          ))}
        </>)}
      </>)}
      <div className="auth-step-nav">
        {rang > 0 && <button type="button" className="btn-outline" onClick={() => setPartie(rang - 1)}>{t('auth.back')}</button>}
        <button type="button" className="btn-gold" style={{ flex: 1 }} disabled={busy} onClick={continuer}>{busy ? '…' : t('auth.continueStep')}</button>
      </div>
    </div>
  );
}

function EtapePaiement({ d, t, busy, token, user, action, onNext }) {
  const [connecting, setConnecting] = useState(false); const [erreur, setErreur] = useState('');
  const statut = d.user?.stripeConnectStatus || user?.stripeConnectStatus;
  async function connecter() {
    setConnecting(true); setErreur('');
    // Dans l'app, Stripe s'ouvre dans le navigateur intégré et l'on revient ici en le fermant (allerAuPaiement, natif.js) ;
    // sur le site, rien ne change : la page part vers Stripe.
    try { const r = await api('/auth/me/connect/onboard', { method: 'POST', token, body: { retour: 'onboarding' } }); await allerAuPaiement(r.url, { retour: '/driver/onboarding' }); setConnecting(false); } catch (e) { setErreur(e.message); setConnecting(false); }
  }
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.paymentTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.paymentHelp')}</p>
      {statut === 'active' ? <div className="courier-ok"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.paymentActive')}</div> : (
        <>
          {/* Activer : LE geste de cet écran (lime) ; « Suivant » passe en contour tant que ce n'est pas fait (audit du 15/10/2026). */}
          <button type="button" className="btn-gold" disabled={connecting || busy} onClick={connecter}>{connecting ? '…' : t('courierOnboarding.paymentStart')}</button>
          {erreur && <p className="small" style={{ margin: '8px 0 0' }}>{erreur}</p>}
          {/* La date d'ouverture ne se montre qu'AVANT l'ouverture : après, « l'activation ouvre le 5 octobre » se lisait au passé. */}
          {!paiementsOuverts() && <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('courierOnboarding.paymentLater', { date: dateOuverturePaiements(getLocale()) })}</p>}
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}><button type="button" className={statut === 'active' ? 'btn-gold' : 'btn-outline'} onClick={onNext}>{t('courierOnboarding.next')}</button></div>
      {/* Le livreur vend la livraison (décision du 23/09/2026) : son tarif minimum se règle ici, et seulement ici. */}
      <div style={{ marginTop: 14 }}><TarifMinimum key={d.courier?.minFeeCents ?? 'aucun'} courier={d.courier} token={token} action={action} busy={busy} /></div>
    </div>
  );
}

// AVANT DE COMMENCER (fondateur, 2026-10-06) : ce que le livreur doit savoir — il commence après validation par Fairide ;
// jusqu'à trois courses à la fois s'il ne livre que pour Fairide (2026-10-17), une seule s'il livre aussi ailleurs ; comment il
// est payé ; le fonds d'assurance Fairide (10 % des frais de livraison) ; sa responsabilité en cas d'accident ou d'infraction.
function AvantDeCommencer({ c, t, pricing, replie = false }) {
  const autre = c?.otherPlatforms?.works === true;
  const eur = (v) => `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
  const p = { base: eur(pricing?.deliveryBaseFee ?? 5), km: Number(pricing?.deliveryBaseKm ?? 1), perKm: eur(pricing?.driverPerKmMotor ?? 0.8), radius: String(pricing?.secondOrderRadiusKm ?? 2).replace('.', ','), delay: Number(pricing?.extraOrderMaxDelayMin ?? 10) };
  return (
    <div className={replie ? undefined : 'card'} style={{ marginBottom: replie ? 0 : 12, marginTop: replie ? 8 : 0 }}>
      {!replie && <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.beforeTitle')}</h3>}
      <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>{t('courierOnboarding.beforeValidation')}</li>
        <li>{autre ? t('courierOnboarding.beforeOneOrder') : t('courierOnboarding.beforeThreeOrders', { radius: p.radius, delay: p.delay })}</li>
        <li>{t('courierOnboarding.beforePayment', p)}</li>
        <li>{t('courierOnboarding.beforeInsurance')}</li>
        <li>{t('courierOnboarding.beforeLiability')}</li>
      </ul>
    </div>
  );
}

function EtapeEnvoi({ d, t, busy, onSubmit, onGoTo }) {
  // Le numéro d'entreprise peut arriver après l'envoi (MANQUES_APRES_ENVOI) : il ne retient pas le bouton.
  const manque = (d.missing ?? []).filter((m) => !MANQUES_INFORMATIFS.includes(m) && !MANQUES_APRES_ENVOI.includes(m));
  const entrepriseEnAttente = (d.missing ?? []).some((m) => MANQUES_APRES_ENVOI.includes(m));
  const infos = (d.missing ?? []).filter((m) => MANQUES_INFORMATIFS.includes(m));
  const etapeDe = (m) => Object.keys(MANQUES_PAR_ETAPE).find((e) => MANQUES_PAR_ETAPE[e].includes(m)) || 'infos';
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.submitTitle')}</h3>
      {manque.length === 0 ? (
        <>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.submitReady')}</p>
          {entrepriseEnAttente && <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.bceLater')}</p>}
          <button type="button" className="btn-gold" disabled={busy} onClick={onSubmit}>{busy ? '…' : t('courierOnboarding.submit')}</button>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('courierOnboarding.submitMissing')}</p>
          <ul className="courier-missing">
            {manque.map((m) => <li key={m}><button type="button" className="btn-ghost" style={{ padding: '2px 6px' }} onClick={() => onGoTo(etapeDe(m))}>{libelleManque(m, t)}</button></li>)}
          </ul>
        </>
      )}
      {infos.map((m) => <p key={m} className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t(`courierOnboarding.missing_${m}`)}</p>)}
    </div>
  );
}

// Compteurs de l'année : brut, net et courses, avec un rappel du seuil social qui concerne le statut. (Plus de jauge de
// plafond ni de précompte : ils n'existaient que pour l'économie collaborative, retirée — CODE-12.)
function Compteurs({ d, t }) {
  const c = d.courier; const legal = d.legal ?? {}; const th = d.thresholds ?? {};
  const annee = th.year ?? legal.year ?? new Date().getFullYear();
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}><Icone nom="stats" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.countersTitle')} {annee}</h3>
      <div className="stat-grid" style={{ marginTop: 10, marginBottom: 8 }}>
        <div className="stat-card"><div className="num">{euro(th.grossTotal)}</div><div className="label">{t('courierOnboarding.grossYear')}</div></div>
        <div className="stat-card highlight"><div className="num">{euro(th.netTotal ?? (Number(th.grossTotal || 0) - Number(th.withholdingTotal || 0)))}</div><div className="label">{t('courierOnboarding.netYear')}</div></div>
        <div className="stat-card"><div className="num">{th.deliveries ?? 0}</div><div className="label">{t('courierOnboarding.deliveriesYear')}</div></div>
      </div>
      {c.statusType === 'student_independent' && <p className="small" style={{ margin: '0 0 6px' }}>{t('courierOnboarding.thresholdInfoStudentIndependent', { exemption: euroOuTiret(legal.studentIndependentExemption), ceiling: euroOuTiret(legal.studentIndependentCeiling) })}</p>}
      {c.statusType === 'independent' && <p className="small" style={{ margin: '0 0 6px' }}>{t('courierOnboarding.thresholdInfoIndependent', { rate: `${pctTexte(legal.independentSocialRate)} %`, exemption: euroOuTiret(legal.independentComplementaryExemption) })}</p>}
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
        <b><Icone nom="cloche" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.notificationsTitle')} ({liste.length})</b>
        <button type="button" className="btn-ghost btn-sm" onClick={() => lire(null)}>{t('courierOnboarding.markAllRead')}</button>
      </div>
      {liste.map((n) => (
        <div key={n.id} className="row small" style={{ justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span>{n.createdAt ? `${new Date(n.createdAt).toLocaleDateString(getLocale())} · ` : ''}{texte(n)}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => lire([n.id])}>{t('courierOnboarding.markRead')}</button>
        </div>
      ))}
    </div>
  );
}

// Changement de statut en libre-service : le dossier repasse en vérification (documents du nouveau
// statut, nouveau contrat), d'où la confirmation.
function ChangementStatut({ d, t, token, action, busy, onChanged }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const c = d.courier;
  const choix = STATUTS.filter((x) => x !== c.statusType);
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
        <h3 style={{ margin: 0, fontSize: 15 }}><Icone nom="melanger" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.changeStatusTitle')}</h3>
        <button type="button" className="btn-ghost" onClick={() => setOuvert((v) => !v)}>{ouvert ? t('courierOnboarding.hide') : t('courierOnboarding.open')}</button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>{c.lifecycleStatus === 'blocked_threshold' ? t('courierOnboarding.changeStatusBlocked') : t('courierOnboarding.changeStatusHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={idsA11y + '-newstatus'}>{t('courierOnboarding.newStatus')}</label>
              <select id={idsA11y + '-newstatus'} value={cible} onChange={(e) => setCible(e.target.value)}>{choix.map((x) => <option key={x} value={x}>{t(`courierOnboarding.status_${x}`)}</option>)}</select>
            </div>
            <button type="button" className="btn-outline" disabled={busy || !cible} onClick={() => setConfirm(true)}>{t('courierOnboarding.changeStatusBtn')}</button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} title={t('courierOnboarding.changeStatusConfirmTitle')} message={t('courierOnboarding.changeStatusConfirmBody', { status: cible ? t(`courierOnboarding.status_${cible}`) : '' })} confirmLabel={t('courierOnboarding.changeStatusBtn')} loading={busy} onConfirm={changer} onCancel={() => setConfirm(false)} />
    </div>
  );
}

// Pièces refusées sans remplacement déposé depuis, hors brouillon (voir l'appel plus haut).
/* LE NUMÉRO D'ENTREPRISE, APRÈS L'ENVOI (fondateur, 18/10/2026). Le dossier est parti sans lui (MANQUES_APRES_ENVOI) ; les
 * étapes sont masquées une fois le dossier envoyé, donc on le demande ici, seul. Dès qu'il est là, l'équipe peut valider. */
function NumeroEntrepriseEnAttente({ t, token, busy, action }) {
  const [bce, setBce] = useState('');
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.bcePendingTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('courierOnboarding.bcePendingText')}</p>
      <form className="row" style={{ gap: 8, flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); action(() => api('/couriers/me', { method: 'PATCH', token, body: { companyNumber: bce.trim() } }), t('courierOnboarding.bceSaved')); }}>
        <input aria-label={t('courierOnboarding.fBce')} value={bce} onChange={(e) => setBce(e.target.value)} placeholder="0123.456.789" inputMode="numeric" style={{ flex: '1 1 180px' }} />
        <button type="submit" className="btn-gold" disabled={busy || !bce.trim()}>{busy ? '…' : t('common.save')}</button>
      </form>
    </div>
  );
}

function PiecesARemplacer({ d, t, token, busy, action }) {
  const toast = useToast();
  const [echeances, setEcheances] = useState({});
  const fichiers = useRef({});
  const docs = d.documents ?? [];
  const types = [...new Set(docs.filter((x) => x.rejectedReason).map((x) => x.docType))]
    .filter((type) => !docs.some((x) => x.docType === type && !x.rejectedReason));
  if (!types.length) return null;
  async function deposer(type, e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType: type, expiresAt: AVEC_ECHEANCE.includes(type) ? echeances[type] || undefined : undefined } }), t('courierOnboarding.toastDocUploaded'));
  }
  return (
    <div className="card" role="alert" style={{ borderColor: 'var(--red)' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('courierOnboarding.docsToReplaceTitle')}</h3>
      {types.map((type) => {
        const refus = docs.filter((x) => x.docType === type && x.rejectedReason).at(-1);
        return (
          <div key={type} className="courier-doc">
            <div>
              <b>{t(`courierOnboarding.doc_${type}`)}</b>
              <p className="small texte-erreur" style={{ margin: '2px 0 0' }}>{refus?.rejectedReason}</p>
            </div>
            <div className="courier-doc-actions">
              {AVEC_ECHEANCE.includes(type) && (
                <label className="courier-doc-echeance small">
                  {t(ECHEANCE_REQUISE.includes(type) ? 'courierOnboarding.docExpiryRequiredLabel' : 'courierOnboarding.docExpiryLabel')}
                  <input type="date" value={echeances[type] || ''} onChange={(e) => setEcheances((x) => ({ ...x, [type]: e.target.value }))} />
                </label>
              )}
              <input ref={(el) => { fichiers.current[type] = el; }} type="file" accept={['profile_photo', 'selfie'].includes(type) ? 'image/*' : 'application/pdf,image/*'} capture={type === 'selfie' ? 'user' : undefined} style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
              <button type="button" className="btn-gold" disabled={busy} onClick={() => {
                if (ECHEANCE_REQUISE.includes(type) && !echeances[type]) { toast(t('courierOnboarding.docExpiryFirst'), 'erreur'); return; }
                fichiers.current[type]?.click();
              }}>{t('courierOnboarding.docReplace')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
