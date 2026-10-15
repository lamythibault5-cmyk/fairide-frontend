import { getLocale } from './context/LanguageContext';
import { getOpenStatus } from './openingHours';
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dates sélectionnables pour "programmer" une commande : aujourd'hui + les 7 prochains jours (même
// fenêtre que la validation côté serveur). Avec les horaires du commerce (`ouverture`), un jour sans aucun
// créneau ouvert n'est plus proposé : on ne choisissait un mardi que pour découvrir qu'il n'y avait rien.
export function getScheduleDateOptions(days = 7, labels = { today: "Aujourd'hui", tomorrow: 'Demain' }, ouverture = null) {
  const now = new Date();
  const opts = [];
  for (let day = 0; day <= days; day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    if (ouverture && getScheduleTimeOptions(dateKey(d), ouverture).length === 0) continue;
    let label;
    if (day === 0) label = labels.today;
    else if (day === 1) label = labels.tomorrow;
    else label = d.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    opts.push({ value: dateKey(d), label });
  }
  return opts;
}

/* Créneaux de 30 min pour la date choisie — au moins 45 min à l'avance si c'est aujourd'hui.
 *
 * LES HORAIRES DU COMMERCE (audit UX du 15/10/2026). La grille était fixe, 9 h – 22 h, quels que soient les horaires et
 * les fermetures exceptionnelles : on pouvait programmer à 10 h chez un commerce qui ouvre à 18 h, et ne l'apprendre
 * qu'au refus du serveur. Avec `ouverture` ({ hours, closures } de la fiche), seuls les créneaux où le commerce est
 * ouvert restent, sur toute la journée (un commerce ouvert à 7 h ou jusqu'à 1 h a ses créneaux). Même calcul que
 * l'affichage « ouvert / fermé » de la fiche (openingHours.js, heure de Bruxelles). Sans horaires connus : 9 h – 22 h. */
export function getScheduleTimeOptions(dateStr, ouverture = null) {
  if (!dateStr) return [];
  const avecHoraires = !!(ouverture?.hours && typeof ouverture.hours === 'object');
  const now = new Date();
  const dayStart = avecHoraires ? 0 : 9;
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
  const dayEndTime = avecHoraires ? new Date(y, m - 1, d, 23, 30, 0, 0) : new Date(y, m - 1, d, 22, 0, 0, 0);
  const slots = [];
  while (cursor <= dayEndTime && slots.length < 48) {
    if (!avecHoraires || getOpenStatus(ouverture.hours, cursor, ouverture.closures || []).isOpen) {
      const hh = String(cursor.getHours()).padStart(2, '0');
      const mm = String(cursor.getMinutes()).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    cursor = new Date(cursor.getTime() + 30 * 60000);
  }
  return slots;
}

export { dateKey };
