import { useEffect, useRef, useState } from 'react';
import { api, apiUpload, API_BASE } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dateOuverturePaiements, paiementsOuverts } from '../../launch';
import { allerAuPaiement } from '../../natif';
import { libelleManque } from '../../conformite';
import { euros } from '../../prixPlat';
import ouvrirDocument from '../../ouvrirDocument';
import Icone from '../../components/Icone';
import EcranPlein from '../../components/EcranPlein';
import SousEcran from '../../components/SousEcran';
import { ConsentementBiometrique } from '../../components/conformite/LivreurConformite';
import { Haut, Option, Fait } from '../app/EcransBienvenue';
import { Champ } from '../app/InscriptionAppli';
import RouteVelo from '../../components/livreur/RouteVelo';
import '../../ecran-livreur.css';
import { MANQUES_INFORMATIFS, MANQUES_APRES_ENVOI, ERREURS_IDENTITE, CAISSES, AVEC_ECHEANCE, ECHEANCE_REQUISE, documentsRequis, corpsInfos, infosDepuisDossier, ouvrirPdf } from './dossierCommun';

/* LE DOSSIER LIVREUR DANS L'APPLICATION (2026-10-15) — /driver/onboarding tant que le dossier est en brouillon.
 *
 * C'est la première page d'un livreur qui vient de s'inscrire. Sur le site, elle empile le titre, l'état du dossier, la
 * carte « Prochaine étape », « Avant de commencer », l'en-tête des étapes, puis l'étape — dont certaines (Infos, Mes
 * engagements) poussent leur bouton un à deux écrans plus bas. Ici, les écrans de l'accueil : un sujet par écran (un
 * document = un écran), le bouton en bas, la progression en haut, une croix pour sortir. Depuis le 2026-10-19, la page
 * s'ouvre sur le sommaire (SommaireDossier : bandeau iris, « À faire », « Fait ») ; son bouton lime mène au premier écran qui
 * manque encore quelque chose, et la croix d'un écran y ramène.
 *
 * MÊMES ROUTES, MÊMES RÈGLES que le dossier du site (Onboarding.jsx), les listes communes dans dossierCommun.js :
 * POST /couriers/me/status, /identity/start, /documents, PATCH /couriers/me, POST /engagements, Stripe Connect, /submit.
 * Ce qui n'est pas ici reste sur la page normale, une fois le dossier envoyé : compteurs, changement de statut, documents
 * de vente. Le guide « comment devenir indépendant » (liens vers les sites publics) reste sur la version du site. */
const STATUTS = [['independent', 'mallette'], ['student_independent', 'guide']];
const VEHICULES = ['velo', 'velo_electrique', 'scooter', 'voiture'];
const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
// Ancienne étape du dossier du site (retour de Stripe : setEtape('envoi')) → écran d'ici.
const ECRAN_DE_ETAPE = { statut: 'statut', identite: 'identite', infos: 'perso', engagements: 'engagements', paiement: 'paiement', envoi: 'envoi' };

// Ce qui manque → l'écran qui le demande.
function ecranDuManque(m, statusType) {
  if (m.startsWith('document_')) return m === 'document_identity_card' ? 'identite' : `doc:${m.slice('document_'.length)}`;
  const table = {
    statut: 'statut', identite: 'identite', nationalite: 'perso', date_naissance: 'perso', registre_national: 'perso', age_minimum: 'perso',
    zone: 'course', vehicule: 'course', permis_immatriculation: 'course', ecole: 'etudes', bce: 'entreprise', tva: 'entreprise', tva_numero: 'entreprise',
    caisse: statusType === 'student_independent' ? 'caisse' : 'societe', siege: 'societe',
    titre_sejour: 'doc:residence_permit', carte_professionnelle: 'doc:professional_card'
  };
  if (table[m]) return table[m];
  if ([...AVANT_COURSE, 'contrat'].includes(m)) return 'engagements';
  return null;
}

