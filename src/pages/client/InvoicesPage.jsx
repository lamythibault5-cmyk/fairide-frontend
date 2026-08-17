import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';

// Liste les commandes payées avec un lien vers leur facture Stripe (générée automatiquement au
// paiement, voir invoice_creation dans routes/payments.js) — rien à générer/héberger nous-mêmes.
// Les commandes réglées par solde uniquement (aucun passage par Stripe) n'ont pas de facture Stripe :
// leur ticket détaillé reste dans l'email de confirmation.
export default function InvoicesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api('/orders/mine', { token }).then((data) => setOrders(data.filter((o) => o.paid))).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders) return <SkeletonCards count={3} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Mes factures</h2>
      {orders.length === 0 && <div className="empty">Aucune commande payée pour l'instant.</div>}
      {orders.map((o) => (
        <div key={o.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{o.restaurantName}</div>
              <div className="small">{new Date(o.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })} · {o.total.toFixed(2)}€</div>
            </div>
            {o.invoiceUrl ? (
              <a className="btn-ghost" href={o.invoiceUrl} target="_blank" rel="noopener noreferrer">📄 Voir la facture</a>
            ) : (
              <span className="small" style={{ opacity: 0.6 }}>Facture indisponible</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
