import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusPanel from '../components/StatusPanel';
import { fetchMyProducts } from '../api/sellerApi';
import { useAuth } from '../auth/AuthContext';
import { formatPrice } from '../lib/format';

const STATUS_LABEL = { draft: 'Borrador', published: 'Publicado' };

/** Panell del venedor: llistat dels seus productes. */
export default function SellerHome() {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading', products: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchMyProducts({ signal: controller.signal })
      .then((products) => setState({ status: 'success', products, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', products: [], error });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="detail-page" aria-labelledby="seller-title">
      <div className="eyebrow">Panel del vendedor</div>
      <div className="seller__header">
        <h1 id="seller-title" className="catalog__title">{user.seller?.legalName ?? user.fullName}</h1>
        <Link className="btn-primary" to="/vendedor/productos/nuevo">Nuevo producto</Link>
      </div>

      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando productos" />}
      {state.status === 'error' && (
        <StatusPanel role="alert" title="No se pudieron cargar tus productos" text={state.error?.message} actionLabel="Reintentar" onAction={() => setAttempt((n) => n + 1)} />
      )}
      {state.status === 'success' && state.products.length === 0 && (
        <StatusPanel title="Todavía no tienes productos" text="Crea el primero: podrás guardarlo como borrador y publicarlo cuando esté listo." />
      )}
      {state.status === 'success' && state.products.length > 0 && (
        <table className="seller-table">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Estado</th>
              <th scope="col">Unidades</th>
              <th scope="col">Precio/día</th>
            </tr>
          </thead>
          <tbody>
            {state.products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link to={`/vendedor/productos/${product.id}`}>{product.name}</Link>
                </td>
                <td>
                  <span className={`badge badge--${product.status}`}>{STATUS_LABEL[product.status]}</span>
                </td>
                <td>{product.units}</td>
                <td>{formatPrice(product.dailyPrice, product.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
