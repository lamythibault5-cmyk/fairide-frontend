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
//   - retour dans l'application après Stripe : lien universel https://fairride.be/… (appUrlOpen) quand il
//     est configuré (docs/application-mobile.md), sinon fermeture du navigateur → on va à la page de retour ;
//   - barre d'état iris, écran de lancement natif retiré quand la page est vraiment rendue ;
//   - clavier : classe `clavier-ouvert` sur <html> pour escamoter les barres fixes du bas ;
//   - vibrations par le moteur haptique natif (gestes.js) ;
//   - notifications push natives (APNs / FCM) à la place du Web Push, voir pushNatif.js ;
//   - position de l'appareil (demanderPosition) et connexion Apple / Google native (connexionFournisseur),
//     pour l'accueil de l'application (pages/app/Bienvenue.jsx) et la page de connexion.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { traduire } from './context/LanguageContext';

export function estNatif() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// Ce qu'un COMMERCE achète à Fairide (abonnement, portail de facturation Stripe, mise en avant payante) ne s'achète pas
// dans l'application des magasins (fondateur, 2026-10-17, confirmé le 2026-10-20). Les règles de Google Play (« Payments »)
// imposent la facturation Google Play pour un abonnement ou un service numérique vendu dans l'app, et interdisent d'y
// renvoyer vers un autre moyen de paiement ; Apple dit la même chose (App Store 3.1.1). Les commandes des clients (repas,
// livraison) sont des biens et services physiques : elles restent payables dans l'app. Dans l'app, ces achats n'ont donc
// ni bouton, ni prix à payer, ni phrase qui envoie ailleurs ; le site, lui, ne change pas. L'écran d'accueil (PWA) n'est
// pas un magasin d'applications : il garde le comportement du site.
export function achatsCommerceAutorises() {
  return !estNatif();
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
const ORIGINE_SITE = 'https://fairride.be';
// Ses adresses reconnues comme « chez nous » : la nouvelle et l'ancienne (fairide.be, une seule r, jusqu'au 2026-10-25), qui
// redirige vers la nouvelle — un lien d'un ancien e-mail ou d'un QR code imprimé doit encore s'ouvrir dans l'app.
const ORIGINES_SITE = new Set([ORIGINE_SITE, 'https://www.fairride.be', 'https://fairide.be', 'https://www.fairide.be']);
const CLE_RETOUR = 'fairide_retour_navigateur';

// Lien à partager vers une page de Fairide (audit du 19/10, CROSS-02 et CROSS-03). Dans l'application, l'origine de la page
// est https://localhost (Android) ou capacitor://localhost (iPhone) : l'invitation à une commande groupée et « Partager
// Fairide » envoyaient un lien qui ne menait nulle part. Sur le site, l'adresse du site lui-même (préproduction comprise).
export function lienPublic(chemin = '') {
  return `${estNatif() ? ORIGINE_SITE : window.location.origin}${chemin}`;
}

// Lien vers un autre site (document signé Cloudinary, PDF, aide externe).
export async function ouvrirLienExterne(url) {
  if (!url) return;
  if (!estNatif()) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'popover' });
}

/* LES LIENS « NOUVEL ONGLET » RESTENT DANS L'APPLICATION (2026-10-15).
 *
 * Dans l'app il n'y a pas d'onglets : un lien target="_blank" ouvrait le navigateur du téléphone — et, quand il menait à
 * une page de Fairide, c'était le SITE qui s'ouvrait au milieu de l'app. Un seul écouteur, pour tous les liens :
 *   - une page de Fairide → la même page DANS l'app (le routeur, sans recharger) ;
 *   - un autre site (document Cloudinary, site d'un commerce, sites publics) → le navigateur intégré (appli native) ;
 *   - cartes et itinéraires (Google Maps, Waze, Apple Plans), tel:, mailto: → inchangés : le téléphone ouvre la bonne app.
 * Un fichier servi par le site (un .pdf, un .png) n'est pas une page : il suit la règle des autres sites. */
