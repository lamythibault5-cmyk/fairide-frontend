import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

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
      toast(`Facture ${r.invoiceNumber} émise.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const fairide = invoice?.fairide;
  const periodLabel = new Date(`${month}-01`).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
  const periodRange = `01/${month.split('-')[1]}/${month.split('-')[0]} — ${lastDayOfMonth(month)}/${month.split('-')[1]}/${month.split('-')[0]}`;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Factures</h2>

      <div className="card no-print">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Abonnement Fairide</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Consulte et télécharge tes factures d'abonnement (20€/mois) via le portail sécurisé Stripe.
        </p>
        <button className="btn-ghost" disabled={openingPortal} onClick={openPortal}>
          {openingPortal ? '...' : '📄 Voir mes factures d\'abonnement'}
        </button>
      </div>

      <div className="card no-print">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Facture de commission</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Facture de la commission Fairide prélevée sur tes commandes pour un mois donné. Une fois émise, elle ne peut plus être modifiée — comme une vraie facture.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
          {invoice?.items?.length > 0 && <button className="btn-teal" onClick={() => window.print()}>🖨️ Imprimer</button>}
        </div>
      </div>

      {loading && <div className="card">Chargement...</div>}

      {!loading && fairide && !fairide.configured && (
        <div className="card no-print" style={{ border: '2px solid var(--red)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--red)' }}>⚠️ Configuration incomplète</h3>
          <p className="small" style={{ margin: 0 }}>
            L'identité légale de Fairide (émetteur de la facture) n'est pas encore configurée côté serveur —
            impossible de générer une facture valide tant que ce n'est pas fait.
          </p>
        </div>
      )}

      {!loading && invoice && (
        <div className="card" id="commission-recap">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>FACTURE</h3>
              {invoice.issued ? (
                <div className="small">N° <b>{invoice.invoiceNumber}</b> · émise le {new Date(invoice.issuedAt).toLocaleDateString('fr-BE')}</div>
              ) : (
                <div className="small" style={{ fontStyle: 'italic' }}>Aperçu — pas encore émise</div>
              )}
              <div className="small">Période de prestation : {periodRange}</div>
            </div>
            {!invoice.issued && !generating && invoice.items?.length > 0 && fairide?.configured && (
              <button className="btn-gold no-print" onClick={generateInvoice}>Générer la facture</button>
            )}
            {generating && <span className="small">Génération...</span>}
          </div>

          <div className="row" style={{ gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="small" style={{ textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Émetteur</div>
              {fairide?.configured ? (
                <>
                  <div style={{ fontWeight: 700 }}>{fairide.legalName}</div>
                  <div className="small">{fairide.address}</div>
                  <div className="small">N° d'entreprise / TVA : {fairide.vatNumber}</div>
                  <div className="small">{fairide.rpm}</div>
                  <div className="small">IBAN : {fairide.iban}</div>
                </>
              ) : (
                <div className="small" style={{ opacity: 0.6 }}>Non configuré</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="small" style={{ textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Client</div>
              <div style={{ fontWeight: 700 }}>{restaurant.legalName || restaurant.name}</div>
              <div className="small">{restaurant.address}</div>
              {restaurant.companyNumber && <div className="small">N° d'entreprise : {restaurant.companyNumber}</div>}
              {restaurant.vatNumber && <div className="small">TVA : {restaurant.vatNumber}</div>}
            </div>
          </div>

          <h4 style={{ margin: '0 0 10px' }}>Commission de service — {periodLabel}</h4>
          {(!invoice.items || invoice.items.length === 0) && <div className="empty">Aucune commande payée ce mois-ci.</div>}
          {invoice.items?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Date</th>
                  <th style={{ padding: '6px 4px' }}>Description</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Prix HTVA</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>TVA</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(o.createdAt).toLocaleDateString('fr-BE')}</td>
                    <td style={{ padding: '6px 4px' }}>Commission de service (10%) — commande #{o.id.slice(0, 8)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.commission.toFixed(2)}€</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(invoice.vatRate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px' }} colSpan={2}>Total HTVA</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{invoice.subtotalHt.toFixed(2)}€</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px' }} colSpan={2}>TVA ({(invoice.vatRate * 100).toFixed(0)}%)</td>
                  <td style={{ padding: '4px', textAlign: 'right' }} colSpan={2}>{invoice.vatAmount.toFixed(2)}€</td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '8px 4px' }} colSpan={2}>Total TTC</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }} colSpan={2}>{invoice.totalTtc.toFixed(2)}€</td>
                </tr>
              </tfoot>
            </table>
          )}

          <p className="small" style={{ marginTop: 16 }}>
            Conditions de paiement : montant déjà prélevé à la source sur les paiements clients — aucun règlement supplémentaire n'est dû par le restaurant.
          </p>
        </div>
      )}
    </div>
  );
}
