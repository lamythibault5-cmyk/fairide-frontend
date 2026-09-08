import { useEffect, useMemo, useState } from 'react';
import { api, apiDownload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { SkeletonCards } from './Skeleton';

// Relevés détaillés des commissions (voir statements.js côté serveur) : le restaurateur choisit une
// période (raccourcis ou dates libres) et une granularité — semaine, mois, trimestre — et voit chaque
// groupe avec ses totaux et, déplié, chaque commande. Export PDF et CSV de la sélection. Document
// informatif : la facture mensuelle numérotée (onglet Factures) reste la pièce comptable.
function iso(d) { return d.toISOString().slice(0, 10); }
function aujourdHui() { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); }
function lundi(d) { const dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000); }
function plusJours(d, n) { return new Date(d.getTime() + n * 86400000); }

function periodePreset(cle) {
  const t = aujourdHui();
  const y = t.getUTCFullYear(); const m = t.getUTCMonth();
  switch (cle) {
    case 'semaine': return { from: iso(lundi(t)), to: iso(t) };
    case 'semaine_prec': { const l = plusJours(lundi(t), -7); return { from: iso(l), to: iso(plusJours(l, 6)) }; }
    case 'mois': return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(t) };
    case 'mois_prec': return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(plusJours(new Date(Date.UTC(y, m, 1)), -1)) };
    case 'trois_mois': return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(t) };
    case 'annee': return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(t) };
    default: return null;
  }
}

const euro = (n) => `${Number(n || 0).toFixed(2)} €`;

