import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fairide_session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setSession(data);
    return data;
  }

  async function register(name, email, password, role, phone, address) {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password, role, phone, address } });
    setSession(data);
    return data;
  }

  async function loginWithGoogle(credential, role, phone, address) {
    const data = await api('/auth/google', { method: 'POST', body: { credential, role, phone, address } });
    setSession(data);
    return data;
  }

  async function updateProfile(patch) {
    const user = await api('/auth/me', { method: 'PATCH', token: session.token, body: patch });
    setSession((prev) => ({ ...prev, user }));
    return user;
  }

  function logout() {
    setSession(null);
  }

  const value = {
    user: session?.user || null,
    token: session?.token || null,
    role: session?.user?.role || null,
    login,
    register,
    loginWithGoogle,
    updateProfile,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
