import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);
const DELIVERY_FEE = 4.5;
const SERVICE_FEE = 0.5;
const COMMISSION_RATE = 0.06;

export function CartProvider({ children }) {
  const [restaurantId, setRestaurantId] = useState(null);
  const [items, setItems] = useState({}); // itemId -> qty

  function startOrder(newRestaurantId) {
    if (newRestaurantId !== restaurantId) {
      setRestaurantId(newRestaurantId);
      setItems({});
    }
  }

  function changeQty(itemId, delta) {
    setItems((prev) => {
      const next = { ...prev };
      const qty = (next[itemId] || 0) + delta;
      if (qty <= 0) delete next[itemId];
      else next[itemId] = qty;
      return next;
    });
  }

  function clear() {
    setItems({});
    setRestaurantId(null);
  }

  const count = useMemo(() => Object.values(items).reduce((a, b) => a + b, 0), [items]);

  function totals(menu) {
    let rawSubtotal = 0;
    let promoDiscount = 0;
    const discountedItems = [];
    Object.entries(items).forEach(([id, qty]) => {
      const item = menu?.find((m) => m.id === id);
      if (!item) return;
      rawSubtotal += item.price * qty;
      const promo = item.activePromo;
      let discount = 0;
      if (promo) {
        if (promo.type === 'percent') discount = item.price * qty * (promo.value / 100);
        else if (promo.type === 'bogo') discount = Math.floor(qty / 2) * item.price;
      }
      if (discount > 0) {
        promoDiscount += discount;
        discountedItems.push({ name: item.name, label: promo.label, discount });
      }
    });
    const subtotal = +(rawSubtotal - promoDiscount).toFixed(2);
    const commission = +(subtotal * COMMISSION_RATE).toFixed(2);
    const total = +(subtotal + DELIVERY_FEE + SERVICE_FEE).toFixed(2);
    return { rawSubtotal: +rawSubtotal.toFixed(2), promoDiscount: +promoDiscount.toFixed(2), discountedItems, subtotal, deliveryFee: DELIVERY_FEE, serviceFee: SERVICE_FEE, commission, total };
  }

  return (
    <CartContext.Provider value={{ restaurantId, items, count, startOrder, changeQty, clear, totals }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
