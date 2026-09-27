import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { imgProps, cacherImageCassee } from '../../images';
import urlSure from '../../urlSure';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart, DELIVERY_FEE } from '../../context/CartContext';
import Icone from '../../components/Icone';
import { commandesOuvertes, livraisonOuverte, dateOuvertureLivraison, dateOuvertureEmporter } from '../../launch';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import EtatVide from '../../components/EtatVide';
import Modale from '../../components/Modale';
import { StarsDisplay } from '../../components/Stars';
// Chargée à la demande, même raison que dans RestaurantList.jsx : Leaflet ne doit pas retarder
// l'affichage d'une fiche de commerce, qui est une page publique et indexable.
const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));
import FichePlat from '../../components/FichePlat';
import MenuCategorySections from '../../components/MenuCategorySections';
import EnteteFlux from '../../components/EnteteFlux';
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
import { resolveItemImage } from '../../menuCategories';
import FicheVendeur from '../../components/conformite/FicheVendeur';

// Clé du jour (openingHours) → clé de traduction du nom du jour (resa.monday…).

export default function RestaurantMenu() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [erreur, setErreur] = useState(null);
  // Incrémenté par « Réessayer » : il suffit qu'il change pour que l'effet de chargement reparte.
  const [essai, setEssai] = useState(0);
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
  // La recherche vit maintenant DANS le bandeau collant, repliée derrière une loupe : le champ
  // occupait une ligne entière sous l'en-tête et partait au défilement comme le reste, alors que
  // c'est précisément en descendant dans une longue carte qu'on se met à chercher.
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const champRechercheRef = useRef(null);
  // Le grand titre est-il encore à l'écran ? Tant qu'il l'est, le bandeau n'affiche pas le nom —
  // voir `titreEstompe` dans EnteteFlux.jsx.
  const titreRef = useRef(null);
  const [grandTitreVisible, setGrandTitreVisible] = useState(true);
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
  // Le nom passe dans le bandeau quand le grand titre sort de l'écran. IntersectionObserver et non
  // un écouteur de défilement : on n'a besoin que d'un booléen qui change deux fois par visite, pas
  // d'une mesure à chaque image. Le seuil de 0 suffit — dès que le titre a entièrement quitté le
  // haut, le bandeau prend le relais. Le garde `restaurant` est indispensable : avant le
  // chargement, la page ne rend qu'un squelette et titreRef est vide.
  useEffect(() => {
    const el = titreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(([e]) => setGrandTitreVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [restaurant]);
  // Ouvrir la loupe donne le clavier tout de suite : un champ qui apparaît et qu'il faut ensuite
  // toucher pour écrire dedans demande deux gestes là où on en attend un.
  useEffect(() => {
    if (rechercheOuverte) champRechercheRef.current?.focus();
  }, [rechercheOuverte]);
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
    /* L'ÉCHEC A UN ÉCRAN, il n'a plus qu'un message qui s'efface.
       La fiche ne se chargeait que dans un sens : en cas d'échec, `restaurant` restait à null,
       le rendu retombait sur les squelettes de chargement (voir plus bas) et n'en sortait
       jamais. Le seul signe était un toast disparu au bout de cinq secondes — après quoi la
       page miroitait indéfiniment, sans rien à toucher. Sur une page PUBLIQUE, indexée, qui est
       souvent la première de Fairide qu'un client voit. */
    setErreur(null);
    api(`/restaurants/${id}`, { token }).then(setRestaurant).catch(setErreur);
    api(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    api('/restaurants').then((all) => setDiscover(all.filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8))).catch(() => {});
    // Page publique (consultable sans compte, voir App.jsx) — inutile pour un visiteur anonyme.
    if (token) {
      api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, essai]);

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

  /* Deux échecs distincts, deux sorties distinctes : une fiche retirée ne se recharge pas, donc
     proposer « Réessayer » dessus serait une fausse piste — on renvoie vers la liste. Tout le
     reste (réseau coupé, serveur en panne) est temporaire et mérite un vrai bouton.

     L'échec temporaire garde AUSSI le retour vers la liste, en second rang. Vérifié contre le
     serveur : une adresse dont l'identifiant n'est pas un UUID valide ne répond pas 404 mais 500,
     et celui-là ne guérira jamais — « Réessayer » seul y serait un cul-de-sac. Le bouton reste
     l'action principale (la plupart des échecs sont bien passagers), la sortie est dessous. */
  if (erreur) {
    const introuvable = erreur.status === 404;
    return (
      <EtatVide
        icone={introuvable ? 'recherche' : 'bogue'}
        titre={introuvable ? t('restaurantMenu.notFound') : t('restaurantMenu.loadError')}
        actionVers={introuvable ? '/restaurants' : undefined}
        actionTexte={introuvable ? t('restaurantMenu.backToRestaurants') : undefined}
      >
        {!introuvable && (
          <>
            <button type="button" className="btn-teal" onClick={() => setEssai((n) => n + 1)}>
              {t('restaurantMenu.retry')}
            </button>
            <Link to="/restaurants" className="btn-outline">{t('restaurantMenu.backToRestaurants')}</Link>
          </>
        )}
      </EtatVide>
    );
  }
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
      toast(e.message, 'erreur');
    } finally {
      setFavoriteBusy(false);
    }
  }

  const onlineOrderingDisabled = !restaurant.offersDelivery && !restaurant.offersPickup;


  // La bascule ne s'affiche que si le commerce propose vraiment les deux : un seul mode possible
  // n'est pas un choix, c'est une information — elle tient alors dans le panneau des frais.
  const emporterSurPlace = !!restaurant.offersPickup && (restaurant.pickupPaymentMode || (restaurant.pickupPayOnSite ? 'both' : 'online')) !== 'online';
  const bandeauOuverture = (restaurant.offersDelivery || restaurant.offersPickup) && !livraisonOuverte(user)
    && (!commandesOuvertes(user) || restaurant.offersDelivery || !emporterSurPlace);
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
    // TOUT plat ouvre sa fiche, avec ou sans options. Avant, un plat sans option partait au panier
    // au premier contact : on ne pouvait ni lire sa description, ni voir la photo, ni en prendre
    // deux. La fiche est l'écran du plat, pas un formulaire d'options (voir FichePlat.jsx).
    setPickerItem(item);
  }

  // L'utilisateur a confirmé vouloir vider son panier (d'un autre commerce) pour continuer ici —
  // on relance alors l'action initialement bloquée par le conflit (ouvrir le sélecteur d'options,
  // ou ajouter directement le plat). Cas simple : switch + ajout regroupés via force=true (voir le
  // commentaire d'addOne dans CartContext.jsx — deux appels séparés ici rejoueraient un faux conflit).
  function confirmSwitchRestaurant() {
    const item = conflictItem;
    setConflictItem(null);
    // Plus de branche selon les options : tout plat passe maintenant par sa fiche, donc l'ajout réel
    // n'a lieu qu'après un second aller-retour. C'est précisément le cas que l'ancien code traitait
    // déjà à part, et la raison qu'il en donnait vaut désormais pour tous les plats — pas de closure
    // périmée, le changement de commerce peut être appliqué séparément dès maintenant.
    cart.switchRestaurant(id, restaurant.name);
    setPickerItem(item);
  }

  return (
    <div>
      {/* LE BANDEAU D'ABORD, LES SECTIONS DESSOUS. C'était l'inverse : la barre des sections était
          rendue en premier et collée à `top: 0`, la croix venait après et ne collait à rien. En
          descendant dans la carte, on gardait donc la table des matières et on perdait la sortie —
          alors que les onglets du bas s'effacent sur cette page justement parce que cette croix est
          censée être la seule sortie (voir Layout.jsx et EnteteFlux.jsx).
          Les deux sont maintenant collants et EMPILÉS : le bandeau à `top: 0`, les sections juste
          dessous à la hauteur du bandeau (--h-bandeau dans styles.css). C'est la disposition
          d'Uber Eats, et celle que le fondateur décrit : croix, nom, recherche, puis les sections.

          La croix, et non une flèche : d'ici on SORT du parcours pour revenir à la liste. Le lien de
          texte qui vivait là faisait 18px de haut — on le manquait au pouce. */}
      <EnteteFlux
        vers="/restaurants"
        geste="fermer"
        libelle={t('restaurantMenu.backToRestaurants')}
        titre={restaurant.name}
        titreEstompe={grandTitreVisible || rechercheOuverte}
        actions={restaurant.menu.length > 8 ? (
          rechercheOuverte ? (
            <form className="recherche-champ fiche-recherche" role="search" onSubmit={(e) => e.preventDefault()}>
              <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={18} /></span>
              <input
                ref={champRechercheRef}
                type="search" value={requete} onChange={(e) => setRequete(e.target.value)}
                placeholder={t('restaurantMenu.searchDish')} aria-label={t('restaurantMenu.searchDish')}
              />
              {/* Fermer VIDE la recherche : replier le champ en gardant un filtre actif laisserait
                  une carte amputée sans rien à l'écran pour dire pourquoi. */}
              <button
                type="button" className="recherche-effacer"
                onClick={() => { setRequete(''); setRechercheOuverte(false); }}
                aria-label={t('restaurantMenu.clearSearch')}
              >
                <Icone nom="interdit" taille={16} />
              </button>
            </form>
          ) : (
            <button
              type="button" className="flux-bouton"
              onClick={() => setRechercheOuverte(true)}
              aria-label={t('restaurantMenu.searchDish')} title={t('restaurantMenu.searchDish')}
            >
              <Icone nom="recherche" taille={20} />
            </button>
          )
        ) : null}
      />
      <CategoryQuickNav categories={sectionsFiltrees} />

      {/* L'EN-TÊTE SORT DE LA CARTE.
          Tout ce bloc vivait dans un <div className="card"> : un rectangle blanc cerné d'un filet,
          avec 24px de marge intérieure, dans lequel la photo devait déborder par des marges
          négatives de -22px pour paraître pleine largeur. Le contour n'apportait rien — il
          encadrait le sujet de la page, pas un élément parmi d'autres — et le débordement était
          un contournement de ce contour. Les deux partent ensemble. */}
      <header className="fiche-entete">
        {(restaurant.coverImageUrl || restaurant.logoImageUrl) && (
          <div className={`fiche-media${restaurant.coverImageUrl ? '' : ' sans-photo'}`}>
            {restaurant.coverImageUrl && <img {...imgProps(restaurant.coverImageUrl, 960, '(max-width: 960px) 100vw, 960px')} alt={restaurant.name} className="fiche-couverture" fetchPriority="high" decoding="async" />}
            {restaurant.logoImageUrl && <img {...imgProps(restaurant.logoImageUrl, 96)} alt="" className="fiche-logo" decoding="async" onError={cacherImageCassee} />}
          </div>
        )}
        <div className="fiche-titre-ligne">
          {/* h1 et non h2 : la fiche est la page la plus importante du site pour le
              référencement et n'avait aucun titre de niveau 1. Son sujet est le commerce. */}
          <h1 className="fiche-nom" ref={titreRef}>
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

        {/* Avant le 10 octobre : à emporter et livraison à venir ; du 10 au 20 : seule la livraison (et l'à emporter payé
            en ligne) attend. Rien n'est annoncé pour un commerce qui ne propose aucun service en ligne, et l'à emporter
            n'est promis que s'il se paie sur place (le paiement en ligne ouvre avec la livraison). */}
        {bandeauOuverture && (
          <div className="ouverture-bandeau" role="status">
            {!emporterSurPlace
              ? t('restaurantMenu.ordersOpenBannerOnlineOnly', { date: dateOuvertureLivraison(getLocale()) })
              : commandesOuvertes(user)
                ? t('restaurantMenu.ordersOpenBannerResaOpen', { date: dateOuvertureLivraison(getLocale()) })
                : restaurant.offersDelivery
                  ? t('restaurantMenu.ordersOpenBanner', { date: dateOuvertureLivraison(getLocale()), dateResa: dateOuvertureEmporter(getLocale()) })
                  : t('restaurantMenu.ordersOpenBannerPickupOnly', { date: dateOuvertureEmporter(getLocale()) })}
          </div>
        )}

      </header>

      {onlineOrderingDisabled && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            {t('restoMenuUi.orderingNotOpenInfo')}
          </p>
        </div>
      )}

      {/* LA RECHERCHE DANS LA CARTE A DÉMÉNAGÉ dans le bandeau collant, derrière la loupe (voir
          plus haut). Elle occupait ici une ligne entière et partait au défilement comme le reste —
          or c'est en descendant dans une longue carte qu'on se met à chercher, pas en arrivant.
          Le seuil de 8 plats et l'habillage (.recherche-champ, celui de la recherche du site) ne
          changent pas ; seul l'endroit change. */}

      <FicheVendeur restaurant={restaurant} />

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

      {/* `imageUrl` : la MÊME résolution que la carte du plat (resolveItemImage, MenuCategorySections).
          Le champ `item.imageUrl` est souvent vide et la photo vient alors de la section ou de la
          banque d'images — le prendre seul donnait une fiche SANS photo là où la carte en montrait
          une, c'est-à-dire l'inverse de ce qu'on cherche : la photo en grand.
          `item` : localizedItem ne renvoie QUE { name, desc }, on l'étale donc sur le plat complet,
          sinon la fiche perdrait le prix et les groupes d'options. */}
      {pickerItem && (
        <FichePlat
          item={{ ...pickerItem, ...localizedItem(pickerItem, language) }}
          imageUrl={resolveItemImage(pickerItem, restaurant.sections)}
          onCancel={() => setPickerItem(null)}
          onConfirm={(optionItemIds, snapshot, unitPrice, qty) => {
            // Le nom enregistré est le nom TRADUIT, comme lors d'un ajout direct : l'ancienne
            // fenêtre gardait `pickerItem.name`, donc un panier en néerlandais pouvait afficher des
            // plats en français selon la façon dont on les avait ajoutés.
            // Même image que la fiche et que la carte : sinon le panier affichait le carré gris de
            // repli pour un plat dont on venait de voir la photo en grand.
            cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: pickerItem.id, name: localizedItem(pickerItem, language).name, imageUrl: resolveItemImage(pickerItem, restaurant.sections), unitPrice, optionItemIds, optionsSnapshot: snapshot, qty });
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
        <Modale titre={t('restaurantMenu.infoTitle')} onFermer={() => setInfosOuvertes(false)}>

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
                  <a href={urlSure(restaurant.website)} target="_blank" rel="noreferrer">
                    {restaurant.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </p>
              </section>
            )}

          <div className="modal-pied">
            <button type="button" className="btn-gold" onClick={() => setInfosOuvertes(false)}>{t('common.close')}</button>
          </div>
        </Modale>
      )}

      {/* Le titre garde sa taille propre (16px) plutôt que .modal-titre : c'est une question posée,
          pas l'en-tête d'un panneau d'informations. D'où `ariaLabel` — sans lui, la fenêtre
          s'annoncerait « dialogue » et rien de plus. */}
      {conflictItem && (
        <Modale ariaLabel={t('floatingCart.conflictTitle')} onFermer={() => setConflictItem(null)}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('floatingCart.conflictTitle')}</h3>
          <p className="small" style={{ margin: '0 0 16px' }}>
            {t('floatingCart.conflictMessage', { restaurant: cart.restaurantName })}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" onClick={confirmSwitchRestaurant}>{t('floatingCart.conflictConfirm')}</button>
            <button className="btn-ghost" onClick={() => setConflictItem(null)}>{t('floatingCart.conflictCancel')}</button>
          </div>
        </Modale>
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
            {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 320)} alt={r.name} onError={cacherImageCassee} />}
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
