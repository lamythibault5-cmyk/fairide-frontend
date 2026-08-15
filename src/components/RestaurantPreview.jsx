import { useState } from 'react';
import { StarsDisplay } from './Stars';
import OptionsPickerModal from './OptionsPickerModal';
import MenuCategorySections from './MenuCategorySections';

const DELIVERY_FEE = 4.5;
const SYSTEM_FEE_RATE = 0.10;

function lineKeyFor(itemId, optionItemIds) {
  return `${itemId}::${[...(optionItemIds || [])].sort().join(',')}`;
}

// Aperçu client en lecture quasi seule pour le restaurateur : mêmes composants visuels que la page
// client (menu, panier, récap), mais un panier local isolé (pas le CartContext réel) et aucune
// commande possible — sert uniquement à vérifier le rendu du menu tel que les clients le voient.
export default function RestaurantPreview({ restaurant }) {
  const [lines, setLines] = useState({});
  const [pickerItem, setPickerItem] = useState(null);

  function addOne(itemId, unitPrice, optionItemIds = [], optionsSnapshot = []) {
    const key = lineKeyFor(itemId, optionItemIds);
    setLines((prev) => {
      const existing = prev[key];
      return { ...prev, [key]: { itemId, optionItemIds, optionsSnapshot, unitPrice, qty: (existing?.qty || 0) + 1 } };
    });
  }

  function changeLineQty(lineKey, delta) {
    setLines((prev) => {
      const existing = prev[lineKey];
      if (!existing) return prev;
      const qty = existing.qty + delta;
      const next = { ...prev };
      if (qty <= 0) delete next[lineKey]; else next[lineKey] = { ...existing, qty };
      return next;
    });
  }

  function addToCart(item) {
    if (item.optionGroups?.length > 0) setPickerItem(item);
    else addOne(item.id, item.price);
  }

  const count = Object.values(lines).reduce((a, l) => a + l.qty, 0);
  let subtotal = 0;
  Object.values(lines).forEach((l) => { subtotal += l.unitPrice * l.qty; });
  subtotal = +subtotal.toFixed(2);
  const serviceFee = +(DELIVERY_FEE * SYSTEM_FEE_RATE).toFixed(2);
  const total = +(subtotal + DELIVERY_FEE + serviceFee).toFixed(2);

  return (
    <div>
      <div style={{ background: 'var(--ink)', color: 'var(--cream)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, fontSize: 13 }}>
        🔍 Aperçu — c'est exactement ce que voient tes clients. Tu peux tester l'ajout au panier, mais aucune commande réelle ne sera passée.
      </div>

      <div className="card">
        {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner-detail" />}
        <h2 style={{ marginBottom: 2 }}>{restaurant.name}</h2>
        <div className="row" style={{ gap: 6, margin: '2px 0' }}>
          <StarsDisplay value={restaurant.rating} />
          <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : 'Nouveau'}</span>
        </div>
        <p className="small" style={{ margin: '0 0 4px' }}>{restaurant.desc || ''} · {restaurant.commune}</p>
        <p className="small" style={{ margin: '0 0 10px' }}>{restaurant.openingHours ? `🕐 ${restaurant.openingHours}` : ''}</p>
        {restaurant.hasPromo && (
          <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontWeight: 700, fontSize: 13 }}>
            🏷️ Des promos sont en cours sur certains plats — repère le badge rouge !
          </div>
        )}
        {restaurant.menu.length === 0 && <div className="empty">Ton menu est encore vide — tes clients ne verront rien tant que tu n'as pas ajouté de plats.</div>}
        <MenuCategorySections menu={restaurant.menu} sections={restaurant.sections || []} onAdd={addToCart} />
      </div>

      {count > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Panier (aperçu)</h3>
          {Object.entries(lines).map(([lineKey, line]) => {
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
                  <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => changeLineQty(lineKey, -1)}>−</button>
                  <span>{line.qty}</span>
                  <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => changeLineQty(lineKey, 1)}>+</button>
                </div>
              </div>
            );
          })}
          <div className="divider" />
          <div className="breakdown">
            <div className="line"><span>Sous-total</span><span>{subtotal.toFixed(2)}€</span></div>
            <div className="line"><span>Livraison (exemple, dépend de la distance réelle)</span><span>{DELIVERY_FEE.toFixed(2)}€</span></div>
            <div className="line"><span>Frais de système (exemple)</span><span>{serviceFee.toFixed(2)}€</span></div>
            <div className="line total"><span>Total (exemple)</span><span>{total.toFixed(2)}€</span></div>
          </div>
          <div className="cart-bar" style={{ marginTop: 12 }}>
            <span>{count} article(s) · aperçu uniquement</span>
            <button className="btn-ghost" disabled title="Mode aperçu — aucune commande réelle ne peut être passée">🔒 Commande désactivée</button>
          </div>
        </div>
      )}

      {pickerItem && (
        <OptionsPickerModal
          item={pickerItem}
          onCancel={() => setPickerItem(null)}
          onConfirm={(optionItemIds, snapshot, unitPrice) => {
            addOne(pickerItem.id, unitPrice, optionItemIds, snapshot);
            setPickerItem(null);
          }}
        />
      )}
    </div>
  );
}
