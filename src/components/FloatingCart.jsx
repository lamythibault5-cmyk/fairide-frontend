import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

// Panier persistant sur toutes les pages (monté une seule fois dans Layout.jsx) : une petite bulle tant
// qu'on ne clique pas dessus, plutôt que le récap complet toujours déployé — moins intrusif pendant
// qu'on parcourt le site, mais jamais perdu en changeant de page grâce à CartContext (sessionStorage).
export default function FloatingCart() {
  const cart = useCart();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  // Chargé à la demande (à l'ouverture) : ce composant n'a pas forcément le menu du restaurant sous la
  // main puisqu'il peut être affiché depuis n'importe quelle page, pas seulement celle du restaurant.
  const [preciseData, setPreciseData] = useState(null);
  const [loadingPrecise, setLoadingPrecise] = useState(false);

  if (cart.count === 0) return null;

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

  if (!expanded) {
    return (
      <button type="button" className="floating-cart-bubble" onClick={handleExpand}>
        <span>🛒</span>
        <span className="floating-cart-bubble-count">{cart.count}</span>
        <span>{cart.rawTotal.toFixed(2)}€</span>
      </button>
    );
  }

  const totals = preciseData ? cart.totals(preciseData.menu, preciseData.cartPromo) : null;

  return (
    <div className="floating-cart">
      <div className="floating-cart-header">
        <div style={{ minWidth: 0 }}>
          <b>{t('floatingCart.title')}</b>
          {cart.restaurantName && <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cart.restaurantName}</div>}
        </div>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          <span className="small">{t('floatingCart.itemCount', { count: cart.count })}</span>
          <button type="button" className="floating-cart-collapse" onClick={() => setExpanded(false)} aria-label={t('floatingCart.collapse')}>✕</button>
        </div>
      </div>
      <div className="floating-cart-lines">
        {Object.entries(cart.lines).map(([lineKey, line]) => (
          <div key={lineKey} className="floating-cart-line">
            <div className="floating-cart-line-info">
              <span className="floating-cart-line-name">{line.name}</span>
              {line.optionsSnapshot?.length > 0 && (
                <span className="small">{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
              )}
            </div>
            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              <button className="btn-outline" style={{ padding: '3px 8px' }} onClick={() => cart.changeLineQty(lineKey, -1)}>−</button>
              <span>{line.qty}</span>
              <button className="btn-outline" style={{ padding: '3px 8px' }} onClick={() => cart.changeLineQty(lineKey, 1)}>+</button>
              <button className="floating-cart-remove" title={t('floatingCart.removeItem')} onClick={() => cart.removeLine(lineKey)}>✕</button>
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
        <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, marginBottom: 10 }}>
          <span>{t('common.subtotal')}</span>
          <span>{loadingPrecise ? '...' : (totals ? totals.subtotal : cart.rawTotal).toFixed(2)}€</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-gold" style={{ flex: 1 }} onClick={() => navigate('/checkout')}>{t('floatingCart.order')}</button>
          <button className="btn-danger-ghost" onClick={() => cart.clearLines()}>{t('floatingCart.clear')}</button>
        </div>
      </div>
    </div>
  );
}
