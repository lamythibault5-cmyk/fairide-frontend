import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// EMPLACEMENT SPONSOR (fondateur, 2026-10-01). Quatre endroits du site réservés au logo d'une société partenaire (future
// collaboration : ce type de partenariat aide Fairide à se développer). Pour l'instant, PERSONNE ne les voit sauf l'équipe :
// un admin connecté voit l'emplacement (en pointillés s'il est vide, avec le logo chargé sinon) ; le public ne voit que les
// emplacements rendus visibles depuis Admin › Collaborations / sponsoring — aucun aujourd'hui.
let cachePublic = null; let cacheEquipe = null;
function charger(admin, token) {
  if (admin) { if (!cacheEquipe) cacheEquipe = api('/sponsors/all', { token }).then((r) => r.slots || []).catch(() => []); return cacheEquipe; }
  if (!cachePublic) cachePublic = api('/sponsors').then((r) => r.slots || []).catch(() => []);
  return cachePublic;
}
export function oublierSponsors() { cachePublic = null; cacheEquipe = null; }

export default function EmplacementSponsor({ cle, style }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const admin = !!user?.isAdmin;
  const [slot, setSlot] = useState(null);
  useEffect(() => {
    let annule = false;
    charger(admin, token).then((slots) => { if (!annule) setSlot(slots.find((s) => s.key === cle) || null); });
    return () => { annule = true; };
  }, [cle, admin, token]);
  if (!admin && !(slot?.visible && slot?.imageUrl)) return null;
  if (!slot) return null;
  const image = slot.imageUrl
    ? <img src={slot.imageUrl} alt={slot.name || t('sponsor.partner')} className="sponsor-image" loading="lazy" decoding="async" />
    : null;
  return (
    <aside className={`sponsor-emplacement${admin && !slot.visible ? ' sponsor-emplacement--prive' : ''}${!slot.imageUrl ? ' sponsor-emplacement--vide' : ''}`} style={style} aria-label={t('sponsor.partner')}>
      <span className="sponsor-mention">{t('sponsor.mention')}{slot.name ? ` · ${slot.name}` : ''}</span>
      {image ? (slot.linkUrl ? <a href={slot.linkUrl} target="_blank" rel="noreferrer noopener sponsored">{image}</a> : image)
        : <span className="small sponsor-vide">{t('sponsor.emptyAdmin', { label: slot.label })}</span>}
      {admin && !slot.visible && <span className="sponsor-prive-badge">{t('sponsor.adminOnly')}</span>}
    </aside>
  );
}
