import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { definirModeEquipe } from '../../modeEquipe';
import { api } from '../../api';
import { experienceApp, achatsCommerceAutorises } from '../../natif';
import { ouvrirStripe } from '../../ouvrirStripe';
import { useAuth } from '../../context/AuthContext';
import usePushNotifications from '../../hooks/usePushNotifications';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import ErrorCard from '../../components/ErrorCard';
import NewOrderAlertBar from '../../components/NewOrderAlertBar';
import NouvelleCommandeModale from '../../components/NouvelleCommandeModale';
import BandeATraiter from '../../components/commerce/BandeATraiter';
import SonTerminal from '../../components/commerce/SonTerminal';
import LigneCompte from '../../components/LigneCompte';
import useNewOrderAlert from '../../hooks/useNewOrderAlert';
import useRevalidation from '../../useRevalidation';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import BandeauOuverture from '../../components/BandeauOuverture';
import MiseEnLigne from '../../components/commerce/MiseEnLigne';
import { demarrerTerminalNavigateur, EVENEMENT_COMMANDE } from '../../terminalNavigateur';
import Icone from '../../components/Icone';
import '../../site-pro.css';

// Charge une seule fois restaurant/orders/drivers et les partage aux sous-pages via
// l'outlet context, plutôt que de dupliquer ce chargement dans chacune. Porte aussi tout ce qui est
// commun à toutes les sous-pages : création du commerce quand le compte n'en a pas (les écrans de l'inscription,
// pages/app/InscriptionAppli.jsx) et bannières (validation/abonnement/Stripe).
// Les écrans de l'inscription ne servent qu'à un compte sans commerce : chargés à la demande.
const InscriptionAppli = lazy(() => import('../app/InscriptionAppli'));
// Promotions et Factures les ont rejointes dans l'app aussi le 2026-10-19 (fondateur, finitions-appli.html, section 4 :
// CadreSite `appli`).
// Questions, Mode d'emploi et Aperçu client aussi depuis le 2026-10-25 (maquettes/une-action/panier-et-site, réponse 9 :
// « bandeau partout ») : ils ne l'avaient que sur le site. « Tes engagements » depuis le 2026-10-27 (EngagementsPage.jsx).
const PAGES_BANDEAU = ['/dashboard', '/dashboard/edit', '/dashboard/orders', '/dashboard/menu', '/dashboard/stats',
  '/dashboard/promotions', '/dashboard/invoices', '/dashboard/questions', '/dashboard/guide', '/dashboard/preview', '/dashboard/engagements',
  // Le terminal avait la seule page du commerce sans bandeau ni « ← Commerce » (S9 de maquettes/audit-ecrans, 2026-10-27).
  '/dashboard/terminal'];
const SITE = !experienceApp();
// Dernier commerce ouvert sur cet appareil, pour un compte qui en a plusieurs (shop-411). Un identifiant, rien de plus.
const CLE_DERNIER_COMMERCE = 'fairide_dernier_commerce';

