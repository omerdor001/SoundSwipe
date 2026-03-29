import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const API_URL = 'http://10.0.0.3:3001';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const storageRef = useRef({});

  useEffect(() => {
    const savedUser = storageRef.current.ss_user;
    const savedToken = storageRef.current.ss_token;
    if (savedUser && savedToken) {
      setUser(savedUser);
      setToken(savedToken);
    }
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
    
    storageRef.current.ss_user = data.user;
    storageRef.current.ss_token = data.token;
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
    
    storageRef.current.ss_user = data.user;
    storageRef.current.ss_token = data.token;
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
    delete storageRef.current.ss_user;
    delete storageRef.current.ss_token;
    setUser(null);
    setToken(null);
  }, []);

  const loginWithToken = useCallback(async (userData, authToken) => {
    storageRef.current.ss_user = userData;
    storageRef.current.ss_token = authToken;
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
