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
