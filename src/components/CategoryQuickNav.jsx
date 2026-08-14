import { useEffect, useRef, useState } from 'react';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...) — fixée
// sur le côté, surtout utile en mobile où le menu est long et scindé en plusieurs colonnes. Met en
// évidence la section actuellement visible (scroll-spy) et fait défiler jusqu'au début d'une section
// au clic. Repose sur les ids `menu-cat-<value>` posés par MenuCategorySections.
export default function CategoryQuickNav({ categories }) {
  const [active, setActive] = useState(categories[0]?.value);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  useEffect(() => {
    // Une section est considérée "active" une fois que son titre a franchi le haut du viewport
    // (mais pas encore le bas) — la fenêtre d'observation resserrée en bas évite qu'une section très
    // courte à peine visible en bas d'écran ne prenne le dessus sur celle qu'on est en train de lire.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.dataset.catValue);
        });
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 }
    );
    categoriesRef.current.forEach((c) => {
      const el = document.getElementById(`menu-cat-${c.value}`);
      if (el) {
        el.dataset.catValue = c.value;
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, [categories]);

  function jumpTo(value) {
    const el = document.getElementById(`menu-cat-${value}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (categories.length < 2) return null;

  return (
    <div className="category-quicknav">
      {categories.map((c) => (
        <button
          key={c.value}
          type="button"
          className={active === c.value ? 'active' : ''}
          onClick={() => jumpTo(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
