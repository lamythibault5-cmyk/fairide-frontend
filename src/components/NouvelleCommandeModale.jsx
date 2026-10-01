import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Modale from './Modale';
import { formatOrderItem, orderTypeLabel } from '../orderStatus';
import { euros } from '../prixPlat';

// LA COMMANDE QUI VIENT D'ARRIVER, SOUS LES YEUX (fondateur, 2026-10-01). Jusqu'ici, une nouvelle commande ne faisait que
// sonner et compter dans la barre : il fallait aller la chercher dans la liste. Cette fenêtre s'ouvre d'elle-même avec
// la commande (client, type, plats, note, total), le ticket s'y réimprime en autant d'exemplaires qu'on veut, et un
// bouton mène à la commande pour l'accepter. Elle ne s'ouvre QUE pour une commande arrivée après le chargement, jamais
// pour celles déjà là à l'ouverture (même règle que useNewOrderAlert).
export default function NouvelleCommandeModale({ orders, ready, restoId }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const vues = useRef(null);
  const [commande, setCommande] = useState(null);
  const [exemplaires, setExemplaires] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [terminal, setTerminal] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const nouvelles = orders.filter((o) => o.status === 'nouveau' && o.paid);
    if (vues.current === null) { vues.current = new Set(nouvelles.map((o) => o.id)); return; }
    const arrivees = nouvelles.filter((o) => !vues.current.has(o.id));
    nouvelles.forEach((o) => vues.current.add(o.id));
    if (arrivees.length) setCommande(arrivees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]);
  }, [orders, ready]);

  useEffect(() => {
    if (!commande || !restoId) return;
    api(`/restaurants/${restoId}/terminals`, { token }).then((d) => setTerminal((d.terminals || []).some((x) => !x.revokedAt))).catch(() => setTerminal(false));
  }, [commande, restoId, token]);

  if (!commande) return null;
  // Toujours la dernière version de la commande (acceptée entre-temps, par exemple).
  const o = orders.find((x) => x.id === commande.id) || commande;
  const fermer = () => setCommande(null);

  async function reimprimer() {
    setEnvoi(true);
    try {
      await api(`/orders/${o.id}/print`, { method: 'POST', token, body: { copies: exemplaires } });
      toast(exemplaires > 1 ? t('ordersResto.toastTicketSentN', { n: exemplaires }) : t('ordersResto.ticketSentTerminal'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  return (
    <Modale titre={`🔔 ${t('newOrder.title')}`} onFermer={fermer}>
      <div className="nouvelle-commande">
        <p className="nouvelle-commande-tete">
          <b>{o.orderNumber ? `#${String(o.orderNumber).padStart(3, '0')}` : ''}</b> {orderTypeLabel(o, t)}
          {o.clientName && <> · {o.clientName}</>}
        </p>
        <ul className="nouvelle-commande-plats">
          {(o.items || []).map((i, k) => <li key={k}>{formatOrderItem(i)}</li>)}
        </ul>
        {o.deliveryNote && <p className="small nouvelle-commande-note">📝 {o.deliveryNote}</p>}
        <p className="nouvelle-commande-total">{t('newOrder.total')} <b>{euros(o.total)}</b></p>
        {terminal && (
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span className="exemplaires" role="group" aria-label={t('ordersResto.copiesLabel')}>
              <span className="small">{t('ordersResto.copiesLabel')}</span>
              <button type="button" className="btn-ghost" disabled={exemplaires <= 1} onClick={() => setExemplaires((v) => Math.max(1, v - 1))} aria-label="−">−</button>
              <b aria-live="polite">{exemplaires}</b>
              <button type="button" className="btn-ghost" disabled={exemplaires >= 5} onClick={() => setExemplaires((v) => Math.min(5, v + 1))} aria-label="+">+</button>
            </span>
            <button type="button" className="btn-outline" disabled={envoi} onClick={reimprimer}>🖨️ {envoi ? t('ordersResto.printing') : t('newOrder.reprint')}</button>
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn-gold" style={{ flex: '1 1 160px', minHeight: 46 }} onClick={() => { fermer(); navigate(`/dashboard/orders?commande=${o.id}`); }}>
            {t('newOrder.open')}
          </button>
          <button type="button" className="btn-ghost" onClick={fermer}>{t('newOrder.later')}</button>
        </div>
      </div>
    </Modale>
  );
}
