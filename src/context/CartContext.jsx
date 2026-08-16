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
    if (!raw) return { restaurantId: null, restaurantName: '', lines: {} };
    const parsed = JSON.parse(raw);
    return { restaurantId: parsed.restaurantId ?? null, restaurantName: parsed.restaurantName ?? '', lines: parsed.lines ?? {} };
  } catch {
    return { restaurantId: null, restaurantName: '', lines: {} };
  }
}

export function CartProvider({ children }) {
  const [restaurantId, setRestaurantId] = useState(() => loadPersisted().restaurantId);
  const [restaurantName, setRestaurantName] = useState(() => loadPersisted().restaurantName);
  // lineKey -> { itemId, name, imageUrl, optionItemIds, optionsSnapshot, unitPrice, qty }
  // name/imageUrl dénormalisés à l'ajout : le panier flottant (persistant sur toutes les pages, voir
  // FloatingCart.jsx) doit pouvoir s'afficher sans avoir sous la main le menu complet du restaurant.
  const [lines, setLines] = useState(() => loadPersisted().lines);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ restaurantId, restaurantName, lines }));
    } catch {
      // stockage indisponible (navigation privée stricte, etc.) — le panier reste fonctionnel en mémoire
    }
  }, [restaurantId, restaurantName, lines]);

  const count = useMemo(() => Object.values(lines).reduce((a, l) => a + l.qty, 0), [lines]);

  // Un panier ne peut contenir que des produits d'un même commerce : true si le panier contient déjà
  // des articles d'un AUTRE restaurant que celui-ci (utilisé pour avertir avant d'ajouter, voir
  // RestaurantMenu.jsx). Un panier vidé (count===0) n'est plus considéré comme "occupé" par son ancien
  // restaurant, même si restaurantId traîne encore (voir clearLines ci-dessous).
  function hasConflict(otherRestaurantId) {
    return !!(restaurantId && restaurantId !== otherRestaurantId && count > 0);
  }

  // Vide le panier et le réassigne à un autre restaurant — n'est appelé qu'après confirmation explicite
  // de l'utilisateur suite à un hasConflict() (voir RestaurantMenu.jsx), jamais silencieusement.
  function switchRestaurant(newRestaurantId, newRestaurantName) {
    setRestaurantId(newRestaurantId);
    setRestaurantName(newRestaurantName || '');
    setLines({});
  }

  // Ajoute une unité d'un plat (avec ses options éventuelles) au panier — crée la ligne si elle n'existe
  // pas encore. Retourne 'conflict' sans rien modifier si le panier contient déjà un autre commerce, sauf
  // avec force=true (utilisé juste après que l'utilisateur a confirmé le remplacement, voir
  // RestaurantMenu.jsx) : switchRestaurant() + addOne() ne peuvent PAS être appelés séparément dans ce
  // cas, le second lirait encore l'ancien restaurantId/count via la closure du même rendu (React ne
  // rejoue le composant qu'après la fin du handler) et redéclencherait donc un faux conflit — d'où le
  // switch et l'ajout regroupés en une seule mise à jour atomique ici.
  function addOne({ restaurantId: newRestaurantId, restaurantName: newRestaurantName, itemId, name, imageUrl, unitPrice, optionItemIds = [], optionsSnapshot = [], force = false }) {
    if (!force && hasConflict(newRestaurantId)) return 'conflict';
    const switching = restaurantId !== newRestaurantId;
    if (switching) {
      setRestaurantId(newRestaurantId);
      setRestaurantName(newRestaurantName || '');
    }
    const key = lineKeyFor(itemId, optionItemIds);
    setLines((prev) => {
      const base = switching ? {} : prev;
      const existing = base[key];
      return { ...base, [key]: { itemId, name, imageUrl, optionItemIds, optionsSnapshot, unitPrice, qty: (existing?.qty || 0) + 1 } };
    });
    return 'ok';
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

  function totals(menu, cartPromo) {
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
        // value = N, le nombre d'articles achetés pour en obtenir 1 offert (défaut 1 = "1 acheté = 1 offert").
        else if (promo.type === 'bogo') discount = Math.floor(line.qty / ((promo.value || 1) + 1)) * item.price;
      }
      if (discount > 0) {
        promoDiscount += discount;
        discountedItems.push({ name: item.name, label: promo.label, discount });
      }
    });
    let subtotal = +(rawSubtotal - promoDiscount).toFixed(2);
    // Promo panier (pas liée à un plat) : "X€ offerts dès Y€ de commande", appliquée sur le sous-total
    // déjà net des remises par plat — même règle que le calcul serveur à la commande.
    if (cartPromo && subtotal >= cartPromo.minCartTotal) {
      const cartDiscount = +Math.min(cartPromo.value, subtotal).toFixed(2);
      promoDiscount += cartDiscount;
      subtotal = +(subtotal - cartDiscount).toFixed(2);
      discountedItems.push({ name: null, label: cartPromo.label, discount: cartDiscount });
    }
    promoDiscount = +promoDiscount.toFixed(2);
    const commission = +(subtotal * COMMISSION_RATE).toFixed(2);
    const serviceFee = +(DELIVERY_FEE * SYSTEM_FEE_RATE).toFixed(2);
    const total = +(subtotal + DELIVERY_FEE + serviceFee).toFixed(2);
    return { rawSubtotal: +rawSubtotal.toFixed(2), promoDiscount, discountedItems, subtotal, deliveryFee: DELIVERY_FEE, serviceFee, commission, total };
  }

  // Estimation sans remises, utilisable sans connaître le menu complet du restaurant (le panier flottant
  // global, voir FloatingCart.jsx, l'affiche tant que les totaux exacts avec promos n'ont pas été chargés).
  const rawTotal = useMemo(() => +Object.values(lines).reduce((a, l) => a + l.unitPrice * l.qty, 0).toFixed(2), [lines]);

  return (
    <CartContext.Provider value={{ restaurantId, restaurantName, lines, count, rawTotal, hasConflict, switchRestaurant, addOne, changeLineQty, removeLine, clear, clearLines, totals }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
