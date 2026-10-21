import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { imgProps, cacherImageCassee } from '../../images';
import urlSure from '../../urlSure';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { euros, prixRemise } from '../../prixPlat';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { horsZoneLivraison, distanceLivraisonKm, tarifLivraison } from '../../livraison';
import Icone from '../../components/Icone';
import BandeauGroupe from '../../components/client/BandeauGroupe';
import { groupeEnCours } from '../../commandeGroupee';
import VisuelVide from '../../components/VisuelVide';
import { commandesOuvertes, livraisonOuverte, paiementEnLigneOuvert, dateOuvertureEmporter, useLancement, livraisonDisponible, exempteLancement } from '../../launch';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import EtatVide from '../../components/EtatVide';
import Modale from '../../components/Modale';
import ConfirmDialog from '../../components/ConfirmDialog';
import { StarsDisplay } from '../../components/Stars';
import { ContexteAvis, SignatureReponse } from '../../components/AvisSignes';
// Chargée à la demande, même raison que dans RestaurantList.jsx : Leaflet ne doit pas retarder
// l'affichage d'une fiche de commerce, qui est une page publique et indexable.
const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));
import FichePlat from '../../components/FichePlat';
import { envolerVersPanier, vibrer, defilement } from '../../gestes';
import MenuCategorySections from '../../components/MenuCategorySections';
import EnteteFlux from '../../components/EnteteFlux';
import CategoryQuickNav from '../../components/CategoryQuickNav';
import FavoriteHeart from '../../components/FavoriteHeart';
import CertifiedBadge from '../../components/CertifiedBadge';
import PrixComptoir from '../../components/PrixComptoir';
import AutoScrollRow from '../../components/AutoScrollRow';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { statutOuverture, formatCountdown, formatDaySchedule, formatFullSchedule, formatDateFr, dayLabel } from '../../openingHours';
import usePageMeta from '../../hooks/usePageMeta';
import useJsonLd from '../../seo/useJsonLd';
import { restaurantJsonLd, breadcrumbJsonLd, SITE_URL } from '../../seo/jsonLd';
import { localizedItem } from '../../menuTranslation';
import { resolveItemImage, restaurantTypeLabel, haversineDistanceKm } from '../../menuCategories';
import { VeloMarque } from '../../components/EcranCommande';
import FicheVendeur from '../../components/conformite/FicheVendeur';
import { experienceApp } from '../../natif';
import { photoEnVol, entreeParPhoto } from '../../transitionPhoto';
import { chargerAvecCache, lireCache, modifierCache } from '../../cacheDonnees';
import PanierColonne from '../../components/PanierColonne';
import { repeterTantQueLibre } from '../../defilementAuto';
import { lienFiche } from '../../murCompte';
import '../../ecran-fiche.css';
import '../../site-fiche.css';

/* DANS L'APP, LA FICHE MONTE EN FEUILLE SUR LA PHOTO (fondateur, 2026-10-16, « Proposition » de « Fiche d'un commerce »
 * dans mockups/tous-les-ecrans.html). La photo de couverture prend le haut de l'écran, bord à bord ; la page monte dessus
 * en feuille blanche aux coins arrondis, le logo posé à cheval ; la croix, la recherche et le cœur flottent en RONDS IRIS
 * par-dessus (blancs sur verre blanc dans la maquette, ils étaient illisibles sur une photo claire — retour du fondateur) ;
 * les sections passent dans une bande de verre où une lentille suit la section qu'on lit (CategoryQuickNav `verre`).
 * Même contenu, mêmes fonctions, même ordre que sur le site (styles dans ecran-fiche.css).
 * Le site a reçu la même famille le même jour, pensée pour un ordinateur (fiche-site, site-fiche.css) : voir le rendu
 * en bas de ce composant. */
const APPLI = experienceApp();

// Clé du jour (openingHours) → clé de traduction du nom du jour (resa.monday…).

// OUVERT OU FERMÉ, SELON LE COMMERCE ET PAS SEULEMENT SES HORAIRES : statutOuverture (openingHours.js), partagé avec la
// liste depuis l'audit du 19/10 (discovery-04).

/* Le document a-t-il été RECHARGÉ (F5, tirer pour rafraîchir) sur la fiche de ce commerce ? L'adresse est relevée au
   chargement du module, c'est-à-dire au démarrage de l'app (import statique dans App.jsx) ; la première fiche montée
   consomme la réponse, les suivantes sont des navigations. */
const CHEMIN_AU_CHARGEMENT = typeof window !== 'undefined' ? window.location.pathname : '';
let premiereFicheMontee = false;
function rechargementDeCettePage(id) {
  const premiere = !premiereFicheMontee;
  premiereFicheMontee = true;
  let recharge = false;
  try { recharge = performance.getEntriesByType('navigation')[0]?.type === 'reload'; } catch { /* API absente */ }
  let dernier = null;
  try { dernier = sessionStorage.getItem('fairide_last_restaurant_viewed'); } catch { /* sans stockage */ }
  return premiere && recharge && CHEMIN_AU_CHARGEMENT === `/restaurants/${id}` && dernier === id;
}

// Moyens de paiement au retrait (serveur : reseauxCommerce.js) → clé de leur libellé.
const LIBELLES_PAIEMENT = { especes: 'payEspeces', bancontact: 'payBancontact', carte: 'payCarte', payconiq: 'payPayconiq', titres_repas: 'payTitresRepas' };

// Huit commerces au hasard pour « À découvrir », sans celui-ci.
const tirerDecouvertes = (tous, id) => (tous || []).filter((r) => r.id !== id).sort(() => Math.random() - 0.5).slice(0, 8);