export function garderLesLiensDansLApp(historique) {
  if (!experienceApp()) return;
  // Marque l'app (native OU écran d'accueil) pour la CSS : html.natif ne couvre que la coque native.
  document.documentElement.classList.add('appli');
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target?.closest?.('a[href]');
    if (!a || a.target !== '_blank') return;
    let url;
    try { url = new URL(a.getAttribute('href'), window.location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    if (/(^|\.)(waze\.com|maps\.apple\.com)$/.test(url.hostname) || (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith('/maps'))) return;
    const pageInterne = (url.origin === window.location.origin || ORIGINES_SITE.has(url.origin)) && !/\.[a-z0-9]{2,5}$/i.test(url.pathname);
    if (pageInterne) { e.preventDefault(); historique.push(`${url.pathname}${url.search}${url.hash}`); return; }
    if (estNatif()) { e.preventDefault(); ouvrirLienExterne(url.href); }
  }, true);
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
    lecteur.onerror = () => reject(new Error(traduire('common.docReadFailed'))); // dans la langue choisie (audit du 19/10, CROSS-13)
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
  const base64 = await new Promise((resolve, reject) => { const l = new FileReader(); l.onload = () => resolve(String(l.result).split(',')[1] || ''); l.onerror = () => reject(new Error(traduire('common.docReadFailed'))); l.readAsDataURL(blob); });
  const { uri } = await Filesystem.writeFile({ path: nom, data: base64, directory: Directory.Documents });
  await Share.share({ title: nom, url: uri });
}

/* VIBRATION NATIVE (2026-10-23, test TestFlight : « je ne sens pas les vibrations »). `sens` : l'un des sens de gestes.js
 * ('touche', 'choix', 'bascule', 'valider', 'seuil', 'pose', 'appuiLong', 'succes', 'attention', 'erreur', 'alerte').
 *   - Le greffon Haptique de l'app (ios/App/App/HaptiquePlugin.swift, android/…/HaptiquePlugin.java) joue la sensation du
 *     téléphone pour ce sens, avec des générateurs gardés et préparés quand un doigt touche l'écran (preparerHaptique).
 *   - Sans lui (une version de l'app construite avant lui), @capacitor/haptics prend le relais, avec des tapes moyennes au
 *     lieu de la plus légère : c'était elle partout, et elle ne se sentait pas.
 *   - 'alerte' reste une vraie vibration de 0,4 s (@capacitor/haptics), à sentir dans une poche.
 * Chargé au démarrage (demarrerNatif) et jamais attendu : la vibration part au toucher, l'action n'attend rien. */
let haptique = null; // { jouer(sens), preparer() }
let haptiquePrete = null;
function chargerHaptique() {
  if (!haptiquePrete) {
    haptiquePrete = (async () => {
      const capacitor = await import('@capacitor/haptics');
      const { Haptics, ImpactStyle, NotificationType } = capacitor;
      const alerte = () => Haptics.vibrate({ duration: 400 });
      if (Capacitor.isPluginAvailable('Haptique')) {
        const Haptique = registerPlugin('Haptique');
        return { jouer: (sens) => (sens === 'alerte' ? alerte() : Haptique.jouer({ sens })), preparer: () => Haptique.preparer() };
      }
      let selectionOuverte = false;
      const repli = {
        choix: async () => {
          // Le « cran » d'une molette. Sans selectionStart, iOS comme Android ignorent selectionChanged : on l'ouvre une fois.
          if (!selectionOuverte) { await Haptics.selectionStart(); selectionOuverte = true; }
          await Haptics.selectionChanged();
        },
        touche: () => Haptics.impact({ style: ImpactStyle.Light }),
        bascule: () => Haptics.impact({ style: ImpactStyle.Medium }),
        valider: () => Haptics.impact({ style: ImpactStyle.Medium }),
        seuil: () => Haptics.impact({ style: ImpactStyle.Heavy }),
        pose: () => Haptics.impact({ style: ImpactStyle.Light }),
        appuiLong: () => Haptics.impact({ style: ImpactStyle.Heavy }),
        succes: () => Haptics.notification({ type: NotificationType.Success }),
        attention: () => Haptics.notification({ type: NotificationType.Warning }),
        erreur: () => Haptics.notification({ type: NotificationType.Error }),
        alerte
      };
      return { jouer: (sens) => (repli[sens] || repli.valider)(), preparer: () => {} };
    })().then((h) => { haptique = h; return h; }, (e) => { haptiquePrete = null; throw e; });
  }
  return haptiquePrete;
}
export function vibrerNatif(sens) {
  const jouer = (h) => { try { Promise.resolve(h.jouer(sens)).catch(() => {}); } catch { /* greffon absent */ } };
  if (haptique) jouer(haptique);
  else chargerHaptique().then(jouer).catch(() => {});
}
// Un doigt se pose : les générateurs de l'iPhone se préparent, la vibration qui suivra part sans le délai de réveil du
// moteur. Au plus toutes les 400 ms (un geste envoie plusieurs pointerdown), et seulement pendant qu'on touche l'écran.
function preparerHaptique() {
  let dernier = 0;
  document.addEventListener('pointerdown', () => {
    const t = Date.now();
    if (!haptique || t - dernier < 400) return;
    dernier = t;
    try { Promise.resolve(haptique.preparer()).catch(() => {}); } catch { /* rien */ }
  }, { capture: true, passive: true });
}

