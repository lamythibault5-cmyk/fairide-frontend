import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

// Panier flottant, toujours visible dès qu'un article est ajouté — plus besoin de faire défiler la
// page pour le voir, l'ajuster ou le vider. Remplace l'ancien récap "Ton panier" qui n'apparaissait
// qu'après le menu, potentiellement très bas sur la page.
export default function FloatingCart({ menu, cartPromo }) {
  const cart = useCart();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (cart.count === 0) return null;

  const totals = cart.totals(menu, cartPromo);

  return (
    <div className="floating-cart">
      <div className="floating-cart-header">
        <b>{t('floatingCart.title')}</b>
        <span className="small">{t('floatingCart.itemCount', { count: cart.count })}</span>
      </div>
      <div className="floating-cart-lines">
        {Object.entries(cart.lines).map(([lineKey, line]) => {
          const item = menu.find((m) => m.id === line.itemId);
          if (!item) return null;
          return (
            <div key={lineKey} className="floating-cart-line">
              <div className="floating-cart-line-info">
                <span className="floating-cart-line-name">{item.name}</span>
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
          );
        })}
      </div>
      <div className="floating-cart-footer">
        {totals.discountedItems.map((d, i) => (
          <div className="row" style={{ justifyContent: 'space-between' }} key={i}>
            <span className="small">🏷️ {d.name || d.label}</span><span className="small">-{d.discount.toFixed(2)}€</span>
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, marginBottom: 10 }}>
          <span>{t('common.subtotal')}</span><span>{totals.subtotal.toFixed(2)}€</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-gold" style={{ flex: 1 }} onClick={() => navigate('/checkout')}>{t('floatingCart.order')}</button>
          <button className="btn-danger-ghost" onClick={() => cart.clearLines()}>{t('floatingCart.clear')}</button>
        </div>
      </div>
    </div>
  );
}
