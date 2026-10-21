import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { imgProps, cacherImageCassee, photoVue, retenirPhotoVue } from '../../images';
import { chargerAvecCache, lireCache, modifierCache, prechargerFiche } from '../../cacheDonnees';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import TirerPourActualiser from '../../components/TirerPourActualiser';
import { platBio, platVegan, restoBio, restoVegan, restoHalal, restoSansGluten } from '../../dietary';
// Chargée à la demande : la carte tire Leaflet (~150 Ko) avec elle, et cette page fait partie des
// rares gardées en import statique pour le référencement. Sans ce découpage, tout visiteur d'une fiche
// de commerce téléchargeait Leaflet avant de voir la moindre ligne de texte — alors que la vue carte
// est un affichage secondaire, choisi par l'utilisateur.
import Icone from '../../components/Icone';
import ChoixAdresse from '../../components/ChoixAdresse';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import PrixComptoir from '../../components/PrixComptoir';
import AutoScrollRow from '../../components/AutoScrollRow';
import { epingler, titreRangee } from '../../misesEnAvant';
import { lireBienvenue } from '../../bienvenue';
import { repondAuxEnvies } from '../../envies';
import { COMMUNES, ILLUSTRATION_TOUTES_CUISINES, RESTAURANT_TYPES, communeRingDistance, haversineDistanceKm, restaurantTypeLabel, communeDepuisCodePostal } from '../../menuCategories';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { statutOuverture } from '../../openingHours';
import { tarifLivraison, eurosCourts, horsZoneLivraison } from '../../livraison';
import { libellePromo } from '../../prixPlat';
import EmplacementSponsor from '../../components/EmplacementSponsor';
import VisuelVide from '../../components/VisuelVide';
import usePageMeta from '../../hooks/usePageMeta';
import useJsonLd from '../../seo/useJsonLd';
import { restaurantListJsonLd, breadcrumbJsonLd, SITE_URL } from '../../seo/jsonLd';
import { livraisonOuverte, paiementEnLigneOuvert, useLancement, chargerLancement, livreurFairideLibre, commandesOuvertes } from '../../launch';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import TeteListe from '../../components/TeteListe';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import '../../ecran-liste.css';
import '../../site-liste.css';
import AvecMarque from '../../components/AvecMarque';
import { lienFiche } from '../../murCompte';
import { normaliserRecherche } from '../../normaliserRecherche';

// « TRIER » ET « PRIX » RETIRÉS POUR LE MOMENT (fondateur, 2026-10-20, après le test avec Maestro Pizza) : avec une
// poignée de commerces, trier ou filtrer par prix ne sert à rien et charge la bande. Les états et les règles restent
// (le tri « Recommandé » est celui que décrit /classement) : repasser à true ici et dans pages/client/MapPage.jsx.
const TRI_ET_PRIX = false;

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
function offerLabelFor(r, t) {
  if (r.activeCartPromo) return libellePromo(r.activeCartPromo, t);
  return libellePromo((r.menu || []).find((i) => i.activePromo)?.activePromo, t);
}

// Livraison réellement possible ici et maintenant : ouverte (GO), dans la zone, et un livreur libre dans le pool Fairide
// (audit du 19/10, discovery-02 ; un commerce qui livre lui-même garde sa vérification sur sa fiche).
function livraisonPossibleIci(r, user) {
  return !!r.offersDelivery && livraisonOuverte(user) && !horsZoneLivraison(r, user)
    && (r.deliveryMode === 'own' || livreurFairideLibre(user));
}

// Le restaurant peut prendre à sa charge tout ou partie des frais de livraison (voir "🏷️ Frais de
// livraison" dans son dashboard) — affiché comme un pill à côté de la commune, pas confondu avec le
// badge promo (🏷️ en haut de la photo) qui porte sur le contenu du panier, pas la livraison.
// Le prix de la livraison sur la carte du commerce (livraison.js) : offerte, offerte dès X €, ou « dès X € » quand il
// est plus bas que le forfait (le commerce en offre une part, ou livre lui-même à ses frais).
// L'à emporter réellement commandable aujourd'hui : ouvert (1er novembre, payé sur place) et, s'il ne se paie qu'en ligne,
// après le GO. Avant le 1er novembre, la carte disait « À emporter » et le filtre gardait le commerce, alors que le serveur
// refuse (PICKUP_NOT_OPEN) — audit du 19/10, discovery-25.
function emporterPossibleIci(r, user) {
  return !!r.offersPickup && commandesOuvertes(user) && (r.pickupPaymentMode !== 'online' || paiementEnLigneOuvert(user));
}

function deliveryOfferLabelFor(r, t, user) {
  // Avant le GO, pas d'offre de livraison sur les cartes : seul l'à emporter est ouvert (audit du 18/10/2026). Hors zone ou
  // sans livreur libre non plus (audit du 19/10, discovery-02 et 03).
  if (!livraisonPossibleIci(r, user)) return null;
  const tarif = tarifLivraison(r);
  if (tarif.offerte) return t('restoListUi.freeDeliveryPill');
  if (tarif.offerteDes != null) return t('restoListUi.freeFrom', { min: eurosCourts(tarif.offerteDes) });
  if (tarif.reduite || tarif.propre) return t('restoListUi.deliveryFromPill', { amount: eurosCourts(tarif.depart) });
  return null;
}

