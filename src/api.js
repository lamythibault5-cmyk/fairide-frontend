export const API_BASE = import.meta.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Impossible de joindre le serveur Fairide. Réessaie dans un instant.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

// Upload de fichier (multipart) : pas de Content-Type manuel, le navigateur doit fixer lui-même la
// boundary du FormData — contrairement à api() ci-dessus qui envoie toujours du JSON.
export async function apiUpload(path, { file, token }) {
  const formData = new FormData();
  formData.append('image', file);
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method: 'POST', headers, body: formData });
  } catch {
    throw new Error("Impossible de joindre le serveur Fairide. Réessaie dans un instant.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}
