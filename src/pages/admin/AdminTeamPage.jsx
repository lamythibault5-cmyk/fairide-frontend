import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { ErrorCard, LoadMore, RecordLink, ResultCount } from '../../components/admin/AdminListTools';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonCards } from '../../components/Skeleton';
import useAdminRole from '../../hooks/useAdminRole';
import { fmtDateTime, useDebouncedValue } from './adminUtils';
import { ADMIN_GROUPS, ADMIN_MODULES } from './adminModules';
import '../../admin-team.css';

// Équipe & accès — qui fait partie de l'équipe Fairide, avec quel rôle, et ce que chacun a fait dans la
// console. Trois onglets (?tab=) : Membres (cartes + invitation), Rôles (matrice rôles × applications,
// miroir de MODULE_ROLES / ROLE_PREFIXES côté serveur) et Activité (journal admin_actions).
const TABS = ['members', 'roles', 'activity'];
const ROLES = ['owner', 'admin', 'ops', 'support', 'finance'];
const PAGE = 50;

// Libellés des actions du journal : ceux déjà traduits pour les fiches (adminHistory.*) + ceux de l'équipe.
const ACTION_KEYS = {
  order_status_override: 'adminHistory.a_order_status_changed', order_driver_reassign: 'adminHistory.a_driver_reassigned', order_refund: 'adminHistory.a_refund',
  restaurant_status_change: 'adminHistory.a_restaurant_status', restaurant_edit: 'adminHistory.a_info_updated', driver_status_change: 'adminHistory.a_driver_status',
  client_status_change: 'adminHistory.a_client_status', note_added: 'adminHistory.a_note_added', settings_change: 'adminHistory.a_pricing_updated',
  crm_prospect_created: 'adminHistory.a_prospect_created', crm_prospect_updated: 'adminHistory.a_prospect_updated', crm_stage_change: 'adminHistory.a_crm_stage',
  crm_prospect_converted: 'adminHistory.a_converted', ticket_created: 'adminHistory.a_ticket_created', ticket_updated: 'adminHistory.a_ticket_updated',
  ticket_status_change: 'adminHistory.a_ticket_status', ticket_escalated: 'adminHistory.a_ticket_escalated', ticket_replied: 'adminHistory.a_reply_sent',
  task_created: 'adminHistory.a_task_created', task_updated: 'adminHistory.a_task_updated', task_status_change: 'adminHistory.a_task_status',
  task_deleted: 'adminHistory.a_task_deleted', automation_rule_updated: 'adminHistory.a_automation_updated', automation_run_triggered: 'adminHistory.a_manual_run',
  team_member_invited: 'adminTeam.act_invited', team_member_role_changed: 'adminTeam.act_roleChanged', team_member_deactivated: 'adminTeam.act_deactivated',
  team_member_reactivated: 'adminTeam.act_reactivated', team_member_updated: 'adminTeam.act_updated', team_member_removed: 'adminTeam.act_removed',
  team_invitation_resent: 'adminTeam.act_resent'
};
function libelleAction(action, tr) {
  const k = ACTION_KEYS[action];
  if (k) { const v = tr(k); if (v !== k) return v; }
  return String(action || '').replace(/_/g, ' ');
}
// Cibles pour lesquelles une fiche s'ouvre ailleurs dans l'ERP (voir RecordLink / CIBLES_FICHE).
const CIBLES_LIENS = new Set(['restaurant', 'driver', 'client', 'order', 'crm_prospect', 'ticket', 'document', 'invoice', 'task']);

