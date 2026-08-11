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

  async function register(payload) {
    const data = await api('/auth/register', { method: 'POST', body: payload });
    if (!data.needsVerification) setSession(data);
    return data;
  }

  async function verifyEmail(email, code) {
    const data = await api('/auth/verify-email', { method: 'POST', body: { email, code } });
    setSession(data);
    return data;
  }

  async function resendCode(email) {
    return api('/auth/resend-code', { method: 'POST', body: { email } });
  }

  async function loginWithGoogle(credential, role, extra) {
    const data = await api('/auth/google', { method: 'POST', body: { credential, role, ...extra } });
    setSession(data);
    return data;
  }

  async function updateProfile(patch) {
    const user = await api('/auth/me', { method: 'PATCH', token: session.token, body: patch });
    setSession((prev) => ({ ...prev, user }));
    return user;
  }

  async function refreshUser() {
    const user = await api('/auth/me', { token: session.token });
    setSession((prev) => ({ ...prev, user }));
    return user;
  }

  async function requestDeletionCode() {
    return api('/auth/me/request-deletion', { method: 'POST', token: session.token });
  }

  async function deleteAccount({ code, reason, comment }) {
    const data = await api('/auth/me', { method: 'DELETE', token: session.token, body: { code, reason, comment } });
    setSession(null);
    return data;
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
    verifyEmail,
    resendCode,
    loginWithGoogle,
    updateProfile,
    refreshUser,
    requestDeletionCode,
    deleteAccount,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
