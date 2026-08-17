import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Deux documents distincts : les factures d'abonnement Fairide (générées et hébergées par Stripe,
// via le portail client) et le récap de commission d'un mois donné (généré ici, imprimable) — le
// restaurant en a besoin comme justificatif de ce que Fairide lui a facturé sur ses ventes.
export default function InvoicesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, orders, restoId } = useOutletContext();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [month, setMonth] = useState(currentMonthValue());

  const monthOrders = useMemo(() => {
    return orders
      .filter((o) => o.paid && new Date(o.createdAt).toISOString().slice(0, 7) === month)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [orders, month]);
  const totals = useMemo(() => ({
    subtotal: monthOrders.reduce((a, o) => a + o.subtotal, 0),
    commission: monthOrders.reduce((a, o) => a + o.commission, 0)
  }), [monthOrders]);

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
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Récap de commission</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Détail de la commission Fairide prélevée sur tes commandes pour un mois donné — imprimable comme justificatif.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn-teal" onClick={() => window.print()}>🖨️ Imprimer</button>
        </div>
      </div>

      <div className="card" id="commission-recap">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{restaurant.legalName || restaurant.name}</div>
          {restaurant.companyNumber && <div className="small">N° d'entreprise : {restaurant.companyNumber}</div>}
          {restaurant.vatNumber && <div className="small">TVA : {restaurant.vatNumber}</div>}
          {restaurant.responsibleName && <div className="small">Responsable : {restaurant.responsibleName}</div>}
        </div>
        <h4 style={{ margin: '0 0 10px' }}>Commission Fairide — {new Date(`${month}-01`).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })}</h4>
        {monthOrders.length === 0 && <div className="empty">Aucune commande payée ce mois-ci.</div>}
        {monthOrders.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Date</th>
                  <th style={{ padding: '6px 4px' }}>Commande</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Sous-total</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Commission (10%)</th>
                </tr>
              </thead>
              <tbody>
                {monthOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(o.createdAt).toLocaleDateString('fr-BE')}</td>
                    <td style={{ padding: '6px 4px' }}>#{o.id.slice(0, 8)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.subtotal.toFixed(2)}€</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.commission.toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 4px' }} colSpan={2}>Total</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{totals.subtotal.toFixed(2)}€</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{totals.commission.toFixed(2)}€</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
