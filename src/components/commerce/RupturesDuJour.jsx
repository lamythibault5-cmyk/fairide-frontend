import { useMemo, useState } from 'react';
import { categoryLabel } from '../../menuCategories';
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
  const [recherche, setRecherche] = useState('');
  const plats = useMemo(() => (restaurant?.menu || []).filter((p) => !p.withdrawn), [restaurant?.menu]);
  const enRupture = plats.filter((p) => p.outOfStockToday).length;
  /* EN PLEIN SERVICE, SUR UNE CARTE DE 40 PLATS (revue des frictions du commerce, 2026-11-08 ; petites retouches, pas de
   * refonte). Les plats en rupture aujourd'hui d'abord (ce qu'on vient remettre en vente), puis les autres par section de la
   * carte, dans l'ordre de la carte ; un champ de recherche au-delà de 12 plats ; des boutons de 44 px au moins. Les
   * suppléments ne sont pas ici (le modèle ne les met pas en rupture). */
  const AVEC_RECHERCHE = 12;
  const groupes = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase();
    const vus = plats.filter((p) => !q || String(p.name || '').toLocaleLowerCase().includes(q));
    const liste = [];
    const rupture = vus.filter((p) => p.outOfStockToday);
    if (rupture.length) liste.push({ cle: '__rupture', titre: t('ordersResto.stockOutGroup'), plats: rupture });
    const parSection = new Map();
    for (const p of vus.filter((x) => !x.outOfStockToday)) {
      const s = p.category || 'plat';
      if (!parSection.has(s)) parSection.set(s, []);
      parSection.get(s).push(p);
    }
    for (const [s, l] of parSection) liste.push({ cle: s, titre: categoryLabel(s, t), plats: l });
    return liste;
  }, [plats, recherche, t]);
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
      rafraichir: () => loadDashboard(restoId, { fiche: !modifierRestaurant, silencieux: true })
    });
  }
  if (!plats.length) return null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button type="button" className="row" style={{ width: '100%', minHeight: 44, justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span><b><Icone nom="sac" taille={16} className="icone-texte" />{' '}{t('ordersResto.stockPanelTitle')}</b>{enRupture > 0 && <span className="pill" style={{ marginLeft: 8 }}>{t('ordersResto.stockPanelCount', { n: enRupture })}</span>}</span>
        <span aria-hidden="true" style={{ transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{t('ordersResto.stockPanelHelp')}</p>
      {ouvert && (
        <>
          {plats.length > AVEC_RECHERCHE && (
            <div className="field" style={{ margin: '10px 0 0' }}>
              <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('ordersResto.stockSearch')}
                aria-label={t('ordersResto.stockSearch')} style={{ minHeight: 44 }} />
            </div>
          )}
          {groupes.length === 0 && <p className="small" style={{ margin: '10px 0 0' }}>{t('ordersResto.stockSearchNone')}</p>}
          {groupes.map((g) => (
            <section key={g.cle} aria-label={g.titre}>
              <p className="small" style={{ margin: '12px 0 2px', fontWeight: 700, color: 'var(--ink-soft)' }}>{g.titre}</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.plats.map((p) => (
                  <li key={p.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line, #e1d9c4)' }}>
                    <span style={{ opacity: p.outOfStockToday ? 0.6 : 1 }}>
                      <b>{p.name}</b>
                      {p.outOfStockToday && <span className="small" style={{ display: 'block' }}>{t('ordersResto.stockOutTodayLine')}</span>}
                    </span>
                    <button type="button" className={p.outOfStockToday ? 'btn-teal' : 'btn-outline'} style={{ minHeight: 44, padding: '8px 14px', fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => basculer(p)}>
                      {p.outOfStockToday ? t('ordersResto.stockBackBtn') : t('ordersResto.stockOutBtn')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
