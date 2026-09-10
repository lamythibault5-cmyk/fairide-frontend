import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';
import FloorPlan, { AREA_ICONS, areaLabel } from '../../components/FloorPlan';
import ReservationsAgenda from '../../components/reservations/ReservationsAgenda';
import ReservationSettings from '../../components/reservations/ReservationSettings';
import ReservationIntegration from '../../components/reservations/ReservationIntegration';
import GiftVouchers from '../../components/reservations/GiftVouchers';
import ReservationStats from '../../components/reservations/ReservationStats';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import '../../reservations.css';

// Réservations : tout ce que le restaurateur fait avec ses tables, en un seul endroit.
//
// AGENDA : le cahier de réservation (qui vient, quand, où — confirmer, installer, terminer, écrire au
// client, annoter, fiche client, recherche, impression). RÉGLAGES : ce que le client peut réserver en
// ligne (horaires, capacité, préavis, acompte, notifications, blocages). PLAN DE SALLE : les tables.
// INTÉGRATION : le lien public, le QR, les extraits pour Google / Instagram / Facebook / site.
// BONS CADEAUX : création, impression, utilisation. STATISTIQUES : ce que la salle a fait.
//
// Une réservation reste une commande `dine_in` côté serveur (voir routes/orders.js) : les actions de
// statut passent par /orders/:id/…, la lecture et les modifications de champ par
// /restaurants/:id/reservations.

const ONGLETS = [
  { cle: 'agenda', label: 'tabAgenda' },
  { cle: 'reglages', label: 'tabSettings' },
  { cle: 'salle', label: 'tabFloor' },
  { cle: 'integration', label: 'tabIntegration' },
  { cle: 'bons', label: 'tabVouchers' },
  { cle: 'stats', label: 'tabStats' }
];

