// Registre des applications de l'ERP admin — une seule source pour l'écran d'accueil (tuiles), la
// barre latérale (sections + pastilles) et l'en-tête de chaque page (fil d'Ariane, description).
// Sur le modèle d'Odoo : chaque application a un nom, une icône, une phrase qui dit à quoi elle sert,
// et un compteur « à traiter » calculé depuis GET /admin/overview.
//
// `badge(overview)` renvoie { count, tone } : tone 'danger' = quelque chose bloque ou est en retard,
// 'warn' = à faire bientôt, 'info' = simple volume. Tous les accès à l'overview sont tolérants
// (`?.`, `|| 0`) : un champ que le serveur n'envoie pas encore ne doit jamais faire planter l'accueil.

// LES PÔLES (2026-09-23). La barre latérale listait les 26 applications à plat, en six familles :
// plus haut qu'un écran de portable, et des doublons côte à côte qu'on ne savait pas départager
// (Livreurs / Dossiers livreurs, CRM / Sales, Support / Messages, Tableau de bord / Rapports /
// Finance). Les applications restent toutes — mêmes adresses, mêmes écrans — mais la barre ne
// montre plus que sept pôles, un par métier, et chaque application devient un onglet de son
// pôle (voir AdminPageHeader.jsx). L'ordre de `modules` est l'ordre des onglets : la première est
// celle où mène l'entrée de la barre, donc celle qu'on ouvre le plus souvent.
// `icon` est un nom de tracé de components/Icone.jsx, plus un emoji : voir l'en-tête de ce fichier-là.
export const ADMIN_HUBS = [
  { key: 'orders', icon: 'commandes', modules: ['orders', 'incidents', 'reviews'] },
  { key: 'partners', icon: 'commerce', modules: ['restaurants', 'sales', 'crm'] },
  { key: 'couriers', icon: 'scooter', modules: ['drivers', 'couriers', 'logistics'] },
  { key: 'customers', icon: 'personnes', modules: ['clients', 'promotions', 'marketing'] },
  { key: 'inbox', icon: 'bulle', modules: ['support', 'messages', 'tasks'] },
  { key: 'money', icon: 'euro', modules: ['dashboard', 'finance', 'payments', 'invoices', 'accounting', 'reports'] },
  // Documents vit ici et pas sous Commerces : il couvre aussi les livreurs. Ses urgences (pièce
  // expirée, à vérifier) remontent de toute façon sur l'accueil, qui pointe directement dessus.
  { key: 'settings', icon: 'reglages', modules: ['settings', 'team', 'documents', 'compliance', 'automations'] }
];
// Gardé pour Équipe & accès, qui range son tableau des droits par famille : les familles sont désormais les pôles.
export const ADMIN_GROUPS = ADMIN_HUBS.map((h) => h.key);

const aucun = () => null;
function pastille(count, tone = 'warn') { return count > 0 ? { count, tone } : null; }
const n = (v) => Number(v) || 0;

