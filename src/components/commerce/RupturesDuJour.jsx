import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

// « Rupture de stock aujourd'hui » depuis le tableau de bord des commandes (fondateur, 2026-10-10) : un bouton à côté de
// chaque plat. En rupture, le plat est masqué aux clients tout de suite et revient TOUT SEUL le lendemain (serveur :
// POST /restaurants/:id/menu/:itemId/stock, remettreRupturesDuJour). Même geste que dans Ma carte, à portée de main pendant
// le service.
export default function RupturesDuJour({ restaurant, restoId, token, toast, loadDashboard }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const plats = (restaurant?.menu || []).filter((p) => !p.withdrawn);
  const enRupture = plats.filter((p) => p.outOfStockToday).length;
  async function basculer(p) {
    setEnCours(p.id);
    try {
      await api(`/restaurants/${restoId}/menu/${p.id}/stock`, { method: 'POST', token, body: { outOfStock: !p.outOfStockToday } });
      toast(p.outOfStockToday ? t('ordersResto.stockBackDone') : t('ordersResto.stockOutDone'));
      await loadDashboard(restoId, { annexes: false, silencieux: true });
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  if (!plats.length) return null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button type="button" className="row" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span><b>🥡 {t('ordersResto.stockPanelTitle')}</b>{enRupture > 0 && <span className="pill" style={{ marginLeft: 8 }}>{t('ordersResto.stockPanelCount', { n: enRupture })}</span>}</span>
        <span aria-hidden="true" style={{ transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('ordersResto.stockPanelHelp')}</p>
      {ouvert && (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {plats.map((p) => (
            <li key={p.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line, #e1d9c4)' }}>
              <span style={{ opacity: p.outOfStockToday ? 0.6 : 1 }}>
                <b>{p.name}</b>
                {p.outOfStockToday && <span className="small" style={{ display: 'block' }}>{t('ordersResto.stockOutTodayLine')}</span>}
              </span>
              <button type="button" className={p.outOfStockToday ? 'btn-teal' : 'btn-outline'} style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap' }} disabled={enCours === p.id} onClick={() => basculer(p)}>
                {enCours === p.id ? '…' : p.outOfStockToday ? t('ordersResto.stockBackBtn') : t('ordersResto.stockOutBtn')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
