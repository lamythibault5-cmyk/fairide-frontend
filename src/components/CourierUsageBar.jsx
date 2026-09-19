import { getLocale } from '../context/LanguageContext';

// Jauge du plafond annuel d'économie collaborative, partagée par le dossier livreur (Onboarding),
// « Mon contrat et mes conditions » (DriverContractTerms) et la page « Mes gains » (EarningsPage).
// Les niveaux d'alerte viennent de la configuration fiscale de l'année (legal.p2pAlertLevels) : la
// couleur passe à l'orange au premier niveau, au rouge au dernier, et reste rouge au-delà de 100 %.
// Aucun montant ni taux n'est écrit ici : tout vient de l'API.
const NIVEAUX_DEFAUT = [70, 90];

export function niveauxAlerte(legal) {
  const n = Array.isArray(legal?.p2pAlertLevels) ? legal.p2pAlertLevels.map(Number).filter((x) => Number.isFinite(x)) : [];
  return n.length ? [...n].sort((a, b) => a - b) : NIVEAUX_DEFAUT;
}

// « 70 % et 90 % » — liste lisible des niveaux, pour les textes d'aide.
export function libelleNiveaux(niveaux, et) {
  const l = niveaux.map((x) => `${x} %`);
  return l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} ${et} ${l[l.length - 1]}`;
}

export function tonalitePlafond(pct, niveaux) {
  if (pct >= 100) return 'danger';
  if (niveaux.length && pct >= niveaux[niveaux.length - 1]) return 'danger';
  if (niveaux.length && pct >= niveaux[0]) return 'warn';
  return 'ok';
}

export const euroPlafond = (n) => `${Number(n || 0).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// situation : { used, max, pct (0..1), remaining, bloque } — forme de /couriers/me (situation) ou de
// /couriers/me/earnings (ceiling). legal : configuration fiscale (pour les niveaux). t : traduction.
export default function CourierUsageBar({ situation, legal, t, year, showRemaining = true, children }) {
  if (!situation || !(Number(situation.max) > 0)) return null;
  const niveaux = niveauxAlerte(legal || { p2pAlertLevels: situation.alertLevels });
  const pctBrut = situation.pct != null ? Number(situation.pct) * 100 : (Number(situation.used || 0) / Number(situation.max)) * 100;
  const pct = Math.max(0, Math.round(pctBrut));
  const tone = tonalitePlafond(pct, niveaux);
  const restant = situation.remaining != null ? Number(situation.remaining) : Math.max(0, Number(situation.max) - Number(situation.used || 0));
  const bloque = situation.bloque || pct >= 100;
  return (
    <div className="courier-usage">
      <p className="small" style={{ margin: '0 0 6px' }}>{t('courierOnboarding.incomeUsed', { used: euroPlafond(situation.used), max: euroPlafond(situation.max) })}</p>
      <div className={`courier-bar ${tone}`} role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <p className="small" style={{ margin: '6px 0 0' }}>
        {pct} %
        {showRemaining && !bloque && ` · ${t('courierOnboarding.remainingCeiling', { amount: euroPlafond(restant), year: year || legal?.year || new Date().getFullYear() })}`}
        {!bloque && tone !== 'ok' && ` · ⚠️ ${t('courierOnboarding.alertNear')}`}
        {bloque && ` · 🚫 ${t('courierOnboarding.alertBlocked')}`}
      </p>
      {children}
    </div>
  );
}
