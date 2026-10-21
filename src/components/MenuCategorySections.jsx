import { sectionLabel, resolveItemImage, groupBySubsection } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import { localizedItem } from '../menuTranslation';
import { libellesAllergenes } from '../allergenes';
import { prixRemise, euros, libellePromo } from '../prixPlat';
import { imgProps } from '../images';
import Icone from './Icone';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { vibrer } from '../gestes';

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
/* LE « + » DEVIENT COMPTEUR (fondateur, 2026-10-16, version 3C de mockups/autres-idees.html). Un + iris plein ; dès
 * qu'un plat est dans le panier, il s'ouvre en « − n + », le chiffre dans un rond lime (lime sur iris), puis se replie
 * au bout de 2,6 s en un rond qui garde le nombre — on voit ce qu'on a déjà pris sans ouvrir le panier. Toucher le rond
 * le rouvre. « − » retire un exemplaire de la dernière ligne de ce plat (un plat pris avec des options différentes
 * fait plusieurs lignes : on enlève la plus récente). Le « + » reste l'ajout direct d'avant (onQuickAdd : fiche si
 * des options sont obligatoires, envol vers le panier sinon). */
const DUREE_OUVERT_MS = 2600;
function PasPlat({ item, name, image, onAjout, t }) {
  const cart = useCart();
  const lignes = Object.entries(cart.lines).filter(([, l]) => l.itemId === item.id);
  const qte = lignes.reduce((s, [, l]) => s + l.qty, 0);
  const [ouvert, setOuvert] = useState(false);
  const [bosse, setBosse] = useState(0);
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  const garderOuvert = () => {
    setOuvert(true);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setOuvert(false), DUREE_OUVERT_MS);
  };
  const etat = qte === 0 ? 'ferme' : ouvert ? 'ouvert' : 'replie';
  const plus = (e) => {
    e.stopPropagation();
    onAjout(item, e.currentTarget.getBoundingClientRect(), image);
    garderOuvert();
    setBosse((b) => b + 1);
  };
  const moins = (e) => {
    e.stopPropagation();
    const derniere = lignes[lignes.length - 1];
    if (!derniere) return;
    vibrer(6);
    cart.changeLineQty(derniere[0], -1);
    garderOuvert();
  };
  return (
    /* La bosse rejoue à chaque ajout : deux classes identiques en alternance (une animation ne repart pas si sa classe reste). */
    <div className={`plat-pas plat-pas--${etat}${bosse ? ` plat-pas--bosse${bosse % 2}` : ''}`} role="group" aria-label={name}>
      <button type="button" className="plat-pas-moins" tabIndex={etat === 'ouvert' ? 0 : -1} aria-hidden={etat !== 'ouvert'} onClick={moins} aria-label={t('menuCategories.oneLess', { name })}>−</button>
      <button type="button" className="plat-pas-chiffre" tabIndex={etat === 'replie' ? 0 : -1} aria-hidden={etat === 'ferme'} onClick={(e) => { e.stopPropagation(); garderOuvert(); }}
        aria-label={t('menuCategories.inCart', { n: qte })}><span key={qte}>{qte}</span></button>
      <button type="button" className="plat-pas-plus" tabIndex={etat === 'replie' ? -1 : 0} onClick={plus} aria-label={t('menuCategories.quickAdd', { name })}><span aria-hidden="true">+</span></button>
    </div>
  );
}

/* LA CARTE DE BISTROT (fondateur, 2026-10-17, version C de « Fiche du commerce » dans mockups/commerces-marque.html), dans
 * l'app seulement (`bistrot`, posé par RestaurantMenu quand experienceApp()). Le plat se lit comme sur la carte imprimée
 * du commerce : une petite photo carrée à gauche, le nom, des points de conduite, le prix sur la même ligne, la description
 * dessous ; le compteur « − n + » (PasPlat) se pose à droite, sous le prix. Mêmes données, mêmes gestes que la ligne du site. */
