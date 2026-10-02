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
