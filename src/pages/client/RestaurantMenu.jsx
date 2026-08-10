import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { CATEGORIES } from '../../menuCategories';
import { SkeletonCards } from '../../components/Skeleton';
import { DELIVERY_INSTRUCTION_OPTIONS } from '../../orderStatus';

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const { token, user } = useAuth();
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('sonner');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [useBalance, setUseBalance] = useState(true);
  const [placing, setPlacing] = useState(false);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    cart.startOrder(id);
    api(`/restaurants/${id}`).then(setRestaurant).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!restaurant) return <SkeletonCards count={3} />;

  const totals = cart.totals(restaurant.menu);

  async function placeOrder() {
    if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim()) {
      toast('Complète ton adresse de livraison (rue, numéro, code postal, ville).');
      return;
    }
    const items = Object.entries(cart.items).map(([itemId, qty]) => ({ itemId, qty }));
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
        <h2 style={{ marginBottom: 2 }}>{restaurant.name}</h2>
        <p className="small" style={{ margin: '0 0 4px' }}>{restaurant.desc || ''} · {restaurant.commune}</p>
        <p className="small" style={{ margin: '0 0 14px' }}>{restaurant.openingHours ? `🕐 ${restaurant.openingHours}` : ''}</p>
        {restaurant.menu.length === 0 && <div className="empty">Ce restaurant n'a pas encore de plat au menu.</div>}
        {CATEGORIES.map((cat) => {
          const items = restaurant.menu.filter((i) => (i.category || 'plat') === cat.value);
          if (!items.length) return null;
          return (
            <div key={cat.value} style={{ marginBottom: 8 }}>
              <div className="category-header">
                {cat.image && <img src={cat.image} alt={cat.label} />}
                <span>{cat.label}</span>
              </div>
              {items.map((item) => (
                <div className="menu-item" key={item.id}>
                  <div className="row" style={{ gap: 10 }}>
                    {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="dish-thumb" />}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      <div className="small">{item.desc || ''}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="price">{item.price.toFixed(2)}€</span>
                    <button className="btn-outline" style={{ padding: '6px 12px' }} onClick={() => cart.changeQty(item.id, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {cart.count > 0 && (
        <>
          <div className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Ton panier</h3>
            {Object.entries(cart.items).map(([itemId, qty]) => {
              const item = restaurant.menu.find((m) => m.id === itemId);
              if (!item) return null;
              return (
                <div key={itemId} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
                  <span>{item.name}</span>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeQty(itemId, -1)}>−</button>
                    <span>{qty}</span>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeQty(itemId, 1)}>+</button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>Sous-total</span><span>{totals.subtotal.toFixed(2)}€</span></div>
              <div className="line"><span>Livraison</span><span>{totals.deliveryFee.toFixed(2)}€</span></div>
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
    </div>
  );
}