export default function DossierAppli({ d, charger, token, user, busy, action, refreshUser, etapeDemandee }) {
  const { t } = useLanguage();
  const c = d.courier; const legal = d.legal ?? {};
  const manques = (d.missing ?? []).filter((m) => !MANQUES_INFORMATIFS.includes(m));
  const stripeActif = (d.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'active';

  const [f, setF] = useState(() => infosDepuisDossier(c));
  const val = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);
  const horsEee = f.nationalityGroup === 'THIRD';
  const docs = documentsRequis(d, { statusType: c.statusType, motorise, horsEee });
  const ecrans = ['statut', 'identite', 'perso', 'course', 'autres',
    ...(c.statusType === 'student_independent' ? ['etudes', 'entreprise', 'caisse'] : c.statusType === 'independent' ? ['entreprise', 'societe'] : []),
    ...docs.map((x) => `doc:${x}`), 'engagements', 'paiement', 'tarif', 'envoi'];
  const aFaire = (e) => manques.some((m) => ecranDuManque(m, c.statusType) === e);

  // Le premier écran qui manque encore quelque chose : là où mène « Compléter mon dossier ».
  const premierEcran = ecrans.find(aFaire) || (stripeActif ? 'envoi' : 'paiement');

  // `ecran` vide : le sommaire du dossier (SommaireDossier, plus bas). Une étape demandée (retour de Stripe) s'ouvre directement.
  const [ecran, setEcran] = useState(() => ECRAN_DE_ETAPE[etapeDemandee] || null);
  const [recule, setRecule] = useState(false);
  const rang = Math.max(0, ecrans.indexOf(ecran));
  const aller = (e, arriere = false) => { setRecule(arriere); setEcran(e); };
  const suivant = () => aller(ecrans[Math.min(rang + 1, ecrans.length - 1)]);
  // La croix (et le retour depuis le premier écran) ramène au sommaire, plus au tableau de bord : on y voit ce qui reste.
  const fermer = () => aller(null, true);
  const retour = () => (rang > 0 ? aller(ecrans[rang - 1], true) : fermer());

  // Les écrans « Infos » enregistrent le formulaire entier, comme « Continuer » sur le site (silencieux : l'écran suivant suffit).
  async function enregistrerPuisSuivant() {
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body: corpsInfos(f) }));
    if (ok) { setF((x) => ({ ...x, nationalNumber: '' })); suivant(); }
  }

  if (!ecran) {
    return <SommaireDossier d={d} t={t} user={user} ecrans={ecrans} docs={docs} manques={manques} aFaire={aFaire} stripeActif={stripeActif}
      premierEcran={premierEcran} onOuvrir={(e) => aller(e)} />;
  }

  let titre = ''; let sous = null; let contenu = null; let pied = null;
  const continuer = (fn = suivant, libelle = t('appli.continuer')) => <button type="button" className="bv-btn btn-teal" disabled={busy} onClick={fn}>{busy ? t('common.loading') : libelle}</button>;
  const select = (id, k, options, vide = '-') => (
    <select id={id} value={f[k]} onChange={(e) => val(k, e.target.value)}>
      <option value="">{vide}</option>
      {options.map(([v, txt]) => <option key={v} value={v}>{txt}</option>)}
    </select>
  );

  if (ecran === 'statut') {
    titre = t('auth.courierStatusTitle'); sous = t('appli.dosStatutSous');
    contenu = <EcranStatut c={c} t={t} busy={busy} onChoix={(st) => (st === c.statusType ? suivant() : action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType: st } }), t('courierOnboarding.toastStatusSaved')).then((ok) => ok && suivant()))} />;
  } else if (ecran === 'identite') {
    titre = t('courierOnboarding.identityTitle'); sous = t('courierOnboarding.identityHelp');
    contenu = <EcranIdentite d={d} t={t} token={token} busy={busy} action={action} onSuivant={suivant} />;
  } else if (ecran === 'perso') {
    titre = t('courierOnboarding.partPersonal');
    contenu = (
      <>
        <Champ id="dos-nat" label={t('conformite.fNationality')} aide={horsEee ? t('conformite.fNationalityThirdHelp') : null}>
          {select('dos-nat', 'nationalityGroup', ['BE', 'EEA_CH', 'THIRD'].map((n) => [n, t(`conformite.nationality_${n}`)]))}
        </Champ>
        <Champ id="dos-naissance" label={t('courierOnboarding.fBirthDate')}>
          <input id="dos-naissance" type="date" value={f.birthDate} onChange={(e) => val('birthDate', e.target.value)} />
        </Champ>
        <Champ id="dos-nrn" label={t('courierOnboarding.fNrn')} aide={c.hasNationalNumber ? t('courierOnboarding.nrnStored', { masked: c.nationalNumberMasked }) : t('courierOnboarding.nrnHelp')}>
          <input id="dos-nrn" inputMode="numeric" value={f.nationalNumber} onChange={(e) => val('nationalNumber', e.target.value)} placeholder="85.07.30-033.28" />
        </Champ>
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran === 'course') {
    titre = t('courierOnboarding.partRides');
    contenu = (
      <>
        <Champ id="dos-zone" label={t('courierOnboarding.fZone')}>{select('dos-zone', 'zone', (d.zones ?? []).map((z) => [z, z]))}</Champ>
        <span className="bv-etiquette">{t('courierOnboarding.fVehicle')}</span>
        <div className="bv-grille" style={{ marginBottom: 14 }}>
          {(d.vehicles ?? VEHICULES).map((v) => <Option key={v} on={f.vehicleType === v} titre={t(`courierOnboarding.vehicle_${v}`)} onClick={() => val('vehicleType', v)} />)}
        </div>
        {motorise && (
          <div className="bv-rangee bv-rangee-moitie">
            <Champ id="dos-permis" label={t('courierOnboarding.fLicence')}><input id="dos-permis" value={f.licenceNumber} onChange={(e) => val('licenceNumber', e.target.value)} /></Champ>
            <Champ id="dos-plaque" label={t('courierOnboarding.fPlate')}><input id="dos-plaque" value={f.licencePlate} onChange={(e) => val('licencePlate', e.target.value)} placeholder="1-ABC-123" /></Champ>
          </div>
        )}
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran === 'autres') {
    // Autres plateformes (une ou deux courses à la fois, routes/orders.js) et le sac de livraison.
    const sacModifiable = ['none', 'due'].includes(c.bag?.depositStatus || 'none');
    titre = t('appli.dosAutresTitre');
    contenu = (
      <>
        <span className="bv-etiquette" id="dos-plateformes">{t('auth.platformsTitle')}</span>
        <div className="bv-segments" role="radiogroup" aria-labelledby="dos-plateformes">
          {[['no', t('auth.platformsNo')], ['yes', t('auth.platformsYes')]].map(([v, txt]) => (
            <button key={v} type="button" role="radio" aria-checked={f.worksOtherPlatforms === v} className={f.worksOtherPlatforms === v ? 'on' : ''} onClick={() => val('worksOtherPlatforms', v)}>{txt}</button>
          ))}
        </div>
        <p className="bv-aide" style={{ margin: '-4px 0 18px' }}>{t('auth.platformsHelp')}</p>
        <span className="bv-etiquette" id="dos-sac">{t('courierOnboarding.fBag')}</span>
        <div className="bv-segments" role="radiogroup" aria-labelledby="dos-sac">
          {[['own', t('auth.bag_own')], ['fairide', t('auth.bag_fairide')]].map(([v, txt]) => (
            <button key={v} type="button" role="radio" aria-checked={f.bagOption === v} disabled={!sacModifiable} className={f.bagOption === v ? 'on' : ''} onClick={() => val('bagOption', v)}>{txt}</button>
          ))}
        </div>
        <p className="bv-aide" style={{ marginTop: -4 }}>{sacModifiable ? t('courierOnboarding.fBagHelp', { amount: c.bag?.depositAmount || 40 }) : t(`courierOnboarding.bagDeposit_${c.bag.depositStatus}`, { amount: c.bag?.depositAmount || 40 })}</p>
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran === 'etudes') {
    titre = t('courierOnboarding.stuIndepSection');
    contenu = (
      <>
        <Champ id="dos-ecole" label={t('courierOnboarding.fSchool')}><input id="dos-ecole" value={f.schoolName} onChange={(e) => val('schoolName', e.target.value)} /></Champ>
        <Champ id="dos-annee" label={t('courierOnboarding.fAcademicYear')} aide={legal.studentParentsCeiling != null ? t('courierOnboarding.studentParentsInfo', { amount: euros(legal.studentParentsCeiling) }) : null}>
          <input id="dos-annee" inputMode="numeric" value={f.academicYear} onChange={(e) => val('academicYear', e.target.value)} placeholder="2026-2027" />
        </Champ>
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran === 'entreprise') {
    titre = t('appli.dosEntrepriseTitre');
    contenu = (
      <>
        <Champ id="dos-bce" label={t('courierOnboarding.fBce')} aide={c.independent?.companyVerified ? t('courierOnboarding.bceVerified') : t('courierOnboarding.bceHelp')}>
          <input id="dos-bce" inputMode="numeric" value={f.companyNumber} onChange={(e) => val('companyNumber', e.target.value)} placeholder="0123.456.789" />
        </Champ>
        <Champ id="dos-tva" label={t('courierOnboarding.fVatStatus')}>
          {select('dos-tva', 'vatStatus', [['franchise', t('courierOnboarding.vatFranchise', { max: legal.franchiseMaxTurnover != null ? euros(legal.franchiseMaxTurnover) : '—' })], ['assujetti', t('courierOnboarding.vatNormal')]])}
        </Champ>
        {f.vatStatus === 'assujetti' && (
          <Champ id="dos-tva-num" label={t('courierOnboarding.fVatNumber')}><input id="dos-tva-num" value={f.vatNumber} onChange={(e) => val('vatNumber', e.target.value)} placeholder="BE0123456789" /></Champ>
        )}
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran === 'caisse' || ecran === 'societe') {
    const connue = !f.socialInsuranceFund || CAISSES.includes(f.socialInsuranceFund);
    titre = ecran === 'caisse' ? t('courierOnboarding.fSocialInsuranceFund') : t('appli.dosSocieteTitre');
    contenu = (
      <>
        <Champ id="dos-caisse" label={ecran === 'caisse' ? null : t('courierOnboarding.fSocialInsuranceFund')} aide={t('courierOnboarding.fSocialInsuranceFundHelp')}>
          {select('dos-caisse', 'socialInsuranceFund', [...CAISSES.map((x) => [x, x]), ...(connue ? [] : [[f.socialInsuranceFund, f.socialInsuranceFund]])])}
        </Champ>
        {ecran === 'societe' && (
          <>
            <Champ id="dos-raison" label={t('courierOnboarding.fLegalName')}><input id="dos-raison" value={f.legalName} onChange={(e) => val('legalName', e.target.value)} /></Champ>
            <Champ id="dos-siege" label={t('courierOnboarding.fSeat')}><input id="dos-siege" value={f.seatAddress} onChange={(e) => val('seatAddress', e.target.value)} /></Champ>
          </>
        )}
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ecran.startsWith('doc:')) {
    const type = ecran.slice(4);
    titre = t(`courierOnboarding.doc_${type}`); sous = t(`courierOnboarding.doc_${type}_help`);
    contenu = <EcranDocument key={type} type={type} d={d} c={c} t={t} token={token} busy={busy} action={action} />;
    pied = continuer();
  } else if (ecran === 'engagements') {
    titre = t('conformite.engagementsTitle');
    contenu = <EcranEngagements t={t} token={token} busy={busy} action={action} onSuivant={() => { charger(); suivant(); }}
      contrat={{ aSigner: manques.includes('contrat'), nom: `${c.identity?.firstName || ''} ${c.identity?.lastName || ''}`.trim() || d.user?.name || '', onApercu: () => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed')) }} />;
  } else if (ecran === 'paiement') {
    titre = t('courierOnboarding.paymentTitle'); sous = t('courierOnboarding.paymentHelp');
    contenu = <EcranPaiement t={t} token={token} busy={busy} actif={stripeActif} onSuivant={suivant} />;
  } else if (ecran === 'tarif') {
    titre = t('conformite.minFeeTitle'); sous = t('conformite.minFeeHelp');
    contenu = <EcranTarif c={c} t={t} token={token} busy={busy} action={action} onSuivant={suivant} />;
  } else {
    titre = t('courierOnboarding.submitTitle');
    contenu = (
      <EcranEnvoi d={d} t={t} busy={busy} manques={manques} statusType={c.statusType} onAller={(e) => aller(e, true)}
        onEnvoyer={() => action(() => api('/couriers/me/submit', { method: 'POST', token }), t('courierOnboarding.toastSubmitted')).then(() => refreshUser?.())} />
    );
  }

  return (
    <EcranPlein etiquette={t('courierOnboarding.title')}>
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={ecran}>
        <Haut onRetour={retour} progression={(rang + 1) / ecrans.length} onFermer={fermer} />
        <div className="bv-form">
          <h1 className="bv-titre bv-titre-form">{titre}</h1>
          {sous && <p className="bv-sous">{sous}</p>}
          {contenu}
          {pied && <><div className="bv-grandit" />{pied}</>}
        </div>
      </main>
    </EcranPlein>
  );
}

/* LE SOMMAIRE DU DOSSIER (fondateur, 2026-10-19, finitions-appli.html, section 4 « Courier › Mon dossier ») : ce que voit le
 * livreur en ouvrant son dossier, avant les écrans. Sur le bandeau iris : « Livreur · prénom », « Mon dossier », combien
 * d'étapes sont faites, et le vélo posé sur la route à cette hauteur (comme la route de l'inscription). Dans la feuille :
 * « À faire » d'abord (rond vide cerclé d'iris, l'étape, ce qui y manque, chevron ; toucher la ligne ouvre son premier écran
 * incomplet), UN bouton lime qui ouvre le premier écran qui manque (celui où s'ouvrait le dossier jusqu'ici), puis « Fait »
 * (ronds iris cochés ; toucher la ligne rouvre l'étape pour la corriger). Tout fait : le bandeau le dit, pas de bouton lime.
 *
 * Une étape regroupe des écrans de `ecrans` ; elle est faite quand aucun d'eux n'a de manque — paiements : compte Stripe
 * actif ; envoi : dossier envoyé. Les écrans et leurs règles ne changent pas (le BCE reste exigé à l'envoi, pas à
 * l'inscription : c'est un manque comme un autre, sous « Ton activité »). */
const ETAPES_SOMMAIRE = [
  ['statut', ['statut']],
  ['identite', ['identite']],
  ['infos', ['perso', 'course', 'autres']],
  ['activite', ['etudes', 'entreprise', 'caisse', 'societe']],
  ['documents', null], // les écrans doc:… du statut choisi
  ['engagements', ['engagements']],
  ['paiement', ['paiement', 'tarif']],
  ['envoi', ['envoi']]
];

function SommaireDossier({ d, t, user, ecrans, docs, manques, aFaire, stripeActif, premierEcran, onOuvrir }) {
  const c = d.courier;
  const etapes = ETAPES_SOMMAIRE.map(([cle, liste]) => {
    const siens = (liste ?? docs.map((x) => `doc:${x}`)).filter((e) => ecrans.includes(e));
    const fait = cle === 'paiement' ? stripeActif : cle === 'envoi' ? !['draft', 'rejected'].includes(c.lifecycleStatus) : !siens.some(aFaire);
    return { cle, siens, fait, manquants: manques.filter((m) => siens.includes(ecranDuManque(m, c.statusType))) };
  }).filter((e) => e.siens.length);
  const restantes = etapes.filter((e) => !e.fait);
  const faites = etapes.filter((e) => e.fait);
  const total = etapes.length;
  const prenom = c.identity?.firstName || (d.user?.name || user?.name || '').trim().split(/\s+/)[0];
  const sousBandeau = !restantes.length ? t('appli.dosToutFait', { total })
    : t(restantes.length === 1 ? 'appli.dosEtapesUne' : 'appli.dosEtapes', { fait: faites.length, total, reste: restantes.length });

  // Sous une étape à faire : ce qui y manque s'il n'y a qu'une chose, combien s'il y en a plusieurs (les libellés des manques
  // viennent de deux familles de textes, mis bout à bout ils se lisaient mal), sinon sa ligne d'aide ; sous une étape faite, ce
  // qui a été choisi.
  const detail = (e) => {
    if (!e.fait) {
      if (!e.manquants.length) return t(`appli.dosAide_${e.cle}`);
      if (e.manquants.length > 1) return t('appli.dosAManquer', { n: e.manquants.length });
      const txt = libelleManque(e.manquants[0], t);
      return txt.charAt(0).toUpperCase() + txt.slice(1);
    }
    if (e.cle === 'statut' && c.statusType) return t(`courierOnboarding.status_${c.statusType}`);
    if (e.cle === 'infos') return [c.vehicleType && t(`courierOnboarding.vehicle_${c.vehicleType}`), c.zone].filter(Boolean).join(' · ') || null;
    if (e.cle === 'activite') return c.independent?.companyNumber || null;
    if (e.cle === 'paiement') return t('courierOnboarding.paymentActive');
    return null;
  };
  const ligne = (e) => {
    const sous = detail(e);
    return (
      <li key={e.cle}>
        <button type="button" className="ecl-etape" onClick={() => onOuvrir(e.siens.find(aFaire) || e.siens[0])}>
          <span className={`ecl-rond-etape${e.fait ? ' fait' : ''}`} aria-hidden="true">{e.fait && <Icone nom="valider" taille={14} />}</span>
          <span className="ecl-grow"><b>{t(`appli.dosEtape_${e.cle}`)}</b>{sous && <small>{sous}</small>}</span>
          {!e.fait && <Icone nom="retour" taille={16} className="bv-chevron" />}
        </button>
      </li>
    );
  };
  // Il ne reste que l'envoi : le bouton le dit (il ouvre l'écran d'envoi, qui montre ce qui sera envoyé).
  const seulEnvoi = restantes.length === 1 && restantes[0].cle === 'envoi';

  return (
    <div className="ecl ecl-page ecl-dossier">
      <section className="ecl-bandeau">
        <div className="ecl-b-haut"><span>{t('appli.dosLivreur')}{prenom && <> · <b>{prenom}</b></>}</span></div>
        <h1 className="ecl-b-titre">{t('appli.dosTitre')}</h1>
        <p className="ecl-b-sous">{sousBandeau}</p>
        <RouteVelo position={Math.round(6 + (88 * faites.length) / Math.max(1, total))} depart={6} />
      </section>
      <div className="ecl-feuille">
        {c.lifecycleStatus === 'rejected' && c.reviewReason && (
          <p className="ecl-note"><Icone nom="alerte" taille={18} />{t('courierOnboarding.rejectedReason', { reason: c.reviewReason })}</p>
        )}
        {restantes.length > 0 && (
          <>
            <h2 className="ecl-titre-sec">{t('appli.dosAFaire')}</h2>
            <ul className="ecl-etapes">{restantes.map(ligne)}</ul>
            <button type="button" className="btn-gold ecl-bouton-dossier" onClick={() => onOuvrir(premierEcran)}>
              {seulEnvoi ? t('appli.dosVerifierEnvoyer') : t('appli.dosCompleter')}
            </button>
          </>
        )}
        {faites.length > 0 && (
          <>
            <h2 className="ecl-titre-sec">{t('appli.dosFait')}</h2>
            <ul className="ecl-etapes">{faites.map(ligne)}</ul>
          </>
        )}
      </div>
    </div>
  );
}

// Le statut : deux choix, la ligne courte de l'inscription sous chacun. Choisir le même ne rappelle pas le serveur.
function EcranStatut({ c, t, busy, onChoix }) {
  const [choix, setChoix] = useState(c.statusType || '');
  return (
    <>
      {STATUTS.map(([st, icone]) => <Option key={st} on={choix === st} icone={icone} titre={t(`courierOnboarding.status_${st}`)} sous={t(`appli.insStatut_${st}`)} onClick={() => setChoix(st)} />)}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={busy || !choix} onClick={() => onChoix(choix)}>{busy ? t('common.loading') : t('appli.continuer')}</button>
    </>
  );
}

// L'identité : trois façons (Stripe Identity, une photo de la pièce, en personne) ; une fois lancée, ce qui en est.
function EcranIdentite({ d, t, token, busy, action, onSuivant }) {
  const toast = useToast();
  const id = d.courier.identity ?? {}; const prov = d.identityProviders ?? {};
  const fichier = useRef(null);
  const [consentement, setConsentement] = useState(null);
  const [choix, setChoix] = useState(prov.stripe_identity ? 'stripe_identity' : 'manual');
  const [autreMoyen, setAutreMoyen] = useState(false);
  // Une pièce refusée par l'équipe ne compte pas : le livreur lit le motif et en dépose une autre.
  const pieces = (d.documents ?? []).filter((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && !x.rejectedReason);
  const refusee = pieces.length === 0 ? (d.documents ?? []).find((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && x.rejectedReason) : null;
  async function stripe() {
    await action(async () => {
      try {
        const r = await api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'stripe_identity' } });
        if (r.url) { await allerAuPaiement(r.url, { retour: '/driver/onboarding' }); return null; }
      } catch (e) {
        // B1 : le selfie exige un consentement biométrique séparé — on l'affiche au lieu de l'erreur.
        if (e.code === 'CONSENTEMENT_BIOMETRIQUE_REQUIS') { setConsentement(e.data?.consent || null); return null; }
        throw e;
      }
      return null;
    });
  }
  async function manuel() {
    if (id.provider !== 'manual') await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } }));
    fichier.current?.click();
  }
  async function deposer(e) {
    const files = [...(e.target.files || [])].slice(0, 4); e.target.value = ''; if (!files.length) return;
    for (const f of files) { const ok = await action(() => apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType: 'identity_card' } }), null); if (!ok) break; }
    setAutreMoyen(false);
    toast(files.length > 1 ? t('courierOnboarding.toastDocsUploaded', { n: files.length }) : t('courierOnboarding.toastDocUploaded'));
  }
  const entree = <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />;
  const lance = id.status === 'verified' || id.status === 'processing' || (id.provider === 'in_person' && id.status === 'pending') || (pieces.length > 0 && !autreMoyen);

  if (lance) {
    const [icone, txt, s] = id.status === 'verified'
      ? ['valider', t('courierOnboarding.identityVerified', { name: `${id.firstName || ''} ${id.lastName || ''}`.trim(), provider: t(`courierOnboarding.provider_${id.provider}`) }), id.nameMatchAccount === false ? t('courierOnboarding.nameMismatch') : null]
      : id.status === 'processing' ? ['horloge', t('courierOnboarding.identityProcessing'), null]
        : id.provider === 'in_person' && id.status === 'pending' ? ['horloge', t('courierOnboarding.inPersonRequested'), null]
          : ['valider', t('courierOnboarding.identityReceived', { n: pieces.length }), t('courierOnboarding.identityReceivedHelp')];
    return (
      <>
        <Fait icone={icone} titre={txt} sous={s} />
        {id.status !== 'verified' && pieces.length > 0 && (
          <>
            <button type="button" className="bv-ajout" onClick={() => fichier.current?.click()}>＋ {t('courierOnboarding.identityAddFile')}</button>
            <button type="button" className="bv-ajout" onClick={() => setAutreMoyen(true)}>{t('courierOnboarding.identityOtherWay')}</button>
          </>
        )}
        {entree}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-teal" onClick={onSuivant}>{t('appli.continuer')}</button>
      </>
    );
  }
  const actions = { stripe_identity: [stripe, id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('courierOnboarding.identityStart')], manual: [manuel, t('courierOnboarding.manualUpload')], in_person: [() => action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'in_person' } }), t('courierOnboarding.inPersonRequested')), t('courierOnboarding.inPersonRequest')] };
  return (
    <>
      {[['stripe_identity', 'document', 'stripeIdentityHelp'], ['manual', 'apercu', 'manualHelp'], ['in_person', 'personnes', 'inPersonHelp']]
        .filter(([p]) => p === 'manual' || prov[p])
        .map(([p, icone, aide]) => <Option key={p} on={choix === p} icone={icone} titre={t(`courierOnboarding.provider_${p}`)} sous={t(`courierOnboarding.${aide}`)} onClick={() => setChoix(p)} />)}
      {refusee && <p className="field-error" role="alert">{t('courierOnboarding.identityRejected', { reason: refusee.rejectedReason })}</p>}
      {id.status === 'failed' && <p className="field-error" role="alert">{t('courierOnboarding.identityFailed')}{ERREURS_IDENTITE.includes(id.error) && <> {t(`courierOnboarding.identityError_${id.error}`)}</>}</p>}
      {entree}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" disabled={busy} onClick={actions[choix][0]}>{busy ? t('common.loading') : actions[choix][1]}</button>
      <button type="button" className="bv-lien" onClick={onSuivant}>{t('appli.pasMaintenant')}</button>
      <ConsentementBiometrique consent={consentement} token={token} onFermer={() => setConsentement(null)}
        onAccepte={() => { setConsentement(null); stripe(); }}
        onManuel={() => { setConsentement(null); setChoix('manual'); manuel(); }} />
    </>
  );
}

