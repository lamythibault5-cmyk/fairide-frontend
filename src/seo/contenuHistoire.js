/* L'ORDRE DES BLOCS ET DES QUESTIONS DE NOTRE HISTOIRE, en un seul endroit (2026-10-22). La page (OurStory.jsx), son
 * pré-rendu (scripts/prerender.mjs : texte lisible sans JavaScript et données FAQPage) le lisent tous les deux ; avant, la
 * liste des questions était recopiée dans le pré-rendu et pouvait diverger. Module sans React : Node l'importe aussi. */

// [clé, forme, nombre d'éléments pour une liste] : story.<clé>Title, puis story.<clé> ou story.<clé>1…n.
// Depuis le 2026-10-26 (docs/agents/voix.md) : le pourquoi d'abord, du point de vue du client, puis la preuve, le service et
// l'équipe. Les anciens blocs (alternative, constat, mission, démarche, identité, valeurs, objectifs) sont retirés.
export const BLOCS_HISTOIRE = [
  ['croyance', 'p'], ['autrement', 'p'], ['service', 'p'], ['equipe', 'p']
];

// 6 (2026-10-02) : la garantie d’abonnement (50 € de commandes ou moins depuis le 2026-10-11), à la suite de l'inscription.
// 7 (2026-10-19) : « Les prix sont-ils les mêmes qu'au restaurant ? », en tête, comme dans l'aide.
// 8 (2026-10-22) : « Pourquoi s’appelle-t-on Fairide ? » — « fair ride », et les orthographes que les gens tapent (Fairride,
// Fair ride), écrites en toutes lettres sur une page que Google lit, en plus de alternateName (seo/jsonLd.js).
// 9 (2026-10-26) : « D'où vient le +55 % de la page d'accueil ? », juste après la 7 (les prix). C'est elle qui rend la carte
// « Le même plat, trois prix » vérifiable (« Détails sur demande », HeroPrix.jsx).
export const QUESTIONS_HISTOIRE = [7, 9, 1, 2, 3, 4, 6, 5, 8];
