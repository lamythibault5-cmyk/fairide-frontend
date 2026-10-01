import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';

// Mon commerce › Commandes et capacité (fondateur, 2026-10-01) : jusqu'où le commerce livre, et combien de
// commandes il accepte par jour. Les deux sont « pas de limite » par défaut ; le restaurateur ajuste s'il craint
// de manquer de nourriture. Le plafond repart de zéro chaque jour (PUT /restaurants/:id/order-limits).
const RAYON_DEFAUT = 5;
const PLAFOND_DEFAUT = 30;

export default function EcranCapacite({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [rayonLibre, setRayonLibre] = useState(true);
  const [rayon, setRayon] = useState(RAYON_DEFAUT);
  const [plafondLibre, setPlafondLibre] = useState(true);
  const [plafond, setPlafond] = useState(PLAFOND_DEFAUT);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/order-limits`, { token }).then((r) => {
      if (annule) return;
      setEtat(r);
      setRayonLibre(r.deliveryRadiusKm === null); if (r.deliveryRadiusKm !== null) setRayon(r.deliveryRadiusKm);
      setPlafondLibre(r.maxOrdersPerDay === null); if (r.maxOrdersPerDay !== null) setPlafond(r.maxOrdersPerDay);
    }).catch((e) => toast(e.message, 'erreur'));
    return () => { annule = true; };
  }, [restoId, token, toast]);

  async function enregistrer() {
    const n = Number(plafond);
    if (!plafondLibre && (!Number.isInteger(n) || n < 1)) { toast(t('editResto.capacityCapInvalid'), 'erreur'); return; }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/order-limits`, { method: 'PUT', token, body: { deliveryRadiusKm: rayonLibre ? null : rayon, maxOrdersPerDay: plafondLibre ? null : n } });
      await loadDashboard?.(restoId);
      toast(t('editResto.capacitySaved'));
      onFermer();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  const pied = (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours || !etat} onClick={enregistrer}>
      {enCours ? '…' : t('editResto.cuisinesSave')}
    </button>
  );
  const km = (v) => String(v).replace('.', ',');

  return (
    <SousEcran titre={t('editResto.rowCapacity')} onFermer={onFermer} pied={pied}>
      {!etat ? <p className="small">…</p> : (
        <>
          {restaurant.offersDelivery !== false && (
            <div className="field" role="group" aria-labelledby="capacite-rayon-titre">
              <span className="titre-groupe" id="capacite-rayon-titre">🛵 {t('editResto.capacityRadiusTitle')}</span>
              <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.capacityRadiusHelp')}</p>
              <label className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="checkbox" checked={rayonLibre} onChange={(e) => setRayonLibre(e.target.checked)} />
                {t('editResto.capacityNoLimit')}
              </label>
              {!rayonLibre && (
                <>
                  <label htmlFor="capacite-rayon" className="small" style={{ fontWeight: 700, display: 'block' }}>{t('editResto.capacityRadiusValue', { km: km(rayon) })}</label>
                  <input id="capacite-rayon" type="range" min="1" max={Math.min(etat.maxRadiusKm || 30, 15)} step="0.5" value={rayon}
                    onChange={(e) => setRayon(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--teal, #1F8A70)' }} aria-valuetext={`${km(rayon)} km`} />
                  <div className="row small" style={{ justifyContent: 'space-between', opacity: 0.7 }}><span>1 km</span><span>15 km</span></div>
                </>
              )}
            </div>
          )}

          <div className="field" role="group" aria-labelledby="capacite-plafond-titre">
            <span className="titre-groupe" id="capacite-plafond-titre">🧾 {t('editResto.capacityCapTitle')}</span>
            <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.capacityCapHelp')}</p>
            <label className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={plafondLibre} onChange={(e) => setPlafondLibre(e.target.checked)} />
              {t('editResto.capacityNoLimit')}
            </label>
            {!plafondLibre && (
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn-ghost" aria-label="−" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPlafond((v) => Math.max(1, Number(v) - 5))}>−5</button>
                <input type="number" inputMode="numeric" min="1" max="1000" value={plafond} onChange={(e) => setPlafond(e.target.value)} style={{ width: 90, textAlign: 'center' }} aria-label={t('editResto.capacityCapTitle')} />
                <button type="button" className="btn-ghost" aria-label="+" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPlafond((v) => Math.min(1000, Number(v) + 5))}>+5</button>
                <span className="small">{t('editResto.capacityPerDay')}</span>
              </div>
            )}
            <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('editResto.capacityToday', { n: etat.ordersToday })}</p>
          </div>

          <p className="small" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--cream-dim)' }}>
            🥡 {t('editResto.capacityStockHint')} <Link to="/dashboard/menu" onClick={onFermer}>{t('editResto.capacityStockLink')}</Link>
          </p>
        </>
      )}
    </SousEcran>
  );
}
