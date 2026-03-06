import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth as authApi, setToken, clearToken, getToken, checkHealth } from "../../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(null); // null = checking, true/false

  // Check if backend is available on mount
  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setBackendAvailable(ok);
    });
    return () => { cancelled = true; };
  }, []);

  // If backend is available and we have a token, verify it
  useEffect(() => {
    if (backendAvailable === null) return; // still checking
    if (!backendAvailable) {
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [backendAvailable]);

  // Listen for auth expired events
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener("vetra-auth-expired", handler);
    return () => window.removeEventListener("vetra-auth-expired", handler);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const data = await authApi.register(email, password, name);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, backendAvailable,
      login, register, logout,
      isAuthenticated: !!user,
      isOfflineMode: backendAvailable === false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
