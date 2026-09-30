import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icone from '../../components/Icone';
import RouleauTickets from '../../components/RouleauTickets';
import '../../simulation.css';

// Admin › Simulation : parcourir Fairide comme un visiteur, un client, un restaurateur et un livreur, dans un bac
// à sable cloisonné (voir backend simulation.js), et garder les notes d'amélioration prises en chemin. Chaque
// lancement ouvre un onglet à part avec les quatre profils ; la barre en bas de cet onglet passe de l'un à l'autre.
const PROFILS = [
  { key: 'visitor', icone: 'globe' },
  { key: 'client', icone: 'compte' },
  { key: 'restaurant', icone: 'commerce' },
  { key: 'driver', icone: 'scooter' }
];
const DEPART = { visitor: () => '/', client: (id) => (id ? `/restaurants/${id}` : '/'), restaurant: () => '/dashboard', driver: () => '/driver' };

export default function AdminSimulationPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [lancement, setLancement] = useState(null); // profil en cours d'ouverture
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);
  const [filtre, setFiltre] = useState('ouverte'); // ouverte | traitee | all
  const [profilNotes, setProfilNotes] = useState('all');
  const [aSupprimer, setASupprimer] = useState(null);
  // Terminal simulé du commerce fictif : ses tickets « sortent » ici (imprimante virtuelle, relue toutes les 5 s).
  const [imprimante, setImprimante] = useState({ tickets: [], nouveaux: [], terminal: false });
  const [impression, setImpression] = useState(false);
  useEffect(() => {
    let actif = true;
    const tourner = () => api('/admin/simulation/printer', { token }).then((r) => { if (actif) setImprimante(r); }).catch(() => {});
    tourner();
    const i = setInterval(tourner, 5000);
    return () => { actif = false; clearInterval(i); };
  }, [token]);
  async function imprimer(orderId) {
    setImpression(true);
    try {
      const r = await api('/admin/simulation/print', { method: 'POST', token, body: orderId ? { orderId } : {} });
      setImprimante(r);
      toast(orderId ? tr('simulation.reprinted') : tr('simulation.testPrinted'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setImpression(false); }
  }

  const charger = useCallback(() => {
    api('/admin/simulation', { token }).then(setEtat).catch((e) => toast(e.message, 'erreur'));
  }, [token, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function lancer(profil) {
    setLancement(profil);
    try {
      const d = await api('/admin/simulation/start', { method: 'POST', token });
      const charge = {
        profiles: d.profiles, actif: profil, restaurantId: d.restaurantId, restaurantName: d.restaurantName,
        // Un peu avant l'expiration réelle des jetons (8 h), pour que la barre prévienne avant les erreurs.
        expiresAt: Date.now() + (Number(d.expiresInHours) || 8) * 3600 * 1000 - 5 * 60 * 1000
      };
      const frag = btoa(encodeURIComponent(JSON.stringify(charge)));
      const w = window.open(`${DEPART[profil](d.restaurantId)}#simuler=${frag}`, '_blank');
      if (!w) toast(tr('simulation.popupBlocked'), 'erreur');
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setLancement(null); }
  }

  async function remettreAZero() {
    setResetEnCours(true);
    try {
      const r = await api('/admin/simulation/reset', { method: 'POST', token });
      toast(tr('simulation.resetDone', { n: (r.deleted || 0) + (r.cancelled || 0) }));
      setConfirmReset(false);
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setResetEnCours(false); }
  }

  async function changerStatut(note, status) {
    try {
      const r = await api(`/admin/simulation/notes/${note.id}`, { method: 'PATCH', token, body: { status } });
      setEtat((e) => ({ ...e, notes: e.notes.map((n) => (n.id === note.id ? r.note : n)) }));
    } catch (e) { toast(e.message, 'erreur'); }
  }

  async function supprimer() {
    const note = aSupprimer;
    try {
      await api(`/admin/simulation/notes/${note.id}`, { method: 'DELETE', token });
      setEtat((e) => ({ ...e, notes: e.notes.filter((n) => n.id !== note.id) }));
      setASupprimer(null);
    } catch (e) { toast(e.message, 'erreur'); }
  }

  const notes = (etat?.notes || []).filter((n) => (filtre === 'all' || n.status === filtre) && (profilNotes === 'all' || n.profile === profilNotes));
  const compte = (s) => (etat?.notes || []).filter((n) => s === 'all' || n.status === s).length;
  const date = (v) => new Date(v).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function copier() {
    const lignes = notes.map((n) => `- [${tr(`simulation.profile_${n.profile}`)} · ${tr(`simulation.cat_${n.category}`)}] ${n.path} (${n.viewport}) : ${n.text}`);
    try { await navigator.clipboard.writeText(lignes.join('\n')); toast(tr('simulation.copied')); } catch { toast(tr('simulation.copyFailed'), 'erreur'); }
  }

  return (
    <div>
      <AdminPageHeader module="simulation" />
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 760 }}>{tr('simulation.intro')}</p>

      <div className="simu-cartes">
        {PROFILS.map((p) => (
          <div key={p.key} className="simu-carte">
            <div className="simu-carte-tete">
              <span className="simu-carte-icone"><Icone nom={p.icone} taille={22} /></span>
              <h3>{tr(`simulation.profile_${p.key}`)}</h3>
            </div>
            <p>{tr(`simulation.${p.key}_desc`)}</p>
            <button type="button" className="btn-teal" disabled={!!lancement} onClick={() => lancer(p.key)}>
              {lancement === p.key ? tr('simulation.launching') : tr('simulation.launch')}
            </button>
          </div>
        ))}
      </div>
      <p className="small" style={{ margin: '10px 0 0', color: 'var(--ink-faint)' }}>{tr('simulation.tipMobile')}</p>

      <div className="simu-grille">
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>{tr('simulation.sandboxTitle')}</h3>
          {!etat && <p className="small">…</p>}
          {etat && !etat.ready && <p className="small" style={{ margin: 0 }}>{tr('simulation.sandboxEmpty')}</p>}
          {etat?.ready && (
            <>
              <dl className="simu-infos">
                <div><dt>{tr('simulation.restaurantLabel')}</dt><dd>{etat.restaurant.name}</dd></div>
                <div>
                  <dt>{tr('simulation.accountsLabel')}</dt>
                  {['client', 'restaurant', 'driver'].map((p) => (
                    <dd key={p}><span className="simu-badge">{tr(`simulation.profile_${p}`)}</span>{etat.accounts[p]?.email}</dd>
                  ))}
                </div>
                <div><dt>{tr('simulation.ordersLabel')}</dt><dd>{tr('simulation.ordersCount', { total: etat.orders.total, open: etat.orders.open })}</dd></div>
              </dl>
              <p className="small" style={{ color: 'var(--ink-faint)' }}>{tr('simulation.mailsHint')}</p>
              <button type="button" className="btn-outline" disabled={!etat.orders.total} onClick={() => setConfirmReset(true)}>{tr('simulation.reset')}</button>
            </>
          )}
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>{tr('simulation.safetyTitle')}</h3>
          <ul className="simu-liste-sure">
            {[1, 2, 3, 4, 5].map((i) => <li key={i}>{tr(`simulation.safety${i}`)}</li>)}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{tr('simulation.printerTitle')}</h3>
          <button type="button" className="btn-outline" disabled={impression || !etat?.ready} onClick={() => imprimer(null)}>{tr('simulation.testTicket')}</button>
        </div>
        <p className="small" style={{ margin: '6px 0 12px', maxWidth: 760 }}>{tr('simulation.printerAdminHelp')}</p>
        <div className="simu-grille" style={{ marginTop: 0 }}>
          <div>
            <h4 style={{ margin: '0 0 8px' }}>{tr('simulation.recentOrders')}</h4>
            {(!etat?.recentOrders || etat.recentOrders.length === 0) && <p className="small" style={{ margin: 0 }}>{tr('simulation.noOrdersYet')}</p>}
            {(etat?.recentOrders || []).map((o) => (
              <div key={o.id} className="simu-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="small"><b>{o.orderNumber ? `#${String(o.orderNumber).padStart(3, '0')}` : '—'}</b> · {tr(o.orderType === 'delivery' ? 'simulation.typeDelivery' : 'simulation.typePickup')} · {tr(`simulation.status_${o.status}`)}</span>
                <button type="button" className="btn-ghost simu-mini" disabled={impression || !o.paid} onClick={() => imprimer(o.id)}>{tr('simulation.printTicket')}</button>
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            <RouleauTickets tickets={imprimante.tickets} nouveaux={imprimante.nouveaux || []} t={tr} max={6} onReprint={(id) => imprimer(id)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{tr('simulation.notesTitle')}</h3>
          {notes.length > 0 && <button type="button" className="btn-ghost" onClick={copier}>{tr('simulation.copyAll')}</button>}
        </div>
        <div className="simu-filtres" style={{ margin: '12px 0 6px' }}>
          {[['ouverte', tr('simulation.filterOpen')], ['traitee', tr('simulation.filterDone')], ['all', tr('simulation.filterAll')]].map(([k, l]) => (
            <button key={k} type="button" className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l} ({compte(k)})</button>
          ))}
        </div>
        <div className="simu-filtres" style={{ margin: '0 0 8px' }}>
          {['all', ...PROFILS.map((p) => p.key)].map((k) => (
            <button key={k} type="button" className={`chip${profilNotes === k ? ' active' : ''}`} onClick={() => setProfilNotes(k)}>
              {k === 'all' ? tr('simulation.allProfiles') : tr(`simulation.profile_${k}`)}
            </button>
          ))}
        </div>
        {etat && notes.length === 0 && <p className="small" style={{ margin: '8px 0 0' }}>{tr('simulation.notesEmpty')}</p>}
        {notes.map((n) => (
          <div key={n.id} className={`simu-note${n.status === 'traitee' ? ' est-traitee' : ''}`}>
            <div><span className="simu-badge">{tr(`simulation.cat_${n.category}`)}</span><span className="simu-badge">{tr(`simulation.profile_${n.profile}`)}</span></div>
            <p className="simu-note-texte">{n.text}</p>
            <div className="simu-note-meta">
              {tr('simulation.noteMeta', { page: n.path || '/', ecran: n.viewport || '—', langue: String(n.language || '').toUpperCase(), date: date(n.createdAt), auteur: n.adminEmail })}
            </div>
            <div className="simu-note-actions">
              {n.status === 'ouverte'
                ? <button type="button" className="btn-outline simu-mini" onClick={() => changerStatut(n, 'traitee')}>{tr('simulation.markDone')}</button>
                : <button type="button" className="btn-ghost simu-mini" onClick={() => changerStatut(n, 'ouverte')}>{tr('simulation.reopen')}</button>}
              <button type="button" className="btn-ghost simu-mini" onClick={() => setASupprimer(n)}>{tr('simulation.delete')}</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog open={confirmReset} title={tr('simulation.reset')} message={tr('simulation.resetConfirm')} confirmLabel={tr('simulation.reset')} danger loading={resetEnCours} onConfirm={remettreAZero} onCancel={() => setConfirmReset(false)} />
      <ConfirmDialog open={!!aSupprimer} title={tr('simulation.delete')} message={tr('simulation.deleteConfirm')} confirmLabel={tr('simulation.delete')} danger onConfirm={supprimer} onCancel={() => setASupprimer(null)} />
    </div>
  );
}
