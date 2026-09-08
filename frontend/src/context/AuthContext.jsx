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

  // activeDepartment is always the logged-in user's dept — strictly isolated, no switching
  const [activeDepartment, setActiveDepartment] = useState(() => {
    try {
      const stored = localStorage.getItem('yensync_active_department');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    async function verifySession() {
      if (token) {
        try {
          const freshUser = await api.getMe();
          setUser(freshUser);
          localStorage.setItem('yensync_user', JSON.stringify(freshUser));

          // Always lock activeDepartment to the logged-in user's dept
          const deptObj = {
            id: freshUser.department_id,
            name: freshUser.department_name,
            code: freshUser.department_code
          };
          setActiveDepartment(deptObj);
          localStorage.setItem('yensync_active_department', JSON.stringify(deptObj));
        } catch {
          logout();
        }
      }
      setLoading(false);
    }
    verifySession();
  }, [token]);

  const login = async (faculty_code, password, department_id = null, department_code = null) => {
    const res = await api.login(faculty_code, password, department_id, department_code);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('yensync_token', res.token);
    localStorage.setItem('yensync_user', JSON.stringify(res.user));

    // Lock to user's own department — strict isolation
    const deptObj = {
      id: res.user.department_id,
      name: res.user.department_name,
      code: res.user.department_code
    };
    setActiveDepartment(deptObj);
    localStorage.setItem('yensync_active_department', JSON.stringify(deptObj));

    return res.user;
  };

  const updateUser = (updatedUser, updatedToken) => {
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('yensync_user', JSON.stringify(updatedUser));
      if (updatedUser.department_id) {
        const deptObj = {
          id: updatedUser.department_id,
          name: updatedUser.department_name,
          code: updatedUser.department_code
        };
        setActiveDepartment(deptObj);
        localStorage.setItem('yensync_active_department', JSON.stringify(deptObj));
      }
    }
    if (updatedToken) {
      setToken(updatedToken);
      localStorage.setItem('yensync_token', updatedToken);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActiveDepartment(null);
    localStorage.removeItem('yensync_token');
    localStorage.removeItem('yensync_user');
    localStorage.removeItem('yensync_active_department');
    localStorage.removeItem('yensync_last_dept_id');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      activeDepartment,
      login,
      logout,
      updateUser,
      loading,
      isAuthenticated: !!token
    }}>
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
