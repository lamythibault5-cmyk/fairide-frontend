import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { CATEGORIES, defaultItemImage } from '../../menuCategories';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import RestaurantsMap from '../../components/RestaurantsMap';
import OptionsPickerModal from '../../components/OptionsPickerModal';
import { DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel } from '../../orderStatus';

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dates sélectionnables pour "programmer" une commande : aujourd'hui + les 7 prochains jours (même
// fenêtre que la validation côté serveur).
function getScheduleDateOptions() {
  const now = new Date();
  const opts = [];
  for (let day = 0; day <= 7; day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    let label;
    if (day === 0) label = "Aujourd'hui";
    else if (day === 1) label = 'Demain';
    else label = d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });
    opts.push({ value: dateKey(d), label });
  }
  return opts;
}

// Créneaux de 30 min entre 9h et 22h pour la date choisie — au moins 45 min à l'avance si c'est
// aujourd'hui, sinon toute la plage horaire est proposée.
function getScheduleTimeOptions(dateStr) {
  if (!dateStr) return [];
  const now = new Date();
  const dayStart = 9, dayEnd = 22;
  const [y, m, d] = dateStr.split('-').map(Number);
  const isToday = dateStr === dateKey(now);
  let cursor;
  if (isToday) {
    cursor = new Date(now.getTime() + 45 * 60000);
    const minutes = cursor.getMinutes();
    const rounded = minutes % 30 === 0 ? minutes : minutes + (30 - (minutes % 30));
    cursor.setMinutes(rounded, 0, 0);
    if (cursor.getHours() < dayStart) cursor.setHours(dayStart, 0, 0, 0);
  } else {
    cursor = new Date(y, m - 1, d, dayStart, 0, 0, 0);
  }
  const dayEndTime = new Date(y, m - 1, d, dayEnd, 0, 0, 0);
  const slots = [];
  while (cursor <= dayEndTime && slots.length < 30) {
    const hh = String(cursor.getHours()).padStart(2, '0');
    const mm = String(cursor.getMinutes()).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    cursor = new Date(cursor.getTime() + 30 * 60000);
  }
  return slots;
}

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const { token, user, refreshUser } = useAuth();
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('sonner');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [useBalance, setUseBalance] = useState(true);
  const [fulfillmentType, setFulfillmentType] = useState('delivery');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [dateOptions] = useState(getScheduleDateOptions);
  const [placing, setPlacing] = useState(false);
  const [pickerItem, setPickerItem] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const pendingOrderRef = useRef(null);
  // Calculé une seule fois, avant que l'effet ci-dessous ne mette sessionStorage à jour : distingue un
  // rafraîchissement de cette même page (F5) d'une vraie navigation vers un autre restaurant.
  const isRefreshRef = useRef(sessionStorage.getItem('fairide_last_restaurant_viewed') === id);
  const scrollRestoredRef = useRef(false);
  // Capturé une seule fois au montage, avant que l'effet de suivi du scroll ci-dessous ne puisse
  // écraser cette valeur (ex. suite à la restauration native du navigateur au rechargement).
  const savedScrollRef = useRef(sessionStorage.getItem(`fairide_scroll_${id}`));

  useEffect(() => {
    if (!isRefreshRef.current) {
      // Vraie navigation vers un nouveau restaurant : on part du haut, et on oublie toute position de
      // scroll sauvegardée pour cette page lors d'une visite précédente.
      window.scrollTo(0, 0);
      sessionStorage.removeItem(`fairide_scroll_${id}`);
    }
    sessionStorage.setItem('fairide_last_restaurant_viewed', id);
    cart.startOrder(id);
    api(`/restaurants/${id}`).then(setRestaurant).catch((e) => toast(e.message));
    api(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    api('/restaurants').then((all) => setDiscover(all.filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8))).catch(() => {});
    api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sauvegarde en continu la position de scroll pour pouvoir la restaurer après un rafraîchissement,
  // puisque le contenu (menu, avis...) se charge de façon asynchrone et décale la hauteur de la page.
  useEffect(() => {
    const prevRestoration = 'scrollRestoration' in window.history ? window.history.scrollRestoration : null;
    // Désactive la restauration native du navigateur au rechargement : elle déclenche ses propres
    // événements "scroll" qui écraseraient notre position sauvegardée avant qu'on ait pu la restaurer.
    if (prevRestoration) window.history.scrollRestoration = 'manual';
    function saveScroll() {
      sessionStorage.setItem(`fairide_scroll_${id}`, String(window.scrollY));
    }
    window.addEventListener('scroll', saveScroll, { passive: true });
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener('scroll', saveScroll);
      window.removeEventListener('beforeunload', saveScroll);
      if (prevRestoration) window.history.scrollRestoration = prevRestoration;
    };
  }, [id]);

  // Une fois le contenu du restaurant chargé, restaure la position sauvegardée si c'est un
  // rafraîchissement (sinon la page reste en haut, déjà géré ci-dessus). On utilise la valeur capturée
  // au montage (savedScrollRef) plutôt que de relire sessionStorage, qui a pu être écrasé entre-temps.
  useEffect(() => {
    if (restaurant && !scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      if (isRefreshRef.current) {
        const savedY = savedScrollRef.current;
        if (savedY) {
          const targetY = Number(savedY);
          // Réapplique la position à plusieurs reprises : les images du menu se chargent de façon
          // asynchrone et augmentent la hauteur de la page après le premier rendu, ce qui peut faire
          // "clamper" un scrollTo trop précoce à une position plus basse que la cible.
          const timers = [0, 100, 300, 600, 1000].map((d) => setTimeout(() => window.scrollTo(0, targetY), d));
          return () => timers.forEach(clearTimeout);
        }
      }
    }
  }, [restaurant, id]);

  // Le client attend qu'on l'amène directement au résumé de sa commande après avoir cliqué "Commander",
  // plutôt que de devoir chercher la carte de confirmation plus bas dans la page.
  useEffect(() => {
    if (pendingOrder && pendingOrderRef.current) {
      pendingOrderRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pendingOrder]);

  if (!restaurant) return <SkeletonCards count={3} />;

  const totals = cart.totals(restaurant.menu);
  // À emporter : pas de frais de livraison/système, contrairement à l'estimation par défaut de cart.totals().
  const estimatedTotalBeforeBalance = fulfillmentType === 'delivery' ? totals.total : totals.subtotal;
  const estimatedTotal = Math.max(0, estimatedTotalBeforeBalance - (useBalance ? Math.min(user.balance || 0, estimatedTotalBeforeBalance) : 0));
  const scheduleTimeOptions = scheduleDate ? getScheduleTimeOptions(scheduleDate) : [];
  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  const isFavorite = favoriteIds.has(id);

  async function toggleFavorite() {
    setFavoriteBusy(true);
    try {
      if (isFavorite) {
        await api(`/restaurants/${id}/favorite`, { method: 'DELETE', token });
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await api(`/restaurants/${id}/favorite`, { method: 'POST', token });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function confirmAndPay() {
    setPaying(true);
    try {
      const pay = await api(`/payments/checkout/${pendingOrder.id}`, { method: 'POST', token });
      if (pay.simulated) {
        toast('Commande passée et payée (paiement simulé).');
        navigate('/orders');
      } else {
        window.location.href = pay.checkoutUrl;
      }
    } catch (e) {
      toast(e.message);
      setPaying(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${pendingOrder.id}/cancel`, { method: 'PATCH', token });
      toast('Commande annulée.');
      setPendingOrder(null);
      if (pendingOrder.balanceUsed > 0) refreshUser().catch(() => {});
    } catch (e) {
      toast(e.message);
    } finally {
      setCancelling(false);
    }
  }

  function addToCart(item) {
    if (item.optionGroups?.length > 0) {
      setPickerItem(item);
    } else {
      cart.addOne(item.id, item.price);
    }
  }

  async function placeOrder() {
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast('Complète ton adresse de livraison (rue, numéro, code postal, ville).');
      return;
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast('Choisis une date et une heure pour ta commande programmée.');
      return;
    }
    const scheduledForISO = scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString() : null;
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
    setPlacing(true);
    try {
      // Les frais de livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande
      // créée côté serveur — on affiche donc le total exact avant de rediriger vers le paiement.
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId: id, items, orderType: fulfillmentType,
          scheduledFor: scheduledForISO,
          ...(fulfillmentType === 'delivery' ? {
            addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
            addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
            deliveryInstructions, deliveryNote: deliveryNote.trim()
          } : {}),
          useBalance
        }
      });
      cart.clear();
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      setDeliveryConfirmed(false);
      setPendingOrder(order);
    } catch (e) {
      toast(e.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div>
      <Link to="/restaurants" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10 }}>&larr; Tous les restaurants</Link>
      <div className="card">
        {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner-detail" />}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ marginBottom: 2 }}>{restaurant.name}</h2>
          <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 18 }} disabled={favoriteBusy} onClick={toggleFavorite} title="Ajouter aux favoris">
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
        <div className="row" style={{ gap: 6, margin: '2px 0' }}>
          <StarsDisplay value={restaurant.rating} />
          <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : 'Nouveau'}</span>
        </div>
        <p className="small" style={{ margin: '0 0 4px' }}>{restaurant.desc || ''} · {restaurant.commune}</p>
        <p className="small" style={{ margin: '0 0 10px' }}>{restaurant.openingHours ? `🕐 ${restaurant.openingHours}` : ''}</p>
        {restaurant.lat && restaurant.lng && (
          <div style={{ marginBottom: 14 }}>
            <RestaurantsMap restaurants={[restaurant]} height={220} singleMarker />
          </div>
        )}
        {restaurant.hasPromo && (
          <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontWeight: 700, fontSize: 13 }}>
            🏷️ Des promos sont en cours sur certains plats — repère le badge rouge !
          </div>
        )}
      </div>

      <div className="card">
        {restaurant.menu.length === 0 && <div className="empty">Ce restaurant n'a pas encore de plat au menu.</div>}
        {CATEGORIES.map((cat) => {
          const items = restaurant.menu.filter((i) => (i.category || 'plat') === cat.value);
          if (!items.length) return null;
          return (
            <div key={cat.value}>
              <div className="category-header">
                {cat.image && <img src={cat.image} alt={cat.label} />}
                <span>{cat.label}</span>
              </div>
              <div className="menu-grid">
                {items.map((item) => (
                  <div className="menu-item-card" key={item.id} style={{ position: 'relative', ...(item.available === false ? { opacity: 0.5 } : {}) }}>
                    {item.activePromo && <span className="promo-badge">🏷️ {item.activePromo.label}</span>}
                    <img src={item.imageUrl || defaultItemImage(item)} alt={item.name} className="dish-thumb-lg" />
                    <div className="name">{item.name}</div>
                    <div className="small desc">{item.available === false ? 'Indisponible pour le moment' : (item.desc || '')}</div>
                    <div className="bottom-row">
                      <span className="price">{item.price.toFixed(2)}€</span>
                      <button className="btn-outline" style={{ padding: '6px 12px' }} disabled={item.available === false} onClick={() => addToCart(item)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {cart.count > 0 && (
        <>
          <div className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Ton panier</h3>
            {Object.entries(cart.lines).map(([lineKey, line]) => {
              const item = restaurant.menu.find((m) => m.id === line.itemId);
              if (!item) return null;
              return (
                <div key={lineKey} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
                  <span>
                    {item.name}
                    {line.optionsSnapshot?.length > 0 && (
                      <span className="small" style={{ display: 'block' }}>{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                    )}
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, -1)}>−</button>
                    <span>{line.qty}</span>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, 1)}>+</button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>Sous-total</span><span>{totals.rawSubtotal.toFixed(2)}€</span></div>
              {totals.discountedItems.map((d, i) => (
                <div className="line" key={i}><span>🏷️ {d.name} ({d.label})</span><span>-{d.discount.toFixed(2)}€</span></div>
              ))}
              {fulfillmentType === 'delivery' && (
                <>
                  <div className="line"><span>Livraison (à partir de)</span><span>{totals.deliveryFee.toFixed(2)}€</span></div>
                  <div className="line"><span>Frais de système (à partir de)</span><span>{totals.serviceFee.toFixed(2)}€</span></div>
                </>
              )}
              <div className="line"><span>dont commission Fairide (10%)</span><span>{totals.commission.toFixed(2)}€</span></div>
              {useBalance && user.balance > 0 && (
                <div className="line"><span>Solde Fairide utilisé</span><span>-{Math.min(user.balance, estimatedTotalBeforeBalance).toFixed(2)}€</span></div>
              )}
              <div className="line total"><span>Total</span><span>{estimatedTotal.toFixed(2)}€</span></div>
            </div>
            {user.balance > 0 && (
              <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                <span className="small">Utiliser mon solde Fairide ({Number(user.balance).toFixed(2)}€ disponible)</span>
              </label>
            )}
          </div>
          <div className="field">
            <label>Comment récupérer ta commande ?</label>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className={fulfillmentType === 'delivery' ? 'btn-gold' : 'btn-outline'} style={{ flex: 1 }} onClick={() => setFulfillmentType('delivery')}>🛵 Livraison</button>
              <button type="button" className={fulfillmentType === 'pickup' ? 'btn-gold' : 'btn-outline'} style={{ flex: 1 }} onClick={() => setFulfillmentType('pickup')}>🏠 À emporter</button>
            </div>
          </div>
          {fulfillmentType === 'delivery' && (
            <>
              <div className="field">
                <label>Rue / Avenue</label>
                <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" />
              </div>
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
              <div className="field">
                <label>Ville / Commune</label>
                <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Bruxelles" />
              </div>
              <div className="field">
                <label>À la livraison</label>
                <select value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)}>
                  {DELIVERY_INSTRUCTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Note pour le livreur (optionnel)</label>
                <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Ex: Code d'entrée 1234, 3ème étage..." />
              </div>
            </>
          )}
          {fulfillmentType === 'pickup' && (
            <p className="small" style={{ margin: '0 0 10px' }}>🏠 Tu viendras chercher ta commande toi-même chez <b>{restaurant.name}</b>{restaurant.address ? `, ${restaurant.address}` : ''}.</p>
          )}
          <div className="field">
            <label className="row" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={scheduleEnabled}
                onChange={(e) => {
                  setScheduleEnabled(e.target.checked);
                  if (e.target.checked) { setScheduleDate(dateOptions[0].value); setScheduleTime(''); }
                  else { setScheduleDate(''); setScheduleTime(''); }
                }}
              />
              <span>🕐 Programmer pour plus tard (au lieu du plus vite possible)</span>
            </label>
            {scheduleEnabled && (
              <>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <select
                    value={scheduleDate}
                    onChange={(e) => { setScheduleDate(e.target.value); setScheduleTime(''); }}
                    style={{ flex: 1 }}
                  >
                    {dateOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <select
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Heure...</option>
                    {scheduleTimeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {scheduleTimeOptions.length === 0 && (
                  <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>Plus aucun créneau disponible pour ce jour.</p>
                )}
                {scheduledPreview && (
                  <p className="small" style={{ margin: '6px 0 0' }}>🕐 Commande programmée pour : <b>{scheduledPreview}</b></p>
                )}
              </>
            )}
          </div>
          <div className="cart-bar">
            <span>{cart.count} article(s) · à partir de {estimatedTotal.toFixed(2)}€</span>
            <button className="btn-gold" disabled={placing} onClick={placeOrder}>
              {placing ? '...' : 'Commander'}
            </button>
          </div>
        </>
      )}

      {pendingOrder && (
        <div className="card" ref={pendingOrderRef}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Confirme ta commande</h3>
          {pendingOrder.orderType === 'delivery' && !pendingOrder.scheduledFor && (
            <p className="small" style={{ margin: '0 0 10px' }}>Les frais de livraison sont calculés selon la distance réelle jusqu'à ton adresse.</p>
          )}

          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', margin: '0 0 14px' }}>
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 8px' }}>
              <input
                type="checkbox"
                checked={deliveryConfirmed}
                onChange={(e) => setDeliveryConfirmed(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span className="small" style={{ fontWeight: 600 }}>
                {pendingOrder.orderType === 'delivery'
                  ? '📍 Je confirme que mes informations de livraison sont correctes'
                  : "🏠 Je confirme vouloir venir chercher ma commande moi-même"}
              </span>
            </label>
            {pendingOrder.orderType === 'delivery' ? (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>Adresse :</b> {pendingOrder.address}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>À la livraison :</b> {deliveryInstructionLabel(pendingOrder.deliveryInstructions)}</p>
                {pendingOrder.deliveryNote && <p className="small" style={{ margin: '0 0 4px' }}><b>Note pour le livreur :</b> {pendingOrder.deliveryNote}</p>}
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>📅 Livraison programmée pour :</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>Arrivée estimée :</b> vers {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            ) : (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>À venir chercher chez :</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>📅 Prête pour :</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>Retrait estimé :</b> vers {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
          </div>

          <div className="breakdown">
            <div className="line"><span>Sous-total</span><span>{pendingOrder.subtotal.toFixed(2)}€</span></div>
            {pendingOrder.promoDiscount > 0 && <div className="line"><span>Promo {pendingOrder.promoLabel}</span><span>-{pendingOrder.promoDiscount.toFixed(2)}€</span></div>}
            {pendingOrder.orderType === 'delivery' && (
              <>
                <div className="line"><span>Livraison</span><span>{pendingOrder.deliveryFee.toFixed(2)}€</span></div>
                <div className="line"><span>Frais de système</span><span>{pendingOrder.serviceFee.toFixed(2)}€</span></div>
              </>
            )}
            {pendingOrder.balanceUsed > 0 && <div className="line"><span>Solde Fairide utilisé</span><span>-{pendingOrder.balanceUsed.toFixed(2)}€</span></div>}
            <div className="line total"><span>Total à payer</span><span>{pendingOrder.total.toFixed(2)}€</span></div>
          </div>

          {!deliveryConfirmed && (
            <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>⚠️ Coche la case ci-dessus pour confirmer avant de payer.</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn-gold" disabled={paying || cancelling || !deliveryConfirmed} onClick={confirmAndPay}>{paying ? '...' : 'Confirmer et payer'}</button>
            <button className="btn-ghost" disabled={paying || cancelling} onClick={cancelOrder}>{cancelling ? '...' : 'Annuler'}</button>
          </div>
        </div>
      )}

      {reviews && reviews.reviews.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Avis clients</h3>
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName}</b>
                <StarsDisplay value={r.foodRating} />
              </div>
              {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
            </div>
          ))}
        </div>
      )}

      {discover.length > 0 && <DiscoverSection restaurants={discover} />}

      {pickerItem && (
        <OptionsPickerModal
          item={pickerItem}
          onCancel={() => setPickerItem(null)}
          onConfirm={(optionItemIds, snapshot, unitPrice) => {
            cart.addOne(pickerItem.id, unitPrice, optionItemIds, snapshot);
            setPickerItem(null);
          }}
        />
      )}
    </div>
  );
}

function DiscoverSection({ restaurants }) {
  const canLoop = restaurants.length >= 3;
  const items = canLoop ? [...restaurants, ...restaurants] : restaurants;
  return (
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      <h3 className="section-title" style={{ fontSize: 16 }}>Découvrir aussi</h3>
      <div className="discover-marquee">
        <div
          className={`discover-track${canLoop ? ' animate' : ''}`}
          style={canLoop ? { animationDuration: `${restaurants.length * 4}s` } : undefined}
        >
          {items.map((r, i) => (
            <Link key={`${r.id}-${i}`} to={`/restaurants/${r.id}`} className="discover-card">
              {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} />}
              <div className="info">
                <b>{r.name}</b>
                <span className="small">{r.commune}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
