import OffreFormules from '../components/OffreFormules';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import BrandMark from '../components/BrandMark';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import AddressRecognition from '../components/AddressRecognition';
import BusinessSearch from '../components/BusinessSearch';
import { api, apiUpload } from '../api';
import IdentityDocsPicker from '../components/IdentityDocsPicker';
import PhoneInput from '../components/PhoneInput';
import EmailDomainChips from '../components/EmailDomainChips';
import AddressSearch from '../components/AddressSearch';
import PasswordInput from '../components/PasswordInput';
import { RESTAURANT_TYPES } from '../menuCategories';
import { cuisineDepuisOsm } from '../osmCuisine';
import { horairesDepuisOsm, horairesNonVides } from '../osmHours';
import OpeningHoursEditor from '../components/OpeningHoursEditor';
import { attendrePage, espaceApresConnexion, prechargerPage } from '../routePrefetch';

function roles(t) {
  return [
    { value: 'client', label: t('auth.roleClient') },
    { value: 'restaurant', label: t('auth.roleRestaurant') },
    { value: 'driver', label: t('auth.roleDriver') }
  ];
}

/* Étapes de l'inscription, dans l'ordre où elles sont posées.

   L'inscription tenait auparavant sur un seul écran : 13 champs pour un client, 17 pour un
   commerce, tous visibles d'un coup. À l'ouverture, ça se lit comme un dossier à monter et
   non comme une inscription — la personne referme avant d'avoir commencé. Le même nombre de
   questions réparti sur trois écrans se remplit sans jamais donner cette impression, parce
   qu'on ne voit à aucun moment plus de quatre champs.

   Le genre et la date de naissance ne sont plus demandés du tout : ils sont facultatifs côté
   serveur, ils ne servent à rien pour livrer un repas, et ils restent modifiables dans la page
   Compte (Account.jsx) pour qui veut les renseigner. Une question qui n'est pas nécessaire ne
   doit pas être posée à l'inscription.

   L'étape "business" n'existe que pour les commerces : le nom légal, le n° BCE, le n° TVA et le
   responsable sont exigés par POST /register côté backend, on ne peut pas s'en passer. */
