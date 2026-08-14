import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const DELIVERY_FEE = 4.5; // estimation "à partir de" — le montant exact dépend de la distance, calculé côté serveur
const SYSTEM_FEE_RATE = 0.10;
const COMMISSION_RATE = 0.10;
const STORAGE_KEY = 'fairide_cart';

function lineKeyFor(itemId, optionItemIds) {
  return `${itemId}::${[...(optionItemIds || [])].sort().join(',')}`;
}

// Conservé dans sessionStorage pour survivre à un rafraîchissement de page (F5) sans persister
// indéfiniment comme le ferait localStorage (le panier reste propre à cet onglet).
function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { restaurantId: null, lines: {} };
    const parsed = JSON.parse(raw);
    return { restaurantId: parsed.restaurantId ?? null, lines: parsed.lines ?? {} };
  } catch {
    return { restaurantId: null, lines: {} };
  }
}

export function CartProvider({ children }) {
  const [restaurantId, setRestaurantId] = useState(() => loadPersisted().restaurantId);
  // lineKey -> { itemId, optionItemIds, optionsSnapshot, unitPrice, qty }
  const [lines, setLines] = useState(() => loadPersisted().lines);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ restaurantId, lines }));
    } catch {
      // stockage indisponible (navigation privée stricte, etc.) — le panier reste fonctionnel en mémoire
    }
  }, [restaurantId, lines]);

  function startOrder(newRestaurantId) {
    if (newRestaurantId !== restaurantId) {
      setRestaurantId(newRestaurantId);
      setLines({});
    }
  }

  // Ajoute une unité d'un plat (avec ses options éventuelles) au panier — crée la ligne si elle n'existe pas encore.
  function addOne(itemId, unitPrice, optionItemIds = [], optionsSnapshot = []) {
    const key = lineKeyFor(itemId, optionItemIds);
    setLines((prev) => {
      const existing = prev[key];
      return { ...prev, [key]: { itemId, optionItemIds, optionsSnapshot, unitPrice, qty: (existing?.qty || 0) + 1 } };
    });
  }

  // Modifie la quantité d'une ligne déjà présente dans le panier (utilisé par le stepper +/- du récap panier).
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

  // Retire entièrement une ligne du panier en un seul geste, quelle que soit sa quantité (plus direct
  // que de décrémenter le stepper jusqu'à zéro).
  function removeLine(lineKey) {
    setLines((prev) => {
      if (!prev[lineKey]) return prev;
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
  }

  // Vide le panier tout en restant sur le même restaurant (ex: bouton "Vider" pendant qu'on parcourt
  // encore le menu) — contrairement à clear(), ne réinitialise pas restaurantId, sinon un ajout
  // ultérieur sans rechargement de page laisserait le panier orphelin de tout restaurant.
  function clearLines() {
    setLines({});
  }

  function clear() {
    setLines({});
    setRestaurantId(null);
  }

  const count = useMemo(() => Object.values(lines).reduce((a, l) => a + l.qty, 0), [lines]);

  function totals(menu) {
    let rawSubtotal = 0;
    let promoDiscount = 0;
    const discountedItems = [];
    Object.values(lines).forEach((line) => {
      const item = menu?.find((m) => m.id === line.itemId);
      if (!item) return;
      rawSubtotal += line.unitPrice * line.qty;
      const promo = item.activePromo;
      let discount = 0;
      if (promo) {
        if (promo.type === 'percent') discount = item.price * line.qty * (promo.value / 100);
        else if (promo.type === 'bogo') discount = Math.floor(line.qty / 2) * item.price;
      }
      if (discount > 0) {
        promoDiscount += discount;
        discountedItems.push({ name: item.name, label: promo.label, discount });
      }
    });
    const subtotal = +(rawSubtotal - promoDiscount).toFixed(2);
    const commission = +(subtotal * COMMISSION_RATE).toFixed(2);
    const serviceFee = +(DELIVERY_FEE * SYSTEM_FEE_RATE).toFixed(2);
    const total = +(subtotal + DELIVERY_FEE + serviceFee).toFixed(2);
    return { rawSubtotal: +rawSubtotal.toFixed(2), promoDiscount: +promoDiscount.toFixed(2), discountedItems, subtotal, deliveryFee: DELIVERY_FEE, serviceFee, commission, total };
  }

  return (
    <CartContext.Provider value={{ restaurantId, lines, count, startOrder, addOne, changeLineQty, removeLine, clear, clearLines, totals }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
