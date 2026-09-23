import { useEffect, useId, useState } from 'react';
import { api, apiDownload } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

/* Le livreur vend la livraison (décision du 23/09/2026) : ce qui va avec, dans son espace.
 *
 * TarifMinimum (B23bis/G3) — un prix en dessous duquel une course ne lui est pas montrée. Il le fixe et
 * le change quand il veut, sans validation de Fairide (PATCH /couriers/me, minFeeCents ; vide = aucun
 * minimum). Saisi en euros, envoyé en centimes : le serveur compare des centimes.
 *
 * DocumentsVente (G2) — un document par livraison, émis par Fairide en son nom au titre du mandat
 * d'autofacturation, numéroté dans une série qui lui est propre. Enregistré via apiDownload (jeton,
 * 401 centralisé) plutôt qu'ouvert dans un onglet : window.open après un await est bloqué par Safari. */
export function TarifMinimum({ courier, token, action, busy }) {
  const { t } = useLanguage();
  const id = useId();
  const [valeur, setValeur] = useState(courier?.minFeeCents != null ? (courier.minFeeCents / 100).toFixed(2) : '');
  const enregistrer = () => {
    const brut = String(valeur).replace(',', '.').trim();
    return action(() => api('/couriers/me', { method: 'PATCH', token, body: { minFeeCents: brut === '' ? null : Math.round(Number(brut) * 100) } }), t('conformite.minFeeSaved'));
  };
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('conformite.minFeeTitle')}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('conformite.minFeeHelp')}</p>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, flex: '0 1 160px' }}>
          <label htmlFor={`${id}-min`}>{t('conformite.minFeeLabel')}</label>
          <input id={`${id}-min`} type="number" min="0" max="100" step="0.10" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} />
        </div>
        <button type="button" className="btn-outline" disabled={busy || (valeur !== '' && !(Number(String(valeur).replace(',', '.')) >= 0))} onClick={enregistrer}>{t('courierOnboarding.save')}</button>
      </div>
    </div>
  );
}

export function DocumentsVente({ token }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [liste, setListe] = useState(null);
  useEffect(() => { api('/couriers/me/sale-documents', { token }).then(setListe).catch(() => setListe([])); }, [token]);
  async function ouvrir(d) {
    try { await apiDownload(`/couriers/me/sale-documents/${d.id}.pdf`, { token, filename: `${d.number}.pdf` }); }
    catch (e) { toast(e.message, 'erreur'); }
  }
  if (!liste) return null;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('conformite.saleDocsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('conformite.saleDocsHelp')}</p>
      {liste.length === 0 && <p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>{t('conformite.saleDocsEmpty')}</p>}
      {liste.map((d) => (
        <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="small"><b>{d.number}</b> · {new Date(d.issuedAt).toLocaleDateString(getLocale())} · {(d.deliveryAmount + d.tipAmount).toFixed(2)} €</span>
          <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={() => ouvrir(d)}>{t('conformite.saleDocsOpen')}</button>
        </div>
      ))}
    </div>
  );
}