/* Mémorisée (2026-10-20, test de l'app Android) : chaque « + » change le panier, donc redessinait la fiche entière et ses
 * centaines de plats. La ligne ne dépend que du plat, de son image et de réglages stables ; seul son compteur (PasPlat), qui
 * lit le panier lui-même, se redessine. */
const ItemCard = memo(function ItemCard({ item, image, onAdd, onQuickAdd, hideAdd, t, language, bistrot = false }) {
  // Nom et description dans la langue affichée, avec repli sur le texte du restaurateur (localizedItem).
  const { name, desc } = localizedItem(item, language);
  const indisponible = item.available === false;
  const cliquable = !hideAdd && !indisponible;
  const remise = prixRemise(item);
  const etiquette = item.activePromo && !item.activePromo.fairide && remise === null ? libellePromo(item.activePromo, t) : null;
  // Un code d'allergène inconnu (donnée ancienne ou mal saisie) donnait une ligne « Allergènes : » sans rien derrière.
  const allergenes = libellesAllergenes(item.allergens, t);
  const remisee = remise !== null && remise < item.price;
  /* PAS DE PRIX BARRÉ (fondateur, 2026-10-17 : il n'aime pas le texte barré). Le prix d'avant reste dit — il le faut pour
   * une réduction (art. VI.18 CDE) — en clair : « avant 13,50 € ». */
  const prixAvant = remisee && <span className="plat-prix-avant">{t('menuCategories.priceBefore', { price: euros(item.price) })}</span>;
  const badges = (
    <>
      {item.healthy && <span className="dish-healthy" title={t('menuCategories.healthy')} aria-label={t('menuCategories.healthy')} role="img">{'\u00A0'}<Icone nom="bol" taille={16} className="icone-texte" /></span>}
      {/* Bio et vegan en toutes lettres, comme halal (audit du 19/10, discovery-06) : leur emoji avait été retiré sans rien à la
          place, et le badge n'était plus qu'une espace vide. */}
      {item.organic && <span className="plat-age">{t('menuCategories.organic')}</span>}
      {item.vegan && <span className="plat-age">{t('menuCategories.vegan')}</span>}
      {/* Halal, sans gluten : déclarés par le commerce (backend migration 042), dits en toutes lettres — un client qui
          cherche l'un ou l'autre doit le lire, pas deviner une icône. */}
      {item.halal && <span className="plat-age" title={t('menuCategories.declaredByBusiness')}>{t('menuCategories.halal')}</span>}
      {item.glutenFree && <span className="plat-age" title={t('menuCategories.declaredByBusiness')}>{t('menuCategories.glutenFree')}</span>}
      {/* Alcool : l'âge exigé à la remise, annoncé avant l'ajout au panier (backlog C3). */}
      {item.isAlcohol && <span className="plat-age" title={t('conformite.alcoholBadgeTitle', { age: Math.max(18, item.minAge || 18) })}> {Math.max(18, item.minAge || 18)}+</span>}
    </>
  );
  const ligneDesc = (indisponible || desc) && <span className="plat-desc">{indisponible ? (item.outOfStockToday ? t('menuCategories.soldOutToday') : t('menuCategories.unavailable')) : desc}</span>;
  const ligneAllergenes = allergenes.length > 0 && <span className="plat-allergenes">{t('conformite.allergensLine', { list: allergenes.join(', ') })}</span>;
  const vignette = image && (
    /* imgProps : la vignette fait 112 px (client-ui.css) ; sans lui chaque plat chargeait l'original
       Cloudinary, 50 à 70 Ko pièce (Lighthouse du 5 oct. 2026 : ~940 Ko de trop sur une carte). */
    <span className="plat-visuel">
      <img loading="lazy" decoding="async" width="112" height="112" {...imgProps(image, 112)} alt="" className="plat-photo" />
    </span>
  );
  const contenu = bistrot ? (
    <>
      {vignette}
      <span className="plat-texte">
        <span className="bistrot-l1">
          <span className="plat-nom">{name}{badges}</span>
          <span className="bistrot-points" aria-hidden="true" />
          <span className={`plat-prix${remisee ? ' est-remise' : ''}`}>{euros(remisee ? remise : item.price)}</span>
        </span>
        {ligneDesc}
        {ligneAllergenes}
        {(prixAvant || etiquette) && <span className="plat-prix-ligne">{prixAvant}{etiquette && <span className="plat-promo">{etiquette}</span>}</span>}
      </span>
    </>
  ) : (
    <>
      <span className="plat-texte">
        <span className="plat-nom">{name}{badges}</span>
        {ligneDesc}
        {/* Allergènes déclarés (A1, palier 2) : listés sur la ligne quand il y en a ; « aucun des 14 » reste dans la fiche du plat. */}
        {ligneAllergenes}
        <span className="plat-prix-ligne">
          {remisee
            ? <><span className="plat-prix est-remise">{euros(remise)}</span>{prixAvant}</>
            : <span className="plat-prix">{euros(item.price)}</span>}
          {etiquette && <span className="plat-promo">{etiquette}</span>}
        </span>
      </span>
      {vignette}
    </>
  );
  const classes = `plat${image ? '' : ' plat-sans-photo'}${indisponible ? ' plat-indisponible' : ''}${bistrot ? ' plat-bistrot' : ''}`;
  if (!cliquable) return <div className={classes}>{contenu}</div>;
  // DEUX GESTES, DEUX BOUTONS (fondateur, 2026-10-01) : toucher le plat ouvre sa fiche (photo, description,
  // options) ; toucher le « + » l'ajoute tout de suite au panier. Deux boutons frères et non imbriqués : un bouton
  // dans un bouton n'est pas du HTML valide, et le second toucher déclenchait aussi le premier.
  return (
    <div className={`plat-ligne${image ? '' : ' plat-ligne-sans-photo'}${bistrot ? ' plat-ligne-bistrot' : ''}`}>
      <button type="button" className={`${classes} plat-cliquable`} onClick={() => onAdd(item)}>
        {contenu}
      </button>
      <PasPlat item={item} name={name} image={image} onAjout={onQuickAdd} t={t} />
    </div>
  );
});

