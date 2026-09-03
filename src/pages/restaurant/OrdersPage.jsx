import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import OrderReceipt from '../../components/OrderReceipt';
import { buildTicketBytes, COLUMNS_58MM, COLUMNS_80MM } from '../../escposTicket';
import * as btPrinter from '../../bluetoothPrinter';
import {
  DeliveryTiming, ProgressBar, statusLabel, deliveryInstructionLabel, formatOrderItem, orderTypeColor, orderTypeLabel,
  ORDER_STAGES, orderStageKey, orderStagePriority, loadStageColors, saveStageColors, resetStageColors
} from '../../orderStatus';

export default function OrdersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { orders, restaurant, restoId, loadDashboard } = useOutletContext();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
  const [confirmingPickup, setConfirmingPickup] = useState(null);
  const [stageColors, setStageColors] = useState(() => loadStageColors(restoId));
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  // Largeur de papier retenue par le restaurateur : sa valeur ne change pas d'une commande à l'autre,
  // la redemander à chaque ticket serait une friction inutile.
  const [paperColumns, setPaperColumns] = useState(() => Number(localStorage.getItem('fairide.paperColumns')) || COLUMNS_58MM);
  const [btName, setBtName] = useState(btPrinter.connectedDeviceName());
  const [printing, setPrinting] = useState(false);
  const btSupported = btPrinter.isSupported();

  function choosePaper(cols) {
    setPaperColumns(cols);
    localStorage.setItem('fairide.paperColumns', String(cols));
  }

  async function printBluetooth(order) {
    setPrinting(true);
    try {
      if (!btPrinter.connectedDeviceName()) setBtName(await btPrinter.connect());
      await btPrinter.printBytes(buildTicketBytes(order, restaurant, { columns: paperColumns }));
      setBtName(btPrinter.connectedDeviceName());
      toast(`Ticket envoyé à l'imprimante.`);
    } catch (e) {
      // Refuser le sélecteur d'appareils lève une NotFoundError : ce n'est pas une panne, inutile
      // d'alarmer le restaurateur qui vient simplement de fermer la fenêtre.
      if (e?.name !== 'NotFoundError') toast(e.message || 'Impression impossible.');
      setBtName(btPrinter.connectedDeviceName());
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => { setStageColors(loadStageColors(restoId)); }, [restoId]);

  function setStageColor(key, color) {
    setStageColors((prev) => {
      const next = { ...prev, [key]: color };
      saveStageColors(restoId, next);
      return next;
    });
  }

  function resetColors() {
    setStageColors(resetStageColors(restoId));
  }

  // Ce qui demande une action ou une surveillance en premier, ce qui est déjà réglé en dernier —
  // pour que le restaurateur voie toujours ce qui compte sans avoir à chercher dans la liste.
  const sortedOrders = useMemo(() => [...orders].sort((a, b) => orderStagePriority(a) - orderStagePriority(b)), [orders]);

  async function orderAction(orderId, action) {
    try {
      await api(`/orders/${orderId}/${action}`, { method: 'PATCH', token });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmPickup(orderId) {
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast('Demande le code de retrait au livreur.'); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-pickup`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast('Retrait confirmé, le client est prévenu !');
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmingPickup(null);
    }
  }

  async function confirmTakeaway(orderId) {
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast('Demande le code de commande au client.'); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-takeaway`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast('Commande à emporter validée !');
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmingPickup(null);
    }
  }

  function printReceipt(order) {
    const prevTitle = document.title;
    document.title = `Fairide - Commande ${order.id.slice(0, 8)}`;
    window.print();
    document.title = prevTitle;
  }

  return (
    <div className="no-print">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🎨 Couleurs des commandes</h3>
          <button type="button" className="btn-ghost" onClick={() => setColorSettingsOpen((v) => !v)}>
            {colorSettingsOpen ? 'Fermer' : 'Personnaliser'}
          </button>
        </div>
        {colorSettingsOpen && (
          <div style={{ marginTop: 10 }}>
            <p className="small" style={{ margin: '0 0 10px' }}>
              Chaque commande est colorée selon où elle en est — ajuste les couleurs à ta convenance, ça reste enregistré sur cet appareil.
            </p>
            {ORDER_STAGES.map((s) => (
              <div key={s.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span className="small">{s.icon} {s.label}</span>
                <input
                  type="color"
                  value={stageColors[s.key]}
                  onChange={(e) => setStageColor(s.key, e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
            ))}
            <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={resetColors}>Réinitialiser les couleurs par défaut</button>
          </div>
        )}
      </div>

      <h2 className="section-title" style={{ marginTop: 0 }}>Commandes entrantes</h2>
      {orders.length === 0 && <div className="empty">Pas encore de commande.</div>}
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
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, margin: '0 0 6px', background: `${stageColor}22`, color: stageColor }}>
            {stage.icon} {stage.label}
          </span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.clientName}</b>
            <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType)}</span>
          </div>
          <div className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o)}</div>
          <ProgressBar status={o.status} orderType={o.orderType} />
          <DeliveryTiming order={o} />
          <div className="small" style={{ margin: '6px 0' }}>{o.items.length > 0 ? o.items.map(formatOrderItem).join(', ') : '🍽️ Réservation sans commande — le client commandera sur place'}</div>
          {o.orderType === 'delivery' && <div className="small">📍 {o.address}</div>}
          {o.orderType === 'dine_in' && <div className="small">🍽️ {o.partySize} pers. — au nom de {o.reservationName}</div>}
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          {o.orderType === 'delivery' && o.driverName && ['preparation', 'pret'].includes(o.status) && (
            <div className="small" style={{ fontWeight: 600 }}>🛵 Livreur assigné : {o.driverName}</div>
          )}
          <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {o.status === 'nouveau' && (
              <>
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'accept')}>Accepter</button>
                <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'refuse')}>Refuser</button>
              </>
            )}
            {o.status === 'preparation' && (
              <button className="btn-gold" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'ready')}>Marquer prêt</button>
            )}
          </div>
          {o.status === 'pret' && (o.orderType === 'pickup' || o.orderType === 'dine_in') && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input
                placeholder="Code du client"
                style={{ maxWidth: 140 }}
                value={pickupCodeInputs[o.id] || ''}
                onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o.id)}>
                {confirmingPickup === o.id ? '...' : o.orderType === 'dine_in' ? 'Valider l\'arrivée' : 'Valider la commande'}
              </button>
            </div>
          )}
          {o.status === 'pret' && o.orderType === 'delivery' && o.driverId && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input
                placeholder="Code du livreur"
                style={{ maxWidth: 140 }}
                value={pickupCodeInputs[o.id] || ''}
                onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmPickup(o.id)}>
                {confirmingPickup === o.id ? '...' : 'Confirmer le retrait'}
              </button>
            </div>
          )}
          {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
            <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>En attente qu'un livreur prenne en charge la commande...</p>
          )}
        </div>
        );
      })}

      {selectedOrder && createPortal(
        <div className="modal-overlay no-print" onClick={() => setSelectedOrder(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Commande de {selectedOrder.clientName}</h3>
              <span className={`status-badge status-${selectedOrder.status}`}>{statusLabel(selectedOrder.status, selectedOrder.orderType)}</span>
            </div>
            <div className={`order-type-badge order-type-badge-${orderTypeColor(selectedOrder)}`} style={{ marginBottom: 8 }}>{orderTypeLabel(selectedOrder)}</div>
            {(() => {
              const sk = orderStageKey(selectedOrder);
              const stg = ORDER_STAGES.find((s) => s.key === sk);
              const col = stageColors[sk];
              return (
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, marginBottom: 8, background: `${col}22`, color: col }}>
                  {stg.icon} {stg.label}
                </span>
              );
            })()}
            <ProgressBar status={selectedOrder.status} orderType={selectedOrder.orderType} />
            <DeliveryTiming order={selectedOrder} />
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Articles</h4>
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
              <div className="line"><span>Sous-total</span><span>{selectedOrder.subtotal.toFixed(2)}€</span></div>
              {selectedOrder.promoDiscount > 0 && <div className="line"><span>Promo {selectedOrder.promoLabel}</span><span>-{selectedOrder.promoDiscount.toFixed(2)}€</span></div>}
              {selectedOrder.orderType === 'delivery' && <div className="line"><span>Livraison</span><span>{selectedOrder.deliveryFee.toFixed(2)}€</span></div>}
              {selectedOrder.serviceFee > 0 && <div className="line"><span>Frais de service</span><span>{selectedOrder.serviceFee.toFixed(2)}€</span></div>}
              {selectedOrder.balanceUsed > 0 && <div className="line"><span>Solde client utilisé</span><span>-{selectedOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>Total payé</span><span>{selectedOrder.total.toFixed(2)}€</span></div>
            </div>
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{selectedOrder.orderType === 'pickup' ? 'À emporter' : selectedOrder.orderType === 'dine_in' ? 'Sur place' : 'Livraison'}</h4>
            {selectedOrder.orderType === 'delivery' && <p className="small" style={{ margin: '4px 0' }}>📍 {selectedOrder.address}</p>}
            {selectedOrder.orderType === 'pickup' && <p className="small" style={{ margin: '4px 0' }}>🏠 Le client vient chercher sa commande sur place.</p>}
            {selectedOrder.orderType === 'dine_in' && (
              <p className="small" style={{ margin: '4px 0' }}>🍽️ Table pour {selectedOrder.partySize} personne{selectedOrder.partySize > 1 ? 's' : ''}, réservée au nom de <b>{selectedOrder.reservationName}</b>.</p>
            )}
            {selectedOrder.clientPhone && <p className="small" style={{ margin: '4px 0' }}>📞 {selectedOrder.clientPhone}</p>}
            {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}>🔑 {deliveryInstructionLabel(selectedOrder.deliveryInstructions)}</p>}
            {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}>📝 {selectedOrder.deliveryNote}</p>}
            {selectedOrder.orderType === 'delivery' && selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>🛵 Livreur : {selectedOrder.driverName}{selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : ''}</p>}
            {selectedOrder.status === 'pret' && (selectedOrder.orderType === 'pickup' || selectedOrder.orderType === 'dine_in') && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  placeholder="Code du client"
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmTakeaway(selectedOrder.id)}>
                  {confirmingPickup === selectedOrder.id ? '...' : selectedOrder.orderType === 'dine_in' ? "Valider l'arrivée" : 'Valider la commande'}
                </button>
              </div>
            )}
            {selectedOrder.status === 'pret' && selectedOrder.orderType === 'delivery' && selectedOrder.driverId && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  placeholder="Code du livreur"
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmPickup(selectedOrder.id)}>
                  {confirmingPickup === selectedOrder.id ? '...' : 'Confirmer le retrait'}
                </button>
              </div>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Ticket de la commande</h4>
            <p className="small" style={{ margin: '0 0 8px' }}>
              À glisser dans le sac ou à coller dessus. {btSupported
                ? `Imprime directement sur ton imprimante thermique Bluetooth, ou via la boîte d'impression de ton appareil.`
                : `Ton appareil ne permet pas le Bluetooth depuis le navigateur : passe par la boîte d'impression, qui gère aussi AirPrint.`}
            </p>
            {btSupported && (
              <div className="row" style={{ gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <span className="small">Papier :</span>
                <button
                  className={paperColumns === COLUMNS_58MM ? 'btn-teal' : 'btn-outline'}
                  style={{ padding: '5px 11px', fontSize: 12 }}
                  onClick={() => choosePaper(COLUMNS_58MM)}
                >58 mm</button>
                <button
                  className={paperColumns === COLUMNS_80MM ? 'btn-teal' : 'btn-outline'}
                  style={{ padding: '5px 11px', fontSize: 12 }}
                  onClick={() => choosePaper(COLUMNS_80MM)}
                >80 mm</button>
                {btName && <span className="small" style={{ marginLeft: 'auto' }}>🔗 {btName}</span>}
              </div>
            )}
            <div className="row" style={{ marginTop: 4, gap: 8 }}>
              {btSupported && (
                <button className="btn-teal" disabled={printing} onClick={() => printBluetooth(selectedOrder)}>
                  {printing ? 'Impression…' : btName ? '🖨️ Imprimer le ticket' : `🔗 Connecter l'imprimante et imprimer`}
                </button>
              )}
              <button className="btn-outline" onClick={() => printReceipt(selectedOrder)}>🖨️ Imprimer le bon de livraison</button>
              <button className="btn-ghost" onClick={() => setSelectedOrder(null)}>Fermer</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Portail séparé du modal (lui-même marqué no-print) : c'est ce qui garantit que le reçu reste
          visible à l'impression même si le modal et le reste de la page sont masqués (voir OrderReceipt.jsx
          et .receipt-print dans styles.css — un enfant ne peut jamais annuler le display:none d'un ancêtre). */}
      {selectedOrder && createPortal(<OrderReceipt order={selectedOrder} restaurant={restaurant} />, document.body)}
    </div>
  );
}
