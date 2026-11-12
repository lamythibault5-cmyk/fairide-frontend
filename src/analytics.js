// Statistiques d'audience SANS cookie ni donnée personnelle : Plausible (script « cookieless », conforme
// RGPD sans bannière — la politique de confidentialité le documente). Rien ne se charge tant que
// VITE_PLAUSIBLE_DOMAIN n'est pas défini (variable Vercel) : en développement et tant que le compte
// Plausible n'est pas ouvert, ce fichier ne fait rien.
//
// Événements suivis (jamais de nom, d'adresse, d'e-mail ni de montant exact — seulement des catégories) :
//   commande_finalisee  { mode: 'livraison' | 'emporter' }
//   commande_emporter   (raccourci de commande_finalisee mode emporter, pour un objectif dédié)
//   inscription_restaurant
//   candidature_livreur
//   inscription_client
//   inscription_ecran   { ecran, role, support: 'appli' | 'site' | 'commun' } : chaque écran de l'accueil et de l'inscription,
//                       et la feuille du code à la première commande (fondateur, 2026-11-02, maquettes/inscription-legere) —
//                       pour voir où l'on s'arrête. Le nom de l'écran seulement.
//   telephone_prouve    { support } : le code du numéro tapé (VerifTelephone.jsx)
import { estApercu } from './apercuSite';

const DOMAINE = import.meta.env.VITE_PLAUSIBLE_DOMAIN || '';
let charge = false;

export function demarrerAnalytics() {
  // L'aperçu de l'accueil (apercuSite.js) n'est pas une visite : la page du site qui le contient est déjà comptée.
  if (charge || !DOMAINE || typeof document === 'undefined' || estApercu()) return;
  charge = true;
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = DOMAINE;
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
}

// Envoie un événement nommé. Silencieux si l'outil n'est pas configuré.
export function suivre(nom, props) {
  if (!DOMAINE || typeof window === 'undefined' || typeof window.plausible !== 'function') return;
  try { window.plausible(nom, props ? { props } : undefined); } catch { /* jamais bloquant */ }
}
