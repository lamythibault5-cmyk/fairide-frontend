import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

// Panier flottant, toujours visible dès qu'un article est ajouté — plus besoin de faire défiler la
// page pour le voir, l'ajuster ou le vider. Remplace l'ancien récap "Ton panier" qui n'apparaissait
// qu'après le menu, potentiellement très bas sur la page.
export default function FloatingCart({ menu }) {
  const cart = useCart();
  const navigate = useNavigate();

  if (cart.count === 0) return null;

  const totals = cart.totals(menu);

  return (
    <div className="floating-cart">
      <div className="floating-cart-header">
        <b>🛒 Ton panier</b>
        <span className="small">{cart.count} article{cart.count > 1 ? 's' : ''}</span>
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
                <button className="floating-cart-remove" title="Retirer ce produit" onClick={() => cart.removeLine(lineKey)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="floating-cart-footer">
        {totals.discountedItems.map((d, i) => (
          <div className="row" style={{ justifyContent: 'space-between' }} key={i}>
            <span className="small">🏷️ {d.name}</span><span className="small">-{d.discount.toFixed(2)}€</span>
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, marginBottom: 10 }}>
          <span>Sous-total</span><span>{totals.subtotal.toFixed(2)}€</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-gold" style={{ flex: 1 }} onClick={() => navigate('/checkout')}>Commander</button>
          <button className="btn-danger-ghost" onClick={() => cart.clearLines()}>Vider</button>
        </div>
      </div>
    </div>
  );
}
