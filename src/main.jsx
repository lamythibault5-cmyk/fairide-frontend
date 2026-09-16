import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
import { PreviewModeProvider } from './context/PreviewModeContext';
import { hasAcceptedConsent, onConsentChange } from './consent';
import { langueDepuisChemin, PREFIXES, languePreferee } from './i18n/routing';
import { historiqueLangue } from './i18n/historiqueLangue';
import './styles.css';
import { rechargerSiNouveauCode } from './lazyPage';

// Sentry ne démarre qu'APRÈS consentement explicite : il transmet l'adresse IP, les URL visitées et le
// contexte utilisateur à un sous-traitant établi aux États-Unis. Le démarrer au chargement de la page,
// comme c'était le cas, revenait à collecter avant la réponse du visiteur et rendait la bannière
// purement décorative (voir consent.js).
// sendDefaultPii reste explicitement à false : même après acceptation, rien n'oblige à joindre les
// données personnelles que le SDK sait deviner tout seul.
let sentryStarted = false;
function startSentryIfAllowed() {
  if (sentryStarted || !import.meta.env.VITE_SENTRY_DSN || !hasAcceptedConsent()) return;
  sentryStarted = true;
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, sendDefaultPii: false });
}

startSentryIfAllowed();

// Mise en ligne pendant qu'un onglet est ouvert : le code d'une section demandée n'existe plus sous son
// ancien nom. Plutôt qu'une page vide, rechargement silencieux vers la nouvelle version (voir lazyPage.js).
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); rechargerSiNouveauCode(e.payload); });
// Acceptation en cours de visite : on démarre sans attendre un rechargement de page.
onConsentChange(startSentryIfAllowed);

// Service worker : rend l'application installable, et surtout c'est le seul endroit qui peut
// recevoir une notification push quand l'onglet est fermé (voir public/sw.js, qui ne met rien en
// cache). Échec silencieux voulu : navigateur trop ancien, page servie en http hors localhost,
// navigation privée — dans tous ces cas l'application doit continuer de fonctionner exactement
// comme avant, sans notification et sans message d'erreur adressé à quelqu'un qui n'a rien demandé.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// LA LANGUE VIENT DE L'ADRESSE : /nl/… et /en/… sont des adresses à part entière, le français est la
// racine (voir src/i18n/routing.js). L'historique du routeur ajoute le préfixe devant chaque lien et le
// retire de ce que lisent les composants, comme le ferait `basename` — mais il peut en changer sans
// recharger la page quand le visiteur change de langue (voir src/i18n/historiqueLangue.js).
const { langue } = langueDepuisChemin(window.location.pathname);

// Visiteur qui revient par une adresse sans préfixe alors qu'il avait choisi une autre langue : on
// l'emmène vers la même page dans SA langue, une seule fois (l'adresse d'arrivée porte un préfixe,
// la condition ne peut donc pas se redéclencher). `replace` et non `assign` : ce détour n'a pas à
// occuper une entrée dans l'historique, sans quoi le bouton Retour y reviendrait en boucle.
const preferee = langue === 'fr' ? languePreferee() : null;
if (preferee && preferee !== 'fr' && PREFIXES[preferee]) {
  const { pathname, search, hash } = window.location;
  window.location.replace(`${PREFIXES[preferee]}${pathname === '/' ? '' : pathname}${search}${hash}`);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <HistoryRouter history={historiqueLangue}>
        <LanguageProvider initial={langue}>
          <ToastProvider>
            <AuthProvider>
              <PreviewModeProvider>
                <CartProvider>
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
