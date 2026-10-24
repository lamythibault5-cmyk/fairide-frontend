import { estNatif, ouvrirPdfBlob } from './natif';
import { getLanguage, traduire } from './context/LanguageContext';

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
// Session révoquée (mot de passe changé, « déconnecter tous mes appareils ») : son propre texte, pas « expirée » (audit du
// 19/10, auth-37). Le code vient de middleware/auth.js (SESSION_REVOKED).
function handleResponse(res, data, hadToken, logoutOn401) {
  if (res.ok) return data;
  if (res.status === 401 && hadToken && logoutOn401) {
    const error = new ApiError(data.code === 'ACCOUNT_DELETED' ? data.error : traduire(data.code === 'SESSION_REVOKED' ? 'auth.sessionRevoked' : 'auth.sessionExpired'), 401);
    error.code = data.code;
    // Le contexte reçoit la raison : compte supprimé (le dire) ou simple session périmée.
    if (onSessionExpired) onSessionExpired(data.code);
    throw error;
  }
  const error = new ApiError(data.error || traduire('common.genericError'), res.status);
  if (data.code) error.code = data.code;
  if (data.field) error.field = data.field;
  /* Le corps complet est attaché à l'erreur. Certaines routes répondent en erreur ET renvoient
     quelque chose d'exploitable — l'exemple d'origine était /floor-plan/analyze, qui rendait un 422
     avec le détail par photo ; elle a disparu, le besoin non. Sans ça, l'appelant devrait refaire
     son fetch à la main pour y accéder, ce qu'il faisait, et c'est pour ça qu'il échappait au
     traitement centralisé du 401. */
  error.data = data;
  throw error;
}

const DELAI_LECTURE_MS = 20000;
const DELAI_ECRITURE_MS = 45000;
// Envoi de fichiers (photos de plats, carte en PDF, pièces du dossier livreur) : quelques mégaoctets sur un réseau mobile
// lent peuvent légitimement prendre plus d'une minute. Le délai ne sert qu'à ne pas attendre une connexion morte.
const DELAI_ENVOI_FICHIER_MS = 180000;

// Échec de fetch : une lecture abandonnée (ou un réseau coupé) dit « serveur injoignable », comme avant ; une ÉCRITURE
// abandonnée par le délai dit qu'elle est peut-être passée, parce qu'on ne sait pas si le serveur l'a reçue.
function erreurReseau(controle, lecture) {
  if (!lecture && controle?.signal.aborted) {
    const e = new ApiError(traduire('common.writeTimeout'), 0);
    e.code = 'WRITE_TIMEOUT';
    return e;
  }
  return new ApiError(traduire('common.serverUnreachable'), 0);
}

// `withHeaders: true` renvoie { data, headers } au lieu du seul corps : les listes admin paginées
// annoncent leur total dans l'en-tête X-Total-Count tout en gardant un tableau en réponse (voir
// GET /admin/restaurants|drivers|clients côté serveur). Sans l'option, comportement inchangé.
export async function api(path, { method = 'GET', body, token, logoutOn401 = true, withHeaders = false, delai: delaiDemande } = {}) {
  // Langue de l'interface : le backend en fait la langue des e-mails déclenchés par cette requête
  // (code de vérification, bienvenue...) — voir userLang.js côté serveur.
  const headers = { 'Content-Type': 'application/json', 'X-Fairide-Lang': getLanguage() };
  // Requête de l'application native : le serveur fait alors revenir Stripe sur /retour-appli, qui rouvre l'app à coup sûr
  // (pages/app/RetourAppli.jsx). Le site n'envoie rien : ses retours de Stripe ne changent pas.
  if (estNatif()) headers['X-Fairide-Appli'] = '1';
  if (token) headers.Authorization = 'Bearer ' + token;
  /* UNE LECTURE ABANDONNE APRÈS 20 SECONDES (audit du 18/10/2026). Sans limite, un serveur qui ne répond pas laissait un
   * chargement tourner pour toujours. L'écran affiche alors « Impossible de charger ».
   * UNE ÉCRITURE APRÈS 45 SECONDES (audit du 24/10). Elle gardait son attente sans fin, pour qu'une commande lente mais
   * aboutie ne soit jamais annoncée comme ratée. Mais sur un réseau mobile instable, une connexion bloquée laisse fetch
   * pendu plusieurs minutes : « Commander et payer » restait sur « ... », sans rien d'autre à faire que recharger. 45 s, plus du
   * double du délai des lectures, laisse sa chance à une écriture lente ; et le message ne dit pas « échec » : il dit que la
   * demande est peut-être passée et qu'il faut vérifier (common.writeTimeout). Un appel qu'on sait long (import d'une carte,
   * automatisation lancée à la main) passe `delai` en millisecondes. Recommander est sans risque : la commande porte
   * `clientRequestId` (CartContext), et le serveur rend la même commande tant qu'elle n'est pas payée, puis refuse une
   * seconde fois si elle l'est (ORDER_ALREADY_PLACED, commandeExistante dans routes/orders.js du backend). */
  const lecture = method === 'GET';
  const delai = delaiDemande || (lecture ? DELAI_LECTURE_MS : DELAI_ECRITURE_MS);
  const controle = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const minuteur = controle ? setTimeout(() => controle.abort(), delai) : null;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controle?.signal });
  } catch {
    throw erreurReseau(controle, lecture);
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
  const data = await res.json().catch(() => ({}));
  const corps = handleResponse(res, data, !!token, logoutOn401);
  return withHeaders ? { data: corps, headers: res.headers } : corps;
}

