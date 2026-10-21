import { useEffect, useState } from 'react';
import { api, apiDownload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCards } from './Skeleton';
import { useLanguage, getLocale } from '../context/LanguageContext';
import PeppolSettings from './PeppolSettings';
import { euros } from '../prixPlat';
import Icone from './Icone';
import ErrorCard from './ErrorCard';

// Archive des documents émis, partagée par le restaurateur (factures de commission) et le livreur
// (relevés mensuels des ventes encaissées pour son compte, fondateur 2026-10-14 : pas des factures, hors Peppol → `peppol`
// à false). Les deux affichent la même chose — un historique, les montants HT/TVA/TTC, et le
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
  desactive: { texte: t('peppol.stDisabled'), pill: 'pill' },
  non_applicable: { texte: t('peppol.stNotApplicable'), pill: 'pill' }
});

export default function InvoiceArchive({ endpoint, pdfPath, ublPath, emailPath, titre, description, colonneMontant, peppol = true }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [mailId, setMailId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [essai, setEssai] = useState(0);

  // Renvoi de la facture par e-mail à l'adresse du compte, PDF joint (voir POST /invoices/restaurant/:id/send).
  async function envoyerParEmail(inv) {
    setMailId(inv.id);
    try {
      const r = await api(emailPath(inv), { method: 'POST', token });
      toast(t('invoiceArchive.emailSent', { to: r.to || '' }), 'succes');
      setData((d) => ({ ...d, invoices: d.invoices.map((x) => (x.id === inv.id ? { ...x, emailedAt: new Date().toISOString(), status: x.status === 'emise' ? 'envoyee' : x.status } : x)) }));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setMailId(null);
    }
  }

  useEffect(() => {
    // Échec de chargement : une carte « Réessayer », plus « Aucune facture émise » comme si l'archive était vide (audit du
    // 19/10, shop-113).
    setErreur('');
    api(endpoint, { token })
      .then(setData)
      .catch((e) => setErreur(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, essai]);

  async function download(inv, format = 'pdf') {
    setBusyId(inv.id);
    try {
      if (format === 'ubl' && ublPath) await apiDownload(ublPath(inv), { token, filename: `${inv.invoiceNumber}.xml` });
      else await apiDownload(pdfPath(inv), { token, filename: `${inv.invoiceNumber}.pdf` });
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setBusyId(null);
    }
  }

  if (erreur) return <ErrorCard message={erreur} onRetry={() => setEssai((n) => n + 1)} />;
  if (!data) return <SkeletonCards count={2} />;

  const invoices = data.invoices || [];

  return (
    <>
    {peppol && <PeppolSettings endpoint="/invoices/peppol/settings" />}
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
                <th className="num">{t('invoiceArchive.vat')}</th>
                <th className="num">{colonneMontant}</th>
                <th>{t('invoiceArchive.status')}</th>
                {peppol && <th>{t('invoiceArchive.peppol')}</th>}
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
                    <td className="num">{euros(inv.subtotalHt)}</td>
                    <td className="num">
                      {euros(inv.vatAmount)}
                      {/* En franchise de TVA, un taux à 0 n'est pas une erreur d'affichage mais le régime
                          du livreur — ou, sur une facture de Fairide, celui de Fairide elle-même depuis le 7/9/2026
                          (lettre du SPF Finances du 12/10/2026) : on le nomme, sinon la ligne paraît incomplète. */}
                      {inv.vatStatus === 'franchise' || (!inv.vatStatus && !(Number(inv.vatAmount) > 0) && !(Number(inv.vatRate) > 0))
                        ? <div className="small">{t('invoiceArchive.vatExempt')}</div>
                        : <div className="small">{(inv.vatRate * 100).toFixed(0)}%</div>}
                    </td>
                    <td className="num"><b>{euros(inv.totalTtc)}</b></td>
                    <td><span className={st.pill}>{st.texte}</span></td>
                    {peppol && <td><span className={pp.pill} title={inv.peppolSentAt ? new Date(inv.peppolSentAt).toLocaleString(getLocale()) : ''}>{pp.texte}</span></td>}
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-ghost" disabled={busyId === inv.id} onClick={() => download(inv)}>
                        {busyId === inv.id ? '...' : 'PDF'}
                      </button>
                      {ublPath && (
                        <button type="button" className="btn-ghost" disabled={busyId === inv.id} onClick={() => download(inv, 'ubl')} title={t('invoiceArchive.ublTitle')}>
                          UBL
                        </button>
                      )}
                      {emailPath && inv.status !== 'annulee' && (
                        <button type="button" className="btn-ghost" disabled={mailId === inv.id} onClick={() => envoyerParEmail(inv)} title={inv.emailedAt ? t('invoiceArchive.emailedOn', { date: new Date(inv.emailedAt).toLocaleDateString(getLocale()) }) : t('invoiceArchive.emailTitle')}>
                          {mailId === inv.id ? '...' : <Icone nom="courrier" taille={16} className="icone-texte" />}
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
