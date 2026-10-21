import { useEffect, useState } from 'react';
import { remplissage } from '../../curseur';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import Icone from '../Icone';
import ErreurChargement from '../ErreurChargement';

// Mon commerce › Commandes et capacité (fondateur, 2026-10-01) : jusqu'où le commerce livre, et combien de
// commandes il accepte par jour. Le plafond de commandes est « pas de limite » par défaut ; le restaurateur ajuste
// s'il craint de manquer de nourriture. Il repart de zéro chaque jour (PUT /restaurants/:id/order-limits).
// La distance, elle, n'est plus jamais illimitée (fondateur, 2026-10-02) : sans réglage, 6 km (le serveur
// renvoie defaultRadiusKm, voir rayonLivraison.js côté backend) — un commerce qui n'y avait pas touché acceptait
// une livraison jusqu'à Anvers. Le commerce choisit sinon sa propre distance.
const RAYON_DEFAUT = 6;
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
  // Montant minimum de commande (plan de test PAN-3) : vide = aucun minimum.
  const [minimum, setMinimum] = useState('');
  // Temps de préparation habituel (backend migration 041) : sert à l'heure d'arrivée annoncée au client. Coché = les
  // 12 minutes par défaut ; la mesure de Fairide (médiane des 30 derniers jours) aide à régler, sans rien imposer.
  const [prepaDefaut, setPrepaDefaut] = useState(true);
  const [prepa, setPrepa] = useState(15);
  const [enCours, setEnCours] = useState(false);
  // Premier chargement en échec : l'écran restait sur « … » pour toujours, « Enregistrer » grisé (audit du 19/10, shop-320).
  // Il le dit, avec « Réessayer » (ErreurChargement).
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/order-limits`, { token }).then((r) => {
      if (annule) return;
      setErreur(false);
      setEtat(r);
      setRayonLibre(r.deliveryRadiusIsDefault !== false); if (r.deliveryRadiusKm != null) setRayon(r.deliveryRadiusKm);
      setPlafondLibre(r.maxOrdersPerDay === null); if (r.maxOrdersPerDay !== null) setPlafond(r.maxOrdersPerDay);
      setMinimum(r.minOrderAmount ? String(r.minOrderAmount).replace('.', ',') : '');
      setPrepaDefaut(r.prepMinutes == null); setPrepa(r.prepMinutes ?? r.measuredPrepMinutes ?? r.defaultPrepMinutes ?? 15);
    }).catch(() => { if (!annule) setErreur(true); });
    return () => { annule = true; };
  }, [restoId, token, essai]);

  async function enregistrer() {
    const n = Number(plafond);
    if (!plafondLibre && (!Number.isInteger(n) || n < 1)) { toast(t('editResto.capacityCapInvalid'), 'erreur'); return; }
    const min = minimum.trim() === '' ? null : Number(minimum.replace(',', '.'));
    if (min !== null && (!Number.isFinite(min) || min < 1 || min > 100)) { toast(t('editResto.minOrderInvalid'), 'erreur'); return; }
    const p = Number(prepa);
    if (!prepaDefaut && (!Number.isInteger(p) || p < 5 || p > 90)) { toast(t('editResto.prepInvalid'), 'erreur'); return; }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/order-limits`, { method: 'PUT', token, body: { deliveryRadiusKm: rayonLibre ? null : rayon, maxOrdersPerDay: plafondLibre ? null : n, minOrderAmount: min, prepMinutes: prepaDefaut ? null : p } });
      await loadDashboard?.(restoId);
      toast(t('editResto.capacitySaved'), 'succes');
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
      {!etat ? (erreur ? <ErreurChargement onReessayer={() => { setErreur(false); setEssai((n) => n + 1); }} /> : <p className="small">…</p>) : (
        <>
          {restaurant.offersDelivery !== false && (
            <div className="field" role="group" aria-labelledby="capacite-rayon-titre">
              <span className="titre-groupe" id="capacite-rayon-titre"><Icone nom="velo" taille={16} className="icone-texte" />{' '}{t('editResto.capacityRadiusTitle')}</span>
              <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.capacityRadiusHelp')}</p>
              <label className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="checkbox" checked={rayonLibre} onChange={(e) => { setRayonLibre(e.target.checked); if (e.target.checked) setRayon(etat.defaultRadiusKm || RAYON_DEFAUT); }} />
                {t('editResto.capacityRadiusDefault', { km: km(etat.defaultRadiusKm || RAYON_DEFAUT) })}
              </label>
              {!rayonLibre && (
                <>
                  <label htmlFor="capacite-rayon" className="small" style={{ fontWeight: 700, display: 'block' }}>{t('editResto.capacityRadiusValue', { km: km(rayon) })}</label>
                  {/* Jusqu'à la limite du serveur (rayonLivraison.js, 30 km), plus 15 : un rayon de 20 km était impossible à
                      choisir, et un réglage de l'équipe au-delà de 15 laissait le curseur bloqué au bout (audit du 19/10, shop-319). */}
                  <input id="capacite-rayon" type="range" min="1" max={etat.maxRadiusKm || 30} step="0.5" value={rayon}
                    onChange={(e) => setRayon(Number(e.target.value))} style={remplissage(rayon, 1, etat.maxRadiusKm || 30)} aria-valuetext={`${km(rayon)} km`} />
                  <div className="row small" style={{ justifyContent: 'space-between', opacity: 0.7 }}><span>1 km</span><span>{etat.maxRadiusKm || 30} km</span></div>
                </>
              )}
            </div>
          )}

          <div className="field" role="group" aria-labelledby="capacite-prepa-titre">
            <span className="titre-groupe" id="capacite-prepa-titre"><Icone nom="horloge" taille={16} className="icone-texte" />{' '}{t('editResto.prepTitle')}</span>
            <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.prepHelp')}</p>
            <label className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={prepaDefaut} onChange={(e) => setPrepaDefaut(e.target.checked)} />
              {t('editResto.prepDefault', { n: etat.defaultPrepMinutes ?? 12 })}
            </label>
            {!prepaDefaut && (
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                {/* Des libellés que le lecteur d'écran peut dire (audit du 19/10, shop-329) : « − » ne disait rien. */}
                <button type="button" className="btn-ghost" aria-label={t('editResto.prepLess')} style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPrepa((v) => Math.max(5, Number(v) - 5))}>−5</button>
                <input type="number" inputMode="numeric" min="5" max="90" value={prepa} onChange={(e) => setPrepa(e.target.value)} style={{ width: 90, textAlign: 'center' }} aria-label={t('editResto.prepTitle')} />
                <button type="button" className="btn-ghost" aria-label={t('editResto.prepMore')} style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPrepa((v) => Math.min(90, Number(v) + 5))}>+5</button>
                <span className="small">{t('editResto.prepUnit')}</span>
              </div>
            )}
            {etat.measuredPrepMinutes != null && (
              <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>
                {t('editResto.prepMeasured', { n: etat.measuredPrepMinutes, orders: etat.measuredPrepOrders })}{' '}
                {(prepaDefaut || Number(prepa) !== etat.measuredPrepMinutes) && etat.measuredPrepMinutes >= 5 && etat.measuredPrepMinutes <= 90 && (
                  <button type="button" className="lien-bouton" onClick={() => { setPrepaDefaut(false); setPrepa(etat.measuredPrepMinutes); }}>{t('editResto.prepUseMeasured')}</button>
                )}
              </p>
            )}
          </div>

          <div className="field" role="group" aria-labelledby="capacite-plafond-titre">
            <span className="titre-groupe" id="capacite-plafond-titre"><Icone nom="document" taille={16} className="icone-texte" />{' '}{t('editResto.capacityCapTitle')}</span>
            <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.capacityCapHelp')}</p>
            <label className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={plafondLibre} onChange={(e) => setPlafondLibre(e.target.checked)} />
              {t('editResto.capacityNoLimit')}
            </label>
            {!plafondLibre && (
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn-ghost" aria-label={t('editResto.capLess')} style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPlafond((v) => Math.max(1, Number(v) - 5))}>−5</button>
                <input type="number" inputMode="numeric" min="1" max="1000" value={plafond} onChange={(e) => setPlafond(e.target.value)} style={{ width: 90, textAlign: 'center' }} aria-label={t('editResto.capacityCapTitle')} />
                <button type="button" className="btn-ghost" aria-label={t('editResto.capMore')} style={{ minWidth: 44, minHeight: 44 }} onClick={() => setPlafond((v) => Math.min(1000, Number(v) + 5))}>+5</button>
                <span className="small">{t('editResto.capacityPerDay')}</span>
              </div>
            )}
            <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('editResto.capacityToday', { n: etat.ordersToday })}</p>
          </div>

          <div className="field">
            <label htmlFor="capacite-minimum" className="titre-groupe">{t('editResto.minOrderTitle')}</label>
            <p className="small" style={{ margin: '0 0 8px' }}>{t('editResto.minOrderHelp')}</p>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input id="capacite-minimum" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder={t('editResto.minOrderNone')} style={{ width: 120 }} />
              <span className="small">€</span>
            </div>
          </div>

          <p className="small" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-soft)' }}>
            <Icone nom="sac" taille={16} className="icone-texte" />{' '}{t('editResto.capacityStockHint')} <Link to="/dashboard/menu" onClick={onFermer}>{t('editResto.capacityStockLink')}</Link>
          </p>
        </>
      )}
    </SousEcran>
  );
}
