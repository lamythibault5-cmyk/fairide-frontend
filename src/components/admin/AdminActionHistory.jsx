import { fmtDateTime } from '../../pages/admin/adminUtils';

const ACTION_LABELS = {
  order_status_override: 'Statut modifié manuellement',
  order_driver_reassign: 'Livreur réassigné',
  order_refund: 'Remboursement',
  restaurant_status_change: 'Statut restaurant modifié',
  restaurant_edit: 'Informations modifiées',
  driver_status_change: 'Statut livreur modifié',
  client_status_change: 'Statut client modifié',
  note_added: 'Note ajoutée',
  settings_change: 'Tarification modifiée',
  crm_prospect_created: 'Prospect créé',
  crm_prospect_updated: 'Prospect modifié',
  crm_stage_change: 'Étape CRM modifiée',
  crm_prospect_converted: 'Converti en partenaire',
  ticket_created: 'Ticket créé',
  ticket_updated: 'Ticket modifié',
  ticket_status_change: 'Statut ticket modifié',
  ticket_escalated: 'Ticket escaladé',
  ticket_replied: 'Réponse envoyée',
  task_created: 'Tâche créée',
  task_updated: 'Tâche modifiée',
  task_status_change: 'Statut tâche modifié',
  task_deleted: 'Tâche supprimée',
  automation_rule_updated: 'Règle automatisation modifiée',
  automation_run_triggered: 'Exécution manuelle déclenchée'
};

function describeDetails(action, details) {
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
  if (action === 'ticket_escalated') return details.escalated ? `⚠️ ${details.reason || ''}` : 'désescaladé';
  if (action === 'ticket_replied') return `"${details.text}"`;
  if (action === 'task_status_change') return `→ ${details.status}`;
  if (action === 'task_created' || action === 'task_deleted') return details.title ? `"${details.title}"` : '';
  return '';
}

// Historique des actions admin, réutilisé sur toutes les fiches — même backend transverse (admin_actions),
// voir GET /admin/actions.
export default function AdminActionHistory({ actions }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>🕐 Historique des actions</h4>
      {(!actions || actions.length === 0) && <div className="small" style={{ opacity: 0.6 }}>Aucune action admin pour l'instant.</div>}
      {actions && actions.map((a) => (
        <div key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', gap: 8 }}>
          <span className="small">{ACTION_LABELS[a.action] || a.action} {describeDetails(a.action, a.details)}</span>
          <span className="small" style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>{a.adminEmail} · {fmtDateTime(a.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
