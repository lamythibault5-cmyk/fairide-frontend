import { useEffect, useState } from 'react';
import { demanderPosition, etatPosition } from '../natif';
import { haversineDistanceKm } from '../menuCategories';

/* « TU N'ES PAS À CETTE ADRESSE ? » (fondateur, 2026-10-27). Le paiement reprend l'adresse de la dernière commande : un client
 * qui recommande depuis le bureau ou chez un ami l'oublie, et la commande part chez lui. Avant de payer, si le téléphone
 * sait déjà où il est, on compare : à plus de LOIN_KM de l'adresse choisie, la rangée d'adresse le dit en rouge.
 *
 * JAMAIS DE QUESTION POUR ÇA. On ne lit la position que si elle est DÉJÀ autorisée (etatPosition) : demander la permission
 * au moment de payer serait une fenêtre de plus pour un simple rappel. Sans position, rien ne s'affiche ; le suivi permet
 * de toute façon de changer l'adresse jusqu'à ce que le livreur ait la commande (changementAdresse.js côté serveur).
 *
 * `lat`/`lng` : la position de l'adresse choisie, celle que le serveur a géocodée pour le devis (POST /orders/devis). Rend
 * true seulement quand on sait que le téléphone est loin ; false dans tous les autres cas. */
const LOIN_KM = 1;

export default function useLoinDeLAdresse(lat, lng, actif = true) {
  const [loin, setLoin] = useState(false);
  useEffect(() => {
    setLoin(false);
    if (!actif || lat == null || lng == null) return undefined;
    let vivant = true;
    (async () => {
      if ((await etatPosition()) !== 'granted') return;
      const ici = await demanderPosition({ delai: 6000 });
      if (vivant && ici) setLoin(haversineDistanceKm(ici.lat, ici.lng, Number(lat), Number(lng)) > LOIN_KM);
    })().catch(() => {});
    return () => { vivant = false; };
  }, [lat, lng, actif]);
  return loin;
}
