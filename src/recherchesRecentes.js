// LES DERNIÈRES RECHERCHES (fondateur, 2026-10-17 : « oui, ayons un Récemment » — « Search » de maquettes/commerces-marque/commerces-marque.html).
//
// Les CINQ derniers mots cherchés, du plus récent au plus ancien, gardés DANS LE TÉLÉPHONE (localStorage) et jamais envoyés
// au serveur : c'est une préférence d'affichage, déclarée comme telle dans la politique des cookies (cookies.preferences),
// sans consentement à demander. Un mot n'est retenu que s'il a servi — Entrée, ou un résultat touché (SearchPage.jsx) —,
// pas à chaque lettre tapée. « Effacer » vide la liste ; la déconnexion volontaire aussi (logout() d'AuthContext appelle
// effacerRecherches), pour que le compte suivant sur le même appareil ne lise pas les recherches du précédent.
const CLE = 'fairide_recherches';
const MAX = 5;

export function lireRecherches() {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(liste) ? liste.filter((x) => typeof x === 'string' && x.trim()).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

// Le mot revient en tête s'il y était déjà (sans tenir compte des majuscules) ; la liste garde MAX mots.
export function retenirRecherche(mot) {
  const propre = String(mot || '').trim().slice(0, 80);
  if (propre.length < 2) return lireRecherches();
  const liste = [propre, ...lireRecherches().filter((x) => x.toLowerCase() !== propre.toLowerCase())].slice(0, MAX);
  try { localStorage.setItem(CLE, JSON.stringify(liste)); } catch { /* stockage indisponible : rien n'est retenu */ }
  return liste;
}

export function effacerRecherches() {
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
}

