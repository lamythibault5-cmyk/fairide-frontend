/* Clé à usage unique d'un onglet lancé par la console admin (« Fairide s'en occupe » et Admin › Simulation).
 *
 * POURQUOI CE FICHIER (audit sécurité 2026-10-31, constat n° 3). Ces deux boutons ouvrent un nouvel onglet qui reçoit une
 * session par le fragment d'adresse (#agir=… ou #simuler=…). Rien ne liait ce fragment au clic de l'admin : n'importe qui
 * pouvait envoyer un lien « fairride.be/…#agir=<son propre jeton> », et l'onglet de la victime adoptait le compte de
 * l'attaquant sans le moindre signe (le bandeau n'existe que dans le tableau de bord commerce). Ce que la victime tapait
 * ensuite (adresse, commande, carte enregistrée au paiement) partait sur le compte de l'attaquant.
 *
 * La parade : juste avant window.open, l'onglet admin dépose une clé aléatoire dans localStorage (partagé par les onglets
 * d'une même origine, inaccessible à un autre site) et la met aussi dans le fragment. L'onglet ouvert n'adopte la session
 * que si la clé du fragment est attendue et pas expirée, puis l'efface : un lien fabriqué ailleurs, ou rejoué plus tard,
 * ne trouve rien. Deux minutes suffisent, l'onglet s'ouvre dans la seconde. Plusieurs clés peuvent attendre en même temps
 * (deux clics rapprochés), d'où une table clé → échéance plutôt qu'une seule valeur.
 *
 * Sans stockage (navigation privée stricte, stockage bloqué), le lancement échoue proprement : l'onglet garde sa session
 * normale. C'est voulu, on préfère un bouton admin qui ne marche pas à une adoption non vérifiée. */
const CLE_STOCKAGE = 'fairide_lancements_onglet';
const DUREE_MS = 2 * 60 * 1000;

function lire() {
  try {
    const m = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || '{}');
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch { return {}; }
}

// Écrit la table sans les clés échues, pour qu'un lancement bloqué (fenêtre refusée) ne s'accumule pas.
function ecrire(m) {
  const maintenant = Date.now();
  const vivantes = {};
  for (const [k, echeance] of Object.entries(m)) if (Number(echeance) > maintenant) vivantes[k] = echeance;
  try {
    if (Object.keys(vivantes).length) localStorage.setItem(CLE_STOCKAGE, JSON.stringify(vivantes));
    else localStorage.removeItem(CLE_STOCKAGE);
  } catch { /* sans stockage : le lancement échouera, voir l'en-tête */ }
}

// Côté console admin, juste avant window.open : renvoie la clé à mettre dans le fragment (« &lancement=<clé> »).
export function preparerLancement() {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  const cle = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  const m = lire();
  m[cle] = Date.now() + DUREE_MS;
  ecrire(m);
  return cle;
}

// Côté onglet ouvert : la clé portée par le fragment, à lire AVANT que replaceState n'efface ce fragment.
export function cleDuFragment(hash) {
  const m = String(hash || '').match(/[#&]lancement=([0-9a-f]{32})(?:&|$)/);
  return m ? m[1] : null;
}

// Vrai seulement si la clé a été déposée par cet appareil il y a moins de deux minutes. Elle est consommée dans tous les
// cas : une même clé ne sert jamais deux fois.
export function lancementAttendu(cle) {
  if (!cle) return false;
  const m = lire();
  const echeance = Number(m[cle]);
  delete m[cle];
  ecrire(m);
  return Number.isFinite(echeance) && echeance > Date.now();
}
