import { orderTypeLabel, deliveryInstructionLabel } from './orderStatus';

// Génère le ticket d'une commande au format ESC/POS, le langage que comprennent les imprimantes
// thermiques. Le contenu reprend celui de OrderReceipt.jsx (impression navigateur) : c'est le même
// document, rendu par deux moyens différents. Toute information ajoutée ici doit l'être là aussi.
//
// Pourquoi un générateur d'octets plutôt qu'un rendu HTML : une imprimante thermique Bluetooth ne
// reçoit pas de page, elle reçoit un flux de caractères et de commandes. Il n'y a ni police, ni mise
// en page, seulement un nombre de colonnes fixe et quelques commandes de style.

// Largeur en caractères selon le format de papier. 58mm est le format des petites imprimantes
// Bluetooth de comptoir, 80mm celui des imprimantes de cuisine.
export const COLUMNS_58MM = 32;
export const COLUMNS_80MM = 48;

const ESC = 0x1b;
const GS = 0x1d;

// --- Accents ---------------------------------------------------------------------------------------
// Les imprimantes ESC/POS démarrent sur une table de caractères historique (CP437) où les accents
// français ne tombent pas au bon endroit : « Crème brûlée » sortirait en « CrÞme br¹lÚe ». Le jeu de
// caractères se change par commande, mais chaque fabricant numérote ses tables différemment et une
// valeur fausse produit du charabia sur tout le ticket. Retirer les diacritiques est le seul choix qui
// donne un résultat lisible sur n'importe quel modèle — « Creme brulee » se lit sans hésitation.
function toAscii(str) {
  return String(str == null ? '' : str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Les ligatures n'ont pas de decomposition Unicode : sans ces deux lignes, NFD les laisse
    // intactes et le filtre ASCII les supprime — « Bœuf » sortait « Buf ».
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7e\n]/g, '');
}

function money(n) {
  return `${Number(n || 0).toFixed(2)}EUR`;
}