export default function ReservationsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId, loadDashboard } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const onglet = ONGLETS.some((o) => o.cle === searchParams.get('onglet')) ? searchParams.get('onglet') : 'agenda';

  // Les tables servent à plusieurs onglets (agenda, plan de salle, réglages d'acompte) : chargées ici.
  const [tables, setTables] = useState(null);
  const [erreurTables, setErreurTables] = useState('');
  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/tables`, { token }).then(setTables).catch((e) => { setTables([]); setErreurTables(e.message); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  const commun = { token, toast, restaurant, restoId, loadDashboard, tables, setTables };

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('resa.title')}</h2>

      <div className="resa-onglets" role="tablist" aria-label={t('resa.ariaSections')}>
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`resa-onglet${onglet === o.cle ? ' actif' : ''}`}
            onClick={() => setSearchParams(o.cle === 'agenda' ? {} : { onglet: o.cle })}>
            {t(`resa.${o.label}`)}
          </button>
        ))}
      </div>

      {!restaurant?.offersDineIn && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          <p className="small" style={{ margin: 0 }}>
            {t('resa.disabledIntro')}
            <b> {t('resa.disabledPath')}</b>.
          </p>
        </div>
      )}
      {erreurTables && <div className="card"><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{t('resa.tablesLoadError', { error: erreurTables })}</p></div>}

      {onglet === 'agenda' && <ReservationsAgenda {...commun} />}
      {onglet === 'reglages' && <ReservationSettings {...commun} />}
      {onglet === 'salle' && <PlanDeSalle {...commun} />}
      {onglet === 'integration' && <ReservationIntegration restoId={restoId} restaurant={restaurant} toast={toast} />}
      {onglet === 'bons' && <GiftVouchers restoId={restoId} token={token} toast={toast} restaurant={restaurant} />}
      {onglet === 'stats' && <ReservationStats token={token} restoId={restoId} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// PLAN DE SALLE — le plan interactif (FloorPlan : dessin, occupation), puis la liste compacte des
// tables pour corriger vite un numéro, un nom, des places ou un acompte sans ouvrir chaque fiche.
// ------------------------------------------------------------------------------------------------
function PlanDeSalle({ token, toast, restaurant, restoId, tables, setTables }) {
  const { t } = useLanguage();
  const [enCours, setEnCours] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const acompteActif = !!restaurant?.reservationDepositEnabled;

  async function modifier(id, champs) {
    setEnCours(id);
    try {
      const maj = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'PATCH', token, body: champs });
      setTables((l) => l.map((x) => (x.id === id ? maj : x)));
    } catch (err) {
      toast(err.message);
      // Valeur refusée (numéro déjà pris…) : on remet ce que le serveur connaît.
      api(`/restaurants/${restoId}/tables`, { token }).then(setTables).catch(() => {});
    } finally { setEnCours(null); }
  }
  async function supprimer(id) {
    setEnCours(id);
    try {
      const r = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'DELETE', token });
      if (r.desactivee) {
        setTables((l) => l.map((x) => (x.id === id ? r.table : x)));
        toast(t('resa.toastTableDisabled'));
      } else {
        setTables((l) => l.filter((x) => x.id !== id));
        toast(t('resa.toastTableDeleted'));
      }
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }
  const local = (id, champs) => setTables((l) => l.map((x) => (x.id === id ? { ...x, ...champs } : x)));

  const actives = (tables || []).filter((tb) => tb.active);
  const totalPlaces = actives.reduce((a, tb) => a + Number(tb.seats || 0), 0);
  const plusGrande = actives.reduce((m, tb) => Math.max(m, Number(tb.seats || 0)), 0);
  const triees = (tables || []).slice().sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999) || a.sortOrder - b.sortOrder);
  const terrasse = actives.filter((tb) => tb.area === 'outside').length;

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.yourTables')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t('resa.planIntro')}</p>
        <FloorPlan restoId={restoId} token={token} toast={toast} tables={tables} setTables={setTables} restaurant={restaurant} />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.tablesList')}</h3>
        {tables === null && <p className="small">{t('resa.loading')}</p>}
        {tables !== null && tables.length === 0 && (
          <p className="small" style={{ margin: 0, padding: '9px 11px', background: 'var(--cream-dim)', borderRadius: 9 }}>
            {t('resa.noTablesWarn1')} <b>{t('resa.noTablesWarn2')}</b>.
          </p>
        )}
        {tables !== null && tables.length > 0 && (
          <>
            <div className="service-table-wrap">
              <table className="service-table plan-table">
                <thead>
                  <tr>
                    <th className="col-actif">{t('resa.colNumber')}</th>
                    <th>{t('resa.table')}</th>
                    <th>{t('resa.zone')}</th>
                    <th className="col-actif">{t('resa.seats')}</th>
                    {acompteActif && <th className="col-actif">{t('resa.deposit')}</th>}
                    <th className="col-actif">{t('resa.open')}</th>
                    <th className="col-actif"> </th>
                  </tr>
                </thead>
                <tbody>
                  {triees.map((tb) => (
                    <tr key={tb.id} className={tb.active ? '' : 'service-off'}>
                      <td className="col-actif">
                        <input type="number" min="1" max="999" value={tb.number ?? ''} disabled={enCours === tb.id} aria-label={t('resa.colNumber')}
                          style={{ width: 58, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                          onChange={(e) => local(tb.id, { number: e.target.value === '' ? null : Number(e.target.value) })}
                          onBlur={(e) => modifier(tb.id, { number: e.target.value === '' ? null : Number(e.target.value) })} />
                      </td>
                      <td>
                        <input value={tb.name} disabled={enCours === tb.id} style={{ padding: '5px 8px', fontSize: 13 }} aria-label={t('resa.tableName')}
                          onChange={(e) => local(tb.id, { name: e.target.value })}
                          onBlur={(e) => e.target.value.trim() !== '' && modifier(tb.id, { name: e.target.value.trim() })} />
                      </td>
                      <td>
                        <span className="pill" title={tb.zone || undefined}>{AREA_ICONS[tb.area]} {areaLabel(t, tb.area)}</span>
                        {tb.joinable && <span className="small" title={t('resa.joinableTitle')}> 🔗</span>}
                      </td>
                      <td className="col-actif">
                        <input type="number" min="1" max="30" value={tb.seats} disabled={enCours === tb.id} aria-label={t('resa.seats')} style={{ width: 62, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                          onChange={(e) => local(tb.id, { seats: e.target.value })}
                          onBlur={(e) => Number(e.target.value) >= 1 && modifier(tb.id, { seats: Number(e.target.value) })} />
                      </td>
                      {acompteActif && (
                        <td className="col-actif">
                          <input type="number" min="0" max="500" step="0.5" value={tb.depositAmount ?? ''} placeholder={t('resa.phRule')} disabled={enCours === tb.id}
                            title={t('resa.titleDepositCell')} aria-label={t('resa.deposit')}
                            style={{ width: 72, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                            onChange={(e) => local(tb.id, { depositAmount: e.target.value === '' ? null : e.target.value })}
                            onBlur={(e) => modifier(tb.id, { depositAmount: e.target.value === '' ? null : Number(e.target.value) })} />
                        </td>
                      )}
                      <td className="col-actif">
                        <label className="service-toggle">
                          <input type="checkbox" checked={tb.active} disabled={enCours === tb.id} onChange={(e) => modifier(tb.id, { active: e.target.checked })} />
                          <span className="sr-only">{t('resa.tableOpenSr', { name: tb.name })}</span>
                        </label>
                      </td>
                      <td className="col-actif">
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} disabled={enCours === tb.id} onClick={() => setASupprimer(tb)} aria-label={t('resa.deleteTableSr', { name: tb.name })}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small" style={{ margin: '10px 0 0' }}>
              {t('resa.tablesSummary', { n: actives.length, seats: totalPlaces, max: plusGrande || 0 })}
              {terrasse > 0 && ` · ${t('resa.outsideCount', { n: terrasse })}`}
            </p>
          </>
        )}
      </div>
      <ConfirmDialog open={!!aSupprimer} danger title={t('resa.deleteTableTitle')} message={aSupprimer ? t('resa.deleteTableMsg', { name: aSupprimer.name }) : ''}
        confirmLabel={t('resa.deleteTableBtn')} loading={!!enCours} onCancel={() => setASupprimer(null)} onConfirm={() => { const id = aSupprimer.id; setASupprimer(null); supprimer(id); }} />
    </>
  );
}
