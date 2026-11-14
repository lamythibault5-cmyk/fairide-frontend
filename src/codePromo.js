/* LE CODE PROMO SEUL (Owen, 2026-11-14, suite de la revue d'avant GO). Le serveur garde et renvoie « CODE (libellé) »
 * (« ETE (-4,00 €) », en français) : à côté d'un montant, le libellé le répétait (« ETE (-4,00 €) : -4,00 € »). Ce qu'un
 * client lit montre le code seul, comme les e-mails et le reçu (fairide-backend codesPromo.codeSeul, même règle). Un code
 * sans libellé est rendu tel quel. */
export function codeSeul(stocke) {
  const s = String(stocke ?? '').trim();
  const m = /^(\S+) \(.*\)$/.exec(s);
  return m ? m[1] : s;
}
