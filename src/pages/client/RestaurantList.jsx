import { useEffect, useMemo, useState } from 'react';
import { imgProps, cacherImageCassee } from '../../images';
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
import ChoixAdresse from '../../components/ChoixAdresse';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import AutoScrollRow from '../../components/AutoScrollRow';
import { COMMUNES, RESTAURANT_TYPES, communeRingDistance, haversineDistanceKm, restaurantTypeLabel } from '../../menuCategories';
import { useLanguage, getLocale } from '../../context/LanguageContext';
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

// CARTE D'UN COMMERCE (refonte du 2026-09-29, fondateur : « trop simpliste, rends-le vraiment user-friendly »).
// Tout ce qui décide d'un clic tient sur la photo et deux lignes : l'offre et l'état (fermé, ouvre à…) posés SUR la
// photo, puis le nom, « cuisine · commune », et une ligne d'infos (note ou « Nouveau », prix, services, offre de
// livraison). Avant : quatre pastilles empilées (commune, quartier, fermé…) et un grand blanc sous le texte.
function RestaurantCard({ r, isFavorite, onToggleFavorite, t }) {
  const { user } = useAuth();
  const offerLabel = offerLabelFor(r);
  const deliveryOfferLabel = deliveryOfferLabelFor(r, t);
  const etat = r.hours ? getOpenStatus(r.hours, new Date(), r.closures) : null;
  const isClosed = !!etat && !etat.isOpen;
  const etatTexte = !isClosed ? null
    : etat.opensToday && etat.opensAt
      ? t('restoListUi.closedOpensAt', { time: etat.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
      : t('restoListUi.closed');
  const bande = bandePrix(r);
  const services = [r.offersPickup && t('restoListUi.servicePickup'), r.offersDelivery && t('restoListUi.serviceDelivery')].filter(Boolean);
  // VISITEUR NON CONNECTÉ : la liste se parcourt librement (on y arrive depuis la barre d'adresse de
  // l'accueil), mais ouvrir un commerce demande un compte (fondateur, 2026-09-27). Le lien part vers
  // la connexion avec la fiche en `from`, et Auth.jsx y ramène une fois connecté ou inscrit.
  // La ROUTE /restaurants/:id, elle, reste publique (App.jsx) : un lien partagé, un moteur de
  // recherche ou la page prérendue y mènent toujours directement. Seul ce clic-ci est filtré.
  const fiche = `/restaurants/${r.id}`;
  return (
    <Link
      to={user ? fiche : '/login?audience=client'}
      state={user ? undefined : { from: fiche }}
      className={`rest-card rc${isClosed ? ' rc-est-ferme' : ''}`}
    >
      <div className="rc-media">
        {r.coverImageUrl
          ? <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 70vw, 320px')} alt="" className="rc-photo" onError={cacherImageCassee} />
          : <span className="rc-photo rc-photo-vide" aria-hidden="true"><Icone nom="restaurants" taille={28} /></span>}
        <FavoriteHeart
          active={isFavorite}
          onClick={(e) => onToggleFavorite(e, r.id)}
          title={t('restaurantList.addFavorite')}
          className="rest-card-fav rc-fav"
        />
        {offerLabel && <span className="rc-offre">{offerLabel}</span>}
        {etatTexte && <span className="rc-etat">{etatTexte}</span>}
      </div>
      <div className="rc-corps">
        <h3 className="rest-card-name rc-nom">
          <span className="rest-card-name-text">{r.name}</span>
          {r.certified && <CertifiedBadge />}
        </h3>
        {/* Type principal + le premier type secondaire (7 types possibles, voir EcranCuisines) : deux, pour rester lisible. */}
        <p className="rc-sous">{[[r.cuisine, ...(r.extraCuisines || [])].filter(Boolean).slice(0, 2).map((c) => restaurantTypeLabel(c, t) || c).join(', '), r.neighborhood || r.commune].filter(Boolean).join(' · ')}</p>
        <p className="rc-infos">
          {/* Pas d'étoiles sans avis : une note que personne n'a donnée n'est pas un avis (CDE VI.100). */}
          {r.reviewCount > 0
            ? <span className="rc-note"><span aria-hidden="true">★</span> {Number(r.rating).toFixed(1)} <span className="rc-discret">({r.reviewCount})</span></span>
            : <span className="rc-nouveau">{t('restaurantList.newBadge')}</span>}
          {bande && <span className="rc-discret" title={t('restoListUi.priceBandTitle')}>{'€'.repeat(bande)}</span>}
          {services.map((s) => <span key={s} className="rc-discret">{s}</span>)}
        </p>
        {(deliveryOfferLabel || r.vitrine) && (
          <p className="rc-infos">
            {deliveryOfferLabel && <span className="rc-livraison">{deliveryOfferLabel}</span>}
            {/* COMMERCE VITRINE : carte listée, commande impossible — dit ICI, avant de composer un panier. */}
            {r.vitrine && <span className="rc-vitrine">{t('restoListUi.showcaseOnly')}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}

// Un vrai commerce déjà inscrit, pas encore ouvert aux commandes (fiche pas encore publiée par Fairide) : montré pour
// ce qu'il est — un commerce qui arrive —, sans lien vers une fiche qui ne s'ouvrirait pas.
function CarteBientot({ r, t }) {
  return (
    <div className="rest-card rc rc-bientot" aria-label={r.name}>
      <div className="rc-media">
        {r.coverImageUrl
          ? <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 70vw, 320px')} alt="" className="rc-photo" onError={cacherImageCassee} />
          : <span className="rc-photo rc-photo-vide" aria-hidden="true"><Icone nom="restaurants" taille={28} /></span>}
        <span className="rc-offre">{t('restaurantList.soonBadge')}</span>
      </div>
      <div className="rc-corps">
        <h3 className="rest-card-name rc-nom"><span className="rest-card-name-text">{r.name}</span><CertifiedBadge /></h3>
        <p className="rc-sous">{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, list, favoriteIds, onToggleFavorite, t, loop, autoplay = false }) {
  if (list.length === 0) return null;
  if (loop && list.length > 1) {
    return (
      <div className="liste-section">
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
    <div className="liste-section">
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
  // Carnet d'adresses, ouvert depuis la rangee « Livrer a » en tete de page.
  const [choixAdresse, setChoixAdresse] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  usePageMeta({ title: t('restoListUi.pageTitle'), description: t('seo.listDescription'), path: '/restaurants' });
  useJsonLd(breadcrumbJsonLd([
    { name: 'Fairide', path: '/' },
    { name: t('restoListUi.heading'), path: '/restaurants' }
  ]), 'ld-breadcrumb');
  // La page Recherche envoie ici ses résultats « cuisine » et « commune » par l'état de navigation :
  // la liste s'ouvre déjà filtrée, sans que l'URL ne change de forme.
  const filtresInitiaux = useLocation().state || {};
  // La commune « de chez soi » : celle du compte, sinon celle de l'adresse tapée dans la barre de
  // l'accueil (`communeProche`, voir HeroAdresse.jsx). Elle ne FILTRE rien : elle range la liste,
  // sa commune d'abord puis les communes voisines, et nourrit la rangée « près de chez toi ».
  // L'accueil envoyait un filtre de commune strict ; le fondateur a demandé de tout montrer tant
  // qu'il y a peu de commerces (2026-09-27).
  const homeCommune = matchCommune(user?.addressCity) || filtresInitiaux.communeProche || null;
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
  // Les VRAIS commerces déjà inscrits (fondateur, 2026-09-30) : rangée en tête de liste, carte complète seulement ;
  // les démos restent dessous, pour montrer l'étendue de l'offre.
  const [inscrits, setInscrits] = useState([]);
  const toast = useToast();

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch((e) => toast(e.message, 'erreur')).finally(() => setLoading(false));
    api('/restaurants/landing').then((l) => setInscrits((l || []).filter((r) => r.menuComplete))).catch(() => {});
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
      toast(err.message, 'erreur');
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
      if (cuisine && r.cuisine !== cuisine && !(r.extraCuisines || []).includes(cuisine)) return false; // type principal ou secondaire
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
      // Seules les notes réellement données comptent : sans avis, le commerce passe après ceux qui en ont.
      if (tri === 'note') return (b.reviewCount > 0 ? b.rating : 0) - (a.reviewCount > 0 ? a.rating : 0);
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
      .sort((a, b) => (b.reviewCount > 0 ? Number(b.avgRating || b.rating) || 0 : 0) - (a.reviewCount > 0 ? Number(a.avgRating || a.rating) || 0 : 0))
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
      {/* Le titre est MASQUÉ À L'ŒIL, pas supprimé (fondateur, 2026-09-17 : « retire-le de la page »).
          Il reste dans le document parce qu'il y avait été mis pour une raison précise : sans h1, le
          titre de niveau 1 de cette page redevient la marque de l'en-tête, et son sujet, pour un
          moteur de recherche, redevient « fairide » au lieu des restaurants de Bruxelles. Le retirer
          vraiment annulerait ce gain sans que rien ne le signale.
          .sr-only le sort de l'affichage et le laisse aux lecteurs d'écran et aux robots. */}
      <h1 className="sr-only">{t('restoListUi.heading')}</h1>
      {/* OÙ SERA LIVRÉE LA COMMANDE, dit dès la première page.
          L'adresse n'apparaissait qu'au paiement : on parcourait les commerces, on composait son
          panier, et on découvrait à la fin où tout cela irait — l'adresse du compte, pas forcément
          celle du moment. C'est la place qu'elle occupe chez Uber Eats : en tête du fil, avant même
          de choisir un commerce, parce qu'elle détermine ce qui est pertinent.
          Rien pour un visiteur non connecté : il n'a pas encore d'adresse à afficher.
          aria-label sur le bouton : le mot « Modifier » a quitté l'écran au profit d'un chevron
          (capture du fondateur, 2026-09-17), et un chevron seul ne dit rien à un lecteur d'écran —
          le libellé porte donc l'action, et le chevron est marqué aria-hidden. */}
      {user && (
        <button
          type="button"
          className="fiche-adresse"
          onClick={() => setChoixAdresse(true)}
          aria-label={t('restaurantMenu.changeAddress')}
        >
          <Icone nom="maison" taille={18} />
          <span className="fiche-adresse-texte">
            <span className="fiche-adresse-intitule">{t('restaurantMenu.deliverTo')}</span>
            <span className="fiche-adresse-valeur">
              {user.addressStreet && user.addressCity
                ? `${user.addressStreet} ${user.addressNumber || ''}, ${user.addressCity}`.replace(' ,', ',')
                : t('restaurantMenu.noAddress')}
            </span>
          </span>
          {/* Le chevron est dessiné en CSS (deux bords tournés) et non écrit en caractère : « ⌄ » ne
              pèse pas le même trait d'une police à l'autre, et se retrouve souvent décentré. */}
          <span className="fiche-adresse-chevron" aria-hidden="true" />
        </button>
      )}
      {choixAdresse && <ChoixAdresse onFermer={() => setChoixAdresse(false)} />}
      {/* Les pastilles sont des <button>, pas des <div onClick>. C'était le seul endroit du dépôt
          où une .cuisine-chip n'en était pas un — partout ailleurs (MapPage, ChoixPastilles) elle
          porte déjà type="button" et aria-pressed. Un <div> ne reçoit pas le focus : ces pastilles
          étaient injoignables au clavier, alors que filtrer par type de cuisine est le premier
          geste d'un client sur cette page. L'anneau de mise au point posé avec la grammaire des
          boutons ne pouvait donc jamais s'y afficher. */}
      <div className="cuisine-scroll">
        <AutoScrollRow
          items={cuisineOptions}
          keyFor={(opt) => opt.value}
          className="cuisine-track"
          renderItem={(opt, i, key) => (
            <button
              key={key}
              type="button"
              className={`cuisine-chip${chipActive(opt) ? ' active' : ''}`}
              aria-pressed={chipActive(opt)}
              onClick={() => surChip(opt)}
            >
              <span className="emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          )}
        />
      </div>
      {/* LE CHAMP DE RECHERCHE ET LE MENU DES COMMUNES ONT QUITTÉ CETTE PAGE (fondateur, 2026-09-17).
          Deux commandes de plus en haut du fil, alors que la recherche a déjà son propre écran — une
          pastille lui est dédiée dans la barre du bas — et que les communes se choisissent aussi
          depuis là. C'est la forme d'Uber Eats : l'adresse et les catégories en tête, la recherche
          ailleurs.

          MAIS LES FILTRES EUX-MÊMES RESTENT, et c'est volontaire : `search` et `commune` sont aussi
          alimentés par la page Recherche, qui ouvre cette liste DÉJÀ filtrée en passant par l'état de
          navigation (voir filtresInitiaux, et SearchPage.jsx). Retirer l'état en même temps que les
          commandes aurait cassé ce chemin-là sans que rien ne le signale. */}
      {/* Les memes filtres que sur la page Carte, avec les memes noms et les memes seuils : on ne
          change pas de vocabulaire selon qu'on regarde une liste ou une carte. « Emporter » n'est
          pas sur la carte, il n'a de sens que devant une liste de commerces qu'on va chercher. */}
      <div className="liste-filtres">
        {/* LA SORTIE D'UN FILTRE VENU D'AILLEURS. La page Recherche peut ouvrir cette liste déjà
            filtrée sur une commune ou un mot ; le menu déroulant était jusqu'ici la seule façon de
            revenir à tout, et il vient d'être retiré. Sans cette pastille, on serait resté enfermé
            dans le filtre sans rien pour l'enlever — il n'existe aucun bouton « réinitialiser »
            ailleurs sur la page. Elle n'apparaît QUE si un tel filtre est actif. */}
        {commune && (
          <button type="button" className="cuisine-chip active" onClick={() => setCommune('')}>
            <Icone nom="position" taille={16} />{commune}<span aria-hidden="true"> ×</span>
          </button>
        )}
        {search && (
          <button type="button" className="cuisine-chip active" onClick={() => setSearch('')}>
            <Icone nom="recherche" taille={16} />{search}<span aria-hidden="true"> ×</span>
          </button>
        )}
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
          {inscrits.length > 0 && (
            <div className="liste-section">
              <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom="commerce" taille={18} />{inscrits.length === 1 ? t('restaurantList.sectionRegisteredOne') : t('restaurantList.sectionRegistered', { n: inscrits.length })}</h3>
              <div className="rest-grid rest-grid-scroll">
                {inscrits.map((x) => {
                  // Publié : la carte complète de la liste (horaires, offres, favori) ; sinon, une carte « bientôt ».
                  const complet = restaurants.find((r) => r.id === x.id);
                  return complet
                    ? <RestaurantCard key={x.id} r={complet} isFavorite={favoriteIds.has(x.id)} onToggleFavorite={toggleFavorite} t={t} />
                    : <CarteBientot key={x.id} r={x} t={t} />;
                })}
              </div>
            </div>
          )}
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