// Le compte d'abord (adresse e-mail + mot de passe, ou Google) : avec Google, nom et e-mail sont connus et ne
// sont plus redemandés aux étapes suivantes. Les autres étapes précisent qui on est et où on est.
const STEP_KEYS = {
  client: ['account', 'identity', 'address'],
  driver: ['account', 'identity', 'documents', 'address'],
  restaurant: ['account', 'identity', 'business', 'address']
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// autoFocus retiré des premiers champs de chaque étape : le navigateur ne se contente pas de
// placer le curseur, il fait défiler la page pour cadrer le champ. Sur téléphone, la carte venait se
// coller sous l'en-tête — qui recouvrait alors le titre — et le clavier s'ouvrait tout seul, donnant
// l'impression d'être enfermé dans le formulaire dès l'arrivée ou au moindre changement d'onglet.
// Le gain d'un tap ne vaut pas ce saut de page à chaque étape.
const CLE_BROUILLON = 'fairide_inscription_brouillon';
const BROUILLON_MAX_MS = 6 * 3600 * 1000; // au-delà, une inscription interrompue ne se reprend plus

export default function Auth() {
  const { t } = useLanguage();
  const ROLES = roles(t);
  const [searchParams] = useSearchParams();
  const audience = searchParams.get('audience'); // 'client' | 'partner' | null
  const roleHint = searchParams.get('role'); // optional pre-pick within an audience, e.g. 'driver'
  // Les trois types de compte sont toujours proposés ; l'audience et le rôle passés dans l'adresse ne
  // servent qu'à présélectionner le bon (demande du fondateur : ne jamais cacher une porte d'entrée).
  const visibleRoles = ROLES;

  const [mode, setMode] = useState(audience ? 'register' : 'login');
  const [role, setRole] = useState(() => {
    if (ROLES.some((r) => r.value === roleHint)) return roleHint;
    if (audience === 'partner') return 'restaurant';
    return 'client';
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [recoEtat, setRecoEtat] = useState('idle');
  const [adresseConfirmee, setAdresseConfirmee] = useState(false);
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref') || '');
  const [legalName, setLegalName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  // Livreur : statut légal et véhicule choisis dès l'inscription (voir routes/auth.js validerLivreur).
  const [courierStatus, setCourierStatus] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [bagOption, setBagOption] = useState(''); // 'own' | 'fairide' — sac de livraison
  const [courierOptions, setCourierOptions] = useState(null);
  useEffect(() => {
    if (role !== 'driver' || courierOptions) return;
    api('/couriers/options').then(setCourierOptions).catch(() => setCourierOptions({ statuses: ['student', 'p2p', 'independent'], p2pEnabled: false, vehicles: ['velo', 'velo_electrique', 'scooter', 'voiture'], bikeMaxKm: 4, legal: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  const [vatNumber, setVatNumber] = useState('');
  // Pré-rempli avec prénom+nom dès qu'ils sont saisis (cas le plus fréquent) tant que le champ n'a
  // pas été touché à la main — modifiable si le responsable légal du commerce diffère de la personne
  // qui crée le compte, sans reposer une question dont on connaît déjà la réponse dans la majorité des cas.
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleTouched, setResponsibleTouched] = useState(false);
  // Commerce trouvé sur le web (BusinessSearch) et vérification BCE/TVA (VIES) — voir l'étape « Ton commerce ».
  const [commerceTrouve, setCommerceTrouve] = useState(null);
  const [verifSociete, setVerifSociete] = useState(null); // { valid, legalName, address, companyNumber, vatNumber } | null
  // Services que le commerce veut proposer ; enregistrés à la création du restaurant (fairide_resto_hint).
  const [services, setServices] = useState({ delivery: true, deliveryMode: 'fairide', pickup: true, dineIn: false });
  // Type de cuisine (liste complète + « Autre » à préciser), retenu pour la création du restaurant et donné en
  // contexte à la lecture IA du menu.
  const [cuisine, setCuisine] = useState('');
  const [customCuisine, setCustomCuisine] = useState('');
  // Horaires structurés (une ligne par jour), prérempli depuis la fiche web quand elle en donne, adaptés ici.
  const [hours, setHours] = useState(null);
  const [hoursDepuisWeb, setHoursDepuisWeb] = useState(false);
  // Contacts du commerce : le numéro du compte sert au commerce ; un 2e numéro et un 2e e-mail sont facultatifs,
  // retirables ici comme plus tard dans « Mon commerce ».
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [phoneSecondaryOuvert, setPhoneSecondaryOuvert] = useState(false);
  const [emailSecondary, setEmailSecondary] = useState('');
  const [emailSecondaryOuvert, setEmailSecondaryOuvert] = useState(false);
  const [horairesSiteEtat, setHorairesSiteEtat] = useState(''); // '' | 'lecture' | 'recherche' | 'trouve' | 'trouveWeb' | 'rien'
  // Site web trouvé par la recherche web (la fiche n'en avait pas) : repoussé dans la fiche du commerce.
  const [siteTrouve, setSiteTrouve] = useState('');
  // Ce qui a été pré-rempli automatiquement doit être relu : case « j'ai vérifié » obligatoire pour continuer.
  const [infosVerifiees, setInfosVerifiees] = useState(false);
  const cleEnrichie = useRef('');
  // Horaires touchés à la main pendant qu'une recherche tourne (elle peut prendre 15 à 30 s) : la réponse ne les écrase pas.
  const horairesTouches = useRef(false);
  const relectureFaite = useRef(0);
  const [horairesSiteSource, setHorairesSiteSource] = useState('');
  const [typeDepuisSite, setTypeDepuisSite] = useState(false); // le type affiché vient du site, pas d'un choix
  const [relireSite, setRelireSite] = useState(0);
  const emailDepuisFiche = useRef('');
  const cuisineFinale = cuisine === 'Autre' ? (customCuisine.trim() || 'Autre') : cuisine;
  // Dès que le commerce est trouvé dans la recherche : horaires publiés sur son site (schema.org ou texte), et s'il
  // n'a pas de site ou que le site ne les donne pas, recherche web par nom + adresse (site officiel et horaires).
  // Tout est proposé, jamais imposé : pas par-dessus des horaires déjà réglés à la main, et relu avant de continuer.
  useEffect(() => {
    if (role !== 'restaurant' || !commerceTrouve || String(commerceTrouve.name || '').trim().length < 2) return undefined;
    if (hours && !hoursDepuisWeb) return undefined;
    const site = String(commerceTrouve.website || '').trim();
    // La fiche OpenStreetMap publie déjà des horaires lisibles : on les garde. S'il lui manque le site, on le
    // cherche quand même (sans toucher aux horaires) ; si elle a les deux, il n'y a rien à chercher.
    const horairesOsm = !!(commerceTrouve.openingHours && horairesDepuisOsm(commerceTrouve.openingHours));
    if (horairesOsm && site.length >= 6) return undefined;
    const cle = site.length >= 6 ? site : [commerceTrouve.name, commerceTrouve.street, commerceTrouve.number, commerceTrouve.postalCode].join('|');
    // Déjà cherché pour ce commerce (ou site que la recherche vient elle-même de trouver) : sauf « Réessayer ».
    if (cle === cleEnrichie.current && relireSite === relectureFaite.current) return undefined;
    let annule = false;
    // Anti-rebond : la fiche remonte à chaque frappe quand on la corrige ; la recherche web attend un peu plus.
    const minuteur = setTimeout(() => {
      cleEnrichie.current = cle; relectureFaite.current = relireSite;
      if (!horairesOsm) setHorairesSiteEtat(site.length >= 6 ? 'lecture' : 'recherche');
      const q = new URLSearchParams({ web: '1', name: commerceTrouve.name || '', street: commerceTrouve.street || '', number: commerceTrouve.number || '', postalCode: commerceTrouve.postalCode || '', city: commerceTrouve.city || '' });
      if (site.length >= 6) q.set('website', site);
      // Horaires déjà connus : la recherche ne sert qu'au site (le serveur ne relit pas les horaires du site).
      if (horairesOsm) q.set('hours', '0');
      api(`/restaurants/lookup/enrich?${q.toString()}`).then((e) => {
        if (annule) return;
        if (e.websiteFound && !site) { cleEnrichie.current = e.websiteFound; setSiteTrouve(e.websiteFound); }
        if (horairesOsm) { /* horaires de la fiche conservés */ } else if (e.hours && horairesNonVides(e.hours) && !horairesTouches.current) {
          setHours(e.hours); setHoursDepuisWeb(true); setInfosVerifiees(false);
          setHorairesSiteEtat(e.hoursFromSearch ? 'trouveWeb' : 'trouve'); setHorairesSiteSource(e.hoursSource || site);
        } else { setHorairesSiteEtat('rien'); setHorairesSiteSource(''); }
        // Type de commerce : proposé seulement si le restaurateur n'a rien choisi lui-même.
        if (e.cuisine && RESTAURANT_TYPES.some((rt) => rt.value === e.cuisine)) {
          setCuisine((v) => (!v || typeDepuisSite ? e.cuisine : v));
          setTypeDepuisSite(true); setInfosVerifiees(false);
        }
      }).catch(() => { if (!annule) { setHorairesSiteEtat('rien'); setHorairesSiteSource(''); } });
    }, site.length >= 6 ? 700 : 1500);
    return () => { annule = true; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commerceTrouve?.name, commerceTrouve?.street, commerceTrouve?.number, commerceTrouve?.postalCode, commerceTrouve?.website, commerceTrouve?.openingHours, role, relireSite]);

  // Tout ce que l'inscription sait du commerce : le serveur le crée dès que le compte est ouvert
  // (POST /auth/register → creerRestaurant), sans second formulaire dans le tableau de bord.
  function construireCommerce() {
    const fiche = commerceTrouve || {};
    return {
      name: fiche.name || legalName.trim(), cuisine: cuisineFinale, hours,
      openingHours: fiche.openingHours || '',
      addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
      commune: addressCity.trim(), neighborhood: '',
      phone: phone.trim(), phoneSecondary: phoneSecondaryOuvert ? phoneSecondary.trim() : '',
      email: email.trim(), emailSecondary: emailSecondaryOuvert ? emailSecondary.trim() : '',
      website: fiche.website || '',
      offersDelivery: !!services.delivery, offersPickup: !!services.pickup, offersDineIn: !!services.dineIn,
      deliveryMode: services.deliveryMode === 'own' ? 'own' : 'fairide',
      // Commerce trouvé dans la recherche, ou saisi à la main parce qu'il n'y était pas : dans les deux
      // cas l'inscription aboutit à un vrai commerce, la provenance n'est qu'une mention pour l'admin.
      businessSource: fiche.source === 'web' ? 'recherche' : fiche.source === 'manuel' ? 'manuel' : 'inconnu'
    };
  }

  useEffect(() => {
    if (role !== 'restaurant') return;
    try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, cuisineType: cuisine, customCuisine: customCuisine.trim(), hours: horairesNonVides(hours) ? hours : undefined })); } catch { /* sans stockage */ }
  }, [cuisine, customCuisine, hours, role]);
  useEffect(() => {
    if (role !== 'restaurant') return undefined;
    const chiffres = (companyNumber || vatNumber).replace(/\D/g, '');
    if (chiffres.length !== 10) { setVerifSociete(null); return undefined; }
    let annule = false;
    const timer = setTimeout(async () => {
      try {
        const r = await api(`/restaurants/lookup/company?number=${chiffres}`);
        if (annule) return;
        setVerifSociete(r);
        if (r.companyNumber && !companyNumber.trim()) setCompanyNumber(r.companyNumber);
        if (r.vatNumber && !vatNumber.trim()) setVatNumber(r.vatNumber);
        if (r.valid && r.legalName && !legalName.trim()) setLegalName(r.legalName);
      } catch { if (!annule) setVerifSociete({ valid: null, error: 'indisponible' }); }
    }, 700);
    return () => { annule = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNumber, vatNumber, role]);

  // La fiche choisie sur le web préremplit ce qu'elle sait ; le reste est mémorisé pour la création du restaurant.
  function appliquerCommerce(fiche) {
    setCommerceTrouve(fiche);
    if (!fiche) return;
    // La fiche est modifiable : chaque correction du restaurateur se répercute sur l'adresse et le téléphone.
    setAddressStreet(fiche.street || '');
    setAddressNumber(fiche.number || '');
    setAddressPostalCode(fiche.postalCode || '');
    setAddressCity(fiche.city || '');
    // Le téléphone personnel saisi à l'étape précédente n'est jamais écrasé par celui du commerce.
    if (fiche.phone && !phone.trim()) setPhone(fiche.phone);
    const typeDevine = cuisineDepuisOsm(fiche.cuisine, fiche.type);
    if (typeDevine && !cuisine && RESTAURANT_TYPES.some((rt) => rt.value === typeDevine)) setCuisine(typeDevine);
    // Horaires publiés sur le web → structure par jour, tant que le restaurateur n'a pas commencé à les régler lui-même.
    if (fiche.openingHours && (!hours || hoursDepuisWeb)) { const h = horairesDepuisOsm(fiche.openingHours); if (h) { setHours(h); setHoursDepuisWeb(true); } }
    // L'e-mail du commerce noté dans la fiche devient l'e-mail du compte (dernière étape), tant qu'il n'a pas été changé à la main.
    if (fiche.email && (!email.trim() || email === emailDepuisFiche.current)) { setEmail(fiche.email); emailDepuisFiche.current = fiche.email; }
    if (fiche.companyNumber && !companyNumber.trim()) setCompanyNumber(fiche.companyNumber.replace(/^BE/i, '').trim());
    try {
      const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}');
      localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, name: fiche.name, cuisine: fiche.cuisine || fiche.type || '', phone: fiche.phone || '', email: fiche.email || '', website: fiche.website || '', openingHours: fiche.openingHours || '', street: fiche.street || '', number: fiche.number || '', postalCode: fiche.postalCode || '', commune: fiche.city || '', lat: fiche.lat ?? null, lng: fiche.lng ?? null }));
    } catch { /* sans stockage */ }
  }
  useEffect(() => {
    if (role !== 'restaurant') return;
    try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, services })); } catch { /* sans stockage */ }
  }, [services, role]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /* Plus de champ "confirme ton mot de passe" : il ne protège de rien qu'un bouton "Afficher" ne
     protège mieux. Retaper un mot de passe à l'aveugle produit surtout la même faute deux fois,
     et c'est une question de plus à l'écran. Le voir suffit à le vérifier.
     Ce commentaire était écrit depuis longtemps, mais le champ, lui, était resté : il a vraiment
     disparu maintenant, ainsi que son contrôle de concordance et ses traductions. */
  /* Le code de parrainage n'apparaît que si la personne en a un : soit il arrive dans l'URL
     (?ref=...) depuis un lien de parrainage, soit elle clique sur "J'ai un code". Sinon, c'est
     un champ vide de plus qui allonge le formulaire sans jamais servir. */
  const [referralOpen, setReferralOpen] = useState(() => Boolean(searchParams.get('ref')));
  /* Étape courante de l'inscription, et erreurs par champ. Les erreurs vivent sous le champ
     fautif plutôt qu'en toast : à la fin d'un formulaire de 13 champs, un toast "adresse
     requise" n'indique pas lequel des quatre champs d'adresse est vide. */
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  // Inscription via Google : le jeton d'identité est gardé jusqu'à la fin du formulaire (c'est lui qui
  // crée le compte), le profil qu'il contient préremplit prénom, nom et e-mail — qu'on ne redemande pas.
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleProfile, setGoogleProfile] = useState(null);
  const [nomModifiable, setNomModifiable] = useState(false);
  function decoderJwt(cred) {
    try { const b = cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch { return {}; }
  }
  function retenirGoogle(credential) {
    const pr = decoderJwt(credential);
    setGoogleCredential(credential);
    setGoogleProfile({ name: pr.name || '', email: pr.email || '' });
    if (pr.email) setEmail(pr.email);
    if (pr.given_name) setFirstName((v) => v || pr.given_name);
    if (pr.family_name) setLastName((v) => v || pr.family_name);
    setPassword(''); setPasswordConfirm(''); setErrors({});
  }
  function oublierGoogle() { setGoogleCredential(null); setGoogleProfile(null); setEmail(''); }
  // Pièce d'identité du livreur (recto / verso) et attestation étudiant, gardées dans le navigateur jusqu'à la
  // création du compte, puis envoyées au dossier coursier — voir televerserDocumentsLivreur.
  const [docKind, setDocKind] = useState('identity_card');
  const [docRecto, setDocRecto] = useState(null);
  const [docVerso, setDocVerso] = useState(null);
  const [docStudent, setDocStudent] = useState(null);
  async function televerserDocumentsLivreur(token) {
    if (role !== 'driver' || !token) return;
    const envois = [[docKind, 'recto', docRecto], [docKind, 'verso', docVerso], ['school_certificate', null, docStudent]].filter((x) => x[2]);
    let echecs = 0;
    for (const [docType, side, file] of envois) {
      try { await apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType, ...(side ? { side } : {}) } }); } catch { echecs++; }
    }
    if (echecs) toast(t('authDocs.uploadFailed'));
  }
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingChannel, setPendingChannel] = useState('email'); // 'sms' | 'email' : par où le code est parti
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // BROUILLON DE L'INSCRIPTION. Un rafraîchissement (geste réflexe sur téléphone, onglet rechargé par le système)
  // effaçait tout : type de compte, étape, identité, commerce trouvé, horaires, services. On garde un instantané
  // dans sessionStorage (propre à l'onglet, effacé à la fermeture) et on le reprend au rechargement.
  // Jamais les mots de passe, ni le jeton Google, ni les pièces d'identité (fichiers) : ceux-là se redonnent.
  // Repris seulement sur un vrai rechargement, et récent : un visiteur qui revient plus tard par « Connexion »
  // tombe sur un formulaire vierge, pas sur une inscription abandonnée.
  const champsBrouillon = {
    mode: [mode, setMode], role: [role, setRole], step: [step, setStep],
    firstName: [firstName, setFirstName], lastName: [lastName, setLastName], phone: [phone, setPhone], email: [email, setEmail],
    addressStreet: [addressStreet, setAddressStreet], addressNumber: [addressNumber, setAddressNumber],
    addressPostalCode: [addressPostalCode, setAddressPostalCode], addressCity: [addressCity, setAddressCity],
    referralCode: [referralCode, setReferralCode], referralOpen: [referralOpen, setReferralOpen],
    legalName: [legalName, setLegalName], companyNumber: [companyNumber, setCompanyNumber], vatNumber: [vatNumber, setVatNumber],
    responsibleName: [responsibleName, setResponsibleName], responsibleTouched: [responsibleTouched, setResponsibleTouched],
    courierStatus: [courierStatus, setCourierStatus], vehicleType: [vehicleType, setVehicleType], bagOption: [bagOption, setBagOption], docKind: [docKind, setDocKind],
    commerceTrouve: [commerceTrouve, setCommerceTrouve], services: [services, setServices],
    cuisine: [cuisine, setCuisine], customCuisine: [customCuisine, setCustomCuisine], hours: [hours, setHours], hoursDepuisWeb: [hoursDepuisWeb, setHoursDepuisWeb],
    phoneSecondary: [phoneSecondary, setPhoneSecondary], phoneSecondaryOuvert: [phoneSecondaryOuvert, setPhoneSecondaryOuvert],
    emailSecondary: [emailSecondary, setEmailSecondary], emailSecondaryOuvert: [emailSecondaryOuvert, setEmailSecondaryOuvert],
    siteTrouve: [siteTrouve, setSiteTrouve], infosVerifiees: [infosVerifiees, setInfosVerifiees], typeDepuisSite: [typeDepuisSite, setTypeDepuisSite],
    // Code de vérification en attente : sans eux, un rechargement renvoyait au formulaire alors que le compte existe.
    pendingEmail: [pendingEmail, setPendingEmail], pendingChannel: [pendingChannel, setPendingChannel], pendingPhone: [pendingPhone, setPendingPhone],
    forgotMode: [forgotMode, setForgotMode], forgotEmail: [forgotEmail, setForgotEmail]
  };
  const brouillonRepris = useRef(false);
  const attenteBrouillon = useRef(null); // { role, mode } restaurés, tant qu'ils ne sont pas encore appliqués
  useLayoutEffect(() => {
    brouillonRepris.current = true;
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      if (nav?.type !== 'reload') { sessionStorage.removeItem(CLE_BROUILLON); return; }
      const b = JSON.parse(sessionStorage.getItem(CLE_BROUILLON) || 'null');
      if (!b || Date.now() - (b.at || 0) > BROUILLON_MAX_MS) return;
      attenteBrouillon.current = { role: b.champs?.role ?? role, mode: b.champs?.mode ?? mode };
      for (const [cle, valeur] of Object.entries(b.champs || {})) champsBrouillon[cle]?.[1](valeur);
    } catch { /* stockage indisponible ou brouillon illisible : formulaire vierge */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const valeursBrouillon = Object.values(champsBrouillon).map((c) => c[0]);
  useEffect(() => {
    if (!brouillonRepris.current) return undefined;
    const minuteur = setTimeout(() => {
      try {
        const champs = Object.fromEntries(Object.entries(champsBrouillon).map(([cle, [valeur]]) => [cle, valeur]));
        sessionStorage.setItem(CLE_BROUILLON, JSON.stringify({ at: Date.now(), champs }));
      } catch { /* stockage plein ou indisponible */ }
    }, 250);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, valeursBrouillon);

  const { login, register, verifyEmail, resendCode, forgotPassword, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Arrivée ici via une action nécessitant un compte (ex. "+" sur une carte, "Réserver une table")
  // depuis une page publique — on revient y déposer le client une fois connecté, au lieu de le
  // renvoyer systématiquement à l'accueil (voir RestaurantMenu.jsx / RestaurantList.jsx).
  const from = location.state?.from || '/';

  // Arrivée après connexion : on attend (brièvement) que le code de la page suivante soit chargé avant de
  // naviguer, et le bouton reste en « Chargement… » jusque-là. Sans cela, le bouton redevenait actif pendant
  // que la page d'arrivée se téléchargeait en coulisse — sur mobile, on croyait que le toucher n'avait pas pris.
  async function allerApresConnexion(user) {
    try { sessionStorage.removeItem(CLE_BROUILLON); } catch { /* sans stockage */ }
    await attendrePage(from === '/' ? espaceApresConnexion(user) : from);
    navigate(from);
  }
  // Intention forte de se connecter (champ touché, formulaire effleuré) : on précharge dès maintenant les
  // espaces commerce et livreur, pour que l'arrivée soit instantanée après la réponse du serveur.
  const prechargerEspaces = () => { prechargerPage('/dashboard'); prechargerPage('/driver'); };

  useEffect(() => {
    if (responsibleTouched) return;
    const full = `${firstName} ${lastName}`.trim();
    if (full) setResponsibleName(full);
  }, [firstName, lastName, responsibleTouched]);

  // La fiche du commerce (recherche web ou saisie à la main) fournit déjà l'adresse : pas de seconde étape
  // « Ton adresse » pour un restaurateur dont l'adresse est complète — on ne pose jamais deux fois la même question.
  const adresseComplete = !!(addressStreet.trim() && addressNumber.trim() && /^\d{4}$/.test(addressPostalCode.trim()) && addressCity.trim());
  const adresseDepuisFiche = role === 'restaurant' && !!commerceTrouve && adresseComplete;
  const steps = (STEP_KEYS[role] || STEP_KEYS.client).filter((k) => !(k === 'address' && adresseDepuisFiche));
  const stepKey = steps[Math.min(step, steps.length - 1)];
  const isLastStep = step >= steps.length - 1;

  /* Titre et sous-titre de l'étape en cours. Le sous-titre de l'adresse dépend du rôle : ce n'est
     pas la même adresse ni le même usage selon qu'on commande, qu'on livre ou qu'on vend. Dire à
     quoi sert une donnée au moment où on la demande évite la question "pourquoi vous voulez ça ?",
     qui est une des raisons pour lesquelles on abandonne un formulaire. */
  const stepCopy = {
    identity: { title: t('auth.stepIdentityTitle'), sub: t('auth.stepIdentitySub') },
    business: { title: t('auth.stepBusinessTitle'), sub: t('auth.stepBusinessSub') },
    documents: { title: t('auth.stepDocsTitle'), sub: t('auth.stepDocsSub') },
    address: {
      title: t('auth.stepAddressTitle'),
      sub: role === 'client' ? t('auth.stepAddressSubClient')
        : role === 'driver' ? t('auth.stepAddressSubDriver')
        : t('auth.stepAddressSubRestaurant')
    },
    account: { title: t('auth.stepAccountTitle'), sub: t('auth.stepAccountSubFirst') }
  }[stepKey];

  /* Un commerce a une étape de plus qu'un client : changer de rôle en cours de route (ou passer
     de "Créer un compte" à "Se connecter") doit ramener au début, sinon on peut se retrouver à
     une étape 3 qui n'existe plus pour le nouveau rôle. */
  // Retour à la première étape quand on CHANGE de type de compte ou d'onglet — pas au montage, ni pendant la
  // reprise d'un brouillon (sinon un rechargement ramenait toujours à l'étape 1).
  const roleModePrecedent = useRef(null);
  useEffect(() => {
    if (attenteBrouillon.current) {
      if (role === attenteBrouillon.current.role && mode === attenteBrouillon.current.mode) attenteBrouillon.current = null;
      roleModePrecedent.current = { role, mode };
      return;
    }
    const avant = roleModePrecedent.current;
    roleModePrecedent.current = { role, mode };
    if (!avant || (avant.role === role && avant.mode === mode)) return;
    setStep(0); setErrors({});
  }, [role, mode]);

  /* Valide UNE étape et renvoie ses erreurs, par champ. Les règles reproduisent exactement celles
     de POST /register côté backend (routes/auth.js) : prénom, nom, email, mot de passe, téléphone
     et adresse complète obligatoires, plus les quatre champs légaux pour un commerce. Les faire
     remonter ici évite un aller-retour réseau pour apprendre qu'il manque un numéro de rue. */
  function validateStep(key) {
    const required = t('auth.errFieldRequired');
    const e = {};
    if (key === 'identity') {
      if (!firstName.trim()) e.firstName = required;
      if (!lastName.trim()) e.lastName = required;
      if (!phone.trim()) e.phone = required;
      if (role === 'driver') {
        if (!courierStatus) e.courierStatus = t('auth.errCourierStatus');
        if (!vehicleType) e.vehicleType = t('auth.errVehicle');
        if (!bagOption) e.bagOption = t('auth.errBag');
        if (courierStatus === 'independent' && !companyNumber.trim()) e.companyNumber = required;
      }
    }
    if (key === 'documents') {
      if (!docRecto) e.docRecto = t('authDocs.errFront');
      if (!docVerso) e.docVerso = t('authDocs.errBack');
    }
    if (key === 'business') {
      if (!legalName.trim()) e.legalName = required;
      // Numéro d'entreprise et de TVA : demandés plus tard (Mon compte › Paiement), pas à l'inscription.
      if (!responsibleName.trim()) e.responsibleName = required;
      if (!cuisine) e.cuisine = t('auth.errCuisine');
      if (!horairesNonVides(hours)) e.hours = t('auth.errHours');
      if ((hoursDepuisWeb || typeDepuisSite || siteTrouve) && !infosVerifiees) e.infosVerifiees = t('auth.errVerifyPrefill');
      if (phoneSecondaryOuvert && phoneSecondary.trim() && phoneSecondary.trim().replace(/\D/g, '').length < 8) e.phoneSecondary = t('auth.errPhoneInvalid');
      if (emailSecondaryOuvert && emailSecondary.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailSecondary.trim())) e.emailSecondary = t('auth.errEmailSecondary');
      if (!services.delivery && !services.pickup && !services.dineIn) e.services = t('auth.errServices');
    }
    if (key === 'address') {
      if (!addressStreet.trim()) e.addressStreet = required;
      if (!addressNumber.trim()) e.addressNumber = required;
      if (!addressPostalCode.trim()) e.addressPostalCode = required;
      if (!addressCity.trim()) e.addressCity = required;
      // Adresse non reconnue : on demande une confirmation plutôt que de bloquer.
      if (role === 'restaurant' && (recoEtat === 'none' || recoEtat === 'error') && !adresseConfirmee) e.addressConfirm = t('auth.errAddressConfirm');
    }
    if (key === 'account' && googleCredential) return e;
    if (key === 'account') {
      if (!email.trim()) e.email = required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t('auth.errEmailInvalid');
      if (!password) e.password = required;
      else if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        e.password = t('auth.errPasswordStrength');
      }
      // Plus de vérification de concordance : il n'y a plus de second champ à confronter.
    }
    return e;
  }

  const [verifDispo, setVerifDispo] = useState(false);
  /* Un e-mail = un compte, un numéro de téléphone = un compte : le serveur applique la règle à
     l'inscription (409), mais on la vérifie déjà en quittant l'étape concernée pour que le refus
     s'affiche sous le champ fautif, pas après avoir tout rempli. Réseau indisponible : on laisse
     passer, l'inscription elle-même tranchera. */
  async function verifierDisponibilite(key) {
    const corps = key === 'identity' ? { phone: phone.trim() } : key === 'account' && !googleCredential ? { email: email.trim() } : null;
    if (!corps) return {};
    try {
      const r = await api('/auth/check-availability', { method: 'POST', body: corps });
      const e = {};
      if (r.phoneValid === false) e.phone = t('auth.errPhoneInvalid');
      if (r.phoneTaken) e.phone = t('auth.errPhoneTaken');
      if (r.emailTaken) e.email = t('auth.errEmailTaken');
      return e;
    } catch { return {}; }
  }

  // Un double appui sur « Continuer » pendant la vérification de disponibilité (réseau lent) ne doit pas
  // faire sauter une étape : tant que la première demande n'est pas revenue, les suivantes sont ignorées.
  const verifEnCours = useRef(false);
  async function goNext() {
    if (verifEnCours.current) return;
    let e = validateStep(stepKey);
    setErrors(e);
    if (Object.keys(e).length) return;
    setVerifDispo(true); verifEnCours.current = true;
    try { e = await verifierDisponibilite(stepKey); } finally { setVerifDispo(false); verifEnCours.current = false; }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  /* Erreur sous un champ. Le champ lui-même reçoit .input-invalid pour que le filet passe en
     rouge : la couleur seule ne suffirait pas (daltonisme), d'où le texte en plus. */
  function fieldError(name) {
    return errors[name] ? <p className="field-error">{errors[name]}</p> : null;
  }

  const googleBtnRef = useRef(null);
  const stateRef = useRef({ mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName });
  useEffect(() => { stateRef.current = { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName }; });

  async function handleGoogleCredential(response) {
    const { mode, role } = stateRef.current;
    if (mode === 'register') {
      retenirGoogle(response.credential);
      setStep((s) => (s === 0 ? 1 : s));
      return;
    }
    setLoading(true);
    let reussi = false;
    try {
      const data = await loginWithGoogle(response.credential, role, {});
      reussi = true;
      toast(t('auth.welcome', { name: data.user.name }));
      await allerApresConnexion(data.user);
    } catch (err) {
      if (err.message === 'INCOMPLETE_PROFILE') {
        // Pas encore de compte pour cette adresse Google : on enchaîne sur l'inscription, profil prérempli.
        retenirGoogle(response.credential);
        setMode('register');
        toast(t('auth.googleNewAccount'));
      } else {
        toast(err.message);
      }
    } finally {
      // Connexion réussie : le bouton reste en « Chargement… » jusqu'au changement de page.
      if (!reussi) setLoading(false);
    }
  }

  // Création du compte via Google, à la dernière étape, avec tout ce que le formulaire a recueilli.
  async function inscrireViaGoogle() {
    const data = await loginWithGoogle(googleCredential, role, {
      phone: phone.trim(),
      addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
      addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
      ...(role === 'restaurant' ? {
        legalName: legalName.trim(), companyNumber: companyNumber.trim(),
        vatNumber: vatNumber.trim(), responsibleName: responsibleName.trim(), cuisine: cuisineFinale,
        business: construireCommerce()
      } : {}),
      ...(role === 'driver' ? { companyNumber: companyNumber.trim(), courierStatus, vehicleType, bagOption } : {})
    });
    await televerserDocumentsLivreur(data.token);
    toast(t('auth.welcome', { name: data.user.name }));
    await allerApresConnexion(data.user);
    return true;
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    function tryInit() {
      if (cancelled) return;
      if (window.google?.accounts?.id && googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: 320, text: mode === 'register' ? 'signup_with' : 'signin_with'
        });
      } else {
        setTimeout(tryInit, 200);
      }
    }
    tryInit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stepKey, googleCredential]);

  async function submit(e) {
    e.preventDefault();
    if (!(mode === 'register' && googleCredential) && (!email || !password)) { toast(t('auth.errEmailPassword')); return; }
    setLoading(true);
    let reussi = false;
    try {
      if (mode === 'register') {
        /* Filet de sécurité : chaque étape a déjà validé ses propres champs avant de laisser
           passer à la suivante, donc en pratique rien ne devrait tomber ici. Mais on revalide
           TOUTES les étapes avant d'appeler le serveur — un retour en arrière suivi d'un champ
           vidé pourrait sinon partir en requête et revenir en 400. Si une étape antérieure est
           en faute, on y ramène la personne plutôt que d'afficher une erreur hors contexte. */
        for (let i = 0; i < steps.length; i++) {
          const e = validateStep(steps[i]);
          if (Object.keys(e).length > 0) {
            setStep(i);
            setErrors(e);
            setLoading(false);
            return;
          }
        }
        if (role === 'driver' && 'geolocation' in navigator) {
          // Demande l'autorisation de géolocalisation une seule fois, à la création du compte.
          // Elle pourra être désactivée plus tard dans les réglages du compte.
          navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
        }
        if (googleCredential) {
          try {
            reussi = await inscrireViaGoogle();
          } catch (err) {
            // Jeton Google expiré (il vit une heure) ou refusé : on repart de la première étape.
            if (/google|token|jeton|expir/i.test(err.message || '') && err.message !== 'INCOMPLETE_PROFILE') { oublierGoogle(); setStep(0); toast(t('auth.googleExpired')); }
            else throw err;
          }
          return;
        }
        const data = await register({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role,
          phone: phone.trim(),
          referralCode: referralCode.trim() || undefined,
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
          addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
          ...(role === 'restaurant' ? {
            legalName: legalName.trim(), companyNumber: companyNumber.trim(),
            vatNumber: vatNumber.trim(), responsibleName: responsibleName.trim(), cuisine: cuisineFinale,
            business: construireCommerce()
          } : {}),
          ...(role === 'driver' ? { companyNumber: companyNumber.trim(), courierStatus, vehicleType, bagOption } : {})
        });
        if (data.needsVerification) {
          setPendingEmail(data.email);
          setPendingChannel(data.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(data.phoneMasked || phone.trim());
          toast(t(data.channel === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
        } else if (data.token) {
          await televerserDocumentsLivreur(data.token);
        }
      } else {
        const data = await login(email.trim(), password);
        reussi = true;
        toast(t('auth.welcome', { name: data.user.name }));
        await allerApresConnexion(data.user);
      }
    } catch (err) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email.trim());
        toast(t('auth.errEmailNotVerified'));
      } else if (err.code === 'ACCOUNT_DELETED' || err.code === 'NO_ACCOUNT') {
        // Compte supprimé ou inexistant : on le dit, et on ouvre directement la création de compte (e-mail conservé).
        toast(t(err.code === 'ACCOUNT_DELETED' ? 'auth.errAccountDeleted' : 'auth.errNoAccount'));
        setMode('register');
      } else if (err.field === 'phone' || err.field === 'email') {
        const message = err.field === 'phone' ? (/invalide/i.test(err.message) ? t('auth.errPhoneInvalid') : t('auth.errPhoneTaken')) : t('auth.errEmailTaken');
        setErrors({ [err.field]: message });
        const i = steps.indexOf(err.field === 'phone' ? 'identity' : 'account');
        if (i >= 0) setStep(i);
        toast(message);
      } else {
        toast(err.message);
      }
    } finally {
      if (!reussi) setLoading(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!code.trim()) { toast(t('auth.errCodeRequired')); return; }
    setLoading(true);
    let reussi = false;
    try {
      const data = await verifyEmail(pendingEmail, code.trim());
      reussi = true;
      await televerserDocumentsLivreur(data.token);
      toast(t('auth.welcome', { name: data.user.name }));
      await allerApresConnexion(data.user);
    } catch (err) {
      toast(err.message);
      reussi = false;
    } finally {
      if (!reussi) setLoading(false);
    }
  }

  async function submitForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast(t('auth.errEmailRequired')); return; }
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotSubmitted(true);
    } catch (err) {
      toast(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendCode(pendingEmail);
      toast(t('auth.newCodeSent'));
    } catch (err) {
      toast(err.message);
    } finally {
      setResending(false);
    }
  }

  // Décor et en-tête suivent le rôle choisi, pas seulement l'adresse d'arrivée : changer de type de compte
  // change le contexte affiché.
  const decorClass = mode === 'register' ? (role === 'client' ? 'client' : 'partner') : (audience === 'partner' ? 'partner' : audience === 'client' ? 'client' : '');

  if (forgotMode) {
    return (
      <div className={`decor-page auth-decor ${decorClass}`}>
        <div className="auth-box">
        <div className="card">
          <div className="auth-brand">
            <BrandMark size={26} />
            <span>fairide</span>
          </div>
          <h2 style={{ marginTop: 0 }}>{t('auth.forgotTitle')}</h2>
          {forgotSubmitted ? (
            <>
              <p className="small" style={{ marginBottom: 14 }}>
                {t('auth.forgotSubmittedText', { email: forgotEmail })}
              </p>
              <button className="btn-ghost" onClick={() => { setForgotMode(false); setForgotSubmitted(false); setForgotEmail(''); }}>
                {t('auth.backToLogin')}
              </button>
            </>
          ) : (
            <>
              <p className="small" style={{ marginBottom: 14 }}>
                {t('auth.forgotText')}
              </p>
              <form onSubmit={submitForgotPassword}>
                <div className="field">
                  <label htmlFor="auth-f-1">{t('auth.email')}</label>
                  <input id="auth-f-1" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder={t('auth.phEmail')} />
                </div>
                <button type="submit" className="btn-gold btn-block" disabled={forgotLoading}>
                  {forgotLoading ? t('common.loading') : t('auth.sendLink')}
                </button>
              </form>
              <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setForgotMode(false)}>
                {t('auth.backToLogin')}
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (pendingEmail) {
    return (
      <div className={`decor-page auth-decor ${decorClass}`}>
        <div className="auth-box">
        <div className="card">
          <div className="auth-brand">
            <BrandMark size={26} />
            <span>fairide</span>
          </div>
          <h2 style={{ marginTop: 0 }}>{t(pendingChannel === 'sms' ? 'auth.verifyTitleSms' : 'auth.verifyTitle')}</h2>
          <p className="small" style={{ marginBottom: 14 }}>
            {pendingChannel === 'sms' ? t('auth.verifyTextSms', { phone: pendingPhone }) : t('auth.verifyText', { email: pendingEmail })}
          </p>
          <form onSubmit={submitCode}>
            <div className="field">
              <label htmlFor="auth-f-2">{t('auth.verifyCodeLabel')}</label>
              <input id="auth-f-2"
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
              />
            </div>
            <button type="submit" className="btn-gold btn-block" disabled={loading}>
              {loading ? t('common.loading') : t('auth.confirm')}
            </button>
          </form>
          <button className="btn-ghost" style={{ marginTop: 10 }} disabled={resending} onClick={handleResend}>
            {resending ? t('common.loading') : t('auth.resendCode')}
          </button>
          <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setPendingEmail(''); setCode(''); }}>
            {t('auth.back')}
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`decor-page auth-decor ${decorClass}`}>
      {/* Le bandeau « Espace client » + accroche au-dessus de la carte a disparu de l'inscription.
          Il redisait ce que le sélecteur de rôle affiche déjà trois centimètres plus bas, et il
          poussait le premier champ hors de l'écran sur un téléphone : on arrivait sur une page
          d'inscription sans voir où s'inscrire. Il ne reste que pour qui arrive par un lien
          d'audience (?pour=commerce), où il sert d'accueil et pas de répétition. */}
      {audience && mode !== 'register' && (
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>
            {role === 'client' ? t('auth.clientHeading') : t('auth.partnerHeading')}
          </h2>
        </div>
      )}
      <div className="auth-box">
      <div className="card">
        <div className="auth-brand">
          <BrandMark size={26} />
          <span>fairide</span>
        </div>
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={`chip${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>{t('auth.login')}</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={`chip${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>{t('auth.register')}</button>
        </div>

        {mode === 'register' ? (
          /* Entrée par étapes. La touche Entrée passe à l'étape suivante tant qu'il en reste une,
             et ne déclenche la création du compte qu'à la dernière — sans ça, taper Entrée dans le
             champ "Prénom" enverrait un formulaire aux trois quarts vide. */
          <form onSubmit={(ev) => { if (isLastStep) { submit(ev); } else { ev.preventDefault(); goNext(); } }}>
            {visibleRoles.length > 1 && step === 0 && (
              <div className="role-pick">
                {visibleRoles.map((r) => (
                  <button type="button" key={r.value} aria-pressed={role === r.value} className={`chip${role === r.value ? ' active' : ''}`} onClick={() => setRole(r.value)}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <div className="auth-step-head">
              <h3>{stepCopy.title}</h3>
              <p className="small">{stepCopy.sub}</p>
              <div className="auth-step-bar">
                <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            {stepKey === 'identity' && (
              <>
                {role === 'driver' && (
                  <>
                    <p className="small" style={{ marginBottom: 8 }}>{t('auth.driverGeoNotice')}</p>
                    <p className="small" style={{ marginBottom: 14 }}>{t('auth.driverFeeNotice')}</p>
                  </>
                )}
                {googleCredential && !nomModifiable && firstName.trim() && lastName.trim() ? (
                  <div className="auth-google-lie" style={{ marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>👤 {firstName} {lastName}</div>
                      <div className="small">{email} · {t('auth.fromGoogle')}</div>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setNomModifiable(true)}>{t('auth.edit')}</button>
                  </div>
                ) : (
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-3">{t('auth.firstName')}</label>
                    <input id="auth-f-3" className={errors.firstName ? 'input-invalid' : undefined}
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('auth.firstName')} />
                    {fieldError('firstName')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-4">{t('auth.lastName')}</label>
                    <input id="auth-f-4" className={errors.lastName ? 'input-invalid' : undefined}
                      value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('auth.lastName')} />
                    {fieldError('lastName')}
                  </div>
                </div>
                )}
                <div className="field">
                  <label htmlFor="auth-f-7">{t('auth.phone')}</label>
                  {/* Pays (UE, Belgique par défaut) + numéro local : la valeur envoyée est internationale (+32 470…). */}
                  <PhoneInput id="auth-f-7" value={phone} onChange={setPhone} invalid={!!errors.phone} />
                  {fieldError('phone')}
                </div>
                {role === 'driver' && (
                  <>
                    <div className="field">
                      <span className="titre-groupe" id="auth-statut-titre">{t('auth.courierStatusTitle')}</span>
                      <p className="small" style={{ margin: '0 0 8px' }}>{t('auth.courierStatusHelp')}</p>
                      <div className={`statut-choix${errors.courierStatus ? ' input-invalid' : ''}`} role="radiogroup" aria-labelledby="auth-statut-titre">
                        {(courierOptions?.statuses || ['student', 'p2p', 'independent']).map((st) => {
                          const ferme = st === 'p2p' && courierOptions && !courierOptions.p2pEnabled;
                          return (
                            <div key={st} role="radio" aria-checked={courierStatus === st} aria-disabled={ferme} tabIndex={ferme ? -1 : 0}
                              className={`statut-carte${courierStatus === st ? ' active' : ''}${ferme ? ' ferme' : ''}`}
                              onClick={() => { if (!ferme) setCourierStatus(st); }} onKeyDown={(e) => { if (!ferme && (e.key === 'Enter' || e.key === ' ')) setCourierStatus(st); }}>
                              <b>{st === 'student' ? '🎓 ' : st === 'p2p' ? '🤝 ' : '🧾 '}{t(`courierOnboarding.status_${st}`)}</b>
                              <span className="small">{t(`courierOnboarding.status_${st}_desc`)}</span>
                              {ferme && <span className="pill" style={{ alignSelf: 'flex-start' }}>{t('auth.courierStatusP2pSoon')}</span>}
                            </div>
                          );
                        })}
                      </div>
                      {fieldError('courierStatus')}
                    </div>
                    {courierStatus === 'independent' && (
                      <div className="field">
                        <label htmlFor="auth-f-19">{t('auth.companyNumberDriver')}</label>
                        <input id="auth-f-19" className={errors.companyNumber ? 'input-invalid' : undefined}
                          value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
                        {fieldError('companyNumber')}
                        <p className="small" style={{ margin: '4px 0 0' }}>{t('auth.companyNumberDriverHelp')}</p>
                      </div>
                    )}
                    <div className="field">
                      <span className="titre-groupe" id="auth-vehicule-titre">{t('auth.vehicleTitle')}</span>
                      <div className={`role-pick statements-chips${errors.vehicleType ? ' input-invalid' : ''}`} role="radiogroup" aria-labelledby="auth-vehicule-titre">
                        {(courierOptions?.vehicles || ['velo', 'velo_electrique', 'scooter', 'voiture']).map((v) => (
                          <div key={v} role="radio" aria-checked={vehicleType === v} tabIndex={0} className={`chip${vehicleType === v ? ' active' : ''}`}
                            onClick={() => setVehicleType(v)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVehicleType(v); }}>
                            {v === 'velo' ? '🚲 ' : v === 'velo_electrique' ? '⚡🚲 ' : v === 'scooter' ? '🛵 ' : '🚗 '}{t(`courierOnboarding.vehicle_${v}`)}
                          </div>
                        ))}
                      </div>
                      {fieldError('vehicleType')}
                      {vehicleType && (
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          {['velo', 'velo_electrique'].includes(vehicleType) ? t('auth.vehicleHelpBike', { km: courierOptions?.bikeMaxKm || 4 }) : t('auth.vehicleHelpMotor', { km: courierOptions?.bikeMaxKm || 4 })}
                        </p>
                      )}
                    </div>
                    <div className="field">
                      <span className="titre-groupe" id="auth-sacoche-titre">{t('auth.bagTitle')}</span>
                      <p className="small" style={{ margin: '0 0 8px' }}>{t('auth.bagHelp')}</p>
                      <div className={`statut-choix${errors.bagOption ? ' input-invalid' : ''}`} role="radiogroup" aria-labelledby="auth-sacoche-titre">
                        {['own', 'fairide'].map((b) => (
                          <div key={b} role="radio" aria-checked={bagOption === b} tabIndex={0} className={`statut-carte${bagOption === b ? ' active' : ''}`}
                            onClick={() => setBagOption(b)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setBagOption(b); }}>
                            <b>{b === 'own' ? '🎒 ' : '🟢 '}{t(`auth.bag_${b}`)}</b>
                            <span className="small">{b === 'own' ? t('auth.bagOwnHelp') : t('auth.bagFairideHelp', { amount: courierOptions?.bagDeposit || 40 })}</span>
                          </div>
                        ))}
                      </div>
                      {fieldError('bagOption')}
                    </div>
                  </>
                )}
              </>
            )}

            {stepKey === 'business' && (
              <>
                <BusinessSearch onSelect={(f) => { if (!f) { setSiteTrouve(''); setInfosVerifiees(false); } appliquerCommerce(f); }} onPostalCode={(cp) => setAddressPostalCode((v) => v || cp)} initialPostalCode={addressPostalCode} siteTrouve={siteTrouve} initialFiche={commerceTrouve} />
                {adresseDepuisFiche && <p className="small" style={{ margin: '-6px 0 12px', color: 'var(--teal-deep, #1F8A70)' }}>✅ {t('auth.addressFromFiche')}</p>}
                <div className="field">
                  <label htmlFor="auth-f-cuisine">{t('auth.cuisineLabel')}</label>
                  <select id="auth-f-cuisine" className={errors.cuisine ? 'input-invalid' : undefined} value={cuisine} onChange={(e) => { setCuisine(e.target.value); setTypeDepuisSite(false); }}>
                    <option value="">{t('auth.cuisinePlaceholder')}</option>
                    {RESTAURANT_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.emoji ? `${rt.emoji} ` : ''}{rt.value}</option>)}
                  </select>
                  {cuisine === 'Autre' && (
                    <input style={{ marginTop: 6 }} value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder={t('dashResto.phType')} aria-label={t('dashResto.specifyType')} />
                  )}
                  <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{typeDepuisSite && cuisine ? `✅ ${t('auth.cuisineFromSite')}` : t('auth.cuisineHelp')}</p>
                  {fieldError('cuisine')}
                </div>
                <div className="field" role="group" aria-labelledby="auth-horaires-titre">
                  <span className="titre-groupe" id="auth-horaires-titre">{t('auth.hoursTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>
                    {hoursDepuisWeb ? `✅ ${t(horairesSiteEtat === 'trouve' ? 'auth.hoursFromSite' : horairesSiteEtat === 'trouveWeb' ? 'auth.hoursFromSearch' : 'auth.hoursFromWeb')}` : horairesSiteEtat === 'lecture' ? `⏳ ${t('auth.hoursReadingSite')}` : horairesSiteEtat === 'recherche' ? `⏳ ${t('auth.hoursSearching')}` : t('auth.hoursHelp')}
                    {(horairesSiteEtat === 'trouve' || horairesSiteEtat === 'trouveWeb') && horairesSiteSource && (
                      <>{' '}<a href={horairesSiteSource} target="_blank" rel="noreferrer">{t('auth.hoursSiteSource')}</a></>
                    )}
                  </p>
                  {horairesSiteEtat === 'rien' && !hoursDepuisWeb && (
                    <p className="small" style={{ margin: '-2px 0 8px', opacity: 0.85 }}>
                      {t('auth.hoursSiteNone')}{' '}
                      <button type="button" className="btn-link-plus" style={{ margin: 0 }} onClick={() => { horairesTouches.current = false; setRelireSite((n) => n + 1); }}>{t('auth.hoursSiteRetry')}</button>
                    </p>
                  )}
                  <OpeningHoursEditor value={hours || {}} onChange={(h) => { horairesTouches.current = true; setHours(h); setHoursDepuisWeb(false); }} />
                  {fieldError('hours')}
                </div>
                {(hoursDepuisWeb || typeDepuisSite || siteTrouve) && (
                  <div className={`field verif-prefill${errors.infosVerifiees ? ' verif-prefill--erreur' : ''}`}>
                    <b>🔎 {t('auth.verifyPrefillTitle')}</b>
                    <p className="small" style={{ margin: '4px 0 6px' }}>{t('auth.verifyPrefillIntro')}</p>
                    <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                      {siteTrouve && <li>🌐 {t('auth.verifyPrefillWebsite')} <a href={siteTrouve} target="_blank" rel="noreferrer">{siteTrouve}</a></li>}
                      {hoursDepuisWeb && <li>🕒 {t('auth.verifyPrefillHours')}</li>}
                      {typeDepuisSite && cuisine && <li>🍽️ {t('auth.verifyPrefillType', { type: cuisine })}</li>}
                    </ul>
                    <label className="verif-prefill-case">
                      <input type="checkbox" checked={infosVerifiees} onChange={(e) => setInfosVerifiees(e.target.checked)} />
                      <span>{t('auth.verifyPrefillCheck')}</span>
                    </label>
                    {fieldError('infosVerifiees')}
                  </div>
                )}
                {/* Plus de question sur la carte ici : elle se crée après l'inscription, dans « Mon menu »
                    (fondateur, 2026-09-14). L'inscription reste courte : le commerce, ses horaires, ses services. */}
                <div className="field contacts-commerce" role="group" aria-labelledby="auth-contacts-titre">
                  <span className="titre-groupe" id="auth-contacts-titre">{t('auth.contactsTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>{t('auth.contactsHelp')}</p>
                  <p className="small contact-ligne">📞 <b>{phone.trim() || '-'}</b> <span style={{ opacity: 0.75 }}>· {t('auth.contactsPhoneFromAccount')}</span></p>
                  {!phoneSecondaryOuvert ? (
                    <button type="button" className="btn-link-plus" onClick={() => setPhoneSecondaryOuvert(true)}>＋ {t('auth.addSecondPhone')}</button>
                  ) : (
                    <div className="contact-second">
                      <label htmlFor="auth-f-tel2" className="small">{t('auth.secondPhone')}</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><PhoneInput id="auth-f-tel2" value={phoneSecondary} onChange={setPhoneSecondary} invalid={!!errors.phoneSecondary} /></div>
                        <button type="button" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 13 }} onClick={() => { setPhoneSecondary(''); setPhoneSecondaryOuvert(false); }}>{t('auth.removeSecond')}</button>
                      </div>
                      {fieldError('phoneSecondary')}
                    </div>
                  )}
                  <p className="small contact-ligne" style={{ marginTop: 8 }}>✉️ <b>{email.trim() || t('auth.contactsEmailLater')}</b> <span style={{ opacity: 0.75 }}>· {t('auth.contactsEmailFromAccount')}</span></p>
                  {!emailSecondaryOuvert ? (
                    <button type="button" className="btn-link-plus" onClick={() => setEmailSecondaryOuvert(true)}>＋ {t('auth.addSecondEmail')}</button>
                  ) : (
                    <div className="contact-second">
                      <label htmlFor="auth-f-mail2" className="small">{t('auth.secondEmail')}</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <input id="auth-f-mail2" type="email" inputMode="email" style={{ flex: 1 }} className={errors.emailSecondary ? 'input-invalid' : undefined} value={emailSecondary} onChange={(e) => setEmailSecondary(e.target.value)} placeholder={t('auth.phEmail')} />
                        <button type="button" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 13 }} onClick={() => { setEmailSecondary(''); setEmailSecondaryOuvert(false); }}>{t('auth.removeSecond')}</button>
                      </div>
                      <EmailDomainChips value={emailSecondary} onChange={setEmailSecondary} inputId="auth-f-mail2" />
                      {fieldError('emailSecondary')}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="auth-f-12">{t('auth.legalName')}</label>
                  <input id="auth-f-12" className={errors.legalName ? 'input-invalid' : undefined}
                    value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t('auth.phLegalName')} />
                  {fieldError('legalName')}
                </div>
                <p className="small" style={{ margin: '-4px 0 12px', opacity: 0.8 }}>{t('auth.legalLaterHint')}</p>
                <div className="field">
                  <label htmlFor="auth-f-15">{t('auth.responsibleName')}</label>
                  <input id="auth-f-15" className={errors.responsibleName ? 'input-invalid' : undefined}
                    value={responsibleName}
                    onChange={(e) => { setResponsibleName(e.target.value); setResponsibleTouched(true); }}
                    placeholder={t('auth.responsibleNamePlaceholder')}
                  />
                  {fieldError('responsibleName')}
                </div>
                <div className="field services-choice" role="group" aria-labelledby="auth-services-titre">
                  <span className="titre-groupe" id="auth-services-titre">{t('auth.servicesTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>{t('auth.servicesHelp')}</p>
                  <label className="service-option"><input type="checkbox" checked={services.delivery} onChange={(e) => setServices((s) => ({ ...s, delivery: e.target.checked }))} /> <span>🛵 {t('auth.serviceDelivery')}</span></label>
                  {services.delivery && (
                    <div className="service-suboptions">
                      <label className="service-option"><input type="radio" name="deliveryMode" checked={services.deliveryMode === 'fairide'} onChange={() => setServices((s) => ({ ...s, deliveryMode: 'fairide' }))} /> <span>{t('auth.serviceDeliveryFairide')}</span></label>
                      <label className="service-option"><input type="radio" name="deliveryMode" checked={services.deliveryMode === 'own'} onChange={() => setServices((s) => ({ ...s, deliveryMode: 'own' }))} /> <span>{t('auth.serviceDeliveryOwn')}</span></label>
                    </div>
                  )}
                  <label className="service-option"><input type="checkbox" checked={services.pickup} onChange={(e) => setServices((s) => ({ ...s, pickup: e.target.checked }))} /> <span>🏠 {t('auth.servicePickup')}</span></label>
                  <label className="service-option"><input type="checkbox" checked={services.dineIn} onChange={(e) => setServices((s) => ({ ...s, dineIn: e.target.checked }))} /> <span>🍽️ {t('auth.serviceDineIn')}</span></label>
                  {/* Gratuit → payant dit en clair dès l'inscription, avec la date du premier prélèvement (voir OffreFormules). */}
                  <OffreFormules payant={services.delivery || services.pickup} inscription />
                  {fieldError('services')}
                </div>
              </>
            )}

            {stepKey === 'documents' && (
              <IdentityDocsPicker kind={docKind} setKind={setDocKind} recto={docRecto} setRecto={setDocRecto} verso={docVerso} setVerso={setDocVerso} student={docStudent} setStudent={setDocStudent} errors={errors} />
            )}

            {stepKey === 'address' && (
              <>
                <AddressSearch onSelect={(a) => { setAddressStreet(a.street); if (a.number) setAddressNumber(a.number); if (a.postalCode) setAddressPostalCode(a.postalCode); if (a.city) setAddressCity(a.city); }} />
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-8">{t('auth.street')}</label>
                    <input id="auth-f-8" className={errors.addressStreet ? 'input-invalid' : undefined}
                      value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('auth.phStreet')} />
                    {fieldError('addressStreet')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-9">{t('auth.number')}</label>
                    <input id="auth-f-9" className={errors.addressNumber ? 'input-invalid' : undefined}
                      value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
                    {fieldError('addressNumber')}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-10">{t('auth.postalCode')}</label>
                    <input id="auth-f-10" className={errors.addressPostalCode ? 'input-invalid' : undefined}
                      value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
                    {fieldError('addressPostalCode')}
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-11">{t('auth.city')}</label>
                    <input id="auth-f-11" className={errors.addressCity ? 'input-invalid' : undefined}
                      value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder={t('auth.phCity')} />
                    {fieldError('addressCity')}
                  </div>
                </div>
                {role === 'restaurant' && (
                  <AddressRecognition
                    street={addressStreet} number={addressNumber} postalCode={addressPostalCode} city={addressCity}
                    onResult={(r) => {
                      if (r.commune && !addressCity.trim()) setAddressCity(r.commune);
                      // { ...ancien } et pas une fiche neuve : cet indice porte aussi les horaires, les
                      // services et les contacts saisis aux étapes précédentes. Les écraser ici privait
                      // le tableau de bord de quoi recréer le commerce, et le restaurateur se retrouvait
                      // à tout ressaisir une seconde fois.
                      try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, commune: r.commune, neighborhood: r.neighborhood, street: addressStreet.trim(), number: addressNumber.trim(), postalCode: addressPostalCode.trim() })); } catch { /* sans stockage */ }
                    }}
                    onPickCandidate={(c, r) => {
                      try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, name: c.name || ancien.name, cuisine: c.cuisine || ancien.cuisine, commune: r.commune, neighborhood: r.neighborhood, street: addressStreet.trim(), number: addressNumber.trim(), postalCode: addressPostalCode.trim() })); } catch { /* sans stockage */ }
                    }}
                    onStatus={setRecoEtat} onConfirm={setAdresseConfirmee}
                  />
                )}
                {role === 'restaurant' && errors.addressConfirm && (
                  <p className="small" style={{ color: 'var(--red)', margin: '4px 0 0' }}>{errors.addressConfirm}</p>
                )}
              </>
            )}

            {stepKey === 'account' && googleCredential && (
              <div className="auth-google-lie">
                <div>
                  <div style={{ fontWeight: 700 }}>✅ {t('auth.googleLinked')}</div>
                  <div className="small">{googleProfile?.name}{googleProfile?.name && googleProfile?.email ? ' · ' : ''}{googleProfile?.email}</div>
                  <div className="small" style={{ marginTop: 4 }}>{t('auth.googleLinkedHelp')}</div>
                </div>
                <button type="button" className="btn-ghost" onClick={oublierGoogle}>{t('auth.googleUseOther')}</button>
              </div>
            )}
            {stepKey === 'account' && !googleCredential && (
              <>
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 10px' }}>
                      <div ref={googleBtnRef} />
                    </div>
                    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                      <span className="small">{t('auth.or')}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                    </div>
                  </>
                )}
                <div className="field">
                  <label htmlFor="auth-f-17">{t('auth.email')}</label>
                  <input id="auth-f-17" type="email" className={errors.email ? 'input-invalid' : undefined}
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.phEmail')} autoComplete="email" inputMode="email" />
                  <EmailDomainChips value={email} onChange={setEmail} inputId="auth-f-17" />
                  {fieldError('email')}
                </div>
                {/* La règle du mot de passe sort du texte d'exemple. « 5 caractères min., 1 majuscule,
                    1 minuscule, 1 chiffre » ne tenait pas dans la largeur du champ : la phrase était
                    coupée en plein milieu, donc la règle était affichée sans être lisible. Sous le
                    champ, elle tient, et elle reste visible pendant la frappe — un texte d'exemple
                    disparaît au premier caractère, exactement quand on en a besoin. */}
                <div className="field">
                  <label htmlFor="auth-f-18">{t('auth.password')}</label>
                  <PasswordInput id="auth-f-18" value={password} onChange={(e) => setPassword(e.target.value)}
                    invalid={!!errors.password} />
                  {errors.password ? fieldError('password') : <p className="champ-aide">{t('auth.passwordRule')}</p>}
                  {/* Le texte d'exemple a disparu du champ : le libellé « Mot de passe » est juste
                      au-dessus, et Uber ne double jamais une étiquette par un texte d'exemple. */}
                </div>
              </>
            )}
            {stepKey === 'account' && (referralOpen ? (
              <div className="field">
                <label htmlFor="auth-f-16">{t('auth.promoCode')}</label>
                <input id="auth-f-16" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
              </div>
            ) : (
              <button type="button" className="btn-ghost" style={{ padding: '2px 0', marginBottom: 10, fontSize: 13 }} onClick={() => setReferralOpen(true)}>
                {t('auth.haveReferral')}
              </button>
            ))}

            <div className="auth-step-nav">
              {step > 0 && (
                <button type="button" className="btn-outline" onClick={goBack}>{t('auth.back')}</button>
              )}
              <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={loading}>
                {loading ? t('common.loading') : isLastStep ? t('auth.createAccount') : t('auth.continueStep')}
              </button>
            </div>
          </form>
        ) : (
          <>
            {GOOGLE_CLIENT_ID && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
                  <div ref={googleBtnRef} />
                </div>
                <div className="row" style={{ alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span className="small">{t('auth.or')}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
              </>
            )}
            <form onSubmit={submit} onPointerDown={prechargerEspaces} onFocus={prechargerEspaces}>
              <div className="field">
                <label htmlFor="auth-f-17">{t('auth.email')}</label>
                <input id="auth-f-17" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.phEmail')} />
              </div>
              <div className="field">
                <label htmlFor="auth-f-18">{t('auth.password')}</label>
                <PasswordInput id="auth-f-18" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.password')} autoComplete="current-password" />
              </div>
              <button type="button" className="btn-ghost" style={{ padding: '2px 0', marginBottom: 10, fontSize: 13 }} onClick={() => { setForgotEmail(email); setForgotMode(true); }}>
                {t('auth.forgotPassword')}
              </button>
              <button type="submit" className="btn-gold btn-block" disabled={loading}>
                {loading ? t('common.loading') : t('auth.signIn')}
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
