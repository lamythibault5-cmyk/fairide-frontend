import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollRestorer from './components/ScrollRestorer';
import ProtectedRoute from './components/ProtectedRoute';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Account from './pages/Account';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminRestaurantsPage from './pages/admin/AdminRestaurantsPage';
import AdminDriversPage from './pages/admin/AdminDriversPage';
import AdminClientsPage from './pages/admin/AdminClientsPage';
import AdminFinancePage from './pages/admin/AdminFinancePage';
import AdminAccountingPage from './pages/admin/AdminAccountingPage';
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import LegalNotice from './pages/legal/LegalNotice';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import ClientHome from './pages/client/Home';
import RestaurantList from './pages/client/RestaurantList';
import RestaurantMenu from './pages/client/RestaurantMenu';
import Checkout from './pages/client/Checkout';
import Favorites from './pages/client/Favorites';
import Orders from './pages/client/Orders';
import OrderResult from './pages/client/OrderResult';
import ClientMapPage from './pages/client/MapPage';
import ClientInvoicesPage from './pages/client/InvoicesPage';
import RestaurantDashboardLayout from './pages/restaurant/DashboardLayout';
import RestaurantMenuPage from './pages/restaurant/MenuPage';
import RestaurantOrdersPage from './pages/restaurant/OrdersPage';
import RestaurantPreviewPage from './pages/restaurant/PreviewPage';
import RestaurantEditPage from './pages/restaurant/EditPage';
import RestaurantPromotionsPage from './pages/restaurant/PromotionsPage';
import RestaurantMapPage from './pages/restaurant/MapPage';
import RestaurantReviewsPage from './pages/restaurant/ReviewsPage';
import RestaurantInvoicesPage from './pages/restaurant/InvoicesPage';
import DriverDashboard from './pages/driver/Dashboard';
import DriverMapPage from './pages/driver/MapPage';
import DriverReviewsPage from './pages/driver/ReviewsPage';
import DriverTipsPage from './pages/driver/TipsPage';
import DriverInvoicesPage from './pages/driver/InvoicesPage';

export default function App() {
  return (
    <>
      <ScrollRestorer />
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/home" element={<ProtectedRoute role="client"><ClientHome /></ProtectedRoute>} />
        {/* Volontairement publiques (pas de ProtectedRoute) : consultables sans compte pour être
            indexables par les moteurs de recherche et partageables par lien — seule une action
            (commander, réserver, mettre en favori) exige de se connecter, voir RestaurantList/RestaurantMenu. */}
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
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
          <Route path="drivers" element={<AdminDriversPage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="finance" element={<AdminFinancePage />} />
          <Route path="accounting" element={<AdminAccountingPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route path="/mentions-legales" element={<LegalNotice />} />
        <Route path="/cgv" element={<Terms />} />
        <Route path="/confidentialite" element={<Privacy />} />
      </Route>
      </Routes>
    </>
  );
}
