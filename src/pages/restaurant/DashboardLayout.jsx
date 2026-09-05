import { useEffect, useRef, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COMMUNES, RESTAURANT_TYPES } from '../../menuCategories';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import OpeningHoursEditor from '../../components/OpeningHoursEditor';
import NewOrderAlertBar from '../../components/NewOrderAlertBar';
import LigneCompte from '../../components/LigneCompte';
import useNewOrderAlert from '../../hooks/useNewOrderAlert';
import { useLanguage } from '../../context/LanguageContext';

// Charge une seule fois restaurant/orders/reviews/drivers et les partage aux sous-pages via
// l'outlet context, plutôt que de dupliquer ce chargement dans chacune. Porte aussi tout ce qui est
// commun à toutes les sous-pages : formulaire de création, bannières (validation/abonnement/Stripe),
// et la carte "Aujourd'hui" de la colonne de droite.
export default function DashboardLayout() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { setRightSlot } = useOutletContext();
  const [myRestos, setMyRestos] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [drivers, setDrivers] = useState([]);

  const [newRestoOpen, setNewRestoOpen] = useState(false);
  const [name, setName] = useState('');
  const [commune, setCommune] = useState(COMMUNES[0]);
  const [neighborhood, setNeighborhood] = useState('');
  const [cuisine, setCuisine] = useState(RESTAURANT_TYPES[0].value);
  const [customCuisine, setCustomCuisine] = useState('');
  const [desc, setDesc] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [hours, setHours] = useState(null);
  const [deliveryModePref, setDeliveryModePref] = useState('fairide');

  // Son + notification système + compteur dans le titre de l'onglet à chaque nouvelle commande.
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const orderAlert = useNewOrderAlert(orders, ordersLoaded);

  const [connecting, setConnecting] = useState(false);
  // La rangée d'état dépliée en tête du tableau de bord (validation), null si aucune.
  const [statutOuvert, setStatutOuvert] = useState(null);
  // Capturé une seule fois au montage, avant que l'effet ci-dessous ne nettoie l'URL — loadDashboard
  // (appelé de façon asynchrone, après coup) ne pourrait plus lire ce paramètre autrement.
  const connectReturnRef = useRef(new URLSearchParams(window.location.search).get('connect'));

  useEffect(() => {
    if (!restaurant) return undefined;
    const delivered = orders.filter((o) => o.status === 'livre');
    const revenue = orders.reduce((a, o) => a + o.subtotal, 0);
    const commissionPaid = orders.reduce((a, o) => a + o.commission, 0);
    const saved = revenue * 0.30 - commissionPaid;
    setRightSlot(
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('dashResto.today')}</h3>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <StarsDisplay value={restaurant.rating} size={16} />
          <span className="small">{restaurant.reviewCount > 0 ? t('dashResto.ratingWithCount', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount }) : t('dashResto.noReviewsYet')}</span>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="num">{orders.length}</div><div className="label">{t('dashResto.orders')}</div></div>
          <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">{t('dashResto.delivered')}</div></div>
          <div className="stat-card"><div className="num">{revenue.toFixed(0)}€</div><div className="label">{t('dashResto.foodRevenue')}</div></div>
          <div className="stat-card highlight"><div className="num">{saved > 0 ? saved.toFixed(0) : '0'}€</div><div className="label">{t('dashResto.savedVsPlatforms')}</div></div>
        </div>
      </div>
    );
    return () => setRightSlot(null);
  }, [restaurant, orders, setRightSlot]);

  useEffect(() => {
    api('/restaurants/mine/dashboard', { token }).then((list) => {
      setMyRestos(list);
      // Un seul restaurant possible par compte -> pas besoin de le faire choisir dans une liste, on l'ouvre direct.
      if (list.length === 1) pickResto(list[0].id);
      // Pas encore de restaurant -> on ouvre directement le formulaire de création, pas besoin de cliquer.
      else if (list.length === 0) setNewRestoOpen(true);
    }).catch((e) => toast(e.message));
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
        api(`/restaurants/${id}`),
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
    } catch (e) {
      toast(e.message);
    }
  }

  function pickResto(id) {
    setRestoId(id);
    loadDashboard(id);
  }

  async function createResto() {
    if (!name.trim()) { toast(t('dashResto.toastNameRequired')); return; }
    if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim()) {
      toast(t('dashResto.toastAddressRequired'));
      return;
    }
    if (!hours || !Object.values(hours).some((shifts) => Array.isArray(shifts) && shifts.length)) {
      toast(t('dashResto.toastHoursRequired'));
      return;
    }
    const finalCuisine = cuisine === 'Autre' ? customCuisine.trim() || 'Autre' : cuisine;
    try {
      const r = await api('/restaurants', {
        method: 'POST', token,
        body: {
          name: name.trim(), commune, neighborhood: neighborhood.trim(), cuisine: finalCuisine, desc: desc.trim(),
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: commune,
          coverImageUrl: coverImageUrl.trim(), hours, deliveryMode: deliveryModePref
        }
      });
      setMyRestos((prev) => [...prev, r]);
      setName(''); setCuisine(RESTAURANT_TYPES[0].value); setCustomCuisine(''); setNeighborhood(''); setDesc('');
      setAddressStreet(''); setAddressNumber(''); setAddressPostalCode('');
      setCoverImageUrl(''); setHours(null); setNewRestoOpen(false);
      pickResto(r.id);
      if (r.wantsOwnDriver) {
        toast(t('dashResto.toastCreatedOwnDriver'));
      } else {
        toast(t('dashResto.toastCreated'));
      }
    } catch (e) {
      toast(e.message);
    }
  }

  async function connectOnboard() {
    setConnecting(true);
    try {
      const r = await api(`/restaurants/${restoId}/connect/onboard`, { method: 'POST', token });
      window.location.href = r.url;
    } catch (e) {
      toast(e.message);
      setConnecting(false);
    }
  }

  if (!myRestos) return <SkeletonCards count={2} />;

  return (
    <div>
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
          {!newRestoOpen && myRestos.length === 0 && (
            <button type="button" className="btn-ghost" onClick={() => setNewRestoOpen(true)}>{t('dashResto.createMine')}</button>
          )}
        </div>
      )}
      {newRestoOpen && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 12px', opacity: 0.75 }}>
            {t('dashResto.createIntro')}
          </p>
          <p className="small" style={{ margin: '0 0 12px', opacity: 0.75 }}>
            {t('dashResto.createNote')}
          </p>

          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('dashResto.identity')}</h4>
          <div className="field"><label>{t('dashResto.businessName')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dashResto.phName')} /></div>
          <div className="field">
            <label>{t('dashResto.businessType')}</label>
            <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
          </div>
          {cuisine === 'Autre' && (
            <div className="field"><label>{t('dashResto.specifyType')}</label><input value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder={t('dashResto.phType')} /></div>
          )}

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('dashResto.addressForDrivers')}</h4>
          <div className="field">
            <label>{t('dashResto.municipality')}</label>
            <select value={commune} onChange={(e) => setCommune(e.target.value)}>
              {COMMUNES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>{t('dashResto.street')}</label><input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('dashResto.phStreet')} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('dashResto.number')}</label>
              <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('dashResto.postalCode')}</label>
              <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
            </div>
          </div>
          <div className="field"><label>{t('dashResto.neighbourhoodOptional')}</label><input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder={t('dashResto.phNeighbourhood')} /></div>

          <div className="divider" />
          <h4 style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('dashResto.openingHours')}</h4>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('dashResto.openingHoursRequired')}</p>
          <OpeningHoursEditor value={hours} onChange={setHours} />

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('dashResto.presentationOptional')}</h4>
          <div className="field"><label>{t('dashResto.description')}</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('dashResto.phDescription')} /></div>
          <div className="field"><label>{t('dashResto.coverUrl')}</label><input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." /></div>

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('dashResto.delivery')}</h4>
          <div className="field">
            <label>{t('dashResto.whoDelivers')}</label>
            <select value={deliveryModePref} onChange={(e) => setDeliveryModePref(e.target.value)}>
              <option value="fairide">{t('dashResto.fairidePool')}</option>
              <option value="own">{t('dashResto.ownDrivers')}</option>
            </select>
            {deliveryModePref === 'own' && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                {t('dashResto.ownDriversHelp')}
              </p>
            )}
          </div>
          <button className="btn-teal" onClick={createResto}>{t('dashResto.createMyRestaurant')}</button>
        </div>
      )}

      {/* Ce qui bloque encore le commerce, en rangées du même dessin que Mon compte (LigneCompte) : la
          validation par Fairide, les paiements Stripe. Le détail se déplie ; la carte n'existe que s'il
          reste quelque chose à faire — un commerce validé et payé n'a rien à lire ici. */}
      {restaurant && (restaurant.adminStatus !== 'approved' || restaurant.stripeConnectStatus !== 'active') && (
        <div className="card account-groupe" aria-label={t('dashResto.ariaStatus')}>
          {restaurant.adminStatus === 'blocked' && (
            <LigneCompte accent="danger" icone="🚫" titre={t('dashResto.blockedTitle')} sous={t('dashResto.blockedSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
              <p className="small" style={{ margin: 0 }}>
                {t('dashResto.blockedText')}
              </p>
            </LigneCompte>
          )}
          {restaurant.adminStatus !== 'approved' && restaurant.adminStatus !== 'blocked' && (
            <LigneCompte accent="warn" icone="🕐" titre={t('dashResto.pendingTitle')} sous={t('dashResto.pendingSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
              <p className="small" style={{ margin: 0 }}>
                {t('dashResto.pendingText')}
              </p>
            </LigneCompte>
          )}
          {restaurant.stripeConnectStatus !== 'active' && (
            <LigneCompte
              accent={restaurant.stripeConnectStatus === 'restricted' ? 'danger' : 'warn'} icone="💳"
              titre={restaurant.stripeConnectStatus === 'restricted' ? t('dashResto.paymentInfoTitle') : t('dashResto.paymentsToConfigure')}
              sous={restaurant.stripeConnectStatus === 'restricted'
                ? t('dashResto.stripeNeedsInfoResto')
                : t('dashResto.viaStripeResto')}
              action={(
                <button type="button" className="btn-gold" style={{ padding: '8px 12px', fontSize: 13 }} disabled={connecting} onClick={connectOnboard}>
                  {connecting ? '...' : (restaurant.stripeConnectStatus === 'restricted' ? t('dashResto.complete') : t('dashResto.configure'))}
                </button>
              )}
            />
          )}
        </div>
      )}

      {/* Placée au niveau du layout, pas de la page Commandes : le restaurateur doit être alerté même
          s'il est en train de modifier son menu ou de consulter ses avis. */}
      {restaurant && <NewOrderAlertBar {...orderAlert} />}

      {restaurant && (
        <Outlet context={{ restaurant, orders, reviews, drivers, restoId, loadDashboard }} />
      )}
    </div>
  );
}