// CARTE D'UN COMMERCE (refonte du 2026-09-29, fondateur : « trop simpliste, rends-le vraiment user-friendly »).
// Tout ce qui décide d'un clic tient sur la photo et deux lignes : l'offre et l'état (fermé, ouvre à…) posés SUR la
// photo, puis le nom, « cuisine · commune », et une ligne d'infos (note ou « Nouveau », prix, services, offre de
// livraison). Avant : quatre pastilles empilées (commune, quartier, fermé…) et un grand blanc sous le texte.
function RestaurantCard({ r, isFavorite, onToggleFavorite, t }) {
  const { user, token } = useAuth();
  const offerLabel = offerLabelFor(r, t);
  const deliveryOfferLabel = deliveryOfferLabelFor(r, t, user);
  // Pause, « fermé pour aujourd'hui » et interrupteur du commerce comptent, comme sur sa fiche (audit du 19/10, discovery-04).
  const etat = statutOuverture(r, new Date());
  const isClosed = !etat.isOpen;
  const etatTexte = !isClosed ? null
    : etat.opensToday && etat.opensAt
      ? t('restoListUi.closedOpensAt', { time: etat.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
      : t('restoListUi.closed');
  const bande = bandePrix(r);
  // Avant le GO, l'à emporter payé en ligne seulement n'est pas encore commandable : « Commande en ligne bientôt » plutôt
  // que « À emporter », découvert seulement au paiement (audit du 18/10/2026).
  const emporterPossible = emporterPossibleIci(r, user);
  const livraisonOuverteIci = r.offersDelivery && livraisonOuverte(user);
  const livraisonPossible = livraisonPossibleIci(r, user);
  // Hors zone : dit sur la carte, avant de composer un panier (audit du 19/10, discovery-03) ; l'à emporter reste dit à côté.
  const horsZone = livraisonOuverteIci && horsZoneLivraison(r, user);
  const services = [emporterPossible && t('restoListUi.servicePickup'), livraisonPossible && t('restoListUi.serviceDelivery'), horsZone && t('restoListUi.outOfZone'), !emporterPossible && !livraisonOuverteIci && (r.offersPickup || r.offersDelivery) && t('restoListUi.serviceSoon'), r.fairideDeliveryDisabled && emporterPossible && t('restoListUi.pickupOnlyZone')].filter(Boolean);
  // VISITEUR NON CONNECTÉ : la liste se parcourt librement (on y arrive depuis la barre d'adresse de
  // l'accueil), mais ouvrir un commerce demande un compte (fondateur, 2026-09-27). Le lien part vers
  // la connexion avec la fiche en `from`, et Auth.jsx y ramène une fois connecté ou inscrit.
  // La ROUTE /restaurants/:id, elle, reste publique (App.jsx) : un lien partagé, un moteur de
  // recherche ou la page prérendue y mènent toujours directement. Seul ce clic-ci est filtré.
  return (
    <Link
      {...lienFiche(user, r.id)}
      className={`rest-card rc${isClosed ? ' rc-est-ferme' : ''}`}
      // La fiche part dès que le doigt se pose (cacheDonnees.js) — seulement si le lien y mène (connecté, murCompte.js).
      onPointerDown={user ? () => prechargerFiche(r.id, token) : undefined}
    >
      <div className="rc-media">
        <VisuelVide nom={r.name} cuisine={r.cuisine} />
        {/* Déjà vue pendant la visite : pas de second fondu (images.js, photoVue). */}
        {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 70vw, 320px')} alt="" className={`rc-photo${photoVue(r.coverImageUrl) ? ' rc-photo--vue' : ''}`} onLoad={() => retenirPhotoVue(r.coverImageUrl)} onError={cacherImageCassee} />}
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
        <p className="rc-sous">{[[r.cuisine, ...(r.extraCuisines || [])].filter(Boolean).slice(0, 2).map((c) => restaurantTypeLabel(c, t) || c).join(', '), r.neighborhood || r.commune, r.distanceKm != null && `${r.distanceKm < 10 ? r.distanceKm.toFixed(1).replace('.', ',') : Math.round(r.distanceKm)} km`].filter(Boolean).join(' · ')}</p>
        <p className="rc-infos">
          {/* Pas d'étoiles sans avis : une note que personne n'a donnée n'est pas un avis (CDE VI.100). */}
          {r.reviewCount > 0
            ? <span className="rc-note"><span aria-hidden="true">★</span> {Number(r.rating).toFixed(1)} <span className="rc-discret">({r.reviewCount})</span></span>
            : <span className="rc-nouveau">{t('restaurantList.newBadge')}</span>}
          {/* Position payée par le commerce : toujours dite au client (classement payant, CDE VI.99). */}
          {r.sponsorise && <span className="rc-sponsorise" title={t('restoListUi.sponsoredTitle')}>{t('restoListUi.sponsored')}</span>}
          {bande &&<span className="rc-discret" title={t('restoListUi.priceBandTitle')}>{'€'.repeat(bande)}</span>}
          {services.map((s) => <span key={s} className="rc-discret">{s}</span>)}
        </p>
        {/* Le badge « Prix du comptoir » sur la seconde ligne : sur la première (note, services), il était coupé dans l'app. */}
        {(deliveryOfferLabel || r.vitrine || r.prixComptoir) && (
          <p className="rc-infos">
            {r.prixComptoir && <PrixComptoir />}
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
// Commerce sans photo de couverture (ou photo qui ne charge pas) : un visuel aux couleurs de Fairide, avec
// l'initiale du nom et l'emoji de sa cuisine — voir components/VisuelVide.jsx. Il est rendu sous la photo.

function CarteBientot({ r, t }) {
  return (
    <div className="rest-card rc rc-bientot" aria-label={r.name}>
      <div className="rc-media">
        <VisuelVide nom={r.name} cuisine={r.cuisine} />
        {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 70vw, 320px')} alt="" className="rc-photo" onError={cacherImageCassee} />}
        <span className="rc-offre">{t('restaurantList.soonBadge')}</span>
      </div>
      <div className="rc-corps">
        <h3 className="rest-card-name rc-nom"><span className="rest-card-name-text">{r.name}</span><CertifiedBadge /></h3>
        <p className="rc-sous">{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  );
}

/* À LA UNE PRÈS DE TOI (fondateur, 2026-10-17, haut de la version B de « Liste » dans mockups/commerces-marque.html ; les
 * rangées d'aujourd'hui restent dessous, telles quelles). Une grande carte photo par écran, le nom écrit sur la photo, et des
 * points qui disent où l'on en est ; on passe de l'une à l'autre au doigt (défilement aimanté). Sur un ordinateur, trois de
 * front. Le CHOIX n'est pas payant : jusqu'à UNE_MAX commerces avec une photo de couverture, les plus proches d'abord (même
 * ordre que « Autour de toi », sans mise en avant), ceux qui sont ouverts avant ceux qui sont fermés — /classement le décrit
 * (conformite.ranking_rows). « Nouveau sur Fairide » : seulement pour un commerce inscrit depuis moins de NOUVEAU_JOURS
 * jours (date de /restaurants/landing) ; sans date connue, rien. */
const UNE_MAX = 5;
const NOUVEAU_JOURS = 30;
function ALaUne({ list, inscritLe, t }) {
  const { user, token } = useAuth();
  const rail = useRef(null);
  const [actif, setActif] = useState(0);
  const surDefilement = () => {
    const el = rail.current;
    if (!el || !el.firstElementChild) return;
    const pas = el.firstElementChild.getBoundingClientRect().width + 12;
    setActif(Math.min(list.length - 1, Math.max(0, Math.round(el.scrollLeft / pas))));
  };
  const maintenant = Date.now();
  return (
    <section className="liste-section une-section">
      <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom="eclair" taille={18} />{t('restaurantList.sectionFeatured')}</h3>
      <div className="une-rail" ref={rail} onScroll={surDefilement}>
        {list.map((r) => {
          // Même état que la fiche : pause et « fermé pour aujourd'hui » compris (audit du 19/10, discovery-04).
          const ferme = !statutOuverture(r, new Date()).isOpen;
          const depuis = inscritLe.get(r.id);
          const nouveau = depuis != null && maintenant - depuis < NOUVEAU_JOURS * 86400000;
          const sous = [[r.cuisine, ...(r.extraCuisines || [])].filter(Boolean).slice(0, 1).map((c) => restaurantTypeLabel(c, t) || c).join(''), r.neighborhood || r.commune,
            r.distanceKm != null && `${r.distanceKm < 10 ? r.distanceKm.toFixed(1).replace('.', ',') : Math.round(r.distanceKm)} km`].filter(Boolean).join(' · ');
          return (
            // Même règle que les cartes dessous : sans compte, le clic mène à la connexion, puis à la fiche.
            <Link key={r.id} {...lienFiche(user, r.id)} className={`une-carte${ferme ? ' une-carte--fermee' : ''}`} onPointerDown={user ? () => prechargerFiche(r.id, token) : undefined}>
              <VisuelVide nom={r.name} cuisine={r.cuisine} />
              <img {...imgProps(r.coverImageUrl, 800, '(max-width: 640px) 92vw, 380px')} alt="" className="une-photo" decoding="async" onError={cacherImageCassee} />
              <span className="une-voile" aria-hidden="true" />
              {nouveau && <span className="une-surtitre"><Icone nom="eclair" taille={13} />{t('restaurantList.newOnFairide')}</span>}
              {ferme && <span className="une-etat">{t('restoListUi.closed')}</span>}
              <span className="une-texte">
                <span className="une-nom">{r.name}{r.certified && <CertifiedBadge size={18} />}</span>
                <span className="une-infos">
                  {r.reviewCount > 0
                    ? <span className="une-note"><Icone nom="etoile" taille={13} />{Number(r.rating).toFixed(1).replace('.', ',')} <span>({r.reviewCount})</span></span>
                    : <span>{t('restaurantList.newBadge')}</span>}
                  {sous && <span>{sous}</span>}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      {list.length > 1 && (
        <div className="une-points" aria-hidden="true">
          {list.map((r, i) => <i key={r.id} className={i === actif ? 'on' : undefined} />)}
        </div>
      )}
    </section>
  );
}

// `cle` : la clé de la rangée (mises en avant / sponsors) — le logo partenaire de la rangée se glisse à côté du titre
// (EmplacementSponsor : rien pour le public tant que l'admin n'a pas activé la rangée).
// `grille` (site, à partir de 900 px) : une grille qui suit la largeur, au lieu d'une rangée qui défile de côté — à la
// souris, une rangée qui défile se manie mal, et un écran large montre trois ou quatre commerces de front sans rien cacher
// (mockups/site-ordinateur.html, section « Liste »). Mêmes commerces, même ordre ; seule la disposition change.
function Section({ title, icon, list, favoriteIds, onToggleFavorite, t, loop, autoplay = false, cle, grille = false }) {
  if (list.length === 0) return null;
  const titre = <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom={icon} taille={18} />{title}{cle && <EmplacementSponsor cle={cle} />}</h3>;
  if (grille) {
    return (
      <section className="liste-section">
        {titre}
        <div className="rest-grid sl-grille">
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
          ))}
        </div>
      </section>
    );
  }
  if (loop && list.length > 1) {
    return (
      <div className="liste-section">
        {titre}
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
      {titre}
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
  // BOUTON GO (audit du 19/10, discovery-01) : la liste suit l'état du serveur comme la fiche (src/launch.js). Sans cet
  // abonnement, un téléphone neuf après GO voyait « Commande en ligne bientôt » jusqu'à ouvrir une fiche, et un téléphone
  // resté sur « GO » promettait la livraison après la fermeture.
  useLancement();
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
  // Ville du compte en néerlandais (« Elsene », « Schaarbeek ») ou en quartier (« Laeken ») : la commune se retrouve par le
  // code postal (audit du 19/10, discovery-23), sinon le « manger local » ne s'appliquait pas du tout.
  const homeCommune = matchCommune(user?.addressCity) || communeDepuisCodePostal(user?.addressPostalCode) || filtresInitiaux.communeProche || null;
  /* AU RETOUR SUR LA LISTE, ELLE EST DÉJÀ LÀ (2026-10-20, test de l'app Android) : la dernière liste lue s'affiche dès la
     première image, sans squelette, et se relit en arrière-plan (cacheDonnees.js). C'est aussi ce qui permet à la photo
     d'une fiche fermée par sa croix de retrouver sa carte (transitionPhoto.js) au lieu de tomber sur des cartes grises. */
  const [restaurants, setRestaurants] = useState(() => lireCache('/restaurants') || []);
  /* Apres la declaration de `restaurants`, jamais avant : lu plus haut, le tableau serait dans
     sa zone morte temporelle et la page planterait au montage. */
  useJsonLd(restaurantListJsonLd(restaurants, { url: `${SITE_URL}/restaurants` }), 'ld-list');
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(token ? lireCache('/restaurants/favorites/ids', token) || [] : []));
  const [orderedRestaurantIds, setOrderedRestaurantIds] = useState(() => new Set(token ? (lireCache('/orders/mine', token) || []).map((o) => o.restaurantId) : []));
  const [loading, setLoading] = useState(() => !lireCache('/restaurants'));
  // La liste n'a pas pu être lue (réseau, serveur) : « Impossible de charger » et Réessayer, pas « Aucun commerce ».
  const [echecListe, setEchecListe] = useState(false);
  // `silencieux` : tirer pour actualiser ne remet pas les cartes grises ; « Réessayer », si. `forcer` : relire même une
  // liste lue à l'instant (cacheDonnees.js). Une réponse identique rend le même tableau : React ne redessine rien.
  const chargerListe = useCallback(({ silencieux = false, forcer = false } = {}) => {
    setEchecListe(false); if (!silencieux) setLoading(true);
    // Rend true / false : tirer pour actualiser le dit quand la lecture échoue alors que des cartes sont déjà là (discovery-32).
    return chargerAvecCache('/restaurants', { forcer }).then((l) => { setRestaurants(l); setEchecListe(false); return true; }).catch(() => { setEchecListe(true); return false; }).finally(() => setLoading(false));
  }, []);
  const [search, setSearch] = useState(filtresInitiaux.search || '');
  const [commune, setCommune] = useState(filtresInitiaux.commune || '');
  const [cuisine, setCuisine] = useState(filtresInitiaux.cuisine || '');
  const [bio, setBio] = useState(!!filtresInitiaux.bio);
  const [vegan, setVegan] = useState(!!filtresInitiaux.vegan);
  // Halal et sans gluten (backend migration 042) : déclarés par le commerce, voir dietary.js.
  const [halal, setHalal] = useState(!!filtresInitiaux.halal);
  const [sansGluten, setSansGluten] = useState(!!filtresInitiaux.sansGluten);
  // Les memes filtres que sur la carte, avec les memes noms : prix, emporter, et un tri.
  // Les avoir des deux cotes evite d'avoir a changer de vue pour affiner une recherche.
  const [prix, setPrix] = useState(0);
  const [emporter, setEmporter] = useState(false);
  const [tri, setTri] = useState('recommande');
  const [panneau, setPanneau] = useState(null);
  // Les VRAIS commerces déjà inscrits (fondateur, 2026-09-30) : rangée en tête de liste, carte complète seulement ;
  // les démos restent dessous, pour montrer l'étendue de l'offre.
  const [inscrits, setInscrits] = useState(() => (lireCache('/restaurants/landing') || []).filter((r) => r.menuComplete));
  // Date d'inscription de chaque commerce (ms), pour « Nouveau sur Fairide » sur les cartes « À la une ».
  const [inscritLe, setInscritLe] = useState(() => new Map((lireCache('/restaurants/landing') || []).filter((r) => r.createdAt).map((r) => [r.id, Number(r.createdAt)])));
  const [placementsTous, setPlacementsTous] = useState(() => lireCache('/placements/active')?.placements || []);
  // Rangées ouvertes à la vente par l'admin en plus de celles d'origine : une par type de cuisine (« Pizza »…).
  const [rangeesAjoutees, setRangeesAjoutees] = useState(() => lireCache('/placements/active')?.sections || []);
  const toast = useToast();
  // LE SITE SUR UN ORDINATEUR (mockups/site-ordinateur.html, « Liste ») — jamais dans l'app : à partir de 900 px, des
  // grilles au lieu des rangées et Livraison / À emporter sur le bandeau ; à partir de 1 100 px, les filtres (Trier, Prix,
  // Envies) passent dans une colonne à gauche. Mêmes états, mêmes règles de tri et de filtre qu'avant : rien d'autre ne bouge.
  const grand = useSiteLarge(900);
  const colonne = useSiteLarge(1100);

  // Une seule lecture de la liste, au chargement et quand on tire pour actualiser (app). Elle rend la promesse des commerces :
  // le vélo roule jusqu'à leur arrivée. Échec : « Impossible de charger » et Réessayer (chargerListe), pas « Aucun commerce ».
  // Chaque lecture passe par cacheDonnees.js : une réponse identique à celle déjà affichée rend le même objet, et l'on ne
  // reconstruit alors ni les Map ni les Set (sinon chaque retour sur la liste redessinait toutes les rangées).
  function charger({ forcer = false } = {}) {
    const commerces = chargerListe({ silencieux: true, forcer });
    // Tirer pour actualiser relit aussi le bouton GO (et la disponibilité des livreurs).
    if (forcer) chargerLancement();
    const deja = { landing: lireCache('/restaurants/landing'), placements: lireCache('/placements/active') };
    chargerAvecCache('/restaurants/landing', { forcer }).then((l) => {
      if (l === deja.landing) return;
      setInscrits((l || []).filter((r) => r.menuComplete));
      setInscritLe(new Map((l || []).filter((r) => r.createdAt).map((r) => [r.id, Number(r.createdAt)])));
    }).catch(() => {});
    // Mises en avant payantes du jour (routes/placements.js) : sans réponse, la liste reste dans son ordre naturel.
    chargerAvecCache('/placements/active', { forcer }).then((r) => { if (r === deja.placements) return; setPlacementsTous(r.placements || []); setRangeesAjoutees(r.sections || []); }).catch(() => {});
    // Page publique (consultable sans compte, voir App.jsx) — ces deux appels ne concernent que les
    // clients connectés, inutile de les tenter (et de récolter un 401 silencieux) pour un visiteur anonyme.
    if (token) {
      const favoris = lireCache('/restaurants/favorites/ids', token);
      const commandes = lireCache('/orders/mine', token);
      chargerAvecCache('/restaurants/favorites/ids', { token, forcer }).then((ids) => { if (ids !== favoris) setFavoriteIds(new Set(ids)); }).catch(() => {});
      chargerAvecCache('/orders/mine', { token, forcer }).then((orders) => { if (orders !== commandes) setOrderedRestaurantIds(new Set(orders.map((o) => o.restaurantId))); }).catch(() => {});
    }
    return commerces;
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // « Fermé » / « Ouvre à 18:00 » se recalculent chaque minute tant que la page reste ouverte, comme sur la fiche
  // (RestaurantMenu.jsx) : sinon une carte restait « Fermé » après l'heure d'ouverture (audit du 19/10, discovery-32).
  const [, setMinute] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinute((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  // Tirer pour actualiser : sans réseau, la liste restait telle quelle sans rien dire (discovery-32).
  const actualiser = () => charger({ forcer: true }).then((ok) => { if (!ok && restaurants.length) toast(t('restoListUi.refreshFailed'), 'erreur'); });

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
      // La copie gardée suit (cacheDonnees.js) : la fiche, puis la liste au retour, montrent le bon cœur dès l'ouverture.
      modifierCache('/restaurants/favorites/ids', token, (ids) => (isFav ? ids.filter((x) => x !== id) : [...ids, id]));
    } catch (err) {
      toast(err.message, 'erreur');
    }
  }

  // Bio et Vegan sont dans la même rangée que les types de commerce, en fin de liste : des filtres comme les
  // autres (cumulables entre eux et avec un type), sans mise en avant.
  const cuisineOptions = [
    { value: '', emoji: 'restaurants', illustration: ILLUSTRATION_TOUTES_CUISINES, label: t('restaurantList.allCuisines') },
    ...RESTAURANT_TYPES.map((rt) => ({ value: rt.value, emoji: rt.icone, illustration: rt.illustration, label: restaurantTypeLabel(rt.value, t) })),
    { value: '__bio', emoji: 'feuille', label: t('restaurantList.chipBio'), regime: 'bio' },
    { value: '__vegan', emoji: 'feuille', label: t('restaurantList.chipVegan'), regime: 'vegan' },
    { value: '__halal', emoji: 'coche', label: t('restaurantList.chipHalal'), regime: 'halal' },
    { value: '__sansGluten', emoji: 'coche', label: t('restaurantList.chipGlutenFree'), regime: 'sansGluten' }
  ];
  const REGIMES = { bio: [bio, setBio], vegan: [vegan, setVegan], halal: [halal, setHalal], sansGluten: [sansGluten, setSansGluten] };
  const chipActive = (opt) => (opt.regime ? REGIMES[opt.regime][0] : cuisine === opt.value);
  const surChip = (opt) => {
    if (opt.regime) REGIMES[opt.regime][1]((v) => !v);
    else setCuisine(cuisine === opt.value ? '' : opt.value);
  };

  // Mises en avant PAR COMMUNE (fondateur, 2026-10-06) : un commerce qui paie n'est épinglé que pour les clients de sa commune
  // (celle du filtre, sinon celle de chez soi). Sans commune connue, rien n'est épinglé.
  // RANGÉE SANS MISE EN AVANT → ORDRE ALÉATOIRE (fondateur, 2026-10-06) : personne n'a payé pour cette rangée dans cette
  // commune, donc personne n'y est avantagé par l'ordre. Mélange stable le temps de la visite (graine tirée une fois), sinon
  // chaque rafraîchissement d'état rebattrait les cartes sous les yeux du client. « Autour de vous » garde la distance.
  const [graine] = useState(() => Math.random().toString(36).slice(2));
  const melanger = (liste) => {
    const poids = (id) => { let h = 2166136261; const s = `${graine}:${id}`; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    return [...liste].sort((a, b) => rang(a) - rang(b) || poids(a.id) - poids(b.id));
  };
  const epinglerOuMelanger = (liste, pl, cle, admissibles) => (pl.some((p) => p.sectionKey === cle) || cle === 'nearby' ? epingler(liste, pl, cle, admissibles) : melanger(liste));
  // MANGER LOCAL (fondateur, 2026-10-06, précisé le 07/10) : chaque rangée montre D'ABORD les commerces de la commune du client
  // (`homeCommune` : adresse du compte, sinon adresse tapée sur l'accueil), PUIS ceux des communes voisines de proche en proche —
  // jamais une rangée ni une page vide. « Autour de vous » reste du plus proche au plus loin par rapport à son adresse. Les
  // filtres et la recherche restent libres. Les mises en avant restent par commune.
  const rang = (r) => (homeCommune ? communeRingDistance(homeCommune, r.commune) : 0);
  const dansCommune = homeCommune ? restaurants.filter((r) => r.commune === homeCommune) : [];
  const base = homeCommune ? [...restaurants].sort((a, b) => rang(a) - rang(b)) : restaurants;
  const communeEpingles = commune || homeCommune;
  const placements = communeEpingles ? placementsTous.filter((p) => !p.commune || p.commune === communeEpingles) : [];
  const hasActiveFilter = !!(search || cuisine || commune || bio || vegan || halal || sansGluten || prix || emporter || tri !== 'recommande');

  // Distance a vol d'oiseau depuis l'adresse du compte, quand elle est connue.
  const distanceDe = (r) => (user?.lat && user?.lng && r.lat && r.lng ? haversineDistanceKm(user.lat, user.lng, r.lat, r.lng) : null);

  const list = restaurants
    .filter((r) => {
      if (commune && r.commune !== commune) return false;
      if (cuisine && r.cuisine !== cuisine && !(r.extraCuisines || []).includes(cuisine)) return false; // type principal ou secondaire
      if (bio && !restoBio(r)) return false;
      if (vegan && !restoVegan(r)) return false;
      if (halal && !restoHalal(r)) return false;
      if (sansGluten && !restoSansGluten(r)) return false;
      if (search && !normaliserRecherche(`${r.name} ${r.desc} ${r.cuisine}`).includes(normaliserRecherche(search))) return false;
      if (prix && bandePrix(r) !== prix) return false;
      if (emporter && !emporterPossibleIci(r, user)) return false;
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
  // SEULE « AUTOUR DE TOI » EST COMPLÉTÉE (audit du 19/10, discovery-07) : une rangée « Vegan » d'un commerce vegan et de
  // cinq commerces qui ne le sont pas mentait sur son titre. Les rangées à thème restent courtes ; une rangée d'une seule
  // carte ne tourne pas en boucle (Section, loop && list.length > 1). /classement le dit (conformite.ranking_rows).
  const completer = (liste) => {
    if (liste.length === 0 || liste.length >= MIN_PAR_RANGEE) return liste;
    const dejaLa = new Set(liste.map((r) => r.id));
    const renfort = [...base]
      .filter((r) => !dejaLa.has(r.id))
      .sort((a, b) => (b.reviewCount > 0 ? Number(b.avgRating || b.rating) || 0 : 0) - (a.reviewCount > 0 ? Number(a.avgRating || a.rating) || 0 : 0))
      .slice(0, MIN_PAR_RANGEE - liste.length);
    return [...liste, ...renfort];
  };
  const nonGrocery = base.filter((r) => !GROCERY_TYPES.includes(r.cuisine));
  const nonGroceryTous = restaurants.filter((r) => !GROCERY_TYPES.includes(r.cuisine)); // « Autour de vous » : toutes les communes
  // MISES EN AVANT (fondateur, 2026-10-02) : un commerce qui a payé la 1re, 2e ou 3e position d'une rangée y remonte,
  // marqué « Sponsorisé » — seulement s'il a sa place dans la rangée (voir misesEnAvant.js).
  const groceryList = epinglerOuMelanger(base.filter((r) => GROCERY_TYPES.includes(r.cuisine)), placements, 'grocery');
  // AUTOUR DE VOUS, DU PLUS PROCHE AU PLUS LOIN (fondateur, 2026-10-01). Adresse géolocalisée : les commerces triés
  // par distance réelle, la distance affichée sur la carte. Sans position : sa commune d'abord, puis les communes
  // voisines de proche en proche (communeRingDistance). Les commerces sans coordonnées passent après.
  const PROCHES_MAX = 15;
  const parDistance = nonGroceryTous.map((r) => ({ ...r, distanceKm: distanceDe(r) })).filter((r) => r.distanceKm != null).sort((a, b) => a.distanceKm - b.distanceKm);
  const nearbyList = completer(epingler(parDistance.length
    ? parDistance.slice(0, PROCHES_MAX)
    : homeCommune ? [...nonGroceryTous].sort((a, b) => communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune)).slice(0, PROCHES_MAX) : [],
  placements, 'nearby', parDistance.length ? parDistance : nonGroceryTous));
  /* VOS ENVIES (2026-10-13). L'accueil de l'application demande « Une envie en particulier ? » et range ses résultats
   * avec ; la liste les oubliait ensuite. Une rangée de plus, juste sous « Autour de vous », avec les commerces qui y
   * répondent, dans le même ordre de proximité — les autres rangées ne bougent pas. Les envies vivent dans le téléphone
   * (bienvenue.js, jamais envoyées) : sur le site, où l'accueil de l'app ne passe pas, la rangée n'existe pas.
   * Jamais complétée : une rangée « Vos envies » remplie de commerces qui n'y répondent pas mentirait.
   * /classement (RankingPage, conformite.ranking_rows) la décrit. */
  const envies = Array.isArray(lireBienvenue().envies) ? lireBienvenue().envies : [];
  const enviesList = envies.length
    ? (parDistance.length ? parDistance : homeCommune ? [...nonGroceryTous].sort((a, b) => communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune)) : nonGroceryTous)
      .filter((r) => repondAuxEnvies(r, envies)).slice(0, PROCHES_MAX)
    : [];
  // À la une : voir ALaUne. Même ordre que « Autour de toi », mais SANS épinglage payant, avec photo, ouverts d'abord.
  const ouvert = (r) => statutOuverture(r, new Date()).isOpen;
  const aLaUne = (parDistance.length ? parDistance : homeCommune ? [...nonGroceryTous].sort((a, b) => communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune)) : nonGroceryTous)
    // SA PROPRE PHOTO (audit du 19/10, discovery-05) : le serveur remplit toujours coverImageUrl, avec une photo d'illustration
    // quand le commerce n'en a pas ; `ownCover` dit si c'est la sienne. Une liste lue avant ce champ (undefined) garde l'ancien
    // comportement. Pas de commerce « Carte seule » (vitrine) en tête : on ne peut pas y commander (discovery-34).
    .filter((r) => r.coverImageUrl && r.ownCover !== false && !r.vitrine)
    .map((r, i) => ({ r, i, o: ouvert(r) ? 0 : 1 }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .slice(0, UNE_MAX)
    .map(({ r }) => r);
  // LIVRAISON DÈS 3 € et LIVRAISON OFFERTE (fondateur, 2026-10-01) : seulement les commerces concernés, jamais complétées.
  const SEUIL_PAS_CHER = 3;
  // Rangées « Livraison offerte » et « Livraison dès 3 € » : seulement après le GO (avant, seul l'à emporter est ouvert).
  // Ni hors zone, ni sans livreur libre (audit du 19/10, discovery-02 et 03).
  const livrables = livraisonOuverte(user) ? nonGrocery.filter((r) => livraisonPossibleIci(r, user)) : [];
  const livraisonPasCher = livrables.map((r) => ({ r, tarif: tarifLivraison(r) }))
    .filter(({ tarif }) => !tarif.offerte && tarif.offerteDes == null && tarif.depart > 0 && tarif.depart <= SEUIL_PAS_CHER)
    .sort((a, b) => a.tarif.depart - b.tarif.depart).map(({ r }) => r);
  const livraisonPasCherEpinglee = epinglerOuMelanger(livraisonPasCher, placements, 'cheap_delivery');
  const livraisonOfferte = livrables.map((r) => ({ r, tarif: tarifLivraison(r) }))
    .filter(({ tarif }) => tarif.offerte || tarif.offerteDes != null)
    .sort((a, b) => (a.tarif.offerte ? 0 : a.tarif.offerteDes) - (b.tarif.offerte ? 0 : b.tarif.offerteDes)).map(({ r }) => r);
  const livraisonOfferteEpinglee = epinglerOuMelanger(livraisonOfferte, placements, 'free_delivery');
  // Une rangée par type de cuisine ajoutée dans Admin › Mises en avant : les commerces de ce type (principal ou
  // secondaire), les épinglés en tête. Jamais complétée : une rangée « Pizza » ne montre que des pizzerias.
  const rangeesCuisine = rangeesAjoutees.filter((s) => s.kind === 'cuisine' && s.cuisine).map((s) => ({
    ...s,
    liste: epinglerOuMelanger(base.filter((r) => r.cuisine === s.cuisine || (r.extraCuisines || []).includes(s.cuisine)), placements, s.key)
  })).filter((s) => s.liste.length > 0);
  const offersList = epinglerOuMelanger(base.filter((r) => r.hasPromo), placements, 'offers');
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
  const bioList = epinglerOuMelanger(parMention(platBio), placements, 'bio');
  const veganList = epinglerOuMelanger(parMention(platVegan), placements, 'vegan');
  const healthyList = epinglerOuMelanger(nonGrocery
    .map((r) => ({ r, n: (r.menu || []).filter((m) => m.healthy).length }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ r }) => r), placements, 'healthy');
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
    const des = new Map(eligible.map((r) => [r.id, Math.random()]));
    return [...eligible].sort((a, b) => rang(a) - rang(b) || des.get(a.id) - des.get(b.id)).slice(0, DISCOVER_MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, homeCommune, orderedRestaurantIds, user?.lat, user?.lng]);

  const avecPosition = !!(user?.lat && user?.lng);
  const libelleTri = (cle) => (cle === 'recommande' ? t('mapClient.sortRecommended') : cle === 'note' ? t('siteListe.triNote') : t('siteListe.triDistance'));
  // « Manger local : les commerces de … d'abord » retiré (fondateur, 2026-10-16) : on ne prévient plus que si la commune n'a
  // encore aucun commerce, pour dire pourquoi la liste montre ceux d'à côté.
  const localTexte = homeCommune && dansCommune.length === 0 ? t('restaurantList.localEmpty', { commune: homeCommune }) : null;
  // Le bandeau ne s'affiche qu'avec un compte : sans lui, « À emporter » reste une pastille au-dessus de la liste.
  // Avant le GO, seul l'à emporter est ouvert : pas de bascule « Livraison / À emporter » (audit du 19/10, discovery-25) ; la
  // pastille « À emporter » reste au-dessus de la liste.
  const modeSurBandeau = grand && !!user && livraisonOuverte(user);
  // La rangée de pastilles au-dessus de la liste : tout ce que la colonne et le bandeau ne portent pas déjà.
  const pastillesFiltres = !colonne || !modeSurBandeau;
  return (
    <div className={`sl-liste${grand ? ' sl-liste--grand' : ''}${colonne ? ' sl-liste--colonne' : ''}`}>
      <TirerPourActualiser onActualiser={actualiser} />
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
          Rien pour un visiteur non connecté : il n'a pas encore d'adresse à afficher (adresse null, pas de bandeau).
          Depuis le 2026-10-16, l'adresse est sur un bandeau iris et les pastilles de cuisine dans une bande collée en
          haut, la cuisine choisie sous une lentille : voir TeteListe.jsx. */}
      <TeteListe
        adresse={user ? (user.addressStreet && user.addressCity
          ? `${user.addressStreet} ${user.addressNumber || ''}, ${user.addressCity}`.replace(' ,', ',')
          : t('restaurantMenu.noAddress')) : null}
        intituleAdresse={t('restaurantMenu.deliverTo')}
        libelleChanger={t('restaurantMenu.changeAddress')}
        onAdresse={() => setChoixAdresse(true)}
        // Avec la colonne, Bio / Vegan / Halal / Sans gluten y sont (« Envies ») : la bande ne garde que les cuisines.
        options={colonne ? cuisineOptions.filter((o) => !o.regime) : cuisineOptions}
        estActive={chipActive}
        surPuce={surChip}
        cuisine={cuisine}
        choisirCuisine={setCuisine}
        libelleBande={t('ecranListe.cuisinesAria')}
        mode={modeSurBandeau ? {
          emporter,
          choisir: setEmporter,
          libelleLivraison: t('siteListe.modeLivraison'),
          libelleEmporter: t('restaurantList.filterPickup'),
          libelleGroupe: t('siteListe.modeAria')
        } : null}
      />
      {choixAdresse && <ChoixAdresse onFermer={() => setChoixAdresse(false)} />}
      <div className="sl-corps">
      {/* LA COLONNE DES FILTRES (site, à partir de 1 100 px ; mockups/site-ordinateur.html, « Liste »). Les mêmes filtres que
          les pastilles et leurs panneaux, ouverts d'un coup au lieu d'être repliés : Trier (mêmes trois tris), Prix (mêmes
          bandes), Envies (les quatre bascules de régime qui terminent la bande des cuisines). Elle reste à l'écran quand on
          descend (collante) ; « Manger local » passe en bas, comme dans la maquette. */}
      {colonne && (
        <aside className="sl-filtres" aria-label={t('siteListe.filtresAria')}>
          {(commune || search) && (
            <div className="sl-filtres-actifs">
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
            </div>
          )}
          {TRI_ET_PRIX && <>
          <fieldset className="sl-groupe">
            <legend className="sl-groupe-titre">{t('mapClient.sort')}</legend>
            {['recommande', 'note', 'distance'].map((cle) => {
              const indisponible = cle === 'distance' && !avecPosition;
              return (
                <label key={cle} className={`sl-choix sl-choix--radio${tri === cle ? ' on' : ''}${indisponible ? ' sl-choix--off' : ''}`}
                  title={indisponible ? t('mapClient.sortDistanceNeedsAddress') : undefined}>
                  <input type="radio" name="sl-tri" value={cle} checked={tri === cle} disabled={indisponible} onChange={() => setTri(cle)} />
                  <i aria-hidden="true" />{libelleTri(cle)}
                </label>
              );
            })}
          </fieldset>
          <fieldset className="sl-groupe">
            <legend className="sl-groupe-titre">{t('mapClient.filterPrice')}</legend>
            <div className="sl-prix">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" className={`cuisine-chip${prix === n ? ' active' : ''}`} aria-pressed={prix === n}
                  onClick={() => setPrix((p) => (p === n ? 0 : n))}>
                  {'€'.repeat(n)}
                </button>
              ))}
            </div>
          </fieldset>
          </>}
          <fieldset className="sl-groupe">
            <legend className="sl-groupe-titre">{t('siteListe.envies')}</legend>
            {cuisineOptions.filter((o) => o.regime).map((o) => {
              const [actif, changer] = REGIMES[o.regime];
              return (
                <label key={o.value} className={`sl-choix sl-choix--case${actif ? ' on' : ''}`}>
                  <input type="checkbox" checked={actif} onChange={() => changer((v) => !v)} />
                  <i aria-hidden="true"><Icone nom="valider" taille={14} /></i>{o.label}
                </label>
              );
            })}
          </fieldset>
          {!loading && !hasActiveFilter && localTexte && (
            <p className="sl-local" role="status"><Icone nom="position" taille={18} /><span>{localTexte}</span></p>
          )}
        </aside>
      )}
      <div className="sl-contenu">
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
      {pastillesFiltres && <div className="liste-filtres">
        {/* LA SORTIE D'UN FILTRE VENU D'AILLEURS. La page Recherche peut ouvrir cette liste déjà
            filtrée sur une commune ou un mot ; le menu déroulant était jusqu'ici la seule façon de
            revenir à tout, et il vient d'être retiré. Sans cette pastille, on serait resté enfermé
            dans le filtre sans rien pour l'enlever — il n'existe aucun bouton « réinitialiser »
            ailleurs sur la page. Elle n'apparaît QUE si un tel filtre est actif. */}
        {!colonne && commune && (
          <button type="button" className="cuisine-chip active" onClick={() => setCommune('')}>
            <Icone nom="position" taille={16} />{commune}<span aria-hidden="true"> ×</span>
          </button>
        )}
        {!colonne && search && (
          <button type="button" className="cuisine-chip active" onClick={() => setSearch('')}>
            <Icone nom="recherche" taille={16} />{search}<span aria-hidden="true"> ×</span>
          </button>
        )}
        {!modeSurBandeau && (
          <button type="button" className={`cuisine-chip${emporter ? ' active' : ''}`} aria-pressed={emporter} onClick={() => setEmporter((v) => !v)}>
            <Icone nom="sac" taille={16} />{t('restaurantList.filterPickup')}
          </button>
        )}
        {!colonne && TRI_ET_PRIX && <>
        <button type="button" className={`cuisine-chip${prix ? ' active' : ''}`} aria-expanded={panneau === 'prix'} onClick={() => setPanneau((x) => (x === 'prix' ? null : 'prix'))}>
          <Icone nom="euro" taille={16} />{prix ? '€'.repeat(prix) : t('mapClient.filterPrice')}
        </button>
        <button type="button" className={`cuisine-chip${tri !== 'recommande' ? ' active' : ''}`} aria-expanded={panneau === 'tri'} onClick={() => setPanneau((x) => (x === 'tri' ? null : 'tri'))}>
          <Icone nom="stats" taille={16} />{tri === 'recommande' ? t('mapClient.sort') : (tri === 'note' ? t('mapClient.sortRating') : t('mapClient.sortDistance'))}
        </button>
        </>}
      </div>}
      {!colonne && panneau === 'prix' && (
        <div className="carte-panneau liste-panneau">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" className={`cuisine-chip${prix === n ? ' active' : ''}`} onClick={() => { setPrix(n); setPanneau(null); }}>
              {n === 0 ? t('mapClient.filterAllPrices') : '€'.repeat(n)}
            </button>
          ))}
        </div>
      )}
      {!colonne && panneau === 'tri' && (
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
        <div className={`rest-grid${grand ? ' sl-grille' : ''}`}>
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={toggleFavorite} t={t} />
          ))}
        </div>
      )}
      {!loading && !hasActiveFilter && localTexte && !colonne && (
        <div className="local-bandeau" role="status">
          <Icone nom="position" taille={16} />
          <span>{localTexte}</span>
        </div>
      )}
      {!loading && !hasActiveFilter && (
        <>
          {aLaUne.length > 0 && <ALaUne list={aLaUne} inscritLe={inscritLe} t={t} />}
          {inscrits.length > 0 && (
            <div className="liste-section">
              <h3 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom="commerce" taille={18} /><span><AvecMarque>{t('restaurantList.sectionRegistered')}</AvecMarque></span></h3>
              <div className={grand ? 'rest-grid sl-grille' : 'rest-grid rest-grid-scroll'}>
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
          <Section title={t('restaurantList.sectionNearby')} icon="position" list={nearbyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="nearby" />
          <Section title={t('restaurantList.sectionCravings')} icon="favoris" list={enviesList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} />
          <Section title={t('restaurantList.sectionFreeDelivery')} icon="velo" list={livraisonOfferteEpinglee} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="free_delivery" />
          <Section title={t('restaurantList.sectionDeliveryFrom', { amount: eurosCourts(3) })} icon="velo" list={livraisonPasCherEpinglee} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="cheap_delivery" />
          <Section title={t('restaurantList.sectionOffers')} icon="etiquette" list={offersList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="offers" />
          {rangeesCuisine.map((s) => (
            <Section key={s.key} title={titreRangee(t, s)} icon="restaurants" list={s.liste} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle={s.key} />
          ))}
          <Section title={t('restaurantList.sectionHealthy')} icon="restaurants" list={healthyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="healthy" />
          <Section title={t('restaurantList.sectionBio')} icon="favoris" list={bioList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="bio" />
          <Section title={t('restaurantList.sectionVegan')} icon="favoris" list={veganList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="vegan" />
          <Section title={t('restaurantList.sectionGrocery')} icon="commerce" list={groceryList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="grocery" />
          <Section title={t('restaurantList.sectionDiscover')} icon="etoile" list={epinglerOuMelanger(discoverList, placements, 'discover', nonGrocery)} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop autoplay grille={grand} cle="discover" />
          {restaurants.length > 0 && nearbyList.length === 0 && offersList.length === 0 && healthyList.length === 0 && bioList.length === 0 && veganList.length === 0 && discoverList.length === 0 && groceryList.length === 0 && (
            <EtatVide icone="restaurants" titre={t('restaurantList.empty')} />
          )}
        </>
      )}
      {/* Filtres trop serrés : « Aucun restaurant pour le moment » laissait croire qu'il n'y en avait aucun, sans moyen d'en
          sortir (audit du 15/10/2026). On dit que c'est le filtre, et on l'efface en un geste. */}
      {!loading && hasActiveFilter && list.length === 0 && (
        <EtatVide icone="recherche" titre={t('restaurantList.emptyFiltered')}>
          <button type="button" className="btn-teal" onClick={() => { setSearch(''); setCuisine(''); setCommune(''); setBio(false); setVegan(false); setHalal(false); setSansGluten(false); setPrix(0); setEmporter(false); setTri('recommande'); }}>
            {t('restaurantList.clearFilters')}
          </button>
        </EtatVide>
      )}
      {!loading && echecListe && restaurants.length === 0 && <ErreurChargement onReessayer={() => chargerListe()} />}
      {!loading && !echecListe && restaurants.length === 0 && (
        <EtatVide icone="restaurants" titre={t('restaurantList.empty')} />
      )}
      </div>
      </div>
    </div>
  );
}
