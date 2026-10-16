import { useSyncExternalStore } from 'react';

/* MEMBRE DE L'ÉQUIPE D'UN COMMERCE (15 oct. 2026 ; backend equipeCommerce.js).
 * Le tableau de bord sait, par /restaurants/mine/dashboard (staffRole), si le compte ouvre le commerce en propriétaire ou
 * en membre « service ». La barre de navigation et Mon compte ont besoin de la même réponse sans refaire l'appel : ce
 * petit magasin la partage. Ce n'est qu'un affichage — le serveur refuse de toute façon au membre ce qui n'est pas du
 * service (refus par défaut). */
let membre = false;
const abonnes = new Set();

export function definirModeEquipe(valeur) {
  const v = !!valeur;
  if (v === membre) return;
  membre = v;
  abonnes.forEach((f) => f());
}

export function useModeEquipe() {
  return useSyncExternalStore((f) => { abonnes.add(f); return () => abonnes.delete(f); }, () => membre, () => false);
}
