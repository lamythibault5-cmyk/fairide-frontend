import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LienCgv, { LienConfidentialite } from '../../components/CgvEnFeuille';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api';
import Icone from '../../components/Icone';
import PhoneInput from '../../components/PhoneInput';
import PasswordInput from '../../components/PasswordInput';
import EmailDomainChips from '../../components/EmailDomainChips';
import AddressSearch from '../../components/AddressSearch';
import EngagementsInscription from '../../components/commerce/EngagementsInscription';
import { RESTAURANT_TYPES, restaurantTypeLabel, COMMUNES } from '../../menuCategories';
import { DAY_ORDER, dayLabel } from '../../openingHours';
import { bceValide, raisonBce, codePostalValide } from '../../validation';
import { lireBienvenue, lireCodeEnAttente, ecrireCodeEnAttente } from '../../bienvenue';
import { attendrePage } from '../../routePrefetch';
import { suivre } from '../../analytics';
import { setConsent } from '../../consent';
import { Haut, Option, Fait } from './EcransBienvenue';

/* L'INSCRIPTION DANS L'ACCUEIL DE L'APPLICATION (fondateur, 2026-10-15).
 *
 * « Continuer avec mon e-mail » (ou Apple / Google pour un compte qui n'existe pas encore) menait à /login : la page
 * du site, dans <Layout> — en-tête, « Contact », « Aide », une carte de formulaire où l'étape « Ton commerce en
 * détail » d'un restaurateur tenait une dizaine de champs. L'accueil venait de donner l'impression d'une application ;
 * l'inscription redevenait un site. Elle se fait donc ici, avec les écrans de l'accueil (même en-tête, même barre de
 * progression, même animation) : une question par écran, sans défiler, jusqu'au compte ouvert — code compris.
 *
 * MÊMES DONNÉES, MÊMES ROUTES que la page du site (Auth.jsx) : POST /auth/register, ou /auth/google et /auth/apple
 * avec le jeton gardé, puis /auth/verify-email. Les règles de chaque champ sont celles d'Auth.jsx, qui reproduisent
 * celles du serveur (routes/auth.js) — changer une règle, c'est la changer aux trois endroits. Ce qui diffère :
 *   - les horaires se donnent en une fois (jours + heures, un 2e service possible) au lieu de sept lignes ; un jour
 *     différent des autres se règle ensuite dans Mon commerce › Horaires ;
 *   - ce qui est facultatif n'est pas demandé : autres cuisines, autres responsables, second numéro ou e-mail du
 *     commerce, numéro masqué au public — tout se règle dans Mon commerce ;
 *   - pas de recherche automatique des horaires sur le web, donc pas de case « j'ai vérifié le préremplissage » ;
 *   - pas de brouillon gardé 48 h : l'application reste ouverte pendant l'inscription, et l'accueil lui-même n'en
 *     garde pas non plus. */

