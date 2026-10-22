import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { cheminFiche } from '../../adresseFiche';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import { RESTAURANT_TYPES, restaurantTypeLabel, haversineDistanceKm } from '../../menuCategories';
import Icone from '../../components/Icone';
import { kmLisible } from '../../prixPlat';
import VisuelVide from '../../components/VisuelVide';
import CertifiedBadge from '../../components/CertifiedBadge';
import { cacherImageCassee } from '../../images';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import '../../ecran-liste.css';
import '../../site-liste.css';

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

// « Trier » retiré pour le moment (fondateur, 2026-10-20), même interrupteur que pages/client/RestaurantList.jsx. Le filtre
// « Prix » (bandes €, € €, € € € calculées sur le prix médian de la carte), lui, est retiré pour de bon (fondateur,
// 2026-10-21 : « retirer ça totalement partout »).
const TRI = false;

export default function MapPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [promosSeules, setPromosSeules] = useState(false);
  const [ouvertsSeuls, setOuvertsSeuls] = useState(false);
  const [cuisine, setCuisine] = useState('');
  const [tri, setTri] = useState('recommande'); // 'recommande' | 'note' | 'distance'
  const [panneau, setPanneau] = useState(null); // 'cuisine' | 'tri' | null
  const [recherche, setRecherche] = useState('');
  /* LE SITE SUR UN ORDINATEUR (fondateur, 2026-10-16, lot « liste » de maquettes/site-ordinateur/site-ordinateur.html) : à partir de 1 100 px,
   * la recherche, les filtres et les commerces trouvés passent dans une colonne blanche à gauche, la carte prend le reste.
   * Le tiroir « Commerces près de toi » a été retiré du téléphone parce qu'il RECOUVRAIT la carte (voir plus haut) ; sur un
   * écran large, la colonne est À CÔTÉ : elle ne cache rien, et elle épargne de viser des épingles de huit pixels à la
   * souris. Mêmes filtres, mêmes commerces, même ordre que les épingles. Jamais dans l'app, ni sur un téléphone. */
  const colonne = useSiteLarge(1100);

  // Liste pas lue (réseau, serveur) : « Aucun commerce avec ces filtres » était faux (audit du 19/10, CROSS-34). On dit que
  // le chargement a échoué, avec « Réessayer ».
  const [echec, setEchec] = useState(false);
  const charger = () => {
    setEchec(false);
    setChargement(true);
    api('/restaurants').then(setRestaurants).catch(() => setEchec(true)).finally(() => setChargement(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  // Plus aucun appel périodique ici. Cette page interrogeait /orders/mine toutes les trente
  // secondes, uniquement pour savoir s'il fallait afficher le bandeau « ta livraison est en
  // route ». Les deux bandeaux sont partis : la carte n'a plus besoin de connaître les commandes,
  // et elle cesse d'interroger le serveur en boucle pour une bannière.

  // Mémorisée : un objet neuf à chaque rendu relançait le calcul de la liste (useMemo plus bas) pour rien.
  const lat = user?.lat;
  const lng = user?.lng;
  const position = useMemo(() => (lat && lng ? { lat, lng } : null), [lat, lng]);

  const liste = useMemo(() => {
    const maintenant = new Date();
    const nom = recherche.trim().toLowerCase();
    const filtres = restaurants.filter((r) => {
      if (promosSeules && !r.hasPromo) return false;
      if (cuisine && r.cuisine !== cuisine && !(r.extraCuisines || []).includes(cuisine)) return false; // type principal ou secondaire
      if (ouvertsSeuls && r.hours && !getOpenStatus(r.hours, maintenant, r.closures).isOpen) return false;
      if (nom && !(r.name || '').toLowerCase().includes(nom)) return false;
      return true;
    });
    const avecDistance = filtres.map((r) => ({
      ...r,
      distanceKm: position && r.lat && r.lng ? haversineDistanceKm(position.lat, position.lng, r.lat, r.lng) : null
    }));
    // « Recommandé » ne réordonne rien : c'est l'ordre que le serveur renvoie, celui des autres
    // pages. Un tri maison baptisé « recommandé » laisserait croire à un classement éditorial qui
    // n'existe pas.
    // Note comptée seulement si quelqu'un a noté : restaurants.rating vaut 4,5 par défaut en base, et un
    // commerce sans avis passait devant un commerce noté 4,2 par de vrais clients. Même règle que RestaurantList.
    if (tri === 'note') return [...avecDistance].sort((a, b) => (b.reviewCount > 0 ? b.rating || 0 : 0) - (a.reviewCount > 0 ? a.rating || 0 : 0));
    if (tri === 'distance') return [...avecDistance].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return avecDistance;
  }, [restaurants, promosSeules, ouvertsSeuls, cuisine, tri, position, recherche]);

  // Les types de cuisine réellement représentés : proposer « Sushi » quand aucun commerce n'en fait
  // donne un filtre qui ne renvoie jamais rien.
  const cuisinesPresentes = useMemo(() => {
    const vus = new Set(restaurants.map((r) => r.cuisine).filter(Boolean));
    return RESTAURANT_TYPES.filter((c) => vus.has(c.value));
  }, [restaurants]);

  const filtreActif = promosSeules || ouvertsSeuls || !!cuisine || tri !== 'recommande' || !!recherche.trim();
  function toutReinitialiser() {
    setPromosSeules(false); setOuvertsSeuls(false); setCuisine(''); setTri('recommande'); setPanneau(null); setRecherche('');
  }
  const basculer = (nom) => setPanneau((p) => (p === nom ? null : nom));
  const LIBELLE_TRI = { recommande: t('mapClient.sortRecommended'), note: t('mapClient.sortRating'), distance: t('mapClient.sortDistance') };

  /* LA FICHE DU COMMERCE TOUCHÉ (fondateur, 2026-10-16, proposition « Verre sur le plan » de maquettes/tous-les-ecrans/tous-les-ecrans.html).
   * Plus la grande bulle à photo et deux boutons : une fiche compacte qui monte au-dessus des onglets — en verre dans
   * l'app, blanche à filet sur le site —, la photo, le nom, « cuisine · commune · quartier · distance », la note (seulement
   * s'il y a de vrais avis, sinon « Nouveau ») et la promo, l'adresse, et « Voir ». La croix (ou un toucher sur le plan)
   * la ferme : c'était « Retour à la carte ». */
  const fiche = (r, fermer) => (
    <div className="carte-fiche" key={r.id}>
      <span className="carte-fiche-photo">
        <VisuelVide nom={r.name} cuisine={r.cuisine} />
        {r.coverImageUrl && <img src={r.coverImageUrl} alt="" loading="lazy" onError={cacherImageCassee} />}
      </span>
      <span className="carte-fiche-texte">
        <b className="carte-fiche-nom"><span>{r.name}</span>{r.certified && <CertifiedBadge size={14} />}</b>
        <small>{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune, r.neighborhood, r.distanceKm != null && kmLisible(r.distanceKm)].filter(Boolean).join(' · ')}</small>
        <small className="carte-fiche-infos">
          {/* Pas d'étoile sans avis : une note que personne n'a donnée n'est pas un avis (CDE VI.100). */}
          {r.reviewCount > 0
            ? <span><span aria-hidden="true">★</span> {Number(r.rating).toFixed(1)} {t('map.reviewsCount', { count: r.reviewCount })}</span>
            : <span className="carte-fiche-nouveau">{t('restaurantList.newBadge')}</span>}
          {r.hasPromo && <span className="carte-fiche-promo">{t('restoMap.promo')}</span>}
        </small>
        {r.address && <small className="carte-fiche-adresse">{r.address}</small>}
      </span>
      <Link to={cheminFiche(r)} className="btn-gold carte-fiche-voir">{t('ecranListe.carteVoir')}</Link>
      <button type="button" className="carte-fiche-fermer" onClick={fermer} aria-label={t('map.backToMapAria')}><Icone nom="croix" taille={14} /></button>
    </div>
  );

  const controles = (
        <div className="carte-controles">
          {/* LA RECHERCHE EN PREMIER, comme sur la carte d'Uber : on cherche un nom bien plus souvent
              qu'on ne filtre par cuisine. Elle porte sur les commerces deja charges, donc elle repond
              sans aller au serveur et sans recadrer la carte sous les doigts. */}
          <div className="carte-recherche">
            <Icone nom="recherche" taille={17} />
            <input
              type="search"
              value={recherche}
              onChange={(ev) => setRecherche(ev.target.value)}
              placeholder={t('mapClient.searchPlaceholder')}
              aria-label={t('mapClient.searchPlaceholder')}
            />
            {recherche && (
              <button type="button" className="carte-recherche-vider" onClick={() => setRecherche('')} aria-label={t('mapClient.reset')}>×</button>
            )}
          </div>
          <div className="carte-pastilles">
            <button type="button" className={`cuisine-chip${promosSeules ? ' active' : ''}`} aria-pressed={promosSeules} onClick={() => setPromosSeules((v) => !v)}>
              <Icone nom="etiquette" taille={16} />{t('mapClient.filterOffers')}
            </button>
            <button type="button" className={`cuisine-chip${ouvertsSeuls ? ' active' : ''}`} aria-pressed={ouvertsSeuls} onClick={() => setOuvertsSeuls((v) => !v)}>
              <Icone nom="horloge" taille={16} />{t('mapClient.filterOpen')}
            </button>
            {/* Un panneau de pastilles, plus un <select> natif : le menu du système s'ouvre au
                milieu de l'écran dans le style du navigateur, une liste grise sans rapport avec la
                page, posée par-dessus la carte. */}
            <button type="button" className={`cuisine-chip${cuisine ? ' active' : ''}`} aria-expanded={panneau === 'cuisine'} onClick={() => basculer('cuisine')}>
              <Icone nom="restaurants" taille={16} />{cuisine ? restaurantTypeLabel(cuisine, t) : t('mapClient.filterCuisine')}
            </button>
            {TRI && (
            <button type="button" className={`cuisine-chip${tri !== 'recommande' ? ' active' : ''}`} aria-expanded={panneau === 'tri'} onClick={() => basculer('tri')}>
              <Icone nom="stats" taille={16} />{tri === 'recommande' ? t('mapClient.sort') : LIBELLE_TRI[tri]}
            </button>
            )}
          </div>

          {panneau === 'cuisine' && (
            <div className="carte-panneau carte-panneau-cuisines">
              <button type="button" className={`cuisine-chip${cuisine ? '' : ' active'}`} onClick={() => { setCuisine(''); setPanneau(null); }}>
                {t('mapClient.filterAllCuisines')}
              </button>
              {cuisinesPresentes.map((c) => (
                <button key={c.value} type="button" className={`cuisine-chip${cuisine === c.value ? ' active' : ''}`}
                  onClick={() => { setCuisine(c.value === cuisine ? '' : c.value); setPanneau(null); }}>
                  <span className="emoji"><Icone nom={c.icone} taille={18} /></span>{restaurantTypeLabel(c.value, t)}
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
            {!chargement && echec && (
              <p className="carte-compte">
                {t('common.loadFailedTitle')}. <button type="button" className="carte-reinit" onClick={charger}>{t('common.retry')}</button>
              </p>
            )}
            {!chargement && !echec && (
              <p className="carte-compte">
                {liste.length === 0 ? t('mapClient.noneMatch') : t('mapClient.count', { n: liste.length })}
              </p>
            )}
            {filtreActif && (
              <button type="button" className="carte-reinit" onClick={toutReinitialiser}>{t('mapClient.reset')}</button>
            )}
          </div>
        </div>
  );

  return (
    <div className={`carte-page carte-plein-ecran${colonne ? ' sl-carte' : ''}`}>
      {colonne && (
        <aside className="sl-carte-colonne" aria-label={t('siteListe.carteColonneAria')}>
          {controles}
          {!chargement && liste.length > 0 && (
            <ul className="sl-carte-liste">
              {liste.map((r) => (
                <li key={r.id}>
                  <Link to={cheminFiche(r)} className="sl-carte-ligne">
                    <span className="carte-fiche-photo">
                      <VisuelVide nom={r.name} cuisine={r.cuisine} />
                      {r.coverImageUrl && <img src={r.coverImageUrl} alt="" loading="lazy" onError={cacherImageCassee} />}
                    </span>
                    <span className="carte-fiche-texte">
                      <b className="carte-fiche-nom"><span>{r.name}</span>{r.certified && <CertifiedBadge size={14} />}</b>
                      <small>{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune, r.distanceKm != null && kmLisible(r.distanceKm)].filter(Boolean).join(' · ')}</small>
                      <small>
                        {/* Pas d'étoile sans avis (CDE VI.100), comme la fiche du commerce touché. */}
                        {r.reviewCount > 0
                          ? <span><span aria-hidden="true">★</span> {Number(r.rating).toFixed(1)} {t('map.reviewsCount', { count: r.reviewCount })}</span>
                          : <span className="carte-fiche-nouveau">{t('restaurantList.newBadge')}</span>}
                        {r.hasPromo && <span className="carte-fiche-promo">{t('restoMap.promo')}</span>}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      <div className="carte-plein">
        <Suspense fallback={<div className="carte-attente" />}>
          <RestaurantsMap
            restaurants={liste}
            height="100%"
            userLocation={position ? { ...position, address: user.address } : null}
            cadrerSurCommerces={!!recherche.trim()}
            renderFiche={fiche}
          />
        </Suspense>

        {!colonne && controles}

        {/* LES RESULTATS EN BAS, une pastille par commerce. Chercher un nom et ne voir qu'une epingle
            sur une carte oblige a viser un point de huit pixels pour savoir ce qu'on a trouve. Une
            pastille porte la photo et le nom, et mene a la fiche d'un seul appui. Elles defilent
            horizontalement quand il y en a plusieurs — la carte reste visible dessous, ce qu'une
            liste en pleine page ne permettrait pas.
            Affichee seulement pendant une recherche : sans elle, ce serait une deuxieme liste de
            commerces posee sur la carte, c'est-a-dire ce que le tiroir « Commerces pres de toi »
            faisait avant d'etre retire. */}
        {!colonne && !!recherche.trim() && liste.length > 0 && (
          <div className="carte-resultats" role="list">
            {liste.map((r) => (
              <Link key={r.id} to={cheminFiche(r)} className="carte-resultat" role="listitem">
                {r.coverImageUrl || r.logoImageUrl ? (
                  <img src={r.logoImageUrl || r.coverImageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="carte-resultat-vide" aria-hidden="true"><Icone nom="restaurants" taille={18} /></span>
                )}
                <span className="carte-resultat-nom">{r.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
