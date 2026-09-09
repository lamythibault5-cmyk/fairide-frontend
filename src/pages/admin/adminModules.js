// Registre des applications de l'ERP admin — une seule source pour l'écran d'accueil (tuiles), la
// barre latérale (sections + pastilles) et l'en-tête de chaque page (fil d'Ariane, description).
// Sur le modèle d'Odoo : chaque application a un nom, une icône, une phrase qui dit à quoi elle sert,
// et un compteur « à traiter » calculé depuis GET /admin/overview.
//
// `badge(overview)` renvoie { count, tone } : tone 'danger' = quelque chose bloque ou est en retard,
// 'warn' = à faire bientôt, 'info' = simple volume. Tous les accès à l'overview sont tolérants
// (`?.`, `|| 0`) : un champ que le serveur n'envoie pas encore ne doit jamais faire planter l'accueil.

export const ADMIN_GROUPS = ['pilotage', 'operations', 'croissance', 'finance', 'services', 'configuration'];

const aucun = () => null;
function pastille(count, tone = 'warn') { return count > 0 ? { count, tone } : null; }
const n = (v) => Number(v) || 0;

export const ADMIN_MODULES = [
  { key: 'dashboard', path: '/admin/dashboard', icon: '📊', group: 'pilotage', badge: aucun },
  { key: 'orders', path: '/admin/orders', icon: '📦', group: 'operations',
    badge: (o) => pastille(n(o.orders?.pending) + n(o.orders?.noDriver) + n(o.orders?.late), n(o.orders?.late) + n(o.orders?.noDriver) > 0 ? 'danger' : 'warn') },
  { key: 'restaurants', path: '/admin/restaurants', icon: '🏪', group: 'operations', badge: (o) => pastille(n(o.restaurants?.pending)) },
  { key: 'drivers', path: '/admin/drivers', icon: '🛵', group: 'operations', badge: (o) => pastille(n(o.drivers?.pending)) },
  { key: 'couriers', path: '/admin/couriers', icon: '🪪', group: 'operations', badge: (o) => pastille(n(o.couriers?.pending)) },
  { key: 'clients', path: '/admin/clients', icon: '👥', group: 'operations', badge: (o) => pastille(n(o.clients?.newWeek), 'info') },
  { key: 'reviews', path: '/admin/reviews', icon: '⭐', group: 'operations', badge: (o) => pastille(n(o.reviews?.low), 'danger') },
  { key: 'crm', path: '/admin/crm', icon: '🤝', group: 'croissance', badge: (o) => pastille(n(o.crm?.followUpsOverdue), 'danger') },
  // Un code actif n'est pas « à traiter » : seule une donnée d'action réelle (codes qui expirent sous
  // peu, si le serveur la fournit) mérite une pastille.
  { key: 'promotions', path: '/admin/promotions', icon: '🏷️', group: 'croissance', badge: (o) => pastille(n(o.promotions?.expiringSoon)) },
  { key: 'finance', path: '/admin/finance', icon: '💶', group: 'finance', badge: aucun },
  { key: 'payments', path: '/admin/payments', icon: '💳', group: 'finance', badge: (o) => (o.payments?.failedToday !== undefined ? pastille(n(o.payments?.failedToday), 'danger') : null) },
  { key: 'invoices', path: '/admin/invoices', icon: '🧾', group: 'finance', badge: (o) => pastille(n(o.invoices?.unpaid), n(o.invoices?.overdue) > 0 ? 'danger' : 'warn') },
  { key: 'accounting', path: '/admin/accounting', icon: '📚', group: 'finance', badge: (o) => pastille(n(o.accounting?.unbalancedGroups) + n(o.accounting?.flaggedEntries) + n(o.accounting?.openPeriodsBehind), 'warn') },
  { key: 'support', path: '/admin/support', icon: '🎫', group: 'services', badge: (o) => pastille(n(o.support?.open), n(o.support?.slaBreached) > 0 ? 'danger' : 'warn') },
  { key: 'documents', path: '/admin/documents', icon: '📁', group: 'services', badge: (o) => pastille(n(o.documents?.pending) + n(o.documents?.expired) + n(o.documents?.expiringSoon), n(o.documents?.expired) > 0 ? 'danger' : 'warn') },
  { key: 'tasks', path: '/admin/tasks', icon: '✅', group: 'services', badge: (o) => pastille(n(o.tasks?.overdue) + n(o.tasks?.dueSoon), n(o.tasks?.overdue) > 0 ? 'danger' : 'warn') },
  { key: 'automations', path: '/admin/automations', icon: '⚡', group: 'services', badge: aucun },
  { key: 'settings', path: '/admin/settings', icon: '⚙️', group: 'configuration', badge: aucun }
];

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
    { key: 'invoicesOverdue', count: n(o.invoices?.overdue), to: '/admin/invoices', tone: 'danger' },
    { key: 'incidentsRefunds', count: n(o.incidents?.refundsToday), to: '/admin/orders?refunded=1', tone: 'info' },
    { key: 'reviewsLow', count: n(o.reviews?.low), to: '/admin/reviews?low=1', tone: 'warn' },
    { key: 'reservationsPending', count: n(o.reservations?.pending), to: '/admin/orders?type=dine_in&status=nouveau', tone: 'warn' },
    { key: 'supportOpen', count: n(o.support?.open), to: '/admin/support', tone: 'info' },
    { key: 'tasksDueSoon', count: n(o.tasks?.dueSoon), to: '/admin/tasks?due=due_soon', tone: 'info' }
  ];
  return items.filter((i) => i.count > 0);
}
