import { useEffect, useState } from 'react';

/* UN DÉCOMPTE EN SECONDES, pour « Renvoyer le code » (audit du 19/10, auth-12).
 *
 * Le bouton n'avait aucun délai : chaque toucher impatient envoyait un SMS (environ 8 centimes) jusqu'à ce que le plafond du
 * serveur réponde « Trop de demandes ». Les écrans du code (Auth.jsx, ConnexionAppli.jsx, InscriptionAppli.jsx) lancent donc
 * un décompte quand le code vient de partir, et le bouton dit « Renvoyer le code dans 25 s » tant qu'il tourne.
 * Rend [secondes restantes, lancer(secondes)]. */
export const DELAI_RENVOI_S = 30;

export default function useDecompte() {
  const [restant, setRestant] = useState(0);
  useEffect(() => {
    if (restant <= 0) return undefined;
    const minuteur = setTimeout(() => setRestant((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(minuteur);
  }, [restant]);
  return [restant, setRestant];
}
