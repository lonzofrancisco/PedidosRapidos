import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import StorefrontPage from './pages/storefront/StorefrontPage.jsx';
import CheckoutPage from './pages/storefront/CheckoutPage.jsx';
import OrderSuccessPage from './pages/storefront/OrderSuccessPage.jsx';
import LoginPage from './pages/admin/LoginPage.jsx';
import ForgotPasswordPage from './pages/admin/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/admin/ResetPasswordPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import ProductsPage from './pages/admin/ProductsPage.jsx';
import OrdersPage from './pages/admin/OrdersPage.jsx';
import OrderDetailPage from './pages/admin/OrderDetailPage.jsx';
import SettingsPage from './pages/admin/SettingsPage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';
import TermsPage from './pages/legal/TermsPage.jsx';
import PrivacyPage from './pages/legal/PrivacyPage.jsx';
import SuperAdminLoginPage from './pages/superadmin/SuperAdminLoginPage.jsx';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard.jsx';
import { RequireAuth } from './contexts/AuthContext.jsx';

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route path="/t/:slug" element={<StorefrontPage />} />
      <Route path="/t/:slug/checkout" element={<CheckoutPage />} />
      <Route path="/t/:slug/orders/:orderId" element={<OrderSuccessPage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin/reset-password/:token" element={<ResetPasswordPage />} />

      {/* Detalle de pedido compartido: lo abre la tienda (gestiona el estado)
          y tambien el comprador desde el link (solo lectura). Por eso vive
          fuera de RequireAuth; el control de acceso lo resuelve la propia pagina. */}
      <Route path="/admin/orders/:orderId" element={<OrderDetailPage />} />

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
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />

      <Route path="/superAdmin/login" element={<SuperAdminLoginPage />} />
      <Route path="/superAdmin" element={<SuperAdminDashboard />} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
