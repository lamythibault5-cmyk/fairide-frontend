// Préchargement des pages chargées à la demande (voir les lazy() d'App.jsx). Les chemins d'import sont
// les mêmes que dans App.jsx : Vite ne génère qu'un seul module par fichier, donc appeler l'un ou
// l'autre remplit le même cache — un module déjà préchargé ici s'affiche instantanément là-bas.
// Appelé par NavigationFeedback.jsx au survol / toucher / focus d'un lien interne.
const CHARGEURS = {
  '/recherche': () => import('./pages/client/SearchPage'),
  '/checkout': () => import('./pages/client/Checkout'),
  '/favorites': () => import('./pages/client/Favorites'),
  '/orders': () => import('./pages/client/Orders'),
  '/map': () => import('./pages/client/MapPage'),
  '/invoices': () => import('./pages/client/InvoicesPage'),
  '/account': () => import('./pages/Account'),
  '/dashboard': () => Promise.all([import('./pages/restaurant/DashboardLayout'), import('./pages/restaurant/EditPage')]),
  '/dashboard/menu': () => import('./pages/restaurant/MenuPage'),
  '/dashboard/orders': () => import('./pages/restaurant/OrdersPage'),
  '/dashboard/preview': () => import('./pages/restaurant/PreviewPage'),
  '/dashboard/promotions': () => import('./pages/restaurant/PromotionsPage'),
  '/dashboard/map': () => import('./pages/restaurant/MapPage'),
  '/dashboard/reviews': () => import('./pages/restaurant/ReviewsPage'),
  '/dashboard/invoices': () => import('./pages/restaurant/InvoicesPage'),
  '/dashboard/guide': () => import('./pages/restaurant/GuidePage'),
  '/dashboard/tables': () => import('./pages/restaurant/TablesPage'),
  '/dashboard/reservations': () => import('./pages/restaurant/ReservationsPage'),
  '/driver': () => import('./pages/driver/Dashboard'),
  '/driver/map': () => import('./pages/driver/MapPage'),
  '/driver/reviews': () => import('./pages/driver/ReviewsPage'),
  '/driver/tips': () => import('./pages/driver/TipsPage'),
  '/driver/invoices': () => import('./pages/driver/InvoicesPage'),
  '/driver/onboarding': () => import('./pages/driver/Onboarding'),
  '/admin': () => Promise.all([import('./pages/admin/AdminLayout'), import('./pages/admin/AdminHomePage')]),
  '/admin/dashboard': () => import('./pages/admin/AdminDashboardPage'),
  '/admin/promotions': () => import('./pages/admin/AdminPromotionsPage'),
  '/admin/reviews': () => import('./pages/admin/AdminReviewsPage'),
  '/admin/orders': () => import('./pages/admin/AdminOrdersPage'),
  '/admin/crm': () => import('./pages/admin/AdminCrmPage'),
  '/admin/restaurants': () => import('./pages/admin/AdminRestaurantsPage'),
  '/admin/drivers': () => import('./pages/admin/AdminDriversPage'),
  '/admin/couriers': () => import('./pages/admin/AdminCouriersPage'),
  '/admin/clients': () => import('./pages/admin/AdminClientsPage'),
  '/admin/finance': () => import('./pages/admin/AdminFinancePage'),
  '/admin/payments': () => import('./pages/admin/AdminPaymentsPage'),
  '/admin/support': () => import('./pages/admin/AdminSupportPage'),
  '/admin/documents': () => import('./pages/admin/AdminDocumentsPage'),
  '/admin/tasks': () => import('./pages/admin/AdminTasksPage'),
  '/admin/automations': () => import('./pages/admin/AdminAutomationsPage'),
  '/admin/accounting': () => import('./pages/admin/AdminAccountingPage'),
  '/admin/invoices': () => import('./pages/admin/AdminInvoicesPage'),
  '/admin/settings': () => import('./pages/admin/AdminSettingsPage'),
  '/mentions-legales': () => import('./pages/legal/LegalNotice'),
  '/cgv': () => import('./pages/legal/Terms'),
  '/confidentialite': () => import('./pages/legal/Privacy'),
  '/aide': () => import('./pages/HelpPage'),
  '/notre-histoire': () => import('./pages/OurStory'),
  '/jeux': () => import('./pages/GamesPage'),
  '/sales': () => import('./pages/client/SalesPage'),
  '/admin/sales': () => import('./pages/admin/AdminSalesPage'),
};

const enCours = new Map();

// Renvoie la promesse du chargement (partagée entre appels), ou null si la page est déjà dans le bundle
// principal. Un échec (hors-ligne, déploiement en cours) n'est pas une erreur ici : l'appel suivant réessaiera.
export function prechargerPage(pathname) {
  const chemin = String(pathname || '').replace(/\/$/, '') || '/';
  let cle = null;
  if (/^\/restaurants\/[^/]+\/reserver$/.test(chemin)) cle = 'reserver';
  else cle = Object.keys(CHARGEURS).filter((k) => chemin === k || chemin.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0];
  if (!cle) return null;
  if (enCours.has(cle)) return enCours.get(cle);
  const charge = cle === 'reserver' ? () => import('./pages/client/ReservationWizard') : CHARGEURS[cle];
  const promesse = Promise.resolve().then(charge).catch(() => { enCours.delete(cle); });
  enCours.set(cle, promesse);
  return promesse;
}

// Espace où arrive un compte juste après connexion (voir pages/Home.jsx) : clients sur la liste des commerces
// (déjà dans le bundle principal), commerces sur /dashboard, livreurs sur /driver, admin sur /admin.
export function espaceApresConnexion(user) {
  if (!user) return '/';
  if (user.isAdmin) return '/admin';
  if (user.role === 'restaurant') return '/dashboard';
  if (user.role === 'driver') return '/driver';
  return '/restaurants';
}

// Attend que le code de la page d'arrivée soit là, sans jamais bloquer plus de `maxMs` : le bouton reste en
// « Chargement… » jusqu'à ce que la page suivante puisse s'afficher d'un coup, au lieu de redevenir cliquable
// pendant qu'un écran blanc se prépare derrière — ce qui donnait l'impression que le toucher n'avait rien fait.
export function attendrePage(pathname, maxMs = 2500) {
  const p = prechargerPage(pathname);
  if (!p) return Promise.resolve();
  return Promise.race([p, new Promise((r) => setTimeout(r, maxMs))]);
}
