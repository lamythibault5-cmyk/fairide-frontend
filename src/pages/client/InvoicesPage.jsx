import { useEffect, useMemo, useState } from 'react';
import { api, apiDownload, API_BASE } from '../../api';
import { ouvrirPdf } from '../../pdf';
import { euros } from '../../prixPlat';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { SkeletonCards } from '../../components/Skeleton';
import EtatVide from '../../components/EtatVide';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Liste les commandes payées en ligne avec leur REÇU FAIRIDE (CODE-1, 8 oct. 2026 — recuClient.js côté serveur) : un bloc
// par vendeur (commerce, livreur, Fairide), TVA par taux, « Payé », heure de Bruxelles. Il remplace la facture automatique
// de Stripe, qui présentait Fairide comme vendeur des plats et sans TVA. Une commande payée sur place n'a pas de reçu
// Fairide : le commerce encaisse et remet son propre ticket.
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
      if (!isPreviewingRestaurant) toast(e.message, 'erreur');
      setOrders([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aUnRecu = (o) => o.paymentMode !== 'on_site' && !o.isTraining;
  const downloadable = useMemo(() => (orders || []).filter(aUnRecu), [orders]);

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
      // apiDownload gère désormais POST + corps JSON, et surtout le 401 : un client dont la session a
      // expiré est renvoyé vers la connexion au lieu de voir « téléchargement impossible ».
      await apiDownload('/orders/invoices/download', {
        token, method: 'POST', body: { orderIds: [...selected] }, filename: 'factures-fairide.zip'
      });
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setDownloading(false);
    }
  }

  if (!orders) return <SkeletonCards count={3} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('invoicesClient.title')}</h2>
      <p className="small" style={{ margin: '-6px 0 12px', opacity: 0.85 }}>{t('invoicesClient.peppolNote')}</p>

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

      {orders.length === 0 && (
        <EtatVide
          icone="document" titre={t('invoicesClient.emptyTitle')} texte={t('invoicesClient.none')}
          actionVers="/restaurants" actionTexte={t('orders.emptyAction')}
        />
      )}
      {/* UNE LISTE DE RANGÉES, plus une pile de cartes.
          Chaque facture était une carte blanche bordée de 24px de marge : dix factures faisaient
          dix rectangles séparés par du vide, pour deux lignes de texte chacun. Une facture n'est
          pas un objet à mettre en avant, c'est une ligne dans un relevé — la liste des reçus de la
          capture 7 est exactement cela : une rangée, un filet, la suivante. */}
      {orders.length > 0 && (
        <div className="card facture-liste">
          {orders.map((o) => (
            <div key={o.id} className="facture-ligne">
              {aUnRecu(o) && (
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={o.restaurantName} />
              )}
              <div className="facture-ligne-texte">
                <b>{o.restaurantName}</b>
                <span className="small">{new Date(o.createdAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' })} · {euros(o.total)}</span>
              </div>
              {aUnRecu(o) ? (
                <button type="button" className="btn-ghost" onClick={() => ouvrirPdf(`${API_BASE}/orders/${o.id}/receipt`, token, t('invoicesClient.downloadFailed'))}>{t('invoicesClient.viewInvoice')}</button>
              ) : (
                <span className="small" style={{ opacity: 0.6 }}>{t('invoicesClient.unavailable')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
