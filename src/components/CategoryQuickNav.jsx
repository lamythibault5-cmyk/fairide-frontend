import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { sectionLabel } from '../menuCategories';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...), fixée en
// haut de l'écran pendant qu'on parcourt le menu. Met en évidence la section actuellement lue, fait
// défiler la barre elle-même pour garder ce bouton visible (utile en mobile où tous les boutons ne
// tiennent pas à l'écran à la fois), et fait défiler jusqu'au début d'une section au clic. Le panier
// lui-même vit dans FloatingCart (bulle persistante en bas à gauche, sur toutes les pages) — pas de
// second accès panier ici pour éviter le doublon. Repose sur les ids `menu-cat-<id>` (id de section)
// posés par MenuCategorySections. `categories` attend des objets { id, name } (une section de
// restaurant.sections).

// Doit dépasser la hauteur réelle de la barre (~56px) : une section n'est considérée "active" qu'une
// fois son titre passé sous la barre, pas simplement entré quelque part dans le haut de l'écran.
const ACTIVE_THRESHOLD_PX = 70;

export default function CategoryQuickNav({ categories }) {
  const { t, language } = useLanguage();
  const [active, setActive] = useState(categories[0]?.id);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const buttonRefs = useRef(new Map());

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

  function jumpTo(id) {
    const el = document.getElementById(`menu-cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (categories.length < 2) return null;

  return (
    <div className="category-quicknav">
      <div className="category-quicknav-sections">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            ref={(el) => { if (el) buttonRefs.current.set(c.id, el); else buttonRefs.current.delete(c.id); }}
            className={active === c.id ? 'active' : ''}
            onClick={() => jumpTo(c.id)}
          >
            {sectionLabel(c, language, t)}
          </button>
        ))}
      </div>
    </div>
  );
}
