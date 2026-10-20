/* LES SEULES PIÈCES DE SENTRY DONT FAIRIDE SE SERT (2026-10-20, test de l'app Android). sentry.js faisait
 * `import('@sentry/react')` et passait le module entier de main en main : le paquetage ne peut alors rien retirer, et le
 * fichier chargé à chaque démarrage de l'app pesait ~475 Ko (rejeu de session, traçage, retours utilisateurs… qu'on
 * n'active jamais). Importées par leur nom ici, le reste est laissé de côté à la construction. sentry.js charge ce fichier
 * avec import(), toujours à la demande : le site ne télécharge toujours rien sans consentement. Une fonction de Sentry de
 * plus utilisée dans sentry.js doit être ajoutée ici. */
export { init, captureException, breadcrumbsIntegration, close, flush } from '@sentry/react';
