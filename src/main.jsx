import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
import { PreviewModeProvider } from './context/PreviewModeContext';
import { hasAcceptedConsent, onConsentChange } from './consent';
import './styles.css';

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
// Acceptation en cours de visite : on démarre sans attendre un rechargement de page.
onConsentChange(startSentryIfAllowed);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
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
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
