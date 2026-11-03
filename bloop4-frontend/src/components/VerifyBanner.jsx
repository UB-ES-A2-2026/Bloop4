import { useState } from 'react';
import ResendVerification from './ResendVerification';
import { useAuth } from '../auth/AuthContext';

/** Avís per als comptes amb sessió iniciada però amb el correu sense verificar. */
export default function VerifyBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (user?.status !== 'pending_verification') return null;

  return (
    <div className="banner" role="status">
      <p>
        Verifica tu correo para poder reservar o publicar material.{' '}
        {!open && (
          <button type="button" className="link-button" onClick={() => setOpen(true)}>
            Reenviar el enlace
          </button>
        )}
      </p>
      {open && <ResendVerification initialEmail={user.email} />}
    </div>
  );
}