export default function DashboardLayout() {
  const { t } = useLanguage();
  const { token, user, roles, actingAs, actingAdminEmail, quitterAction, refreshUser, changerRole, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  // /dashboard/edit est l'ancienne adresse des infos : même page (la redirection ne joue qu'avec un restaurant).
  const lieu = useLocation();
  const chemin = lieu.pathname.replace(/\/$/, '');
  // Retour de Stripe (`?connect=return`, ou `refresh` quand le lien a expiré / a été quitté en route) : lu à chaque
  // navigation, pas seulement au montage — dans l'app le retour est un historique.push et ce tableau de bord reste monté
  // (audit du 19/10, shop-7).
  const retourConnect = new URLSearchParams(lieu.search).get('connect');
  const surAccueil = ['/dashboard', '/dashboard/edit'].includes(chemin);
  // Pages au bandeau iris (2026-10-16, ecran-commerce.css) : elles portent elles-mêmes le nom du commerce et posent
  // les blocs communs (alertes, prochaine étape, alerte de commande) en tête de leur feuille blanche.
  const avecBandeau = PAGES_BANDEAU.includes(chemin);
  // Commandes sur le site, sur un ordinateur : le son, l'alarme et la prochaine étape montent dans le bandeau de la page
  // (OrdersPage) ; la feuille ne garde que les deux alertes. Sur un téléphone, le site montre les commandes comme l'app
  // (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 11). Dans l'app, rien ne change.
  const siteLarge = useSiteLarge(900);
  const commandesSite = SITE && siteLarge && chemin === '/dashboard/orders';
  const [myRestos, setMyRestos] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  /* UNE RELECTURE PARTIE AVANT UN GESTE NE L'EFFACE PLUS (revue du 24/10). « Prête » ou « Accepter » changent la liste ici
     tout de suite (modifierCommandes) ; un sondage de 15 s parti juste avant revenait ensuite avec l'état d'avant, et la
     carte retournait « En préparation » jusqu'au relevé suivant. Chaque geste monte ce compteur : une relecture qui le
     retrouve changé à son retour ne remplace pas la liste. La relecture lancée après le geste (actionOptimiste.js,
     `rafraichir`) part, elle, après lui, et passe. */
  const versionCommandes = useRef(0);
  const modifierCommandes = useCallback((maj) => { versionCommandes.current += 1; setOrders(maj); }, []);
  // Ce que la vue « service » calcule côté serveur (audit du 19/10, shop-213) : le nombre de commandes closes (titre de
  // l'historique, chargé à la demande) et celles du mois (accueil), puisque le tableau ne reçoit plus tout l'historique.
  const [statsService, setStatsService] = useState(null);
  /* LA LISTE EST-ELLE À JOUR ? (audit du 19/10, CROSS-31 et shop-217). Les relectures de fond sont silencieuses : un
     serveur en panne, un Wi-Fi sans Internet ou un membre retiré laissaient la vieille liste à l'écran sans un mot, et
     « Pas encore de commande » quand rien n'était jamais arrivé. « echecs » compte les relectures ratées d'affilée,
     « derniereMaj » l'heure de la dernière réussie, « accesPerdu » un 403 (membre retiré, commerce fermé). */
  const [etatCommandes, setEtatCommandes] = useState({ echecs: 0, derniereMaj: null, erreur: null, accesPerdu: false });
  const [drivers, setDrivers] = useState([]);

  // Les écrans de l'inscription, ouverts d'eux-mêmes quand le compte n'a pas de commerce (voir chargerCommerces).
  const [creationOuverte, setCreationOuverte] = useState(false);
  // Son + notification système + compteur dans le titre de l'onglet à chaque nouvelle commande.
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  // Échec du premier chargement (réseau, serveur en redéploiement) : sans ceci la page restait vide, sans
  // rien d'autre qu'un toast, et il fallait recharger à la main. Deux reprises automatiques, puis un bouton.
  const [erreurChargement, setErreurChargement] = useState(null);
  const tentatives = useRef(0);
  const orderAlert = useNewOrderAlert(orders, ordersLoaded);
  // La feuille « Nouvelle commande » (NouvelleCommandeModale) : l'identifiant de la commande qu'elle montre. Elle s'ouvre
  // d'elle-même à l'arrivée d'une commande, ou quand on touche « 1 commande à traiter » sur l'accueil (audit design 2).
  const [feuilleCommande, setFeuilleCommande] = useState(null);
  // Notifications push : la seule alerte qui survive a l'onglet ferme (voir src/push.js).
  const push = usePushNotifications(token);

  const [connecting, setConnecting] = useState(false);
  // La rangée d'état dépliée en tête du tableau de bord (validation), null si aucune.
  const [statutOuvert, setStatutOuvert] = useState(null);
  const statutReluRef = useRef(false); // statut Stripe « en attente » relu une fois par page (voir loadDashboard)

  // Plus de carte « Aujourd'hui » dans la colonne de droite (2026-09-23). Elle comptait TOUTES les
  // commandes jamais reçues (le serveur renvoie l'historique complet) sous le titre « Aujourd'hui »,
  // additionnait au chiffre d'affaires les commandes refusées et annulées, et affichait un « Économisé
  // vs les grandes plateformes » calculé sur une commission supposée de 30 %, que rien ne permettait de
  // vérifier. Le nombre de commandes en cours et du jour est maintenant en tête de la page Commandes.

  // Terminal « navigateur » (Goodcom sans coque Android) : si CET appareil est associé au commerce, il imprime les
  // tickets de la file d'impression tant que le tableau de bord est ouvert (voir terminalNavigateur.js).
  useEffect(() => { demarrerTerminalNavigateur(); }, []);
  // Membre de l'équipe (staffRole) : partagé avec la barre de navigation et Mon compte (modeEquipe.js).
  useEffect(() => { definirModeEquipe(myRestos?.find((r) => r.id === restoId)?.staffRole === 'service'); }, [myRestos, restoId]);
  // PREMIÈRE REQUÊTE EN ÉCHEC (audit du 19/10, CROSS-30) : la liste des commerces ne venait pas (coupure réseau, serveur
  // en redéploiement) → un toast, puis le squelette pour toujours : ni son de nouvelle commande, ni bouton, il fallait
  // tuer l'app. Même règle que loadDashboard : deux reprises automatiques (2,5 s puis 5 s), puis la carte d'échec avec
  // « Réessayer ». Une fois la liste reçue, tout repart comme au premier chargement (pickResto, relecture toutes les 15 s,
  // alerte de nouvelle commande).
  const [erreurListe, setErreurListe] = useState(null);
  const tentativesListe = useRef(0);
  const repriseListe = useRef(null);
  useEffect(() => () => clearTimeout(repriseListe.current), []);
  function chargerCommerces() {
    api('/restaurants/mine/dashboard', { token }).then((list) => {
      setErreurListe(null); tentativesListe.current = 0;
      setMyRestos(list);
      // Un seul restaurant possible par compte -> pas besoin de le faire choisir dans une liste, on l'ouvre direct.
      if (list.length === 1) pickResto(list[0].id, list[0]);
      /* PLUSIEURS COMMERCES (le sien et celui d'une équipe, audit du 19/10, shop-411) : rien n'était choisi, et la page
         restait sur un squelette sans fin. On ouvre celui que l'adresse demande (?resto=, depuis l'invitation), sinon le
         dernier choisi sur cet appareil ; à défaut, la liste de choix reste seule, sans squelette. */
      else if (list.length > 1) {
        let voulu = new URLSearchParams(window.location.search).get('resto');
        if (!voulu) { try { voulu = localStorage.getItem(CLE_DERNIER_COMMERCE); } catch { /* sans stockage */ } }
        const r = list.find((x) => x.id === voulu);
        if (r) pickResto(r.id, r);
      }
      /* PAS ENCORE DE COMMERCE (casquette « restaurant » prise depuis Mes casquettes, ou création échouée à l'inscription) :
         les écrans de l'inscription, sans les questions du compte (fondateur, 2026-10-27 : « on ne peut pas avoir deux
         processus qui font la même chose »). Avant, un formulaire à part (CreationCommerce.jsx) ou une création silencieuse
         depuis ce que le navigateur avait gardé de l'inscription. */
      else if (list.length === 0) setCreationOuverte(true);
      // Le commerce a été créé automatiquement à l'inscription : l'indice local ne sert plus qu'à ouvrir la
      // demande de carte. Le site web n'est plus gardé dans le navigateur : MenuPage.jsx lit celui de la fiche.
      if (list.length > 0) {
        try {
          const h = JSON.parse(localStorage.getItem('fairide_resto_hint') || 'null');
          if (h) {
            ouvrirDemandeCarte(list[0]?.id, h);
            localStorage.removeItem('fairide_resto_hint');
          }
        } catch { /* rien */ }
      }
    }).catch((e) => {
      // Objet neuf à chaque échec, comme erreurChargement : un message identique ne déclencherait pas de nouveau rendu.
      setErreurListe({ message: e.message, n: tentativesListe.current });
      if (tentativesListe.current < 2) { tentativesListe.current += 1; repriseListe.current = setTimeout(chargerCommerces, 2500 * tentativesListe.current); }
    });
  }
  useEffect(() => {
    chargerCommerces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // RETOUR DE STRIPE (audit du 19/10, shop-7). Avant : « en cours de validation » à chaque retour, y compris quand le lien
  // avait expiré ou que le commerçant avait quitté Stripe à mi-chemin ; et dans l'app, aucun statut relu (le tableau de bord
  // restait monté). Maintenant : on relit le statut chez Stripe, on recharge la fiche, et le message dit ce qui est vrai.
  useEffect(() => {
    if (!retourConnect || !restoId) return;
    navigate('/dashboard', { replace: true });
    api(`/restaurants/${restoId}/connect/refresh`, { method: 'POST', token })
      .then((r) => {
        const statut = r?.stripeConnectStatus;
        if (statut === 'active') toast(t('dashResto.toastPaymentsActive'), 'succes');
        else if (statut === 'pending' && retourConnect === 'return') toast(t('dashResto.toastPaymentsValidating'));
        // Refusé : la rangée d'état du tableau de bord le dit déjà, avec la marche à suivre.
        else if (statut !== 'rejected') toast(t('dashResto.toastPaymentsUnfinished'));
      })
      .catch((e) => toast(e.message, 'erreur'))
      .finally(() => loadDashboard(restoId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retourConnect, restoId]);

  // Rafraîchissement : les commandes toutes les 15 s, même onglet en arrière-plan (c'est ce qui fait sonner l'alerte
  // « nouvelle commande », voir useNewOrderAlert) ; la fiche complète et les livreurs une fois par minute et
  // seulement onglet visible. Avant, les quatre partaient toutes les 15 s, onglet caché compris : la fiche seule
  // recharge toute la carte, soit une quinzaine de requêtes en base à chaque tour et par tablette.
  const tour = useRef(0);
  useEffect(() => {
    if (!restoId || etatCommandes.accesPerdu) return;
    const interval = setInterval(() => {
      tour.current += 1;
      // Rafraîchissement en arrière-plan : une coupure réseau passagère ne doit pas afficher une erreur toutes les 15 s.
      if (tour.current % 4 === 0 && document.visibilityState === 'visible') loadDashboard(restoId, { silencieux: true });
      else loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true });
    }, 15000);
    // Sur un appareil associé comme terminal, le flux du serveur annonce chaque commande (terminalNavigateur.js) : relecture
    // immédiate, l'alarme part dans la seconde au lieu de jusqu'à 15 s plus tard.
    const tout = () => loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true });
    window.addEventListener(EVENEMENT_COMMANDE, tout);
    return () => { clearInterval(interval); window.removeEventListener(EVENEMENT_COMMANDE, tout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, etatCommandes.accesPerdu]);
  // STATUT STRIPE « EN ATTENTE » RELU UNE FOIS PAR PAGE (test réel, 12 oct. 2026). Il n'était relu qu'au retour du lien
  // Stripe : un restaurateur qui fermait l'onglet au lieu de « Revenir sur Fairide », ou dont le compte s'activait quelques
  // secondes après, restait « Paiements à configurer » alors que Stripe le disait actif. Un effet sur la fiche (et non dans
  // loadDashboard : la fiche arrive par pickResto, que loadDashboard ne relit pas) — un appel Stripe, rien de plus.
  const stripeStatut = restaurant?.stripeConnectStatus;
  useEffect(() => {
    if (!restoId || stripeStatut !== 'pending' || statutReluRef.current) return;
    statutReluRef.current = true;
    api(`/restaurants/${restoId}/connect/refresh`, { method: 'POST', token })
      .then((r) => { if (r?.stripeConnectStatus && r.stripeConnectStatus !== 'pending') setRestaurant((x) => (x ? { ...x, stripeConnectStatus: r.stripeConnectStatus } : x)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, stripeStatut]);
  // RETOUR DE STRIPE DANS L'APP (2026-10-21, vérification Stripe site / app). Dans l'app, la page reste montée pendant que
  // Stripe s'ouvre par-dessus : l'effet ci-dessus, une fois par page, ne revoyait jamais le compte s'activer, et
  // « Paiements à configurer » restait jusqu'au redémarrage (Stripe Connect n'a pas de webhook ici). Tant que le statut est
  // « en attente », chaque retour au premier plan le relit.
  useRevalidation(() => api(`/restaurants/${restoId}/connect/refresh`, { method: 'POST', token })
    .then((r) => { if (r?.stripeConnectStatus && r.stripeConnectStatus !== 'pending') setRestaurant((x) => (x ? { ...x, stripeConnectStatus: r.stripeConnectStatus } : x)); }),
  { actif: !!restoId && stripeStatut === 'pending', absenceMin: 0 });
  // Retour sur l'onglet, focus, connexion retrouvée : relecture silencieuse (voir useRevalidation.js).
  useRevalidation(() => { if (restoId) return loadDashboard(restoId); return undefined; }, { actif: !!restoId && !etatCommandes.accesPerdu });
  // Changement d'onglet : on relit les données en arrière-plan (sans squelette — l'ancien état reste
  // affiché jusqu'à la réponse) pour que la page ouverte soit à jour sans attendre le prochain cycle.
  const premierChemin = useRef(chemin);
  useEffect(() => {
    if (!restoId || premierChemin.current === chemin) return;
    premierChemin.current = chemin;
    loadDashboard(restoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin, restoId]);

  // `fiche` : recharger aussi la fiche du commerce (carte comprise) ; `annexes` : les livreurs. Plus d'avis à lire depuis
  // leur retrait (fondateur, 22/10/2026 : pas assez d'utilisateurs, des commerces avec peu d'étoiles feraient mauvaise
  // impression ; on les refera peut-être plus tard).
  async function loadDashboard(id, { fiche = true, annexes = true, silencieux = false } = {}) {
    const version = versionCommandes.current;
    try {
      // Retour de l'onboarding Stripe Connect : le statut (pas suivi par webhook pour ce type de compte) est relu par
      // l'effet « retour de Stripe » plus haut, qui recharge ensuite le tableau de bord (shop-7).
      const [ordersData, restoData, driversData] = await Promise.all([
        // Vue « service » (shop-213) : en cours + closes depuis 24 h, au lieu de tout l'historique toutes les 15 s.
        api(`/orders/restaurant/${id}?vue=service`, { token }),
        fiche ? api(`/restaurants/${id}`, { token }) : null,
        // Annexes (livreurs) : un échec ne doit jamais vider la liste des commandes (banc du 9 oct. 2026 : un 404 sur une
        // annexe laissait « Pas encore de commande » alors que le serveur en renvoyait).
        annexes ? api(`/restaurants/${id}/drivers`, { token }).catch(() => null) : null
      ]);
      if (versionCommandes.current === version) setOrders(Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []));
      if (!Array.isArray(ordersData) && ordersData) setStatsService({ historyCount: ordersData.historyCount || 0, monthCount: ordersData.monthCount || 0 });
      setEtatCommandes({ echecs: 0, derniereMaj: Date.now(), erreur: null, accesPerdu: false });
      if (restoData) setRestaurant(restoData);
      if (driversData) setDrivers(driversData);
      // Marque la fin du premier chargement réel : sans ce signal, l'alerte "nouvelle commande"
      // prend l'arrivée des données initiales pour des commandes qui viennent de tomber (voir
      // useNewOrderAlert).
      setOrdersLoaded(true);
      setErreurChargement(null); tentatives.current = 0;
    } catch (e) {
      // 403 : membre retiré de l'équipe (STAFF_REMOVED), casquette reprise (ROLE_REQUIRED), commerce fermé. Le dire une fois
      // et arrêter de relire (shop-403), au lieu de garder une liste figée qui ne sonnera plus.
      setEtatCommandes((x) => ({ ...x, echecs: x.echecs + 1, erreur: e.message, accesPerdu: x.accesPerdu || e.status === 403 }));
      if (!restaurant) {
        // Objet neuf à chaque échec : un message identique ne suffirait pas à déclencher un nouveau rendu.
        setErreurChargement({ message: e.message, n: tentatives.current });
        if (tentatives.current < 2) { tentatives.current += 1; setTimeout(() => loadDashboard(id), 2500 * tentatives.current); }
      } else if (!silencieux) {
        toast(e.message, 'erreur');
      }
    }
  }

  /* Après « Tu n'as plus accès à ce commerce » (shop-403) : les rôles sont relus. Sans la casquette « Commerce » (membre
     retiré qui ne sert plus nulle part), retour à la vue client — avant, il tombait sur « Crée ton commerce ». S'il la garde
     (son propre commerce, une autre équipe), la liste de ses commerces est relue. */
  async function apresAccesPerdu() {
    let u = null;
    try { u = await refreshUser?.(); } catch { /* session encore valable : on relit au moins la liste */ }
    try { localStorage.removeItem(CLE_DERNIER_COMMERCE); } catch { /* sans stockage */ }
    if (u && !(u.roles || []).includes('restaurant')) { changerRole?.('client', u.roles); navigate('/', { replace: true }); return; }
    setEtatCommandes({ echecs: 0, derniereMaj: null, erreur: null, accesPerdu: false });
    setRestoId(null); setRestaurant(null); setOrders([]); setMyRestos(null);
    chargerCommerces();
  }

  // `fiche` : la fiche déjà reçue (liste /mine/dashboard) — affichée tout de suite, sans second chargement.
  function pickResto(id, fiche = null) {
    setRestoId(id);
    try { localStorage.setItem(CLE_DERNIER_COMMERCE, id); } catch { /* sans stockage */ }
    if (fiche) setRestaurant(fiche);
    loadDashboard(id, { fiche: !fiche });
  }

  // Création silencieuse depuis l'indice d'inscription (fairide_resto_hint) : un nom suffit. Les
  // horaires ne sont plus exigés ici — le serveur (fromSignup) crée alors le commerce fermé, à ouvrir
  // dès que le restaurateur pose ses horaires. Tout ressaisir parce qu'il manquait un champ n'avait
  // aucun sens : il a déjà rempli le formulaire d'inscription une fois.
  /* LA CARTE EST DEMANDÉE AVANT LA PREMIÈRE CONNEXION.
     Si le commerçant a dit à l'inscription qu'il était déjà sur Uber Eats, Deliveroo, Takeaway ou
     qu'il a un site (voir l'étape « business » d'Auth.jsx), la demande « Fairide s'en occupe » part
     ici, dès que le commerce existe — il ne peut pas la poser lui-même plus tôt, elle a besoin de
     l'identifiant du commerce. Il découvre donc un tableau de bord où sa carte est déjà en
     préparation, au lieu d'une carte vide et de six méthodes à comparer.

     Silencieux par construction : un échec ne doit pas gâcher l'arrivée. Le 409 (« une demande est
     déjà en cours ») n'est pas une erreur ici, c'est le résultat attendu si la page a été rechargée.
     Dans tous les cas la demande reste faisable à la main depuis Mes produits. */
  async function ouvrirDemandeCarte(idResto, indice) {
    const platform = indice?.menuPlatform;
    if (!idResto || !platform) return;
    try {
      await api(`/restaurants/${idResto}/menu/concierge`, {
        method: 'POST', token,
        body: { platform, url: indice.menuUrl || '', notes: '' }
      });
    } catch { /* déjà ouverte, hors ligne, ou refusée : la demande reste faisable à la main */ }
  }

  // Commerce créé par les écrans de l'inscription (POST /auth/commerce) : la liste se relit et l'ouvre, comme au premier
  // chargement (la demande de carte gardée par l'inscription du site part de là aussi).
  function commerceCree() {
    setCreationOuverte(false);
    navigate('/dashboard', { replace: true });
    chargerCommerces();
    toast(t('dashResto.toastCreated'), 'succes');
  }
  /* SORTIR SANS CRÉER (fondateur, 2026-10-27, bloqué en vue commerce sans commerce : « il faut un bouton retour, je ne peux
     pas sortir »). Sans commerce, l'onglet Commerce n'a pas de Mon compte (EditPage attend un commerce), donc pas de Mes
     casquettes : la sortie est ici. Le compte a une autre casquette → on y retourne ; sinon, la déconnexion. */
  const autreRole = ['client', 'driver'].find((r) => (roles || []).includes(r)) || null;
  function quitterVueCommerce() {
    setCreationOuverte(false);
    if (autreRole && changerRole(autreRole)) {
      toast(t('casquettes.basculee', { role: t(`casquettes.nom_${autreRole}`) }));
      navigate(autreRole === 'driver' ? '/driver' : '/', { replace: true });
    }
  }

  async function connectOnboard() {
    setConnecting(true);
    try {
      // Dans l'app, Stripe s'ouvre dans le navigateur intégré et l'on revient ici en le fermant (allerAuPaiement, natif.js) ;
      // sur le site, rien ne change : la page part vers Stripe. L'écran d'attente couvre l'ouverture (ouvrirStripe.js).
      // Retour avec `?connect=return` aussi quand on ferme le navigateur intégré : le statut est alors relu (shop-7).
      await ouvrirStripe(() => api(`/restaurants/${restoId}/connect/onboard`, { method: 'POST', token }), { retour: '/dashboard?connect=return' });
      setConnecting(false);
    } catch (e) {
      // Numéros d'entreprise / TVA manquants : on emmène vers la sous-section Paiement qui les demande.
      if (e.code === 'LEGAL_INFO_REQUIRED' || /LEGAL_INFO_REQUIRED|numéro d'entreprise/i.test(e.message || '')) { toast(t('dashResto.toastLegalFirst'), 'erreur'); navigate('/account?ouvrir=paiement&retour=/dashboard'); }
      else toast(e.message, 'erreur');
      setConnecting(false);
    }
  }

  // Chargement dans l'app : le bandeau et la feuille dès la première image (Skeleton.jsx, audit « Look and feel »).
  if (!myRestos) {
    if (erreurListe && erreurListe.n >= 2) {
      return <ErrorCard titre={t('dashResto.loadFailedTitle')} message={erreurListe.message}
        onRetry={() => { clearTimeout(repriseListe.current); tentativesListe.current = 0; setErreurListe(null); chargerCommerces(); }} />;
    }
    return experienceApp() ? <SqueletteEcran /> : <SkeletonCards count={2} />;
  }

  // MEMBRE DE L'ÉQUIPE (backend equipeCommerce.js) : le commerce ouvert n'est pas le sien, il y fait le service. Il ne
  // voit que les commandes — les autres écrans appellent des routes du propriétaire, que le serveur lui refuse.
  const membreEquipe = myRestos.find((r) => r.id === restoId)?.staffRole === 'service';
  if (membreEquipe && restoId && chemin !== '/dashboard/orders') return <Navigate to="/dashboard/orders" replace />;
  // Les blocs communs à toutes les pages, sous le nom : deux alertes qui ne sont pas des étapes, le calendrier
  // d'ouverture (accueil) ou la prochaine étape (ailleurs), l'alerte de nouvelle commande. Les pages au bandeau les
  // posent en tête de leur feuille (`communs` du contexte) ; les autres les reçoivent ici, comme avant.
  const bandeau = avecBandeau && !!restaurant;
  // La commande qui attend depuis le plus longtemps (échéance la plus proche) : celle que « 1 commande à traiter » ouvre.
  const premiereNouvelle = orders.filter((o) => o.status === 'nouveau' && o.paid)
    .sort((a, b) => new Date(a.acceptDeadline || a.createdAt).getTime() - new Date(b.acceptDeadline || b.createdAt).getTime())[0] || null;
  const abonnementBloque = !!restaurant && !restaurant.isDemo && !!restaurant.subscriptionRequired && (!!restaurant.wantsDelivery || !!restaurant.wantsPickup);
  const communs = restaurant && (
    <>
      {/* Deux alertes qui ne sont pas des étapes : le blocage par l'équipe, la livraison coupée dans la zone. */}
      {/* Abonnement facturé mais pas souscrit (audit du 19/10, admin-26) : plus aucune commande, et le commerce ne le voyait
          nulle part. Sur le site, la ligne dit où souscrire ; dans l'app (achats interdits par les magasins d'applications,
          natif.js), elle dit seulement ce qui se passe, sans bouton ni renvoi vers un paiement. */}
      {abonnementBloque && (
        <div className="card account-groupe" aria-label={t('dashResto.ariaStatus')}>
          <LigneCompte accent="danger" icone="carteBancaire" titre={t('dashResto.subRequiredTitle')}
            sous={achatsCommerceAutorises() ? t('dashResto.subRequiredWeb') : t('dashResto.subRequiredApp')}
            to={achatsCommerceAutorises() ? '/account?ouvrir=abonnement' : undefined} />
        </div>
      )}
      {/* Délai de grâce (fondateur, 2026-10-21) : facturation activée, pas encore souscrit, les commandes continuent jusqu'à
          la date. Sur le site, la ligne dit où souscrire ; dans l'app, seulement la date (ni bouton, ni renvoi vers un
          paiement : achatsCommerceAutorises, natif.js). */}
      {!abonnementBloque && !!restaurant.subscriptionGraceUntil && (
        <div className="card account-groupe" aria-label={t('dashResto.ariaStatus')}>
          <LigneCompte accent="warn" icone="carteBancaire"
            titre={t('dashResto.subGraceTitle', { date: new Date(restaurant.subscriptionGraceUntil).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' }) })}
            sous={achatsCommerceAutorises() ? t('dashResto.subGraceWeb') : t('dashResto.subGraceApp')}
            to={achatsCommerceAutorises() ? '/account?ouvrir=abonnement' : undefined} />
        </div>
      )}
      {(restaurant.adminStatus === 'blocked' || restaurant.fairideDeliveryDisabled) && (
        <div className="card account-groupe" aria-label={t('dashResto.ariaStatus')}>
          {restaurant.adminStatus === 'blocked' && (
            <LigneCompte accent="danger" icone="interdit" titre={t('dashResto.blockedTitle')} sous={t('dashResto.blockedSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
              <p className="small" style={{ margin: 0 }}>
                {t('dashResto.blockedText')}
              </p>
            </LigneCompte>
          )}
          {/* Livraison Fairide coupée par l'équipe : commerce seul dans sa zone, aucun livreur à proximité (2026-10-08). */}
          {restaurant.fairideDeliveryDisabled && (
            <LigneCompte accent="warn" icone="velo" titre={t('dashResto.zoneDeliveryOffTitle')}
              sous={t('dashResto.zoneDeliveryOffText') + (restaurant.fairideDeliveryDisabledReason ? ` (${restaurant.fairideDeliveryDisabledReason})` : '')} />
          )}
        </div>
      )}
      {/* Les vraies dates d'ouverture des commandes (à emporter, livraison), sur l'accueil du commerce. */}
      {surAccueil && <BandeauOuverture role="restaurant" />}
      {/* Tout ce qui reste avant d'être vu des clients, en une liste et un seul prochain bouton (MiseEnLigne.jsx) :
          remplace la carte d'état (validation, visibilité, Stripe), le bandeau « Ta carte attend ta validation »
          (CarteAValider) et la liste de MenuReadiness. Complète sur Mon commerce (la route du bandeau, EditPage), une
          rangée « Prochaine étape » ailleurs — y compris sur le terminal. En « agir pour », l'équipe voit la liste sans
          aucun bouton : elle ne signe ni ne valide rien à la place du commerce. */}
      {/* Depuis le 2026-10-17 (fondateur : deux boutons lime au-dessus du titre de chaque page), la rangée « Prochaine étape »
          ne vit plus que sur la page Commandes de l'app (le terminal) : l'accueil a la liste complète, et les autres pages
          (menu, factures, promotions…) n'ont pas à la répéter. */}
      {/* Avant la mise en ligne, Commandes EST le guide (OrdersPage, 2026-10-27) : la rangée n'y revient qu'une fois en ligne
          (nouveau contrat à accepter, carte à revalider). */}
      {chemin === '/dashboard/orders' && !commandesSite && !membreEquipe && restaurant.publicListed && (
        <MiseEnLigne restaurant={restaurant} restoId={restoId} token={token} onConnect={connectOnboard} connecting={connecting}
          onChange={() => loadDashboard(restoId)} lectureSeule={!!actingAs} />
      )}
      {/* Placée au niveau du layout, pas de la page Commandes : le restaurateur doit être alerté même
          s'il est en train de modifier son menu ou de consulter ses factures. */}
      {/* Barre complète sur l'accueil et les commandes ; ailleurs, la version compacte (NewOrderAlertBar.jsx). */}
      {/* Sur Commandes, l'alarme est une ligne du bandeau iris (LigneAlarme dans l'app, AlerteBandeau sur le site — audit
          design 2, 2026-10-19) : la carte ne se répète pas dans la feuille, la commande qui attend passe en premier. */}
      {/* Sur téléphone (app et site), la commande qui attend est la bande lime au-dessus des onglets (BandeATraiter, plus bas) :
          cette carte n'y garde que le son et les notifications qui manquent (fondateur, 2026-10-27, maquettes/ecrans-pro). */}
      {chemin !== '/dashboard/orders' && <NewOrderAlertBar {...orderAlert} push={push} compact={!surAccueil} sansCommande={!siteLarge}
        onOuvrir={premiereNouvelle ? () => setFeuilleCommande(premiereNouvelle.id) : null} />}
    </>
  );

  return (
    <div className={bandeau && !actingAs && myRestos.length === 1 ? 'ec-coquille--bandeau' : undefined}>
      {actingAs && (
        <div className="agir-bandeau" role="status">
          <span><Icone nom="reglages" taille={16} className="icone-texte" />{' '}{t('dashResto.actingBanner', { name: user?.name || '', admin: actingAdminEmail })}</span>
          <button type="button" className="btn-outline btn-sm" onClick={quitterAction}>{t('dashResto.actingQuit')}</button>
        </div>
      )}
      {myRestos.length === 1 ? (
        !bandeau && <h2 style={{ margin: '0 0 14px' }}>{myRestos[0].name}</h2>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('dashResto.myRestaurant')}</h2>
          {myRestos.length > 1 && (
            <div className="row" style={{ marginBottom: 10 }}>
              <select style={{ flex: 1 }} value={restoId || ''} onChange={(e) => e.target.value && pickResto(e.target.value)} aria-label={t('dashResto.myRestaurant')}>
                <option value="">{t('dashResto.chooseRestaurant')}</option>
                {myRestos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          {myRestos.length === 0 && (
            <div className="empty" style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 6 }}><Icone nom="commerce" taille={28} className="icone-texte" /></div>
              <b>{t('dashResto.waitTitle')}</b>
              <p className="small" style={{ margin: '6px auto 12px', maxWidth: 420 }}>{t('dashResto.waitText')}</p>
              {/* Les écrans s'ouvrent ici même, sans changer de page : rien à attendre (fondateur, 2026-10-27). */}
              <button type="button" className="btn-gold" onClick={() => setCreationOuverte(true)}>{t('dashResto.waitCta')}</button>
              <div style={{ marginTop: 10 }}>
                {autreRole
                  ? <button type="button" className="btn-ghost" onClick={quitterVueCommerce}>{t('dashResto.waitQuitter', { role: t(`casquettes.nom_${autreRole}`) })}</button>
                  : <button type="button" className="btn-ghost" onClick={logout}>{t('nav.logout')}</button>}
              </div>
            </div>
          )}
        </div>
      )}
      {creationOuverte && myRestos?.length === 0 && (
        <Suspense fallback={null}>
          {/* ‹ au premier écran ou la croix : retour à l'autre casquette s'il y en a une, sinon cette carte. */}
          <InscriptionAppli role="restaurant" compte onCree={commerceCree} onQuitter={quitterVueCommerce} />
        </Suspense>
      )}
      {!bandeau && communs}
      {/* Terminal Goodcom au son bloqué par le navigateur : l'écran plein qui le débloque d'un toucher (SonTerminal.jsx). */}
      <SonTerminal alerte={orderAlert} />
      {/* La commande qui attend, au-dessus des onglets sur téléphone ; pas sur Commandes, qui a sa barre « Accepter » (OrdersPage). */}
      {restaurant && !siteLarge && premiereNouvelle && chemin !== '/dashboard/orders' && (
        <BandeATraiter commande={premiereNouvelle} nombre={orderAlert.newCount} alarmeEnCours={orderAlert.alarmeEnCours}
          couperAlarme={orderAlert.couperAlarme} onOuvrir={() => setFeuilleCommande(premiereNouvelle.id)} />
      )}
      {/* La commande qui vient d'arriver, affichée d'elle-même (fondateur, 2026-10-01). */}
      {restaurant && <NouvelleCommandeModale orders={orders} ready={ordersLoaded} restoId={restoId} loadDashboard={loadDashboard} modifierCommandes={modifierCommandes}
        ouverte={feuilleCommande} setOuverte={setFeuilleCommande} />}

      {/* Accès perdu (membre retiré, commerce fermé, shop-403) : un seul message, et le chemin vers la vue client. */}
      {etatCommandes.accesPerdu && (
        <ErrorCard titre={t('dashResto.accessLostTitle')} message={t('dashResto.accessLostText')}
          onRetry={apresAccesPerdu} libelle={t('dashResto.accessLostCta')} />
      )}
      {!restaurant && restoId && !etatCommandes.accesPerdu && (
        /* La carte d'échec est celle de components/ErrorCard.jsx, commune aux quatre espaces :
           elle était écrite à la main ici, avec un émoji 📡 que le reste de l'interface a abandonné
           (voir l'en-tête de Icone.jsx). Le seuil de deux tentatives ne bouge pas : un échec isolé
           se rattrape tout seul au rechargement suivant, et basculer en écran d'erreur dès le
           premier ferait clignoter le tableau de bord d'un restaurateur en plein service. */
        erreurChargement && erreurChargement.n >= 2 ? (
          <ErrorCard
            titre={t('dashResto.loadFailedTitle')}
            message={erreurChargement.message}
            onRetry={() => { tentatives.current = 0; setErreurChargement(null); loadDashboard(restoId); }}
          />
        ) : <SkeletonCards count={3} />
      )}
      {restaurant && !etatCommandes.accesPerdu && (
        <div className="page-fade" key={chemin}>
          {/* modifierRestaurant / modifierCommandes (2026-10-23, app lente) : un geste (« épuisé », « Prête », pause, accepter)
              change la fiche ou la liste ici même, avant la réponse ou sans attendre le rechargement complet
              (actionOptimiste.js, components/commerce/majLocale.js). Le sondage de 15 s et les relectures les corrigent. */}
          <Outlet context={{ restaurant: restaurant || null, orders, drivers, restoId, loadDashboard, ordersLoaded, etatCommandes, statsService,
            modifierRestaurant: setRestaurant, modifierCommandes,
            communs: bandeau ? communs : null, onConnect: connectOnboard, connecting, lectureSeule: !!actingAs,
            alerte: { ...orderAlert, push } }} />
        </div>
      )}
    </div>
  );
}
