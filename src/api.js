export const API_BASE = import.meta.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';

// Erreur enrichie du code HTTP : jusqu'ici toute réponse non-OK devenait un Error générique, ce qui
// rendait un 401 (session expirée) indiscernable d'un 500 côté appelant — l'app affichait donc
// "Une erreur est survenue" indéfiniment sur toutes les pages, sans jamais renvoyer vers /login, et
// seul un vidage manuel du localStorage permettait d'en sortir. `status` rend ce cas identifiable.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Appelé quand une requête AUTHENTIFIÉE revient en 401 : le token est périmé ou révoqué. AuthContext
// s'enregistre ici au montage (voir AuthContext.jsx) pour vider la session et renvoyer vers /login.
// Un module plutôt qu'un import direct du contexte : api.js est importé par le contexte lui-même,
// l'inverse créerait un cycle.
let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

// Un 401 sur une requête SANS token n'est pas une session expirée mais un échec de connexion
// (mauvais mot de passe sur /auth/login, jeton Google invalide...) : il doit remonter normalement à
// l'appelant pour être affiché dans le formulaire, sans déclencher de déconnexion.
//
// `logoutOn401: false` couvre le cas restant, vérifié côté serveur : PATCH /auth/me renvoie 401
// « Mot de passe actuel incorrect » alors que le token, lui, est parfaitement valide (voir
// routes/auth.js). Sans cette exception, se tromper de mot de passe actuel en le changeant
// déconnecterait l'utilisateur en lui annonçant une session expirée — deux mensonges d'un coup.
// C'est le SEUL endpoint authentifié du backend dans ce cas ; partout ailleurs un 401 vient du
// middleware requireAuth, donc d'un token réellement périmé.
function handleResponse(res, data, hadToken, logoutOn401) {
  if (res.ok) return data;
  if (res.status === 401 && hadToken && logoutOn401) {
    const error = new ApiError('Ta session a expiré. Reconnecte-toi pour continuer.', 401);
    if (onSessionExpired) onSessionExpired();
    throw error;
  }
  throw new ApiError(data.error || 'Une erreur est survenue.', res.status);
}

export async function api(path, { method = 'GET', body, token, logoutOn401 = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Impossible de joindre le serveur Fairide. Réessaie dans un instant.", 0);
  }
  const data = await res.json().catch(() => ({}));
  return handleResponse(res, data, !!token, logoutOn401);
}

// Upload de fichier (multipart) : pas de Content-Type manuel, le navigateur doit fixer lui-même la
// boundary du FormData — contrairement à api() ci-dessus qui envoie toujours du JSON. fieldName doit
// correspondre au nom attendu par multer côté backend (ex: upload.single('image') vs .single('file')).
// `fields` (optionnel) ajoute des champs texte au FormData (ex: module Documents, POST /admin/documents
// qui a besoin de targetType/targetId/title en plus du fichier) — undefined/absent pour tous les autres
// appelants existants, aucun changement de comportement pour eux.
export async function apiUpload(path, { file, token, fieldName = 'image', fields }) {
  const formData = new FormData();
  formData.append(fieldName, file);
  if (fields) Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') formData.append(k, v); });
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method: 'POST', headers, body: formData });
  } catch {
    throw new ApiError("Impossible de joindre le serveur Fairide. Réessaie dans un instant.", 0);
  }
  const data = await res.json().catch(() => ({}));
  return handleResponse(res, data, !!token, true);
}