// Une pièce : ce qui est déjà déposé (voir, retirer), l'échéance quand elle compte, le dépôt.
function EcranDocument({ type, d, c, t, token, busy, action }) {
  const toast = useToast();
  const fichier = useRef(null);
  const [echeance, setEcheance] = useState('');
  const deposes = (d.documents ?? []).filter((x) => x.docType === type);
  const photo = ['profile_photo', 'selfie'].includes(type);
  async function deposer(e) {
    const files = [...(e.target.files || [])].slice(0, 6); e.target.value = ''; if (!files.length) return;
    for (const file of files) {
      const ok = await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType: type, expiresAt: AVEC_ECHEANCE.includes(type) ? echeance || undefined : undefined } }), files.length === 1 ? t('courierOnboarding.toastDocUploaded') : null);
      if (!ok) break;
    }
    if (files.length > 1) toast(t('courierOnboarding.toastDocsUploaded', { n: files.length }), 'succes');
  }
  return (
    <>
      {deposes.map((x) => (
        <div key={x.id} className="bv-fichier">
          <Icone nom={x.verifiedAt ? 'valider' : x.rejectedReason ? 'croix' : 'horloge'} taille={16} />
          <span>
            <button type="button" className="lien-bouton" onClick={() => ouvrirDocument({ url: x.prive ? null : x.fileUrl, lien: `/couriers/me/documents/${x.id}/lien`, token, toast, messageErreur: t('courierOnboarding.docUnavailable') })}>{t('courierOnboarding.docView')}</button>
            {x.expiresAt && ` · ${t('courierOnboarding.docExpires', { date: new Date(x.expiresAt).toLocaleDateString(getLocale()) })}`}
            {x.rejectedReason && <span className="texte-erreur"> · {x.rejectedReason}</span>}
          </span>
          {!x.verifiedAt && <button type="button" className="bv-rond" aria-label={t('courierOnboarding.docDelete')} onClick={() => action(() => api(`/couriers/me/documents/${x.id}`, { method: 'DELETE', token }))}><Icone nom="croix" taille={14} /></button>}
        </div>
      ))}
      {AVEC_ECHEANCE.includes(type) && (
        <Champ id={`dos-echeance-${type}`} label={t(ECHEANCE_REQUISE.includes(type) ? 'courierOnboarding.docExpiryRequiredLabel' : 'courierOnboarding.docExpiryLabel')}>
          <input id={`dos-echeance-${type}`} type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </Champ>
      )}
      <input ref={fichier} type="file" multiple={!photo} accept={photo ? 'image/*' : 'application/pdf,image/*'} capture={type === 'selfie' ? 'user' : undefined} style={{ display: 'none' }} onChange={deposer} />
      <button type="button" className="bv-option" disabled={busy} onClick={() => {
        if (ECHEANCE_REQUISE.includes(type) && !echeance) { toast(t('courierOnboarding.docExpiryFirst'), 'erreur'); return; }
        fichier.current?.click();
      }}>
        <span className="bv-tuile"><Icone nom={photo ? 'apercu' : 'document'} taille={20} /></span>
        <span>{deposes.length ? t('courierOnboarding.docReplace') : t('courierOnboarding.docUpload')}</span>
      </button>
      {/* Dispense de carte professionnelle (audit UX du 15/10/2026) : la case débloque l'envoi ; l'équipe accorde la dispense. */}
      {type === 'professional_card' && (c.selfEmploymentByResidence ? (
        <p className="bv-aide"><Icone nom="valider" taille={16} className="icone-texte" /> {t('courierOnboarding.proCardExemptGranted')}</p>
      ) : (
        <label className="bv-case-ligne bv-case-discrete">
          <input type="checkbox" checked={!!c.selfEmploymentClaimedAt} disabled={busy} onChange={(e) => action(() => api('/couriers/me', { method: 'PATCH', token, body: { selfEmploymentClaim: e.target.checked } }))} />
          <span>{t('courierOnboarding.proCardExemptClaim')}</span>
        </label>
      ))}
    </>
  );
}

