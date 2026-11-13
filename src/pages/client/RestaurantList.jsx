import { createContext, Fragment, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { imgProps, cacherImageCassee, photoVue, retenirPhotoVue } from '../../images';
import { CHEMIN_COMMANDES_RECENTES, chargerAvecCache, lireCache, poserFavoriEnCache, prechargerFiche } from '../../cacheDonnees';
import { useActionOptimiste } from '../../actionOptimiste';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SqueletteAccueil } from '../../components/Skeleton';
import TirerPourActualiser from '../../components/TirerPourActualiser';
import { MENTIONS_ALIMENTAIRES, nbPlatsBio, nbPlatsVegan, restoBio, restoVegan, restoHalal, restoSansGluten } from '../../dietary';
import { CHEMIN_LISTE, jetonListe, nbPlatsHealthy, promoDUnPlat } from '../../resumeCarte';
// Chargée à la demande : la carte tire Leaflet (~150 Ko) avec elle, et cette page fait partie des
// rares gardées en import statique pour le référencement. Sans ce découpage, tout visiteur d'une fiche
// de commerce téléchargeait Leaflet avant de voir la moindre ligne de texte — alors que la vue carte
// est un affichage secondaire, choisi par l'utilisateur.
import Icone from '../../components/Icone';
import { experienceApp } from '../../natif';
import { estApercu, signalerAuSite } from '../../apercuSite';

// Le faux téléphone de l'accueil du site (apercuSite.js) : les cartes y sont toutes pareilles (RestaurantCard, ALaUne).
const APERCU = estApercu();
import ChoixAdresse from '../../components/ChoixAdresse';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import PrixComptoir from '../../components/PrixComptoir';
import AutoScrollRow from '../../components/AutoScrollRow';
import { epingler, titreRangee } from '../../misesEnAvant';
import { COMMUNES, communeRingDistance, haversineDistanceKm, restaurantTypeLabel, communeDepuisCodePostal, illustrationCuisine } from '../../menuCategories';
import { categoriesClient, libelleCategorie, specialite } from '../../specialites';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { statutOuverture } from '../../openingHours';
import { useCart } from '../../context/CartContext';
import { poserCommercePanier, retirerCommercePanier } from '../../fermeCourt';
import { tarifLivraison, eurosCourts, horsZoneLivraison } from '../../livraison';
import { aDeuxPas, fourchette, minutesLivraison, pointDuClient, prepAnnoncee } from '../../delaiEstime';
import { euros, kmLisible, libellePromo, prixRemise, remiseCourte } from '../../prixPlat';
import EmplacementSponsor from '../../components/EmplacementSponsor';
import VisuelVide from '../../components/VisuelVide';
import usePageMeta from '../../hooks/usePageMeta';
import useJsonLd from '../../seo/useJsonLd';
import { restaurantListJsonLd, breadcrumbJsonLd, SITE_URL } from '../../seo/jsonLd';
import { livraisonOuverte, useLancement, chargerLancement, livreurFairideLibre, commandesOuvertes } from '../../launch';
import { livraisonPossibleIci, emporterPossibleIci, ouvertPourCommander, livreChezToi, filtreLivraisonPossible, premierARouvrir } from '../../peutCommander';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import TeteListe from '../../components/TeteListe';
import { ecrireEtatEcran } from '../../etatEcran';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import '../../ecran-liste.css';
import '../../site-liste.css';
import { lienFiche } from '../../murCompte';
import { vibrer } from '../../gestes';
import { normaliserRecherche } from '../../normaliserRecherche';
import RangeeDemandes from '../../components/demandes/RangeeDemandes';
import { FinDeListeDemande, LienIlEnManque, RappelDemande, TuileIlEnManque } from '../../components/demandes/CartesDemander';
import useDemandesPres from '../../components/demandes/useDemandesPres';
import useFenetreDemande from '../../components/demandes/useFenetreDemande';
import { creerRangement, rangeesEnvies, PAR_RANGEE_ENVIE } from '../../accueilRangees';
import { filtresEnvoyes } from '../../filtresEnvoyes';
import usePositionLancement, { aPorteeDUnCommerce } from '../../hooks/usePositionLancement';
import BulleAdresseLoin from '../../components/client/BulleAdresseLoin';
import { adresseEnCours, nomAdresse } from '../../nomAdresse';

// Une liste lue en cache, ou [] : une réponse d'une autre forme (objet, ancienne version) ne fait plus planter la liste.
const listeEnCache = (chemin) => { const l = lireCache(chemin); return Array.isArray(l) ? l : []; };

// « TRIER » RETIRÉ POUR LE MOMENT (fondateur, 2026-10-20, après le test avec Maestro Pizza) : avec une poignée de commerces,
// trier ne sert à rien et charge la bande. L'état et les règles restent (le tri « Recommandé » est celui que décrit
// /classement) : repasser à true ici et dans pages/client/MapPage.jsx.
// LE PRIX, LUI, EST RETIRÉ POUR DE BON (fondateur, 2026-10-21 : « retirer ça totalement partout ») : plus de « €€ » sur
// les cartes des commerces, plus de filtre par prix, ni ici ni sur la page Carte. Les bandes étaient calculées sur le prix
// médian de la carte ; rien n'est stocké, il n'y a rien à effacer côté serveur.
const TRI = false;

// « À EMPORTER » RETIRÉ POUR LE MOMENT (fondateur, 2026-10-21).
// La pastille au-dessus de la liste et Livraison / À emporter sur le bandeau (site, 900 px)
// disparaissent ; l'état `emporter` reste à false. Repasser à true pour les remettre.
const FILTRE_EMPORTER = false;

/* « OUVERT » ET « LIVRE CHEZ TOI » (fondateur, 2026-10-26, version A de maquettes/filtre-ouvert/filtre-ouvert.html) : deux
 * pastilles au-dessus de la liste, comme « Ouvert » sur l'onglet Carte, chacune s'allume seule ; ce qu'elles écartent est
 * caché, et une liste vide dit pourquoi. Règles : peutCommander.js. ÉTEINTES À CHAQUE OUVERTURE (réponse 5) : gardées en
 * mémoire tant que l'app (ou l'onglet du navigateur) reste ouverte, pour qu'aller voir un commerce et revenir ne les
 * éteigne pas, mais rien n'est écrit sur le téléphone — rouverte le lendemain à 23:30, l'app ne montre pas une liste vide
 * sans dire pourquoi. */
const disponibilite = { ouvert: false, livre: false };

// « LIVRE CHEZ TOI » MASQUÉ POUR LE MOMENT (fondateur, 2026-10-26 : pas encore de livreurs, on ouvre avec l'à emporter ;
// la pastille sortira dans une mise à jour de l'app quand la livraison démarre). Tout est prêt (peutCommander.js, écran
// vide « Rien ne livre chez toi maintenant ») : repasser à true ici. « Ouvert » reste.
const FILTRE_LIVRE = false;

// Types "courses alimentaires" plutôt que "repas à commander" — regroupés dans leur propre section
// (Supermarchés) au lieu d'être mélangés avec les restos dans Autour de vous / Offres / À découvrir.
// Les commerces de la rangée « Courses » : la famille Courses & Épicerie (supermarché, night shop, boucherie, primeur…) et
// les boulangeries, d'après leur type principal — comme la liste fixe d'avant (Supermarché, Night Shop, Boulangerie, Boucherie).
const estCourses = (r) => specialite(r.cuisine)?.familles[0] === 'courses' || ['Boulangerie', 'Boulangerie du monde'].includes(specialite(r.cuisine)?.value);
// Taille minimale d'une rangée thématique avant complément (voir completer()).
const MIN_PAR_RANGEE = 6;
// « Tous les commerces » : le rappel des demandés se glisse après ce nombre de cartes (accueil plein, 2026-11-12).
const RAPPEL_APRES = 10;
// Sur le site en grille, une rangée ne montre que sa première ligne (.sl-une-ligne) : au plus 6 cartes, la ligne la plus large.
const GRILLE_MAX = 6;

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
  return libellePromo(promoDUnPlat(r), t, { court: true });
}

// Livraison et à emporter réellement possibles ici et maintenant : livraisonPossibleIci et emporterPossibleIci
// (peutCommander.js, partagés avec l'onglet Carte depuis le 2026-10-26).

