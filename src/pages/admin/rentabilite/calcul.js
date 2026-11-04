// Calculs de la simulation « Et si… ? » d'Admin › Finances › Coûts et rentabilité (Owen, 2026-11-04 : « que se passe-t-il
// à 200 commandes par mois, et combien il en faut pour être à l'équilibre »). Fonctions pures, appelées à chaque frappe.
// Les tarifs (Stripe, commission, frais de système) viennent du serveur (backend rentabilite.js › TARIFS, pricing.js) :
// rien n'est recopié ici.
//
// Ce que Fairride garde sur une commande, d'après argent.md :
//   - livraison par un livreur Fairride : 10 % des plats + 10 % des frais de livraison ;
//   - emporter payé en ligne : 10 % des plats ;
//   - emporter payé au commerce : rien (ni commission ni frais).
// Ce qu'elle paie : le frais Stripe du paiement (Bancontact fixe, ou carte % + fixe), 0,25 % de ce qu'elle reverse
// (Connect), quelques centimes de SMS et d'e-mails ; et chaque mois 2 € par commerce ou livreur payé, plus ses virements.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Une commande d'un type donné : ce qui entre, ce qui sort, ce qui reste. `h` = hypothèses, `t` = tarifs, `p` = prix.
export function margeCommande(type, h, t, p) {
  if (type === 'emporterCommerce') return { revenu: 0, stripe: 0, virement: 0, divers: 0, net: 0 };
  const panier = Number(h.panier) || 0;
  const livraison = type === 'livraison' ? Number(h.livraison) || 0 : 0;
  const revenu = panier * p.commission + livraison * p.fraisSysteme;
  const paye = panier + livraison;
  const partBancontact = Math.min(100, Math.max(0, Number(h.partBancontact) || 0)) / 100;
  const stripe = partBancontact * t.bancontact + (1 - partBancontact) * ((paye * t.cartePourcent) / 100 + t.carteFixe);
  const virement = ((paye - revenu) * t.virementPourcent) / 100;
  const divers = t.diversParCommande;
  return { revenu, stripe, virement, divers, net: revenu - stripe - virement - divers };
}

// Le mois simulé. `h.commandes` par mois, réparties selon h.partLivraison / h.partEmporterEnLigne (le reste : payé au
// commerce). Les comptes Connect payés ne peuvent pas dépasser les commandes qui les paient : 100 livreurs pour
// 50 livraisons, c'est au plus 50 livreurs payés.
export function simuler(h, t, p, coutsFixes) {
  const n = Math.max(0, Number(h.commandes) || 0);
  const pl = Math.min(100, Math.max(0, Number(h.partLivraison) || 0)) / 100;
  const pe = Math.min(1 - pl, Math.max(0, Number(h.partEmporterEnLigne) || 0) / 100);
  const nb = { livraison: n * pl, emporterEnLigne: n * pe, emporterCommerce: n * (1 - pl - pe) };
  const lignes = { revenu: 0, stripe: 0, virement: 0, divers: 0 };
  for (const type of Object.keys(nb)) {
    const m = margeCommande(type, h, t, p);
    for (const k of Object.keys(lignes)) lignes[k] += m[k] * nb[type];
  }
  const enLigne = nb.livraison + nb.emporterEnLigne;
  const commerces = Math.min(Math.max(0, Number(h.commerces) || 0), Math.ceil(enLigne));
  const livreurs = Math.min(Math.max(0, Number(h.livreurs) || 0), Math.ceil(nb.livraison));
  const parCompte = t.compteActifMois + t.virementsParMois * t.virementFixe;
  const connect = (commerces + livreurs) * parCompte;
  const resultat = lignes.revenu - lignes.stripe - lignes.virement - lignes.divers - connect - coutsFixes;
  return {
    commandes: n, nb, commercesPayes: commerces, livreursPayes: livreurs,
    revenu: r2(lignes.revenu), stripe: r2(lignes.stripe), virement: r2(lignes.virement), divers: r2(lignes.divers),
    connect: r2(connect), coutsFixes: r2(coutsFixes), resultat: r2(resultat),
    netParCommande: n > 0 ? r2((lignes.revenu - lignes.stripe - lignes.virement - lignes.divers) / n) : r2(margeMoyenne(h, t, p))
  };
}

// Ce qui reste en moyenne sur une commande, avec la répartition choisie (avant les coûts du mois).
export function margeMoyenne(h, t, p) {
  const pl = Math.min(100, Math.max(0, Number(h.partLivraison) || 0)) / 100;
  const pe = Math.min(1 - pl, Math.max(0, Number(h.partEmporterEnLigne) || 0) / 100);
  return pl * margeCommande('livraison', h, t, p).net + pe * margeCommande('emporterEnLigne', h, t, p).net;
}

// Le plus petit nombre de commandes par mois où le résultat n'est plus négatif (null si la marge ne suffit jamais).
// Cherché pas à pas plutôt qu'en divisant : les comptes Connect suivent les commandes jusqu'à leur plafond.
export function pointMort(h, t, p, coutsFixes) {
  if (margeMoyenne(h, t, p) <= 0) return null;
  let bas = 0; let haut = 1;
  while (simuler({ ...h, commandes: haut }, t, p, coutsFixes).resultat < 0) {
    haut *= 2;
    if (haut > 1e7) return null;
  }
  while (bas < haut) {
    const milieu = Math.floor((bas + haut) / 2);
    if (simuler({ ...h, commandes: milieu }, t, p, coutsFixes).resultat >= 0) haut = milieu; else bas = milieu + 1;
  }
  return bas;
}