export default function CommissionStatements() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [preset, setPreset] = useState('mois');
  const [group, setGroup] = useState('week');
  const [perso, setPerso] = useState(periodePreset('mois'));
  const [data, setData] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [telechargement, setTelechargement] = useState(null);

  const periode = useMemo(() => (preset === 'perso' ? perso : periodePreset(preset)), [preset, perso]);
  const requete = periode && periode.from && periode.to && periode.from <= periode.to
    ? `/invoices/restaurant/statement?from=${periode.from}&to=${periode.to}&group=${group}` : null;

  useEffect(() => {
    if (!requete) return;
    setChargement(true);
    api(requete, { token })
      .then((d) => { setData(d); setOuverts(new Set(d.groups.slice(0, 1).map((g) => g.key))); })
      .catch((e) => { toast(e.message); setData({ groups: [], totals: { count: 0, sales: 0, commissionHt: 0, vat: 0, ttc: 0, avgRate: 0 } }); })
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requete]);

  async function exporter(format) {
    if (!requete) return;
    setTelechargement(format);
    try { await apiDownload(`${requete}&format=${format}`, { token, filename: `releve-fairide-${periode.from}_${periode.to}.${format}` }); } catch (e) { toast(e.message); } finally { setTelechargement(null); }
  }

  function basculer(key) { setOuverts((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; }); }

  const presets = [
    ['semaine', t('statements.thisWeek')], ['semaine_prec', t('statements.lastWeek')], ['mois', t('statements.thisMonth')],
    ['mois_prec', t('statements.lastMonth')], ['trois_mois', t('statements.last3Months')], ['annee', t('statements.thisYear')], ['perso', t('statements.custom')]
  ];
  const groupes = [['week', t('statements.byWeek')], ['month', t('statements.byMonth')], ['quarter', t('statements.byQuarter')]];
  const T = data?.totals;

  return (
    <div>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('statements.title')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t('statements.intro')}</p>
        <div className="small" style={{ fontWeight: 700, margin: '0 0 6px' }}>{t('statements.period')}</div>
        <div className="role-pick statements-chips" style={{ marginBottom: 10 }}>
          {presets.map(([cle, label]) => (
            <div key={cle} role="button" tabIndex={0} className={`chip${preset === cle ? ' active' : ''}`} onClick={() => setPreset(cle)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreset(cle); }}>{label}</div>
          ))}
        </div>
        {preset === 'perso' && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="stmt-from">{t('statements.from')}</label>
              <input id="stmt-from" type="date" value={perso.from} max={perso.to} onChange={(e) => setPerso((p) => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="stmt-to">{t('statements.to')}</label>
              <input id="stmt-to" type="date" value={perso.to} min={perso.from} onChange={(e) => setPerso((p) => ({ ...p, to: e.target.value }))} />
            </div>
          </div>
        )}
        <div className="small" style={{ fontWeight: 700, margin: '0 0 6px' }}>{t('statements.groupBy')}</div>
        <div className="role-pick statements-chips">
          {groupes.map(([cle, label]) => (
            <div key={cle} role="button" tabIndex={0} className={`chip${group === cle ? ' active' : ''}`} onClick={() => setGroup(cle)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setGroup(cle); }}>{label}</div>
          ))}
        </div>
      </div>

      {chargement && <SkeletonCards count={2} />}

      {!chargement && data && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t('statements.summaryTitle', { from: new Date(periode.from).toLocaleDateString(getLocale()), to: new Date(periode.to).toLocaleDateString(getLocale()) })}</div>
                <div className="small">{t('statements.summaryNote')}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn-outline" disabled={!!telechargement || !T?.count} onClick={() => exporter('pdf')}>{telechargement === 'pdf' ? '...' : '⬇️ PDF'}</button>
                <button type="button" className="btn-outline" disabled={!!telechargement || !T?.count} onClick={() => exporter('csv')}>{telechargement === 'csv' ? '...' : '⬇️ CSV (Excel)'}</button>
              </div>
            </div>
            <div className="stat-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card"><div className="num">{T.count}</div><div className="label">{t('statements.orders')}</div></div>
              <div className="stat-card"><div className="num">{euro(T.sales)}</div><div className="label">{t('statements.sales')}</div></div>
              <div className="stat-card"><div className="num">{euro(T.commissionHt)}</div><div className="label">{t('statements.commissionExVat')}</div></div>
              <div className="stat-card"><div className="num">{euro(T.vat)}</div><div className="label">{t('statements.vat')}</div></div>
              <div className="stat-card highlight"><div className="num">{euro(T.ttc)}</div><div className="label">{t('statements.commissionIncVat')}</div></div>
              <div className="stat-card"><div className="num">{(T.avgRate * 100).toFixed(1)} %</div><div className="label">{t('statements.avgRate')}</div></div>
            </div>
          </div>

          {data.groups.length === 0 && <div className="empty">{t('statements.none')}</div>}

          {data.groups.map((g) => {
            const ouvert = ouverts.has(g.key);
            const facture = data.invoicedMonths?.[g.key];
            return (
              <div className="card statements-group" key={g.key} style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" className="statements-group-head" onClick={() => basculer(g.key)} aria-expanded={ouvert}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{g.label}</div>
                    <div className="small">
                      {t('statements.groupSub', { n: g.totals.count, sales: euro(g.totals.sales) })}
                      {group === 'month' && facture && <span className="pill teal" style={{ marginLeft: 8 }}>{t('statements.invoiceIssued', { number: facture.invoiceNumber })}</span>}
                      {group === 'month' && !facture && <span className="pill" style={{ marginLeft: 8 }}>{t('statements.invoicePending')}</span>}
                    </div>
                  </div>
                  <div className="statements-group-totals">
                    <div><span className="small">{t('statements.commissionExVat')}</span><b>{euro(g.totals.commissionHt)}</b></div>
                    <div><span className="small">{t('statements.vat')}</span><b>{euro(g.totals.vat)}</b></div>
                    <div><span className="small">TTC</span><b>{euro(g.totals.ttc)}</b></div>
                  </div>
                  <span aria-hidden="true" style={{ fontSize: 18, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                </button>
                {ouvert && (
                  <div className="invoice-table-wrap" style={{ borderTop: '1px solid var(--line)' }}>
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>{t('statements.colDate')}</th>
                          <th>{t('statements.colOrder')}</th>
                          <th className="num">{t('statements.colOrderAmount')}</th>
                          <th className="num">{t('statements.colRate')}</th>
                          <th className="num">{t('statements.commissionExVat')}</th>
                          <th className="num">{t('statements.vat')}</th>
                          <th className="num">TTC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.orders.map((o) => (
                          <tr key={o.id}>
                            <td>{new Date(o.createdAt).toLocaleDateString(getLocale())}<div className="small">{new Date(o.createdAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</div></td>
                            <td><b>#{String(o.id).slice(0, 8)}</b><div className="small">{o.typeLabel}{o.promoDiscount > 0 ? ` · ${t('statements.discount', { n: euro(o.promoDiscount) })}` : ''}</div></td>
                            <td className="num">{euro(o.subtotal)}</td>
                            <td className="num">{(o.rate * 100).toFixed(1)} %</td>
                            <td className="num">{euro(o.commission)}</td>
                            <td className="num">{euro(o.commissionVat)}</td>
                            <td className="num"><b>{euro(o.commissionTtc)}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
