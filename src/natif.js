// Pont vers l'application native (Capacitor) — App Store et Play Store.
//
// LE MÊME CODE PARTOUT. Le site n'est pas dupliqué pour les magasins d'applications : c'est exactement
// ce `dist/` qui est emballé dans une coque iOS et Android par Capacitor (capacitor.config.json). Tout
// ce qui diffère entre « page dans Safari » et « application installée » passe par ce fichier, et nulle
// part ailleurs : on teste `estNatif()` ici, pas dans les composants.
//
// SANS LA COQUE, RIEN NE CHANGE. `Capacitor.isNativePlatform()` renvoie false dans un navigateur et
// chaque fonction retombe sur le comportement web d'avant (window.open, location.href, navigator.vibrate).
// Les greffons natifs sont chargés à la demande (`import()`), donc leur code n'alourdit pas le site.
//
// CE QUI EST PRIS EN CHARGE
//   - bouton Retour d'Android (sinon il ferme l'application au premier appui) ;
//   - liens externes et paiement Stripe dans un navigateur intégré (SFSafariViewController / Custom Tab)
//     plutôt que dans la WebView, qui n'a ni barre d'adresse ni cadenas — Stripe et Google l'exigent ;
//   - retour dans l'application après Stripe : lien universel https://fairide.be/… (appUrlOpen) quand il
//     est configuré (docs/application-mobile.md), sinon fermeture du navigateur → on va à la page de retour ;
//   - barre d'état iris, écran de lancement natif retiré quand la page est vraiment rendue ;
//   - clavier : classe `clavier-ouvert` sur <html> pour escamoter les barres fixes du bas ;
//   - vibrations par le moteur haptique natif (gestes.js) ;
//   - notifications push natives (APNs / FCM) à la place du Web Push, voir pushNatif.js ;
//   - position de l'appareil (demanderPosition) et connexion Apple / Google native (connexionFournisseur),
//     pour l'accueil de l'application (pages/app/Bienvenue.jsx) et la page de connexion.

import { Capacitor } from '@capacitor/core';

export function estNatif() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// L'EXPÉRIENCE « APPLICATION » : la vraie application (Capacitor) OU le site ajouté à l'écran d'accueil, qui s'ouvre en plein
// écran comme une app (fondateur, 2026-10-15 : sur iPhone, avant TestFlight, c'est l'application). Pour CE QU'ON MONTRE
// seulement : accueil de l'app au premier lancement, pas de page vitrine, feuilles et gestes. Les fonctions natives
// (connexion Apple/Google native, vibrations, push APNs/FCM) restent derrière estNatif().
export function ecranAccueil() {
  try { return window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator.standalone === true; } catch { return false; }
}
export function experienceApp() {
  return estNatif() || ecranAccueil();
}

// 'web' | 'ios' | 'android'
export function plateforme() {
  try { return Capacitor.getPlatform(); } catch { return 'web'; }
}

// Adresse publique du site : les liens universels et les retours de paiement y pointent.
const ORIGINE_SITE = 'https://fairide.be';
const CLE_RETOUR = 'fairide_retour_navigateur';

// Lien vers un autre site (document signé Cloudinary, PDF, aide externe).
export async function ouvrirLienExterne(url) {
  if (!url) return;
  if (!estNatif()) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'popover' });
}

// Page de paiement Stripe (commande, pourboire, abonnement). `retour` : où aller dans l'application quand
// le navigateur intégré se ferme sans que le lien universel ait pris le relais (paiement abandonné, ou
// association de domaine pas encore vérifiée par le téléphone).
export async function allerAuPaiement(url, { retour = '/orders' } = {}) {
  if (!estNatif()) { window.location.href = url; return; }
  try { sessionStorage.setItem(CLE_RETOUR, retour); } catch { /* stockage indisponible */ }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'fullscreen' });
}

// PDF reçu en mémoire (contrat, relevé : l'adresse exige un en-tête Authorization, on ne peut pas l'ouvrir
// directement). Web : nouvel onglet. Application : fichier écrit dans le cache puis feuille de partage du
// système, qui propose « Ouvrir », « Enregistrer dans Fichiers », l'envoi par e-mail…
export async function ouvrirPdfBlob(blob, nom = 'fairide.pdf') {
  if (!estNatif()) { window.open(URL.createObjectURL(blob), '_blank', 'noopener'); return; }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const base64 = await new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => reject(new Error('Lecture du document impossible.'));
    lecteur.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: nom, data: base64, directory: Directory.Cache });
  await Share.share({ title: nom, url: uri });
}