// « Mes engagements » : les textes derrière une rangée (une feuille les montre, chacun repliable), une case, le nom tapé si le
// contrat est à signer, un bouton (comme EtapeNotices). Les cinq textes dépliés poussaient la case et le bouton hors de l'écran.
function EcranEngagements({ t, token, busy, action, onSuivant, contrat }) {
  const [liste, setListe] = useState(null);
  const [textesOuverts, setTextesOuverts] = useState(false);
  const [coche, setCoche] = useState(false);
  const [nom, setNom] = useState(contrat?.nom || '');
  const charger = () => api('/couriers/me/consents', { token }).then((r) => setListe(Array.isArray(r) ? r : [])).catch(() => setListe([]));
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!liste) return <p className="bv-sous">{t('common.loading')}</p>;
  const reste = liste.filter((x) => AVANT_COURSE.includes(x.kind) && !x.accepted);
  const toutAccepte = !reste.length && !contrat.aSigner;
  async function accepter() {
    const ok = await action(() => api('/couriers/me/engagements', { method: 'POST', token, body: { accepted: true, typedName: nom.trim() } }), t('conformite.engagementsAcceptedToast'));
    if (ok) { await charger(); onSuivant(); }
  }
  if (toutAccepte) {
    return (<><Fait icone="valider" titre={t('conformite.engagementsDone')} /><div className="bv-grandit" /><button type="button" className="bv-btn btn-teal" onClick={onSuivant}>{t('appli.continuer')}</button></>);
  }
  return (
    <>
      <p className="bv-sous">{t('conformite.engagementsHelp')}</p>
      <Option icone="document" titre={t('appli.dosLireTextes', { n: reste.length + (contrat.aSigner ? 1 : 0) })} onClick={() => setTextesOuverts(true)} />
      {textesOuverts && (
        <SousEcran titre={t('conformite.engagementsTitle')} onFermer={() => setTextesOuverts(false)}>
          <div className="bv-textes">
            {reste.map((x) => (
              <details key={x.kind}>
                <summary>{x.title}</summary>
                {/* Texte rendu tel quel : c'est sa version exacte (et son empreinte) qui est enregistrée. */}
                <div className="bv-texte-legal">{x.text}</div>
              </details>
            ))}
            {contrat.aSigner && <button type="button" className="bv-ajout" onClick={contrat.onApercu}><Icone nom="document" taille={16} className="icone-texte" /> {t('conformite.engagementsReadContract')}</button>}
          </div>
        </SousEcran>
      )}
      <label className="bv-case-ligne">
        <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} />
        <span>{contrat.aSigner ? t('conformite.engagementsCheckWithContract') : t('conformite.engagementsCheck')}</span>
      </label>
      {contrat.aSigner && (
        <Champ id="dos-signature" label={t('courierOnboarding.typedName')}>
          <input id="dos-signature" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
        </Champ>
      )}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" disabled={busy || !coche || (contrat.aSigner && nom.trim().length < 3)} onClick={accepter}>{busy ? t('common.loading') : t('conformite.engagementsButton')}</button>
    </>
  );
}

