import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart, DELIVERY_FEE } from '../../context/CartContext';
import Icone from '../../components/Icone';
import { commandesOuvertes, livraisonOuverte, dateOuvertureLivraison, reservationsOuvertes, dateOuvertureReservations } from '../../launch';
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
import AutoScrollRow from '../../components/AutoScrollRow';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { getOpenStatus, formatCountdown, formatDaySchedule, formatFullSchedule, formatDateFr, dayLabel } from '../../openingHours';
import usePageMeta from '../../hooks/usePageMeta';
import useJsonLd from '../../seo/useJsonLd';
import { restaurantJsonLd, breadcrumbJsonLd, SITE_URL } from '../../seo/jsonLd';
import { localizedItem } from '../../menuTranslation';

// Clé du jour (openingHours) → clé de traduction du nom du jour (resa.monday…).

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  // Les horaires, l'adresse, le téléphone et le site vivaient en clair sous le titre, soit six
  // lignes de métadonnées avant le premier plat. Ils passent derrière « Infos », comme sur la
  // fiche d'Uber : un visiteur vient lire une carte, pas un annuaire.
  const [infosOuvertes, setInfosOuvertes] = useState(false);
  // Livraison ou à emporter, choisi ici plutôt qu'au paiement. Le commerce déclare déjà les deux
  // capacités (offersDelivery / offersPickup) mais elles n'étaient lues qu'au moment de payer :
  // le client découvrait donc à la fin qu'il pouvait venir chercher sa commande.
  const [mode, setMode] = useState(null);
  // Recherche dans la carte. Une carte de supermarché compte plusieurs centaines de lignes ;
  // la seule façon d'y trouver un article était de faire défiler.
  const [requete, setRequete] = useState('');
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
  /* Titre, description et image construits depuis la fiche : c'est ce qui distingue cette page
     des autres aux yeux d'un moteur, et ce qui s'affiche quand le lien est partagé. */
  usePageMeta({
    title: restaurant ? t('seo.restaurantTitle', { name: restaurant.name, cuisine: restaurant.cuisine || '', commune: restaurant.commune || '' }) : undefined,
    description: restaurant ? (restaurant.desc || t('seo.restaurantDescription', { name: restaurant.name, commune: restaurant.commune || 'Bruxelles' })) : undefined,
    path: `/restaurants/${id}`,
    image: restaurant?.coverImageUrl || undefined,
    type: 'restaurant'
  });
  useJsonLd(restaurant ? restaurantJsonLd(restaurant, { url: `${SITE_URL}/restaurants/${id}` }) : null, 'ld-restaurant');
  useJsonLd(restaurant ? breadcrumbJsonLd([
    { name: 'Fairide', path: '/' },
    { name: t('restoListUi.heading'), path: '/restaurants' },
    { name: restaurant.name, path: `/restaurants/${id}` }
  ]) : null, 'ld-breadcrumb');
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
  // Les sections proposées à la navigation rapide suivent la recherche : filtrer la carte sans
  // filtrer sa table des matières laisserait des onglets qui ne mènent nulle part.

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

  // La bascule ne s'affiche que si le commerce propose vraiment les deux : un seul mode possible
  // n'est pas un choix, c'est une information — elle tient alors dans le panneau des frais.
  const modesPossibles = [restaurant.offersDelivery && 'delivery', restaurant.offersPickup && 'pickup'].filter(Boolean);
  const modeActif = mode && modesPossibles.includes(mode) ? mode : modesPossibles[0];

  // Le choix est déposé pour le paiement, qui le relit au montage. sessionStorage et non un état
  // partagé : le mode appartient à cette visite-ci de cette fiche-ci, il n'a pas à survivre à la
  // fermeture de l'onglet ni à suivre l'utilisateur d'un commerce à l'autre.
  function choisirMode(m) {
    setMode(m);
    try { sessionStorage.setItem(`fairide_mode_${id}`, m); } catch { /* navigation privée : le paiement reprendra son défaut */ }
  }

  // Frais annoncés sur la fiche. DELIVERY_FEE (CartContext) est une ESTIMATION forfaitaire côté
  // client — le montant réel dépend de la distance et se calcule au serveur — d'où le « dès ».
  const q = requete.trim().toLowerCase();
  const menuFiltre = q
    ? restaurant.menu.filter((i) => {
        const loc = localizedItem(i, language);
        return `${loc.name} ${loc.desc || ''}`.toLowerCase().includes(q);
      })
    : restaurant.menu;
  const sectionsFiltrees = (restaurant.sections || []).filter((s) => menuFiltre.some((i) => (i.category || 'plat') === s.name));

  function addToCart(item) {
    if (!user) {
      toast(t('restoMenuUi.toastLogin'));
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
    if (onlineOrderingDisabled) {
      toast(t('restoMenuUi.toastNoOnline'));
      return;
    }
    if (!getOpenStatus(restaurant.hours, now, restaurant.closures).isOpen) {
      toast(t('restoMenuUi.toastClosed'));
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
      <CategoryQuickNav categories={sectionsFiltrees} />
      <Link to="/restaurants" className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10 }}>{t('restaurantMenu.backToRestaurants')}</Link>

      {/* L'EN-TÊTE SORT DE LA CARTE.
          Tout ce bloc vivait dans un <div className="card"> : un rectangle blanc cerné d'un filet,
          avec 24px de marge intérieure, dans lequel la photo devait déborder par des marges
          négatives de -22px pour paraître pleine largeur. Le contour n'apportait rien — il
          encadrait le sujet de la page, pas un élément parmi d'autres — et le débordement était
          un contournement de ce contour. Les deux partent ensemble. */}
      <header className="fiche-entete">
        {(restaurant.coverImageUrl || restaurant.logoImageUrl) && (
          <div className={`fiche-media${restaurant.coverImageUrl ? '' : ' sans-photo'}`}>
            {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="fiche-couverture" />}
            {restaurant.logoImageUrl && <img src={restaurant.logoImageUrl} alt="" className="fiche-logo" />}
          </div>
        )}
        <div className="fiche-titre-ligne">
          {/* h1 et non h2 : la fiche est la page la plus importante du site pour le
              référencement et n'avait aucun titre de niveau 1. Son sujet est le commerce. */}
          <h1 className="fiche-nom">
            <span>{restaurant.name}</span>
            {restaurant.certified && <CertifiedBadge size={20} />}
          </h1>
          <FavoriteHeart active={isFavorite} busy={favoriteBusy} onClick={toggleFavorite} title={t('restaurantList.addFavorite')} className="favorite-heart-inline" />
        </div>

        {/* UNE SEULE LIGNE DE MÉTA, à la place de six.
            Il y avait, empilées : la note, la description + commune, le site, le téléphone, les
            horaires du jour, et un bouton pour déplier la semaine. Uber tient l'équivalent sur une
            ligne — « 4.1 ★ (4 000+) · €1.79 Delivery Fee · Info » — et range le reste derrière
            « Info ». Le visiteur vient lire une carte. */}
        <p className="fiche-meta">
          {/* Pas d'étoiles quand personne n'a encore noté : cinq étoiles vides à côté du mot
              « Nouveau » se lisaient comme une note de zéro sur cinq, ce qui est le contraire de
              ce qu'on veut dire d'un commerce qui vient d'arriver. */}
          {restaurant.reviewCount > 0 ? (
            <>
              <span className="fiche-meta-note"><StarsDisplay value={restaurant.rating} size={13} /></span>
              <span>{t('restaurantMenu.ratingReviews', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount })}</span>
            </>
          ) : (
            <span>{t('restaurantList.newBadge')}</span>
          )}
          {restaurant.commune && <><span aria-hidden="true">·</span><span>{restaurant.commune}</span></>}
          <span aria-hidden="true">·</span>
          <button type="button" className="fiche-infos-lien" onClick={() => setInfosOuvertes(true)}>
            {t('restaurantMenu.infoButton')}
          </button>
        </p>
        {restaurant.desc && <p className="fiche-desc">{restaurant.desc}</p>}

        {/* BASCULE LIVRAISON / À EMPORTER, affichée seulement quand les deux existent. */}
        {modesPossibles.length > 1 && (
          <div className="fiche-modes" role="group" aria-label={t('restaurantMenu.modeLabel')}>
            <button type="button" className={modeActif === 'delivery' ? 'est-actif' : ''} aria-pressed={modeActif === 'delivery'} onClick={() => choisirMode('delivery')}>
              {t('restaurantMenu.modeDelivery')}
            </button>
            <button type="button" className={modeActif === 'pickup' ? 'est-actif' : ''} aria-pressed={modeActif === 'pickup'} onClick={() => choisirMode('pickup')}>
              {t('restaurantMenu.modePickup')}
            </button>
          </div>
        )}

        {/* Le panneau gris des frais. Il dit « dès » parce que DELIVERY_FEE est une estimation
            forfaitaire côté client : le montant exact dépend de la distance et se calcule au
            serveur, exactement comme l'annonce déjà le paiement. Aucun délai d'arrivée n'y figure —
            aucun champ de temps de préparation n'existe, ni ici ni au serveur. */}
        {!onlineOrderingDisabled && (
          <div className="fiche-panneau">
            <b>{modeActif === 'pickup'
              ? t('restaurantMenu.feePickup')
              : restaurant.freeDelivery
                ? t('restaurantMenu.feeFree')
                : t('restaurantMenu.feeFrom', { amount: DELIVERY_FEE.toFixed(2).replace('.', ',') })}</b>
            <span className="fiche-panneau-cle">{modeActif === 'pickup' ? t('restaurantMenu.feePickupLabel') : t('restaurantMenu.feeLabel')}</span>
          </div>
        )}

        {/* UNE SEULE CARTE D'OFFRE, au lieu de deux bandeaux de deux couleurs.
            La promotion et la livraison offerte étaient deux <div> sans classe, l'un rouge l'autre
            iris, écrits en style inline. Ils disent la même chose — « tu paies moins ici » — donc
            ils tiennent dans un seul encart, celui de « Savings and more ». */}
        {(restaurant.fairideAdvantage || restaurant.hasPromo || restaurant.freeDelivery || restaurant.freeDeliveryMinOrder != null || restaurant.deliveryFeeDiscount > 0) && (
          <div className="fiche-offres">
            <span className="fiche-offres-icone" aria-hidden="true"><Icone nom="etiquette" taille={20} /></span>
            <div className="fiche-offres-texte">
              {restaurant.fairideAdvantage && (
                <span>{restaurant.fairideAdvantage.mode === 'amount'
                  ? t('restaurantMenu.fairideAdvantageAmount', { name: restaurant.name, v: `${Number(restaurant.fairideAdvantage.value).toFixed(2).replace('.', ',').replace(/,00$/, '')} €` })
                  : t('restaurantMenu.fairideAdvantagePercent', { name: restaurant.name, v: restaurant.fairideAdvantage.value })}</span>
              )}
              {restaurant.hasPromo && !restaurant.fairideAdvantage && <span>{t('restaurantMenu.promoBanner')}</span>}
              {(restaurant.freeDelivery || restaurant.freeDeliveryMinOrder != null || restaurant.deliveryFeeDiscount > 0) && (
                <span>{restaurant.freeDelivery
                  ? t('restoMenuUi.freeDeliveryBy', { name: restaurant.name })
                  : restaurant.freeDeliveryMinOrder != null
                    ? t('restoMenuUi.freeDeliveryFrom', { name: restaurant.name, min: restaurant.freeDeliveryMinOrder.toFixed(2) })
                    : t('restoMenuUi.deliveryDiscountBy', { name: restaurant.name, amount: restaurant.deliveryFeeDiscount.toFixed(2) })}</span>
              )}
            </div>
          </div>
        )}

        {/* La fermeture reste seule en alerte : c'est la seule information qui empêche de commander.
            Les sept lignes d'horaires qu'elle dépliait sont maintenant dans « Infos ». */}
        {restaurant.hours && openStatus.isExceptionalClosure && (
          <div className="closed-banner">
            <div className="closed-banner-title">{t('restoMenuUi.exceptionalClosure')}</div>
            {openStatus.closedReason && <p className="small" style={{ margin: 0 }}>{openStatus.closedReason}</p>}
            <p className="small" style={{ margin: '4px 0 0' }}>
              {openStatus.reopensDate ? t('restoMenuUi.reopenOn', { date: formatDateFr(openStatus.reopensDate) }) : t('restoMenuUi.reopenUnknown')}
            </p>
          </div>
        )}
        {restaurant.hours && !openStatus.isExceptionalClosure && !openStatus.isOpen && (
          <div className="closed-banner">
            <div className="closed-banner-title">{t('restoMenuUi.currentlyClosed')}</div>
            {openStatus.opensToday ? (
              <p className="small" style={{ margin: 0 }}>{t('restoMenuUi.opensIn', { countdown: formatCountdown(openStatus.opensAt - now, t), time: openStatus.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })}</p>
            ) : (
              <p className="small" style={{ margin: 0 }}>
                {t('restoMenuUi.nextOpening', { day: dayLabel(openStatus.opensDayKey, t), schedule: formatDaySchedule(restaurant.hours, openStatus.opensDayKey, t) })}
              </p>
            )}
          </div>
        )}

        {/* Avant le 5 octobre : réservations et à emporter à venir ; du 5 au 15 : seule la livraison attend. */}
        {(!commandesOuvertes(user) || (restaurant.offersDelivery && !livraisonOuverte(user))) && (
          <div className="ouverture-bandeau" role="status">
            {commandesOuvertes(user)
              ? t('restaurantMenu.ordersOpenBannerResaOpen', { date: dateOuvertureLivraison(getLocale()) })
              : t('restaurantMenu.ordersOpenBanner', { date: dateOuvertureLivraison(getLocale()), dateResa: dateOuvertureReservations(getLocale()) })}
          </div>
        )}

        {restaurant.offersDineIn && (reservationsOuvertes(user) ? (
          <button type="button" className="btn-outline btn-block" onClick={() => navigate(`/restaurants/${id}/reserver`)}>
            {t('restaurantMenu.reserveTable')}
          </button>
        ) : (
          <button type="button" className="btn-outline btn-block" disabled title={t('restaurantMenu.reserveSoon', { date: dateOuvertureReservations(getLocale()) })}>
            {t('restaurantMenu.reserveSoon', { date: dateOuvertureReservations(getLocale()) })}
          </button>
        ))}
      </header>

      {onlineOrderingDisabled && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>{t('restoMenuUi.reservationOnlyInfo')}</p>
        </div>
      )}

      {/* RECHERCHE DANS LA CARTE, comme le « Search in McDonald's® » de la capture. Sans elle, le
          seul moyen de trouver un article dans la carte d'un supermarché était de faire défiler.
          Même habillage que la recherche du site (.recherche-champ), pour ne pas inventer un
          second type de champ de recherche. */}
      {restaurant.menu.length > 8 && (
        <form className="recherche-champ fiche-recherche" role="search" onSubmit={(e) => e.preventDefault()}>
          <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={18} /></span>
          <input
            type="search" value={requete} onChange={(e) => setRequete(e.target.value)}
            placeholder={t('restaurantMenu.searchDish')} aria-label={t('restaurantMenu.searchDish')}
          />
          {requete && (
            <button type="button" className="recherche-effacer" onClick={() => setRequete('')} aria-label={t('restaurantMenu.clearSearch')}>
              <Icone nom="interdit" taille={16} />
            </button>
          )}
        </form>
      )}

      <div className="card">
        {restaurant.menu.length === 0 && <div className="empty">{t('restaurantMenu.noMenuYet')}</div>}
        {restaurant.menu.length > 0 && menuFiltre.length === 0 && (
          <p className="small" style={{ margin: 0 }}>{t('restaurantMenu.noDishMatch', { q: requete })}</p>
        )}
        <MenuCategorySections menu={menuFiltre} sections={sectionsFiltrees} onAdd={addToCart} hideAdd={onlineOrderingDisabled} />
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

      {/* LA FEUILLE « INFOS ».
          Elle recueille tout ce qui encombrait le haut de la page : les sept lignes d'horaires de
          la semaine, l'adresse, le téléphone, le site, et la carte de 220px de haut qui s'insérait
          entre le titre et le premier plat. Aucune de ces informations n'est perdue — elles sont
          simplement à un toucher, au lieu d'être devant le plat qu'on venait voir. */}
      {infosOuvertes && (
        <div className="modal-overlay" onClick={() => setInfosOuvertes(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titre">{t('restaurantMenu.infoTitle')}</h3>

            {restaurant.hours && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="horloge" taille={16} />{t('restaurantMenu.hoursLabel')}</h4>
                <div className="closed-banner-schedule">
                  {formatFullSchedule(restaurant.hours, t).map((line) => <span key={line}>{line}</span>)}
                </div>
              </section>
            )}

            {(restaurant.address || restaurant.commune) && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="position" taille={16} />{t('restaurantMenu.addressLabel')}</h4>
                <p className="small">{[restaurant.address, restaurant.commune].filter(Boolean).join(', ')}</p>
                {restaurant.lat && restaurant.lng && (
                  <Suspense fallback={<div style={{ height: 180 }} />}>
                    <RestaurantsMap restaurants={[restaurant]} height={180} singleMarker />
                  </Suspense>
                )}
              </section>
            )}

            {restaurant.phone && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="antenne" taille={16} />{t('restaurantMenu.phoneLabel')}</h4>
                <p className="small"><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, '')}`}>{restaurant.phone}</a></p>
              </section>
            )}

            {restaurant.website && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="globe" taille={16} />{t('restaurantMenu.websiteLabel')}</h4>
                <p className="small">
                  <a href={restaurant.website} target="_blank" rel="noreferrer">
                    {restaurant.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </p>
              </section>
            )}

            <div className="modal-pied">
              <button type="button" className="btn-gold" onClick={() => setInfosOuvertes(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
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
  return (
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      <h3 className="section-title" style={{ fontSize: 16 }}>{t('restaurantMenu.discoverTitle')}</h3>
      <AutoScrollRow
        items={restaurants}
        keyFor={(r) => r.id}
        className="discover-track"
        renderItem={(r, i, key) => (
          <Link key={key} to={`/restaurants/${r.id}`} className="discover-card">
            {r.coverImageUrl && <img loading="lazy" src={r.coverImageUrl} alt={r.name} />}
            <div className="info">
              <b>{r.name}</b>
              <span className="small">{r.commune}</span>
            </div>
          </Link>
        )}
      />
    </div>
  );
}
