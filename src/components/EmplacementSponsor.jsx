import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ecouterSimulationSponsor, simulationSponsorActive } from '../sponsorSimulation';

// EMPLACEMENT SPONSOR (fondateur, 2026-10-01). Quatre endroits du site réservés au logo d'une société partenaire (future
// collaboration : ce type de partenariat aide Fairide à se développer). Pour l'instant, PERSONNE ne les voit sauf l'équipe :
// un admin connecté voit l'emplacement (en pointillés s'il est vide, avec le logo chargé sinon) ; le public ne voit que les
// emplacements rendus visibles depuis Admin › Collaborations / sponsoring — aucun aujourd'hui.
//
// SIMULATION (2026-10-02) : l'admin peut demander à voir chaque emplacement « comme si » un partenaire y était — le logo
// chargé s'il existe, sinon le visuel de démonstration ci-dessous —, avec le rendu que verrait le public (pas de cadre en
// pointillés). Réglage local à son navigateur (sponsorSimulation.js), jamais envoyé au serveur.
let cachePublic = null; let cacheEquipe = null;
function charger(admin, token) {
  if (admin) { if (!cacheEquipe) cacheEquipe = api('/sponsors/all', { token }).then((r) => r.slots || []).catch(() => []); return cacheEquipe; }
  if (!cachePublic) cachePublic = api('/sponsors').then((r) => r.slots || []).catch(() => []);
  return cachePublic;
}
export function oublierSponsors() { cachePublic = null; cacheEquipe = null; }

// Visuel de démonstration : une marque qui n'existe pas (« Maison Exemple »), dessinée ici pour ne dépendre d'aucun
// fichier. Deux formats, comme les emplacements réels : bannière large, ou carte (suivi de commande).
export function VisuelSponsorDemo({ format = 'banniere' }) {
  const { t } = useLanguage();
  return (
    <div className={`sponsor-demo sponsor-demo--${format}`} role="img" aria-label={t('sponsor.demoAlt')}>
      <svg className="sponsor-demo-logo" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#C8F03C" />
        <path d="M18 44V20l14 14 14-14v24" fill="none" stroke="#14121F" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="sponsor-demo-texte">
        <b>{t('sponsor.demoBrand')}</b>
        <span>{t('sponsor.demoTagline')}</span>
      </div>
      <span className="sponsor-demo-bouton">{t('sponsor.demoCta')}</span>
    </div>
  );
}

export default function EmplacementSponsor({ cle, style }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const admin = !!user?.isAdmin;
  const [slot, setSlot] = useState(null);
  const [simulation, setSimulation] = useState(() => simulationSponsorActive());
  useEffect(() => {
    let annule = false;
    charger(admin, token).then((slots) => { if (!annule) setSlot(slots.find((s) => s.key === cle) || null); });
    return () => { annule = true; };
  }, [cle, admin, token]);
  useEffect(() => ecouterSimulationSponsor(() => setSimulation(simulationSponsorActive())), []);
  if (!admin && !(slot?.visible && slot?.imageUrl)) return null;
  if (!slot) return null;
  const image = slot.imageUrl
    ? <img src={slot.imageUrl} alt={slot.name || t('sponsor.partner')} className="sponsor-image" loading="lazy" decoding="async" />
    : null;

  // Simulation : le rendu public, avec le logo chargé ou le visuel de démonstration.
  if (admin && simulation && !slot.visible) {
    return (
      <aside className="sponsor-emplacement sponsor-emplacement--simulation" style={style} aria-label={t('sponsor.partner')}>
        <span className="sponsor-mention">{t('sponsor.mention')} · {slot.name || t('sponsor.demoBrand')}</span>
        {image || <VisuelSponsorDemo format={cle === 'suivi' ? 'carte' : 'banniere'} />}
        <span className="sponsor-prive-badge">{t('sponsor.simulationBadge')}</span>
      </aside>
    );
  }
  return (
    <aside className={`sponsor-emplacement${admin && !slot.visible ? ' sponsor-emplacement--prive' : ''}${!slot.imageUrl ? ' sponsor-emplacement--vide' : ''}`} style={style} aria-label={t('sponsor.partner')}>
      <span className="sponsor-mention">{t('sponsor.mention')}{slot.name ? ` · ${slot.name}` : ''}</span>
      {image ? (slot.linkUrl ? <a href={slot.linkUrl} target="_blank" rel="noreferrer noopener sponsored">{image}</a> : image)
        : <span className="small sponsor-vide">{t('sponsor.emptyAdmin', { label: slot.label })}</span>}
      {admin && !slot.visible && <span className="sponsor-prive-badge">{t('sponsor.adminOnly')}</span>}
    </aside>
  );
}
