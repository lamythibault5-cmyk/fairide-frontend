import { useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { fmtDateTime } from '../adminUtils';

/* LE GO POUR ANNONCER UNE NOUVELLE VERSION (Owen, 14/11/2026 ; backend annoncesVersions.js). Le 14/11 au matin, publier le
 * contrat livreur 2026.12 avait suffi pour que le backend écrive « Ton contrat livreur a changé » à 25 livreurs, sans
 * qu'Owen l'ait choisi. Désormais une nouvelle version n'envoie rien seule : chacun la voit à l'écran qui lui demande de
 * signer à nouveau (NouvellesConditions.jsx). Ce panneau d'Admin › Conformité › Contrats liste les versions en vigueur ;
 * « Annoncer » libère l'e-mail (et la notification des livreurs) pour UNE version, qui part une fois à ceux qui avaient
 * accepté une version antérieure et ne l'ont pas encore reçu (POST /admin/compliance/version-announcements, propriétaire et
 * admins). Un go ne se reprend pas. `annonces` vient de GET /admin/compliance/contracts. */
export default function AnnoncesVersions({ annonces, onDone }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [cible, setCible] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!annonces?.length) return null;

  async function annoncer() {
    setBusy(true);
    try {
      await api('/admin/compliance/version-announcements', { method: 'POST', token, body: { version: cible.version } });
      toast(tr('adminCompliance.toastAnnounced', { version: cible.version }));
      onDone?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); setCible(null); }
  }

  const libelle = (a) => `${tr(`adminCompliance.announceAudience_${a.audience}`)} · ${a.sorte === 'contrat' ? tr('adminCompliance.announceKindContract') : a.type}`;
  return (
    <div className="admin-control-panel" style={{ display: 'block' }}>
      <b>{tr('adminCompliance.announceTitle')}</b>
      <p className="small" style={{ opacity: 0.7, margin: '4px 0 8px' }}>{tr('adminCompliance.announceHint')}</p>
      {annonces.map((a) => (
        <div key={a.version} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><b>{a.version}</b> <span className="small">{libelle(a)} · {tr('adminCompliance.announceSent', { n: a.sent })}</span></span>
          <span style={{ marginLeft: 'auto' }}>
            {a.released
              ? <span className="small">{tr('adminCompliance.announced', { date: fmtDateTime(a.releasedAt) })}</span>
              : <button className="btn-outline" onClick={() => setCible(a)}>{tr('adminCompliance.announceButton')}</button>}
          </span>
        </div>
      ))}
      <ConfirmDialog open={!!cible} title={tr('adminCompliance.announceConfirmTitle', { version: cible?.version || '' })}
        message={tr(cible?.audience === 'restaurants' ? 'adminCompliance.announceConfirmRestaurants' : 'adminCompliance.announceConfirmCouriers')}
        confirmLabel={tr('adminCompliance.announceButton')} loading={busy} onConfirm={annoncer} onCancel={() => setCible(null)} />
    </div>
  );
}
