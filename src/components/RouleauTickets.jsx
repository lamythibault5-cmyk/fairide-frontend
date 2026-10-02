import TicketPapier from './TicketPapier';
import { getLocale } from '../context/LanguageContext';
import { imprimerTicketPapier } from '../impressionPapier';

// Les derniers tickets sortis d'un terminal (imprimante virtuelle de la simulation) : le plus récent en haut, ceux
// qui viennent d'arriver glissent comme un ticket qui sort de la machine.
export default function RouleauTickets({ tickets = [], nouveaux = [], t, max = 6, onReprint }) {
  if (!tickets.length) return <p className="small" style={{ margin: 0 }}>{t('simulation.printerEmpty')}</p>;
  const heure = (d) => (d ? new Date(d).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
  return (
    <div className="tickets-rouleau">
      {tickets.slice(0, max).map((x) => (
        <div key={x.id} className={nouveaux.includes(x.id) ? 'ticket-arrive' : ''} style={{ width: '100%', display: 'grid', justifyItems: 'center', gap: 4 }}>
          <div className="ticket-entete">
            <span><b>{t(`simulation.ticket_${x.kind}`)}</b>{x.orderNumber ? ` · #${String(x.orderNumber).padStart(3, '0')}` : ''}</span>
            <span>
              {heure(x.printedAt)}
              <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} title={t('simulation.printPaperHelp')} onClick={() => imprimerTicketPapier(x.lines, x.columns || 32)}>{t('simulation.printPaper')}</button>
              {onReprint && x.orderId && x.kind !== 'cancel' && (
                <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => onReprint(x.orderId, x.kind)}>{t('simulation.reprint')}</button>
              )}
            </span>
          </div>
          <TicketPapier lines={x.lines} columns={x.columns || 32} />
        </div>
      ))}
    </div>
  );
}