// Rendu du menu groupé par section — les sections sont définies par le restaurateur (nom + ordre,
// voir restaurant.sections / restaurant_sections en base), plus les 4 par défaut Entrées/Plats/
// Desserts/Boissons créées automatiquement à l'usage. Chaque section peut en plus être subdivisée
// en sous-sections libres (ex: "Boissons froides" dans "Boissons") définies par le restaurateur sur
// chaque plat (menu_items.subsection) — pour la section "boisson", un plat sans sous-section
// manuelle retombe sur l'ancienne déduction automatique (chaudes/alcool/froides) par nom, pour ne
// pas casser les menus déjà en place. Partagé entre la page client (RestaurantMenu) et l'aperçu
// restaurateur (RestaurantPreview) pour que les deux restent strictement identiques.
export default function MenuCategorySections({ menu, sections, onAdd, onQuickAdd, hideAdd, bistrot = false }) {
  const { t, language } = useLanguage();
  // Les gestes de la page changent à chaque rendu (fonctions refaites) : on passe aux lignes mémorisées des fonctions
  // stables qui appellent toujours les dernières, sinon memo ne servirait à rien.
  const gestes = useRef({ onAdd, onQuickAdd });
  useLayoutEffect(() => { gestes.current = { onAdd, onQuickAdd }; });
  const surAjout = useCallback((...a) => gestes.current.onAdd(...a), []);
  const surAjoutDirect = useCallback((...a) => (gestes.current.onQuickAdd || gestes.current.onAdd)(...a), []);
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
                  {group.items.map((item) => <ItemCard key={item.id} item={item} image={resolveItemImage(item, sections)} onAdd={surAjout} onQuickAdd={surAjoutDirect} hideAdd={hideAdd} t={t} language={language} bistrot={bistrot} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
