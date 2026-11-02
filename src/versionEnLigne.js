// Veille de version (sortie de NavigationFeedback.jsx le 2026-11-02, pour que EditPage.jsx la lise aussi). Toutes les
// 5 minutes (et au retour sur l'onglet), on relit index.html et on compare le nom du fichier principal à celui qui tourne. S'il a changé, une nouvelle version est en ligne : le prochain
// clic sur un lien interne quitte le routeur pour un vrai chargement de la page cible — la personne arrive
// où elle voulait aller, dans la nouvelle version, sans jamais voir un rechargement en plein travail.
// LES BOUTONS AUSSI (Maestro pizza, 2026-11-02) : un onglet du site ouvert depuis l'après-midi montrait encore l'ancien écran
// « Mes livreurs » à 22 h, parce que Mon commerce ouvre ses écrans par un bouton (EditPage.jsx), sans lien ni changement
// d'adresse. Désormais tout changement d'adresse (lien, bouton, onglet du bas) recharge vers la nouvelle version, et les écrans
// qui s'ouvrent sur place demandent nouvelleVersionEnLigne() avant de s'ouvrir.
export const VEILLE_MS = 5 * 60 * 1000;
let nouvelleVersion = false;
export function nouvelleVersionEnLigne() { return nouvelleVersion; }
function fichierPrincipalCourant() {
  const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
  return el ? (el.getAttribute('src') || '').replace(/^.*\/assets\//, '') : null;
}
export async function verifierVersion() {
  const courant = fichierPrincipalCourant();
  if (!courant || nouvelleVersion) return;
  try {
    const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    const m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    if (m && m[1] !== courant) nouvelleVersion = true;
  } catch { /* hors ligne : on réessaiera */ }
}
