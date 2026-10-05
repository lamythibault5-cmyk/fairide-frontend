import { sectionLabel, resolveItemImage, groupBySubsection } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import { localizedItem } from '../menuTranslation';
import { libellesAllergenes } from '../allergenes';
import { prixRemise, euros } from '../prixPlat';
import { imgProps } from '../images';

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
// Prix remisé et format des montants : voir prixPlat.js (partagé avec la fiche du plat).
// PLAT EN LIGNE (refonte du 2026-09-29) : nom, description sur deux lignes, prix — à gauche ; la photo à droite avec
// le « + ». C'est la forme qui se parcourt le plus vite au pouce (une colonne, la photo ne coupe pas le texte), et
// un plat sans photo ne laisse plus de trou. Toute la ligne reste le bouton (voir l'ancien commentaire : une cible
// de 30 px dans une carte de 250 obligeait à viser).
function ItemCard({ item, onAdd, onQuickAdd, hideAdd, t, sections, language }) {
  const image = resolveItemImage(item, sections);
  // Nom et description dans la langue affichée, avec repli sur le texte du restaurateur (localizedItem).
  const { name, desc } = localizedItem(item, language);
  const indisponible = item.available === false;
  const cliquable = !hideAdd && !indisponible;
  const remise = prixRemise(item);
  const etiquette = item.activePromo && !item.activePromo.fairide && remise === null ? item.activePromo.label : null;
  const contenu = (
    <>
      <span className="plat-texte">
        <span className="plat-nom">
          {name}
          {item.healthy && <span className="dish-healthy" title={t('menuCategories.healthy')} aria-label={t('menuCategories.healthy')} role="img">{'\u00A0'}🥗</span>}
          {item.organic && <span className="dish-healthy" title={t('menuCategories.organic')} aria-label={t('menuCategories.organic')} role="img">{'\u00A0'}🌿</span>}
          {item.vegan && <span className="dish-healthy" title={t('menuCategories.vegan')} aria-label={t('menuCategories.vegan')} role="img">{'\u00A0'}🌱</span>}
          {/* Alcool : l'âge exigé à la remise, annoncé avant l'ajout au panier (backlog C3). */}
          {item.isAlcohol && <span className="plat-age" title={t('conformite.alcoholBadgeTitle', { age: Math.max(18, item.minAge || 18) })}> {Math.max(18, item.minAge || 18)}+</span>}
        </span>
        {(indisponible || desc) && <span className="plat-desc">{indisponible ? (item.outOfStockToday ? t('menuCategories.soldOutToday') : t('menuCategories.unavailable')) : desc}</span>}
        {/* Allergènes déclarés (A1, palier 2) : listés sur la ligne quand il y en a ; « aucun des 14 » reste dans la fiche du plat. */}
        {item.allergens?.length > 0 && <span className="plat-allergenes">{t('conformite.allergensLine', { list: libellesAllergenes(item.allergens, t).join(', ') })}</span>}
        <span className="plat-prix-ligne">
          {remise !== null && remise < item.price
            ? <><span className="plat-prix est-remise">{euros(remise)}</span><s className="plat-prix-avant">{euros(item.price)}</s></>
            : <span className="plat-prix">{euros(item.price)}</span>}
          {etiquette && <span className="plat-promo">{etiquette}</span>}
        </span>
      </span>
      {image ? (
        <span className="plat-visuel">
          {/* imgProps : la vignette fait 112 px (client-ui.css) ; sans lui chaque plat chargeait l'original
              Cloudinary, 50 à 70 Ko pièce (Lighthouse du 5 oct. 2026 : ~940 Ko de trop sur une carte). */}
          <img loading="lazy" decoding="async" width="112" height="112" {...imgProps(image, 112)} alt="" className="plat-photo" />
        </span>
      ) : null}
    </>
  );
  const classes = `plat${image ? '' : ' plat-sans-photo'}${indisponible ? ' plat-indisponible' : ''}`;
  if (!cliquable) return <div className={classes}>{contenu}</div>;
  // DEUX GESTES, DEUX BOUTONS (fondateur, 2026-10-01) : toucher le plat ouvre sa fiche (photo, description,
  // options) ; toucher le « + » l'ajoute tout de suite au panier. Deux boutons frères et non imbriqués : un bouton
  // dans un bouton n'est pas du HTML valide, et le second toucher déclenchait aussi le premier.
  return (
    <div className={`plat-ligne${image ? '' : ' plat-ligne-sans-photo'}`}>
      <button type="button" className={`${classes} plat-cliquable`} onClick={() => onAdd(item)} aria-label={`${name}, ${euros(remise ?? item.price)}`}>
        {contenu}
      </button>
      <button type="button" className="plat-ajout" aria-label={t('menuCategories.quickAdd', { name })}
        onClick={(e) => { e.stopPropagation(); (onQuickAdd || onAdd)(item, e.currentTarget.getBoundingClientRect(), image); }}>
        <span aria-hidden="true">+</span>
      </button>
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
export default function MenuCategorySections({ menu, sections, onAdd, onQuickAdd, hideAdd }) {
  const { t, language } = useLanguage();
  return (
    <>
      {sections.map((section) => {
        const items = menu.filter((i) => (i.category || 'plat') === section.name);
        if (!items.length) return null;
        const label = sectionLabel(section, language, t);
        const subsectionGroups = groupBySubsection(items, section.name, t);
        return (
          <div key={section.id} id={`menu-cat-${section.id}`}>
            <h2 className="plats-section-titre">
              <span>{label}</span>
              <span className="plats-section-compte">{items.length}</span>
            </h2>
            {subsectionGroups.map((group) => (
              <div key={group.key || '__none'}>
                {group.label && <div className="sub-category-header"><span>{group.label}</span></div>}
                <div className="plats-liste">
                  {group.items.map((item) => <ItemCard key={item.id} item={item} onAdd={onAdd} onQuickAdd={onQuickAdd} hideAdd={hideAdd} t={t} sections={sections} language={language} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
