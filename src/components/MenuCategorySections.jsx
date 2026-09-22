import { categoryImage, sectionLabel, resolveItemImage, groupBySubsection } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import { localizedItem } from '../menuTranslation';

// TOUTE LA CARTE EST LA CIBLE, plus seulement le « + » de son coin.
//
// L'ajout se faisait par un bouton en filet de 6px sur 12 posé en bas à droite : une cible d'une
// trentaine de pixels de haut dans une carte qui en fait deux cent cinquante. Ailleurs dans
// l'application, une carte de commerce s'ouvre en la touchant n'importe où ; ici il fallait viser.
//
// La carte devient donc elle-même le bouton, et le « + » redevient ce qu'il aurait toujours dû
// être : le signe qui annonce ce qui va se passer, pas la seule zone qui l'exécute. Il est rendu
// en <span> et non en <button> — un bouton dans un bouton n'est pas du HTML valide, et un lecteur
// d'écran annoncerait deux commandes là où il n'y a qu'une action.
//
// Quand la commande en ligne est fermée, ou le plat indisponible, la carte n'est plus un bouton du
// tout : elle n'a rien à déclencher, et un bouton qui ne fait rien se signale au clavier pour rien.
function ItemCard({ item, onAdd, hideAdd, t, sections, language }) {
  const image = resolveItemImage(item, sections);
  // Nom et description dans la langue affichée, avec repli sur le texte du restaurateur — voir
  // localizedItem pour les trois cas de repli, tous normaux.
  const { name, desc } = localizedItem(item, language);
  const indisponible = item.available === false;
  const cliquable = !hideAdd && !indisponible;
  const contenu = (
    <>
      {/* PAS DE PHOTO, PAS DE CADRE. Un plat sans photo affichait un rectangle de 130px barré d'un
          emoji de catégorie — le même pour tous les plats de la section, qui n'apprenait rien et
          occupait la moitié de la carte. Sur une carte importée d'une plateforme, un tiers des plats
          n'ont pas de photo : la grille se remplissait de 🍽️ identiques.
          La carte se réduit donc à son texte, et le « + » descend sur la ligne du prix. C'est ce que
          fait Uber Eats sur ses propres plats sans photo, et la raison est la même : une carte courte
          se lit, un cadre vide se subit.
          Le cadre vide SURVIT dans MenuItemRow (tableau de bord) : côté restaurateur, il ne comble
          pas un trou, il signale une photo à ajouter. */}
      {image ? (
        <div className="menu-item-visuel">
          {item.activePromo && <span className="promo-badge">{item.activePromo.label}</span>}
          <img loading="lazy" src={image} alt={name} className="dish-thumb-lg" />
          {cliquable && <span className="menu-item-ajout" aria-hidden="true">+</span>}
        </div>
      ) : (
        item.activePromo && <span className="promo-badge promo-badge-ligne">{item.activePromo.label}</span>
      )}
      {/* Le badge « healthy » vient de main, le texte traduit de la refonte : les deux se cumulent.
          Le nom affiché est celui de la langue du client, le badge reste posé à côté. */}
      <div className="name">
        {name}
        {item.healthy && <span className="dish-healthy" title={t('menuCategories.healthy')} aria-label={t('menuCategories.healthy')} role="img">{'\u00A0'}🥗</span>}
        {item.organic && <span className="dish-healthy" title={t('menuCategories.organic')} aria-label={t('menuCategories.organic')} role="img">{'\u00A0'}🌿</span>}
        {item.vegan && <span className="dish-healthy" title={t('menuCategories.vegan')} aria-label={t('menuCategories.vegan')} role="img">{'\u00A0'}🌱</span>}
      </div>
      <div className="small desc">{indisponible ? t('menuCategories.unavailable') : desc}</div>
      <div className="bottom-row">
        <span className="price">{item.price.toFixed(2)}€</span>
        {!image && cliquable && <span className="menu-item-ajout menu-item-ajout-ligne" aria-hidden="true">+</span>}
      </div>
    </>
  );
  const classes = `menu-item-card${image ? '' : ' menu-item-card-sans-photo'}`;
  if (!cliquable) {
    return <div className={`${classes}${indisponible ? ' menu-item-card-indisponible' : ''}`}>{contenu}</div>;
  }
  return (
    <button type="button" className={`${classes} menu-item-card-cliquable`} onClick={() => onAdd(item)}>
      {contenu}
    </button>
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
  const { t, language } = useLanguage();
  return (
    <>
      {sections.map((section) => {
        const items = menu.filter((i) => (i.category || 'plat') === section.name);
        if (!items.length) return null;
        const label = sectionLabel(section, language, t);
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
                  {group.items.map((item) => <ItemCard key={item.id} item={item} onAdd={onAdd} hideAdd={hideAdd} t={t} sections={sections} language={language} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