export const ADMIN_MODULES = [
  { key: 'dashboard', path: '/admin/dashboard', icon: 'stats', hub: 'money', badge: aucun },
  { key: 'orders', path: '/admin/orders', icon: 'commandes', hub: 'orders',
    badge: (o) => pastille(n(o.orders?.pending) + n(o.orders?.noDriver) + n(o.orders?.late), n(o.orders?.late) + n(o.orders?.noDriver) > 0 ? 'danger' : 'warn') },
  { key: 'restaurants', path: '/admin/restaurants', icon: 'commerce', hub: 'partners', badge: (o) => pastille(n(o.restaurants?.pending)) },
  { key: 'drivers', path: '/admin/drivers', icon: 'scooter', hub: 'couriers', badge: (o) => pastille(n(o.drivers?.pending)) },
  { key: 'couriers', path: '/admin/couriers', icon: 'dossier', hub: 'couriers', badge: (o) => pastille(n(o.couriers?.pending)) },
  { key: 'clients', path: '/admin/clients', icon: 'personnes', hub: 'customers', badge: (o) => pastille(n(o.clients?.newWeek), 'info') },
  { key: 'reviews', path: '/admin/reviews', icon: 'etoile', hub: 'orders', badge: (o) => pastille(n(o.reviews?.low), 'danger') },
  { key: 'crm', path: '/admin/crm', icon: 'cible', hub: 'partners', badge: (o) => pastille(n(o.crm?.followUpsOverdue), 'danger') },
  // Un code actif n'est pas « à traiter » : seule une donnée d'action réelle (codes qui expirent sous
  // peu, si le serveur la fournit) mérite une pastille.
  { key: 'promotions', path: '/admin/promotions', icon: 'etiquette', hub: 'customers', badge: (o) => pastille(n(o.promotions?.expiringSoon)) },
  { key: 'finance', path: '/admin/finance', icon: 'euro', hub: 'money', badge: aucun },
  { key: 'payments', path: '/admin/payments', icon: 'carteBancaire', hub: 'money', badge: (o) => (o.payments?.failedToday !== undefined ? pastille(n(o.payments?.failedToday), 'danger') : null) },
  { key: 'invoices', path: '/admin/invoices', icon: 'document', hub: 'money', badge: (o) => pastille(n(o.invoices?.unpaid), n(o.invoices?.overdue) > 0 ? 'danger' : 'warn') },
  { key: 'accounting', path: '/admin/accounting', icon: 'guide', hub: 'money', badge: (o) => pastille(n(o.accounting?.unbalancedGroups) + n(o.accounting?.flaggedEntries) + n(o.accounting?.openPeriodsBehind), 'warn') },
  { key: 'support', path: '/admin/support', icon: 'bouee', hub: 'inbox', badge: (o) => pastille(n(o.support?.open), n(o.support?.slaBreached) > 0 ? 'danger' : 'warn') },
  { key: 'documents', path: '/admin/documents', icon: 'contrat', hub: 'settings', badge: (o) => pastille(n(o.documents?.pending) + n(o.documents?.expired) + n(o.documents?.expiringSoon), n(o.documents?.expired) > 0 ? 'danger' : 'warn') },
  { key: 'tasks', path: '/admin/tasks', icon: 'coche', hub: 'inbox', badge: (o) => pastille(n(o.tasks?.overdue) + n(o.tasks?.dueSoon), n(o.tasks?.overdue) > 0 ? 'danger' : 'warn') },
  { key: 'automations', path: '/admin/automations', icon: 'eclair', hub: 'settings', badge: aucun },
  { key: 'settings', path: '/admin/settings', icon: 'reglages', hub: 'settings', badge: aucun },
  // Applications ajoutées le 2026-09-09 (« toutes les applications importantes pour un business comme Fairide »).
  { key: 'marketing', path: '/admin/marketing', icon: 'megaphone', hub: 'customers', badge: (o) => pastille(o.marketing?.scheduled || 0, 'info') },
  { key: 'logistics', path: '/admin/logistics', icon: 'carte', hub: 'couriers', badge: (o) => pastille(o.logistics?.zonesUncovered || 0, 'warn') },
  { key: 'incidents', path: '/admin/incidents', icon: 'alerte', hub: 'orders', badge: (o) => pastille(o.incidents?.open || 0, (o.incidents?.overdue || 0) > 0 ? 'danger' : 'warn') },
  { key: 'reports', path: '/admin/reports', icon: 'tendance', hub: 'money', badge: aucun },
  { key: 'team', path: '/admin/team', icon: 'compte', hub: 'settings', badge: aucun },
  { key: 'messages', path: '/admin/messages', icon: 'bulle', hub: 'inbox', badge: (o) => pastille(o.messages?.unread || 0, 'warn') },
  // Sales (2026-09-17) : codes commerciaux, commerciaux (proches qui démarchent les restaurateurs) et commerces démarchés.
  { key: 'sales', path: '/admin/sales', icon: 'mallette', hub: 'partners', badge: (o) => pastille(o.sales?.overdue || 0, 'warn') },
  { key: 'compliance', path: '/admin/compliance', icon: 'bouclier', hub: 'settings', badge: (o) => pastille((o.compliance?.privacyOpen || 0) + (o.compliance?.privacyOverdue || 0), (o.compliance?.privacyOverdue || 0) > 0 ? 'danger' : 'warn') }
];

// Rôles autorisés par application (Équipe & accès) : absent = tous les membres. Le serveur applique la même
// règle par préfixe d'adresse dans middleware/auth.js (requireAdmin) ; ici on ne fait que masquer la barre latérale.
export const MODULE_ROLES = {
  finance: ['owner', 'admin', 'finance'], payments: ['owner', 'admin', 'finance'], invoices: ['owner', 'admin', 'finance'], accounting: ['owner', 'admin', 'finance'],
  settings: ['owner', 'admin'], automations: ['owner', 'admin'],
  marketing: ['owner', 'admin', 'ops'],
  logistics: ['owner', 'admin', 'ops', 'support'],
  incidents: ['owner', 'admin', 'ops', 'support', 'finance'],
  reports: ['owner', 'admin', 'finance', 'ops'],
  team: ['owner', 'admin'],
  compliance: ['owner', 'admin', 'finance'],
  messages: ['owner', 'admin', 'ops', 'support'],
  sales: ['owner', 'admin', 'ops']
};
export function moduleAllowed(mod, role) {
  const roles = MODULE_ROLES[mod.key];
  return !roles || !role || roles.includes(role);
}

export function moduleByKey(key) {
  return ADMIN_MODULES.find((m) => m.key === key) || null;
}

