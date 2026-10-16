// Sentry chargé à la demande : la bibliothèque (plusieurs dizaines de Ko) ne part plus dans le paquet principal de
// chaque visiteur, seulement chez ceux qui ont accepté les cookies de mesure (voir main.jsx). Sans consentement,
// signalerErreur ne fait rien — comme captureException avant Sentry.init.
let sentry = null;

export async function demarrerSentry(options) {
  const S = await import('@sentry/react');
  S.init(options);
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
  const S = await import('@sentry/react');
  S.init({ dsn, sendDefaultPii: false, defaultIntegrations: false });
  S.captureException(error, { extra });
  await S.flush(4000);
}
