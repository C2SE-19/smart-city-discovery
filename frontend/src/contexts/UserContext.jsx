/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch (err) {
      console.error('Lỗi parse user:', err);
      localStorage.removeItem('user');
      return null;
    }
  });
  const loading = false;

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser phải được sử dụng trong UserProvider');
  }
  return context;
}
