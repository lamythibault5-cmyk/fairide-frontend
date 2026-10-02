// « Commander à nouveau » (plan de test USR-9, 2 octobre 2026) : refait le panier d'une commande passée à partir de la
// carte D'AUJOURD'HUI — prix, disponibilité et options actuels, jamais ceux figés sur l'ancienne commande. Ce qui a
// disparu, est en rupture ou dont une option n'existe plus est signalé au lieu d'être ajouté en silence.
//
// Les options d'une commande sont figées par nom (groupName + name, voir resolveOptions côté serveur), pas par
// identifiant : on les retrouve par ces noms dans les groupes actuels du plat. « Toutes les crudités » (un groupe à choix
// multiple entièrement coché) se relit comme « tous les choix du groupe ».
import { api } from './api';

const norm = (s) => String(s || '').trim().toLowerCase();

function optionsActuelles(plat, snapshot) {
  const groupes = plat.optionGroups || [];
  const ids = [];
  for (const opt of snapshot || []) {
    const g = groupes.find((x) => norm(x.name) === norm(opt.groupName));
    if (!g) return null;
    if (/^toutes? les /i.test(opt.name)) { ids.push(...(g.items || []).map((i) => i.id)); continue; }
    const choix = (g.items || []).find((i) => norm(i.name) === norm(opt.name));
    if (!choix) return null;
    ids.push(choix.id);
  }
  // Un groupe obligatoire sans choix reconstitué : on ne peut pas deviner, le plat est signalé.
  if (groupes.some((g) => g.required && !(g.items || []).some((i) => ids.includes(i.id)))) return null;
  return ids;
}

// Renvoie { restaurant, lignes, manquants } : `lignes` prêtes pour cart.addOne, `manquants` = noms à signaler.
export async function preparerNouvelleCommande(order, token) {
  const restaurant = await api(`/restaurants/${order.restaurantId}`, { token });
  const carte = restaurant.menu || [];
  const lignes = []; const manquants = [];
  for (const it of order.items || []) {
    const plat = carte.find((m) => m.id === it.itemId) || carte.find((m) => norm(m.name) === norm(it.name));
    if (!plat || plat.available === false || plat.outOfStockToday || plat.alcoholUnavailable) { manquants.push(it.name); continue; }
    const optionItemIds = optionsActuelles(plat, it.options);
    if (optionItemIds === null) { manquants.push(it.name); continue; }
    const groupes = plat.optionGroups || [];
    const optionsSnapshot = groupes.flatMap((g) => (g.items || []).filter((i) => optionItemIds.includes(i.id)).map((i) => ({ groupName: g.name, name: i.name, priceDelta: Number(i.priceDelta || 0) })));
    const unitPrice = +(Number(plat.price) + optionsSnapshot.reduce((a, o) => a + o.priceDelta, 0)).toFixed(2);
    lignes.push({ itemId: plat.id, name: plat.name, imageUrl: plat.imageUrl || '', unitPrice, optionItemIds, optionsSnapshot, qty: it.qty });
  }
  return { restaurant, lignes, manquants };
}