// Les routes d'entrée : un Retour Android depuis l'une d'elles réduit l'application (comme l'accueil du
// téléphone) au lieu de remonter un historique qui n'existe plus.
// /dashboard/orders : la page de service d'un membre d'équipe, qui n'a qu'elle et son compte (DashboardSidebar.jsx ; audit du
// 19/10, CROSS-06). /account n'en est pas une : on y arrive aussi depuis le paiement, où Retour doit y ramener.
const RACINES = new Set(['/', '/bienvenue', '/restaurants', '/dashboard', '/driver', '/admin', '/orders', '/login', '/dashboard/orders']);
// Les autres onglets de la barre du bas : le Retour y ramène à l'onglet d'accueil du rôle, puis réduit l'application. Avant,
// il remontait tous les onglets visités un par un (audit du 19/10, CROSS-20).
const ONGLETS = {
  '/map': '/restaurants', '/recherche': '/restaurants',
  '/dashboard/menu': '/dashboard',
  '/driver/map': '/driver', '/driver/earnings': '/driver', '/driver/onboarding': '/driver'
};
function cheminSansLangue(pathname) {
  return pathname.replace(/^\/(nl|en)(?=\/|$)/, '') || '/';
}

// À appeler une fois au démarrage (main.jsx), avec l'historique du routeur.
// Ne lève jamais : un greffon absent de la coque ne doit pas empêcher l'application de s'afficher.
export async function demarrerNatif(historique) {
  if (!estNatif()) return;
  const html = document.documentElement;
  html.classList.add('natif', `natif-${plateforme()}`);
  // Les vibrations sont prêtes avant le premier toucher (voir vibrerNatif).
  chargerHaptique().catch(() => {});
  preparerHaptique();
  // La tape légère sous chaque bouton (gestes.js, 2026-10-25).
  import('./gestes').then(({ installerTouches }) => installerTouches()).catch(() => {});
  // iPhone : le verre iris sous l'heure et la batterie quand la page défile (verreBarreEtat.js, verre.css).
  if (plateforme() === 'ios') import('./verreBarreEtat').then(({ installerVerreBarreEtat }) => installerVerreBarreEtat()).catch(() => {});
  // Les écrans glissent, la photo d'un commerce voyage, la croix et ‹ reculent, le bas de page rebondit (transitionPhoto.js,
  // maquettes/transitions-appli, 2026-10-23).
  import('./transitionPhoto').then(({ installerTransitionsEcrans }) => installerTransitionsEcrans(historique)).catch(() => {});
  // Le verre qui répond au doigt : il grossit à la pose, une lumière le suit, il rebondit au lâcher (verreAppui.js, version B de
  // maquettes/verre-appui, 2026-10-24).
  import('./verreAppui').then(({ installerVerreAppui }) => installerVerreAppui()).catch(() => {});

  try {
    const { App } = await import('@capacitor/app');

    App.addListener('backButton', () => {
      const chemin = cheminSansLangue(window.location.pathname);
      // Fenêtre, fiche ou tiroir ouvert : le refermer d'abord (Échap), comme le ferait un geste de retour.
      // La bannière cookies est un dialogue sans aria-modal : elle n'est pas concernée.
      const dialogues = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      // L'amorce des notifications (.bv-par-dessus) passe AU-DESSUS du dossier livreur, rendu pourtant après elle dans la page.
      const dialogue = document.querySelector('.bv-par-dessus[role="dialog"][aria-modal="true"]') || dialogues[dialogues.length - 1];
      if (dialogue) {
        // Dans l'ordre : son bouton de fermeture, sinon son bouton Retour (‹), sinon le fond cliquable qui l'entoure, sinon Échap.
        // Le ‹ des écrans pleins (EcranPlein.jsx : dossier livreur, « Envoyer ma carte ») recule d'une étape, ou ferme à la
        // première, comme à l'écran. Sans lui, le Retour d'Android y envoyait Échap, que personne n'écoute : rien ne se passait
        // (audit du 19/10, CROSS-05).
        const bouton = dialogue.querySelector('.flux-bouton[aria-label], .tracking-fullscreen-close, .modal-close, [data-fermer]')
          || dialogue.querySelector('[data-retour-natif]');
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
      if (ONGLETS[chemin]) { historique.replace(ONGLETS[chemin]); return; }
      // Un geste de la personne : l'écran recule en glissant, comme sur iPhone (transitionPhoto.js).
      historique.back({ geste: true });
    });

    // Lien universel (https://fairride.be/order-success?order=…) ou schéma de l'application : on navigue
    // à l'intérieur de la page déjà chargée, sans recharger la WebView.
    App.addListener('appUrlOpen', async ({ url }) => {
      try {
        const u = new URL(url);
        const interne = ORIGINES_SITE.has(u.origin) || u.protocol === 'fairide:';
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
    // Puis elle suit l'écran : iris sous un bandeau, blanche quand il s'est replié (barreEtat.js).
    const { suivreBarreEtat } = await import('./barreEtat');
    suivreBarreEtat({ StatusBar, Style, android: plateforme() === 'android' });
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

/* Position PRÉCISE ET FRAÎCHE, pour l'alerte d'urgence du livreur (components/livreur/BoutonUrgence.jsx) : haute
 * précision, 30 s de cache au plus, 8 s pour répondre — l'équipe doit pouvoir le retrouver, pas seulement sa commune.
 * Rend { lat, lng, precision } ou null, jamais d'erreur : l'alerte part quand même, sans position. */
export async function positionPrecise() {
  const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30 * 1000 };
  const rendre = (p) => ({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy });
  if (estNatif()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      let droit = await Geolocation.checkPermissions();
      if (droit.location === 'prompt' || droit.location === 'prompt-with-rationale') droit = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (droit.location !== 'granted' && droit.coarseLocation !== 'granted') return null;
      return rendre(await Geolocation.getCurrentPosition(options));
    } catch { return null; }
  }
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((p) => resolve(rendre(p)), () => resolve(null), options);
  });
}

/* SUIVI DE POSITION DU LIVREUR, TÉLÉPHONE VERROUILLÉ COMPRIS (comparaison avec Uber Eats, 15 oct. 2026).
 *
 * Sur le web, watchPosition s'arrête quand le téléphone se verrouille : le client voyait une carte figée dès que le
 * livreur rangeait son téléphone (CLAUDE.md, « Known gaps » 1). Dans l'application, pendant une course EN LIVRAISON
 * seulement (`arrierePlan`), le greffon @capacitor-community/background-geolocation prend le relais : un service au
 * premier plan, avec sa notification permanente (« course en cours ») — Android l'exige, et le livreur voit ainsi
 * qu'il est suivi et jusqu'à quand. Le reste du temps, et sur le site, le watchPosition d'avant.
 *
 * Le greffon n'a pas de code JavaScript : il s'appelle par registerPlugin, et n'existe donc que dans la coque — le site ne
 * télécharge rien de plus. Greffon absent (ancienne version de l'appli) : retour au watchPosition, sans erreur.
 * Rend une fonction d'arrêt. `onPosition({ latitude, longitude })`, `onErreur()` une fois en cas de refus. */
export async function suivrePositionCourse({ arrierePlan = false, titre, message, onPosition, onErreur }) {
  if (arrierePlan && estNatif()) {
    try {
      const { registerPlugin } = await import('@capacitor/core');
      const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
      const id = await BackgroundGeolocation.addWatcher(
        { backgroundTitle: titre, backgroundMessage: message, requestPermissions: true, stale: false, distanceFilter: 10 },
        (position, erreur) => {
          if (erreur) { onErreur?.(erreur); return; }
          if (position) onPosition({ latitude: position.latitude, longitude: position.longitude });
        }
      );
      return () => { BackgroundGeolocation.removeWatcher({ id }).catch(() => {}); };
    } catch { /* greffon absent : suivi au premier plan ci-dessous */ }
  }
  if (!('geolocation' in navigator)) { onErreur?.(); return () => {}; }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    (e) => onErreur?.(e),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
  );
  return () => navigator.geolocation.clearWatch(watchId);
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
 * le bouton de googleSignIn.js, qui marche sur fairride.be, échoue dans l'application. Le greffon passe par le
 * compte Google du téléphone (Android) ou la feuille Google/Apple d'iOS et rend le même jeton d'identité que le
 * site — POST /auth/google le vérifie exactement pareil, à condition que webClientId soit l'identifiant web
 * (VITE_GOOGLE_CLIENT_ID, celui que le serveur attend comme destinataire).
 *
 * APPLE SUR IPHONE SEULEMENT. La règle 4.8 de l'App Store l'impose dès que Google est proposé (décision du
 * fondateur, 2026-10-11) ; Android garde Google et l'e-mail. Jeton vérifié par POST /auth/apple (backend apple.js).
 *
 * Rend { fournisseur, jeton, prenom, nom } ; lève une Error lisible si la personne annule ou si le greffon manque.
 * Apple ne donne prénom et nom qu'à la toute première autorisation : vides ensuite, le formulaire les redemande.
 *
 * CODE D'AUTORISATION APPLE (2026-10-25, règle 5.1.1(v) de l'App Store). `useProperTokenExchange` fait rendre au greffon
 * le code à usage unique de la connexion, à côté du jeton d'identité (sans échange côté téléphone : le greffon le laisse au
 * serveur). POST /auth/apple l'échange contre le jeton qui permettra de révoquer l'accès Apple à la suppression du compte.
 * Gardé ici, rattaché à son jeton d'identité (codeApple), pour que tous les appels de loginWithApple (accueil, connexion,
 * inscription) l'envoient sans que chaque écran ait à le porter. */
