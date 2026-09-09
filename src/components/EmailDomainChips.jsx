import { useLanguage } from '../context/LanguageContext';

// Sous le champ e-mail de l'inscription : les fournisseurs courants en pastilles, pour compléter l'adresse d'un
// geste au lieu de la taper (gain de temps surtout sur téléphone). « Autre » pose juste le @ et rend la main.
// Les pastilles disparaissent dès que l'adresse est complète (un @ suivi d'un point).
const DOMAINES = ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com', 'hotmail.be', 'proton.me', 'skynet.be', 'telenet.be'];

export default function EmailDomainChips({ value, onChange, inputId }) {
  const { t } = useLanguage();
  const v = String(value || '');
  const [local, domaine = ''] = v.split('@');
  if (!local.trim() || (v.includes('@') && domaine.includes('.'))) return null;
  const filtre = domaine.toLowerCase();
  const propositions = DOMAINES.filter((d) => !filtre || d.startsWith(filtre)).slice(0, 6);
  if (!propositions.length && filtre) return null;
  const appliquer = (d) => {
    onChange(`${local.trim()}@${d}`);
    const el = inputId ? document.getElementById(inputId) : null;
    if (el) { el.focus(); if (!d) el.setSelectionRange(el.value.length, el.value.length); }
  };
  return (
    <div className="email-chips" role="group" aria-label={t('auth.emailSuggestions')}>
      {propositions.map((d) => (
        <button key={d} type="button" className="chip email-chip" onClick={() => appliquer(d)}>@{d}</button>
      ))}
      <button type="button" className="chip email-chip email-chip-autre" onClick={() => appliquer('')}>{t('auth.emailOther')}</button>
    </div>
  );
}
