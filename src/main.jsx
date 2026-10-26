// En premier : les dates s'affichent en heure de Bruxelles partout (voir fuseauBruxelles.js, plan de test HOR-6).
import './fuseauBruxelles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
/* `unstable_HistoryRouter` porte bien son nom : c'est une API que React Router ne garantit pas entre
   deux versions mineures. Elle est indispensable ici — c'est elle qui permet de changer de langue
   sans recharger la page (voir i18n/historiqueLangue.js) — mais la dépendance est donc épinglée à
   une version exacte dans package.json, sans accent circonflexe. Un `npm install` qui ramènerait
   7.19 pourrait retirer cet export et casser TOUT le routage d'un coup, à la première mise en ligne
   suivante, sans que rien dans le code n'ait changé. */
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { demarrerSentry, arreterSentry } from './sentry';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary';
import BandeauHorsLigne from './components/BandeauHorsLigne';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
import { PreviewModeProvider } from './context/PreviewModeContext';
import { rapportsPanneActifs, onConsentChange } from './consent';
import { langueDepuisChemin, PREFIXES, languePreferee } from './i18n/routing';
import { historiqueLangue, changerLangue } from './i18n/historiqueLangue';
import { chargerLangue, DEFAULT_LANGUAGE } from './i18n/translations';
import './styles.css';
// Parcours client (liste, fiche, panier, paiement, suivi) — après styles.css pour l'emporter sur les anciens réglages.
import './client-ui.css';
// Le verre de l'app (2026-10-23) : après les feuilles communes ; ses règles sont aussi plus fortes que celles de chaque écran.
import './verre.css';
import './transitions-appli.css';
import { rechargerSiNouveauCode, horsLigne } from './lazyPage';
import { demarrerAnalytics } from './analytics';
import { estNatif, demarrerNatif, retirerEcranLancementNatif, garderLesLiensDansLApp } from './natif';
import { ecouterNotificationsNatives } from './pushNatif';
import { installerFonduPhotos } from './images';

// POLICES : on rallume la feuille laissée en `media="print"` par index.html (voir le commentaire
// détaillé là-bas). Deux contraintes se croisent et cette ligne est le seul point où elles tiennent
// ensemble : la CSP interdit un `onload=` en ligne sur la balise, et une feuille ordinaire dans le
// <head> bloquerait l'exécution de ce fichier-ci — donc le démarrage de l'application — le temps
// d'un aller-retour vers Google Fonts. Ici, le code vient de notre origine (`script-src 'self'`) et
// s'exécute une fois l'application chargée : la police ne peut plus retarder ni empêcher le
// démarrage, elle se substitue à la police de repli quand elle arrive.
for (const lien of document.querySelectorAll('link[data-police]')) lien.media = 'all';

// Sentry (rapports de panne) : sur le SITE, seulement après « Accepter » sur la bannière — le démarrer au chargement, comme
// c'était le cas, rendait la bannière décorative. Dans l'APP, actif sauf refus (fondateur, 2026-10-16 ; règle et raisons
// dans rapportsPanneActifs, consent.js). Réglage réduit aux erreurs, sans identité ni paramètres d'adresse (sentry.js).
let sentryStarted = false;
function startSentryIfAllowed() {
  if (sentryStarted || !import.meta.env.VITE_SENTRY_DSN || !rapportsPanneActifs()) return;
  sentryStarted = true;
  demarrerSentry(import.meta.env.VITE_SENTRY_DSN).catch(() => { sentryStarted = false; });
}

/* AU DÉMARRAGE, SENTRY ATTEND QUE L'APP SOIT AFFICHÉE (2026-10-20, test de l'app Android : démarrage lent). Le charger et
   l'initialiser tout de suite prenait le processeur pendant le premier rendu, sur un téléphone moyen. Il part quand le
   navigateur n'a plus rien à faire (requestIdleCallback, au plus 3 s), ou après 3 s là où cette fonction n'existe pas
   (Safari). Même règle de consentement, mêmes réglages : seul le moment change. Une panne dans ces premières secondes n'est
   pas rapportée — c'était déjà le cas le temps que le fichier arrive. Une acceptation en cours de visite le démarre tout de
   suite (onConsentChange, plus bas). */
if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => startSentryIfAllowed(), { timeout: 3000 });
else setTimeout(startSentryIfAllowed, 3000);
// Statistiques sans cookie (Plausible) : inactif tant que VITE_PLAUSIBLE_DOMAIN n'est pas défini.
demarrerAnalytics();

