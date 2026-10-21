// Choix de remboursement à l'annulation d'une commande payée (audit du 19/10/2026, admin-18 ; ChoixRemboursement.jsx).
// Par défaut : en entier, à la charge du commerce, comme une annulation normale (qui reprend son versement).
export const REMBOURSEMENT_DEFAUT = { mode: 'full', amount: '', responsibility: 'restaurant' };

// Corps « refund » envoyé avec PATCH /admin/orders/:id/status.
export function corpsRemboursement(valeur) {
  if (!valeur) return undefined;
  return { mode: valeur.mode, responsibility: valeur.responsibility, ...(valeur.mode === 'partial' ? { amount: Number(valeur.amount) } : {}) };
}
