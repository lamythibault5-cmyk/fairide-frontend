import { useEffect, useId, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { SkeletonCards } from '../../../components/Skeleton';
import { ErrorCard } from '../../../components/admin/AdminListTools';

/* Attribution des courses (décision du 23/09/2026 : le livreur vend la livraison et choisit ses courses).
 *
 * 1. Réglages de la livraison — hausse par paliers du prix proposé (payée par Fairide), annulation
 *    automatique faute de livreur (vide = jamais), vendeur de la livraison (« fairide » = repli, seulement
 *    si l'avocat l'impose). Backend : PATCH /admin/compliance/parameters, bornes vérifiées côté serveur.
 * 2. Export mensuel anonymisé « offres reçues / refus / prises » par livreur : la pièce qui montre que les
 *    offres reçues ne baissent pas avec les refus (présomption de salariat, critère « sanction du refus »).
 *    Pas de nom, pas d'identifiant : un rang. Ce tableau n'alimente AUCUNE décision — il sert de preuve. */
const CLES = ['delivery_bump_cents', 'delivery_bump_every_min', 'delivery_bump_cap_cents', 'delivery_no_courier_cancel_min'];

export default function DispatchTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [params, setParams] = useState(null);
  const [saisie, setSaisie] = useState({});
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState(null);
  const chargerParams = () => api('/admin/compliance/parameters', { token }).then((r) => { setParams(r.parameters); setSaisie({}); }).catch((e) => setErreur(e.message));
  useEffect(() => { chargerParams(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setStats(null); api(`/admin/compliance/dispatch-stats?month=${mois}`, { token }).then(setStats).catch((e) => setErreur(e.message)); }, [token, mois]);
  const valeur = (cle) => saisie[cle] ?? params?.find((p) => p.key === cle)?.value ?? '';
  async function enregistrer() {
    const body = {};
    for (const cle of Object.keys(saisie)) body[cle] = cle === 'delivery_no_courier_cancel_min' || cle === 'delivery_seller' ? saisie[cle] : Number(saisie[cle]);
    try { await api('/admin/compliance/parameters', { method: 'PATCH', token, body }); toast(t('conformite.paramsSaved')); chargerParams(); }
    catch (e) { toast(e.message, 'erreur'); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      {erreur && <ErrorCard message={erreur} onRetry={() => { setErreur(null); chargerParams(); }} />}
      <h4 style={{ marginTop: 0 }}>{t('conformite.dispatchParamsTitle')}</h4>
      {!params && !erreur && <SkeletonCards count={1} />}
      {params && (
        <>
          {CLES.map((cle) => (
            <div className="field" key={cle}>
              <label htmlFor={`${id}-${cle}`}>{t(`conformite.param_${cle}`)}</label>
              <input id={`${id}-${cle}`} type="number" min="0" step="1" value={valeur(cle)} onChange={(e) => setSaisie((s) => ({ ...s, [cle]: e.target.value }))} style={{ maxWidth: 160 }} />
            </div>
          ))}
          <div className="field">
            <label htmlFor={`${id}-seller`}>{t('conformite.param_delivery_seller')}</label>
            <select id={`${id}-seller`} value={valeur('delivery_seller') || 'courier'} onChange={(e) => setSaisie((s) => ({ ...s, delivery_seller: e.target.value }))} style={{ maxWidth: 320 }}>
              <option value="courier">{t('conformite.sellerCourier')}</option>
              <option value="fairide">{t('conformite.sellerFairide')}</option>
            </select>
          </div>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('conformite.dispatchParamsHelp')}</p>
          <button type="button" className="btn-teal" disabled={!Object.keys(saisie).length} onClick={enregistrer}>{t('conformite.save')}</button>
        </>
      )}

      <h4 style={{ marginTop: 20 }}>{t('conformite.dispatchStatsTitle')}</h4>
      <p className="small" style={{ marginTop: 0 }}>{t('conformite.dispatchStatsHelp')}</p>
      <div className="field" style={{ maxWidth: 200 }}>
        <label htmlFor={`${id}-mois`}>{t('conformite.dispatchMonth')}</label>
        <input id={`${id}-mois`} type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} />
      </div>
      {!stats && !erreur && <SkeletonCards count={1} />}
      {stats && stats.couriers.length === 0 && <p className="small">{t('conformite.dispatchEmpty')}</p>}
      {stats && stats.couriers.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th>#</th><th>{t('conformite.dispatchOffers')}</th><th>{t('conformite.dispatchRefused')}</th><th>{t('conformite.dispatchAccepted')}</th><th>{t('conformite.dispatchRefusalRate')}</th></tr></thead>
            <tbody>
              {stats.couriers.map((c) => <tr key={c.rank}><td>{c.rank}</td><td>{c.offers}</td><td>{c.refused}</td><td>{c.accepted}</td><td>{c.refusalRate} %</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