function initiales(m) {
  const base = (m.name || m.email || '').trim();
  const parts = base.includes('@') ? [base[0]] : base.split(/\s+/).slice(0, 2).map((p) => p[0]);
  return parts.join('').toUpperCase() || '?';
}
function resumeDetails(d) {
  if (!d || typeof d !== 'object') return '';
  try { return Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '); } catch { return ''; }
}

export default function AdminTeamPage() {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const { role: monRole, isOwner, refresh: refreshRole } = useAdminRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'members';
  const go = (next) => setSearchParams(next === 'members' ? {} : { tab: next }, { replace: true });

  const [membres, setMembres] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [inviter, setInviter] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try { setMembres(await api('/admin/team/members', { token })); } catch (e) { setErreur(e.message); setMembres([]); }
  }, [token]);
  useEffect(() => { charger(); }, [charger]);

  const peutGerer = monRole === 'owner' || monRole === 'admin';
  const nbActifs = (membres || []).filter((m) => m.active).length;

  return (
    <div>
      <AdminPageHeader
        module="team"
        actions={peutGerer ? <button type="button" className="btn-gold" onClick={() => setInviter(true)}>{tr('adminTeam.invite')}</button> : null}
      />
      <nav className="team-tabs" aria-label={tr('adminTeam.tabsAria')}>
        <div role="tab" aria-selected={tab === 'members'} className={`chip${tab === 'members' ? ' active' : ''}`} onClick={() => go('members')}>
          {tr('adminTeam.tab_members')}{membres ? <span className="pill">{nbActifs}</span> : null}
        </div>
        <div role="tab" aria-selected={tab === 'roles'} className={`chip${tab === 'roles' ? ' active' : ''}`} onClick={() => go('roles')}>{tr('adminTeam.tab_roles')}</div>
        <div role="tab" aria-selected={tab === 'activity'} className={`chip${tab === 'activity' ? ' active' : ''}`} onClick={() => go('activity')}>{tr('adminTeam.tab_activity')}</div>
      </nav>

      {tab === 'members' && (
        <MembresTab membres={membres} erreur={erreur} recharger={charger} monRole={monRole} isOwner={isOwner} moi={user?.email} token={token} toast={toast} tr={tr} onInvite={peutGerer ? () => setInviter(true) : null} refreshRole={refreshRole} />
      )}
      {tab === 'roles' && <RolesTab token={token} tr={tr} />}
      {tab === 'activity' && <ActiviteTab token={token} tr={tr} membres={membres || []} />}

      {inviter && createPortal(
        <InviterDrawer token={token} tr={tr} toast={toast} isOwner={isOwner} onClose={() => setInviter(false)} onDone={() => { setInviter(false); charger(); }} />,
        document.body
      )}
    </div>
  );
}

// --- Onglet Membres ----------------------------------------------------------------------------------------

