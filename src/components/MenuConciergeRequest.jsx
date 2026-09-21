import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Fairide crée ma carte » — LA seule façon de créer sa carte côté restaurateur (fondateur, 2026-09-21) : il dit sur
// quoi se baser (son site, Uber Eats, Deliveroo, Takeaway, autre), peut nous envoyer une photo ou un PDF de sa carte,
// et l'équipe Fairide fait le reste. PHOTOS (fondateur, 21/09) : avec une source (site, Uber Eats, Deliveroo, Takeaway),
// Fairide reprend EXACTEMENT la carte de cette page, photos comprises — rien à choisir ; la question « veux-tu des
// photos ? » ne se pose que sans carte en ligne (source « autre » : photo ou PDF de la carte papier, sans photos). Il vérifie la carte avant publication
// (rien n'est visible des clients sans sa confirmation, voir MenuReadiness) et la modifie ensuite lui-même.
// Une seule demande ouverte à la fois ; l'état (reçue → en cours → terminée) suit la tâche côté admin (module Tâches).
const PLATEFORMES = ['website', 'uber_eats', 'deliveroo', 'takeaway', 'other'];
const LIBELLES = { uber_eats: 'Uber Eats', deliveroo: 'Deliveroo', takeaway: 'Takeaway.com', website: null, other: null };
const ICONES = { website: '🌐', uber_eats: '🟢', deliveroo: '🩵', takeaway: '🟠', other: '📄' };
const MAX_FICHIERS = 10;
const ACCEPT = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic';

