import { createContext, useContext, useMemo } from 'react';
import { ROLES } from '../constants/roles';

const AuthContext = createContext(null);

const devRole = import.meta.env.VITE_DEV_ROLE || ROLES.ADMIN;

const defaultUser = {
  id: 'dev-admin',
  fullName: 'Khoa Admin',
  avatarUrl:
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  role: devRole,
};

export function AuthProvider({ children }) {
  const value = useMemo(
    () => ({
      user: defaultUser,
      isAuthenticated: true,
      logout: () => {
        window.location.assign('/');
      },
    }),
    []
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
