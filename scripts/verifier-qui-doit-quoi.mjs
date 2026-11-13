// VÉRIFICATION DE « QUI TE DOIT QUOI » — `npm run check:groupe` (revue avant GO du 13/11/2026, client-commande 0 et 3).
//
// Le calcul de ce que chaque invité d'une commande groupée doit à l'hôte (src/partsGroupe.js, affiché par
// components/client/QuiDoitQuoi.jsx sur « Commande confirmée ») est une fonction sans import : ce script la nourrit de
// commandes et de groupes tels que GET /orders/mine et GET /group-orders/:code les renvoient, et vérifie chaque montant.
// Aucun navigateur, aucun serveur. Pas de cadre de test dans ce dépôt (CLAUDE.md) : node:assert seulement.
//
// Le cas qui a lancé ce script : l'hôte commande sa Salade (10 €) depuis SON panier, Marie sa Calzone (10 €) par le groupe,
// livraison 4,50 €. L'écran demandait 22,25 € à Marie (le sous-total entier rapporté à sa seule Calzone) au lieu de 12,25 €.
import assert from 'node:assert/strict';
import { partsDuGroupe } from '../src/partsGroupe.js';

const commande = (items, autres = {}) => ({
  orderType: 'delivery', deliveryFee: 4.5, deliveryDiscount: 0,
  subtotal: +items.reduce((a, i) => a + i.price * i.qty - (i.discount || 0), 0).toFixed(2), items, ...autres
});
const ligne = (guestName, itemId, name, unitPrice, qty = 1, autres = {}) => ({ id: `${guestName}-${itemId}-${qty}`, guestName, mine: false, itemId, name, unitPrice, qty, note: null, ...autres });
const du = (r) => Object.fromEntries(r.personnes.map((p) => [p.cle, p.du]));

const CAS = [
  {
    nom: "l'hôte commande ses propres plats depuis son panier (pas envoyés au groupe)",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Marie' }, { itemId: 'salade', name: 'Salade', price: 10, qty: 1 }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10)],
    attendu: { 'n:Marie': 12.25 }
  },
  {
    nom: "une part retirée par l'hôte dans le panier après « Commander » n'est pas due",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Marie' }, { itemId: 'salade', name: 'Salade', price: 10, qty: 1 }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10), ligne('Igor', 'tiramisu', 'Tiramisu', 6)],
    attendu: { 'n:Marie': 12.25 }
  },
  {
    nom: "une part réduite par l'hôte (2 demandées, 1 commandée)",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Marie' }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10, 2)],
    attendu: { 'n:Marie': 12.25 }
  },
  {
    nom: "l'offre d'un plat et l'offre sur le panier, au prix payé",
    // Calzone 10 € −20 % = 8 € pour Marie ; Salade 10 € de l'hôte ; puis 3,60 € offerts sur le panier (18 € → 14,40 €, × 0,8).
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, discount: 2, note: 'Pour Marie' }, { itemId: 'salade', name: 'Salade', price: 10, qty: 1 }], { subtotal: 14.4 }),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10)],
    attendu: { 'n:Marie': 8.65 } // 8 × 0,8 + 2,25
  },
  {
    nom: "deux invités et l'hôte : livraison en trois",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 8, qty: 1, note: 'Pour Marie' }, { itemId: 'tiramisu', name: 'Tiramisu', price: 6, qty: 1, note: 'Voor Igor · zonder cacao' }, { itemId: 'salade', name: 'Salade', price: 6, qty: 1, note: 'Pour Cléa' }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 8), ligne('Igor', 'tiramisu', 'Tiramisu', 6, 1, { note: 'zonder cacao' }), { ...ligne('Cléa', 'salade', 'Salade', 6), mine: true }],
    attendu: { 'n:Marie': 9.5, 'n:Igor': 7.5 }
  },
  {
    nom: "le même plat pour l'hôte et pour un invité : chacun le sien",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Marie' }, { itemId: 'calzone', name: 'Calzone', price: 10, qty: 1 }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10)],
    attendu: { 'n:Marie': 12.25 }
  },
  {
    nom: "« Ana » ne prend pas le plat d'« Anabelle »",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Anabelle' }]),
    lignes: [ligne('Ana', 'calzone', 'Calzone', 10), ligne('Anabelle', 'calzone', 'Calzone', 10)],
    attendu: { 'n:Anabelle': 12.25 }
  },
  {
    nom: 'deux invités au même prénom, quand le serveur les distingue (participant)',
    // Les deux Calzone « Pour Marie » sont une seule ligne du panier (qty 2), comme CartContext.replaceGroupLines les fusionne.
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 8, qty: 2, note: 'Pour Marie' }, { itemId: 'tiramisu', name: 'Tiramisu', price: 6, qty: 1, note: 'Pour Marie' }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 8, 1, { participant: 1 }), ligne('Marie', 'calzone', 'Calzone', 8, 1, { participant: 2, id: 'm2c' }), ligne('Marie', 'tiramisu', 'Tiramisu', 6, 1, { participant: 2 })],
    attendu: { 'p:1': 9.5, 'p:2': 15.5 }
  },
  {
    nom: "à emporter : pas de livraison à partager",
    commande: commande([{ itemId: 'calzone', name: 'Calzone', price: 10, qty: 1, note: 'Pour Marie' }, { itemId: 'salade', name: 'Salade', price: 10, qty: 1 }], { orderType: 'pickup' }),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10)],
    attendu: { 'n:Marie': 10 }
  },
  {
    nom: 'aucune part des invités dans la commande : rien à afficher',
    commande: commande([{ itemId: 'salade', name: 'Salade', price: 10, qty: 1 }]),
    lignes: [ligne('Marie', 'calzone', 'Calzone', 10)],
    attendu: {}
  }
];

let echecs = 0;
for (const c of CAS) {
  try {
    assert.deepEqual(du(partsDuGroupe(c.commande, { lines: c.lignes })), c.attendu);
    console.log(`OK     ${c.nom}`);
  } catch (e) {
    echecs += 1;
    console.log(`ÉCHEC  ${c.nom}\n       attendu ${JSON.stringify(e.expected)}, calculé ${JSON.stringify(e.actual)}`);
  }
}
console.log(`\n${echecs} échec(s) sur ${CAS.length}`);
process.exit(echecs ? 1 : 0);
