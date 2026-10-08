import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// ENTRAÎNEMENT (fondateur, 2026-10-08) : pendant 7 jours après la première connexion de son terminal, le commerce se fait envoyer
// des commandes d'essai pour voir comment une commande arrive — notification, tickets (deux pour une livraison : sac et
// restaurant), réimpression —, puis simuler l'arrivée d'un livreur (bon « LIVREUR ATTRIBUÉ ») et photographier la commande.
// Rien n'est préparé, rien n'est livré, rien ne compte dans ses chiffres : les tickets portent « SIMULATION ».
export default function SimulationPage() {
  const { restaurant } = useOutletContext();
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const restoId = restaurant?.id;
  const [etat, setEtat] = useState(null);
  const [occupe, setOccupe] = useState(null);

  const charger = useCallback(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/training`, { token }).then(setEtat).catch((e) => toast(e.message, 'erreur'));
  }, [restoId, token, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function commandeEssai(type, paymentMode) {
    setOccupe(type + (paymentMode || ''));
    try {
      await api(`/restaurants/${restoId}/training/order`, { method: 'POST', token, body: { type, paymentMode } });
      toast(t('simResto.sentToast'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function livreur(o) {
    setOccupe(`driver-${o.id}`);
    try { await api(`/restaurants/${restoId}/training/orders/${o.id}/driver`, { method: 'POST', token }); toast(t('simResto.driverToast')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function reimprimer(o, copies) {
    setOccupe(`print-${o.id}`);
    try { await api(`/orders/${o.id}/print`, { method: 'POST', token, body: { copies } }); toast(t('simResto.printToast', { n: copies })); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function terminer() {
    setOccupe('finish');
    try { await api(`/restaurants/${restoId}/training/finish`, { method: 'POST', token }); toast(t('simResto.finishToast')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }

  const quand = (ms) => new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  const enCours = (etat?.orders || []).filter((o) => ['nouveau', 'preparation', 'pret', 'livraison'].includes(o.status));

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>🧪 {t('simResto.title')}</h2>
      <p className="small" style={{ margin: '0 0 14px', maxWidth: 760 }}>{t('simResto.intro')}</p>

      {!etat && <p className="small">…</p>}
      {etat && !etat.available && etat.reason === 'NO_TERMINAL' && (
        <div className="card"><b>{t('simResto.noTerminalTitle')}</b><p className="small" style={{ margin: '6px 0 0' }}>{t('simResto.noTerminalText')} <Link to="/dashboard/terminal">{t('simResto.terminalLink')}</Link></p></div>
      )}
      {etat && !etat.available && etat.reason === 'EXPIRED' && (
        <div className="card"><b>{t('simResto.expiredTitle')}</b><p className="small" style={{ margin: '6px 0 0' }}>{t('simResto.expiredText', { days: etat.days })}</p></div>
      )}
      {etat?.available && (
        <>
          <div className="card">
            <p className="small" style={{ margin: '0 0 10px' }}>
              <span className="pill teal">{t('simResto.daysLeft', { n: etat.daysLeft })}</span>
              {' '}{etat.terminalOnline ? `🟢 ${t('simResto.terminalOnline')}` : `⚪ ${t('simResto.terminalOffline')}`}
            </p>
            <p className="small" style={{ margin: '0 0 10px' }}>{t('simResto.howTo')}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-teal" disabled={!!occupe} onClick={() => commandeEssai('delivery')}>{occupe === 'delivery' ? '…' : `🛵 ${t('simResto.sendDelivery')}`}</button>
              <button type="button" className="btn-outline" disabled={!!occupe} onClick={() => commandeEssai('pickup', 'online')}>{occupe === 'pickuponline' ? '…' : `🥡 ${t('simResto.sendPickupOnline')}`}</button>
              <button type="button" className="btn-outline" disabled={!!occupe} onClick={() => commandeEssai('pickup', 'on_site')}>{occupe === 'pickupon_site' ? '…' : `💶 ${t('simResto.sendPickupOnSite')}`}</button>
            </div>
          </div>

          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>{t('simResto.ordersTitle')}</h3>
          {enCours.length === 0 && <div className="empty">{t('simResto.none')}</div>}
          {enCours.map((o) => (
            <div key={o.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>#{String(o.orderNumber || '').padStart(3, '0')} · {o.orderType === 'delivery' ? t('simResto.typeDelivery') : t('simResto.typePickup')} · {quand(o.createdAt)}</b>
                <span className="pill">{t(`simResto.st_${o.status}`)}</span>
              </div>
              <p className="small" style={{ margin: '6px 0 8px' }}>
                {o.driverName ? `🛵 ${t('simResto.driverAssigned', { name: o.driverName })}` : o.orderType === 'delivery' ? t('simResto.driverPending') : t('simResto.pickupNote')}
                {o.preparedPhotoAt ? ` · 📷 ${t('simResto.photoTaken', { time: quand(o.preparedPhotoAt) })}` : ''}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" disabled={!!occupe} onClick={() => reimprimer(o, o.orderType === 'delivery' ? 2 : 1)}>{occupe === `print-${o.id}` ? '…' : `🖨️ ${o.orderType === 'delivery' ? t('simResto.printTwo') : t('simResto.printOne')}`}</button>
                {o.orderType === 'delivery' && !o.driverName && (
                  <button type="button" className="btn-teal" disabled={!!occupe} onClick={() => livreur(o)}>{occupe === `driver-${o.id}` ? '…' : `🛵 ${t('simResto.simulateDriver')}`}</button>
                )}
                <Link className="btn-ghost" to="/dashboard/orders">{t('simResto.openOrders')}</Link>
              </div>
            </div>
          ))}
          {enCours.length > 0 && (
            <button type="button" className="btn-ghost" disabled={!!occupe} onClick={terminer}>{occupe === 'finish' ? '…' : t('simResto.finish')}</button>
          )}
          <div className="card" style={{ marginTop: 16 }}>
            <b>📷 {t('simResto.photoTitle')}</b>
            <p className="small" style={{ margin: '6px 0 0' }}>{t('simResto.photoText')}</p>
          </div>
        </>
      )}
    </div>
  );
}
