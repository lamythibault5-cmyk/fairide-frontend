import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import { RESTAURANT_TYPES, restaurantTypeLabel } from '../../menuCategories';
import Icone from '../../components/Icone';

const RestaurantsMap = lazy(() => import('../../components/RestaurantsMap'));

// La carte des commerces, en plein écran.
//
// CET ONGLET MONTRAIT LE SUIVI DE LIVRAISON. C'était le mauvais contenu derrière la bonne icône :
// on clique sur une carte pour explorer un quartier — voir qui est ouvert, qui fait une promo, ce
// qu'il y a à deux rues — pas pour regarder un livreur avancer. Le suivi n'est pas perdu pour
// autant : il vit déjà dans « Mes commandes », et tant qu'une livraison est en cours un bandeau y
// mène depuis ici, en un toucher.
//
// La carte des commerces, elle, existait bien mais était CACHÉE derrière une bascule « Liste /
// Carte » au milieu de la liste des restaurants — c'est-à-dire à l'endroit où l'on est déjà en
// train de parcourir une liste. Elle a maintenant son onglet, et la pleine hauteur.
//
// Pleine hauteur, justement : la carte prend tout ce qui reste sous l'en-tête, et les contrôles
// FLOTTENT par-dessus au lieu de la pousser vers le bas. C'est ce que fait l'application dont le
// fondateur a fourni les captures : on voit d'abord la carte, les pastilles ne gênent pas.

export default function MapPage() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [enCours, setEnCours] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [promosSeules, setPromosSeules] = useState(false);
  const [ouvertsSeuls, setOuvertsSeuls] = useState(false);
  const [cuisine, setCuisine] = useState('');

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch(() => {}).finally(() => setChargement(false));
  }, []);

  // Les livraisons en cours, relues régulièrement : c'est la seule chose qui justifie encore un
  // aller-retour périodique sur cette page, et elle ne sert qu'au bandeau.
  useEffect(() => {
    if (!token) return undefined;
    function lire() {
      api('/orders/mine', { token })
        .then((cmds) => setEnCours((cmds || []).filter((o) => o.status === 'livraison' && o.orderType === 'delivery')))
        .catch(() => {});
    }
    lire();
    const id = setInterval(lire, 30000);
    return () => clearInterval(id);
  }, [token]);

  const liste = useMemo(() => {
    const maintenant = new Date();
    return restaurants.filter((r) => {
      if (promosSeules && !r.hasPromo) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (ouvertsSeuls && r.hours && !getOpenStatus(r.hours, maintenant, r.closures).isOpen) return false;
      return true;
    });
  }, [restaurants, promosSeules, ouvertsSeuls, cuisine]);

  // Les types de cuisine réellement représentés : proposer « Sushi » quand aucun commerce n'en fait
  // donne un filtre qui ne renvoie jamais rien.
  const cuisinesPresentes = useMemo(() => {
    const vus = new Set(restaurants.map((r) => r.cuisine).filter(Boolean));
    return RESTAURANT_TYPES.filter((c) => vus.has(c.value));
  }, [restaurants]);

  return (
    <div className="carte-page">
      <div className="carte-plein">
        <Suspense fallback={<div className="carte-attente" />}>
          <RestaurantsMap
            restaurants={liste}
            height="100%"
            userLocation={user?.lat && user?.lng ? { lat: user.lat, lng: user.lng, address: user.address } : null}
          />
        </Suspense>

        <div className="carte-controles">
          {enCours.length > 0 && (
            <Link to="/orders" className="carte-bandeau-livraison">
              <Icone nom="scooter" taille={20} />
              <span>{t('mapClient.trackingBanner', { n: enCours.length })}</span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
          <div className="carte-pastilles">
            <button type="button" className={`cuisine-chip${promosSeules ? ' active' : ''}`} aria-pressed={promosSeules} onClick={() => setPromosSeules((v) => !v)}>
              <Icone nom="etiquette" taille={16} />{t('mapClient.filterOffers')}
            </button>
            <button type="button" className={`cuisine-chip${ouvertsSeuls ? ' active' : ''}`} aria-pressed={ouvertsSeuls} onClick={() => setOuvertsSeuls((v) => !v)}>
              <Icone nom="horloge" taille={16} />{t('mapClient.filterOpen')}
            </button>
            {/* Un <select> natif plutôt qu'un menu maison : sur téléphone il ouvre la roue du
                système, qui se manipule mieux au pouce que n'importe quelle liste déroulante
                dessinée à la main. */}
            <label className={`cuisine-chip carte-chip-select${cuisine ? ' active' : ''}`}>
              <Icone nom="restaurants" taille={16} />
              <span>{cuisine ? restaurantTypeLabel(cuisine, t) : t('mapClient.filterCuisine')}</span>
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label={t('mapClient.filterCuisine')}>
                <option value="">{t('mapClient.filterAllCuisines')}</option>
                {cuisinesPresentes.map((c) => <option key={c.value} value={c.value}>{restaurantTypeLabel(c.value, t)}</option>)}
              </select>
            </label>
          </div>
          {/* Zéro résultat se voyait par une carte vide, sans un mot : on ne savait pas si aucun
              commerce ne correspondait ou si la carte n'avait pas fini de charger. Combiner
              « Offres » et « Ouvert » un matin de semaine suffit à y arriver. */}
          {!chargement && (
            <p className="carte-compte">
              {liste.length === 0 ? t('mapClient.noneMatch') : t('mapClient.count', { n: liste.length })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
