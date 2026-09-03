import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollRestorer from './components/ScrollRestorer';
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
const ClientHome = lazy(() => import('./pages/client/Home'));
const Checkout = lazy(() => import('./pages/client/Checkout'));
const Favorites = lazy(() => import('./pages/client/Favorites'));
const Orders = lazy(() => import('./pages/client/Orders'));
const OrderResult = lazy(() => import('./pages/client/OrderResult'));
const ClientMapPage = lazy(() => import('./pages/client/MapPage'));
const ClientInvoicesPage = lazy(() => import('./pages/client/InvoicesPage'));
const Account = lazy(() => import('./pages/Account'));

// --- Espace restaurateur ---
const RestaurantDashboardLayout = lazy(() => import('./pages/restaurant/DashboardLayout'));
const RestaurantMenuPage = lazy(() => import('./pages/restaurant/MenuPage'));
const RestaurantOrdersPage = lazy(() => import('./pages/restaurant/OrdersPage'));
const RestaurantPreviewPage = lazy(() => import('./pages/restaurant/PreviewPage'));
const RestaurantEditPage = lazy(() => import('./pages/restaurant/EditPage'));
const RestaurantPromotionsPage = lazy(() => import('./pages/restaurant/PromotionsPage'));
const RestaurantMapPage = lazy(() => import('./pages/restaurant/MapPage'));
const RestaurantReviewsPage = lazy(() => import('./pages/restaurant/ReviewsPage'));
const RestaurantInvoicesPage = lazy(() => import('./pages/restaurant/InvoicesPage'));
const RestaurantGuidePage = lazy(() => import('./pages/restaurant/GuidePage'));
const RestaurantTablesPage = lazy(() => import('./pages/restaurant/TablesPage'));

// --- Espace livreur ---
const DriverDashboard = lazy(() => import('./pages/driver/Dashboard'));
const DriverMapPage = lazy(() => import('./pages/driver/MapPage'));
const DriverReviewsPage = lazy(() => import('./pages/driver/ReviewsPage'));
const DriverTipsPage = lazy(() => import('./pages/driver/TipsPage'));
const DriverInvoicesPage = lazy(() => import('./pages/driver/InvoicesPage'));

// --- Console d'administration ---
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminCrmPage = lazy(() => import('./pages/admin/AdminCrmPage'));
const AdminRestaurantsPage = lazy(() => import('./pages/admin/AdminRestaurantsPage'));
const AdminDriversPage = lazy(() => import('./pages/admin/AdminDriversPage'));
const AdminClientsPage = lazy(() => import('./pages/admin/AdminClientsPage'));
const AdminFinancePage = lazy(() => import('./pages/admin/AdminFinancePage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));
const AdminDocumentsPage = lazy(() => import('./pages/admin/AdminDocumentsPage'));
const AdminTasksPage = lazy(() => import('./pages/admin/AdminTasksPage'));
const AdminAutomationsPage = lazy(() => import('./pages/admin/AdminAutomationsPage'));
const AdminAccountingPage = lazy(() => import('./pages/admin/AdminAccountingPage'));
const AdminInvoicesPage = lazy(() => import('./pages/admin/AdminInvoicesPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

// --- Pages légales ---
const LegalNotice = lazy(() => import('./pages/legal/LegalNotice'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));

export default function App() {
  return (
    <>
      <ScrollRestorer />
      {/* Un seul Suspense autour de toutes les routes : le repli réutilise les squelettes déjà employés
          au chargement des données, donc l'attente d'un module a la même apparence que l'attente d'une
          requête — pas un deuxième vocabulaire visuel à apprendre pour l'utilisateur. */}
      <Suspense fallback={<div className="wrap" style={{ paddingTop: 24 }}><SkeletonCards count={3} /></div>}>
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/home" element={<ProtectedRoute role="client"><ClientHome /></ProtectedRoute>} />
        {/* Volontairement publiques (pas de ProtectedRoute) : consultables sans compte pour être
            indexables par les moteurs de recherche et partageables par lien — seule une action
            (commander, réserver, mettre en favori) exige de se connecter, voir RestaurantList/RestaurantMenu.
            Ce sont aussi, pour cette raison, les deux seules pages hors accueil gardées en import
            statique : une page indexable ne doit pas attendre un second téléchargement pour s'afficher. */}
        <Route path="/restaurants" element={<RestaurantList />} />
        <Route path="/restaurants/:id" element={<RestaurantMenu />} />
        <Route path="/checkout" element={<ProtectedRoute role="client"><Checkout /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute role="client"><Favorites /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute role="client"><Orders /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute role="client"><ClientMapPage /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute role="client"><ClientInvoicesPage /></ProtectedRoute>} />
        <Route path="/order-success" element={<ProtectedRoute role="client"><OrderResult success /></ProtectedRoute>} />
        <Route path="/order-cancelled" element={<ProtectedRoute role="client"><OrderResult success={false} /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute role="restaurant"><RestaurantDashboardLayout /></ProtectedRoute>}>
          <Route index element={<RestaurantMenuPage />} />
          <Route path="orders" element={<RestaurantOrdersPage />} />
          <Route path="preview" element={<RestaurantPreviewPage />} />
          <Route path="edit" element={<RestaurantEditPage />} />
          <Route path="promotions" element={<RestaurantPromotionsPage />} />
          <Route path="map" element={<RestaurantMapPage />} />
          <Route path="reviews" element={<RestaurantReviewsPage />} />
          <Route path="invoices" element={<RestaurantInvoicesPage />} />
          <Route path="guide" element={<RestaurantGuidePage />} />
          <Route path="tables" element={<RestaurantTablesPage />} />
        </Route>
        <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/map" element={<ProtectedRoute role="driver"><DriverMapPage /></ProtectedRoute>} />
        <Route path="/driver/reviews" element={<ProtectedRoute role="driver"><DriverReviewsPage /></ProtectedRoute>} />
        <Route path="/driver/tips" element={<ProtectedRoute role="driver"><DriverTipsPage /></ProtectedRoute>} />
        <Route path="/driver/invoices" element={<ProtectedRoute role="driver"><DriverInvoicesPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="crm" element={<AdminCrmPage />} />
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
          <Route path="drivers" element={<AdminDriversPage />} />
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
        </Route>

        <Route path="/mentions-legales" element={<LegalNotice />} />
        <Route path="/cgv" element={<Terms />} />
        <Route path="/confidentialite" element={<Privacy />} />

        {/* Attrape-tout, obligatoirement en dernier : sans lui, une URL inconnue affichait la mise en
            page avec un contenu vide, sans message ni lien de sortie. */}
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
      </Suspense>
    </>
  );
}