// Les paiements : Stripe dans le navigateur intégré de l'app ; « Pas maintenant » ne bloque rien d'autre.
function EcranPaiement({ t, token, busy, actif, onSuivant }) {
  const [ouverture, setOuverture] = useState(false);
  const [erreur, setErreur] = useState('');
  async function connecter() {
    setOuverture(true); setErreur('');
    try { const r = await api('/auth/me/connect/onboard', { method: 'POST', token, body: { retour: 'onboarding' } }); await allerAuPaiement(r.url, { retour: '/driver/onboarding' }); }
    catch (e) { setErreur(e.message); } finally { setOuverture(false); }
  }
  if (actif) return (<><Fait icone="valider" titre={t('courierOnboarding.paymentActive')} /><div className="bv-grandit" /><button type="button" className="bv-btn btn-teal" onClick={onSuivant}>{t('appli.continuer')}</button></>);
  return (
    <>
      <Fait icone="banque" titre={t('appli.dosStripe')} sous={!paiementsOuverts() ? t('courierOnboarding.paymentLater', { date: dateOuverturePaiements(getLocale()) }) : null} />
      {erreur && <p className="field-error" role="alert">{erreur}</p>}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" disabled={ouverture || busy} onClick={connecter}>{ouverture ? t('common.loading') : t('courierOnboarding.paymentStart')}</button>
      <button type="button" className="bv-lien" onClick={onSuivant}>{t('appli.pasMaintenant')}</button>
    </>
  );
}

