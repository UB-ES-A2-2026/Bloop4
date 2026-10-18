const NAV_ITEMS = [{ label: 'Categorías', href: '#catalogo' }];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <a className="logo" href="#catalogo" aria-label="Bloop4, ir al catálogo">
          <span className="logo__mark" aria-hidden="true" />
          <span className="logo__text" aria-hidden="true">
            bloop<span>4</span>
          </span>
        </a>
        <nav aria-label="Principal">
          <ul className="nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a className="nav__link" href={item.href} aria-current="page">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
