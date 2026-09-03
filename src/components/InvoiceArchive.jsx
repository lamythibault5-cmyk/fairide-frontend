import { useEffect, useState } from 'react';
import { api, apiDownload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCards } from './Skeleton';

// Archive des factures émises, partagée par le restaurateur (factures de commission) et le livreur
// (autofacturations). Les deux affichent la même chose — un historique, les montants HT/TVA/TTC, et le
// PDF — seuls l'endpoint et le vocabulaire changent, d'où un composant unique plutôt que deux tableaux
// jumeaux qui divergeraient à la première correction.

function formatPeriod(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const mois = s.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
  const jours = `${s.toLocaleDateString('fr-BE')} → ${e.toLocaleDateString('fr-BE')}`;
  return { mois, jours };
}

const STATUS_LABEL = {
  emise: { texte: 'Émise', pill: 'pill' },
  payee: { texte: 'Payée', pill: 'pill teal' },
  annulee: { texte: 'Annulée', pill: 'pill' }
};

export default function InvoiceArchive({ endpoint, pdfPath, titre, description, colonneMontant }) {
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api(endpoint, { token })
      .then(setData)
      .catch((e) => { toast(e.message); setData({ invoices: [] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function download(inv) {
    setBusyId(inv.id);
    try {
      await apiDownload(pdfPath(inv), { token, filename: `${inv.invoiceNumber}.pdf` });
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <SkeletonCards count={2} />;

  const invoices = data.invoices || [];

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{titre}</h3>
      <p className="small" style={{ margin: '0 0 14px' }}>{description}</p>

      {invoices.length === 0 && (
        <div className="empty">
          Aucune facture émise pour l'instant. Elles apparaîtront ici dès la première période facturée.
        </div>
      )}

      {invoices.length > 0 && (
        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Période</th>
                <th>Émise le</th>
                <th className="num">Montant HT</th>
                <th className="num">TVA</th>
                <th className="num">{colonneMontant}</th>
                <th>Statut</th>
                <th aria-label="Téléchargement" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const p = formatPeriod(inv.periodStart, inv.periodEnd);
                const st = STATUS_LABEL[inv.status] || STATUS_LABEL.emise;
                return (
                  <tr key={inv.id}>
                    <td><b>{inv.invoiceNumber}</b></td>
                    <td>
                      <div style={{ textTransform: 'capitalize' }}>{p.mois}</div>
                      <div className="small">{p.jours}</div>
                    </td>
                    <td>{new Date(inv.issuedAt).toLocaleDateString('fr-BE')}</td>
                    <td className="num">{inv.subtotalHt.toFixed(2)}€</td>
                    <td className="num">
                      {inv.vatAmount.toFixed(2)}€
                      {/* En franchise de TVA, un taux à 0 n'est pas une erreur d'affichage mais le régime
                          du livreur : on le nomme, sinon la ligne paraît incomplète. */}
                      {inv.vatStatus === 'franchise'
                        ? <div className="small">Franchise</div>
                        : <div className="small">{(inv.vatRate * 100).toFixed(0)}%</div>}
                    </td>
                    <td className="num"><b>{inv.totalTtc.toFixed(2)}€</b></td>
                    <td><span className={st.pill}>{st.texte}</span></td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === inv.id}
                        onClick={() => download(inv)}
                      >
                        {busyId === inv.id ? '...' : '⬇️ PDF'}
                      </button>
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
          Émetteur : {data.fairide.legalName}
          {data.fairide.vatNumber ? ` · TVA ${data.fairide.vatNumber}` : ''}
        </p>
      ) : (
        <p className="small" style={{ marginTop: 14 }}>
          ⚠️ L'identité légale de Fairide n'est pas encore complètement renseignée : certaines mentions
          obligatoires peuvent manquer sur les PDF.
        </p>
      ))}
    </div>
  );
}
