import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../../components/admin/RecordDrawer';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { downloadCsv, fmtDateTime } from '../adminUtils';
import { useApiData, LoadState, KpiCard } from './common';

// Onglet Zones : les 19 communes, leur état (active / suspendue), leur activité sur 30 jours et une fiche
// (tiroir) pour le supplément, le délai annoncé et les notes internes. Suspendre une commune passe par
// une confirmation : côté client, seul le retrait reste proposé tant qu'elle est suspendue.
export default function ZonesTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const zones = useApiData(() => api('/admin/logistics/zones', { token }), []);
  const { sort, toggle } = useTableSort('commune', 'asc');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState(null); // zone à suspendre (confirmation)
  const [busy, setBusy] = useState(null); // commune en cours d'enregistrement
  const [ouverte, setOuverte] = useState(null); // zone affichée dans le tiroir
  const [form, setForm] = useState({ feeExtra: '', etaExtraMinutes: '', notes: '' });

  useEffect(() => {
    if (ouverte) setForm({ feeExtra: String(ouverte.feeExtra ?? 0), etaExtraMinutes: String(ouverte.etaExtraMinutes ?? 0), notes: ouverte.notes || '' });
  }, [ouverte]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (zones.data || []).filter((z) => {
      if (filter === 'active' && !z.active) return false;
      if (filter === 'inactive' && z.active) return false;
      if (!q) return true;
      return z.commune.toLowerCase().includes(q) || (z.postalCodes || []).some((c) => c.includes(q));
    }).map((z) => ({ ...z, id: z.commune }));
  }, [zones.data, search, filter]);

  async function patch(zone, body, okMessage) {
    setBusy(zone.commune);
    try {
      const maj = await api(`/admin/logistics/zones/${encodeURIComponent(zone.commune)}`, { method: 'PATCH', body, token });
      toast(okMessage || tr('adminLogistics.toastZoneUpdated'));
      zones.reload();
      if (ouverte && ouverte.commune === zone.commune) setOuverte((o) => ({ ...o, ...maj }));
      return true;
    } catch (e) {
      toast(e.message || tr('adminCommon.loadError'));
      return false;
    } finally {
      setBusy(null);
    }
  }

  function onToggle(zone) {
    if (zone.active) setPending(zone);
    else patch(zone, { active: true });
  }

  async function enregistrerFiche() {
    const feeExtra = Number(String(form.feeExtra).replace(',', '.'));
    const etaExtraMinutes = Number(form.etaExtraMinutes);
    if (!Number.isFinite(feeExtra) || feeExtra < 0 || feeExtra > 20) { toast(tr('adminLogistics.errFee')); return; }
    if (!Number.isInteger(etaExtraMinutes) || etaExtraMinutes < 0 || etaExtraMinutes > 120) { toast(tr('adminLogistics.errEta')); return; }
    const ok = await patch(ouverte, { feeExtra, etaExtraMinutes, notes: form.notes });
    if (ok) setOuverte(null);
  }

  function exportCsv() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`zones-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.commune'), get: (z) => z.commune },
      { label: tr('adminLogistics.colPostalCodes'), get: (z) => (z.postalCodes || []).join(' ') },
      { label: tr('adminCommon.status'), get: (z) => (z.active ? tr('adminLogistics.zoneActive') : tr('adminLogistics.zoneInactive')) },
      { label: tr('adminCommon.restaurants'), get: (z) => z.restaurants },
      { label: tr('adminLogistics.colOrders30d'), get: (z) => z.ordersLast30d },
      { label: tr('adminLogistics.colAvgMinutes'), get: (z) => z.avgDeliveryMinutes30d ?? '' },
      { label: tr('adminCommon.drivers'), get: (z) => z.driversApproved },
      { label: tr('adminLogistics.colFeeExtra'), get: (z) => z.feeExtra },
      { label: tr('adminLogistics.colEtaExtra'), get: (z) => z.etaExtraMinutes },
      { label: tr('adminCommon.notes'), get: (z) => z.notes || '' }
    ]);
  }

  const columns = [
    { key: 'commune', label: tr('adminCommon.commune'), get: (z) => <b>{z.commune}</b>, sortValue: (z) => z.commune },
    { key: 'postalCodes', label: tr('adminLogistics.colPostalCodes'), get: (z) => <span className="lg-mono">{(z.postalCodes || []).join(', ')}</span>, sortValue: (z) => (z.postalCodes || [])[0] || '' },
    {
      key: 'active', label: tr('adminCommon.status'), sortValue: (z) => (z.active ? 1 : 0),
      get: (z) => (
        <span className="row" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`lg-switch${z.active ? ' on' : ''}`} role="switch" aria-checked={z.active} aria-label={z.commune} disabled={busy === z.commune} onClick={() => onToggle(z)} />
          <span className={`lg-pill ${z.active ? 'online' : 'offline'}`}>{z.active ? tr('adminLogistics.zoneActive') : tr('adminLogistics.zoneInactive')}</span>
        </span>
      )
    },
    { key: 'restaurants', label: tr('adminCommon.restaurants'), align: 'right', get: (z) => z.restaurants, sum: true },
    { key: 'ordersLast30d', label: tr('adminLogistics.colOrders30d'), align: 'right', get: (z) => z.ordersLast30d, sum: true },
    { key: 'avgDeliveryMinutes30d', label: tr('adminLogistics.colAvgMinutes'), align: 'right', get: (z) => (z.avgDeliveryMinutes30d === null ? <span className="lg-muted">—</span> : tr('adminLogistics.minutesShort', { n: z.avgDeliveryMinutes30d })), sortValue: (z) => z.avgDeliveryMinutes30d },
    { key: 'driversApproved', label: tr('adminCommon.drivers'), align: 'right', get: (z) => z.driversApproved, sum: true },
    { key: 'feeExtra', label: tr('adminLogistics.colFeeExtra'), align: 'right', get: (z) => (z.feeExtra ? `+${z.feeExtra.toFixed(2)} €` : <span className="lg-muted">—</span>), sortValue: (z) => z.feeExtra },
    { key: 'etaExtraMinutes', label: tr('adminLogistics.colEtaExtra'), align: 'right', get: (z) => (z.etaExtraMinutes ? `+${z.etaExtraMinutes} min` : <span className="lg-muted">—</span>), sortValue: (z) => z.etaExtraMinutes },
    { key: 'notes', label: tr('adminCommon.notes'), get: (z) => (z.notes ? <span className="small" title={z.notes}>{z.notes.length > 40 ? z.notes.slice(0, 40) + '…' : z.notes}</span> : <span className="lg-muted">—</span>) }
  ];

  return (
    <LoadState state={zones} skeleton={4}>
      {(d) => {
        const actives = d.filter((z) => z.active).length;
        return (
          <>
            <div className="stat-grid">
              <KpiCard value={actives} label={tr('adminLogistics.kpiActiveZones')} highlight />
              <KpiCard value={d.length - actives} label={tr('adminLogistics.kpiInactiveZones')} warn={d.length - actives > 0} />
              <KpiCard value={d.reduce((s, z) => s + z.restaurants, 0)} label={tr('adminLogistics.kpiRestaurants')} />
              <KpiCard value={d.reduce((s, z) => s + z.ordersLast30d, 0)} label={tr('adminLogistics.kpiOrders30d')} />
              <KpiCard value={d.reduce((s, z) => s + z.driversApproved, 0)} label={tr('adminLogistics.kpiDrivers')} />
            </div>
            <div className="lg-toolbar">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('adminLogistics.searchZone')} aria-label={tr('adminLogistics.searchZone')} />
              {[['all', tr('adminLogistics.filterAll')], ['active', tr('adminLogistics.filterActive')], ['inactive', tr('adminLogistics.filterInactive')]].map(([k, label]) => (
                <button key={k} type="button" className={`chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
              ))}
              <span className="spacer" />
              <span className="small admin-result-count">{tr('adminCommon.resultsCount', { n: rows.length })}</span>
              <button type="button" className="btn-ghost" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
            </div>
            <div className="card">
              <AdminDataTable columns={columns} rows={rows} sort={sort} onSort={toggle} onRowClick={setOuverte} rowClassName={(z) => (z.active ? '' : 'lg-row-inactive')} emptyLabel={tr('adminLogistics.emptyZones')} showTotals />
            </div>

            <ConfirmDialog
              open={!!pending}
              title={pending ? tr('adminLogistics.deactivateTitle', { commune: pending.commune }) : ''}
              message={tr('adminLogistics.deactivateMessage')}
              confirmLabel={tr('adminLogistics.deactivateConfirm')}
              danger
              loading={!!busy}
              onCancel={() => setPending(null)}
              onConfirm={async () => { const z = pending; const ok = await patch(z, { active: false }); if (ok) setPending(null); }}
            />

            {ouverte && createPortal(
              <RecordDrawer
                title={ouverte.commune}
                subtitle={tr('adminLogistics.drawerSubtitle', { codes: (ouverte.postalCodes || []).join(', ') })}
                badge={<span className={`lg-pill ${ouverte.active ? 'online' : 'offline'}`}>{ouverte.active ? tr('adminLogistics.zoneActive') : tr('adminLogistics.zoneInactive')}</span>}
                onClose={() => setOuverte(null)}
                width={520}
                footer={(
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="btn-ghost" onClick={() => setOuverte(null)}>{tr('adminCommon.cancel')}</button>
                    <button type="button" className="btn-gold" disabled={busy === ouverte.commune} onClick={enregistrerFiche}>{busy === ouverte.commune ? '…' : tr('adminCommon.save')}</button>
                  </div>
                )}
              >
                <DrawerRow label={tr('adminCommon.restaurants')} value={ouverte.restaurants} />
                <DrawerRow label={tr('adminLogistics.colOrders30d')} value={ouverte.ordersLast30d} />
                <DrawerRow label={tr('adminLogistics.colAvgMinutes')} value={ouverte.avgDeliveryMinutes30d === null ? '—' : tr('adminLogistics.minutesShort', { n: ouverte.avgDeliveryMinutes30d })} />
                <DrawerRow label={tr('adminCommon.drivers')} value={ouverte.driversApproved} />
                <DrawerRow label={tr('adminLogistics.updatedAt')} value={fmtDateTime(ouverte.updatedAt)} />
                <div className="lg-form" style={{ marginTop: 16 }}>
                  <div className="field">
                    <label htmlFor="lg-fee">{tr('adminLogistics.fieldFeeExtra')}</label>
                    <input id="lg-fee" type="number" min="0" max="20" step="0.5" value={form.feeExtra} onChange={(e) => setForm((f) => ({ ...f, feeExtra: e.target.value }))} />
                    <span className="help">{tr('adminLogistics.fieldFeeExtraHelp')}</span>
                  </div>
                  <div className="field">
                    <label htmlFor="lg-eta">{tr('adminLogistics.fieldEtaExtra')}</label>
                    <input id="lg-eta" type="number" min="0" max="120" step="5" value={form.etaExtraMinutes} onChange={(e) => setForm((f) => ({ ...f, etaExtraMinutes: e.target.value }))} />
                    <span className="help">{tr('adminLogistics.fieldEtaExtraHelp')}</span>
                  </div>
                  <div className="field">
                    <label htmlFor="lg-notes">{tr('adminLogistics.fieldNotes')}</label>
                    <textarea id="lg-notes" rows={4} maxLength={2000} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    <span className="help">{tr('adminLogistics.fieldNotesHelp')}</span>
                  </div>
                </div>
              </RecordDrawer>,
              document.body
            )}
          </>
        );
      }}
    </LoadState>
  );
}
