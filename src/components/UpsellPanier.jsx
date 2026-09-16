import { useState } from 'react';
import OptionsPickerModal from './OptionsPickerModal';
import { categoryKind, resolveItemImage } from '../menuCategories';

// « Un dessert ou une boisson avec ça ? » — les suggestions de fin de panier.
//
// Ce bloc vivait dans Checkout.jsx, en premiere etape du paiement. Il est sorti ici pour etre
// partage avec la page Panier, ou il a davantage sa place : c'est devant son panier qu'on decide
// d'ajouter une boisson, pas une fois engage dans le paiement. C'est aussi l'ordre de
// l'application dont le fondateur a fourni les captures - le panier montre les offres, le paiement
// ne montre que ce qu'on paie.

export function computeUpsellSuggestions(restaurant, cart) {
  const cartItemIds = new Set(Object.values(cart.lines).map((l) => l.itemId));
  const kindOf = (item) => categoryKind(item.category);
  const hasKindInCart = (kind) => Object.values(cart.lines).some((l) => {
    const item = restaurant.menu.find((m) => m.id === l.itemId);
    return item && kindOf(item) === kind;
  });
  // Le restaurateur peut marquer explicitement certains plats à mettre en avant ici (suggestAtCheckout) —
  // s'il en a marqué au moins un dans cette catégorie, on ne montre QUE ceux-là (choix éditorial assumé du
  // restaurateur) ; sinon, repli sur le comportement automatique d'avant (n'importe quel plat de la catégorie).
  const suggestionsFor = (kind) => {
    if (hasKindInCart(kind)) return [];
    const candidates = restaurant.menu.filter((m) => kindOf(m) === kind && m.available !== false && !cartItemIds.has(m.id));
    const featured = candidates.filter((m) => m.suggestAtCheckout);
    return (featured.length > 0 ? featured : candidates).slice(0, 4);
  };
  return { desserts: suggestionsFor('dessert'), drinks: suggestionsFor('boisson') };
}

export function LastChanceUpsell({ desserts, drinks, restaurant, cart, t }) {
  if (desserts.length === 0 && drinks.length === 0) return null;

  return (
    <div className="card upsell-card">
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('checkout.upsellTitle')}</h3>
      {desserts.length > 0 && <UpsellRow items={desserts} cart={cart} restaurant={restaurant} />}
      {drinks.length > 0 && <UpsellRow items={drinks} cart={cart} restaurant={restaurant} />}
    </div>
  );
}

function UpsellRow({ items, cart, restaurant }) {
  const [pickerItem, setPickerItem] = useState(null);
  function handleAdd(item) {
    if (item.optionGroups?.length > 0) { setPickerItem(item); return; }
    cart.addOne({ restaurantId: restaurant.id, restaurantName: restaurant.name, itemId: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.price });
  }
  return (
    <div className="upsell-row">
      {items.map((item) => {
        const image = resolveItemImage(item, restaurant.sections);
        return (
          <button type="button" key={item.id} className="upsell-item" onClick={() => handleAdd(item)}>
            {image ? <img loading="lazy" src={image} alt="" /> : <span className="upsell-item-emoji">🍽️</span>}
            <span className="upsell-item-name">{item.name}</span>
            <span className="upsell-item-price">+{item.price.toFixed(2)}€</span>
          </button>
        );
      })}
      {pickerItem && (
        <OptionsPickerModal
          item={pickerItem}
          onCancel={() => setPickerItem(null)}
          onConfirm={(optionItemIds, snapshot, unitPrice) => {
            cart.addOne({ restaurantId: restaurant.id, restaurantName: restaurant.name, itemId: pickerItem.id, name: pickerItem.name, imageUrl: pickerItem.imageUrl, unitPrice, optionItemIds, optionsSnapshot: snapshot });
            setPickerItem(null);
          }}
        />
      )}
    </div>
  );
}
