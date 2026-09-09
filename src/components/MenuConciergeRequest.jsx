import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Fairide s'en occupe » : le restaurateur indique sur quelle plateforme (ou site) sa carte existe déjà,
// l'équipe Fairide la reprend et l'intègre pour lui. Une seule demande ouverte à la fois ; l'état
// (en attente → en cours → terminée) s'affiche ici et suit la tâche côté admin (module Tâches).
export const PLATEFORMES = ['uber_eats', 'deliveroo', 'takeaway', 'website', 'other'];
const LIBELLES = { uber_eats: 'Uber Eats', deliveroo: 'Deliveroo', takeaway: 'Takeaway.com', website: null, other: null };

export default function MenuConciergeRequest({ restoId, urlSuggeree = '' }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [demande, setDemande] = useState(undefined); // undefined = chargement, null = aucune
  const [platform, setPlatform] = useState(urlSuggeree ? 'website' : 'uber_eats');
  const [url, setUrl] = useState(urlSuggeree);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteEdit, setNoteEdit] = useState('');

  useEffect(() => { api(`/restaurants/${restoId}/menu/concierge`, { token }).then((r) => setDemande(r.request || null)).catch(() => setDemande(null)); }, [restoId, token]);

  const libelle = (p) => LIBELLES[p] || t(`menuConcierge.platform_${p}`);

  async function envoyer() {
    if (platform !== 'other' && platform !== 'website' && !url.trim() && !notes.trim()) { /* le nom de la plateforme suffit : on retrouve la page */ }
    setBusy(true);
    try {
      const r = await api(`/restaurants/${restoId}/menu/concierge`, { method: 'POST', token, body: { platform, url: url.trim(), notes: notes.trim() } });
      setDemande(r.request); toast(t('menuConcierge.sent'));
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function enregistrerNote() {
    setBusy(true);
    try {
      const r = await api(`/restaurants/${restoId}/menu/concierge/${demande.id}`, { method: 'PATCH', token, body: { notes: noteEdit.trim() } });
      setDemande(r.request); setEditNote(false); toast(t('menuConcierge.noteSaved'));
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function annuler() {
    setBusy(true);
    try { await api(`/restaurants/${restoId}/menu/concierge/${demande.id}`, { method: 'DELETE', token }); setDemande(null); toast(t('menuConcierge.cancelled')); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  if (demande === undefined) return <p className="small">{t('menuConcierge.loading')}</p>;

  if (demande && demande.status !== 'refusee') {
    const etat = { en_attente: ['⏳', t('menuConcierge.stPending'), 'pill'], en_cours: ['🛠️', t('menuConcierge.stInProgress'), 'pill teal'], terminee: ['✅', t('menuConcierge.stDone'), 'pill teal'] }[demande.status] || ['⏳', demande.status, 'pill'];
    return (
      <div className="menu-concierge-etat">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={etat[2]}>{etat[0]} {etat[1]}</span>
          <span className="small">{t('menuConcierge.requestedOn', { date: new Date(demande.createdAt).toLocaleDateString(getLocale()), platform: libelle(demande.platform) })}</span>
        </div>
        {demande.url && <p className="small" style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>🔗 {demande.url}</p>}
        {demande.notes && !editNote && <p className="small" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>📝 <b>{t('menuConcierge.yourNotes')}</b> : {demande.notes}</p>}
        {demande.adminNote && <p className="small" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>💬 <b>{t('menuConcierge.fairideNote')}</b> : {demande.adminNote}</p>}
        {editNote && (
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="concierge-notes-edit">{t('menuConcierge.notesLabel')}</label>
            <textarea id="concierge-notes-edit" rows={3} value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} placeholder={t('menuConcierge.notesPlaceholder')} style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <button type="button" className="btn-teal" disabled={busy} onClick={enregistrerNote}>{busy ? '…' : t('menuConcierge.saveNote')}</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setEditNote(false)}>{t('menuConcierge.cancelEdit')}</button>
            </div>
          </div>
        )}
        <p className="small" style={{ margin: '8px 0 0' }}>
          {demande.status === 'terminee' ? t('menuConcierge.doneHelp') : t('menuConcierge.pendingHelp')}
        </p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {(demande.status === 'en_attente' || demande.status === 'en_cours') && !editNote && <button type="button" className="btn-outline" disabled={busy} onClick={() => { setNoteEdit(demande.notes || ''); setEditNote(true); }}>✏️ {t('menuConcierge.addNote')}</button>}
          {demande.status === 'en_attente' && <button type="button" className="btn-ghost" disabled={busy} onClick={annuler}>{t('menuConcierge.cancel')}</button>}
          {demande.status === 'terminee' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => setDemande(null)}>{t('menuConcierge.newRequest')}</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('menuConcierge.intro')}</p>
      <div className="field">
        <label htmlFor="concierge-platform">{t('menuConcierge.platformLabel')}</label>
        <select id="concierge-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATEFORMES.map((p) => <option key={p} value={p}>{libelle(p)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="concierge-url">{t('menuConcierge.urlLabel')} <span className="small">· {t('menuConcierge.optional')}</span></label>
        <input id="concierge-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={platform === 'website' ? 'https://www.mon-restaurant.be/carte' : 'https://…'} />
        <p className="small" style={{ margin: '4px 0 0' }}>{t('menuConcierge.urlHelp')}</p>
      </div>
      <div className="field">
        <label htmlFor="concierge-notes">{t('menuConcierge.notesLabel')} <span className="small">· {t('menuConcierge.optional')}</span></label>
        <textarea id="concierge-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('menuConcierge.notesPlaceholder')} style={{ width: '100%' }} />
      </div>
      <button type="button" className="btn-gold" disabled={busy} onClick={envoyer}>{busy ? '…' : t('menuConcierge.send')}</button>
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('menuConcierge.delay')}</p>
    </div>
  );
}
