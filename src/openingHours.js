// Statut d'ouverture d'un commerce à partir de ses horaires structurés — duplique volontairement la
// logique de openingHours.js côté backend (même pattern que les formules de prix déjà dupliquées client/
// serveur dans ce projet). Toujours calculé en heure de Bruxelles via Intl, pas l'heure locale de
// l'appareil, pour rester cohérent avec la validation serveur quel que soit le fuseau du téléphone.
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS_FR = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };

function brusselsParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Brussels', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayShort = (get('weekday') || '').toLowerCase().slice(0, 3);
  const dayKey = DAY_KEYS.find((k) => k === weekdayShort) || DAY_KEYS[date.getUTCDay()];
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  const minute = Number(get('minute'));
  return { dayKey, minutes: hour * 60 + minute };
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
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(date);
}

// Une fermeture couvre la date donnée si startDate <= date <= endDate (endDate null = pas de fin connue).
function activeClosureFor(closures, dateStr) {
  if (!Array.isArray(closures)) return null;
  return closures.find((c) => c.startDate <= dateStr && (!c.endDate || c.endDate >= dateStr)) || null;
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
export function getOpenStatus(hours, now = new Date(), closures = []) {
  const { dayKey: todayKey, minutes: nowMinutes } = brusselsParts(now);
  const closure = activeClosureFor(closures, brusselsDateStr(now));
  if (closure) {
    return {
      isOpen: false, opensToday: false, opensAt: null, todayKey,
      isExceptionalClosure: true, closedReason: closure.reason || '', reopensDate: closure.endDate || null
    };
  }
  const base = getRegularOpenStatus(hours, now, todayKey, nowMinutes);
  return { ...base, isExceptionalClosure: false, closedReason: null, reopensDate: null };
}

function getRegularOpenStatus(hours, now, todayKey, nowMinutes) {
  if (!hours || typeof hours !== 'object') return { isOpen: true, opensToday: false, opensAt: null, todayKey };
  const todayShifts = Array.isArray(hours[todayKey]) ? hours[todayKey] : [];
  for (const shift of todayShifts) {
    const { openM, closeM } = shiftToMinutes(shift);
    if (nowMinutes >= openM && nowMinutes < closeM) return { isOpen: true, opensToday: false, opensAt: null, todayKey };
  }
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

// "2h 15min" / "45min" / "moins d'une minute"
export function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return "moins d'une minute";
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatShift(shift) {
  return `${shift.open}–${shift.close === '00:00' ? 'minuit' : shift.close}`;
}

// "11:30–14:30 et 18:00–22:00" / "Fermé"
export function formatDaySchedule(hours, dayKey) {
  const shifts = hours && Array.isArray(hours[dayKey]) ? hours[dayKey] : [];
  if (!shifts.length) return 'Fermé';
  return shifts.map(formatShift).join(' et ');
}

// Horaires complets de la semaine, une ligne par jour — pour l'affichage "sinon juste son horaire".
export function formatFullSchedule(hours) {
  return DAY_ORDER.map((key) => `${DAY_LABELS_FR[key]} : ${formatDaySchedule(hours, key)}`);
}
