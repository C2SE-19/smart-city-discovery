import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ROLES } from '../constants/roles';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'auth';

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const displayName = user.fullname || user.fullName || user.username || 'User';

  return {
    ...user,
    fullname: user.fullname || displayName,
    fullName: user.fullName || displayName,
    role: user.role || ROLES.USER,
    avatarUrl: user.avatarUrl || '',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

      if (savedAuth) {
        const parsedAuth = JSON.parse(savedAuth);
        setUser(normalizeUser(parsedAuth.user));
        setToken(parsedAuth.token || '');
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login: (nextUser, nextToken) => {
        const normalizedUser = normalizeUser(nextUser);
        const normalizedToken = nextToken || '';

        setUser(normalizedUser);
        setToken(normalizedToken);
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            user: normalizedUser,
            token: normalizedToken,
          })
        );
      },
      logout: () => {
        setUser(null);
        setToken('');
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.location.assign('/');
      },
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
