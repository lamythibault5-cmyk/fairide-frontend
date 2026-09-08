import { Component } from 'react';
import * as Sentry from '@sentry/react';
import { rechargerSiNouveauCode } from '../lazyPage';

// Filet de sécurité global contre l'écran blanc : sans limite d'erreur, une seule exception pendant le
// rendu (un restaurant sans menu, une commande à laquelle il manque un champ...) démonte tout l'arbre
// React et laisse une page vide, sans message ni moyen de repartir. Sur /checkout, cela signifie une
// commande perdue sans que le client comprenne pourquoi.
//
// Volontairement une classe : c'est aujourd'hui encore la seule façon d'intercepter une erreur de
// rendu en React (pas d'équivalent hook à componentDidCatch).
//
// Les textes sont ICI, pas dans translations.js : la limite d'erreur enveloppe le routeur, donc au-dessus du
// LanguageProvider — t() n'existe pas à ce niveau. La version précédente l'appelait quand même : au moment
// même où une page plantait, le filet plantait à son tour (« t is not defined ») et l'écran restait blanc,
// exactement ce qu'il devait éviter. La langue est lue directement dans le stockage local.
const TEXTES = {
  fr: { title: "Cette page n'a pas pu s'afficher", body: "Un problème technique est survenu de notre côté. Rien n'est perdu : recharge la page pour reprendre où tu en étais. Si cela se reproduit, écris-nous et nous corrigerons.", reload: 'Recharger la page', backHome: "Retour à l'accueil" },
  en: { title: 'This page could not be displayed', body: 'A technical problem occurred on our side. Nothing is lost: reload the page to pick up where you were. If it happens again, write to us and we will fix it.', reload: 'Reload the page', backHome: 'Back to home' },
  nl: { title: 'Deze pagina kon niet worden weergegeven', body: 'Er is een technisch probleem opgetreden bij ons. Er is niets verloren: herlaad de pagina om verder te gaan waar je was. Als het opnieuw gebeurt, schrijf ons en we lossen het op.', reload: 'Pagina herladen', backHome: 'Terug naar de startpagina' }
};
function textes() {
  try { const l = localStorage.getItem('fairide_language'); if (l && TEXTES[l]) return TEXTES[l]; } catch { /* sans stockage */ }
  return TEXTES.fr;
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Ancienne version de l'appli après une mise en ligne (fichier de code introuvable) : rechargement
    // silencieux vers la nouvelle version plutôt qu'un écran d'erreur — voir lazyPage.js.
    if (rechargerSiNouveauCode(error)) return;
    // Sentry n'est initialisé qu'après consentement (voir main.jsx) : sans consentement, captureException
    // est un no-op côté SDK, on peut donc l'appeler sans condition.
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const L = textes();
    return (
      <div className="center-page" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>😕</div>
        <h2>{L.title}</h2>
        <p className="small" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{L.body}</p>
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button className="btn-gold" onClick={() => window.location.reload()}>{L.reload}</button>
          {/* Lien natif plutôt que <Link> : la limite d'erreur enveloppe le routeur, dont l'état
              vient justement de planter — un rechargement complet est le seul retour fiable. */}
          <a className="btn-outline" href="/" style={{ textDecoration: 'none' }}>{L.backHome}</a>
        </div>
      </div>
    );
  }
}
