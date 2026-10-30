/* LA ROUTE QUI AVANCE VITE AU DÉBUT (fondateur, 2026-10-30, version B de maquettes/progression/progression.html).
 *
 * Quand on REMPLIT des écrans (accueil, inscription, dossier livreur, inscription du site), la route avance vite sur les
 * premiers, puis plus doucement : à mi-route dès les premiers écrans, on finit plus volontiers. Une synthèse de 32
 * expériences sur des questionnaires en ligne (Villar, Callegaro & Yang, 2013) : rapide puis lente = moins d'abandons,
 * lente puis rapide = plus, régulière = rien. 70 % de « vite puis lent » et 30 % de régulier : chaque écran fait encore
 * avancer le vélo d'au moins 3 %, la route ne paraît jamais bloquée sur les derniers.
 *
 * `part` : la part des écrans faits (0 à 1), comptée comme avant. Jamais pour une route qui dit un fait (suivi de commande,
 * « n étapes faites sur N » d'un commerce ou d'un livreur) : là, la route reste exacte. Pour une ATTENTE, c'est l'inverse
 * (lent puis vite), voir l'anneau du chargement (EcransBienvenue.jsx, ANNEAU_RECHERCHE). */
export function courbeRoute(part) {
  const x = Math.min(1, Math.max(0, Number(part) || 0));
  return 0.7 * (1 - (1 - x) ** 2) + 0.3 * x;
}
