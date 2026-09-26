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