const ETAPES = {
  client: ['email', 'nom', 'tel', 'adresse', 'fin'],
  // 'etudes' n'existe que pour l'étudiant-indépendant (voir etapes plus bas).
  driver: ['email', 'nom', 'tel', 'statut', 'etudes', 'bce', 'vehicule', 'adresse', 'fin'],
  restaurant: ['email', 'nom', 'tel', 'commerce', 'type', 'entreprise', 'horaires', 'services', 'adresse', 'fin']
};
// Erreur renvoyée par le serveur sur un champ → l'écran qui le porte.
const ETAPE_DU_CHAMP = {
  email: 'email', password: 'email', firstName: 'nom', lastName: 'nom', phone: 'tel', courierStatus: 'statut', vehicleType: 'vehicule',
  schoolName: 'etudes', academicYear: 'etudes', addressStreet: 'adresse', addressNumber: 'adresse', addressPostalCode: 'adresse', addressCity: 'adresse',
  legalName: 'entreprise', vatNumber: 'entreprise', responsibleName: 'entreprise', cuisine: 'type'
};
const STATUTS = [['independent', 'document'], ['student_independent', 'guide']];
const MDP_FORME = (v) => v.length >= 6 && /[A-Z]/.test(v) && /[a-z]/.test(v);
const sansAccents = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function decoderJwt(jeton) {
  try { const b = jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch { return {}; }
}

// Un champ de l'accueil : libellé, saisie, puis l'erreur à la place de l'aide.
// `labelMasque` : le titre de l'écran sert déjà de libellé à l'œil, celui-ci est pour les lecteurs d'écran.
export function Champ({ id, label, labelMasque, erreur, aide, children }) {
  return (
    <div className="bv-champ">
      {label && <label htmlFor={id} className={labelMasque ? 'sr-only' : undefined}>{label}</label>}
      {children}
      {erreur ? <p className="field-error" role="alert">{erreur}</p> : aide ? <p className="bv-aide">{aide}</p> : null}
    </div>
  );
}

// Choix en pastilles (mode de livraison, paiement de l'à emporter).
function Segments({ label, valeur, options, onChoix }) {
  return (
    <div className="bv-segments" role="radiogroup" aria-label={label}>
      {options.map(([v, texte]) => (
        <button key={v} type="button" role="radio" aria-checked={valeur === v} className={valeur === v ? 'on' : ''} onClick={() => onChoix(v)}>{texte}</button>
      ))}
    </div>
  );
}

export default function InscriptionAppli({ role, fed, depuis, onQuitter, onConnexion }) {
  const { t } = useLanguage();
  const { register, verifyEmail, resendCode, loginWithGoogle, loginWithApple } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fond = useRef(null);

  // Apple / Google : le jeton porte l'e-mail, et souvent le nom (Apple le donne à côté, à la première autorisation).
  const profilFed = useMemo(() => (fed?.jeton ? decoderJwt(fed.jeton) : {}), [fed]);
  const [email, setEmail] = useState(profilFed.email || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(profilFed.given_name || fed?.prenom || '');
  const [lastName, setLastName] = useState(profilFed.family_name || fed?.nom || '');
  // Fixé au premier rendu : l'écran du nom ne doit pas disparaître de la liste pendant qu'on le remplit.
  const [nomConnu] = useState(() => !!(fed && (profilFed.given_name || fed.prenom) && (profilFed.family_name || fed.nom)));
  const [phone, setPhone] = useState('');
  // Client : le code postal tapé dans l'accueil (« Ton code postal ») préremplit l'adresse, comme sur le site.
  const [bienvenue] = useState(lireBienvenue);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState(role === 'client' ? bienvenue.codePostal || '' : '');
  const [addressCity, setAddressCity] = useState(role === 'client' ? bienvenue.commune || '' : '');
  // Livreur
  const [courierStatus, setCourierStatus] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [courierOptions, setCourierOptions] = useState(null);
  // Commerce
  const [nomCommerce, setNomCommerce] = useState('');
  const [restoPhone, setRestoPhone] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [customCuisine, setCustomCuisine] = useState('');
  const [rechercheType, setRechercheType] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [responsable, setResponsable] = useState(null); // null : la personne qui s'inscrit
  const [jours, setJours] = useState([]);
  const [creneaux, setCreneaux] = useState([{ open: '11:00', close: '22:00' }]);
  const [services, setServices] = useState({ delivery: true, deliveryMode: 'fairide', pickup: true, pickupPaymentMode: 'on_site' });
  // Dernier écran
  const [accepteCgu, setAccepteCgu] = useState(false);
  const [accepteEngagements, setAccepteEngagements] = useState(false);
  const [refusNouvelles, setRefusNouvelles] = useState(false);
  // Client : les nouvelles de Fairide demandent un OUI (case non cochée). Un compte gratuit sans commande n'est pas un
  // « client » au sens de l'AR du 4 avril 2003 : l'opt-out ne vaut pas pour lui (SPF Économie ; CJUE Planet49). Commerces et
  // livreurs gardent la case de refus ci-dessus. Serveur : routes/auth.js, enregistrerChoixNouvelles.
  const [nouvellesOui, setNouvellesOui] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralOuvert, setReferralOuvert] = useState(false);
  const [versionCgu, setVersionCgu] = useState('');
  const [siteWeb, setSiteWeb] = useState(''); // pot de miel, comme sur le site
  /* Rapports de panne (Sentry) : dans l'app ils sont ACTIFS SAUF REFUS (fondateur, 2026-10-16 ; rapportsPanneActifs,
   * consent.js). La case est donc cochée d'avance et se décoche : ce n'est pas un consentement (une case pré-cochée n'en
   * serait pas un, CJUE Planet49) mais la possibilité de refuser. Dans une carte à part, jamais collée à la case « Ne pas
   * m'envoyer les nouvelles », qui se coche dans l'autre sens. Se coupe aussi dans Mon compte. */
  const [rapports, setRapports] = useState(true);

  const [index, setIndex] = useState(0);
  const [recule, setRecule] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [attente, setAttente] = useState(false);
  // Après l'inscription par e-mail : { email, canal: 'email' | 'sms', telephone } → écran du code. Repris si l'application
  // a été fermée pendant qu'on allait lire l'e-mail (bienvenue.js, lireCodeEnAttente) : on rouvre sur le code, pas sur un
  // formulaire vide.
  const [repriseCode] = useState(() => {
    const c = fed ? null : lireCodeEnAttente();
    return c && c.role === role ? c : null;
  });
  const [enAttente, setEnAttente] = useState(() => (repriseCode ? { email: repriseCode.email, canal: repriseCode.canal, telephone: repriseCode.telephone } : null));
  const retourApres = depuis || repriseCode?.depuis || null;
  useEffect(() => {
    if (enAttente) ecrireCodeEnAttente({ ...enAttente, role, depuis: retourApres });
    else if (lireCodeEnAttente()?.role === role) ecrireCodeEnAttente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enAttente]);
  const [code, setCode] = useState('');

  const etapes = useMemo(() => ETAPES[role].filter((e) => !(e === 'email' && fed) && !(e === 'nom' && nomConnu)
    && !(e === 'etudes' && courierStatus !== 'student_independent')), [role, fed, nomConnu, courierStatus]);
  const etape = enAttente ? 'code' : etapes[Math.min(index, etapes.length - 1)];
  const derniere = index >= etapes.length - 1;
  const progression = enAttente ? 1 : (index + 1) / (etapes.length + 1);
  const nomResponsable = responsable ?? `${firstName} ${lastName}`.trim();
  const cuisineFinale = cuisine === 'Autre' ? (customCuisine.trim() || 'Autre') : cuisine;

  useEffect(() => {
    if (role === 'client') api('/auth/terms/current').then((r) => setVersionCgu(r.version)).catch(() => {});
    if (role === 'driver') api('/couriers/options').then(setCourierOptions).catch(() => {});
  }, [role]);
  // Numéro d'entreprise du commerce : la BCE donne la raison sociale et la TVA (même appel qu'Auth.jsx).
  useEffect(() => {
    const chiffres = companyNumber.replace(/\D/g, '');
    if (role !== 'restaurant' || chiffres.length !== 10) return undefined;
    let annule = false;
    const minuteur = setTimeout(() => {
      api(`/restaurants/lookup/company?number=${chiffres}`).then((r) => {
        if (annule) return;
        if (r.vatNumber) setVatNumber(r.vatNumber);
        if (r.valid && r.legalName) setLegalName((v) => v || r.legalName);
      }).catch(() => {});
    }, 600);
    return () => { annule = true; clearTimeout(minuteur); };
  }, [companyNumber, role]);
  // Chaque écran s'ouvre en haut (c'est le fond plein écran qui défile, pas la fenêtre).
  useEffect(() => { fond.current?.scrollTo?.(0, 0); }, [etape]);

  function messageBce() {
    const why = raisonBce(companyNumber);
    return why?.raison === 'longueur' ? t('auth.errCompanyNumberLength', { n: why.chiffres }) : why?.raison === 'prefixe' ? t('auth.errCompanyNumberPrefix') : t('auth.errCompanyNumberKey');
  }

  // Ce que l'écran affiché exige, champ par champ (règles d'Auth.jsx, validateStep).
  function erreursDe(cle) {
    const requis = t('auth.errFieldRequired');
    const e = {};
    if (cle === 'email') {
      if (!email.trim()) e.email = requis;
      // Même forme que le serveur (routes/auth.js, EMAIL_RE) : au moins deux lettres après le dernier point.
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = t('auth.errEmailInvalid');
      if (!password) e.password = requis;
      else if (!MDP_FORME(password)) e.password = t('auth.errPasswordStrength');
    }
    if (cle === 'nom') {
      if (!firstName.trim()) e.firstName = requis;
      if (!lastName.trim()) e.lastName = requis;
    }
    if (cle === 'tel' && !phone.trim()) e.phone = requis;
    if (cle === 'commerce') {
      if (!nomCommerce.trim()) e.nomCommerce = requis;
      if (!restoPhone.trim()) e.restoPhone = requis;
      else if (restoPhone.replace(/\D/g, '').length < 8) e.restoPhone = t('auth.errPhoneInvalid');
    }
    if (cle === 'type' && !cuisine) e.cuisine = t('auth.errCuisine');
    if (cle === 'entreprise') {
      if (!companyNumber.trim()) e.companyNumber = requis;
      else if (!bceValide(companyNumber)) e.companyNumber = messageBce();
      if (!legalName.trim()) e.legalName = requis;
      if (!nomResponsable) e.responsibleName = requis;
    }
    if (cle === 'horaires' && (!jours.length || creneaux.some((c) => !c.open || !c.close))) e.hours = t('auth.errHours');
    if (cle === 'services' && !services.delivery && !services.pickup) e.services = t('auth.errServices');
    if (cle === 'statut' && !courierStatus) e.courierStatus = t('auth.errCourierStatus');
    if (cle === 'etudes') {
      if (schoolName.trim().length < 2) e.schoolName = requis;
      if (!academicYear.trim()) e.academicYear = requis;
      else if (!/^\d{4}(\s*[-/–]\s*\d{2,4})?$/.test(academicYear.trim())) e.academicYear = t('auth.errAcademicYear');
    }
    // Facultatif pour un livreur (audit UX du 15/10/2026) : vérifié seulement s'il est donné.
    if (cle === 'bce' && companyNumber.trim() && !bceValide(companyNumber)) e.companyNumber = messageBce();
    if (cle === 'vehicule' && !vehicleType) e.vehicleType = t('auth.errVehicle');
    if (cle === 'adresse') {
      if (!addressStreet.trim()) e.addressStreet = requis;
      if (!addressNumber.trim()) e.addressNumber = requis;
      if (!addressPostalCode.trim()) e.addressPostalCode = requis;
      else if (!codePostalValide(addressPostalCode)) e.addressPostalCode = t('auth.errPostalCode');
      if (!addressCity.trim()) e.addressCity = requis;
    }
    if (cle === 'fin' && role === 'client' && !accepteCgu) e.cgu = t('conformite.toastTermsRequired');
    if (cle === 'fin' && role === 'restaurant' && !accepteEngagements) e.engagements = t('auth.engagementsRequired');
    if (cle === 'code' && !code.trim()) e.code = t('auth.errCodeRequired');
    return e;
  }

  // Un e-mail = un compte, un numéro = un compte, et un mot de passe qui ne traîne pas dans des fuites connues : dit
  // sous le champ en quittant l'écran, pas à la fin. Serveur injoignable : on laisse passer, l'inscription tranchera.
  async function verifierServeur(cle) {
    const e = {};
    if (cle === 'email') {
      const r = await api('/auth/check-password', { method: 'POST', body: { password } }).catch(() => null);
      if (r && r.ok === false) e.password = t(r.raison === 'fuite' ? 'auth.errPasswordBreached' : 'auth.errPasswordStrength');
    }
    const corps = cle === 'email' ? { email: email.trim() } : cle === 'tel' ? { phone: phone.trim() } : null;
    if (!corps) return e;
    try {
      const r = await api('/auth/check-availability', { method: 'POST', body: corps });
      if (r.phoneValid === false) e.phone = t('auth.errPhoneInvalid');
      if (r.phoneTaken) e.phone = t('auth.errPhoneTaken');
      if (r.emailValid === false) e.email = t('auth.errEmailInvalid');
      else if (r.emailReserved) e.email = t('auth.errEmailReserved');
      else if (r.emailTaken) e.email = t('auth.errEmailTaken');
    } catch { /* l'inscription tranchera */ }
    return e;
  }

  async function avancer(ev) {
    ev?.preventDefault();
    if (attente) return;
    let e = erreursDe(etape);
    setErreurs(e);
    if (Object.keys(e).length) return;
    if (etape === 'code') { confirmerCode(); return; }
    if (derniere) { creerCompte(); return; }
    if (etape === 'email' || etape === 'tel') {
      setAttente(true);
      try { e = await verifierServeur(etape); } finally { setAttente(false); }
      setErreurs(e);
      if (Object.keys(e).length) return;
    }
    setRecule(false);
    setIndex((i) => i + 1);
  }

  function reculer() {
    setErreurs({});
    setRecule(true);
    // Depuis l'écran du code repris après fermeture : le formulaire n'est plus là, on repart de l'accueil du compte.
    if (enAttente) { setEnAttente(null); setCode(''); if (repriseCode) onQuitter(); return; }
    if (index === 0) { onQuitter(); return; }
    setIndex((i) => i - 1);
  }

  function allerA(cle, e) {
    const i = etapes.indexOf(cle);
    if (i >= 0) { setRecule(true); setIndex(i); }
    setErreurs(e);
  }

  // Compte ouvert : droit dans son espace, comme après l'inscription du site (allerApresInscription d'Auth.jsx).
  async function arriver(user) {
    toast(t('auth.welcome', { name: user.name }), 'succes');
    // Un client venu d'un commerce touché sans compte y retourne (comme sur le site, Auth.jsx).
    const cible = user?.role === 'restaurant' ? '/dashboard' : user?.role === 'driver' ? '/driver/onboarding' : retourApres && retourApres !== '/' ? retourApres : '/restaurants';
    await attendrePage(cible);
    navigate(cible, { replace: true });
  }

  function horaires() {
    return Object.fromEntries(DAY_ORDER.map((d) => [d, jours.includes(d) ? creneaux.map((c) => ({ ...c })) : []]));
  }
  // Le commerce tel qu'Auth.jsx l'envoie (construireCommerce), avec les réglages facultatifs à leur valeur par défaut.
  function commerce() {
    return {
      name: nomCommerce.trim(), cuisine: cuisineFinale, hours: horaires(), engagements: accepteEngagements, extraCuisines: [], openingHours: '',
      addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
      commune: addressCity.trim(), neighborhood: '',
      phone: restoPhone.trim() || phone.trim(), phoneSecondary: '', phonePublic: true, phoneSecondaryPublic: true,
      managerContacts: [{ name: `${firstName} ${lastName}`.trim(), phone: phone.trim(), role: 'owner' }],
      email: email.trim(), emailSecondary: '', website: '',
      offersDelivery: !!services.delivery, offersPickup: !!services.pickup,
      pickupPaymentMode: services.pickup ? services.pickupPaymentMode : undefined,
      deliveryMode: services.deliveryMode === 'own' ? 'own' : 'fairide',
      businessSource: 'manuel'
    };
  }
  function tva() {
    if (vatNumber.trim()) return vatNumber.trim();
    const chiffres = companyNumber.replace(/\D/g, '');
    return chiffres.length === 10 ? `BE${chiffres}` : '';
  }
  function communeDeLAdresse() {
    const trouvee = COMMUNES.find((c) => c.toLowerCase() === addressCity.trim().toLowerCase());
    return trouvee ? [trouvee] : [];
  }

  async function creerCompte() {
    const extra = {
      phone: phone.trim(),
      referralCode: referralCode.trim() || undefined,
      ...(role === 'restaurant' ? {
        legalName: legalName.trim(), companyNumber: companyNumber.trim(), vatNumber: tva(), responsibleName: nomResponsable, cuisine: cuisineFinale,
        business: commerce()
      } : { addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim() }),
      ...(role === 'driver' ? {
        companyNumber: companyNumber.trim(), courierStatus, schoolName: schoolName.trim(), academicYear: academicYear.trim(), vehicleType,
        otherPlatforms: [], otherPlatformNote: '', preferredZones: communeDeLAdresse()
      } : {}),
      ...(accepteCgu ? { acceptTerms: true, termsVersion: versionCgu || undefined } : {}),
      ...(role === 'client' ? { marketingConsent: nouvellesOui } : refusNouvelles ? { marketingOptOut: true } : {}),
      // Apple / Google : le prénom et le nom de l'écran « nom » (ou ceux du fournisseur, préremplis) font foi. Avant, le
      // serveur gardait le nom de Google, coupé au premier espace, et ce qu'on avait corrigé ici était perdu.
      ...(fed ? { firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined } : {})
    };
    setConsent(rapports ? 'accepted' : 'refused');
    setAttente(true);
    let reussi = false;
    try {
      if (fed) {
        const data = fed.fournisseur === 'apple'
          ? await loginWithApple(fed.jeton, role, { givenName: firstName.trim() || undefined, familyName: lastName.trim() || undefined, ...extra })
          : await loginWithGoogle(fed.jeton, role, extra);
        suivre(role === 'restaurant' ? 'inscription_restaurant' : role === 'driver' ? 'candidature_livreur' : 'inscription_client');
        // Le téléphone se prouve par SMS, Apple et Google compris (fondateur, 18/10/2026) : écran du code, comme au mot de passe.
        if (data.needsVerification) {
          setRecule(false);
          setEnAttente({ email: data.email, canal: data.channel === 'sms' ? 'sms' : 'email', telephone: data.phoneMasked || phone.trim() });
          return;
        }
        reussi = true;
        await arriver(data.user);
        return;
      }
      const data = await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role, website: siteWeb, ...extra });
      suivre(role === 'restaurant' ? 'inscription_restaurant' : role === 'driver' ? 'candidature_livreur' : 'inscription_client');
      if (data.needsVerification) {
        setRecule(false);
        setEnAttente({ email: data.email, canal: data.channel === 'sms' ? 'sms' : 'email', telephone: data.phoneMasked || phone.trim() });
      } else if (data.token) {
        reussi = true;
        await arriver(data.user);
      }
    } catch (err) {
      const champ = err.field || err.data?.field;
      if (fed && err.message !== 'INCOMPLETE_PROFILE' && /google|apple|token|jeton|expir/i.test(err.message || '')) {
        // Le jeton vit une heure : on repart de l'écran du compte, où « Continuer avec… » en redonne un.
        toast(t('auth.googleExpired'), 'erreur');
        onQuitter();
      } else if (champ === 'password' || err.code === 'PASSWORD_BREACHED' || err.code === 'PASSWORD_WEAK') {
        setPassword('');
        allerA('email', { password: t(err.code === 'PASSWORD_BREACHED' ? 'auth.errPasswordBreached' : 'auth.errPasswordStrength') });
      } else if (champ === 'phone' || champ === 'email') {
        // Le code dit ce qui ne va pas (routes/auth.js) ; sans code connu, le message du serveur, déjà traduit.
        const MESSAGES = { EMAIL_TAKEN: 'auth.errEmailTaken', EMAIL_INVALID: 'auth.errEmailInvalid', EMAIL_RESERVED: 'auth.errEmailReserved', PHONE_TAKEN: 'auth.errPhoneTaken', PHONE_INVALID: 'auth.errPhoneInvalid' };
        allerA(champ === 'phone' ? 'tel' : 'email', { [champ]: MESSAGES[err.code] ? t(MESSAGES[err.code]) : err.message });
      } else if (champ === 'companyNumber') {
        allerA(role === 'restaurant' ? 'entreprise' : 'bce', { companyNumber: err.data?.detail || err.message });
      } else if (ETAPE_DU_CHAMP[champ]) {
        allerA(ETAPE_DU_CHAMP[champ], { [champ]: err.data?.detail || err.message });
      } else {
        toast(err.message === 'INCOMPLETE_PROFILE' ? (err.data?.detail || t('auth.errGoogleIncomplete')) : err.message, 'erreur');
      }
    } finally {
      // Compte ouvert : on reste en « Chargement… » jusqu'au changement de page.
      if (!reussi) setAttente(false);
    }
  }

  async function confirmerCode() {
    setAttente(true);
    try {
      const data = await verifyEmail(enAttente.email, code.trim());
      await arriver(data.user);
    } catch (err) {
      setErreurs({ code: err.message });
      setAttente(false);
    }
  }

  async function renvoyer() {
    setAttente(true);
    try {
      const r = await resendCode(enAttente.email);
      if (r?.channel) setEnAttente((p) => ({ ...p, canal: r.channel === 'sms' ? 'sms' : 'email', telephone: r.phoneMasked || p.telephone }));
      setCode(''); setErreurs({});
      toast(t(r?.channel === 'sms' ? 'auth.errVerificationSentSms' : r?.channel === 'email' ? 'auth.errVerificationSent' : 'auth.newCodeSent'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setAttente(false);
    }
  }

  const titre = (texte, sous) => <><h1 className="bv-titre bv-titre-form">{texte}</h1>{sous && <p className="bv-sous">{sous}</p>}</>;
  const basculerJour = (d) => { setJours((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d])); setErreurs({}); };
  const changerCreneau = (i, champ, v) => setCreneaux((l) => l.map((c, j) => (j === i ? { ...c, [champ]: v } : c)));

  let entete = null; // titre et sous-titre de l'étape : sur le bandeau iris, au-dessus de la feuille
  let contenu = null;
  let bouton = t('appli.continuer');
  switch (etape) {
    case 'email':
      entete = titre(t('appli.insEmailTitre'), t('appli.insEmailSous'));
      contenu = (
        <>
          <Champ id="bv-i-email" label={t('auth.email')} erreur={erreurs.email}>
            <input id="bv-i-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              className={erreurs.email ? 'input-invalid' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.phEmail')} />
            <EmailDomainChips value={email} onChange={setEmail} inputId="bv-i-email" />
          </Champ>
          {erreurs.email === t('auth.errEmailTaken') && <button type="button" className="bv-lien bv-lien-serre" onClick={onConnexion}>{t('appli.dejaCompte')}</button>}
          <Champ id="bv-i-mdp" label={t('auth.password')} erreur={erreurs.password}>
            <PasswordInput id="bv-i-mdp" value={password} invalid={!!erreurs.password}
              onChange={(e) => { setPassword(e.target.value); if (erreurs.password) setErreurs(({ password: _p, ...reste }) => reste); }} />
            {!erreurs.password && (
              <ul className="mdp-criteres" aria-live="polite">
                {[['mdpLongueur', password.length >= 6], ['mdpMajuscule', /[A-Z]/.test(password)], ['mdpMinuscule', /[a-z]/.test(password)]].map(([cle, ok]) => (
                  <li key={cle} className={ok ? 'ok' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {t(`auth.${cle}`)}</li>
                ))}
              </ul>
            )}
          </Champ>
          {/* Pot de miel : hors écran, hors tabulation, hors lecteur d'écran (voir Auth.jsx). */}
          <div className="hp-champ" aria-hidden="true">
            <label htmlFor="bv-i-hp">Site web</label>
            <input id="bv-i-hp" name="website" tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
          </div>
        </>
      );
      break;
    case 'nom':
      entete = titre(t('appli.insNomTitre'), role === 'restaurant' ? t('auth.stepIdentitySubRestaurant') : null);
      contenu = (
        <>
          <Champ id="bv-i-prenom" label={t('auth.firstName')} erreur={erreurs.firstName}>
            <input id="bv-i-prenom" autoComplete="given-name" className={erreurs.firstName ? 'input-invalid' : undefined} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Champ>
          <Champ id="bv-i-nom" label={t('auth.lastName')} erreur={erreurs.lastName}>
            <input id="bv-i-nom" autoComplete="family-name" className={erreurs.lastName ? 'input-invalid' : undefined} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Champ>
        </>
      );
      break;
    case 'tel':
      entete = titre(t('appli.insTelTitre'), role === 'restaurant' ? t('auth.phoneOwnerHelp') : t('auth.stepIdentitySub'));
      contenu = (
        <>
          <Champ id="bv-i-tel" label={t('auth.phone')} labelMasque erreur={erreurs.phone}>
            <PhoneInput id="bv-i-tel" value={phone} onChange={setPhone} invalid={!!erreurs.phone} />
          </Champ>
        </>
      );
      break;
    case 'commerce':
      entete = titre(t('appli.insCommerceTitre'));
      contenu = (
        <>
          <Champ id="bv-i-commerce" label={t('auth.businessNameLabel')} erreur={erreurs.nomCommerce} aide={t('auth.businessNameHelp')}>
            <input id="bv-i-commerce" autoComplete="organization" className={erreurs.nomCommerce ? 'input-invalid' : undefined} value={nomCommerce}
              onChange={(e) => setNomCommerce(e.target.value)} placeholder={t('auth.businessNamePh')} />
          </Champ>
          <Champ id="bv-i-tel-resto" label={t('auth.restoPhoneLabel')} erreur={erreurs.restoPhone} aide={t('auth.restoPhoneHelp')}>
            <PhoneInput id="bv-i-tel-resto" value={restoPhone} onChange={setRestoPhone} invalid={!!erreurs.restoPhone} autoComplete="off" />
          </Champ>
          {phone.trim() && restoPhone.trim() !== phone.trim() && (
            <button type="button" className="bv-ajout" onClick={() => setRestoPhone(phone.trim())}>{t('auth.restoPhoneSameAsMine')}</button>
          )}
        </>
      );
      break;
    /* Des pastilles plutôt que la liste déroulante du téléphone, qui sortait de l'app (retour du fondateur, 2026-10-16).
       35 types : un champ de recherche filtre, et seule la boîte des pastilles défile, pas l'écran. « Autre » reste
       toujours visible, en dernier, pour un commerce que la recherche ne trouve pas ; le type déjà choisi aussi. */
    case 'type': {
      const cherche = sansAccents(rechercheType.trim());
      const types = RESTAURANT_TYPES.filter((rt) => rt.value === 'Autre' || rt.value === cuisine || !cherche ||sansAccents(restaurantTypeLabel(rt.value, t)).includes(cherche));
      entete = titre(t('appli.insTypeTitre'), t('auth.cuisineHelp'));
      contenu = (
        <>
          <label htmlFor="bv-i-type" className="sr-only">{t('appli.insTypeChercher')}</label>
          <input id="bv-i-type" type="search" className="bv-types-recherche" autoComplete="off" enterKeyHint="search"
            value={rechercheType} onChange={(e) => setRechercheType(e.target.value)} placeholder={t('appli.insTypeChercher')} />
          <div className={`bv-types${cuisine === 'Autre' ? ' avec-autre' : ''}`} role="radiogroup" aria-label={t('auth.cuisineLabel')}>
            {types.map((rt) => (
              <button key={rt.value} type="button" role="radio" aria-checked={cuisine === rt.value}
                className={`bv-type${cuisine === rt.value ? ' on' : ''}`} onClick={() => setCuisine(rt.value)}>
                <Icone nom={rt.icone} taille={16} />{restaurantTypeLabel(rt.value, t)}
              </button>
            ))}
          </div>
          {erreurs.cuisine && <p className="field-error" role="alert">{erreurs.cuisine}</p>}
          {cuisine === 'Autre' && (
            <Champ id="bv-i-type-autre" label={t('dashResto.specifyType')}>
              <input id="bv-i-type-autre" value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder={t('dashResto.phType')} />
            </Champ>
          )}
        </>
      );
      break;
    }
    case 'entreprise':
      entete = titre(t('appli.insEntrepriseTitre'));
      contenu = (
        <>
          <Champ id="bv-i-bce" label={t('auth.companyNumberResto')} erreur={erreurs.companyNumber} aide={t('auth.companyNumberRestoHelp')}>
            <input id="bv-i-bce" inputMode="numeric" className={erreurs.companyNumber ? 'input-invalid' : undefined} value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
          </Champ>
          <Champ id="bv-i-raison" label={t('auth.legalName')} erreur={erreurs.legalName}>
            <input id="bv-i-raison" className={erreurs.legalName ? 'input-invalid' : undefined} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t('auth.phLegalName')} />
          </Champ>
          {/* Le responsable légal : la personne qui s'inscrit, sauf si elle dit le contraire (comme sur le site). */}
          {responsable === null && !erreurs.responsibleName ? (
            <p className="bv-aide">
              {t('auth.responsibleIs', { name: nomResponsable || '-' })}{' '}
              <button type="button" className="bv-ajout bv-ajout-texte" onClick={() => setResponsable('')}>{t('auth.responsibleChange')}</button>
            </p>
          ) : (
            <Champ id="bv-i-resp" label={t('auth.responsibleName')} erreur={erreurs.responsibleName}>
              <input id="bv-i-resp" className={erreurs.responsibleName ? 'input-invalid' : undefined} value={responsable ?? ''} onChange={(e) => setResponsable(e.target.value)}
                placeholder={t('auth.responsibleNamePlaceholder')} />
            </Champ>
          )}
        </>
      );
      break;
    case 'horaires':
      entete = titre(t('appli.insHorairesTitre'), t('appli.insHorairesSous'));
      contenu = (
        <>
          <span className="bv-etiquette" id="bv-i-jours">{t('appli.insJours')}</span>
          <div className="bv-jours" role="group" aria-labelledby="bv-i-jours">
            {DAY_ORDER.map((d) => (
              <button key={d} type="button" className={jours.includes(d) ? 'on' : ''} aria-pressed={jours.includes(d)} aria-label={dayLabel(d, t)} onClick={() => basculerJour(d)}>
                {dayLabel(d, t).slice(0, 2)}
              </button>
            ))}
          </div>
          <span className="bv-etiquette">{t('appli.insHeures')}</span>
          {creneaux.map((c, i) => (
            <div key={i} className="bv-creneau">
              <input type="time" value={c.open} aria-label={t('appli.insOuvre')} onChange={(e) => changerCreneau(i, 'open', e.target.value)} />
              <span aria-hidden="true">–</span>
              <input type="time" value={c.close} aria-label={t('appli.insFerme')} onChange={(e) => changerCreneau(i, 'close', e.target.value)} />
              {i > 0 && (
                <button type="button" className="bv-rond" aria-label={t('hoursEditor.removeService')} onClick={() => setCreneaux((l) => l.filter((_, j) => j !== i))}>
                  <Icone nom="croix" taille={16} />
                </button>
              )}
            </div>
          ))}
          {creneaux.length < 2 && (
            <button type="button" className="bv-ajout" onClick={() => setCreneaux((l) => [...l, { open: '18:00', close: '22:00' }])}>＋ {t('appli.insDeuxiemeService')}</button>
          )}
          {erreurs.hours && <p className="field-error" role="alert">{erreurs.hours}</p>}
        </>
      );
      break;
    case 'services':
      entete = titre(t('auth.stepServicesTitle'), t('auth.servicesHelp'));
      contenu = (
        <>
          <Option multi on={services.delivery} icone="scooter" titre={t('auth.serviceDelivery')} onClick={() => setServices((s) => ({ ...s, delivery: !s.delivery }))} />
          {services.delivery && (
            <Segments label={t('auth.serviceDelivery')} valeur={services.deliveryMode} onChoix={(v) => setServices((s) => ({ ...s, deliveryMode: v }))}
              options={[['fairide', t('appli.insLivFairide')], ['own', t('appli.insLivPropres')]]} />
          )}
          <Option multi on={services.pickup} icone="maison" titre={t('auth.servicePickup')} onClick={() => setServices((s) => ({ ...s, pickup: !s.pickup }))} />
          {services.pickup && (
            <>
              <Segments label={t('accountUi.pickupPayTitle')} valeur={services.pickupPaymentMode} onChoix={(v) => setServices((s) => ({ ...s, pickupPaymentMode: v }))}
                options={[['on_site', t('appli.insSurPlace')], ['online', t('appli.insEnLigne')], ['both', t('appli.insAuChoix')]]} />
              <p className="bv-aide">{t(`accountUi.${{ on_site: 'pickupPayOnSiteOnly', online: 'pickupPayOnline', both: 'pickupPayBoth' }[services.pickupPaymentMode]}Text`)}</p>
            </>
          )}
          {erreurs.services && <p className="field-error" role="alert">{erreurs.services}</p>}
        </>
      );
      break;
    case 'statut':
      entete = titre(t('auth.courierStatusTitle'), t('appli.insStatutSous'));
      contenu = (
        <>
          {STATUTS.map(([st, icone]) => (
            <Option key={st} on={courierStatus === st} icone={icone} titre={t(`auth.courierStatus_${st}`)} sous={t(`appli.insStatut_${st}`)} onClick={() => setCourierStatus(st)} />
          ))}
          {erreurs.courierStatus && <p className="field-error" role="alert">{erreurs.courierStatus}</p>}
        </>
      );
      break;
    case 'etudes':
      entete = titre(t('appli.insEtudesTitre'));
      contenu = (
        <>
          <Champ id="bv-i-ecole" label={t('auth.schoolName')} erreur={erreurs.schoolName}>
            <input id="bv-i-ecole" autoComplete="organization" className={erreurs.schoolName ? 'input-invalid' : undefined} value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)} placeholder={t('auth.schoolNamePlaceholder')} />
          </Champ>
          <Champ id="bv-i-annee" label={t('auth.academicYear')} erreur={erreurs.academicYear}>
            <input id="bv-i-annee" inputMode="numeric" className={erreurs.academicYear ? 'input-invalid' : undefined} value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-2027" />
          </Champ>
        </>
      );
      break;
    case 'bce':
      // Facultatif : sans numéro, le bouton dit « plus tard » — le dossier le demandera avant la première course.
      if (!companyNumber.trim()) bouton = t('appli.insPlusTard');
      entete = titre(t('auth.companyNumberDriver'), t('auth.companyNumberDriverHelp'));
      contenu = (
        <>
          <Champ id="bv-i-bce-lv" label={t('auth.companyNumberDriver')} labelMasque erreur={erreurs.companyNumber}>
            <input id="bv-i-bce-lv" inputMode="numeric" className={erreurs.companyNumber ? 'input-invalid' : undefined} value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
          </Champ>
        </>
      );
      break;
    case 'vehicule': {
      const km = courierOptions?.bikeMaxKm || 4;
      entete = titre(t('auth.vehicleTitle'));
      contenu = (
        <>
          <div className="bv-grille">
            {(courierOptions?.vehicles || ['velo', 'velo_electrique', 'scooter', 'voiture']).map((v) => (
              <Option key={v} on={vehicleType === v} titre={t(`courierOnboarding.vehicle_${v}`)} onClick={() => setVehicleType(v)} />
            ))}
          </div>
          {vehicleType && <p className="bv-aide" style={{ marginTop: 12 }}>{['velo', 'velo_electrique'].includes(vehicleType) ? t('auth.vehicleHelpBike', { km }) : t('auth.vehicleHelpMotor', { km })}</p>}
          {erreurs.vehicleType && <p className="field-error" role="alert">{erreurs.vehicleType}</p>}
        </>
      );
      break;
    }
    case 'adresse':
      entete = titre(role === 'restaurant' ? t('auth.stepAddressTitleRestaurant') : role === 'client' ? t('appli.insAdresseClient') : t('auth.stepAddressTitle'),
        role === 'client' ? t('auth.stepAddressSubClient') : role === 'driver' ? t('auth.stepAddressSubDriver') : null);
      contenu = (
        <>
          <div className="bv-champ">
            <AddressSearch compact onSelect={(a) => { setAddressStreet(a.street); if (a.number) setAddressNumber(a.number); if (a.postalCode) setAddressPostalCode(a.postalCode); if (a.city) setAddressCity(a.city); }} />
          </div>
          <div className="bv-rangee">
            <Champ id="bv-i-rue" label={t('auth.street')} erreur={erreurs.addressStreet}>
              <input id="bv-i-rue" autoComplete={role === 'restaurant' ? 'off' : 'address-line1'} className={erreurs.addressStreet ? 'input-invalid' : undefined}
                value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('auth.phStreet')} />
            </Champ>
            <Champ id="bv-i-num" label={t('auth.number')} erreur={erreurs.addressNumber}>
              <input id="bv-i-num" className={erreurs.addressNumber ? 'input-invalid' : undefined} value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
            </Champ>
          </div>
          <div className="bv-rangee bv-rangee-inverse">
            <Champ id="bv-i-cp" label={t('auth.postalCode')} erreur={erreurs.addressPostalCode}>
              <input id="bv-i-cp" inputMode="numeric" autoComplete={role === 'restaurant' ? 'off' : 'postal-code'} className={erreurs.addressPostalCode ? 'input-invalid' : undefined}
                value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
            </Champ>
            <Champ id="bv-i-ville" label={t('auth.city')} erreur={erreurs.addressCity}>
              <input id="bv-i-ville" autoComplete={role === 'restaurant' ? 'off' : 'address-level2'} className={erreurs.addressCity ? 'input-invalid' : undefined}
                value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder={t('auth.phCity')} />
            </Champ>
          </div>
        </>
      );
      break;
    case 'fin':
      bouton = t('auth.createAccount');
      entete = titre(t('appli.insFinTitre'), t(role === 'restaurant' ? 'appli.insFinCommerce' : role === 'driver' ? 'appli.insFinLivreur' : 'appli.insFinClient'));
      contenu = (
        <>
          {role === 'driver' && (
            <>
              <Fait icone="euro" titre={t('appli.insFinLv1')} sous={t('auth.driverFeeNotice')} />
              <Fait icone="position" titre={t('appli.insFinLv2')} sous={t('auth.driverGeoNotice')} />
            </>
          )}
          {role === 'client' && (
            <label className="bv-case-ligne">
              <input type="checkbox" checked={accepteCgu} onChange={(e) => setAccepteCgu(e.target.checked)} />
              <span>{t('conformite.termsAcceptPrefix')} <LienCgv>{t('conformite.termsLink')}</LienCgv>{versionCgu ? ` (${versionCgu})` : ''}.</span>
            </label>
          )}
          {erreurs.cgu && <p className="field-error" role="alert">{erreurs.cgu}</p>}
          {role === 'restaurant' && <EngagementsInscription checked={accepteEngagements} onChange={setAccepteEngagements} />}
          {erreurs.engagements && <p className="field-error" role="alert">{erreurs.engagements}</p>}
          <label className="bv-case-ligne bv-case-carte">
            <input type="checkbox" checked={rapports} onChange={(e) => setRapports(e.target.checked)} />
            <span><b>{t('appli.insRapportsTitre')}</b>{t('appli.insRapports')}</span>
          </label>
          {role === 'client' ? (
            <label className="bv-case-ligne">
              <input type="checkbox" checked={nouvellesOui} onChange={(e) => setNouvellesOui(e.target.checked)} />
              <span>{t('nouvelles.signupOptIn')}</span>
            </label>
          ) : (
            <label className="bv-case-ligne bv-case-discrete">
              <input type="checkbox" checked={refusNouvelles} onChange={(e) => setRefusNouvelles(e.target.checked)} />
              <span>{t('nouvelles.signupOptOut')}</span>
            </label>
          )}
          {/* Où l'on dit comment les données sont utilisées, là où on les demande (RGPD art. 13). */}
          <p className="small" style={{ margin: '4px 0 0' }}>{t('nouvelles.privacyPrefix')} <LienConfidentialite>{t('nouvelles.privacyLink')}</LienConfidentialite>.</p>
          {referralOuvert ? (
            <Champ id="bv-i-code-promo" label={t('auth.promoCode')}>
              <input id="bv-i-code-promo" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
            </Champ>
          ) : (
            <button type="button" className="bv-ajout" onClick={() => setReferralOuvert(true)}>{t('auth.haveReferral')}</button>
          )}
        </>
      );
      break;
    case 'code':
      bouton = t('auth.confirm');
      entete = titre(t(enAttente.canal === 'sms' ? 'auth.verifyTitleSms' : 'auth.verifyTitle'),
        enAttente.canal === 'sms' ? t('auth.verifyTextSms', { phone: enAttente.telephone }) : t('auth.verifyText', { email: enAttente.email }));
      contenu = (
        <>
          <label htmlFor="bv-i-code" className="sr-only">{t('auth.verifyCodeLabel')}</label>
          <input id="bv-i-code" className={`bv-saisie${erreurs.code ? ' input-invalid' : ''}`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
            placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {erreurs.code && <p className="field-error bv-centre" role="alert">{erreurs.code}</p>}
          <button type="button" className="bv-lien" disabled={attente} onClick={renvoyer}>{t('auth.resendCode')}</button>
        </>
      );
      break;
    default:
  }

  return (
    <div className="bv bv-bandeau" ref={fond}>
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={etape}>
        <Haut onRetour={reculer} progression={progression} />
        {entete}
        <form className="bv-form bv-feuille" onSubmit={avancer} noValidate>
          {contenu}
          <div className="bv-grandit" />
          <button type="submit" className="bv-btn btn-gold" disabled={attente}>
            {attente ? t('common.loading') : bouton}
          </button>
        </form>
      </main>
    </div>
  );
}
