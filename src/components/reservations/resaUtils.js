import { getLocale } from '../../context/LanguageContext';

// Petits utilitaires partagés par les onglets du module Réservations (dates à l'heure de Bruxelles,
// montants, états métier d'une réservation). Aucun texte visible ici : les libellés passent par t().

export function isoDuJour(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}
export function heureLocale(ms) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}
// Heure « HH:MM » stable (en-GB) pour remplir un <input type="time">.
export function heureInput(ms) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}
// Minutes depuis minuit, à l'heure de Bruxelles — le navigateur du restaurateur peut être ailleurs,
// et une réservation doit s'afficher à l'heure de sa salle, pas à celle de son téléphone.
export function minutesLocales(ms) {
  const [h, m] = heureInput(ms).split(':').map(Number);
  return h * 60 + m;
}
// Minutes depuis minuit DU JOUR AFFICHÉ — négatif pour une réservation entamée la veille.
export function minutesDansLeJour(r, date) {
  const m = minutesLocales(r.startAt);
  return isoDuJour(new Date(r.startAt)) === date ? m : m - 1440;
}
export function decalerJour(iso, jours) {
  const [a, mo, j] = iso.split('-').map(Number);
  return isoDuJour(new Date(Date.UTC(a, mo - 1, j + jours, 12)));
}
export function libelleJour(iso, court = false, locale = getLocale()) {
  const [a, mo, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, court ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(a, mo - 1, j, 12)));
}
export function dateCourte(ms, locale = getLocale()) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
export function lundiDe(iso) {
  const [a, mo, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j, 12));
  const decal = (d.getUTCDay() + 6) % 7;
  return decalerJour(iso, -decal);
}
// Instant (heure de Bruxelles) d'une date + heure locales : on part d'une estimation UTC puis on
// corrige l'écart réellement appliqué par Intl (été/hiver).
export function instantBruxelles(dateISO, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const [a, mo, j] = dateISO.split('-').map(Number);
  let d = new Date(Date.UTC(a, mo - 1, j, h, m));
  for (let i = 0; i < 2; i++) {
    const [hh, mm] = heureInput(d.getTime()).split(':').map(Number);
    const ecart = (h * 60 + m) - ((hh % 24) * 60 + mm);
    if (!ecart) break;
    d = new Date(d.getTime() + ecart * 60000);
  }
  return d.toISOString();
}
export function euros(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} €`; }

// État métier d'une réservation, dérivé du statut de commande et du pointage d'arrivée :
// a_confirmer → confirmee → installee (client arrivé, statut « pret ») → terminee ; ou table_prete
// (statut « pret » sans arrivée), no_show, annulee, refusee.
export const ETATS = ['a_confirmer', 'confirmee', 'table_prete', 'installee', 'terminee', 'no_show', 'annulee', 'refusee'];
export function etatResa(r) {
  if (r.status === 'refuse') return 'refusee';
  if (r.status === 'annule') return 'annulee';
  if (r.arrival === 'no_show') return 'no_show';
  if (r.status === 'livre') return 'terminee';
  if (r.status === 'pret') return r.arrival === 'arrive' ? 'installee' : 'table_prete';
  if (r.status === 'nouveau') return 'a_confirmer';
  return 'confirmee';
}
export function estClose(r) { return ['refuse', 'annule', 'livre'].includes(r.status); }
export function estActive(r) { return !['refuse', 'annule'].includes(r.status); }

export const SOURCES = { client: 'srcClient', restaurant: 'srcRestaurant', phone: 'srcPhone', walk_in: 'srcWalkIn' };
export const ACOMPTE_LABEL = { pending: 'depPending', paid: 'depPaid', refunded: 'depRefunded', kept: 'depKept' };

export function nomTable(tb) {
  if (!tb) return '';
  return tb.number != null ? `${tb.number} · ${tb.name}` : tb.name;
}
