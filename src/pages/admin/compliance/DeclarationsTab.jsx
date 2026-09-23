import { useEffect, useId, useState } from 'react';
import { api, apiDownload } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { SkeletonCards } from '../../../components/Skeleton';
import { ErrorCard } from '../../../components/admin/AdminListTools';
import ConfirmDialog from '../../../components/ConfirmDialog';

/* Déclarations annuelles et semestrielles (backlog du 23/09/2026 : A10, B8, D5).
 * Backend : fairide-backend/routes/conformiteP1.js — tout y est calculé à la demande, rien n'est stocké.
 *
 *   DAC7 — les deux populations : livreurs (service) et commerces (biens ; déclarables dès 30 ventes OU
 *          plus de 2 000 €). Les données manquantes s'affichent par commerce, pour relancer à la main (le
 *          cycle automatique rappel → blocage attend la migration 009). L'envoi des copies annuelles est
 *          un geste volontaire, après vérification des chiffres par le comptable — d'où la confirmation.
 *   Registre art. 17 (directive 2024/2831) — livreurs actifs par statut, durée d'activité, revenu
 *          hebdomadaire moyen, sur un semestre. */
const ANNEE_PASSEE = new Date().getFullYear() - 1;
const SEMESTRES = (() => {
  const a = new Date().getFullYear();
  return [`${a}-S1`, `${a - 1}-S2`, `${a - 1}-S1`, `${a - 2}-S2`];
})();

export default function DeclarationsTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [annee, setAnnee] = useState(ANNEE_PASSEE);
  const [dac7, setDac7] = useState(null);
  const [semestre, setSemestre] = useState(SEMESTRES[1]);
  const [registre, setRegistre] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [essai, setEssai] = useState(0); // « Réessayer » relance les deux chargements

  useEffect(() => { setDac7(null); api(`/admin/compliance/dac7?year=${annee}`, { token }).then(setDac7).catch((e) => setErreur(e.message)); }, [token, annee, essai]);
  useEffect(() => { setRegistre(null); api(`/admin/compliance/platform-work?semester=${semestre}`, { token }).then(setRegistre).catch((e) => setErreur(e.message)); }, [token, semestre, essai]);

  const exporter = (population) => apiDownload(`/admin/compliance/dac7/export.csv?year=${annee}&population=${population}`, { token, filename: `dac7-${population}-${annee}.csv` }).catch((e) => toast(e.message, 'erreur'));
  async function envoyerCopies() {
    setOccupe(true);
    try { const r = await api('/admin/compliance/dac7/send-copies', { method: 'POST', token, body: { year: annee } }); toast(t('conformite.dac7CopiesSent', { sent: r.sent, failed: r.failed })); }
    catch (e) { toast(e.message, 'erreur'); }
    finally { setOccupe(false); setEnvoi(false); }
  }
  const declarables = dac7?.restaurants.filter((r) => r.reportable) || [];
  const incomplets = declarables.filter((r) => r.missing.length);

  return (
    <div className="card" style={{ marginTop: 0 }}>
      {erreur && <ErrorCard message={erreur} onRetry={() => { setErreur(null); setEssai((n) => n + 1); }} />}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>{t('conformite.dac7Title')}</h4>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${id}-an`}>{t('conformite.dac7Year')}</label>
          <select id={`${id}-an`} value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {[ANNEE_PASSEE + 1, ANNEE_PASSEE, ANNEE_PASSEE - 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <p className="small" style={{ margin: '6px 0 12px', color: 'var(--ink-soft)' }}>{t('conformite.dac7Help')}</p>
      {!dac7 && !erreur && <SkeletonCards count={1} />}
      {dac7 && (
        <>
          <div className="stat-grid" style={{ marginBottom: 12 }}>
            <div className="stat-card"><div className="num">{dac7.couriers.count}</div><div className="label">{t('conformite.dac7Couriers')}</div></div>
            <div className="stat-card"><div className="num">{declarables.length}</div><div className="label">{t('conformite.dac7Restaurants')}</div></div>
            <div className="stat-card"><div className="num">{incomplets.length}</div><div className="label">{t('conformite.dac7Incomplete')}</div></div>
          </div>
          {dac7.restaurants.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>{t('conformite.dac7ColRestaurant')}</th><th>{t('conformite.dac7ColSales')}</th><th>{t('conformite.dac7ColAmount')}</th><th>{t('conformite.dac7ColStatus')}</th></tr></thead>
                <tbody>
                  {dac7.restaurants.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.sales}</td>
                      <td>{Number(r.consideration).toFixed(2)} €</td>
                      <td className="small">
                        {!r.reportable ? t('conformite.dac7Excluded')
                          : r.missing.length ? <span style={{ color: 'var(--red)' }}>{t('conformite.dac7Missing', { list: r.missing.map((m) => t(`conformite.dac7Field_${m}`)).join(', ') })}</span>
                          : t('conformite.dac7Complete')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-outline" onClick={() => exporter('restaurants')}>{t('conformite.dac7ExportRestaurants')}</button>
            <button type="button" className="btn-outline" onClick={() => exporter('couriers')}>{t('conformite.dac7ExportCouriers')}</button>
            <button type="button" className="btn-teal" disabled={occupe} onClick={() => setEnvoi(true)}>{t('conformite.dac7SendCopies')}</button>
          </div>
          <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('conformite.dac7XmlNote')}</p>
        </>
      )}

      <div className="divider" style={{ margin: '20px 0' }} />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>{t('conformite.art17Title')}</h4>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${id}-sem`}>{t('conformite.art17Semester')}</label>
          <select id={`${id}-sem`} value={semestre} onChange={(e) => setSemestre(e.target.value)}>
            {SEMESTRES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {!registre && !erreur && <SkeletonCards count={1} />}
      {registre && (
        <>
          <p className="small" style={{ margin: '6px 0 12px' }}>{t('conformite.art17Summary', { n: registre.activeCouriers, i: registre.intermediaries })}</p>
          {registre.byStatus.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>{t('conformite.art17ColStatus')}</th><th>{t('conformite.art17ColCouriers')}</th><th>{t('conformite.art17ColDeliveries')}</th><th>{t('conformite.art17ColWeeks')}</th><th>{t('conformite.art17ColSpan')}</th><th>{t('conformite.art17ColIncome')}</th></tr></thead>
                <tbody>
                  {registre.byStatus.map((s) => (
                    <tr key={s.status}><td>{s.status}</td><td>{s.activeCouriers}</td><td>{s.deliveries}</td><td>{s.avgActiveWeeks}</td><td>{s.avgActivitySpanDays}</td><td>{s.avgWeeklyGrossIncome.toFixed(2)} €</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{registre.method}</p>
        </>
      )}

      <ConfirmDialog open={envoi} title={t('conformite.dac7SendCopies')} message={t('conformite.dac7SendConfirm', { year: annee })}
        confirmLabel={t('conformite.dac7SendCopies')} loading={occupe} onConfirm={envoyerCopies} onCancel={() => setEnvoi(false)} />
    </div>
  );
}