// Mise en ligne pendant qu'un onglet est ouvert : le code d'une section demandée n'existe plus sous son
// ancien nom. Plutôt qu'une page vide, rechargement silencieux vers la nouvelle version (voir lazyPage.js).
// HORS LIGNE, l'erreur n'est plus retenue (audit du 24/10) : retenue (preventDefault) sans rechargement, l'import se
// résolvait sur `undefined` et React plantait avec un message sans rapport. Laissée passer, elle arrive à lazyPage puis à
// AppErrorBoundary, qui dit « Pas de connexion internet » et recharge au retour du réseau. En ligne, rien ne change.
window.addEventListener('vite:preloadError', (e) => { if (rechargerSiNouveauCode(e.payload) || !horsLigne()) e.preventDefault(); });
// Acceptation en cours de visite : on démarre sans attendre un rechargement de page. Refus après coup (« Couper » dans
// Mon compte, dans l'app) : on arrête tout de suite.
onConsentChange(() => {
  if (rapportsPanneActifs()) { startSentryIfAllowed(); return; }
  if (sentryStarted) { sentryStarted = false; arreterSentry(); }
});

// Service worker : rend l'application installable, et surtout c'est le seul endroit qui peut
// recevoir une notification push quand l'onglet est fermé (voir public/sw.js, qui ne met rien en
// cache). Échec silencieux voulu : navigateur trop ancien, page servie en http hors localhost,
// navigation privée — dans tous ces cas l'application doit continuer de fonctionner exactement
// comme avant, sans notification et sans message d'erreur adressé à quelqu'un qui n'a rien demandé.
// Dans l'application native (Capacitor), la page est servie localement et les notifications passent par
// APNs/FCM (pushNatif.js) : pas de service worker, il n'aurait rien à faire.
if ('serviceWorker' in navigator && !estNatif()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// LA LANGUE VIENT DE L'ADRESSE : /nl/… et /en/… sont des adresses à part entière, le français est la
// racine (voir src/i18n/routing.js). L'historique du routeur ajoute le préfixe devant chaque lien et le
// retire de ce que lisent les composants, comme le ferait `basename` — mais il peut en changer sans
// recharger la page quand le visiteur change de langue (voir src/i18n/historiqueLangue.js).
let { langue } = langueDepuisChemin(window.location.pathname);

// Visiteur qui revient par une adresse sans préfixe alors qu'il avait choisi une autre langue : on
// l'emmène vers la même page dans SA langue, une seule fois (l'adresse d'arrivée porte un préfixe,
// la condition ne peut donc pas se redéclencher). `replace` et non `assign` : ce détour n'a pas à
// occuper une entrée dans l'historique, sans quoi le bouton Retour y reviendrait en boucle.
//
// DANS L'APPLICATION, sans rechargement (2026-10-21, latence de l'app) : elle s'ouvre toujours sur « / », donc un utilisateur
// néerlandophone ou anglophone rechargeait TOUTE l'app à chaque lancement, après avoir déjà lu et exécuté 1,3 Mo de JavaScript.
// Rien n'est encore rendu à ce stade : changerLangue réécrit l'adresse en place (replaceState), comme le bouton de langue.
// Le site garde le rechargement : ses pages sont pré-rendues en français, et un moteur de recherche doit suivre l'adresse.
const preferee = langue === 'fr' ? languePreferee() : null;
if (preferee && preferee !== 'fr' && PREFIXES[preferee]) {
  if (estNatif()) {
    changerLangue(preferee);
    langue = preferee;
  } else {
    const { pathname, search, hash } = window.location;
    window.location.replace(`${PREFIXES[preferee]}${pathname === '/' ? '' : pathname}${search}${hash}`);
  }
}

// LE DICTIONNAIRE DE LA LANGUE DE L'ADRESSE EST DEMANDÉ ICI, PAS AU PREMIER RENDU (audit du 24/10). LanguageProvider le
// demande dans un effet, donc après que toute l'application a été rendue une première fois (en français) ; sur un téléphone
// moyen, ce sont des centaines de millisecondes de plus avant que le texte néerlandais arrive. Lancé ici, l'import() part dès
// l'exécution de ce fichier — et sur les pages /nl et /en pré-rendues, le fichier est déjà en route (modulepreload, voir
// scripts/prerender.mjs). chargerLangue ne lève jamais et ne télécharge qu'une fois : l'effet du fournisseur reprend la même
// promesse.
if (langue !== DEFAULT_LANGUAGE) chargerLangue(langue);

// Écran de chargement (index.html, #splash) : il ne fait que COUVRIR le chargement, jamais le prolonger
// (fondateur, 2026-09-17 : « le plus smooth possible, pas d'attente longue »). Il s'efface dès que l'application
// est montée, sans attendre les données.
// LE VÉLO POUR LE DÉMARRAGE, LES SQUELETTES POUR LES DONNÉES (fondateur, 2026-10-26). Du 2026-10-21 au 2026-10-26, l'écran
// attendait aussi qu'aucun squelette ne reste à l'écran (« jusqu'à ce que l'app ou le site soit chargé ») : il cachait donc
// les squelettes, et une connexion lente donnait jusqu'à 7,5 s d'iris immobile, sans rien de la page. Un squelette montre
// où les choses vont arriver, les onglets et la recherche sont déjà là : l'attente paraît plus courte. Les lignes du
// squelette n'apparaissent qu'après 0,3 s (.sq-lignes, styles.css), pour qu'un chargement rapide ne clignote pas.
// Le plafond reste à 7,5 s depuis l'ouverture de la page, juste avant le message de secours en CSS (8 s, index.html) : au-delà,
// on montre ce qu'on a. Sondage par setTimeout et non requestAnimationFrame : dans un onglet ouvert en arrière-plan, rAF ne se
// déclenche pas et l'écran resterait affiché.
//
// SUR LE SITE, l'écran n'est qu'un cache blanc pendant la première seconde (index.html) : s'il n'est pas encore devenu iris,
// on le retire tout de suite, sans le fondu ni le vélo qui part.
//
// DANS L'APPLICATION, l'écran de lancement natif (le vélo seul, immobile) restait PAR-DESSUS jusqu'à la fin : le vélo qui
// roule n'était jamais vu. On le retire dès que ce script tourne — notre écran est déjà peint dessous, le vélo déjà
// complet (classe splash-natif, voir index.html) — et c'est le nôtre qui couvre la suite.
function retirerEcranChargement() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  if (estNatif()) {
    splash.classList.add('splash-natif');
    retirerEcranLancementNatif();
  }
  const prete = () => {
    const root = document.getElementById('root');
    if (!root || !root.children.length) return false;
    // Le texte pré-rendu pour les moteurs (scripts/contenuStatique.mjs) n'est pas la page : on attend que React l'ait remplacé,
    // sinon l'écran s'effacerait sur ce texte sans mise en forme.
    return !root.querySelector('[data-prerendu]');
  };
  const sonder = () => {
    if (prete() || performance.now() > 7500) {
      const iris = splash.querySelector('.splash-iris');
      if (iris && getComputedStyle(iris).opacity === '0') {
        splash.remove();
        retirerEcranLancementNatif();
        return;
      }
      // 220 ms : le vélo part (0,25 s) pendant que l'écran s'efface (0,18 s) ; la page est déjà là dessous. C'était 450 ms
      // (0,4 s puis 0,25 s après 0,12 s) : raccourci le 2026-10-21 (latence de l'app, « ok » du fondateur).
      splash.classList.add('splash-fin');
      setTimeout(() => splash.remove(), 220);
      retirerEcranLancementNatif();
      return;
    }
    setTimeout(sonder, 40);
  };
  sonder();
}
setTimeout(retirerEcranChargement, 0);

// Coque iOS / Android : bouton Retour, liens universels, barre d'état, clavier (voir natif.js).
demarrerNatif(historiqueLangue);
garderLesLiensDansLApp(historiqueLangue);
if (estNatif()) ecouterNotificationsNatives(historiqueLangue);
// Le fondu d'une photo part quand elle arrive, pas au rendu (images.js) — site et app.
installerFonduPhotos();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <HistoryRouter history={historiqueLangue}>
        <LanguageProvider initial={langue}>
          <ToastProvider>
            <AuthProvider>
              <PreviewModeProvider>
                <CartProvider>
                  <BandeauHorsLigne />
                  <App />
                </CartProvider>
              </PreviewModeProvider>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </HistoryRouter>
    </AppErrorBoundary>
  </StrictMode>
);
