import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
// Chargée à la demande : la carte tire Leaflet (~150 Ko) avec elle, et cette page fait partie des
// rares gardées en import statique pour le référencement. Sans ce découpage, tout visiteur d'une fiche
// de commerce téléchargeait Leaflet avant de voir la moindre ligne de texte — alors que la vue carte
// est un affichage secondaire, choisi par l'utilisateur.
const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import AutoScrollRow from '../../components/AutoScrollRow';
import { COMMUNES, RESTAURANT_TYPES, communeRingDistance, haversineDistanceKm, restaurantTypeLabel } from '../../menuCategories';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import usePageMeta from '../../hooks/usePageMeta';

// Types "courses alimentaires" plutôt que "repas à commander" — regroupés dans leur propre section
// (Supermarchés) au lieu d'être mélangés avec les restos dans Autour de vous / Offres / À découvrir.
const GROCERY_TYPES = ['Supermarché', 'Night Shop', 'Boulangerie', 'Boucherie'];
const DISCOVER_RADIUS_KM = 10;
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
function deliveryOfferLabelFor(r) {
  if (r.freeDelivery) return '🚴 Livraison offerte';
  if (r.freeDeliveryMinOrder != null) return `🚴 Offerte dès ${r.freeDeliveryMinOrder.toFixed(2)}€`;
  if (r.deliveryFeeDiscount > 0) return `🚴 -${r.deliveryFeeDiscount.toFixed(2)}€ livraison`;
  return null;
}

