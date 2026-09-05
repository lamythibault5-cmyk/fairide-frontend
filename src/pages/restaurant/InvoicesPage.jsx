import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import InvoiceArchive from '../../components/InvoiceArchive';
import { useLanguage, getLocale } from '../../context/LanguageContext';

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Deux documents distincts : les factures d'abonnement Fairide (générées et hébergées par Stripe,
// via le portail client) et la facture de commission d'un mois donné — celle-ci est une vraie facture
// au sens légal (mentions obligatoires belges, Code TVA art. 5 AR n°1 ; numérotée séquentiellement et
// figée côté backend, voir POST /restaurants/:id/commission-invoice) puisque Fairide facture un
// service (la commission) au restaurant.
export default function InvoicesPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId } = useOutletContext();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [month, setMonth] = useState(currentMonthValue());
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api(`/restaurants/${restoId}/commission-invoice?month=${month}`, { token })
      .then(setInvoice)
      .catch((e) => toast(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, restoId]);

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const r = await api(`/restaurants/${restoId}/subscription/portal`, { method: 'POST', token });
      window.location.href = r.url;
    } catch (e) {
      toast(e.message);
      setOpeningPortal(false);
    }
  }

  async function generateInvoice() {
    setGenerating(true);
    try {
      const r = await api(`/restaurants/${restoId}/commission-invoice`, { method: 'POST', token, body: { month } });
      setInvoice((prev) => ({ ...prev, ...r }));
      toast(t('invoicesResto.toastIssued', { number: r.invoiceNumber }));
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const fairide = invoice?.fairide;
  const periodLabel = new Date(`${month}-01`).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
  const periodRange = `01/${month.split('-')[1]}/${month.split('-')[0]} — ${lastDayOfMonth(month)}/${month.split('-')[1]}/${month.split('-')[0]}`;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('invoicesResto.title')}</h2>

      {/* Archive de tout ce qui a déjà été émis, en plus de la vue mois par mois plus bas qui sert, elle,
          à préparer et émettre la facture d'une période donnée. */}
      <InvoiceArchive
        endpoint="/invoices/restaurant"
        pdfPath={(inv) => `/invoices/restaurant/${inv.id}/pdf`}
        titre={t('invoicesResto.archiveTitle')}
        description={t('invoicesResto.archiveDesc')}
        colonneMontant="Total TTC"
      />

      <div className="card no-print">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('invoicesResto.subscription')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('invoicesResto.subscriptionHelp')}
        </p>
        <button className="btn-ghost" disabled={openingPortal} onClick={openPortal}>
          {openingPortal ? '...' : t('invoicesResto.viewSubInvoices')}
        </button>
      </div>

      <div className="card no-print">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('invoicesResto.commissionInvoice')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('invoicesResto.commissionHelp')}
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
          {invoice?.items?.length > 0 && <button className="btn-teal" onClick={() => window.print()}>{t('invoicesResto.print')}</button>}
        </div>
      </div>

      {loading && <div className="card">{t('invoicesResto.loading')}</div>}

      {!loading && fairide && !fairide.configured && (
        <div className="card no-print" style={{ border: '2px solid var(--red)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--red)' }}>{t('invoicesResto.incompleteConfig')}</h3>
          <p className="small" style={{ margin: 0 }}>
            {t('invoicesResto.incompleteConfigHelp')}
          </p>
        </div>
      )}

      {!loading && invoice && (
        <div className="card" id="commission-recap">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>FACTURE</h3>
              {invoice.issued ? (
                <div className="small">N° <b>{invoice.invoiceNumber}</b> {t('invoicesResto.issuedOn', { date: new Date(invoice.issuedAt).toLocaleDateString(getLocale()) })}</div>
              ) : (
                <div className="small" style={{ fontStyle: 'italic' }}>{t('invoicesResto.previewNotIssued')}</div>
              )}
              <div className="small">{t('invoicesResto.servicePeriod', { range: periodRange })}</div>
            </div>
            {!invoice.issued && !generating && invoice.items?.length > 0 && fairide?.configured && (
              <button className="btn-gold no-print" onClick={generateInvoice}>{t('invoicesResto.generate')}</button>
            )}
            {generating && <span className="small">{t('invoicesResto.generating')}</span>}
          </div>

          <div className="row" style={{ gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="small" style={{ textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>{t('invoicesResto.issuer')}</div>
              {fairide?.configured ? (
                <>
                  <div style={{ fontWeight: 700 }}>{fairide.legalName}</div>
                  <div className="small">{fairide.address}</div>
                  <div className="small">{t('invoicesResto.companyVat', { vat: fairide.vatNumber })}</div>
                  <div className="small">{fairide.rpm}</div>
                  <div className="small">{t('invoicesResto.iban', { iban: fairide.iban })}</div>
                </>
              ) : (
                <div className="small" style={{ opacity: 0.6 }}>{t('invoicesResto.notConfigured')}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="small" style={{ textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>{t('invoicesResto.client')}</div>
              <div style={{ fontWeight: 700 }}>{restaurant.legalName || restaurant.name}</div>
              <div className="small">{restaurant.address}</div>
              {restaurant.companyNumber && <div className="small">{t('invoicesResto.companyNumber', { n: restaurant.companyNumber })}</div>}
              {restaurant.vatNumber && <div className="small">{t('invoicesResto.vatNumber', { n: restaurant.vatNumber })}</div>}
            </div>
          </div>

          <h4 style={{ margin: '0 0 10px' }}>{t('invoicesResto.serviceCommission', { period: periodLabel })}</h4>
          {(!invoice.items || invoice.items.length === 0) && <div className="empty">{t('invoicesResto.noPaidOrders')}</div>}
          {invoice.items?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>{t('invoicesResto.date')}</th>
                  <th style={{ padding: '6px 4px' }}>{t('invoicesResto.description')}</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t('invoicesResto.priceExVat')}</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>TVA</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(o.createdAt).toLocaleDateString(getLocale())}</td>
                    <td style={{ padding: '6px 4px' }}>{t('invoicesResto.serviceCommissionOrder', { id: o.id.slice(0, 8) })}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.commission.toFixed(2)}€</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(invoice.vatRate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px' }} colSpan={2}>{t('invoicesResto.totalExVat')}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{invoice.subtotalHt.toFixed(2)}€</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px' }} colSpan={2}>{t('invoicesResto.vatRate', { rate: (invoice.vatRate * 100).toFixed(0) })}</td>
                  <td style={{ padding: '4px', textAlign: 'right' }} colSpan={2}>{invoice.vatAmount.toFixed(2)}€</td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '8px 4px' }} colSpan={2}>{t('invoicesResto.totalIncVat')}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{invoice.totalTtc.toFixed(2)}€</td>
                </tr>
              </tfoot>
            </table>
          )}

          <p className="small" style={{ marginTop: 16 }}>
            {t('invoicesResto.paymentTerms')}
          </p>
        </div>
      )}
    </div>
  );
}
