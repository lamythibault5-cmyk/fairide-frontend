// Registre des applications de l'ERP admin — une seule source pour l'écran d'accueil (tuiles), la
// barre latérale (sections + pastilles) et l'en-tête de chaque page (fil d'Ariane, description).
// Sur le modèle d'Odoo : chaque application a un nom, une icône, une phrase qui dit à quoi elle sert,
// et un compteur « à traiter » calculé depuis GET /admin/overview.
//
// `badge(overview)` renvoie { count, tone } : tone 'danger' = quelque chose bloque ou est en retard,
// 'warn' = à faire bientôt, 'info' = simple volume.

export const ADMIN_GROUPS = ['pilotage', 'operations', 'croissance', 'finance', 'services', 'configuration'];

const aucun = () => null;
function pastille(count, tone = 'warn') { return count > 0 ? { count, tone } : null; }

export const ADMIN_MODULES = [
  { key: 'dashboard', path: '/admin/dashboard', icon: '📊', group: 'pilotage', badge: aucun },
  { key: 'orders', path: '/admin/orders', icon: '📦', group: 'operations',
    badge: (o) => pastille(o.orders.pending + o.orders.noDriver + o.orders.late, o.orders.late + o.orders.noDriver > 0 ? 'danger' : 'warn') },
  { key: 'restaurants', path: '/admin/restaurants', icon: '🏪', group: 'operations', badge: (o) => pastille(o.restaurants.pending) },
  { key: 'drivers', path: '/admin/drivers', icon: '🛵', group: 'operations', badge: (o) => pastille(o.drivers.pending) },
  { key: 'clients', path: '/admin/clients', icon: '👥', group: 'operations', badge: (o) => pastille(o.clients.newWeek, 'info') },
  { key: 'reviews', path: '/admin/reviews', icon: '⭐', group: 'operations', badge: (o) => pastille(o.reviews.low, 'danger') },
  { key: 'crm', path: '/admin/crm', icon: '🤝', group: 'croissance', badge: (o) => pastille(o.crm.followUpsOverdue, 'danger') },
  { key: 'promotions', path: '/admin/promotions', icon: '🏷️', group: 'croissance', badge: (o) => pastille(o.promotions.active, 'info') },
  { key: 'finance', path: '/admin/finance', icon: '💶', group: 'finance', badge: aucun },
  { key: 'payments', path: '/admin/payments', icon: '💳', group: 'finance', badge: aucun },
  { key: 'invoices', path: '/admin/invoices', icon: '🧾', group: 'finance', badge: (o) => pastille(o.invoices.unpaid, o.invoices.overdue > 0 ? 'danger' : 'warn') },
  { key: 'accounting', path: '/admin/accounting', icon: '📚', group: 'finance', badge: aucun },
  { key: 'support', path: '/admin/support', icon: '🎫', group: 'services', badge: (o) => pastille(o.support.open, o.support.slaBreached > 0 ? 'danger' : 'warn') },
  { key: 'documents', path: '/admin/documents', icon: '📁', group: 'services', badge: (o) => pastille(o.documents.pending + o.documents.expired, o.documents.expired > 0 ? 'danger' : 'warn') },
  { key: 'tasks', path: '/admin/tasks', icon: '✅', group: 'services', badge: (o) => pastille(o.tasks.overdue + o.tasks.dueSoon, o.tasks.overdue > 0 ? 'danger' : 'warn') },
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
    { key: 'ordersLate', count: o.orders.late, to: '/admin/orders?late=1', tone: 'danger' },
    { key: 'ordersNoDriver', count: o.orders.noDriver, to: '/admin/orders?noDriver=1', tone: 'danger' },
    { key: 'ordersPending', count: o.orders.pending, to: '/admin/orders?status=nouveau', tone: 'warn' },
    { key: 'supportSla', count: o.support.slaBreached, to: '/admin/support', tone: 'danger' },
    { key: 'tasksOverdue', count: o.tasks.overdue, to: '/admin/tasks', tone: 'danger' },
    { key: 'restaurantsPending', count: o.restaurants.pending, to: '/admin/restaurants', tone: 'warn' },
    { key: 'driversPending', count: o.drivers.pending, to: '/admin/drivers', tone: 'warn' },
    { key: 'documentsExpired', count: o.documents.expired, to: '/admin/documents', tone: 'danger' },
    { key: 'documentsPending', count: o.documents.pending, to: '/admin/documents', tone: 'warn' },
    { key: 'crmFollowUps', count: o.crm.followUpsOverdue, to: '/admin/crm', tone: 'warn' },
    { key: 'invoicesOverdue', count: o.invoices.overdue, to: '/admin/invoices', tone: 'danger' },
    { key: 'reviewsLow', count: o.reviews.low, to: '/admin/reviews?low=1', tone: 'warn' },
    { key: 'reservationsPending', count: o.reservations.pending, to: '/admin/orders?status=nouveau', tone: 'warn' },
    { key: 'supportOpen', count: o.support.open, to: '/admin/support', tone: 'info' },
    { key: 'tasksDueSoon', count: o.tasks.dueSoon, to: '/admin/tasks', tone: 'info' }
  ];
  return items.filter((i) => i.count > 0);
}
