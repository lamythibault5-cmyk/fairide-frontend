import { useEffect, useState } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { useApiData, LoadState } from './common';

const CHAMPS = [
  { key: 'autoAssignRadiusKm', min: 0.5, max: 50, step: 0.5, unit: 'km' },
  { key: 'maxSimultaneousOrders', min: 1, max: 10, step: 1, entier: true },
  { key: 'acceptTimeoutSeconds', min: 15, max: 600, step: 5, entier: true, unit: 's' }
];

// Onglet Réglages : les quatre paramètres de dispatch (rayon d'attribution, commandes simultanées, délai
// d'acceptation, contrôle des zones), enregistrés dans platform_settings et journalisés côté serveur.
// Enregistrement derrière une confirmation, comme la tarification.
export default function SettingsTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const settings = useApiData(() => api('/admin/logistics/settings', { token }), []);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setForm({ ...settings.data });
  }, [settings.data]);

  const libelles = {
    autoAssignRadiusKm: [tr('adminLogistics.setRadius'), tr('adminLogistics.setRadiusHelp')],
    maxSimultaneousOrders: [tr('adminLogistics.setMaxOrders'), tr('adminLogistics.setMaxOrdersHelp')],
    acceptTimeoutSeconds: [tr('adminLogistics.setTimeout'), tr('adminLogistics.setTimeoutHelp')]
  };

  function changements() {
    if (!form || !settings.data) return {};
    const out = {};
    for (const c of CHAMPS) {
      const v = Number(String(form[c.key]).replace(',', '.'));
      if (Number.isFinite(v) && v !== settings.data[c.key]) out[c.key] = v;
    }
    if (form.zoneCheckEnabled !== settings.data.zoneCheckEnabled) out.zoneCheckEnabled = !!form.zoneCheckEnabled;
    return out;
  }

  function valider() {
    for (const c of CHAMPS) {
      const v = Number(String(form[c.key]).replace(',', '.'));
      if (!Number.isFinite(v) || v < c.min || v > c.max || (c.entier && !Number.isInteger(v))) {
        toast(tr('adminLogistics.errRange', { field: libelles[c.key][0], min: c.min, max: c.max }));
        return false;
      }
    }
    return true;
  }

  function demanderConfirmation() {
    if (!Object.keys(changements()).length) { toast(tr('adminLogistics.unchanged')); return; }
    if (!valider()) return;
    setConfirm(true);
  }

  async function enregistrer() {
    setSaving(true);
    try {
      await api('/admin/logistics/settings', { method: 'PATCH', body: changements(), token });
      toast(tr('adminLogistics.toastSettingsSaved'));
      setConfirm(false);
      settings.reload();
    } catch (e) {
      toast(e.message || tr('adminCommon.loadError'));
    } finally {
      setSaving(false);
    }
  }

  const nb = Object.keys(changements()).length;

  return (
    <LoadState state={settings} skeleton={2}>
      {(d) => (form && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{tr('adminLogistics.settingsTitle')}</h3>
            <p className="small lg-muted" style={{ margin: '0 0 14px' }}>{tr('adminLogistics.settingsNote')}</p>
            <div className="lg-form lg-form-grid">
              {CHAMPS.map((c) => (
                <div className="field" key={c.key}>
                  <label htmlFor={`lg-set-${c.key}`}>{libelles[c.key][0]}</label>
                  <input id={`lg-set-${c.key}`} type="number" min={c.min} max={c.max} step={c.step} value={form[c.key]} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} />
                  <span className="help">{libelles[c.key][1]} {tr('adminLogistics.rangeHint', { min: c.min, max: c.max })}</span>
                </div>
              ))}
            </div>
            <div className="lg-setting-row" style={{ marginTop: 6 }}>
              <div>
                <label htmlFor="lg-set-zone" style={{ marginBottom: 2 }}>{tr('adminLogistics.setZoneCheck')}</label>
                <span className="small lg-muted">{tr('adminLogistics.setZoneCheckHelp')}</span>
              </div>
              <span className="row" style={{ gap: 8 }}>
                <button id="lg-set-zone" type="button" className={`lg-switch${form.zoneCheckEnabled ? ' on' : ''}`} role="switch" aria-checked={!!form.zoneCheckEnabled} onClick={() => setForm((f) => ({ ...f, zoneCheckEnabled: !f.zoneCheckEnabled }))} />
                <span className={`lg-pill ${form.zoneCheckEnabled ? 'online' : 'offline'}`}>{form.zoneCheckEnabled ? tr('adminLogistics.checkOn') : tr('adminLogistics.checkOff')}</span>
              </span>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn-ghost" disabled={!nb} onClick={() => setForm({ ...d })}>{tr('adminLogistics.reset')}</button>
            <button type="button" className="btn-gold" disabled={!nb || saving} onClick={demanderConfirmation}>{tr('adminCommon.save')}{nb ? ` (${nb})` : ''}</button>
          </div>
          <ConfirmDialog
            open={confirm}
            title={tr('adminLogistics.confirmSaveTitle')}
            message={tr('adminLogistics.confirmSaveMessage')}
            confirmLabel={tr('adminCommon.save')}
            loading={saving}
            onCancel={() => setConfirm(false)}
            onConfirm={enregistrer}
          />
        </>
      ))}
    </LoadState>
  );
}
