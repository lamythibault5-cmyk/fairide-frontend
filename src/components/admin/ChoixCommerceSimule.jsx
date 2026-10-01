import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../ConfirmDialog';

// Admin › Simulation › « Quel commerce simuler ? » (fondateur, 2026-10-01). Le commerce de simulation peut prendre la carte
// et l'apparence d'un VRAI commerce (Al Taglio…) pour suivre sa commande de bout en bout — client, paiement simulé, ticket,
// restaurateur, livreur, remise — sans jamais toucher au vrai commerce (copie, côté serveur : POST /admin/simulation/copy).
// Le parcours se fait ensuite avec les cartes de profils plus bas, comme d'habitude.
export default function ChoixCommerceSimule({ etat, onChange }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState([]);
  const [aCopier, setACopier] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    const minuteur = setTimeout(() => {
      api(`/admin/simulation/sources?q=${encodeURIComponent(q.trim())}`, { token })
        .then((r) => { if (!annule) setResultats(r.restaurants || []); }).catch(() => {});
    }, 250);
    return () => { annule = true; clearTimeout(minuteur); };
  }, [q, token]);

  async function copier() {
    const cible = aCopier;
    setEnCours(true);
    try {
      const r = await api('/admin/simulation/copy', { method: 'POST', token, body: { restaurantId: cible.id } });
      toast(tr('simulation.copyDone', { name: r.sourceName, n: r.items }));
      setACopier(null);
      onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }
  async function revenir() {
    setEnCours(true);
    try {
      await api('/admin/simulation/restore', { method: 'POST', token });
      toast(tr('simulation.restoreDone'));
      onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  const copie = !!etat?.restaurant?.sourceId;
  return (
    <div className="card simu-choix" style={{ margin: '0 0 16px' }}>
      <h3 style={{ marginTop: 0 }}>🏪 {tr('simulation.chooseTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        {tr('simulation.chooseCurrent')} <b>{etat?.restaurant?.name || '…'}</b>
        {copie ? ` · ${tr('simulation.chooseCopy')}` : ` · ${tr('simulation.chooseFictional')}`}
      </p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('simulation.chooseSearch')} aria-label={tr('simulation.chooseSearch')} style={{ width: '100%', maxWidth: 420 }} />
      <ul className="simu-sources">
        {resultats.map((r) => (
          <li key={r.id}>
            {r.coverImageUrl ? <img src={r.coverImageUrl} alt="" loading="lazy" /> : <span className="simu-sources-vide" aria-hidden="true">🍽️</span>}
            <span className="simu-sources-texte"><b>{r.name}</b><span className="small">{[r.cuisine, r.commune, tr('simulation.chooseItems', { n: r.items })].filter(Boolean).join(' · ')}</span></span>
            <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => setACopier(r)}>{tr('simulation.chooseButton')}</button>
          </li>
        ))}
        {!resultats.length && <li className="small" style={{ color: 'var(--ink-faint)' }}>{tr('simulation.chooseNone')}</li>}
      </ul>
      {copie && <button type="button" className="btn-outline" disabled={enCours} onClick={revenir}>{tr('simulation.chooseRestore')}</button>}
      <ol className="small simu-parcours">
        {[1, 2, 3, 4, 5, 6].map((i) => <li key={i}>{tr(`simulation.journey${i}`)}</li>)}
      </ol>
      <ConfirmDialog
        open={!!aCopier}
        title={tr('simulation.chooseConfirmTitle', { name: aCopier?.name || '' })}
        message={tr('simulation.chooseConfirmText')}
        confirmLabel={tr('simulation.chooseButton')}
        loading={enCours}
        onConfirm={copier}
        onCancel={() => { if (!enCours) setACopier(null); }}
      />
    </div>
  );
}
