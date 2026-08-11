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
import { DELIVERY_INSTRUCTION_OPTIONS } from '../../orderStatus';

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
  const [placing, setPlacing] = useState(false);
  const [pickerItem, setPickerItem] = useState(null);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
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

  function addToCart(item) {
    if (item.optionGroups?.length > 0) {
      setPickerItem(item);
    } else {
      cart.addOne(item.id, item.price);
    }
  }

  async function placeOrder() {
    if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim()) {
      toast('Complète ton adresse de livraison (rue, numéro, code postal, ville).');
      return;
    }
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
    setPlacing(true);
    try {
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId: id, items,
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
          addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
          deliveryInstructions, deliveryNote: deliveryNote.trim(), useBalance
        }
      });
      const pay = await api(`/payments/checkout/${order.id}`, { method: 'POST', token });
      cart.clear();
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      if (pay.simulated) {
        toast('Commande passée et payée (paiement simulé).');
        navigate('/orders');
      } else {
        window.location.href = pay.checkoutUrl;
      }
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
              <div className="line"><span>Livraison</span><span>{totals.deliveryFee.toFixed(2)}€</span></div>
              <div className="line"><span>Frais de service</span><span>{totals.serviceFee.toFixed(2)}€</span></div>
              <div className="line"><span>dont commission Fairide (6%)</span><span>{totals.commission.toFixed(2)}€</span></div>
              {useBalance && user.balance > 0 && (
                <div className="line"><span>Solde Fairide utilisé</span><span>-{Math.min(user.balance, totals.total).toFixed(2)}€</span></div>
              )}
              <div className="line total"><span>Total</span><span>{Math.max(0, totals.total - (useBalance ? Math.min(user.balance || 0, totals.total) : 0)).toFixed(2)}€</span></div>
            </div>
            {user.balance > 0 && (
              <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                <span className="small">Utiliser mon solde Fairide ({Number(user.balance).toFixed(2)}€ disponible)</span>
              </label>
            )}
          </div>
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
          <div className="cart-bar">
            <span>{cart.count} article(s) · {Math.max(0, totals.total - (useBalance ? Math.min(user.balance || 0, totals.total) : 0)).toFixed(2)}€</span>
            <button className="btn-gold" disabled={placing} onClick={placeOrder}>
              {placing ? '...' : 'Commander et payer'}
            </button>
          </div>
        </>
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

      {discover.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="section-title" style={{ fontSize: 16 }}>Découvrir aussi</h3>
          <div className="discover-scroll">
            {discover.map((r) => (
              <Link key={r.id} to={`/restaurants/${r.id}`} className="discover-card">
                {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} />}
                <div className="info">
                  <b>{r.name}</b>
                  <span className="small">{r.commune}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
