// Statut d'ouverture d'un commerce à partir de ses horaires structurés — duplique volontairement la
// logique de openingHours.js côté backend (même pattern que les formules de prix déjà dupliquées client/
// serveur dans ce projet). Toujours calculé en heure de Bruxelles via Intl, pas l'heure locale de
// l'appareil, pour rester cohérent avec la validation serveur quel que soit le fuseau du téléphone.
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS_FR = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };

// Libellés dans la langue affichée : `t` vient de useLanguage() (clés hours.*) ; sans t, français.
export function dayLabel(dayKey, t) {
  return t ? t(`hours.${dayKey}`) : DAY_LABELS_FR[dayKey];
}
function libelle(t, cle, defaut) {
  return t ? t(`hours.${cle}`) : defaut;
}

/* UN SEUL FORMATEUR, ET LA MINUTE EN MÉMOIRE (2026-10-27, « Ouvert » qui saccade dans l'app). Créer un Intl.DateTimeFormat
 * avec un fuseau coûte cher, et l'état d'ouverture est demandé des milliers de fois par rendu de la liste (chaque commerce,
 * dans chaque comparaison de tri, chaque rangée, chaque carte) : mesuré, 774 ms sur les 1,3 s d'un appui sur « Ouvert »
 * (téléphone simulé 4× plus lent). Les formateurs sont donc créés une fois, et le résultat d'une minute donnée est gardé :
 * à la minute près, la réponse est la même. */
const FORMAT_PARTIES = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Brussels', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
});
const FORMAT_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' });
const MEMOIRE_MAX = 64;
const partiesParMinute = new Map();
const dateParMinute = new Map();
function retenir(memoire, cle, calcul) {
  let v = memoire.get(cle);
  if (v === undefined) {
    if (memoire.size >= MEMOIRE_MAX) memoire.clear();
    v = calcul();
    memoire.set(cle, v);
  }
  return v;
}

function brusselsParts(date) {
  return retenir(partiesParMinute, Math.floor(date.getTime() / 60000), () => {
    const parts = FORMAT_PARTIES.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekdayShort = (get('weekday') || '').toLowerCase().slice(0, 3);
    const dayKey = DAY_KEYS.find((k) => k === weekdayShort) || DAY_KEYS[date.getUTCDay()];
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    const minute = Number(get('minute'));
    return { dayKey, minutes: hour * 60 + minute };
  });
}

function shiftToMinutes(shift) {
  const [oh, om] = shift.open.split(':').map(Number);
  const [ch, cm] = shift.close.split(':').map(Number);
  const openM = oh * 60 + om;
  let closeM = ch * 60 + cm;
  if (closeM <= openM) closeM += 24 * 60;
  return { openM, closeM };
}

function brusselsMinutesToDate(now, dayOffset, minutesFromMidnight) {
  const approx = new Date(now.getTime() + dayOffset * 24 * 60 * 60000);
  const { minutes: approxNowMinutes } = brusselsParts(approx);
  const diffMinutes = minutesFromMidnight - approxNowMinutes;
  return new Date(approx.getTime() + diffMinutes * 60000);
}

function brusselsDateStr(date) {
  return retenir(dateParMinute, Math.floor(date.getTime() / 60000), () => FORMAT_DATE.format(date));
}

// Une fermeture couvre la date donnée si startDate <= date <= endDate (endDate null = pas de fin connue).
function activeClosureFor(closures, dateStr) {
  if (!Array.isArray(closures)) return null;
  return closures.find((c) => c.startDate <= dateStr && (!c.endDate || c.endDate >= dateStr)) || null;
}

