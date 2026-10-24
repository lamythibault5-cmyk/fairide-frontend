import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import EngagementsInscription from '../components/commerce/EngagementsInscription';
import { remonterEnHaut } from '../remonter';
import urlSure from '../urlSure';
import { chargerGoogleSignIn } from '../googleSignIn';
import { estNatif, connexionFournisseur } from '../natif';
import { lireBienvenue } from '../bienvenue';
import BoutonsConnexionNative, { LogoGoogle } from '../components/BoutonsConnexionNative';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import AddressRecognition from '../components/AddressRecognition';
import { api } from '../api';
import PhoneInput from '../components/PhoneInput';
import EmailDomainChips from '../components/EmailDomainChips';
import AddressSearch from '../components/AddressSearch';
import PasswordInput from '../components/PasswordInput';
import { restaurantTypeLabel, COMMUNES, communeDepuisCodePostal } from '../menuCategories';
import { specialite } from '../specialites';
import ChoixSpecialites from '../components/commerce/ChoixSpecialites';
import { horairesDepuisOsm, horairesNonVides } from '../osmHours';
import OpeningHoursEditor from '../components/OpeningHoursEditor';
import { attendrePage, espaceApresConnexion, prechargerPage } from '../routePrefetch';
import usePageMeta from '../hooks/usePageMeta';
import { suivre } from '../analytics';
import { bceValide, raisonBce, codePostalValide, CHAMP_CODE_SECOURS, formaterAnneeAcademique } from '../validation';
import { lireAdresseAccueil } from '../adresseAccueil';
import useDecompte, { DELAI_RENVOI_S, DELAI_CODE_EMAIL_S } from '../hooks/useDecompte';
import RedirectionRole from '../components/RedirectionRole';
import Icone from '../components/Icone';
import CadreConnexion from '../components/CadreConnexion';
import AvecMarque from '../components/AvecMarque';
import VerifSociete from '../components/commerce/VerifSociete';
import { defilement } from '../gestes';

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
/* L'INSCRIPTION RESTAURATEUR SE FAIT UN SUJET PAR ECRAN.
   « Ton commerce » tenait tout sur un seul ecran : recherche du commerce, cuisine, horaires, contacts,
   raison sociale, representant, services et formule. Environ dix-huit champs a la suite, ou le
   restaurateur ne voyait jamais la fin — et ou une erreur sur un champ du bas obligeait a remonter tout
   l'ecran. Quatre ecrans le remplacent, dans l'ordre ou on y pense : on trouve son commerce, on decrit
   ce qu'il est, on dit quand il est ouvert, puis ce qu'il propose.
   Chacun valide ce qu'il porte, donc « Continuer » bloque au plus pres de la faute. */
