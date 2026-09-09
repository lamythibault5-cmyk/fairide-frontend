// Valeurs de référence de l'application Incidents (miroir de routes/adminIncidents.js côté serveur) et
// libellés traduits : chaque enum passe par tr('adminIncidents.<groupe>_<valeur>').

export const INCIDENT_TYPES = ['refund', 'cancellation', 'complaint', 'no_show', 'damage', 'late', 'payment', 'other'];
export const RESPONSIBILITIES = ['restaurant', 'driver', 'fairide', 'client', 'unknown'];
export const REFUND_RESPONSIBILITIES = ['restaurant', 'driver', 'fairide'];
export const STATUSES = ['open', 'investigating', 'resolved', 'rejected'];
export const PRIORITIES = ['low', 'normal', 'high'];
export const OPEN_STATUSES = ['open', 'investigating'];

export function typeLabel(tr, v) { return tr(`adminIncidents.type_${v}`); }
export function respLabel(tr, v) { return tr(`adminIncidents.resp_${v}`); }
export function statusLabel(tr, v) { return tr(`adminIncidents.status_${v}`); }
export function priorityLabel(tr, v) { return tr(`adminIncidents.prio_${v}`); }
export function sourceLabel(tr, v) { return tr(`adminIncidents.source_${v}`); }

export const estOuvert = (i) => OPEN_STATUSES.includes(i?.status);
