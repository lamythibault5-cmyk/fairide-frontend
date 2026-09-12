import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import OrderReceipt from '../../components/OrderReceipt';
import { buildTicketBytes, COLUMNS_58MM, COLUMNS_80MM } from '../../escposTicket';
import * as btPrinter from '../../bluetoothPrinter';
import PrinterSettings, { AUTO_PRINT_KEY } from '../../components/PrinterSettings';
import TicketEditor from '../../components/TicketEditor';
import {
  DeliveryTiming, ProgressBar, statusLabel, deliveryInstructionLabel, formatOrderItem, orderTypeColor, orderTypeLabel,
  ORDER_STAGES, orderStageKey, orderStagePriority, loadStageColors, saveStageColors, resetStageColors
} from '../../orderStatus';
import { useLanguage } from '../../context/LanguageContext';

export default function OrdersPage() {
  const { t } = useLanguage();
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

  // Impression automatique de chaque nouvelle commande sur l'imprimante connectée (voir PrinterSettings).
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem(AUTO_PRINT_KEY) === '1'; } catch { return false; } });
  function choisirAutoPrint(v) { setAutoPrint(v); try { localStorage.setItem(AUTO_PRINT_KEY, v ? '1' : '0'); } catch { /* sans stockage */ } }

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
  async function connecterImprimante() {
    setPrinting(true);
    try { setBtName(await btPrinter.connect()); toast(t('ordersResto.toastPrinterConnected')); }
    catch (e) { if (e?.name !== 'NotFoundError') toast(e.message || 'Connexion impossible.'); }
    finally { setPrinting(false); }
  }
  function deconnecterImprimante() { btPrinter.disconnect(); setBtName(null); }
  function ticketDeTest() {
    return printBluetooth({
      id: 'TEST0000', clientName: t('ordersResto.printerTestClient'), clientPhone: '', createdAt: Date.now(), orderType: 'pickup', paid: true,
      items: [{ name: t('ordersResto.printerTestItem'), qty: 1, price: 0 }], subtotal: 0, deliveryFee: 0, serviceFee: 0, promoDiscount: 0, balanceUsed: 0, total: 0
    });
  }

  // Nouvelle commande → ticket imprimé tout seul, si l'option est active et l'imprimante connectée. Les
  // commandes déjà présentes au premier chargement ne sont jamais réimprimées ; chaque commande l'est au
  // plus une fois (mémoire de session), même si la liste se rafraîchit ou si l'on change d'onglet.
  const dejaVues = useRef(null);
  useEffect(() => {
    if (!orders) return;
    if (dejaVues.current === null) { dejaVues.current = new Set(orders.map((o) => o.id)); return; }
    const nouvelles = orders.filter((o) => !dejaVues.current.has(o.id) && o.paid !== false && !['annule', 'refuse'].includes(o.status));
    nouvelles.forEach((o) => dejaVues.current.add(o.id));
    if (!autoPrint || !btPrinter.connectedDeviceName() || nouvelles.length === 0) return;
    let imprimees = new Set();
    try { imprimees = new Set(JSON.parse(sessionStorage.getItem('fairide.printed') || '[]')); } catch { /* sans stockage */ }
    (async () => {
      for (const o of nouvelles) {
        if (imprimees.has(o.id)) continue;
        const ok = await printBluetooth(o, { silencieux: true });
        if (ok) { imprimees.add(o.id); toast(t('ordersResto.toastAutoPrinted', { id: o.id.slice(0, 8) })); }
      }
      try { sessionStorage.setItem('fairide.printed', JSON.stringify([...imprimees].slice(-200))); } catch { /* sans stockage */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

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
    if (!code) { toast(t('ordersResto.toastAskDriverCode')); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-pickup`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast(t('ordersResto.toastPickupConfirmed'));
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmingPickup(null);
    }
  }

  async function confirmTakeaway(orderId) {
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast(t('ordersResto.toastAskCustomerCode')); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-takeaway`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast(t('ordersResto.toastTakeawayDone'));
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmingPickup(null);
    }
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
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{t('ordersResto.colorsTitle')}</h3>
          <button type="button" className="btn-ghost" onClick={() => setColorSettingsOpen((v) => !v)}>
            {colorSettingsOpen ? 'Fermer' : 'Personnaliser'}
          </button>
        </div>
        {colorSettingsOpen && (
          <div style={{ marginTop: 10 }}>
            <p className="small" style={{ margin: '0 0 10px' }}>
              {t('ordersResto.colorsIntro')}
            </p>
            {ORDER_STAGES.map((s) => (
              <div key={s.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span className="small">{s.icon} {t(`orderStatus.stage_${s.key}`)}</span>
                <input
                  type="color"
                  value={stageColors[s.key]}
                  onChange={(e) => setStageColor(s.key, e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
            ))}
            <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={resetColors}>{t('ordersResto.resetColors')}</button>
          </div>
        )}
      </div>

      <PrinterSettings btName={btName} onConnect={connecterImprimante} onDisconnect={deconnecterImprimante} onTest={ticketDeTest} printing={printing}
        paperColumns={paperColumns} onPaper={choosePaper} autoPrint={autoPrint} onAutoPrint={choisirAutoPrint} onNewTicket={() => setEditeur({ order: null })} />

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
          <ProgressBar status={o.status} orderType={o.orderType} />
          <DeliveryTiming order={o} />
          <div className="small" style={{ margin: '6px 0' }}>{o.items.length > 0 ? o.items.map(formatOrderItem).join(', ') : '🍽️ Réservation sans commande, le client commandera sur place'}</div>
          {o.orderType === 'delivery' && <div className="small">📍 {o.address}</div>}
          {o.orderType === 'dine_in' && <div className="small">{t('ordersResto.dineInLine', { n: o.partySize, name: o.reservationName })}</div>}
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          {o.orderType === 'delivery' && o.driverName && ['preparation', 'pret'].includes(o.status) && (
            <div className="small" style={{ fontWeight: 600 }}>{t('ordersResto.driverAssigned', { name: o.driverName })}</div>
          )}
          <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {o.status === 'nouveau' && (
              <>
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'accept')}>{t('ordersResto.accept')}</button>
                <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'refuse')}>{t('ordersResto.refuse')}</button>
              </>
            )}
            {o.status === 'preparation' && (
              <button className="btn-gold" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
            )}
          </div>
          {o.status === 'pret' && (o.orderType === 'pickup' || o.orderType === 'dine_in') && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input
                placeholder={t('ordersResto.phCustomerCode')}
                style={{ maxWidth: 140 }}
                value={pickupCodeInputs[o.id] || ''}
                onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o.id)}>
                {confirmingPickup === o.id ? '...' : o.orderType === 'dine_in' ? t('ordersResto.validateArrival') : t('ordersResto.validateOrder')}
              </button>
            </div>
          )}
          {o.status === 'pret' && o.orderType === 'delivery' && o.driverId && (
            <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <input
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
              {selectedOrder.serviceFee > 0 && <div className="line"><span>{t('ordersResto.serviceFee')}</span><span>{selectedOrder.serviceFee.toFixed(2)}€</span></div>}
              {selectedOrder.balanceUsed > 0 && <div className="line"><span>{t('ordersResto.balanceUsed')}</span><span>-{selectedOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>{t('ordersResto.totalPaid')}</span><span>{selectedOrder.total.toFixed(2)}€</span></div>
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
            {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}>🔑 {deliveryInstructionLabel(selectedOrder.deliveryInstructions)}</p>}
            {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}>📝 {selectedOrder.deliveryNote}</p>}
            {selectedOrder.orderType === 'delivery' && selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.driverLine', { name: selectedOrder.driverName, phone: selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : '' })}</p>}
            {selectedOrder.status === 'pret' && (selectedOrder.orderType === 'pickup' || selectedOrder.orderType === 'dine_in') && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  placeholder={t('ordersResto.phCustomerCode')}
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmTakeaway(selectedOrder.id)}>
                  {confirmingPickup === selectedOrder.id ? '...' : selectedOrder.orderType === 'dine_in' ? t('ordersResto.validateArrival') : t('ordersResto.validateOrder')}
                </button>
              </div>
            )}
            {selectedOrder.status === 'pret' && selectedOrder.orderType === 'delivery' && selectedOrder.driverId && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
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
              {t('ordersResto.slipInBag')} {btSupported ? t('ordersResto.printBtHelp') : t('ordersResto.printNoBtHelp')}
            </p>
            {btSupported && (
              <div className="row" style={{ gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <span className="small">{t('ordersResto.paper')}</span>
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
            {impressions[selectedOrder.id] > 0 && (
              <p className="small" style={{ margin: '0 0 8px' }}>✅ {t('ordersResto.printedTimes', { n: impressions[selectedOrder.id] })} {t('ordersResto.reprintHint')}</p>
            )}
            <div className="row" style={{ marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
              {btSupported && (
                <button className="btn-teal" disabled={printing} onClick={() => printBluetooth(selectedOrder)}>
                  {printing ? t('ordersResto.printing') : impressions[selectedOrder.id] ? t('ordersResto.printAgain') : btName ? t('ordersResto.printTicket') : t('ordersResto.connectAndPrint')}
                </button>
              )}
              {btSupported && btName && (
                <button className="btn-outline" disabled={printing} onClick={() => printBluetooth(selectedOrder, { copies: 2 })}>{t('ordersResto.printTwo')}</button>
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
      {editeur && (
        <TicketEditor initial={editeur.order} btName={btName} printing={printing}
          onPrintBluetooth={(ticket, copies) => printBluetooth(ticket, { copies })}
          onPrintBrowser={printReceiptEdite}
          onClose={() => setEditeur(null)} />
      )}
    </div>
  );
}
