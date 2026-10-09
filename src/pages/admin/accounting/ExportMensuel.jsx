import { useId, useState } from 'react';
import { api, apiDownload } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';

/* Export comptable mensuel (CODE-8, DEC-24 ; serveur : comptaMensuelle.js). Une ligne par jour : ventes de Fairide et leur
 * TVA, fonds de tiers (commerces, livreurs, pourboires), frais Stripe, remboursements, remises. Le CSV s'importe dans le
 * logiciel comptable ; le mois clos part aussi tout seul, une fois, à l'adresse d'archive (hors de Railway). */
export default function ExportMensuel({ token, toast }) {
  const { t } = useLanguage();
  const id = useId();
  const precedent = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [mois, setMois] = useState(precedent);
  const [envoi, setEnvoi] = useState(false);
  async function telecharger() {
    try { await apiDownload(`/admin/accounting/monthly-export?month=${mois}&format=csv`, { token, filename: `fairide-compta-${mois}.csv` }); } catch (e) { toast(e.message, 'erreur'); }
  }
  async function archiver() {
    setEnvoi(true);
    try {
      const r = await api('/admin/accounting/monthly-export/archive', { method: 'POST', token });
      toast(r.sent ? t('exportMensuel.archived', { month: r.mois }) : t('exportMensuel.alreadyArchived'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('exportMensuel.title')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('exportMensuel.help')}</p>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${id}-mois`}>{t('exportMensuel.month')}</label>
          <input id={`${id}-mois`} type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </div>
        <button type="button" className="btn-teal" onClick={telecharger} disabled={!mois}>{t('exportMensuel.download')}</button>
        <button type="button" className="btn-outline" onClick={archiver} disabled={envoi}>{t('exportMensuel.archiveNow')}</button>
      </div>
    </div>
  );
}
