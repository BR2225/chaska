import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminLayout from "@/components/AdminLayout";
import CustomerRoute from "@/components/CustomerRoute";

const Home = lazy(() => import("@/pages/Home"));
const Menu = lazy(() => import("@/pages/Menu"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Contact = lazy(() => import("@/pages/Contact"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminProducts = lazy(() => import("@/pages/AdminProducts"));
const AdminOrders = lazy(() => import("@/pages/AdminOrders"));
const AdminContacts = lazy(() => import("@/pages/AdminContacts"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const CustomerAuth = lazy(() => import("@/pages/CustomerAuth"));
const MyOrders = lazy(() => import("@/pages/MyOrders"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-[#5C5042]" role="status">
      Loading Chaska…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster position="top-right" richColors />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<><Header /><Home /><Footer /></>} />
              <Route path="/menu" element={<><Header /><Menu /><Footer /></>} />
              <Route path="/menu/:id" element={<><Header /><ProductDetail /><Footer /></>} />
              <Route path="/checkout" element={<CustomerRoute><Header /><Checkout /><Footer /></CustomerRoute>} />
              <Route path="/track-order" element={<><Header /><TrackOrder /><Footer /></>} />
              <Route path="/login" element={<><Header /><CustomerAuth /><Footer /></>} />
              <Route path="/forgot-password" element={<><Header /><ForgotPassword /><Footer /></>} />
              <Route path="/reset-password" element={<><Header /><ResetPassword /><Footer /></>} />
              <Route path="/my-orders" element={<CustomerRoute><Header /><MyOrders /><Footer /></CustomerRoute>} />
              <Route path="/contact" element={<CustomerRoute><Header /><Contact /><Footer /></CustomerRoute>} />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
              <Route path="/admin/products" element={<AdminLayout><AdminProducts /></AdminLayout>} />
              <Route path="/admin/orders" element={<AdminLayout><AdminOrders /></AdminLayout>} />
              <Route path="/admin/contacts" element={<AdminLayout><AdminContacts /></AdminLayout>} />
            </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
