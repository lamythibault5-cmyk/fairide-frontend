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
//   - notifications push natives (APNs / FCM) à la place du Web Push, voir pushNatif.js.

import { Capacitor } from '@capacitor/core';

export function estNatif() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
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
const RACINES = new Set(['/', '/restaurants', '/dashboard', '/driver', '/admin', '/orders', '/login']);
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

// L'écran de lancement natif couvre le démarrage de la WebView ; main.jsx le retire au même moment que
// le #splash HTML, quand la page est réellement rendue.
export async function retirerEcranLancementNatif() {
  if (!estNatif()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch { /* greffon absent ou déjà masqué */ }
}
