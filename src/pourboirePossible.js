// Le pourboire peut-il encore être donné sur cette commande ? (Pourboire.jsx, Orders.jsx.) Même règle que le serveur
// (backend pourboireApres.controler, qui tranche de toute façon) : livrée par un livreur Fairride, pas encore donné, et dans
// les sept jours qui suivent la livraison (tipOpenUntil, envoyé avec la commande ; fondateur, 2026-11-06).
export function pourboirePossible(o, maintenant = Date.now()) {
  return !!o && o.status === 'livre' && o.orderType === 'delivery' && !!o.driverName && o.deliveryBy !== 'restaurant' && !o.tipPaid
    && (!o.tipOpenUntil || maintenant < o.tipOpenUntil);
}