// Enregistrer un PDF (fondateur, 2026-10-08) : sur le web, un téléchargement nommé ; dans l'application, le fichier est écrit
// dans les documents puis proposé au partage/enregistrement du téléphone.
export async function telechargerPdfBlob(blob, nom = 'fairide.pdf') {
  if (!estNatif()) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const base64 = await new Promise((resolve, reject) => { const l = new FileReader(); l.onload = () => resolve(String(l.result).split(',')[1] || ''); l.onerror = () => reject(new Error('Lecture du document impossible.')); l.readAsDataURL(blob); });
  const { uri } = await Filesystem.writeFile({ path: nom, data: base64, directory: Directory.Documents });
  await Share.share({ title: nom, url: uri });
}

// Vibration haptique native. `motif` suit la convention de navigator.vibrate : un nombre (ms) ou un tableau.
export async function vibrerNatif(motif) {
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  if (Array.isArray(motif)) { await Haptics.notification({ type: NotificationType.Success }); return; }
  await Haptics.impact({ style: Number(motif) > 20 ? ImpactStyle.Medium : ImpactStyle.Light });
}

// Les routes d'entrée : un Retour Android depuis l'une d'elles réduit l'application (comme l'accueil du
// téléphone) au lieu de remonter un historique qui n'existe plus.
const RACINES = new Set(['/', '/bienvenue', '/restaurants', '/dashboard', '/driver', '/admin', '/orders', '/login']);
function cheminSansLangue(pathname) {
  return pathname.replace(/^\/(nl|en)(?=\/|$)/, '') || '/';
}

// À appeler une fois au démarrage (main.jsx), avec l'historique du routeur.
// Ne lève jamais : un greffon absent de la coque ne doit pas empêcher l'application de s'afficher.
export async function demarrerNatif(historique) {
  if (!estNatif()) return;
  const html = document.documentElement;
  html.classList.add('natif', `natif-${plateforme()}`);

  try {
    const { App } = await import('@capacitor/app');

    App.addListener('backButton', () => {
      const chemin = cheminSansLangue(window.location.pathname);
      // Fenêtre, fiche ou tiroir ouvert : le refermer d'abord (Échap), comme le ferait un geste de retour.
      // La bannière cookies est un dialogue sans aria-modal : elle n'est pas concernée.
      const dialogues = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      const dialogue = dialogues[dialogues.length - 1];
      if (dialogue) {
        // Dans l'ordre : son bouton de fermeture, sinon le fond cliquable qui l'entoure, sinon Échap.
        const bouton = dialogue.querySelector('.flux-bouton[aria-label], .tracking-fullscreen-close, .modal-close, [data-fermer]');
        const fond = dialogue.closest('.modal-overlay');
        if (bouton) bouton.click();
        else if (fond) fond.click();
        else dialogue.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      // Écran à étapes sans adresse propre (accueil de l'application, pages/app/Bienvenue.jsx) : son bouton
      // Retour recule d'une étape — sans lui, le Retour d'Android quittait l'accueil en plein milieu.
      const retourEtape = document.querySelector('[data-retour-natif]');
      if (retourEtape) { retourEtape.click(); return; }
      if (RACINES.has(chemin) || window.history.length <= 1) { App.minimizeApp().catch(() => {}); return; }
      historique.back();
    });

    // Lien universel (https://fairide.be/order-success?order=…) ou schéma de l'application : on navigue
    // à l'intérieur de la page déjà chargée, sans recharger la WebView.
    App.addListener('appUrlOpen', async ({ url }) => {
      try {
        const u = new URL(url);
        const interne = u.origin === ORIGINE_SITE || u.protocol === 'fairide:';
        if (!interne) return;
        try { sessionStorage.removeItem(CLE_RETOUR); } catch { /* rien */ }
        try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* pas ouvert */ }
        historique.push(`${u.pathname}${u.search}${u.hash}`);
      } catch { /* adresse illisible */ }
    });

    // Retour au premier plan : les listes (commandes, livraisons) se rafraîchissent comme à un changement
    // d'onglet — c'est l'événement que les sondages écoutent déjà.
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      }
    });
  } catch { /* greffon App absent */ }

  try {
    const { Browser } = await import('@capacitor/browser');
    // Le navigateur intégré s'est fermé sans lien universel : on rejoint la page de retour mémorisée.
    Browser.addListener('browserFinished', () => {
      let retour = null;
      try { retour = sessionStorage.getItem(CLE_RETOUR); sessionStorage.removeItem(CLE_RETOUR); } catch { /* rien */ }
      if (retour) historique.push(retour);
    });
  } catch { /* greffon Browser absent */ }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Fond iris, texte clair — la couleur de `theme-color` et de l'écran de lancement.
    await StatusBar.setStyle({ style: Style.Dark });
    if (plateforme() === 'android') await StatusBar.setBackgroundColor({ color: '#3B2FB5' });
  } catch { /* greffon StatusBar absent */ }

  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => html.classList.add('clavier-ouvert'));
    Keyboard.addListener('keyboardWillHide', () => html.classList.remove('clavier-ouvert'));
  } catch { /* greffon Keyboard absent */ }
}

