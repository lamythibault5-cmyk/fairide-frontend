import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { effacerRecherches } from '../recherchesRecentes';
import { api, setSessionExpiredHandler } from '../api';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';
import { languePreferee, SUPPORTED_LANGUAGES } from '../i18n/routing';
import { effacerReprise } from '../bienvenue';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fairide_session';
// « Fairide s'en occupe » : l'admin ouvre le tableau de bord d'un commerce comme son restaurateur, dans un onglet
// à part. La session d'action vit dans sessionStorage (propre à l'onglet) et arrive par le fragment d'adresse
// (#agir=…), jamais envoyé au serveur ; la session admin, dans localStorage, reste intacte dans les autres onglets.
const ACT_KEY = 'fairide_session_agir';
// Casquette active d'un compte qui en porte plusieurs (voir plus bas). Mémorisée pour que l'onglet
// rouvre sur la même vue, jamais crue sur parole : elle est revalidée contre les rôles du compte.
const ROLE_ACTIF_KEY = 'fairide_role_actif';
/* LA CASQUETTE RETENUE PAR COMPTE (audit du 19/10, shop-402). La déconnexion oublie la casquette active (le compte suivant
 * sur la tablette ne doit pas ouvrir sur la vue du précédent) : un membre de l'équipe, dont le rôle d'origine est « client »,
 * se reconnectait à chaque service sur la vue client — mauvaise barre d'onglets, pas de « Mon équipe ». On retient donc
 * aussi le dernier choix PAR COMPTE (identifiant → casquette), relu à la connexion de ce même compte, et toujours revalidé
 * contre ses rôles. Rien de personnel : un identifiant opaque et un nom de rôle. */
const ROLE_PAR_COMPTE_KEY = 'fairide_role_par_compte';
function roleRetenuPour(userId) {
  if (!userId) return null;
  try { return JSON.parse(localStorage.getItem(ROLE_PAR_COMPTE_KEY) || '{}')[userId] || null; } catch { return null; }
}
function retenirRolePour(userId, role) {
  if (!userId) return;
  try {
    const m = JSON.parse(localStorage.getItem(ROLE_PAR_COMPTE_KEY) || '{}');
    m[userId] = role;
    localStorage.setItem(ROLE_PAR_COMPTE_KEY, JSON.stringify(m));
  } catch { /* sans stockage */ }
}
/* SIMULATION (Admin › Simulation). La console ouvre un onglet avec les sessions de trois comptes de test (client,
 * restaurateur, livreur) plus le profil « visiteur » (aucune session). Tout vit dans sessionStorage, propre à
 * l'onglet, et arrive par le fragment #simuler=… : comme pour « Fairide agit comme… », la session admin
 * (localStorage) des autres onglets n'est jamais touchée. `actif` dit quel profil l'onglet affiche. */
