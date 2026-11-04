import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { becomeSeller as apiBecomeSeller, fetchMe, login as apiLogin, logout as apiLogout } from '../api/authApi';

const AuthContext = createContext({
  user: null,
  status: 'ready',
  login: async () => null,
  logout: async () => {},
  becomeSeller: async () => null,
  refresh: async () => {},
});

/** On ha d'anar cada rol després d'iniciar sessió. */
export function homeFor(user) {
  return user?.roles.includes('seller') ? '/vendedor' : '/';
}

/** Sessió de l'usuari: es carrega amb GET /api/auth/me en obrir l'app. status: loading | ready */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      status,
      refresh,
      async login(credentials) {
        const loggedIn = await apiLogin(credentials);
        setUser(loggedIn);
        return loggedIn;
      },
      async logout() {
        await apiLogout().catch(() => {});
        setUser(null);
      },
      async becomeSeller(fields) {
        const updated = await apiBecomeSeller(fields);
        setUser(updated);
        return updated;
      },
    }),
    [user, status, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
