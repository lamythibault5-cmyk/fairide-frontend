/* « QUI TE DOIT QUOI » : LE CALCUL (fondateur, 2026-11-08, maquettes/bienvenue-partage ; revue avant GO du 13/11/2026,
 * client-commande 0 et 3). Module sans import, pour que `npm run check:groupe` (scripts/verifier-qui-doit-quoi.mjs) le
 * vérifie sans navigateur. Affiché par components/client/QuiDoitQuoi.jsx.
 *
 * Chaque invité doit SES plats tels qu'ils sont dans la commande, au prix payé, plus sa part égale de la livraison. Les plats
 * viennent des lignes de la COMMANDE (`commande.items`, GET /orders/mine), pas des lignes du groupe seules :
 *   - l'hôte commande souvent ses propres plats depuis SON panier, sans les envoyer au groupe (« Commander » garde ses
 *     lignes à lui, CartContext.replaceGroupLines). Diviser le sous-total par les seules lignes du groupe faisait payer
 *     ces plats aux invités (10 € de Calzone + 10 € de Salade de l'hôte : Marie devait 22,25 € au lieu de 12,25 €) ;
 *   - une part retirée ou réduite par l'hôte dans le panier après « Commander » n'est pas dans la commande : rien à devoir.
 * Une ligne de la commande appartient à un invité quand elle porte sa consigne « Pour <prénom> » (posée par « Commander »,
 * pages/client/CommandeGroupee.jsx, dans la langue de l'hôte à ce moment : le premier mot est sauté, voir consigneNomme)
 * et le même plat. Le prix payé d'une unité : prix de la ligne (options comprises) moins sa remise, puis l'offre sur tout
 * le panier (« X € offerts dès Y € ») répartie à proportion (sous-total payé / somme des lignes nettes). Le crédit de
 * bienvenue et le solde de l'hôte restent à l'hôte (ils ne sont pas dans le sous-total).
 *
 * Un invité = `participant` de la ligne du groupe quand le serveur le donne (clé opaque par groupe), sinon son prénom :
 * sans cette clé, deux invités au même prénom restent une seule ligne (client-commande 3, reste à faire côté serveur). */

const espaces = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// La consigne d'une ligne de la commande nomme-t-elle ce prénom ? Lue sur sa forme, celle que pose « Commander »
// (CommandeGroupee.jsx) : un mot (« Pour », « Voor », « For »), le prénom, puis la fin ou « · <la consigne de l'invité> ».
// Chercher le prénom n'importe où (revue du 2026-11-14) faisait se voler leurs plats « Marie » et « Marie D », et donnait
// à Marie la ligne « Pour Paul · comme Marie ». « Ana » ne prend pas non plus les plats d'« Anabelle ».
function consigneNomme(note, prenom) {
  const nom = espaces(prenom);
  if (!nom) return false;
  return new RegExp(`^\\S+ ${echapper(nom)}(?: · |$)`, 'u').test(espaces(note));
}
// À qui est cette consigne, parmi les prénoms du groupe : quand plusieurs pourraient convenir, le plus long gagne.
function titulaireConsigne(note, noms) {
  let titulaire = null;
  for (const n of noms) if (consigneNomme(note, n) && (!titulaire || espaces(n).length > espaces(titulaire).length)) titulaire = n;
  return titulaire;
}

const memePlat = (item, ligne) => (item.itemId && ligne.itemId ? String(item.itemId) === String(ligne.itemId) : espaces(item.name) === espaces(ligne.name));

export function partsDuGroupe(commande, groupe) {
  const autres = (groupe?.lines || []).filter((l) => !l.mine);
  const items = (commande?.items || []).map((i) => {
    const qty = Math.max(0, Math.floor(Number(i.qty) || 0));
    const net = Math.max(0, Number(i.price || 0) * qty - Number(i.discount || 0));
    return { ...i, reste: qty, unite: qty > 0 ? net / qty : 0, net };
  });
  const noms = [...new Set(autres.map((l) => l.guestName))];
  for (const i of items) i.titulaire = titulaireConsigne(i.note, noms);
  const totalNet = items.reduce((a, i) => a + i.net, 0);
  const sousTotal = Number(commande?.subtotal);
  const echelle = totalNet > 0 && sousTotal >= 0 && Number.isFinite(sousTotal) ? sousTotal / totalNet : 1;

  const parPersonne = new Map();
  for (const l of autres) {
    let voulu = Math.max(0, Math.floor(Number(l.qty) || 0));
    const candidates = items.filter((i) => i.reste > 0 && memePlat(i, l) && i.titulaire != null && espaces(i.titulaire) === espaces(l.guestName));
    // Le même plat à deux prix (options différentes) : d'abord la ligne au prix de cette part.
    candidates.sort((a, b) => Math.abs(Number(a.price) - Number(l.unitPrice)) - Math.abs(Number(b.price) - Number(l.unitPrice)));
    let pris = 0;
    let montant = 0;
    for (const i of candidates) {
      if (!voulu) break;
      const n = Math.min(voulu, i.reste);
      i.reste -= n;
      voulu -= n;
      pris += n;
      montant += n * i.unite;
    }
    if (!pris) continue;
    const cle = l.participant != null ? `p:${l.participant}` : `n:${l.guestName}`;
    const p = parPersonne.get(cle) || { cle, nom: l.guestName, plats: [], montant: 0 };
    p.plats.push(pris > 1 ? `${pris}× ${l.name}` : l.name);
    p.montant += montant;
    parPersonne.set(cle, p);
  }

  const personnes = [...parPersonne.values()];
  const livraison = commande?.orderType === 'delivery' ? Number(commande.deliveryFee || 0) - Number(commande.deliveryDiscount || 0) : 0;
  const partLivraison = livraison > 0 && personnes.length ? livraison / (personnes.length + 1) : 0;
  for (const p of personnes) p.du = +(p.montant * echelle + partLivraison).toFixed(2);
  return { personnes, partLivraison };
}
