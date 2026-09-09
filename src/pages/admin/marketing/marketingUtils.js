import { COMMUNES } from '../../../menuCategories';

// Petits utilitaires (sans composant, voir MarketingPills.jsx pour les pastilles) partagés par la
// page Marketing, le formulaire de campagne et le tiroir de fiche.

export const STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'];
export const ROLES = ['client', 'restaurant', 'driver'];
export const LANGS = ['fr', 'en', 'nl'];
export { COMMUNES };

// Audience telle que manipulée par le formulaire (chaînes vides plutôt que null pour les <input>).
export function audienceVide() {
  return { roles: [], communes: [], lang: '', activeWithinDays: '', inactiveForDays: '', minOrders: '', verifiedOnly: false };
}

export function audienceVersForm(a) {
  const src = a && typeof a === 'object' ? a : {};
  return {
    roles: Array.isArray(src.roles) ? src.roles.filter((r) => ROLES.includes(r)) : [],
    communes: Array.isArray(src.communes) ? src.communes.filter(Boolean) : [],
    lang: src.lang || '',
    activeWithinDays: src.activeWithinDays ? String(src.activeWithinDays) : '',
    inactiveForDays: src.inactiveForDays ? String(src.inactiveForDays) : '',
    minOrders: src.minOrders ? String(src.minOrders) : '',
    verifiedOnly: !!src.verifiedOnly
  };
}

// Formulaire → JSON attendu par l'API (POST /admin/marketing/audience/preview et campagnes).
export function audienceVersApi(f) {
  const nombre = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    roles: f.roles, communes: f.communes, lang: f.lang || null,
    activeWithinDays: nombre(f.activeWithinDays), inactiveForDays: nombre(f.inactiveForDays), minOrders: nombre(f.minOrders),
    verifiedOnly: !!f.verifiedOnly
  };
}

// Résumé d'une audience en une ligne (« Clients, Commerces · 3 communes · inactifs ≥ 60 j »).
export function resumeAudience(a, tr) {
  const src = a && typeof a === 'object' ? a : {};
  const parts = [];
  const roles = Array.isArray(src.roles) ? src.roles.filter((r) => ROLES.includes(r)) : [];
  parts.push(roles.length ? roles.map((r) => tr(`adminMarketing.role_${r}`)).join(', ') : '—');
  const communes = Array.isArray(src.communes) ? src.communes : [];
  parts.push(communes.length === 0 ? tr('adminMarketing.audAllCommunes') : communes.length === 1 ? communes[0] : tr('adminMarketing.audCommunes', { n: communes.length }));
  if (src.lang) parts.push(tr('adminMarketing.audLang', { lang: String(src.lang).toUpperCase() }));
  if (src.activeWithinDays) parts.push(tr('adminMarketing.audActive', { n: src.activeWithinDays }));
  if (src.inactiveForDays) parts.push(tr('adminMarketing.audInactive', { n: src.inactiveForDays }));
  if (src.minOrders) parts.push(tr('adminMarketing.audMinOrders', { n: src.minOrders }));
  if (src.verifiedOnly) parts.push(tr('adminMarketing.audVerified'));
  return parts.join(' · ');
}

// Valeurs d'exemple pour l'aperçu (même remplacement que le serveur : {prenom} {nom} {commune}).
export const EXEMPLE = { prenom: 'Marie', nom: 'Marie Dupont', commune: 'Ixelles' };
export function personnaliser(texte, vals = EXEMPLE) {
  return String(texte || '').replace(/\{\s*([a-zA-Zéè]+)\s*\}/g, (m, cle) => {
    const k = cle.toLowerCase().replace(/é|è/g, 'e');
    return k in vals ? vals[k] : m;
  });
}

export function paragraphes(body) {
  return String(body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

// Valeur par défaut d'un <input type="datetime-local"> : dans une heure, arrondi au quart d'heure.
export function dansUneHeure() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const PEUT_ENVOYER = (s) => ['draft', 'scheduled', 'failed', 'cancelled'].includes(s);
export const PEUT_MODIFIER = (s) => ['draft', 'scheduled'].includes(s);
export const PEUT_ANNULER = (s) => ['scheduled', 'sending'].includes(s);
export const PEUT_SUPPRIMER = (s) => ['draft', 'cancelled'].includes(s);
