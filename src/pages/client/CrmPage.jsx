import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import RetourCompte from '../../components/RetourCompte';

import '../../crm.css';

// CRM des commerciaux (« sales ») : la personne qui a saisi un code commercial dans Mon compte enregistre ici les
// commerces qu'elle démarche, et où ils en sont — étape, visites, appels, notes datées, avis du restaurateur,
// prochaine action. Un compte client sans code n'a pas accès à cette page (le serveur répond 403 NOT_SALES_AGENT,
// et Mon compte n'affiche pas le lien). Serveur : routes/adminSales.js (/sales/…).

const STAGES = ['a_contacter', 'contacte', 'interesse', 'rdv', 'inscrit', 'carte_en_ligne', 'actif', 'plus_tard', 'refuse'];
const KINDS = ['visite', 'appel', 'message', 'note'];
const STAGE_ICONES = { a_contacter: '📋', contacte: '📞', interesse: '💡', rdv: '📅', inscrit: '✍️', carte_en_ligne: '🍽️', actif: '✅', plus_tard: '⏳', refuse: '✖️' };
const KIND_ICONES = { visite: '🚶', appel: '📞', message: '💬', note: '📝', etape: '🔀' };

const vide = { name: '', address: '', commune: '', phone: '', contactName: '', email: '', cuisine: '', stage: 'a_contacter', notes: '', firstNote: '' };
// <input type="datetime-local"> attend l'heure locale sans fuseau.
const versLocal = (ms) => { if (!ms) return ''; const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const maintenantLocal = () => versLocal(Date.now());

export default function CrmPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const locale = getLocale();
  const [etat, setEtat] = useState(null); // { agent, stats } ; agent: false = pas de code
  const [prospects, setProspects] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(null); // id du prospect ouvert
  const [creation, setCreation] = useState(false);

  const charger = useCallback(() => {
    api('/sales/me', { token }).then(setEtat).catch((e) => toast(e.message));
    const params = new URLSearchParams(); if (filtre) params.set('stage', filtre); if (recherche.trim()) params.set('q', recherche.trim());
    api(`/sales/prospects?${params.toString()}`, { token }).then((r) => setProspects(r.prospects)).catch((e) => { if (e.code === 'NOT_SALES_AGENT') setEtat({ agent: false }); else toast(e.message); });
  }, [token, filtre, recherche, toast]);
  useEffect(() => { charger(); }, [charger]);

  const fmtDate = (ms) => new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const stageLabel = (s) => `${STAGE_ICONES[s] || ''} ${t(`sales.stage_${s}`)}`;

  if (etat && !etat.agent) {
    return (
      <div>
        <RetourCompte />
        <h1 className="section-title" style={{ marginTop: 0 }}>{t('sales.title')}</h1>
        <div className="card"><p className="small" style={{ margin: 0 }}>{t('sales.notAgent')} <Link to="/account?ouvrir=commercial">{t('sales.enterCode')}</Link></p></div>
      </div>
    );
  }

  return (
    <div className="crm-page">
      <RetourCompte />
      <div className="crm-entete">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>{t('sales.title')}</h1>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.intro')}</p>
        </div>
        <button type="button" className="btn-gold" onClick={() => setCreation(true)}>+ {t('sales.addProspect')}</button>
      </div>

      {etat?.stats && (
        <div className="stat-grid crm-stats">
          <div className="stat-card"><div className="num">{etat.stats.total}</div><div className="label">{t('sales.statTotal')}</div></div>
          <div className="stat-card"><div className="num">{(etat.stats.byStage.inscrit || 0) + (etat.stats.byStage.carte_en_ligne || 0) + (etat.stats.byStage.actif || 0)}</div><div className="label">{t('sales.statSigned')}</div></div>
          <div className="stat-card highlight"><div className="num">{etat.stats.byStage.actif || 0}</div><div className="label">{t('sales.statActive')}</div></div>
          <div className={`stat-card${etat.stats.overdue > 0 ? ' crm-retard' : ''}`}><div className="num">{etat.stats.overdue}</div><div className="label">{t('sales.statOverdue')}</div></div>
        </div>
      )}

      <div className="admin-control-panel">
        <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('sales.searchPlaceholder')} aria-label={t('sales.searchPlaceholder')} />
        </div>
        <div className="role-pick crm-filtres" role="group" aria-label={t('sales.filterStage')}>
          <button type="button" className={`chip${filtre === '' ? ' active' : ''}`} onClick={() => setFiltre('')}>{t('sales.allStages')}</button>
          {STAGES.map((s) => <button key={s} type="button" className={`chip${filtre === s ? ' active' : ''}`} onClick={() => setFiltre(s)}>{stageLabel(s)}{etat?.stats?.byStage?.[s] ? ` · ${etat.stats.byStage[s]}` : ''}</button>)}
        </div>
      </div>

      {prospects === null && <div className="small">{t('common.loading')}</div>}
      {prospects && prospects.length === 0 && (
        <div className="card"><p className="small" style={{ margin: 0 }}>{filtre || recherche ? t('sales.noneFiltered') : t('sales.noneYet')}</p></div>
      )}
      <div className="crm-liste">
        {(prospects || []).map((p) => (
          <button type="button" key={p.id} className={`card crm-carte crm-etape-${p.stage}`} onClick={() => setOuvert(p.id)}>
            <div className="crm-carte-tete">
              <b>{p.name}</b>
              <span className={`crm-badge crm-badge-${p.stage}`}>{stageLabel(p.stage)}</span>
            </div>
            <div className="small crm-carte-ligne">
              {p.commune && <span>📍 {p.commune}</span>}
              {p.contactName && <span>👤 {p.contactName}</span>}
              {p.rating && <span>{'★'.repeat(p.rating)}{'☆'.repeat(5 - p.rating)}</span>}
            </div>
            <div className="small crm-carte-ligne">
              {p.lastEventAt && <span>{t('sales.lastActivity', { date: fmtDate(p.lastEventAt) })}</span>}
              {p.nextActionAt && <span className={p.nextActionAt < Date.now() && !['actif', 'refuse'].includes(p.stage) ? 'crm-retard-texte' : ''}>⏰ {t('sales.nextAction', { date: fmtDate(p.nextActionAt) })}</span>}
              {p.restaurantName && <span>🏪 {t('sales.linkedTo', { name: p.restaurantName })}</span>}
            </div>
          </button>
        ))}
      </div>

      {creation && <ProspectForm token={token} t={t} toast={toast} onClose={() => setCreation(false)} onSaved={(p) => { setCreation(false); charger(); setOuvert(p.id); }} />}
      {ouvert && <ProspectDetail id={ouvert} token={token} t={t} toast={toast} locale={locale} stageLabel={stageLabel} onClose={() => { setOuvert(null); charger(); }} onDeleted={() => { setOuvert(null); charger(); }} />}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- création
function ProspectForm({ token, t, toast, onClose, onSaved }) {
  const [f, setF] = useState(vide);
  const [envoi, setEnvoi] = useState(false);
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function enregistrer(e) {
    e.preventDefault();
    if (!f.name.trim()) { toast(t('sales.errName')); return; }
    setEnvoi(true);
    try { onSaved(await api('/sales/prospects', { method: 'POST', token, body: f })); toast(t('sales.toastCreated')); } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }
  return (
    <div className="modal-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label={t('sales.addProspect')} onClick={onClose}>
      <form className="modal-box drawer-box crm-form" onClick={(e) => e.stopPropagation()} onSubmit={enregistrer}>
        <h3 className="modal-titre">{t('sales.addProspect')}</h3>
        <div className="field"><label htmlFor="crm-nom">{t('sales.fName')} *</label><input id="crm-nom" value={f.name} onChange={champ('name')} autoFocus /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 2 }}><label htmlFor="crm-adresse">{t('sales.fAddress')}</label><input id="crm-adresse" value={f.address} onChange={champ('address')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-commune">{t('sales.fCommune')}</label><input id="crm-commune" value={f.commune} onChange={champ('commune')} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-contact">{t('sales.fContact')}</label><input id="crm-contact" value={f.contactName} onChange={champ('contactName')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-tel">{t('sales.fPhone')}</label><input id="crm-tel" type="tel" value={f.phone} onChange={champ('phone')} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-email">{t('sales.fEmail')}</label><input id="crm-email" type="email" value={f.email} onChange={champ('email')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-cuisine">{t('sales.fCuisine')}</label><input id="crm-cuisine" value={f.cuisine} onChange={champ('cuisine')} /></div>
        </div>
        <div className="field"><label htmlFor="crm-etape">{t('sales.fStage')}</label>
          <select id="crm-etape" value={f.stage} onChange={champ('stage')}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_ICONES[s]} {t(`sales.stage_${s}`)}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="crm-note1">{t('sales.fFirstNote')}</label><textarea id="crm-note1" rows={3} value={f.firstNote} onChange={champ('firstNote')} placeholder={t('sales.fFirstNotePh')} /></div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- fiche
function ProspectDetail({ id, token, t, toast, locale, stageLabel, onClose, onDeleted }) {
  const [p, setP] = useState(null);
  const [edition, setEdition] = useState(null);
  const [ev, setEv] = useState({ kind: 'visite', at: maintenantLocal(), stage: '', note: '' });
  const [envoi, setEnvoi] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [lien, setLien] = useState({ q: '', resultats: [] });
  const charger = useCallback(() => api(`/sales/prospects/${id}`, { token }).then(setP).catch((e) => toast(e.message)), [id, token, toast]);
  useEffect(() => { charger(); }, [charger]);
  const fmt = (ms) => new Date(ms).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function patch(body, message) {
    setEnvoi(true);
    try { const r = await api(`/sales/prospects/${id}`, { method: 'PATCH', token, body }); setP((s) => ({ ...s, ...r })); if (message) toast(message); await charger(); } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }
  async function ajouterEvenement(e) {
    e.preventDefault();
    if (!ev.note.trim() && ev.kind === 'note') { toast(t('sales.errNote')); return; }
    setEnvoi(true);
    try {
      await api(`/sales/prospects/${id}/events`, { method: 'POST', token, body: { kind: ev.kind, at: new Date(ev.at).toISOString(), stage: ev.stage || null, note: ev.note } });
      setEv({ kind: 'visite', at: maintenantLocal(), stage: '', note: '' }); toast(t('sales.toastEvent')); await charger();
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }
  async function supprimerEvenement(eid) {
    try { await api(`/sales/prospects/${id}/events/${eid}`, { method: 'DELETE', token }); await charger(); } catch (e) { toast(e.message); }
  }
  async function chercherResto(q) {
    setLien((s) => ({ ...s, q }));
    if (q.trim().length < 2) { setLien((s) => ({ ...s, resultats: [] })); return; }
    try { setLien((s) => ({ ...s, resultats: [] })); const r = await api(`/sales/restaurant-lookup?q=${encodeURIComponent(q.trim())}`, { token }); setLien((s) => (s.q === q ? { ...s, resultats: r } : s)); } catch { /* recherche silencieuse */ }
  }

  const evenements = useMemo(() => p?.events || [], [p]);
  return (
    <div className="modal-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label={p?.name || ''} onClick={onClose}>
      <div className="modal-box drawer-box crm-fiche" onClick={(e) => e.stopPropagation()}>
        {!p ? <div className="small">{t('common.loading')}</div> : (
          <>
            <div className="crm-fiche-tete">
              <div>
                <h3 className="modal-titre" style={{ margin: 0 }}>{p.name}</h3>
                <p className="small" style={{ margin: '2px 0 0' }}>{[p.address, p.commune].filter(Boolean).join(', ')}{p.cuisine ? ` · ${p.cuisine}` : ''}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={onClose} aria-label={t('common.close')}>✕</button>
            </div>

            {/* Étape : un chip par étape, un appui la change (le serveur trace l'événement). */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.fStage')}</b>
              <div className="role-pick crm-etapes">
                {STAGES.map((s) => <button key={s} type="button" disabled={envoi} className={`chip${p.stage === s ? ' active' : ''}`} onClick={() => p.stage !== s && patch({ stage: s }, t('sales.toastStage'))}>{stageLabel(s)}</button>)}
              </div>
            </div>

            <div className="crm-bloc crm-deux-colonnes">
              <div>
                <b className="crm-bloc-titre">{t('sales.contactTitle')}</b>
                <p className="small" style={{ margin: 0 }}>
                  {p.contactName && <>👤 {p.contactName}<br /></>}
                  {p.phone && <>📞 <a href={`tel:${p.phone}`}>{p.phone}</a><br /></>}
                  {p.email && <>✉️ <a href={`mailto:${p.email}`}>{p.email}</a></>}
                  {!p.contactName && !p.phone && !p.email && <i>{t('sales.noContact')}</i>}
                </p>
                <button type="button" className="btn-ghost" style={{ padding: '4px 0', fontSize: 13 }} onClick={() => setEdition({ name: p.name, address: p.address, commune: p.commune, phone: p.phone, contactName: p.contactName, email: p.email, cuisine: p.cuisine, notes: p.notes })}>✏️ {t('sales.editInfo')}</button>
              </div>
              <div>
                <b className="crm-bloc-titre">{t('sales.nextActionTitle')}</b>
                <input type="datetime-local" value={versLocal(p.nextActionAt)} disabled={envoi} onChange={(e) => patch({ nextActionAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                {p.nextActionAt && <button type="button" className="btn-ghost" style={{ padding: '4px 0', fontSize: 13 }} onClick={() => patch({ nextActionAt: null })}>{t('sales.clearNextAction')}</button>}
              </div>
            </div>

            {/* Avis du restaurateur : ce qu'il pense de Fairide, en étoiles et en une phrase. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.feedbackTitle')}</b>
              <div className="crm-etoiles" role="radiogroup" aria-label={t('sales.feedbackTitle')}>
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={p.rating === n} className={`crm-etoile${p.rating >= n ? ' pleine' : ''}`} disabled={envoi} onClick={() => patch({ rating: p.rating === n ? null : n })}>★</button>)}
                <span className="small">{p.rating ? t(`sales.rating_${p.rating}`) : t('sales.ratingNone')}</span>
              </div>
              <textarea rows={2} defaultValue={p.feedback} key={`fb-${p.updatedAt}`} placeholder={t('sales.feedbackPh')} onBlur={(e) => e.target.value !== p.feedback && patch({ feedback: e.target.value })} />
            </div>

            {/* Lier au commerce inscrit sur Fairide, pour voir s'il est validé et en ligne. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.linkTitle')}</b>
              {p.restaurantId ? (
                <p className="small" style={{ margin: 0 }}>🏪 {p.restaurantName} · {t(`sales.restoStatus_${p.restaurantStatus || 'pending'}`)} <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => patch({ restaurantId: null })}>{t('sales.unlink')}</button></p>
              ) : (
                <div>
                  <input type="search" value={lien.q} onChange={(e) => chercherResto(e.target.value)} placeholder={t('sales.linkPlaceholder')} />
                  {lien.resultats.length > 0 && (
                    <div className="crm-resultats">
                      {lien.resultats.map((r) => <button key={r.id} type="button" className="btn-ghost" onClick={() => { patch({ restaurantId: r.id }, t('sales.toastLinked')); setLien({ q: '', resultats: [] }); }}>🏪 {r.name} · {r.commune} · {t(`sales.restoStatus_${r.adminStatus}`)}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Historique : chaque visite, appel, message ou note, daté à la minute ; un changement d'étape aussi. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.historyTitle')}</b>
              <form className="crm-ajout" onSubmit={ajouterEvenement}>
                <div className="role-pick" role="group" aria-label={t('sales.eventKind')}>
                  {KINDS.map((k) => <button key={k} type="button" className={`chip${ev.kind === k ? ' active' : ''}`} onClick={() => setEv((s) => ({ ...s, kind: k }))}>{KIND_ICONES[k]} {t(`sales.kind_${k}`)}</button>)}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input type="datetime-local" value={ev.at} onChange={(e) => setEv((s) => ({ ...s, at: e.target.value }))} required style={{ flex: 1 }} />
                  <select value={ev.stage} onChange={(e) => setEv((s) => ({ ...s, stage: e.target.value }))} style={{ flex: 1 }} aria-label={t('sales.eventStage')}>
                    <option value="">{t('sales.eventStageKeep')}</option>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_ICONES[s]} {t(`sales.stage_${s}`)}</option>)}
                  </select>
                </div>
                <textarea rows={2} value={ev.note} onChange={(e) => setEv((s) => ({ ...s, note: e.target.value }))} placeholder={t('sales.eventNotePh')} />
                <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('sales.addEvent')}</button>
              </form>
              {evenements.length === 0 ? <p className="small" style={{ margin: '8px 0 0' }}>{t('sales.noEvents')}</p> : (
                <ol className="crm-historique">
                  {evenements.map((e) => (
                    <li key={e.id}>
                      <span className="crm-hist-ico" aria-hidden="true">{KIND_ICONES[e.kind]}</span>
                      <div>
                        <div className="small"><b>{t(`sales.kind_${e.kind}`)}</b>{e.stage ? ` → ${stageLabel(e.stage)}` : ''} · {fmt(e.at)}</div>
                        {e.note && <div className="crm-hist-note">{e.note}</div>}
                      </div>
                      <button type="button" className="btn-ghost crm-hist-suppr" aria-label={t('sales.deleteEvent')} onClick={() => setConfirm({ title: t('sales.confirmDeleteEvent'), run: () => supprimerEvenement(e.id) })}>✕</button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.notesTitle')}</b>
              <textarea rows={3} defaultValue={p.notes} key={`notes-${p.updatedAt}`} placeholder={t('sales.notesPh')} onBlur={(e) => e.target.value !== p.notes && patch({ notes: e.target.value })} />
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="small">{t('sales.createdOn', { date: fmt(p.createdAt) })}</span>
              <button type="button" className="btn-danger-ghost" onClick={() => setConfirm({ title: t('sales.confirmDelete', { name: p.name }), danger: true, run: async () => { try { await api(`/sales/prospects/${id}`, { method: 'DELETE', token }); toast(t('sales.toastDeleted')); onDeleted(); } catch (e) { toast(e.message); } } })}>{t('sales.deleteProspect')}</button>
            </div>
          </>
        )}
        {edition && (
          <form className="crm-edition" onSubmit={async (e) => { e.preventDefault(); await patch(edition, t('sales.toastSaved')); setEdition(null); }}>
            <h4 style={{ margin: '0 0 8px' }}>{t('sales.editInfo')}</h4>
            {[['name', 'fName'], ['address', 'fAddress'], ['commune', 'fCommune'], ['contactName', 'fContact'], ['phone', 'fPhone'], ['email', 'fEmail'], ['cuisine', 'fCuisine']].map(([k, cle]) => (
              <div className="field" key={k}><label htmlFor={`crm-ed-${k}`}>{t(`sales.${cle}`)}</label><input id={`crm-ed-${k}`} value={edition[k] || ''} onChange={(e) => setEdition((s) => ({ ...s, [k]: e.target.value }))} /></div>
            ))}
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setEdition(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-teal" disabled={envoi}>{t('common.save')}</button>
            </div>
          </form>
        )}
        <ConfirmDialog open={!!confirm} title={confirm?.title} danger={confirm?.danger} onCancel={() => setConfirm(null)} onConfirm={async () => { const c = confirm; setConfirm(null); await c.run(); }} />
      </div>
    </div>
  );
}

export { STAGES as SALES_STAGES, STAGE_ICONES as SALES_STAGE_ICONES };
