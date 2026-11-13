// Les déclarations de prix du commerce, triées par plat ou supplément (haussesOutils.jsx, useDeclarations). Sans import :
// une fonction pure, que l'on peut appeler hors du navigateur.

const instant = (d) => { const n = typeof d === 'number' ? d : Date.parse(d); return Number.isFinite(n) ? n : 0; };
const cents = (v) => Math.round(Number(v) * 100);
// Une déclaration vise un plat ou un supplément : la clé qui les sépare (un plat et un supplément peuvent avoir le même id).
export const cleDeclaration = (d) => (d?.optionItemId ? `o:${d.optionItemId}` : d?.itemId ? `p:${d.itemId}` : null);

/* La déclaration qui compte pour chaque plat ou supplément : la dernière, sauf un refus qui attend encore le choix du commerce.
 * UN REFUS QUE LE MÊME PRIX NE REMPLACE PAS (revue avant GO, 13/11). Après un refus, le commerce pouvait toucher le prix et
 * redire le même : une déclaration plus récente, sans vérification, cachait la carte « Photo à revoir », alors que le serveur
 * remet quand même l'ancien prix 48 h plus tard, parce que le prix en ligne est toujours celui refusé (backend haussesPrix.js,
 * remettreAncienPrix). Le refus reste donc tant que toutes les déclarations suivantes gardent le prix refusé ; un autre prix
 * (une baisse, une nouvelle hausse) le remplace, comme pour le serveur. */
export function derniereParPlat(liste) {
  const parCle = new Map();
  [...liste].sort((a, b) => instant(b.declaredAt) - instant(a.declaredAt)).forEach((d) => {
    const k = cleDeclaration(d);
    if (!k) return;
    if (!parCle.has(k)) parCle.set(k, []);
    parCle.get(k).push(d);
  });
  const m = new Map();
  for (const [k, ds] of parCle) {
    const i = ds.findIndex((d) => d.checkStatus === 'refusee');
    const r = i > 0 ? ds[i] : null;
    const attend = r && !r.shopChoice && !r.restoredAt && ds.slice(0, i).every((d) => cents(d.counterPrice) === cents(r.counterPrice));
    m.set(k, attend ? r : ds[0]);
  }
  return m;
}
