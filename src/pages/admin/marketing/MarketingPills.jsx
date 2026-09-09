// Pastilles de statut de l'application Marketing (même vocabulaire de couleurs que les autres
// applications : teal = en cours/planifié, gold = terminé, rouge = échec, gris = annulé/ignoré).
const STATUS_CLASS = { scheduled: 'teal', sending: 'teal', sent: 'gold' };
const STATUS_COLOR = { cancelled: 'var(--ink-soft)', failed: 'var(--red)' };

export function StatusPill({ status, tr }) {
  const cls = STATUS_CLASS[status] ? `pill ${STATUS_CLASS[status]}` : 'pill';
  return (
    <span className={cls} style={STATUS_COLOR[status] ? { color: STATUS_COLOR[status] } : undefined}>
      {status === 'sending' ? '⏳ ' : ''}{tr(`adminMarketing.status_${status}`)}
    </span>
  );
}

export function SendStatePill({ status, tr }) {
  const style = status === 'failed' ? { color: 'var(--red)' } : status === 'skipped' ? { color: 'var(--ink-soft)' } : undefined;
  return <span className={status === 'sent' ? 'pill gold' : 'pill'} style={style}>{tr(`adminMarketing.sendState_${status}`)}</span>;
}
