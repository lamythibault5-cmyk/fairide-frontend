import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { categoryLabel } from '../menuCategories';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...), fixée en
// haut de l'écran pendant qu'on parcourt le menu. Met en évidence la section actuellement lue et fait
// défiler jusqu'au début d'une section au clic. Affiche aussi en permanence l'état du panier (même à
// vide), pour que son remplissage reste visible sans avoir à chercher la bulle flottante. Repose sur
// les ids `menu-cat-<id>` (id de section) posés par MenuCategorySections.
// `categories` attend des objets { id, name } (une section de restaurant.sections).

// Doit dépasser la hauteur réelle de la barre (~56px) : une section n'est considérée "active" qu'une
// fois son titre passé sous la barre, pas simplement entré quelque part dans le haut de l'écran.
const ACTIVE_THRESHOLD_PX = 70;

export default function CategoryQuickNav({ categories }) {
  const { t } = useLanguage();
  const cart = useCart();
  const navigate = useNavigate();
  const [active, setActive] = useState(categories[0]?.id);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

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

  function jumpTo(id) {
    const el = document.getElementById(`menu-cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (categories.length === 0) return null;

  return (
    <div className="category-quicknav">
      {categories.length >= 2 && categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={active === c.id ? 'active' : ''}
          onClick={() => jumpTo(c.id)}
        >
          {categoryLabel(c.name, t)}
        </button>
      ))}
      <button
        type="button"
        className={`category-quicknav-cart${cart.count === 0 ? ' empty' : ''}`}
        onClick={() => { if (cart.count > 0) navigate('/checkout'); }}
      >
        🛒 {cart.count > 0 ? t('categoryQuickNav.cart', { count: cart.count, total: cart.rawTotal.toFixed(2) }) : t('categoryQuickNav.cartEmpty')}
      </button>
    </div>
  );
}