/* Position de l'appareil, pour l'accueil de l'application (« Trouvez les commerces près de chez vous »,
 * pages/app/Bienvenue.jsx). Rend { lat, lng } ou null — jamais d'erreur : un refus ou un GPS muet mène au code
 * postal, pas à un blocage.
 *
 * Dans la coque, par le greffon Geolocation plutôt que navigator.geolocation : sur iPhone, la WebView poserait
 * SA question (« localhost souhaite utiliser votre position ») en plus de celle du système, deux fenêtres pour
 * une seule demande. L'écran d'amorçage explique AVANT d'appeler ceci : un refus est définitif sur iOS. */
export async function demanderPosition() {
  const options = { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 };
  if (estNatif()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      let droit = await Geolocation.checkPermissions();
      if (droit.location === 'prompt' || droit.location === 'prompt-with-rationale') droit = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
      if (droit.location !== 'granted' && droit.coarseLocation !== 'granted') return null;
      const p = await Geolocation.getCurrentPosition(options);
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    } catch { return null; }
  }
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), options);
  });
}

/* État de l'autorisation de position, SANS rien demander : 'granted' | 'denied' | 'prompt'. Sert à l'écran qui bloque les
 * courses d'un livreur tant qu'elle manque (components/livreur/PositionRequise.jsx). 'denied' veut dire que le système ne
 * reposera plus la question : seule la personne peut la rouvrir dans ses réglages. Un navigateur sans l'API Permissions
 * répond 'prompt' — la demande réelle (demanderPosition) tranchera. */
export async function etatPosition() {
  if (estNatif()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const d = await Geolocation.checkPermissions();
      if (d.location === 'granted' || d.coarseLocation === 'granted') return 'granted';
      return d.location === 'denied' ? 'denied' : 'prompt';
    } catch { return 'prompt'; }
  }
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state || 'prompt';
  } catch { return 'prompt'; }
}

/* Connexion Apple / Google DANS L'APPLICATION (feuille native du système).
 *
 * POURQUOI PAS LE BOUTON GOOGLE DU SITE. Google refuse sa connexion dans une WebView (« disallowed_useragent ») :
 * le bouton de googleSignIn.js, qui marche sur fairide.be, échoue dans l'application. Le greffon passe par le
 * compte Google du téléphone (Android) ou la feuille Google/Apple d'iOS et rend le même jeton d'identité que le
 * site — POST /auth/google le vérifie exactement pareil, à condition que webClientId soit l'identifiant web
 * (VITE_GOOGLE_CLIENT_ID, celui que le serveur attend comme destinataire).
 *
 * APPLE SUR IPHONE SEULEMENT. La règle 4.8 de l'App Store l'impose dès que Google est proposé (décision du
 * fondateur, 2026-10-11) ; Android garde Google et l'e-mail. Jeton vérifié par POST /auth/apple (backend apple.js).
 *
 * Rend { fournisseur, jeton, prenom, nom } ; lève une Error lisible si la personne annule ou si le greffon manque.
 * Apple ne donne prénom et nom qu'à la toute première autorisation : vides ensuite, le formulaire les redemande. */
let connexionPrete = null;
async function preparerConnexion() {
  if (!connexionPrete) {
    connexionPrete = (async () => {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const webClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      await SocialLogin.initialize({
        google: { webClientId, iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || undefined, iOSServerClientId: webClientId, mode: 'online' },
        ...(plateforme() === 'ios' ? { apple: {} } : {})
      });
      return SocialLogin;
    })().catch((e) => { connexionPrete = null; throw e; });
  }
  return connexionPrete;
}

export function appleDisponible() { return estNatif() && plateforme() === 'ios'; }

export async function connexionFournisseur(fournisseur) {
  const SocialLogin = await preparerConnexion();
  const { result } = await SocialLogin.login({
    provider: fournisseur,
    options: fournisseur === 'apple' ? { scopes: ['email', 'name'] } : { scopes: ['email', 'profile'] }
  });
  const jeton = result?.idToken;
  if (!jeton) throw new Error('Connexion annulée.');
  const profil = result.profile || {};
  return { fournisseur, jeton, prenom: profil.givenName || '', nom: profil.familyName || '' };
}

// L'écran de lancement natif couvre le démarrage de la WebView ; main.jsx le retire au même moment que
// le #splash HTML, quand la page est réellement rendue.
export async function retirerEcranLancementNatif() {
  if (!estNatif()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch { /* greffon absent ou déjà masqué */ }
}
