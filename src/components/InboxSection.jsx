import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import useInbox, { poserNonLus } from '../hooks/useInbox';

// Rubrique « Messages » de Mon compte (tous rôles) : la liste des conversations avec Fairide, une
// conversation ouverte (bulles, réponse, réactions) et le formulaire « Nouveau message à Fairide ».
// Les routes /inbox… ne renvoient que les conversations du compte connecté (voir routes/adminMessages.js).
const REACTIONS = ['👍', '❤️', '✅', '🙏', '😕'];
const MAX_BODY = 2000;

function fmtDate(ts, locale) {
  if (!ts) return '';
  const d = new Date(ts);
  const aujourdHui = new Date().toDateString() === d.toDateString();
  return aujourdHui
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function InboxSection() {
  const { token } = useAuth();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { refresh } = useInbox();
  const [threads, setThreads] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState('list'); // 'list' | 'thread' | 'new'
  const [courant, setCourant] = useState(null); // { thread, messages }
  const [chargementFil, setChargementFil] = useState(false);
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const finListe = useRef(null);

  const charger = useCallback(() => {
    setErreur(null);
    api('/inbox', { token })
      .then((r) => { setThreads(r.threads || []); poserNonLus(r.unread || 0); })
      .catch((e) => setErreur(e.message));
  }, [token]);
  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (vue === 'thread' && courant) finListe.current?.scrollIntoView({ block: 'nearest' });
  }, [vue, courant]);

  async function ouvrir(id) {
    setVue('thread'); setCourant(null); setChargementFil(true); setReponse('');
    try {
      const r = await api(`/inbox/threads/${id}`, { token });
      setCourant(r);
      // Lu : le compteur local baisse tout de suite, la nav suit, le serveur confirme.
      setThreads((prev) => {
        const suivant = (prev || []).map((x) => (x.id === id ? { ...x, unread: 0 } : x));
        poserNonLus(suivant.reduce((s, x) => s + (x.unread || 0), 0));
        return suivant;
      });
      refresh();
    } catch (e) {
      toast(e.message); setVue('list');
    } finally {
      setChargementFil(false);
    }
  }

  function retourListe() { setVue('list'); setCourant(null); charger(); }

  async function envoyer(payload) {
    if (!courant) return;
    setEnvoi(true);
    try {
      const r = await api(`/inbox/threads/${courant.thread.id}/messages`, { method: 'POST', token, body: payload });
      setCourant((c) => ({ ...c, thread: { ...c.thread, status: 'open', lastFrom: 'user' }, messages: [...c.messages, r.message] }));
      if (payload.body) setReponse('');
      toast(t(payload.reaction ? 'inbox.reacted' : 'inbox.sent'));
    } catch (e) {
      toast(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function creer(e) {
    e.preventDefault();
    if (!sujet.trim() || !corps.trim()) { toast(t('inbox.subjectBodyRequired')); return; }
    setEnvoi(true);
    try {
      const r = await api('/inbox', { method: 'POST', token, body: { subject: sujet.trim(), body: corps.trim() } });
      setSujet(''); setCorps('');
      toast(t('inbox.sent'));
      setThreads((prev) => [r.thread, ...(prev || [])]);
      setCourant({ thread: r.thread, messages: [r.message] });
      setVue('thread');
    } catch (err) {
      toast(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  function surTouche(e, action) {
    // Ctrl/Cmd + Entrée envoie ; Entrée seul garde le retour à la ligne.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); action(); }
  }

  if (vue === 'new') {
    return (
      <form className="inbox-new" onSubmit={creer}>
        <button type="button" className="inbox-back" onClick={() => setVue('list')}>← {t('inbox.back')}</button>
        <h4>{t('inbox.newToFairide')}</h4>
        <div className="field">
          <label htmlFor="inbox-sujet">{t('inbox.subject')}</label>
          <input id="inbox-sujet" value={sujet} maxLength={140} placeholder={t('inbox.phSubject')} onChange={(e) => setSujet(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="inbox-corps">{t('inbox.message')}</label>
          <textarea id="inbox-corps" value={corps} rows={5} maxLength={MAX_BODY} placeholder={t('inbox.phBody')} onChange={(e) => setCorps(e.target.value)} onKeyDown={(e) => surTouche(e, () => e.target.form?.requestSubmit())} required />
          <span className="small inbox-counter">{corps.length}/{MAX_BODY}</span>
        </div>
        <div className="inbox-actions">
          <button type="button" className="btn-ghost" onClick={() => setVue('list')} disabled={envoi}>{t('common.cancel')}</button>
          <button type="submit" className="btn-teal" disabled={envoi || !sujet.trim() || !corps.trim()}>{envoi ? t('inbox.sending') : t('inbox.send')}</button>
        </div>
      </form>
    );
  }

  if (vue === 'thread') {
    const fil = courant?.thread;
    const ferme = fil?.status === 'closed';
    return (
      <div className="inbox-thread">
        <button type="button" className="inbox-back" onClick={retourListe}>← {t('inbox.back')}</button>
        {chargementFil && <div className="skeleton skeleton-card" />}
        {fil && (
          <>
            <h4 className="inbox-thread-subject">{fil.subject}</h4>
            {ferme && <p className="small inbox-closed">{t('inbox.closedHint')}</p>}
            <ol className="inbox-bubbles" aria-live="polite">
              {courant.messages.map((m) => (
                <li key={m.id} className={`inbox-bubble ${m.fromRole === 'admin' ? 'from-admin' : 'from-me'}${m.reaction ? ' is-reaction' : ''}`}>
                  <span className="inbox-bubble-author">{m.fromRole === 'admin' ? t('inbox.fairide') : t('inbox.me')}</span>
                  <span className="inbox-bubble-body">{m.reaction || m.body}</span>
                  <time className="inbox-bubble-date" dateTime={new Date(m.createdAt).toISOString()}>{fmtDate(m.createdAt, locale)}</time>
                </li>
              ))}
              <li ref={finListe} aria-hidden="true" />
            </ol>
            <div className="inbox-reactions" role="group" aria-label={t('inbox.react')}>
              {REACTIONS.map((r) => (
                <button key={r} type="button" className="inbox-reaction" disabled={envoi} onClick={() => envoyer({ reaction: r })} aria-label={`${t('inbox.react')} ${r}`}>{r}</button>
              ))}
            </div>
            <div className="inbox-reply">
              <label htmlFor="inbox-reponse" className="inbox-sr">{t('inbox.reply')}</label>
              <textarea id="inbox-reponse" value={reponse} rows={3} maxLength={MAX_BODY} placeholder={t('inbox.phReply')} onChange={(e) => setReponse(e.target.value)} onKeyDown={(e) => surTouche(e, () => reponse.trim() && envoyer({ body: reponse.trim() }))} />
              <div className="inbox-actions">
                <span className="small inbox-counter">{reponse.length}/{MAX_BODY}</span>
                <button type="button" className="btn-teal" disabled={envoi || !reponse.trim()} onClick={() => envoyer({ body: reponse.trim() })}>{envoi ? t('inbox.sending') : t('inbox.send')}</button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="inbox-list-wrap">
      <div className="inbox-list-head">
        <p className="small" style={{ margin: 0 }}>{t('inbox.intro')}</p>
        <button type="button" className="btn-outline" onClick={() => setVue('new')}>✉️ {t('inbox.newToFairide')}</button>
      </div>
      {erreur && (
        <div className="inbox-error" role="alert">
          <span>{t('inbox.loadError')}</span>
          <button type="button" className="btn-ghost" onClick={charger}>{t('inbox.retry')}</button>
        </div>
      )}
      {!erreur && threads === null && <div className="skeleton skeleton-card" />}
      {threads && threads.length === 0 && (
        <div className="inbox-empty">
          <span aria-hidden="true">💬</span>
          <b>{t('inbox.empty')}</b>
          <span className="small">{t('inbox.emptyHint')}</span>
        </div>
      )}
      {threads && threads.length > 0 && (
        <ul className="inbox-list">
          {threads.map((th) => (
            <li key={th.id}>
              <button type="button" className={`inbox-item${th.unread > 0 ? ' is-unread' : ''}`} onClick={() => ouvrir(th.id)}>
                <span className="inbox-item-dot" aria-label={th.unread > 0 ? t('inbox.unread') : undefined} />
                <span className="inbox-item-text">
                  <b>{th.subject}</b>
                  <span className="small">{th.lastFrom === 'user' ? `${t('inbox.me')} : ` : ''}{th.preview}</span>
                </span>
                <time className="small inbox-item-date" dateTime={new Date(th.lastMessageAt).toISOString()}>{fmtDate(th.lastMessageAt, locale)}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
