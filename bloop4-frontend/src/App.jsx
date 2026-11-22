import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Catalog from './components/Catalog';
import BecomeSellerPage from './pages/BecomeSellerPage';
import VerifyBanner from './components/VerifyBanner';
import RequireRole from './auth/RequireRole';
import LoginPage from './pages/LoginPage';
import ProductDetail from './pages/ProductDetail';
import RegisterPage from './pages/RegisterPage';
import CartPage from './pages/CartPage';
import SellerHome from './pages/SellerHome';
import SellerProductForm from './pages/SellerProductForm';
import VerifyEmailPage from './pages/VerifyEmailPage';
import BookingPage from './pages/BookingPage';
import BookingsPage from './pages/BookingsPage';
import RiderServicePage from './pages/RiderServicePage';
// Sprint 2: cada història importa les seves pàgines dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-08 ──
import MockPaymentPage from './pages/MockPaymentPage';
// ── US-14 ──
// ── US-15 ──
import MyServicesPage from './pages/MyServicesPage';
// ── US-11 ──
import ProofPage from './pages/ProofPage';
import SellerServicesPage from './pages/SellerServicesPage';
// ── fi de les zones ──

function NotFoundPage() {
  return (
    <div className="empty-state" role="status">
      <h1 className="empty-state__title">Página no encontrada</h1>
      <Link className="btn-primary" to="/">Ir al catálogo</Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <VerifyBanner />
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route
            path="/hazte-vendedor"
            element={
              <RequireRole roles={['customer']}>
                <BecomeSellerPage />
              </RequireRole>
            }
          />
          <Route path="/productos/:id" element={<ProductDetail />} />
          <Route path="/iniciar-sesion" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/verificar" element={<VerifyEmailPage />} />
          <Route
            path="/reserva"
            element={
              <RequireRole roles={['customer']}>
                <CartPage />
              </RequireRole>
            }
          />
          <Route
            path="/vendedor"
            element={
              <RequireRole roles={['seller']}>
                <SellerHome />
              </RequireRole>
            }
          />
          <Route
            path="/vendedor/productos/nuevo"
            element={
              <RequireRole roles={['seller']}>
                <SellerProductForm />
              </RequireRole>
            }
          />
          <Route
            path="/vendedor/productos/:id"
            element={
              <RequireRole roles={['seller']}>
                <SellerProductForm />
              </RequireRole>
            }
          />
          {/* Sprint 2 · fonaments: les reserves del client i el detall d'un servei del rider. */}
          <Route
            path="/reservas"
            element={
              <RequireRole roles={['customer']}>
                <BookingsPage />
              </RequireRole>
            }
          />
          <Route
            path="/reservas/:id"
            element={
              <RequireRole roles={['customer']}>
                <BookingPage />
              </RequireRole>
            }
          />
          <Route
            path="/repartidor/servicios/:id"
            element={
              <RequireRole roles={['rider']}>
                <RiderServicePage />
              </RequireRole>
            }
          />
          {/* Sprint 2 · zones de les històries: cada història afegeix les seves rutes dins de la seva. */}
          {/* ── US-08 ── */}
          <Route
            path="/pago-simulado"
            element={
              <RequireRole roles={['customer']}>
                <MockPaymentPage />
              </RequireRole>
            }
          />
          {/* ── US-14 ── */}
          {/* ── US-15 ── */}
          <Route
            path="/repartidor"
            element={
              <RequireRole roles={['rider']}>
                <MyServicesPage />
              </RequireRole>
            }
          />
          {/* ── US-11 ── */}
          <Route
            path="/vendedor/servicios"
            element={
              <RequireRole roles={['seller']}>
                <SellerServicesPage />
              </RequireRole>
            }
          />
          <Route
            path="/pruebas/:id"
            element={
              <RequireRole roles={['customer', 'seller', 'rider', 'admin']}>
                <ProofPage />
              </RequireRole>
            }
          />
          {/* ── fi de les zones ── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
