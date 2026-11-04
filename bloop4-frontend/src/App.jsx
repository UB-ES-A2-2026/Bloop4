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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
