import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, setSessionExpiredHandler } from '../api';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fairide_session';

export function AuthProvider({ children }) {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Garde-fou anti-répétition de la déconnexion pour expiration (voir l'effet plus bas).
  const expiredRef = useRef(false);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      // Nouvelle session valide : on réarme le garde-fou ci-dessous, sinon une deuxième expiration
      // plus tard dans la même page passerait silencieusement (aucun toast, aucune déconnexion).
      expiredRef.current = false;
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // La langue choisie suit le compte : le backend l'utilise pour les e-mails envoyés plus tard, hors de
  // toute requête de l'utilisateur (livreur en route, réservation confirmée par le restaurateur...).
  useEffect(() => {
    if (!session?.token || !session.user || session.user.language === language) return;
    api('/auth/me', { method: 'PATCH', token: session.token, body: { language }, logoutOn401: false })
      .then((user) => setSession((prev) => (prev ? { ...prev, user } : prev)))
      .catch(() => {});
  }, [language, session?.token]);

  // Session expirée (401 sur une requête authentifiée, voir api.js) : on vide la session, ce qui
  // suffit à renvoyer vers /login puisque ProtectedRoute redirige dès que `user` est nul — pas de
  // navigation impérative ici, qui ferait sortir à tort un visiteur d'une page publique.
  // Un garde-fou est nécessaire : une page charge souvent plusieurs endpoints en parallèle
  // (voir loadDashboard), qui repartiraient donc tous en 401 en même temps et empileraient autant
  // de toasts identiques.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      setSession(null);
      toast(t('auth.sessionExpired'));
    });
    return () => setSessionExpiredHandler(null);
  }, [toast]);

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

  async function forgotPassword(email) {
    return api('/auth/forgot-password', { method: 'POST', body: { email } });
  }

  async function resetPassword(token, password) {
    return api('/auth/reset-password', { method: 'POST', body: { token, password } });
  }

  async function loginWithGoogle(credential, role, extra) {
    const data = await api('/auth/google', { method: 'POST', body: { credential, role, ...extra } });
    setSession(data);
    return data;
  }

  async function updateProfile(patch) {
    // logoutOn401: false — cet endpoint renvoie 401 pour un mot de passe ACTUEL incorrect, pas pour
    // une session invalide (voir api.js). L'erreur doit s'afficher dans le formulaire.
    const user = await api('/auth/me', { method: 'PATCH', token: session.token, body: patch, logoutOn401: false });
    setSession((prev) => ({ ...prev, user }));
    return user;
  }

  async function refreshUser() {
    const user = await api('/auth/me', { token: session.token });
    setSession((prev) => ({ ...prev, user }));
    return user;
  }

  async function requestContactChange(field, newValue) {
    return api('/auth/me/request-contact-change', { method: 'POST', token: session.token, body: { field, newValue } });
  }

  async function confirmContactChange(field, newValue, code) {
    // Réponse { token, user } comme login/register — un nouveau token est nécessaire car le JWT
    // embarque l'email (voir middleware/auth.js requireAdmin) et resterait sinon périmé après un
    // changement d'email jusqu'à la prochaine reconnexion.
    const data = await api('/auth/me/confirm-contact-change', { method: 'PATCH', token: session.token, body: { field, newValue, code } });
    setSession(data);
    return data.user;
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
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    updateProfile,
    refreshUser,
    requestContactChange,
    confirmContactChange,
    requestDeletionCode,
    deleteAccount,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
