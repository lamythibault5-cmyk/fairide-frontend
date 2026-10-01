import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { euros } from '../../prixPlat';

// Admin › Simulation › « Créer une commande et l'imprimer » (fondateur, 2026-10-01). L'admin compose une commande sur la
// carte du commerce de simulation, elle est enregistrée payée au nom du client de simulation, et son ticket sort tout de
// suite sur l'imprimante virtuelle à droite : on voit ce qui s'imprime, sans parcourir le site. Le restaurateur de
// simulation la reçoit comme une vraie commande.
export default function CommandeTestAdmin({ pret, onCree }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [carte, setCarte] = useState(null);
  const [qte, setQte] = useState({});
  const [type, setType] = useState('pickup');
  const [note, setNote] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!pret || !ouvert) return;
    api('/admin/simulation/menu', { token }).then(setCarte).catch((e) => toast(e.message, 'erreur'));
  }, [pret, ouvert, token, toast]);

  const lignes = Object.entries(qte).filter(([, n]) => n > 0);
  const total = lignes.reduce((a, [id, n]) => a + n * (carte?.items.find((i) => i.id === id)?.price || 0), 0);
  const changer = (id, d) => setQte((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] || 0) + d)) }));

  async function creer() {
    if (!lignes.length) { toast(tr('simulation.orderPickOne'), 'erreur'); return; }
    setEnCours(true);
    try {
      const r = await api('/admin/simulation/order', { method: 'POST', token, body: { items: lignes.map(([itemId, qty]) => ({ itemId, qty })), orderType: type, note: note.trim() } });
      toast(tr('simulation.orderCreated', { n: r.orderNumber ? `#${String(r.orderNumber).padStart(3, '0')}` : '', total: euros(r.total) }));
      setQte({}); setNote('');
      onCree?.(r);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  if (!ouvert) {
    return <button type="button" className="btn-gold" disabled={!pret} onClick={() => setOuvert(true)}>🧾 {tr('simulation.orderCreateButton')}</button>;
  }
  const sections = carte ? [...new Set(carte.items.map((i) => i.section))] : [];
  return (
    <div className="simu-commande">
      <p className="small" style={{ margin: '0 0 8px' }}>{tr('simulation.orderCreateHelp', { name: carte?.restaurant?.name || '…' })}</p>
      {!carte && <p className="small">…</p>}
      <div className="simu-commande-carte">
        {sections.map((s) => (
          <div key={s}>
            <b className="small">{s}</b>
            {carte.items.filter((i) => i.section === s).map((i) => (
              <div key={i.id} className="simu-commande-plat">
                <span className="simu-commande-nom">{i.name} <span className="small" style={{ color: 'var(--ink-faint)' }}>{euros(i.price)}</span></span>
                <span className="exemplaires">
                  <button type="button" className="btn-ghost" disabled={!qte[i.id]} onClick={() => changer(i.id, -1)} aria-label="−">−</button>
                  <b>{qte[i.id] || 0}</b>
                  <button type="button" className="btn-ghost" onClick={() => changer(i.id, 1)} aria-label="+">+</button>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        {['pickup', 'delivery'].map((k) => (
          <button key={k} type="button" className={`chip${type === k ? ' active' : ''}`} onClick={() => setType(k)}>{tr(k === 'pickup' ? 'simulation.typePickup' : 'simulation.typeDelivery')}</button>
        ))}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('simulation.orderNotePh')} maxLength={300} style={{ flex: '1 1 200px' }} aria-label={tr('simulation.orderNotePh')} />
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-gold" disabled={enCours || !lignes.length} onClick={creer}>
          {enCours ? '…' : tr('simulation.orderCreateAndPrint', { total: euros(total) })}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>{tr('simulation.orderClose')}</button>
      </div>
    </div>
  );
}
