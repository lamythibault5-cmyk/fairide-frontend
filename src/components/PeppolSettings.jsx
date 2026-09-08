import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// Réglages Peppol d'un restaurateur ou d'un livreur, affichés au-dessus de son archive de factures :
// explication de ce qu'est Peppol (et de l'obligation belge), identifiant Peppol (dérivé du numéro
// d'entreprise, modifiable), interrupteur d'envoi, et vérification dans l'annuaire public. Le serveur
// dit aussi si le point d'accès de Fairide est déjà branché ; sinon, on l'écrit noir sur blanc plutôt que
// de laisser croire que les factures partent déjà.
export default function PeppolSettings({ endpoint }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [peppolId, setPeppolId] = useState('');
  const [saving, setSaving] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    api(endpoint, { token }).then((d) => { setData(d); setPeppolId(d.peppolId || ''); }).catch((e) => { toast(e.message); setData({ error: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function enregistrer(changements) {
    setSaving(true);
    try {
      const d = await api(endpoint, { method: 'PATCH', token, body: { peppolId: peppolId.trim(), ...changements } });
      setData(d); setPeppolId(d.peppolId || '');
      toast(t('peppol.toastSaved'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data || data.error) return null;
  const identifiant = data.effectiveId || '';
  const registered = data.registered;

  return (
    <div className="card peppol-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🧾 {t('peppol.title')}</h3>
          <p className="small" style={{ margin: 0 }}>
            {data.providerConfigured
              ? (data.enabled ? t('peppol.stateOn') : t('peppol.stateOff'))
              : t('peppol.stateSoon')}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setOuvert((v) => !v)}>{ouvert ? t('peppol.hide') : t('peppol.details')}</button>
      </div>

      {ouvert && (
        <div style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('peppol.what')}</p>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('peppol.howFairide')}</p>

          <div className="peppol-grid">
            <label className="business-fiche-field span2">
              <span>{t('peppol.idLabel')}</span>
              <input value={peppolId} onChange={(e) => setPeppolId(e.target.value)} placeholder={data.defaultId || '0208:0123456789'} />
            </label>
            <div className="small" style={{ gridColumn: 'span 2' }}>
              {identifiant
                ? <>{t('peppol.idInUse', { id: identifiant })} {registered === true && <span className="pill teal">✅ {t('peppol.registered')}</span>}{registered === false && <span className="pill">⚠️ {t('peppol.notRegistered')}</span>}</>
                : <>⚠️ {t('peppol.noId')}</>}
            </div>
            {registered === false && <p className="small" style={{ gridColumn: 'span 2', margin: 0 }}>{t('peppol.notRegisteredHelp')}</p>}
          </div>

          <label className="service-option" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={!!data.enabled} disabled={saving} onChange={(e) => enregistrer({ enabled: e.target.checked })} />
            <span>{t('peppol.enable')}</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" disabled={saving} onClick={() => enregistrer({})}>{saving ? '…' : t('peppol.save')}</button>
          </div>
          <p className="small" style={{ margin: '10px 0 0', opacity: 0.8 }}>{t('peppol.ublHint')}</p>
        </div>
      )}
    </div>
  );
}
