import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

/* « QUESTIONS AU COMMERCE » DANS ADMIN › CARTE (fondateur, 2026-10-20 ; maquettes/questions-commerce.html).
 *
 * L'équipe pose ici les points à confirmer sur une carte (les `to_confirm` du fichier) sous forme de questions à une
 * touche, les envoie au commerce PAR E-MAIL (pas de SMS : ils coûtent), lit les réponses, et marque qu'elles sont reportées
 * dans la carte — c'est ce qui rouvre « C'est bon » sur le lien. « Copier pour l'agent » donne le texte que l'agent des
 * cartes lit aussi directement en base (scripts/questions-carte.js) : pas d'export à faire. */
const VIDE = { question: '', kind: 'choice', options: '', context: '' };

export default function QuestionsCommerce({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [donnees, setDonnees] = useState(null);
  const [form, setForm] = useState(VIDE);
  const [edite, setEdite] = useState(null); // id de la question en cours de modification
  const [busy, setBusy] = useState(false);
  const [lien, setLien] = useState('');

  const charger = useCallback(() => api(`/admin/restaurants/${restoId}/menu-questions`, { token }).then(setDonnees).catch((e) => toast(e.message, 'erreur')), [restoId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDonnees(null); setLien(''); charger(); }, [charger]);

  const qs = donnees?.questions || [];
  const ouvertes = qs.filter((q) => q.status === 'open').length;
  const enAttente = qs.filter((q) => q.status === 'answered').length;
  const derniere = Math.max(0, ...qs.map((q) => q.answeredAt || 0));

  async function agir(fn, succes) {
    setBusy(true);
    try { const r = await fn(); if (succes) toast(succes); await charger(); return r; } catch (e) { toast(e.message, 'erreur'); return null; } finally { setBusy(false); }
  }
  const corps = () => ({ question: form.question, kind: form.kind, context: form.context,
    options: form.kind === 'choice' ? form.options.split('\n').map((o) => o.trim()).filter(Boolean) : [] });
  async function enregistrer() {
    const ok = await agir(() => api(`/admin/restaurants/${restoId}/menu-questions${edite ? `/${edite}` : ''}`, { method: edite ? 'PATCH' : 'POST', token, body: corps() }), t('adminQuestions.saved'));
    if (ok) { setForm(VIDE); setEdite(null); }
  }
  function modifier(q) { setEdite(q.id); setForm({ question: q.question, kind: q.kind, options: q.options.join('\n'), context: q.context || '' }); }
  async function envoyer(parEmail) {
    const r = await agir(() => api(`/admin/restaurants/${restoId}/menu-questions/send`, { method: 'POST', token, body: parEmail ? { send: 'email' } : {} }),
      parEmail ? t('adminQuestions.emailed') : null);
    if (!r) return;
    if (parEmail && !r.emailed) toast(t('adminQuestions.noEmail'), 'erreur');
    if (!parEmail) {
      setLien(r.url);
      try { await navigator.clipboard.writeText(r.url); toast(t('adminQuestions.linkCopied')); } catch { /* le lien reste affiché */ }
    }
  }
  async function copierAgent() {
    try { await navigator.clipboard.writeText(donnees.agentText); toast(t('adminQuestions.agentCopied')); } catch { toast(t('adminQuestions.copyFailed'), 'erreur'); }
  }

  const reponse = (q) => {
    if (!q.answer) return <span className="small" style={{ opacity: 0.6 }}>—</span>;
    const { value, other } = q.answer;
    if (q.kind === 'yes_no') return <b>{value === 'oui' ? t('questionsCarte.yes') : <>{t('adminQuestions.no')}{other && <small style={{ display: 'block', fontWeight: 400 }}>« {other} »</small>}</>}</b>;
    if (value) return <b>{value}</b>;
    return <b>{q.kind === 'choice' ? t('adminQuestions.other') : ''}<small style={{ display: 'block', fontWeight: 400 }}>« {other} »</small></b>;
  };
  const pastille = (s) => <span className={`pill${s === 'answered' ? ' pill--ok' : ''}`} style={s === 'answered' ? { background: '#E8F7D0', color: '#2F6B00' } : undefined}>{t(`adminQuestions.status_${s}`)}</span>;

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--iris)' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icone nom="bulle" taille={16} />{t('adminQuestions.title')}
        {donnees && qs.length > 0 && <span className="pill">{t('adminQuestions.summary', { open: ouvertes, answered: enAttente })}</span>}
      </h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        {t('adminQuestions.intro')}{derniere ? ` ${t('adminQuestions.lastAnswer', { date: new Date(derniere).toLocaleString() })}` : ''}
      </p>

      {/* .admin-table met toutes ses cellules sur une ligne (styles.css) : une question longue élargissait le tableau au-delà
          de la carte et coupait « Modifier / Supprimer ». Question et réponse reviennent à la ligne, les boutons restent groupés. */}
      {qs.length > 0 && (
        <table className="admin-table" style={{ width: '100%', marginBottom: 10 }}>
          <thead><tr><th>{t('adminQuestions.question')}</th><th>{t('adminQuestions.answer')}</th><th>{t('adminQuestions.status')}</th><th /></tr></thead>
          <tbody>
            {qs.map((q) => (
              <tr key={q.id}>
                <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', width: '55%' }}>{q.question}{q.context && <small style={{ display: 'block', opacity: 0.7 }}>{q.context}</small>}
                  {q.kind === 'choice' && <small style={{ display: 'block', opacity: 0.7 }}>{q.options.join(' · ')}</small>}</td>
                <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{reponse(q)}</td>
                <td>{pastille(q.status)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {q.status === 'open' && <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => modifier(q)}>{t('adminQuestions.edit')}</button>}
                  <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => agir(() => api(`/admin/restaurants/${restoId}/menu-questions/${q.id}`, { method: 'DELETE', token }), t('adminQuestions.deleted'))}>{t('adminQuestions.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn-teal" disabled={busy || !ouvertes} onClick={() => envoyer(true)}>{t('adminQuestions.sendEmail')}</button>
        <button type="button" className="btn-outline" disabled={busy || !ouvertes} onClick={() => envoyer(false)}>{t('adminQuestions.copyLink')}</button>
        <button type="button" className="btn-outline" disabled={!qs.some((q) => q.answer)} onClick={copierAgent}>{t('adminQuestions.copyAgent')}</button>
        <button type="button" className="btn-outline" disabled={busy || !enAttente} onClick={() => agir(() => api(`/admin/restaurants/${restoId}/menu-questions/applied`, { method: 'POST', token, body: {} }), t('adminQuestions.appliedToast'))}>{t('adminQuestions.markApplied')}</button>
      </div>
      {lien && <p className="small" style={{ margin: '0 0 12px', overflowWrap: 'anywhere' }}>{t('adminQuestions.link')} : <a href={lien} target="_blank" rel="noreferrer">{lien}</a></p>}
      {donnees?.agentText && qs.some((q) => q.answer) && <pre style={{ background: '#1E1E24', color: '#E8E8F0', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{donnees.agentText}</pre>}

      <details open={!qs.length || !!edite}>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>{edite ? t('adminQuestions.editTitle') : t('adminQuestions.addTitle')}</summary>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="aq-question">{t('adminQuestions.question')}</label>
          <input id="aq-question" value={form.question} maxLength={300} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder={t('adminQuestions.questionPh')} />
        </div>
        <div className="field">
          <label htmlFor="aq-kind">{t('adminQuestions.kind')}</label>
          <select id="aq-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {['choice', 'yes_no', 'text'].map((k) => <option key={k} value={k}>{t(`adminQuestions.kind_${k}`)}</option>)}
          </select>
        </div>
        {form.kind === 'choice' && (
          <div className="field">
            <label htmlFor="aq-options">{t('adminQuestions.options')}</label>
            <textarea id="aq-options" rows={3} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder={t('adminQuestions.optionsPh')} />
          </div>
        )}
        <div className="field">
          <label htmlFor="aq-context">{t('adminQuestions.context')}</label>
          <input id="aq-context" value={form.context} maxLength={300} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder={t('adminQuestions.contextPh')} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-gold" disabled={busy || form.question.trim().length < 3} onClick={enregistrer}>{edite ? t('adminQuestions.save') : t('adminQuestions.add')}</button>
          {edite && <button type="button" className="btn-ghost" onClick={() => { setEdite(null); setForm(VIDE); }}>{t('adminQuestions.cancel')}</button>}
        </div>
      </details>
    </div>
  );
}
