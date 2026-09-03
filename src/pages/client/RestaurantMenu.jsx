import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
// Chargée à la demande, même raison que dans RestaurantList.jsx : Leaflet ne doit pas retarder
// l'affichage d'une fiche de commerce, qui est une page publique et indexable.
const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));
import OptionsPickerModal from '../../components/OptionsPickerModal';
import MenuCategorySections from '../../components/MenuCategorySections';
import CategoryQuickNav from '../../components/CategoryQuickNav';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus, formatCountdown, formatDaySchedule, formatFullSchedule, formatDateFr, DAY_LABELS_FR } from '../../openingHours';
import usePageMeta from '../../hooks/usePageMeta';
import { localizedItem } from '../../menuTranslation';

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const { token, user } = useAuth();
  const [pickerItem, setPickerItem] = useState(null);
  // Article qu'on essayait d'ajouter quand le panier contenait déjà un autre commerce (voir addToCart) —
  // conservé le temps que l'utilisateur confirme ou annule le remplacement du panier.
  const [conflictItem, setConflictItem] = useState(null);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  // Page publique (consultable sans compte, voir App.jsx) — chaque restaurant a besoin de son propre
  // titre/canonical, sinon index.html sert le même <link rel="canonical" href="/"> partout et Google
  // considère la fiche comme un doublon de l'accueil plutôt que de l'indexer pour elle-même.
  usePageMeta({ title: restaurant ? `${restaurant.name} — Fairide` : undefined, path: `/restaurants/${id}` });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, []);
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
    api(`/restaurants/${id}`).then(setRestaurant).catch((e) => toast(e.message));
    api(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    api('/restaurants').then((all) => setDiscover(all.filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8))).catch(() => {});
    // Page publique (consultable sans compte, voir App.jsx) — inutile pour un visiteur anonyme.
    if (token) {
      api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    }
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
  const openStatus = getOpenStatus(restaurant.hours, now, restaurant.closures);
  const presentSections = (restaurant.sections || []).filter((s) => restaurant.menu.some((i) => (i.category || 'plat') === s.name));

  async function toggleFavorite() {
    if (!user) {
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
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

  const onlineOrderingDisabled = !restaurant.offersDelivery && !restaurant.offersPickup;

  function addToCart(item) {
    if (!user) {
      toast('Connecte-toi ou crée un compte pour commander.');
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
    if (onlineOrderingDisabled) {
      toast('Ce restaurant ne propose pas la commande en ligne — réserve une table pour découvrir la carte sur place.');
      return;
    }
    if (!getOpenStatus(restaurant.hours, now, restaurant.closures).isOpen) {
      toast('Ce commerce est actuellement fermé.');
      return;
    }
    if (cart.hasConflict(id)) {
      setConflictItem(item);
      return;
    }
    if (item.optionGroups?.length > 0) {
      setPickerItem(item);
    } else {
      cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: item.id, name: localizedItem(item, language).name, imageUrl: item.imageUrl, unitPrice: item.price });
    }
  }

  // L'utilisateur a confirmé vouloir vider son panier (d'un autre commerce) pour continuer ici —
  // on relance alors l'action initialement bloquée par le conflit (ouvrir le sélecteur d'options,
  // ou ajouter directement le plat). Cas simple : switch + ajout regroupés via force=true (voir le
  // commentaire d'addOne dans CartContext.jsx — deux appels séparés ici rejoueraient un faux conflit).
  function confirmSwitchRestaurant() {
    const item = conflictItem;
    setConflictItem(null);
    if (item.optionGroups?.length > 0) {
      // Ici l'ajout réel n'a lieu qu'après un second aller-retour (choix des options dans la modale),
      // donc pas de risque de closure périmée — le switch peut être appliqué séparément dès maintenant.
      cart.switchRestaurant(id, restaurant.name);
      setPickerItem(item);
    } else {
      cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: item.id, name: localizedItem(item, language).name, imageUrl: item.imageUrl, unitPrice: item.price, force: true });
    }
  }

  return (
    <div>
      <CategoryQuickNav categories={presentSections} />
      <Link to="/restaurants" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10 }}>{t('restaurantMenu.backToRestaurants')}</Link>
      <div className="card">
        {(restaurant.coverImageUrl || restaurant.logoImageUrl) && (
          <div className={`restaurant-header-media${restaurant.coverImageUrl ? '' : ' no-cover'}`}>
            {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner-detail" />}
            {restaurant.logoImageUrl && <img src={restaurant.logoImageUrl} alt="" className="restaurant-logo-badge" />}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 className="restaurant-header-name-row" style={{ marginBottom: 2 }}>
            <span>{restaurant.name}</span>
            {restaurant.certified && <CertifiedBadge size={20} />}
          </h2>
          <FavoriteHeart active={isFavorite} busy={favoriteBusy} onClick={toggleFavorite} title={t('restaurantList.addFavorite')} className="favorite-heart-inline" />
        </div>
        <div className="row" style={{ gap: 6, margin: '2px 0' }}>
          <StarsDisplay value={restaurant.rating} />
          <span className="small">{restaurant.reviewCount > 0 ? t('restaurantMenu.ratingReviews', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount }) : t('restaurantList.newBadge')}</span>
        </div>
        <p className="small" style={{ margin: '0 0 4px' }}>{restaurant.desc || ''} · {restaurant.commune}</p>
        {restaurant.hours && (
          openStatus.isExceptionalClosure ? (
            <div className="closed-banner">
              <div className="closed-banner-title">🏖️ Fermeture exceptionnelle</div>
              {openStatus.closedReason && <p className="small" style={{ margin: 0 }}>{openStatus.closedReason}</p>}
              <p className="small" style={{ margin: '4px 0 0' }}>
                {openStatus.reopensDate ? `Réouverture prévue le ${formatDateFr(openStatus.reopensDate)}` : 'Date de réouverture pas encore communiquée'}
              </p>
            </div>
          ) : openStatus.isOpen ? (
            <div style={{ margin: '0 0 10px' }}>
              <p className="small" style={{ margin: 0 }}>🕐 Ouvert maintenant · {formatDaySchedule(restaurant.hours, openStatus.todayKey)}</p>
              <button type="button" className="btn-ghost" style={{ padding: '2px 0', fontSize: 12 }} onClick={() => setHoursExpanded((v) => !v)}>
                {hoursExpanded ? 'Masquer les horaires' : 'Voir tous les horaires'}
              </button>
              {hoursExpanded && (
                <div className="closed-banner-schedule">
                  {formatFullSchedule(restaurant.hours).map((line) => <span key={line}>{line}</span>)}
                </div>
              )}
            </div>
          ) : (
            <div className="closed-banner">
              <div className="closed-banner-title">🔒 Actuellement fermé</div>
              {openStatus.opensToday ? (
                <p className="small" style={{ margin: 0 }}>Ouvre dans {formatCountdown(openStatus.opensAt - now)} (à {openStatus.opensAt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })})</p>
              ) : (
                <p className="small" style={{ margin: 0 }}>
                  Prochaine ouverture : {DAY_LABELS_FR[openStatus.opensDayKey]}, {formatDaySchedule(restaurant.hours, openStatus.opensDayKey)}
                </p>
              )}
              <div className="closed-banner-schedule">
                {formatFullSchedule(restaurant.hours).map((line) => <span key={line}>{line}</span>)}
              </div>
            </div>
          )
        )}
        {restaurant.lat && restaurant.lng && (
          <div style={{ marginBottom: 14 }}>
            <Suspense fallback={<div style={{ height: 220 }} />}>
              <RestaurantsMap restaurants={[restaurant]} height={220} singleMarker />
            </Suspense>
          </div>
        )}
        {restaurant.hasPromo && (
          <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontWeight: 700, fontSize: 13 }}>
            {t('restaurantMenu.promoBanner')}
          </div>
        )}
        {(restaurant.freeDelivery || restaurant.freeDeliveryMinOrder != null || restaurant.deliveryFeeDiscount > 0) && (
          <div style={{ background: 'var(--teal)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontWeight: 700, fontSize: 13 }}>
            {restaurant.freeDelivery
              ? `🚴 Livraison offerte par ${restaurant.name}`
              : restaurant.freeDeliveryMinOrder != null
              ? `🚴 Livraison offerte par ${restaurant.name} dès ${restaurant.freeDeliveryMinOrder.toFixed(2)}€ d'achat`
              : `🚴 -${restaurant.deliveryFeeDiscount.toFixed(2)}€ sur les frais de livraison, offert par ${restaurant.name}`}
          </div>
        )}
        {restaurant.offersDineIn && (
          <button
            type="button"
            className="btn-outline btn-block"
            onClick={() => {
              if (!user) {
                navigate('/login?audience=client', { state: { from: location.pathname } });
                return;
              }
              navigate('/checkout', { state: { reservationOnly: true, restaurantId: id } });
            }}
          >
            {t('restaurantMenu.reserveTable')}
          </button>
        )}
      </div>

      {onlineOrderingDisabled && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>🍽️ Ce restaurant fonctionne uniquement sur réservation — la commande en ligne n'est pas disponible ici. Réserve une table pour découvrir la carte sur place.</p>
        </div>
      )}

      <div className="card">
        {restaurant.menu.length === 0 && <div className="empty">{t('restaurantMenu.noMenuYet')}</div>}
        <MenuCategorySections menu={restaurant.menu} sections={restaurant.sections || []} onAdd={addToCart} hideAdd={onlineOrderingDisabled} />
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
              {r.restaurantReply && (
                <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--teal)' }}>
                  <div className="small" style={{ fontWeight: 700 }}>{t('restaurantMenu.reviewReplyFrom', { name: restaurant.name })}</div>
                  <p className="small" style={{ margin: '2px 0 0' }}>{r.restaurantReply}</p>
                </div>
              )}
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
            cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: pickerItem.id, name: pickerItem.name, imageUrl: pickerItem.imageUrl, unitPrice, optionItemIds, optionsSnapshot: snapshot });
            setPickerItem(null);
          }}
        />
      )}

      {conflictItem && (
        <div className="modal-overlay" onClick={() => setConflictItem(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('floatingCart.conflictTitle')}</h3>
            <p className="small" style={{ margin: '0 0 16px' }}>
              {t('floatingCart.conflictMessage', { restaurant: cart.restaurantName })}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" onClick={confirmSwitchRestaurant}>{t('floatingCart.conflictConfirm')}</button>
              <button className="btn-ghost" onClick={() => setConflictItem(null)}>{t('floatingCart.conflictCancel')}</button>
            </div>
          </div>
        </div>
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
          style={canLoop ? { animationDuration: `${restaurants.length * 9}s` } : undefined}
        >
          {items.map((r, i) => (
            <Link key={`${r.id}-${i}`} to={`/restaurants/${r.id}`} className="discover-card">
              {r.coverImageUrl && <img loading="lazy" src={r.coverImageUrl} alt={r.name} />}
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