const STEP_KEYS = {
  client: ['account', 'identity', 'address'],
  // Livreur : plus de pièces d'identité ni de selfie à l'inscription (audit UX du 15/10/2026). Ils étaient gardés en mémoire
  // jusqu'à la création du compte — perdus au moindre rechargement, et Android ferme souvent l'onglet en ouvrant l'appareil
  // photo. L'identité se vérifie dans le dossier (Stripe Identity, pièce téléversée ou en personne), qui l'exige avant envoi.
  driver: ['account', 'identity', 'address'],
  restaurant: ['account', 'identity', 'business', 'details', 'hours', 'services', 'address']
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// autoFocus retiré des premiers champs de chaque étape : le navigateur ne se contente pas de
// placer le curseur, il fait défiler la page pour cadrer le champ. Sur téléphone, la carte venait se
// coller sous l'en-tête — qui recouvrait alors le titre — et le clavier s'ouvrait tout seul, donnant
// l'impression d'être enfermé dans le formulaire dès l'arrivée ou au moindre changement d'onglet.
// Le gain d'un tap ne vaut pas ce saut de page à chaque étape.
const CLE_BROUILLON = 'fairide_inscription_brouillon';
/* BROUILLON GARDÉ 48 H, MÊME ONGLET FERMÉ (audit UX du 15/10/2026). Il ne survivait qu'à un rechargement du même onglet
   (sessionStorage) : un restaurateur qui fermait la page pour aller chercher son numéro d'entreprise recommençait tout.
   localStorage, 48 h, effacé à l'inscription réussie ou par « Recommencer » ; jamais de mot de passe ni de code dedans.
   Déclaré dans la politique des cookies (stockage technique, cookies.technical). */
const BROUILLON_MAX_MS = 48 * 3600 * 1000; // au-delà, une inscription interrompue ne se reprend plus

// Le cadre en deux moitiés (iris + feuille blanche) : components/CadreConnexion.jsx, partagé avec le nouveau mot de passe.
export default function Auth() {
  const { t, language } = useLanguage();
  // Page publique et indexée (voir robots.txt) : elle porte son propre titre et sa description.
  usePageMeta({ title: t('seo.loginTitle'), description: t('seo.loginDescription'), path: '/login' });
  // Pot de miel : un champ que personne ne voit ni ne remplit — sauf un robot (le serveur le lit aussi).
  const [siteWeb, setSiteWeb] = useState('');
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
  // Selon le statut (fondateur, 2026-10-06) : école et année académique de l'étudiant-indépendant, déclaration sur l'honneur du
  // particulier (économie collaborative). Le numéro d'entreprise sert aux deux statuts indépendants.
  const [schoolName, setSchoolName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [bagOption, setBagOption] = useState(''); // 'own' | 'fairide' — sac de livraison
  // Livreur (fondateur, 2026-10-05) : travaille-t-il déjà pour d'autres plateformes (lesquelles, plusieurs possibles),
  // et ses communes de préférence (plusieurs possibles, facultatif).
  const [autrePlateforme, setAutrePlateforme] = useState(''); // '' | 'yes' | 'no'
  const [plateformes, setPlateformes] = useState([]);
  const [plateformeAutre, setPlateformeAutre] = useState('');
  const [zonesPreferees, setZonesPreferees] = useState([]);
  const [courierOptions, setCourierOptions] = useState(null);
  useEffect(() => {
    if (role !== 'driver' || courierOptions) return;
    // Hors ligne : les deux statuts (plus d'économie collaborative depuis CODE-12 — régime fermé aux livreurs de plateformes).
    api('/couriers/options').then(setCourierOptions).catch(() => setCourierOptions({ statuses: ['student_independent', 'independent'], vehicles: ['velo', 'velo_electrique', 'scooter', 'voiture'], bikeMaxKm: 4, legal: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  const [vatNumber, setVatNumber] = useState('');
  // Pré-rempli avec prénom+nom dès qu'ils sont saisis (cas le plus fréquent) tant que le champ n'a
  // pas été touché à la main — modifiable si le responsable légal du commerce diffère de la personne
  // qui crée le compte, sans reposer une question dont on connaît déjà la réponse dans la majorité des cas.
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleTouched, setResponsibleTouched] = useState(false);
  const [responsableOuvert, setResponsableOuvert] = useState(false);
  // Commerce trouvé sur le web (BusinessSearch) et vérification BCE/TVA (VIES) — voir l'étape « Ton commerce ».
  // Nom du commerce, saisi à la main (fondateur, 2026-10-13 : le raccourci « trouver mon commerce par code postal » est retiré,
  // il ne donnait pas de résultat fiable). L'adresse est demandée à l'étape « Adresse », les horaires une seule fois à l'étape
  // « Horaires », le type à l'étape « Ton commerce en détail » : plus aucun préremplissage venu du web.
  const [nomCommerce, setNomCommerce] = useState('');
  const [commerceTrouve, setCommerceTrouve] = useState(null);
  const raisonSocialeBce = useRef(''); // dernière raison sociale remplie par la BCE, remplaçable par la suivante (shop-1)
  const [verifSociete, setVerifSociete] = useState(null); // { valid, legalName, address, companyNumber, vatNumber } | null — affiché sous le numéro (VerifSociete, shop-2)
  // Services que le commerce veut proposer ; enregistrés à la création du restaurant (fairide_resto_hint).
  // pickupPaymentMode : 'on_site' (0 % de commission) | 'online' | 'both' — l'à emporter relève toujours de la version complète, voir OffreFormules.
  const [services, setServices] = useState({ delivery: true, deliveryMode: 'fairide', pickup: true, pickupPaymentMode: 'on_site' });
  // Type de cuisine (liste complète + « Autre » à préciser), retenu pour la création du restaurant et donné en
  // contexte à la lecture IA du menu.
  // Ce que le commerce vend (ChoixSpecialites.jsx, fondateur, 2026-10-22) : jusqu'à 7 spécialités, la première est son type
  // principal (`cuisine`), les autres ses types en plus. Une saisie libre (« Je ne trouve pas ») y est telle quelle.
  const [specialites, setSpecialites] = useState([]);
  const cuisine = specialites[0] || '';
  // Horaires structurés (une ligne par jour), prérempli depuis la fiche web quand elle en donne, adaptés ici.
  const [hours, setHours] = useState(null);
  const [hoursDepuisWeb, setHoursDepuisWeb] = useState(false);
  // Contacts du commerce : le numéro du compte sert au commerce ; un 2e numéro et un 2e e-mail sont facultatifs,
  // retirables ici comme plus tard dans « Mon commerce ».
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [phoneSecondaryOuvert, setPhoneSecondaryOuvert] = useState(false);
  // Masquer au public (fondateur, 2026-10-10) : chaque numéro du commerce peut être caché des clients dès l'inscription ;
  // l'équipe Fairide le voit toujours. Le numéro personnel du titulaire n'est jamais public.
  const [phonePublic, setPhonePublic] = useState(true);
  const [phoneSecondaryPublic, setPhoneSecondaryPublic] = useState(true);
  // Restaurateur (fondateur, 2026-09-30) : le numéro SUR PLACE du restaurant (restaurants.phone) est distinct du
  // numéro du compte, qui est celui du patron / responsable ; d'autres responsables s'ajoutent (manager_contacts).
  const [restoPhone, setRestoPhone] = useState('');
  const [responsables, setResponsables] = useState([]);
  // Autres types de cuisine dès l'inscription (fondateur, 2026-10-01) : 6 au plus, 7 avec le type principal.
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
  const cuisineFinale = cuisine;
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
        // Proposé en premier choix ; un premier choix lui-même proposé par le site est remplacé, les autres restent.
        const devine = specialite(e.cuisine)?.value;
        if (devine) {
          setSpecialites((v) => (!v.length ? [devine] : typeDepuisSite ? [devine, ...v.slice(1).filter((x) => x !== devine)] : v));
          setTypeDepuisSite(true); setInfosVerifiees(false);
        }
      }).catch(() => { if (!annule) { setHorairesSiteEtat('rien'); setHorairesSiteSource(''); } });
    }, site.length >= 6 ? 700 : 1500);
    return () => { annule = true; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commerceTrouve?.name, commerceTrouve?.street, commerceTrouve?.number, commerceTrouve?.postalCode, commerceTrouve?.website, commerceTrouve?.openingHours, role, relireSite]);

  // Tout ce que l'inscription sait du commerce : le serveur le crée dès que le compte est ouvert
  // (POST /auth/register → creerRestaurant), sans second formulaire dans le tableau de bord.
  // En Belgique, le numéro de TVA est « BE » + le numéro d'entreprise : déduit s'il n'a été ni trouvé ni tapé.
  // Pour un commerce, TOUJOURS déduit du numéro envoyé (audit du 19/10, shop-1) : la TVA trouvée pour un premier numéro
  // mal tapé restait collée après correction, et « Configurer mes paiements » refusait plus tard la discordance.
  function tvaInscription() {
    const chiffres = companyNumber.replace(/\D/g, '');
    if (role === 'restaurant' && chiffres.length === 10) return `BE${chiffres}`;
    return vatNumber.trim();
  }

  // Commune du livreur prise de son adresse, quand elle est l'une des 19 (sinon rien : il la choisit dans son dossier).
  function communeDeLAdresse() {
    const ville = addressCity.trim().toLowerCase();
    const trouvee = COMMUNES.find((c) => c.toLowerCase() === ville);
    return trouvee ? [trouvee] : [];
  }

  function construireCommerce() {
    const fiche = commerceTrouve || {};
    return {
      name: nomCommerce.trim() || fiche.name || legalName.trim(), cuisine: cuisineFinale, hours,
      engagements: accepteEngagements,
      extraCuisines: specialites.slice(1),
      openingHours: fiche.openingHours || '',
      addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
      commune: addressCity.trim(), neighborhood: '',
      phone: restoPhone.trim() || phone.trim(), phoneSecondary: phoneSecondaryOuvert ? phoneSecondary.trim() : '',
      phonePublic, phoneSecondaryPublic: phoneSecondaryOuvert ? phoneSecondaryPublic : true,
      // Le titulaire du compte d'abord (patron / responsable), puis les autres responsables saisis.
      managerContacts: [{ name: `${firstName} ${lastName}`.trim(), phone: phone.trim(), role: 'owner' }, ...responsables.filter((r) => r.phone.trim()).map((r) => ({ name: r.name.trim(), phone: r.phone.trim(), role: 'manager' }))],
      email: email.trim(), emailSecondary: emailSecondaryOuvert ? emailSecondary.trim() : '',
      website: fiche.website || '',
      offersDelivery: !!services.delivery, offersPickup: !!services.pickup,
      pickupPaymentMode: services.pickup ? services.pickupPaymentMode : undefined,
      deliveryMode: services.deliveryMode === 'own' ? 'own' : 'fairide',
      // Commerce trouvé dans la recherche, ou saisi à la main parce qu'il n'y était pas : dans les deux
      // cas l'inscription aboutit à un vrai commerce, la provenance n'est qu'une mention pour l'admin.
      businessSource: fiche.source === 'web' ? 'recherche' : fiche.source === 'manuel' ? 'manuel' : 'inconnu'
    };
  }

  useEffect(() => {
    if (role !== 'restaurant') return;
    try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, cuisineType: cuisine, extraCuisines: specialites.slice(1), hours: horairesNonVides(hours) ? hours : undefined })); } catch { /* sans stockage */ }
  }, [cuisine, specialites, hours, role]);
  useEffect(() => {
    if (role !== 'restaurant') return undefined;
    const chiffres = companyNumber.replace(/\D/g, '');
    // La ligne du numéro précédent ne reste pas affichée sous un autre numéro pendant la nouvelle recherche (shop-2).
    setVerifSociete(null);
    if (chiffres.length !== 10) return undefined;
    let annule = false;
    const timer = setTimeout(async () => {
      try {
        const r = await api(`/restaurants/lookup/company?number=${chiffres}`);
        if (annule) return;
        setVerifSociete(r);
        if (r.companyNumber && !companyNumber.trim()) setCompanyNumber(r.companyNumber);
        // TVA et raison sociale suivent CHAQUE numéro trouvé, plus seulement le premier (audit du 19/10, shop-1). La
        // raison sociale tapée à la main reste : on ne remplace que celle que la BCE avait mise elle-même.
        setVatNumber(r.vatNumber || '');
        if (r.valid && r.legalName) {
          setLegalName((v) => {
            if (v.trim() && v !== raisonSocialeBce.current) return v;
            raisonSocialeBce.current = r.legalName;
            return r.legalName;
          });
        }
      } catch { if (!annule) setVerifSociete({ valid: null, error: 'indisponible' }); }
    }, 700);
    return () => { annule = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNumber, role]);

  // appliquerCommerce (une fiche trouvée sur le web préremplissait l'adresse, le téléphone, la cuisine, les horaires) est
  // retiré avec la recherche du commerce par code postal (fondateur, 2026-10-13, voir nomCommerce) : il n'était plus appelé.
  useEffect(() => {
    if (role !== 'restaurant') return;
    try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, services })); } catch { /* sans stockage */ }
  }, [services, role]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Le mot de passe est demandé deux fois à l'inscription (fondateur, 2026-09-17) : une faute de frappe dans un
  // champ masqué enfermait la personne dehors dès sa première connexion.
  // « Créer mon compte » avec une étape incomplète : on y ramène la personne ET on lui dit pourquoi, au-dessus du
  // bouton — sinon elle se retrouvait sur une étape précédente sans explication. { step, n } ; effacé dès qu'on
  // change d'étape.
  const [incomplet, setIncomplet] = useState(null);
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
  // Client qui arrive de l'accueil de l'application : le code postal tapé là-bas (écran « Ton code postal ») préremplit
  // l'adresse, au lieu d'être redemandé deux écrans plus loin. Seulement des champs vides — un brouillon restauré ou une
  // fiche Google gardent la main. L'étape reste : le serveur exige l'adresse complète d'un client (routes/auth.js).
  useEffect(() => {
    if (mode !== 'register' || role !== 'client') return;
    const b = lireBienvenue();
    if (b.codePostal) setAddressPostalCode((v) => v || b.codePostal);
    if (b.commune) setAddressCity((v) => v || b.commune);
    // L'adresse choisie sur l'accueil du site (audit du 19/10, auth-27 / LIVE-12, voir adresseAccueil.js) : mêmes règles,
    // seulement des champs vides.
    const a = lireAdresseAccueil();
    if (a?.street) setAddressStreet((v) => v || a.street);
    if (a?.number) setAddressNumber((v) => v || a.number);
    if (a?.postalCode) setAddressPostalCode((v) => v || a.postalCode);
    if (a?.city) setAddressCity((v) => v || a.city);
  }, [mode, role]);
  // Chaque nouvelle étape s'ouvre en haut de l'écran, pas là où l'on a touché « Continuer » (voir src/remonter.js).
  const etapeAffichee = useRef(step);
  useEffect(() => {
    if (etapeAffichee.current === step) return;
    etapeAffichee.current = step;
    remonterEnHaut();
  }, [step]);
  const [errors, setErrors] = useState({});
  // Inscription via Google : le jeton d'identité est gardé jusqu'à la fin du formulaire (c'est lui qui
  // crée le compte), le profil qu'il contient préremplit prénom, nom et e-mail — qu'on ne redemande pas.
  const [googleCredential, setGoogleCredential] = useState(null);
  // Dans l'application iPhone, le jeton gardé peut venir d'Apple au lieu de Google (natif.js) : même parcours,
  // seule la route du serveur change (/auth/apple au lieu de /auth/google). Tout le reste du formulaire l'ignore.
  const [fournisseurFed, setFournisseurFed] = useState('google');
  // CGU (backlog C1) : case non pré-cochée, obligatoire pour un compte client, et version affichée —
  // le serveur enregistre la version que la personne a vue, avec l'heure, l'IP et l'empreinte du texte.
  const [accepteCgu, setAccepteCgu] = useState(false);
  // Restaurateur : la case des engagements (déclaration professionnelle + allergènes), signés à la création du commerce.
  const [accepteEngagements, setAccepteEngagements] = useState(false);
  // E-mails marketing en opt-out : la loi belge exige de pouvoir refuser dès la collecte de l'adresse (AR 4 avril 2003,
  // art. 1). Case NON cochée par défaut ; cochée, le compte est créé désinscrit (routes/auth.js, enregistrerRefusNouvelles).
  const [refusNouvelles, setRefusNouvelles] = useState(false);
  // Client : les nouvelles demandent un OUI, case non cochée (recherche du 18/10/2026 : un compte gratuit sans commande
  // n'ouvre pas l'exception « client » de l'AR du 4 avril 2003). Commerces et livreurs gardent la case de refus.
  const [nouvellesOui, setNouvellesOui] = useState(false);
  const [versionCgu, setVersionCgu] = useState('');
  useEffect(() => { api('/auth/terms/current').then((r) => setVersionCgu(r.version)).catch(() => {}); }, []);
  const [googleProfile, setGoogleProfile] = useState(null);
  const [nomModifiable, setNomModifiable] = useState(false);
  function decoderJwt(cred) {
    try { const b = cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch { return {}; }
  }
  // `fed` : { fournisseur, prenom, nom } quand le jeton vient de la feuille native (Apple ne met pas le nom dans
  // son jeton : il arrive à côté, et seulement à la première autorisation).
  function retenirGoogle(credential, fed = {}) {
    const pr = decoderJwt(credential);
    setGoogleCredential(credential);
    setFournisseurFed(fed.fournisseur || 'google');
    const prenom = pr.given_name || fed.prenom || '';
    const nomFamille = pr.family_name || fed.nom || '';
    setGoogleProfile({ name: pr.name || [prenom, nomFamille].filter(Boolean).join(' '), email: pr.email || '' });
    if (pr.email) setEmail(pr.email);
    if (prenom) setFirstName((v) => v || prenom);
    if (nomFamille) setLastName((v) => v || nomFamille);
    setPassword(''); setErrors({});
  }
  function oublierGoogle() { setGoogleCredential(null); setGoogleProfile(null); setEmail(''); }
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingChannel, setPendingChannel] = useState('email'); // 'sms' | 'email' : par où le code est parti
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState('');
  // Double authentification : le champ n'apparaît qu'après un premier essai où le serveur a répondu
  // TOTP_REQUIRED — donc seulement pour les comptes qui l'ont activée, et seulement une fois le mot de
  // passe validé. Voir routes/auth.js pour la raison de cet ordre.
  const [totpAttendu, setTotpAttendu] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  // Connexion Google d'un compte à double authentification : le serveur la réclame désormais aussi (elle
  // ne l'était qu'au mot de passe). Le jeton Google est gardé le temps de saisir le code, puis renvoyé
  // avec lui par le même bouton « Se connecter » — il reste valable une heure.
  const [googleEnAttente2fa, setGoogleEnAttente2fa] = useState(null);
  const [resending, setResending] = useState(false);
  // « Renvoyer le code » attend 30 s après chaque envoi (audit du 19/10, auth-12, voir hooks/useDecompte.js).
  const [attenteRenvoi, lancerAttenteRenvoi] = useDecompte();
  useEffect(() => { if (pendingEmail) lancerAttenteRenvoi(DELAI_RENVOI_S); }, [pendingEmail, lancerAttenteRenvoi]);
  // « Je n'ai pas reçu le SMS », puis le code par e-mail 30 s plus tard (voir DELAI_CODE_EMAIL_S).
  const [smsPasRecu, setSmsPasRecu] = useState(false);
  const [attenteEmail, lancerAttenteEmail] = useDecompte();
  // Code SMS lu par Chrome sur Android (WebOTP, audit du 19/10, auth-35) : le SMS finit par « @fairide.be #123456 »
  // (routes/auth.js, smsCode) ; le navigateur propose alors de remplir le champ. Ailleurs (iPhone, ordinateur, application),
  // rien ne change : autocomplete="one-time-code" fait le reste.
  useEffect(() => {
    if (!pendingEmail || pendingChannel !== 'sms' || estNatif() || !('OTPCredential' in window)) return undefined;
    const arret = new AbortController();
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: arret.signal })
      .then((otp) => { if (otp?.code) setCode(String(otp.code).replace(/\D/g, '').slice(0, 6)); })
      .catch(() => { /* refusé, expiré ou abandonné : la saisie à la main reste */ });
    return () => arret.abort();
  }, [pendingEmail, pendingChannel]);
  // Erreurs de connexion et du code SOUS le champ (audit du 19/10, auth-10) : le toast de 3 s passait sous le clavier du
  // téléphone, et le formulaire semblait n'avoir rien fait. Le toast reste en plus.
  const [erreurConnexion, setErreurConnexion] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  // « Changer de numéro » sur l'écran du code (audit du 19/10, auth-03) : le champ du bon numéro, et la preuve que le compte
  // est à soi — le mot de passe tapé (gardé en mémoire, jamais dans le brouillon), ou le jeton Apple / Google.
  const [changerNumero, setChangerNumero] = useState(false);
  const [nouveauNumero, setNouveauNumero] = useState('');
  const [erreursNumero, setErreursNumero] = useState({});
  // Jeton Apple / Google d'une CONNEXION sur un compte qui attend son code (PHONE_NOT_VERIFIED) : la preuve du compte.
  const [preuveCode, setPreuveCode] = useState(null);
  // ?oubli=1 : arrivée depuis un lien de réinitialisation périmé (ResetPassword.jsx), directement sur « mot de passe oublié ».
  const [forgotMode, setForgotMode] = useState(() => searchParams.get('oubli') === '1');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  // Adresse jamais confirmée : l'écran du code d'adresse, avant le lien (forgotCodeStep).
  const [forgotCodeStep, setForgotCodeStep] = useState(false);
  const [forgotCode, setForgotCode] = useState('');

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
    courierStatus: [courierStatus, setCourierStatus], schoolName: [schoolName, setSchoolName], academicYear: [academicYear, setAcademicYear], vehicleType: [vehicleType, setVehicleType], bagOption: [bagOption, setBagOption],
    autrePlateforme: [autrePlateforme, setAutrePlateforme], plateformes: [plateformes, setPlateformes], plateformeAutre: [plateformeAutre, setPlateformeAutre], zonesPreferees: [zonesPreferees, setZonesPreferees],
    commerceTrouve: [commerceTrouve, setCommerceTrouve], nomCommerce: [nomCommerce, setNomCommerce], services: [services, setServices],
    specialites: [specialites, setSpecialites], hours: [hours, setHours], hoursDepuisWeb: [hoursDepuisWeb, setHoursDepuisWeb],
    phoneSecondary: [phoneSecondary, setPhoneSecondary], phoneSecondaryOuvert: [phoneSecondaryOuvert, setPhoneSecondaryOuvert],
    restoPhone: [restoPhone, setRestoPhone], responsables: [responsables, setResponsables],
    emailSecondary: [emailSecondary, setEmailSecondary], emailSecondaryOuvert: [emailSecondaryOuvert, setEmailSecondaryOuvert],
    siteTrouve: [siteTrouve, setSiteTrouve], infosVerifiees: [infosVerifiees, setInfosVerifiees], typeDepuisSite: [typeDepuisSite, setTypeDepuisSite],
    // Code de vérification en attente : sans eux, un rechargement renvoyait au formulaire alors que le compte existe.
    pendingEmail: [pendingEmail, setPendingEmail], pendingChannel: [pendingChannel, setPendingChannel], pendingPhone: [pendingPhone, setPendingPhone],
    forgotMode: [forgotMode, setForgotMode], forgotEmail: [forgotEmail, setForgotEmail]
  };
  const brouillonRepris = useRef(false);
  // Inscription reprise après être parti (pas un simple rechargement) : on le dit, avec « Recommencer ».
  const [brouillonReprisVisible, setBrouillonRepris] = useState(false);
  function recommencer() {
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans stockage */ }
    window.location.reload();
  }
  const attenteBrouillon = useRef(null); // { role, mode } restaurés, tant qu'ils ne sont pas encore appliqués
  /* LE MOT DE PASSE D'UN BROUILLON REPRIS (audit du 19/10, LIVE-13). Le brouillon ne le garde jamais, et c'est voulu. Mais
     repris au-delà de la première étape (celle du compte), il manquait au moment de « Créer mon compte » : retour à l'étape
     1, « Ce champ est requis », et tout le parcours à refaire. On le redemande donc à la DERNIÈRE étape, juste au-dessus du
     bouton : la personne reste où elle en était. */
  const [mdpARetaper, setMdpARetaper] = useState(false);
  useLayoutEffect(() => {
    brouillonRepris.current = true;
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) || 'null');
      if (!b || Date.now() - (b.at || 0) > BROUILLON_MAX_MS) { localStorage.removeItem(CLE_BROUILLON); return; }
      // Hors rechargement, L'ADRESSE DIT CE QUE LA PERSONNE VIENT FAIRE, et elle l'emporte sur le brouillon (bug du
      // 2026-10-17 : le brouillon est écrit à chaque visite, connexion comprise ; repris tel quel, il rouvrait la connexion
      // quand on cliquait « Inscription », et le formulaire de connexion à la place de « Mot de passe oublié » (?oubli=1)).
      // On ne reprend donc qu'une inscription en cours, et seulement quand on revient s'inscrire : pas par « Connexion »
      // (/login seul), pas par « Mot de passe oublié », pas par un lien vers un AUTRE type de compte (« Devenir livreur »
      // après un brouillon de commerce). Le brouillon reste pour plus tard. Un rechargement reprend toujours.
      if (nav?.type !== 'reload') {
        if (b.champs?.mode !== 'register' || !audience || searchParams.get('oubli') === '1') return;
        if ((roleHint || audience) && b.champs?.role && b.champs.role !== role) return;
      }
      if (nav?.type !== 'reload' && b.champs?.mode === 'register') setBrouillonRepris(true);
      attenteBrouillon.current = { role: b.champs?.role ?? role, mode: b.champs?.mode ?? mode };
      for (const [cle, valeur] of Object.entries(b.champs || {})) champsBrouillon[cle]?.[1](valeur);
      if (b.champs?.mode === 'register' && Number(b.champs?.step) > 0) setMdpARetaper(true);
    } catch { /* stockage indisponible ou brouillon illisible : formulaire vierge */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const valeursBrouillon = Object.values(champsBrouillon).map((c) => c[0]);
  useEffect(() => {
    if (!brouillonRepris.current) return undefined;
    // Seulement une INSCRIPTION en cours (audit du 19/10, auth-31) : l'e-mail tapé pour se connecter sur un ordinateur
    // partagé restait 48 h dans le navigateur. Exception : un code d'activation attendu (pendingEmail), pour qu'un
    // rechargement rouvre l'écran du code.
    if (mode !== 'register' && !pendingEmail) return undefined;
    const minuteur = setTimeout(() => {
      try {
        const champs = Object.fromEntries(Object.entries(champsBrouillon).map(([cle, [valeur]]) => [cle, valeur]));
        localStorage.setItem(CLE_BROUILLON, JSON.stringify({ at: Date.now(), champs }));
      } catch { /* stockage plein ou indisponible */ }
    }, 250);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, valeursBrouillon);

  const { user, login, register, verifyEmail, resendCode, changePendingPhone, forgotPassword, confirmForgotPassword, loginWithGoogle, loginWithApple } = useAuth();
  // Déjà connecté EN ARRIVANT (et non pendant une connexion faite ici) : voir la redirection juste avant le rendu.
  const [connecteALArrivee] = useState(() => !!user);
  // Google ou Apple selon d'où vient le jeton. Apple n'a pas le nom dans son jeton : on envoie celui du formulaire
  // (prérempli par la feuille Apple à la première autorisation, saisi sinon).
  function connexionFed(fournisseur, jeton, roleChoisi, extra) {
    if (fournisseur === 'apple') return loginWithApple(jeton, roleChoisi, { givenName: firstName.trim() || undefined, familyName: lastName.trim() || undefined, ...extra });
    return loginWithGoogle(jeton, roleChoisi, { firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined, ...extra });
  }
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Arrivée ici via une action nécessitant un compte (ex. "+" sur une carte)
  // depuis une page publique — on revient y déposer le client une fois connecté, au lieu de le
  // renvoyer systématiquement à l'accueil (voir RestaurantMenu.jsx / RestaurantList.jsx).
  const from = location.state?.from || '/';

  // UN LIEN VERS CETTE PAGE QUAND ON Y EST DÉJÀ (fondateur, 2026-10-16) : « Connexion » ou « Inscription » de l'en-tête,
  // « Ajouter mon commerce » ou « Devenir livreur » du pied de page. Même chemin (/login) : la page n'est pas remontée,
  // et mode et rôle, lus dans l'adresse une seule fois à l'arrivée, ne suivaient pas — on cliquait « Connexion » et
  // l'inscription restait affichée. Chaque nouvelle navigation (location.key) relit donc l'adresse, repart de la
  // première étape et remonte en haut de la page.
  const derniereNavigation = useRef(location.key);
  useEffect(() => {
    if (derniereNavigation.current === location.key) return;
    derniereNavigation.current = location.key;
    const a = searchParams.get('audience');
    const r = searchParams.get('role');
    setMode(a ? 'register' : 'login');
    setRole(ROLES.some((x) => x.value === r) ? r : a === 'partner' ? 'restaurant' : 'client');
    setForgotMode(searchParams.get('oubli') === '1');
    setStep(0);
    remonterEnHaut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Arrivée après connexion : on attend (brièvement) que le code de la page suivante soit chargé avant de
  // naviguer, et le bouton reste en « Chargement… » jusque-là. Sans cela, le bouton redevenait actif pendant
  // que la page d'arrivée se téléchargeait en coulisse — sur mobile, on croyait que le toucher n'avait pas pris.
  async function allerApresConnexion(user) {
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans stockage */ }
    await attendrePage(from === '/' ? espaceApresConnexion(user) : from);
    navigate(from);
  }
  // Après une INSCRIPTION (compte créé, code vérifié), on arrive directement dans son espace — jamais sur la page de
  // connexion ni sur l'accueil (fondateur, 2026-09-18) : client → les commerces, commerce → tableau de bord, livreur →
  // espace livreur (où l'attend la vérification d'identité). `replace` : le bouton Retour ne ramène pas au formulaire.
  // Client : les commerces et non plus Mon compte (audit du 15/10/2026) — l'accueil de l'appli venait d'annoncer « N commerces
  // livrent chez toi », et le client tombait sur une page de réglages sans lien vers eux.
  async function allerApresInscription(user) {
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans stockage */ }
    // Exception : un CLIENT arrivé ici depuis une page précise (un commerce cliqué dans la liste, voir
    // RestaurantCard dans RestaurantList.jsx) y retourne — il s'est inscrit pour voir cette carte-là,
    // pas pour remplir son profil (fondateur, 2026-09-27).
    const cible = user?.role === 'restaurant' ? '/dashboard'
      : user?.role === 'driver' ? '/driver/onboarding'
      : from !== '/' ? from : '/restaurants';
    await attendrePage(cible);
    navigate(cible, { replace: true });
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
    identity: { title: t('auth.stepIdentityTitle'), sub: role === 'restaurant' ? t('auth.stepIdentitySubRestaurant') : t('auth.stepIdentitySub') },
    business: { title: t('auth.stepBusinessTitle'), sub: t('auth.stepBusinessSub') },
    documents: { title: t('auth.stepDocsTitle'), sub: t('auth.stepDocsSub') },
    /* POUR UN RESTAURATEUR, CETTE ADRESSE EST CELLE DU COMMERCE.
       L'écran s'annonçait « Ton adresse — celle du gérant, celle du commerce vient après ». C'était
       faux sur les deux points : construireCommerce() envoie ces quatre champs tels quels comme
       adresse du commerce, et rien ne vient après — il n'existe pas de second formulaire. D'où un
       restaurateur qui saisissait son adresse personnelle, et un commerce placé chez lui sur la carte.
       Le titre le dit donc explicitement pour ce rôle, et le sous-titre dit à quoi elle sert. */
    address: {
      title: role === 'restaurant' ? t('auth.stepAddressTitleRestaurant') : t('auth.stepAddressTitle'),
      sub: role === 'client' ? t('auth.stepAddressSubClient')
        : role === 'driver' ? t('auth.stepAddressSubDriver')
        : t('auth.stepAddressSubRestaurant')
    },
    details: { title: t('auth.stepDetailsTitle'), sub: t('auth.stepDetailsSub') },
    hours: { title: t('auth.stepHoursTitle'), sub: t('auth.stepHoursSub') },
    services: { title: t('auth.stepServicesTitle'), sub: t('auth.stepServicesSub') },
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
      if (role === 'restaurant') responsables.forEach((r, i) => {
        if (!r.name.trim() && !r.phone.trim()) return;
        if (!r.name.trim()) e[`resp${i}`] = t('auth.errManagerName');
        else if (r.phone.trim().replace(/\D/g, '').length < 8) e[`resp${i}`] = t('auth.errPhoneInvalid');
      });
      if (role === 'driver') {
        if (!courierStatus) e.courierStatus = t('auth.errCourierStatus');
        if (!vehicleType) e.vehicleType = t('auth.errVehicle');
        // Sac, autres plateformes, communes : plus demandés ici (12 oct. 2026), voir l'écran 2 plus bas.
        // Facultatif à l'inscription (audit UX du 15/10/2026) : le dossier l'exige avant envoi. Vérifié seulement s'il est donné.
        if (companyNumber.trim() && !bceValide(companyNumber)) { const why = raisonBce(companyNumber); e.companyNumber = why?.raison === 'longueur' ? t('auth.errCompanyNumberLength', { n: why.chiffres }) : why?.raison === 'prefixe' ? t('auth.errCompanyNumberPrefix') : t('auth.errCompanyNumberKey'); }
        if (courierStatus === 'student_independent') {
          if (schoolName.trim().length < 2) e.schoolName = required;
          if (!academicYear.trim()) e.academicYear = required;
          else if (!/^\d{4}(\s*[-/–]\s*\d{2,4})?$/.test(academicYear.trim())) e.academicYear = t('auth.errAcademicYear');
        }
      }
    }
    // « business » (fondateur, 2026-10-13) : le nom du commerce et son numéro sur place, saisis à la main — plus de recherche
    // par code postal, qui ne trouvait pas les commerces.
    if (key === 'business' && role === 'restaurant') {
      if (!nomCommerce.trim()) e.nomCommerce = required;
      if (!restoPhone.trim()) e.restoPhone = required;
      else if (restoPhone.trim().replace(/\D/g, '').length < 8) e.restoPhone = t('auth.errPhoneInvalid');
    }
    if (key === 'details') {
      if (!cuisine) e.cuisine = t('specialites.aucune');
      // NUMÉRO D'ENTREPRISE À L'INSCRIPTION (12 oct. 2026). Il était demandé plus tard, à « Configurer mes paiements » :
      // un écran et un enregistrement de plus au moment où l'on veut juste activer Stripe. Tapé ici, la BCE remplit la
      // dénomination et la TVA (effet plus haut), et les paiements ne demandent plus qu'un geste.
      if (!companyNumber.trim()) e.companyNumber = required;
      else if (!bceValide(companyNumber)) { const why = raisonBce(companyNumber); e.companyNumber = why?.raison === 'longueur' ? t('auth.errCompanyNumberLength', { n: why.chiffres }) : why?.raison === 'prefixe' ? t('auth.errCompanyNumberPrefix') : t('auth.errCompanyNumberKey'); }
      if (!legalName.trim()) e.legalName = required;
      if (!responsibleName.trim()) e.responsibleName = required;
      if (phoneSecondaryOuvert && phoneSecondary.trim() && phoneSecondary.trim().replace(/\D/g, '').length < 8) e.phoneSecondary = t('auth.errPhoneInvalid');
      if (emailSecondaryOuvert && emailSecondary.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailSecondary.trim())) e.emailSecondary = t('auth.errEmailSecondary');
    }
    if (key === 'hours') {
      if (!horairesNonVides(hours)) e.hours = t('auth.errHours');
      // Un service à une heure effacée : le serveur ne pouvait pas l'enregistrer et posait 11:00-22:00 à la place, sans rien
      // dire (audit du 19/10, CROSS-61). Même contrôle, service par service, que l'inscription dans l'app.
      else if (Object.values(hours).some((c) => Array.isArray(c) && c.some((sh) => !sh?.open || !sh?.close))) e.hours = t('auth.errHoursSlot');
      // La case « j'ai vérifié » vit ici : c'est le dernier écran qui montre du préremplissage, et elle
      // récapitule les trois sources (site, horaires, type) d'un seul geste.
      if ((hoursDepuisWeb || typeDepuisSite || siteTrouve) && !infosVerifiees) e.infosVerifiees = t('auth.errVerifyPrefill');
    }
    if (key === 'services') {
      if (!services.delivery && !services.pickup) e.services = t('auth.errServices');
    }
    if (key === 'address') {
      if (!addressStreet.trim()) e.addressStreet = required;
      if (!addressNumber.trim()) e.addressNumber = required;
      if (!addressPostalCode.trim()) e.addressPostalCode = required;
      else if (!codePostalValide(addressPostalCode)) e.addressPostalCode = t('auth.errPostalCode');
      if (!addressCity.trim()) e.addressCity = required;
      // Adresse non reconnue : on demande une confirmation plutôt que de bloquer.
      if (role === 'restaurant' && (recoEtat === 'none' || recoEtat === 'error') && !adresseConfirmee) e.addressConfirm = t('auth.errAddressConfirm');
    }
    if (key === 'account' && googleCredential) return e;
    if (key === 'account') {
      if (!email.trim()) e.email = required;
      // Même forme que le serveur (routes/auth.js, EMAIL_RE) : au moins deux lettres après le dernier point.
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = t('auth.errEmailInvalid');
      if (!password) e.password = required;
      else if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        e.password = t('auth.errPasswordStrength');
      }
    }
    return e;
  }

  const [verifDispo, setVerifDispo] = useState(false);
  /* Mot de passe vérifié par le serveur dès qu'on quitte le champ (même règle que l'inscription, fuites connues
     comprises) : le refus s'affiche tout de suite sous le champ (fondateur, 2026-09-25). Rend null si le mot de passe
     passe ou si le serveur ne répond pas (l'inscription tranchera), sinon 'forme' | 'fuite'. Mémorisé par valeur. */
  // La vérification EN COURS est mémorisée (promesse), pas seulement son résultat : quitter le champ puis cliquer
  // « Continuer » aussitôt n'envoie qu'un appel (l'API est limitée à 40 vérifications par quart d'heure).
  const verifMdp = useRef({ valeur: null, promesse: null });
  const motDePasseActuel = useRef(password);
  motDePasseActuel.current = password;
  function verifierMotDePasse(valeur) {
    if (!valeur) return Promise.resolve(null);
    if (valeur.length < 6 || !/[A-Z]/.test(valeur) || !/[a-z]/.test(valeur)) return Promise.resolve('forme');
    if (verifMdp.current.valeur === valeur && verifMdp.current.promesse) return verifMdp.current.promesse;
    const promesse = api('/auth/check-password', { method: 'POST', body: { password: valeur } })
      .then((r) => (r && r.ok === false ? (r.raison || 'forme') : null))
      .catch(() => { if (verifMdp.current.valeur === valeur) verifMdp.current = { valeur: null, promesse: null }; return null; });
    verifMdp.current = { valeur, promesse };
    return promesse;
  }
  async function controlerMotDePasseEnQuittant() {
    if (!password) return;
    const valeur = password;
    const raison = await verifierMotDePasse(valeur);
    // Le mot de passe a changé pendant la vérification : cette réponse ne le concerne plus.
    if (valeur !== motDePasseActuel.current) return;
    setErrors((prev) => {
      const { password: _ancien, ...reste } = prev;
      return raison ? { ...reste, password: t(raison === 'fuite' ? 'auth.errPasswordBreached' : 'auth.errPasswordStrength') } : reste;
    });
  }
  /* Un e-mail = un compte, un numéro de téléphone = un compte : le serveur applique la règle à
     l'inscription (409), mais on la vérifie déjà en quittant l'étape concernée pour que le refus
     s'affiche sous le champ fautif, pas après avoir tout rempli. Réseau indisponible : on laisse
     passer, l'inscription elle-même tranchera. */
  async function verifierDisponibilite(key) {
    const corps = key === 'identity' ? { phone: phone.trim() } : key === 'account' && !googleCredential ? { email: email.trim() } : null;
    if (!corps) return {};
    const e = {};
    // Mot de passe refusé par le serveur (fuites connues) : dit ICI, sous le champ, pas à la dernière étape.
    if (key === 'account' && !googleCredential) {
      const raison = await verifierMotDePasse(password);
      if (raison) e.password = t(raison === 'fuite' ? 'auth.errPasswordBreached' : 'auth.errPasswordStrength');
    }
    try {
      const r = await api('/auth/check-availability', { method: 'POST', body: corps });
      if (r.phoneValid === false) e.phone = t(r.phoneDoublePrefix ? 'auth.errPhoneDoublePrefix' : 'auth.errPhoneInvalid'); // audit du 19/10, auth-01
      if (r.phoneTaken) e.phone = t('auth.errPhoneTaken');
      if (r.emailValid === false) e.email = t('auth.errEmailInvalid');
      else if (r.emailReserved) e.email = t('auth.errEmailReserved');
      else if (r.emailTaken) e.email = t('auth.errEmailTaken');
      return e;
    } catch { return e; }
  }

  // Un double appui sur « Continuer » pendant la vérification de disponibilité (réseau lent) ne doit pas
  // faire sauter une étape : tant que la première demande n'est pas revenue, les suivantes sont ignorées.
  const verifEnCours = useRef(false);
  // Le premier champ en faute est amené à l'écran : sur téléphone, l'erreur d'un champ du haut restait hors de vue.
  function montrerPremiereErreur() {
    setTimeout(() => document.querySelector('.input-invalid, .field-error')?.scrollIntoView({ behavior: defilement(), block: 'center' }), 60);
  }
  /* CHAQUE ÉCRAN COMMENCE EN HAUT.
     Le changement d'étape ne remplace que le contenu du formulaire : la page, elle, garde la position
     de défilement. On appuyait donc sur « Continuer » en bas d'un écran long — les horaires, les
     services — et on arrivait au milieu du suivant, souvent sous son titre, sans rien pour dire qu'on
     avait changé d'étape. Les étapes remontent en haut avec remonterEnHaut (effet sur `step`, plus haut).
     Passer de « Connexion » à « Inscription » (ou l'inverse) aussi, et EN HAUT DE LA PAGE, titre compris (fondateur,
     2026-10-16) : avant, on amenait la carte du formulaire sous l'en-tête, et sur téléphone le titre restait au-dessus,
     hors de l'écran. */
  const modeAffiche = useRef(mode);
  useEffect(() => {
    if (modeAffiche.current === mode) return;
    modeAffiche.current = mode;
    remonterEnHaut();
  }, [mode]);

  async function goNext() {
    if (verifEnCours.current) return;
    setIncomplet(null);
    let e = validateStep(stepKey);
    setErrors(e);
    if (Object.keys(e).length) { montrerPremiereErreur(); return; }
    setVerifDispo(true); verifEnCours.current = true;
    try { e = await verifierDisponibilite(stepKey); } finally { setVerifDispo(false); verifEnCours.current = false; }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  }

  function goBack() {
    setErrors({}); setIncomplet(null);
    setStep((s) => Math.max(0, s - 1));
  }

  /* Erreur sous un champ. Le champ lui-même reçoit .input-invalid pour que le filet passe en
     rouge : la couleur seule ne suffirait pas (daltonisme), d'où le texte en plus. */
  function fieldError(name) {
    return errors[name] ? <p className="field-error" role="alert">{errors[name]}</p> : null;
  }

  const googleBtnRef = useRef(null);
  // Le script Google ne part qu'au clic sur « Continuer avec Google » (politique des cookies : « seulement si vous cliquez
  // dessus », fondateur 2026-10-14) ; le bouton officiel de Google, qui seul peut ouvrir sa fenêtre, prend alors sa place.
  const [googleDemande, setGoogleDemande] = useState(false);
  // Le choix du compte Google s'ouvre UNE fois, au clic qui charge le script — pas à chaque nouveau rendu du bouton.
  const googleInvite = useRef(false);
  const demanderGoogle = () => { googleInvite.current = true; setGoogleDemande(true); };
  const stateRef = useRef({ mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName });
  useEffect(() => { stateRef.current = { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName }; });

  async function handleGoogleCredential(response, fed = { fournisseur: 'google' }) {
    const { mode, role } = stateRef.current;
    if (mode === 'register') {
      /* ADRESSE GOOGLE DÉJÀ INSCRITE (audit du 19/10, auth-06). Le jeton n'était que gardé : on remplissait tout le
       * formulaire (commerce, horaires, adresse…), puis le serveur, trouvant le compte, ouvrait simplement l'ancien et
       * laissait tomber le nouveau rôle et tout ce qui avait été tapé, sans un mot. On le dit maintenant DÈS le clic,
       * avant le formulaire : la connexion s'ouvre, l'adresse remplie. Rien de ce qui a été tapé n'est effacé (il reste
       * dans l'onglet « Inscription »). Un ajout de rôle se fait ensuite dans Mon compte. Réseau indisponible : on laisse
       * continuer, comme les autres vérifications de disponibilité. */
      const adresse = decoderJwt(response.credential).email;
      if (adresse) {
        try {
          const r = await api('/auth/check-availability', { method: 'POST', body: { email: adresse } });
          if (r?.emailTaken) {
            setEmail(adresse); setMode('login');
            toast(t('auth.googleAccountExists'));
            return;
          }
        } catch { /* l'inscription tranchera */ }
      }
      retenirGoogle(response.credential, fed);
      setStep((s) => (s === 0 ? 1 : s));
      return;
    }
    setLoading(true);
    let reussi = false;
    try {
      const data = fed.fournisseur === 'apple'
        ? await loginWithApple(response.credential, role, { givenName: fed.prenom || undefined, familyName: fed.nom || undefined })
        : await loginWithGoogle(response.credential, role, {});
      reussi = true;
      toast(t('auth.welcome', { name: data.user.name }), 'succes');
      await allerApresConnexion(data.user);
    } catch (err) {
      if (err.message === 'PHONE_NOT_VERIFIED') {
        // Inscription Google / Apple faite, code SMS jamais saisi : l'écran du code (« Renvoyer » y est). Le jeton est gardé
        // en mémoire : il prouve le compte si le numéro est à changer (auth-03).
        setPreuveCode({ fournisseur: fed.fournisseur || 'google', jeton: response.credential });
        setPendingEmail(err.data?.email || ''); setPendingChannel('sms'); setPendingPhone(err.data?.phoneMasked || '');
      } else if (err.message === 'INCOMPLETE_PROFILE') {
        // Pas encore de compte pour cette adresse Google : on enchaîne sur l'inscription, profil prérempli.
        retenirGoogle(response.credential, fed);
        setMode('register');
        toast(t('auth.googleNewAccount'));
      } else if (err.code === 'TOTP_REQUIRED') {
        // Compte Google protégé par un second facteur : on ouvre le champ du code, le formulaire renverra
        // le jeton Google avec lui (voir googleEnAttente2fa).
        setGoogleEnAttente2fa(response.credential);
        setFournisseurFed(fed.fournisseur || 'google');
        setTotpAttendu(true);
      } else {
        toast(err.message, 'erreur');
      }
    } finally {
      // Connexion réussie : le bouton reste en « Chargement… » jusqu'au changement de page.
      if (!reussi) setLoading(false);
    }
  }

  // Création du compte via Google, à la dernière étape, avec tout ce que le formulaire a recueilli.
  async function inscrireViaGoogle() {
    const data = await connexionFed(fournisseurFed, googleCredential, role, {
      phone: phone.trim(),
      referralCode: referralCode.trim() || undefined,
      ...(role === 'restaurant' ? {} : { addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim() }),
      ...(role === 'restaurant' ? {
        legalName: legalName.trim(), companyNumber: companyNumber.trim(),
        vatNumber: tvaInscription(), responsibleName: responsibleName.trim(), cuisine: cuisineFinale,
        business: construireCommerce()
      } : {}),
      ...(role === 'driver' ? { companyNumber: companyNumber.trim(), courierStatus, schoolName: schoolName.trim(), academicYear: academicYear.trim(), vehicleType, bagOption, worksOtherPlatforms: autrePlateforme === 'yes' ? true : autrePlateforme === 'no' ? false : undefined, otherPlatforms: autrePlateforme === 'yes' ? plateformes : [], otherPlatformNote: autrePlateforme === 'yes' && plateformes.includes('autre') ? plateformeAutre.trim() : '', preferredZones: zonesPreferees.length ? zonesPreferees : communeDeLAdresse() } : {}),
      ...(accepteCgu ? { acceptTerms: true, termsVersion: versionCgu || undefined } : {}),
      ...(role === 'client' ? { marketingConsent: nouvellesOui } : refusNouvelles ? { marketingOptOut: true } : {})
    });
    suivre(role === 'restaurant' ? 'inscription_restaurant' : role === 'driver' ? 'candidature_livreur' : 'inscription_client');
    // Le téléphone se prouve par SMS, Google et Apple compris (fondateur, 18/10/2026) : le même écran du code qu'au mot de passe.
    if (data.needsVerification) {
      setPendingEmail(data.email);
      setPendingChannel(data.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(data.phoneMasked || phone.trim());
      toast(t(data.channel === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
      return false;
    }
    toast(t('auth.welcome', { name: data.user.name }), 'succes');
    // Une inscription, même par Google, arrive dans son espace (tableau de bord, dossier livreur) — pas sur l'accueil.
    await allerApresInscription(data.user);
    return true;
  }

  /* Le script Google n'est plus dans index.html : c'est CETTE page qui le demande, au moment d'en
   * avoir besoin (voir src/googleSignIn.js pour le pourquoi). La boucle de sondage toutes les 200 ms
   * qui attendait window.google disparaît avec lui — le chargeur rend une promesse, donc on sait
   * exactement quand l'API est prête, sans réveiller le navigateur dix fois pour rien.
   *
   * Si le script ne se charge pas (bloqueur, réseau, Google injoignable), on ne dessine simplement
   * pas le bouton : le formulaire e-mail/mot de passe juste à côté reste la voie normale, et afficher
   * une erreur pour un moyen de connexion secondaire n'aiderait personne. */
  useEffect(() => {
    // Dans l'application, pas de bouton Google du site (refusé dans une WebView) : BoutonsConnexionNative le remplace.
    if (!GOOGLE_CLIENT_ID || estNatif() || !googleDemande) return;
    let cancelled = false;
    chargerGoogleSignIn()
      .then((gsi) => {
        if (cancelled || !googleBtnRef.current) return;
        googleBtnRef.current.innerHTML = '';
        gsi.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, use_fedcm_for_prompt: true });
        // `locale` : sans lui, Google écrit le bouton dans la langue du NAVIGATEUR, pas celle choisie sur le site
        // (« Inloggen met Google » sur la page française — test du 6 oct. 2026).
        gsi.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: 320, text: mode === 'register' ? 'signup_with' : 'signin_with', locale: language
        });
        // UN CLIC AU LIEU DE DEUX (audit du 18/10/2026) : notre bouton ne faisait que charger le script, puis il fallait
        // toucher celui de Google. Le même clic ouvre maintenant le choix du compte (FedCM / One Tap) ; si le navigateur
        // ne l'affiche pas (cookies tiers bloqués, refus récent), le bouton officiel ci-dessus reste là.
        if (googleInvite.current) { googleInvite.current = false; try { gsi.prompt(); } catch { /* le bouton suffit */ } }
      })
      .catch(() => { /* bouton Google absent, le reste de la page fonctionne */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stepKey, googleCredential, language, googleDemande]);

  // Application : la feuille native d'Apple ou de Google, puis exactement le chemin du bouton Google du site.
  // Une annulation par la personne n'est pas une erreur à afficher.
  async function connexionNative(fournisseur) {
    let fed;
    try {
      fed = await connexionFournisseur(fournisseur);
    } catch (err) {
      // Le texte brut du greffon (« com.google.android.gms…: 10: ») n'est plus collé au message (audit du 19/10, CROSS-13) : il
      // part dans la console (adb logcat) ; un refus du serveur (ApiError, avec un statut) garde son propre texte, traduit.
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) {
        if (!err?.status) console.error('Connexion native :', err);
        toast(err?.status && err?.message ? err.message : t('appli.nativeLoginFailed'), 'erreur');
      }
      return;
    }
    await handleGoogleCredential({ credential: fed.jeton }, fed);
  }

  // Arrivée depuis l'accueil de l'application (pages/app/Bienvenue.jsx) avec un jeton Apple ou Google déjà obtenu :
  // on le traite une fois, comme si le bouton avait été touché ici — pas de second geste à demander.
  const fedRecu = useRef(false);
  useEffect(() => {
    const fed = location.state?.fed;
    if (!fed?.jeton || fedRecu.current) return;
    fedRecu.current = true;
    handleGoogleCredential({ credential: fed.jeton }, fed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    // À l'inscription, ce sont les étapes qui valident (ci-dessous) : un e-mail ou un mot de passe manquant
    // ramène à l'étape « compte » avec le champ en rouge, au lieu d'un simple message générique.
    // Connexion Google d'un compte à double authentification (googleEnAttente2fa) : ni e-mail ni mot de passe à exiger, seul
    // le code compte. Sans cette exception, « Se connecter » répondait « Email et mot de passe requis » à chaque fois
    // (audit du 19/10, auth-19).
    setErreurConnexion('');
    if (mode === 'login' && !googleEnAttente2fa && (!email || !password)) { setErreurConnexion(t('auth.errEmailPassword')); toast(t('auth.errEmailPassword'), 'erreur'); return; }
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
          // Brouillon repris : seul le mot de passe manque, et son champ est sur cette dernière étape (LIVE-13). On y reste.
          if (steps[i] === 'account' && mdpARetaper && step > 0 && !googleCredential && Object.keys(e).length === 1 && e.password) {
            setErrors(e);
            montrerPremiereErreur();
            setLoading(false);
            return;
          }
          if (Object.keys(e).length > 0) {
            setStep(i);
            setErrors(e);
            setIncomplet({ step: i, n: Object.keys(e).length });
            const titres = { account: 'stepAccountTitle', identity: 'stepIdentityTitle', business: 'stepBusinessTitle', details: 'stepDetailsTitle', hours: 'stepHoursTitle', services: 'stepServicesTitle', documents: 'stepDocsTitle', address: 'stepAddressTitle' };
            toast(t('auth.checkIncomplete', { n: Object.keys(e).length, step: t(`auth.${titres[steps[i]]}`) }));
            montrerPremiereErreur();
            setLoading(false);
            return;
          }
        }
        if (role === 'restaurant' && !accepteEngagements) {
          toast(t('auth.engagementsRequired'), 'erreur');
          setLoading(false);
          return;
        }
        if (role === 'client' && !accepteCgu) {
          toast(t('conformite.toastTermsRequired'), 'erreur');
          setLoading(false);
          return;
        }
        // Plus de demande de position à la création du compte livreur (audit UX du 15/10/2026) : elle venait des semaines avant
        // la première course et avant la lecture de la politique de géolocalisation. Elle est demandée là où elle sert, au-dessus
        // de la liste des courses, avec son explication (components/livreur/PositionRequise.jsx).
        if (googleCredential) {
          try {
            reussi = await inscrireViaGoogle();
          } catch (err) {
            // Jeton Google expiré (il vit une heure) ou refusé : on repart de la première étape.
            if (/google|token|jeton|expir/i.test(err.message || '') && err.message !== 'INCOMPLETE_PROFILE') { oublierGoogle(); setStep(0); toast(t('auth.googleExpired'), 'erreur'); }
            // Profil refusé par le serveur : on affiche sa raison (« numéro d'entreprise requis »…), pas le code interne.
            else if (err.message === 'INCOMPLETE_PROFILE') toast(err.data?.detail || t('auth.errGoogleIncomplete'), 'erreur');
            else throw err;
          }
          return;
        }
        const data = await register({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role,
          phone: phone.trim(),
          referralCode: referralCode.trim() || undefined,
          ...(role === 'restaurant' ? {} : { addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim() }),
          ...(role === 'restaurant' ? {
            legalName: legalName.trim(), companyNumber: companyNumber.trim(),
            vatNumber: tvaInscription(), responsibleName: responsibleName.trim(), cuisine: cuisineFinale,
            business: construireCommerce()
          } : {}),
          ...(role === 'driver' ? { companyNumber: companyNumber.trim(), courierStatus, schoolName: schoolName.trim(), academicYear: academicYear.trim(), vehicleType, bagOption, worksOtherPlatforms: autrePlateforme === 'yes' ? true : autrePlateforme === 'no' ? false : undefined, otherPlatforms: autrePlateforme === 'yes' ? plateformes : [], otherPlatformNote: autrePlateforme === 'yes' && plateformes.includes('autre') ? plateformeAutre.trim() : '', preferredZones: zonesPreferees.length ? zonesPreferees : communeDeLAdresse() } : {}),
          ...(accepteCgu ? { acceptTerms: true, termsVersion: versionCgu || undefined } : {}),
          ...(role === 'client' ? { marketingConsent: nouvellesOui } : refusNouvelles ? { marketingOptOut: true } : {}),
          website: siteWeb
        });
        // Statistiques (sans donnée personnelle) : une inscription par type de compte.
        suivre(role === 'restaurant' ? 'inscription_restaurant' : role === 'driver' ? 'candidature_livreur' : 'inscription_client');
        if (data.needsVerification) {
          setPendingEmail(data.email);
          setPendingChannel(data.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(data.phoneMasked || phone.trim());
          toast(t(data.channel === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
        } else if (data.token) {
          toast(t('auth.welcome', { name: data.user.name }), 'succes');
          await allerApresInscription(data.user);
        }
      } else if (googleEnAttente2fa) {
        const data = await connexionFed(fournisseurFed, googleEnAttente2fa, role, { totpCode: totpCode.trim() });
        reussi = true;
        setGoogleEnAttente2fa(null);
        toast(t('auth.welcome', { name: data.user.name }), 'succes');
        await allerApresConnexion(data.user);
      } else {
        const data = await login(email.trim(), password, totpCode.trim() || undefined);
        reussi = true;
        toast(t('auth.welcome', { name: data.user.name }), 'succes');
        await allerApresConnexion(data.user);
      }
    } catch (err) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        // Code de l'inscription ENCORE VALABLE (codeActif, audit du 19/10, auth-02) : l'écran du code, sans SMS de plus —
        // celui que la personne a reçu marche. Expiré : on en envoie un neuf plutôt que d'ouvrir un écran qui attend un code
        // que la personne n'a plus. Le canal (SMS ou e-mail) vient de la réponse.
        if (err.data?.codeActif) {
          setPendingChannel(err.data.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(err.data.phoneMasked || '');
          setPendingEmail(email.trim());
          toast(t('auth.codeStillValid'));
          return;
        }
        let canal = null;
        try { canal = await resendCode(email.trim()); } catch { /* plafond atteint ou réseau : le bouton « Renvoyer » reste là */ }
        setPendingChannel(canal?.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(canal?.phoneMasked || '');
        setPendingEmail(email.trim());
        toast(t(canal?.channel === 'sms' ? 'auth.errVerificationSentSms' : canal ? 'auth.errVerificationSent' : 'auth.errEmailNotVerified'), canal ? undefined : 'erreur');
      } else if (err.code === 'TOTP_REQUIRED') {
        // Mot de passe bon, second facteur attendu : on ouvre le champ sans rien dire d'alarmant.
        setTotpAttendu(true);
      } else if (err.code === 'TOTP_INVALID' || err.code === 'TOTP_REPLAY') {
        // Le champ reste ouvert, on vide la saisie : un code périmé se retape, il ne se corrige pas.
        setTotpAttendu(true);
        setTotpCode('');
        setErreurConnexion(err.message);
        toast(err.message, 'erreur');
      } else if (err.code === 'ACCOUNT_DELETED' || err.code === 'NO_ACCOUNT') {
        // Compte supprimé ou inexistant : on le dit, et on ouvre directement la création de compte (e-mail conservé).
        toast(t(err.code === 'ACCOUNT_DELETED' ? 'auth.errAccountDeleted' : 'auth.errNoAccount'));
        setMode('register');
      } else if (err.field === 'password' || err.code === 'PASSWORD_BREACHED' || err.code === 'PASSWORD_WEAK') {
        // Tout ce qui a été saisi reste en place (commerce, horaires, services…) : seul le mot de passe est à refaire.
        const message = t(err.code === 'PASSWORD_BREACHED' ? 'auth.errPasswordBreached' : 'auth.errPasswordStrength');
        setPassword(''); verifMdp.current = { valeur: null, promesse: null };
        setErrors({ password: message });
        const i = steps.indexOf('account');
        // Brouillon repris : le champ du mot de passe est sur la dernière étape, on y reste (LIVE-13).
        if (i >= 0 && !(mdpARetaper && step > 0)) setStep(i);
        toast(t('auth.errPasswordRetry'), 'erreur');
        montrerPremiereErreur();
      } else if (err.field === 'phone' || err.field === 'email') {
        // Le code dit ce qui ne va pas (routes/auth.js) ; sans code connu, le message du serveur, déjà traduit. Avant,
        // toute erreur d'e-mail s'affichait « déjà pris », et le téléphone se reconnaissait au mot français « invalide ».
        const MESSAGES = { EMAIL_TAKEN: 'auth.errEmailTaken', EMAIL_INVALID: 'auth.errEmailInvalid', EMAIL_RESERVED: 'auth.errEmailReserved', PHONE_TAKEN: 'auth.errPhoneTaken', PHONE_INVALID: 'auth.errPhoneInvalid' };
        const message = MESSAGES[err.code] ? t(MESSAGES[err.code]) : err.message;
        setErrors({ [err.field]: message });
        const i = steps.indexOf(err.field === 'phone' ? 'identity' : 'account');
        if (i >= 0) setStep(i);
        toast(message);
      } else {
        if (mode === 'login') setErreurConnexion(err.message);
        toast(err.message, 'erreur');
      }
    } finally {
      if (!reussi) setLoading(false);
    }
  }

  /* COMPTE DÉJÀ CONFIRMÉ AILLEURS (revue du 24/10) : code tapé dans l'app ou un autre onglet, réponse perdue. Le serveur
   * répond ALREADY_VERIFIED à chaque code et l'écran restait bloqué. C'est une réussite : avec le mot de passe encore en
   * mémoire, on connecte ; sinon retour au formulaire de connexion, adresse remplie, avec le message du serveur. */
  async function compteDejaConfirme(err) {
    const adresse = pendingEmail;
    if (password && adresse) {
      try {
        const data = await login(adresse, password);
        toast(t('auth.welcome', { name: data.user.name }), 'succes');
        await allerApresInscription(data.user);
        return true;
      } catch { /* second facteur, mot de passe changé : le formulaire de connexion s'en charge */ }
    }
    setPendingEmail(''); setCode(''); setErreurCode(''); setChangerNumero(false); setPreuveCode(null);
    setEmail(adresse); setMode('login');
    toast(err.message);
    return false;
  }

  async function submitCode(e) {
    e.preventDefault();
    setErreurCode('');
    if (!code.trim()) { toast(t('auth.errCodeRequired'), 'erreur'); return; }
    setLoading(true);
    let reussi = false;
    try {
      const data = await verifyEmail(pendingEmail, code.trim());
      reussi = true;
      toast(t('auth.welcome', { name: data.user.name }), 'succes');
      await allerApresInscription(data.user);
    } catch (err) {
      if (err.code === 'ALREADY_VERIFIED') { reussi = await compteDejaConfirme(err); return; }
      setErreurCode(err.message);
      toast(err.message, 'erreur');
      reussi = false;
    } finally {
      if (!reussi) setLoading(false);
    }
  }

  async function submitForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast(t('auth.errEmailRequired'), 'erreur'); return; }
    setForgotLoading(true);
    try {
      const r = await forgotPassword(forgotEmail.trim());
      // Adresse jamais confirmée : d'abord le code reçu à l'adresse, puis le lien (fondateur, 18/10/2026).
      if (r?.confirmationRequired) { setForgotCode(''); setForgotCodeStep(true); return; }
      setForgotSubmitted(true);
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setForgotLoading(false);
    }
  }

  async function submitForgotCode(e) {
    e.preventDefault();
    if (!forgotCode.trim()) { toast(t('auth.errCodeRequired'), 'erreur'); return; }
    setForgotLoading(true);
    try {
      await confirmForgotPassword(forgotEmail.trim(), forgotCode.trim());
      setForgotCodeStep(false); setForgotCode(''); setForgotSubmitted(true);
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setForgotLoading(false);
    }
  }

  async function renvoyerCodeOubli() {
    setResending(true);
    try { await forgotPassword(forgotEmail.trim()); setForgotCode(''); toast(t('auth.newCodeSent')); }
    catch (err) { toast(err.message, 'erreur'); }
    finally { setResending(false); }
  }

  // canal 'email' : « Recevoir le code par e-mail », quand le SMS n'arrive pas (22/10/2026).
  async function handleResend(canal) {
    setResending(true);
    try {
      const r = await resendCode(pendingEmail, canal);
      if (r?.channel) { setPendingChannel(r.channel === 'sms' ? 'sms' : 'email'); if (r.phoneMasked) setPendingPhone(r.phoneMasked); }
      setCode(''); setErreurCode('');
      lancerAttenteRenvoi(DELAI_RENVOI_S);
      toast(t(r?.channel === 'sms' ? 'auth.errVerificationSentSms' : r?.channel === 'email' ? 'auth.errVerificationSent' : 'auth.newCodeSent'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setResending(false);
    }
  }

  // « Changer de numéro » (audit du 19/10, auth-03) : un code part au bon numéro, l'ancien ne vaut plus. Sans mot de passe en
  // mémoire ni jeton (page rechargée), on le demande.
  const preuveNumero = preuveCode || (googleCredential ? { fournisseur: fournisseurFed, jeton: googleCredential } : null);
  async function envoyerNouveauNumero(e) {
    e.preventDefault();
    const requis = t('auth.errFieldRequired');
    const manque = {};
    if (!nouveauNumero.trim()) manque.phone = requis;
    if (!preuveNumero && !password) manque.password = requis;
    setErreursNumero(manque);
    if (Object.keys(manque).length) return;
    setResending(true);
    try {
      const r = await changePendingPhone(pendingEmail, nouveauNumero.trim(), { password, preuve: preuveNumero });
      setPendingChannel(r?.channel === 'sms' ? 'sms' : 'email'); setPendingPhone(r?.phoneMasked || nouveauNumero.trim());
      // Le formulaire garde le bon numéro : une nouvelle inscription repartirait avec lui.
      setPhone(nouveauNumero.trim());
      setCode(''); setErreurCode(''); setChangerNumero(false);
      lancerAttenteRenvoi(DELAI_RENVOI_S);
      toast(t(r?.channel === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
    } catch (err) {
      const MESSAGES = { PHONE_TAKEN: 'auth.errPhoneTaken', PHONE_INVALID: 'auth.errPhoneInvalid', PHONE_DOUBLE_PREFIX: 'auth.errPhoneDoublePrefix' };
      if (err.code === 'ALREADY_VERIFIED') await compteDejaConfirme(err);
      else if (err.field === 'phone') setErreursNumero({ phone: MESSAGES[err.code] ? t(MESSAGES[err.code]) : err.message });
      else if (err.code === 'BAD_CREDENTIALS' && !preuveNumero) setErreursNumero({ password: err.message });
      else toast(err.message, 'erreur');
    } finally {
      setResending(false);
    }
  }

  // Décor et en-tête suivent le rôle choisi, pas seulement l'adresse d'arrivée : changer de type de compte
  // change le contexte affiché.
  const decorClass = mode === 'register' ? (role === 'client' ? 'client' : 'partner') : (audience === 'partner' ? 'partner' : audience === 'client' ? 'client' : '');

  // DÉJÀ CONNECTÉ QUAND ON OUVRE /login (fondateur, 2026-10-17) : la page montrait l'ancien en-tête des visiteurs avec
  // « Se déconnecter » au-dessus d'un formulaire de connexion inutile. On va directement dans son espace (ou là où l'on
  // voulait aller). Seulement si la session existait à l'arrivée : une connexion ou une inscription faite ICI garde sa
  // propre suite (code de vérification, retour au commerce touché…).
  if (connecteALArrivee && user) {
    // « Devenir livreur » / « Ajouter mon commerce » ouvert connecté (audit du 19/10, auth-17) : si le compte n'a pas encore ce
    // rôle, on le dit et on mène à « Mes casquettes » (Mon compte), au lieu de son espace sans un mot.
    const voulu = audience === 'partner' ? (roleHint === 'driver' ? 'driver' : 'restaurant') : null;
    const sesRoles = user.roles?.length ? user.roles : [user.role];
    if (voulu && !sesRoles.includes(voulu)) return <RedirectionRole role={voulu} />;
    return <Navigate to={location.state?.from || espaceApresConnexion(user)} replace />;
  }

  if (forgotMode) {
    return (
      <CadreConnexion decorClass={decorClass} titre={t('siteCadre.oubliTitre')} sous={t('siteCadre.oubliSous')}>
        <div className="auth-site-form">
          {forgotCodeStep ? (
            <>
              <h2 style={{ marginTop: 0 }}>{t('auth.forgotConfirmTitle')}</h2>
              <p className="small" style={{ marginBottom: 14 }}>{t('auth.forgotConfirmText', { email: forgotEmail.trim() })}</p>
              <form onSubmit={submitForgotCode}>
                <div className="field">
                  <label htmlFor="auth-f-oubli-code">{t('auth.verifyCodeLabel')}</label>
                  <input id="auth-f-oubli-code"
                    value={forgotCode} onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                    inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
                    maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
                  />
                </div>
                <button type="submit" className="btn-gold btn-block" disabled={forgotLoading || forgotCode.length !== 6}>
                  {forgotLoading ? t('common.loading') : t('auth.forgotConfirmBtn')}
                </button>
              </form>
              <button className="btn-ghost" style={{ marginTop: 10 }} disabled={resending} onClick={renvoyerCodeOubli}>
                {resending ? t('common.loading') : t('auth.resendCode')}
              </button>
              <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setForgotCodeStep(false); setForgotCode(''); }}>
                {t('auth.back')}
              </button>
            </>
          ) : <h2 style={{ marginTop: 0 }}>{t('auth.forgotTitle')}</h2>}
          {forgotCodeStep ? null : forgotSubmitted ? (
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
                  <input id="auth-f-1" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder={t('auth.phEmail')} />
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
      </CadreConnexion>
    );
  }

  if (pendingEmail) {
    return (
      <CadreConnexion decorClass={decorClass} titre={t('siteCadre.codeTitre')} sous={t('siteCadre.codeSous')}>
        <div className="auth-site-form">
          <h2 style={{ marginTop: 0 }}>{t(pendingChannel === 'sms' ? 'auth.verifyTitleSms' : 'auth.verifyTitle')}</h2>
          <p className="small" style={{ marginBottom: 14 }}>
            {pendingChannel === 'sms' ? t('auth.verifyTextSms', { phone: pendingPhone }) : t('auth.verifyText', { email: pendingEmail })}
          </p>
          <form onSubmit={submitCode}>
            <div className="field">
              <label htmlFor="auth-f-2">{t('auth.verifyCodeLabel')}</label>
              <input id="auth-f-2"
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErreurCode(''); }} placeholder="123456"
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" className={erreurCode ? 'input-invalid' : undefined}
                maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
              />
              {/* Chiffres seulement (audit du 19/10, auth-16) : « 123 456 » collé gardait l'espace et perdait le dernier chiffre. */}
              {erreurCode && <p className="field-error" role="alert">{erreurCode}</p>}
            </div>
            {/* Six chiffres avant d'envoyer (audit du 19/10, LIVE-28) : un code incomplet partait au serveur pour « Code incorrect ». */}
            <button type="submit" className="btn-gold btn-block" disabled={loading || code.length !== 6}>
              {loading ? t('common.loading') : t('auth.confirm')}
            </button>
          </form>
          <button className="btn-ghost" style={{ marginTop: 10 }} disabled={resending || attenteRenvoi > 0} onClick={() => handleResend()}>
            {resending ? t('common.loading') : attenteRenvoi > 0 ? t('auth.resendIn', { s: attenteRenvoi }) : t('auth.resendCode')}
          </button>
          {/* Le SMS peut se perdre après le fournisseur, sans erreur pour nous (22/10/2026). Dernier recours, en deux temps
              (fondateur) : « Je n'ai pas reçu le SMS », puis le code par e-mail après un décompte VISIBLE (DELAI_CODE_EMAIL_S) ;
              l'ancien bouton, désactivé sans le dire pendant l'attente de « Renvoyer », semblait ne pas marcher (22/10). */}
          {pendingChannel === 'sms' && (!smsPasRecu ? (
            <button className="btn-ghost" style={{ marginTop: 4 }} disabled={resending} onClick={() => { setSmsPasRecu(true); lancerAttenteEmail(DELAI_CODE_EMAIL_S); }}>
              {t('auth.smsPasRecu')}
            </button>
          ) : (
            <>
              <p className="small" style={{ margin: '8px 0 0', textAlign: 'center' }}>{t('auth.smsPasRecuAide')}</p>
              <button className="btn-ghost" style={{ marginTop: 4 }} disabled={resending || attenteEmail > 0} onClick={() => handleResend('email')}>
                {attenteEmail > 0 ? t('auth.codeByEmailIn', { s: attenteEmail }) : t('auth.codeByEmail')}
              </button>
            </>
          ))}
          {/* Un numéro mal tapé : on le corrige ici, depuis l'inscription comme depuis la connexion (audit du 19/10, auth-03). */}
          {changerNumero ? (
            <form onSubmit={envoyerNouveauNumero} style={{ marginTop: 14 }} noValidate>
              <h3 style={{ margin: '0 0 4px' }}>{t('auth.changePhoneTitle')}</h3>
              <p className="small" style={{ marginBottom: 10 }}>{t('auth.changePhoneText')}</p>
              <div className="field">
                <label htmlFor="auth-f-nouveau-tel">{t('auth.phone')}</label>
                <PhoneInput id="auth-f-nouveau-tel" value={nouveauNumero} onChange={setNouveauNumero} invalid={!!erreursNumero.phone} />
                {erreursNumero.phone && <p className="field-error" role="alert">{erreursNumero.phone}</p>}
              </div>
              {!preuveNumero && (
                <div className="field">
                  <label htmlFor="auth-f-tel-mdp">{t('auth.changePhonePassword')}</label>
                  <PasswordInput id="auth-f-tel-mdp" value={password} invalid={!!erreursNumero.password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
                  {erreursNumero.password && <p className="field-error" role="alert">{erreursNumero.password}</p>}
                </div>
              )}
              <button type="submit" className="btn-gold btn-block" disabled={resending}>
                {resending ? t('common.loading') : t('auth.changePhoneSend')}
              </button>
            </form>
          ) : (
            <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setNouveauNumero(phone); setErreursNumero({}); setChangerNumero(true); }}>
              {t('auth.changePhone')}
            </button>
          )}
          <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setPendingEmail(''); setCode(''); setChangerNumero(false); setPreuveCode(null); }}>
            {t('auth.back')}
          </button>
        </div>
      </CadreConnexion>
    );
  }

  /* Le titre de la moitié iris. Le bandeau « Espace client » + accroche qui surmontait la carte a disparu de l'inscription :
     il redisait le sélecteur de rôle et poussait le premier champ hors de l'écran sur un téléphone. Il ne reste que pour qui
     arrive par un lien d'audience (?pour=commerce) sans s'inscrire, où il sert d'accueil — c'est maintenant ce titre. */
  const titreIris = mode === 'register'
    ? t(role === 'restaurant' ? 'siteCadre.inscriptionCommerce' : role === 'driver' ? 'siteCadre.inscriptionLivreur' : 'siteCadre.inscriptionClient')
    : audience ? <AvecMarque>{role === 'client' ? t('auth.clientHeading') : t('auth.partnerHeading')}</AvecMarque> : t('siteCadre.connexionTitre');
  return (
    <CadreConnexion
      decorClass={decorClass}
      titre={titreIris}
      // Mur de compte d'un commerce (audit du 19/10, LIVE-23) : on dit pourquoi on est là, avec le nom du commerce touché
      // (murCompte.js, lienFiche). Sinon, comme avant.
      sous={location.state?.commerce ? t('auth.wallShop', { name: location.state.commerce }) : mode === 'login' && !audience ? t('siteCadre.connexionSous') : null}
      long={mode === 'register'}
    >
      <div className="auth-site-form">
        {/* Connexion / Inscription : un sélecteur à pouce iris qui glisse (site-cadre.css, .auth-segment). */}
        <div className={`auth-segment${mode === 'register' ? ' auth-segment--droite' : ''}`} role="tablist" aria-label={t('siteCadre.choixConnexion')}>
          <span className="auth-segment-pouce" aria-hidden="true" />
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>{t('nav.login')}</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>{t('nav.register')}</button>
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

            {brouillonReprisVisible && (
              <div className="auth-brouillon" role="status">
                <span className="small">{t('auth.draftResumed')}</span>
                <button type="button" className="btn-ghost btn-sm" onClick={recommencer}>{t('auth.draftRestart')}</button>
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
                      <div style={{ fontWeight: 700 }}><Icone nom="compte" taille={16} className="icone-texte" />{' '}{firstName} {lastName}</div>
                      <div className="small">{email} · {t('auth.fromGoogle')}</div>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setNomModifiable(true)}>{t('auth.edit')}</button>
                  </div>
                ) : (
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-3">{t('auth.firstName')}</label>
                    <input id="auth-f-3" className={errors.firstName ? 'input-invalid' : undefined}
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    {fieldError('firstName')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-4">{t('auth.lastName')}</label>
                    <input id="auth-f-4" className={errors.lastName ? 'input-invalid' : undefined}
                      value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                    {fieldError('lastName')}
                  </div>
                </div>
                )}
                <div className="field">
                  <label htmlFor="auth-f-7">{role === 'restaurant' ? t('auth.phoneOwner') : t('auth.phone')}</label>
                  {/* Pays (UE, Belgique par défaut) + numéro local : la valeur envoyée est internationale (+32 470…). */}
                  <PhoneInput id="auth-f-7" value={phone} onChange={setPhone} invalid={!!errors.phone} />
                  {role === 'restaurant' && <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('auth.phoneOwnerHelp')}</p>}
                  {fieldError('phone')}
                </div>
                {role === 'restaurant' && (
                  <div className="field responsables" role="group" aria-labelledby="auth-resp-titre">
                    <span className="titre-groupe" id="auth-resp-titre">{t('auth.managersTitle')}</span>
                    <p className="small" style={{ margin: '0 0 6px' }}>{t('auth.managersHelp')}</p>
                    {responsables.map((r, i) => (
                      <div key={i} className="contact-second" style={{ marginBottom: 8 }}>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <input style={{ flex: 1 }} aria-label={t('auth.managerName')} placeholder={t('auth.managerNamePh')} value={r.name}
                            onChange={(e) => setResponsables((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setResponsables((l) => l.filter((_, j) => j !== i))} aria-label={t('auth.managerRemoveA11y', { n: i + 1 })}>{t('auth.removeSecond')}</button>
                        </div>
                        {/* Le téléphone du responsable a un nom, et « Retirer » dit qui il retire (audit du 19/10, CROSS-89/109). */}
                        <label className="sr-only" htmlFor={`auth-f-resp-${i}`}>{t('auth.managerPhoneA11y', { n: i + 1 })}</label>
                        <div style={{ marginTop: 6 }}><PhoneInput id={`auth-f-resp-${i}`} value={r.phone} onChange={(v) => setResponsables((l) => l.map((x, j) => (j === i ? { ...x, phone: v } : x)))} invalid={!!errors[`resp${i}`]} /></div>
                        {fieldError(`resp${i}`)}
                      </div>
                    ))}
                    {responsables.length < 4 && (
                      <button type="button" className="btn-link-plus" onClick={() => setResponsables((l) => [...l, { name: '', phone: '' }])}>＋ {t('auth.addManager')}</button>
                    )}
                  </div>
                )}
                {role === 'driver' && (
                  <>
                    <div className="field">
                      <span className="titre-groupe" id="auth-statut-titre">{t('auth.courierStatusTitle')}</span>
                      <p className="small" style={{ margin: '0 0 8px' }}>{t('auth.courierStatusHelp')}</p>
                      <div className={`statut-choix${errors.courierStatus ? ' input-invalid' : ''}`} role="radiogroup" aria-labelledby="auth-statut-titre">
                        {/* Deux statuts, avec numéro d'entreprise : indépendant (à titre principal ou complémentaire) et
                            étudiant-indépendant. Plus d'économie collaborative (CODE-12, DEC-19 : régime fermé aux livreurs de
                            plateformes depuis le 8 juin 2026). Libellés dédiés à l'inscription (auth.courierStatus_*). */}
                        {['independent', 'student_independent'].map((st) => (
                          <div key={st} role="radio" aria-checked={courierStatus === st} tabIndex={0}
                            className={`statut-carte${courierStatus === st ? ' active' : ''}`}
                            onClick={() => setCourierStatus(st)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCourierStatus(st); }}>
                            <b>{st === 'student_independent' ? <Icone nom="guide" taille={16} className="icone-texte" /> : <Icone nom="document" taille={16} className="icone-texte" />}{t(`auth.courierStatus_${st}`)}</b>
                            <span className="small">{t(`auth.courierStatus_${st}_desc`)}</span>
                            <span className="small" style={{ color: 'var(--iris)' }}>{t(`auth.courierStatus_${st}_asks`)}</span>
                          </div>
                        ))}
                      </div>
                      {fieldError('courierStatus')}
                    </div>
                    {courierStatus && (
                      <p className="small" style={{ margin: '-4px 0 10px', color: 'var(--ink-soft)' }}>{t(`auth.courierStatus_${courierStatus}_next`)}</p>
                    )}
                    {['student_independent', 'independent'].includes(courierStatus) && (
                      <div className="field">
                        <label htmlFor="auth-f-19">{t('auth.companyNumberDriver')} <span className="small">· {t('authDocs.optional')}</span></label>
                        <input id="auth-f-19" className={errors.companyNumber ? 'input-invalid' : undefined}
                          value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" inputMode="numeric" />
                        {fieldError('companyNumber')}
                        <p className="small" style={{ margin: '4px 0 0' }}>{t('auth.companyNumberDriverHelp')}</p>
                      </div>
                    )}
                    {courierStatus === 'student_independent' && (
                      <>
                        <div className="field">
                          <label htmlFor="auth-f-ecole">{t('auth.schoolName')}</label>
                          <input id="auth-f-ecole" className={errors.schoolName ? 'input-invalid' : undefined} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder={t('auth.schoolNamePlaceholder')} autoComplete="organization" />
                          {fieldError('schoolName')}
                        </div>
                        <div className="field">
                          <label htmlFor="auth-f-annee">{t('auth.academicYear')}</label>
                          <input id="auth-f-annee" className={errors.academicYear ? 'input-invalid' : undefined} value={academicYear} onChange={(e) => setAcademicYear(formaterAnneeAcademique(e.target.value))} placeholder="2026-2027" inputMode="numeric" />
                          {fieldError('academicYear')}
                          <p className="small" style={{ margin: '4px 0 0' }}>{t('auth.studentCertificateNote')}</p>
                        </div>
                      </>
                    )}
                    <div className="field">
                      <span className="titre-groupe" id="auth-vehicule-titre">{t('auth.vehicleTitle')}</span>
                      <div className={`role-pick statements-chips${errors.vehicleType ? ' input-invalid' : ''}`} role="radiogroup" aria-labelledby="auth-vehicule-titre">
                        {(courierOptions?.vehicles || ['velo', 'velo_electrique', 'scooter', 'voiture']).map((v) => (
                          <div key={v} role="radio" aria-checked={vehicleType === v} tabIndex={0} className={`chip${vehicleType === v ? ' active' : ''}`}
                            onClick={() => setVehicleType(v)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVehicleType(v); }}>
                            {/* Vélo (électrique ou non) : le vélo ; scooter : le scooter ; voiture : pas d'icône, il n'en existe pas (audit du 19/10, auth-38 : tout portait le scooter). */}
                            {['velo', 'velo_electrique'].includes(v) ? <Icone nom="velo" taille={16} className="icone-texte" /> : v === 'scooter' ? <Icone nom="scooter" taille={16} className="icone-texte" /> : null}{t(`courierOnboarding.vehicle_${v}`)}
                          </div>
                        ))}
                      </div>
                      {fieldError('vehicleType')}
                      {vehicleType && (
                        <p className="small" style={{ margin: '6px 0 0' }}>
                          {['velo', 'velo_electrique'].includes(vehicleType) ? t('auth.vehicleHelpBike', { km: courierOptions?.bikeMaxKm || 4 }) : t('auth.vehicleHelpMotor', { km: courierOptions?.bikeMaxKm || 4 })}
                        </p>
                      )}
                      {vehicleType === 'voiture' && <p className="small" style={{ margin: '6px 0 0' }}>{t('courierOnboarding.carWeightHelp')}</p>}
                    </div>
                    {/* ÉCRAN 2 ALLÉGÉ (12 oct. 2026). Il portait aussi le sac, « une autre plateforme ? » et 19 communes à cocher :
                        l'écran le plus lourd des deux inscriptions. Le sac et les autres plateformes se règlent dans le dossier
                        (étape « Infos »), la commune vient de l'adresse (écran suivant) — modifiable ensuite. */}
                  </>
                )}
              </>
            )}

            {stepKey === 'business' && (
              <>
                <p className="small infos-resto-note" style={{ margin: '0 0 10px', padding: '8px 10px', borderRadius: 8, background: 'var(--cream-dim)', borderLeft: '3px solid var(--iris)' }}><Icone nom="commerce" taille={16} className="icone-texte" />{' '}{t('auth.businessInfoNote')}</p>
                <div className="field">
                  <label htmlFor="auth-f-nom-commerce">{t('auth.businessNameLabel')}</label>
                  <input id="auth-f-nom-commerce" className={errors.nomCommerce ? 'input-invalid' : undefined} value={nomCommerce}
                    onChange={(e) => setNomCommerce(e.target.value)} placeholder={t('auth.businessNamePh')} autoComplete="organization" />
                  <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('auth.businessNameHelp')}</p>
                  {fieldError('nomCommerce')}
                </div>
                <div className="field">
                  <label htmlFor="auth-f-tel-resto">{t('auth.restoPhoneLabel')}</label>
                  <PhoneInput id="auth-f-tel-resto" value={restoPhone} onChange={setRestoPhone} invalid={!!errors.restoPhone} />
                  <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('auth.restoPhoneHelp')}</p>
                  {phone.trim() && restoPhone.trim() !== phone.trim() && (
                    <button type="button" className="btn-link-plus" onClick={() => setRestoPhone(phone.trim())}>{t('auth.restoPhoneSameAsMine')}</button>
                  )}
                  {fieldError('restoPhone')}
                </div>
              </>
            )}

            {/* ÉCRAN 2 — ce que le commerce EST : sa cuisine, sa raison sociale, son représentant, ses
                contacts. Tout ce qui décrit, rien de ce qui s'organise (horaires) ni de ce qui se vend
                (services). */}
            {stepKey === 'details' && (
              <>
                {/* CE QUE LE COMMERCE VEND (fondateur, 2026-10-22, maquettes/categories-commerce : « site pareil que l'app ») : le même
                    écran que l'inscription dans l'app et Mon commerce, à la place de la liste déroulante des 35 types et des
                    pastilles « Tu proposes aussi… ». Jusqu'à 7 spécialités, la première s'affiche sur la fiche. */}
                <div className="field" role="group" aria-labelledby="auth-specialites-titre">
                  <span className="titre-groupe" id="auth-specialites-titre">{t('auth.cuisineLabel')}</span>
                  <p className="small" style={{ margin: '0 0 8px', opacity: 0.8 }}>{typeDepuisSite && cuisine ? t('auth.cuisineFromSite') : t('auth.cuisineHelp')}</p>
                  <ChoixSpecialites valeurs={specialites} onChange={(v) => { setSpecialites(v); setTypeDepuisSite(false); }} />
                  {fieldError('cuisine')}
                </div>
                {/* Plus de question sur la carte ici : elle se crée après l'inscription, dans « Mon menu »
                    (fondateur, 2026-09-14). L'inscription reste courte : le commerce, ses horaires, ses services. */}
                <div className="field contacts-commerce" role="group" aria-labelledby="auth-contacts-titre">
                  <span className="titre-groupe" id="auth-contacts-titre">{t('auth.contactsTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>{t('auth.contactsHelp')}</p>
                  <p className="small contact-ligne"><Icone nom="telephone" taille={16} className="icone-texte" />{' '}<b>{restoPhone.trim() || phone.trim() || '-'}</b> <span style={{ opacity: 0.75 }}>· {restoPhone.trim() ? t('auth.contactsPhoneOnSite') : t('auth.contactsPhoneFromAccount')}</span></p>
                  <label className="row small" style={{ gap: 8, alignItems: 'center', margin: '2px 0 6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!phonePublic} onChange={(e) => setPhonePublic(!e.target.checked)} />
                    <span>{t('auth.hidePhonePublic')}</span>
                  </label>
                  <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}><Icone nom="cadenas" taille={16} className="icone-texte" />{' '}{t('auth.personalPhonePrivate')}</p>
                  {!phoneSecondaryOuvert ? (
                    <button type="button" className="btn-link-plus" onClick={() => setPhoneSecondaryOuvert(true)}>＋ {t('auth.addSecondPhone')}</button>
                  ) : (
                    <div className="contact-second">
                      <label htmlFor="auth-f-tel2" className="small">{t('auth.secondPhone')}</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><PhoneInput id="auth-f-tel2" value={phoneSecondary} onChange={setPhoneSecondary} invalid={!!errors.phoneSecondary} /></div>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => { setPhoneSecondary(''); setPhoneSecondaryOuvert(false); }}>{t('auth.removeSecond')}</button>
                      </div>
                      {fieldError('phoneSecondary')}
                      <label className="row small" style={{ gap: 8, alignItems: 'center', margin: '6px 0 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!phoneSecondaryPublic} onChange={(e) => setPhoneSecondaryPublic(!e.target.checked)} />
                        <span>{t('auth.hidePhonePublic')}</span>
                      </label>
                    </div>
                  )}
                  <p className="small contact-ligne" style={{ marginTop: 8 }}><Icone nom="courrier" taille={16} className="icone-texte" />{' '}<b>{email.trim() || t('auth.contactsEmailLater')}</b> <span style={{ opacity: 0.75 }}>· {t('auth.contactsEmailFromAccount')}</span></p>
                  {!emailSecondaryOuvert ? (
                    <button type="button" className="btn-link-plus" onClick={() => setEmailSecondaryOuvert(true)}>＋ {t('auth.addSecondEmail')}</button>
                  ) : (
                    <div className="contact-second">
                      <label htmlFor="auth-f-mail2" className="small">{t('auth.secondEmail')}</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <input id="auth-f-mail2" type="email" inputMode="email" style={{ flex: 1 }} className={errors.emailSecondary ? 'input-invalid' : undefined} value={emailSecondary} onChange={(e) => setEmailSecondary(e.target.value)} placeholder={t('auth.phEmail')} />
                        <button type="button" className="btn-ghost btn-sm" onClick={() => { setEmailSecondary(''); setEmailSecondaryOuvert(false); }}>{t('auth.removeSecond')}</button>
                      </div>
                      <EmailDomainChips value={emailSecondary} onChange={setEmailSecondary} inputId="auth-f-mail2" />
                      {fieldError('emailSecondary')}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="auth-f-bce">{t('auth.companyNumberResto')}</label>
                  <input id="auth-f-bce" inputMode="numeric" className={errors.companyNumber ? 'input-invalid' : undefined}
                    value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
                  {fieldError('companyNumber')}
                  {!errors.companyNumber && <VerifSociete verif={verifSociete} style={{ margin: '4px 0 0' }} />}
                  <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('auth.companyNumberRestoHelp')}</p>
                </div>
                <div className="field">
                  <label htmlFor="auth-f-12">{t('auth.legalName')}</label>
                  <input id="auth-f-12" className={errors.legalName ? 'input-invalid' : undefined}
                    value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t('auth.phLegalName')} />
                  {fieldError('legalName')}
                </div>
                {/* Le responsable légal : par défaut la personne qui s'inscrit (prénom + nom de l'écran 2) — une ligne, et un
                    lien pour la changer, au lieu d'un champ à remplir à chaque fois. */}
                {responsableOuvert || errors.responsibleName ? (
                  <div className="field">
                    <label htmlFor="auth-f-15">{t('auth.responsibleName')}</label>
                    <input id="auth-f-15" className={errors.responsibleName ? 'input-invalid' : undefined}
                      value={responsibleName}
                      onChange={(e) => { setResponsibleName(e.target.value); setResponsibleTouched(true); }}
                      placeholder={t('auth.responsibleNamePlaceholder')}
                    />
                    {fieldError('responsibleName')}
                  </div>
                ) : (
                  <p className="small" style={{ margin: '0 0 12px' }}>
                    {t('auth.responsibleIs', { name: responsibleName || '-' })}{' '}
                    <button type="button" className="btn-link-plus" style={{ margin: 0 }} onClick={() => setResponsableOuvert(true)}>{t('auth.responsibleChange')}</button>
                  </p>
                )}
              </>
            )}

            {/* ÉCRAN 3 — les horaires seuls. C'est le champ le plus long à remplir de toute
                l'inscription (sept jours, deux services possibles par jour) : il mérite son écran, et
                c'est ici que la case « j'ai vérifié le préremplissage » récapitule les trois sources. */}
            {stepKey === 'hours' && (
              <>
                <div className="field" role="group" aria-labelledby="auth-horaires-titre">
                  <span className="titre-groupe" id="auth-horaires-titre">{t('auth.hoursTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>
                    {hoursDepuisWeb ? `${t(horairesSiteEtat === 'trouve' ? 'auth.hoursFromSite' : horairesSiteEtat === 'trouveWeb' ? 'auth.hoursFromSearch' : 'auth.hoursFromWeb')}` : horairesSiteEtat === 'lecture' ? `${t('auth.hoursReadingSite')}` : horairesSiteEtat === 'recherche' ? `${t('auth.hoursSearching')}` : t('auth.hoursHelp')}
                    {(horairesSiteEtat === 'trouve' || horairesSiteEtat === 'trouveWeb') && horairesSiteSource && (
                      <>{' '}<a href={urlSure(horairesSiteSource)} target="_blank" rel="noreferrer">{t('auth.hoursSiteSource')}</a></>
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
                    <b><Icone nom="recherche" taille={16} className="icone-texte" />{' '}{t('auth.verifyPrefillTitle')}</b>
                    <p className="small" style={{ margin: '4px 0 6px' }}>{t('auth.verifyPrefillIntro')}</p>
                    <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                      {siteTrouve && <li><Icone nom="globe" taille={16} className="icone-texte" />{' '}{t('auth.verifyPrefillWebsite')} <a href={urlSure(siteTrouve)} target="_blank" rel="noreferrer">{siteTrouve}</a></li>}
                      {hoursDepuisWeb && <li>{t('auth.verifyPrefillHours')}</li>}
                      {typeDepuisSite && cuisine && <li><Icone nom="restaurants" taille={16} className="icone-texte" />{' '}{t('auth.verifyPrefillType', { type: restaurantTypeLabel(cuisine, t) })}</li>}
                    </ul>
                    <label className="verif-prefill-case">
                      <input type="checkbox" checked={infosVerifiees} onChange={(e) => setInfosVerifiees(e.target.checked)} />
                      <span>{t('auth.verifyPrefillCheck')}</span>
                    </label>
                    {fieldError('infosVerifiees')}
                  </div>
                )}
              </>
            )}

            {/* ÉCRAN 4 — ce que le commerce VEND. Isolé parce que c'est le seul écran de
                l'inscription qui engage de l'argent : le choix des services décide de la formule, et
                OffreFormules affiche juste en dessous ce qui sera prélevé et à partir de quand. */}
            {stepKey === 'services' && (
              <>
                <div className="field services-choice" role="group" aria-labelledby="auth-services-titre">
                  <span className="titre-groupe" id="auth-services-titre">{t('auth.servicesTitle')}</span>
                  <p className="small" style={{ margin: '0 0 6px' }}>{t('auth.servicesHelp')}</p>
                  <label className="service-option"><input type="checkbox" checked={services.delivery} onChange={(e) => setServices((s) => ({ ...s, delivery: e.target.checked }))} /> <span><Icone nom="velo" taille={16} className="icone-texte" />{' '}{t('auth.serviceDelivery')}</span></label>
                  {services.delivery && (
                    <div className="service-suboptions">
                      <label className="service-option"><input type="radio" name="deliveryMode" checked={services.deliveryMode === 'fairide'} onChange={() => setServices((s) => ({ ...s, deliveryMode: 'fairide' }))} /> <span>{t('auth.serviceDeliveryFairide')}</span></label>
                      <label className="service-option"><input type="radio" name="deliveryMode" checked={services.deliveryMode === 'own'} onChange={() => setServices((s) => ({ ...s, deliveryMode: 'own' }))} /> <span>{t('auth.serviceDeliveryOwn')}</span></label>
                    </div>
                  )}
                  <label className="service-option"><input type="checkbox" checked={services.pickup} onChange={(e) => setServices((s) => ({ ...s, pickup: e.target.checked }))} /> <span><Icone nom="maison" taille={16} className="icone-texte" />{' '}{t('auth.servicePickup')}</span></label>
                  {services.pickup && (
                    // Comment l'à emporter est payé décide de la commission : sur place = 0 %, en ligne ou au choix = 10 % sur les
                    // commandes payées en ligne. L'à emporter lui-même relève toujours de la version complète (2026-09-23).
                    <div className="service-suboptions" role="group" aria-label={t('accountUi.pickupPayTitle')}>
                      {[['on_site', 'pickupPayOnSiteOnly'], ['online', 'pickupPayOnline'], ['both', 'pickupPayBoth']].map(([v, cle]) => (
                        <label key={v} className="service-option"><input type="radio" name="pickupPaymentMode" checked={services.pickupPaymentMode === v} onChange={() => setServices((s) => ({ ...s, pickupPaymentMode: v }))} /> <span>{t(`accountUi.${cle}`)}{services.pickupPaymentMode === v && <span className="small" style={{ display: 'block' }}>{t(`accountUi.${cle}Text`)}</span>}</span></label>
                      ))}
                    </div>
                  )}
                  {/* PENDANT LE LANCEMENT, RIEN À PAYER (12 oct. 2026, test au téléphone). Le grand encadré des formules (prix,
                      « quand est-ce que je commence à payer », premier prélèvement daté) contredisait l'abonnement offert
                      pendant le lancement (formules.abonnementOffert) et faisait de cet écran le plus long de l'inscription.
                      Une phrase suffit ; le détail reste dans Mon compte › Abonnement, où il suit l'état réel du commerce. */}
                  {(services.delivery || services.pickup) && <p className="small offre-lancement">{t('dashResto.createNote')}</p>}
                  {fieldError('services')}
                </div>
              </>
            )}

            {stepKey === 'address' && (
              <>
                <AddressSearch onSelect={(a) => { setAddressStreet(a.street); if (a.number) setAddressNumber(a.number); if (a.postalCode) setAddressPostalCode(a.postalCode); if (a.city) setAddressCity(a.city); }} />
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-8">{t('auth.street')}</label>
                    <input id="auth-f-8" className={errors.addressStreet ? 'input-invalid' : undefined}
                      value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('auth.phStreet')} autoComplete={role === 'restaurant' ? 'off' : 'address-line1'} />
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
                      value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" inputMode="numeric" autoComplete={role === 'restaurant' ? 'off' : 'postal-code'} />
                    {fieldError('addressPostalCode')}
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-11">{t('auth.city')}</label>
                    <input id="auth-f-11" className={errors.addressCity ? 'input-invalid' : undefined}
                      value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder={t('auth.phCity')} autoComplete={role === 'restaurant' ? 'off' : 'address-level2'} />
                    {fieldError('addressCity')}
                  </div>
                </div>
                {/* Code postal hors de Bruxelles et de sa périphérie (audit du 19/10, auth-09) : on le dit dès ici, sans bloquer,
                    au lieu de le découvrir au paiement. */}
                {role === 'client' && codePostalValide(addressPostalCode) && !communeDepuisCodePostal(addressPostalCode) && (
                  <p className="small" role="status" style={{ margin: '0 0 10px' }}><Icone nom="position" taille={16} className="icone-texte" />{' '}{t('auth.outOfZoneInfo')}</p>
                )}
                {role === 'restaurant' && (
                  <AddressRecognition
                    street={addressStreet} number={addressNumber} postalCode={addressPostalCode} city={addressCity}
                    onResult={(r) => {
                      if (r.commune && !addressCity.trim()) setAddressCity(r.commune);
                      // { ...ancien } et pas une fiche neuve : cet indice porte aussi les horaires, les
                      // services et les contacts saisis aux étapes précédentes. Les écraser ici privait
                      // le tableau de bord de quoi recréer le commerce, et le restaurateur se retrouvait
                      // à tout ressaisir une seconde fois.
                      try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, street: addressStreet.trim(), number: addressNumber.trim(), postalCode: addressPostalCode.trim(), city: addressCity.trim() || r.commune || '', commune: r.commune, neighborhood: r.neighborhood })); } catch { /* sans stockage */ }
                    }}
                    onPickCandidate={(c, r) => {
                      try { const ancien = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}'); localStorage.setItem('fairide_resto_hint', JSON.stringify({ ...ancien, name: c.name || ancien.name, cuisine: c.cuisine || ancien.cuisine, commune: r.commune, neighborhood: r.neighborhood })); } catch { /* sans stockage */ }
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
                  <div style={{ fontWeight: 700 }}><Icone nom="valider" taille={16} className="icone-texte" />{' '}{fournisseurFed === 'apple' ? t('appli.appleLinked') : t('auth.googleLinked')}</div>
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
                      {estNatif() ? <BoutonsConnexionNative onChoix={connexionNative} disabled={loading} /> : googleDemande ? <div ref={googleBtnRef} /> : (<div className="connexion-native" style={{ maxWidth: 320 }}><button type="button" className="btn-connexion btn-connexion-google" onClick={demanderGoogle}><LogoGoogle /> {t('appli.continueGoogle')}</button></div>)}
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
                  <PasswordInput id="auth-f-18" value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((prev) => { const { password: _p, ...reste } = prev; return reste; }); }}
                    onBlur={controlerMotDePasseEnQuittant} invalid={!!errors.password} />
                  {errors.password ? fieldError('password') : (
                    // Les trois critères, cochés au fil de la frappe : on sait tout de suite ce qui manque.
                    <ul className="mdp-criteres" aria-live="polite">
                      {[['mdpLongueur', password.length >= 6], ['mdpMajuscule', /[A-Z]/.test(password)], ['mdpMinuscule', /[a-z]/.test(password)]].map(([cle, ok]) => (
                        <li key={cle} className={ok ? 'ok' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {t(`auth.${cle}`)}</li>
                      ))}
                    </ul>
                  )}
                  {/* Le texte d'exemple a disparu du champ : le libellé « Mot de passe » est juste
                      au-dessus, et Uber ne double jamais une étiquette par un texte d'exemple. */}
                </div>
                {/* Plus de « Confirme ton mot de passe » (12 oct. 2026) : l'œil du champ montre ce qu'on tape, c'est ce qui
                    évite la faute de frappe — un second champ ne faisait que doubler la saisie. */}
              </>
            )}
            {/* Pot de miel (voir siteWeb) : hors écran, hors tabulation, hors lecteur d'écran. */}
            {stepKey === 'account' && (
              <div className="hp-champ" aria-hidden="true">
                <label htmlFor="auth-hp">Site web</label>
                <input id="auth-hp" name="website" tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
              </div>
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

            {/* Brouillon repris : le mot de passe, jamais gardé, se retape ici plutôt qu'à l'étape 1 (LIVE-13). */}
            {isLastStep && step > 0 && mdpARetaper && !googleCredential && (
              <div className="field">
                <label htmlFor="auth-f-mdp-reprise">{t('auth.password')}</label>
                <PasswordInput id="auth-f-mdp-reprise" value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((prev) => { const { password: _p, ...reste } = prev; return reste; }); }}
                  onBlur={controlerMotDePasseEnQuittant} invalid={!!errors.password} />
                {errors.password ? fieldError('password') : <p className="small" style={{ margin: '4px 0 0' }}>{t('auth.draftPasswordAgain')}</p>}
              </div>
            )}

            {isLastStep && role === 'client' && (
              <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '4px 0 12px' }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={accepteCgu} onChange={(e) => setAccepteCgu(e.target.checked)} />
                <span className="small">
                  {t('conformite.termsAcceptPrefix')} <Link to="/cgv" target="_blank" rel="noopener">{t('conformite.termsLink')}</Link>{versionCgu ? ` (${versionCgu})` : ''}.
                </span>
              </label>
            )}
            {isLastStep && role === 'restaurant' && (
              <EngagementsInscription checked={accepteEngagements} onChange={setAccepteEngagements} />
            )}
            {/* Refus des nouvelles de Fairide (voir refusNouvelles) : discret, sous les cases obligatoires, tous rôles. */}
            {isLastStep && role === 'client' && (
              <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 12px' }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={nouvellesOui} onChange={(e) => setNouvellesOui(e.target.checked)} />
                <span className="small">{t('nouvelles.signupOptIn')}</span>
              </label>
            )}
            {isLastStep && role !== 'client' && (
              <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 12px', opacity: 0.8 }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={refusNouvelles} onChange={(e) => setRefusNouvelles(e.target.checked)} />
                <span className="small">{t('nouvelles.signupOptOut')}</span>
              </label>
            )}
            {/* Comment les données sont utilisées, là où on les demande (RGPD art. 13). */}
            {isLastStep && <p className="small" style={{ margin: '0 0 12px' }}>{t('nouvelles.privacyPrefix')} <Link to="/confidentialite" target="_blank" rel="noopener">{t('nouvelles.privacyLink')}</Link>.</p>}
            {incomplet && incomplet.step === step && Object.keys(errors).length > 0 && (
              <p className="auth-incomplet" role="alert"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('auth.checkIncomplete', { n: incomplet.n, step: stepCopy?.title || '' })}</p>
            )}
            <div className="auth-step-nav">
              {step > 0 && (
                <button type="button" className="btn-outline" onClick={goBack}>{t('auth.back')}</button>
              )}
              <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={loading || verifDispo}>
                {loading || verifDispo ? t('common.loading') : isLastStep ? t('auth.createAccount') : t('auth.continueStep')}
              </button>
            </div>
          </form>
        ) : (
          <>
            {GOOGLE_CLIENT_ID && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
                  {estNatif() ? <BoutonsConnexionNative onChoix={connexionNative} disabled={loading} /> : googleDemande ? <div ref={googleBtnRef} /> : (<div className="connexion-native" style={{ maxWidth: 320 }}><button type="button" className="btn-connexion btn-connexion-google" onClick={demanderGoogle}><LogoGoogle /> {t('appli.continueGoogle')}</button></div>)}
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
                <PasswordInput id="auth-f-18" value={password} onChange={(e) => { setPassword(e.target.value); setErreurConnexion(''); }} placeholder={t('auth.password')} autoComplete="current-password" invalid={!!erreurConnexion && !totpAttendu} />
                {erreurConnexion && !totpAttendu && <p className="field-error" role="alert">{erreurConnexion}</p>}
              </div>
              {/* Second facteur : n'apparaît qu'après que le serveur l'a réclamé, donc jamais pour un
                  compte qui ne l'a pas activé. autoComplete one-time-code : le téléphone propose le code copié.
                  Clavier TEXTE (audit du 19/10, CROSS-60) : un code de secours a des lettres et un tiret. */}
              {totpAttendu && (
                <div className="field">
                  <label htmlFor="auth-f-totp">{t('auth.totpLabel')}</label>
                  <input
                    id="auth-f-totp" type="text" {...CHAMP_CODE_SECOURS} autoComplete="one-time-code"
                    pattern="[0-9A-Za-z-]*" maxLength={11} autoFocus
                    value={totpCode} onChange={(e) => setTotpCode(e.target.value)}
                    placeholder={t('auth.totpPlaceholder')}
                  />
                  {erreurConnexion && <p className="field-error" role="alert">{erreurConnexion}</p>}
                  <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('auth.totpHelp')}</p>
                </div>
              )}
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
    </CadreConnexion>
  );
}
