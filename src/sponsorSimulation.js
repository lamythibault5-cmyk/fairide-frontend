// Simulation de sponsoring (fondateur, 2026-10-02) : l'admin voit les emplacements partenaires REMPLIS — avec le logo
// chargé s'il y en a un, sinon avec un visuel de démonstration — exactement comme le public les verrait, sans rien
// publier. Le réglage vit dans ce navigateur seulement (localStorage) : il ne change rien pour personne d'autre, et
// EmplacementSponsor ne le lit que pour un compte admin.
const CLE = 'fairide_sponsor_simulation';
const EVENEMENT = 'fairide:sponsor-simulation';

export function simulationSponsorActive() {
  try { return localStorage.getItem(CLE) === '1'; } catch { return false; }
}
export function reglerSimulationSponsor(active) {
  try { if (active) localStorage.setItem(CLE, '1'); else localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event(EVENEMENT));
}
export function ecouterSimulationSponsor(rappel) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', rappel);
  return () => { window.removeEventListener(EVENEMENT, rappel); window.removeEventListener('storage', rappel); };
}

// CE QU'UN EMPLACEMENT MONTRE, selon qui regarde. Une seule règle, testée à part (simulation du sponsoring) :
//   'rien'       : rien du tout (public sans emplacement publié ; emplacement inconnu) ;
//   'public'     : le logo publié, tel que tout le monde le voit — l'équipe le voit pareil ;
//   'simulation' : l'équipe, simulation allumée : le rendu public avec le logo chargé ou le visuel de démonstration ;
//   'prive'      : l'équipe, logo chargé mais pas publié (cadre en pointillés) ;
//   'vide'       : l'équipe, aucun logo (cadre en pointillés et consigne).
// Un visiteur ne voit JAMAIS la simulation, même s'il pose lui-même la clé dans son navigateur : elle ne compte que
// pour un compte de l'équipe, et le serveur ne lui envoie de toute façon que les emplacements publiés.
export function modeEmplacement({ admin, simulation, slot }) {
  if (!slot) return 'rien';
  const publie = !!(slot.visible && slot.imageUrl);
  if (publie) return 'public';
  if (!admin) return 'rien';
  if (simulation) return 'simulation';
  return slot.imageUrl ? 'prive' : 'vide';
}
