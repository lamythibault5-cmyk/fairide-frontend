import { fmtDateTime } from '../../pages/admin/adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const actionLabels = (tr) => ({
  order_status_override: tr('adminHistory.a_order_status_changed'),
  order_driver_reassign: tr('adminHistory.a_driver_reassigned'),
  order_refund: tr('adminHistory.a_refund'),
  restaurant_status_change: tr('adminHistory.a_restaurant_status'),
  restaurant_edit: tr('adminHistory.a_info_updated'),
  driver_status_change: tr('adminHistory.a_driver_status'),
  client_status_change: tr('adminHistory.a_client_status'),
  note_added: tr('adminHistory.a_note_added'),
  settings_change: tr('adminHistory.a_pricing_updated'),
  crm_prospect_created: tr('adminHistory.a_prospect_created'),
  crm_prospect_updated: tr('adminHistory.a_prospect_updated'),
  crm_stage_change: tr('adminHistory.a_crm_stage'),
  crm_prospect_converted: tr('adminHistory.a_converted'),
  ticket_created: tr('adminHistory.a_ticket_created'),
  ticket_updated: tr('adminHistory.a_ticket_updated'),
  ticket_status_change: tr('adminHistory.a_ticket_status'),
  ticket_escalated: tr('adminHistory.a_ticket_escalated'),
  ticket_replied: tr('adminHistory.a_reply_sent'),
  task_created: tr('adminHistory.a_task_created'),
  task_updated: tr('adminHistory.a_task_updated'),
  task_status_change: tr('adminHistory.a_task_status'),
  task_deleted: tr('adminHistory.a_task_deleted'),
  automation_rule_updated: tr('adminHistory.a_automation_updated'),
  automation_run_triggered: tr('adminHistory.a_manual_run')
});

function describeDetails(action, details, tr) {
  if (!details) return '';
  if (action === 'order_status_override') return `→ ${details.status}`;
  if (action === 'order_driver_reassign') return `→ ${details.driverName}`;
  if (action === 'order_refund') return `${Number(details.amount).toFixed(2)}€ (${details.responsibility})`;
  if (action === 'restaurant_status_change' || action === 'driver_status_change' || action === 'client_status_change') return `→ ${details.status}`;
  if (action === 'note_added') return `"${details.text}"`;
  if (action === 'settings_change') return Object.entries(details).map(([k, v]) => `${k}=${v}`).join(', ');
  if (action === 'crm_stage_change') return `→ ${details.stage}${details.lossReason ? ` (${details.lossReason})` : ''}`;
  if (action === 'crm_prospect_converted') return `→ ${details.restaurantName}`;
  if (action === 'ticket_status_change') return `→ ${details.status}`;
  if (action === 'ticket_escalated') return details.escalated ? `⚠️ ${details.reason || ''}` : tr('adminHistory.deescalated');
  if (action === 'ticket_replied') return `"${details.text}"`;
  if (action === 'task_status_change') return `→ ${details.status}`;
  if (action === 'task_created' || action === 'task_deleted') return details.title ? `"${details.title}"` : '';
  return '';
}

// Historique des actions admin, réutilisé sur toutes les fiches — même backend transverse (admin_actions),
// voir GET /admin/actions.
export default function AdminActionHistory({ actions }) {
  const { t: tr } = useLanguage();
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>{tr('adminHistory.title')}</h4>
      {(!actions || actions.length === 0) && <div className="small" style={{ opacity: 0.6 }}>{tr('adminHistory.none')}</div>}
      {actions && actions.map((a) => (
        <div key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', gap: 8 }}>
          <span className="small">{actionLabels(tr)[a.action] || a.action} {describeDetails(a.action, a.details, tr)}</span>
          <span className="small" style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>{a.adminEmail} · {fmtDateTime(a.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
