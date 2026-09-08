import { useEffect, useState } from 'react';
import { api, apiDownload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCards } from './Skeleton';
import { useLanguage, getLocale } from '../context/LanguageContext';
import PeppolSettings from './PeppolSettings';

// Archive des factures émises, partagée par le restaurateur (factures de commission) et le livreur
// (autofacturations). Les deux affichent la même chose — un historique, les montants HT/TVA/TTC, et le
// PDF — seuls l'endpoint et le vocabulaire changent, d'où un composant unique plutôt que deux tableaux
// jumeaux qui divergeraient à la première correction.

function formatPeriod(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const mois = s.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
  const jours = `${s.toLocaleDateString(getLocale())} → ${e.toLocaleDateString(getLocale())}`;
  return { mois, jours };
}

// Résolu au rendu (t n'existe pas au niveau module).
const statusLabels = (t) => ({
  emise: { texte: t('invoiceArchive.statusIssued'), pill: 'pill' },
  envoyee: { texte: t('invoiceArchive.statusSent'), pill: 'pill teal' },
  payee: { texte: t('invoiceArchive.statusPaid'), pill: 'pill teal' },
  annulee: { texte: t('invoiceArchive.statusCancelled'), pill: 'pill' }
});

// Statut Peppol d'un document (voir peppol.js côté serveur) → libellé et pastille.
export const peppolLabels = (t) => ({
  en_attente: { texte: t('peppol.stPending'), pill: 'pill' },
  envoye: { texte: t('peppol.stSent'), pill: 'pill teal' },
  erreur: { texte: t('peppol.stError'), pill: 'pill' },
  sans_identifiant: { texte: t('peppol.stNoId'), pill: 'pill' },
  non_enregistre: { texte: t('peppol.stNotRegistered'), pill: 'pill' },
  desactive: { texte: t('peppol.stDisabled'), pill: 'pill' }
});

export default function InvoiceArchive({ endpoint, pdfPath, ublPath, emailPath, titre, description, colonneMontant }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [mailId, setMailId] = useState(null);

  // Renvoi de la facture par e-mail à l'adresse du compte, PDF joint (voir POST /invoices/restaurant/:id/send).
  async function envoyerParEmail(inv) {
    setMailId(inv.id);
    try {
      const r = await api(emailPath(inv), { method: 'POST', token });
      toast(t('invoiceArchive.emailSent', { to: r.to || '' }));
      setData((d) => ({ ...d, invoices: d.invoices.map((x) => (x.id === inv.id ? { ...x, emailedAt: new Date().toISOString(), status: x.status === 'emise' ? 'envoyee' : x.status } : x)) }));
    } catch (e) {
      toast(e.message);
    } finally {
      setMailId(null);
    }
  }

  useEffect(() => {
    api(endpoint, { token })
      .then(setData)
      .catch((e) => { toast(e.message); setData({ invoices: [] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function download(inv, format = 'pdf') {
    setBusyId(inv.id);
    try {
      if (format === 'ubl' && ublPath) await apiDownload(ublPath(inv), { token, filename: `${inv.invoiceNumber}.xml` });
      else await apiDownload(pdfPath(inv), { token, filename: `${inv.invoiceNumber}.pdf` });
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <SkeletonCards count={2} />;

  const invoices = data.invoices || [];

  return (
    <>
    <PeppolSettings endpoint="/invoices/peppol/settings" />
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{titre}</h3>
      <p className="small" style={{ margin: '0 0 14px' }}>{description}</p>

      {invoices.length === 0 && (
        <div className="empty">
          {t('invoiceArchive.none')}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>{t('invoiceArchive.number')}</th>
                <th>{t('invoiceArchive.period')}</th>
                <th>{t('invoiceArchive.issuedOn')}</th>
                <th className="num">{t('invoiceArchive.amountExVat')}</th>
                <th className="num">TVA</th>
                <th className="num">{colonneMontant}</th>
                <th>{t('invoiceArchive.status')}</th>
                <th>{t('invoiceArchive.peppol')}</th>
                <th aria-label={t('invoiceArchive.download')} />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const p = formatPeriod(inv.periodStart, inv.periodEnd);
                const st = statusLabels(t)[inv.status] || statusLabels(t).emise;
                const pp = peppolLabels(t)[inv.peppolStatus] || peppolLabels(t).en_attente;
                return (
                  <tr key={inv.id}>
                    <td><b>{inv.invoiceNumber}</b></td>
                    <td>
                      <div style={{ textTransform: 'capitalize' }}>{p.mois}</div>
                      <div className="small">{p.jours}</div>
                    </td>
                    <td>{new Date(inv.issuedAt).toLocaleDateString(getLocale())}</td>
                    <td className="num">{inv.subtotalHt.toFixed(2)}€</td>
                    <td className="num">
                      {inv.vatAmount.toFixed(2)}€
                      {/* En franchise de TVA, un taux à 0 n'est pas une erreur d'affichage mais le régime
                          du livreur : on le nomme, sinon la ligne paraît incomplète. */}
                      {inv.vatStatus === 'franchise'
                        ? <div className="small">{t('invoiceArchive.vatExempt')}</div>
                        : <div className="small">{(inv.vatRate * 100).toFixed(0)}%</div>}
                    </td>
                    <td className="num"><b>{inv.totalTtc.toFixed(2)}€</b></td>
                    <td><span className={st.pill}>{st.texte}</span></td>
                    <td><span className={pp.pill} title={inv.peppolSentAt ? new Date(inv.peppolSentAt).toLocaleString(getLocale()) : ''}>{pp.texte}</span></td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-ghost" disabled={busyId === inv.id} onClick={() => download(inv)}>
                        {busyId === inv.id ? '...' : '⬇️ PDF'}
                      </button>
                      {ublPath && (
                        <button type="button" className="btn-ghost" disabled={busyId === inv.id} onClick={() => download(inv, 'ubl')} title={t('invoiceArchive.ublTitle')}>
                          UBL
                        </button>
                      )}
                      {emailPath && inv.status !== 'annulee' && (
                        <button type="button" className="btn-ghost" disabled={mailId === inv.id} onClick={() => envoyerParEmail(inv)} title={inv.emailedAt ? t('invoiceArchive.emailedOn', { date: new Date(inv.emailedAt).toLocaleDateString(getLocale()) }) : t('invoiceArchive.emailTitle')}>
                          {mailId === inv.id ? '...' : '📧'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* configured=false signifie que l'identité légale de Fairide n'est pas encore renseignée côté
          serveur (variables d'environnement). Le dire franchement vaut mieux qu'afficher un émetteur
          vide sous un tableau de factures, ou pire, laisser croire que le PDF est complet. */}
      {data.fairide && (data.fairide.configured ? (
        <p className="small" style={{ marginTop: 14, opacity: 0.8 }}>
          {t('invoiceArchive.issuer', { name: data.fairide.legalName })}{data.fairide.vatNumber ? t('invoiceArchive.vatSuffix', { vat: data.fairide.vatNumber }) : ''}
        </p>
      ) : (
        <p className="small" style={{ marginTop: 14 }}>
          {t('invoiceArchive.legalIncomplete')}
        </p>
      ))}
    </div>
    </>
  );
}
