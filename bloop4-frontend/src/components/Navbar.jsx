import { Link, NavLink } from 'react-router-dom';

const NAV_ITEMS = [{ label: 'Catálogo', to: '/' }];

export default function Navbar() {
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
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink className="nav__link" to={item.to} end>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
