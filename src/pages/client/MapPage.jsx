import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import { RESTAURANT_TYPES, restaurantTypeLabel, haversineDistanceKm } from '../../menuCategories';
import Icone from '../../components/Icone';

const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));

// La carte des commerces.
//
// CET ONGLET MONTRAIT LE SUIVI DE LIVRAISON. C'était le mauvais contenu derrière la bonne icône :
// on clique sur une carte pour explorer un quartier — voir qui est ouvert, qui fait une promo, ce
// qu'il y a à deux rues — pas pour regarder un livreur avancer. Le suivi vit dans « Mes commandes ».
//
// DEUX BANDEAUX FLOTTAIENT ICI, l'un vers le suivi de livraison, l'autre vers les jeux. Ils se
// posaient par-dessus la carte, c'est-à-dire par-dessus le contenu qu'on venait voir, pour mener
// ailleurs. Les deux sont partis : ce qu'ils annonçaient vit sur « Mes commandes », à côté de la
// commande concernée, qui est le seul endroit où cette information a un sens.
//
// RIEN QUE LA CARTE. Elle occupait la première hauteur d'écran et un tiroir « Commerces près de
// toi » se tirait par-dessus, à trois hauteurs. Ce tiroir répétait la liste de /restaurants, qui
// la montre mieux — avec ses rangées de sections, ses filtres et ses photos en grand — sur une
// page faite pour ça. Deux listes des mêmes commerces à deux endroits, c'est une de trop, et
// c'est celle qui recouvrait la carte qui part. Ici il reste une carte, et ce qui flotte dessus.

// Bandes de prix, calculées sur le prix MÉDIAN des plats de la carte.
//
// Aucune colonne « niveau de prix » n'existe en base, et il n'était pas question d'en inventer une :
// un € affiché au jugé serait faux pour la moitié des commerces. La médiane des prix réellement
// pratiqués, elle, est une mesure — et les cartes complètes arrivent déjà avec la liste
// (GET /restaurants), donc ça ne coûte aucun appel de plus. Les seuils sont posés sur la
// distribution observée : friteries et cafés autour de 4-6 €, restaurants complets au-delà de 10 €.
const SEUIL_MOYEN = 7;
const SEUIL_CHER = 11;

function medianePrix(resto) {
  const prix = (resto.menu || []).map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!prix.length) return null;
  const milieu = Math.floor(prix.length / 2);
  return prix.length % 2 ? prix[milieu] : (prix[milieu - 1] + prix[milieu]) / 2;
}

function bandePrix(resto) {
  const m = medianePrix(resto);
  if (m == null) return null;
  return m < SEUIL_MOYEN ? 1 : m < SEUIL_CHER ? 2 : 3;
}

