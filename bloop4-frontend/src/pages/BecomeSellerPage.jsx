import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Un client afegeix el rol de venedor al seu compte: /hazte-vendedor */
export default function BecomeSellerPage() {
  const { user, becomeSeller } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ legalName: '', city: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  if (user.roles.includes('seller')) {
    return (
      <section className="auth-page" aria-labelledby="become-seller-title">
        <h1 id="become-seller-title" className="auth-page__title">Ya eres empresa arrendadora</h1>
        <Link className="btn-primary" to="/vendedor">Ir a mi panel</Link>
      </section>
    );
  }

  const change = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!form.legalName.trim() || !form.city.trim()) return setError('Escribe la razón social y la ciudad de la empresa.');
    setSending(true);
    setError(null);
    try {
      await becomeSeller(form);
      navigate('/vendedor', { replace: true });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="become-seller-title">
      <h1 id="become-seller-title" className="auth-page__title">Publica tu material</h1>
      <p className="auth-page__text">
        Añade una empresa a tu cuenta para publicar productos. Podrás seguir reservando con la misma cuenta.
      </p>
      {user.status !== 'active' && (
        <p className="form__error" role="alert">Verifica tu correo electrónico para poder continuar.</p>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <label className="form__field">
          <span className="form__label">Razón social</span>
          <input className="form__input" name="legalName" autoComplete="organization" value={form.legalName} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Ciudad</span>
          <input className="form__input" name="city" autoComplete="address-level2" value={form.city} onChange={change} />
        </label>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={sending || user.status !== 'active'}>
          {sending ? 'Guardando…' : 'Añadir mi empresa'}
        </button>
      </form>
    </section>
  );
}
