import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, setSessionExpiredHandler } from '../api';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fairide_session';
// « Fairide s'en occupe » : l'admin ouvre le tableau de bord d'un commerce comme son restaurateur, dans un onglet
// à part. La session d'action vit dans sessionStorage (propre à l'onglet) et arrive par le fragment d'adresse
// (#agir=…), jamais envoyé au serveur ; la session admin, dans localStorage, reste intacte dans les autres onglets.
const ACT_KEY = 'fairide_session_agir';
function sessionDepuisFragment() {
  try {
    const m = window.location.hash.match(/[#&]agir=([^&]+)/);
    if (!m) return null;
    const s = JSON.parse(decodeURIComponent(atob(m[1])));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return s && s.token ? { ...s, actingAs: true } : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [session, setSession] = useState(() => {
    try {
      const agir = sessionDepuisFragment() || JSON.parse(sessionStorage.getItem(ACT_KEY) || 'null');
      if (agir && agir.token) return { ...agir, actingAs: true };
    } catch { /* pas de session d'action */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  // Cet onglet est-il un onglet « Fairide agit comme… » ? Si oui, on n'écrit jamais dans localStorage.
  const actingRef = useRef(!!session?.actingAs);

  // Garde-fou anti-répétition de la déconnexion pour expiration (voir l'effet plus bas).
  const expiredRef = useRef(false);

  useEffect(() => {
    if (session?.actingAs) {
      actingRef.current = true;
      try { sessionStorage.setItem(ACT_KEY, JSON.stringify(session)); } catch { /* sans stockage */ }
      expiredRef.current = false;
      return;
    }
    if (actingRef.current) {
      // Fin de l'action (quitter, expiration) : on ne touche pas à la session admin des autres onglets.
      try { sessionStorage.removeItem(ACT_KEY); } catch { /* rien */ }
      return;
    }
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
    if (!session?.token || !session.user || session.user.language === language || session.actingAs) return;
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
    setSessionExpiredHandler((code) => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      setSession(null);
      // Compte supprimé (par son titulaire ou par Fairide) : on le dit tel quel, pas « session expirée ».
      toast(code === 'ACCOUNT_DELETED' ? t('auth.accountDeletedLogout') : t('auth.sessionExpired'));
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

  // Quitter le mode « Fairide agit comme… » : l'onglet revient à la session admin (localStorage).
  function quitterAction() {
    try { sessionStorage.removeItem(ACT_KEY); } catch { /* rien */ }
    window.location.assign('/admin/restaurants');
  }

  const value = {
    user: session?.user || null,
    token: session?.token || null,
    role: session?.user?.role || null,
    actingAs: !!session?.actingAs,
    actingAdminEmail: session?.user?.actingAdminEmail || '',
    quitterAction,
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
