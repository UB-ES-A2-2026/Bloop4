import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link className="logo" to="/" aria-label="Bloop4, ir al catálogo">
          <span className="logo__mark" aria-hidden="true" />
          <span className="logo__text" aria-hidden="true">
            bloop<span>4</span>
          </span>
        </Link>
        <nav aria-label="Principal">
          <ul className="nav">
            <li>
              <NavLink className="nav__link" to="/" end>
                Catálogo
              </NavLink>
            </li>
            {user?.roles.includes('customer') && (
              <li>
                <NavLink className="nav__link" to="/reserva">
                  Mi reserva
                </NavLink>
              </li>
            )}
            {user?.roles.includes('seller') && (
              <li>
                <NavLink className="nav__link" to="/vendedor">
                  Mi panel
                </NavLink>
              </li>
            )}
            {user?.roles.includes('customer') && !user.roles.includes('seller') && (
              <li>
                <NavLink className="nav__link" to="/hazte-vendedor">
                  Publica tu material
                </NavLink>
              </li>
            )}
            {user ? (
              <>
                <li className="nav__user">{user.fullName}</li>
                <li>
                  <button type="button" className="nav__link nav__button" onClick={signOut}>
                    Cerrar sesión
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink className="nav__link" to="/iniciar-sesion">
                    Iniciar sesión
                  </NavLink>
                </li>
                <li>
                  <NavLink className="nav__link" to="/registro">
                    Crear cuenta
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
