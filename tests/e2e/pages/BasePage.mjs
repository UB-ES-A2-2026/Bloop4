// Base dels objectes de pàgina (Page Object Model): el que comparteixen totes les pantalles.
// Els elements es localitzen pel rol i el nom accessible, com els troba un lector de pantalla;
// si una prova no troba un element, sovint és perquè ha perdut l'etiqueta accessible.
export class BasePage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.nav = page.getByRole('navigation', { name: 'Principal' });
  }

  /** Missatge d'estat (role="status") que conté `text`. */
  status(text) {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  /** Missatge d'error (role="alert") que conté `text`. */
  alert(text) {
    return this.page.getByRole('alert').filter({ hasText: text });
  }

  /** Nom de l'usuari de la sessió a la barra de navegació. */
  userName(fullName) {
    return this.nav.getByText(fullName, { exact: true });
  }

  async signOut() {
    await this.nav.getByRole('button', { name: 'Cerrar sesión' }).click();
  }
}
