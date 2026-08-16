import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Account from './pages/Account';
import Admin from './pages/Admin';
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
import RestaurantDashboardLayout from './pages/restaurant/DashboardLayout';
import RestaurantMenuPage from './pages/restaurant/MenuPage';
import RestaurantOrdersPage from './pages/restaurant/OrdersPage';
import RestaurantPreviewPage from './pages/restaurant/PreviewPage';
import RestaurantEditPage from './pages/restaurant/EditPage';
import RestaurantPromotionsPage from './pages/restaurant/PromotionsPage';
import RestaurantMapPage from './pages/restaurant/MapPage';
import DriverDashboard from './pages/driver/Dashboard';
import DriverMapPage from './pages/driver/MapPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/home" element={<ProtectedRoute role="client"><ClientHome /></ProtectedRoute>} />
        <Route path="/restaurants" element={<ProtectedRoute role="client"><RestaurantList /></ProtectedRoute>} />
        <Route path="/restaurants/:id" element={<ProtectedRoute role="client"><RestaurantMenu /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute role="client"><Checkout /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute role="client"><Favorites /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute role="client"><Orders /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute role="client"><ClientMapPage /></ProtectedRoute>} />
        <Route path="/order-success" element={<ProtectedRoute role="client"><OrderResult success /></ProtectedRoute>} />
        <Route path="/order-cancelled" element={<ProtectedRoute role="client"><OrderResult success={false} /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute role="restaurant"><RestaurantDashboardLayout /></ProtectedRoute>}>
          <Route index element={<RestaurantMenuPage />} />
          <Route path="orders" element={<RestaurantOrdersPage />} />
          <Route path="preview" element={<RestaurantPreviewPage />} />
          <Route path="edit" element={<RestaurantEditPage />} />
          <Route path="promotions" element={<RestaurantPromotionsPage />} />
          <Route path="map" element={<RestaurantMapPage />} />
        </Route>
        <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/map" element={<ProtectedRoute role="driver"><DriverMapPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />

        <Route path="/mentions-legales" element={<LegalNotice />} />
        <Route path="/cgv" element={<Terms />} />
        <Route path="/confidentialite" element={<Privacy />} />
      </Route>
    </Routes>
  );
}
