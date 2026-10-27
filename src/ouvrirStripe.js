import { useSyncExternalStore } from 'react';
import { allerAuPaiement, estNatif } from './natif';

/* L'OUVERTURE DE STRIPE CONNECT, AVEC UN ÉCRAN D'ATTENTE (fondateur, 2026-10-27, test du commerce : « quand j'ai cliqué sur
 * connecter Stripe, ça a pris du temps et j'ai cru que ça ne viendrait pas, ajoute un skeleton »).
 *
 * Entre le toucher et la page de Stripe : le serveur crée le compte Connect et le lien d'inscription (souvent deux à cinq
 * secondes), puis le navigateur intégré s'ouvre (app) ou la page part vers Stripe (site). Le bouton ne montrait que « … ».
 * Ici, l'écran d'attente de l'app (EcranAttente, Skeleton.jsx : bandeau iris, vélo qui roule, feuille en squelette) couvre
 * tout l'écran dès le toucher, avec « On t'emmène chez Stripe ». Une seule fonction pour les cinq boutons qui ouvrent Stripe
 * (commerce : tableau de bord et Mon compte ; livreur : dossier, Mes courses et Mon compte) ; un seul écran, monté une fois
 * dans App.jsx (AttenteStripe.jsx).
 *
 *   - `obtenirUrl` : la requête au serveur, qui renvoie { url } ;
 *   - dans l'app, l'écran se retire une fois le navigateur intégré ouvert par-dessus ;
 *   - sur le site, il reste jusqu'au départ de la page (retiré si le navigateur la rend depuis son cache au retour, pageshow) ;
 *   - une erreur le retire et remonte à l'appelant, qui l'affiche comme avant. */
let visible = false;
const abonnes = new Set();
function changer(v) {
  visible = v;
  abonnes.forEach((f) => f());
}
if (typeof window !== 'undefined') window.addEventListener('pageshow', (e) => { if (e.persisted) changer(false); });

export function useAttenteStripe() {
  return useSyncExternalStore((f) => { abonnes.add(f); return () => abonnes.delete(f); }, () => visible, () => false);
}

export async function ouvrirStripe(obtenirUrl, { retour } = {}) {
  changer(true);
  try {
    const r = await obtenirUrl();
    if (!r?.url) { changer(false); return r; }
    await allerAuPaiement(r.url, { retour });
    // Le site part vers Stripe : l'écran reste jusqu'à ce que la page change. Filet si le départ n'a pas lieu (bloqué).
    if (estNatif()) changer(false);
    else setTimeout(() => changer(false), 20000);
    return r;
  } catch (e) {
    changer(false);
    throw e;
  }
}
