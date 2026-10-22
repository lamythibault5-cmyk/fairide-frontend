// Choix de remboursement à l'annulation d'une commande payée (audit du 19/10/2026, admin-18 ; ChoixRemboursement.jsx).
// Par défaut : en entier. Qui le porte dépend du MOTIF choisi (fondateur, 2026-10-21, décision 3), plus d'un « commerce »
// posé d'office : tant qu'aucun motif n'est choisi, la fenêtre ne se valide pas (motifManquant).
export const REMBOURSEMENT_DEFAUT = { mode: 'full', amount: '', responsibility: 'restaurant', reasonCode: '' };

// Le motif propose qui porte le remboursement : motifs du côté du commerce → le commerce (repris sur son versement), tous
// les autres → Fairide. Même table que le serveur (../fairide-backend/motifsAnnulation.js) : changer l'une, changer l'autre.
// L'ordre est celui de la liste dans la fenêtre.
export const MOTIFS_ANNULATION = [
  ['commerce_ferme', 'restaurant'],
  ['plat_indisponible', 'restaurant'],
  ['commande_non_preparee', 'restaurant'],
  ['demande_commerce', 'restaurant'],
  ['livreur', 'fairide'],
  ['probleme_fairide', 'fairide'],
  ['geste_commercial', 'fairide'],
  ['probleme_paiement', 'fairide'],
  ['autre', 'fairide']
];
export const chargeDuMotif = (code) => (MOTIFS_ANNULATION.find(([c]) => c === code) || [])[1] || null;

// Un remboursement va partir et aucun motif n'est choisi : la fenêtre d'annulation ne se valide pas.
export function motifManquant(valeur) {
  return !!valeur && valeur.mode !== 'none' && !valeur.reasonCode;
}

// Corps « refund » envoyé avec PATCH /admin/orders/:id/status.
export function corpsRemboursement(valeur) {
  if (!valeur) return undefined;
  return {
    mode: valeur.mode, responsibility: valeur.responsibility,
    ...(valeur.reasonCode ? { reasonCode: valeur.reasonCode } : {}),
    ...(valeur.mode === 'partial' ? { amount: Number(valeur.amount) } : {})
  };
}
