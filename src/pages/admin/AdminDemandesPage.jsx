import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

/* Admin › Commerces › Demandes des clients (« Demande ton restaurant », fondateur, 2026-10-26). Les restaurants que les
 * clients demandent, le plus demandé d'abord : combien, combien cette semaine, d'où. L'équipe y note où elle en est (statut,
 * rendez-vous, note — le client n'en voit qu'une version douce), relie la demande au commerce quand il s'inscrit (le message
 * « il est arrivé » part tout seul quand il devient commandable, backend demandesRestaurants.notifierArrivees), et ouvre la
 * preuve à montrer au restaurant : un lien /preuve/<jeton>, sans compte, qui ne montre aucun nom. */
const STATUTS = ['a_voir', 'en_relance', 'rendez_vous', 'inscrit', 'pas_maintenant', 'retire'];

export default function AdminDemandesPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [notes, setNotes] = useState({});
  const charger = useCallback(() => api('/admin/demandes', { token }).then((r) => setListe(r.demandes || [])).catch((e) => toast(e.message, 'erreur')), [token, toast]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    api('/admin/restaurants?limit=1000&sort=name', { token }).then((l) => setRestaurants(Array.isArray(l) ? l : [])).catch(() => {});
  }, [token]);

  async function modifier(id, champs) {
    try {
      await api(`/admin/demandes/${id}`, { method: 'PATCH', token, body: champs });
      toast(tr('adminDemandes.enregistre'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }
  async function preuve(id, copier = false) {
    try {
      const r = await api(`/admin/demandes/${id}/preuve`, { method: 'POST', token });
      const url = `${window.location.origin}${r.chemin}`;
      if (copier) { await navigator.clipboard?.writeText(url); toast(tr('adminDemandes.lienCopie')); }
      else window.open(url, '_blank', 'noopener');
    } catch (e) { toast(e.message, 'erreur'); }
  }
  const jour = (d) => (d ? new Date(d).toLocaleDateString('fr-BE') : '');

  return (
    <div>
      <AdminPageHeader module="demandes" />
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 780 }}>{tr('adminDemandes.intro')}</p>
      {!liste && <p className="small">…</p>}
      {liste && liste.length === 0 && <p className="small">{tr('adminDemandes.vide')}</p>}
      {liste && liste.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr('adminDemandes.colRestaurant')}</th><th>{tr('adminDemandes.colDemandes')}</th><th>{tr('adminDemandes.colSemaine')}</th>
                <th>{tr('adminDemandes.colOu')}</th><th>{tr('adminDemandes.colStatut')}</th><th>{tr('adminDemandes.colCommerce')}</th><th />
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.nom}</b>
                    <div className="small">{[[d.rue, d.numero].filter(Boolean).join(' '), [d.codePostal, d.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
                    <div className="small">{tr(`adminDemandes.origine_${d.origine}`)}{d.prevenusLe ? ` · ${tr('adminDemandes.prevenus', { date: jour(d.prevenusLe) })}` : d.restaurantId && d.aPrevenir ? ` · ${tr('adminDemandes.aPrevenir', { n: d.aPrevenir })}` : ''}</div>
                    <textarea rows={2} style={{ marginTop: 6, width: '100%', minWidth: 200 }} placeholder={tr('adminDemandes.note')} aria-label={tr('adminDemandes.note')}
                      value={notes[d.id] ?? d.note} onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                      onBlur={() => { if ((notes[d.id] ?? d.note) !== d.note) modifier(d.id, { note: notes[d.id] }); }} />
                  </td>
                  <td><b>{d.total}</b></td>
                  <td>{d.semaine > 0 ? `+${d.semaine}` : '0'}</td>
                  <td>{d.communes.join(', ')}</td>
                  <td>
                    <select value={d.statut} onChange={(e) => modifier(d.id, { statut: e.target.value })} aria-label={tr('adminDemandes.colStatut')}>
                      {STATUTS.map((s) => <option key={s} value={s}>{tr(`adminDemandes.statut_${s}`)}</option>)}
                    </select>
                    {d.statut === 'rendez_vous' && (
                      <label className="small" style={{ display: 'block', marginTop: 6 }}>{tr('adminDemandes.rendezVous')}{' '}
                        <input type="date" value={d.rendezVousLe ? String(d.rendezVousLe).slice(0, 10) : ''} onChange={(e) => modifier(d.id, { rendezVousLe: e.target.value || null })} />
                      </label>
                    )}
                  </td>
                  <td>
                    {d.restaurantId ? (
                      <>
                        {d.restaurantSlug ? <a href={`/restaurants/${d.restaurantSlug}`} target="_blank" rel="noreferrer">{d.restaurantNom}</a> : d.restaurantNom}
                        {d.origine !== 'resto' && <div><button type="button" className="btn-ghost btn-sm" onClick={() => modifier(d.id, { restaurantId: null })}>{tr('adminDemandes.delier')}</button></div>}
                      </>
                    ) : (
                      <select value="" onChange={(e) => e.target.value && modifier(d.id, { restaurantId: e.target.value })} aria-label={tr('adminDemandes.relier')} title={tr('adminDemandes.relierAide')}>
                        <option value="">{tr('adminDemandes.relierChoisir')}</option>
                        {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}{r.commune ? ` · ${r.commune}` : ''}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-outline btn-sm" onClick={() => preuve(d.id)}>{tr('adminDemandes.preuve')}</button>{' '}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => preuve(d.id, true)}>{tr('adminDemandes.copierLien')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
