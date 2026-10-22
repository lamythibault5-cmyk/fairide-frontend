/* L'ORDRE DES BLOCS ET DES QUESTIONS DE NOTRE HISTOIRE, en un seul endroit (2026-10-22). La page (OurStory.jsx), son
 * pré-rendu (scripts/prerender.mjs : texte lisible sans JavaScript et données FAQPage) le lisent tous les deux ; avant, la
 * liste des questions était recopiée dans le pré-rendu et pouvait diverger. Module sans React : Node l'importe aussi. */

// [clé, forme, nombre d'éléments pour une liste] : story.<clé>Title, puis story.<clé> ou story.<clé>1…n.
export const BLOCS_HISTOIRE = [
  ['alternative', 'p'], ['constat', 'p'], ['mission', 'p'], ['demarche', 'ul', 4], ['identite', 'p'], ['valeurs', 'ul', 4], ['objectifs', 'ul', 4]
];

// 6 (2026-10-02) : la garantie d’abonnement (50 € de commandes ou moins depuis le 2026-10-11), à la suite de l'inscription.
// 7 (2026-10-19) : « Les prix sont-ils les mêmes qu'au restaurant ? », en tête, comme dans l'aide.
// 8 (2026-10-22) : « Pourquoi s’appelle-t-on Fairide ? » — « fair ride », et les orthographes que les gens tapent (Fairride,
// Fair ride), écrites en toutes lettres sur une page que Google lit, en plus de alternateName (seo/jsonLd.js).
export const QUESTIONS_HISTOIRE = [7, 1, 2, 3, 4, 6, 5, 8];
