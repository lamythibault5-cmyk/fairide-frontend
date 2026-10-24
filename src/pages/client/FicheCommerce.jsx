/* ROUTE /restaurants/:id — L'ADRESSE D'UNE FICHE, LISIBLE OU NON (fondateur, 2026-10-22, voir adresseFiche.js).
 *
 * L'adresse porte le slug (« delispice-woluwe-saint-pierre ») ou, pour un ancien lien, l'identifiant. La fiche
 * (RestaurantMenu) travaille TOUJOURS avec l'identifiant — panier, favoris, avis, capacité, commandes groupées — : ce
 * composant le trouve avant de la monter.
 *   - Un identifiant : tel quel.
 *   - Un slug déjà vu pendant la visite (liste et accueil gardés par cacheDonnees.js, fiches déjà ouvertes) : sans
 *     attendre, la fiche s'ouvre comme avant depuis la liste, photo en vol comprise.
 *   - Sinon (lien partagé, Google, page prérendue) : la fiche est lue par son slug, rangée sous son identifiant
 *     (garderEnCache), puis montée — elle s'affiche aussitôt, sans relire la même réponse.
 * Statiquement importé comme la fiche (App.jsx) : c'est l'entrée de la plupart des visiteurs venus de Google. */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chargerAvecCache, garderEnCache, lireCache } from '../../cacheDonnees';
import { estIdentifiant, idPourSlug, retenirSlugs } from '../../adresseFiche';
import { CHEMIN_LISTE } from '../../resumeCarte';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import { experienceApp } from '../../natif';
import RestaurantMenu, { EchecFiche } from './RestaurantMenu';

function idConnu(adresse) {
  if (estIdentifiant(adresse)) return adresse;
  if (idPourSlug(adresse)) return idPourSlug(adresse);
  retenirSlugs(lireCache(CHEMIN_LISTE) || []);
  retenirSlugs(lireCache('/restaurants/landing') || []);
  return idPourSlug(adresse) || null;
}

export default function FicheCommerce() {
  const { id: adresse } = useParams();
  const { token } = useAuth();
  // { adresse, id } : l'identifiant trouvé POUR CETTE adresse. Une autre fiche ouverte (« À découvrir ») repart de zéro.
  const [trouve, setTrouve] = useState(() => ({ adresse, id: idConnu(adresse) }));
  // L'échec, avec l'adresse qu'il concerne : il ne s'affiche pas sur la fiche suivante le temps d'une image.
  const [echec, setEchec] = useState(null);
  const [essai, setEssai] = useState(0);
  const id = trouve.adresse === adresse && trouve.id ? trouve.id : idConnu(adresse);

  useEffect(() => {
    if (id) return undefined;
    let actif = true;
    chargerAvecCache(`/restaurants/${adresse}`, { token })
      .then((fiche) => {
        if (!actif) return;
        garderEnCache(`/restaurants/${fiche.id}`, token, fiche);
        retenirSlugs(fiche);
        setTrouve({ adresse, id: String(fiche.id) });
      })
      .catch((e) => { if (actif) setEchec({ adresse, essai, erreur: e }); });
    return () => { actif = false; };
  }, [adresse, id, token, essai]);

  if (id) return <RestaurantMenu id={id} />;
  if (echec?.adresse === adresse && essai === echec.essai) return <EchecFiche erreur={echec.erreur} chemin={`/restaurants/${adresse}`} onReessayer={() => setEssai((n) => n + 1)} />;
  return experienceApp() ? <SqueletteEcran photo /> : <SkeletonCards count={3} />;
}
