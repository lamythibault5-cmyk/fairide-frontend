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
import useNewOrderAlert from '../../hooks/useNewOrderAlert';

// Charge une seule fois restaurant/orders/reviews/drivers et les partage aux sous-pages via
// l'outlet context, plutôt que de dupliquer ce chargement dans chacune. Porte aussi tout ce qui est
// commun à toutes les sous-pages : formulaire de création, bannières (validation/abonnement/Stripe),
// et la carte "Aujourd'hui" de la colonne de droite.
export default function DashboardLayout() {
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
  const orderAlert = useNewOrderAlert(orders);

  const [connecting, setConnecting] = useState(false);
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
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Aujourd'hui</h3>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <StarsDisplay value={restaurant.rating} size={16} />
          <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : 'Pas encore d\'avis'}</span>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="num">{orders.length}</div><div className="label">Commandes</div></div>
          <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livrées</div></div>
          <div className="stat-card"><div className="num">{revenue.toFixed(0)}€</div><div className="label">CA plats</div></div>
          <div className="stat-card highlight"><div className="num">{saved > 0 ? saved.toFixed(0) : '0'}€</div><div className="label">Économisé vs les grandes plateformes</div></div>
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
      toast('Configuration des paiements en cours de validation (quelques secondes).');
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
    } catch (e) {
      toast(e.message);
    }
  }

  function pickResto(id) {
    setRestoId(id);
    loadDashboard(id);
  }

  async function createResto() {
    if (!name.trim()) { toast('Donne un nom à ton restaurant.'); return; }
    if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim()) {
      toast("Donne l'adresse complète du restaurant (rue, numéro, code postal) pour les livreurs et la carte.");
      return;
    }
    if (!hours || !Object.values(hours).some((shifts) => Array.isArray(shifts) && shifts.length)) {
      toast('Indique tes horaires d\'ouverture : ton commerce ne sera visible que pendant ces créneaux.');
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
        toast("Restaurant créé ! Ajoute maintenant l'email de ton livreur dans la section Livraison pour activer ton propre livreur.");
      } else {
        toast('Restaurant créé !');
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
          <h2 style={{ marginTop: 0 }}>Mon restaurant</h2>
          {myRestos.length > 1 && (
            <div className="row" style={{ marginBottom: 10 }}>
              <select style={{ flex: 1 }} value={restoId || ''} onChange={(e) => e.target.value && pickResto(e.target.value)}>
                <option value="">— Choisir un restaurant —</option>
                {myRestos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          {!newRestoOpen && myRestos.length === 0 && (
            <button type="button" className="btn-ghost" onClick={() => setNewRestoOpen(true)}>+ Créer mon restaurant</button>
          )}
        </div>
      )}
      {newRestoOpen && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 12px', opacity: 0.75 }}>
            Une fois créé, Fairide te propose de générer ton menu et ta photo de couverture automatiquement — tu n'as que le strict nécessaire à remplir ici.
          </p>
          <p className="small" style={{ margin: '0 0 12px', opacity: 0.75 }}>
            À noter : ton abonnement Fairide (premier mois offert) ne pourra être activé qu'une fois ton compte validé par notre équipe —
            le temps de vérifier la conformité de ton commerce et que le contrat soit accepté par les deux parties.
          </p>

          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Identité</h4>
          <div className="field"><label>Nom du commerce</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Chez Momo" /></div>
          <div className="field">
            <label>Type de commerce</label>
            <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
          </div>
          {cuisine === 'Autre' && (
            <div className="field"><label>Précise le type</label><input value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder="Ex: Grec, Mexicain..." /></div>
          )}

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Adresse (pour les livreurs et la carte)</h4>
          <div className="field">
            <label>Commune</label>
            <select value={commune} onChange={(e) => setCommune(e.target.value)}>
              {COMMUNES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Rue / Avenue</label><input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Numéro</label>
              <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Code postal</label>
              <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
            </div>
          </div>
          <div className="field"><label>Quartier (optionnel)</label><input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex: Châtelain, Flagey..." /></div>

          <div className="divider" />
          <h4 style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Horaires d'ouverture</h4>
          <p className="small" style={{ margin: '0 0 10px' }}>Obligatoire : ton commerce ne sera visible et accessible aux clients que pendant ces horaires.</p>
          <OpeningHoursEditor value={hours} onChange={setHours} />

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Présentation (tout est optionnel)</h4>
          <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Une phrase pour présenter ton commerce" /></div>
          <div className="field"><label>Image de couverture (URL) — une photo par défaut est utilisée sinon</label><input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." /></div>

          <div className="divider" />
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Livraison</h4>
          <div className="field">
            <label>Qui livre tes commandes ?</label>
            <select value={deliveryModePref} onChange={(e) => setDeliveryModePref(e.target.value)}>
              <option value="fairide">Les livreurs Fairide (pool général)</option>
              <option value="own">Mon/mes propre(s) livreur(s)</option>
            </select>
            {deliveryModePref === 'own' && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                Tu pourras lier l'email de ton livreur juste après la création (il doit avoir un compte livreur Fairide). Ton livreur suit exactement le même processus que les autres — retrait/livraison par code, position en direct.
              </p>
            )}
          </div>
          <button className="btn-teal" onClick={createResto}>Créer mon restaurant</button>
        </div>
      )}

      {restaurant && restaurant.adminStatus !== 'approved' && (
        <div className="card" style={{ border: '2px solid var(--red)' }}>
          {restaurant.adminStatus === 'blocked' ? (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🚫 Compte bloqué par Fairide</h3>
              <p className="small" style={{ margin: 0 }}>
                Ton restaurant a été bloqué par l'équipe Fairide et n'est pas visible aux clients, quel que soit ton statut d'abonnement. Contacte le support pour plus d'informations.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🕐 En attente de validation</h3>
              <p className="small" style={{ margin: 0 }}>
                Ton restaurant doit être validé par l'équipe Fairide avant d'apparaître aux clients — mais pas besoin d'attendre pour continuer :
                tu peux dès maintenant compléter ton menu. Ton abonnement (premier mois offert) ne pourra être activé qu'une fois ton compte
                validé — le temps pour Fairide de vérifier la conformité de ton commerce et que le contrat soit accepté par les deux parties.
                Dès que ton compte est validé, tu pourras t'abonner et ton restaurant deviendra visible immédiatement. C'est généralement rapide, repasse un peu plus tard.
              </p>
            </>
          )}
        </div>
      )}

      {restaurant && restaurant.stripeConnectStatus !== 'active' && (
        <div className="card" style={{ border: `2px solid ${restaurant.stripeConnectStatus === 'restricted' ? 'var(--red)' : 'var(--gold)'}` }}>
          {restaurant.stripeConnectStatus === 'restricted' ? (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⚠️ Informations de paiement à compléter</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Stripe a besoin d'informations supplémentaires pour pouvoir te verser tes paiements. Tant que ce n'est pas complété, tu ne peux pas recevoir de nouvelles commandes.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>💳 Configure tes paiements Fairide</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Pour recevoir tes paiements directement sur ton compte bancaire à chaque commande, configure tes informations de paiement via Stripe (rapide et sécurisé). Tant que ce n'est pas fait, ton restaurant ne peut pas recevoir de commandes.
              </p>
            </>
          )}
          <button className="btn-gold" disabled={connecting} onClick={connectOnboard}>
            {connecting ? '...' : (restaurant.stripeConnectStatus === 'restricted' ? 'Compléter mes informations' : 'Configurer mes paiements')}
          </button>
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
