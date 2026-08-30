import { categoryEmoji, categoryImage, categoryLabel, resolveItemImage, groupBySubsection } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';

function ItemCard({ item, onAdd, hideAdd, t, sections }) {
  const image = resolveItemImage(item, sections);
  return (
    <div className="menu-item-card" style={{ position: 'relative', ...(item.available === false ? { opacity: 0.5 } : {}) }}>
      {item.activePromo && <span className="promo-badge">🏷️ {item.activePromo.label}</span>}
      {image ? (
        <img loading="lazy" src={image} alt={item.name} className="dish-thumb-lg" />
      ) : (
        <div className="dish-thumb-lg-empty"><span className="icon">{categoryEmoji(item.category)}</span></div>
      )}
      <div className="name">{item.name}</div>
      <div className="small desc">{item.available === false ? t('menuCategories.unavailable') : (item.desc || '')}</div>
      <div className="bottom-row">
        <span className="price">{item.price.toFixed(2)}€</span>
        {!hideAdd && <button className="btn-outline" style={{ padding: '6px 12px' }} disabled={item.available === false} onClick={() => onAdd(item)}>+</button>}
      </div>
    </div>
  );
}

// Rendu du menu groupé par section — les sections sont définies par le restaurateur (nom + ordre,
// voir restaurant.sections / restaurant_sections en base), plus les 4 par défaut Entrées/Plats/
// Desserts/Boissons créées automatiquement à l'usage. Chaque section peut en plus être subdivisée
// en sous-sections libres (ex: "Boissons froides" dans "Boissons") définies par le restaurateur sur
// chaque plat (menu_items.subsection) — pour la section "boisson", un plat sans sous-section
// manuelle retombe sur l'ancienne déduction automatique (chaudes/alcool/froides) par nom, pour ne
// pas casser les menus déjà en place. Partagé entre la page client (RestaurantMenu) et l'aperçu
// restaurateur (RestaurantPreview) pour que les deux restent strictement identiques.
export default function MenuCategorySections({ menu, sections, onAdd, hideAdd }) {
  const { t } = useLanguage();
  return (
    <>
      {sections.map((section) => {
        const items = menu.filter((i) => (i.category || 'plat') === section.name);
        if (!items.length) return null;
        const label = categoryLabel(section.name, t);
        const image = section.imageUrl || categoryImage(section.name);
        const subsectionGroups = groupBySubsection(items, section.name, t);
        return (
          <div key={section.id} id={`menu-cat-${section.id}`}>
            <div className="category-header">
              {image && <img loading="lazy" src={image} alt={label} />}
              <span>{label}</span>
            </div>
            {subsectionGroups.map((group) => (
              <div key={group.key || '__none'}>
                {group.label && <div className="sub-category-header"><span>{group.label}</span></div>}
                <div className="menu-grid">
                  {group.items.map((item) => <ItemCard key={item.id} item={item} onAdd={onAdd} hideAdd={hideAdd} t={t} sections={sections} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
