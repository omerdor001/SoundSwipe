import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = 'http://10.0.0.3:3001';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const savedUser = localStorage.getItem('ss_user');
    const savedToken = localStorage.getItem('ss_token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    localStorage.setItem('ss_token', data.token);
    setUser(data.user);
    setToken(data.token);
    setRefreshKey(k => k + 1);
    return data.user;
  }, []);

  const signup = useCallback(async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    localStorage.setItem('ss_token', data.token);
    setUser(data.user);
    setToken(data.token);
    setRefreshKey(k => k + 1);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch {}
    localStorage.removeItem('ss_user');
    localStorage.removeItem('ss_token');
    setUser(null);
    setToken(null);
  }, []);

  const loginWithToken = useCallback((userData, authToken) => {
    localStorage.setItem('ss_user', JSON.stringify(userData));
    localStorage.setItem('ss_token', authToken);
    setUser(userData);
    setToken(authToken);
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, refreshKey, login, signup, logout, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export { API_URL };