const codesApple = new Map();
export function codeApple(jeton) { return codesApple.get(jeton); }
export function oublierCodeApple(jeton) { codesApple.delete(jeton); }
let connexionPrete = null;
async function preparerConnexion() {
  if (!connexionPrete) {
    connexionPrete = (async () => {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const webClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      await SocialLogin.initialize({
        google: { webClientId, iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || undefined, iOSServerClientId: webClientId, mode: 'online' },
        ...(plateforme() === 'ios' ? { apple: { useProperTokenExchange: true } } : {})
      });
      // DANS UNE BOÎTE, JAMAIS SEUL. Un greffon Capacitor répond à N'IMPORTE QUEL nom de méthode, `then` compris : rendu
      // tel quel par une fonction async, il passe pour une promesse, et JavaScript appelle SocialLogin.then(…) — une
      // méthode que le greffon natif n'a pas et qui ne répond jamais. La connexion attendait sans fin, bouton grisé, sans
      // erreur ni ligne dans le journal Android (trouvé au logcat sur une Galaxy Tab S7+, 17 oct. 2026).
      return { SocialLogin };
    })().catch((e) => { connexionPrete = null; throw e; });
  }
  return connexionPrete;
}

/* PRÉCHAUFFER LA CONNEXION (2026-10-21, latence de l'app) : le greffon était chargé et initialisé au premier toucher de
 * « Continuer avec Google », pendant que la personne attendait. Les écrans qui montrent ces boutons l'appellent à
 * l'ouverture (BoutonsConnexionNative) : au toucher, il ne reste que la feuille de Google. Sans effet sur le site. */
