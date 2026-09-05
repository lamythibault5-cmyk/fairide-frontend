import { getLocale } from './context/LanguageContext';
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dates sélectionnables pour "programmer" une commande : aujourd'hui + les 7 prochains jours (même
// fenêtre que la validation côté serveur). Une réservation de table suit l'horizon du restaurant
// (reservationMaxDays), d'où le paramètre.
export function getScheduleDateOptions(days = 7, labels = { today: "Aujourd'hui", tomorrow: 'Demain' }) {
  const now = new Date();
  const opts = [];
  for (let day = 0; day <= days; day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    let label;
    if (day === 0) label = labels.today;
    else if (day === 1) label = labels.tomorrow;
    else label = d.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    opts.push({ value: dateKey(d), label });
  }
  return opts;
}

// Créneaux de 30 min entre 9h et 22h pour la date choisie — au moins 45 min à l'avance si c'est
// aujourd'hui, sinon toute la plage horaire est proposée.
export function getScheduleTimeOptions(dateStr) {
  if (!dateStr) return [];
  const now = new Date();
  const dayStart = 9, dayEnd = 22;
  const [y, m, d] = dateStr.split('-').map(Number);
  const isToday = dateStr === dateKey(now);
  let cursor;
  if (isToday) {
    cursor = new Date(now.getTime() + 45 * 60000);
    const minutes = cursor.getMinutes();
    const rounded = minutes % 30 === 0 ? minutes : minutes + (30 - (minutes % 30));
    cursor.setMinutes(rounded, 0, 0);
    if (cursor.getHours() < dayStart) cursor.setHours(dayStart, 0, 0, 0);
  } else {
    cursor = new Date(y, m - 1, d, dayStart, 0, 0, 0);
  }
  const dayEndTime = new Date(y, m - 1, d, dayEnd, 0, 0, 0);
  const slots = [];
  while (cursor <= dayEndTime && slots.length < 30) {
    const hh = String(cursor.getHours()).padStart(2, '0');
    const mm = String(cursor.getMinutes()).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    cursor = new Date(cursor.getTime() + 30 * 60000);
  }
  return slots;
}

export { dateKey };