function RestaurantCard({ r, isFavorite, onToggleFavorite, t }) {
  const offerLabel = offerLabelFor(r);
  const deliveryOfferLabel = deliveryOfferLabelFor(r);
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
        {isClosed && <span className="pill closed-pill">🔒 Fermé</span>}
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

function Section({ title, icon, list, favoriteIds, onToggleFavorite, t, loop }) {
  if (list.length === 0) return null;
  if (loop && list.length > 1) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ fontSize: 17, margin: '0 0 12px' }}>{icon} {title}</h3>
        <AutoScrollRow
          items={list}
          keyFor={(r) => r.id}
          className="rest-grid-loop"
          renderItem={(r, i, key) => (
            <RestaurantCard key={key} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
          )}
        />
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 className="section-title" style={{ fontSize: 17, margin: '0 0 12px' }}>{icon} {title}</h3>
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
  usePageMeta({ title: 'Restaurants et commerces à Bruxelles — Fairide', path: '/restaurants' });
  const homeCommune = matchCommune(user?.addressCity);
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [orderedRestaurantIds, setOrderedRestaurantIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // « Recherche » dans la barre du bas mène ici avec ?recherche : c'est la même liste, mais on pose le
  // curseur dans le champ et on l'amène à l'écran — sur téléphone, le clavier s'ouvre. Une page de
  // recherche à part aurait dupliqué la liste et ses filtres pour un seul champ de plus.
  const champRecherche = useRef(null);
  const emplacementRecherche = useLocation();
  useEffect(() => {
    if (!new URLSearchParams(emplacementRecherche.search).has('recherche')) return;
    const champ = champRecherche.current;
    if (!champ) return;
    champ.focus({ preventScroll: true });
    champ.scrollIntoView({ block: 'center' });
  }, [emplacementRecherche.search]);
  const [commune, setCommune] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [view, setView] = useState('list');
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

  const cuisineOptions = [{ value: '', emoji: '🍽️', label: t('restaurantList.allCuisines') }, ...RESTAURANT_TYPES.map((rt) => ({ value: rt.value, emoji: rt.emoji, label: restaurantTypeLabel(rt.value, t) }))];

  const hasActiveFilter = !!(search || cuisine || commune);

  const list = restaurants
    .filter((r) => {
      if (commune && r.commune !== commune) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (search && !`${r.name} ${r.desc} ${r.cuisine}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    // Sans filtre de commune explicite : d'abord les commerces de la commune du client, puis ceux
    // des communes limitrophes, de proche en proche. Sort étant stable, l'ordre existant (plus
    // récent d'abord, envoyé par le serveur) reste la règle de départage au sein d'un même anneau.
    .sort((a, b) => {
      if (!homeCommune || commune) return 0;
      return communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune);
    });

  // Page d'accueil "par sections" (façon Uber Eats/Deliveroo) affichée uniquement sans filtre actif —
  // dès qu'on cherche/filtre, on retombe sur la liste plate ci-dessus, plus adaptée à une recherche.
  const nonGrocery = restaurants.filter((r) => !GROCERY_TYPES.includes(r.cuisine));
  const groceryList = restaurants.filter((r) => GROCERY_TYPES.includes(r.cuisine));
  const nearbyList = homeCommune ? nonGrocery.filter((r) => r.commune === homeCommune) : [];
  const offersList = restaurants.filter((r) => r.hasPromo);
  // Un seul plat marqué healthy par le restaurateur suffit à faire entrer le commerce ici (menu_items.healthy,
  // voir la case à cocher dans la fiche d'un plat côté restaurateur). Trié par nombre de plats healthy
  // décroissant plutôt que dans l'ordre du serveur : sans ça, une pizzeria qui propose une salade verte
  // apparaît avant une enseigne dont toute la carte est healthy, alors que les deux sont légitimement
  // dans la section. Les commerces de courses (Supermarchés) sont exclus, ils ont déjà leur section.
  const healthyList = nonGrocery
    .map((r) => ({ r, n: (r.menu || []).filter((m) => m.healthy).length }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ r }) => r);
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
      <div className="cuisine-scroll">
        <AutoScrollRow
          items={cuisineOptions}
          keyFor={(opt) => opt.value}
          className="cuisine-track"
          renderItem={(opt, i, key) => (
            <div
              key={key}
              className={`cuisine-chip${cuisine === opt.value ? ' active' : ''}`}
              onClick={() => setCuisine(cuisine === opt.value ? '' : opt.value)}
            >
              <span className="emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
            </div>
          )}
        />
      </div>
      <div className="restaurant-search-row">
        <input ref={champRecherche} placeholder={t('restaurantList.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">{t('restaurantList.allCommunes')}</option>
          {COMMUNES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        <div className={`chip${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>{t('restaurantList.viewList')}</div>
        <div className={`chip${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>{t('restaurantList.viewMap')}</div>
      </div>
      {!loading && hasActiveFilter && <div className="small" style={{ marginBottom: 14 }}>{t('restaurantList.count', { count: list.length })}</div>}
      {loading && <SkeletonCards count={4} />}
      {!loading && view === 'map' && (
        <div className="card">
          <Suspense fallback={<SkeletonCards count={1} />}>
            <RestaurantsMap
              restaurants={hasActiveFilter ? list : restaurants}
              userLocation={user?.lat && user?.lng ? { lat: user.lat, lng: user.lng, address: user.address } : null}
            />
          </Suspense>
        </div>
      )}
      {!loading && view === 'list' && hasActiveFilter && (
        <div className="rest-grid">
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={toggleFavorite} t={t} />
          ))}
        </div>
      )}
      {!loading && view === 'list' && !hasActiveFilter && (
        <>
          <Section title={t('restaurantList.sectionNearby')} icon="📍" list={nearbyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} />
          <Section title={t('restaurantList.sectionOffers')} icon="🏷️" list={offersList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} />
          <Section title={t('restaurantList.sectionHealthy')} icon="🥗" list={healthyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} />
          <Section title={t('restaurantList.sectionGrocery')} icon="🛒" list={groceryList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} />
          <Section title={t('restaurantList.sectionDiscover')} icon="✨" list={discoverList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop />
          {restaurants.length > 0 && nearbyList.length === 0 && offersList.length === 0 && healthyList.length === 0 && discoverList.length === 0 && groceryList.length === 0 && (
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
