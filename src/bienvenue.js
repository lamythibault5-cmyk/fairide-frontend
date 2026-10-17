// Mémoire de l'accueil de l'application (pages/app/Bienvenue.jsx), dans le téléphone seulement.
//
// Ce qu'on retient : l'accueil a-t-il été vu (pour ne le montrer qu'au premier lancement), le profil choisi, la
// commune ou la position (pour ouvrir la liste des commerces au bon endroit, voir Home.jsx), les envies, et s'il
// reste à proposer les notifications après l'inscription (AmorceNotifications.jsx).
//
// localStorage et pas le serveur : ce sont des préférences d'appareil d'une personne qui n'a pas encore de compte.
// Rien n'est envoyé — et un stockage indisponible (mode privé) ne fait que remontrer l'accueil, sans rien casser.
const CLE = 'fairide_bienvenue';

export function lireBienvenue() {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch { return {}; }
}

export function ecrireBienvenue(changements) {
  const valeur = { ...lireBienvenue(), ...changements };
  try { localStorage.setItem(CLE, JSON.stringify(valeur)); } catch { /* stockage indisponible */ }
  return valeur;
}

/* LA REPRISE DE L'ACCUEIL (fondateur, 2026-10-17) : quelqu'un fait l'accueil, ferme l'application avant d'avoir son
 * compte, et la rouvre. Avant, il retombait au tout premier écran, ou — s'il avait atteint l'écran du compte — sur la
 * liste des commerces du mode visiteur, puis sur la connexion au premier commerce touché. Désormais l'accueil retient où
 * il en est (écran, profil, réponses, commune ou position) et l'application le rouvre LÀ, dans les écrans de l'accueil,
 * tant qu'aucun compte n'est ouvert sur l'appareil. Effacée dès qu'une session existe (AuthContext.jsx). 30 jours au plus :
 * au-delà, mieux vaut recommencer que reprendre un vieux parcours. Rien d'autre que ce que l'accueil a demandé : jamais
 * d'e-mail, de mot de passe ni de jeton. */
const REPRISE_MAX_MS = 30 * 24 * 3600 * 1000;

export function lireReprise() {
  const r = lireBienvenue().reprise;
  return r && r.ecran && Date.now() - (r.at || 0) < REPRISE_MAX_MS ? r : null;
}

export function ecrireReprise(reprise) {
  ecrireBienvenue({ reprise: { ...reprise, at: Date.now() } });
}

export function effacerReprise() {
  if (lireBienvenue().reprise) ecrireBienvenue({ reprise: null });
}
