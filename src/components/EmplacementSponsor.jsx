import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import urlSure from '../urlSure';
import { ecouterSimulationSponsor, modeEmplacement, simulationSponsorActive } from '../sponsorSimulation';

// LOGO PARTENAIRE D'UNE RANGÉE (fondateur, 2026-10-01 ; version sobre du 2026-10-06). Un petit logo à côté du titre d'une
// rangée de la liste des commerces (« Autour de vous », « Healthy », « Bio »…) : un partenaire par rangée, réglé dans
// Admin › Collaborations / sponsoring. Pour l'instant, PERSONNE ne le voit sauf l'équipe : un admin connecté voit la place
// (pastille en pointillés si vide, le logo chargé sinon) ; le public ne voit que les rangées activées par l'admin — aucune
// aujourd'hui. Les anciennes bannières (accueil, suivi, tableau de bord) n'existent plus.
//
// SIMULATION (2026-10-02) : l'admin peut voir chaque rangée « comme si » un partenaire y était — le logo chargé s'il
// existe, sinon la marque de démonstration ci-dessous —, avec le rendu que verrait le public. Réglage local à son navigateur
// (sponsorSimulation.js), jamais envoyé au serveur. Qui voit quoi : une seule règle, `modeEmplacement`.
let cachePublic = null; let cacheEquipe = null;
function charger(admin, token) {
  // Un échec n'est pas gardé en mémoire : sinon une coupure réseau au premier affichage cachait les logos jusqu'au
  // rechargement complet de la page.
  if (admin) {
    if (!cacheEquipe) cacheEquipe = api('/sponsors/all', { token }).then((r) => r.slots || []).catch(() => { cacheEquipe = null; return []; });
    return cacheEquipe;
  }
  if (!cachePublic) cachePublic = api('/sponsors').then((r) => r.slots || []).catch(() => { cachePublic = null; return []; });
  return cachePublic;
}
export function oublierSponsors() { cachePublic = null; cacheEquipe = null; }

// Marque de démonstration : une enseigne qui n'existe pas (« Maison Exemple »), dessinée ici pour ne dépendre d'aucun fichier.
export function VisuelSponsorDemo() {
  const { t } = useLanguage();
  return (
    <span className="sponsor-demo-mini" role="img" aria-label={t('sponsor.demoAlt')}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#C8F03C" />
        <path d="M18 44V20l14 14 14-14v24" fill="none" stroke="#14121F" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <b>{t('sponsor.demoBrand')}</b>
    </span>
  );
}

export default function EmplacementSponsor({ cle, style }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const admin = !!user?.isAdmin;
  const [slot, setSlot] = useState(null);
  const [simulation, setSimulation] = useState(() => simulationSponsorActive());
  // Logo publié mais introuvable (fichier supprimé chez l'hébergeur) : plutôt rien qu'une icône d'image cassée.
  const [cassee, setCassee] = useState(false);
  useEffect(() => {
    let annule = false;
    setCassee(false);
    charger(admin, token).then((slots) => { if (!annule) setSlot(slots.find((s) => s.key === cle) || null); });
    return () => { annule = true; };
  }, [cle, admin, token]);
  useEffect(() => ecouterSimulationSponsor(() => setSimulation(simulationSponsorActive())), []);

  const mode = modeEmplacement({ admin, simulation, slot });
  if (mode === 'rien') return null;
  if (cassee && !admin) return null;
  const image = slot.imageUrl && !cassee
    ? <img src={slot.imageUrl} alt={slot.name || t('sponsor.partner')} className="sponsor-logo" loading="lazy" decoding="async" onError={() => setCassee(true)} />
    : null;
  // Le lien vient d'une saisie de l'équipe : http(s) seulement, vérifié ici aussi (le serveur le vérifie à l'entrée).
  const lien = urlSure(slot.linkUrl);
  const avecLien = (contenu) => (lien ? <a href={lien} target="_blank" rel="noreferrer noopener sponsored">{contenu}</a> : contenu);

  if (mode === 'public' || mode === 'simulation') {
    return (
      <span className={`sponsor-rangee${mode === 'simulation' ? ' sponsor-rangee--simulation' : ''}`} style={style} aria-label={t('sponsor.partner')}>
        <span className="sponsor-mention">{t('sponsor.mention')}</span>
        {image ? avecLien(image) : <VisuelSponsorDemo />}
        {mode === 'simulation' && <span className="sponsor-prive-badge">{t('sponsor.simulationBadge')}</span>}
      </span>
    );
  }
  // 'prive' (logo chargé, pas activé) ou 'vide' : l'équipe seule.
  return (
    <span className="sponsor-rangee sponsor-rangee--prive" style={style} aria-label={t('sponsor.partner')} title={cassee ? t('sponsor.brokenAdmin', { label: slot.label }) : t('sponsor.emptyRow')}>
      {image ? avecLien(image) : <span className="sponsor-vide">{t('sponsor.emptyRowShort')}</span>}
      <span className="sponsor-prive-badge">{t('sponsor.adminOnly')}</span>
    </span>
  );
}
