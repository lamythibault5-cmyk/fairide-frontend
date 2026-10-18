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
  const b = lireBienvenue();
  if (b.reprise || b.codeEnAttente) ecrireBienvenue({ reprise: null, codeEnAttente: null });
}

/* L'ACCUEIL DÉJÀ FAIT (fondateur, 2026-10-18). Les écrans de l'accueil restent pour qui ne les a pas vus : ils retiennent
 * les gens. Mais quelqu'un qui les a déjà parcourus sur ce téléphone et revient par « Créer un compte » (la connexion, un
 * commerce touché sans compte) ne les refait pas : il reprend à l'écran du compte, avec son profil et ses réponses.
 * Retenu en arrivant à l'écran du compte (Bienvenue.jsx). Mêmes données que l'accueil garde déjà, rien d'autre. */
export function lireParcoursFait() {
  const p = lireBienvenue().parcoursFait;
  return p && p.role ? p : null;
}

export function ecrireParcoursFait(parcours) {
  ecrireBienvenue({ parcoursFait: parcours });
}

/* LE CODE ATTENDU (audit du 18/10/2026). Après « Créer mon compte », le code part par e-mail : on quitte l'application
 * pour le lire, et Android la ferme parfois entre-temps. Rouverte, elle repartait d'une inscription VIDE. On retient donc
 * l'adresse à confirmer (jamais le mot de passe), pour rouvrir l'écran du code (InscriptionAppli.jsx). 24 heures au plus ;
 * effacé dès qu'une session est ouverte (effacerReprise). */
const CODE_MAX_MS = 24 * 3600 * 1000;

export function lireCodeEnAttente() {
  const c = lireBienvenue().codeEnAttente;
  return c && c.email && Date.now() - (c.at || 0) < CODE_MAX_MS ? c : null;
}

export function ecrireCodeEnAttente(attente) {
  ecrireBienvenue({ codeEnAttente: attente ? { ...attente, at: Date.now() } : null });
}
