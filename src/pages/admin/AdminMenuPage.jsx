import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { SkeletonCards } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import MenuPage from '../restaurant/MenuPage';

// Carte d'un commerce vue par l'admin : exactement l'éditeur du restaurateur (Mes produits), branché sur
// son restaurant — sections, plats, options, import PDF / photo / site, modèles, traduction. En tête, la
// demande « Fairide s'en occupe » si le restaurateur en a fait une : plateforme de référence, page, ses
// précisions, et le traitement (prise en charge → terminée, avec un mot qui lui est montré et envoyé).
export default function AdminMenuPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const { t: tr } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try { setRestaurant(await api(`/restaurants/${id}`)); } catch (e) { setErreur(e.message); }
  }, [id]);

  useEffect(() => {
    charger();
    api(`/admin/restaurants/${id}`, { token }).then((d) => { setFiche(d); setNote(d.concierge?.adminNote || ''); }).catch((e) => toast(e.message));
  }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function traiter(status) {
    if (!fiche?.concierge) return;
    setBusy(true);
    try {
      const body = status ? { status, adminNote: note.trim() } : { adminNote: note.trim() };
      const r = await api(`/admin/restaurants/${id}/menu/concierge/${fiche.concierge.id}`, { method: 'PATCH', token, body });
      setFiche((f) => ({ ...f, concierge: r.request }));
      toast(status === 'terminee' ? tr('adminMenu.toastDone') : tr('adminMenu.toastUpdated'));
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  const d = fiche?.concierge;
  const etat = d ? ({
    en_attente: ['⏳', tr('adminMenu.stPending'), 'pill gold'], en_cours: ['🛠️', tr('adminMenu.stInProgress'), 'pill teal'],
    terminee: ['✅', tr('adminMenu.stDone'), 'pill teal'], refusee: ['✖', tr('adminMenu.stRefused'), 'pill']
  }[d.status] || ['⏳', d.status, 'pill']) : null;
  const ouverte = d && (d.status === 'en_attente' || d.status === 'en_cours');

  return (
    <div className="admin-menu-page">
      <AdminPageHeader module="restaurants" title={restaurant ? tr('adminMenu.title', { name: restaurant.name }) : tr('adminMenu.titleLoading')}
        actions={<>
          <Link to="/admin/restaurants" className="btn-outline" style={{ textDecoration: 'none' }}>{tr('adminMenu.back')}</Link>
          <a href={`/restaurants/${id}`} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>{tr('adminRestos.viewPage')}</a>
        </>} />

      <div className="card" style={{ borderLeft: '4px solid var(--teal, #1E8A7A)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🤝 {tr('adminMenu.requestTitle')}</h3>
        {!fiche && <p className="small" style={{ margin: 0 }}>{tr('adminCommon.loading')}</p>}
        {fiche && !d && <p className="small" style={{ margin: 0 }}>{tr('adminMenu.noRequest')}</p>}
        {d && (
          <>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={etat[2]}>{etat[0]} {etat[1]}</span>
              <span className="small">{tr('adminMenu.requestedOn', { date: new Date(d.createdAt).toLocaleDateString(getLocale()) })}</span>
              {d.taskId && <Link to="/admin/tasks" className="small">{tr('adminMenu.seeTask')}</Link>}
            </div>
            <p className="small" style={{ margin: '8px 0 2px' }}><b>{tr('adminMenu.platform')}</b> : {d.platformLabel}</p>
            {d.url && <p className="small" style={{ margin: '2px 0', overflowWrap: 'anywhere' }}><b>{tr('adminMenu.page')}</b> : <a href={d.url} target="_blank" rel="noreferrer">{d.url}</a></p>}
            <p className="small" style={{ margin: '2px 0', whiteSpace: 'pre-wrap' }}><b>{tr('adminMenu.notes')}</b> : {d.notes || <i>{tr('adminMenu.noNotes')}</i>}</p>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="admin-menu-note">{tr('adminMenu.noteLabel')}</label>
              <textarea id="admin-menu-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('adminMenu.notePh')} style={{ width: '100%' }} />
              <span className="small">{tr('adminMenu.noteHelp')}</span>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {d.status === 'en_attente' && <button type="button" className="btn-teal" disabled={busy} onClick={() => traiter('en_cours')}>{tr('adminMenu.take')}</button>}
              {ouverte && <button type="button" className="btn-gold" disabled={busy} onClick={() => traiter('terminee')}>{tr('adminMenu.done')}</button>}
              {ouverte && <button type="button" className="btn-danger-ghost" disabled={busy} onClick={() => traiter('refusee')}>{tr('adminMenu.refuse')}</button>}
              {!ouverte && <button type="button" className="btn-outline" disabled={busy} onClick={() => traiter('en_attente')}>{tr('adminMenu.reopen')}</button>}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => traiter(null)}>{tr('adminMenu.saveNote')}</button>
            </div>
          </>
        )}
      </div>

      {erreur && <div className="card"><p className="small" style={{ margin: 0 }}>⚠️ {erreur}</p></div>}
      {!restaurant && !erreur && <SkeletonCards count={3} />}
      {restaurant && (
        <>
          <p className="small" style={{ margin: '4px 0 10px' }}>
            {tr('adminMenu.intro', { name: restaurant.name, n: (restaurant.menu || []).length })}
          </p>
          <MenuPage modeAdmin contexte={{ restaurant, restoId: id, loadDashboard: charger }} />
        </>
      )}
    </div>
  );
}
