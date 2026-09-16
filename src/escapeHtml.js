// Échappement HTML, pour les rares endroits où l'on construit du balisage à la main.
//
// POURQUOI CE FICHIER EXISTE. React échappe tout ce qu'il affiche, donc en temps normal la question ne
// se pose pas. Leaflet, lui, n'est pas React : `marker.bindPopup(texte)` et `L.divIcon({ html })`
// insèrent la chaîne reçue comme du HTML BRUT. Passer directement un nom de commerce ou une adresse de
// client à une bulle de carte, c'est donc exécuter le JavaScript que cette donnée contiendrait — un
// commerce nommé `<img src=x onerror=...>` s'exécutait dans le navigateur du livreur qui ouvrait la
// bulle, et le jeton de session vit dans localStorage, à portée de ce script.
//
// La fonction était déjà écrite, correctement, dans la carte de la console admin (logistics/LiveMap) ;
// les trois autres cartes ne l'avaient jamais reprise. Elle est ici pour qu'il n'y ait plus qu'un seul
// endroit à corriger si elle devait l'être, et qu'aucune carte ne l'oublie à nouveau.
//
// À utiliser SEULEMENT pour du balisage construit à la main. Dans du JSX, `{valeur}` suffit : y ajouter
// cette fonction afficherait les entités en clair (« Chez Jean &amp; Fils »).
const REMPLACEMENTS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => REMPLACEMENTS[c]);
}
