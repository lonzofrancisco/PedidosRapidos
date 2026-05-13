import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import StorefrontPage from './pages/storefront/StorefrontPage.jsx';
import CheckoutPage from './pages/storefront/CheckoutPage.jsx';
import OrderSuccessPage from './pages/storefront/OrderSuccessPage.jsx';
import LoginPage from './pages/admin/LoginPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import ProductsPage from './pages/admin/ProductsPage.jsx';
import OrdersPage from './pages/admin/OrdersPage.jsx';
import OrderDetailPage from './pages/admin/OrderDetailPage.jsx';
import SettingsPage from './pages/admin/SettingsPage.jsx';
import { RequireAuth } from './contexts/AuthContext.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route path="/t/:slug" element={<StorefrontPage />} />
      <Route path="/t/:slug/checkout" element={<CheckoutPage />} />
      <Route path="/t/:slug/orders/:orderId" element={<OrderSuccessPage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