export default function MapPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [promosSeules, setPromosSeules] = useState(false);
  const [ouvertsSeuls, setOuvertsSeuls] = useState(false);
  const [cuisine, setCuisine] = useState('');
  const [prix, setPrix] = useState(0); // 0 = tous, sinon 1 / 2 / 3
  const [tri, setTri] = useState('recommande'); // 'recommande' | 'note' | 'distance'
  const [panneau, setPanneau] = useState(null); // 'cuisine' | 'prix' | 'tri' | null

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch(() => {}).finally(() => setChargement(false));
  }, []);

  // Plus aucun appel périodique ici. Cette page interrogeait /orders/mine toutes les trente
  // secondes, uniquement pour savoir s'il fallait afficher le bandeau « ta livraison est en
  // route ». Les deux bandeaux sont partis : la carte n'a plus besoin de connaître les commandes,
  // et elle cesse d'interroger le serveur en boucle pour une bannière.

  const position = user?.lat && user?.lng ? { lat: user.lat, lng: user.lng } : null;

  const liste = useMemo(() => {
    const maintenant = new Date();
    const filtres = restaurants.filter((r) => {
      if (promosSeules && !r.hasPromo) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (prix && bandePrix(r) !== prix) return false;
      if (ouvertsSeuls && r.hours && !getOpenStatus(r.hours, maintenant, r.closures).isOpen) return false;
      return true;
    });
    const avecDistance = filtres.map((r) => ({
      ...r,
      distanceKm: position && r.lat && r.lng ? haversineDistanceKm(position.lat, position.lng, r.lat, r.lng) : null
    }));
    // « Recommandé » ne réordonne rien : c'est l'ordre que le serveur renvoie, celui des autres
    // pages. Un tri maison baptisé « recommandé » laisserait croire à un classement éditorial qui
    // n'existe pas.
    if (tri === 'note') return [...avecDistance].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (tri === 'distance') return [...avecDistance].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return avecDistance;
  }, [restaurants, promosSeules, ouvertsSeuls, cuisine, prix, tri, position]);

  // Les types de cuisine réellement représentés : proposer « Sushi » quand aucun commerce n'en fait
  // donne un filtre qui ne renvoie jamais rien.
  const cuisinesPresentes = useMemo(() => {
    const vus = new Set(restaurants.map((r) => r.cuisine).filter(Boolean));
    return RESTAURANT_TYPES.filter((c) => vus.has(c.value));
  }, [restaurants]);

  const filtreActif = promosSeules || ouvertsSeuls || !!cuisine || !!prix || tri !== 'recommande';
  function toutReinitialiser() {
    setPromosSeules(false); setOuvertsSeuls(false); setCuisine(''); setPrix(0); setTri('recommande'); setPanneau(null);
  }
  const basculer = (nom) => setPanneau((p) => (p === nom ? null : nom));
  const LIBELLE_TRI = { recommande: t('mapClient.sortRecommended'), note: t('mapClient.sortRating'), distance: t('mapClient.sortDistance') };

  return (
    <div className="carte-page">
      <div className="carte-plein">
        <Suspense fallback={<div className="carte-attente" />}>
          <RestaurantsMap
            restaurants={liste}
            height="100%"
            userLocation={position ? { ...position, address: user.address } : null}
          />
        </Suspense>

        <div className="carte-controles">
          <div className="carte-pastilles">
            <button type="button" className={`cuisine-chip${promosSeules ? ' active' : ''}`} aria-pressed={promosSeules} onClick={() => setPromosSeules((v) => !v)}>
              <Icone nom="etiquette" taille={16} />{t('mapClient.filterOffers')}
            </button>
            <button type="button" className={`cuisine-chip${ouvertsSeuls ? ' active' : ''}`} aria-pressed={ouvertsSeuls} onClick={() => setOuvertsSeuls((v) => !v)}>
              <Icone nom="horloge" taille={16} />{t('mapClient.filterOpen')}
            </button>
            <button type="button" className={`cuisine-chip${prix ? ' active' : ''}`} aria-expanded={panneau === 'prix'} onClick={() => basculer('prix')}>
              <Icone nom="euro" taille={16} />{prix ? '€'.repeat(prix) : t('mapClient.filterPrice')}
            </button>
            {/* Un panneau de pastilles, plus un <select> natif : le menu du système s'ouvre au
                milieu de l'écran dans le style du navigateur, une liste grise sans rapport avec la
                page, posée par-dessus la carte. */}
            <button type="button" className={`cuisine-chip${cuisine ? ' active' : ''}`} aria-expanded={panneau === 'cuisine'} onClick={() => basculer('cuisine')}>
              <Icone nom="restaurants" taille={16} />{cuisine ? restaurantTypeLabel(cuisine, t) : t('mapClient.filterCuisine')}
            </button>
            <button type="button" className={`cuisine-chip${tri !== 'recommande' ? ' active' : ''}`} aria-expanded={panneau === 'tri'} onClick={() => basculer('tri')}>
              <Icone nom="stats" taille={16} />{tri === 'recommande' ? t('mapClient.sort') : LIBELLE_TRI[tri]}
            </button>
          </div>

          {panneau === 'prix' && (
            <div className="carte-panneau">
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" className={`cuisine-chip${prix === n ? ' active' : ''}`} onClick={() => { setPrix(n); setPanneau(null); }}>
                  {n === 0 ? t('mapClient.filterAllPrices') : '€'.repeat(n)}
                </button>
              ))}
            </div>
          )}
          {panneau === 'cuisine' && (
            <div className="carte-panneau carte-panneau-cuisines">
              <button type="button" className={`cuisine-chip${cuisine ? '' : ' active'}`} onClick={() => { setCuisine(''); setPanneau(null); }}>
                {t('mapClient.filterAllCuisines')}
              </button>
              {cuisinesPresentes.map((c) => (
                <button key={c.value} type="button" className={`cuisine-chip${cuisine === c.value ? ' active' : ''}`}
                  onClick={() => { setCuisine(c.value === cuisine ? '' : c.value); setPanneau(null); }}>
                  <span className="emoji">{c.emoji}</span>{restaurantTypeLabel(c.value, t)}
                </button>
              ))}
            </div>
          )}
          {panneau === 'tri' && (
            <div className="carte-panneau">
              {['recommande', 'note', 'distance'].map((cle) => (
                <button key={cle} type="button" className={`cuisine-chip${tri === cle ? ' active' : ''}`}
                  disabled={cle === 'distance' && !position}
                  title={cle === 'distance' && !position ? t('mapClient.sortDistanceNeedsAddress') : undefined}
                  onClick={() => { setTri(cle); setPanneau(null); }}>
                  {LIBELLE_TRI[cle]}
                </button>
              ))}
            </div>
          )}

          {/* Pas de bouton « Appliquer » : chaque choix s'applique tout de suite, et la carte se
              recadre sous les doigts. Un « Appliquer » n'aurait rien à faire — il ne resterait
              qu'à fermer un panneau déjà fermé. « Tout réinitialiser » n'apparaît, lui, que
              lorsqu'il y a vraiment quelque chose à remettre à zéro. */}
          <div className="carte-ligne-etat">
            {!chargement && (
              <p className="carte-compte">
                {liste.length === 0 ? t('mapClient.noneMatch') : t('mapClient.count', { n: liste.length })}
              </p>
            )}
            {filtreActif && (
              <button type="button" className="carte-reinit" onClick={toutReinitialiser}>{t('mapClient.reset')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
