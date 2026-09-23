import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import usePushNotifications from '../../hooks/usePushNotifications';
import { useToast } from '../../context/ToastContext';
import { RESTAURANT_TYPES } from '../../menuCategories';
import CreationCommerce from '../../components/commerce/CreationCommerce';
import { SkeletonCards } from '../../components/Skeleton';
import ErrorCard from '../../components/ErrorCard';
import NewOrderAlertBar from '../../components/NewOrderAlertBar';
import LigneCompte from '../../components/LigneCompte';
import useNewOrderAlert from '../../hooks/useNewOrderAlert';
import useRevalidation from '../../useRevalidation';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { dateOuverturePaiements } from '../../launch';
import { cuisineDepuisOsm } from '../../osmCuisine';

// Charge une seule fois restaurant/orders/reviews/drivers et les partage aux sous-pages via
// l'outlet context, plutôt que de dupliquer ce chargement dans chacune. Porte aussi tout ce qui est
// commun à toutes les sous-pages : création du commerce (components/commerce/CreationCommerce.jsx) et
// bannières (validation/abonnement/Stripe).
const FONDATEURS = ['lamythibault5@gmail.com', 'lamythibault60@gmail.com'];

export default function DashboardLayout() {
  const { t } = useLanguage();
  const { token, user, actingAs, actingAdminEmail, quitterAction } = useAuth();
  const navigate = useNavigate();
  // Comptes fondateurs (admin, ou l'un des e-mails ci-dessous, la même liste que FAIRIDE_FOUNDER_EMAILS côté
  // serveur) : leur restaurant de test se crée même incomplet, le serveur complète ce qui manque.
  const fondateur = !!user?.isAdmin || FONDATEURS.includes(String(user?.email || '').toLowerCase());
  const toast = useToast();
  // Sans restaurant, seule la racine (« Mon commerce ») propose la création ; les autres sections attendent.
  // /dashboard/edit est l'ancienne adresse des infos : même page (la redirection ne joue qu'avec un restaurant).
  const chemin = useLocation().pathname.replace(/\/$/, '');
  const surAccueil = ['/dashboard', '/dashboard/edit'].includes(chemin);
  // La page Carte (map, livreurs, jeux) s'ouvre même sans restaurant : rien n'y dépend d'un commerce créé.
  const surCarte = chemin === '/dashboard/map';
  const [myRestos, setMyRestos] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [drivers, setDrivers] = useState([]);

  const [newRestoOpen, setNewRestoOpen] = useState(false);
  // Son + notification système + compteur dans le titre de l'onglet à chaque nouvelle commande.
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  // Échec du premier chargement (réseau, serveur en redéploiement) : sans ceci la page restait vide, sans
  // rien d'autre qu'un toast, et il fallait recharger à la main. Deux reprises automatiques, puis un bouton.
  const [erreurChargement, setErreurChargement] = useState(null);
  const tentatives = useRef(0);
  const orderAlert = useNewOrderAlert(orders, ordersLoaded);
  // Notifications push : la seule alerte qui survive a l'onglet ferme (voir src/push.js).
  const push = usePushNotifications(token);

  const [connecting, setConnecting] = useState(false);
  // La rangée d'état dépliée en tête du tableau de bord (validation), null si aucune.
  const [statutOuvert, setStatutOuvert] = useState(null);
  // Capturé une seule fois au montage, avant que l'effet ci-dessous ne nettoie l'URL — loadDashboard
  // (appelé de façon asynchrone, après coup) ne pourrait plus lire ce paramètre autrement.
  const connectReturnRef = useRef(new URLSearchParams(window.location.search).get('connect'));

  // Plus de carte « Aujourd'hui » dans la colonne de droite (2026-09-23). Elle comptait TOUTES les
  // commandes jamais reçues (le serveur renvoie l'historique complet) sous le titre « Aujourd'hui »,
  // additionnait au chiffre d'affaires les commandes refusées et annulées, et affichait un « Économisé
  // vs les grandes plateformes » calculé sur une commission supposée de 30 %, que rien ne permettait de
  // vérifier. Le nombre de commandes en cours et du jour est maintenant en tête de la page Commandes ;
  // les avis sont dans Mon compte.

  useEffect(() => {
    api('/restaurants/mine/dashboard', { token }).then((list) => {
      setMyRestos(list);
      // Un seul restaurant possible par compte -> pas besoin de le faire choisir dans une liste, on l'ouvre direct.
      if (list.length === 1) pickResto(list[0].id);
      // Pas encore de restaurant (compte ouvert avant la création automatique, ou création échouée à
      // l'inscription) : on le crée tout de suite depuis ce que l'inscription a retenu, sans rien demander ;
      // le formulaire ne s'ouvre qu'en dernier recours, déjà prérempli.
      else if (list.length === 0) {
        creerDepuisIndice().then((r) => {
          if (r) { setMyRestos([r]); pickResto(r.id); toast(t('dashResto.toastAutoCreated', { name: r.name })); }
          else setNewRestoOpen(true);
        });
      }
      // Le commerce a été créé automatiquement à l'inscription : l'indice local ne sert plus qu'à retenir le
      // site web pour lire la carte (Mes produits → import depuis le web).
      if (list.length > 0) {
        try {
          const h = JSON.parse(localStorage.getItem('fairide_resto_hint') || 'null');
          if (h) {
            if (h.website) localStorage.setItem('fairide_menu_source_url', h.website);
            ouvrirDemandeCarte(list[0]?.id, h);
            localStorage.removeItem('fairide_resto_hint');
          }
        } catch { /* rien */ }
      }
    }).catch((e) => toast(e.message, 'erreur'));
    if (new URLSearchParams(window.location.search).get('connect')) {
      toast(t('dashResto.toastPaymentsValidating'));
      window.history.replaceState({}, '', '/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoId) return;
    const interval = setInterval(() => loadDashboard(restoId), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);
  // Retour sur l'onglet, focus, connexion retrouvée : relecture silencieuse (voir useRevalidation.js).
  useRevalidation(() => { if (restoId) return loadDashboard(restoId); return undefined; }, { actif: !!restoId });
  // Changement d'onglet : on relit les données en arrière-plan (sans squelette — l'ancien état reste
  // affiché jusqu'à la réponse) pour que la page ouverte soit à jour sans attendre le prochain cycle.
  const premierChemin = useRef(chemin);
  useEffect(() => {
    if (!restoId || premierChemin.current === chemin) return;
    premierChemin.current = chemin;
    loadDashboard(restoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin, restoId]);

  async function loadDashboard(id) {
    try {
      // Retour de l'onboarding Stripe Connect : le statut n'est pas suivi par webhook pour ce type
      // de compte, on le relit activement une fois avant de charger le reste du tableau de bord.
      if (connectReturnRef.current) {
        connectReturnRef.current = null;
        await api(`/restaurants/${id}/connect/refresh`, { method: 'POST', token }).catch(() => {});
      }
      const [ordersData, restoData, reviewsData, driversData] = await Promise.all([
        api(`/orders/restaurant/${id}`, { token }),
        api(`/restaurants/${id}`, { token }),
        api(`/restaurants/${id}/reviews`),
        api(`/restaurants/${id}/drivers`, { token })
      ]);
      setOrders(ordersData);
      setRestaurant(restoData);
      setReviews(reviewsData);
      setDrivers(driversData);
      // Marque la fin du premier chargement réel : sans ce signal, l'alerte "nouvelle commande"
      // prend l'arrivée des données initiales pour des commandes qui viennent de tomber (voir
      // useNewOrderAlert).
      setOrdersLoaded(true);
      setErreurChargement(null); tentatives.current = 0;
    } catch (e) {
      if (!restaurant) {
        // Objet neuf à chaque échec : un message identique ne suffirait pas à déclencher un nouveau rendu.
        setErreurChargement({ message: e.message, n: tentatives.current });
        if (tentatives.current < 2) { tentatives.current += 1; setTimeout(() => loadDashboard(id), 2500 * tentatives.current); }
      } else {
        toast(e.message, 'erreur');
      }
    }
  }

  function pickResto(id) {
    setRestoId(id);
    loadDashboard(id);
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

  async function creerDepuisIndice() {
    let h = null;
    try { h = JSON.parse(localStorage.getItem('fairide_resto_hint') || 'null'); } catch { return null; }
    if (!h || !h.name) return null;
    const horairesValides = h.hours && Object.values(h.hours).some((c) => Array.isArray(c) && c.length);
    const typeDevine = cuisineDepuisOsm(h.cuisine, h.type);
    const cuisineChoisie = h.cuisineType === 'Autre' && h.customCuisine ? h.customCuisine
      : (h.cuisineType && RESTAURANT_TYPES.some((rt) => rt.value === h.cuisineType)) ? h.cuisineType
        : (typeDevine && RESTAURANT_TYPES.some((rt) => rt.value === typeDevine)) ? typeDevine : 'Autre';
    const sv = h.services || {};
    try {
      const r = await api('/restaurants', {
        method: 'POST', token,
        body: {
          name: String(h.name).trim(), commune: h.commune || user?.addressCity || '', neighborhood: h.neighborhood || '', cuisine: cuisineChoisie, desc: '',
          addressStreet: h.street || user?.addressStreet || '', addressNumber: h.number || user?.addressNumber || '', addressPostalCode: h.postalCode || user?.addressPostalCode || '', addressCity: h.commune || user?.addressCity || '',
          hours: horairesValides ? h.hours : null, openingHours: h.openingHours || '', deliveryMode: sv.deliveryMode === 'own' ? 'own' : 'fairide',
          fromSignup: true,
          offersDelivery: sv.delivery !== false, offersPickup: sv.pickup !== false, offersDineIn: !!sv.dineIn,
          phone: h.phone || '', website: h.website || ''
        }
      });
      try {
        if (h.website) localStorage.setItem('fairide_menu_source_url', h.website);
        ouvrirDemandeCarte(r?.id, h);
        localStorage.removeItem('fairide_resto_hint');
      } catch { /* rien */ }
      return r;
    } catch { return null; }
  }

  // Création manuelle, étape par étape (components/commerce/CreationCommerce.jsx) : ce qui suit n'est
  // que l'arrivée sur le tableau de bord du commerce qu'on vient de créer.
  function commerceCree(r) {
    setMyRestos((prev) => [...prev, r]);
    setNewRestoOpen(false);
    pickResto(r.id);
    navigate('/dashboard', { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(r.wantsOwnDriver ? t('dashResto.toastCreatedOwnDriver') : t('dashResto.toastCreated'));
  }

  async function connectOnboard() {
    setConnecting(true);
    try {
      const r = await api(`/restaurants/${restoId}/connect/onboard`, { method: 'POST', token });
      window.location.href = r.url;
    } catch (e) {
      // Numéros d'entreprise / TVA manquants : on emmène vers la sous-section Paiement qui les demande.
      if (e.code === 'LEGAL_INFO_REQUIRED' || /LEGAL_INFO_REQUIRED|numéro d'entreprise/i.test(e.message || '')) { toast(t('dashResto.toastLegalFirst')); navigate('/account?ouvrir=paiement&retour=/dashboard'); }
      else toast(e.message, 'erreur');
      setConnecting(false);
    }
  }

  if (!myRestos) return <SkeletonCards count={2} />;

  return (
    <div>
      {actingAs && (
        <div className="agir-bandeau" role="status">
          <span>🛠️ {t('dashResto.actingBanner', { name: user?.name || '', admin: actingAdminEmail })}</span>
          <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={quitterAction}>{t('dashResto.actingQuit')}</button>
        </div>
      )}
      {myRestos.length === 1 ? (
        <h2 style={{ margin: '0 0 14px' }}>{myRestos[0].name}</h2>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('dashResto.myRestaurant')}</h2>
          {myRestos.length > 1 && (
            <div className="row" style={{ marginBottom: 10 }}>
              <select style={{ flex: 1 }} value={restoId || ''} onChange={(e) => e.target.value && pickResto(e.target.value)}>
                <option value="">{t('dashResto.chooseRestaurant')}</option>
                {myRestos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          {!newRestoOpen && myRestos.length === 0 && surAccueil && (
            <button type="button" className="btn-ghost" onClick={() => setNewRestoOpen(true)}>{t('dashResto.createMine')}</button>
          )}
          {myRestos.length === 0 && !surAccueil && !surCarte && (
            <div className="empty" style={{ marginTop: 8 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🔒</div>
              <b>{t('dashResto.waitTitle')}</b>
              <p className="small" style={{ margin: '6px auto 12px', maxWidth: 420 }}>{t('dashResto.waitText')}</p>
              <Link to="/dashboard" className="btn-teal" style={{ display: 'inline-block', padding: '8px 16px', fontSize: 14 }}>{t('dashResto.waitCta')}</Link>
            </div>
          )}
        </div>
      )}
      {newRestoOpen && surAccueil && <CreationCommerce fondateur={fondateur} onCree={commerceCree} ouvrirDemandeCarte={ouvrirDemandeCarte} />}

      {/* Ce qui bloque encore le commerce, en rangées du même dessin que Mon compte (LigneCompte) : la
          validation par Fairide, les paiements Stripe. Le détail se déplie ; la carte n'existe que s'il
          reste quelque chose à faire — un commerce validé et payé n'a rien à lire ici. */}
      {restaurant && (restaurant.adminStatus !== 'approved' || restaurant.stripeConnectStatus !== 'active' || (!restaurant.publicListed && !restaurant.isDemo)) && (
        <div className="card account-groupe" aria-label={t('dashResto.ariaStatus')}>
          {restaurant.adminStatus === 'blocked' && (
            <LigneCompte accent="danger" icone="interdit" titre={t('dashResto.blockedTitle')} sous={t('dashResto.blockedSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
              <p className="small" style={{ margin: 0 }}>
                {t('dashResto.blockedText')}
              </p>
            </LigneCompte>
          )}
          {restaurant.adminStatus !== 'approved' && restaurant.adminStatus !== 'blocked' && (
            <LigneCompte accent="warn" icone="horloge" titre={t('dashResto.pendingTitle')} sous={t('dashResto.pendingSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
              <p className="small" style={{ margin: 0 }}>
                {t('dashResto.pendingText')}
              </p>
            </LigneCompte>
          )}
          {/* Validé mais pas encore publié : le commerce n'apparaît pas aux clients, et le restaurateur doit le
              savoir sans avoir à le deviner en cherchant sa fiche sur le site. */}
          {restaurant.adminStatus === 'approved' && !restaurant.publicListed && !restaurant.isDemo && (
            <LigneCompte accent="warn" icone="masque" titre={t('dashResto.notListedTitle')} sous={t('dashResto.notListedSub')} ouverte={statutOuvert === 'visibilite'} onClick={() => setStatutOuvert(statutOuvert === 'visibilite' ? null : 'visibilite')}>
              <p className="small" style={{ margin: 0 }}>{t('dashResto.notListedText')}</p>
            </LigneCompte>
          )}
          {/* Version gratuite (réservations, à emporter payé sur place) : aucun paiement ne transite par Fairide — la rangée
              n'a rien à demander, même avec un acompte coché (il ne s'applique qu'une fois les paiements actifs). Même
              règle que formules.paiementsRequis côté serveur. */}
          {restaurant.stripeConnectStatus !== 'active' && (restaurant.wantsDelivery || (restaurant.wantsPickup && restaurant.pickupPaymentMode !== 'on_site')) && (
            <LigneCompte
              accent={restaurant.stripeConnectStatus === 'restricted' ? 'danger' : 'warn'} icone="carteBancaire"
              titre={restaurant.stripeConnectStatus === 'restricted' ? t('dashResto.paymentInfoTitle') : t('dashResto.paymentsToConfigure')}
              sous={restaurant.stripeConnectStatus === 'restricted'
                ? t('dashResto.stripeNeedsInfoResto')
                : t('dashResto.viaStripeResto', { date: dateOuverturePaiements(getLocale()) })}
              action={restaurant.stripeConnectStatus === 'restricted' ? (
                <button type="button" className="btn-gold" style={{ padding: '8px 12px', fontSize: 13 }} disabled={connecting} onClick={connectOnboard}>
                  {connecting ? '...' : t('dashResto.complete')}
                </button>
              ) : (
                // Activation fermée jusqu'à début octobre 2026 : le détail (et Stripe expliqué) est dans Mon compte › Paiement.
                <Link to="/account?ouvrir=paiement&retour=/dashboard" className="btn-outline" style={{ padding: '8px 12px', fontSize: 13, display: 'inline-block' }}>{t('dashResto.paymentsSoonBtn', { date: dateOuverturePaiements(getLocale()) })}</Link>
              )}
            />
          )}
        </div>
      )}

      {/* Placée au niveau du layout, pas de la page Commandes : le restaurateur doit être alerté même
          s'il est en train de modifier son menu ou de consulter ses avis. */}
      {restaurant && <NewOrderAlertBar {...orderAlert} push={push} />}

      {!restaurant && myRestos.length > 0 && !surCarte && (
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
      {(restaurant || (surCarte && myRestos.length === 0)) && (
        <div className="page-fade" key={chemin}>
          <Outlet context={{ restaurant: restaurant || null, orders, reviews, drivers, restoId, loadDashboard }} />
        </div>
      )}
    </div>
  );
}