export default function MenuConciergeRequest({ restoId, urlSuggeree = '' }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [demande, setDemande] = useState(undefined); // undefined = chargement, null = aucune
  const [platform, setPlatform] = useState(urlSuggeree ? 'website' : 'uber_eats');
  const [url, setUrl] = useState(urlSuggeree);
  const [fichiers, setFichiers] = useState([]);
  const [wantsPhotos, setWantsPhotos] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteEdit, setNoteEdit] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { api(`/restaurants/${restoId}/menu/concierge`, { token }).then((r) => setDemande(r.request || null)).catch(() => setDemande(null)); }, [restoId, token]);

  const libelle = (p) => LIBELLES[p] || t(`menuConcierge.source_${p}`);
  // Une source en ligne → ses photos sont reprises telles quelles ; « autre » → on demande s'il en veut.
  const sourceEnLigne = platform !== 'other';
  const placeholderUrl = { website: 'https://www.mon-restaurant.be/carte', uber_eats: 'https://www.ubereats.com/be/store/…', deliveroo: 'https://deliveroo.be/fr/menu/…', takeaway: 'https://www.takeaway.com/be/…', other: 'https://…' }[platform];

  function ajouterFichiers(liste) {
    const nouveaux = Array.from(liste || []);
    if (!nouveaux.length) return;
    setFichiers((f) => {
      const tous = [...f, ...nouveaux.filter((n) => !f.some((x) => x.name === n.name && x.size === n.size))];
      if (tous.length > MAX_FICHIERS) toast(t('menuConcierge.filesTooMany', { n: MAX_FICHIERS }));
      return tous.slice(0, MAX_FICHIERS);
    });
  }

  async function envoyer() {
    if (platform === 'other' && !url.trim() && !fichiers.length && !notes.trim()) { toast(t('menuConcierge.errNeedSource')); return; }
    setBusy(true);
    try {
      const photos = sourceEnLigne ? true : wantsPhotos; // source en ligne : photos reprises de la source
      const r = fichiers.length
        ? await apiUpload(`/restaurants/${restoId}/menu/concierge`, { files: fichiers, token, fieldName: 'files', fields: { platform, url: url.trim(), notes: notes.trim(), wantsPhotos: photos ? 'true' : 'false' } })
        : await api(`/restaurants/${restoId}/menu/concierge`, { method: 'POST', token, body: { platform, url: url.trim(), notes: notes.trim(), wantsPhotos: photos } });
      setDemande(r.request); setFichiers([]); toast(t('menuConcierge.sent'));
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

  // Ce qui se passe ensuite : les trois étapes, dites pareil avant et après l'envoi.
  const ensuite = (
    <ol className="concierge-ensuite small">
      <li><b>{t('menuConcierge.next1Title')}</b> {t('menuConcierge.next1')}</li>
      <li><b>{t('menuConcierge.next2Title')}</b> {t('menuConcierge.next2')}</li>
      <li><b>{t('menuConcierge.next3Title')}</b> {t('menuConcierge.next3')}</li>
    </ol>
  );

  if (demande && demande.status !== 'refusee') {
    const etat = { en_attente: ['⏳', t('menuConcierge.stPending'), 'pill'], en_cours: ['🛠️', t('menuConcierge.stInProgress'), 'pill teal'], terminee: ['✅', t('menuConcierge.stDone'), 'pill teal'] }[demande.status] || ['⏳', demande.status, 'pill'];
    return (
      <div className="menu-concierge-etat">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={etat[2]}>{etat[0]} {etat[1]}</span>
          <span className="small">{t('menuConcierge.requestedOn', { date: new Date(demande.createdAt).toLocaleDateString(getLocale()), platform: libelle(demande.platform) })}</span>
        </div>
        {demande.url && <p className="small" style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>🔗 {demande.url}</p>}
        {demande.attachments?.length > 0 && (
          <p className="small" style={{ margin: '6px 0 0' }}>📎 <b>{t('menuConcierge.yourFiles')}</b> : {demande.attachments.map((a, i) => <span key={a.url}>{i > 0 ? ' · ' : ''}<a href={a.url} target="_blank" rel="noreferrer">{a.name || `${i + 1}`}</a></span>)}</p>
        )}
        <p className="small" style={{ margin: '6px 0 0' }}>📸 {demande.platform !== 'other' ? t('menuConcierge.photosLineSource', { source: libelle(demande.platform) }) : demande.wantsPhotos ? t('menuConcierge.photosLineYes') : t('menuConcierge.photosLineNo')}</p>
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
        {demande.status !== 'terminee' && ensuite}
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {(demande.status === 'en_attente' || demande.status === 'en_cours') && !editNote && <button type="button" className="btn-outline" disabled={busy} onClick={() => { setNoteEdit(demande.notes || ''); setEditNote(true); }}>✏️ {t('menuConcierge.addNote')}</button>}
          {demande.status === 'en_attente' && <button type="button" className="btn-ghost" disabled={busy} onClick={annuler}>{t('menuConcierge.cancel')}</button>}
          {demande.status === 'terminee' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => setDemande(null)}>{t('menuConcierge.newRequest')}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="menu-concierge-form">
      <p className="small" style={{ margin: '0 0 12px' }}>{t('menuConcierge.intro')}</p>

      {/* 1. Sur quoi se baser */}
      <div className="concierge-bloc">
        <b>1. {t('menuConcierge.sourceTitle')}</b>
        <p className="small" style={{ margin: '2px 0 8px' }}>{t('menuConcierge.sourceHelp')}</p>
        <div className="role-pick concierge-sources" role="radiogroup" aria-label={t('menuConcierge.sourceTitle')}>
          {PLATEFORMES.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={platform === p} className={`chip${platform === p ? ' active' : ''}`} onClick={() => setPlatform(p)}>{ICONES[p]} {libelle(p)}</button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="concierge-url">{t('menuConcierge.urlLabel')} <span className="small">· {t('menuConcierge.optional')}</span></label>
          <input id="concierge-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholderUrl} />
          <p className="small" style={{ margin: '4px 0 0' }}>{t('menuConcierge.urlHelp')}</p>
        </div>
      </div>

      {/* 2. Ou envoyer sa carte (photo, PDF) */}
      <div className="concierge-bloc">
        <b>2. {t('menuConcierge.filesTitle')}</b>
        <p className="small" style={{ margin: '2px 0 8px' }}>{t('menuConcierge.filesHelp')}</p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ''; }} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn-outline" disabled={busy || fichiers.length >= MAX_FICHIERS} onClick={() => inputRef.current?.click()}>📎 {t('menuConcierge.filesButton')}</button>
          {fichiers.length > 0 && <span className="small">{t('menuConcierge.filesCount', { n: fichiers.length })}</span>}
        </div>
        {fichiers.length > 0 && (
          <ul className="concierge-fichiers">
            {fichiers.map((f) => (
              <li key={`${f.name}-${f.size}`}>
                <span>{/^image\//.test(f.type) ? '🖼️' : '📄'} {f.name} <span className="small">· {(f.size / 1024 / 1024).toFixed(1)} Mo</span></span>
                <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setFichiers((l) => l.filter((x) => x !== f))} aria-label={t('menuConcierge.filesRemove')}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 3. Les photos : reprises de la source en ligne telles quelles ; sinon (carte papier), on demande. */}
      <div className="concierge-bloc">
        <b>3. {t('menuConcierge.photosTitle')}</b>
        {sourceEnLigne ? (
          <p className="small concierge-photos-source" style={{ margin: '6px 0 0' }}>📸 {t('menuConcierge.photosSameSource', { source: libelle(platform) })}<br /><span style={{ opacity: .85 }}>{t('menuConcierge.photosSameSourceHelp')}</span></p>
        ) : (
          <>
            <p className="small" style={{ margin: '2px 0 8px' }}>{t('menuConcierge.photosNoSourceHelp')}</p>
            <div className="role-pick" role="radiogroup" aria-label={t('menuConcierge.photosTitle')}>
              <button type="button" role="radio" aria-checked={wantsPhotos} className={`chip${wantsPhotos ? ' active' : ''}`} onClick={() => setWantsPhotos(true)}>📸 {t('menuConcierge.photosYes')}</button>
              <button type="button" role="radio" aria-checked={!wantsPhotos} className={`chip${!wantsPhotos ? ' active' : ''}`} onClick={() => setWantsPhotos(false)}>{t('menuConcierge.photosNo')}</button>
            </div>
          </>
        )}
      </div>

      <div className="field">
        <label htmlFor="concierge-notes">{t('menuConcierge.notesLabel')} <span className="small">· {t('menuConcierge.optional')}</span></label>
        <textarea id="concierge-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('menuConcierge.notesPlaceholder')} style={{ width: '100%' }} />
      </div>

      <button type="button" className="btn-gold" disabled={busy} onClick={envoyer}>{busy ? t('menuConcierge.sending') : t('menuConcierge.send')}</button>
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('menuConcierge.delay')}</p>

      <div className="concierge-bloc" style={{ marginTop: 12 }}>
        <b>{t('menuConcierge.nextTitle')}</b>
        {ensuite}
      </div>
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.85 }}>🔐 {t('menuConcierge.accessNote')}</p>
    </div>
  );
}