// Le tarif minimum (par course et par km) : facultatif, enregistré seulement s'il a changé (comme TarifMinimum).
function EcranTarif({ c, t, token, busy, action, onSuivant }) {
  const depart = [c.minFeeCents, c.minFeePerKmCents].map((v) => (v != null ? (v / 100).toFixed(2) : ''));
  const [valeur, setValeur] = useState(depart[0]);
  const [parKm, setParKm] = useState(depart[1]);
  const centimes = (v) => { const b = String(v).replace(',', '.').trim(); return b === '' ? null : Math.round(Number(b) * 100); };
  const invalide = [valeur, parKm].some((v) => v !== '' && !(Number(String(v).replace(',', '.')) >= 0));
  async function suite() {
    if (valeur === depart[0] && parKm === depart[1]) { onSuivant(); return; }
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body: { minFeeCents: centimes(valeur), minFeePerKmCents: centimes(parKm) } }), t('conformite.minFeeSaved'));
    if (ok) onSuivant();
  }
  return (
    <>
      <div className="bv-rangee bv-rangee-moitie">
        <Champ id="dos-min" label={t('conformite.minFeeLabel')}><input id="dos-min" type="number" min="0" max="100" step="0.10" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} /></Champ>
        <Champ id="dos-min-km" label={t('conformite.minFeePerKmLabel')}><input id="dos-min-km" type="number" min="0" max="10" step="0.05" inputMode="decimal" value={parKm} onChange={(e) => setParKm(e.target.value)} /></Champ>
      </div>
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={busy || invalide} onClick={suite}>{busy ? t('common.loading') : (valeur || parKm) ? t('appli.continuer') : t('appli.dosSansMinimum')}</button>
    </>
  );
}

