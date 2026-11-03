import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Només deixa passar usuaris amb algun dels rols indicats; sense sessió, envia al login. */
export default function RequireRole({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando" />;
  if (!user) return <Navigate to="/iniciar-sesion" replace state={{ from: location.pathname }} />;
  if (!roles.some((role) => user.roles.includes(role))) {
    return (
      <div className="empty-state" role="alert">
        <h1 className="empty-state__title">No tienes acceso a esta página</h1>
      </div>
    );
  }
  return children;
}
