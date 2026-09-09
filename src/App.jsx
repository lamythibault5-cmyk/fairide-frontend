import { Suspense } from 'react';
import { lazyPage } from './lazyPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollRestorer from './components/ScrollRestorer';
import NavigationFeedback from './components/NavigationFeedback';
import ProtectedRoute from './components/ProtectedRoute';
import { SkeletonCards } from './components/Skeleton';

// Découpage du bundle par rôle.
//
// Tout était jusqu'ici livré dans un seul fichier de 1,2 Mo : un client affamé sur la 4G téléchargeait
// les quinze pages d'administration, Leaflet, dnd-kit et les mini-jeux avant de voir le moindre
// restaurant. Ce sont pourtant des univers disjoints — un client n'ouvrira jamais /admin, un
// restaurateur jamais /driver.
//
// Ce qui reste chargé d'emblée (imports statiques ci-dessous) : uniquement le parcours d'arrivée —
// accueil, connexion, liste et fiche des commerces. Ce sont les seules pages publiques, donc celles
// qui décident du temps de premier affichage et du référencement. Tout le reste part en chargement
// différé.
import Home from './pages/Home';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import RestaurantList from './pages/client/RestaurantList';
import RestaurantMenu from './pages/client/RestaurantMenu';
import NotFound from './pages/NotFound';

// --- Espace client (au-delà des pages publiques) ---
const SearchPage = lazyPage(() => import('./pages/client/SearchPage'));
const Checkout = lazyPage(() => import('./pages/client/Checkout'));
const ReservationWizard = lazyPage(() => import('./pages/client/ReservationWizard'));
const Favorites = lazyPage(() => import('./pages/client/Favorites'));
const Orders = lazyPage(() => import('./pages/client/Orders'));
const OrderResult = lazyPage(() => import('./pages/client/OrderResult'));
const ClientMapPage = lazyPage(() => import('./pages/client/MapPage'));
const ClientInvoicesPage = lazyPage(() => import('./pages/client/InvoicesPage'));
const Account = lazyPage(() => import('./pages/Account'));

// --- Espace restaurateur ---
const RestaurantDashboardLayout = lazyPage(() => import('./pages/restaurant/DashboardLayout'));
const RestaurantMenuPage = lazyPage(() => import('./pages/restaurant/MenuPage'));
const RestaurantOrdersPage = lazyPage(() => import('./pages/restaurant/OrdersPage'));
const RestaurantPreviewPage = lazyPage(() => import('./pages/restaurant/PreviewPage'));
const RestaurantEditPage = lazyPage(() => import('./pages/restaurant/EditPage'));
const RestaurantPromotionsPage = lazyPage(() => import('./pages/restaurant/PromotionsPage'));
const RestaurantMapPage = lazyPage(() => import('./pages/restaurant/MapPage'));
const RestaurantReviewsPage = lazyPage(() => import('./pages/restaurant/ReviewsPage'));
const RestaurantInvoicesPage = lazyPage(() => import('./pages/restaurant/InvoicesPage'));
const RestaurantGuidePage = lazyPage(() => import('./pages/restaurant/GuidePage'));
const RestaurantTablesPage = lazyPage(() => import('./pages/restaurant/TablesPage'));
const RestaurantReservationsPage = lazyPage(() => import('./pages/restaurant/ReservationsPage'));

// --- Espace livreur ---
const DriverDashboard = lazyPage(() => import('./pages/driver/Dashboard'));
const DriverMapPage = lazyPage(() => import('./pages/driver/MapPage'));
const DriverReviewsPage = lazyPage(() => import('./pages/driver/ReviewsPage'));
const DriverTipsPage = lazyPage(() => import('./pages/driver/TipsPage'));
const DriverInvoicesPage = lazyPage(() => import('./pages/driver/InvoicesPage'));
const DriverOnboarding = lazyPage(() => import('./pages/driver/Onboarding'));

