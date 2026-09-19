import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import CourierUsageBar, { niveauxAlerte, libelleNiveaux } from '../../components/CourierUsageBar';

// « Mes gains » (livreur) : ce que Fairide a versé sur l'année, brut / précompte / net, par mois et par
// course (/couriers/me/earnings), avec la jauge du plafond pour l'économie collaborative et un rappel
// des règles du statut. Aucun chiffre légal n'est écrit ici : tout vient de `legal` (/couriers/me).
// Cette page n'affiche ni classement, ni objectif, ni cadence : elle rend compte, elle n'impose rien.
const PREMIERE_ANNEE = 2026;
const euro = (n) => `${Number(n || 0).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pctTexte = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })} %`);
// Montant signé : une contre-écriture ou une correction négative se lit en rouge, sans ambiguïté.
function Montant({ v, strong }) {
  const n = Number(v || 0);
  const style = n < 0 ? { color: 'var(--red)' } : undefined;
  return strong ? <b style={style}>{euro(n)}</b> : <span style={style}>{euro(n)}</span>;
}

export default function EarningsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const idsA11y = useId();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [gains, setGains] = useState(null);
  const [dossier, setDossier] = useState(null);
  const annees = useMemo(() => { const a = new Date().getFullYear(); const l = []; for (let y = a; y >= Math.min(a, PREMIERE_ANNEE); y--) l.push(y); return l; }, []);

  useEffect(() => { api('/couriers/me', { token }).then(setDossier).catch(() => setDossier({})); }, [token]);
  useEffect(() => {
    setGains(null);
    api(`/couriers/me/earnings?year=${annee}`, { token }).then(setGains).catch((e) => { toast(e.message); setGains({ year: annee, totals: {}, byMonth: [], lines: [], ceiling: null }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, annee]);

  const legal = dossier?.legal ?? {};
  const statut = dossier?.courier?.statusType;
  const totaux = gains?.totals ?? {};
  const mois = gains?.byMonth ?? [];
  const lignes = gains?.lines ?? [];
  const plafond = gains?.ceiling ?? null;
  const locale = getLocale();
  const et = locale.startsWith('fr') ? 'et' : locale.startsWith('nl') ? 'en' : 'and';
  const nomMois = (m) => new Date(annee, Number(m) - 1, 1).toLocaleDateString(locale, { month: 'long' });
  const aide = statut === 'p2p' ? t('driverPay.help_p2p', { rate: pctTexte(legal.p2pWithholdingRate) })
    : statut === 'student_independent' ? t('driverPay.help_student_independent')
    : statut === 'independent' ? t('driverPay.help_independent', { rate: pctTexte(legal.independentSocialRate) }) : null;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>{t('driverPay.title')}</h2>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={idsA11y + '-year'}>{t('driverPay.year')}</label>
          <select id={idsA11y + '-year'} value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>{annees.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('driverPay.intro')}</p>

      {!gains ? <SkeletonCards count={2} /> : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="num">{euro(totaux.gross)}</div><div className="label">{t('driverPay.totalGross')}</div></div>
            <div className="stat-card"><div className="num">{euro(totaux.withholding)}</div><div className="label">{t('driverPay.totalWithholding')}</div></div>
            <div className="stat-card highlight"><div className="num">{euro(totaux.net)}</div><div className="label">{t('driverPay.totalNet')}</div></div>
            <div className="stat-card"><div className="num">{totaux.deliveries ?? 0}</div><div className="label">{t('driverPay.totalDeliveries')}</div></div>
          </div>

          {plafond && Number(plafond.max) > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🤝 {t('driverPay.gaugeTitle', { year: annee })}</h3>
              <CourierUsageBar situation={plafond} legal={{ ...legal, p2pAlertLevels: plafond.alertLevels ?? legal.p2pAlertLevels }} t={t} year={annee}>
                <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('driverPay.alertLevels', { levels: libelleNiveaux(niveauxAlerte({ p2pAlertLevels: plafond.alertLevels ?? legal.p2pAlertLevels }), et) })}</p>
              </CourierUsageBar>
            </div>
          )}

          {aide && <div className="card"><p className="small" style={{ margin: 0 }}>ℹ️ {aide}</p></div>}

          {mois.length === 0 && lignes.length === 0 && <div className="empty">{t('driverPay.none')}</div>}

          {mois.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('driverPay.byMonth')}</h3>
              <div className="service-table-wrap">
                <table className="service-table paiement-table">
                  <thead><tr><th>{t('driverPay.month')}</th><th>{t('driverPay.deliveries')}</th><th>{t('driverPay.gross')}</th><th>{t('driverPay.withholding')}</th><th>{t('driverPay.net')}</th></tr></thead>
                  <tbody>
                    {mois.map((m) => (
                      <tr key={m.month}>
                        <td style={{ textTransform: 'capitalize' }}>{nomMois(m.month)}</td>
                        <td>{m.deliveries ?? 0}</td>
                        <td><Montant v={m.gross} /></td>
                        <td><Montant v={m.withholding} /></td>
                        <td><Montant v={m.net} strong /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td><b>{annee}</b></td><td>{totaux.deliveries ?? 0}</td><td>{euro(totaux.gross)}</td><td>{euro(totaux.withholding)}</td><td><b>{euro(totaux.net)}</b></td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {lignes.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('driverPay.lines')}</h3>
              <div className="service-table-wrap">
                <table className="service-table paiement-table">
                  <thead><tr><th>{t('driverPay.date')}</th><th>{t('driverPay.order')}</th><th>{t('driverPay.kind')}</th><th>{t('driverPay.gross')}</th><th>{t('driverPay.withholding')}</th><th>{t('driverPay.net')}</th><th>{t('driverPay.status')}</th></tr></thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id}>
                        <td>{l.earnedAt ? new Date(l.earnedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '-'}</td>
                        <td>{l.orderId ? `#${String(l.orderId).slice(0, 8)}` : '-'}</td>
                        <td>{['delivery', 'tip', 'reversal', 'correction'].includes(l.kind) ? t(`driverPay.kind_${l.kind}`) : l.kind}{l.reversesId ? ' ↩︎' : ''}</td>
                        <td><Montant v={l.gross} /></td>
                        <td>{Number(l.withholding || 0) !== 0 ? <><Montant v={l.withholding} />{l.withholdingRate != null ? <span className="small" style={{ opacity: 0.7 }}> ({pctTexte(l.withholdingRate)})</span> : null}</> : '-'}</td>
                        <td><Montant v={l.net} strong /></td>
                        <td>{l.statusAtTime ? t(`courierOnboarding.status_${l.statusAtTime}`) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      <p className="small" style={{ margin: '8px 0 0' }}><Link to="/driver/invoices">{t('driverPay.invoicesLink')}</Link> · <Link to="/driver/onboarding">{t('driverPay.fileLink')}</Link></p>
    </div>
  );
}
