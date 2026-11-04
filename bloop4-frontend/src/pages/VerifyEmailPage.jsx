import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ResendVerification from '../components/ResendVerification';
import { verifyEmail } from '../api/authApi';
import { useAuth } from '../auth/AuthContext';

/** Destí de l'enllaç del correu: /verificar?token=… */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: token ? 'loading' : 'error', message: 'El enlace no es válido.' });
  // El token només es pot fer servir un cop: StrictMode executa els efectes dues vegades.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    verifyEmail(token)
      .then((message) => {
        setState({ status: 'success', message });
        refresh();
      })
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token, refresh]);

  return (
    <section className="auth-page" aria-labelledby="verify-title">
      <h1 id="verify-title" className="auth-page__title">Verificar el correo</h1>
      {state.status === 'loading' && <p className="auth-page__text" role="status">Verificando…</p>}
      {state.status === 'success' && (
        <>
          <p className="auth-page__text" role="status">{state.message}</p>
          <Link className="btn-primary" to="/iniciar-sesion">Iniciar sesión</Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <p className="form__error" role="alert">{state.message}</p>
          <ResendVerification />
        </>
      )}
    </section>
  );
}
