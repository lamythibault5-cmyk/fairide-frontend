import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import * as btPrinter from '../bluetoothPrinter';
import { COLUMNS_58MM, COLUMNS_80MM } from '../escposTicket';

// « Imprimante à tickets » en tête de la page Commandes : l'état de la connexion, le bouton pour
// appairer l'imprimante thermique (Bluetooth BLE, depuis Chrome / Edge), un ticket de test, la largeur
// du papier, et l'impression automatique de chaque nouvelle commande. Le tout était jusqu'ici enfoui
// dans la fenêtre d'une commande : on ne pouvait ni préparer l'imprimante avant le service, ni savoir
// d'un coup d'œil si elle était encore connectée.
export const AUTO_PRINT_KEY = 'fairide.autoPrint';

export default function PrinterSettings({ btName, onConnect, onDisconnect, onTest, printing, paperColumns, onPaper, autoPrint, onAutoPrint, onNewTicket }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(() => !btName);
  const supporte = btPrinter.isSupported();
  const raison = btPrinter.unsupportedReason();

  return (
    <div className="card printer-card">
      <button type="button" className="printer-head" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span className="printer-head-titre">🖨️ {t('ordersResto.printerTitle')}</span>
        <span className={`pill${btName ? ' teal' : ''}`}>{btName ? `🔗 ${btName}` : supporte ? t('ordersResto.printerStatusNone') : t('ordersResto.printerStatusUnsupported')}</span>
        {autoPrint && btName && <span className="pill gold">{t('ordersResto.autoPrintOn')}</span>}
        <span aria-hidden="true" style={{ marginLeft: 'auto', transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      {ouvert && (
        <div className="printer-body">
          {supporte ? (
            <>
              <p className="small" style={{ margin: '0 0 10px' }}>{t('ordersResto.printerHelp')}</p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {!btName
                  ? <button type="button" className="btn-teal" disabled={printing} onClick={onConnect}>{printing ? '…' : t('ordersResto.printerConnect')}</button>
                  : <>
                    <button type="button" className="btn-outline" disabled={printing} onClick={onTest}>{printing ? t('ordersResto.printing') : t('ordersResto.printerTest')}</button>
                    <button type="button" className="btn-ghost" disabled={printing} onClick={onDisconnect}>{t('ordersResto.printerDisconnect')}</button>
                  </>}
                <span className="small" style={{ marginLeft: 'auto' }}>{t('ordersResto.paper')}</span>
                <button type="button" className={paperColumns === COLUMNS_58MM ? 'btn-teal' : 'btn-outline'} style={{ padding: '5px 11px', fontSize: 12 }} onClick={() => onPaper(COLUMNS_58MM)}>58 mm</button>
                <button type="button" className={paperColumns === COLUMNS_80MM ? 'btn-teal' : 'btn-outline'} style={{ padding: '5px 11px', fontSize: 12 }} onClick={() => onPaper(COLUMNS_80MM)}>80 mm</button>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button type="button" className="btn-outline" onClick={onNewTicket}>✏️ {t('ordersResto.newTicket')}</button>
                <span className="small">{t('ordersResto.newTicketHelp')}</span>
              </div>
              <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginTop: 12 }}>
                <input type="checkbox" checked={autoPrint} onChange={(e) => onAutoPrint(e.target.checked)} style={{ marginTop: 3, width: 'auto' }} />
                <span><b>{t('ordersResto.autoPrint')}</b><br /><span className="small">{t('ordersResto.autoPrintHelp')}</span></span>
              </label>
            </>
          ) : (
            <>
              <p className="small" style={{ margin: 0 }}>{raison || t('ordersResto.printNoBtHelp')}</p>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button type="button" className="btn-outline" onClick={onNewTicket}>✏️ {t('ordersResto.newTicket')}</button>
                <span className="small">{t('ordersResto.newTicketHelp')}</span>
              </div>
            </>
          )}
          <div className="printer-compat small">
            <b>{t('ordersResto.printerCompatTitle')}</b>
            <ul>
              <li>{t('ordersResto.printerCompat1')}</li>
              <li>{t('ordersResto.printerCompat2')}</li>
              <li>{t('ordersResto.printerCompat3')}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
