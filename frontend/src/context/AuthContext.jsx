import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('yensync_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('yensync_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      if (token) {
        try {
          const freshUser = await api.getMe();
          setUser(freshUser);
          localStorage.setItem('yensync_user', JSON.stringify(freshUser));
        } catch {
          logout();
        }
      }
      setLoading(false);
    }
    verifySession();
  }, [token]);

  const login = async (faculty_code, password) => {
    const res = await api.login(faculty_code, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('yensync_token', res.token);
    localStorage.setItem('yensync_user', JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('yensync_token');
    localStorage.removeItem('yensync_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
