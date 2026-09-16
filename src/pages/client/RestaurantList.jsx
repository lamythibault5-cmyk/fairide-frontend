import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import { platBio, platVegan, restoBio, restoVegan } from '../../dietary';
// Chargée à la demande : la carte tire Leaflet (~150 Ko) avec elle, et cette page fait partie des
// rares gardées en import statique pour le référencement. Sans ce découpage, tout visiteur d'une fiche
// de commerce téléchargeait Leaflet avant de voir la moindre ligne de texte — alors que la vue carte
// est un affichage secondaire, choisi par l'utilisateur.
import Icone from '../../components/Icone';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import AutoScrollRow from '../../components/AutoScrollRow';
import { COMMUNES, RESTAURANT_TYPES, communeRingDistance, haversineDistanceKm, restaurantTypeLabel } from '../../menuCategories';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import usePageMeta from '../../hooks/usePageMeta';
import useJsonLd from '../../seo/useJsonLd';
import { restaurantListJsonLd, breadcrumbJsonLd, SITE_URL } from '../../seo/jsonLd';

// Bandes de prix, calculees sur le prix MEDIAN des plats de la carte : aucune colonne « niveau de
// prix » n'existe en base, et un euro affiche au juge serait faux pour la moitie des commerces.
// Memes seuils que la page Carte (pages/client/MapPage.jsx) — les deux doivent classer pareil.
const SEUIL_MOYEN = 7;
const SEUIL_CHER = 11;
function bandePrix(resto) {
  const prix = (resto.menu || []).map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!prix.length) return null;
  const milieu = Math.floor(prix.length / 2);
  const m = prix.length % 2 ? prix[milieu] : (prix[milieu - 1] + prix[milieu]) / 2;
  return m < SEUIL_MOYEN ? 1 : m < SEUIL_CHER ? 2 : 3;
}

// Types "courses alimentaires" plutôt que "repas à commander" — regroupés dans leur propre section
// (Supermarchés) au lieu d'être mélangés avec les restos dans Autour de vous / Offres / À découvrir.
const GROCERY_TYPES = ['Supermarché', 'Night Shop', 'Boulangerie', 'Boucherie'];
const DISCOVER_RADIUS_KM = 10;
// Taille minimale d'une rangée thématique avant complément (voir completer()).
const MIN_PAR_RANGEE = 6;
const DISCOVER_MAX = 8;