function MembresTab({ membres, erreur, recharger, monRole, isOwner, moi, token, toast, tr, onInvite, refreshRole }) {
  const { t } = useLanguage();
  const [recherche, setRecherche] = useState('');
  const q = useDebouncedValue(recherche, 200).trim().toLowerCase();
  const [filtre, setFiltre] = useState('all'); // all | active | inactive
  const [edition, setEdition] = useState(null); // membre en cours de modification (drawer)
  const [confirm, setConfirm] = useState(null); // { kind: 'deactivate'|'reactivate'|'remove'|'role', membre, role? }
  const [occupe, setOccupe] = useState(false);

  const liste = useMemo(() => (membres || []).filter((m) => {
    if (filtre === 'active' && !m.active) return false;
    if (filtre === 'inactive' && m.active) return false;
    if (q && !`${m.name || ''} ${m.email}`.toLowerCase().includes(q)) return false;
    return true;
  }), [membres, filtre, q]);

  const moiMin = String(moi || '').toLowerCase();
  const peutGerer = monRole === 'owner' || monRole === 'admin';
  const parRole = useMemo(() => ROLES.map((r) => ({ role: r, n: (membres || []).filter((m) => m.active && m.role === r).length })).filter((x) => x.n > 0), [membres]);

  async function executer(c) {
    setOccupe(true);
    try {
      if (c.kind === 'remove') {
        await api(`/admin/team/members/${encodeURIComponent(c.membre.email)}`, { method: 'DELETE', token });
        toast(tr('adminTeam.toastRemoved'));
      } else if (c.kind === 'role') {
        await api(`/admin/team/members/${encodeURIComponent(c.membre.email)}`, { method: 'PATCH', token, body: { role: c.role, name: c.name } });
        toast(tr('adminTeam.toastRoleChanged'));
        setEdition(null);
      } else {
        await api(`/admin/team/members/${encodeURIComponent(c.membre.email)}`, { method: 'PATCH', token, body: { active: c.kind === 'reactivate' } });
        toast(c.kind === 'reactivate' ? tr('adminTeam.toastReactivated') : tr('adminTeam.toastDeactivated'));
      }
      setConfirm(null);
      await recharger();
      if (c.membre.email === moiMin) refreshRole();
    } catch (e) {
      toast(e.message);
    } finally {
      setOccupe(false);
    }
  }

  async function renvoyer(m) {
    try {
      const r = await api(`/admin/team/members/${encodeURIComponent(m.email)}/resend`, { method: 'POST', token });
      toast(r.emailSent ? tr('adminTeam.toastResent', { email: m.email }) : tr('adminTeam.toastResentNoMail'));
    } catch (e) { toast(e.message); }
  }

  // Un admin ne touche pas aux propriétaires ; personne ne touche aux fondateurs ni ne se retire soi-même.
  function actionsPossibles(m) {
    if (!peutGerer || m.isOwnerFixed) return { edit: false, toggle: false, remove: false, resend: false };
    if (m.role === 'owner' && !isOwner) return { edit: false, toggle: false, remove: false, resend: false };
    const moiMeme = m.email === moiMin;
    return { edit: true, toggle: !moiMeme, remove: !moiMeme, resend: m.active };
  }

  const titreConfirm = confirm ? {
    remove: tr('adminTeam.confirmRemoveTitle'), deactivate: tr('adminTeam.confirmDeactivateTitle'), reactivate: tr('adminTeam.confirmReactivateTitle'), role: tr('adminTeam.confirmRoleTitle')
  }[confirm.kind] : '';
  const messageConfirm = confirm ? {
    remove: tr('adminTeam.confirmRemoveMsg', { email: confirm.membre.email }),
    deactivate: tr('adminTeam.confirmDeactivateMsg', { email: confirm.membre.email }),
    reactivate: tr('adminTeam.confirmReactivateMsg', { email: confirm.membre.email }),
    role: tr('adminTeam.confirmRoleMsg', { email: confirm.membre.email, role: tr(`adminTeam.role_${confirm.role}`) })
  }[confirm.kind] : '';

  return (
    <div>
      {membres && membres.length > 0 && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{membres.filter((m) => m.active).length}</div><div className="label">{tr('adminTeam.kpiActive')}</div></div>
          {parRole.map((x) => <div key={x.role} className="stat-card"><div className="num">{x.n}</div><div className="label">{tr(`adminTeam.role_${x.role}`)}</div></div>)}
          <div className="stat-card"><div className="num">{membres.filter((m) => !m.hasAccount).length}</div><div className="label">{tr('adminTeam.kpiNoAccount')}</div></div>
        </div>
      )}
      <div className="admin-control-panel">
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={tr('adminTeam.searchPlaceholder')} aria-label={tr('adminTeam.searchPlaceholder')} style={{ maxWidth: 260 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {['all', 'active', 'inactive'].map((f) => (
            <div key={f} className={`chip${filtre === f ? ' active' : ''}`} onClick={() => setFiltre(f)}>{tr(`adminTeam.filter_${f}`)}</div>
          ))}
        </div>
        {membres && <ResultCount n={liste.length} total={membres.length} />}
      </div>

      {erreur && <ErrorCard message={erreur} onRetry={recharger} />}
      {!membres && !erreur && <div className="team-grid"><SkeletonCards count={4} /></div>}
      {membres && !erreur && liste.length === 0 && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>{membres.length === 0 ? tr('adminTeam.emptyMembers') : tr('adminCommon.nothingForFilter')}</p>
          {onInvite && membres.length === 0 && <button type="button" className="btn-gold" style={{ marginTop: 10 }} onClick={onInvite}>{tr('adminTeam.invite')}</button>}
        </div>
      )}
      {membres && liste.length > 0 && (
        <div className="team-grid">
          {liste.map((m) => {
            const a = actionsPossibles(m);
            return (
              <article key={m.email} className={`team-card${m.active ? '' : ' inactive'}${m.email === moiMin ? ' me' : ''}`}>
                <div className="team-card-head">
                  <span className={`team-avatar ${m.role}`} aria-hidden="true">{initiales(m)}</span>
                  <div className="team-card-id">
                    <b>{m.name || m.email.split('@')[0]}{m.email === moiMin ? ` (${tr('adminTeam.you')})` : ''}</b>
                    <span className="small">{m.email}</span>
                  </div>
                </div>
                <div className="team-card-meta">
                  <span className={`role-pill ${m.role}`}>{tr(`adminTeam.role_${m.role}`)}</span>
                  {m.isOwnerFixed && <span className="role-pill">{tr('adminTeam.fixedOwner')}</span>}
                  <span className={`team-status${m.active ? '' : ' off'}`}>{m.active ? tr('adminTeam.active') : tr('adminTeam.inactive')}</span>
                  {!m.hasAccount && <span className="team-status noaccount" title={tr('adminTeam.noAccountHint')}>{tr('adminTeam.noAccount')}</span>}
                </div>
                <div className="small" style={{ opacity: 0.7 }}>
                  {tr('adminTeam.lastSeen')} : {m.lastSeenAt ? fmtDateTime(m.lastSeenAt) : tr('adminTeam.never')}
                  {m.invitedBy && <> · {tr('adminTeam.invitedBy', { email: m.invitedBy })}</>}
                  {m.createdAt && <> · {tr('adminTeam.since', { date: fmtDateTime(m.createdAt) })}</>}
                </div>
                {(a.edit || a.toggle || a.remove || a.resend) && (
                  <div className="team-card-actions">
                    {a.edit && <button type="button" className="btn-outline" onClick={() => setEdition(m)}>{tr('adminTeam.changeRole')}</button>}
                    {a.toggle && (m.active
                      ? <button type="button" className="btn-ghost" onClick={() => setConfirm({ kind: 'deactivate', membre: m })}>{tr('adminCommon.disable')}</button>
                      : <button type="button" className="btn-ghost" onClick={() => setConfirm({ kind: 'reactivate', membre: m })}>{tr('adminCommon.reactivate')}</button>)}
                    {a.resend && <button type="button" className="btn-ghost" onClick={() => renvoyer(m)}>{tr('adminTeam.resend')}</button>}
                    {a.remove && <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirm({ kind: 'remove', membre: m })}>{tr('adminTeam.remove')}</button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {edition && createPortal(
        <ModifierDrawer membre={edition} tr={tr} isOwner={isOwner} onClose={() => setEdition(null)} onSubmit={(role, name) => setConfirm({ kind: 'role', membre: edition, role, name })} />,
        document.body
      )}
      <ConfirmDialog
        open={!!confirm}
        title={titreConfirm}
        message={messageConfirm}
        confirmLabel={confirm?.kind === 'remove' ? tr('adminTeam.remove') : tr('adminCommon.confirm')}
        danger={confirm?.kind === 'remove' || confirm?.kind === 'deactivate'}
        loading={occupe}
        onConfirm={() => executer(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// Choix du rôle avec l'explication de chacun — partagé par l'invitation et la modification.
function ChoixRole({ value, onChange, isOwner, tr }) {
  return (
    <div className="team-role-options" role="radiogroup" aria-label={tr('adminTeam.role')}>
      {ROLES.map((r) => {
        const bloque = r === 'owner' && !isOwner;
        return (
          <label key={r} className={`team-role-option${value === r ? ' active' : ''}${bloque ? ' disabled' : ''}`} title={bloque ? tr('adminTeam.ownerOnlyByOwner') : undefined}>
            <input type="radio" name="team-role" value={r} checked={value === r} disabled={bloque} onChange={() => onChange(r)} />
            <span>
              <span className={`role-pill ${r}`}>{tr(`adminTeam.role_${r}`)}</span>
              <span className="small">{tr(`adminTeam.roleDesc_${r}`)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function InviterDrawer({ token, tr, toast, isOwner, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('support');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  async function envoyer(e) {
    e?.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setErreur(tr('adminTeam.errEmail')); return; }
    setEnvoi(true); setErreur('');
    try {
      const r = await api('/admin/team/members', { method: 'POST', token, body: { email: mail, name: name.trim() || undefined, role } });
      toast(r.emailSent ? tr('adminTeam.toastInvited', { email: mail }) : tr('adminTeam.toastInvitedNoMail', { email: mail }));
      onDone();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <RecordDrawer
      title={tr('adminTeam.inviteTitle')}
      subtitle={tr('adminTeam.inviteSubtitle')}
      onClose={onClose}
      width={520}
      footer={(
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={envoi}>{tr('adminCommon.cancel')}</button>
          <button type="button" className="btn-gold" onClick={envoyer} disabled={envoi}>{envoi ? '...' : tr('adminTeam.sendInvite')}</button>
        </div>
      )}
    >
      <form onSubmit={envoyer}>
        <div className="field">
          <label htmlFor="team-invite-email">{tr('adminCommon.email')}</label>
          <input id="team-invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@fairide.be" autoFocus required />
        </div>
        <div className="field">
          <label htmlFor="team-invite-name">{tr('adminTeam.nameOptional')}</label>
          <input id="team-invite-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>{tr('adminTeam.role')}</label>
          <ChoixRole value={role} onChange={setRole} isOwner={isOwner} tr={tr} />
        </div>
        {erreur && <p className="field-error">{erreur}</p>}
        <p className="small" style={{ opacity: 0.75 }}>{tr('adminTeam.inviteExplain')}</p>
      </form>
    </RecordDrawer>
  );
}

function ModifierDrawer({ membre, tr, isOwner, onClose, onSubmit }) {
  const [role, setRole] = useState(membre.role);
  const [name, setName] = useState(membre.name || '');
  const change = role !== membre.role || (name.trim() || null) !== (membre.name || null);
  return (
    <RecordDrawer
      title={membre.name || membre.email}
      subtitle={membre.email}
      badge={<span className={`role-pill ${membre.role}`}>{tr(`adminTeam.role_${membre.role}`)}</span>}
      onClose={onClose}
      width={520}
      footer={(
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
          <button type="button" className="btn-gold" disabled={!change} onClick={() => onSubmit(role, name.trim() || null)}>{tr('adminTeam.save')}</button>
        </div>
      )}
    >
      <DrawerRow label={tr('adminTeam.lastSeen')} value={membre.lastSeenAt ? fmtDateTime(membre.lastSeenAt) : tr('adminTeam.never')} />
      <DrawerRow label={tr('adminTeam.account')} value={membre.hasAccount ? tr('adminTeam.hasAccount') : tr('adminTeam.noAccount')} />
      {membre.invitedBy && <DrawerRow label={tr('adminTeam.invitedByLabel')} value={membre.invitedBy} />}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="team-edit-name">{tr('adminCommon.name')}</label>
        <input id="team-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>{tr('adminTeam.role')}</label>
        <ChoixRole value={role} onChange={setRole} isOwner={isOwner} tr={tr} />
      </div>
    </RecordDrawer>
  );
}

// --- Onglet Rôles ------------------------------------------------------------------------------------------

function RolesTab({ token, tr }) {
  const [roles, setRoles] = useState(null);
  const [erreur, setErreur] = useState(null);
  const charger = useCallback(async () => {
    setErreur(null);
    try { setRoles(await api('/admin/team/roles', { token })); } catch (e) { setErreur(e.message); setRoles([]); }
  }, [token]);
  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <ErrorCard message={erreur} onRetry={charger} />;
  if (!roles) return <div className="team-role-cards"><SkeletonCards count={5} /></div>;
  const ordre = ROLES.filter((r) => roles.some((x) => x.role === r));
  const autorise = (role, key) => roles.find((x) => x.role === role)?.modules?.includes(key);

  return (
    <div>
      <div className="team-role-cards">
        {ordre.map((r) => (
          <div key={r} className="team-role-card">
            <span className={`role-pill ${r}`}>{tr(`adminTeam.role_${r}`)}</span>
            <p className="small">{tr(`adminTeam.roleDesc_${r}`)}</p>
            <p className="small" style={{ opacity: 0.7 }}>{tr('adminTeam.appsCount', { n: roles.find((x) => x.role === r)?.modules?.length || 0 })}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="small" style={{ margin: '0 0 10px' }}>{tr('adminTeam.matrixIntro')}</p>
        <div className="team-matrix-wrap">
          <table className="team-matrix">
            <thead>
              <tr>
                <th>{tr('adminTeam.application')}</th>
                {ordre.map((r) => <th key={r}><span className={`role-pill ${r}`}>{tr(`adminTeam.role_${r}`)}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {ADMIN_GROUPS.map((g) => {
                const mods = ADMIN_MODULES.filter((m) => m.group === g);
                if (!mods.length) return null;
                return [
                  <tr key={`g-${g}`} className="group-row"><td colSpan={ordre.length + 1}>{tr(`adminHome.group_${g}`)}</td></tr>,
                  ...mods.map((m) => (
                    <tr key={m.key}>
                      <td>{m.icon} {tr(`adminModules.${m.key}`)}</td>
                      {ordre.map((r) => (
                        <td key={r} aria-label={autorise(r, m.key) ? tr('adminTeam.allowed') : tr('adminTeam.notAllowed')}>
                          {autorise(r, m.key) ? <span className="ok">✓</span> : <span className="no">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Onglet Activité ----------------------------------------------------------------------------------------

function ActiviteTab({ token, tr, membres }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [action, setAction] = useState('');
  const [actions, setActions] = useState([]);
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [ouvert, setOuvert] = useState(null); // id de la ligne dont les détails sont dépliés
  const { sort, toggle } = useTableSort('createdAt', 'desc');

  useEffect(() => {
    api('/admin/team/activity/actions', { token }).then(setActions).catch(() => setActions([]));
  }, [token]);

  const charger = useCallback(async (offset = 0) => {
    setChargement(true); setErreur(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (email) params.set('email', email);
      if (action) params.set('action', action);
      const r = await api(`/admin/team/activity?${params}`, { token });
      setItems((prev) => (offset === 0 || !prev ? r.items : [...prev, ...r.items]));
      setTotal(r.total);
    } catch (e) {
      setErreur(e.message);
      if (offset === 0) setItems([]);
    } finally {
      setChargement(false);
    }
  }, [token, email, action]);
  useEffect(() => { charger(0); }, [charger]);

  // Adresses présentes dans le journal mais plus dans l'équipe (anciens membres) : proposées quand même.
  const emails = useMemo(() => {
    const set = new Set(membres.map((m) => m.email));
    for (const a of items || []) if (a.adminEmail) set.add(String(a.adminEmail).toLowerCase());
    return [...set].sort();
  }, [membres, items]);
  const nomDe = (mail) => membres.find((m) => m.email === String(mail || '').toLowerCase())?.name || mail;

  const columns = useMemo(() => [
    { key: 'createdAt', label: tr('adminCommon.date'), get: (a) => fmtDateTime(a.createdAt), sortValue: (a) => new Date(a.createdAt).getTime(), width: 150 },
    { key: 'adminEmail', label: tr('adminTeam.member'), get: (a) => <span className="team-activity-email" title={a.adminEmail}>{nomDe(a.adminEmail)}</span>, sortValue: (a) => a.adminEmail },
    { key: 'action', label: tr('adminTeam.action'), get: (a) => <b>{libelleAction(a.action, tr)}</b>, sortValue: (a) => a.action },
    { key: 'target', label: tr('adminTeam.target'), get: (a) => (
      CIBLES_LIENS.has(a.targetType) && a.targetId
        ? <RecordLink type={a.targetType} id={a.targetId} name={a.details?.name || a.details?.title || a.details?.restaurantName} label={`${a.targetType} ${String(a.targetId).slice(0, 8)}`} />
        : <span className="small">{a.targetType}{a.details?.email ? ` · ${a.details.email}` : ''}</span>
    ), sortValue: (a) => a.targetType },
    { key: 'details', label: tr('adminTeam.details'), get: (a) => {
      const txt = resumeDetails(a.details);
      if (!txt) return <span className="small" style={{ opacity: 0.5 }}>—</span>;
      const open = ouvert === a.id;
      return <span className={`small team-activity-details${open ? ' open' : ''}`} title={open ? undefined : txt} onClick={(e) => { e.stopPropagation(); setOuvert(open ? null : a.id); }} style={{ cursor: 'pointer' }}>{open ? JSON.stringify(a.details, null, 1) : txt}</span>;
    }, sortValue: (a) => resumeDetails(a.details) }
  ], [tr, ouvert, membres]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="admin-control-panel">
        <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label={tr('adminTeam.member')} style={{ maxWidth: 260 }}>
          <option value="">{tr('adminTeam.allMembers')}</option>
          {emails.map((m) => <option key={m} value={m}>{nomDe(m) === m ? m : `${nomDe(m)} — ${m}`}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label={tr('adminTeam.action')} style={{ maxWidth: 260 }}>
          <option value="">{tr('adminTeam.allActions')}</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{libelleAction(a.action, tr)} ({a.count})</option>)}
        </select>
        {(email || action) && <button type="button" className="btn-ghost" onClick={() => { setEmail(''); setAction(''); }}>{tr('adminTeam.clearFilters')}</button>}
        {items && <ResultCount n={items.length} total={total} />}
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={() => charger(0)} />}
      {!items && !erreur && <SkeletonCards count={3} />}
      {items && items.length === 0 && !erreur && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminTeam.emptyActivity')}</p></div>}
      {items && items.length > 0 && (
        <>
          <AdminDataTable columns={columns} rows={items} sort={sort} onSort={toggle} />
          <LoadMore loaded={items.length} total={total} loading={chargement} onMore={() => charger(items.length)} />
        </>
      )}
    </div>
  );
}
