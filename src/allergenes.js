// Les 14 allergènes réglementaires (règlement (UE) 1169/2011, annexe II), par code — le même code que
// le serveur stocke (menu_items.allergens, voir fairide-backend/allergenes.js). Les libellés sont dans les
// tables de traduction (conformite.allergen1 … allergen14) : le client lit « Lait » ou « Melk ».
export const CODES_ALLERGENES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function libellesAllergenes(codes, t) {
  return (codes || []).filter((c) => CODES_ALLERGENES.includes(Number(c))).map((c) => t(`conformite.allergen${Number(c)}`));
}
