import { Component } from 'react';
import * as Sentry from '@sentry/react';

// Filet de sécurité global contre l'écran blanc : sans limite d'erreur, une seule exception pendant le
// rendu (un restaurant sans menu, une commande à laquelle il manque un champ...) démonte tout l'arbre
// React et laisse une page vide, sans message ni moyen de repartir. Sur /checkout, cela signifie une
// commande perdue sans que le client comprenne pourquoi.
//
// Volontairement une classe : c'est aujourd'hui encore la seule façon d'intercepter une erreur de
// rendu en React (pas d'équivalent hook à componentDidCatch).
//
// Le texte reste en français, comme le reste de l'app à ce niveau : la limite d'erreur enveloppe le
// routeur, donc au-dessus du LanguageProvider — t() n'est pas disponible ici, et un composant qui
// vient justement de planter est le dernier endroit où ajouter une dépendance de contexte.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Sentry n'est initialisé qu'après consentement (voir main.jsx) : sans consentement, captureException
    // est un no-op côté SDK, on peut donc l'appeler sans condition.
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="center-page" style={{ padding: '60px 20px' }}>
        <div style={{ fontSize: 40 }}>😕</div>
        <h2>{t('errorPage.title')}</h2>
        <p className="small" style={{ maxWidth: 420, margin: '0 auto 20px' }}>
          {t('errorPage.body')}
        </p>
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button className="btn-gold" onClick={() => window.location.reload()}>{t('errorPage.reload')}</button>
          {/* Lien natif plutôt que <Link> : la limite d'erreur enveloppe le routeur, dont l'état
              vient justement de planter — un rechargement complet est le seul retour fiable. */}
          <a className="btn-outline" href="/" style={{ textDecoration: 'none' }}>{t('errorPage.backHome')}</a>
        </div>
      </div>
    );
  }
}
