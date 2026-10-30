import { useEffect, useRef, useState } from 'react';
import { api, apiUpload, API_BASE } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dateOuverturePaiements, paiementsOuverts } from '../../launch';
import { ouvrirStripe } from '../../ouvrirStripe';
import { libelleManque } from '../../conformite';
import ouvrirDocument from '../../ouvrirDocument';
import Icone from '../../components/Icone';
import EcranPlein from '../../components/EcranPlein';
import SousEcran from '../../components/SousEcran';
import { RetraitConsentementBiometrique } from '../../components/conformite/LivreurConformite';
import { Haut, Option, Fait } from '../app/EcransBienvenue';
import { Champ } from '../app/InscriptionAppli';
import RouteVelo from '../../components/livreur/RouteVelo';
import { formaterAnneeAcademique } from '../../validation';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import { defilement } from '../../gestes';
import { euros } from '../../prixPlat';
import GuideIndependant from '../../components/livreur/GuideIndependant';
import { AvantDeCommencer } from './dossierBlocs';
import '../../ecran-livreur.css';
import '../../ecran-general.css'; // le rond du retour (.gn-rond) de la fin express
import { MANQUES_INFORMATIFS, MANQUES_APRES_ENVOI, ERREURS_IDENTITE, CAISSES, AVEC_ECHEANCE, ECHEANCE_REQUISE, documentsRequis, corpsInfos, infosDepuisDossier, ouvrirPdf } from './dossierCommun';

/* UN SEUL DOSSIER, SUR LE SITE COMME DANS L'APP (fondateur, 2026-10-25). Le site avait son propre dossier en six étapes
 * (Onboarding.jsx) : le livreur qui commençait sur le site et continuait dans l'app (ou l'inverse) tombait sur un autre écran,
 * et chaque correction se faisait deux fois. Il n'en reste qu'un, celui-ci. Sur un téléphone (site ou app), rien ne change :
 * le sommaire, puis un écran plein par sujet. Sur le site, à partir de 1 100 px (useSiteLarge), le sommaire reste à gauche et
 * l'écran ouvert s'affiche à droite, dans la page : on voit tout le dossier en remplissant une étape, comme les six onglets
 * le permettaient. Ce que seul le site avait est repris ici : le comparatif des deux statuts et le guide « devenir
 * indépendant » (« Lequel choisir ? »), l'avertissement aux étudiants sur la charge des parents, « Avant de commencer », et
 * le renvoi d'un dossier refusé (le serveur n'envoie seul qu'un brouillon : avancerDossier ; sans bouton, un dossier refusé
 * dans l'app restait « complet » sans issue).
 *
 * LE DOSSIER LIVREUR DANS L'APPLICATION (2026-10-15) — /driver/onboarding tant que le dossier est en brouillon.
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
 *
 * INSCRIPTION EXPRESS DEPUIS LE 2026-10-22 (version A de maquettes/inscription-livreur/inscription-livreur.html) : l'inscription ne
 * demande plus que le compte ; ici, « Ton activité » (statut, numéro d'entreprise lu au registre, adresse s'il ne la donne pas,
 * école, TVA, nationalité, caisse), « Tes courses » (véhicule, zone, autres plateformes, sac, minimum), hors EEE les deux pièces,
 * la pièce d'identité chez Stripe sans selfie, « Pièce vérifiée » (registre national), le compte de versement, la photo, une case.
 * Plus d'écran d'envoi : le serveur envoie le dossier dès qu'il est complet et le valide seul quand tout est vert
 * (routes/couriers.js › avancerDossier) ; Onboarding.jsx montre alors FinExpress (« Tu peux rouler » ou « Presque prêt »).
 * Une fois le dossier envoyé, l'app passe à DossierSuivi.jsx (compteurs, changement de statut, documents de vente, en bandeau
 * et feuille depuis le 2026-10-19). */
const STATUTS = ['independent', 'student_independent'];
const VEHICULES = ['velo', 'velo_electrique', 'scooter', 'voiture'];

/* CE QUI EST TAPÉ RESTE (fondateur, 2026-10-30, coupure 5 de maquettes/progression). « Ton activité », « Tes courses » et
 * « Registre » ne vont au serveur que sur « Continuer » : sorti avant (app fermée, appel, croix), le livreur retapait tout.
 * Ici, dans le téléphone seulement, les champs qu'il a CHANGÉS et pas encore envoyés : jamais une valeur que le serveur a
 * déjà (elle remplacerait une correction faite depuis par l'équipe), jamais le numéro de registre national. Une fois
 * envoyés, ils sont égaux au dossier et la clé s'efface d'elle-même. 30 jours au plus, ce compte seulement. Déclaré dans la
 * politique des cookies (cookiesPolicy.technical). */
const CLE_SAISIE = 'fairide_dossier_livreur';
const SAISIE_MAX_MS = 30 * 24 * 3600 * 1000;
const JAMAIS_GARDE = ['nationalNumber'];
function lireSaisie(compteId) {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SAISIE) || 'null');
    return s && compteId && s.compte === compteId && Date.now() - (s.at || 0) < SAISIE_MAX_MS ? s.champs || {} : {};
  } catch { return {}; }
}
function ecrireSaisie(compteId, champs) {
  try {
    if (!compteId || !Object.keys(champs).length) localStorage.removeItem(CLE_SAISIE);
    else localStorage.setItem(CLE_SAISIE, JSON.stringify({ compte: compteId, at: Date.now(), champs }));
  } catch { /* stockage indisponible : on retapera */ }
}
const NATIONALITES = ['BE', 'EEA_CH', 'THIRD'];
const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
// Ancienne étape du dossier du site (retour de Stripe : setEtape('envoi')) → écran d'ici.
const ECRAN_DE_ETAPE = { statut: 'activite', identite: 'identite', infos: 'activite', engagements: 'engagements', paiement: 'paiement', envoi: 'paiement' }; // « envoi » : le retour de Stripe Connect (Onboarding.jsx)

// Ce qui manque → l'écran qui le demande.
function ecranDuManque(m) {
  if (m.startsWith('document_')) return m === 'document_identity_card' ? 'identite' : `doc:${m.slice('document_'.length)}`;
  const table = {
    statut: 'activite', identite: 'identite', nationalite: 'activite', date_naissance: 'registre', registre_national: 'registre', age_minimum: 'registre',
    zone: 'courses', vehicule: 'courses', permis_immatriculation: 'courses', ecole: 'activite', bce: 'activite', tva: 'activite', tva_numero: 'activite',
    caisse: 'activite', siege: 'activite',
    titre_sejour: 'doc:residence_permit', carte_professionnelle: 'doc:professional_card'
  };
  if (table[m]) return table[m];
  if ([...AVANT_COURSE, 'contrat'].includes(m)) return 'engagements';
  return null;
}

