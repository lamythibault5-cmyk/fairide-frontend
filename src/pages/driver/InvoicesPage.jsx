import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import InvoiceArchive from '../../components/InvoiceArchive';

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Récap mensuel imprimable des sommes reçues (frais de livraison + pourboires) — pas une facture TVA
// (la plupart des livreurs sont des particuliers), mais un justificatif de paiement clair pour leur
// propre suivi, dans le même esprit que le récap de commission côté restaurant.
export default function InvoicesPage() {
  const { user, token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [month, setMonth] = useState(currentMonthValue());

  useEffect(() => {
    api('/orders/mine/deliveries', { token }).then(setOrders).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o) => o.status === 'livre' && new Date(o.createdAt).toISOString().slice(0, 7) === month)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [orders, month]);
  const totals = useMemo(() => ({
    deliveryFees: monthOrders.reduce((a, o) => a + o.deliveryFee, 0),
    tips: monthOrders.reduce((a, o) => a + o.tipAmount, 0)
  }), [monthOrders]);

  if (!orders) return <SkeletonCards count={3} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Factures</h2>

      {/* Les vraies pièces comptables du livreur : Fairide émet ces autofacturations en son nom, il n'a
          rien à rédiger mais doit pouvoir les récupérer. Le récap mensuel plus bas reste un outil de
          suivi personnel, calculé à la volée, et n'a aucune valeur de facture. */}
      <InvoiceArchive
        endpoint="/invoices/driver"
        pdfPath={(inv) => `/invoices/driver/${inv.id}/pdf`}
        titre="Mes autofacturations"
        description="Fairide établit ces factures en ton nom pour tes prestations de livraison. Ce sont elles qui font foi comptablement."
        colonneMontant="Total"
      />

      <div className="card no-print">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Récap de paiements</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Détail des frais de livraison et pourboires reçus pour un mois donné — imprimable comme justificatif.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn-teal" onClick={() => window.print()}>🖨️ Imprimer</button>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
          {user?.email && <div className="small">{user.email}</div>}
        </div>
        <h4 style={{ margin: '0 0 10px' }}>Paiements reçus — {new Date(`${month}-01`).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })}</h4>
        {monthOrders.length === 0 && <div className="empty">Aucune livraison ce mois-ci.</div>}
        {monthOrders.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Date</th>
                <th style={{ padding: '6px 4px' }}>Restaurant</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Frais de livraison</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Pourboire</th>
              </tr>
            </thead>
            <tbody>
              {monthOrders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 4px' }}>{new Date(o.createdAt).toLocaleDateString('fr-BE')}</td>
                  <td style={{ padding: '6px 4px' }}>{o.restaurantName}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.deliveryFee.toFixed(2)}€</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{o.tipAmount > 0 ? `${o.tipAmount.toFixed(2)}€` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                <td style={{ padding: '8px 4px' }} colSpan={2}>Total</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{totals.deliveryFees.toFixed(2)}€</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{totals.tips.toFixed(2)}€</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
