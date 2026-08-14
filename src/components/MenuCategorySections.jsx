import { CATEGORIES, BOISSON_SUBCATEGORIES, boissonSubcategory, defaultItemImage } from '../menuCategories';

function ItemCard({ item, onAdd }) {
  return (
    <div className="menu-item-card" style={{ position: 'relative', ...(item.available === false ? { opacity: 0.5 } : {}) }}>
      {item.activePromo && <span className="promo-badge">🏷️ {item.activePromo.label}</span>}
      <img src={item.imageUrl || defaultItemImage(item)} alt={item.name} className="dish-thumb-lg" />
      <div className="name">{item.name}</div>
      <div className="small desc">{item.available === false ? 'Indisponible pour le moment' : (item.desc || '')}</div>
      <div className="bottom-row">
        <span className="price">{item.price.toFixed(2)}€</span>
        <button className="btn-outline" style={{ padding: '6px 12px' }} disabled={item.available === false} onClick={() => onAdd(item)}>+</button>
      </div>
    </div>
  );
}

// Rendu du menu groupé par catégorie — la catégorie "Boissons" est en plus subdivisée
// (chaudes/alcool/froides) déduites du nom du produit, sans champ supplémentaire à gérer par le
// restaurateur. Partagé entre la page client (RestaurantMenu) et l'aperçu restaurateur (RestaurantPreview)
// pour que les deux restent strictement identiques.
export default function MenuCategorySections({ menu, onAdd }) {
  return (
    <>
      {CATEGORIES.map((cat) => {
        const items = menu.filter((i) => (i.category || 'plat') === cat.value);
        if (!items.length) return null;
        return (
          <div key={cat.value}>
            <div className="category-header">
              {cat.image && <img src={cat.image} alt={cat.label} />}
              <span>{cat.label}</span>
            </div>
            {cat.value === 'boisson' ? (
              BOISSON_SUBCATEGORIES.map((sub) => {
                const subItems = items.filter((i) => boissonSubcategory(i.name) === sub.value);
                if (!subItems.length) return null;
                return (
                  <div key={sub.value}>
                    <div className="sub-category-header"><span>{sub.label}</span></div>
                    <div className="menu-grid">
                      {subItems.map((item) => <ItemCard key={item.id} item={item} onAdd={onAdd} />)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="menu-grid">
                {items.map((item) => <ItemCard key={item.id} item={item} onAdd={onAdd} />)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
