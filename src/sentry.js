// Sentry chargé à la demande : la bibliothèque (plusieurs dizaines de Ko) ne part plus dans le paquet principal de
// chaque visiteur, seulement quand les rapports sont actifs (rapportsPanneActifs, consent.js ; voir main.jsx). Sinon,
// signalerErreur ne fait rien — comme captureException avant Sentry.init.
let sentry = null;

/* RÉGLAGE PRUDENT (2026-10-16, issu de la recherche sur les rapports sans consentement) : les ERREURS seulement. Pas de
 * mesure de performance (aucun tracesSampleRate), pas de sessions (BrowserSession retiré), pas de journal de la console
 * dans le fil d'Ariane (il peut contenir n'importe quoi), adresses sans leurs paramètres (?token=…, ?code=…), aucune
 * donnée personnelle devinée par le SDK (sendDefaultPii: false), et jamais d'identité d'utilisateur (aucun setUser). */
const sansParametres = (url) => (typeof url === 'string' ? url.split(/[?#]/)[0] : url);
function nettoyer(evenement) {
  if (evenement.request) {
    evenement.request.url = sansParametres(evenement.request.url);
    delete evenement.request.query_string;
    delete evenement.request.cookies;
  }
  for (const b of evenement.breadcrumbs || []) {
    if (b.data?.url) b.data.url = sansParametres(b.data.url);
    if (b.data?.from) b.data.from = sansParametres(b.data.from);
    if (b.data?.to) b.data.to = sansParametres(b.data.to);
  }
  return evenement;
}
function reglages(S, dsn) {
  return {
    dsn,
    sendDefaultPii: false,
    integrations: (parDefaut) => [
      ...parDefaut.filter((i) => i.name !== 'BrowserSession' && i.name !== 'Breadcrumbs'),
      S.breadcrumbsIntegration({ console: false }),
    ],
    beforeSend: nettoyer,
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
  };
}

export async function demarrerSentry(dsn) {
  const S = await import('./sentryNoyau');
  S.init(reglages(S, dsn));
  sentry = S;
}

export function signalerErreur(error, extra) {
  sentry?.captureException(error, { extra });
}

export function sentryActif() {
  return !!sentry;
}

// « Couper » dans Mon compte : plus rien ne part, sans attendre un rechargement.
export async function arreterSentry() {
  if (!sentry) return;
  const S = sentry;
  sentry = null;
  await S.close(2000).catch(() => {});
}

/* UN SEUL RAPPORT, accepté sur l'écran d'une panne (AppErrorBoundary.jsx) par quelqu'un qui n'a pas activé les rapports :
 * son « oui » vaut pour celui-ci seulement. Sentry est donc démarré SANS ses écouteurs automatiques (erreurs globales,
 * fil d'Ariane, sessions) et le module ne le garde pas : signalerErreur reste muet pour la suite. */
export async function envoyerCeRapport(dsn, error, extra) {
  if (sentry) { sentry.captureException(error, { extra }); return; }
  const S = await import('./sentryNoyau');
  S.init({ ...reglages(S, dsn), integrations: [], defaultIntegrations: false });
  S.captureException(error, { extra });
  await S.flush(4000);
}