// Le lendemain d'une date pure "YYYY-MM-DD" (calcul à midi UTC : aucun changement d'heure ne fait sauter un jour).
function lendemain(dateStr) {
  return new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

// "DD/MM/YYYY" à partir d'un "YYYY-MM-DD" — pas de conversion de fuseau, c'est une date pure (pas un instant).
export function formatDateFr(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Renvoie { isOpen, opensToday, opensAt (Date|null), opensDayKey, todayKey, isExceptionalClosure,
// closedReason, reopensDate }. `todayKey` (jour courant en heure de Bruxelles) est toujours présent, y
// compris quand isOpen=true, pour afficher l'horaire du jour. `closures` (optionnel) = fermetures
// exceptionnelles en cours, qui priment sur l'horaire hebdomadaire habituel — même logique que côté
// backend (voir openingHours.js), dupliquée ici pour l'affichage instantané sans aller-retour serveur.
// LA NUIT APPARTIENT À LA VEILLE (audit du 19/10, shop-315 ; même règle que le backend, openingHours.js) : l'après-minuit
// d'une plage « 18:00 → 02:00 » suit la fermeture exceptionnelle de la veille, pas celle du jour.
function veilleDe(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
function dansNuitDeLaVeille(hours, todayKey, nowMinutes) {
  if (!hours || typeof hours !== 'object') return false;
  const veilleKey = DAY_KEYS[(DAY_KEYS.indexOf(todayKey) + 6) % 7];
  return (Array.isArray(hours[veilleKey]) ? hours[veilleKey] : []).some((shift) => {
    const { closeM } = shiftToMinutes(shift);
    return closeM > 24 * 60 && nowMinutes < closeM - 24 * 60;
  });
}

export function getOpenStatus(hours, now = new Date(), closures = []) {
  const { dayKey: todayKey, minutes: nowMinutes } = brusselsParts(now);
  const jour = brusselsDateStr(now);
  const closure = activeClosureFor(closures, jour);
  const veilleFermee = !!activeClosureFor(closures, veilleDe(jour));
  if (closure) {
    if (!veilleFermee && dansNuitDeLaVeille(hours, todayKey, nowMinutes)) return { isOpen: true, opensToday: false, opensAt: null, todayKey, isExceptionalClosure: false, closedReason: null, reopensDate: null };
    return {
      isOpen: false, opensToday: false, opensAt: null, todayKey,
      // La fermeture COMPREND sa date de fin : on rouvre le lendemain. « Réouverture prévue le 25/10 » pour une fermeture
      // jusqu'au 25 inclus avançait d'un jour (audit du 19/10, discovery-10 ; même calcul côté serveur).
      isExceptionalClosure: true, closedReason: closure.reason || '', reopensDate: closure.endDate ? lendemain(closure.endDate) : null
    };
  }
  const base = getRegularOpenStatus(hours, now, todayKey, nowMinutes, veilleFermee);
  return { ...base, isExceptionalClosure: false, closedReason: null, reopensDate: null };
}

function getRegularOpenStatus(hours, now, todayKey, nowMinutes, sansVeille = false) {
  if (!hours || typeof hours !== 'object') return { isOpen: true, opensToday: false, opensAt: null, todayKey };
  const todayShifts = Array.isArray(hours[todayKey]) ? hours[todayKey] : [];
  for (const shift of todayShifts) {
    const { openM, closeM } = shiftToMinutes(shift);
    if (nowMinutes >= openM && nowMinutes < closeM) return { isOpen: true, opensToday: false, opensAt: null, todayKey };
  }
  // La plage de la veille qui déborde après minuit (« 18:00 → 01:00 ») compte aussi : sans ce tour, un commerce
  // ouvert jusqu'à 1 h s'affichait fermé de minuit à la fermeture. Même correctif que le backend (openingHours.js).
  // Veille en fermeture exceptionnelle : sa nuit ne compte pas (shop-315).
  if (!sansVeille && dansNuitDeLaVeille(hours, todayKey, nowMinutes)) return { isOpen: true, opensToday: false, opensAt: null, todayKey };
  const upcomingToday = todayShifts
    .map(shiftToMinutes)
    .filter((s) => s.openM > nowMinutes)
    .sort((a, b) => a.openM - b.openM)[0];
  if (upcomingToday) {
    return { isOpen: false, opensToday: true, opensAt: brusselsMinutesToDate(now, 0, upcomingToday.openM), opensDayKey: todayKey, todayKey };
  }
  const todayIndex = DAY_KEYS.indexOf(todayKey);
  for (let offset = 1; offset <= 7; offset++) {
    const dayKey = DAY_KEYS[(todayIndex + offset) % 7];
    const shifts = Array.isArray(hours[dayKey]) ? hours[dayKey] : [];
    if (!shifts.length) continue;
    const earliest = shifts.map(shiftToMinutes).sort((a, b) => a.openM - b.openM)[0];
    return { isOpen: false, opensToday: false, opensAt: brusselsMinutesToDate(now, offset, earliest.openM), opensDayKey: dayKey, todayKey };
  }
  return { isOpen: false, opensToday: false, opensAt: null, todayKey };
}

/* OUVERT OU FERMÉ, SELON LE COMMERCE ET PAS SEULEMENT SES HORAIRES.
 *
 * La fiche recalculait l'état à partir des horaires seuls : un commerce passé « fermé » par son interrupteur, ou en
 * pause minutée (RES-9), restait affiché « Ouvert » à qui ouvrait sa page par un lien direct — le client remplissait
 * son panier et n'apprenait qu'au paiement « Ce restaurant est actuellement fermé » (test de bout en bout du 5 oct.
 * 2026). Même règle que le serveur (routes/orders.js refuse `open = false`, la pause ferme jusqu'à paused_until).
 * Sortie de RestaurantMenu.jsx pour la liste (audit du 19/10, discovery-04) : un commerce en pause ou « fermé pour
 * aujourd'hui » y paraissait ouvert, et « À la une » le rangeait parmi les ouverts. */
export function statutOuverture(restaurant, now = new Date()) {
  const s = getOpenStatus(restaurant.hours, now, restaurant.closures);
  if (!s.isOpen) return s;
  if (restaurant.pausedUntil && restaurant.pausedUntil > now.getTime()) {
    // Stoppé pour la journée (fondateur, 2026-10-10) : la reprise tombe demain — on le dit tel quel au client. Reconnu à sa
    // durée (plus d'une heure : les pauses font 15 à 60 min) ET au changement de date, comme l'interrupteur du commerce
    // (audit du 19/10, shop-312) : une pause de 60 min prise à 23:30 n'est pas « fermé aujourd'hui, rouvre demain à 00:30 ».
    const longue = restaurant.pausedUntil - now.getTime() > 61 * 60000;
    const demain = longue && new Date(restaurant.pausedUntil).toDateString() !== now.toDateString();
    return { ...s, isOpen: false, opensToday: !demain, opensAt: new Date(restaurant.pausedUntil), fermePourLaJournee: demain };
  }
  if (restaurant.open === false) return { ...s, isOpen: false, opensToday: false, fermeParLeCommerce: true };
  return s;
}

// "2h 15min" / "45min" / "moins d'une minute"
export function formatCountdown(ms, t) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return libelle(t, 'lessThanMinute', "moins d'une minute");
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatShift(shift, t) {
  return `${shift.open}–${shift.close === '00:00' ? libelle(t, 'midnight', 'minuit') : shift.close}`;
}

// "11:30–14:30 et 18:00–22:00" / "Fermé"
export function formatDaySchedule(hours, dayKey, t) {
  const shifts = hours && Array.isArray(hours[dayKey]) ? hours[dayKey] : [];
  if (!shifts.length) return libelle(t, 'closed', 'Fermé');
  return shifts.map((s) => formatShift(s, t)).join(libelle(t, 'and', ' et '));
}

// Horaires complets de la semaine, une ligne par jour — pour l'affichage "sinon juste son horaire".
export function formatFullSchedule(hours, t) {
  return DAY_ORDER.map((key) => `${dayLabel(key, t)} : ${formatDaySchedule(hours, key, t)}`);
}

import { useLanguage } from './context/LanguageContext';