// --- Console d'administration ---
const AdminLayout = lazyPage(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage = lazyPage(() => import('./pages/admin/AdminDashboardPage'));
const AdminHomePage = lazyPage(() => import('./pages/admin/AdminHomePage'));
const AdminPromotionsPage = lazyPage(() => import('./pages/admin/AdminPromotionsPage'));
const AdminReviewsPage = lazyPage(() => import('./pages/admin/AdminReviewsPage'));
const AdminOrdersPage = lazyPage(() => import('./pages/admin/AdminOrdersPage'));
const AdminCrmPage = lazyPage(() => import('./pages/admin/AdminCrmPage'));
const AdminRestaurantsPage = lazyPage(() => import('./pages/admin/AdminRestaurantsPage'));
const AdminMenuPage = lazyPage(() => import('./pages/admin/AdminMenuPage'));
const AdminDriversPage = lazyPage(() => import('./pages/admin/AdminDriversPage'));
const AdminCouriersPage = lazyPage(() => import('./pages/admin/AdminCouriersPage'));
const AdminClientsPage = lazyPage(() => import('./pages/admin/AdminClientsPage'));
const AdminFinancePage = lazyPage(() => import('./pages/admin/AdminFinancePage'));
const AdminPaymentsPage = lazyPage(() => import('./pages/admin/AdminPaymentsPage'));
const AdminSupportPage = lazyPage(() => import('./pages/admin/AdminSupportPage'));
const AdminDocumentsPage = lazyPage(() => import('./pages/admin/AdminDocumentsPage'));
const AdminTasksPage = lazyPage(() => import('./pages/admin/AdminTasksPage'));
const AdminAutomationsPage = lazyPage(() => import('./pages/admin/AdminAutomationsPage'));
const AdminAccountingPage = lazyPage(() => import('./pages/admin/AdminAccountingPage'));
const AdminInvoicesPage = lazyPage(() => import('./pages/admin/AdminInvoicesPage'));
const AdminSettingsPage = lazyPage(() => import('./pages/admin/AdminSettingsPage'));
const AdminMarketingPage = lazyPage(() => import('./pages/admin/AdminMarketingPage'));
const AdminLogisticsPage = lazyPage(() => import('./pages/admin/AdminLogisticsPage'));
const AdminIncidentsPage = lazyPage(() => import('./pages/admin/AdminIncidentsPage'));
const AdminReportsPage = lazyPage(() => import('./pages/admin/AdminReportsPage'));
const AdminTeamPage = lazyPage(() => import('./pages/admin/AdminTeamPage'));
const AdminCompliancePage = lazyPage(() => import('./pages/admin/AdminCompliancePage'));

// --- Pages légales ---
const LegalNotice = lazyPage(() => import('./pages/legal/LegalNotice'));
const Terms = lazyPage(() => import('./pages/legal/Terms'));
const Privacy = lazyPage(() => import('./pages/legal/Privacy'));
const HelpPage = lazyPage(() => import('./pages/HelpPage'));
const OurStory = lazyPage(() => import('./pages/OurStory'));

export default function App() {
  return (
    <>
      <ScrollRestorer />
      <NavigationFeedback />
      {/* Un seul Suspense autour de toutes les routes : le repli réutilise les squelettes déjà employés
          au chargement des données, donc l'attente d'un module a la même apparence que l'attente d'une
          requête — pas un deuxième vocabulaire visuel à apprendre pour l'utilisateur. */}
      <Suspense fallback={<div className="wrap" style={{ paddingTop: 24 }}><SkeletonCards count={3} /></div>}>
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Volontairement publiques (pas de ProtectedRoute) : consultables sans compte pour être
            indexables par les moteurs de recherche et partageables par lien — seule une action
            (commander, réserver, mettre en favori) exige de se connecter, voir RestaurantList/RestaurantMenu.
            Ce sont aussi, pour cette raison, les deux seules pages hors accueil gardées en import
            statique : une page indexable ne doit pas attendre un second téléchargement pour s'afficher. */}
        <Route path="/restaurants" element={<RestaurantList />} />
        <Route path="/restaurants/:id" element={<RestaurantMenu />} />
        <Route path="/restaurants/:id/reserver" element={<ReservationWizard />} />
        {/* Publique comme la liste : chercher un commerce ou un plat ne demande pas de compte. Les
            résultats personnels (commandes) n'apparaissent que connecté. */}
        <Route path="/recherche" element={<SearchPage />} />
        <Route path="/checkout" element={<ProtectedRoute role="client"><Checkout /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute role="client"><Favorites /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute role="client"><Orders /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute role="client"><ClientMapPage /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute role="client"><ClientInvoicesPage /></ProtectedRoute>} />
        <Route path="/order-success" element={<ProtectedRoute role="client"><OrderResult success /></ProtectedRoute>} />
        <Route path="/order-cancelled" element={<ProtectedRoute role="client"><OrderResult success={false} /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute role="restaurant"><RestaurantDashboardLayout /></ProtectedRoute>}>
          {/* « Mon commerce » : les infos du restaurant (création puis modification). « Ma carte » : les produits,
              en attente tant que le restaurant n'est pas créé (voir DashboardLayout). L'ancienne adresse /edit
              redirige : elle portait les infos, qui vivent maintenant à la racine. */}
          <Route index element={<RestaurantEditPage />} />
          <Route path="menu" element={<RestaurantMenuPage />} />
          <Route path="orders" element={<RestaurantOrdersPage />} />
          <Route path="preview" element={<RestaurantPreviewPage />} />
          <Route path="edit" element={<Navigate to="/dashboard" replace />} />
          <Route path="promotions" element={<RestaurantPromotionsPage />} />
          <Route path="map" element={<RestaurantMapPage />} />
          <Route path="reviews" element={<RestaurantReviewsPage />} />
          <Route path="invoices" element={<RestaurantInvoicesPage />} />
          <Route path="guide" element={<RestaurantGuidePage />} />
          <Route path="tables" element={<RestaurantTablesPage />} />
          <Route path="reservations" element={<RestaurantReservationsPage />} />
        </Route>
        <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/map" element={<ProtectedRoute role="driver"><DriverMapPage /></ProtectedRoute>} />
        <Route path="/driver/reviews" element={<ProtectedRoute role="driver"><DriverReviewsPage /></ProtectedRoute>} />
        <Route path="/driver/tips" element={<ProtectedRoute role="driver"><DriverTipsPage /></ProtectedRoute>} />
        <Route path="/driver/invoices" element={<ProtectedRoute role="driver"><DriverInvoicesPage /></ProtectedRoute>} />
        <Route path="/driver/onboarding" element={<ProtectedRoute role="driver"><DriverOnboarding /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminHomePage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="crm" element={<AdminCrmPage />} />
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
          <Route path="restaurants/:id/menu" element={<AdminMenuPage />} />
          <Route path="drivers" element={<AdminDriversPage />} />
          <Route path="couriers" element={<AdminCouriersPage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="finance" element={<AdminFinancePage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="documents" element={<AdminDocumentsPage />} />
          <Route path="tasks" element={<AdminTasksPage />} />
          <Route path="automations" element={<AdminAutomationsPage />} />
          <Route path="accounting" element={<AdminAccountingPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="marketing" element={<AdminMarketingPage />} />
          <Route path="logistics" element={<AdminLogisticsPage />} />
          <Route path="incidents" element={<AdminIncidentsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="team" element={<AdminTeamPage />} />
          <Route path="compliance" element={<AdminCompliancePage />} />
        </Route>

        <Route path="/mentions-legales" element={<LegalNotice />} />
        <Route path="/cgv" element={<Terms />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/aide" element={<HelpPage />} />
        <Route path="/notre-histoire" element={<OurStory />} />

        {/* Attrape-tout, obligatoirement en dernier : sans lui, une URL inconnue affichait la mise en
            page avec un contenu vide, sans message ni lien de sortie. */}
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
      </Suspense>
    </>
  );
}
