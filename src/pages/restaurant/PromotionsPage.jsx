import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const TYPES = [
  { value: 'percent', label: 'Réduction % sur un plat' },
  { value: 'bogo', label: 'N achetés = 1 offert (sur un plat)' },
  { value: 'cart_threshold', label: 'X€ offerts dès Y€ de commande (toute la commande)' }
];

export default function PromotionsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId } = useOutletContext();

  const [promos, setPromos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('percent');
  const [itemId, setItemId] = useState('');
  const [percentValue, setPercentValue] = useState('15');
  const [bogoN, setBogoN] = useState('1');
  const [discountValue, setDiscountValue] = useState('');
  const [minCartTotal, setMinCartTotal] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  function loadPromos() {
    api(`/restaurants/${restoId}/promotions/mine`, { token }).then(setPromos).catch((e) => toast(e.message));
  }

  useEffect(() => {
    loadPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  async function createPromo() {
    setSaving(true);
    try {
      if (type === 'cart_threshold') {
        const x = Number(discountValue);
        const y = Number(minCartTotal);
        if (!x || x <= 0) { toast('Indique le montant offert.'); setSaving(false); return; }
        if (!y || y <= x) { toast('Le seuil de commande doit être supérieur au montant offert.'); setSaving(false); return; }
        await api(`/restaurants/${restoId}/promotions`, { method: 'POST', token, body: { discountValue: x, minCartTotal: y } });
      } else {
        if (!itemId) { toast('Choisis un plat.'); setSaving(false); return; }
        const body = type === 'percent' ? { type: 'percent', value: Number(percentValue) } : { type: 'bogo', value: Number(bogoN) };
        await api(`/restaurants/${restoId}/menu/${itemId}/promotions`, { method: 'POST', token, body });
      }
      setFormOpen(false);
      setItemId(''); setDiscountValue(''); setMinCartTotal('');
      loadPromos();
      toast('Promotion créée.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo) {
    setTogglingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'PATCH', token, body: { active: !promo.active } });
      loadPromos();
    } catch (e) {
      toast(e.message);
    } finally {
      setTogglingId(null);
    }
  }

  async function deletePromo(promo) {
    setDeletingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'DELETE', token });
      loadPromos();
      toast('Promotion supprimée.');
    } catch (e) {
      toast(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Promotions</h2>
      <p className="small" style={{ margin: '0 0 14px' }}>
        Réductions sur un plat précis, ou une offre sur toute la commande. Une seule promo active à la fois par plat, et une seule promo panier active à la fois.
      </p>

      {promos === null && <div className="empty">Chargement...</div>}
      {promos !== null && promos.length === 0 && !formOpen && <div className="empty">Aucune promotion pour l'instant.</div>}
      {promos !== null && promos.map((p) => (
        <div className="card" key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className="pill teal">🏷️ {p.label}</span>
              <div className="small" style={{ marginTop: 6 }}>{p.itemName || 'Toute la commande'}{!p.active ? ' — inactive' : ''}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={togglingId === p.id} onClick={() => toggleActive(p)}>
                {togglingId === p.id ? '...' : p.active ? 'Désactiver' : 'Activer'}
              </button>
              <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={deletingId === p.id} onClick={() => deletePromo(p)}>
                {deletingId === p.id ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {!formOpen ? (
        <button type="button" className="btn-teal" onClick={() => setFormOpen(true)}>+ Ajouter une promotion</button>
      ) : (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Nouvelle promotion</h3>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
            </select>
          </div>

          {type !== 'cart_threshold' && (
            <div className="field">
              <label>Plat concerné</label>
              <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">— Choisir un plat —</option>
                {(restaurant.menu || []).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
          )}

          {type === 'percent' && (
            <div className="field">
              <label>Réduction</label>
              <select value={percentValue} onChange={(e) => setPercentValue(e.target.value)}>
                {[10, 15, 20, 25, 30, 40, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          )}

          {type === 'bogo' && (
            <div className="field">
              <label>Nombre d'articles achetés pour en obtenir 1 offert</label>
              <select value={bogoN} onChange={(e) => setBogoN(e.target.value)}>
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} acheté{v > 1 ? 's' : ''} = 1 offert</option>)}
              </select>
            </div>
          )}

          {type === 'cart_threshold' && (
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Montant offert (€)</label>
                <input type="number" step="0.5" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="5" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Dès combien de commande (€) ?</label>
                <input type="number" step="0.5" value={minCartTotal} onChange={(e) => setMinCartTotal(e.target.value)} placeholder="30" />
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={createPromo}>{saving ? '...' : 'Créer la promotion'}</button>
            <button className="btn-ghost" onClick={() => setFormOpen(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