export function moduleForPath(pathname) {
  // Le plus long préfixe gagne (/admin/orders avant /admin).
  return ADMIN_MODULES.filter((m) => pathname === m.path || pathname.startsWith(m.path + '/')).sort((a, b) => b.path.length - a.path.length)[0] || null;
}

// Pastille d'une application (null si rien à signaler) — tolère un overview absent (chargement).
export function moduleBadge(mod, overview) {
  if (!overview) return null;
  try { return mod.badge(overview); } catch { return null; }
}

export function hubByKey(key) {
  return ADMIN_HUBS.find((h) => h.key === key) || null;
}

// Applications d'un pôle ouvertes au rôle du membre, dans l'ordre des onglets.
export function hubModules(hub, role) {
  return hub.modules.map(moduleByKey).filter((m) => m && moduleAllowed(m, role));
}

// Pastille d'un pôle dans la barre latérale : la somme de ce qui ATTEND une action. Les pastilles
// 'info' (nouveaux clients de la semaine, campagnes programmées) sont un simple volume ; additionnées
// dans la barre, elles y allumaient un chiffre en permanence et noyaient le seul qui compte. Elles
// restent visibles sur l'onglet de leur application.
const RANG = { info: 0, warn: 1, danger: 2 };
export function hubBadge(hub, overview, role) {
  let count = 0;
  let tone = null;
  for (const m of hubModules(hub, role)) {
    const b = moduleBadge(m, overview);
    if (!b || b.tone === 'info') continue;
    count += b.count;
    if (!tone || RANG[b.tone] > RANG[tone]) tone = b.tone;
  }
  return count > 0 ? { count, tone } : null;
}

// « À traiter aujourd'hui » : les lignes de l'écran d'accueil, dans l'ordre d'urgence. Chaque ligne
// pointe vers la vue déjà filtrée de l'application concernée.
export function attentionItems(o) {
  if (!o) return [];
  const items = [
    { key: 'ordersLate', count: n(o.orders?.late), to: '/admin/orders?late=1', tone: 'danger' },
    { key: 'ordersNoDriver', count: n(o.orders?.noDriver), to: '/admin/orders?noDriver=1', tone: 'danger' },
    { key: 'incidentsFailedPayments', count: n(o.incidents?.failedPaymentsToday), to: '/admin/payments', tone: 'danger' },
    { key: 'incidentsStaleOrders', count: n(o.incidents?.staleOrders), to: '/admin/orders?stale=1', tone: 'danger' },
    { key: 'ordersPending', count: n(o.orders?.pending), to: '/admin/orders?status=nouveau', tone: 'warn' },
    { key: 'supportSla', count: n(o.support?.slaBreached), to: '/admin/support?sla=1', tone: 'danger' },
    { key: 'tasksOverdue', count: n(o.tasks?.overdue), to: '/admin/tasks?due=overdue', tone: 'danger' },
    { key: 'restaurantsPending', count: n(o.restaurants?.pending), to: '/admin/restaurants?status=pending', tone: 'warn' },
    { key: 'driversPending', count: n(o.drivers?.pending), to: '/admin/drivers?status=pending', tone: 'warn' },
    { key: 'couriersPending', count: n(o.couriers?.pending), to: '/admin/couriers', tone: 'warn' },
    { key: 'documentsExpired', count: n(o.documents?.expired), to: '/admin/documents?expiry=expired', tone: 'danger' },
    { key: 'documentsExpiringSoon', count: n(o.documents?.expiringSoon), to: '/admin/documents?expiry=expiring_soon', tone: 'warn' },
    { key: 'documentsPending', count: n(o.documents?.pending), to: '/admin/documents?verification=en_attente', tone: 'warn' },
    { key: 'crmFollowUps', count: n(o.crm?.followUpsOverdue), to: '/admin/crm?overdue=1', tone: 'warn' },
    { key: 'salesOverdue', count: n(o.sales?.overdue), to: '/admin/sales?tab=prospects&overdue=1', tone: 'warn' },
    { key: 'invoicesOverdue', count: n(o.invoices?.overdue), to: '/admin/invoices', tone: 'danger' },
    { key: 'incidentsRefunds', count: n(o.incidents?.refundsToday), to: '/admin/orders?refunded=1', tone: 'info' },
    { key: 'reviewsLow', count: n(o.reviews?.low), to: '/admin/reviews?low=1', tone: 'warn' },
    { key: 'reservationsPending', count: n(o.reservations?.pending), to: '/admin/orders?type=dine_in&status=nouveau', tone: 'warn' },
    { key: 'deletionRequests', count: n(o.deletions?.pending), to: '/admin#suppressions', tone: 'warn' },
    { key: 'supportOpen', count: n(o.support?.open), to: '/admin/support', tone: 'info' },
    { key: 'tasksDueSoon', count: n(o.tasks?.dueSoon), to: '/admin/tasks?due=due_soon', tone: 'info' }
  ];
  return items.filter((i) => i.count > 0);
}