export default function DossierAppli({ d, charger, token, user, busy, action, refreshUser, etapeDemandee }) {
  const { t } = useLanguage();
  const c = d.courier;
  const manques = (d.missing ?? []).filter((m) => !MANQUES_INFORMATIFS.includes(m));
  const stripeActif = (d.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'active';

  const compteId = d.user?.id || user?.id || null;
  const [f, setF] = useState(() => {
    const garde = lireSaisie(compteId);
    for (const k of JAMAIS_GARDE) delete garde[k];
    return { ...infosDepuisDossier(c, d.zones), ...garde };
  });
  const val = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // Garder ce qui diffère du dossier du serveur (voir CLE_SAISIE).
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const serveur = infosDepuisDossier(c, d.zones);
      ecrireSaisie(compteId, Object.fromEntries(Object.entries(f).filter(([k, v]) => !JAMAIS_GARDE.includes(k) && v !== serveur[k])));
    }, 300);
    return () => clearTimeout(minuteur);
  }, [f, c, d.zones, compteId]);
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);
  const horsEee = f.nationalityGroup === 'THIRD';
  const docs = documentsRequis(d, { statusType: c.statusType, motorise, horsEee });
  // Hors EEE, les deux pièces juste après « Tes courses » ; la photo (et les pièces d'un véhicule motorisé) après le versement.
  const docsSejour = docs.filter((x) => ['residence_permit', 'professional_card'].includes(x));
  const ecrans = ['activite', 'courses', ...docsSejour.map((x) => `doc:${x}`), 'identite', 'registre', 'paiement',
    ...docs.filter((x) => !docsSejour.includes(x)).map((x) => `doc:${x}`), 'engagements'];
  const aFaire = (e) => manques.some((m) => ecranDuManque(m, c.statusType) === e);

  // Le premier écran qui manque encore quelque chose : là où mène « Compléter mon dossier ».
  const premierEcran = ecrans.find(aFaire) || (stripeActif ? 'engagements' : 'paiement');

  /* RENVOYER UN DOSSIER REFUSÉ. Le serveur envoie seul un brouillon complet (routes/couriers.js › avancerDossier), jamais un
   * dossier refusé : seul POST /couriers/me/submit le remet en vérification. Le dossier du site avait ce bouton ; l'app n'en
   * avait pas, et un livreur refusé qui avait tout corrigé voyait « ton dossier est complet » sans rien pouvoir faire. */
  const envoyable = !manques.some((m) => !MANQUES_APRES_ENVOI.includes(m));
  const refuse = c.lifecycleStatus === 'rejected';
  const envoyer = () => action(() => api('/couriers/me/submit', { method: 'POST', token }), t('courierOnboarding.toastSubmitted')).then((ok) => { if (ok) refreshUser?.(); });

  // Site sur un ordinateur : le sommaire à gauche, l'écran ouvert à droite (voir l'en-tête du fichier).
  const large = useSiteLarge(1100);
  // `ecran` vide : le sommaire du dossier (SommaireDossier, plus bas). Une étape demandée (retour de Stripe) s'ouvre directement.
  const [ecran, setEcran] = useState(() => ECRAN_DE_ETAPE[etapeDemandee] || null);
  // L'écran demandé arrive souvent APRÈS le dossier (Onboarding.jsx relit d'abord le dossier, puis traite le retour de
  // Stripe) : lu seulement à l'ouverture, il était perdu, et le retour de Stripe retombait sur le sommaire.
  useEffect(() => { if (ECRAN_DE_ETAPE[etapeDemandee]) setEcran(ECRAN_DE_ETAPE[etapeDemandee]); }, [etapeDemandee]);
  // Sur un ordinateur, un écran est toujours ouvert à droite : le premier à compléter, ou celui du renvoi d'un dossier refusé.
  const ouvert = ecran || (large ? (refuse && envoyable ? 'manques' : premierEcran) : null);
  const [recule, setRecule] = useState(false);
  const rang = Math.max(0, ecrans.indexOf(ouvert));
  // Changer d'écran sur un ordinateur : le haut du nouvel écran revient en vue s'il était remonté hors de la fenêtre.
  const panneau = useRef(null);
  useEffect(() => {
    if (!large || !panneau.current) return;
    if (panneau.current.getBoundingClientRect().top < 0) panneau.current.scrollIntoView({ behavior: defilement(), block: 'start' });
  }, [ouvert, large]);
  const aller = (e, arriere = false) => { setRecule(arriere); setEcran(e); };
  const suivant = () => aller(ecrans[Math.min(rang + 1, ecrans.length - 1)]);
  // La croix (et le retour depuis le premier écran) ramène au sommaire, plus au tableau de bord : on y voit ce qui reste.
  const fermer = () => aller(null, true);
  const retour = () => (rang > 0 ? aller(ecrans[rang - 1], true) : fermer());

  // Les écrans « Infos » enregistrent le formulaire entier, comme « Continuer » sur le site (silencieux : l'écran suivant suffit).
  async function enregistrerPuisSuivant() {
    const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body: corpsInfos(f, c) }));
    if (ok) { setF((x) => ({ ...x, nationalNumber: '' })); suivant(); }
  }

  const sommaire = (panneauOuvert = null) => (
    <SommaireDossier d={d} t={t} user={user} ecrans={ecrans} docs={docs} manques={manques} aFaire={aFaire} stripeActif={stripeActif}
      premierEcran={premierEcran} onOuvrir={(e) => aller(e)} ouvert={large ? ouvert : null} renvoi={refuse && envoyable ? envoyer : null} busy={busy}>
      {panneauOuvert}
    </SommaireDossier>
  );
  if (!ouvert) return sommaire();

  let titre = ''; let sous = null; let contenu = null; let pied = null;
  const continuer = (fn = suivant, libelle = t('appli.continuer')) => <button type="button" className="bv-btn btn-teal" disabled={busy} onClick={fn}>{busy ? t('common.loading') : libelle}</button>;
  const select = (id, k, options, vide = '-') => (
    <select id={id} value={f[k]} onChange={(e) => val(k, e.target.value)}>
      <option value="">{vide}</option>
      {options.map(([v, txt]) => <option key={v} value={v}>{txt}</option>)}
    </select>
  );

  if (ouvert === 'activite') {
    titre = t('appli.exActiviteTitre'); sous = t('appli.exActiviteSous');
    contenu = <EcranActivite d={d} f={f} val={val} t={t} token={token} busy={busy} action={action} select={select} />;
    pied = continuer(async () => {
      // Dénomination d'un indépendant en personne physique : son nom, si le registre ne l'a pas donnée.
      const corps = corpsInfos({ ...f, legalName: f.legalName || d.companyRegistry?.name || d.user?.name || '' }, c);
      const adresse = !d.user?.address && f.addressStreet ? { addressStreet: f.addressStreet, addressNumber: f.addressNumber, addressPostalCode: f.addressPostalCode, addressCity: f.addressCity } : {};
      /* SIÈGE D'UN INDÉPENDANT (manque « siege »). Le registre le donne quand il connaît le numéro ; l'adresse tapée ici aussi
       * (serveur : enregistrerAdresse). Restait le livreur qui a déjà une adresse (toutes les inscriptions du site jusqu'au
       * 2026-10-25) et un numéro sous la franchise, que le registre ne connaît pas : aucun écran ne demandait son siège et le
       * dossier restait incomplet. Comme le serveur le fait pour une adresse tapée, son adresse devient son siège. */
      const siege = c.statusType === 'independent' && !c.independent?.seatAddress && !f.seatAddress && !adresse.addressStreet
        && !(d.companyRegistry?.valid && d.companyRegistry?.address) && d.user?.address ? { seatAddress: d.user.address } : {};
      const ok = await action(() => api('/couriers/me', { method: 'PATCH', token, body: { ...corps, ...adresse, ...siege } }));
      if (ok) { setF((x) => ({ ...x, nationalNumber: '' })); suivant(); }
    });
  } else if (ouvert === 'courses') {
    titre = t('appli.exCoursesTitre'); sous = t('appli.exCoursesSous');
    contenu = <EcranCourses d={d} c={c} f={f} val={val} t={t} motorise={motorise} select={select} />;
    pied = continuer(enregistrerPuisSuivant);
  } else if (ouvert === 'identite') {
    titre = t('appli.exPieceTitre'); sous = t('appli.exPieceSous');
    contenu = <EcranIdentite d={d} t={t} token={token} busy={busy} action={action} onSuivant={suivant} />;
  } else if (ouvert === 'registre') {
    const id = c.identity ?? {};
    titre = id.status === 'verified' ? t('appli.exVerifieeTitre') : t('courierOnboarding.partPersonal'); sous = t('appli.exVerifieeSous');
    contenu = (
      <>
        {id.status === 'verified' ? (
          <Fait icone="valider" titre={`${id.firstName || ''} ${id.lastName || ''}`.trim()}
            sous={c.birthDate ? t('appli.exNele', { date: new Date(c.birthDate).toLocaleDateString(getLocale()), age: Math.floor((Date.now() - new Date(c.birthDate)) / (365.25 * 24 * 3600 * 1000)) }) : null} />
        ) : ['pending', 'processing'].includes(id.status) && id.provider === 'stripe_identity' ? (
          <Fait icone="horloge" titre={t('appli.exStripeVerifie')} sous={t('appli.exStripeVerifieS')} />
        ) : null}
        {/* Date de naissance : lue sur la pièce par Stripe ; à taper seulement sans elle (pièce déposée, contrôle en personne). */}
        {!c.birthDate && id.provider !== 'stripe_identity' && (
          <Champ id="dos-naissance" label={t('courierOnboarding.fBirthDate')}>
            <input id="dos-naissance" type="date" value={f.birthDate} onChange={(e) => val('birthDate', e.target.value)} />
          </Champ>
        )}
        <Champ id="dos-nrn" label={t('courierOnboarding.fNrn')} aide={c.hasNationalNumber ? t('courierOnboarding.nrnStored', { masked: c.nationalNumberMasked }) : t('appli.exNrnAide')}>
          <input id="dos-nrn" inputMode="numeric" value={f.nationalNumber} onChange={(e) => val('nationalNumber', e.target.value)} placeholder="99.05.05-123.45" />
        </Champ>
      </>
    );
    pied = continuer(enregistrerPuisSuivant);
  } else if (ouvert.startsWith('doc:')) {
    const type = ouvert.slice(4);
    titre = t(`courierOnboarding.doc_${type}`); sous = t(`courierOnboarding.doc_${type}_help`);
    contenu = <EcranDocument key={type} type={type} d={d} c={c} t={t} token={token} busy={busy} action={action} />;
    pied = continuer();
  } else if (ouvert === 'engagements') {
    titre = t('conformite.engagementsTitle');
    contenu = <EcranEngagements t={t} token={token} busy={busy} action={action} onSuivant={() => { charger(); refreshUser?.(); if (rang >= ecrans.length - 1) aller('manques'); else suivant(); }}
      contrat={{ aSigner: manques.includes('contrat'), nom: `${c.identity?.firstName || ''} ${c.identity?.lastName || ''}`.trim() || d.user?.name || '', onApercu: () => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed')) }} />;
  } else if (ouvert === 'paiement') {
    titre = t('courierOnboarding.paymentTitle'); sous = t('courierOnboarding.paymentHelp');
    contenu = <EcranPaiement t={t} token={token} busy={busy} actif={stripeActif} onSuivant={suivant} />;
  } else {
    // Après la dernière case, le serveur envoie (et valide si tout est vert) : il ne reste ici que ce qui manque encore.
    titre = t('courierOnboarding.submitTitle');
    contenu = <EcranManques d={d} t={t} manques={manques} statusType={c.statusType} onAller={(e) => aller(e, true)} renvoi={refuse ? envoyer : null} busy={busy} />;
  }

  // Sur un ordinateur : l'écran ouvert dans la page, à droite du sommaire. Ni croix ni retour : le sommaire est à côté.
  if (large) {
    return sommaire(
      <section className="bv-form ecl-dossier-ecran" key={ouvert} ref={panneau} aria-labelledby="dossier-ecran-titre">
        <h2 className="bv-titre bv-titre-form" id="dossier-ecran-titre">{titre}</h2>
        {sous && <p className="bv-sous">{sous}</p>}
        {contenu}
        {pied && <><div className="bv-grandit" />{pied}</>}
      </section>
    );
  }

  return (
    <EcranPlein etiquette={t('courierOnboarding.title')}>
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={ouvert}>
        {/* L'inscription compte comme un écran déjà fait (« Inscription ✓ » du sommaire). « Ce qui manque » (pas dans `ecrans`)
            est le dernier : la route y est pleine ; elle revenait au début (coupure 6 de maquettes/progression, 2026-10-30). */}
        <Haut onRetour={retour} progression={ouvert === 'manques' ? 1 : (rang + 2) / (ecrans.length + 1)} onFermer={fermer} />
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
 * actif ; envoi : dossier envoyé. Les écrans et leurs règles ne changent pas. Le BCE est un manque sous « Ton activité »,
 * mais il peut arriver APRÈS l'envoi (fondateur, 18/10/2026 : MANQUES_APRES_ENVOI) ; il reste exigé avant la validation par
 * l'équipe (audit du 19/10, courier-35 : ce commentaire disait « exigé à l'envoi »).
 *
 * Depuis le 2026-10-25 (dossier unique) : `children`, l'écran ouvert, posé à droite sur un ordinateur — l'étape ouverte
 * (`ouvert`) est alors marquée dans la liste et le bouton lime s'efface (le geste lime est celui de l'écran) ; `renvoi`, un
 * dossier refusé que plus rien ne retient : son bouton lime le renvoie à l'équipe ; « Avant de commencer » en bas, comme sur
 * le dossier envoyé (DossierSuivi). */
const ETAPES_SOMMAIRE = [
  ['activite', ['activite']],
  ['courses', ['courses']],
  ['identite', ['identite', 'registre']],
  ['paiement', ['paiement']],
  ['documents', null], // les écrans doc:… (photo, et hors EEE les deux pièces)
  ['engagements', ['engagements']]
];

function SommaireDossier({ d, t, user, ecrans, docs, manques, aFaire, stripeActif, premierEcran, onOuvrir, ouvert = null, renvoi = null, busy = false, children = null }) {
  const c = d.courier;
  const [avant, setAvant] = useState(false);
  // « Inscription » d'abord, toujours faite (fondateur, 2026-10-30, maquettes/progression) : c'est vrai, et une étape déjà
  // cochée donne envie de finir (Nunes & Drèze, 2006). « 1 sur 7 » au lieu de « 0 sur 6 ». Elle ne s'ouvre pas.
  const etapes = [{ cle: 'inscription', siens: [], fait: true, manquants: [] }, ...ETAPES_SOMMAIRE.map(([cle, liste]) => {
    const siens = (liste ?? docs.map((x) => `doc:${x}`)).filter((e) => ecrans.includes(e));
    const fait = cle === 'paiement' ? stripeActif : !siens.some(aFaire);
    return { cle, siens, fait, manquants: manques.filter((m) => siens.includes(ecranDuManque(m, c.statusType))) };
  }).filter((e) => e.siens.length)];
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
    if (e.cle === 'activite') return [c.statusType && t(`courierOnboarding.status_${c.statusType}`), c.independent?.companyNumber].filter(Boolean).join(' · ') || null;
    if (e.cle === 'courses') return [c.vehicleType && t(`courierOnboarding.vehicle_${c.vehicleType}`), c.zone].filter(Boolean).join(' · ') || null;
    if (e.cle === 'paiement') return t('courierOnboarding.paymentActive');
    if (e.cle === 'inscription') return d.user?.email || user?.email || null;
    return null;
  };
  const ligne = (e) => {
    const sous = detail(e);
    const actif = !!ouvert && e.siens.includes(ouvert);
    if (!e.siens.length) {
      return (
        <li key={e.cle}>
          <div className="ecl-etape">
            <span className="ecl-rond-etape fait" aria-hidden="true"><Icone nom="valider" taille={14} /></span>
            <span className="ecl-grow"><b>{t(`appli.dosEtape_${e.cle}`)}</b>{sous && <small>{sous}</small>}</span>
          </div>
        </li>
      );
    }
    return (
      <li key={e.cle}>
        <button type="button" className={`ecl-etape${actif ? ' on' : ''}`} aria-current={actif ? 'step' : undefined} onClick={() => onOuvrir(e.siens.find(aFaire) || e.siens[0])}>
          <span className={`ecl-rond-etape${e.fait ? ' fait' : ''}`} aria-hidden="true">{e.fait && <Icone nom="valider" taille={14} />}</span>
          <span className="ecl-grow"><b>{t(`appli.dosEtape_${e.cle}`)}</b>{sous && <small>{sous}</small>}</span>
          {!e.fait && <Icone nom="retour" taille={16} className="bv-chevron" />}
        </button>
      </li>
    );
  };
  // Un seul lime : renvoyer un dossier refusé quand plus rien ne le retient, sinon ouvrir le premier écran à compléter. Sur un
  // ordinateur (`children`), aucun dans la liste : l'écran ouvert à droite porte le sien.
  const boutonLime = children ? null : renvoi ? (
    <button type="button" className="btn-gold ecl-bouton-dossier" disabled={busy} onClick={renvoi}>{busy ? t('common.loading') : t('appli.dosRenvoyer')}</button>
  ) : restantes.length > 0 ? (
    <button type="button" className="btn-gold ecl-bouton-dossier" onClick={() => onOuvrir(premierEcran)}>{t('appli.dosCompleter')}</button>
  ) : null;

  const liste = (
    <>
      {c.lifecycleStatus === 'rejected' && c.reviewReason && (
        <p className="ecl-note"><Icone nom="alerte" taille={18} /><span>{t('courierOnboarding.rejectedReason', { reason: c.reviewReason })}{renvoi && !children && <> {t('appli.dosRenvoyerAide')}</>}</span></p>
      )}
      {restantes.length > 0 && (
        <>
          <h2 className="ecl-titre-sec">{t('appli.dosAFaire')}</h2>
          <ul className="ecl-etapes">{restantes.map(ligne)}</ul>
        </>
      )}
      {boutonLime}
      {faites.length > 0 && (
        <>
          <h2 className="ecl-titre-sec">{t('appli.dosFait')}</h2>
          <ul className="ecl-etapes">{faites.map(ligne)}</ul>
        </>
      )}
      {/* « Avant de commencer » (paiement, courses groupées, assurance) : le dossier du site l'avait en tête, replié. */}
      <ul className="ecl-etapes ecl-etapes-annexe">
        <li>
          <button type="button" className="ecl-etape" onClick={() => setAvant(true)}>
            <span className="ecl-grow"><b>{t('courierOnboarding.beforeTitle')}</b><small>{t('ecranLivreur.dosAvantSous')}</small></span>
            <Icone nom="retour" taille={16} className="bv-chevron" />
          </button>
        </li>
      </ul>
      {avant && (
        <SousEcran titre={t('courierOnboarding.beforeTitle')} onFermer={() => setAvant(false)}>
          <div className="ecl-dans-feuille"><AvantDeCommencer c={c} t={t} pricing={d.pricing} replie /></div>
        </SousEcran>
      )}
    </>
  );

  return (
    <div className={`ecl ecl-page ecl-dossier${children ? ' ecl-page-large ecl-dossier-large' : ''}`}>
      <section className="ecl-bandeau">
        <div className="ecl-b-haut"><span>{t('appli.dosLivreur')}{prenom && <> · <b>{prenom}</b></>}</span></div>
        <h1 className="ecl-b-titre">{t('appli.dosTitre')}</h1>
        <p className="ecl-b-sous">{sousBandeau}</p>
        <RouteVelo position={Math.round(6 + (88 * faites.length) / Math.max(1, total))} depart={6} />
      </section>
      <div className="ecl-feuille">
        {children ? (
          <div className="ecl-dossier-cols">
            <nav className="ecl-dossier-liste" aria-label={t('appli.dosTitre')}>{liste}</nav>
            {children}
          </div>
        ) : liste}
      </div>
    </div>
  );
}