// L'envoi : ce qui manque encore, chaque ligne ramène à son écran ; sinon « Envoyer mon dossier ».
function EcranEnvoi({ d, t, busy, manques: tousManques, statusType, onAller, onEnvoyer }) {
  const infos = (d.missing ?? []).filter((m) => MANQUES_INFORMATIFS.includes(m));
  // Le numéro d'entreprise peut arriver après l'envoi (MANQUES_APRES_ENVOI) : il ne retient pas le bouton.
  const manques = tousManques.filter((m) => !MANQUES_APRES_ENVOI.includes(m));
  const entrepriseEnAttente = tousManques.some((m) => MANQUES_APRES_ENVOI.includes(m));
  if (!manques.length) {
    return (
      <>
        <p className="bv-sous">{t('courierOnboarding.submitReady')}</p>
        {entrepriseEnAttente && <p className="bv-aide">{t('courierOnboarding.bceLater')}</p>}
        {infos.map((m) => <p key={m} className="bv-aide">{t(`courierOnboarding.missing_${m}`)}</p>)}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={busy} onClick={onEnvoyer}>{busy ? t('common.loading') : t('courierOnboarding.submit')}</button>
      </>
    );
  }
  // Quatre lignes au plus (un dossier tout neuf en compte une douzaine) ; le bouton mène au premier manque.
  const premier = manques.map((m) => ecranDuManque(m, statusType)).find(Boolean);
  return (
    <>
      <p className="bv-sous">{t('courierOnboarding.submitMissing')}</p>
      <div className="bv-carte bv-manques">
        {manques.slice(0, 4).map((m) => {
          const e = ecranDuManque(m, statusType);
          return (
            <button key={m} type="button" disabled={!e} onClick={() => e && onAller(e)}>
              <span>{libelleManque(m, t)}</span>{e && <Icone nom="retour" taille={16} className="bv-chevron" />}
            </button>
          );
        })}
        {manques.length > 4 && <p className="bv-petit" style={{ padding: '10px 0' }}>{t('appli.etAutres', { n: manques.length - 4 })}</p>}
      </div>
      {infos.map((m) => <p key={m} className="bv-aide">{t(`courierOnboarding.missing_${m}`)}</p>)}
      <div className="bv-grandit" />
      {premier && <button type="button" className="bv-btn btn-gold" onClick={() => onAller(premier)}>{t('appli.dosCompleter')}</button>}
    </>
  );
}
