import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import OrderReceipt from '../../components/OrderReceipt';
import ConfirmDialog from '../../components/ConfirmDialog';
import { BandeauAllergie, BadgeAlcool, VerificationAge } from '../../components/conformite/CommandeConformite';
import { buildTicketBytes, COLUMNS_58MM } from '../../escposTicket';
import * as btPrinter from '../../bluetoothPrinter';
import TerminalFairide from '../../components/TerminalFairide';
import TicketEditor from '../../components/TicketEditor';
import {
  DeliveryTiming, EcheanceAcceptation, ProgressBar, statusLabel, deliveryInstructionLabel, formatOrderItem, orderTypeColor, orderTypeLabel,
  ORDER_STAGES, orderStageKey, orderStagePriority, stageColors as couleursEtapes
} from '../../orderStatus';
import { useLanguage } from '../../context/LanguageContext';

export default function OrdersPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { orders, restaurant, restoId, loadDashboard } = useOutletContext();

  const [selectedOrder, setSelectedOrder] = useState(null);
  // Commande à emporter payée sur place que le client n'est pas venu chercher (confirmation avant de la clore).
  const [pasVenu, setPasVenu] = useState(null);
  const [clotureEnCours, setClotureEnCours] = useState(false);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
  const [confirmingPickup, setConfirmingPickup] = useState(null);
  // Conformité : commande avec demande d'allergie à confirmer (A1), remise d'alcool à contrôler (B6).
  const [allergieAConfirmer, setAllergieAConfirmer] = useState(null);
  const [ageAVerifier, setAgeAVerifier] = useState(null);
  const stageColors = useMemo(() => couleursEtapes(restoId), [restoId]);
  // Largeur de papier retenue par le restaurateur : sa valeur ne change pas d'une commande à l'autre,
  // la redemander à chaque ticket serait une friction inutile.
  // Fondateur (2026-09-22) : les commandes se voient, s'acceptent et s'impriment sur le TERMINAL Fairide (tout-en-un,
  // configuré par l'équipe). Plus de réglages Bluetooth / iOS / Android ici : la page garde les commandes et, en
  // secours, l'impression par la boîte d'impression de l'appareil (« Imprimer le bon de livraison »).
  const [paperColumns] = useState(() => Number(localStorage.getItem('fairide.paperColumns')) || COLUMNS_58MM);
  const [btName, setBtName] = useState(btPrinter.connectedDeviceName());
  const [printing, setPrinting] = useState(false);

  // Nombre d'impressions déjà faites par commande (session) : affiché dans le détail, pour savoir si le
  // ticket est déjà sorti et pouvoir le réimprimer sans hésiter quand la première sortie a raté.
  const [impressions, setImpressions] = useState({});
  const [editeur, setEditeur] = useState(null); // null | { order } (modification) | { order: null } (création)
  const [recuEdite, setRecuEdite] = useState(null);

  async function printBluetooth(order, { silencieux = false, copies = 1 } = {}) {
    setPrinting(true);
    try {
      if (!btPrinter.connectedDeviceName()) setBtName(await btPrinter.connect());
      const octets = buildTicketBytes(order, restaurant, { columns: paperColumns });
      for (let i = 0; i < Math.max(1, copies); i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 600));
        await btPrinter.printBytes(octets);
      }
      setBtName(btPrinter.connectedDeviceName());
      setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + Math.max(1, copies) }));
      if (!silencieux) toast(copies > 1 ? t('ordersResto.toastTicketSentN', { n: copies }) : t('ordersResto.toastTicketSent'));
      return true;
    } catch (e) {
      // Refuser le sélecteur d'appareils lève une NotFoundError : ce n'est pas une panne, inutile
      // d'alarmer le restaurateur qui vient simplement de fermer la fenêtre.
      if (e?.name !== 'NotFoundError') toast(e.message || 'Impression impossible.');
      setBtName(btPrinter.connectedDeviceName());
      return false;
    } finally {
      setPrinting(false);
    }
  }

  // Ce qui demande une action ou une surveillance en premier, ce qui est déjà réglé en dernier —
  // pour que le restaurateur voie toujours ce qui compte sans avoir à chercher dans la liste.
  const sortedOrders = useMemo(() => [...orders].sort((a, b) => orderStagePriority(a) - orderStagePriority(b)), [orders]);

  async function orderAction(orderId, action, body) {
    try {
      await api(`/orders/${orderId}/${action}`, { method: 'PATCH', token, body });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    }
  }

  async function signalerPasVenu() {
    if (!pasVenu) return;
    setClotureEnCours(true);
    try {
      await api(`/orders/${pasVenu.id}/pickup-no-show`, { method: 'PATCH', token });
      toast(t('ordersResto.toastNoShow'));
      setPasVenu(null);
      setSelectedOrder(null);
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setClotureEnCours(false);
    }
  }

  async function confirmPickup(orderId) {
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast(t('ordersResto.toastAskDriverCode')); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-pickup`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast(t('ordersResto.toastPickupConfirmed'));
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirmingPickup(null);
    }
  }

  // `ageVerifie` : la pièce d'identité a été contrôlée (commande avec alcool, backlog B6). Sans elle, on
  // ouvre d'abord la vérification — le serveur refuserait de toute façon (AGE_A_VERIFIER).
  async function confirmTakeaway(order, ageVerifie = false) {
    const orderId = order.id;
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast(t('ordersResto.toastAskCustomerCode')); return; }
    if (order.containsAlcohol && order.orderType === 'pickup' && !ageVerifie) { setAgeAVerifier(order); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-takeaway`, { method: 'PATCH', token, body: { code, ...(ageVerifie ? { ageCheck: 'verified' } : {}) } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast(t('ordersResto.toastTakeawayDone'));
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirmingPickup(null);
    }
  }

  async function refuserRemiseAge(order) {
    try {
      await api(`/orders/${order.id}/age-refused`, { method: 'PATCH', token, body: { reason: 'refused_age' } });
      toast(t('conformite.ageRefusedDone'));
      setAgeAVerifier(null);
      setSelectedOrder(null);
      loadDashboard(restoId);
    } catch (e) { toast(e.message, 'erreur'); }
  }

  function printReceipt(order) {
    const prevTitle = document.title;
    document.title = `Fairide - Commande ${String(order.id).slice(0, 8)}`;
    window.print();
    document.title = prevTitle;
    setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + 1 }));
  }
  function printReceiptEdite(order) {
    setRecuEdite(order);
    // Le portail doit être rendu avec ce ticket avant l'ouverture de la boîte d'impression.
    setTimeout(() => { printReceipt(order); setTimeout(() => setRecuEdite(null), 500); }, 50);
  }

  return (
    <div className="no-print">
      {/* Tout se passe sur le terminal Fairide : voir, accepter, suivre et imprimer les commandes. */}
      <div className="card terminal-commandes">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🖥️ {t('ordersResto.terminalCardTitle')}</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('ordersResto.terminalCardIntro')}</p>
        <ul className="small terminal-commandes-points">
          <li>{t('ordersResto.terminalCard1')}</li>
          <li>{t('ordersResto.terminalCard2')}</li>
          <li>{t('ordersResto.terminalCard3')}</li>
          <li>{t('ordersResto.terminalCard4')}</li>
        </ul>
        <TerminalFairide terminal={restaurant?.terminal || null} compact />
      </div>

      <h2 className="section-title" style={{ marginTop: 0 }}>{t('ordersResto.incoming')}</h2>
      {orders.length === 0 && <div className="empty">{t('ordersResto.noneYet')}</div>}
      {sortedOrders.map((o) => {
        const stageKey = orderStageKey(o);
        const stage = ORDER_STAGES.find((s) => s.key === stageKey);
        const stageColor = stageColors[stageKey];
        return (
        <div
          className={`card order-card-clickable order-type-${orderTypeColor(o)}`}
          key={o.id}
          style={{ borderLeft: `5px solid ${stageColor}` }}
          onClick={() => setSelectedOrder(o)}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${stageColor}22`, color: stageColor }}>
              {stage.icon} {t(`orderStatus.stage_${stage.key}`)}
            </span>
            <button type="button" className="btn-ghost order-print-btn" title={btName ? t('ordersResto.printTicket') : t('ordersResto.printDeliveryNote')} aria-label={t('ordersResto.printTicket')}
              onClick={(e) => { e.stopPropagation(); if (btName) printBluetooth(o); else { setSelectedOrder(o); } }}>🖨️</button>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.clientName}</b>
            <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>
          </div>
          <div className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o)}</div>
          {o.paymentMode === 'on_site' && (
            <div className="small" style={{ margin: '4px 0', fontWeight: 700, color: o.pickupNoShow ? 'var(--red)' : 'var(--ink)' }}>
              {o.pickupNoShow ? t('ordersResto.noShowBadge') : t('ordersResto.payOnSiteBadge', { amount: `${o.total.toFixed(2)}€` })}
            </div>
          )}
          <ProgressBar status={o.status} orderType={o.orderType} />
          <DeliveryTiming order={o} />
          <EcheanceAcceptation order={o} />
          <BandeauAllergie order={o} />
          <BadgeAlcool order={o} />
          <div className="small" style={{ margin: '6px 0' }}>{o.items.length > 0 ? o.items.map(formatOrderItem).join(', ') : t('ordersResto.reservationNoOrder')}</div>
          {o.orderType === 'delivery' && <div className="small">📍 {o.address}</div>}
          {o.orderType === 'dine_in' && <div className="small">{t('ordersResto.dineInLine', { n: o.partySize, name: o.reservationName })}</div>}
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          {o.orderType === 'delivery' && o.driverName && ['preparation', 'pret'].includes(o.status) && (
            <div className="small" style={{ fontWeight: 600 }}>{t('ordersResto.driverAssigned', { name: o.driverName })}</div>
          )}
          <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {o.status === 'nouveau' && (
              <>
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => (o.allergyRequest ? setAllergieAConfirmer(o) : orderAction(o.id, 'accept'))}>{t('ordersResto.accept')}</button>
                <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'refuse')}>{t('ordersResto.refuse')}</button>
              </>
            )}
            {o.status === 'preparation' && (
              <button className="btn-gold" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
            )}
            {o.paymentMode === 'on_site' && ['preparation', 'pret'].includes(o.status) && (
              <button className="btn-ghost" style={{ padding: '8px 12px', fontSize: 13, color: 'var(--red)' }} onClick={() => setPasVenu(o)}>🚫 {t('ordersResto.customerNoShow')}</button>
            )}
          </div>
          {o.status === 'pret' && (o.orderType === 'pickup' || o.orderType === 'dine_in') && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input aria-label={t('ordersResto.phCustomerCode')}
                placeholder={t('ordersResto.phCustomerCode')}
                style={{ maxWidth: 140 }}
                value={pickupCodeInputs[o.id] || ''}
                onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o)}>
                {confirmingPickup === o.id ? '...' : o.orderType === 'dine_in' ? t('ordersResto.validateArrival') : t('ordersResto.validateOrder')}
              </button>
            </div>
          )}
          {o.status === 'pret' && o.orderType === 'delivery' && o.driverId && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input aria-label={t('ordersResto.phDriverCode')}
                placeholder={t('ordersResto.phDriverCode')}
                style={{ maxWidth: 140 }}
                value={pickupCodeInputs[o.id] || ''}
                onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmPickup(o.id)}>
                {confirmingPickup === o.id ? '...' : t('ordersResto.confirmPickup')}
              </button>
            </div>
          )}
          {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
            <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>{t('ordersResto.waitingDriver')}</p>
          )}
        </div>
        );
      })}

      {selectedOrder && createPortal(
        <div className="modal-overlay no-print" onClick={() => setSelectedOrder(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{t('ordersResto.orderOf', { name: selectedOrder.clientName })}</h3>
              <span className={`status-badge status-${selectedOrder.status}`}>{statusLabel(selectedOrder.status, selectedOrder.orderType, t)}</span>
            </div>
            <div className={`order-type-badge order-type-badge-${orderTypeColor(selectedOrder)}`} style={{ marginBottom: 8 }}>{orderTypeLabel(selectedOrder)}</div>
            {(() => {
              const sk = orderStageKey(selectedOrder);
              const stg = ORDER_STAGES.find((s) => s.key === sk);
              const col = stageColors[sk];
              return (
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, marginBottom: 8, background: `${col}22`, color: col }}>
                  {stg.icon} {t(`orderStatus.stage_${stg.key}`)}
                </span>
              );
            })()}
            <ProgressBar status={selectedOrder.status} orderType={selectedOrder.orderType} />
            <DeliveryTiming order={selectedOrder} />
            <div className="divider" />
            {/* Une réservation de table peut n'avoir aucun plat (voir routes/orders.js : seul 'dine_in'
                l'autorise). Sans ce cas, la fiche affichait une section « Articles » vide suivie d'un
                « Total payé 0,00 € », qui se lit comme une commande impayée au lieu d'une table réservée. */}
            {selectedOrder.items.length === 0 ? (
              <p className="small" style={{ margin: '4px 0' }}>
                {t('ordersResto.reservationNoOrder')}
              </p>
            ) : (
              <>
            <h4 style={{ margin: '0 0 6px' }}>{t('ordersResto.items')}</h4>
            {selectedOrder.items.map((i) => (
              <div key={i.itemId} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', alignItems: 'flex-start' }}>
                <span>
                  {i.qty}× {i.name}{i.discount > 0 ? ' 🏷️' : ''}
                  {i.options?.length > 0 && <span className="small" style={{ display: 'block' }}>{i.options.map((o) => o.name).join(', ')}</span>}
                </span>
                <span>{(i.price * i.qty - (i.discount || 0)).toFixed(2)}€</span>
              </div>
            ))}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>{t('ordersResto.subtotal')}</span><span>{selectedOrder.subtotal.toFixed(2)}€</span></div>
              {selectedOrder.promoDiscount > 0 && <div className="line"><span>{t('ordersResto.promo', { label: selectedOrder.promoLabel })}</span><span>-{selectedOrder.promoDiscount.toFixed(2)}€</span></div>}
              {selectedOrder.orderType === 'delivery' && <div className="line"><span>{t('ordersResto.delivery')}</span><span>{selectedOrder.deliveryFee.toFixed(2)}€</span></div>}
              {selectedOrder.serviceFee > 0 && <div className="line"><span>{t('ordersResto.serviceFee')}</span><span>{(selectedOrder.serviceFee + (selectedOrder.serviceFeeVat || 0)).toFixed(2)}€</span></div>}
              {selectedOrder.balanceUsed > 0 && <div className="line"><span>{t('ordersResto.balanceUsed')}</span><span>-{selectedOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>{selectedOrder.paymentMode === 'on_site' ? `💶 ${t('ordersResto.toCollectOnSite')}` : t('ordersResto.totalPaid')}</span><span>{selectedOrder.total.toFixed(2)}€</span></div>
            </div>
              </>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{selectedOrder.orderType === 'pickup' ? t('ordersResto.takeaway') : selectedOrder.orderType === 'dine_in' ? t('ordersResto.dineIn') : t('ordersResto.delivery')}</h4>
            {selectedOrder.orderType === 'delivery' && <p className="small" style={{ margin: '4px 0' }}>📍 {selectedOrder.address}</p>}
            {selectedOrder.orderType === 'pickup' && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.pickupInfo')}</p>}
            {selectedOrder.orderType === 'dine_in' && (
              <p className="small" style={{ margin: '4px 0' }}>🍽️ Table pour {selectedOrder.partySize} personne{selectedOrder.partySize > 1 ? 's' : ''}, réservée au nom de <b>{selectedOrder.reservationName}</b>.</p>
            )}
            {selectedOrder.clientPhone && <p className="small" style={{ margin: '4px 0' }}>📞 {selectedOrder.clientPhone}</p>}
            <BandeauAllergie order={selectedOrder} />
            <BadgeAlcool order={selectedOrder} />
            {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}>🔑 {deliveryInstructionLabel(selectedOrder.deliveryInstructions)}</p>}
            {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}>📝 {selectedOrder.deliveryNote}</p>}
            {selectedOrder.orderType === 'delivery' && selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.driverLine', { name: selectedOrder.driverName, phone: selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : '' })}</p>}
            {selectedOrder.status === 'pret' && (selectedOrder.orderType === 'pickup' || selectedOrder.orderType === 'dine_in') && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input aria-label={t('ordersResto.phCustomerCode')}
                  placeholder={t('ordersResto.phCustomerCode')}
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmTakeaway(selectedOrder)}>
                  {confirmingPickup === selectedOrder.id ? '...' : selectedOrder.orderType === 'dine_in' ? t('ordersResto.validateArrival') : t('ordersResto.validateOrder')}
                </button>
              </div>
            )}
            {selectedOrder.status === 'pret' && selectedOrder.orderType === 'delivery' && selectedOrder.driverId && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input aria-label={t('ordersResto.phDriverCode')}
                  placeholder={t('ordersResto.phDriverCode')}
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmPickup(selectedOrder.id)}>
                  {confirmingPickup === selectedOrder.id ? '...' : t('ordersResto.confirmPickup')}
                </button>
              </div>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{t('ordersResto.orderTicket')}</h4>
            <p className="small" style={{ margin: '0 0 8px' }}>
              {t('ordersResto.slipInBag')} {t('ordersResto.printTerminalHelp')}
            </p>
            {impressions[selectedOrder.id] > 0 && (
              <p className="small" style={{ margin: '0 0 8px' }}>✅ {t('ordersResto.printedTimes', { n: impressions[selectedOrder.id] })} {t('ordersResto.reprintHint')}</p>
            )}
            <div className="row" style={{ marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
              {btName && (
                <button className="btn-teal" disabled={printing} onClick={() => printBluetooth(selectedOrder)}>{printing ? t('ordersResto.printing') : impressions[selectedOrder.id] ? t('ordersResto.printAgain') : t('ordersResto.printTicket')}</button>
              )}
              <button className="btn-outline" onClick={() => setEditeur({ order: selectedOrder })}>✏️ {t('ordersResto.editTicket')}</button>
              <button className="btn-outline" onClick={() => printReceipt(selectedOrder)}>{t('ordersResto.printDeliveryNote')}</button>
              <button className="btn-ghost" onClick={() => setSelectedOrder(null)}>{t('ordersResto.close')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Portail séparé du modal (lui-même marqué no-print) : c'est ce qui garantit que le reçu reste
          visible à l'impression même si le modal et le reste de la page sont masqués (voir OrderReceipt.jsx
          et .receipt-print dans styles.css — un enfant ne peut jamais annuler le display:none d'un ancêtre). */}
      {(recuEdite || selectedOrder) && createPortal(<OrderReceipt order={recuEdite || selectedOrder} restaurant={restaurant} />, document.body)}
      <ConfirmDialog open={!!pasVenu} danger
        title={t('ordersResto.confirmNoShowTitle')}
        message={t('ordersResto.confirmNoShowText', { name: pasVenu?.clientName || '' })}
        confirmLabel={t('ordersResto.customerNoShow')}
        loading={clotureEnCours}
        onCancel={() => setPasVenu(null)}
        onConfirm={signalerPasVenu} />
      {/* A1 : accepter une commande avec demande d'allergie, c'est s'engager à la respecter. */}
      <ConfirmDialog open={!!allergieAConfirmer}
        title={t('conformite.allergyConfirmTitle')}
        message={t('conformite.allergyConfirmText', { request: allergieAConfirmer?.allergyRequest || '' })}
        confirmLabel={t('conformite.allergyConfirmAccept')}
        onCancel={() => setAllergieAConfirmer(null)}
        onConfirm={() => { const o = allergieAConfirmer; setAllergieAConfirmer(null); orderAction(o.id, 'accept', { allergyAck: true }); }} />
      {/* B6 : pas de remise d'alcool sans pièce d'identité contrôlée. Refus → commande close, tâche admin. */}
      <VerificationAge order={ageAVerifier} onFermer={() => setAgeAVerifier(null)}
        onVerifie={() => { const o = ageAVerifier; setAgeAVerifier(null); confirmTakeaway(o, true); }}
        onRefuse={() => refuserRemiseAge(ageAVerifier)} />
      {editeur && (
        <TicketEditor initial={editeur.order} btName={btName} printing={printing}
          onPrintBluetooth={(ticket, copies) => printBluetooth(ticket, { copies })}
          onPrintBrowser={printReceiptEdite}
          onClose={() => setEditeur(null)} />
      )}
    </div>
  );
}
