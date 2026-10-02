/* Toutes les heures affichées en heure de Bruxelles, quel que soit le fuseau de l'appareil.
 *
 * POURQUOI. Plan de test HOR-6 (2 octobre 2026) : un navigateur réglé sur New York affichait « Commandée à 09:25 »
 * pour une commande passée à 15:25 à Bruxelles. Le ticket et les e-mails (backend) fixent Europe/Brussels ; le site,
 * lui, suivait le fuseau de l'appareil — un commerçant dont la tablette est mal réglée, un livreur en roaming, un
 * administrateur en voyage lisaient une autre heure que le client et que le ticket.
 *
 * COMMENT. Fairide n'opère qu'à Bruxelles : toute date affichée se lit en heure belge. Plutôt que d'ajouter
 * `timeZone` aux ~120 appels de toLocale…String du code (et d'oublier le suivant), on fixe ce fuseau PAR DÉFAUT :
 * un appel qui précise déjà son timeZone garde le sien. Importé en premier dans main.jsx.
 * Limite connue : getHours()/getDate() restent dans le fuseau de l'appareil ; le code qui raisonne sur l'heure
 * de Bruxelles passe déjà par openingHours.js (Intl avec timeZone explicite). */
const FUSEAU = 'Europe/Brussels';

function avecFuseau(original) {
  return function (locales, options) {
    const opts = options && typeof options === 'object' ? options : {};
    return original.call(this, locales, opts.timeZone ? opts : { ...opts, timeZone: FUSEAU });
  };
}

if (typeof Date !== 'undefined' && !Date.prototype.__fuseauBruxelles) {
  Date.prototype.toLocaleString = avecFuseau(Date.prototype.toLocaleString);
  Date.prototype.toLocaleDateString = avecFuseau(Date.prototype.toLocaleDateString);
  Date.prototype.toLocaleTimeString = avecFuseau(Date.prototype.toLocaleTimeString);
  Object.defineProperty(Date.prototype, '__fuseauBruxelles', { value: true });
}

export const FUSEAU_AFFICHAGE = FUSEAU;
