import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

// Panier persistant sur toutes les pages (monté une seule fois dans Layout.jsx), toujours en bas à
// gauche de l'écran : une petite bulle tant qu'on ne clique pas dessus, plutôt que le récap complet
// toujours déployé — moins intrusif pendant qu'on parcourt le site, mais jamais perdu en changeant de
// page grâce à CartContext (sessionStorage). Seul et unique accès panier de l'appli (pas de doublon
// dans la barre de sections du menu, voir CategoryQuickNav). Reste affiché même à vide (indicateur
// estompé, non cliquable) pour que le client sache toujours où se trouve son panier plutôt que de le
// voir disparaître entièrement de l'écran une fois vidé.
export default function FloatingCart() {
  const cart = useCart();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  // Chargé à la demande (à l'ouverture) : ce composant n'a pas forcément le menu du restaurant sous la
  // main puisqu'il peut être affiché depuis n'importe quelle page, pas seulement celle du restaurant.
  const [preciseData, setPreciseData] = useState(null);
  const [loadingPrecise, setLoadingPrecise] = useState(false);

  function handleExpand() {
    setExpanded(true);
    if (!preciseData && cart.restaurantId) {
      setLoadingPrecise(true);
      api(`/restaurants/${cart.restaurantId}`)
        .then((r) => setPreciseData({ menu: r.menu, cartPromo: r.activeCartPromo }))
        .catch(() => {})
        .finally(() => setLoadingPrecise(false));
    }
  }

  if (cart.count === 0) {
    return (
      <div className="floating-cart-bubble floating-cart-bubble-empty">
        <span className="floating-cart-bubble-icon">🛒</span>
        <span className="floating-cart-bubble-text">
          <span className="floating-cart-bubble-count">{t('floatingCart.emptyLabel')}</span>
        </span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button type="button" className="floating-cart-bubble" onClick={handleExpand}>
        <span className="floating-cart-bubble-icon">🛒</span>
        <span className="floating-cart-bubble-text">
          <span className="floating-cart-bubble-count">{t('floatingCart.itemCount', { count: cart.count })}</span>
          <span className="floating-cart-bubble-total">{cart.rawTotal.toFixed(2)}€</span>
        </span>
      </button>
    );
  }

  const totals = preciseData ? cart.totals(preciseData.menu, preciseData.cartPromo) : null;
  const displayedSubtotal = loadingPrecise ? null : (totals ? totals.subtotal : cart.rawTotal);

  return (
    <div className="floating-cart">
      <div className="floating-cart-header">
        <span className="floating-cart-header-icon">🛒</span>
        <div className="floating-cart-header-text">
          <b>{t('floatingCart.title')}</b>
          <div className="small floating-cart-header-sub">
            {cart.restaurantName ? `${cart.restaurantName} · ` : ''}{t('floatingCart.itemCount', { count: cart.count })}
          </div>
        </div>
        <button type="button" className="floating-cart-collapse" onClick={() => setExpanded(false)} aria-label={t('floatingCart.collapse')}>✕</button>
      </div>
      <div className="floating-cart-lines">
        {Object.entries(cart.lines).map(([lineKey, line]) => (
          <div key={lineKey} className="floating-cart-line">
            <div className="floating-cart-line-info">
              <span className="floating-cart-line-name">{line.name}</span>
              {line.optionsSnapshot?.length > 0 && (
                <span className="small floating-cart-line-options">{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
              )}
              <span className="floating-cart-line-price">{(line.unitPrice * line.qty).toFixed(2)}€</span>
            </div>
            <div className="floating-cart-line-actions">
              <div className="floating-cart-stepper">
                <button type="button" onClick={() => cart.changeLineQty(lineKey, -1)} aria-label="−">−</button>
                <span>{line.qty}</span>
                <button type="button" onClick={() => cart.changeLineQty(lineKey, 1)} aria-label="+">+</button>
              </div>
              <button type="button" className="floating-cart-remove" title={t('floatingCart.removeItem')} onClick={() => cart.removeLine(lineKey)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      <div className="floating-cart-footer">
        {totals && totals.discountedItems.map((d, i) => (
          <div className="row" style={{ justifyContent: 'space-between' }} key={i}>
            <span className="small">🏷️ {d.name || d.label}</span><span className="small">-{d.discount.toFixed(2)}€</span>
          </div>
        ))}
        <div className="floating-cart-subtotal-row">
          <span>{t('common.subtotal')}</span>
          <span className="floating-cart-subtotal-amount">{loadingPrecise ? '···' : `${displayedSubtotal.toFixed(2)}€`}</span>
        </div>
        <button type="button" className="floating-cart-order-btn" onClick={() => navigate('/checkout')}>
          {t('floatingCart.order')}
        </button>
        <button type="button" className="floating-cart-clear-link" onClick={() => cart.clearLines()}>🗑️ {t('floatingCart.clear')}</button>
      </div>
    </div>
  );
}
