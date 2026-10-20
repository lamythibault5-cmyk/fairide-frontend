import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { achatsCommerceAutorises, allerAuPaiement, experienceApp } from '../../natif';
import { useAuth } from '../../context/AuthContext';
import CopieDac7 from '../../components/conformite/CopieDac7';
import { useToast } from '../../context/ToastContext';
import InvoiceArchive from '../../components/InvoiceArchive';
import CommissionStatements from '../../components/CommissionStatements';
import InvoicePreferences from '../../components/InvoicePreferences';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import CadreSite from '../../components/commerce/CadreSite';
import { SegmentGlisse } from '../../components/commerce/BandeauCommerce';
import EtatVide from '../../components/EtatVide';

// Facture sans TVA : Fairide est sous le régime de la franchise depuis le 7/9/2026 (lettre du SPF Finances du 12/10/2026).
// Jugé par facture : une facture émise avec TVA garde ses colonnes.
const sansTva = (inv) => !(Number(inv?.vatAmount) > 0) && !(Number(inv?.vatRate) > 0);

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
//
// BANDEAU ET FEUILLE, DANS L'APP AUSSI (fondateur, 2026-10-19, section 4 de finitions-appli.html) : le titre et sa phrase
// sur le bandeau iris ; les trois onglets deviennent le curseur à pouce iris (SegmentGlisse, comme le temps de préparation) ;
// chaque bloc est une section à titre en capitales, sans cadre. Les blocs partagés avec le livreur (InvoiceArchive,
// InvoicePreferences, CommissionStatements) ne changent pas : c'est .ec-bloc (ecran-commerce.css) qui efface leur cadre ici.
// L'aperçu de la facture reste un document, imprimé seul : le bandeau ne s'imprime pas (même fichier CSS).
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
  // Trois onglets : les factures (pièces comptables, mensuelles), les relevés détaillés (suivi libre par
  // semaine / mois / trimestre), l'abonnement (factures Stripe). L'onglet ouvert survit à un rechargement.
  const [onglet, setOnglet] = useState(() => {
    try { const o = sessionStorage.getItem('fairide_factures_onglet') || 'factures'; return o === 'abonnement' && !achatsCommerceAutorises() ? 'factures' : o; } catch { return 'factures'; }
  });
  function choisirOnglet(o) { setOnglet(o); try { sessionStorage.setItem('fairide_factures_onglet', o); } catch { /* sans stockage */ } }

  useEffect(() => {
    setLoading(true);
    api(`/restaurants/${restoId}/commission-invoice?month=${month}`, { token })
      .then(setInvoice)
      .catch((e) => toast(e.message, 'erreur'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, restoId]);

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const r = await api(`/restaurants/${restoId}/subscription/portal`, { method: 'POST', token });
      // Dans l'app, Stripe s'ouvre dans le navigateur intégré et l'on revient ici en le fermant (allerAuPaiement, natif.js) ;
      // sur le site, rien ne change : la page part vers Stripe.
      await allerAuPaiement(r.url, { retour: '/dashboard/invoices' });
      setOpeningPortal(false);
    } catch (e) {
      toast(e.message, 'erreur');
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
      toast(e.message, 'erreur');
    } finally {
      setGenerating(false);
    }
  }

  const fairide = invoice?.fairide;
  const periodLabel = new Date(`${month}-01`).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
  const periodRange = `01/${month.split('-')[1]}/${month.split('-')[0]}, ${lastDayOfMonth(month)}/${month.split('-')[1]}/${month.split('-')[0]}`;

  return (
    <CadreSite appli classe="ec-factures" titre={t('invoicesResto.title')} sous={t('invoicesResto.pageIntro')}>
      <div className="no-print ec-factures-onglets">
        <SegmentGlisse libelle={t('invoicesResto.title')} valeur={onglet} onChange={choisirOnglet}
          options={[['factures', t('invoicesResto.tabInvoices')], ['releves', t('invoicesResto.tabStatements')], ...(achatsCommerceAutorises() ? [['abonnement', t('invoicesResto.tabSubscription')]] : [])].map(([value, label]) => ({ value, label }))} />
      </div>

      {onglet === 'releves' && (
        <>
          <div className="ec-bloc ec-bloc--releves"><CommissionStatements /></div>
          {/* Copie DAC7 annuelle (A10) : ce que Fairide a déclaré au SPF Finances sur les ventes du commerce. */}
          <div className="no-print"><CopieDac7 chemin={(a) => `/restaurants/${restoId}/dac7/${a}.pdf`} token={token} /></div>
        </>
      )}

      {/* L'onglet Abonnement n'ouvre que le portail Stripe, où l'on paie : absent de l'app des magasins (natif.js). */}
      {onglet === 'abonnement' && achatsCommerceAutorises() && (
        <section className="no-print">
          {/* Titre en capitales, donc sans AvecMarque : le mot-logo reste toujours en minuscules. */}
          <p className="ec-feuille-titre">{t('invoicesResto.subscription')}</p>
          <p className="ec-aide">{t('invoicesResto.subscriptionHelp')}</p>
          <button type="button" className="ec-bouton ec-bouton--iris ec-bouton--court" disabled={openingPortal} onClick={openPortal}>
            {openingPortal ? '...' : t('invoicesResto.viewSubInvoices')}
          </button>
        </section>
      )}

      {onglet === 'factures' && (<>
      {/* Archive de tout ce qui a déjà été émis, en plus de la vue mois par mois plus bas qui sert, elle,
          à préparer et émettre la facture d'une période donnée. */}
      <div className="ec-bloc"><InvoiceArchive
        endpoint="/invoices/restaurant"
        pdfPath={(inv) => `/invoices/restaurant/${inv.id}/pdf`}
        ublPath={(inv) => `/invoices/restaurant/${inv.id}/ubl`}
        emailPath={(inv) => `/invoices/restaurant/${inv.id}/send`}
        titre={t('invoicesResto.archiveTitle')}
        description={t('invoicesResto.archiveDesc2')}
        // « Total », pas « Total TTC » : sous la franchise TVA (depuis le 7/9/2026), la facture de Fairide ne porte pas de TVA
        // et « TTC » laisserait croire le contraire ; une facture plus ancienne, avec TVA, garde son total juste. Même libellé
        // que les factures livreur (driver/InvoicesPage.jsx).
        colonneMontant="Total"
      /></div>

      <div className="ec-bloc"><InvoicePreferences /></div>

      <section className="no-print">
        <p className="ec-feuille-titre">{t('invoicesResto.commissionInvoice')}</p>
        <p className="ec-aide">{t('invoicesResto.commissionHelp')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
          {/* Imprimer n'existe pas dans l'application (WebView) : le bouton n'y faisait rien. */}
          {invoice?.items?.length > 0 && !experienceApp() && <button className="btn-teal" onClick={() => window.print()}>{t('invoicesResto.print')}</button>}
        </div>
      </section>

      {loading && <p className="ec-aide">{t('invoicesResto.loading')}</p>}

      {!loading && fairide && !fairide.configured && (
        <div className="ec-alerte no-print" role="alert">
          <b>{t('invoicesResto.incompleteConfig')}</b>
          <p>{t('invoicesResto.incompleteConfigHelp')}</p>
        </div>
      )}

      {!loading && invoice && (
        <div className="ec-document" id="commission-recap">
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
          {(!invoice.items || invoice.items.length === 0) && <EtatVide icone="document" titre={t('invoicesResto.noPaidOrders')} />}
          {invoice.items?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>{t('invoicesResto.date')}</th>
                  <th style={{ padding: '6px 4px' }}>{t('invoicesResto.description')}</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t('statements.colOrderAmount')}</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t(sansTva(invoice) ? 'invoicesResto.priceNoVat' : 'invoicesResto.priceExVat')}</th>
                  {!sansTva(invoice) && <th style={{ padding: '6px 4px', textAlign: 'right' }}>TVA</th>}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(o.createdAt).toLocaleDateString(getLocale())}</td>
                    <td style={{ padding: '6px 4px' }}>{t('invoicesResto.serviceCommissionOrder', { id: o.id.slice(0, 8) })}{o.orderType || o.typeLabel ? <span className="small"> · {o.orderType ? t(`orderStatus.orderType.${o.orderType === 'pickup' || o.orderType === 'takeaway' ? 'pickup' : 'delivery'}`) : o.typeLabel}</span> : null}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{euros(Number(o.subtotal || 0))}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{euros(o.commission)}</td>
                    {!sansTva(invoice) && <td style={{ padding: '6px 4px', textAlign: 'right' }}>{euros(Number(o.commissionVat || 0))} <span className="small">({(invoice.vatRate * 100).toFixed(0)}%)</span></td>}
                  </tr>
                ))}
              </tbody>
              {sansTva(invoice) ? (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 4px' }} colSpan={3}>{t('invoicesResto.totalNoVat')}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{euros(invoice.totalTtc)}</td>
                </tr>
              </tfoot>
              ) : (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px' }} colSpan={3}>{t('invoicesResto.totalExVat')}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{euros(invoice.subtotalHt)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px' }} colSpan={3}>{t('invoicesResto.vatRate', { rate: (invoice.vatRate * 100).toFixed(0) })}</td>
                  <td style={{ padding: '4px', textAlign: 'right' }} colSpan={2}>{euros(invoice.vatAmount)}</td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '8px 4px' }} colSpan={3}>{t('invoicesResto.totalIncVat')}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{euros(invoice.totalTtc)}</td>
                </tr>
              </tfoot>
              )}
            </table>
          )}

          <p className="small" style={{ marginTop: 16 }}>
            {t('invoicesResto.paymentTerms')}
          </p>
        </div>
      )}
      </>)}
    </CadreSite>
  );
}