const SIMU_KEY = 'fairide_simulation';
export const PROFILS_SIMULATION = ['visitor', 'client', 'restaurant', 'driver'];
function simulationInitiale() {
  try {
    const m = window.location.hash.match(/[#&]simuler=([^&]+)/);
    if (m) {
      const s = JSON.parse(decodeURIComponent(atob(m[1])));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (s && s.profiles) {
        // Un nouveau lancement repart d'une simulation propre (un onglet réutilisé garderait l'ancienne).
        try { sessionStorage.removeItem(ACT_KEY); } catch { /* sans stockage */ }
        return { ...s, actif: PROFILS_SIMULATION.includes(s.actif) ? s.actif : 'visitor' };
      }
    }
    const s = JSON.parse(sessionStorage.getItem(SIMU_KEY) || 'null');
    return s && s.profiles ? s : null;
  } catch { return null; }
}
function sessionDuProfil(simulation) {
  if (!simulation || simulation.actif === 'visitor') return null;
  return simulation.profiles?.[simulation.actif] || null;
}
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
  const { t, language, setLanguage } = useLanguage();
  const toast = useToast();
  const [simulation, setSimulation] = useState(simulationInitiale);
  // Onglet de simulation : ni localStorage, ni session d'action — seulement les profils de la simulation.
  const simuRef = useRef(!!simulation);
  const [session, setSession] = useState(() => {
    if (simuRef.current) return sessionDuProfil(simulation);
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
  const [roleMemorise, setRoleMemorise] = useState(() => {
    try { return localStorage.getItem(ROLE_ACTIF_KEY) || null; } catch { return null; }
  });

  // Garde-fou anti-répétition de la déconnexion pour expiration (voir l'effet plus bas).
  const expiredRef = useRef(false);
  /* DÉCONNEXION VOULUE (audit du 19/10, auth-14). Après « Se déconnecter », ProtectedRoute renvoyait vers /login avec la page
   * quittée en `from` : la personne suivante sur l'appareil (un commerce après un client) arrivait dans « Mon compte » au lieu
   * de son espace, et le site montrait le formulaire de connexion au lieu de l'accueil. Ce drapeau dit à ProtectedRoute
   * d'aller à l'accueil, sans `from` ; il retombe dès qu'une session s'ouvre. Une session EXPIRÉE garde le `from` (USR-6). */
  const [deconnexionVoulue, setDeconnexionVoulue] = useState(false);
  useEffect(() => { if (session?.user) setDeconnexionVoulue(false); }, [session?.user]);

  useEffect(() => {
    if (simuRef.current) {
      // Le profil affiché garde sa session à jour (refreshUser, updateProfile…). Une session vidée (expiration,
      // déconnexion) ne l'efface pas : la barre de simulation propose alors de relancer depuis la console.
      if (session) {
        setSimulation((prev) => {
          if (!prev || prev.actif === 'visitor' || prev.profiles?.[prev.actif] === session) return prev;
          return { ...prev, profiles: { ...prev.profiles, [prev.actif]: session } };
        });
        expiredRef.current = false;
      }
      return;
    }
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

  useEffect(() => {
    if (!simuRef.current) return;
    try {
      if (simulation) sessionStorage.setItem(SIMU_KEY, JSON.stringify(simulation));
      else sessionStorage.removeItem(SIMU_KEY);
    } catch { /* sans stockage */ }
  }, [simulation]);

  // Une session ouverte (inscription, connexion) : l'accueil de l'application n'a plus rien à reprendre (bienvenue.js).
  useEffect(() => { if (session?.user) effacerReprise(); }, [session?.user]);

  // La langue choisie suit le compte : le backend l'utilise pour les e-mails envoyés plus tard, hors de
  // toute requête de l'utilisateur (livreur en route, réservation confirmée par le restaurateur...).
  useEffect(() => {
    if (!session?.token || !session.user || session.user.language === language || session.actingAs) return;
    /* UN NOUVEL APPAREIL N'IMPOSE PAS SA LANGUE AU COMPTE (audit du 19/10, AO-23). La langue de la page vient de l'adresse
     * (le français à la racine) : un client néerlandophone qui se connectait pour la première fois sur fairide.be/login
     * repassait son compte en français, et ses e-mails et notifications suivaient. Sans choix mémorisé sur cet appareil
     * (routing.js, posé par un vrai changement de langue), c'est la langue du compte qui l'emporte : la page s'y met. */
    if (!languePreferee() && SUPPORTED_LANGUAGES.includes(session.user.language)) { setLanguage(session.user.language); return; }
    api('/auth/me', { method: 'PATCH', token: session.token, body: { language }, logoutOn401: false })
      .then((user) => setSession((prev) => (prev ? { ...prev, user } : prev)))
      .catch(() => {});
  }, [language, session?.token, setLanguage]);

  /* LA SESSION SE PROLONGE QUAND ON S'EN SERT (audit du 18/10/2026). Elle dure 30 jours depuis la connexion : ouverte
   * chaque jour, l'application déconnectait quand même le 31e. Au plus une fois par jour (à l'ouverture, au retour au
   * premier plan), une session de plus d'un jour est échangée contre une neuve (POST /auth/session/renew). Le serveur
   * refuse pour un administrateur (12 h fermes), « Fairide agit comme… » et la simulation : il rend alors token: null. */
  useEffect(() => {
    if (!session?.token || session.actingAs || simuRef.current) return undefined;
    let fini = false;
    const emisA = (() => { try { return JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).iat || 0; } catch { return 0; } })();
    const renouveler = () => {
      if (fini || document.visibilityState === 'hidden' || Date.now() / 1000 - emisA < 24 * 3600) return;
      fini = true;
      api('/auth/session/renew', { method: 'POST', token: session.token, logoutOn401: false })
        .then((r) => { if (r?.token) setSession((prev) => (prev && prev.token === session.token ? { ...prev, token: r.token } : prev)); })
        .catch(() => { /* on réessaiera à la prochaine ouverture */ });
    };
    renouveler();
    document.addEventListener('visibilitychange', renouveler);
    return () => { fini = true; document.removeEventListener('visibilitychange', renouveler); };
  }, [session?.token, session?.actingAs]);

  /* LES DROITS DE LA SESSION SE METTENT À JOUR (audit du 19/10, LIVE-19). Le compte gardé dans le téléphone n'était relu
   * qu'à la connexion : un membre ajouté à l'équipe restait renvoyé hors de /admin (isAdmin faux), un compte passé « test »
   * ne l'était pas, jusqu'à se déconnecter. On relit /auth/me à l'ouverture et au retour au premier plan (au plus une fois
   * toutes les cinq minutes). Pas pendant « Fairide agit comme… » ni en simulation : leur session n'est pas celle du
   * compte lu. Une session révoquée répond 401, et la déconnexion centrale (api.js) fait le reste. */
  useEffect(() => {
    if (!session?.token || session.actingAs || simuRef.current) return undefined;
    let derniere = 0;
    const relire = () => {
      if (document.visibilityState === 'hidden' || Date.now() - derniere < 5 * 60 * 1000) return;
      derniere = Date.now();
      api('/auth/me', { token: session.token })
        .then((user) => setSession((prev) => (prev && prev.token === session.token && JSON.stringify(prev.user) !== JSON.stringify(user) ? { ...prev, user } : prev)))
        .catch(() => { /* réseau : on réessaiera au prochain retour */ });
    };
    relire();
    document.addEventListener('visibilitychange', relire);
    return () => document.removeEventListener('visibilitychange', relire);
  }, [session?.token, session?.actingAs]);

  /* DÉCONNEXION DANS UN AUTRE ONGLET (audit du 19/10, auth-14). Se déconnecter dans un onglet laissait les autres travailler
   * avec la même session jusqu'au rechargement. L'événement « storage » dit quand un autre onglet a vidé la session : on la
   * vide ici aussi. Pas dans un onglet « Fairide agit comme… » ni de simulation, qui ont leur propre session. */
  useEffect(() => {
    function ailleurs(e) {
      if (e.key !== STORAGE_KEY || e.newValue || simuRef.current || actingRef.current) return;
      setSession(null);
      setDeconnexionVoulue(true);
    }
    window.addEventListener('storage', ailleurs);
    return () => window.removeEventListener('storage', ailleurs);
  }, []);

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
      // Compte supprimé (par son titulaire ou par Fairide) : on le dit tel quel, pas « session expirée ». Session révoquée
      // (mot de passe changé, « déconnecter tous mes appareils ») : sa propre phrase (audit du 19/10, auth-37).
      toast(code === 'ACCOUNT_DELETED' ? t('auth.accountDeletedLogout') : code === 'SESSION_REVOKED' ? t('auth.sessionRevoked') : t('auth.sessionExpired'));
    });
    return () => setSessionExpiredHandler(null);
    // `t` aussi (audit du 19/10, auth-33) : sans lui, le message gardait la langue dans laquelle la page s'était ouverte.
  }, [toast, t]);

  /* `totpCode` n'est envoyé qu'au second passage : le serveur répond d'abord 401 TOTP_REQUIRED, ce que
   * Auth.jsx transforme en champ « code à 6 chiffres ». On ne le demande jamais d'avance — demander un
   * code avant de savoir si le compte en a un dirait à un inconnu quels comptes sont administrateurs. */
  async function login(email, password, totpCode) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, ...(totpCode ? { totpCode } : {}) } });
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

  // canal 'email' : « Recevoir le code par e-mail » quand le SMS n'arrive pas (22/10/2026, routes/auth.js › /resend-code).
  async function resendCode(email, canal) {
    return api('/auth/resend-code', { method: 'POST', body: { email, ...(canal === 'email' ? { canal } : {}) } });
  }

  // « Changer de numéro » sur l'écran du code (audit du 19/10, auth-03) : le compte en attente se prouve par son mot de
  // passe, ou par le jeton Apple / Google (preuve = { fournisseur, jeton }), et un code part au nouveau numéro.
  async function changePendingPhone(email, phone, { password, preuve } = {}) {
    return api('/auth/pending/phone', { method: 'POST', body: { email, phone, ...(preuve?.jeton ? { fournisseur: preuve.fournisseur, jeton: preuve.jeton } : { password }) } });
  }

  async function forgotPassword(email) {
    return api('/auth/forgot-password', { method: 'POST', body: { email } });
  }

  // Mot de passe oublié sur une adresse jamais confirmée : le code reçu la confirme, puis le lien part (routes/auth.js).
  async function confirmForgotPassword(email, code) {
    return api('/auth/forgot-password/confirm', { method: 'POST', body: { email, code } });
  }

  async function resetPassword(token, password) {
    return api('/auth/reset-password', { method: 'POST', body: { token, password } });
  }

  async function loginWithGoogle(credential, role, extra) {
    const data = await api('/auth/google', { method: 'POST', body: { credential, role, ...extra } });
    // Nouveau compte : le téléphone se prouve par SMS d'abord (needsVerification), la session vient avec le code.
    if (!data.needsVerification) setSession(data);
    return data;
  }

  // « Continuer avec Apple » (application iPhone seulement, voir natif.js) : même réponse que Google — session
  // ouverte, ou INCOMPLETE_PROFILE pour enchaîner sur le formulaire d'inscription.
  async function loginWithApple(idToken, role, extra) {
    const data = await api('/auth/apple', { method: 'POST', body: { idToken, role, ...extra } });
    if (!data.needsVerification) setSession(data);
    return data;
  }

  async function updateProfile(patch) {
    // logoutOn401: false — cet endpoint renvoie 401 pour un mot de passe ACTUEL incorrect, pas pour
    // une session invalide (voir api.js). L'erreur doit s'afficher dans le formulaire.
    const reponse = await api('/auth/me', { method: 'PATCH', token: session.token, body: patch, logoutOn401: false });
    // Changer son mot de passe ferme TOUTES les sessions du compte, côté serveur (token_version) : les
    // autres appareils sont déconnectés, ce qui est le but. Celle-ci serait déconnectée avec, donc le
    // serveur renvoie un jeton neuf dans ce cas précis — il faut le garder, sinon l'utilisateur est
    // éjecté de l'écran où il vient de changer son mot de passe. Les autres champs (langue, adresse,
    // IBAN…) répondent sans `token`, et rien ne change pour eux.
    const { token: nouveauJeton, ...user } = reponse;
    setSession((prev) => (nouveauJeton ? { ...prev, token: nouveauJeton, user } : { ...prev, user }));
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

  /* Simulation : passer d'un profil à l'autre ne touche à aucun compte, c'est un changement de session DANS l'onglet.
   * Par un rechargement complet, et c'est voulu : changer la session puis naviguer en deux temps laissait la page
   * protégée du profil précédent se rendre une fois sans session (→ /login), et les caches en mémoire d'un profil
   * (panier, messages, tableau de bord) auraient survécu dans l'autre. */
  function changerProfilSimulation(cible, chemin = '/') {
    if (!simuRef.current || !simulation || !PROFILS_SIMULATION.includes(cible)) return false;
    try { sessionStorage.setItem(SIMU_KEY, JSON.stringify({ ...simulation, actif: cible })); } catch { /* sans stockage */ }
    window.location.assign(chemin);
    return true;
  }

  // Quitter la simulation : l'onglet revient à la session admin (localStorage), sur la page Simulation.
  function quitterSimulation() {
    try { sessionStorage.removeItem(SIMU_KEY); } catch { /* rien */ }
    window.location.assign('/admin/simulation');
  }

  function logout() {
    // En simulation, « Se déconnecter » ramène au profil visiteur sans perdre les sessions de test.
    if (simuRef.current) { changerProfilSimulation('visitor', '/'); return; }
    setDeconnexionVoulue(true);
    setSession(null);
    // La casquette active appartient à la session qui s'en va : sans cet oubli, le compte suivant
    // ouvrirait sur la vue du précédent (ou sur une vue à laquelle il n'a pas droit, le temps que
    // la revalidation le corrige).
    setRoleMemorise(null);
    try { localStorage.removeItem(ROLE_ACTIF_KEY); } catch { /* sans stockage */ }
    // Les dernières recherches de la page Recherche partent aussi : le compte suivant sur ce téléphone ne les lit pas.
    effacerRecherches();
    // Le panier de cet onglet part avec la session (CartContext écoute cet événement — plan de test PAN-1).
    window.dispatchEvent(new Event('fairide:deconnexion'));
  }

  // Quitter le mode « Fairide agit comme… » : l'onglet revient à la session admin (localStorage).
  function quitterAction() {
    try { sessionStorage.removeItem(ACT_KEY); } catch { /* rien */ }
    window.location.assign('/admin/restaurants');
  }

  /* PLUSIEURS CASQUETTES, UNE SEULE ACTIVE.
   *
   * `roles` est ce que le compte porte (voir user_roles côté serveur) ; `role` reste ce que
   * l'interface affiche — la casquette ACTIVE. C'est volontaire : une centaine d'endroits lisent
   * déjà `role` pour décider d'un écran, d'un menu ou d'une redirection. En faisant de `role` la
   * casquette active plutôt que « le rôle du compte », aucun d'eux ne change.
   *
   * La casquette active est mémorisée, mais toujours revalidée contre `roles` : un rôle retiré côté
   * serveur, ou une session d'un autre compte, ne peut pas laisser l'interface sur un écran auquel
   * le compte n'a plus droit. En cas de doute, on retombe sur le rôle d'origine du compte.
   *
   * Les onglets « Fairide agit comme… » n'y touchent pas : ils affichent le commerce, point. */
  const roles = session?.user?.roles?.length
    ? session.user.roles
    : (session?.user?.role ? [session.user.role] : []);
  // (En simulation, la casquette mémorisée est celle de l'admin, dans localStorage : elle ne vaut pas ici.)
  const roleRetenu = roleMemorise || (!session?.actingAs && !simuRef.current ? roleRetenuPour(session?.user?.id) : null);
  const roleActif = !session?.actingAs && !simuRef.current && roleRetenu && roles.includes(roleRetenu)
    ? roleRetenu
    : (session?.user?.role || null);

  // Ajoute une casquette au compte courant (POST /auth/roles) et met la session à jour sans
  // reconnexion : le serveur lit les rôles en base à chaque requête, le jeton n'a pas à changer.
  async function ajouterRole(nouveauRole) {
    const data = await api('/auth/roles', { method: 'POST', token: session?.token, body: { role: nouveauRole } });
    setSession((s) => (s ? { ...s, user: { ...s.user, roles: data.roles } } : s));
    return data.roles;
  }

  // Changer de casquette ne touche ni au compte ni au jeton : c'est un changement de vue.
  // `rolesConnus` : les rôles que l'appelant vient de relire (refreshUser). Juste après avoir rejoint une équipe, `roles`
  // est encore celui du rendu d'avant (['client']) : sans eux, la casquette « commerce » était refusée (shop-402).
  function changerRole(cible, rolesConnus) {
    if (!(rolesConnus || roles).includes(cible)) return false;
    setRoleMemorise(cible);
    if (simuRef.current) return true; // localStorage appartient à la session admin des autres onglets
    try { localStorage.setItem(ROLE_ACTIF_KEY, cible); } catch { /* sans stockage */ }
    if (!session?.actingAs) retenirRolePour(session?.user?.id, cible);
    return true;
  }

  const value = {
    user: session?.user || null,
    deconnexionVoulue,
    token: session?.token || null,
    role: roleActif,
    roles,
    ajouterRole,
    changerRole,
    actingAs: !!session?.actingAs,
    actingAdminEmail: session?.user?.actingAdminEmail || '',
    quitterAction,
    simulation: simulation
      ? { actif: simulation.actif, restaurantId: simulation.restaurantId || null, restaurantName: simulation.restaurantName || '', expiresAt: simulation.expiresAt || 0, profiles: simulation.profiles }
      : null,
    changerProfilSimulation,
    quitterSimulation,
    login,
    register,
    verifyEmail,
    resendCode,
    changePendingPhone,
    forgotPassword,
    confirmForgotPassword,
    resetPassword,
    loginWithGoogle,
    loginWithApple,
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