// Normalise pour comparer "Ixelles", "ixelles", "Ixelles " ou une variante accentuée saisie librement
// à l'inscription contre la liste officielle des 19 communes (comparaison insensible à la casse/aux accents).
function normalizeCommune(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function matchCommune(addressCity) {
  const target = normalizeCommune(addressCity);
  if (!target) return null;
  return COMMUNES.find((c) => normalizeCommune(c) === target) || null;
}

// Priorité : la promo panier (toute la commande) si active, sinon la première promo trouvée sur un
// plat du menu — juste pour donner un aperçu concret de l'offre directement sur la carte du commerce.
function offerLabelFor(r) {
  if (r.activeCartPromo?.label) return r.activeCartPromo.label;
  const itemPromo = (r.menu || []).find((i) => i.activePromo)?.activePromo;
  return itemPromo?.label || null;
}

// Le restaurant peut prendre à sa charge tout ou partie des frais de livraison (voir "🏷️ Frais de
// livraison" dans son dashboard) — affiché comme un pill à côté de la commune, pas confondu avec le
// badge promo (🏷️ en haut de la photo) qui porte sur le contenu du panier, pas la livraison.
function deliveryOfferLabelFor(r, t) {
  if (r.freeDelivery) return t('restoListUi.freeDeliveryPill');
  if (r.freeDeliveryMinOrder != null) return t('restoListUi.freeFrom', { min: r.freeDeliveryMinOrder.toFixed(2) });
  if (r.deliveryFeeDiscount > 0) return t('restoListUi.deliveryDiscountPill', { amount: r.deliveryFeeDiscount.toFixed(2) });
  return null;
}

function RestaurantCard({ r, isFavorite, onToggleFavorite, t }) {
  const offerLabel = offerLabelFor(r);
  const deliveryOfferLabel = deliveryOfferLabelFor(r, t);
  const isClosed = r.hours && !getOpenStatus(r.hours, new Date(), r.closures).isOpen;
  return (
    <Link to={`/restaurants/${r.id}`} className="card rest-card" style={{ position: 'relative' }}>
      <FavoriteHeart
        active={isFavorite}
        onClick={(e) => onToggleFavorite(e, r.id)}
        title={t('restaurantList.addFavorite')}
        className="rest-card-fav"
      />
      {offerLabel && <span className="promo-badge">🏷️ {offerLabel}</span>}
      {r.coverImageUrl && <img loading="lazy" src={r.coverImageUrl} alt={r.name} className="cover-banner-sm" />}
      <div className="pill-row">
        <span className="pill teal">{r.commune}</span>
        {r.neighborhood && <span className="pill gold">{r.neighborhood}</span>}
        {deliveryOfferLabel && <span className="pill teal">{deliveryOfferLabel}</span>}
        {isClosed && <span className="pill closed-pill">{t('restoListUi.closed')}</span>}
      </div>
      <h3 className="rest-card-name" style={{ margin: '8px 0 4px' }}>
        <span className="rest-card-name-text">{r.name}</span>
        {r.certified && <CertifiedBadge />}
      </h3>
      <div className="row rest-card-rating" style={{ gap: 6, margin: '2px 0' }}>
        <StarsDisplay value={r.rating} />
        <span className="small rest-card-reviews">{r.reviewCount > 0 ? `(${r.reviewCount})` : t('restaurantList.newBadge')}</span>
      </div>
      <p className="small rest-card-desc">{r.desc || ''} {r.cuisine ? `· ${restaurantTypeLabel(r.cuisine, t)}` : ''}</p>
      <span className="small rest-card-dishes">{t('restaurantList.dishesCount', { count: r.menu.length })}</span>
    </Link>
  );
}


function Section({ title, icon, list, favoriteIds, onToggleFavorite, t, loop, autoplay = false }) {
  if (list.length === 0) return null;
  if (loop && list.length > 1) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom={icon} taille={18} />{title}</h3>
        <AutoScrollRow
          items={list}
          keyFor={(r) => r.id}
          className="rest-grid-loop"
          autoplay={autoplay}
          renderItem={(r, i, key) => (
            <RestaurantCard key={key} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
          )}
        />
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom={icon} taille={18} />{title}</h3>
      <div className="rest-grid rest-grid-scroll">
        {list.map((r) => (
          <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function RestaurantList() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  usePageMeta({ title: t('restoListUi.pageTitle'), description: t('seo.listDescription'), path: '/restaurants' });
  useJsonLd(breadcrumbJsonLd([
    { name: 'Fairide', path: '/' },
    { name: t('restoListUi.heading'), path: '/restaurants' }
  ]), 'ld-breadcrumb');
  const homeCommune = matchCommune(user?.addressCity);
  // La page Recherche envoie ici ses résultats « cuisine » et « commune » par l'état de navigation :
  // la liste s'ouvre déjà filtrée, sans que l'URL ne change de forme.
  const filtresInitiaux = useLocation().state || {};
  const [restaurants, setRestaurants] = useState([]);
  /* Apres la declaration de `restaurants`, jamais avant : lu plus haut, le tableau serait dans
     sa zone morte temporelle et la page planterait au montage. */
  useJsonLd(restaurantListJsonLd(restaurants, { url: `${SITE_URL}/restaurants` }), 'ld-list');
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [orderedRestaurantIds, setOrderedRestaurantIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(filtresInitiaux.search || '');
  const [commune, setCommune] = useState(filtresInitiaux.commune || '');
  const [cuisine, setCuisine] = useState(filtresInitiaux.cuisine || '');
  const [bio, setBio] = useState(!!filtresInitiaux.bio);
  const [vegan, setVegan] = useState(!!filtresInitiaux.vegan);
  // Les memes filtres que sur la carte, avec les memes noms : prix, emporter, et un tri.
  // Les avoir des deux cotes evite d'avoir a changer de vue pour affiner une recherche.
  const [prix, setPrix] = useState(0);
  const [emporter, setEmporter] = useState(false);
  const [tri, setTri] = useState('recommande');
  const [panneau, setPanneau] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch((e) => toast(e.message)).finally(() => setLoading(false));
    // Page publique (consultable sans compte, voir App.jsx) — ces deux appels ne concernent que les
    // clients connectés, inutile de les tenter (et de récolter un 401 silencieux) pour un visiteur anonyme.
    if (token) {
      api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
      api('/orders/mine', { token }).then((orders) => setOrderedRestaurantIds(new Set(orders.map((o) => o.restaurantId)))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleFavorite(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
    const isFav = favoriteIds.has(id);
    try {
      if (isFav) {
        await api(`/restaurants/${id}/favorite`, { method: 'DELETE', token });
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await api(`/restaurants/${id}/favorite`, { method: 'POST', token });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (err) {
      toast(err.message);
    }
  }

  // Bio et Vegan sont dans la même rangée que les types de commerce, en fin de liste : des filtres comme les
  // autres (cumulables entre eux et avec un type), sans mise en avant.
  const cuisineOptions = [
    { value: '', emoji: '🍽️', label: t('restaurantList.allCuisines') },
    ...RESTAURANT_TYPES.map((rt) => ({ value: rt.value, emoji: rt.emoji, label: restaurantTypeLabel(rt.value, t) })),
    { value: '__bio', emoji: '🌿', label: t('restaurantList.chipBio'), regime: 'bio' },
    { value: '__vegan', emoji: '🌱', label: t('restaurantList.chipVegan'), regime: 'vegan' }
  ];
  const chipActive = (opt) => (opt.regime === 'bio' ? bio : opt.regime === 'vegan' ? vegan : cuisine === opt.value);
  const surChip = (opt) => {
    if (opt.regime === 'bio') setBio((v) => !v);
    else if (opt.regime === 'vegan') setVegan((v) => !v);
    else setCuisine(cuisine === opt.value ? '' : opt.value);
  };

  const hasActiveFilter = !!(search || cuisine || commune || bio || vegan || prix || emporter || tri !== 'recommande');

  // Distance a vol d'oiseau depuis l'adresse du compte, quand elle est connue.
  const distanceDe = (r) => (user?.lat && user?.lng && r.lat && r.lng ? haversineDistanceKm(user.lat, user.lng, r.lat, r.lng) : null);

  const list = restaurants
    .filter((r) => {
      if (commune && r.commune !== commune) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (bio && !restoBio(r)) return false;
      if (vegan && !restoVegan(r)) return false;
      if (search && !`${r.name} ${r.desc} ${r.cuisine}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (prix && bandePrix(r) !== prix) return false;
      if (emporter && !r.offersPickup) return false;
      return true;
    })
    // Le tri choisi passe AVANT le rangement par anneaux de communes ci-dessous : demander « les
    // mieux notes » et recevoir d'abord sa propre commune ne serait pas un tri.
    //
    // PAS DE TRI « ARRIVE LE PLUS TOT ». Il faudrait un temps de preparation par commerce et une
    // estimation de course ; ni l'un ni l'autre n'existe. La distance est la seule approximation
    // honnete dont on dispose, et elle porte son vrai nom.
    .sort((a, b) => {
      if (tri === 'note') return (b.rating || 0) - (a.rating || 0);
      if (tri === 'distance') return (distanceDe(a) ?? Infinity) - (distanceDe(b) ?? Infinity);
      return 0;
    })
    // Sans filtre de commune explicite : d'abord les commerces de la commune du client, puis ceux
    // des communes limitrophes, de proche en proche. Sort étant stable, l'ordre existant (plus
    // récent d'abord, envoyé par le serveur) reste la règle de départage au sein d'un même anneau.
    .sort((a, b) => {
      if (!homeCommune || commune || tri !== 'recommande') return 0;
      return communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune);
    });

  // Page d'accueil "par sections" (façon Uber Eats/Deliveroo) affichée uniquement sans filtre actif —
  // dès qu'on cherche/filtre, on retombe sur la liste plate ci-dessus, plus adaptée à une recherche.
  // Une rangée trop courte tourne mal en boucle (2 cartes qui se répètent) : en dessous de MIN_PAR_RANGEE
  // commerces, on la complète avec d'autres commerces de la liste, les mieux notés d'abord, sans doublon.
  // Une rangée vide reste vide : on ne fabrique pas une section « Bio » sans le moindre produit bio.
  const completer = (liste) => {
    if (liste.length === 0 || liste.length >= MIN_PAR_RANGEE) return liste;
    const dejaLa = new Set(liste.map((r) => r.id));
    const renfort = [...restaurants]
      .filter((r) => !dejaLa.has(r.id))
      .sort((a, b) => (Number(b.avgRating || b.rating) || 0) - (Number(a.avgRating || a.rating) || 0))
      .slice(0, MIN_PAR_RANGEE - liste.length);
    return [...liste, ...renfort];
  };
  const nonGrocery = restaurants.filter((r) => !GROCERY_TYPES.includes(r.cuisine));
  const groceryList = completer(restaurants.filter((r) => GROCERY_TYPES.includes(r.cuisine)));
  const nearbyList = completer(homeCommune ? nonGrocery.filter((r) => r.commune === homeCommune) : []);
  const offersList = completer(restaurants.filter((r) => r.hasPromo));
  // Un seul plat marqué healthy par le restaurateur suffit à faire entrer le commerce ici (menu_items.healthy,
  // voir la case à cocher dans la fiche d'un plat côté restaurateur). Trié par nombre de plats healthy
  // décroissant plutôt que dans l'ordre du serveur : sans ça, une pizzeria qui propose une salade verte
  // apparaît avant une enseigne dont toute la carte est healthy, alors que les deux sont légitimement
  // dans la section. Les commerces de courses (Supermarchés) sont exclus, ils ont déjà leur section.
  // Bio et Vegan : la case cochée par le restaurateur (menu_items.organic / .vegan) fait foi ; à défaut,
  // le nom ou la description du plat suffit (« Burger vegan », « Vin bio ») pour que les rangées vivent
  // avant que toutes les cartes soient annotées. Un commerce peut apparaître dans plusieurs rangées.
  const parMention = (test) => nonGrocery
    .map((r) => ({ r, n: (r.menu || []).filter(test).length }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ r }) => r);
  const bioList = completer(parMention(platBio));
  const veganList = completer(parMention(platVegan));
  const healthyList = completer(nonGrocery
    .map((r) => ({ r, n: (r.menu || []).filter((m) => m.healthy).length }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ r }) => r));
  // Sans lat/lng sur le compte (adresse pas encore renseignée/géocodée), la section restait vide en
  // permanence — pas juste lente, jamais affichée du tout, ce qui donnait l'impression d'un chargement
  // sans fin. Avec position connue : restos à moins de DISCOVER_RADIUS_KM, comme avant. Sans position :
  // repli sur une sélection aléatoire parmi tous (hors déjà commandés), pour que la section s'affiche
  // toujours immédiatement dès que la liste des restos est chargée.
  const discoverList = useMemo(() => {
    const hasLocation = user?.lat && user?.lng;
    const eligible = nonGrocery.filter((r) => (
      !orderedRestaurantIds.has(r.id) &&
      (!hasLocation || (r.lat && r.lng && haversineDistanceKm(user.lat, user.lng, r.lat, r.lng) <= DISCOVER_RADIUS_KM))
    ));
    return [...eligible].sort(() => Math.random() - 0.5).slice(0, DISCOVER_MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, orderedRestaurantIds, user?.lat, user?.lng]);

  return (
    <div>
      {/* La page n'avait aucun h1 : son titre de niveau 1 était la marque de l'en-tête, donc son
          sujet, pour un moteur, était « fairide » et non les restaurants de Bruxelles. */}
      <h1 className="page-title">{t('restoListUi.heading')}</h1>
      <div className="cuisine-scroll">
        <AutoScrollRow
          items={cuisineOptions}
          keyFor={(opt) => opt.value}
          className="cuisine-track"
          renderItem={(opt, i, key) => (
            <div
              key={key}
              className={`cuisine-chip${chipActive(opt) ? ' active' : ''}`}
              onClick={() => surChip(opt)}
            >
              <span className="emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
            </div>
          )}
        />
      </div>
      <div className="restaurant-search-row">
        <input aria-label={t('restaurantList.searchPlaceholder')} placeholder={t('restaurantList.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">{t('restaurantList.allCommunes')}</option>
          {COMMUNES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {/* Les memes filtres que sur la page Carte, avec les memes noms et les memes seuils : on ne
          change pas de vocabulaire selon qu'on regarde une liste ou une carte. « Emporter » n'est
          pas sur la carte, il n'a de sens que devant une liste de commerces qu'on va chercher. */}
      <div className="liste-filtres">
        <button type="button" className={`cuisine-chip${emporter ? ' active' : ''}`} aria-pressed={emporter} onClick={() => setEmporter((v) => !v)}>
          <Icone nom="sac" taille={16} />{t('restaurantList.filterPickup')}
        </button>
        <button type="button" className={`cuisine-chip${prix ? ' active' : ''}`} aria-expanded={panneau === 'prix'} onClick={() => setPanneau((x) => (x === 'prix' ? null : 'prix'))}>
          <Icone nom="euro" taille={16} />{prix ? '€'.repeat(prix) : t('mapClient.filterPrice')}
        </button>
        <button type="button" className={`cuisine-chip${tri !== 'recommande' ? ' active' : ''}`} aria-expanded={panneau === 'tri'} onClick={() => setPanneau((x) => (x === 'tri' ? null : 'tri'))}>
          <Icone nom="stats" taille={16} />{tri === 'recommande' ? t('mapClient.sort') : (tri === 'note' ? t('mapClient.sortRating') : t('mapClient.sortDistance'))}
        </button>
      </div>
      {panneau === 'prix' && (
        <div className="carte-panneau liste-panneau">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" className={`cuisine-chip${prix === n ? ' active' : ''}`} onClick={() => { setPrix(n); setPanneau(null); }}>
              {n === 0 ? t('mapClient.filterAllPrices') : '€'.repeat(n)}
            </button>
          ))}
        </div>
      )}
      {panneau === 'tri' && (
        <div className="carte-panneau liste-panneau">
          {['recommande', 'note', 'distance'].map((cle) => (
            <button key={cle} type="button" className={`cuisine-chip${tri === cle ? ' active' : ''}`}
              disabled={cle === 'distance' && !(user?.lat && user?.lng)}
              title={cle === 'distance' && !(user?.lat && user?.lng) ? t('mapClient.sortDistanceNeedsAddress') : undefined}
              onClick={() => { setTri(cle); setPanneau(null); }}>
              {cle === 'recommande' ? t('mapClient.sortRecommended') : cle === 'note' ? t('mapClient.sortRating') : t('mapClient.sortDistance')}
            </button>
          ))}
        </div>
      )}
      {/* La bascule « Liste / Carte » vivait ici. Elle a disparu le jour où la carte a pris son
          propre onglet, en bas de l'écran : demander à quelqu'un qui parcourt une liste s'il ne
          préférerait pas une carte, alors qu'un onglet dédié l'y emmène, c'est poser deux fois la
          même question. Cette page est la liste ; la carte est la carte. */}
      {!loading && hasActiveFilter && <div className="small" style={{ marginBottom: 14 }}>{t('restaurantList.count', { count: list.length })}</div>}
      {loading && <SkeletonCards count={4} />}
      {!loading && hasActiveFilter && (
        <div className="rest-grid">
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={toggleFavorite} t={t} />
          ))}
        </div>
      )}
      {!loading && !hasActiveFilter && (
        <>
          <Section title={t('restaurantList.sectionNearby')} icon="position" list={nearbyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionOffers')} icon="etiquette" list={offersList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionHealthy')} icon="restaurants" list={healthyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionBio')} icon="favoris" list={bioList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionVegan')} icon="favoris" list={veganList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionGrocery')} icon="commerce" list={groceryList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          <Section title={t('restaurantList.sectionDiscover')} icon="etoile" list={discoverList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop autoplay />
          {restaurants.length > 0 && nearbyList.length === 0 && offersList.length === 0 && healthyList.length === 0 && bioList.length === 0 && veganList.length === 0 && discoverList.length === 0 && groceryList.length === 0 && (
            <div className="empty">{t('restaurantList.empty')}</div>
          )}
        </>
      )}
      {!loading && hasActiveFilter && list.length === 0 && (
        <div className="empty">{t('restaurantList.empty')}</div>
      )}
      {!loading && restaurants.length === 0 && (
        <div className="empty">{t('restaurantList.empty')}</div>
      )}
    </div>
  );
}
