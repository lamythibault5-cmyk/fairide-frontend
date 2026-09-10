import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonCards } from '../../components/Skeleton';
import { ErrorCard, Pager } from '../../components/admin/AdminListTools';
import { fmtDateTime, useDebouncedValue, estCompteSupprime } from './adminUtils';
import { COMMUNES } from '../../menuCategories';
import '../../admin-messages.css';

// Application « Messages » : Fairide écrit à ses comptes (annonce par type / commune / comptes précis,
// ou message direct), lit leurs réponses et réactions, répond — une conversation par personne.
// Serveur : routes/adminMessages.js (tables inbox_broadcasts / inbox_threads / inbox_messages).
const TABS = ['threads', 'broadcasts', 'compose'];
const ROLES = ['restaurant', 'driver', 'client'];
const PAGE_SIZE = 25;
const MAX_BODY = 2000;

function roleLabel(tr, role) { return tr(`adminMessages.roleOne_${role}`); }

// ---------------------------------------------------------------------------------------------
// Onglet Conversations
// ---------------------------------------------------------------------------------------------
function ThreadsTab({ token, tr, toast, broadcastFilter, onClearBroadcast, refreshKey, onChanged }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { sort, toggle } = useTableSort('lastMessageAt', 'desc');

  const load = useCallback(() => {
    setData(null); setErreur(null);
    const params = new URLSearchParams();
    if (unreadOnly) params.set('unread', '1');
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    if (broadcastFilter?.id) params.set('broadcastId', broadcastFilter.id);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/messages/threads?${params.toString()}`, { token }).then(setData).catch((e) => setErreur(e.message));
    api('/admin/messages/stats', { token }).then(setStats).catch(() => {});
  }, [token, unreadOnly, role, status, q, broadcastFilter?.id, page]);
  useEffect(load, [load, refreshKey]);
  useEffect(() => { setPage(0); }, [unreadOnly, role, status, q, broadcastFilter?.id]);

  const columns = useMemo(() => [
    { key: 'userName', label: tr('adminMessages.colAccount'), get: (r) => (
      <span>
        <b>{r.userName}</b>{r.restaurantName ? ` · ${r.restaurantName}` : ''}
        <br /><span className="msg-role">{roleLabel(tr, r.userRole)}{r.commune ? ` · ${r.commune}` : ''}</span>
      </span>
    ), sortValue: (r) => r.userName },
    { key: 'subject', label: tr('adminCommon.subject'), get: (r) => r.subject },
    { key: 'lastMessageAt', label: tr('adminMessages.colLast'), get: (r) => `${fmtDateTime(r.lastMessageAt)} · ${r.lastFrom === 'admin' ? tr('adminCommon.fairide') : r.userName}`, sortValue: (r) => r.lastMessageAt },
    { key: 'unreadAdmin', label: tr('adminMessages.colUnread'), align: 'right', get: (r) => (r.unreadAdmin > 0 ? <span className="msg-unread-pill">{r.unreadAdmin}</span> : ''), sortValue: (r) => r.unreadAdmin },
    { key: 'status', label: tr('adminCommon.status'), get: (r) => <span className={`msg-status ${r.status}`}>{tr(`adminMessages.status_${r.status}`)}</span> }
  ], [tr]);

  return (
    <>
      {stats && (
        <div className="stat-grid msg-kpis">
          <button type="button" className={`stat-card${stats.unread > 0 ? ' is-alert' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setUnreadOnly(true)}><div className="num">{stats.unread}</div><div className="label">{tr('adminMessages.kpiUnread')}</div></button>
          <button type="button" className="stat-card" style={{ textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => { setUnreadOnly(false); setStatus('open'); }}><div className="num">{stats.open}</div><div className="label">{tr('adminMessages.kpiOpen')}</div></button>
          <div className="stat-card"><div className="num">{stats.repliesWeek}</div><div className="label">{tr('adminMessages.kpiRepliesWeek')}</div></div>
          <div className="stat-card"><div className="num">{stats.broadcasts}</div><div className="label">{tr('adminMessages.kpiBroadcasts')}</div></div>
        </div>
      )}
      <div className="msg-filters">
        <button type="button" className={`chip${unreadOnly ? ' active' : ''}`} aria-pressed={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>{tr('adminMessages.filterUnread')}</button>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={tr('adminCommon.accountKind')}>
          <option value="">{tr('adminMessages.allRoles')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{tr(`adminMessages.role_${r}`)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr('adminCommon.status')}>
          <option value="">{tr('adminCommon.allStatuses')}</option>
          <option value="open">{tr('adminMessages.status_open')}</option>
          <option value="closed">{tr('adminMessages.status_closed')}</option>
        </select>
        <input type="search" value={qInput} placeholder={tr('adminMessages.phSearch')} onChange={(e) => setQInput(e.target.value)} aria-label={tr('adminMessages.phSearch')} />
        {broadcastFilter && (
          <span className="msg-filter-broadcast">
            {tr('adminMessages.broadcastFilter', { subject: broadcastFilter.subject })}
            <button type="button" onClick={onClearBroadcast} aria-label={tr('adminMessages.clearFilter')}>✕</button>
          </span>
        )}
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!erreur && !data && <SkeletonCards count={3} />}
      {data && data.items.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminMessages.noThreads')}</p></div>}
      {data && data.items.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <AdminDataTable columns={columns} rows={data.items} sort={sort} onSort={toggle} onRowClick={(r) => setSelectedId(r.id)} rowClassName={(r) => (r.unreadAdmin > 0 ? 'msg-row-unread' : '')} emptyLabel={tr('adminMessages.noThreads')} />
        </div>
      )}
      {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      {selectedId && createPortal(
        <ThreadDrawer id={selectedId} token={token} tr={tr} toast={toast} onClose={() => setSelectedId(null)} onChanged={() => { load(); onChanged?.(); }} />,
        document.body
      )}
    </>
  );
}

// Tiroir d'une conversation : infos du compte, bulles (compte à gauche, Fairide à droite), réponse,
// clôture / réouverture.
function ThreadDrawer({ id, token, tr, toast, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const fin = useRef(null);

  const load = useCallback(() => {
    setErreur(null);
    api(`/admin/messages/threads/${id}`, { token }).then((r) => { setData(r); onChanged?.(); }).catch((e) => setErreur(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
  useEffect(load, [load]);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [data?.messages?.length]);

  async function envoyer() {
    const body = reponse.trim();
    if (!body) return;
    setEnvoi(true);
    try {
      const r = await api(`/admin/messages/threads/${id}/messages`, { method: 'POST', token, body: { body } });
      setData((d) => ({ ...d, thread: { ...d.thread, status: 'open', lastFrom: 'admin' }, messages: [...d.messages, r.message] }));
      setReponse('');
      toast(tr('adminMessages.replySent'));
      onChanged?.();
    } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }

  async function basculerStatut() {
    const status = data.thread.status === 'closed' ? 'open' : 'closed';
    try {
      await api(`/admin/messages/threads/${id}`, { method: 'PATCH', token, body: { status } });
      setData((d) => ({ ...d, thread: { ...d.thread, status } }));
      toast(tr(status === 'closed' ? 'adminMessages.closedToast' : 'adminMessages.reopenedToast'));
      onChanged?.();
    } catch (e) { toast(e.message); }
  }

  const th = data?.thread;
  return (
    <RecordDrawer
      title={th ? th.subject : tr('adminCommon.loading')}
      subtitle={th ? tr('adminMessages.threadWith', { name: th.userName }) : ''}
      badge={th ? <span className={`msg-status ${th.status}`}>{tr(`adminMessages.status_${th.status}`)}</span> : null}
      actions={th ? <button type="button" className="btn-ghost" onClick={basculerStatut}>{tr(th.status === 'closed' ? 'adminMessages.reopen' : 'adminMessages.close')}</button> : null}
      onClose={onClose}
      width={680}
    >
      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!erreur && !data && <SkeletonCards count={2} />}
      {data && (
        <>
          <div className="msg-drawer-meta">
            <DrawerRow label={tr('adminCommon.email')} value={th.userEmail} />
            <DrawerRow label={tr('adminCommon.accountKind')} value={`${roleLabel(tr, th.userRole)}${th.restaurantName ? ` · ${th.restaurantName}` : ''}`} />
            {th.commune && <DrawerRow label={tr('adminCommon.commune')} value={th.commune} />}
          </div>
          <ol className="msg-bubbles">
            {data.messages.map((m) => (
              <li key={m.id} className={`msg-bubble ${m.fromRole === 'admin' ? 'from-admin' : 'from-user'}${m.reaction ? ' is-reaction' : ''}`}>
                <span className="msg-bubble-author">{m.fromRole === 'admin' ? `${tr('adminCommon.fairide')}${m.authorEmail ? ` · ${m.authorEmail}` : ''}` : th.userName}</span>
                <span className="msg-bubble-body">{m.reaction || m.body}</span>
                <span className="msg-bubble-date">{fmtDateTime(m.createdAt)}</span>
              </li>
            ))}
            <li ref={fin} aria-hidden="true" />
          </ol>
          <div className="msg-reply">
            <label htmlFor="msg-reponse" className="small">{tr('adminMessages.reply')}</label>
            <textarea id="msg-reponse" rows={4} maxLength={MAX_BODY} value={reponse} placeholder={tr('adminMessages.phReply')} onChange={(e) => setReponse(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(); } }} />
            <div className="msg-reply-actions">
              <span className="msg-counter">{reponse.length}/{MAX_BODY}</span>
              <button type="button" className="btn-teal" disabled={envoi || !reponse.trim()} onClick={envoyer}>{envoi ? tr('adminMessages.sending') : tr('adminMessages.send')}</button>
            </div>
          </div>
        </>
      )}
    </RecordDrawer>
  );
}

// ---------------------------------------------------------------------------------------------
// Onglet Annonces
// ---------------------------------------------------------------------------------------------
function audienceResume(tr, a) {
  if (!a) return '';
  if (a.userIds?.length) return tr('adminMessages.audience_users', { n: a.userIds.length });
  const parts = [];
  if (a.roles?.length) parts.push(tr('adminMessages.audience_roles', { roles: a.roles.length === ROLES.length ? tr('adminMessages.role_all') : a.roles.map((r) => tr(`adminMessages.role_${r}`)).join(', ') }));
  if (a.communes?.length) parts.push(tr('adminMessages.audience_communes', { communes: a.communes.join(', ') }));
  return parts.join(' · ');
}

function BroadcastsTab({ token, tr, refreshKey, onOpenThreads }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const load = useCallback(() => {
    setData(null); setErreur(null);
    api('/admin/messages/broadcasts', { token }).then(setData).catch((e) => setErreur(e.message));
  }, [token]);
  useEffect(load, [load, refreshKey]);

  if (erreur) return <ErrorCard message={erreur} onRetry={load} />;
  if (!data) return <SkeletonCards count={3} />;
  if (!data.items.length) return <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminMessages.noBroadcasts')}</p></div>;
  return (
    <div className="msg-broadcasts">
      {data.items.map((b) => (
        <button key={b.id} type="button" className="msg-broadcast" onClick={() => onOpenThreads(b)} title={tr('adminMessages.viewThreads')}>
          <h4>{b.subject}</h4>
          <span className="small">{fmtDateTime(b.createdAt)}{b.createdBy ? ` · ${tr('adminMessages.sentBy', { email: b.createdBy })}` : ''}</span>
          <span className="small">{audienceResume(tr, b.audience)}</span>
          <div className="msg-broadcast-body">{b.body}</div>
          <div className="msg-broadcast-counts">
            <span>{tr('adminMessages.recipients', { n: b.recipients })}</span>
            <span>{tr('adminMessages.readBy', { n: b.readCount })}</span>
            <span>{tr('adminMessages.replies', { n: b.replies })}</span>
            {b.unreadAdmin > 0 && <span className="unread">{tr('adminMessages.unreadShort', { n: b.unreadAdmin })}</span>}
          </div>
          {Object.keys(b.reactions || {}).length > 0 && (
            <div className="msg-reactions-summary" aria-label={tr('adminMessages.reactions')}>
              {Object.entries(b.reactions).map(([r, n]) => <span key={r}>{r} {n}</span>)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Onglet Nouveau message : sujet, corps (balises {prenom} / {commerce} remplacées côté serveur),
// audience (types, communes, ou comptes précis), aperçu du nombre de destinataires, e-mail facultatif.
// ---------------------------------------------------------------------------------------------
function ComposeTab({ token, tr, toast, onSent }) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [roles, setRoles] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [users, setUsers] = useState([]); // [{ id, name, email, role }]
  const [userQuery, setUserQuery] = useState('');
  const userQ = useDebouncedValue(userQuery, 300);
  const [userResults, setUserResults] = useState(null);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [preview, setPreview] = useState(null); // { count, sample }
  const [previewErr, setPreviewErr] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const bodyRef = useRef(null);

  const audience = useMemo(() => ({ roles, communes, userIds: users.map((u) => u.id) }), [roles, communes, users]);
  const audienceKey = JSON.stringify(audience);
  const specific = users.length > 0;

  // Aperçu du nombre de destinataires, recalculé à chaque changement d'audience.
  useEffect(() => {
    if (!specific && !roles.length) { setPreview({ count: 0, sample: [] }); return undefined; }
    let annule = false;
    setPreview(null); setPreviewErr(false);
    const timer = setTimeout(() => {
      api('/admin/messages/audience/preview', { method: 'POST', token, body: { audience: JSON.parse(audienceKey) } })
        .then((r) => { if (!annule) setPreview(r); })
        .catch(() => { if (!annule) setPreviewErr(true); });
    }, 250);
    return () => { annule = true; clearTimeout(timer); };
  }, [audienceKey, token, specific, roles.length]);

  // Recherche d'un compte précis (GET /admin/users?search=), comptes supprimés écartés.
  useEffect(() => {
    if (userQ.trim().length < 2) { setUserResults(null); return undefined; }
    let annule = false;
    api(`/admin/users?search=${encodeURIComponent(userQ.trim())}`, { token })
      .then((rows) => { if (!annule) setUserResults((rows || []).filter((u) => !estCompteSupprime(u)).slice(0, 12)); })
      .catch(() => { if (!annule) setUserResults([]); });
    return () => { annule = true; };
  }, [userQ, token]);

  function toggleRole(r) { setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])); }
  function toggleCommune(c) { setCommunes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])); }
  function ajouterUser(u) {
    setUsers((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, { id: u.id, name: u.name, email: u.email, role: u.role }]));
    setUserQuery(''); setUserResults(null);
  }
  function inserer(balise) {
    const el = bodyRef.current;
    if (!el) { setBody((b) => `${b}${balise}`); return; }
    const debut = el.selectionStart ?? body.length; const fin = el.selectionEnd ?? body.length;
    const suivant = `${body.slice(0, debut)}${balise}${body.slice(fin)}`;
    setBody(suivant);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(debut + balise.length, debut + balise.length); });
  }

  const pret = subject.trim() && body.trim() && (specific || roles.length > 0) && preview && preview.count > 0;

  async function envoyer() {
    setEnvoi(true);
    try {
      let r;
      if (specific && users.length === 1) {
        // Un seul compte : message direct (pas d'annonce), sans exclusion des comptes de test.
        r = await api('/admin/messages/threads', { method: 'POST', token, body: { userId: users[0].id, subject: subject.trim(), body: body.trim(), notifyByEmail } });
        toast(tr('adminMessages.sentToast', { n: 1 }));
      } else {
        r = await api('/admin/messages/broadcast', { method: 'POST', token, body: { subject: subject.trim(), body: body.trim(), audience, notifyByEmail } });
        toast(tr('adminMessages.sentToast', { n: r.recipients }));
      }
      setSubject(''); setBody(''); setRoles([]); setCommunes([]); setUsers([]); setNotifyByEmail(false);
      onSent?.(r);
    } catch (e) { toast(e.message); } finally { setEnvoi(false); setConfirm(false); }
  }

  // Un seul compte précis passe par le message direct : l'aperçu (qui exclut les comptes de test)
  // ne bloque pas dans ce cas.
  const compteDirect = specific && users.length === 1;
  const nombre = compteDirect ? 1 : (preview?.count ?? null);

  return (
    <>
      <div className="msg-compose">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{tr('adminMessages.composeTitle')}</h3>
          <div className="field">
            <label htmlFor="msg-subject">{tr('adminCommon.subject')}</label>
            <input id="msg-subject" value={subject} maxLength={140} placeholder={tr('adminMessages.phSubject')} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="msg-body">{tr('adminCommon.message')}</label>
            <textarea id="msg-body" ref={bodyRef} value={body} maxLength={MAX_BODY} placeholder={tr('adminMessages.phBody')} onChange={(e) => setBody(e.target.value)} />
            <div className="msg-placeholders">
              <span className="small">{tr('adminMessages.placeholdersHint')}</span>
              <button type="button" className="btn-ghost" onClick={() => inserer('{prenom}')}>{'{prenom}'}</button>
              <button type="button" className="btn-ghost" onClick={() => inserer('{commerce}')}>{'{commerce}'}</button>
              <span className="msg-counter" style={{ marginLeft: 'auto' }}>{body.length}/{MAX_BODY}</span>
            </div>
          </div>
          <label className="msg-notify">
            <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} />
            <span><b>{tr('adminMessages.notifyByEmail')}</b><br /><span className="small">{tr('adminMessages.notifyHint')}</span></span>
          </label>
          <div className="msg-compose-actions">
            <button type="button" className="btn-teal" disabled={!(pret || (compteDirect && subject.trim() && body.trim())) || envoi} onClick={() => setConfirm(true)}>{tr('adminMessages.sendBroadcast')}</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>{tr('adminMessages.audienceTitle')}</h3>
          <div className="msg-audience-group">
            <h4>{tr('adminMessages.audienceByRole')}</h4>
            <div className="msg-chips" role="group" aria-label={tr('adminMessages.audienceByRole')}>
              <button type="button" className={`chip${roles.length === ROLES.length ? ' active' : ''}`} disabled={specific} aria-pressed={roles.length === ROLES.length} onClick={() => setRoles(roles.length === ROLES.length ? [] : [...ROLES])}>{tr('adminMessages.role_all')}</button>
              {ROLES.map((r) => (
                <button key={r} type="button" className={`chip${roles.includes(r) ? ' active' : ''}`} disabled={specific} aria-pressed={roles.includes(r)} onClick={() => toggleRole(r)}>{tr(`adminMessages.role_${r}`)}</button>
              ))}
            </div>
          </div>
          <div className="msg-audience-group">
            <h4>{tr('adminMessages.audienceCommunes')}</h4>
            <div className="msg-chips msg-communes" role="group" aria-label={tr('adminMessages.audienceCommunes')}>
              <button type="button" className={`chip${!communes.length ? ' active' : ''}`} disabled={specific} aria-pressed={!communes.length} onClick={() => setCommunes([])}>{tr('adminMessages.allCommunes')}</button>
              {COMMUNES.map((c) => (
                <button key={c} type="button" className={`chip${communes.includes(c) ? ' active' : ''}`} disabled={specific} aria-pressed={communes.includes(c)} onClick={() => toggleCommune(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="msg-audience-group">
            <h4>{tr('adminMessages.audienceSpecific')}</h4>
            <div className="msg-user-search">
              <input type="search" value={userQuery} placeholder={tr('adminMessages.phUserSearch')} onChange={(e) => setUserQuery(e.target.value)} aria-label={tr('adminMessages.phUserSearch')} />
              {userResults && (
                <ul className="msg-user-results">
                  {userResults.length === 0 && <li><span className="small" style={{ padding: '8px 10px', display: 'block' }}>{tr('adminMessages.noUserFound')}</span></li>}
                  {userResults.map((u) => (
                    <li key={u.id}><button type="button" onClick={() => ajouterUser(u)}><b>{u.name}</b><span className="small">{u.email} · {roleLabel(tr, u.role)}{u.isTest ? ' · 🧪' : ''}</span></button></li>
                  ))}
                </ul>
              )}
            </div>
            {users.length > 0 && (
              <div className="msg-selected-users">
                {users.map((u) => (
                  <span key={u.id} className="chip">{u.name}<button type="button" onClick={() => setUsers((prev) => prev.filter((x) => x.id !== u.id))} aria-label={`${tr('adminCommon.delete')} ${u.name}`}>✕</button></span>
                ))}
              </div>
            )}
            {specific && <p className="msg-hint">{tr('adminMessages.specificWins')}</p>}
          </div>
          <div className={`msg-preview${nombre === 0 ? ' is-empty' : ''}`} aria-live="polite">
            {nombre === null && !previewErr && <span className="small">{tr('adminCommon.loading')}</span>}
            {previewErr && <span className="small">{tr('adminMessages.previewError')}</span>}
            {nombre !== null && <b>{nombre > 0 ? tr('adminMessages.recipientsCount', { n: nombre }) : tr('adminMessages.recipientsNone')}</b>}
            {!compteDirect && preview?.sample?.length > 0 && (
              <span className="small">
                {tr('adminMessages.recipientsSample', { names: preview.sample.map((s) => s.name).join(', ') })}
                {preview.count > preview.sample.length ? ` ${tr('adminMessages.andMore', { n: preview.count - preview.sample.length })}` : ''}
              </span>
            )}
            <span className="small">{tr('adminMessages.testExcluded')}</span>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={tr('adminMessages.confirmTitle', { n: nombre ?? 0 })}
        message={`${tr('adminMessages.confirmBody')}${notifyByEmail ? ` ${tr('adminMessages.confirmBodyEmail')}` : ''}`}
        confirmLabel={tr('adminMessages.send')}
        loading={envoi}
        onConfirm={envoyer}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------
export default function AdminMessagesPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [onglet, setOnglet] = useState(() => (searchParams.get('new') === '1' ? 'compose' : (TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'threads')));
  const [broadcastFilter, setBroadcastFilter] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unread, setUnread] = useState(null);

  // ?new=1 (accueil de l'ERP) consommé une seule fois.
  useEffect(() => { if (searchParams.get('new')) { const next = Object.fromEntries([...searchParams.entries()]); delete next.new; setSearchParams(next, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('/admin/messages/stats', { token }).then((s) => setUnread(s.unread)).catch(() => {}); }, [token, refreshKey]);

  function ouvrirAnnonce(b) { setBroadcastFilter({ id: b.id, subject: b.subject }); setOnglet('threads'); }

  return (
    <div>
      <AdminPageHeader module="messages" actions={<button type="button" className="btn-teal" onClick={() => setOnglet('compose')}>{tr('adminMessages.newMessage')}</button>} />
      <div className="role-pick msg-tabs" role="tablist">
        {TABS.map((k) => (
          <div key={k} role="tab" tabIndex={0} aria-selected={onglet === k} className={`chip${onglet === k ? ' active' : ''}`} onClick={() => setOnglet(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnglet(k); } }}>
            {tr(`adminMessages.tab_${k}`)}{k === 'threads' && unread > 0 ? <span className="pill">{unread}</span> : null}
          </div>
        ))}
      </div>
      {onglet === 'threads' && <ThreadsTab token={token} tr={tr} toast={toast} broadcastFilter={broadcastFilter} onClearBroadcast={() => setBroadcastFilter(null)} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {onglet === 'broadcasts' && <BroadcastsTab token={token} tr={tr} refreshKey={refreshKey} onOpenThreads={ouvrirAnnonce} />}
      {onglet === 'compose' && <ComposeTab token={token} tr={tr} toast={toast} onSent={() => { setRefreshKey((k) => k + 1); setOnglet('broadcasts'); }} />}
    </div>
  );
}
