import { useEffect, useMemo, useState } from 'react';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { SkeletonCards } from '../../components/Skeleton';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Liste les commandes payées avec un lien vers leur facture Stripe (générée automatiquement au
// paiement, voir invoice_creation dans routes/payments.js) — rien à générer/héberger nous-mêmes.
// Les commandes réglées par solde uniquement (aucun passage par Stripe) n'ont pas de facture Stripe :
// leur ticket détaillé reste dans l'email de confirmation.
function isInPeriod(order, period) {
  const now = new Date();
  const d = new Date(order.createdAt);
  if (period === 'week') {
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo && d <= now;
  }
  if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  return false;
}

export default function InvoicesPage() {
  const { t } = useLanguage();
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const [orders, setOrders] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Voir MapPage.jsx : un restaurateur en mode aperçu n'a pas de vraies factures (403 côté API) —
    // repli sur une liste vide plutôt qu'un message d'erreur trompeur ou un chargement bloqué à vie.
    const isPreviewingRestaurant = previewMode && role === 'restaurant';
    api('/orders/mine', { token }).then((data) => setOrders(data.filter((o) => o.paid))).catch((e) => {
      if (!isPreviewingRestaurant) toast(e.message);
      setOrders([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadable = useMemo(() => (orders || []).filter((o) => o.invoiceUrl), [orders]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectPeriod(period) {
    setSelected(new Set(downloadable.filter((o) => isInPeriod(o, period)).map((o) => o.id)));
  }

  async function downloadSelected() {
    if (selected.size === 0) { toast(t('invoicesClient.toastSelectOne')); return; }
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/orders/invoices/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderIds: [...selected] })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('invoicesClient.downloadFailed'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'factures-fairide.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (!orders) return <SkeletonCards count={3} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('invoicesClient.title')}</h2>

      {downloadable.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('invoicesClient.intro')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" className="btn-ghost" onClick={() => selectPeriod('week')}>{t('invoicesClient.thisWeek')}</button>
            <button type="button" className="btn-ghost" onClick={() => selectPeriod('month')}>{t('invoicesClient.thisMonth')}</button>
            <button type="button" className="btn-ghost" onClick={() => selectPeriod('year')}>{t('invoicesClient.thisYear')}</button>
            <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>{t('invoicesClient.deselectAll')}</button>
          </div>
          <button type="button" className="btn-teal" disabled={selected.size === 0 || downloading} onClick={downloadSelected}>
            {downloading ? '...' : t('invoicesClient.downloadSelection', { n: selected.size })}
          </button>
        </div>
      )}

      {orders.length === 0 && <div className="empty">{t('invoicesClient.none')}</div>}
      {orders.map((o) => (
        <div key={o.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              {o.invoiceUrl && (
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{o.restaurantName}</div>
                <div className="small">{new Date(o.createdAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' })} · {o.total.toFixed(2)}€</div>
              </div>
            </div>
            {o.invoiceUrl ? (
              <a className="btn-ghost" href={o.invoiceUrl} target="_blank" rel="noopener noreferrer">{t('invoicesClient.viewInvoice')}</a>
            ) : (
              <span className="small" style={{ opacity: 0.6 }}>{t('invoicesClient.unavailable')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