// Coupe un texte trop long pour la largeur du papier, sans casser les mots quand c'est possible.
function wrap(text, cols) {
  const mots = toAscii(text).split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = '';
  for (const mot of mots) {
    if (!courante.length) courante = mot;
    else if (courante.length + 1 + mot.length <= cols) courante += ' ' + mot;
    else { lignes.push(courante); courante = mot; }
    // Un mot seul plus long que la largeur (URL, nom à rallonge) : on le tronçonne de force.
    while (courante.length > cols) { lignes.push(courante.slice(0, cols)); courante = courante.slice(cols); }
  }
  if (courante.length) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

// Libellé à gauche, montant à droite, points de conduite au milieu. Si les deux ne tiennent pas sur
// une ligne, le libellé passe au-dessus et le montant reste seul à droite : jamais de montant tronqué.
function pair(gauche, droite, cols) {
  const g = toAscii(gauche);
  const d = toAscii(droite);
  if (g.length + d.length + 1 <= cols) return g + ' '.repeat(cols - g.length - d.length) + d;
  const lignes = wrap(g, cols);
  lignes.push(' '.repeat(Math.max(0, cols - d.length)) + d);
  return lignes.join('\n');
}

class Ticket {
  constructor(cols) {
    this.cols = cols;
    this.bytes = [];
  }
  raw(...b) { this.bytes.push(...b); return this; }
  text(s) {
    for (const ch of toAscii(s)) this.bytes.push(ch.charCodeAt(0));
    return this;
  }
  line(s = '') { return this.text(s).raw(0x0a); }
  lines(s, cols = this.cols) { wrap(s, cols).forEach((l) => this.line(l)); return this; }
  align(n) { return this.raw(ESC, 0x61, n); }          // 0 gauche, 1 centre, 2 droite
  bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  // GS ! : quartet haut = largeur, quartet bas = hauteur. 0x11 double les deux.
  size(double) { return this.raw(GS, 0x21, double ? 0x11 : 0x00); }
  rule() { return this.line('-'.repeat(this.cols)); }
  build() { return new Uint8Array(this.bytes); }
}

function formatDateTime(ms) {
  return new Date(ms).toLocaleString('fr-BE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function buildTicketBytes(order, restaurant, { columns = COLUMNS_58MM } = {}) {
  const t = new Ticket(columns);
  t.raw(ESC, 0x40);                                     // réinitialise (marge, style, table de caractères)

  // --- En-tête : qui vend --------------------------------------------------------------------------
  t.align(1).bold(true).size(true);
  t.lines(restaurant?.legalName || restaurant?.name || 'Restaurant', Math.floor(columns / 2));
  t.size(false).bold(false);
  if (restaurant?.address) t.lines(restaurant.address);
  const tva = restaurant?.vatNumber;
  const entreprise = restaurant?.companyNumber;
  if (tva) t.line(`TVA ${tva}`);
  if (entreprise) t.line(`N entreprise ${entreprise}`);

  // --- Identification de la commande ---------------------------------------------------------------
  t.align(0).rule().align(1);
  t.bold(true).line(`Commande #${order.id.slice(0, 8)}`).bold(false);
  t.line(formatDateTime(order.createdAt));
  t.line(orderTypeLabel(order));
  t.align(0).rule();

  // --- Client ---------------------------------------------------------------------------------------
  t.bold(true).lines(order.orderType === 'dine_in' ? (order.reservationName || '') : (order.clientName || '')).bold(false);
  if (order.clientPhone) t.line(order.clientPhone);
  if (order.orderType === 'dine_in' && order.partySize) {
    t.line(`Table pour ${order.partySize} personne${order.partySize > 1 ? 's' : ''}`);
  }
  if (order.deliveryInstructions) t.lines(`Consigne : ${deliveryInstructionLabel(order.deliveryInstructions)}`);
  if (order.deliveryNote) t.lines(`Note : ${order.deliveryNote}`);
  // L'adresse de livraison est volontairement absente, comme sur le ticket navigateur : le livreur l'a
  // déjà dans son application, et ce ticket voyage collé sur un sac, visible de tous.
  t.rule();

  // --- Articles -------------------------------------------------------------------------------------
  // Une réservation de table peut n'avoir aucun plat : imprimer une liste vide suivie d'un « TOTAL
  // 0.00EUR » ferait lire le ticket comme une commande impayée. On dit ce qu'il est.
  if (!(order.items || []).length) {
    t.align(1).lines('Reservation de table').line('sans commande').align(0);
    t.rule();
    t.lines("Le client commandera sur place.");
    t.align(1).line().line('A bientot !');
    t.raw(0x0a, 0x0a, 0x0a, 0x0a);
    t.raw(GS, 0x56, 0x42, 0x00);
    return t.build();
  }
  for (const i of order.items || []) {
    const montant = money(i.price * i.qty - (i.discount || 0));
    t.line(pair(`${i.qty}x ${i.name}`, montant, columns));
    if (i.options?.length) {
      // Les options sont indentées pour se distinguer du plat auquel elles se rattachent.
      wrap(i.options.map((o) => o.name).join(', '), columns - 2).forEach((l) => t.line('  ' + l));
    }
  }
  t.rule();

  // --- Totaux ---------------------------------------------------------------------------------------
  t.line(pair('Sous-total', money(order.subtotal), columns));
  if (order.promoDiscount > 0) t.line(pair(`Promo ${order.promoLabel || ''}`.trim(), `-${money(order.promoDiscount)}`, columns));
  if (order.orderType === 'delivery') t.line(pair('Livraison', money(order.deliveryFee), columns));
  if (order.serviceFee > 0) t.line(pair('Frais de service', money(order.serviceFee), columns));
  if (order.balanceUsed > 0) t.line(pair('Solde client utilise', `-${money(order.balanceUsed)}`, columns));
  t.rule();
  t.bold(true).size(true);
  // En double largeur, une ligne fait deux fois moins de colonnes : le total doit être calé sur cette
  // largeur-là, sinon il déborde et repart à la ligne au milieu du montant.
  t.line(pair('TOTAL', money(order.total), Math.floor(columns / 2)));
  t.size(false).bold(false);
  t.align(1).line(order.paid ? 'Paye via Fairide' : 'NON PAYE').align(0);

  // --- Pied ------------------------------------------------------------------------------------------
  t.rule();
  t.lines("Recapitulatif de commande fourni par Fairide - ne remplace pas le ticket de caisse de votre propre systeme d'encaissement si vous y etes soumis legalement.");
  t.align(1).line().line('Merci et bonne degustation !');

  // Avance le papier pour dégager la zone de découpe, puis tente une coupe partielle. Les modèles sans
  // massicot ignorent simplement la commande — d'où l'avance papier, qui reste utile dans les deux cas.
  t.raw(0x0a, 0x0a, 0x0a, 0x0a);
  t.raw(GS, 0x56, 0x42, 0x00);
  return t.build();
}
