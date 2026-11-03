import { useState } from 'react';
import { resendVerification } from '../api/authApi';

/** Formulari per demanar un enllaç de verificació nou. */
export default function ResendVerification({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    try {
      setMessage(await resendVerification(email));
    } catch (err) {
      setError(err.message);
    }
  }

  if (message) return <p className="auth-page__text" role="status">{message}</p>;
  return (
    <form className="form form--inline" onSubmit={submit} noValidate>
      <label className="form__field">
        <span className="form__label">Correo electrónico</span>
        <input className="form__input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button type="submit" className="btn-outline">Enviar un enlace nuevo</button>
    </form>
  );
}
