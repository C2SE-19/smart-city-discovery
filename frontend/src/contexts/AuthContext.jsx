/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ROLES } from '../constants/roles';
import axios from 'axios';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'auth';

const ROLE_ALIASES = {
  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
  'super-admin': ROLES.ADMIN,
  super_admin: ROLES.ADMIN,
  merchant: ROLES.MERCHANT,
  seller: ROLES.MERCHANT,
  vendor: ROLES.MERCHANT,
  user: ROLES.USER,
  customer: ROLES.USER,
};

function normalizeRole(user) {
  if (user?.isAdmin === true) {
    return ROLES.ADMIN;
  }

  const rawRole =
    user?.role ?? user?.userRole ?? user?.user_role ?? user?.type ?? user?.accountType ?? '';

  if (typeof rawRole !== 'string') {
    return ROLES.USER;
  }

  const normalizedRole = rawRole.trim().toLowerCase();
  return ROLE_ALIASES[normalizedRole] || ROLES.USER;
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const displayName = user.fullname || user.fullName || user.name || user.username || 'User';

  return {
    ...user,
    fullname: user.fullname || displayName,
    fullName: user.fullName || displayName,
    role: normalizeRole(user),
    avatarUrl: user.avatarUrl || user.avatar_url || '',
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
        const savedToken =
          parsedAuth.token || parsedAuth.accessToken || parsedAuth.access_token || '';

        if (!savedToken) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setUser(null);
          setToken('');
        } else {
          setUser(normalizeUser(parsedAuth.user));
          setToken(savedToken);
        }
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const apiUrl =
      import.meta.env.VITE_API_BASE_URL
      || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${apiUrl}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const nextUser = normalizeUser(response.data?.user || null);
        if (nextUser) {
          setUser((prevUser) => {
            const mergedUser = normalizeUser({ ...prevUser, ...nextUser });
            localStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify({
                user: mergedUser,
                token
              })
            );
            return mergedUser;
          });
        }
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          console.log('AuthContext: token invalid or user paused/blocked, logging out');
          setUser(null);
          setToken('');
          localStorage.removeItem(AUTH_STORAGE_KEY);
          window.location.assign('/login');
          return;
        }

        // Silent: keep existing user if refresh fails for other reasons.
      }
    };

    const fetchSelfAndStartPolling = async () => {
      await fetchProfile();
      const intervalId = setInterval(async () => {
        try {
          await axios.get(`${apiUrl}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            console.log('AuthContext: verify token failed, logout now');
            setUser(null);
            setToken('');
            localStorage.removeItem(AUTH_STORAGE_KEY);
            window.location.assign('/login');
          }
        }
      }, 2000); 

      return intervalId;
    };

    let intervalId = null;

    (async () => {
      intervalId = await fetchSelfAndStartPolling();
    })();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [token]);

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
      updateUser: (patch) => {
        setUser((prevUser) => {
          if (!prevUser) {
            return prevUser;
          }
          const mergedUser = normalizeUser({ ...prevUser, ...patch });
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              user: mergedUser,
              token,
            })
          );
          return mergedUser;
        });
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
