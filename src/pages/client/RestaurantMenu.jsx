import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import RestaurantsMap from '../../components/RestaurantsMap';
import OptionsPickerModal from '../../components/OptionsPickerModal';
import MenuCategorySections from '../../components/MenuCategorySections';
import CategoryQuickNav from '../../components/CategoryQuickNav';
import FloatingCart from '../../components/FloatingCart';
import { useLanguage } from '../../context/LanguageContext';

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const { token, user } = useAuth();
  const [pickerItem, setPickerItem] = useState(null);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  // Calculé une seule fois, avant que l'effet ci-dessous ne mette sessionStorage à jour : distingue un
  // rafraîchissement de cette même page (F5) d'une vraie navigation vers un autre restaurant.
  const isRefreshRef = useRef(sessionStorage.getItem('fairide_last_restaurant_viewed') === id);
  const scrollRestoredRef = useRef(false);
  // Capturé une seule fois au montage, avant que l'effet de suivi du scroll ci-dessous ne puisse
  // écraser cette valeur (ex. suite à la restauration native du navigateur au rechargement).
  const savedScrollRef = useRef(sessionStorage.getItem(`fairide_scroll_${id}`));

  useEffect(() => {
    if (!isRefreshRef.current) {
      // Vraie navigation vers un nouveau restaurant : on part du haut, et on oublie toute position de
      // scroll sauvegardée pour cette page lors d'une visite précédente.
      window.scrollTo(0, 0);
      sessionStorage.removeItem(`fairide_scroll_${id}`);
    }
    sessionStorage.setItem('fairide_last_restaurant_viewed', id);
    cart.startOrder(id);
    api(`/restaurants/${id}`).then(setRestaurant).catch((e) => toast(e.message));
    api(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    api('/restaurants').then((all) => setDiscover(all.filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8))).catch(() => {});
    api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sauvegarde en continu la position de scroll pour pouvoir la restaurer après un rafraîchissement,
  // puisque le contenu (menu, avis...) se charge de façon asynchrone et décale la hauteur de la page.
  useEffect(() => {
    const prevRestoration = 'scrollRestoration' in window.history ? window.history.scrollRestoration : null;
    // Désactive la restauration native du navigateur au rechargement : elle déclenche ses propres
    // événements "scroll" qui écraseraient notre position sauvegardée avant qu'on ait pu la restaurer.
    if (prevRestoration) window.history.scrollRestoration = 'manual';
    function saveScroll() {
      sessionStorage.setItem(`fairide_scroll_${id}`, String(window.scrollY));
    }
    window.addEventListener('scroll', saveScroll, { passive: true });
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener('scroll', saveScroll);
      window.removeEventListener('beforeunload', saveScroll);
      if (prevRestoration) window.history.scrollRestoration = prevRestoration;
    };
  }, [id]);

  // Une fois le contenu du restaurant chargé, restaure la position sauvegardée si c'est un
  // rafraîchissement (sinon la page reste en haut, déjà géré ci-dessus). On utilise la valeur capturée
  // au montage (savedScrollRef) plutôt que de relire sessionStorage, qui a pu être écrasé entre-temps.
  useEffect(() => {
    if (restaurant && !scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      if (isRefreshRef.current) {
        const savedY = savedScrollRef.current;
        if (savedY) {
          const targetY = Number(savedY);
          // Réapplique la position à plusieurs reprises : les images du menu se chargent de façon
          // asynchrone et augmentent la hauteur de la page après le premier rendu, ce qui peut faire
          // "clamper" un scrollTo trop précoce à une position plus basse que la cible.
          const timers = [0, 100, 300, 600, 1000].map((d) => setTimeout(() => window.scrollTo(0, targetY), d));
          return () => timers.forEach(clearTimeout);
        }
      }
    }
  }, [restaurant, id]);

  if (!restaurant) return <SkeletonCards count={3} />;

  const isFavorite = favoriteIds.has(id);
  const presentSections = (restaurant.sections || []).filter((s) => restaurant.menu.some((i) => (i.category || 'plat') === s.name));

  async function toggleFavorite() {
    setFavoriteBusy(true);
    try {
      if (isFavorite) {
        await api(`/restaurants/${id}/favorite`, { method: 'DELETE', token });
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await api(`/restaurants/${id}/favorite`, { method: 'POST', token });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setFavoriteBusy(false);
    }
  }

  function addToCart(item) {
    if (item.optionGroups?.length > 0) {
      setPickerItem(item);
    } else {
      cart.addOne(item.id, item.price);
    }
  }

  return (
    <div>
      <CategoryQuickNav categories={presentSections} />
      <FloatingCart menu={restaurant.menu} />
      <Link to="/restaurants" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10 }}>{t('restaurantMenu.backToRestaurants')}</Link>
      <div className="card">
        {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner-detail" />}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ marginBottom: 2 }}>{restaurant.name}</h2>
          <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 18 }} disabled={favoriteBusy} onClick={toggleFavorite} title={t('restaurantList.addFavorite')}>
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
        <div className="row" style={{ gap: 6, margin: '2px 0' }}>
          <StarsDisplay value={restaurant.rating} />
          <span className="small">{restaurant.reviewCount > 0 ? t('restaurantMenu.ratingReviews', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount }) : t('restaurantList.newBadge')}</span>
        </div>
        <p className="small" style={{ margin: '0 0 4px' }}>{restaurant.desc || ''} · {restaurant.commune}</p>
        <p className="small" style={{ margin: '0 0 10px' }}>{restaurant.openingHours ? `🕐 ${restaurant.openingHours}` : ''}</p>
        {restaurant.lat && restaurant.lng && (
          <div style={{ marginBottom: 14 }}>
            <RestaurantsMap restaurants={[restaurant]} height={220} singleMarker />
          </div>
        )}
        {restaurant.hasPromo && (
          <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontWeight: 700, fontSize: 13 }}>
            {t('restaurantMenu.promoBanner')}
          </div>
        )}
        <button
          type="button"
          className="btn-outline btn-block"
          onClick={() => navigate('/checkout', { state: { reservationOnly: true } })}
        >
          {t('restaurantMenu.reserveTable')}
        </button>
      </div>

      <div className="card">
        {restaurant.menu.length === 0 && <div className="empty">{t('restaurantMenu.noMenuYet')}</div>}
        <MenuCategorySections menu={restaurant.menu} sections={restaurant.sections || []} onAdd={addToCart} />
      </div>

      {reviews && reviews.reviews.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('restaurantMenu.reviewsTitle')}</h3>
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName}</b>
                <StarsDisplay value={r.foodRating} />
              </div>
              {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
            </div>
          ))}
        </div>
      )}

      {discover.length > 0 && <DiscoverSection restaurants={discover} t={t} />}

      {pickerItem && (
        <OptionsPickerModal
          item={pickerItem}
          onCancel={() => setPickerItem(null)}
          onConfirm={(optionItemIds, snapshot, unitPrice) => {
            cart.addOne(pickerItem.id, unitPrice, optionItemIds, snapshot);
            setPickerItem(null);
          }}
        />
      )}
    </div>
  );
}

function DiscoverSection({ restaurants, t }) {
  const canLoop = restaurants.length >= 3;
  const items = canLoop ? [...restaurants, ...restaurants] : restaurants;
  return (
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      <h3 className="section-title" style={{ fontSize: 16 }}>{t('restaurantMenu.discoverTitle')}</h3>
      <div className="discover-marquee">
        <div
          className={`discover-track${canLoop ? ' animate' : ''}`}
          style={canLoop ? { animationDuration: `${restaurants.length * 4}s` } : undefined}
        >
          {items.map((r, i) => (
            <Link key={`${r.id}-${i}`} to={`/restaurants/${r.id}`} className="discover-card">
              {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} />}
              <div className="info">
                <b>{r.name}</b>
                <span className="small">{r.commune}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
