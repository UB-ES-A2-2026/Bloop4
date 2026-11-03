import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api/authApi';

export const PASSWORD_MIN_LENGTH = 8;
const EMPTY = { role: 'customer', fullName: '', email: '', password: '', legalName: '', city: '', acceptTerms: false };

/** Comprovacions bàsiques abans d'enviar; l'API les torna a fer totes. */
function validate(form) {
  if (!form.fullName.trim()) return 'Escribe tu nombre.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return 'Escribe un correo electrónico válido.';
  if (form.password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (form.role === 'seller' && (!form.legalName.trim() || !form.city.trim())) return 'Escribe la razón social y la ciudad de la empresa.';
  if (!form.acceptTerms) return 'Debes aceptar los términos y la política de privacidad.';
  return null;
}

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [sending, setSending] = useState(false);

  const change = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  async function submit(event) {
    event.preventDefault();
    const invalid = validate(form);
    if (invalid) return setError(invalid);
    setSending(true);
    setError(null);
    try {
      const { legalName, city, ...rest } = form;
      setDone(await register(form.role === 'seller' ? { ...rest, legalName, city } : rest));
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="auth-page" aria-labelledby="register-title">
        <h1 id="register-title" className="auth-page__title">Revisa tu correo</h1>
        <p className="auth-page__text" role="status">{done}</p>
        <Link className="btn-primary" to="/iniciar-sesion">Ir a iniciar sesión</Link>
      </section>
    );
  }

  return (
    <section className="auth-page" aria-labelledby="register-title">
      <h1 id="register-title" className="auth-page__title">Crear una cuenta</h1>
      <form className="form" onSubmit={submit} noValidate>
        <fieldset className="form__roles">
          <legend className="form__label">Quiero…</legend>
          <label className="form__radio">
            <input type="radio" name="role" value="customer" checked={form.role === 'customer'} onChange={change} />
            Alquilar material para mis eventos
          </label>
          <label className="form__radio">
            <input type="radio" name="role" value="seller" checked={form.role === 'seller'} onChange={change} />
            Publicar el material de mi empresa
          </label>
        </fieldset>
        <label className="form__field">
          <span className="form__label">Nombre y apellidos</span>
          <input className="form__input" name="fullName" autoComplete="name" value={form.fullName} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Correo electrónico</span>
          <input className="form__input" type="email" name="email" autoComplete="email" value={form.email} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Contraseña (mínimo {PASSWORD_MIN_LENGTH} caracteres)</span>
          <input className="form__input" type="password" name="password" autoComplete="new-password" value={form.password} onChange={change} />
        </label>
        {form.role === 'seller' && (
          <>
            <label className="form__field">
              <span className="form__label">Razón social</span>
              <input className="form__input" name="legalName" autoComplete="organization" value={form.legalName} onChange={change} />
            </label>
            <label className="form__field">
              <span className="form__label">Ciudad</span>
              <input className="form__input" name="city" autoComplete="address-level2" value={form.city} onChange={change} />
            </label>
          </>
        )}
        <label className="form__check">
          <input type="checkbox" name="acceptTerms" checked={form.acceptTerms} onChange={change} />
          Acepto los términos de uso y la política de privacidad
        </label>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? 'Creando la cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="auth-page__alt">
        ¿Ya tienes cuenta? <Link to="/iniciar-sesion">Iniciar sesión</Link>
      </p>
    </section>
  );
}
