import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { categoryLabel } from '../menuCategories';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...), fixée en
// haut de l'écran pendant qu'on parcourt le menu. Met en évidence la section actuellement lue, fait
// défiler la barre elle-même pour garder ce bouton visible (utile en mobile où tous les boutons ne
// tiennent pas à l'écran à la fois), et fait défiler jusqu'au début d'une section au clic. Affiche
// aussi en permanence l'état du panier (même à vide), pour que son remplissage reste visible sans
// avoir à chercher la bulle flottante. Repose sur les ids `menu-cat-<id>` (id de section) posés par
// MenuCategorySections. `categories` attend des objets { id, name } (une section de restaurant.sections).

// Doit dépasser la hauteur réelle de la barre (~56px) : une section n'est considérée "active" qu'une
// fois son titre passé sous la barre, pas simplement entré quelque part dans le haut de l'écran.
const ACTIVE_THRESHOLD_PX = 70;

export default function CategoryQuickNav({ categories }) {
  const { t } = useLanguage();
  const cart = useCart();
  const navigate = useNavigate();
  const [active, setActive] = useState(categories[0]?.id);
  const [showCartMenu, setShowCartMenu] = useState(false);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const buttonRefs = useRef(new Map());
  const cartMenuRef = useRef(null);

  useEffect(() => {
    // Scroll-spy par position plutôt que par IntersectionObserver : la section active est la DERNIÈRE
    // dont le titre a déjà franchi la barre (en descendant la liste dans l'ordre du menu) — recalculée
    // à chaque scroll, jamais dépendante d'un événement d'entrée/sortie individuel qui pourrait être
    // manqué (un scroll rapide peut faire passer un titre sous la barre sans jamais déclencher son
    // propre événement "entrée" si un autre événement du même lot prend le dessus). Plus classique
    // (technique "scrollspy" standard) et plus fiable qu'un suivi par intersection.
    let ticking = false;
    function computeActive() {
      ticking = false;
      let current = categoriesRef.current[0]?.id;
      for (const c of categoriesRef.current) {
        const el = document.getElementById(`menu-cat-${c.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= ACTIVE_THRESHOLD_PX) {
          current = c.id;
        } else {
          break;
        }
      }
      setActive(current);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(computeActive);
    }
    computeActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [categories]);

  // Fait défiler HORIZONTALEMENT la barre elle-même pour garder le bouton actif visible (ex: sur un
  // menu avec beaucoup de sections en mobile, arrivé à "Boissons" tout à la fin, le bouton correspondant
  // serait sinon resté hors champ à droite tant qu'on n'a pas fait glisser la barre à la main).
  // block: 'nearest' pour ne jamais provoquer de scroll VERTICAL de la page en plus (le bouton est déjà
  // visible verticalement puisque la barre est sticky en haut) — seul le défilement horizontal compte ici.
  useEffect(() => {
    const btn = buttonRefs.current.get(active);
    if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  // Ferme le menu du panier au clic ailleurs sur la page.
  useEffect(() => {
    if (!showCartMenu) return undefined;
    function onClickOutside(e) {
      if (cartMenuRef.current && !cartMenuRef.current.contains(e.target)) setShowCartMenu(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showCartMenu]);

  function jumpTo(id) {
    const el = document.getElementById(`menu-cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearCart() {
    cart.clearLines();
    setShowCartMenu(false);
  }

  function goToCheckout() {
    setShowCartMenu(false);
    navigate('/checkout');
  }

  if (categories.length === 0) return null;

  return (
    <div className="category-quicknav">
      <div className="category-quicknav-sections">
        {categories.length >= 2 && categories.map((c) => (
          <button
            key={c.id}
            type="button"
            ref={(el) => { if (el) buttonRefs.current.set(c.id, el); else buttonRefs.current.delete(c.id); }}
            className={active === c.id ? 'active' : ''}
            onClick={() => jumpTo(c.id)}
          >
            {categoryLabel(c.name, t)}
          </button>
        ))}
      </div>
      <div className="category-quicknav-cart-wrap" ref={cartMenuRef}>
        <button
          type="button"
          className={`category-quicknav-cart${cart.count === 0 ? ' empty' : ''}`}
          onClick={() => { if (cart.count > 0) setShowCartMenu((v) => !v); }}
        >
          🛒 {cart.count > 0 ? t('categoryQuickNav.cart', { count: cart.count, total: cart.rawTotal.toFixed(2) }) : t('categoryQuickNav.cartEmpty')}
        </button>
        {showCartMenu && cart.count > 0 && (
          <div className="category-quicknav-cart-menu">
            <div className="category-quicknav-cart-lines">
              {Object.entries(cart.lines).map(([lineKey, line]) => (
                <div key={lineKey} className="floating-cart-line">
                  <div className="floating-cart-line-info">
                    <span className="floating-cart-line-name">{line.name}</span>
                    {line.optionsSnapshot?.length > 0 && (
                      <span className="small">{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <button type="button" className="btn-outline" style={{ padding: '3px 8px' }} onClick={() => cart.changeLineQty(lineKey, -1)}>−</button>
                    <span>{line.qty}</span>
                    <button type="button" className="btn-outline" style={{ padding: '3px 8px' }} onClick={() => cart.changeLineQty(lineKey, 1)}>+</button>
                    <button type="button" className="floating-cart-remove" title={t('floatingCart.removeItem')} onClick={() => cart.removeLine(lineKey)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, margin: '8px 0' }}>
              <span>{t('common.subtotal')}</span>
              <span>{cart.rawTotal.toFixed(2)}€</span>
            </div>
            <button type="button" className="btn-gold" onClick={goToCheckout}>{t('categoryQuickNav.goToCheckout')}</button>
            <button type="button" className="btn-danger-ghost" onClick={clearCart}>{t('categoryQuickNav.clearCart')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
