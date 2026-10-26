// LES PAGES QUI S'OUVRENT EN FEUILLE (fondateur, 2026-10-17 : « Favoris, Mes commandes, Mes factures… je ne peux pas
// revenir en arrière ; je veux pouvoir tirer vers le bas pour sortir, comme Mes infos »).
//
// Ouvertes depuis Mon compte, ces pages montent en feuille PAR-DESSUS lui, au lieu de le remplacer : Mon compte reste
// derrière, la feuille se ferme d'un geste vers le bas (ou par ‹), et l'on retrouve Mon compte là où on l'avait laissé —
// exactement comme « Mes infos » (SousEcran). L'adresse change quand même (/favorites…) : un lien partagé, le bouton
// Retour du téléphone et un rechargement continuent de marcher. Ouverte directement (lien, onglet), la page reste une page.
//
// Mécanique (App.jsx) : le lien porte `state.fond` = la page d'où l'on vient. App rend alors cette page-là en fond
// (`<Routes location={fond}>`) et la page demandée dans une PageFeuille au-dessus.
//
// Dans l'app, et sur le site au téléphone (900 px et moins) : sur un ordinateur, la barre latérale fait la navigation.
// Les pages du tableau de bord d'un commerce n'y sont pas : elles vivent dans le cadre du tableau de bord (DashboardLayout),
// qui leur donne leurs données.
import { experienceApp } from './natif';

export const PAGES_EN_FEUILLE = ['/favorites', '/demandes', '/orders', '/invoices', '/documents', '/driver/earnings', '/driver/invoices'];

export function estPageEnFeuille(chemin) {
  return PAGES_EN_FEUILLE.includes(chemin);
}

// L'état à poser sur un lien vers `vers` depuis `location` : la page de fond, si `vers` s'ouvre en feuille ici.
export function etatFeuille(vers, location) {
  if (!estPageEnFeuille(String(vers).split('?')[0])) return undefined;
  if (!experienceApp() && typeof window !== 'undefined' && window.innerWidth > 900) return undefined;
  const { pathname, search, hash, key } = location;
  return { fond: { pathname, search, hash, key } };
}
