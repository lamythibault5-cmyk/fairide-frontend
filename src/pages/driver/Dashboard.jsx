import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import TirerPourActualiser from '../../components/TirerPourActualiser';
import ErrorCard from '../../components/ErrorCard';
import IncidentsCourse from '../../components/livreur/IncidentsCourse';
import PhotoDepot from '../../components/livreur/PhotoDepot';
import BoutonUrgence from '../../components/livreur/BoutonUrgence';
import GlisserPourConfirmer from '../../components/livreur/GlisserPourConfirmer';
import RouteVelo from '../../components/livreur/RouteVelo';
import { experienceApp, allerAuPaiement, suivrePositionCourse } from '../../natif';
import { mouvementReduit, vibrer } from '../../gestes';
import Icone from '../../components/Icone';
import { euros } from '../../prixPlat';
import { DeliveryTiming, DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel, formatOrderItem } from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Montants et distances au format de la langue (« 4,50 », « 0,3 ») : toFixed écrivait « 4.50 € » en français.
const dec = (v, n = 2) => Number(v || 0).toLocaleString(getLocale(), { minimumFractionDigits: n, maximumFractionDigits: n });
import { paiementsOuverts } from '../../launch';
import BandeauOuverture from '../../components/BandeauOuverture';
import useRevalidation from '../../useRevalidation';
import useAlerteLivreur from '../../hooks/useAlerteLivreur';
import AlerteLivreurBar from '../../components/AlerteLivreurBar';
import SelfieControle from '../../components/livreur/SelfieControle';
import LivreurDedie from '../../components/livreur/LivreurDedie';
import NotifCourses from '../../components/livreur/NotifCourses';
import PositionRequise from '../../components/livreur/PositionRequise';
import { BandeauAllergie, BadgeAlcool, VerificationAge } from '../../components/conformite/CommandeConformite';
import EtatVide from '../../components/EtatVide';
import '../../ecran-livreur.css';
import '../../site-livreur.css';
import { telephoneLisible } from '../../validation';

// La carte de la course choisie (site sur un ordinateur seulement) : Leaflet n'est téléchargé que là, jamais sur un
// téléphone ni dans l'app (CarteCourse.jsx).
const CarteCourse = lazy(() => import('../../components/livreur/CarteCourse'));

/* LE SITE SUR UN ORDINATEUR (fondateur, 2026-10-16, mockups/site-ordinateur.html, section « Livreur », « Proposition ») :
   à partir de 1100 px, la liste des courses à gauche, la carte et le détail de la course choisie à droite ; une course
   en main, son détail à gauche et sa carte à droite. Jamais dans l'app, qui garde son écran de téléphone, et pas sur un
   téléphone non plus : la page y reste en une colonne, avec des boutons (la glissière est réservée à l'app). */
const SITE_LARGE = '(min-width: 1100px)';
function useSiteLarge(actif) {
  const [large, setLarge] = useState(() => actif && window.matchMedia(SITE_LARGE).matches);
  useEffect(() => {
    if (!actif) return undefined;
    const mq = window.matchMedia(SITE_LARGE);
    const suivre = () => setLarge(mq.matches);
    suivre();
    mq.addEventListener('change', suivre);
    return () => mq.removeEventListener('change', suivre);
  }, [actif]);
  return large;
}

// Cadence maximale d'envoi de la position au serveur (voir l'effet watchPosition plus bas) — reprend
// l'intervalle de l'ancien sondage, pour que le passage à watchPosition n'augmente pas le trafic.
const MIN_LOCATION_SEND_INTERVAL_MS = 12000;

function formatClock(date) {
  return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

// ITINÉRAIRE (GEO-7). L'adresse n'était que du texte : le livreur devait la recopier dans son appli de navigation, à
// vélo, d'une main (test de bout en bout du 6 oct. 2026). Le lien universel Google Maps ouvre l'appli installée sur
// Android comme sur iPhone, et le navigateur à défaut. Vers le commerce sur la carte « à récupérer », vers le client
// seulement une fois la commande en main (l'adresse complète n'est envoyée qu'à ce moment-là).
//
// WAZE EN GROS BOUTON (fondateur, simulation du 10 oct. 2026). Les livreurs bruxellois roulent sur Waze ; un petit lien
// texte se ratait d'un pouce ganté. D'où un bouton iris pleine largeur, le geste évident de la carte, et Google Maps
// gardé en lien discret pour qui ne l'a pas. Les coordonnées passent avant l'adresse quand le serveur les donne : Waze
// géocode mal certaines adresses bruxelloises bilingues (« Rue … / …straat »), un point GPS ne se trompe pas.
// LES VRAIS LOGOS (fondateur, 2026-10-18) : la bulle générique et l'épingle rouge unie ressemblaient à n'importe quelle app.
// Le « Wazer » (bulle blanche à roues, visage souriant) et l'épingle quatre couleurs de Google se reconnaissent d'un coup
// d'œil, au guidon. Dessins simplifiés à 24 px, pas les fichiers officiels. useId : le clipPath de l'épingle doit avoir un
// identifiant par carte, plusieurs cartes de course étant à l'écran en même temps.
function LogoWaze() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M13 3.2c4.3 0 7.6 3 7.6 6.9 0 2.6-1.4 4.6-3.7 5.8H8.6c-1 0-1.9-.3-2.6-.9-.6.5-1.5.8-2.4.7.7-.7 1-1.6 1-2.6v-3c0-3.9 3.8-6.9 8.4-6.9Z" fill="#fff" stroke="#0B1F2E" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10.7" cy="8.7" r="1" fill="#0B1F2E" />
      <circle cx="15.5" cy="8.7" r="1" fill="#0B1F2E" />
      <path d="M10.3 11.3c1.5 1.5 4 1.5 5.5 0" fill="none" stroke="#0B1F2E" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9.4" cy="17.8" r="2.1" fill="#0B1F2E" />
      <circle cx="16.3" cy="17.8" r="2.1" fill="#0B1F2E" />
    </svg>
  );
}

function LogoGoogleMaps() {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <defs>
        <clipPath id={id}><path d="M12 1.5c-4.1 0-7.4 3.3-7.4 7.4 0 5.3 7.4 13.6 7.4 13.6s7.4-8.3 7.4-13.6c0-4.1-3.3-7.4-7.4-7.4Z" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <path d="M9 0h15v5L12 8.9Z" fill="#EA4335" />
        <path d="M0 0h9l3 8.9L0 12Z" fill="#4285F4" />
        <path d="M0 12l12-3.1L5 24H0Z" fill="#FBBC04" />
        <path d="M12 8.9 24 5v19H5Z" fill="#34A853" />
      </g>
      <circle cx="12" cy="8.9" r="2.7" fill="#fff" />
    </svg>
  );
}

function BoutonsItineraire({ adresse, lat, lng, t }) {
  if (!adresse && (lat == null || lng == null)) return null;
  const point = lat != null && lng != null ? `${lat},${lng}` : null;
  const waze = point ? `https://waze.com/ul?ll=${point}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point || adresse)}`;
  // CÔTE À CÔTE (fondateur, 2026-10-16, maquette « Course en cours ») : Waze garde le bouton plein, Google Maps passe d'un
  // lien discret à un bouton à contour de même taille, plus facile à toucher au guidon.
  // AUX COULEURS DE CHAQUE APP (fondateur, 2026-10-17) : Waze dans son bleu clair, Google Maps en blanc avec l'épingle de
  // Google — on reconnaît l'app avant de lire. Seule exception au « blanc ou iris » de la marque : ces boutons ouvrent une autre app.
  return (
    <div className="ecl-itineraire">
      <a href={waze} target="_blank" rel="noopener noreferrer" className="btn-nav btn-nav--waze">
        <LogoWaze />
        {t('dashDriver.openWaze')}
      </a>
      <a href={google} target="_blank" rel="noopener noreferrer" className="btn-nav btn-nav--google" aria-label={`${t('dashDriver.directions')} (Google Maps)`}>
        <LogoGoogleMaps />
        Google Maps
      </a>
    </div>
  );
}

