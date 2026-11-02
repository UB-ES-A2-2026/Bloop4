import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Catalog from './components/Catalog';
import ProductDetail from './pages/ProductDetail';

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
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/productos/:id" element={<ProductDetail />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