export function prechaufferConnexion() {
  if (!estNatif()) return;
  preparerConnexion().catch(() => { /* réessayé au toucher, qui affichera l'erreur */ });
}

export function appleDisponible() { return estNatif() && plateforme() === 'ios'; }

export async function connexionFournisseur(fournisseur) {
  const { SocialLogin } = await preparerConnexion();
  // Google sur Android : pas de liste « scopes ». E-mail + profil + openid sont déjà demandés par défaut
  // (GoogleProvider.java), et le greffon refuse toute liste si MainActivity n'implémente pas son interface.
  // PLUS RAPIDE (2026-10-21, latence de l'app) : `style: 'bottom'`, la feuille des comptes en bas de l'écran au lieu de
  // l'écran « Se connecter avec Google » (sans compte Google sur le téléphone, le greffon repasse seul à l'écran complet) ;
  // `idTokenOnly`, ajouté au greffon par scripts/corriger-connexion-google.mjs : il rend le jeton d'identité tout de suite,
  // sans la seconde étape de Google (authorize, un aller-retour et parfois un second écran) qui ne servait qu'à un jeton
  // d'accès que Fairide n'utilise pas — POST /auth/google ne lit que le jeton d'identité.
  const options = fournisseur === 'apple' ? { scopes: ['email', 'name'] }
    : plateforme() === 'android' ? { style: 'bottom', idTokenOnly: true } : { scopes: ['email', 'profile'] };
  const { result } = await SocialLogin.login({ provider: fournisseur, options });
  const jeton = result?.idToken;
  if (!jeton) throw new Error('Connexion annulée.');
  if (fournisseur === 'apple' && result.authorizationCode) codesApple.set(jeton, result.authorizationCode);
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
