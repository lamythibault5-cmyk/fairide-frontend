import { useState } from 'react';
import { api } from '../../api';
import { useActionOptimiste } from '../../actionOptimiste';
import { champsStockVises, etatStock, modifierPlat } from './majLocale';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

// « Rupture de stock aujourd'hui » depuis le tableau de bord des commandes (fondateur, 2026-10-10) : un bouton à côté de
// chaque plat. En rupture, le plat est masqué aux clients tout de suite et revient TOUT SEUL le lendemain (serveur :
// POST /restaurants/:id/menu/:itemId/stock, remettreRupturesDuJour). Même geste que dans Ma carte, à portée de main pendant
// le service.
export default function RupturesDuJour({ restaurant, restoId, token, toast, loadDashboard, modifierRestaurant }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const plats = (restaurant?.menu || []).filter((p) => !p.withdrawn);
  const enRupture = plats.filter((p) => p.outOfStockToday).length;
  /* LE PLAT CHANGE AU TOUCHER (2026-10-23, app lente : le bouton affichait « … » le temps de l'appel puis d'un rechargement
   * de la fiche, en plein service). Le plat est modifié dans la fiche gardée par DashboardLayout, l'appel suit, sa réponse
   * (l'état réel du plat) remplace la devinette ; un refus le remet comme avant avec le message d'erreur
   * (actionOptimiste.js). Même clé que dans Ma carte (« stock:<plat> »). La relecture, la plus légère (les commandes : la
   * réponse donne déjà le plat), part une fois les gestes finis, sans rien bloquer. */
  const agir = useActionOptimiste();
  function basculer(p) {
    const corps = { outOfStock: !p.outOfStockToday };
    agir(`stock:${p.id}`, {
      appliquer: () => { const avant = etatStock(p); modifierPlat(modifierRestaurant, p.id, champsStockVises(p, corps)); return avant; },
      envoyer: () => api(`/restaurants/${restoId}/menu/${p.id}/stock`, { method: 'POST', token, body: corps }),
      annuler: (avant) => modifierPlat(modifierRestaurant, p.id, avant),
      confirmer: (rep) => {
        modifierPlat(modifierRestaurant, p.id, etatStock(rep));
        toast(corps.outOfStock ? t('ordersResto.stockOutDone') : t('ordersResto.stockBackDone'));
      },
      // Sans fiche gardée à modifier, la relecture reprend la fiche (le plat ne bougerait pas sinon).
      rafraichir: () => loadDashboard(restoId, { fiche: !modifierRestaurant, annexes: false, silencieux: true })
    });
  }
  if (!plats.length) return null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button type="button" className="row" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span><b><Icone nom="sac" taille={16} className="icone-texte" />{' '}{t('ordersResto.stockPanelTitle')}</b>{enRupture > 0 && <span className="pill" style={{ marginLeft: 8 }}>{t('ordersResto.stockPanelCount', { n: enRupture })}</span>}</span>
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
              <button type="button" className={p.outOfStockToday ? 'btn-teal' : 'btn-outline'} style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => basculer(p)}>
                {p.outOfStockToday ? t('ordersResto.stockBackBtn') : t('ordersResto.stockOutBtn')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
