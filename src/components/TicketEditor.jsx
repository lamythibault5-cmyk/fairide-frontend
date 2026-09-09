import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

// Éditeur de ticket : à partir d'une commande (pour corriger ou compléter avant impression) ou de zéro
// (commande passée par téléphone, table sur place, ticket de cuisine libre). On modifie le nom, le type,
// les lignes (libellé, quantité, prix), une note, puis on imprime en Bluetooth (avec le nombre de copies
// voulu) ou par la boîte d'impression. Rien n'est enregistré côté serveur : c'est un ticket papier.
const euro = (n) => `${Number(n || 0).toFixed(2)} €`;

function depuisCommande(order, t) {
  if (!order) return { clientName: '', orderType: 'pickup', items: [{ name: '', qty: 1, price: '' }], note: '', deliveryFee: 0, address: '' };
  return {
    clientName: order.clientName || '', orderType: order.orderType || 'delivery',
    items: (order.items || []).map((it) => ({ name: it.name, qty: it.qty || 1, price: it.price ?? '' })),
    note: order.deliveryNote || order.deliveryInstructions || '', deliveryFee: Number(order.deliveryFee || 0), address: order.address || '',
    id: order.id, clientPhone: order.clientPhone || ''
  };
}

export function ticketVersCommande(f) {
  const items = f.items.filter((it) => String(it.name || '').trim()).map((it) => ({ name: it.name.trim(), qty: Math.max(1, Number(it.qty) || 1), price: Number(String(it.price).replace(',', '.')) || 0 }));
  const subtotal = +items.reduce((a, it) => a + it.qty * it.price, 0).toFixed(2);
  const deliveryFee = f.orderType === 'delivery' ? Number(f.deliveryFee || 0) : 0;
  return {
    id: f.id || `M-${Date.now().toString(36).toUpperCase().slice(-6)}`, clientName: f.clientName || '', reservationName: f.clientName || '', partySize: null, clientPhone: f.clientPhone || '', orderType: f.orderType,
    items, subtotal, deliveryFee, serviceFee: 0, promoDiscount: 0, balanceUsed: 0, total: +(subtotal + deliveryFee).toFixed(2),
    deliveryNote: f.note || '', address: f.address || '', createdAt: Date.now(), paid: true, status: 'nouveau', manuel: !f.id
  };
}

export default function TicketEditor({ initial, btName, printing, onPrintBluetooth, onPrintBrowser, onClose }) {
  const { t } = useLanguage();
  const [f, setF] = useState(() => depuisCommande(initial, t));
  const [copies, setCopies] = useState(1);
  const [imprimes, setImprimes] = useState(0);
  const apercu = useMemo(() => ticketVersCommande(f), [f]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setItem = (i, k, v) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const ajouter = () => setF((x) => ({ ...x, items: [...x.items, { name: '', qty: 1, price: '' }] }));
  const retirer = (i) => setF((x) => ({ ...x, items: x.items.length > 1 ? x.items.filter((_, j) => j !== i) : x.items }));

  async function imprimerBt() {
    if (!apercu.items.length) return;
    const ok = await onPrintBluetooth(apercu, copies);
    if (ok) setImprimes((n) => n + copies);
  }

  return createPortal(
    <div className="modal-overlay no-print" onClick={onClose}>
      <div className="modal-box ticket-editor" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{initial ? t('ticketEditor.titleEdit', { id: String(initial.id).slice(0, 8) }) : t('ticketEditor.titleNew')}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <p className="small" style={{ margin: '0 0 12px' }}>{initial ? t('ticketEditor.introEdit') : t('ticketEditor.introNew')}</p>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 200px', margin: 0 }}>
            <label htmlFor="tk-nom">{t('ticketEditor.client')}</label>
            <input id="tk-nom" value={f.clientName} onChange={set('clientName')} placeholder={t('ticketEditor.clientPh')} />
          </div>
          <div className="field" style={{ flex: '1 1 150px', margin: 0 }}>
            <label htmlFor="tk-type">{t('ticketEditor.type')}</label>
            <select id="tk-type" value={f.orderType} onChange={set('orderType')}>
              <option value="delivery">{t('ticketEditor.typeDelivery')}</option>
              <option value="pickup">{t('ticketEditor.typePickup')}</option>
              <option value="dine_in">{t('ticketEditor.typeDineIn')}</option>
            </select>
          </div>
        </div>

        <div className="ticket-lignes">
          <div className="ticket-ligne ticket-ligne-tete"><span>{t('ticketEditor.item')}</span><span>{t('ticketEditor.qty')}</span><span>{t('ticketEditor.price')}</span><span /></div>
          {f.items.map((it, i) => (
            <div className="ticket-ligne" key={i}>
              <input value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder={t('ticketEditor.itemPh')} aria-label={t('ticketEditor.item')} />
              <input type="number" min="1" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} aria-label={t('ticketEditor.qty')} />
              <input inputMode="decimal" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="0.00" aria-label={t('ticketEditor.price')} />
              <button type="button" className="btn-ghost" onClick={() => retirer(i)} aria-label={t('ticketEditor.remove')}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 12px', fontSize: 13 }} onClick={ajouter}>+ {t('ticketEditor.addLine')}</button>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="tk-note">{t('ticketEditor.note')}</label>
          <textarea id="tk-note" rows={2} value={f.note} onChange={set('note')} placeholder={t('ticketEditor.notePh')} style={{ width: '100%' }} />
        </div>

        <div className="ticket-apercu small">
          <b>{t('ticketEditor.preview')}</b> · {apercu.items.length} {t('ticketEditor.lines')} · {t('ticketEditor.subtotal')} {euro(apercu.subtotal)}{apercu.deliveryFee ? ` · ${t('ticketEditor.delivery')} ${euro(apercu.deliveryFee)}` : ''} · <b>{t('ticketEditor.total')} {euro(apercu.total)}</b>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          {btName && (
            <>
              <label className="small" htmlFor="tk-copies">{t('ticketEditor.copies')}</label>
              <select id="tk-copies" value={copies} onChange={(e) => setCopies(Number(e.target.value))} style={{ width: 70 }}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" className="btn-teal" disabled={printing || !apercu.items.length} onClick={imprimerBt}>
                {printing ? t('ordersResto.printing') : imprimes ? t('ticketEditor.printAgain') : t('ordersResto.printTicket')}
              </button>
            </>
          )}
          <button type="button" className="btn-outline" disabled={!apercu.items.length} onClick={() => onPrintBrowser(apercu)}>{t('ordersResto.printDeliveryNote')}</button>
          {imprimes > 0 && <span className="small" style={{ marginLeft: 'auto' }}>✅ {t('ticketEditor.printedCount', { n: imprimes })}</span>}
        </div>
        {!btName && <p className="small" style={{ margin: '8px 0 0' }}>{t('ticketEditor.noPrinter')}</p>}
      </div>
    </div>,
    document.body
  );
}