// Le restaurant peut prendre à sa charge tout ou partie des frais de livraison (voir "🏷️ Frais de
// livraison" dans son dashboard) — affiché comme un pill à côté de la commune, pas confondu avec le
// badge promo (🏷️ en haut de la photo) qui porte sur le contenu du panier, pas la livraison.
// Le prix de la livraison sur la carte du commerce (livraison.js) : offerte, offerte dès X €, ou « dès X € » quand il
// est plus bas que le forfait (le commerce en offre une part, ou livre lui-même à ses frais).
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
// photo, puis le nom, « cuisine · commune », et une ligne d'infos (note ou « Nouveau », services, offre de
// livraison). Avant : quatre pastilles empilées (commune, quartier, fermé…) et un grand blanc sous le texte.
// `apercu` : la GRANDE CARTE des rangées « Offres » et « Courses » quand le commerce y est seul (voir RangeeApercu) — toute la
// largeur, et quatre de ses plats ou produits sous le nom.
// La commune d'où la liste compte (homeCommune de RestaurantList) : le temps d'une carte part de son centre quand le
// compte n'a pas d'adresse localisée (delaiEstime.js). Un contexte plutôt qu'une prop : sept endroits dessinent une carte.
const CommuneListe = createContext(null);
function RestaurantCard({ r, isFavorite, onToggleFavorite, t, apercu = null }) {
  const { user, token } = useAuth();
  const communeListe = useContext(CommuneListe);
  // L'APERÇU DE L'ACCUEIL DU SITE (apercuSite.js ; Owen, 2026-11-12, remarque 8 de maquettes/site-appli-essai) : toutes les
  // cartes pareilles — ni offre, ni « Fermé », ni délai, ni services, ni « Carte seule », ni photo grisée. Restent le badge
  // « Prix du comptoir » et « Sponsorisé » (une position payée est toujours dite, CDE VI.99). L'ORDRE, lui, ne change pas.
  const offerLabel = APERCU ? null : offerLabelFor(r, t);
  const deliveryOfferLabel = APERCU ? null : deliveryOfferLabelFor(r, t, user);
  // Pause, « fermé pour aujourd'hui » et interrupteur du commerce comptent, comme sur sa fiche (audit du 19/10, discovery-04).
  const etat = statutOuverture(r, new Date());
  const isClosed = !APERCU && !etat.isOpen;
  const etatTexte = !isClosed ? null
    : etat.opensToday && etat.opensAt
      ? t('restoListUi.closedOpensAt', { time: etat.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
      : t('restoListUi.closed');
  // Avant le GO, l'à emporter payé en ligne seulement n'est pas encore commandable : « Commande en ligne bientôt » plutôt
  // que « À emporter », découvert seulement au paiement (audit du 18/10/2026).
  const emporterPossible = emporterPossibleIci(r, user);
  const livraisonOuverteIci = r.offersDelivery && livraisonOuverte(user);
  const livraisonPossible = livraisonPossibleIci(r, user);
  // Hors zone : dit sur la carte, avant de composer un panier (audit du 19/10, discovery-03) ; l'à emporter reste dit à côté.
  const horsZone = livraisonOuverteIci && horsZoneLivraison(r, user);
  /* LE TEMPS D'ATTENTE SUR LA PHOTO (fondateur, 2026-10-29, maquettes/delai-estime, version L1) : « 20–30 min », comme les
   * grandes applications, à la place de « Fermé · ouvre à… », qu'il ne remplace jamais (un commerce fermé dit quand il
   * rouvre). Livraison possible ici : la fourchette jusqu'à chez toi. Sinon (avant le GO, aucun livreur libre, hors zone) :
   * le temps de l'à emporter, s'il est commandable. Ni l'un ni l'autre : rien, plutôt qu'un temps qu'on ne tiendrait pas. */
  const minutes = livraisonPossible ? minutesLivraison(r, pointDuClient(user, communeListe)) : null;
  const delaiTexte = APERCU || isClosed || r.vitrine ? null
    : minutes != null ? t('restoListUi.etaRange', fourchette(minutes))
      : emporterPossible ? t('restoListUi.etaPickup', { min: prepAnnoncee(r) }) : null;
  /* LIVRAISON OU À EMPORTER, CÔTE À CÔTE (fondateur, 2026-10-31) : quand la pastille dit le temps de livraison et que le
   * commerce est à deux pas (delaiEstime.aDeuxPas), « À emporter » dit aussi quand ce serait prêt. Sur la ligne des services
   * et non dans la pastille de la photo : une pastille « 25–35 min · ou prête en 15 min » était coupée sur les petites cartes. */
  const emporterTexte = minutes != null && aDeuxPas(r, user)
    ? t('restoListUi.servicePickupReady', { min: prepAnnoncee(r) }) : t('restoListUi.servicePickup');
  const services = APERCU ? [] : [emporterPossible && emporterTexte, livraisonPossible && t('restoListUi.serviceDelivery'), horsZone && t('restoListUi.outOfZone'), !emporterPossible && !livraisonOuverteIci && (r.offersPickup || r.offersDelivery) && t('restoListUi.serviceSoon'), r.fairideDeliveryDisabled && emporterPossible && t('restoListUi.pickupOnlyZone')].filter(Boolean);
  // VISITEUR NON CONNECTÉ : la liste se parcourt librement (on y arrive depuis la barre d'adresse de
  // l'accueil), mais ouvrir un commerce demande un compte (fondateur, 2026-09-27). Le lien part vers
  // la connexion avec la fiche en `from`, et Auth.jsx y ramène une fois connecté ou inscrit.
  // La ROUTE /restaurants/:id, elle, reste publique (App.jsx) : un lien partagé, un moteur de
  // recherche ou la page prérendue y mènent toujours directement. Seul ce clic-ci est filtré.
  return (
    <Link
      {...lienFiche(user, r, r.name)}
      className={`rest-card rc${isClosed ? ' rc-est-ferme' : ''}${apercu ? ' rc-grande' : ''}`}
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
        {offerLabel && <span className="rc-offre rc-promo"><Icone nom="etiquette" taille={13} className="icone-texte" />{' '}{offerLabel}</span>}
        {etatTexte && <span className="rc-etat">{etatTexte}</span>}
        {delaiTexte && <span className="rc-etat">{delaiTexte}</span>}
      </div>
      <div className="rc-corps">
        <h3 className="rest-card-name rc-nom">
          <span className="rest-card-name-text">{r.name}</span>
          {r.certified && <CertifiedBadge />}
        </h3>
        {/* Type principal + le premier type secondaire (7 spécialités possibles, voir EcranTypeCommerce) : deux, pour rester lisible. */}
        <p className="rc-sous">{[[r.cuisine, ...(r.extraCuisines || [])].filter(Boolean).slice(0, 2).map((c) => restaurantTypeLabel(c, t) || c).join(', '), r.neighborhood || r.commune, r.distanceKm != null && kmLisible(r.distanceKm)].filter(Boolean).join(' · ')}</p>
        <p className="rc-infos">
          {/* Plus de note ni de « Nouveau » (qui voulait dire « pas encore d'avis ») depuis le retrait des avis clients
              (fondateur, 22/10/2026 : pas assez d'utilisateurs, des commerces avec peu d'étoiles feraient mauvaise impression ;
              on les refera peut-être plus tard). */}
          {/* Position payée par le commerce : toujours dite au client (classement payant, CDE VI.99). */}
          {r.sponsorise && <span className="rc-sponsorise" title={t('restoListUi.sponsoredTitle')}>{t('restoListUi.sponsored')}</span>}
          {services.map((s) => <span key={s} className="rc-discret">{s}</span>)}
        </p>
        {/* Le badge « Prix du comptoir » sur la seconde ligne : sur la première (note, services), il était coupé dans l'app. */}
        {(deliveryOfferLabel || (r.vitrine && !APERCU) || r.prixComptoir) && (
          <p className="rc-infos">
            {r.prixComptoir && <PrixComptoir />}
            {deliveryOfferLabel && <span className="rc-livraison">{deliveryOfferLabel}</span>}
            {/* COMMERCE VITRINE : carte listée, commande impossible — dit ICI, avant de composer un panier. */}
            {r.vitrine && !APERCU && <span className="rc-vitrine">{t('restoListUi.showcaseOnly')}</span>}
          </p>
        )}
        {apercu && (
          <span className="rc-apercu">
            {apercu.map((p) => {
              const remise = prixRemise(p);
              return (
                <span key={p.id} className="rc-apercu-plat">
                  <img loading="lazy" decoding="async" {...imgProps(p.imageUrl, 90)} alt="" onError={cacherImageCassee} />
                  <span className="sr-only">{p.name}</span>
                  <span className={`rc-apercu-prix${remise != null ? ' est-remise' : ''}`}>{euros(remise ?? p.price)}</span>
                  {/* Le prix d'avant d'une réduction, toujours dit (art. VI.18 CDE ; comparaison, 2026-11-05). */}
                  {remise != null && remise < p.price && <small className="rc-apercu-avant">{t('menuCategories.priceBefore', { price: euros(p.price) })}</small>}
                </span>
              );
            })}
          </span>
        )}
      </div>
    </Link>
  );
}

/* LES PLATS D'UN COMMERCE EN TUILES (rangées « Offres » et « Courses » à partir de deux commerces, voir RangeeApercu) : la
 * photo du plat, l'offre en rouge sur la photo, le prix remisé en rouge avec « avant … » (jamais barré, design.md), et le
 * commerce dessous. Un appui ouvre la fiche du commerce, comme sa carte. */
function TuileApercu({ r, p, t }) {
  const { user, token } = useAuth();
  const remise = prixRemise(p);
  const ferme = !APERCU && !estOuvert(r);
  return (
    <Link {...lienFiche(user, r, r.name)} className={`tuile-apercu${ferme ? ' tuile-apercu--fermee' : ''}`} onPointerDown={user ? () => prechargerFiche(r.id, token) : undefined}>
      <span className="ta-media">
        <img loading="lazy" decoding="async" {...imgProps(p.imageUrl, 160)} alt="" onError={cacherImageCassee} />
        {p.activePromo && <span className="rc-offre rc-promo"><Icone nom="etiquette" taille={12} className="icone-texte" />{' '}{remiseCourte(p.activePromo, t)}</span>}
      </span>
      <span className="ta-nom">{p.name}</span>
      <span className="ta-prix">
        <span className={remise != null ? 'est-remise' : undefined}>{euros(remise ?? p.price)}</span>
        {remise != null && <small>{t('menuCategories.priceBefore', { price: euros(p.price) })}</small>}
      </span>
      <span className="ta-chez">
        {r.name}
        {/* Position payée : toujours dite au client (CDE VI.99), comme sur la carte du commerce. */}
        {r.sponsorise && <> · <span className="rc-sponsorise" title={t('restoListUi.sponsoredTitle')}>{t('restoListUi.sponsored')}</span></>}
      </span>
    </Link>
  );
}

/* À LA UNE PRÈS DE TOI (fondateur, 2026-10-17, haut de la version B de « Liste » dans maquettes/commerces-marque/commerces-marque.html ; les
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
      {/* h2 et non plus h3 (audit du 24/10, Lighthouse « heading-order ») : sous le h1 de la page, le titre d'une rangée sautait un niveau, et les noms des commerces (h3) étaient au même rang que leur rangée. Même classe et même style en ligne : rien ne bouge à l'écran. */}
      <h2 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom="eclair" taille={18} />{t('restaurantList.sectionFeatured')}</h2>
      <div className="une-rail" ref={rail} onScroll={surDefilement}>
        {list.map((r) => {
          // Même état que la fiche : pause et « fermé pour aujourd'hui » compris (audit du 19/10, discovery-04).
          // Aperçu de l'accueil du site : ni « Fermé » ni « Nouveau sur Fairride », comme les autres cartes (apercuSite.js).
          const ferme = !APERCU && !statutOuverture(r, new Date()).isOpen;
          const depuis = inscritLe.get(r.id);
          const nouveau = !APERCU && depuis != null && maintenant - depuis < NOUVEAU_JOURS * 86400000;
          const sous = [[r.cuisine, ...(r.extraCuisines || [])].filter(Boolean).slice(0, 1).map((c) => restaurantTypeLabel(c, t) || c).join(''), r.neighborhood || r.commune,
            r.distanceKm != null && kmLisible(r.distanceKm)].filter(Boolean).join(' · ');
          return (
            // Même règle que les cartes dessous : sans compte, le clic mène à la connexion, puis à la fiche.
            <Link key={r.id} {...lienFiche(user, r, r.name)} className={`une-carte${ferme ? ' une-carte--fermee' : ''}`} onPointerDown={user ? () => prechargerFiche(r.id, token) : undefined}>
              <VisuelVide nom={r.name} cuisine={r.cuisine} />
              {/* Sans photo, le visuel de marque seul, comme les autres cartes : la boutique de test (seul commerce sans photo
                  admis ici) montrait l'icône d'image cassée en tête d'« À la une » (2026-10-26). */}
              {r.coverImageUrl && <img {...imgProps(r.coverImageUrl, 800, '(max-width: 640px) 92vw, 380px')} alt="" className="une-photo" decoding="async" onError={cacherImageCassee} />}
              <span className="une-voile" aria-hidden="true" />
              {nouveau && <span className="une-surtitre"><Icone nom="eclair" taille={13} />{t('restaurantList.newOnFairide')}</span>}
              {ferme && <span className="une-etat">{t('restoListUi.closed')}</span>}
              <span className="une-texte">
                <span className="une-nom">{r.name}{r.certified && <CertifiedBadge size={18} />}</span>
                <span className="une-infos">
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

/* LES OUVERTS D'ABORD, PARTOUT (fondateur, 2026-10-25 : « les commerces fermés sont en noir et blanc et les seuls ouverts
 * sont tout en bas »). Dans chaque rangée, dans « Déjà sur Fairide » et dans la liste filtrée : les commerces ouverts
 * maintenant passent devant les fermés, chaque groupe gardant l'ordre propre à la rangée (distance, commune, rang de
 * l'équipe…). Même état que la carte grisée : pause et « fermé pour aujourd'hui » compris. Seule exception : une carte
 * « Sponsorisé » garde la position payée, ouverte ou non ; les autres se rangent autour. /classement le dit. */
const estOuvert = (r) => statutOuverture(r, new Date()).isOpen;
function ouvertsDabord(liste) {
  const libres = liste.filter((r) => !r.sponsorise);
  const ranges = [...libres.filter(estOuvert), ...libres.filter((r) => !estOuvert(r))];
  return liste.map((r) => (r.sponsorise ? r : ranges.shift()));
}

// `cle` : la clé de la rangée (mises en avant / sponsors) — le logo partenaire de la rangée se glisse à côté du titre
// (EmplacementSponsor : rien pour le public tant que l'admin n'a pas activé la rangée).
// `grille` (site, à partir de 900 px) : une grille qui suit la largeur, au lieu d'une rangée qui défile de côté — à la
// souris, une rangée qui défile se manie mal, et un écran large montre trois ou quatre commerces de front sans rien cacher
// (maquettes/site-ordinateur/site-ordinateur.html, section « Liste »). Mêmes commerces, même ordre ; seule la disposition change.
// Chaque rangée passe ici : les ouverts d'abord (ouvertsDabord) s'appliquent à toutes.
// LES RANGÉES PAR ENVIE (accueil plein, fondateur 2026-11-12 ; accueilRangees.js) passent aussi par ici, avec :
//   - `dessin` : le dessin 3D de la catégorie à la place de l'icône (comme sa puce dans la bande) ;
//   - `surTitre` : le titre se touche (« Pizza → », réponse 6 : la flèche, sans nombre) et ouvre la catégorie, comme sa puce ;
//     pas de tuile « Voir les 11 » au bout, elle aurait fait la même chose en prenant la place d'une carte ;
//   - `fin` : la tuile « Il en manque un ? » au bout de la rangée qui défile ; sur le site en grille, `finGrille` (un lien à
//     droite du titre). Sur le site, toute rangée tient sur UNE ligne (.sl-une-ligne, ecran-demandes.css : 11 pizzerias en
//     grille faisaient un mur) ; au plus GRILLE_MAX cartes, ce qu'une ligne peut montrer de plus large.
// Ces rangées ne tournent pas en boucle : la tuile de fin doit rester la fin.
function Section({ title, icon, dessin = null, list: rangee, favoriteIds, onToggleFavorite, t, loop, autoplay = false, cle, grille = false,
  surTitre = null, fin = null, finGrille = null }) {
  if (rangee.length === 0) return null;
  const list = ouvertsDabord(rangee);
  const tete = dessin
    ? <img className="section-dessin" src={dessin} alt="" width="30" height="30" decoding="async" draggable="false" />
    : <Icone nom={icon} taille={18} />;
  const sponsor = cle && <EmplacementSponsor cle={cle} />;
  const titre = surTitre ? (
    <h2 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}>
      <button type="button" className="section-titre-bouton" onClick={surTitre} aria-label={t('restaurantList.voirTout', { nom: title })}>
        {tete}<span>{title}</span>
        <span className="section-vers" aria-hidden="true"><Icone nom="fleche" taille={16} /></span>
      </button>
      {sponsor}{grille && finGrille}
    </h2>
  ) : <h2 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}>{tete}{title}{sponsor}</h2>;
  if (grille) {
    return (
      <section className="liste-section">
        {titre}
        <div className="rest-grid sl-grille sl-une-ligne">
          {list.slice(0, GRILLE_MAX).map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
          ))}
        </div>
      </section>
    );
  }
  if (fin) {
    return (
      <div className="liste-section">
        {titre}
        <div className="rest-grid rest-grid-scroll">
          {list.map((r) => (
            <RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />
          ))}
          {fin}
        </div>
      </div>
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

/* « OFFRES » ET « COURSES » NE SONT PLUS DES RANGÉES VIDES (fondateur, 2026-10-26, maquettes/sections-pleines : B, C et la
 * réponse 5). Avec un seul commerce, une carte de 163 px laissait la moitié de l'écran blanche. La rangée ne se complète
 * toujours pas avec des commerces qui n'y répondent pas (/classement) : elle montre ce que ses commerces vendent, d'après
 * `resumeCarte.apercu` (backend : 4 plats avec photo et prix, ceux en promo d'abord, une catégorie après l'autre).
 *   - un seul commerce : sa carte en grand (toute la largeur), quatre de ses plats ou produits dessous ;
 *   - deux ou plus : jusqu'à APERCU_PAR_COMMERCE tuiles par commerce, un commerce après l'autre, les ouverts d'abord
 *     (ouvertsDabord) ; un commerce sans aperçu y garde sa carte habituelle, à son tour.
 * Sans aucun aperçu (vieille liste gardée par l'app, commerce sans photo de plat) : la rangée d'avant (Section). */
const APERCU_PAR_COMMERCE = 3;
const apercuDe = (r) => (Array.isArray(r.resumeCarte?.apercu) ? r.resumeCarte.apercu : []);
function RangeeApercu({ title, icon, list: rangee, favoriteIds, onToggleFavorite, t, cle, grille = false }) {
  if (rangee.length === 0) return null;
  const list = ouvertsDabord(rangee);
  if (!list.some((r) => apercuDe(r).length > 0)) {
    return <Section title={title} icon={icon} list={rangee} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} t={t} loop grille={grille} cle={cle} />;
  }
  const titre = <h2 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom={icon} taille={18} />{title}{cle && <EmplacementSponsor cle={cle} />}</h2>;
  if (list.length === 1) {
    const r = list[0];
    return (
      <section className="liste-section">
        {titre}
        <RestaurantCard r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} apercu={apercuDe(r).slice(0, 4)} />
      </section>
    );
  }
  // Un tour par commerce : le 1er plat de chacun, puis le 2e…
  const tuiles = [];
  for (let tour = 0; tour < APERCU_PAR_COMMERCE; tour++) {
    for (const r of list) {
      const plats = apercuDe(r);
      if (plats.length === 0) { if (tour === 0) tuiles.push(<RestaurantCard key={r.id} r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={onToggleFavorite} t={t} />); continue; }
      if (plats[tour]) tuiles.push(<TuileApercu key={`${r.id}-${plats[tour].id}`} r={r} p={plats[tour]} t={t} />);
    }
  }
  return (
    <section className="liste-section">
      {titre}
      <div className={grille ? 'rangee-apercu rangee-apercu--grille' : 'rangee-apercu'}>{tuiles}</div>
    </section>
  );
}

export default function RestaurantList() {
  const { token, user, refreshUser } = useAuth();
  // BOUTON GO (audit du 19/10, discovery-01) : la liste suit l'état du serveur comme la fiche (src/launch.js). Sans cet
  // abonnement, un téléphone neuf après GO voyait « Commande en ligne bientôt » jusqu'à ouvrir une fiche, et un téléphone
  // resté sur « GO » promettait la livraison après la fermeture.
  useLancement();
  // Carnet d'adresses, ouvert depuis la rangee « Livrer a » en tete de page.
  // 'ici' : ouvert par la bulle « Livrer à ma position », directement sur la position (ChoixAdresse, depuisPosition).
  const [choixAdresse, setChoixAdresse] = useState(false);
  // LA POSITION À CHAQUE OUVERTURE (2026-11-08, usePositionLancement.js) : l'adresse du carnet où l'on est, la bulle « Tu es
  // à 4,2 km de … », et, sans compte, le tri du plus proche.
  // Pas dans l'aperçu de l'accueil du site : le visiteur n'a rien demandé (usePositionLancement.js).
  const lancement = usePositionLancement({ user, token, refreshUser, actif: !APERCU });
  // D'où se mesurent les distances : l'adresse du compte, sinon (sans compte) la position du téléphone.
  const reperePos = user?.lat && user?.lng ? { lat: user.lat, lng: user.lng } : (!user && lancement.position ? lancement.position : null);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  usePageMeta({ title: t('restoListUi.pageTitle'), description: t('seo.listDescription'), path: '/restaurants' });
  useJsonLd(breadcrumbJsonLd([
    { name: 'Fairride', path: '/' },
    { name: t('restoListUi.heading'), path: '/restaurants' }
  ]), 'ld-breadcrumb');
  // La page Recherche envoie ici ses résultats « cuisine » et « commune » par l'état de navigation :
  // la liste s'ouvre déjà filtrée, sans que l'URL ne change de forme.
  const filtresInitiaux = location.state || {};
  /* LES FILTRES DE CETTE LISTE, RETROUVÉS AU RETOUR (2026-10-26, etatEcran.js). Ils sont écrits dans l'entrée d'historique
     de la liste à chaque changement ; revenir d'une fiche les relit ici, avant ce qu'avait envoyé la Recherche. */
  const sauves = filtresInitiaux.filtresListe || null;
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
  const [restaurants, setRestaurants] = useState(() => lireCache(CHEMIN_LISTE, jetonListe(user, token)) || []);
  /* Apres la declaration de `restaurants`, jamais avant : lu plus haut, le tableau serait dans
     sa zone morte temporelle et la page planterait au montage. */
  // Mémorisé sur la liste : refait quand la liste change, pas à chaque rendu (useJsonLd.js).
  const ldListe = useMemo(() => restaurantListJsonLd(restaurants, { url: `${SITE_URL}/restaurants` }), [restaurants]);
  useJsonLd(ldListe, 'ld-list');
  // La barre du panier dit « Fermé · ouvre à… » quand le commerce du panier est fermé (fermeCourt.js) : il est dans la liste.
  const panierRestaurantId = useCart().restaurantId;
  const commercePanier = panierRestaurantId == null ? null : restaurants.find((r) => String(r.id) === String(panierRestaurantId)) || null;
  useEffect(() => {
    if (!commercePanier) return undefined;
    poserCommercePanier(commercePanier);
    return () => retirerCommercePanier(commercePanier);
  }, [commercePanier]);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(token ? lireCache('/restaurants/favorites/ids', token) || [] : []));
  const [loading, setLoading] = useState(() => !lireCache(CHEMIN_LISTE, jetonListe(user, token)));
  // La liste n'a pas pu être lue (réseau, serveur) : « Impossible de charger » et Réessayer, pas « Aucun commerce ».
  const [echecListe, setEchecListe] = useState(false);
  // `silencieux` : tirer pour actualiser ne remet pas les cartes grises ; « Réessayer », si. `forcer` : relire même une
  // liste lue à l'instant (cacheDonnees.js). Une réponse identique rend le même tableau : React ne redessine rien.
  const chargerListe = useCallback(({ silencieux = false, forcer = false } = {}) => {
    setEchecListe(false); if (!silencieux) setLoading(true);
    // Rend true / false : tirer pour actualiser le dit quand la lecture échoue alors que des cartes sont déjà là (discovery-32).
    return chargerAvecCache(CHEMIN_LISTE, { forcer, token: jetonListe(user, token) }).then((l) => { setRestaurants(l); setEchecListe(false); return true; }).catch(() => { setEchecListe(true); return false; }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isTest, token]);
  const envoyesAuMontage = filtresEnvoyes(filtresInitiaux);
  const [search, setSearch] = useState(sauves ? sauves.search : envoyesAuMontage.search);
  const [commune, setCommune] = useState(sauves ? sauves.commune : envoyesAuMontage.commune);
  // LA CATÉGORIE CHOISIE (fondateur, 2026-10-27, categoriesClient dans specialites.js) : une seule bande, plus de rangée de
  // spécialités dessous. La Recherche envoie la catégorie (« Par envie », ou celle d'une spécialité tapée).
  const [categorie, setCategorie] = useState(sauves ? sauves.categorie || '' : envoyesAuMontage.categorie);
  /* CHANGER DE CUISINE NE FAIT PLUS « SAUTER » LA LISTE (fondateur, 2026-10-23 : « comme la barre d'onglets, beaucoup plus
     calme »). Les cartes jouent leur entrée (popIn, styles.css) à la première apparition de la liste ; un changement de
     catégorie les remplace sans la rejouer — comme un onglet, qui change d'écran sans animation
     (sl-liste--calme, ecran-liste.css). */
  const [listeCalme, setListeCalme] = useState(false);
  const filtresDeDepart = useRef(categorie);
  useEffect(() => {
    if (categorie !== filtresDeDepart.current) setListeCalme(true);
  }, [categorie]);
  // Masqués pour le moment (MENTIONS_ALIMENTAIRES) : jamais allumés à l'ouverture, sinon la liste serait filtrée sans
  // aucune pastille pour retirer le filtre.
  const [bio, setBio] = useState(MENTIONS_ALIMENTAIRES && !!(sauves || filtresInitiaux).bio);
  const [vegan, setVegan] = useState(MENTIONS_ALIMENTAIRES && !!(sauves || filtresInitiaux).vegan);
  // Halal et sans gluten (backend migration 042) : déclarés par le commerce, voir dietary.js.
  const [halal, setHalal] = useState(MENTIONS_ALIMENTAIRES && !!(sauves || filtresInitiaux).halal);
  const [sansGluten, setSansGluten] = useState(MENTIONS_ALIMENTAIRES && !!(sauves || filtresInitiaux).sansGluten);
  // Les memes filtres que sur la carte, avec les memes noms : emporter, et un tri.
  // Les avoir des deux cotes evite d'avoir a changer de vue pour affiner une recherche.
  const [emporter, setEmporter] = useState(!!sauves?.emporter);
  const [ouvertsSeuls, setOuvertsSeuls] = useState(disponibilite.ouvert);
  const [livreSeuls, setLivreSeuls] = useState(disponibilite.livre);
  useEffect(() => { disponibilite.ouvert = ouvertsSeuls; disponibilite.livre = livreSeuls; }, [ouvertsSeuls, livreSeuls]);
  const [tri, setTri] = useState(sauves?.tri || 'recommande');
  useEffect(() => {
    ecrireEtatEcran(location.key, 'filtresListe', { search, commune, categorie, bio, vegan, halal, sansGluten, emporter, tri });
  }, [location.key, search, commune, categorie, bio, vegan, halal, sansGluten, emporter, tri]);
  /* « ACCUEIL » TOUCHÉ SUR L'ACCUEIL, LA LISTE REPART DE ZÉRO (fondateur, 2026-10-26). Une catégorie choisie dans la
     Recherche (« Poissons ») restait appliquée quand on touchait Accueil, puis revenait au retour de chaque fiche. Comme sur
     iPhone, l'onglet où l'on est ramène à son écran de départ : plus aucun filtre (« Ouvert » compris), en haut (DashboardSidebar.jsx envoie
     « fairide:onglet-retouche »). Sur le site, un lien vers la liste pendant qu'on y est (nouvelle entrée sans filtre) fait
     de même. */
  const reinitialiserFiltres = useCallback(() => {
    setSearch(''); setCommune(''); setCategorie(''); setBio(false); setVegan(false); setHalal(false); setSansGluten(false);
    setEmporter(false); setOuvertsSeuls(false); setLivreSeuls(false); setTri('recommande');
  }, []);
  useEffect(() => {
    const surOnglet = (e) => { if (e.detail === '/restaurants') reinitialiserFiltres(); };
    window.addEventListener('fairide:onglet-retouche', surOnglet);
    return () => window.removeEventListener('fairide:onglet-retouche', surOnglet);
  }, [reinitialiserFiltres]);
  const cleMontee = useRef(location.key);
  useEffect(() => {
    if (location.key === cleMontee.current) return;
    cleMontee.current = location.key;
    const st = location.state || {};
    if (st.filtresListe) return;
    reinitialiserFiltres();
    // Une catégorie, une commune ou un mot envoyés par la Recherche alors que la liste est déjà montée derrière elle (2026-10-27,
    // revenu le 2026-11-08) : ils s'appliquent ici, pas seulement au montage (useState plus haut), sinon la liste restait sur tout.
    const envoyes = filtresEnvoyes(st);
    if (envoyes.categorie) setCategorie(envoyes.categorie);
    if (envoyes.commune) setCommune(envoyes.commune);
    if (envoyes.search) setSearch(envoyes.search);
  }, [location.key, location.state, reinitialiserFiltres]);
  const [panneau, setPanneau] = useState(null);
  // « Déjà sur fairride » (les commerces à la carte complète, fondateur 2026-09-30) est retiré de l'accueil (fondateur,
  // 2026-11-12, maquettes/accueil-plein, réponse 5) : tous les commerces de la page sont sur Fairride, le titre ne disait rien
  // au client, et 4 de ses 7 commerces étaient déjà dans « À la une ». /restaurants/landing ne sert plus qu'à leur date.
  // Date d'inscription de chaque commerce (ms), pour « Nouveau sur Fairide » sur les cartes « À la une ».
  const [inscritLe, setInscritLe] = useState(() => new Map(listeEnCache('/restaurants/landing').filter((r) => r.createdAt).map((r) => [r.id, Number(r.createdAt)])));
  const [placementsTous, setPlacementsTous] = useState(() => lireCache('/placements/active')?.placements || []);
  // Rangées ouvertes à la vente par l'admin en plus de celles d'origine : une par type de cuisine (« Pizza »…).
  const [rangeesAjoutees, setRangeesAjoutees] = useState(() => lireCache('/placements/active')?.sections || []);
  const toast = useToast();
  // LES DEMANDÉS PRÈS DE TOI ET LEUR PAGE, UNE FOIS POUR TOUT L'ACCUEIL (accueil plein, fondateur 2026-11-12, section 5) : la rangée,
  // « Il en manque un ? » au bout de chaque envie, le rappel dans « Tous » et la carte de fin ouvrent la même page.
  const demandesPres = useDemandesPres();
  const { ouvrir: ouvrirDemande, fenetre: fenetreDemande } = useFenetreDemande(demandesPres.charger);
  // LE SITE SUR UN ORDINATEUR (maquettes/site-ordinateur/site-ordinateur.html, « Liste ») — jamais dans l'app : à partir de 900 px, des
  // grilles au lieu des rangées et Livraison / À emporter sur le bandeau ; à partir de 1 100 px, les filtres (Trier, Prix,
  // Envies) passent dans une colonne à gauche. Mêmes états, mêmes règles de tri et de filtre qu'avant : rien d'autre ne bouge.
  // Trier et Envies masqués (TRI, MENTIONS_ALIMENTAIRES) : la colonne n'aurait plus rien à porter et laissait un grand blanc à
  // gauche (2026-10-21). Sans elle, la commune ou le mot cherchés et « Manger local » s'affichent au-dessus de la liste.
  const grand = useSiteLarge(900);
  const ecranColonne = useSiteLarge(1100);
  const colonne = ecranColonne && (TRI || MENTIONS_ALIMENTAIRES);

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
      setInscritLe(new Map((l || []).filter((r) => r.createdAt).map((r) => [r.id, Number(r.createdAt)])));
    }).catch(() => {});
    // Mises en avant payantes du jour (routes/placements.js) : sans réponse, la liste reste dans son ordre naturel.
    chargerAvecCache('/placements/active', { forcer }).then((r) => { if (r === deja.placements) return; setPlacementsTous(r.placements || []); setRangeesAjoutees(r.sections || []); }).catch(() => {});
    // Page publique (consultable sans compte, voir App.jsx) — ces deux appels ne concernent que les
    // clients connectés, inutile de les tenter (et de récolter un 401 silencieux) pour un visiteur anonyme.
    if (token) {
      const favoris = lireCache('/restaurants/favorites/ids', token);
      chargerAvecCache('/restaurants/favorites/ids', { token, forcer }).then((ids) => { if (ids !== favoris) setFavoriteIds(new Set(ids)); }).catch(() => {});
      // Plus de rangée « À découvrir » (accueil plein, 2026-11-12) : la lecture reste, elle garde « Mes commandes » prête.
      chargerAvecCache(CHEMIN_COMMANDES_RECENTES, { token, forcer }).catch(() => {});
    }
    return commerces;
  }
  // Relue aussi quand le compte change (chargerListe suit le jeton d'un compte de test, voir jetonListe).
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargerListe]);
  // « Fermé » / « Ouvre à 18:00 » se recalculent chaque minute tant que la page reste ouverte, comme sur la fiche
  // (RestaurantMenu.jsx) : sinon une carte restait « Fermé » après l'heure d'ouverture (audit du 19/10, discovery-32).
  const [, setMinute] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinute((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  // Tirer pour actualiser : sans réseau, la liste restait telle quelle sans rien dire (discovery-32).
  const actualiser = () => charger({ forcer: true }).then((ok) => { if (!ok && restaurants.length) toast(t('restoListUi.refreshFailed'), 'erreur'); });

  /* LE CŒUR SE REMPLIT AU TOUCHER (2026-10-23, app lente : le cœur attendait la réponse du serveur avant de changer). Il
   * change tout de suite, l'appel suit ; si le serveur refuse, il revient avec le message d'erreur (actionOptimiste.js).
   * La copie gardée suit dans les deux sens (cacheDonnees.js) : la fiche, puis la liste au retour, montrent le bon cœur. */
  const agirOptimiste = useActionOptimiste();
  function poserFavori(id, actif) {
    setFavoriteIds((prev) => {
      if (prev.has(id) === actif) return prev;
      const next = new Set(prev);
      if (actif) next.add(id); else next.delete(id);
      return next;
    });
    poserFavoriEnCache(token, id, actif);
  }
  function toggleFavorite(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
    const avant = favoriteIds.has(id);
    vibrer('bascule'); // le cœur se sent au toucher, comme il se remplit (gestes.js)
    agirOptimiste(`favori:${id}`, {
      appliquer: () => { poserFavori(id, !avant); return avant; },
      envoyer: () => api(`/restaurants/${id}/favorite`, { method: avant ? 'DELETE' : 'POST', token }),
      annuler: (etat) => poserFavori(id, etat)
    });
  }

  // Bio et Vegan sont dans la même rangée que les catégories, en fin de liste : des filtres comme les
  // autres (cumulables entre eux et avec une catégorie), sans mise en avant.
  // CASES VIDES CACHÉES (réponse 6 du questionnaire, 2026-10-22) : seules les catégories qui ont au moins un commerce dans la
  // liste (categoriesClient), et celle déjà choisie. Avant, les 35 types s'affichaient même vides et menaient à « aucun commerce ».
  const categories = useMemo(() => categoriesClient(restaurants, { garder: categorie }), [restaurants, categorie]);
  // LA MÊME BANDE POUR TOUT LE MONDE (fondateur, 2026-10-26 : « je n'aime pas ces points verts ; l'écran Tu as envie de quoi ? est
  // juste pour le plaisir, il ne doit rien changer »). Les familles cochées à l'accueil de l'app passaient en tête de la bande avec
  // un point lime, et ouvraient une rangée « Tes envies » (2026-10-25) : retiré. L'accueil garde son écran et ses résultats.
  // PLUS DE PASTILLE « TOUS », COMME UBER EATS (fondateur, 2026-10-27) : la liste s'ouvre sur tout, sans rien d'allumé ; on
  // touche une catégorie pour filtrer, on la retouche pour revenir à tout (surChip). La lentille apparaît et s'efface sur place
  // (TeteListe.jsx).
  const cuisineOptions = [
    ...categories.liste.map((f) => ({ value: f.cle, emoji: f.icone, illustration: f.illustration, label: libelleCategorie(f.cle, t, { court: true }) })),
    // Bio, Vegan, Halal, Sans gluten : masqués pour le moment (MENTIONS_ALIMENTAIRES, dietary.js).
    ...(MENTIONS_ALIMENTAIRES ? [
    { value: '__bio', emoji: 'feuille', label: t('restaurantList.chipBio'), regime: 'bio' },
    { value: '__vegan', emoji: 'feuille', label: t('restaurantList.chipVegan'), regime: 'vegan' },
    { value: '__halal', emoji: 'coche', label: t('restaurantList.chipHalal'), regime: 'halal' },
    { value: '__sansGluten', emoji: 'coche', label: t('restaurantList.chipGlutenFree'), regime: 'sansGluten' }
    ] : [])
  ];
  const REGIMES = { bio: [bio, setBio], vegan: [vegan, setVegan], halal: [halal, setHalal], sansGluten: [sansGluten, setSansGluten] };
  const chipActive = (opt) => (opt.regime ? REGIMES[opt.regime][0] : categorie === opt.value);
  const surChip = (opt) => {
    if (opt.regime) REGIMES[opt.regime][1]((v) => !v);
    else setCategorie(categorie === opt.value ? '' : opt.value);
  };

  // Mises en avant PAR COMMUNE (fondateur, 2026-10-06) : un commerce qui paie n'est épinglé que pour les clients de sa commune
  // (celle du filtre, sinon celle de chez soi). Sans commune connue, rien n'est épinglé.
  // RANGÉE SANS MISE EN AVANT → ORDRE ALÉATOIRE (fondateur, 2026-10-06) : personne n'a payé pour cette rangée dans cette
  // commune, donc personne n'y est avantagé par l'ordre. Mélange stable le temps de la visite (graine tirée une fois), sinon
  // chaque rafraîchissement d'état rebattrait les cartes sous les yeux du client. « Autour de vous » garde la distance.
  // Depuis le 2026-11-12 (accueil plein) : dans une même bande de distance, chacun son tour (accueilRangees.js › creerRangement).
  const [graine] = useState(() => Math.random().toString(36).slice(2));
  // MANGER LOCAL (fondateur, 2026-10-06, précisé le 07/10) : chaque rangée montre D'ABORD les commerces de la commune du client
  // (`homeCommune` : adresse du compte, sinon adresse tapée sur l'accueil), PUIS ceux des communes voisines de proche en proche —
  // jamais une rangée ni une page vide. « Autour de vous » reste du plus proche au plus loin par rapport à son adresse. Les
  // filtres et la recherche restent libres. Les mises en avant restent par commune.
  const rang = (r) => (homeCommune ? communeRingDistance(homeCommune, r.commune) : 0);
  const dansCommune = homeCommune ? restaurants.filter((r) => r.commune === homeCommune) : [];
  const base = homeCommune ? [...restaurants].sort((a, b) => rang(a) - rang(b)) : restaurants;
  const communeEpingles = commune || homeCommune;
  const placements = communeEpingles ? placementsTous.filter((p) => !p.commune || p.commune === communeEpingles) : [];
  // « Livre chez toi » ne compte que tant que la pastille peut être montrée (GO pressé, adresse connue) : un GO relâché
  // pendant la visite ne laisse pas un filtre invisible allumé.
  // De même « Ouvert » attend que les commandes soient ouvertes (« Ouvrir l'à emporter », launch.js) : avant, il viderait toujours la liste.
  const pastilleLivre = FILTRE_LIVRE && filtreLivraisonPossible(user);
  const pastilleOuvert = commandesOuvertes(user);
  const livreActif = livreSeuls && pastilleLivre;
  const ouvertActif = ouvertsSeuls && pastilleOuvert;
  /* LE BOUTON D'ABORD, LA LISTE JUSTE APRÈS (fondateur, 2026-10-27 : « Ouvert » saccadait dans l'app). Allumer « Ouvert » ou
     une cuisine remplace toute la page (rangées ↔ liste filtrée) : le bouton attendait que tout soit reconstruit. Les
     boutons lisent la valeur touchée ; la liste en lit une copie différée (useDeferredValue), que React prépare juste après
     avoir redessiné le bouton — et qu'il abandonne si le doigt touche encore entre-temps. */
  const ouvertListe = useDeferredValue(ouvertActif);
  const livreListe = useDeferredValue(livreActif);
  const categorieListe = useDeferredValue(categorie);
  const emporterListe = useDeferredValue(emporter);
  const maintenant = new Date();
  const hasActiveFilter = !!(search || categorieListe || commune || bio || vegan || halal || sansGluten || emporterListe || ouvertListe || livreListe || tri !== 'recommande');

  // Distance a vol d'oiseau depuis l'adresse du compte, quand elle est connue.
  const distanceDe = (r) => (reperePos && r.lat && r.lng ? haversineDistanceKm(reperePos.lat, reperePos.lng, r.lat, r.lng) : null);

  // `toujoursOuvert` : la même règle sans l'heure, pour l'écran vide (qui rouvre en premier).
  const garderDisponibilite = (r, options) => (!ouvertListe || ouvertPourCommander(r, user, maintenant, options))
    && (!livreListe || livreChezToi(r, user, maintenant, options));
  const garderAutres = (r) => {
    if (commune && r.commune !== commune) return false;
    // Type principal ou en plus : une seule de ses spécialités suffit.
    if (categorieListe && !categories.de(r).has(categorieListe)) return false;
    if (bio && !restoBio(r)) return false;
    if (vegan && !restoVegan(r)) return false;
    if (halal && !restoHalal(r)) return false;
    if (sansGluten && !restoSansGluten(r)) return false;
    if (search && !normaliserRecherche(`${r.name} ${r.desc} ${r.cuisine}`).includes(normaliserRecherche(search))) return false;
    if (emporterListe && !emporterPossibleIci(r, user)) return false;
    return true;
  };
  const list = restaurants
    .filter((r) => garderDisponibilite(r) && garderAutres(r))
    // Le tri choisi passe AVANT le rangement par anneaux de communes ci-dessous : demander « les
    // plus proches » et recevoir d'abord sa propre commune ne serait pas un tri. Plus de tri « Note » depuis le retrait
    // des avis clients (fondateur, 22/10/2026) ; le tri n'est gardé nulle part (état de la page), aucun ancien choix à
    // reprendre — une valeur inconnue retombe sur l'ordre « Recommandé ».
    //
    // PAS DE TRI « LE PLUS RAPIDE » (fondateur, 2026-10-29, maquettes/delai-estime, question 8 : « pas maintenant »). Le
    // temps de chaque carte existe depuis (delaiEstime.js), mais tant que presque tous les commerces comptent les mêmes
    // minutes de préparation, il range exactement comme « Le plus proche ». À reprendre quand les temps mesurés diffèrent.
    .sort((a, b) => {
      if (tri === 'distance') return (distanceDe(a) ?? Infinity) - (distanceDe(b) ?? Infinity);
      return 0;
    })
    // « RECOMMANDÉ » = LE PLUS PROCHE D'ABORD quand l'adresse du compte est localisée (fondateur, 2026-10-31 : un « 40–50 min »
    // ne doit pas être la première chose vue ; avant, sa commune puis les voisines, le plus récent d'abord dans chacune — un
    // commerce à 3,5 km dans sa commune passait devant un autre à 600 m de l'autre côté de la limite). Les commerces sans
    // coordonnées passent après. Sans position : d'abord la commune du client, puis les communes limitrophes de proche en
    // proche (sauf filtre de commune explicite), l'ordre du serveur (plus récent d'abord) départageant un même anneau.
    .sort((a, b) => {
      if (tri !== 'recommande') return 0;
      if (reperePos) return (distanceDe(a) ?? Infinity) - (distanceDe(b) ?? Infinity) || 0;
      if (!homeCommune || commune) return 0;
      return communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune);
    })
    // Puis les ouverts d'abord, quel que soit le tri choisi (voir ouvertsDabord).
    .sort((a, b) => estOuvert(b) - estOuvert(a))
    // La boutique de test d'un compte de test tout en haut (relecture des stores, voir jetonListe) : seul un compte de test
    // reçoit `pourTesteurs`.
    .sort((a, b) => !!b.pourTesteurs - !!a.pourTesteurs);

  // Page d'accueil "par sections" (façon Uber Eats/Deliveroo) affichée uniquement sans filtre actif —
  // dès qu'on cherche/filtre, on retombe sur la liste plate ci-dessus, plus adaptée à une recherche.
  // Une rangée trop courte tourne mal en boucle (2 cartes qui se répètent) : en dessous de MIN_PAR_RANGEE
  // commerces, on la complète avec d'autres commerces de la liste, dans l'ordre de la liste, sans doublon (« les mieux
  // notés d'abord » jusqu'au retrait des avis, 22/10/2026).
  // Une rangée vide reste vide : on ne fabrique pas une section « Bio » sans le moindre produit bio.
  // SEULE « AUTOUR DE TOI » EST COMPLÉTÉE (audit du 19/10, discovery-07) : une rangée « Vegan » d'un commerce vegan et de
  // cinq commerces qui ne le sont pas mentait sur son titre. Les rangées à thème restent courtes ; une rangée d'une seule
  // carte ne tourne pas en boucle (Section, loop && list.length > 1). /classement le dit (conformite.ranking_rows).
  const completer = (liste) => {
    if (liste.length === 0 || liste.length >= MIN_PAR_RANGEE) return liste;
    const dejaLa = new Set(liste.map((r) => r.id));
    const renfort = [...base]
      .filter((r) => !dejaLa.has(r.id))
      .slice(0, MIN_PAR_RANGEE - liste.length);
    return [...liste, ...renfort];
  };
  const nonGrocery = base.filter((r) => !estCourses(r));
  const nonGroceryTous = restaurants.filter((r) => !estCourses(r)); // « Autour de vous » : toutes les communes

  /* L'ACCUEIL PLEIN (fondateur, 2026-11-12, maquettes/accueil-plein ; règles et raisons dans accueilRangees.js). Les rangées
   * sont calculées DANS L'ORDRE OÙ LA PAGE LES MONTRE : la règle « une tête par rangée » retient, rangée après rangée, les
   * commerces déjà premiers plus haut. Une rangée masquée (Bio, Vegan) n'est pas calculée : elle ne prendrait pas de tête. */
  const rangement = creerRangement({
    distanceDe: (r) => r.distanceKm ?? distanceDe(r), avecPosition: !!reperePos, rang, graine,
    estOuvert, peutCommander: (r) => ouvertPourCommander(r, user, maintenant)
  });
  // La distance écrite sur chaque carte, comme dans « Autour de toi » : « près d'abord » se voit.
  const avecKm = (liste) => (reperePos ? liste.map((r) => (r.distanceKm != null ? r : { ...r, distanceKm: distanceDe(r) })) : liste);
  // Une rangée à thème : bande la plus proche d'abord, chacun son tour dans la bande, une tête par rangée, puis la position
  // payée (MISES EN AVANT, fondateur 2026-10-02 : seulement si le commerce a sa place dans la rangée, misesEnAvant.js).
  const ranger = (liste, cle, admissibles) => epingler(rangement.uneTete(rangement.parBandeEtTour(avecKm(liste))), placements, cle, admissibles);

  // AUTOUR DE VOUS, DU PLUS PROCHE AU PLUS LOIN (fondateur, 2026-10-01). Adresse géolocalisée : les commerces triés
  // par distance réelle, la distance affichée sur la carte. Sans position : sa commune d'abord, puis les communes
  // voisines de proche en proche (communeRingDistance). Les commerces sans coordonnées passent après.
  // 8 AU LIEU DE 15 (accueil plein, 2026-11-12) : tous les commerces sont maintenant plus bas (envies, « Tous »).
  const PROCHES_MAX = 8;
  const parDistance = nonGroceryTous.map((r) => ({ ...r, distanceKm: distanceDe(r) })).filter((r) => r.distanceKm != null).sort((a, b) => a.distanceKm - b.distanceKm);
  const parAnneau = homeCommune ? [...nonGroceryTous].sort((a, b) => communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune)) : nonGroceryTous;
  // À la une : voir ALaUne. Même ordre que « Autour de toi », mais SANS épinglage payant, avec photo, ouverts d'abord.
  // La boutique de test d'un compte de test (relecture des stores, fondateur 2026-10-26 : « le premier, à la une ») ouvre la
  // rangée, avec ou sans photo : le relecteur d'Apple ou de Google la trouve sans chercher. Les autres suivent la règle.
  const pourTesteurs = restaurants.filter((r) => r.pourTesteurs);
  const aLaUne = [...pourTesteurs, ...(parDistance.length ? parDistance : parAnneau)
    // SA PROPRE PHOTO (audit du 19/10, discovery-05) : le serveur remplit toujours coverImageUrl, avec une photo d'illustration
    // quand le commerce n'en a pas ; `ownCover` dit si c'est la sienne. Une liste lue avant ce champ (undefined) garde l'ancien
    // comportement. Pas de commerce « Carte seule » (vitrine) en tête : on ne peut pas y commander (discovery-34).
    .filter((r) => !r.pourTesteurs && r.coverImageUrl && r.ownCover !== false && !r.vitrine)
    .map((r, i) => ({ r, i, o: estOuvert(r) ? 0 : 1 }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(({ r }) => r)]
    .slice(0, UNE_MAX);
  // Une grande carte par écran : seule la première est vue sans glisser.
  rangement.retenir(aLaUne, 1);
  // « Autour de toi » : le plus proche, sans tour (son titre le promet) ; la tête ne s'échange qu'entre voisins de même bande.
  const nearbyList = completer(epingler(rangement.uneTete(parDistance.length ? parDistance.slice(0, PROCHES_MAX) : homeCommune ? parAnneau.slice(0, PROCHES_MAX) : []),
    placements, 'nearby', parDistance.length ? parDistance : nonGroceryTous));
  // LIVRAISON OFFERTE et LIVRAISON DÈS 3 € (fondateur, 2026-10-01) : seulement les commerces concernés, jamais complétées.
  const SEUIL_PAS_CHER = 3;
  // Rangées « Livraison offerte » et « Livraison dès 3 € » : seulement après le GO (avant, seul l'à emporter est ouvert).
  // Ni hors zone, ni sans livreur libre (audit du 19/10, discovery-02 et 03).
  const livrables = livraisonOuverte(user) ? nonGrocery.filter((r) => livraisonPossibleIci(r, user)) : [];
  const livraisonOfferteEpinglee = ranger(livrables.filter((r) => { const tarif = tarifLivraison(r); return tarif.offerte || tarif.offerteDes != null; }), 'free_delivery');
  const livraisonPasCherEpinglee = ranger(livrables.filter((r) => { const tarif = tarifLivraison(r); return !tarif.offerte && tarif.offerteDes == null && tarif.depart > 0 && tarif.depart <= SEUIL_PAS_CHER; }), 'cheap_delivery');
  const offersList = ranger(base.filter((r) => r.hasPromo), 'offers');
  // Une rangée par type de cuisine ajoutée dans Admin › Mises en avant : les commerces de ce type (principal ou
  // secondaire), les épinglés en tête. Jamais complétée : une rangée « Pizza » ne montre que des pizzerias.
  const rangeesCuisine = rangeesAjoutees.filter((s) => s.kind === 'cuisine' && s.cuisine).map((s) => ({
    ...s,
    liste: ranger(base.filter((r) => r.cuisine === s.cuisine || (r.extraCuisines || []).includes(s.cuisine)), s.key)
  })).filter((s) => s.liste.length > 0);
  // Un seul plat marqué healthy par le restaurateur suffit à faire entrer le commerce ici (menu_items.healthy). Bio et Vegan :
  // la case cochée par le restaurateur (menu_items.organic / .vegan) fait foi ; à défaut, le nom ou la description du plat
  // (« Burger vegan », « Vin bio »). Un commerce peut apparaître dans plusieurs rangées. Les courses ont leur rangée.
  const parMention = (compte) => nonGrocery.filter((r) => compte(r) > 0);
  const healthyList = ranger(parMention(nbPlatsHealthy), 'healthy');
  const bioList = MENTIONS_ALIMENTAIRES ? ranger(parMention(nbPlatsBio), 'bio') : [];
  const veganList = MENTIONS_ALIMENTAIRES ? ranger(parMention(nbPlatsVegan), 'vegan') : [];
  // LES RANGÉES PAR ENVIE (réponse 2) : une par catégorie de la bande, accueilRangees.js › rangeesEnvies. Pas deux fois la
  // même : une catégorie qui a déjà sa rangée vendue dans Admin › Mises en avant, ou « Healthy » quand la rangée des plats
  // healthy existe, n'en a pas une seconde.
  const exclusEnvies = [...rangeesCuisine.map((s) => categories.deSpecialite(s.cuisine)).filter(Boolean), ...(healthyList.length ? ['healthy'] : [])];
  const envies = rangeesEnvies(nonGroceryTous, categories, { exclure: exclusEnvies })
    .map((e) => ({ ...e, liste: ranger(e.liste, `envie:${e.cle}`).slice(0, PAR_RANGEE_ENVIE) }));
  const groceryList = ranger(base.filter(estCourses), 'grocery');
  /* TOUS LES COMMERCES (réponse 3) : chacun une fois, une grande carte l'une sous l'autre (sur le site, la grille). D'abord ceux
   * où l'on peut commander maintenant, puis les « Carte seule » ouverts, puis les fermés (réponse 4) ; dans chaque groupe, par
   * bande de distance, chacun son tour. Une position achetée pour l'ancienne rangée « À découvrir » (Admin › Mises en avant,
   * clé 'discover') y garde sa place, marquée « Sponsorisé » : la rangée a été remplacée par celle-ci. */
  const tous = epingler(rangement.uneTete(rangement.parBandeEtTour(avecKm(restaurants)), { commande: true }), placements, 'discover', restaurants);
  // Toucher le titre d'une rangée par envie (« Pizza → ») : la catégorie, comme sa puce dans la bande, et l'écran en haut
  // (règle 5 de design.md : un toucher n'arrive jamais au milieu d'une page).
  const ouvrirCategorie = (cle) => { vibrer('bascule'); setCategorie(cle); window.scrollTo(0, 0); };

  const avecPosition = !!reperePos;
  // Le nom de l'adresse choisie dans le carnet (« Maison », « Travail », ou celui tapé), vide sinon.
  const nomEnCours = user ? nomAdresse(adresseEnCours(lancement.adresses, user), t) : '';
  const libelleTri = (cle) => (cle === 'recommande' ? t('mapClient.sortRecommended') : t('siteListe.triDistance'));
  // « Manger local : les commerces de … d'abord » retiré (fondateur, 2026-10-16) : on ne prévient plus que si la commune n'a
  // encore aucun commerce, pour dire pourquoi la liste montre ceux d'à côté.
  const localTexte = homeCommune && dansCommune.length === 0 ? t('restaurantList.localEmpty', { commune: homeCommune }) : null;
  // Le bandeau ne s'affiche qu'avec un compte : sans lui, « À emporter » reste une pastille au-dessus de la liste.
  // Avant le GO, seul l'à emporter est ouvert : pas de bascule « Livraison / À emporter » (audit du 19/10, discovery-25) ; la
  // pastille « À emporter » reste au-dessus de la liste.
  const modeSurBandeau = FILTRE_EMPORTER && grand && !!user && livraisonOuverte(user);
  // La rangée de pastilles au-dessus de la liste : tout ce que la colonne et le bandeau ne portent pas déjà.
  // Seulement s'il y a quelque chose dedans : sans « À emporter » ni tri, la rangée vide laissait un blanc.
  const pastillesFiltres = (!colonne || !modeSurBandeau) && (FILTRE_EMPORTER || ((pastilleOuvert || pastilleLivre) && restaurants.length > 0) || (!colonne && (TRI || !!commune || !!search)));
  const toutEffacer = () => { setSearch(''); setCategorie(''); setCommune(''); setBio(false); setVegan(false); setHalal(false); setSansGluten(false); setEmporter(false); setOuvertsSeuls(false); setLivreSeuls(false); setTri('recommande'); };
  /* LA LISTE VIDE PAR « OUVERT » OU « LIVRE CHEZ TOI » DIT POURQUOI (réponse 4 de maquettes/filtre-ouvert) : le 26/10, depuis
   * Woluwe à midi, un seul restaurant livrait ; à 23:30, aucun. Plutôt que « aucun commerce ne correspond » : pas de livreur
   * libre, ou qui rouvre en premier parmi ceux que les autres filtres gardent, ou personne ne livre à cette adresse. */
  const videDisponibilite = (() => {
    if (!ouvertListe && !livreListe) return null;
    const titre = livreListe ? t('restaurantList.videLivre') : t('restaurantList.videOuvert');
    if (livreListe && !livreurFairideLibre(user)) return { titre, texte: t('restaurantList.videSansLivreur') };
    const premier = premierARouvrir(restaurants.filter((r) => garderAutres(r) && garderDisponibilite(r, { toujoursOuvert: true })), maintenant);
    if (!premier) return { titre, texte: livreListe ? t('restaurantList.videHorsZone') : t('restaurantList.emptyFiltered') };
    const heure = premier.quand.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
    const jours = Math.round((new Date(premier.quand).setHours(0, 0, 0, 0) - new Date(maintenant).setHours(0, 0, 0, 0)) / 86400000);
    const texte = jours <= 0 ? t('restaurantList.videRouvreA', { nom: premier.r.name, heure })
      : jours === 1 ? t('restaurantList.videRouvreDemain', { nom: premier.r.name, heure })
        : t('restaurantList.videRouvreJour', { nom: premier.r.name, heure, jour: premier.quand.toLocaleDateString(getLocale(), { weekday: 'long' }) });
    return { titre, texte };
  })();
  return (
    <CommuneListe.Provider value={homeCommune}>
    <div className={`sl-liste${grand ? ' sl-liste--grand' : ''}${colonne ? ' sl-liste--colonne' : ''}${listeCalme ? ' sl-liste--calme' : ''}`}>
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
        // L'aperçu de l'accueil du site (apercuSite.js) montre le bandeau de l'appli même sans compte : « Livrer à · Ajoute ton
        // adresse » ; le toucher ouvre la fenêtre du site (installer l'appli / créer un compte), comme un commerce touché.
        adresse={user ? (user.addressStreet && user.addressCity
          ? `${user.addressStreet} ${user.addressNumber || ''}, ${user.addressCity}`.replace(' ,', ',')
          : t('restaurantMenu.noAddress')) : APERCU ? t('restaurantMenu.noAddress') : null}
        // « Livrer à · Maison » quand l'adresse choisie a un nom dans le carnet (2026-11-08).
        intituleAdresse={nomEnCours ? t('restaurantMenu.deliverToNamed', { nom: nomEnCours }) : t('restaurantMenu.deliverTo')}
        libelleChanger={t('restaurantMenu.changeAddress')}
        onAdresse={() => (APERCU ? signalerAuSite({ type: 'ouvrir', chemin: '/adresse' }) : setChoixAdresse(true))}
        // Avec la colonne, Bio / Vegan / Halal / Sans gluten y sont (« Envies ») : la bande ne garde que les cuisines.
        options={colonne ? cuisineOptions.filter((o) => !o.regime) : cuisineOptions}
        estActive={chipActive}
        surPuce={surChip}
        cuisine={categorie}
        choisirCuisine={setCategorie}
        libelleBande={t('ecranListe.cuisinesAria')}
        // Liste pas encore lue : les ronds des cuisines attendent à leur place (Skeleton.jsx, PucesCuisineVides).
        chargement={loading && cuisineOptions.length === 0}
        /* Seulement à portée d'un commerce (2026-11-12, usePositionLancement.js › HORS DE PORTÉE) : à Londres, rien. */
        bulle={lancement.loin && !choixAdresse && aPorteeDUnCommerce(lancement.position, restaurants) ? (
          <BulleAdresseLoin km={lancement.loin.km} user={user} onGarder={lancement.garder} onIci={() => { lancement.garder(); setChoixAdresse('ici'); }} />
        ) : null}
        mode={modeSurBandeau ? {
          emporter,
          choisir: setEmporter,
          libelleLivraison: t('siteListe.modeLivraison'),
          libelleEmporter: t('restaurantList.filterPickup'),
          libelleGroupe: t('siteListe.modeAria')
        } : null}
      />
      {choixAdresse && <ChoixAdresse depuisPosition={choixAdresse === 'ici'} onFermer={() => { setChoixAdresse(false); lancement.relireCarnet(); }} />}
      <div className="sl-corps">
      {/* LA COLONNE DES FILTRES (site, à partir de 1 100 px ; maquettes/site-ordinateur/site-ordinateur.html, « Liste »). Les mêmes filtres que
          les pastilles et leurs panneaux, ouverts d'un coup au lieu d'être repliés : Trier (mêmes trois tris) et Envies (les
          quatre bascules de régime qui terminent la bande des cuisines), tous deux masqués pour le moment. Elle reste à l'écran quand on
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
          {TRI && (
          <fieldset className="sl-groupe">
            <legend className="sl-groupe-titre">{t('mapClient.sort')}</legend>
            {['recommande', 'distance'].map((cle) => {
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
          )}
          {MENTIONS_ALIMENTAIRES && (
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
          )}
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
        {/* « Ouvert » et « Livre chez toi » d'abord (version A de maquettes/filtre-ouvert) : même pastille, même nom et même
            horloge que « Ouvert » sur l'onglet Carte. */}
        {pastilleOuvert && restaurants.length > 0 && (
          <button type="button" className={`cuisine-chip${ouvertActif ? ' active' : ''}`} aria-pressed={ouvertActif} onClick={() => { vibrer('bascule'); setOuvertsSeuls((v) => !v); }}>
            {/* Allumée dans l'app, l'horloge se remplit, comme l'icône de l'onglet choisi (maquettes/ouvert-verre) ; le site garde son trait. */}
            <Icone nom={ouvertActif && experienceApp() ? 'horlogePleine' : 'horloge'} taille={16} />{t('mapClient.filterOpen')}
          </button>
        )}
        {pastilleLivre && restaurants.length > 0 && (
          <button type="button" className={`cuisine-chip${livreActif ? ' active' : ''}`} aria-pressed={livreActif} onClick={() => { vibrer('bascule'); setLivreSeuls((v) => !v); }}>
            <Icone nom="velo" taille={16} />{t('restaurantList.filtreLivre')}
          </button>
        )}
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
        {FILTRE_EMPORTER && !modeSurBandeau && (
          <button type="button" className={`cuisine-chip${emporter ? ' active' : ''}`} aria-pressed={emporter} onClick={() => setEmporter((v) => !v)}>
            <Icone nom="sac" taille={16} />{t('restaurantList.filterPickup')}
          </button>
        )}
        {!colonne && TRI && <>
        <button type="button" className={`cuisine-chip${tri !== 'recommande' ? ' active' : ''}`} aria-expanded={panneau === 'tri'} onClick={() => setPanneau((x) => (x === 'tri' ? null : 'tri'))}>
          <Icone nom="stats" taille={16} />{tri === 'distance' ? t('mapClient.sortDistance') : t('mapClient.sort')}
        </button>
        </>}
      </div>}
      {!colonne && panneau === 'tri' && (
        <div className="carte-panneau liste-panneau">
          {['recommande', 'distance'].map((cle) => (
            <button key={cle} type="button" className={`cuisine-chip${tri === cle ? ' active' : ''}`}
              disabled={cle === 'distance' && !avecPosition}
              title={cle === 'distance' && !avecPosition ? t('mapClient.sortDistanceNeedsAddress') : undefined}
              onClick={() => { setTri(cle); setPanneau(null); }}>
              {cle === 'recommande' ? t('mapClient.sortRecommended') : t('mapClient.sortDistance')}
            </button>
          ))}
        </div>
      )}
      {/* La bascule « Liste / Carte » vivait ici. Elle a disparu le jour où la carte a pris son
          propre onglet, en bas de l'écran : demander à quelqu'un qui parcourt une liste s'il ne
          préférerait pas une carte, alors qu'un onglet dédié l'y emmène, c'est poser deux fois la
          même question. Cette page est la liste ; la carte est la carte. */}
      {!loading && hasActiveFilter && list.length > 0 && <div className="small" style={{ marginBottom: 14 }}>{t('restaurantList.count', { count: list.length })}</div>}
      {loading && <SqueletteAccueil grand={grand} />}
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
          <Section title={t('restaurantList.sectionNearby')} icon="position" list={nearbyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="nearby" />
          {/* « Demandés près de toi » (fondateur, 2026-10-26, version B de maquettes/demande-restaurant) : sous « Autour de toi ». */}
          {/* Toujours là, « Le tien ? » en premier (accueil plein, 2026-11-12, réponse 8). Jamais dans le faux téléphone de l'accueil
              du site (Owen, 2026-11-12 : « retire la vue demander un restaurant ») : ni cette rangée, ni « Il en manque un ? » au bout
              des rangées, ni le rappel dans « Tous », ni la carte de fin. L'aperçu montre les restaurants, rien d'autre. */}
          {!APERCU && <RangeeDemandes grand={grand} demandes={demandesPres} ouvrir={ouvrirDemande} />}
          <Section title={t('restaurantList.sectionFreeDelivery')} icon="velo" list={livraisonOfferteEpinglee} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="free_delivery" />
          <Section title={t('restaurantList.sectionDeliveryFrom', { amount: eurosCourts(3) })} icon="velo" list={livraisonPasCherEpinglee} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="cheap_delivery" />
          <RangeeApercu title={t('restaurantList.sectionOffers')} icon="etiquette" list={offersList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} grille={grand} cle="offers" />
          {rangeesCuisine.map((s) => (
            <Section key={s.key} title={titreRangee(t, s)} icon="restaurants" list={s.liste} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle={s.key} />
          ))}
          <Section title={t('restaurantList.sectionHealthy')} icon="restaurants" list={healthyList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="healthy" />
          {MENTIONS_ALIMENTAIRES && <>
          <Section title={t('restaurantList.sectionBio')} icon="favoris" list={bioList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="bio" />
          <Section title={t('restaurantList.sectionVegan')} icon="favoris" list={veganList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} loop grille={grand} cle="vegan" />
          </>}
          {envies.map((e) => {
            const dessin = illustrationCuisine(e.illustration, { plat: !experienceApp() });
            return (
              <Section key={e.cle} title={libelleCategorie(e.cle, t)} dessin={dessin} list={e.liste} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t}
                grille={grand} cle={`envie:${e.cle}`} surTitre={() => ouvrirCategorie(e.cle)}
                fin={APERCU ? null : <TuileIlEnManque categorie={e.cle} dessin={dessin} onOuvrir={ouvrirDemande} />}
                finGrille={APERCU ? null : <LienIlEnManque categorie={e.cle} onOuvrir={ouvrirDemande} />} />
            );
          })}
          <RangeeApercu title={t('restaurantList.sectionGrocery')} icon="commerce" list={groceryList} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t} grille={grand} cle="grocery" />
          {tous.length > 0 && (
            <section className="liste-section tous-section">
              <h2 className="section-title section-titre-icone" style={{ fontSize: 17, margin: '0 0 12px' }}><Icone nom="restaurants" taille={18} />{t('restaurantList.sectionTous')}</h2>
              <div className={grand ? 'rest-grid sl-grille tous-commerces' : 'rest-grid tous-commerces'}>
                {tous.map((r, i) => (
                  <Fragment key={r.id}>
                    <RestaurantCard r={r} isFavorite={favoriteIds.has(r.id)} onToggleFavorite={toggleFavorite} t={t} />
                    {/* Le rappel des demandés après le 10e (réponse 9) : un seul. */}
                    {!APERCU && i === Math.min(RAPPEL_APRES, tous.length) - 1 && <RappelDemande demandes={demandesPres} onOuvrir={ouvrirDemande} />}
                  </Fragment>
                ))}
              </div>
            </section>
          )}
          {/* « Il manque ton restaurant ? » : là où la liste s'arrête et où l'on se dit qu'il manque le sien (2026-10-26). */}
          {!APERCU && restaurants.length > 0 && <FinDeListeDemande onOuvrir={ouvrirDemande} />}
        </>
      )}
      {fenetreDemande}
      {/* Filtres trop serrés : « Aucun restaurant pour le moment » laissait croire qu'il n'y en avait aucun, sans moyen d'en
          sortir (audit du 15/10/2026). On dit que c'est le filtre, et on l'efface en un geste. */}
      {!loading && hasActiveFilter && list.length === 0 && restaurants.length > 0 && (videDisponibilite ? (
        <EtatVide icone={livreListe ? 'velo' : 'horloge'} titre={videDisponibilite.titre} texte={videDisponibilite.texte}>
          <button type="button" className="btn-gold" onClick={toutEffacer}>{t('restaurantList.voirTous')}</button>
        </EtatVide>
      ) : (
        <EtatVide icone="recherche" titre={t('restaurantList.emptyFiltered')}>
          <button type="button" className="btn-teal" onClick={toutEffacer}>
            {t('restaurantList.clearFilters')}
          </button>
        </EtatVide>
      ))}
      {!loading && echecListe && restaurants.length === 0 && <ErreurChargement onReessayer={() => chargerListe()} />}
      {!loading && !echecListe && restaurants.length === 0 && (
        <EtatVide icone="restaurants" titre={t('restaurantList.empty')} />
      )}
      </div>
      </div>
    </div>
    </CommuneListe.Provider>
  );
}
