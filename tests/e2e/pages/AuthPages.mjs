import { BasePage } from './BasePage.mjs';

/** Inici de sessió (/iniciar-sesion). */
export class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.email = page.getByLabel('Correo electrónico');
    this.password = page.getByLabel('Contraseña');
    this.submit = page.getByRole('button', { name: 'Entrar' });
  }

  async goto() {
    await this.page.goto('/iniciar-sesion');
  }

  async signIn({ email, password }) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

/** Registre (/registro). */
export class RegisterPage extends BasePage {
  constructor(page) {
    super(page);
    this.fullName = page.getByLabel('Nombre y apellidos');
    this.email = page.getByLabel('Correo electrónico');
    this.password = page.getByLabel(/^Contraseña/);
    this.terms = page.getByLabel('Acepto los términos de uso y la política de privacidad');
    this.submit = page.getByRole('button', { name: 'Crear cuenta' });
  }

  async goto() {
    await this.page.goto('/registro');
  }

  async registerCustomer({ fullName, email, password }) {
    await this.page.getByLabel('Alquilar material para mis eventos').check();
    await this.fullName.fill(fullName);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.terms.check();
    await this.submit.click();
  }
}