/* « TON ACTIVITÉ » (version A) : le statut, le numéro d'entreprise — lu au registre TVA européen dès qu'il a ses dix chiffres
 * (PATCH /couriers/me : le serveur remplit dénomination, siège, adresse et zone avec ce que le registre dit) —, l'adresse quand
 * personne ne la donne, l'école d'un étudiant, la TVA, la nationalité (la pièce la confirmera) et la caisse. */
// « RUE DU BAILLI 42 1050 IXELLES » (registre, en capitales) → « Rue Du Bailli 42 1050 Ixelles », lisible sur la carte.
const adresseLisible = (a) => String(a || '').toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (x) => x.toUpperCase());
function EcranActivite({ d, f, val, t, token, busy, action, select }) {
  const c = d.courier;
  const registre = d.companyRegistry;
  const chiffres = String(f.companyNumber || '').replace(/\D/g, '');
  const dejaLu = registre && chiffres === String(c.independent?.companyNumber || '').replace(/\D/g, '');
  // Dix chiffres tapés, pas encore lus : on les envoie (le registre répond en une ou deux secondes).
  useEffect(() => {
    if (chiffres.length !== 10 || dejaLu) return undefined;
    const minuteur = setTimeout(() => { action(() => api('/couriers/me', { method: 'PATCH', token, body: { companyNumber: chiffres } })); }, 500);
    return () => clearTimeout(minuteur);
  }, [chiffres]); // eslint-disable-line react-hooks/exhaustive-deps
  // Le registre a trouvé le numéro : il est assujetti à la TVA (VIES ne connaît que les assujettis).
  useEffect(() => { if (dejaLu && registre?.valid && !f.vatStatus) val('vatStatus', 'assujetti'); }, [dejaLu, registre?.valid]); // eslint-disable-line react-hooks/exhaustive-deps
  const segments = (id, k, liste, libelle) => (
    <div className="bv-segments" role="radiogroup" aria-labelledby={id}>
      {liste.map((v) => <button key={v} type="button" role="radio" aria-checked={f[k] === v} className={f[k] === v ? 'on' : ''} onClick={() => val(k, v)}>{libelle(v)}</button>)}
    </div>
  );
  const connue = !f.socialInsuranceFund || CAISSES.includes(f.socialInsuranceFund);
  const legal = d.legal ?? {};
  const [comparer, setComparer] = useState(false);
  return (
    <>
      <div className="bv-segments" role="radiogroup" aria-label={t('auth.courierStatusTitle')}>
        {STATUTS.map((st) => (
          <button key={st} type="button" role="radio" aria-checked={c.statusType === st} className={c.statusType === st ? 'on' : ''} disabled={busy}
            onClick={() => st !== c.statusType && action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType: st } }))}>{t(`appli.exStatut_${st}`)}</button>
        ))}
      </div>
      {/* Le comparatif des deux statuts et le guide « devenir indépendant », que seul le dossier du site montrait. */}
      <button type="button" className="bv-ajout" style={{ marginTop: -4, marginBottom: 12 }} onClick={() => setComparer(true)}>{t('appli.exLequel')}</button>
      {comparer && (
        <SousEcran titre={t('courierOnboarding.chooseStatus')} onFermer={() => setComparer(false)}>
          <div className="ecl-dans-feuille"><ComparaisonStatuts legal={legal} t={t} actuel={c.statusType} /></div>
        </SousEcran>
      )}
      <Champ id="dos-bce" label={t('courierOnboarding.fBce')}>
        <input id="dos-bce" inputMode="numeric" value={f.companyNumber} onChange={(e) => val('companyNumber', e.target.value)} placeholder="0123.456.789" />
      </Champ>
      {dejaLu && registre.valid === true && <Fait icone="valider" titre={t('appli.exRegistreOk', { name: registre.name })} sous={t('appli.exRegistreOkS', { address: adresseLisible(registre.address) })} />}
      {dejaLu && registre.valid === false && <Fait icone="horloge" titre={t('appli.exRegistreNon')} sous={t('appli.exRegistreNonS')} />}
      {dejaLu && registre.valid == null && <Fait icone="horloge" titre={t('appli.exRegistreMuet')} sous={t('appli.exRegistreMuetS')} />}
      {!chiffres && <p className="bv-aide" style={{ marginTop: -4 }}>{t('appli.exSansNumero')}</p>}
      {/* L'adresse : seulement si ni le compte ni le registre ne l'ont (le serveur la reprend du registre quand il la trouve). */}
      {!d.user?.address && !(dejaLu && registre.valid) && (
        <>
          <span className="bv-etiquette">{t('appli.exAdresse')}</span>
          <div className="bv-rangee"><Champ id="dos-rue" label={t('appli.exRue')}><input id="dos-rue" value={f.addressStreet} onChange={(e) => val('addressStreet', e.target.value)} autoComplete="address-line1" /></Champ>
            <Champ id="dos-num" label={t('appli.exNumero')}><input id="dos-num" value={f.addressNumber} onChange={(e) => val('addressNumber', e.target.value)} /></Champ></div>
          <div className="bv-rangee"><Champ id="dos-cp" label={t('appli.exCp')}><input id="dos-cp" inputMode="numeric" maxLength={4} value={f.addressPostalCode} onChange={(e) => val('addressPostalCode', e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" /></Champ>
            <Champ id="dos-commune" label={t('appli.exCommune')}><input id="dos-commune" value={f.addressCity} onChange={(e) => val('addressCity', e.target.value)} autoComplete="address-level2" /></Champ></div>
        </>
      )}
      {c.statusType === 'student_independent' && (
        <div className="bv-rangee">
          <Champ id="dos-ecole" label={t('courierOnboarding.fSchool')}><input id="dos-ecole" value={f.schoolName} onChange={(e) => val('schoolName', e.target.value)} /></Champ>
          {/* Tiret posé tout seul : le pavé numérique de l'iPhone n'en a pas (audit du 19/10, CROSS-64). */}
          <Champ id="dos-annee" label={t('courierOnboarding.fAcademicYear')}><input id="dos-annee" inputMode="numeric" value={f.academicYear} onChange={(e) => val('academicYear', formaterAnneeAcademique(e.target.value))} placeholder="2026-2027" /></Champ>
        </div>
      )}
      {c.statusType === 'student_independent' && legal.studentParentsCeiling != null && (
        <p className="bv-aide" style={{ marginTop: -4 }}>{t('courierOnboarding.studentParentsInfo', { amount: euros(Number(legal.studentParentsCeiling)) })}</p>
      )}
      <span className="bv-etiquette" id="dos-tva">{t('appli.exRegimeTva')}</span>
      {segments('dos-tva', 'vatStatus', ['franchise', 'assujetti'], (v) => t(`appli.exTva_${v}`))}
      <span className="bv-etiquette" id="dos-nat">{t('appli.exNationalite')}</span>
      {segments('dos-nat', 'nationalityGroup', NATIONALITES, (v) => t(`appli.exNat_${v}`))}
      <p className="bv-aide" style={{ marginTop: -4 }}>{f.nationalityGroup === 'THIRD' ? t('conformite.fNationalityThirdHelp') : t('appli.exNationaliteAide')}</p>
      <Champ id="dos-caisse" label={t('courierOnboarding.fSocialInsuranceFund')} aide={t('courierOnboarding.fSocialInsuranceFundHelp')}>
        {select('dos-caisse', 'socialInsuranceFund', [...CAISSES.map((x) => [x, x]), ...(connue ? [] : [[f.socialInsuranceFund, f.socialInsuranceFund]])])}
      </Champ>
    </>
  );
}

