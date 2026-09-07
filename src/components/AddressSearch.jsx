import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Barre de recherche d'adresse : on tape le début (« avenue georges henri 12 »), le serveur propose des
// adresses belges (GET /restaurants/lookup/suggest, Photon/OpenStreetMap), on en choisit une et les
// champs rue / numéro / code postal / ville se remplissent. Rien n'oblige à passer par là : les champs
// restent éditables à la main, et une suggestion « rue seule » laisse le numéro à compléter.
export default function AddressSearch({ onSelect, compact = false }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [etat, setEtat] = useState('idle'); // idle | loading | done
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const boite = useRef(null);
  // Après un choix, le champ reçoit le libellé complet : ce changement-là ne doit pas relancer une recherche.
  const ignorerProchaine = useRef(false);

  useEffect(() => {
    if (ignorerProchaine.current) { ignorerProchaine.current = false; return undefined; }
    const terme = q.trim();
    if (terme.length < 3) { setSuggestions([]); setEtat('idle'); return undefined; }
    let annule = false;
    const timer = setTimeout(async () => {
      setEtat('loading');
      try {
        const r = await api(`/restaurants/lookup/suggest?q=${encodeURIComponent(terme)}`);
        if (annule) return;
        setSuggestions(r.suggestions || []); setEtat('done'); setOuvert(true); setActif(-1);
      } catch {
        if (!annule) { setSuggestions([]); setEtat('done'); }
      }
    }, 450);
    return () => { annule = true; clearTimeout(timer); };
  }, [q]);

  // Clic en dehors : on replie la liste sans rien changer aux champs.
  useEffect(() => {
    const fermer = (e) => { if (boite.current && !boite.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('pointerdown', fermer);
    return () => document.removeEventListener('pointerdown', fermer);
  }, []);

  function choisir(s) {
    onSelect?.({ street: s.street || '', number: s.number || '', postalCode: s.postalCode || '', city: s.city || '' });
    ignorerProchaine.current = true;
    setQ(s.label);
    setOuvert(false);
  }

  function clavier(e) {
    if (!ouvert || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => Math.min(suggestions.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(suggestions[actif >= 0 ? actif : 0]); }
    else if (e.key === 'Escape') setOuvert(false);
  }

  return (
    <div className={`address-search${compact ? ' compact' : ''}`} ref={boite}>
      <label htmlFor="address-search-input">🔎 {t('addressSearch.label')}</label>
      <input
        id="address-search-input" value={q} autoComplete="off" role="combobox" aria-expanded={ouvert} aria-controls="address-search-list"
        onChange={(e) => setQ(e.target.value)} onFocus={() => suggestions.length && setOuvert(true)} onKeyDown={clavier}
        placeholder={t('addressSearch.placeholder')}
      />
      <p className="small address-search-help">{t('addressSearch.help')}</p>
      {ouvert && etat === 'done' && (
        <ul id="address-search-list" className="address-search-list" role="listbox">
          {suggestions.length === 0 && <li className="address-search-empty">{t('addressSearch.noResult')}</li>}
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`} role="option" aria-selected={i === actif} className={i === actif ? 'active' : undefined} onPointerDown={(e) => { e.preventDefault(); choisir(s); }}>
              <b>{[s.street, s.number].filter(Boolean).join(' ') || s.label}</b>
              <span className="small">{[s.postalCode, s.city].filter(Boolean).join(' ')}{!s.number ? ` · ${t('addressSearch.streetOnly')}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {etat === 'loading' && <p className="small" style={{ margin: 0 }}>{t('addressSearch.searching')}</p>}
    </div>
  );
}