/* LE CODE DU CLIENT EN QUATRE CASES (fondateur, 2026-10-16, maquette « Course en cours »). Un seul vrai champ, transparent,
 * posé sur les cases : le clavier numérique, le collage et le lecteur d'écran marchent comme avant. Les codes de remise ont
 * quatre chiffres (serveur, routes/orders.js) ; la validation reste celle de deliver() et du serveur. */
function CodeCases({ valeur, onChange, onValider, libelle }) {
  return (
    <label className="ecl-code-cases">
      <input aria-label={libelle} inputMode="numeric" autoComplete="off" maxLength={4} value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => { if (e.key === 'Enter') onValider(); }} />
      {[0, 1, 2, 3].map((k) => (
        <span key={`${k}-${valeur[k] || ''}`} aria-hidden="true" className={`${valeur[k] ? 'plein' : ''}${k === Math.min(valeur.length, 3) ? ' actuel' : ''}`}>{valeur[k] || ''}</span>
      ))}
    </label>
  );
}

export default function DriverDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  // Un ref et non un state : sa valeur est lue dans load(), qui n'est pas re-créée à chaque rendu.
  const chargeReussieRef = useRef(false);
  const [codeInputs, setCodeInputs] = useState({});
  // Remise d'une commande avec alcool : pièce d'identité à contrôler d'abord (backlog B6).
  const [ageAVerifier, setAgeAVerifier] = useState(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [lastPositionAt, setLastPositionAt] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  // Selfie de contrôle demandé (SelfieControle.jsx) : null, ou { dueAt, blocking }. Sert au bandeau (LIVE-25).
  const [selfie, setSelfie] = useState(null);
  const activeIdsRef = useRef([]);
  // Site sur un ordinateur : mise en page en deux colonnes, et la course choisie dans la liste (son id).
  const large = useSiteLarge(!experienceApp());
  const [choisie, setChoisie] = useState(null);

  async function togglePause() {
    setTogglingPause(true);
    try {
      await api('/auth/me', { method: 'PATCH', token, body: { driverPaused: !user?.driverPaused } });
      await refreshUser();
      // Reprise : les courses tout de suite, sans attendre le prochain relevé de 15 secondes (audit du 19/10, LIVE-26).
      load();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setTogglingPause(false);
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connect')) {
      toast(t('dashDriver.toastPaymentsValidating'));
      window.history.replaceState({}, '', '/driver');
      // Le statut Stripe Connect n'est pas suivi par webhook pour ce type de compte (voir backend) —
      // on le relit activement au retour de l'onboarding avant de rafraîchir l'utilisateur en contexte.
      api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {}).finally(() => refreshUser().catch(() => {}));
    } else if (user?.stripeConnectStatus === 'pending') {
      // Même filet que côté commerce (DashboardLayout.jsx) : un compte resté « en attente » est relu à l'ouverture, au cas où
      // le livreur n'est pas repassé par le lien de retour de Stripe, ou si l'activation est arrivée après.
      api('/auth/me/connect/refresh', { method: 'POST', token }).then(() => refreshUser().catch(() => {})).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* RETOUR DE STRIPE CONNECT DANS L'APPLICATION (audit du 19/10, courier-3). Le navigateur intégré qui se ferme ramène à
   * /driver, la page déjà ouverte : la relecture du lancement (?connect, au-dessus) ne repassait pas, et « Active tes
   * paiements » restait jusqu'au redémarrage de l'application. Au retour au premier plan (ou sur cette page), un compte
   * lancé ici ou resté « en attente » est relu chez Stripe. */
  const connectLance = useRef(false);
  const location = useLocation();
  function relireConnect() {
    if (!connectLance.current && user?.stripeConnectStatus !== 'pending') return undefined;
    connectLance.current = false;
    return api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {}).finally(() => refreshUser().catch(() => {}));
  }
  // Pas au premier affichage : l'effet de lancement, au-dessus, s'en charge déjà.
  const premierAffichage = useRef(true);
  useEffect(() => { if (premierAffichage.current) { premierAffichage.current = false; return; } relireConnect(); }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connectOnboard() {
    connectLance.current = true;
    setConnecting(true);
    try {
      const r = await api('/auth/me/connect/onboard', { method: 'POST', token });
      // Dans l'app, Stripe s'ouvre dans le navigateur intégré et l'on revient ici en le fermant (allerAuPaiement, natif.js) ;
      // sur le site, rien ne change : la page part vers Stripe.
      await allerAuPaiement(r.url, { retour: '/driver' });
      setConnecting(false);
    } catch (e) {
      toast(e.message, 'erreur');
      setConnecting(false);
    }
  }

  // Véhicule déclaré (dossier coursier) : explique pourquoi certaines courses n'apparaissent pas (vélo) ou
  // pourquoi les longues distances sont en tête (motorisé).
  const [vehicule, setVehicule] = useState(null);
  const [sac, setSac] = useState(null);
  // Un seul appel au dossier (il y en avait deux, identiques) : sac, véhicule, et l'état du dossier — qui décide du message
  // affiché avant la validation (pas encore envoyé, à corriger, ou en cours de vérification).
  const [dossier, setDossier] = useState(null);
  const [tournee, setTournee] = useState(null);
  useEffect(() => {
    api('/couriers/me', { token }).then((d) => {
      setSac(d.courier?.bag || null);
      setVehicule({ type: d.courier?.vehicleType || '', bikeMaxKm: d.pricing?.bikeMaxKm || 4, rate: ['velo', 'velo_electrique'].includes(d.courier?.vehicleType || '') ? d.pricing?.driverPerKmBike : d.pricing?.driverPerKmMotor, base: d.pricing?.deliveryBaseFee, baseKm: d.pricing?.deliveryBaseKm });
      setDossier({ statut: d.courier?.lifecycleStatus || null, motif: d.courier?.reviewReason || '' });
      // Règles de la tournée (routes/couriers.js tarifsLivreur, tournee.js côté serveur), rappelées dès qu'une course est en main.
      setTournee({
        max: d.courier?.otherPlatforms?.works === true ? 1 : (d.pricing?.maxOrdersFairideOnly || 3),
        radius: String(d.pricing?.secondOrderRadiusKm ?? 2).replace('.', ','),
        delay: d.pricing?.extraOrderMaxDelayMin ?? 10
      });
    }).catch(() => {});
  }, [token]);

  async function load() {
    try {
      const [availableData, mineData] = await Promise.all([
        api('/orders/available', { token }),
        api('/orders/mine/deliveries', { token })
      ]);
      setAvailable(availableData);
      setMine(mineData);
      setErreur(null);
      chargeReussieRef.current = true;
    } catch (e) {
      /* UN ÉCHEC NE DOIT PAS SE LIRE COMME « AUCUNE COURSE ».
         Jusqu'ici l'échec ne posait qu'un toast : `loading` passait à false, la page s'affichait
         avec des listes vides et le livreur lisait « aucune commande disponible ». C'est un
         mensonge coûteux — il est payé à la course, et rien ne lui disait de réessayer.

         L'écran d'erreur ne remplace la page QUE tant qu'aucun chargement n'a réussi. Ensuite on
         garde les données déjà affichées et le toast suffit : la page se recharge toute seule
         toutes les 15 secondes, et sur un réseau qui clignote (un livreur est en mouvement, c'est
         le cas normal) la faire basculer en écran d'erreur lui retirerait ses courses des mains. */
      setErreur(e);
      if (chargeReussieRef.current) toast(e.message, 'erreur');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // refreshUser() en plus de load() : contrairement au dashboard restaurateur (qui recharge tout
    // l'objet restaurant, adminStatus inclus, à chaque poll), le statut d'approbation du livreur vit
    // sur l'objet user mis en cache depuis la connexion — sans ce refresh périodique, une approbation
    // admin ne se refléterait ici qu'après une reconnexion manuelle.
    load();
    refreshUser().catch(() => {});
    const interval = setInterval(() => { load(); refreshUser().catch(() => {}); }, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Retour sur l'onglet après une absence : relecture immédiate, sans attendre le prochain cycle (compte Stripe compris : courier-3).
  useRevalidation(() => { load(); return relireConnect() || refreshUser(); });

  useEffect(() => {
    activeIdsRef.current = mine.filter((o) => o.status === 'livraison').map((o) => o.id);
  }, [mine]);

  // Son, vibration, notification et compteur d'onglet : nouvelle course disponible, course prise devenue prête.
  const alerte = useAlerteLivreur({
    disponibles: available, mesCourses: mine, pret: !loading,
    actif: user?.adminStatus === 'approved' && user?.stripeConnectStatus === 'active' && !user?.driverPaused,
    // Course annulée avant le retrait : dite aussi à l'écran, en rouge (audit des notifications du 2026-10-17).
    surAnnulee: (o) => toast(t('driverAlert.notifCancelled', { name: o.restaurantName || '' }), 'erreur')
  });

  // Partage de position : watchPosition plutôt qu'un getCurrentPosition relancé toutes les 12 s.
  //
  // Le sondage par setInterval était doublement fragile : un onglet en arrière-plan voit ses minuteurs
  // fortement ralentis, et un téléphone qui se verrouille les suspend tout court — donc le suivi
  // s'arrêtait en silence dès que le livreur rangeait son téléphone dans sa poche, sans que ni lui ni
  // le client ne le voient. watchPosition est alimenté par le GPS lui-même et continue à émettre plus
  // longtemps dans ces conditions.
  //
  // Ce que cela ne règle PAS sur le site : navigateur fermé ou appareil en veille prolongée. La géolocalisation en
  // arrière-plan n'existe pas sur le web. DANS L'APPLICATION, pendant une course en livraison, elle existe depuis le
  // 15/10/2026 (natif.js suivrePositionCourse, service au premier plan avec sa notification) : le suivi reprend quand
  // `enLivraison` change. L'horodatage renvoyé au client reste : une carte figée doit se lire comme telle.
  const enLivraison = mine.some((o) => o.status === 'livraison');
  /* LA POSITION N'EST DEMANDÉE QUE QUAND ELLE SERT (audit du 19/10, courier-14). Le suivi démarrait à l'ouverture de
   * « Courses » pour tout livreur : le navigateur demandait la position à un nouvel inscrit dont le dossier n'était même pas
   * envoyé, contre la promesse de l'inscription (driverGeoNotice : « que lorsque tu voudras recevoir des courses »). Il
   * démarre désormais pour un livreur qui peut rouler et n'est pas en pause, ou qui a une course en main ; avant,
   * PositionRequise demande l'autorisation au-dessus de la liste des courses, au moment où elle sert. */
  const suiviUtile = mine.length > 0 || (user?.adminStatus === 'approved' && user?.stripeConnectStatus === 'active' && !user?.driverPaused);
  useEffect(() => {
    if (user?.locationSharingEnabled === false || !suiviUtile) {
      setSharingLocation(false);
      return undefined;
    }
    let deniedNotified = false;
    let lastSentAt = 0;
    let lastCoords = null;
    let arreter = null;
    let fini = false;

    function send(latitude, longitude) {
      if (!activeIdsRef.current.length) return;
      lastSentAt = Date.now();
      setLastPositionAt(new Date());
      activeIdsRef.current.forEach((id) => {
        api(`/orders/${id}/location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {});
      });
    }

    suivrePositionCourse({
      arrierePlan: enLivraison,
      titre: t('dashDriver.bgTrackingTitle'),
      message: t('dashDriver.bgTrackingMessage'),
      onPosition: ({ latitude, longitude }) => {
        setSharingLocation(true);
        lastCoords = { latitude, longitude };
        // La position peut arriver plusieurs fois par seconde en déplacement : on limite les envois
        // au même rythme que l'ancien sondage, pour ne pas multiplier les requêtes par course.
        if (Date.now() - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
        send(latitude, longitude);
      },
      onErreur: () => {
        setSharingLocation(false);
        if (!deniedNotified) {
          deniedNotified = true;
          toast(t('dashDriver.toastAllowGeo'));
        }
      }
    }).then((stop) => { if (fini) stop(); else arreter = stop; });

    // Battement de cœur. watchPosition n'émet QUE lorsque la position change : un livreur immobile —
    // arrêté devant le restaurant en attendant la commande, ou coincé à un feu — n'envoyait donc plus
    // rien du tout, et le client voyait une carte vide. L'ancien sondage par intervalle envoyait au
    // moins une position toutes les 12 s, immobile ou non ; on rétablit cette garantie en réémettant
    // la dernière position connue quand aucune n'est partie depuis trop longtemps.
    const heartbeat = setInterval(() => {
      if (!lastCoords) return;
      if (Date.now() - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
      send(lastCoords.latitude, lastCoords.longitude);
    }, MIN_LOCATION_SEND_INTERVAL_MS);

    return () => {
      fini = true;
      arreter?.();
      clearInterval(heartbeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationSharingEnabled, enLivraison, suiviUtile]);

  // Refuser une course (B23bis) : elle quitte SA liste, et rien d'autre — le refus n'est relu par aucune
  // autre décision (docs/dispatch.md côté serveur). Retrait local immédiat, sans attendre le rechargement.
  async function refuserOffre(id) {
    try {
      await api(`/orders/${id}/refuse-offer`, { method: 'PATCH', token });
      // La carte glisse vers la gauche, puis quitte la liste (ecran-livreur.css, .ecl-offre.part).
      setPartantes((p) => [...p, id]);
      setTimeout(() => {
        setAvailable((prev) => prev.filter((x) => x.id !== id));
        setPartantes((p) => p.filter((x) => x !== id));
      }, mouvementReduit() ? 0 : 300);
      toast(t('conformite.offerRefused'));
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Course en train d'être prise (bordure iris le temps de la réponse) et cartes refusées qui s'en vont.
  const [prise, setPrise] = useState(null);
  const [partantes, setPartantes] = useState([]);
  async function claim(id) {
    setPrise(id);
    try {
      await api(`/orders/${id}/claim`, { method: 'PATCH', token });
      if (experienceApp()) vibrer([10, 30, 10]);
      await load();
    } catch (e) {
      toast(e.message, 'erreur');
      // Notices à relire (B4), titre de séjour expiré (B2) ou dossier à compléter / pas encore vérifié — y compris l'ancien
      // compte livreur sans dossier, qui y remplit statut et numéro d'entreprise (17/10/2026) : ça se règle dans l'espace
      // livreur, on y va.
      if (['NOTICES_A_ACCEPTER', 'TITRE_SEJOUR_EXPIRE', 'STATUS_NOT_VERIFIED'].includes(e.code)) navigate('/driver/onboarding');
    } finally {
      setPrise(null);
    }
  }

  async function deliver(order, ageVerifie = false) {
    const id = order.id;
    const code = (codeInputs[id] || '').trim();
    if (!code) { toast(t('dashDriver.toastAskCode')); return; }
    if (order.containsAlcohol && !ageVerifie) { setAgeAVerifier(order); return; }
    try {
      await api(`/orders/${id}/deliver`, { method: 'PATCH', token, body: { code, ...(ageVerifie ? { ageCheck: 'verified' } : {}) } });
      setCodeInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setTerminee({ id, fee: order.driverFee ?? order.deliveryFee });
      toast(t('dashDriver.toastDelivered'));
      load();
    } catch (e) {
      toast(e.message, 'erreur');
    }
  }

  // COURSE TERMINÉE (maquette « Course en cours », 2026-10-16) : juste après la remise, le bandeau garde le trajet un moment,
  // le vélo roule jusqu'à la maison et saute. Puis il revient à la disponibilité. Rien d'autre ne dépend de cet état.
  const [terminee, setTerminee] = useState(null);
  useEffect(() => {
    if (!terminee) return undefined;
    const id = setTimeout(() => setTerminee(null), 9000);
    return () => clearTimeout(id);
  }, [terminee]);

  // RETRAIT CONFIRMÉ PAR LE LIVREUR (simulation du 10 oct. 2026) : le commerce n'a plus rien à taper. Il compare à l'œil
  // le code affiché ici avec le sien, remet la commande, et c'est ce bouton qui la fait passer « en livraison ».
  const [retraitEnCours, setRetraitEnCours] = useState(null);
  /* DEUX TEMPS POUR « COMMANDE RÉCUPÉRÉE » (fondateur, 2026-10-17 : « une vérification en deux étapes : oui, puis confirmer »).
   * Le glisser (app) ou le bouton (site) ouvre d'abord la question « Tu as bien la commande ? », avec le nombre d'articles et le
   * commerce ; seul « Oui, j'ai la commande » la marque récupérée — le client voit alors qu'elle est en route. */
  const [retraitAConfirmer, setRetraitAConfirmer] = useState(null);
  async function confirmerRetrait(order) {
    setRetraitEnCours(order.id);
    try {
      await api(`/orders/${order.id}/picked-up`, { method: 'PATCH', token });
      toast(t('dashDriver.toastPickedUp'));
      load();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setRetraitEnCours(null);
    }
  }

  // Âge non prouvé à la porte : la commande est close, la course t'est payée, l'équipe décide du reste.
  async function refuserRemiseAge(order) {
    try {
      await api(`/orders/${order.id}/age-refused`, { method: 'PATCH', token, body: { reason: 'refused_age' } });
      setAgeAVerifier(null);
      toast(t('conformite.ageRefusedDriverDone'));
      load();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Plus de carte « Aujourd'hui » dans la colonne de droite (2026-09-23) : ses trois compteurs
  // (disponibles, à récupérer, en livraison) redisaient les titres des sections de la page, et sur un
  // téléphone la colonne passe SOUS le contenu — le livreur ne la voyait qu'en bas de page. L'état du
  // partage de position qu'elle portait aussi est dans la rangée « Partage de position ».

  // Chargement dans l'app : le bandeau et la feuille dès la première image (Skeleton.jsx, audit « Look and feel »).
  if (loading) return experienceApp() ? <SqueletteEcran /> : <SkeletonCards count={3} />;
  // Voir load() : seulement tant que rien n'a jamais chargé, sinon on garderait les courses en main.
  if (erreur && !chargeReussieRef.current) {
    return <ErrorCard titre={t('dashDriver.loadError')} message={erreur.message} onRetry={() => { setLoading(true); load(); }} />;
  }

  const awaitingPickup = mine.filter((o) => ['preparation', 'pret'].includes(o.status));
  const active = mine.filter((o) => o.status === 'livraison');
  // Courses livrées aujourd'hui : brut · retenue · net quand le serveur joint `driverEarning` à la
  // commande (précompte de l'économie collaborative), sinon le tarif livreur tel quel.
  const aujourdhui = new Date().toDateString();
  const livreesAujourdhui = mine.filter((o) => o.status === 'livre' && new Date(o.deliveredAt || o.updatedAt || o.createdAt).toDateString() === aujourdhui);
  const ligneGain = (o) => (o.driverEarning && o.driverEarning.gross != null
    ? t('dashDriver.earningLine', { gross: dec(o.driverEarning.gross), withholding: dec(o.driverEarning.withholding ?? 0), net: dec(o.driverEarning.net ?? (o.driverEarning.gross - (o.driverEarning.withholding || 0))) })
    : t('dashDriver.rideFee', { fee: dec(o.driverFee ?? o.deliveryFee) }));

  const approuve = user?.adminStatus === 'approved';
  const peutRouler = approuve && user?.stripeConnectStatus === 'active';
  const enPause = !!user?.driverPaused;
  const appli = experienceApp();

  /* LE BANDEAU IRIS (fondateur, 2026-10-16, mockups/tous-les-ecrans.html, « Le vélo roule quand tu es dispo » et « Glisse
     le vélo »). Sans course en main, il porte l'interrupteur : disponible, le vélo roule sur sa route ; en pause, il
     s'arrête. Avec une course en main, il montre son trajet : le vélo attend au commerce, roule vers la maison une fois la
     commande récupérée, et saute à l'arrivée (état `terminee`, quelques secondes après la remise). Une seule course est au
     bandeau — celle qu'on livre d'abord, sinon celle à récupérer — ; les autres suivent en cartes dans la feuille. */
  const principale = approuve ? (active[0] || awaitingPickup[0] || null) : null;
  const autresActives = active.filter((o) => o !== principale);
  const autresRetraits = awaitingPickup.filter((o) => o !== principale);
  const course = principale || (approuve && terminee ? terminee : null);
  const enRetrait = !!principale && principale.status !== 'livraison';
  const fraisCourse = (o) => dec(o.driverFee ?? o.deliveryFee ?? o.fee);
  const etatRetrait = (o) => (o.status === 'pret' ? t('dashDriver.readyToPickUp') : t('dashDriver.preparing'));
  let titreBandeau = null;
  let sousBandeau = null;
  if (principale && enRetrait) {
    titreBandeau = t('ecranLivreur.directionCommerce', { name: principale.restaurantName });
    sousBandeau = [principale.restaurantAddress && t('dashDriver.pickupAt', { address: principale.restaurantAddress }), etatRetrait(principale)].filter(Boolean).join(' · ');
  } else if (principale) {
    titreBandeau = principale.clientName ? t('ecranLivreur.enRouteVers', { name: principale.clientName }) : t('ecranLivreur.enRoute');
    sousBandeau = [t('dashDriver.deliveryAt', { address: principale.address }), principale.travelMinutes && t('ecranLivreur.minutes', { min: principale.travelMinutes })].filter(Boolean).join(' · ');
  } else if (course) {
    titreBandeau = t('ecranLivreur.terminee');
    sousBandeau = `${t('dashDriver.rideFee', { fee: fraisCourse(course) })} · ${t('ecranLivreur.termineeSous')}`;
  } else if (peutRouler && !enPause && selfie?.blocking) {
    // Délai du selfie de contrôle écoulé : aucune offre n'arrive. Le bandeau ne dit plus « Tu es disponible » (audit du
    // 19/10, LIVE-25) ; la carte du selfie, juste dessous, porte le bouton.
    titreBandeau = t('selfieControle.headerTitle');
    sousBandeau = t('selfieControle.headerSub');
  }
  const partageOk = user?.locationSharingEnabled !== false && sharingLocation;

  const interrupteur = (surBlanc) => (
    <button type="button" className={`ecl-service${enPause ? '' : ' on'}${surBlanc ? ' sur-blanc' : ''}`} aria-pressed={!enPause} disabled={togglingPause}
      onClick={() => { if (appli) vibrer(10); togglePause(); }}>
      <span className="ecl-service-txt">
        <b>{enPause ? t('dashDriver.accountPaused') : t('dashDriver.availableToDeliver')}</b>
        {/* Sur un ordinateur, on clique : « Touche pour… » se lit mal à la souris. */}
        <span>{togglingPause ? '…' : enPause ? t(large ? 'siteLivreur.cliqueReprendre' : 'dashDriver.tapToResume') : t(large ? 'siteLivreur.cliquePause' : 'dashDriver.tapToPause')}</span>
      </span>
      <span className="ecl-inter" aria-hidden="true" />
    </button>
  );

  // Un article par ligne, sa quantité dans une case (comme Mes commandes côté client).
  const articles = (o) => (o.items?.length ? (
    <ul className="ecl-articles">
      {o.items.map((i, k) => {
        const extra = [i.options?.length ? i.options.map((x) => x.name).join(', ') : '', i.note ? `« ${i.note} »` : ''].filter(Boolean).join(' ');
        return <li key={k}><span className="ecl-qte">{i.qty}</span><span><b>{i.name}</b>{extra && <small>{extra}</small>}</span></li>;
      })}
    </ul>
  ) : null);

  // À récupérer : le code du comptoir, puis glisser (app) ou le bouton (site) une fois la commande en main.
  const detailRetrait = (o, auBandeau) => (
    <>
      <div className="ecl-code">
        <div className="ecl-code-lib">{t('dashDriver.codeForRestaurant')}</div>
        <div className="ecl-code-valeur">{o.pickupCode}</div>
      </div>
      {o.status !== 'pret' && <p className="small" style={{ margin: '10px 0 0' }}>{t('dashDriver.stillPreparing')}</p>}
      {articles(o)}
      <BoutonsItineraire adresse={o.restaurantAddress} lat={o.restaurantLat} lng={o.restaurantLng} t={t} />
      {!auBandeau && o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
      <div className="small">{t('dashDriver.deliveryAt', { address: o.address })}</div>
      {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${dec(o.distanceKm, 1)} km)` : '' })}</div>}
      <DeliveryTiming order={o} />
      {/* Dans l'application : glisser pour confirmer (un appui dans la poche ne valide rien). Sur le site : le bouton. */}
      <div className="ecl-glisser">
        <GlisserPourConfirmer libelle={t('dashDriver.pickedUpButton')} disabled={retraitEnCours === o.id} onConfirmer={() => setRetraitAConfirmer(o)}>
          <button type="button" className="btn-outline" style={{ width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700 }} disabled={retraitEnCours === o.id} onClick={() => setRetraitAConfirmer(o)}>
            {retraitEnCours === o.id ? '…' : t('dashDriver.pickedUpButton')}
          </button>
        </GlisserPourConfirmer>
      </div>
      <IncidentsCourse order={o} token={token} toast={toast} onChange={load} />
      <ConfirmDialog
        open={retraitAConfirmer?.id === o.id}
        icone="sac"
        title={t('dashDriver.pickupConfirmTitle')}
        message={t('dashDriver.pickupConfirmText', { n: (o.items || []).reduce((n, i) => n + (Number(i.qty) || 1), 0), restaurant: o.restaurantName || '' })}
        confirmLabel={t('dashDriver.pickupConfirmYes')}
        cancelLabel={t('dashDriver.pickupConfirmNo')}
        loading={retraitEnCours === o.id}
        onConfirm={async () => { await confirmerRetrait(o); setRetraitAConfirmer(null); }}
        onCancel={() => setRetraitAConfirmer(null)}
      />
    </>
  );

  // En livraison : sonner / appeler, l'itinéraire, le code du client en cases, puis glisser (app) ou le bouton (site).
  const detailLivraison = (o, auBandeau) => (
    <>
      <BandeauAllergie order={o} />
      <BadgeAlcool order={o} />
      {(o.deliveryInstructions || o.clientPhone) && (
        <div className="ecl-ligne">
          <Icone nom={DELIVERY_INSTRUCTION_OPTIONS.find((x) => x.value === o.deliveryInstructions)?.icon || (o.deliveryInstructions ? 'sonnette' : 'telephone')} taille={20} />
          <span className="ecl-grow">
            {o.deliveryInstructions ? deliveryInstructionLabel(o.deliveryInstructions) : null}
            {o.deliveryNote && <small>{o.deliveryNote}</small>}
            {o.clientPhone && <small><a href={`tel:${o.clientPhone}`}>{telephoneLisible(o.clientPhone)}</a></small>}
          </span>
          {o.clientPhone && <a className="ecl-rond" href={`tel:${o.clientPhone}`} aria-label={o.clientPhone}><Icone nom="telephone" taille={18} /></a>}
        </div>
      )}
      {articles(o)}
      <BoutonsItineraire adresse={o.address} lat={o.deliveryLat} lng={o.deliveryLng} t={t} />
      {!auBandeau && <div className="small">{t('dashDriver.deliveryAt', { address: o.address })}</div>}
      {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
      {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${dec(o.distanceKm, 1)} km)` : '' })}</div>}
      <DeliveryTiming order={o} />
      <p className="ecl-titre-sec">{t('dashDriver.phCustomerCode')}</p>
      <CodeCases libelle={t('dashDriver.phCustomerCode')} valeur={codeInputs[o.id] || ''} onValider={() => deliver(o)}
        onChange={(v) => setCodeInputs((prev) => ({ ...prev, [o.id]: v }))} />
      {/* Taille normale (audit du 15/10/2026) : c'est le geste qui clôt la course, fait d'une main, souvent dehors. */}
      {!appli && <button type="button" className="btn-teal ecl-code-envoi" onClick={() => deliver(o)}>{t('dashDriver.confirmDelivery')}</button>}
      {/* Application : le code du client tapé, on glisse pour livrer (même raison que pour la récupération). */}
      {appli && <div className="ecl-glisser"><GlisserPourConfirmer libelle={t('dashDriver.confirmDelivery')} onConfirmer={() => deliver(o)} /></div>}
      <PhotoDepot order={o} token={token} toast={toast} onLivree={() => { setTerminee({ id: o.id, fee: o.driverFee ?? o.deliveryFee }); load(); }} />
      <IncidentsCourse order={o} token={token} toast={toast} onChange={load} />
    </>
  );

  // Distance et durée d'une course proposée (« 1,2 km · ~6 min »), sur sa carte comme dans le détail du site.
  const voieOffre = (o) => {
    const km = o.distanceKm != null ? (o.longDistance ? t('dashDriver.longDistance', { km: dec(o.distanceKm, 1) }) : t('dashDriver.shortDistance', { km: dec(o.distanceKm, 1) })) : null;
    return [km, o.travelMinutes && t('ecranLivreur.minutes', { min: o.travelMinutes })].filter(Boolean).join(' · ');
  };

  // Une course proposée : son trajet en pointillés, son prix dans une pastille iris, « Prendre la course » en lime.
  const carteOffre = (o) => {
    const voie = voieOffre(o);
    return (
      <article className={`ecl-offre${prise === o.id ? ' prise' : ''}${partantes.includes(o.id) ? ' part' : ''}`} key={o.id}>
        <div className="ecl-offre-tete">
          <span className="ecl-offre-nom"><b>{o.restaurantName}</b><small>{o.items.map(formatOrderItem).join(', ')}</small></span>
          <span className="ecl-prix"><small>{t('ecranLivreur.prixPropose')}</small>{t('ecranLivreur.prixMontant', { fee: fraisCourse(o) })}</span>
        </div>
        <div className="ecl-badges">
          <span className={`ecl-badge ${o.status === 'pret' ? 'lime' : 'doux'}`}>{etatRetrait(o)}</span>
          {o.commune && <span className="ecl-badge neutre">{o.commune}</span>}
        </div>
        <div className="ecl-trajet-carte">
          <span className="ecl-tj-pt" aria-hidden="true"><Icone nom="commerce" taille={16} /></span>
          <span className="ecl-tj-voie">{voie && <b>{voie}</b>}</span>
          <span className="ecl-tj-pt maison" aria-hidden="true"><Icone nom="maison" taille={16} /></span>
        </div>
        {/* Adresse sans numéro ni nom du client avant la prise (le serveur ne les envoie pas). */}
        <div className="ecl-tj-libs">
          <span>{o.restaurantAddress ? t('dashDriver.pickupAt', { address: o.restaurantAddress }) : null}</span>
          <span>{t('dashDriver.deliveryAt', { address: o.address })}<br /><span className="ecl-faint">{t('conformite.offerApproxAddress')}</span></span>
        </div>
        <DeliveryTiming order={o} />
        {o.bonusCents > 0 && <p className="small" style={{ margin: '6px 0 0' }}>{t('conformite.offerBonus', { amount: dec(o.bonusCents / 100) })}</p>}
        <div className="ecl-offre-pied">
          {/* Refuser reste discret et neutre : aucune conséquence pour le livreur. */}
          <button type="button" className="btn-ghost" onClick={() => refuserOffre(o.id)}>{t('conformite.refuseOffer')}</button>
          <button type="button" className="btn-gold" disabled={prise === o.id} onClick={() => claim(o.id)}>{prise === o.id ? '…' : t('dashDriver.takeRide')}</button>
        </div>
      </article>
    );
  };

  const urgence = peutRouler && <span className="ecl-urgence"><BoutonUrgence token={token} toast={toast} /></span>;

  /* ---------- Le site (jamais l'app) : le bandeau du tableau de bord, la liste et le détail d'une course ---------- */
  const site = !appli;
  // Les courses livrées aujourd'hui, pourboires compris (100 % au livreur) : ce qu'il a gagné dans la journée. Les mêmes
  // montants que la liste « Livrées aujourd'hui » plus bas ; Gains reste la page qui fait foi (année, mois, relevés).
  const gainsJour = livreesAujourdhui.reduce((s, o) => s + Number(o.driverFee ?? o.deliveryFee ?? 0) + Number(o.tipAmount || 0), 0);
  const vehiculeNom = vehicule?.type ? t(`courierOnboarding.vehicle_${vehicule.type}`) : null;
  const contexte = [user?.name, vehiculeNom].filter(Boolean).join(' · ');
  const titreSite = titreBandeau || (peutRouler ? (enPause ? t('siteLivreur.enPause') : t('siteLivreur.disponible')) : t('nav.rides'));
  const sousSite = sousBandeau || (!peutRouler ? null : enPause ? t('siteLivreur.pauseSous')
    : available.length === 0 ? t('siteLivreur.aucuneProposee') : available.length === 1 ? t('siteLivreur.proposeeUne') : t('siteLivreur.proposees', { n: available.length }));

  const trajetBandeau = course ? (
    <div className="ecl-trajet" aria-label={t('ecranLivreur.ariaTrajet')} role="img">
      <span className="ecl-pt"><Icone nom="commerce" taille={18} /></span>
      <RouteVelo key={`course-${course.id}`} position={enRetrait ? 12 : principale ? 50 : 88} depart={enRetrait ? undefined : 12} roule={!!principale && !enRetrait} saut={!principale} />
      <span className={`ecl-pt maison${principale ? '' : ' arrivee'}`}><Icone nom="maison" taille={18} /></span>
    </div>
  ) : (
    <RouteVelo key="dispo" position={50} roule={peutRouler && !enPause} pause={peutRouler && enPause} />
  );
  // Partage de position pendant une livraison (c'était la rangée « Partage de position » de la page).
  const partage = active.length > 0 && (
    <p className={`ecl-partage ${partageOk ? 'ok' : 'attention'}`}>
      <i aria-hidden="true" />
      <span><b>{t('dashDriver.locationSharing')}</b> · {user?.locationSharingEnabled === false
        ? t('dashDriver.sharingDisabledSub')
        : sharingLocation
          ? t('dashDriver.sharingOnSub', { last: lastPositionAt ? t('dashDriver.geoLastSentDot', { time: formatClock(lastPositionAt) }) : '' })
          : t('dashDriver.sharingWaitingSub')}</span>
    </p>
  );

  /* LE BANDEAU DU SITE (mockups/site-ordinateur.html, « Livreur ») : qui roule et sur quoi, « Tu es disponible » en titre,
     les courses proposées en sous-titre, les gains du jour à droite ; dessous l'interrupteur et, à côté, Urgence ; puis la
     route. Une course en main : son trajet, comme dans l'app. La disposition (deux colonnes sur un ordinateur, une
     pile sur un téléphone) est dans site-livreur.css (.ecl-bandeau-site). */
  const bandeauSite = (
    <section className={`ecl-bandeau ecl-bandeau-site${course ? ' avec-course' : ''}`}>
      <p className="ecl-b-ctx">
        <span>{course ? <><b>{t('ecranLivreur.course')}</b> · {t('ecranLivreur.prixMontant', { fee: fraisCourse(course) })}</> : (contexte || t('nav.rides'))}</span>
        {!principale && course && <span className="ecl-chip">{t('ecranLivreur.livree')}</span>}
      </p>
      {peutRouler && (
        <p className="ecl-gains-j">
          <small>{livreesAujourdhui.length === 0 ? t('siteLivreur.aujourdhui') : livreesAujourdhui.length === 1 ? t('siteLivreur.aujourdhuiUne') : t('siteLivreur.aujourdhuiCourses', { n: livreesAujourdhui.length })}</small>
          <b>{euros(gainsJour)}</b>
        </p>
      )}
      <h1 className="ecl-b-titre" key={titreSite}>{titreSite}</h1>
      {sousSite && <p className="ecl-b-sous">{sousSite}</p>}
      {!course && peutRouler && interrupteur(false)}
      {urgence}
      {trajetBandeau}
      {partage}
    </section>
  );

  const bandeauAppli = (
    <section className="ecl-bandeau">
      <div className="ecl-b-haut">
        {course
          ? <span><b>{t('ecranLivreur.course')}</b> · {t('ecranLivreur.prixMontant', { fee: fraisCourse(course) })}</span>
          : <span><b>{t('nav.rides')}</b></span>}
        {/* Urgence (accident, agression, malaise) : 112 d'abord, puis l'équipe Fairide avec la position (BoutonUrgence.jsx). */}
        <span className="ecl-b-droite">{!principale && course && <span className="ecl-chip">{t('ecranLivreur.livree')}</span>}{urgence}</span>
      </div>
      {titreBandeau && <h1 className="ecl-b-titre" key={titreBandeau}>{titreBandeau}</h1>}
      {sousBandeau && <p className="ecl-b-sous">{sousBandeau}</p>}
      {/* L'INTERRUPTEUR EN TÊTE (2026-09-23), sur le bandeau depuis le 2026-10-16 : la première chose que le livreur voit,
          c'est s'il reçoit des courses ou non, et le geste pour changer, sur toute la largeur. */}
      {!course && peutRouler && interrupteur(false)}
      {trajetBandeau}
      {partage}
    </section>
  );

  // La course en main d'abord (je livre → je vais chercher), puis les autres courses en main. Une section vide ne s'affiche pas.
  const blocEnMain = (enCarte) => (
    <>
      {principale && (enCarte
        ? <div className="ecl-course-carte ecl-en-main">{enRetrait ? detailRetrait(principale, true) : detailLivraison(principale, true)}</div>
        : (enRetrait ? detailRetrait(principale, true) : detailLivraison(principale, true)))}

      {autresActives.length > 0 && <h2 className="ecl-h2">{t('dashDriver.myOngoing')}</h2>}
      {autresActives.map((o) => (
        <div className="ecl-course-carte" key={o.id}>
          <div className="ecl-course-tete"><span><b>{o.restaurantName}</b> → {o.clientName}</span><span className="ecl-badge doux">{t('dashDriver.rideFee', { fee: fraisCourse(o) })}</span></div>
          {detailLivraison(o, false)}
        </div>
      ))}

      {autresRetraits.length > 0 && <h2 className="ecl-h2">{t('dashDriver.awaitingPickup')}</h2>}
      {autresRetraits.map((o) => (
        <div className="ecl-course-carte" key={o.id}>
          <div className="ecl-course-tete"><b>{o.restaurantName}</b><span className={`ecl-badge ${o.status === 'pret' ? 'lime' : 'doux'}`}>{etatRetrait(o)}</span></div>
          <div className="small" style={{ marginBottom: 10 }}>{t('dashDriver.rideFee', { fee: fraisCourse(o) })}</div>
          {detailRetrait(o, false)}
        </div>
      ))}
    </>
  );

  // Paiements d'abord (validé mais Stripe pas actif) ou pause : ce qui remplace la liste des courses.
  /* Validé mais paiements pas encore actifs : le serveur refuse toute prise de course (routes/orders.js, 403). La
     liste montrait quand même les offres et leurs boutons « Prendre », qui échouaient un par un. On dit plutôt ce qui
     manque, avec le seul bouton de l'écran. */
  const blocSansListe = !peutRouler ? (
    <EtatVide icone="carteBancaire" titre={t('dashDriver.paymentsFirstTitle')} texte={t('dashDriver.paymentsFirstText')}>
      {user?.stripeConnectStatus === 'restricted' || paiementsOuverts() ? (
        <button type="button" className="btn-gold" disabled={connecting} onClick={connectOnboard}>
          {connecting ? '...' : user?.stripeConnectStatus === 'restricted' ? t('dashDriver.complete') : t('dashDriver.paymentsActivateBtn')}
        </button>
      ) : null}
    </EtatVide>
  ) : enPause ? (
    <div className="empty" style={{ marginTop: 18 }}>{t('dashDriver.pausedText')}</div>
  ) : null;

  const blocSac = sac?.option === 'fairide' && sac.depositStatus !== 'refunded' && (
    <div className="card sac-fairide" style={{ borderLeft: '4px solid var(--iris)' }}>
      <b>{t('dashDriver.bagTitle')}</b>
      <p className="small" style={{ margin: '4px 0 0' }}>{t(`dashDriver.bag_${sac.depositStatus}`, { amount: Number(sac.depositAmount || 40).toFixed(0) })}</p>
    </div>
  );
  const titreOffres = <h2 className="ecl-h2">{t('dashDriver.availableOrders')}{available.length > 0 && <span className="ecl-badge doux">{available.length}</span>}</h2>;
  /* LA TOURNÉE (fondateur, 2026-10-17) : jusqu'à trois courses à la fois. Dès qu'une course est en main, la liste ne montre
     que les courses sur son chemin : la règle est dite ici, avec ses chiffres, pour que le livreur sache pourquoi la liste
     est plus courte. Les mêmes pour tous (notice d'information, section 2). */
  const nEnMain = awaitingPickup.length + active.length;
  const blocTournee = tournee && nEnMain > 0 && (
    <p className="ecl-tournee">
      <span className="ecl-tournee-points" aria-hidden="true">
        {Array.from({ length: tournee.max }, (_, i) => <i key={i} className={i < nEnMain ? 'plein' : ''} />)}
      </span>
      <span>{tournee.max === 1 ? t('dashDriver.tourneeUne')
        : nEnMain >= tournee.max ? t('dashDriver.tourneePleine', { max: tournee.max })
          : t('dashDriver.tourneeRegle', { n: nEnMain, max: tournee.max, radius: tournee.radius, delay: tournee.delay })}</span>
    </p>
  );
  const blocGrille = vehicule?.type && (
    <details className="ecl-grille">
      <summary><Icone nom="euro" taille={16} />{['velo', 'velo_electrique'].includes(vehicule.type) ? t('ecranLivreur.grilleVelo') : t('ecranLivreur.grilleMoteur')}</summary>
      <p className="small">
        {['velo', 'velo_electrique'].includes(vehicule.type) ? t('dashDriver.bikeRule', { km: vehicule.bikeMaxKm }) : t('dashDriver.motorRule', { km: vehicule.bikeMaxKm })}
        {vehicule.rate !== undefined && <> {t('dashDriver.rateRule', { base: dec(vehicule.base || 0), baseKm: vehicule.baseKm, rate: dec(vehicule.rate || 0) })}</>}
      </p>
    </details>
  );

  // Les courses proposées, cartes complètes (app, téléphone, et la colonne de droite du site quand une course est en main).
  const blocOffres = blocSansListe || (
    <>
      {blocSac}
      {titreOffres}
      {blocTournee}
      {blocGrille}
      <NotifCourses />
      {/* Pas de course sans position autorisée (PositionRequise.jsx) : le client ne pourrait pas suivre la livraison. */}
      <PositionRequise>
        {available.length === 0 && <EtatVide scene="commandes" titre={t('dashDriver.noneAvailable')} />}
        {available.map(carteOffre)}
      </PositionRequise>
      {/* Son, vibration, notifications : sous les offres depuis le 2026-10-16 (maquette), pour que la première course
          proposée tienne dans le premier écran. Site seulement (deuxième audit design, 2026-10-19) : la carte promettait
          l'alerte « tant que cette page reste ouverte, sinon un e-mail », phrase du site ; l'app a les notifications push
          (NotifCourses juste au-dessus), « Prête à récupérer » est écrit sur la carte de la course, et le son des alertes se
          règle dans Mon compte (SonAlertesLivreur.jsx). L'alerte elle-même (useAlerteLivreur) sonne toujours. */}
      {!appli && <AlerteLivreurBar {...alerte} />}
    </>
  );

  const blocLivrees = livreesAujourdhui.length > 0 && (<>
    <h2 className="ecl-h2">{t('dashDriver.deliveredToday')}</h2>
    <div className="ecl-groupe">
      {livreesAujourdhui.map((o) => (
        <div className="ecl-lc" key={o.id}>
          <span className="ecl-tuile-ic" aria-hidden="true"><Icone nom="commandes" taille={18} /></span>
          <span className="ecl-grow"><b>{o.restaurantName}</b>{o.commune ? ` → ${o.commune}` : ''}<small>{ligneGain(o)}</small></span>
          {o.deliveredAt && <span className="ecl-badge neutre">{formatClock(new Date(o.deliveredAt))}</span>}
        </div>
      ))}
    </div>
  </>);

  /* LA LISTE ET LE DÉTAIL (site, ordinateur). À gauche, chaque course est un bouton compact (le restaurant, le prix, le trajet) ;
     la course choisie est cerclée d'iris et son détail, avec sa carte, est à droite, avec « Prendre la course » et
     « Refuser ». Par défaut, la première de la liste. Refuser fait partir la carte comme dans l'app ; la suivante prend
     sa place. */
  const offreChoisie = available.find((o) => o.id === choisie) || available.find((o) => !partantes.includes(o.id)) || null;
  const choixOffre = (o) => {
    const on = offreChoisie?.id === o.id;
    return (
      <button type="button" key={o.id} className={`ecl-choix${on ? ' on' : ''}${partantes.includes(o.id) ? ' part' : ''}`} aria-pressed={on} onClick={() => setChoisie(o.id)}>
        <span className="ecl-offre-tete">
          <span className="ecl-offre-nom"><b>{o.restaurantName}</b><small>{[etatRetrait(o), o.commune].filter(Boolean).join(' · ')}</small></span>
          <span className="ecl-prix"><small>{t('ecranLivreur.prixPropose')}</small>{t('ecranLivreur.prixMontant', { fee: fraisCourse(o) })}</span>
        </span>
        <span className="ecl-trajet-carte" aria-hidden="true">
          <span className="ecl-tj-pt"><Icone nom="commerce" taille={16} /></span>
          <span className="ecl-tj-voie">{voieOffre(o) && <b>{voieOffre(o)}</b>}</span>
          <span className="ecl-tj-pt maison"><Icone nom="maison" taille={16} /></span>
        </span>
        <span className="ecl-tj-libs"><span>{o.restaurantAddress}</span><span>{o.address}</span></span>
      </button>
    );
  };
  // Le retrait et la livraison d'une course, avec la carte au-dessus : le détail d'une offre et la course en main.
  const lieux = (o, approx) => (
    <div className="ecl-lieux">
      <div><Icone nom="commerce" taille={18} /><span><b>{t('siteLivreur.retrait')}</b><small>{[o.restaurantName, o.restaurantAddress].filter(Boolean).join(', ')}</small></span></div>
      <div><Icone nom="maison" taille={18} /><span><b>{t('siteLivreur.livraison')}</b><small>{o.address}{approx && <><br /><span className="ecl-faint">{t('conformite.offerApproxAddress')}</span></>}</small></span></div>
    </div>
  );
  const carte = (o) => (
    <Suspense fallback={<div className="ecl-carte-course" style={{ height: 250 }} />}>
      <CarteCourse depart={[o.restaurantLat, o.restaurantLng]} arrivee={[o.deliveryLat, o.deliveryLng]} hauteur={250} />
    </Suspense>
  );
  const detailOffre = (o) => (
    <article className="ecl-fiche-course" aria-labelledby="ecl-fc-titre">
      {carte(o)}
      <div className="ecl-fc-corps">
        <div className="ecl-fc-tete">
          <div>
            <h2 id="ecl-fc-titre">{o.restaurantName} → {String(o.address || '').split(',')[0]}</h2>
            <p className="small">{[voieOffre(o), etatRetrait(o)].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="ecl-prix"><small>{t('ecranLivreur.prixPropose')}</small>{t('ecranLivreur.prixMontant', { fee: fraisCourse(o) })}</span>
        </div>
        {lieux(o, true)}
        {articles(o)}
        <DeliveryTiming order={o} />
        {o.bonusCents > 0 && <p className="small" style={{ margin: '6px 0 0' }}>{t('conformite.offerBonus', { amount: dec(o.bonusCents / 100) })}</p>}
        <div className="ecl-fc-actions">
          <button type="button" className="btn-gold" disabled={prise === o.id} onClick={() => claim(o.id)}>{prise === o.id ? '…' : t('dashDriver.takeRide')}</button>
          {/* Refuser reste neutre : aucune conséquence pour le livreur. */}
          <button type="button" className="btn-outline" onClick={() => refuserOffre(o.id)}>{t('conformite.refuseOffer')}</button>
        </div>
      </div>
    </article>
  );

  let grilleSite = null;
  if (large && approuve) {
    let gauche;
    let droite = null;
    if (principale) {
      // Une course en main : son détail (codes, itinéraire, boutons) à gauche ; sa carte, l'interrupteur et les éventuelles
      // nouvelles offres à droite.
      gauche = <>{blocEnMain(true)}{blocLivrees}</>;
      droite = (
        <>
          <article className="ecl-fiche-course">
            {carte(principale)}
            <div className="ecl-fc-corps">{lieux(principale, false)}</div>
          </article>
          {peutRouler && interrupteur(true)}
          {blocOffres}
        </>
      );
    } else if (blocSansListe) {
      gauche = <>{blocSansListe}{blocLivrees}</>;
    } else {
      gauche = (
        <>
          {blocSac}
          {titreOffres}
          {blocGrille}
          <PositionRequise>
            {available.length === 0 && <EtatVide scene="commandes" titre={t('dashDriver.noneAvailable')} />}
            {available.length > 0 && <div className="ecl-choix-liste">{available.map(choixOffre)}</div>}
          </PositionRequise>
          {available.length > 0 && <p className="small ecl-astuce">{t('siteLivreur.astuceTelephone')}</p>}
          <NotifCourses />
          <AlerteLivreurBar {...alerte} />
          {blocLivrees}
        </>
      );
      if (offreChoisie) droite = <PositionRequise repli={null}>{detailOffre(offreChoisie)}</PositionRequise>;
    }
    grilleSite = (
      <div className={`ecl-site-grille${droite ? '' : ' seule'}`}>
        <div className="ecl-site-gauche">{gauche}</div>
        {droite && <div className={`ecl-site-droite${principale ? '' : ' collante'}`}>{droite}</div>}
      </div>
    );
  }

  return (
    <div className="ecl ecl-tableau">
      <TirerPourActualiser onActualiser={load} />
      {site ? bandeauSite : bandeauAppli}

      <div className="ecl-feuille">
        <BandeauOuverture role="driver" />
        {/* Selfie de contrôle au hasard à la prise de service (CODE-14) : 60 minutes pour le prendre, ensuite plus de nouvelle
            course tant qu'il n'est pas envoyé (controleSelfie.js côté serveur). */}
        {peutRouler && <SelfieControle token={token} onDepose={load} onEtat={setSelfie} />}
        {/* Invitation d'un commerce à devenir son livreur dédié, à accepter ou refuser (audit du 19/10, shop-301). */}
        <LivreurDedie token={token} toast={toast} onChange={load} />

        {!approuve ? (() => {
          /* LE MESSAGE SUIT L'ÉTAT DU DOSSIER (audit du 15/10/2026). « L'équipe vérifie ton dossier » s'affichait aussi à un
             livreur qui ne l'avait pas encore envoyé, ou dont le dossier était à corriger — sans bouton : il attendait une
             vérification qui n'avait pas commencé. Brouillon ou refusé : un seul bouton vers le dossier. Envoyé : on attend,
             avec le dossier consultable. Bloqué : inchangé. */
          const bloque = user?.adminStatus === 'blocked';
          const statut = dossier?.statut;
          const aCompleter = !bloque && statut === 'draft';
          const aCorriger = !bloque && statut === 'rejected';
          const titre = bloque ? t('dashDriver.blockedTitle') : aCompleter ? t('dashDriver.fileToCompleteTitle') : aCorriger ? t('dashDriver.fileToFixTitle') : t('dashDriver.waitingTitle');
          const texte = bloque ? t('dashDriver.blockedText') : aCompleter ? t('dashDriver.fileToCompleteText') : aCorriger ? t('dashDriver.fileToFixText') : t('dashDriver.waitingEmpty');
          return (
            <div className="empty" style={{ padding: '40px 20px' }}>
              {/* Une icône, pas son nom : la ligne affichait littéralement « horloge » ou « interdit » en
                  34px — reliquat du remplacement des emojis par <Icone>, où la chaîne était restée seule. */}
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icone nom={bloque ? 'interdit' : (aCompleter || aCorriger) ? 'dossier' : 'horloge'} taille={34} /></div>
              <b>{titre}</b>
              <p className="small" style={{ margin: '6px auto 0', maxWidth: 420 }}>{texte}</p>
              {aCorriger && dossier.motif && <p className="small" style={{ margin: '6px auto 0', maxWidth: 420, color: 'var(--red)' }}>{t('courierOnboarding.rejectedReason', { reason: dossier.motif })}</p>}
              {(aCompleter || aCorriger) && (
                <Link to="/driver/onboarding" className="btn-gold" style={{ display: 'inline-block', marginTop: 14 }}>{aCorriger ? t('dashDriver.fileToFixBtn') : t('dashDriver.fileToCompleteBtn')}</Link>
              )}
              {!bloque && !aCompleter && !aCorriger && (
                <Link to="/driver/onboarding" className="btn-outline btn-sm" style={{ display: 'inline-block', marginTop: 14 }}>{t('dashDriver.fileSeeBtn')}</Link>
              )}
            </div>
          );
        })() : grilleSite || (<>
          {/* LA COURSE EN MAIN D'ABORD. L'ordre suit l'urgence : je livre → je vais chercher → je pourrais prendre. La course
              du bandeau ouvre la feuille ; une section vide ne s'affiche pas. */}
          {blocEnMain(false)}

          {/* Une course en main : le bandeau montre son trajet, l'interrupteur descend ici. Se mettre en pause coupe les
              nouvelles offres, pas les courses déjà prises. */}
          {course && peutRouler && interrupteur(true)}

          {blocOffres}

          {blocLivrees}
        </>)}
      </div>
      <VerificationAge order={ageAVerifier} onFermer={() => setAgeAVerifier(null)}
        onVerifie={() => { const o = ageAVerifier; setAgeAVerifier(null); deliver(o, true); }}
        onRefuse={() => refuserRemiseAge(ageAVerifier)} />
    </div>
  );
}
