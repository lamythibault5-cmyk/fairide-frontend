import { Component } from 'react';
import * as Sentry from '@sentry/react';
import { useLanguage } from '../../context/LanguageContext';
import { rechargerSiNouveauCode } from '../../lazyPage';

// Limite d'erreur de l'ERP admin : une page qui plante (fiche à laquelle il manque un champ, réponse
// inattendue du serveur…) affiche une carte d'erreur avec « Recharger » au lieu de démonter toute la
// console. La barre latérale et les autres applications restent utilisables. Remise à zéro dès que
// l'adresse change (`resetKey`) : naviguer vers une autre application suffit à repartir.
//
// Classe obligatoire (componentDidCatch n'a pas d'équivalent hook) ; les textes passent par un petit
// composant fonction pour pouvoir utiliser t() — ici on est sous le LanguageProvider, contrairement à
// AppErrorBoundary.

function CarteErreur({ error, onReset }) {
  const { t: tr } = useLanguage();
  return (
    <div className="admin-error-card" role="alert">
      <span className="admin-error-icon" aria-hidden="true">⚠️</span>
      <div className="admin-error-body">
        <h3>{tr('adminCommon.pageCrashTitle')}</h3>
        <p className="small">{tr('adminCommon.pageCrashBody')}</p>
        {error?.message && <pre>{String(error.message)}</pre>}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-gold" onClick={() => window.location.reload()}>{tr('adminCommon.reload')}</button>
          <button type="button" className="btn-outline" onClick={onReset}>{tr('adminCommon.retry')}</button>
          <a className="btn-ghost" href="/admin" style={{ textDecoration: 'none' }}>{tr('adminHome.apps')}</a>
        </div>
      </div>
    </div>
  );
}

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (rechargerSiNouveauCode(error)) return;
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack, admin: true } });
  }

  componentDidUpdate(prevProps) {
    // Changement d'application : on redonne sa chance à la nouvelle page.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CarteErreur error={this.state.error} onReset={() => this.setState({ error: null })} />;
  }
}