/* LEQUEL CHOISIR ? Le comparatif des deux statuts du dossier du site (plafond, retenue, cotisations, TVA, démarches, âge), les
 * montants de l'année tirés de `legal` (configuration fiscale, jamais écrits ici), et le guide « devenir indépendant » avec les
 * sites officiels (GuideIndependant). Ici on lit seulement : le choix se fait sur les deux pastilles de « Ton activité ». */
const EUROS_OU_TIRET = (x) => (x == null || x === '' ? '—' : euros(Number(x)));
const POURCENT = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })} %`);
function ComparaisonStatuts({ legal, t, actuel }) {
  const age = legal.adultMinAge ?? '—';
  const lignes = {
    student_independent: [
      ['cmpCeiling', t('courierOnboarding.cmpStuCeiling', { ceiling: EUROS_OU_TIRET(legal.studentIndependentCeiling) })],
      ['cmpWithholding', t('courierOnboarding.cmpStuWithholding')],
      ['cmpSocial', t('courierOnboarding.cmpStuSocial', { exemption: EUROS_OU_TIRET(legal.studentIndependentExemption) })],
      ['cmpVat', t('courierOnboarding.cmpStuVat', { max: EUROS_OU_TIRET(legal.franchiseMaxTurnover) })],
      ['cmpSteps', t('courierOnboarding.cmpStuSteps')],
      ['cmpAgeLabel', t('courierOnboarding.cmpStuAge', { age })]
    ],
    independent: [
      ['cmpCeiling', t('courierOnboarding.cmpIndCeiling')],
      ['cmpWithholding', t('courierOnboarding.cmpIndWithholding')],
      ['cmpSocial', t('courierOnboarding.cmpIndSocial', { rate: POURCENT(legal.independentSocialRate), exemption: EUROS_OU_TIRET(legal.independentComplementaryExemption) })],
      ['cmpVat', t('courierOnboarding.cmpIndVat', { max: EUROS_OU_TIRET(legal.franchiseMaxTurnover) })],
      ['cmpSteps', t('courierOnboarding.cmpIndSteps')],
      ['cmpAgeLabel', t('courierOnboarding.cmpAge', { age })]
    ]
  };
  return (
    <>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('courierOnboarding.chooseStatusHelp')}</p>
      <div className="courier-compare">
        {STATUTS.map((st) => (
          <div key={st} className={`courier-compare-card${actuel === st ? ' active' : ''}`}>
            <div className="courier-compare-head"><Icone nom={st === 'student_independent' ? 'guide' : 'mallette'} taille={26} /><b>{t(`courierOnboarding.status_${st}`)}</b></div>
            <p className="small">{t(`courierOnboarding.status_${st}_desc`)}</p>
            <dl className="courier-compare-list">
              {lignes[st].map(([cle, txt]) => <div key={cle} style={{ display: 'contents' }}><dt>{t(`courierOnboarding.${cle}`)}</dt><dd>{txt}</dd></div>)}
            </dl>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}><GuideIndependant legal={legal} /></div>
    </>
  );
}

/* « TES COURSES » (version A) : le véhicule (permis et plaque s'il est motorisé), la zone (tirée de l'adresse, à changer ici), une
 * autre plateforme (une course à la fois, ou trois), le sac, et le minimum par course et par km — facultatif. */
function EcranCourses({ d, c, f, val, t, motorise, select }) {
  const sacModifiable = ['none', 'due'].includes(c.bag?.depositStatus || 'none');
  const segments = (id, k, liste) => (
    <div className="bv-segments" role="radiogroup" aria-labelledby={id}>
      {liste.map(([v, txt]) => <button key={v} type="button" role="radio" aria-checked={f[k] === v} disabled={k === 'bagOption' && !sacModifiable} className={f[k] === v ? 'on' : ''} onClick={() => val(k, v)}>{txt}</button>)}
    </div>
  );
  return (
    <>
      <div className="bv-grille" style={{ marginBottom: 14 }}>
        {(d.vehicles ?? VEHICULES).map((v) => <Option key={v} on={f.vehicleType === v} titre={t(`courierOnboarding.vehicle_${v}`)} onClick={() => val('vehicleType', v)} />)}
      </div>
      {motorise && (
        <div className="bv-rangee bv-rangee-moitie">
          <Champ id="dos-permis" label={t('courierOnboarding.fLicence')}><input id="dos-permis" value={f.licenceNumber} onChange={(e) => val('licenceNumber', e.target.value)} /></Champ>
          <Champ id="dos-plaque" label={t('courierOnboarding.fPlate')}><input id="dos-plaque" value={f.licencePlate} onChange={(e) => val('licencePlate', e.target.value)} placeholder="1-ABC-123" /></Champ>
        </div>
      )}
      {/* En voiture, les deux poids de la carte grise : au-delà, licence de transport (maquettes/livreur-voiture/livreur-voiture.html). */}
      {f.vehicleType === 'voiture' && <p className="bv-aide" style={{ marginTop: -4, marginBottom: 14 }}>{t('courierOnboarding.carWeightHelp')}</p>}
      <Champ id="dos-zone" label={t('courierOnboarding.fZone')}>{select('dos-zone', 'zone', (d.zones ?? []).map((z) => [z, z]))}</Champ>
      <span className="bv-etiquette" id="dos-plateformes">{t('auth.platformsTitle')}</span>
      {segments('dos-plateformes', 'worksOtherPlatforms', [['no', t('auth.platformsNo')], ['yes', t('auth.platformsYes')]])}
      <span className="bv-etiquette" id="dos-sac">{t('courierOnboarding.fBag')}</span>
      {segments('dos-sac', 'bagOption', [['own', t('auth.bag_own')], ['fairide', t('auth.bag_fairide')]])}
      <p className="bv-aide" style={{ marginTop: -4 }}>{sacModifiable ? t('courierOnboarding.fBagHelp', { amount: c.bag?.depositAmount || 40 }) : t(`courierOnboarding.bagDeposit_${c.bag.depositStatus}`, { amount: c.bag?.depositAmount || 40 })}</p>
      <span className="bv-etiquette" style={{ marginTop: 14 }}>{t('appli.exMinimum')}</span>
      <div className="bv-rangee bv-rangee-moitie">
        <Champ id="dos-min" label={t('appli.exMinCourse')}><input id="dos-min" type="number" min="0" max="100" step="0.10" inputMode="decimal" value={f.minFee} onChange={(e) => val('minFee', e.target.value)} /></Champ>
        <Champ id="dos-min-km" label={t('appli.exMinKm')}><input id="dos-min-km" type="number" min="0" max="10" step="0.05" inputMode="decimal" value={f.minFeePerKm} onChange={(e) => val('minFeePerKm', e.target.value)} /></Champ>
      </div>
    </>
  );
}

// L'identité : trois façons (Stripe Identity, une photo de la pièce, en personne) ; une fois lancée, ce qui en est.
export function EcranIdentite({ d, t, token, busy, action, onSuivant }) {
  const toast = useToast();
  const id = d.courier.identity ?? {}; const prov = d.identityProviders ?? {};
  const fichier = useRef(null);
  const [choix, setChoix] = useState(prov.stripe_identity ? 'stripe_identity' : 'manual');
  // Version A : Stripe d'abord, présenté seul ; les autres façons (contrôle en personne) seulement sur demande.
  const [autresFacons, setAutresFacons] = useState(!prov.stripe_identity);
  // Le consentement biométrique (texte et version courante), coché sur l'écran même (version B, 2026-10-22).
  const [consentement, setConsentement] = useState(null);
  const [accord, setAccord] = useState(false);
  const [texteOuvert, setTexteOuvert] = useState(false);
  useEffect(() => {
    if (!prov.stripe_identity || d.biometricConsent) return;
    api('/couriers/me/consents', { token }).then((liste) => setConsentement((Array.isArray(liste) ? liste : []).find((x) => x.kind === 'biometric_identity') || null)).catch(() => {});
  }, [prov.stripe_identity, d.biometricConsent, token]);
  const [autreMoyen, setAutreMoyen] = useState(false);
  // Une pièce refusée par l'équipe ne compte pas : le livreur lit le motif et en dépose une autre.
  const pieces = (d.documents ?? []).filter((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && !x.rejectedReason);
  const refusee = pieces.length === 0 ? (d.documents ?? []).find((x) => ['identity_card', 'driving_licence', 'residence_permit'].includes(x.docType) && x.rejectedReason) : null;
  async function stripe() {
    await action(async () => {
      try {
        // Même écran d'attente que Connect (ouvrirStripe.js) : la session Identity prend elle aussi quelques secondes.
        const r = await ouvrirStripe(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'stripe_identity' } }), { retour: '/driver/onboarding' });
        if (r?.url) return null;
      } catch (e) {
        // Consentement retiré ou nouvelle version du texte entre-temps : la case réapparaît, avec le texte reçu.
        if (e.code === 'CONSENTEMENT_BIOMETRIQUE_REQUIS') { if (e.data?.consent) setConsentement(e.data.consent); setAccord(false); return null; }
        // Déjà vérifiée entre-temps (webhook) : rien à relancer, le dossier relu le montre (audit du 19/10, courier-3).
        if (e.code === 'IDENTITE_DEJA_VERIFIEE') return null;
        throw e;
      }
      return null;
    });
  }
  async function manuel() {
    if (id.provider !== 'manual') await action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'manual' } }));
    fichier.current?.click();
  }
  // Un envoi raté garde son message d'erreur (action) : « Document déposé. » s'affichait par-dessus, et le livreur attendait
  // une vérification qui ne viendrait pas (audit du 19/10, LIVE-04). L'écran reste là, le bouton permet de réessayer.
  async function deposer(e) {
    const files = [...(e.target.files || [])].slice(0, 4); e.target.value = ''; if (!files.length) return;
    for (const f of files) { const ok = await action(() => apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType: 'identity_card' } }), null); if (!ok) return; }
    setAutreMoyen(false);
    toast(files.length > 1 ? t('courierOnboarding.toastDocsUploaded', { n: files.length }) : t('courierOnboarding.toastDocUploaded'));
  }
  // Consentement biométrique donné : il se retire depuis cet écran (audit du 19/10, courier-9).
  const retrait = d.biometricConsent && (
    <p className="bv-aide" style={{ marginTop: 12 }}>
      <RetraitConsentementBiometrique busy={busy} onRetirer={() => action(() => api('/couriers/me/consents/biometric_identity/withdraw', { method: 'POST', token }), t('conformite.biometricWithdrawn'))} />
    </p>
  );
  const entree = <input ref={fichier} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={deposer} />;
  // Refusée par l'équipe : on revient aux façons de la vérifier, motif en tête, même si une pièce est encore déposée (admin-43).
  const lance = id.status === 'verified' || id.status === 'processing' || (id.provider === 'in_person' && id.status === 'pending') || (pieces.length > 0 && !autreMoyen && !id.rejectedReason);

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
        {retrait}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-teal" onClick={onSuivant}>{t('appli.continuer')}</button>
      </>
    );
  }
  /* LA PIÈCE ET LE SELFIE CHEZ STRIPE (version B, 2026-10-22 : sans selfie, une carte trouvée ou prêtée suffisait à s'inscrire).
   * Ce que Fairide en reçoit, le selfie comparé par Stripe, et le consentement biométrique en une case sur l'écran même (RGPD
   * art. 9 : explicite, et le texte entier à un toucher) — plus de fenêtre à part. Qui refuse : « Je préfère sans selfie »,
   * photo de la pièce et un selfie que l'équipe regarde (plus jamais de rendez-vous). */
  if (!autresFacons && !id.rejectedReason) {
    const dejaConsenti = !!d.biometricConsent;
    return (
      <>
        <Fait icone="document" titre={t('appli.exRecoit')} sous={t('appli.exRecoitS')} />
        <Fait icone="bouclier" titre={t('appli.exSelfie')} sous={t('appli.exSelfieS')} />
        {!dejaConsenti && consentement && (
          <label className="bv-case-ligne">
            <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
            <span>{t('appli.exConsent')} <button type="button" className="lien-bouton" onClick={(e) => { e.preventDefault(); setTexteOuvert(true); }}>{t('appli.exConsentLire')}</button></span>
          </label>
        )}
        {texteOuvert && consentement && (
          <SousEcran titre={consentement.title} onFermer={() => setTexteOuvert(false)}>
            {/* Texte rendu tel quel : c'est sa version exacte (et son empreinte) qui est enregistrée. */}
            <div className="bv-texte-legal">{consentement.text}</div>
          </SousEcran>
        )}
        {id.status === 'failed' && <p className="field-error" role="alert">{t('courierOnboarding.identityFailed')}{ERREURS_IDENTITE.includes(id.error) && <> {t(`courierOnboarding.identityError_${id.error}`)}</>}</p>}
        {retrait}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={busy || (!dejaConsenti && !accord)} onClick={async () => {
          // La case cochée enregistre le consentement dans sa version affichée, puis Stripe s'ouvre.
          if (!dejaConsenti) {
            const ok = await action(() => api('/couriers/me/consents', { method: 'POST', token, body: { kind: 'biometric_identity', version: consentement.version, accepted: true } }));
            if (!ok) return;
          }
          stripe();
        }}>{busy ? t('common.loading') : id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('appli.exVerifier')}</button>
        <button type="button" className="bv-lien" onClick={() => { setAutresFacons(true); setChoix('manual'); }}>{t('appli.exSansBiometrie')}</button>
      </>
    );
  }
  // Stripe choisi ici : retour à l'écran de la pièce, où se coche le consentement (jamais Stripe sans la case).
  const actions = { stripe_identity: [() => { setAutresFacons(false); setChoix('stripe_identity'); }, id.status === 'pending' && id.provider === 'stripe_identity' ? t('courierOnboarding.identityResume') : t('courierOnboarding.identityStart')], manual: [manuel, t('courierOnboarding.manualUpload')], in_person: [() => action(() => api('/couriers/me/identity/start', { method: 'POST', token, body: { provider: 'in_person' } }), t('courierOnboarding.inPersonRequested')), t('courierOnboarding.inPersonRequest')] };
  return (
    <>
      {[['stripe_identity', 'document', 'stripeIdentityHelp'], ['manual', 'apercu', 'manualHelp'], ['in_person', 'personnes', 'inPersonHelp']]
        // Les façons ouvertes par le serveur : Stripe, et sans biométrie la pièce + un selfie regardés par l'équipe. Plus de
        // contrôle en personne depuis le 2026-10-22 (le serveur ne le propose plus : in_person false).
        .filter(([p]) => prov[p])
        .map(([p, icone, aide]) => <Option key={p} on={choix === p} icone={icone} titre={t(`courierOnboarding.provider_${p}`)} sous={t(`courierOnboarding.${aide}`)} onClick={() => setChoix(p)} />)}
      {refusee && <p className="field-error" role="alert">{t('courierOnboarding.identityRejected', { reason: refusee.rejectedReason })}</p>}
      {/* Identité refusée par l'équipe : son motif plutôt que l'échec générique (audit du 19/10, admin-43). */}
      {id.status === 'failed' && (id.rejectedReason
        ? <p className="field-error" role="alert">{t('courierOnboarding.identityRejectedByTeam', { reason: id.rejectedReason })}</p>
        : <p className="field-error" role="alert">{t('courierOnboarding.identityFailed')}{ERREURS_IDENTITE.includes(id.error) && <> {t(`courierOnboarding.identityError_${id.error}`)}</>}</p>)}
      {entree}
      {retrait}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" disabled={busy} onClick={actions[choix][0]}>{busy ? t('common.loading') : actions[choix][1]}</button>
      <button type="button" className="bv-lien" onClick={onSuivant}>{t('appli.pasMaintenant')}</button>
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
    // Les versions AFFICHÉES (audit du 19/10, courier-27) : un texte changé entre-temps est refusé (409) et la liste rechargée.
    const versions = Object.fromEntries(liste.filter((x) => AVANT_COURSE.includes(x.kind)).map((x) => [x.kind, x.version]));
    const ok = await action(() => api('/couriers/me/engagements', { method: 'POST', token, body: { accepted: true, typedName: nom.trim(), versions } }), t('conformite.engagementsAcceptedToast'));
    if (ok) { await charger(); onSuivant(); } else { setCoche(false); charger(); }
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
export function EcranPaiement({ t, token, busy, actif, onSuivant }) {
  const [ouverture, setOuverture] = useState(false);
  const [erreur, setErreur] = useState('');
  async function connecter() {
    setOuverture(true); setErreur('');
    try { await ouvrirStripe(() => api('/auth/me/connect/onboard', { method: 'POST', token, body: { retour: 'onboarding' } }), { retour: '/driver/onboarding' }); }
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

// Ce qui manque encore, après la dernière case : chaque ligne ramène à son écran. Pas de bouton d'envoi : le serveur envoie
// le dossier dès qu'il est complet (hors numéro d'entreprise, qui peut arriver après, MANQUES_APRES_ENVOI).
// `renvoi` : un dossier refusé n'est pas renvoyé par le serveur (avancerDossier ne touche qu'aux brouillons), il faut ce bouton.
function EcranManques({ d, t, manques: tousManques, statusType, onAller, renvoi = null, busy = false }) {
  const infos = (d.missing ?? []).filter((m) => MANQUES_INFORMATIFS.includes(m));
  const manques = tousManques.filter((m) => !MANQUES_APRES_ENVOI.includes(m));
  if (!manques.length) {
    return (
      <>
        <p className="bv-sous">{renvoi ? t('appli.dosRenvoyerAide') : t('courierOnboarding.submitReady')}</p>
        {renvoi && <><div className="bv-grandit" /><button type="button" className="bv-btn btn-gold" disabled={busy} onClick={renvoi}>{busy ? t('common.loading') : t('appli.dosRenvoyer')}</button></>}
      </>
    );
  }
  // Quatre lignes au plus ; le bouton mène au premier manque.
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

/* LA FIN DE L'INSCRIPTION EXPRESS (version A de maquettes/inscription-livreur/inscription-livreur.html) : Onboarding.jsx la montre au
 * moment où le serveur envoie le dossier (routes/couriers.js › avancerDossier). Tout vert : « Tu peux rouler », validé sans
 * attendre personne. Sinon : « Presque prêt », et seulement ce que l'équipe regarde (d.teamChecks) ou ce qui manque encore.
 * Chaque ligne dit d'où vient son vert. Le compte de versement pas encore actif est un geste du LIVREUR (2026-10-25) : le
 * serveur envoie le dossier sans lui (« Pas maintenant »), mais ne le valide pas sans lui, et personne ne le relance. La puce
 * disait « Stripe vérifie encore ton compte », même quand Stripe n'avait jamais été ouvert ; DossierSuivi montre le bouton.
 * COMME « MERCI POUR TA COMMANDE ! » (fondateur, 2026-10-27) : un ‹ en haut à gauche pour en sortir (vers le suivi du dossier,
 * le Retour d'Android le touche), plus de vélo dans le bandeau, et le bouton lime tenu au-dessus des onglets (ecran-livreur.css). */
export function FinExpress({ d, t, onCourses, onDossier }) {
  const c = d.courier; const id = c.identity ?? {};
  const valide = c.lifecycleStatus === 'approved';
  const equipe = d.teamChecks ?? [];
  const stripeActif = d.user?.stripeConnectStatus === 'active';
  const age = c.birthDate ? Math.floor((Date.now() - new Date(c.birthDate)) / (365.25 * 24 * 3600 * 1000)) : null;
  const sansNumero = (d.missing ?? []).includes('bce');
  const prenom = id.firstName || (d.user?.name || '').trim().split(/\s+/)[0];
  const lignes = [
    ['bce', t('appli.exLigneBce'), equipe.includes('bce') ? 'equipe' : sansNumero ? 'attente' : 'fait',
      equipe.includes('bce') ? t('appli.exLigneBceEquipe') : sansNumero ? t('appli.exSansNumero') : t('appli.exLigneBceOk', { name: `${id.firstName || ''} ${id.lastName || ''}`.trim() })],
    ['piece', t('appli.exLignePiece'), equipe.includes('identite') ? 'equipe' : 'fait', equipe.includes('identite') ? t('appli.exLignePieceEquipe') : id.provider === 'stripe_identity' ? t('appli.exLignePieceStripe') : t('appli.exLignePieceManuel')],
    ['age', t('appli.exLigneAge'), 'fait', age != null ? t('appli.exAns', { age }) : null],
    ['droit', t('appli.exLigneDroit'), equipe.includes('titre_sejour') || equipe.includes('nationalite') ? 'equipe' : 'fait',
      equipe.includes('titre_sejour') ? t('appli.exLigneDroitSejour') : equipe.includes('nationalite') ? t('appli.exLigneDroitNat') : t('appli.exLigneDroitEee')],
    ['versement', t('appli.exLigneVersement'), stripeActif ? 'fait' : 'attente', stripeActif ? t('appli.exLigneVersementOk') : t('appli.exLigneVersementAFaire')],
    ['engagements', t('appli.exLigneEngagements'), 'fait', t('appli.exLigneEngagementsOk')]
  ];
  return (
    <div className="ecl ecl-page ecl-dossier ecl-fin">
      <section className="ecl-bandeau">
        <div className="ecl-b-haut">
          <button type="button" className="gn-rond" data-retour-natif onClick={onDossier} aria-label={t('appli.retour')} title={t('appli.retour')}><Icone nom="retour" taille={18} /></button>
          <span>{t('appli.dosLivreur')}{prenom && <> · <b>{prenom}</b></>}</span></div>
        <span className={`ecl-puce-fin${valide ? ' vert' : ''}`}>
          <Icone nom={valide ? 'valider' : 'horloge'} taille={14} />
          {valide ? t('appli.exPuceAuto') : equipe.length ? t('appli.exPuceEquipe', { quoi: equipe.map((k) => t(`appli.exQuoi_${k}`)).join(', ') }) : t('appli.exPuceVersement')}
        </span>
        <h1 className="ecl-b-titre">{valide ? t('appli.exFinVert') : t('appli.exFinPresque')}</h1>
        <p className="ecl-b-sous">{valide ? t('appli.exFinVertS') : !equipe.length && !stripeActif ? t('appli.exFinVersementS') : t('appli.exFinPresqueS')}</p>
      </section>
      <div className="ecl-feuille">
        <ul className="ecl-etapes">
          {lignes.map(([k, titre, etat, sous]) => (
            <li key={k}>
              <div className="ecl-etape">
                <span className={`ecl-rond-etape${etat === 'fait' ? ' fait' : ''}`} aria-hidden="true">{etat === 'fait' ? <Icone nom="valider" taille={14} /> : <Icone nom="horloge" taille={12} />}</span>
                <span className="ecl-grow"><b>{titre}</b>{sous && <small>{sous}</small>}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="ecl-fin-actions">
          <button type="button" className="btn-gold ecl-bouton-dossier" onClick={valide ? onCourses : onDossier}>{valide ? t('appli.exVoirCourses') : t('appli.exVoirDossier')}</button>
        </div>
      </div>
    </div>
  );
}
