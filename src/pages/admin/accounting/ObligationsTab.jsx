import { useState } from 'react';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { money, downloadPdf } from '../adminUtils';
import { useApiData, LoadState } from './common';
import ExportMensuel from './ExportMensuel';

/* Obligations de la société (audit comptable du 7 oct. 2026) : les prochaines échéances — déclaration TVA, DAC7, listing
 * annuel des clients assujettis, comptes annuels, impôt des sociétés, registre UBO — et le listing annuel prêt à déposer
 * sur Intervat. Les dates viennent du serveur (GET /admin/accounting/obligations), qui suit les délais en vigueur depuis
 * 2025 ; le calendrier officiel du SPF Finances fait foi (week-ends, régime d'été). */
export default function ObligationsTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const obligations = useApiData(() => api('/admin/accounting/obligations', { token }), []);
  const [annee, setAnnee] = useState(new Date().getFullYear() - 1);
  const listing = useApiData(() => api(`/admin/accounting/client-listing?year=${annee}`, { token }), [annee]);
  const [busy, setBusy] = useState(false);

  async function telechargerListing() {
    setBusy(true);
    try { await downloadPdf(`/admin/accounting/client-listing?year=${annee}&format=xml`, token, `listing-clients-${annee}.xml`); }
    catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  const couleur = (j) => (j === null ? 'var(--line)' : j < 0 ? 'var(--red)' : j <= 14 ? 'var(--orange)' : 'var(--iris)');

  return (
    <>
      <div className="card" style={{ borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>{tr('adminAccounting.obligationsIntro')}</p>
      </div>
      {/* CODE-8 : l'export du mois pour le logiciel comptable, et son archivage hors de Railway. */}
      <ExportMensuel token={token} toast={toast} />
      <LoadState state={obligations} skeleton={3}>
        {(d) => (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{tr('adminAccounting.obligationsTitle')}</h3>
            {d.items.map((o) => (
              <div key={o.key} className="row" style={{ gap: 12, alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid var(--line)', borderLeft: `3px solid ${couleur(o.daysLeft)}`, paddingLeft: 10 }}>
                <div style={{ minWidth: 110 }}><b>{o.dueDate ? new Date(o.dueDate).toLocaleDateString() : tr('adminAccounting.obligationsNoDate')}</b>
                  {o.daysLeft !== null && <div className="small" style={{ opacity: 0.7 }}>{o.daysLeft < 0 ? tr('adminAccounting.obligationsLate', { n: -o.daysLeft }) : tr('adminAccounting.obligationsDaysLeft', { n: o.daysLeft })}</div>}
                </div>
                <div style={{ flex: 1 }}>{o.label}<div className="small" style={{ opacity: 0.7 }}>{o.where} · {o.tool}</div></div>
              </div>
            ))}
            <p className="small" style={{ opacity: 0.7, marginBottom: 0 }}>{tr(d.periodicity === 'monthly' ? 'adminAccounting.obligationsMonthly' : 'adminAccounting.obligationsQuarterly')}</p>
          </div>
        )}
      </LoadState>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{tr('adminAccounting.listingTitle')}</h3>
        <p className="small">{tr('adminAccounting.listingIntro')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="listing-annee" className="small">{tr('adminAccounting.listingYear')}</label>
          <select id="listing-annee" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 'auto' }}>
            {[0, 1, 2].map((i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn-teal" disabled={busy} onClick={telechargerListing}>{busy ? '…' : tr('adminAccounting.listingDownload')}</button>
        </div>
        <LoadState state={listing} skeleton={2}>
          {(l) => (
            <>
              <p className="small" style={{ marginBottom: 4 }}>{tr('adminAccounting.listingClients', { n: l.clients.length, ht: money(l.totals.turnover), tva: money(l.totals.vatAmount), date: new Date(l.deadline).toLocaleDateString() })}</p>
              {l.clients.map((c) => <div key={c.restaurantId} className="small">{c.name} · {c.vatNumber} · {money(c.turnover)} · {tr('adminCommon.vat')} {money(c.vatAmount)}</div>)}
              {l.missingVatNumber.length > 0 && (
                <p className="small" style={{ color: 'var(--red)' }}>{tr('adminAccounting.listingMissingVat', { names: l.missingVatNumber.map((c) => c.name).join(', ') })}</p>
              )}
            </>
          )}
        </LoadState>
      </div>
    </>
  );
}
