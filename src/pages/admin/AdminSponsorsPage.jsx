import { useCallback, useEffect, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Link } from 'react-router-dom';
import { oublierSponsors, VisuelSponsorDemo } from '../../components/EmplacementSponsor';
import { reglerSimulationSponsor, simulationSponsorActive } from '../../sponsorSimulation';

// Admin › Collaborations / sponsoring (fondateur, 2026-10-01 ; version sobre du 2026-10-06) : un petit logo partenaire par
// rangée de la liste des commerces, à côté du titre. Rien n'est visible du public tant que « Visible du public » n'est pas
// coché pour la rangée ; l'équipe, elle, voit chaque logo en place sur la liste (EmplacementSponsor.jsx) et peut simuler le
// rendu public (interrupteur ci-dessous, puis « Voir côté client »).
export default function AdminSponsorsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [slots, setSlots] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  const [brouillons, setBrouillons] = useState({});
  const [simulation, setSimulation] = useState(() => simulationSponsorActive());
  const basculerSimulation = (active) => { reglerSimulationSponsor(active); setSimulation(active); };

  const charger = useCallback(() => {
    api('/admin/sponsors', { token }).then((r) => { setSlots(r.slots || []); oublierSponsors(); }).catch((e) => toast(e.message, 'erreur'));
  }, [token, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function envoyer(slot, fichier) {
    if (!fichier) return;
    setOccupe(slot.key);
    try {
      await apiUpload(`/admin/sponsors/${slot.key}`, { file: fichier, token, fieldName: 'image' });
      toast(tr('sponsors.uploaded', { label: slot.label }));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function regler(slot, champs) {
    setOccupe(slot.key);
    try {
      await api(`/admin/sponsors/${slot.key}`, { method: 'PATCH', token, body: champs });
      toast(tr('sponsors.saved'));
      setBrouillons((b) => ({ ...b, [slot.key]: undefined }));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function retirer() {
    const slot = aRetirer; setARetirer(null); setOccupe(slot.key);
    try { await api(`/admin/sponsors/${slot.key}`, { method: 'DELETE', token }); toast(tr('sponsors.removed')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  const quand = (d) => new Date(d).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <AdminPageHeader module="sponsors" />
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 780 }}>{tr('sponsors.intro')}</p>
      <div className="card sponsor-simulation" style={{ margin: '0 0 16px' }}>
        <label className="row" style={{ gap: 10, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={simulation} onChange={(e) => basculerSimulation(e.target.checked)} />
          <b>{tr('sponsors.simTitle')}</b>
        </label>
        <p className="small" style={{ margin: '6px 0 0' }}>{tr('sponsors.simHelp')}</p>
        {simulation && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Link className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} to="/restaurants">{tr('sponsors.simSeeClient')}</Link>
          </div>
        )}
      </div>
      {!slots && <p className="small">…</p>}
      <div className="sponsors-grille">
        {(slots || []).map((s) => {
          const b = brouillons[s.key] || { name: s.name, linkUrl: s.linkUrl };
          return (
            <div key={s.key} className="card sponsor-carte" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{s.section ? tr('sponsors.rowTitle', { section: s.section }) : s.label}</h3>
                  <p className="small" style={{ margin: '2px 0 0', color: 'var(--ink-faint)' }}>{tr('sponsors.format', { format: s.format })}</p>
                </div>
                <span className={`pill ${s.visible ? 'teal' : ''}`}>{s.visible ? tr('sponsors.public') : tr('sponsors.adminOnly')}</span>
              </div>
              <div className="sponsor-apercu">
                {s.imageUrl ? <img src={s.imageUrl} alt={s.name || s.label} />
                  : simulation ? <VisuelSponsorDemo />
                    : <span className="small">{tr('sponsors.empty')}</span>}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn-teal" style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
                  {occupe === s.key ? '…' : s.imageUrl ? tr('sponsors.replace') : tr('sponsors.upload')}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden disabled={occupe === s.key} onChange={(e) => { envoyer(s, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {s.imageUrl && <button type="button" className="btn-danger-ghost" style={{ padding: '8px 12px', fontSize: 13 }} disabled={occupe === s.key} onClick={() => setARetirer(s)}>{tr('sponsors.remove')}</button>}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input style={{ flex: '1 1 160px' }} placeholder={tr('sponsors.namePh')} value={b.name || ''} onChange={(e) => setBrouillons((x) => ({ ...x, [s.key]: { ...b, name: e.target.value } }))} aria-label={tr('sponsors.namePh')} />
                <input style={{ flex: '2 1 220px' }} placeholder="https://" inputMode="url" value={b.linkUrl || ''} onChange={(e) => setBrouillons((x) => ({ ...x, [s.key]: { ...b, linkUrl: e.target.value } }))} aria-label={tr('sponsors.linkPh')} />
                <button type="button" className="btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} disabled={occupe === s.key || !brouillons[s.key]} onClick={() => regler(s, { name: b.name || '', linkUrl: b.linkUrl || '' })}>{tr('sponsors.saveDetails')}</button>
              </div>
              <label className="row small" style={{ gap: 8, alignItems: 'center', marginTop: 10, cursor: s.imageUrl ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={s.visible} disabled={!s.imageUrl || occupe === s.key} onChange={(e) => regler(s, { visible: e.target.checked })} />
                {tr('sponsors.visibleToggle')}
              </label>
              {s.updatedAt && <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-faint)' }}>{tr('sponsors.updatedAt', { date: quand(s.updatedAt) })}</p>}
            </div>
          );
        })}
      </div>
      <ConfirmDialog open={!!aRetirer} title={tr('sponsors.remove')} message={tr('sponsors.removeConfirm', { label: aRetirer?.label || '' })} confirmLabel={tr('sponsors.remove')} danger onConfirm={retirer} onCancel={() => setARetirer(null)} />
    </div>
  );
}