// Total annoncé par une liste paginée (X-Total-Count) ; repli sur la longueur du tableau reçu quand
// l'en-tête manque (ancien serveur, réponse non paginée) pour ne jamais afficher « 0 résultat » à tort.
export function totalDepuisEntetes(headers, data) {
  const n = Number(headers?.get?.('X-Total-Count'));
  return Number.isFinite(n) && n >= 0 ? n : (Array.isArray(data) ? data.length : 0);
}

// Téléchargement d'un fichier servi par une route authentifiée (PDF de facture...). Un simple lien
// <a href> ne convient pas : le navigateur n'y joint pas l'en-tête Authorization, et la requête
// repartirait donc en 401. On récupère donc le binaire par fetch, puis on déclenche l'enregistrement
// depuis un blob local. L'URL d'objet est révoquée juste après, sinon le blob resterait en mémoire
// pour toute la durée de vie de l'onglet.
/* `method`, `body` et `rendreBlob` ont été ajoutés pour que cette fonction couvre TOUS les appels qui
 * récupèrent autre chose que du JSON. Cinq endroits appelaient `fetch` directement — analyse d'un
 * plan de salle, export d'agenda, deux aides au téléchargement côté admin, téléchargement de
 * factures — et chacun redéveloppait sa gestion d'erreur. Aucun ne passait par le traitement
 * centralisé du 401, donc une session expirée y produisait « Téléchargement impossible » au lieu de
 * renvoyer vers la connexion : l'utilisateur recliquait, sans comprendre, jusqu'à abandonner.
 *
 * `rendreBlob: true` rend le blob à l'appelant au lieu de déclencher l'enregistrement — c'est ce dont
 * a besoin l'analyse de plan de salle, qui exploite la réponse au lieu de la donner à l'utilisateur. */
export async function apiDownload(path, { token, filename, method = 'GET', body, rendreBlob = false } = {}) {
  let res;
  try {
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    // FormData : pas de Content-Type manuel, le navigateur doit poser lui-même sa frontière
    // (même raison que dans apiUpload plus bas).
    const estFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !estFormData) headers['Content-Type'] = 'application/json';
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? (estFormData ? body : JSON.stringify(body)) : undefined
    });
  } catch {
    throw new Error(traduire('common.serverUnreachable'));
  }
  if (!res.ok) {
    // Les erreurs de ces routes restent en JSON même quand le succès est un PDF.
    const data = await res.json().catch(() => ({}));
    /* Session expirée : même traitement que dans api(). Sans cela, un téléchargement lancé après
       l'expiration affichait une erreur générique et laissait l'utilisateur sur une page dont plus
       rien ne fonctionnait, sans jamais le renvoyer vers /login. */
    if (res.status === 401 && token) {
      const error = new ApiError(data.code === 'ACCOUNT_DELETED' ? data.error : traduire(data.code === 'SESSION_REVOKED' ? 'auth.sessionRevoked' : 'auth.sessionExpired'), 401);
      error.code = data.code;
      if (onSessionExpired) onSessionExpired(data.code);
      throw error;
    }
    // Repli traduit (audit du 19/10, CROSS-45) : le texte était écrit en dur en français.
    throw new ApiError(data.error || traduire('common.downloadError'), res.status);
  }
  const blob = await res.blob();
  if (rendreBlob) return blob;
  // Application native : un <a download> ne fait rien dans la WebView (iPhone). Le fichier part dans la feuille de partage
  // du téléphone (Enregistrer dans Fichiers, Envoyer…), comme les PDF (natif.js) — relevés, ZIP de factures, export JSON.
  if (estNatif()) { await ouvrirPdfBlob(blob, filename); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Upload de fichier (multipart) : pas de Content-Type manuel, le navigateur doit fixer lui-même la
// boundary du FormData — contrairement à api() ci-dessus qui envoie toujours du JSON. fieldName doit
// correspondre au nom attendu par multer côté backend (ex: upload.single('image') vs .single('file')).
// `fields` (optionnel) ajoute des champs texte au FormData (ex: module Documents, POST /admin/documents
// qui a besoin de targetType/targetId/title en plus du fichier) — undefined/absent pour tous les autres
// appelants existants, aucun changement de comportement pour eux.
export async function apiUpload(path, { file, files, token, fieldName = 'image', fields }) {
  const formData = new FormData();
  // Un fichier (`file`) ou plusieurs (`files`, même nom de champ répété).
  if (files && files.length) files.forEach((f) => formData.append(fieldName, f));
  else if (file) formData.append(fieldName, file);
  if (fields) Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') formData.append(k, v); });
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  // Même garde que les écritures d'api(), avec un délai à la mesure d'un fichier (DELAI_ENVOI_FICHIER_MS).
  const controle = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const minuteur = controle ? setTimeout(() => controle.abort(), DELAI_ENVOI_FICHIER_MS) : null;
  let res;
  try {
    res = await fetch(API_BASE + path, { method: 'POST', headers, body: formData, signal: controle?.signal });
  } catch {
    throw erreurReseau(controle, false);
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
  const data = await res.json().catch(() => ({}));
  return handleResponse(res, data, !!token, true);
}
