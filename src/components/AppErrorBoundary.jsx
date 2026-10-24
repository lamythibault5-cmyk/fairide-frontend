import { Component } from 'react';
import { signalerErreur, sentryActif, envoyerCeRapport } from '../sentry';
import { rechargerSiNouveauCode, erreurDeChargementDeCode, horsLigne } from '../lazyPage';
import { langueDepuisChemin } from '../i18n/routing';

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
// exactement ce qu'il devait éviter. La langue est celle de l'ADRESSE (voir textes() plus bas).
const TEXTES = {
  fr: { title: "Cette page n'a pas pu s'afficher", body: "Un problème technique est survenu de notre côté. Rien n'est perdu : recharge la page pour reprendre où tu en étais. Si cela se reproduit, écris-nous et nous corrigerons.", reload: 'Recharger la page', backHome: "Retour à l'accueil",
    demande: 'Nous envoyer ce qui s’est passé ? Ça nous aide à corriger cette panne.', envoyer: 'Envoyer le rapport', envoi: 'Envoi…', merci: 'Merci, c’est envoyé.', echec: 'L’envoi n’a pas marché.',
    horsLigneTitre: 'Pas de connexion internet', horsLigneCorps: "Cette partie du site n'a pas pu se charger sans réseau. Rien n'est perdu : la page se recharge toute seule dès que la connexion revient." },
  en: { title: 'This page could not be displayed', body: 'A technical problem occurred on our side. Nothing is lost: reload the page to pick up where you were. If it happens again, write to us and we will fix it.', reload: 'Reload the page', backHome: 'Back to home',
    demande: 'Send us what happened? It helps us fix this crash.', envoyer: 'Send the report', envoi: 'Sending…', merci: 'Thanks, it’s sent.', echec: 'Sending didn’t work.',
    horsLigneTitre: 'No internet connection', horsLigneCorps: 'This part of the site could not load without a network. Nothing is lost: the page reloads by itself as soon as the connection is back.' },
  nl: { title: 'Deze pagina kon niet worden weergegeven', body: 'Er is een technisch probleem opgetreden bij ons. Er is niets verloren: herlaad de pagina om verder te gaan waar je was. Als het opnieuw gebeurt, schrijf ons en we lossen het op.', reload: 'Pagina herladen', backHome: 'Terug naar de startpagina',
    demande: 'Ons sturen wat er gebeurde? Zo kunnen we deze crash oplossen.', envoyer: 'Rapport versturen', envoi: 'Versturen…', merci: 'Bedankt, het is verstuurd.', echec: 'Versturen is niet gelukt.',
    horsLigneTitre: 'Geen internetverbinding', horsLigneCorps: 'Dit deel van de site kon zonder netwerk niet laden. Er gaat niets verloren: de pagina laadt vanzelf opnieuw zodra de verbinding terug is.' }
};
/* LA LANGUE DE L'ÉCRAN DE PANNE VIENT DE L'ADRESSE (audit du 24/10). Elle était lue dans localStorage (fairide_language), qui
   n'est écrit qu'au changement de langue explicite : un visiteur arrivé directement sur /nl ou /en voyait la panne en
   français. L'adresse est la règle de tout le site (« /nl/… affiche le néerlandais, point », LanguageContext.jsx), y compris
   dans l'app, où changerLangue réécrit l'adresse sur place. Lue au rendu de l'écran, donc après un éventuel changement. */
function textes() {
  try { return TEXTES[langueDepuisChemin(window.location.pathname).langue] || TEXTES.fr; } catch { return TEXTES.fr; }
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, rapport: null }; // rapport : null | 'envoi' | 'envoye' | 'echec'
    this.panne = null;
  }

  /* SANS RÉSEAU, UNE SECTION PAS ENCORE CHARGÉE (audit du 24/10, voir horsLigne() dans lazyPage.js) : ce n'est pas une panne
     de notre côté, l'écran le dit (« Pas de connexion internet »), et la page se recharge d'elle-même à l'événement `online`
     — le code de la section arrivera alors. Rien n'est envoyé à Sentry : ce n'est pas un défaut, et sans réseau le rapport
     ne partirait pas. Calculé ici, et non dans componentDidCatch, pour que le premier rendu de l'écran soit déjà le bon. */
  static getDerivedStateFromError(error) {
    return { hasError: true, horsLigne: erreurDeChargementDeCode(error) && horsLigne() };
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.auRetourDuReseau);
  }

  auRetourDuReseau = () => { window.location.reload(); };

  componentDidCatch(error, info) {
    if (erreurDeChargementDeCode(error) && horsLigne()) {
      window.addEventListener('online', this.auRetourDuReseau, { once: true });
      return;
    }
    // Ancienne version de l'appli après une mise en ligne (fichier de code introuvable) : rechargement
    // silencieux vers la nouvelle version plutôt qu'un écran d'erreur — voir lazyPage.js.
    if (rechargerSiNouveauCode(error)) return;
    // Sentry n'est initialisé qu'après consentement (voir main.jsx) : sans consentement, captureException
    // est un no-op côté SDK, on peut donc l'appeler sans condition.
    signalerErreur(error, { componentStack: info?.componentStack });
    this.panne = { error, extra: { componentStack: info?.componentStack } };
    this.setState({ panneConnue: true }); // componentDidCatch vient après le premier rendu de l'écran d'erreur
  }

  /* Rapports pas activés : on propose d'envoyer CELUI-CI, au moment où la panne vient d'arriver (c'est là qu'on dit le
     plus volontiers oui). Un clic = un rapport, rien d'autre ne part ensuite (sentry.js, envoyerCeRapport). */
  envoyer = async () => {
    if (!this.panne) return;
    this.setState({ rapport: 'envoi' });
    try {
      await envoyerCeRapport(import.meta.env.VITE_SENTRY_DSN, this.panne.error, this.panne.extra);
      this.setState({ rapport: 'envoye' });
    } catch {
      this.setState({ rapport: 'echec' });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const L = textes();
    return (
      <div className="center-page" data-page-plantee style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}></div>
        <h2>{this.state.horsLigne ? L.horsLigneTitre : L.title}</h2>
        <p className="small" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{this.state.horsLigne ? L.horsLigneCorps : L.body}</p>
        {import.meta.env.VITE_SENTRY_DSN && !sentryActif() && this.state.panneConnue && !this.state.horsLigne && (
          <div className="card" style={{ maxWidth: 420, margin: '0 auto 20px', padding: 16 }}>
            {this.state.rapport === 'envoye' ? <p className="small" style={{ margin: 0 }}>{L.merci}</p> : (
              <>
                <p className="small" style={{ margin: '0 0 12px' }}>{this.state.rapport === 'echec' ? L.echec : L.demande}</p>
                <button type="button" className="btn-outline" disabled={this.state.rapport === 'envoi'} onClick={this.envoyer}>
                  {this.state.rapport === 'envoi' ? L.envoi : L.envoyer}
                </button>
              </>
            )}
          </div>
        )}
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
