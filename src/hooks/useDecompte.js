import { useEffect, useState } from 'react';

/* UN DÉCOMPTE EN SECONDES, pour « Renvoyer le code » (audit du 19/10, auth-12).
 *
 * Le bouton n'avait aucun délai : chaque toucher impatient envoyait un SMS (environ 8 centimes) jusqu'à ce que le plafond du
 * serveur réponde « Trop de demandes ». Les écrans du code (Auth.jsx, ConnexionAppli.jsx, InscriptionAppli.jsx) lancent donc
 * un décompte quand le code vient de partir, et le bouton dit « Renvoyer le code dans 25 s » tant qu'il tourne.
 * Rend [secondes restantes, lancer(secondes)]. */
export const DELAI_RENVOI_S = 30;
/* « Je n'ai pas reçu le SMS » → le code par e-mail, 30 s plus tard (fondateur, 22/10/2026). L'e-mail ne prouve pas le
 * téléphone : c'est un dernier recours, pas un raccourci. Décompte à part, que « Renvoyer le code » ne relance pas, et
 * toujours affiché (« … dans 25 s ») : un bouton désactivé sans le dire laissait croire qu'il ne marchait pas. */
export const DELAI_CODE_EMAIL_S = 30;

export default function useDecompte() {
  const [restant, setRestant] = useState(0);
  useEffect(() => {
    if (restant <= 0) return undefined;
    const minuteur = setTimeout(() => setRestant((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(minuteur);
  }, [restant]);
  return [restant, setRestant];
}
