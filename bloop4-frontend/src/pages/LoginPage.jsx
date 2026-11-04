import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const change = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const user = await login(form);
      navigate(location.state?.from ?? homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="login-title">
      <h1 id="login-title" className="auth-page__title">Iniciar sesión</h1>
      <form className="form" onSubmit={submit} noValidate>
        <label className="form__field">
          <span className="form__label">Correo electrónico</span>
          <input className="form__input" type="email" name="email" autoComplete="email" required value={form.email} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Contraseña</span>
          <input className="form__input" type="password" name="password" autoComplete="current-password" required value={form.password} onChange={change} />
        </label>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="auth-page__alt">
        ¿No tienes cuenta? <Link to="/registro">Crear una cuenta</Link>
      </p>
    </section>
  );
}
