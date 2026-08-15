import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { categoryLabel } from '../menuCategories';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...) — fixée
// sur le côté, surtout utile en mobile où le menu est long et scindé en plusieurs colonnes. Met en
// évidence la section actuellement visible (scroll-spy) et fait défiler jusqu'au début d'une section
// au clic. Repose sur les ids `menu-cat-<id>` (id de section) posés par MenuCategorySections.
// `categories` attend des objets { id, name } (une section de restaurant.sections).
export default function CategoryQuickNav({ categories }) {
  const { t } = useLanguage();
  const [active, setActive] = useState(categories[0]?.id);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  useEffect(() => {
    // Une section est considérée "active" une fois que son titre a franchi le haut du viewport
    // (mais pas encore le bas) — la fenêtre d'observation resserrée en bas évite qu'une section très
    // courte à peine visible en bas d'écran ne prenne le dessus sur celle qu'on est en train de lire.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.dataset.catId);
        });
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 }
    );
    categoriesRef.current.forEach((c) => {
      const el = document.getElementById(`menu-cat-${c.id}`);
      if (el) {
        el.dataset.catId = c.id;
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, [categories]);

  function jumpTo(id) {
    const el = document.getElementById(`menu-cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (categories.length < 2) return null;

  return (
    <div className="category-quicknav">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={active === c.id ? 'active' : ''}
          onClick={() => jumpTo(c.id)}
        >
          {categoryLabel(c.name, t)}
        </button>
      ))}
    </div>
  );
}
