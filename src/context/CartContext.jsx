import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);
const DELIVERY_FEE = 4.5;
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
    let subtotal = 0;
    Object.entries(items).forEach(([id, qty]) => {
      const item = menu?.find((m) => m.id === id);
      if (item) subtotal += item.price * qty;
    });
    const commission = +(subtotal * COMMISSION_RATE).toFixed(2);
    const total = +(subtotal + DELIVERY_FEE).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), deliveryFee: DELIVERY_FEE, commission, total };
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
