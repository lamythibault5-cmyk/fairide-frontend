// CONNEXION GOOGLE SUR ANDROID SANS LA SECONDE ÉTAPE (2026-10-21, latence de l'app) — lancé par `npm install` / `npm ci`
// (postinstall), donc aussi par GitHub Actions avant `npx cap sync android` et le build de l'app.
//
// Le greffon @capgo/capacitor-social-login, en mode « online », fait DEUX étapes après le choix du compte : il obtient le
// jeton d'identité (ce que Fairide envoie à POST /auth/google), puis appelle encore authorize() de Google pour un jeton
// d'ACCÈS — un aller-retour de plus (0,3 à 1 s) et parfois un second écran de consentement. Fairide n'utilise pas ce jeton.
// Ce script ajoute au greffon une option `idTokenOnly` (passée par natif.js, connexionFournisseur) : avec elle, il rend le
// jeton d'identité et le profil tout de suite. Sans l'option, rien ne change.
//
// Le fichier Java est corrigé sur place, dans node_modules. Si le greffon change (mise à jour) et que le repère n'est plus
// trouvé, le script prévient et ne fait rien : la connexion marche alors comme avant (l'option est simplement ignorée),
// en plus lent. Il ne fait jamais échouer l'installation.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FICHIER = fileURLToPath(new URL('../node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/GoogleProvider.java', import.meta.url));
const MARQUE = '// FAIRIDE idTokenOnly';
const REPERE = '                    ListenableFuture<AuthorizationResult> future = getAuthorizationResult(forceRefreshToken);';
const AJOUT = `                    ${MARQUE} (scripts/corriger-connexion-google.mjs) : le jeton d'identité seul, sans authorize().
                    boolean idTokenOnly = false;
                    try {
                        idTokenOnly = options != null && options.has("idTokenOnly") && options.getBoolean("idTokenOnly");
                    } catch (JSONException e) {
                        Log.e(LOG_TAG, "Error parsing idTokenOnly option", e);
                    }
                    if (idTokenOnly && GoogleProvider.this.mode == GoogleProviderLoginType.ONLINE) {
                        resultObj.put("profile", user);
                        resultObj.put("idToken", googleIdTokenCredential.getIdToken());
                        resultObj.put("responseType", "online");
                        response.put("result", resultObj);
                        call.resolve(response);
                        return;
                    }
`;

try {
  if (!existsSync(FICHIER)) {
    console.warn(`[corriger-connexion-google] greffon introuvable, rien à faire (${FICHIER}).`);
  } else {
    const brut = readFileSync(FICHIER, 'utf8');
    const crlf = brut.includes('\r\n');
    const texte = brut.replace(/\r\n/g, '\n');
    if (texte.includes(MARQUE)) {
      console.log('[corriger-connexion-google] déjà corrigé.');
    } else if (!texte.includes(REPERE)) {
      console.warn('[corriger-connexion-google] repère introuvable (greffon mis à jour ?) : Google garde sa seconde étape, la connexion marche mais plus lentement. Revoir ce script.');
    } else {
      const corrige = texte.replace(REPERE, `${AJOUT}${REPERE}`);
      writeFileSync(FICHIER, crlf ? corrige.replace(/\n/g, '\r\n') : corrige);
      console.log('[corriger-connexion-google] option idTokenOnly ajoutée au greffon Google.');
    }
  }
} catch (e) {
  console.warn(`[corriger-connexion-google] non appliqué : ${e.message}`);
}
