import { useEffect, useState } from 'react';
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

// Créneaux de 30 min proposés pour "programmer" une commande : au moins 45 min à l'avance, entre 9h et
// 22h, sur aujourd'hui puis demain si la fenêtre du jour est dépassée.
function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  const dayStart = 9, dayEnd = 22;
  for (let day = 0; day < 2 && slots.length < 24; day++) {
    let cursor;
    if (day === 0) {
      cursor = new Date(now.getTime() + 45 * 60000);
      const minutes = cursor.getMinutes();
      const roundedMinutes = minutes % 30 === 0 ? minutes : minutes + (30 - (minutes % 30));
      cursor.setMinutes(roundedMinutes, 0, 0);
      if (cursor.getHours() < dayStart) cursor.setHours(dayStart, 0, 0, 0);
    } else {
      cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, dayStart, 0, 0, 0);
    }
    const dayEndTime = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), dayEnd, 0, 0, 0);
    while (cursor <= dayEndTime && slots.length < 24) {
      slots.push({
        value: cursor.toISOString(),
        label: `${day === 0 ? "Aujourd'hui" : 'Demain'} ${cursor.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`
      });
      cursor = new Date(cursor.getTime() + 30 * 60000);
    }
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
  const [scheduledFor, setScheduledFor] = useState('');
  const [timeSlots] = useState(generateTimeSlots);
  const [placing, setPlacing] = useState(false);
  const [pickerItem, setPickerItem] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    cart.startOrder(id);
    api(`/restaurants/${id}`).then(setRestaurant).catch((e) => toast(e.message));
    api(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    api('/restaurants').then((all) => setDiscover(all.filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8))).catch(() => {});
    api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!restaurant) return <SkeletonCards count={3} />;

  const totals = cart.totals(restaurant.menu);
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
    if (scheduleEnabled && !scheduledFor) {
      toast('Choisis une heure pour ta commande programmée.');
      return;
    }
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
    setPlacing(true);
    try {
      // Les frais de livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande
      // créée côté serveur — on affiche donc le total exact avant de rediriger vers le paiement.
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId: id, items, orderType: fulfillmentType,
          scheduledFor: scheduleEnabled && scheduledFor ? scheduledFor : null,
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
                <div className="line"><span>Solde Fairide utilisé</span><span>-{Math.min(user.balance, totals.total).toFixed(2)}€</span></div>
              )}
              <div className="line total"><span>Total</span><span>{Math.max(0, (fulfillmentType === 'delivery' ? totals.total : totals.rawSubtotal - totals.discountedItems.reduce((s, d) => s + d.discount, 0)) - (useBalance ? Math.min(user.balance || 0, totals.total) : 0)).toFixed(2)}€</span></div>
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
                onChange={(e) => { setScheduleEnabled(e.target.checked); if (!e.target.checked) setScheduledFor(''); }}
              />
              <span>🕐 Programmer pour plus tard (au lieu du plus vite possible)</span>
            </label>
            {scheduleEnabled && (
              <select value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} style={{ marginTop: 8 }}>
                <option value="">Choisis une heure...</option>
                {timeSlots.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </div>
          <div className="cart-bar">
            <span>{cart.count} article(s) · à partir de {Math.max(0, totals.total - (useBalance ? Math.min(user.balance || 0, totals.total) : 0)).toFixed(2)}€</span>
            <button className="btn-gold" disabled={placing} onClick={placeOrder}>
              {placing ? '...' : 'Commander'}
            </button>
          </div>
        </>
      )}

      {pendingOrder && (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Confirme ta commande</h3>
          {pendingOrder.orderType === 'delivery' && !pendingOrder.scheduledFor && (
            <p className="small" style={{ margin: '0 0 10px' }}>Les frais de livraison sont calculés selon la distance réelle jusqu'à ton adresse.</p>
          )}

          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', margin: '0 0 14px' }}>
            {pendingOrder.orderType === 'delivery' ? (
              <>
                <p className="small" style={{ margin: '0 0 8px', fontWeight: 600 }}>📍 Vérifie tes informations de livraison</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>Adresse :</b> {pendingOrder.address}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>À la livraison :</b> {deliveryInstructionLabel(pendingOrder.deliveryInstructions)}</p>
                {pendingOrder.deliveryNote && <p className="small" style={{ margin: '0 0 4px' }}><b>Note pour le livreur :</b> {pendingOrder.deliveryNote}</p>}
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: '0 0 8px' }}><b>📅 Livraison programmée pour :</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: '0 0 8px' }}><b>Arrivée estimée :</b> vers {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            ) : (
              <>
                <p className="small" style={{ margin: '0 0 8px', fontWeight: 600 }}>🏠 Vérifie les informations de retrait</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>À venir chercher chez :</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: '0 0 8px' }}><b>📅 Prête pour :</b> {new Date(pendingOrder.scheduledFor).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: '0 0 8px' }}><b>Retrait estimé :</b> vers {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={deliveryConfirmed}
                onChange={(e) => setDeliveryConfirmed(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span className="small">
                {pendingOrder.orderType === 'delivery'
                  ? 'Je confirme que ces informations de livraison sont correctes'
                  : 'Je confirme vouloir venir chercher ma commande moi-même'}
              </span>
            </label>
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
            <button className="btn-gold" disabled={paying || !deliveryConfirmed} onClick={confirmAndPay}>{paying ? '...' : 'Confirmer et payer'}</button>
            <button className="btn-ghost" disabled={paying} onClick={() => setPendingOrder(null)}>Annuler</button>
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