export default function RestaurantMenu() {
  const { id } = useParams();
  const { token, user, role } = useAuth();
  /* DÉJÀ LUE, LA FICHE S'OUVRE TOUT DE SUITE (2026-10-20, test de l'app Android avec Maestro Pizza : « lent à s'ouvrir »).
     Ce qui a été lu pendant la visite — au toucher de la carte dans la liste (prechargerFiche), ou lors d'un passage
     précédent — s'affiche dès la première image ; la relecture part quand même, et la fiche ne change que si la réponse
     diffère (cacheDonnees.js). Le jeton fait partie de la clé : une fiche lue connecté n'est pas resservie à un visiteur. */
  const [restaurant, setRestaurant] = useState(() => lireCache(`/restaurants/${id}`, token) || null);
  /* ENTRÉE PAR LA PHOTO (transitionPhoto.js) : la photo de la carte vient de grandir jusqu'en haut de l'écran, c'est déjà
     l'entrée de la fiche. La feuille qui remonte et le sceau qui saute (ecran-fiche.css) en faisaient une seconde, 0,45 s
     plus tard : deux entrées de suite, la fiche paraissait lente. Ouverte ainsi, la fiche est posée sans animation. */
  const [parPhoto] = useState(() => entreeParPhoto(id));
  // Commande groupée quittée depuis le bandeau : le bouton « Commande groupée » revient tout de suite.
  const [groupeQuitte, setGroupeQuitte] = useState(false);
  // Plafond de commandes du jour atteint (réglé par le commerce) : on le dit avant le panier, pas au paiement.
  const [complet, setComplet] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Incrémenté par « Réessayer » : il suffit qu'il change pour que l'effet de chargement reparte.
  const [essai, setEssai] = useState(0);
  const [reviews, setReviews] = useState(() => lireCache(`/restaurants/${id}/reviews`) || null);
  const [discover, setDiscover] = useState(() => tirerDecouvertes(lireCache('/restaurants'), id));
  // Le commerce pour lequel « À découvrir » a été tiré (null : pas encore tiré, la liste n'était pas gardée).
  const decouvertesPour = useRef(lireCache('/restaurants') ? id : null);
  // Le commerce affiché en ce moment : une réponse arrivée après un changement de fiche (« À découvrir ») est ignorée.
  const ficheCourante = useRef(id);
  // Un double appui sur « Commande groupée » créait deux groupes (audit du 19/10, CROSS-48).
  const groupeEnCreation = useRef(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(token ? lireCache('/restaurants/favorites/ids', token) || [] : []));
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
  // App sans compte : la barre d'app (Layout.jsx) colle en haut de l'écran, les ronds flottants et la bande des sections
  // collent juste dessous. Sa hauteur dépend du bouton qu'elle porte (marque ou Retour) : on la mesure.
  const pageRef = useRef(null);
  const [pickerItem, setPickerItem] = useState(null);
  // Article qu'on essayait d'ajouter quand le panier contenait déjà un autre commerce (voir addToCart) —
  // conservé le temps que l'utilisateur confirme ou annule le remplacement du panier.
  const [conflictItem, setConflictItem] = useState(null);
  // Panier d'un autre commerce que le client a accepté de remplacer : il ne l'est qu'AU MOMENT où le plat est ajouté
  // (addOne force=true), pas à l'ouverture de la fiche — fermer la fiche sans rien ajouter vidait quand même l'ancien
  // panier (audit du 15/10/2026).
  const [remplacerPanier, setRemplacerPanier] = useState(false);
  // Un seul avis « commerce fermé, ton panier est gardé » par visite de la fiche.
  const avertiFerme = useRef(false);
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
  useEffect(() => {
    if (!APPLI || !pageRef.current) return;
    const barre = document.querySelector('.appli-barre');
    if (barre) pageRef.current.style.setProperty('--fiche-haut', `${barre.offsetHeight}px`);
  }, [restaurant]);
  /* SUR LE SITE, LA PHOTO VA D'UN BORD À L'AUTRE DE LA ZONE DE LA PAGE. La page est rendue dans la colonne principale
     (.dashboard-main, connecté) ou dans le .wrap de 960px (visiteur), chacun avec sa marge intérieure : on MESURE de combien
     sortir de chaque côté au lieu de recopier ces marges ici — elles changent avec la largeur de l'écran, et vivent dans
     styles.css. Connecté : jusqu'aux bords de la colonne principale (la barre latérale reste à gauche) ; visiteur : jusqu'aux
     bords de la fenêtre. Mesuré avant l'affichage (pas de saut), puis à chaque changement de taille. */
  useLayoutEffect(() => {
    const racine = pageRef.current;
    if (APPLI || !racine) return undefined;
    const zone = racine.closest('main');
    if (!zone) return undefined;
    const tableau = zone.classList.contains('dashboard-main');
    const cadre = tableau ? zone : (zone.parentElement || zone);
    // La place « naturelle » de la page = sa boîte actuelle plus les débords déjà appliqués. Pas la boîte de son parent : la
    // marge négative du haut fusionne avec celle du parent (même bord, ni padding ni bordure), qui remonte avec elle — la
    // mesure retombait à 0 au tour suivant, et la page sautait de 24px en boucle.
    const applique = (nom) => parseFloat(racine.style.getPropertyValue(nom)) || 0;
    function poser(nom, valeur) {
      const v = `${Math.max(0, Math.round(valeur))}px`;
      if (racine.style.getPropertyValue(nom) !== v) racine.style.setProperty(nom, v);
    }
    function mesurer() {
      const r = racine.getBoundingClientRect();
      const c = cadre.getBoundingClientRect();
      const gauche = r.left + applique('--fiche-bord-g');
      const droite = r.right - applique('--fiche-bord-d');
      const haut = r.top + applique('--fiche-bord-h');
      poser('--fiche-bord-g', tableau ? gauche - c.left : gauche);
      poser('--fiche-bord-d', tableau ? c.right - droite : document.documentElement.clientWidth - droite);
      poser('--fiche-bord-h', haut - c.top);
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    obs?.observe(cadre);
    return () => { window.removeEventListener('resize', mesurer); obs?.disconnect(); };
  }, [restaurant]);
  // Ouvrir la loupe donne le clavier tout de suite : un champ qui apparaît et qu'il faut ensuite
  // toucher pour écrire dedans demande deux gestes là où on en attend un.
  useEffect(() => {
    if (rechercheOuverte) champRechercheRef.current?.focus();
  }, [rechercheOuverte]);
  // Calculé une seule fois, avant que l'effet ci-dessous ne mette sessionStorage à jour : distingue un
  // rafraîchissement de cette même page (F5) d'une vraie navigation vers un autre restaurant.
  /* UN VRAI RAFRAÎCHISSEMENT, PAS UNE SECONDE VISITE (fondateur, 2026-10-17 : « je descends, ça recharge très vite et ça
     me ramène en haut »). Le test était seulement « dernier commerce vu = celui-ci » : rouvrir le même commerce depuis la
     liste passait pour un F5, et la position mémorisée (souvent 0, le haut) était réappliquée pendant une seconde, par-dessus
     le défilement du client. Avec un seul commerce publié, c'était chaque visite après la première. (Invisible en
     développement : le double passage des effets de React StrictMode annulait les minuteurs.) Il faut maintenant que le
     navigateur ait réellement rechargé le document, sur cette adresse-ci, et que ce soit la première fiche montée. */
  const isRefreshRef = useRef(rechargementDeCettePage(id));
  const scrollRestoredRef = useRef(false);
  // Capturé une seule fois au montage, avant que l'effet de suivi du scroll ci-dessous ne puisse
  // écraser cette valeur (ex. suite à la restauration native du navigateur au rechargement).
  const savedScrollRef = useRef(sessionStorage.getItem(`fairide_scroll_${id}`));

  useEffect(() => {
    if (!isRefreshRef.current) {
      // Pas un rechargement : on oublie toute position sauvegardée lors d'une visite précédente. Le placement de la page
      // (en haut pour une nouvelle visite, à la position quittée pour un retour arrière) est l'affaire de ScrollRestorer :
      // le scrollTo(0, 0) qui était ici ramenait en haut au RETOUR du panier, contre la restauration (2026-10-17).
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
    // Fiche déjà gardée (cacheDonnees.js) : elle est à l'écran, la relecture se fait derrière. Si la relecture échoue, on
    // garde ce qu'on montre — sauf un 404 : le commerce a été retiré, la fiche ne doit plus s'afficher.
    /* CHANGER DE FICHE SANS GARDER L'ANCIENNE (audit du 19/10, CROSS-46). Une carte « À découvrir » ouvrait B alors que la
       carte de A restait affichée jusqu'à la réponse — un plat ajouté pendant ce temps était celui de A. On repart de ce
       qu'on sait de B (ou des squelettes), et une réponse tardive pour A ne remplace plus B. */
    ficheCourante.current = id;
    const pourCetteFiche = (fn) => (v) => { if (ficheCourante.current === id) fn(v); };
    const gardee = lireCache(`/restaurants/${id}`, token);
    setRestaurant(gardee || null);
    setReviews(lireCache(`/restaurants/${id}/reviews`) || null);
    setComplet(false);
    chargerAvecCache(`/restaurants/${id}`, { token }).then(pourCetteFiche(setRestaurant)).catch(pourCetteFiche((e) => { if (!gardee || e.status === 404) setErreur(e); }));
    // La capacité du jour (« complet ») change d'une commande à l'autre : toujours relue, jamais gardée.
    api(`/restaurants/${id}/capacity`).then(pourCetteFiche((c) => setComplet(!!c.full))).catch(() => {});
    chargerAvecCache(`/restaurants/${id}/reviews`).then(pourCetteFiche(setReviews)).catch(() => {});
    // « À découvrir » est tiré une fois par fiche : une relecture identique ne rebat pas la rangée sous les yeux.
    const tous = lireCache('/restaurants');
    if (tous && decouvertesPour.current !== id) { decouvertesPour.current = id; setDiscover(tirerDecouvertes(tous, id)); }
    chargerAvecCache('/restaurants').then((all) => {
      if (all === tous && decouvertesPour.current === id) return;
      decouvertesPour.current = id;
      setDiscover(tirerDecouvertes(all, id));
    }).catch(() => {});
    // Page publique (consultable sans compte, voir App.jsx) — inutile pour un visiteur anonyme.
    if (token) {
      const favoris = lireCache('/restaurants/favorites/ids', token);
      chargerAvecCache('/restaurants/favorites/ids', { token }).then((ids) => { if (ids !== favoris) setFavoriteIds(new Set(ids)); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, essai]);

  // Sauvegarde en continu la position de scroll pour pouvoir la restaurer après un rafraîchissement,
  // puisque le contenu (menu, avis...) se charge de façon asynchrone et décale la hauteur de la page.
  // La restauration native du navigateur est coupée une fois pour toutes par ScrollRestorer (2026-10-17). Elle l'était
  // ici, le temps de la fiche, puis RÉTABLIE en la quittant : après la visite d'un commerce, le navigateur se remettait à
  // replacer lui-même les pages au retour arrière, en concurrence avec ScrollRestorer, sur tout le site.
  // Écrite au plus toutes les 200 ms (2026-10-20, test de l'app Android) : elle partait à CHAQUE événement de défilement,
  // une écriture synchrone dans sessionStorage par image pendant qu'on parcourt la carte. La dernière position est de toute
  // façon écrite en quittant (pagehide, beforeunload, démontage).
  useEffect(() => {
    let minuteur = 0;
    function saveScroll() {
      clearTimeout(minuteur);
      minuteur = 0;
      try { sessionStorage.setItem(`fairide_scroll_${id}`, String(window.scrollY)); } catch { /* sans stockage */ }
    }
    function surDefilement() {
      if (!minuteur) minuteur = setTimeout(saveScroll, 200);
    }
    window.addEventListener('scroll', surDefilement, { passive: true });
    window.addEventListener('pagehide', saveScroll);
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener('scroll', surDefilement);
      window.removeEventListener('pagehide', saveScroll);
      window.removeEventListener('beforeunload', saveScroll);
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
          // Le client reprend la main (doigt, molette, clavier, clic) : on arrête de le replacer (defilementAuto.js).
          return repeterTantQueLibre(() => window.scrollTo(0, targetY), [0, 100, 300, 600, 1000]);
        }
      }
    }
  }, [restaurant, id]);

  // BOUTON GO (lancement.js côté serveur) : useLancement redessine la fiche au GO ou à la fermeture. Après GO, la livraison
  // n'est proposée que si un livreur est libre à l'instant (relu toutes les minutes) : sinon un bandeau le dit et
  // l'à emporter est choisi. Les comptes exemptés (équipe, test, simulation) ne sont pas concernés, comme côté serveur.
  useLancement();
  const [livraisonDispo, setLivraisonDispo] = useState(null);
  const verifierLivraison = !!restaurant?.offersDelivery && livraisonOuverte(user) && !exempteLancement(user);
  useEffect(() => {
    if (!verifierLivraison) { setLivraisonDispo(null); return undefined; }
    let fini = false;
    const lire = () => livraisonDisponible(id).then((d) => { if (!fini && d) setLivraisonDispo(d.available); });
    lire();
    const minuteur = setInterval(() => { if (document.visibilityState === 'visible') lire(); }, 60000);
    return () => { fini = true; clearInterval(minuteur); };
  }, [verifierLivraison, id]);

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
  // Chargement dans l'app : la fiche commence par sa photo, un aplat iris pâle la remplace en attendant (Skeleton.jsx).
  if (!restaurant) return experienceApp() ? <SqueletteEcran photo src={photoEnVol(id)} /> : <SkeletonCards count={3} />;

  const isFavorite = favoriteIds.has(id);
  const openStatus = statutOuverture(restaurant, now);
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
      // La copie gardée suit (cacheDonnees.js) : la liste montre le bon cœur dès le retour.
      modifierCache('/restaurants/favorites/ids', token, (ids) => (isFavorite ? ids.filter((x) => x !== id) : [...ids, id]));
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
  // Aucun livreur libre (après GO), ou livraison pas encore ouverte (avant le GO) : la bascule ne propose plus que l'à
  // emporter, quand le commerce le propose — la fiche s'ouvre alors sur « À emporter », pas sur une livraison impossible.
  const sansLivreur = livraisonDispo === false;
  // Adresse du compte au-delà de la distance de livraison du commerce (audit du 19/10, discovery-03) : même calcul que le
  // serveur (livraison.js) ; la fiche s'ouvre sur l'à emporter et le dit, au lieu du refus au devis.
  const horsZone = !!restaurant.offersDelivery && livraisonOuverte(user) && horsZoneLivraison(restaurant, user);
  const modesPossibles = [restaurant.offersDelivery && !((sansLivreur || horsZone || !livraisonOuverte(user)) && restaurant.offersPickup) && 'delivery', restaurant.offersPickup && 'pickup'].filter(Boolean);
  // Infos › Paiement : en ligne seulement après le GO ; sur place, ce que le commerce a dit accepter.
  const paiementEnLigne = paiementEnLigneOuvert(user);
  const paiementsSurPlace = restaurant.offersPickup && restaurant.pickupPaymentMode && restaurant.pickupPaymentMode !== 'online' ? (restaurant.paiementsSurPlace || []) : [];
  const modeActif = mode && modesPossibles.includes(mode) ? mode : modesPossibles[0];

  // Le choix est déposé pour le paiement, qui le relit au montage. sessionStorage et non un état
  // partagé : le mode appartient à cette visite-ci de cette fiche-ci, il n'a pas à survivre à la
  // fermeture de l'onglet ni à suivre l'utilisateur d'un commerce à l'autre.
  function choisirMode(m) {
    setMode(m);
    try { sessionStorage.setItem(`fairide_mode_${id}`, m); } catch { /* navigation privée : le paiement reprendra son défaut */ }
  }

  // Frais annoncés sur la fiche : le prix de DÉPART (livraison.js) — forfait ou frais propres du commerce, moins ce
  // qu'il offre. Le montant réel dépend de la distance et se calcule au serveur — d'où le « dès ».
  const q = requete.trim().toLowerCase();
  const menuFiltre = q
    ? restaurant.menu.filter((i) => {
        const loc = localizedItem(i, language);
        return `${loc.name} ${loc.desc || ''}`.toLowerCase().includes(q);
      })
    : restaurant.menu;
  const sectionsFiltrees = (restaurant.sections || []).filter((s) => menuFiltre.some((i) => (i.category || 'plat') === s.name));

  // Contrôles communs à l'ouverture de la fiche et à l'ajout direct par le « + ». Renvoie false si l'ajout est bloqué.
  function peutAjouter(item) {
    if (!user) {
      toast(t('restoMenuUi.toastLogin'));
      navigate('/login?audience=client', { state: { from: location.pathname } });
      return;
    }
    if (onlineOrderingDisabled) {
      toast(t('restoMenuUi.toastNoOnline'));
      return;
    }
    // Commerce fermé en ce moment : on laisse composer le panier (une commande programmée reste possible, et la
    // fiche promet « compose ton panier ») — avant, l'ajout était refusé sous un bandeau qui disait le contraire
    // (plan de test). Le checkout et le serveur refusent toujours une commande immédiate à un commerce fermé.
    // Fermé par son interrupteur (« Fermer jusqu'à ce que je rouvre ») : le serveur refuse aussi une commande programmée,
    // le toast ne la propose donc pas (audit du 19/10, checkout-04).
    if (!statutOuverture(restaurant, now).isOpen && !avertiFerme.current) {
      avertiFerme.current = true;
      toast(t(restaurant.open === false ? 'restoMenuUi.toastClosedByShopCartKept' : 'restoMenuUi.toastClosedCartKept'));
    }
    if (complet) {
      toast(t('restoMenuUi.toastFullToday'));
      return;
    }
    if (cart.hasConflict(id)) {
      setConflictItem(item);
      return;
    }
    return true;
  }

  function addToCart(item) {
    if (!peutAjouter(item)) return;
    // Toucher le PLAT ouvre sa fiche (photo en grand, description, options, quantité — voir FichePlat.jsx).
    // Le « + » posé dessus, lui, ajoute directement (ajoutDirect ci-dessous).
    setPickerItem(item);
  }

  // LE « + » AJOUTE TOUT DE SUITE (fondateur, 2026-10-01) : une unité, sans options, et le plat s'envole vers le
  // panier. Seule exception : un plat avec un choix OBLIGATOIRE (taille, sauce…) ouvre sa fiche — l'ajouter sans
  // ce choix donnerait une commande que le commerce ne peut pas préparer (le serveur la refuserait).
  function ajoutDirect(item, depuis, image) {
    if (!peutAjouter(item)) return;
    if ((item.optionGroups || []).some((g) => g.required)) { setPickerItem(item); return; }
    vibrer(14);
    envolerVersPanier({ depuis, image });
    cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: item.id, name: localizedItem(item, language).name, imageUrl: resolveItemImage(item, restaurant.sections), unitPrice: item.price, optionItemIds: [], optionsSnapshot: [], qty: 1 });
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
    setRemplacerPanier(true);
    setPickerItem(item);
  }

  // Le cœur est un rond flottant avec la croix et la loupe, dans l'app comme sur le site (2026-10-16).
  const coeur = (
    <FavoriteHeart active={isFavorite} busy={favoriteBusy} onClick={toggleFavorite} title={t('restaurantList.addFavorite')} className="favorite-heart--rond" />
  );
  // Les sections : sous l'en-tête, dans la feuille. Dans l'app, une bande de verre ; sur le site, une bande blanche pleine
  // où une pastille iris glisse d'une section à l'autre (`pouce`).
  const sectionsEtResultat = (
    <>
      <CategoryQuickNav categories={sectionsFiltrees} verre={APPLI} pouce={!APPLI} />
      {/* Le résultat d'une recherche, dit en clair (et annoncé aux lecteurs d'écran) : la carte filtrée seule ne disait
          pas que le tri avait eu lieu. Zéro résultat : le message « aucun plat » plus bas suffit. */}
      {q && menuFiltre.length > 0 && (
        <p className="fiche-recherche-resultat" role="status">
          {menuFiltre.length === 1 ? t('restaurantMenu.searchCountOne') : t('restaurantMenu.searchCount', { n: menuFiltre.length })}
        </p>
      )}
    </>
  );

  /* LA CROIX, LA LOUPE ET LE CŒUR, EN RONDS IRIS FLOTTANTS (`flottant`).
     Ils étaient d'abord un bandeau collant (croix, nom, recherche) au-dessus des sections : le BANDEAU D'ABORD, LES SECTIONS
     DESSOUS — la croix devait rester la sortie de la page, puisque les onglets du bas s'y effacent (Layout.jsx,
     EnteteFlux.jsx). Dans l'app (2026-10-16) puis sur le site (même jour, mockups/site-ordinateur.html) ils flottent sur la
     photo de couverture. Sur téléphone ils collent en haut de l'écran, la bande des sections juste dessous : c'est toujours
     la seule sortie. Sur un ordinateur, la barre latérale fait la navigation : ils partent avec la photo (site-fiche.css).
     La croix, et non une flèche : d'ici on SORT du parcours pour revenir à la liste. */
  const entete = (
    <EnteteFlux
      vers="/restaurants"
      geste="fermer"
      libelle={t('restaurantMenu.backToRestaurants')}
      titre={restaurant.name}
      titreEstompe={grandTitreVisible || rechercheOuverte}
      flottant
      actions={<>{restaurant.menu.length > 8 ? (
        rechercheOuverte ? (
          /* VALIDER LA RECHERCHE (retour du fondateur, 2026-10-14) : rien ne confirmait l'action — la touche Entrée ne
             faisait rien et le rond gris restait vide. « Voir les résultats » (ou Entrée) ferme le clavier et amène à la
             première section trouvée ; le nombre de plats s'affiche sous la barre des sections (fiche-recherche-resultat). */
          <form className="recherche-champ fiche-recherche" role="search" onSubmit={(e) => {
            e.preventDefault();
            champRechercheRef.current?.blur();
            document.querySelector('[id^="menu-cat-"]')?.scrollIntoView({ behavior: defilement(), block: 'start' });
          }}>
            <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={18} /></span>
            <input
              ref={champRechercheRef}
              type="search" enterKeyHint="search" value={requete} onChange={(e) => setRequete(e.target.value)}
              placeholder={t('restaurantMenu.searchDish')} aria-label={t('restaurantMenu.searchDish')}
            />
            {/* Fermer VIDE la recherche : replier le champ en gardant un filtre actif laisserait
                une carte amputée sans rien à l'écran pour dire pourquoi. Une croix, plus le rond « interdit ». */}
            <button
              type="button" className="recherche-effacer"
              onClick={() => { setRequete(''); setRechercheOuverte(false); }}
              aria-label={t('restaurantMenu.clearSearch')} title={t('restaurantMenu.clearSearch')}
            >
              <Icone nom="croix" taille={16} />
            </button>
            {requete.trim() && (
              <button type="submit" className="recherche-valider" aria-label={t('restaurantMenu.searchSubmit')} title={t('restaurantMenu.searchSubmit')}>
                <Icone nom="valider" taille={18} />
              </button>
            )}
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
      ) : null}{coeur}</>}
    />
  );

  /* L'EN-TÊTE SORT DE LA CARTE.
     Tout ce bloc vivait dans un <div className="card"> : un rectangle blanc cerné d'un filet,
     avec 24px de marge intérieure, dans lequel la photo devait déborder par des marges
     négatives de -22px pour paraître pleine largeur. Le contour n'apportait rien — il
     encadrait le sujet de la page, pas un élément parmi d'autres — et le débordement était
     un contournement de ce contour. Les deux partent ensemble.
     Le bandeau existe toujours : sans photo de couverture (ou si elle ne charge pas), c'est un visuel aux
     couleurs de Fairide (VisuelVide) qui tient la place — plus de bloc gris qui ressemble à une image cassée.
     Sur le site, la photo va d'un bord à l'autre de la colonne de la page : on la demande donc plus large. */
  const couverture = (
    <>
      <VisuelVide nom={restaurant.name} cuisine={restaurant.cuisine} taille="bandeau" className="fiche-couverture-vide" />
      {restaurant.coverImageUrl && (APPLI
        ? <CouvertureAppli url={restaurant.coverImageUrl} petite={photoEnVol(id)} alt={restaurant.name} />
        : <img {...imgProps(restaurant.coverImageUrl, 1200, '100vw')} alt={restaurant.name} className="fiche-couverture" fetchPriority="high" decoding="async" onError={cacherImageCassee} />)}
    </>
  );
  const logo = restaurant.logoImageUrl && <img {...imgProps(restaurant.logoImageUrl, 96)} alt="" className="fiche-logo" decoding="async" onError={cacherImageCassee} />;

  // Les frais, selon le mode. Le panneau gris de l'app est inchangé ; sur le site, les mêmes faits en colonnes « valeur /
  // libellé » à droite de la bascule (mockups/site-ordinateur.html). Rien de plus n'y est dit (voir le panneau ci-dessous).
  const fraisLivraison = modeActif === 'pickup'
    ? t('restaurantMenu.feePickup')
    : restaurant.freeDelivery
      ? t('restaurantMenu.feeFree')
      : t('restaurantMenu.feeFrom', { amount: euros(tarifLivraison(restaurant).depart) }); // « from €5.00 » en anglais (LIVE-14)
  /* Le panneau gris des frais. Il dit « dès » parce que DELIVERY_FEE est une estimation
     forfaitaire côté client : le montant exact dépend de la distance et se calcule au
     serveur, exactement comme l'annonce déjà le paiement. Aucun délai d'arrivée n'y figure : le
     commerce règle son temps de préparation (backend migration 041), mais le trajet dépend de
     l'adresse, inconnue ici — l'heure estimée n'existe qu'une fois la commande passée. La maquette du site
     montrait une « Estimation » en minutes : pas reprise, pour la même raison (et le délai de préparation
     n'est pas dans la fiche publique). */
  /* LE BOUTON « COMMANDE GROUPÉE » (pages/client/CommandeGroupee.jsx) : compte client exigé, comme pour commander. Sur le site,
     une pastille à filet iris sous la description ; dans l'app (version B), un lien court sur la rangée de la bascule. */
  const boutonGroupe = user && !onlineOrderingDisabled && !(String(groupeEnCours()?.restaurantId) === String(restaurant.id) && !groupeQuitte) && (
    <button type="button" className={APPLI ? 'fiche-groupe-lien' : 'eg-bouton-iris eg-depart'} aria-label={t('groupOrder.start')} onClick={async () => {
      if (groupeEnCreation.current) return;
      groupeEnCreation.current = true;
      try {
        const g = await api('/group-orders', { method: 'POST', token, body: { restaurantId: restaurant.id } });
        navigate(`/groupe/${g.code}`);
      } catch (e) { toast(e.message, 'erreur'); } finally { groupeEnCreation.current = false; }
    }}>
      <Icone nom="personnes" taille={17} />{APPLI ? t('groupOrder.startShort') : t('groupOrder.start')}
    </button>
  );
  /* LE TICKET DE L'APP (fondateur, 2026-10-17, version B de « Fiche du commerce » dans mockups/commerces-marque.html) : la
     note, la distance et le prix de la livraison, en trois cases séparées par des pointillés, sous le nom. La distance est
     celle de chez toi quand l'adresse du compte est connue, sinon le rayon de livraison choisi par le commerce ; le prix est
     le même « dès » qu'avant (estimation, le montant exact se calcule au serveur). Le minimum de commande reste dit dessous. */
  const distanceKm = user?.lat && user?.lng && restaurant.lat && restaurant.lng ? haversineDistanceKm(user.lat, user.lng, restaurant.lat, restaurant.lng) : null;
  const kmTexte = (v) => (v < 10 ? Number(v).toFixed(1) : String(Math.round(v))).replace('.', ',');
  const ticket = APPLI && (
    <>
      <div className="fiche-ticket">
        <div>
          <b>{restaurant.reviewCount > 0 ? <><Icone nom="etoile" taille={14} />{Number(restaurant.rating).toFixed(1).replace('.', ',')}</> : t('restaurantList.newBadge')}</b>
          <small>{restaurant.reviewCount > 0 ? t('restaurantMenu.ticketReviews', { n: restaurant.reviewCount }) : t('restaurantMenu.ticketNoReviews')}</small>
        </div>
        {distanceKm != null ? (
          <div><b>{kmTexte(distanceKm)} km</b><small>{t('restaurantMenu.ticketFromYou')}</small></div>
        ) : restaurant.deliveryRadiusKm != null && modeActif !== 'pickup' && !onlineOrderingDisabled ? (
          <div><b>{t('siteFiche.radiusValue', { km: String(restaurant.deliveryRadiusKm).replace('.', ',') })}</b><small>{t('siteFiche.radiusLabel')}</small></div>
        ) : null}
        {!onlineOrderingDisabled && (
          <div><b>{fraisLivraison}</b><small>{modeActif === 'pickup' ? t('restaurantMenu.feePickupLabel') : t('restaurantMenu.feeLabel')}</small></div>
        )}
      </div>
      {/* Montant minimum choisi par le commerce (PAN-3), annoncé avant de composer le panier. */}
      {!onlineOrderingDisabled && restaurant.minOrderAmount > 0 && (
        <p className="fiche-ticket-note">{t('restoMenuUi.minOrder', { amount: euros(restaurant.minOrderAmount) })}</p>
      )}
    </>
  );
  /* APERÇU DE LA CARTE (app, version B) : une rangée des plats qui ont leur propre photo, dans l'ordre de la carte. La
     maquette disait « Populaires » ; Fairide ne publie aucune donnée de ventes par plat, donc le titre ne promet rien de
     tel. Toucher un plat ouvre sa fiche, le « + » l'ajoute comme sur la carte. Rien pendant une recherche dans la carte. */
  const apercu = APPLI && !q ? restaurant.menu.filter((i) => i.imageUrl && i.available !== false).slice(0, 8) : [];
  const apercuCarte = apercu.length >= 3 && (
    <section className="fiche-apercu" aria-labelledby="fiche-apercu-titre">
      <h2 className="fiche-apercu-titre" id="fiche-apercu-titre">{t('restaurantMenu.menuPreview')}</h2>
      <div className="fiche-apercu-rangee">
        {apercu.map((item) => {
          const { name } = localizedItem(item, language);
          const remise = prixRemise(item);
          const prix = euros(remise !== null && remise < item.price ? remise : item.price);
          return (
            <div className="fiche-apercu-plat" key={item.id}>
              <button type="button" className="fiche-apercu-bouton" onClick={() => addToCart(item)} disabled={onlineOrderingDisabled} aria-label={`${name}, ${prix}`}>
                <span className="fiche-apercu-photo"><img loading="lazy" decoding="async" {...imgProps(item.imageUrl, 320)} alt="" onError={cacherImageCassee} /></span>
                <b>{name}</b>
                <span>{prix}</span>
              </button>
              {!onlineOrderingDisabled && (
                <button type="button" className="fiche-apercu-plus" onClick={(e) => ajoutDirect(item, e.currentTarget.getBoundingClientRect(), item.imageUrl)} aria-label={t('menuCategories.quickAdd', { name })}>
                  <span aria-hidden="true">+</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
  // Dans l'app, les frais, la distance et le minimum sont dans le ticket (version B, ci-dessus).
  const panneauFrais = onlineOrderingDisabled ? null : APPLI ? null : (
    <div className="fiche-frais">
      <span><b>{fraisLivraison}</b><small>{modeActif === 'pickup' ? t('restaurantMenu.feePickupLabel') : t('restaurantMenu.feeLabel')}</small></span>
      {modeActif !== 'pickup' && restaurant.deliveryRadiusKm != null && (
        <span><b>{t('siteFiche.radiusValue', { km: String(restaurant.deliveryRadiusKm).replace('.', ',') })}</b><small>{t('siteFiche.radiusLabel')}</small></span>
      )}
      {restaurant.minOrderAmount > 0 && (
        <span><b>{euros(restaurant.minOrderAmount)}</b><small>{t('siteFiche.minimumLabel')}</small></span>
      )}
    </div>
  );

  /* Tout ce qui suit la photo jusqu'à la carte, en deux morceaux : `identite` (nom, note, état d'ouverture, description) et
     `pratique` (commande groupée, mode, frais, offres, annonces). Le site les met l'un après l'autre dans l'en-tête de sa
     colonne de gauche ; l'app (version C, 2026-10-17) pose l'identité sur le bandeau iris et la pratique dans la feuille. */
  const identite = (
    <>
      <div className="fiche-titre-ligne">
        {/* h1 et non h2 : la fiche est la page la plus importante du site pour le
            référencement et n'avait aucun titre de niveau 1. Son sujet est le commerce. */}
        <h1 className="fiche-nom" ref={titreRef}>
          <span>{restaurant.name}</span>
          {restaurant.certified && <CertifiedBadge size={20} />}
        </h1>
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
        {/* Dans l'app, la note est dans le « ticket » sous le nom (version B) : pas deux fois. */}
        {!APPLI && (restaurant.reviewCount > 0 ? (
          <>
            <span className="fiche-meta-note"><StarsDisplay value={restaurant.rating} size={13} /></span>
            <span>{t('restaurantMenu.ratingReviews', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount })}</span>
          </>
        ) : (
          <span>{t('restaurantList.newBadge')}</span>
        ))}
        {/* Dans l'app, la cuisine en tête de ligne (« Pizza · Ixelles »), comme dans la maquette retenue. */}
        {APPLI && restaurant.cuisine && <span>{restaurantTypeLabel(restaurant.cuisine, t) || restaurant.cuisine}</span>}
        {restaurant.commune && <><span aria-hidden="true">·</span><span>{restaurant.commune}</span></>}
        {/* Prix vérifiés en magasin, sans hausse (PrixComptoir.jsx) : un fait sur ce commerce, jamais la commission. */}
        {restaurant.prixComptoir && <><span aria-hidden="true">·</span><PrixComptoir /></>}
        <span aria-hidden="true">·</span>
        <button type="button" className="fiche-infos-lien" onClick={() => setInfosOuvertes(true)}>
          {t('restaurantMenu.infoButton')}
        </button>
      </p>
      {/* ÉTAT D'OUVERTURE EN UNE LIGNE (refonte du 2026-09-29) : un point vert ou rouge, « Ouvert · horaires du jour »
          ou « Fermé · ouvre dans… ». C'était un grand encadré rouge qui, empilé avec l'offre et l'annonce d'ouverture,
          repoussait la carte sous la ligne de flottaison. La fermeture exceptionnelle garde son encadré au-dessus. */}
      {restaurant.hours && !openStatus.isExceptionalClosure && (
        <p className={`fiche-statut ${openStatus.isOpen ? 'est-ouvert' : 'est-ferme'}`}>
          <span className="fiche-statut-point" aria-hidden="true" />
          <b>{openStatus.isOpen ? t('restoMenuUi.statusOpen') : t('restoMenuUi.statusClosed')}</b>
          <span className="fiche-statut-detail">
            {openStatus.isOpen
              ? formatDaySchedule(restaurant.hours, openStatus.todayKey, t)
              : openStatus.opensToday
                ? t('restoMenuUi.opensIn', { countdown: formatCountdown(openStatus.opensAt - now, t), time: openStatus.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
                : openStatus.fermePourLaJournee
                  ? t('restaurantMenu.closedForToday', { time: openStatus.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
                : openStatus.fermeParLeCommerce
                  ? t('restoMenuUi.closedForNow')
                  : t('restoMenuUi.nextOpening', { day: dayLabel(openStatus.opensDayKey, t), schedule: formatDaySchedule(restaurant.hours, openStatus.opensDayKey, t) })}
          </span>
        </p>
      )}

      {restaurant.desc && <p className="fiche-desc">{restaurant.desc}</p>}
    </>
  );
  const pratique = (
    <>
      {/* Commande groupée (pages/client/CommandeGroupee.jsx) : le bandeau quand on compose sa part, sinon le bouton
          pour en ouvrir une — compte client exigé, comme pour commander. Le bouton est secondaire (pastille à filet iris,
          ecran-equipe-groupe.css) : la lime de la fiche reste au panier. */}
      <BandeauGroupe restaurantId={restaurant.id} onQuitter={() => setGroupeQuitte(true)} />
      {!APPLI && boutonGroupe}

      {/* La bascule et les frais sur une même rangée entre deux filets (.fiche-faits), dans l'app comme sur le site. */}
      <div className="fiche-faits">
      {/* BASCULE LIVRAISON / À EMPORTER, affichée seulement quand les deux existent. Un pouce iris glisse sous le mode
          choisi (.fiche-modes-pouce). */}
      {modesPossibles.length > 1 && (
        <div className="fiche-modes" role="group" aria-label={t('restaurantMenu.modeLabel')} data-mode={modeActif}>
          <span className="fiche-modes-pouce" aria-hidden="true" />
          <button type="button" className={modeActif === 'delivery' ? 'est-actif' : ''} aria-pressed={modeActif === 'delivery'} onClick={() => choisirMode('delivery')}>
            {t('restaurantMenu.modeDelivery')}
          </button>
          <button type="button" className={modeActif === 'pickup' ? 'est-actif' : ''} aria-pressed={modeActif === 'pickup'} onClick={() => choisirMode('pickup')}>
            {t('restaurantMenu.modePickup')}
          </button>
        </div>
      )}
      {panneauFrais}
      {/* App (version B) : « À plusieurs » à côté de la bascule. */}
      {APPLI && boutonGroupe}
      </div>

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
                ? t('restaurantMenu.fairideAdvantageAmount', { name: restaurant.name, v: `${Number(restaurant.fairideAdvantage.value).toFixed(2).replace('.', ',').replace(/,00$/, '')} €` })
                : t('restaurantMenu.fairideAdvantagePercent', { name: restaurant.name, v: restaurant.fairideAdvantage.value })}</span>
            )}
            {restaurant.hasPromo && !restaurant.fairideAdvantage && <span>{t('restaurantMenu.promoBanner')}</span>}
            {(restaurant.freeDelivery || restaurant.freeDeliveryMinOrder != null || restaurant.deliveryFeeDiscount > 0) && (
              <span>{restaurant.freeDelivery
                ? t('restoMenuUi.freeDeliveryBy', { name: restaurant.name })
                : restaurant.freeDeliveryMinOrder != null
                  ? t('restoMenuUi.freeDeliveryFrom', { name: restaurant.name, min: euros(restaurant.freeDeliveryMinOrder) })
                  : t('restoMenuUi.deliveryDiscountBy', { name: restaurant.name, amount: euros(restaurant.deliveryFeeDiscount) })}</span>
            )}
          </div>
        </div>
      )}

      {complet && (
        <div className="closed-banner" role="status">
          <div className="closed-banner-title">{t('restoMenuUi.fullTodayTitle')}</div>
          <p className="small" style={{ margin: 0 }}>{t('restoMenuUi.fullTodayText', { name: restaurant.name })}</p>
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
      {/* Avant le 1er novembre : à emporter et livraison à venir ; du 1er novembre au GO : seule la livraison (et l'à emporter payé
          en ligne) attend. Rien n'est annoncé pour un commerce qui ne propose aucun service en ligne, et l'à emporter
          n'est promis que s'il se paie sur place (le paiement en ligne ouvre avec la livraison). */}
      {bandeauOuverture && (
        <div className={`ouverture-bandeau fiche-info${APPLI ? ' fiche-info--route' : ''}`} role="status">
          <span className="fiche-info-icone" aria-hidden="true"><Icone nom="horloge" taille={18} /></span>
          <span>
          {!emporterSurPlace
            ? t('restaurantMenu.ordersOpenBannerOnlineOnly')
            : commandesOuvertes(user)
              ? t('restaurantMenu.ordersOpenBannerResaOpen')
              : restaurant.offersDelivery
                ? t('restaurantMenu.ordersOpenBanner', { dateResa: dateOuvertureEmporter(getLocale()) })
                : t('restaurantMenu.ordersOpenBannerPickupOnly', { date: dateOuvertureEmporter(getLocale()) })}
          </span>
          {/* App (version B) : l'annonce roule sur la route du vélo. */}
          {APPLI && <span className="fiche-info-route" aria-hidden="true"><span className="fiche-info-velo"><VeloMarque largeur={26} /></span></span>}
        </div>
      )}
      {/* Après GO, aucun livreur libre à l'instant : seul l'à emporter est possible (relu toutes les minutes). */}
      {sansLivreur && !bandeauOuverture && (
        <div className="ouverture-bandeau fiche-info" role="status">
          <span className="fiche-info-icone" aria-hidden="true"><Icone nom="velo" taille={18} /></span>
          <span>{t('restaurantMenu.noCourierBanner')}</span>
        </div>
      )}
      {/* Hors zone de livraison (audit du 19/10, discovery-03) : la distance du commerce et celle de l'adresse du compte. */}
      {horsZone && !bandeauOuverture && (
        <div className="ouverture-bandeau fiche-info" role="status">
          <span className="fiche-info-icone" aria-hidden="true"><Icone nom="velo" taille={18} /></span>
          <span>{t('restaurantMenu.outOfZoneBanner', { radius: String(restaurant.deliveryRadiusKm).replace('.', ','), distance: String(distanceLivraisonKm(restaurant, user)).replace('.', ',') })}</span>
        </div>
      )}
      {/* Livraison Fairide coupée dans la zone par l'équipe (08/10) : le client sait que seul l'à emporter est possible ici. */}
      {restaurant.fairideDeliveryDisabled && restaurant.offersPickup && (
        <div className="ouverture-bandeau fiche-info" role="status">
          <span className="fiche-info-icone" aria-hidden="true"><Icone nom="velo" taille={18} /></span>
          <span>{t('restaurantMenu.deliveryUnavailableZone')}</span>
        </div>
      )}
    </>
  );
  const infos = <>{identite}{pratique}</>;

  /* LA CARTE. La recherche vit dans les ronds flottants, derrière la loupe : elle occupait ici une ligne entière et partait
     au défilement comme le reste — or c'est en descendant dans une longue carte qu'on se met à chercher, pas en arrivant.
     Le seuil de 8 plats et l'habillage (.recherche-champ, celui de la recherche du site) ne changent pas. */
  const carte = (
    <>
      {onlineOrderingDisabled && (
        <div className="fiche-info">
          <span className="fiche-info-icone" aria-hidden="true"><Icone nom="horloge" taille={18} /></span>
          <span>{t('restoMenuUi.orderingNotOpenInfo')}</span>
        </div>
      )}
      <div className="fiche-carte-plats">
        {restaurant.menu.length === 0 && <div className="empty">{t('restaurantMenu.noMenuYet')}</div>}
        {restaurant.menu.length > 0 && menuFiltre.length === 0 && (
          <p className="small" style={{ margin: 0 }}>{t('restaurantMenu.noDishMatch', { q: requete })}</p>
        )}
        <MenuCategorySections menu={menuFiltre} sections={sectionsFiltrees} onAdd={addToCart} onQuickAdd={ajoutDirect} hideAdd={onlineOrderingDisabled} bistrot={APPLI} />
      </div>
    </>
  );

  const avis = reviews && reviews.reviews.length > 0 && (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('restaurantMenu.reviewsTitle')}</h3>
      {reviews.reviews.map((r, i) => (
        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--cream-dim)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 13 }}>{r.clientName}</b>
            <StarsDisplay value={r.foodRating} />
          </div>
          {/* De quoi parle l'avis (plats, commune de livraison) et qui a répondu (audit design 2, idée 11f). */}
          <ContexteAvis avis={r} />
          {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
          {r.restaurantReply && (
            <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--teal)' }}>
              <div className="small" style={{ fontWeight: 700 }}>{t('restaurantMenu.reviewReplyFrom', { name: restaurant.name })}</div>
              <p className="small" style={{ margin: '2px 0 0' }}>{r.restaurantReply}</p>
              <SignatureReponse signature={reviews.signature} />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const fenetres = (
    <>
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
          onCancel={() => { setPickerItem(null); setRemplacerPanier(false); }}
          onConfirm={(optionItemIds, snapshot, unitPrice, qty, note) => {
            // Le nom enregistré est le nom TRADUIT, comme lors d'un ajout direct : l'ancienne
            // fenêtre gardait `pickerItem.name`, donc un panier en néerlandais pouvait afficher des
            // plats en français selon la façon dont on les avait ajoutés.
            // Même image que la fiche et que la carte : sinon le panier affichait le carré gris de
            // repli pour un plat dont on venait de voir la photo en grand.
            cart.addOne({ restaurantId: id, restaurantName: restaurant.name, itemId: pickerItem.id, name: localizedItem(pickerItem, language).name, imageUrl: resolveItemImage(pickerItem, restaurant.sections), unitPrice, optionItemIds, optionsSnapshot: snapshot, qty, note, force: remplacerPanier });
            setPickerItem(null);
            setRemplacerPanier(false);
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
                {/* La commune seulement si l'adresse ne la contient pas déjà (« …, 1060 Saint-Gilles, Saint-Gilles »). */}
                <p className="small">{[restaurant.address, restaurant.address && restaurant.commune && restaurant.address.toLowerCase().includes(restaurant.commune.toLowerCase()) ? '' : restaurant.commune].filter(Boolean).join(', ')}</p>
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

            {/* Réseaux du commerce (2026-10-18, facultatifs, Mon commerce › Contact) : deux liens sur une ligne, rien s'il n'y en a pas. */}
            {(restaurant.instagram || restaurant.facebook) && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="personnes" taille={16} />{t('restaurantMenu.socialLabel')}</h4>
                <p className="small fiche-infos-reseaux">
                  {restaurant.instagram && <a href={urlSure(restaurant.instagram)} target="_blank" rel="noreferrer"><Icone nom="instagram" taille={16} />Instagram</a>}
                  {restaurant.facebook && <a href={urlSure(restaurant.facebook)} target="_blank" rel="noreferrer"><Icone nom="facebook" taille={16} />Facebook</a>}
                </p>
              </section>
            )}

            {/* Paiement (2026-10-18). En ligne : celui de Fairide (Bancontact et carte, routes/payments.js côté serveur). Sur
                place : seulement quand le commerce permet de payer au retrait et a dit ce qu'il accepte (Mon compte › Services). */}
            {(restaurant.offersDelivery || restaurant.offersPickup) && (paiementEnLigne || paiementsSurPlace.length > 0) && (
              <section className="fiche-infos-bloc">
                <h4><Icone nom="euro" taille={16} />{t('restaurantMenu.paymentLabel')}</h4>
                {paiementEnLigne && <p className="small">{t('restaurantMenu.paymentOnline')}</p>}
                {paiementsSurPlace.length > 0 && (
                  <p className="small">{t('restaurantMenu.paymentOnSite', { list: paiementsSurPlace.map((p) => t(`restaurantMenu.${LIBELLES_PAIEMENT[p] || 'payCarte'}`)).join(', ') })}</p>
                )}
              </section>
            )}

          <div className="modal-pied">
            {/* Fermer n'est pas une étape : contour, pas lime (audit du 15/10/2026, « une pointe de lime par vue »). */}
            <button type="button" className="btn-outline" onClick={() => setInfosOuvertes(false)}>{t('common.close')}</button>
          </div>
        </Modale>
      )}

      {/* Panier d'un autre commerce : la feuille de confirmation commune (ConfirmDialog), qui dit en clair ce qui sera
          retiré. C'était une Modale montée à la main, avec un bouton `btn-teal` sans style sur un <button>. */}
      <ConfirmDialog
        open={!!conflictItem}
        icone="commandes"
        title={t('floatingCart.conflictTitle')}
        message={t('floatingCart.conflictMessage', { restaurant: cart.restaurantName })}
        detail={t('floatingCart.conflictDetail', { restaurant: cart.restaurantName })}
        confirmLabel={t('floatingCart.conflictConfirm')}
        cancelLabel={t('floatingCart.conflictCancel')}
        onConfirm={confirmSwitchRestaurant}
        onCancel={() => setConflictItem(null)}
      />
    </>
  );

  const decouvrir = discover.length > 0 && <DiscoverSection restaurants={discover} t={t} user={user} />;

  /* LA FICHE DANS L'APP, VERSION B « SCEAU ET TICKET » (fondateur, 2026-10-17, mockups/commerces-marque.html ; il avait
     d'abord retenu C, puis précisé « B, mais je garde les pointillés de la carte »). La photo de couverture bord à bord ; la
     feuille blanche monte dessus avec, à cheval sur son bord, le SCEAU du commerce — son logo, ou son initiale sur un carré
     lime. Sous le nom : le ticket (note, distance, livraison), la bascule et « À plusieurs », l'annonce d'ouverture sur la
     route du vélo, puis l'aperçu des plats en photo. La carte garde ses pointillés (MenuCategorySections `bistrot`).
     Mêmes contenus et mêmes fonctions qu'avant ; styles dans ecran-fiche.css. */
  if (APPLI) {
    const sceau = restaurant.logoImageUrl
      ? <span className="fiche-sceau fiche-sceau--logo" aria-hidden="true"><img {...imgProps(restaurant.logoImageUrl, 160)} alt="" decoding="async" onError={cacherImageCassee} /></span>
      : <span className="fiche-sceau" aria-hidden="true">{String(restaurant.name || '').trim().charAt(0).toUpperCase()}</span>;
    return (
      <div className={`fiche-page fiche-appli${parPhoto ? ' fiche-appli--sans-entree' : ''}`} ref={pageRef}>
        {entete}
        <header className="fiche-entete fiche-entete--sceau">
          <div className="fiche-media">{couverture}</div>
          {/* La feuille blanche qui monte sur la photo, le sceau à cheval sur son bord. */}
          <div className="fiche-feuille">{sceau}{identite}{ticket}{pratique}</div>
        </header>
        {apercuCarte}
        {sectionsEtResultat}
        {carte}
        {/* Vendeur (A8) : toujours affiché avant la commande, sans clic, sous la carte plutôt qu'entre l'en-tête et les plats. */}
        <FicheVendeur restaurant={restaurant} />
        {avis}
        {decouvrir}
        {fenetres}
      </div>
    );
  }

  /* SUR LE SITE (fondateur, 2026-10-16, « Proposition » de « Page d'un commerce » dans mockups/site-ordinateur.html) : la
     photo d'un bord à l'autre de la page, la feuille blanche qui monte dessus avec le logo à cheval, puis deux colonnes — à
     gauche l'en-tête, la bande des sections (blanche, collante) et la carte sur deux colonnes de plats ; à droite le panier,
     collant (PanierColonne). Sur un téléphone, une seule colonne et la barre du panier en bas (FloatingCart). Mise en page
     dans site-fiche.css ; la page reprend la largeur de sa zone (--fiche-bord-*, mesurées plus haut). Le panier en colonne
     n'a de sens que pour qui peut commander : pas pour un livreur, un commerce ou l'équipe venus regarder la fiche. */
  const avecPanier = !user || (!user.isAdmin && role === 'client');
  return (
    // --compact : le grand titre a quitté l'écran — sur téléphone, un aplat blanc passe derrière les ronds collants.
    <div className={`fiche-page fiche-site${avecPanier ? ' fiche-site--panier' : ''}${grandTitreVisible ? '' : ' fiche-site--compact'}`} ref={pageRef}>
      {entete}
      <div className="fiche-couv">{couverture}</div>
      <div className="fiche-site-feuille">
        <div className="fiche-site-grille">
          <div className="fiche-site-gauche">
            <header className={`fiche-entete${restaurant.logoImageUrl ? ' fiche-entete--logo' : ''}`}>
              {logo}
              {infos}
            </header>
            {sectionsEtResultat}
            {carte}
            {/* Vendeur (A8) : toujours affiché avant la commande, sans clic, sous la carte. */}
            <FicheVendeur restaurant={restaurant} />
            {avis}
          </div>
          {avecPanier && <PanierColonne restaurant={restaurant} mode={modeActif} />}
        </div>
        {decouvrir}
      </div>
      {fenetres}
    </div>
  );
}

/* LA COUVERTURE DE L'APP, SANS SECOND TÉLÉCHARGEMENT VISIBLE (2026-10-20, test de l'app Android). La carte de la liste
   avait déjà sa photo (480 à 800 px, dans le cache du navigateur) ; la fiche demandait la même en 960 à 1 920 px et montrait
   le visuel de marque le temps qu'elle arrive. Ouverte depuis la carte (`petite`, transitionPhoto.js), la fiche montre
   d'abord la photo de la carte, tout de suite, et passe à la grande une fois celle-ci chargée ET décodée — l'échange de
   `src` se fait sans trou : le navigateur garde l'ancienne image jusqu'à ce que la nouvelle soit prête. Sans `petite` (lien
   direct, retour arrière), la grande seule, comme avant. */
function CouvertureAppli({ url, petite, alt }) {
  const grande = imgProps(url, 960, '(max-width: 960px) 100vw, 960px');
  const [src, setSrc] = useState(petite);
  useEffect(() => {
    if (!petite) return undefined;
    let fini = false;
    const img = new Image();
    img.decoding = 'async';
    img.sizes = grande.sizes;
    if (grande.srcSet) img.srcset = grande.srcSet;
    img.src = grande.src;
    img.decode().then(() => { if (!fini) setSrc(img.currentSrc || img.src); }).catch(() => { /* la petite reste */ });
    return () => { fini = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, petite]);
  if (!petite) return <img {...grande} alt={alt} className="fiche-couverture" fetchPriority="high" decoding="async" onError={cacherImageCassee} />;
  return <img src={src} alt={alt} className="fiche-couverture" decoding="async" onError={cacherImageCassee} />;
}

// Un visiteur arrivé par un lien partagé voit cette rangée, mais ouvrir un AUTRE commerce depuis Fairide demande un compte
// (murCompte.js) : la fiche partagée reste publique, la suivante non.
function DiscoverSection({ restaurants, t, user }) {
  return (
    <div className="fiche-decouvrir" style={{ marginTop: 18, marginBottom: 18 }}>
      <h3 className="section-title" style={{ fontSize: 16 }}>{t('restaurantMenu.discoverTitle')}</h3>
      <AutoScrollRow
        items={restaurants}
        keyFor={(r) => r.id}
        className="discover-track"
        renderItem={(r, i, key) => (
          <Link key={key} {...lienFiche(user, r.id)} className="discover-card">
            {/* Le visuel de marque sous la photo : un commerce sans photo (ou dont la photo casse) garde une vignette. */}
            <span className="discover-card-media">
              <VisuelVide nom={r.name} cuisine={r.cuisine} />
              {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 320)} alt={r.name} onError={cacherImageCassee} />}
            </span>
            <div className="info">
              <b>{r.name}</b>
              <span className="small">{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune].filter(Boolean).join(' · ')}</span>
            </div>
          </Link>
        )}
      />
    </div>
  );
}
