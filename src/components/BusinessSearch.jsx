import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Recherche d'un commerce sur le web (OpenStreetMap via le serveur) : le restaurateur tape le nom de son
// restaurant, choisit la bonne fiche, et tout ce qui est connu publiquement est repris — adresse, téléphone,
// e-mail, site, horaires, type de cuisine. Il n'a plus qu'à vérifier. Rien n'est imposé : chaque champ reste
// modifiable, et « Ce n'est pas le bon ? » permet de recommencer.
const EMOJI_TYPE = { restaurant: '🍽️', cafe: '☕', fast_food: '🍔', bar: '🍺', pub: '🍺', bakery: '🥐', ice_cream: '🍨', food_court: '🍱', supermarket: '🛒', convenience: '🏪', butcher: '🥩', deli: '🧀', pastry: '🍰', greengrocer: '🥦' };

export default function BusinessSearch({ onSelect, compact = false }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState([]);
  const [etat, setEtat] = useState('idle'); // idle | loading | done | error | details
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState(null);
  const boite = useRef(null);
  const ignorer = useRef(false);

  useEffect(() => {
    if (ignorer.current) { ignorer.current = false; return undefined; }
    const terme = q.trim();
    if (terme.length < 3) { setResultats([]); setEtat('idle'); return undefined; }
    let annule = false;
    const timer = setTimeout(async () => {
      setEtat('loading');
      try {
        const r = await api(`/restaurants/lookup/business?q=${encodeURIComponent(terme)}`);
        if (annule) return;
        setResultats(r.results || []); setEtat('done'); setOuvert(true);
      } catch { if (!annule) { setResultats([]); setEtat('error'); } }
    }, 500);
    return () => { annule = true; clearTimeout(timer); };
  }, [q]);

  useEffect(() => {
    const fermer = (e) => { if (boite.current && !boite.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('pointerdown', fermer);
    return () => document.removeEventListener('pointerdown', fermer);
  }, []);

  async function choisir(r) {
    setOuvert(false); ignorer.current = true; setQ(r.name); setEtat('details');
    let details = {};
    try { details = await api(`/restaurants/lookup/business-details?type=${encodeURIComponent(r.osmType)}&id=${encodeURIComponent(r.osmId)}`); } catch { /* la fiche sans les détails vaut déjà l'adresse */ }
    const fiche = { ...r, ...details, name: r.name };
    setChoisi(fiche); setEtat('done');
    onSelect?.(fiche);
  }

  function recommencer() { setChoisi(null); ignorer.current = true; setQ(''); setResultats([]); setEtat('idle'); onSelect?.(null); }

  return (
    <div className={`business-search${compact ? ' compact' : ''}`} ref={boite}>
      <label htmlFor="business-search-input">🔎 {t('businessSearch.label')}</label>
      <p className="small business-search-help">{t('businessSearch.help')}</p>
      <input id="business-search-input" value={q} autoComplete="off" role="combobox" aria-expanded={ouvert}
        onChange={(e) => setQ(e.target.value)} onFocus={() => resultats.length && setOuvert(true)} placeholder={t('businessSearch.placeholder')} />
      {etat === 'loading' && <p className="small" style={{ margin: '4px 0 0' }}>{t('businessSearch.searching')}</p>}
      {etat === 'details' && <p className="small" style={{ margin: '4px 0 0' }}>{t('businessSearch.fetching')}</p>}
      {etat === 'error' && <p className="small" style={{ margin: '4px 0 0' }}>{t('businessSearch.error')}</p>}
      {ouvert && etat === 'done' && !choisi && (
        <ul className="address-search-list business-search-list" role="listbox">
          {resultats.length === 0 && <li className="address-search-empty">{t('businessSearch.noResult')}</li>}
          {resultats.map((r) => (
            <li key={`${r.osmType}-${r.osmId}`} role="option" onPointerDown={(e) => { e.preventDefault(); choisir(r); }}>
              <b>{EMOJI_TYPE[r.type] || '🏪'} {r.name}</b>
              <span className="small">{[[r.street, r.number].filter(Boolean).join(' '), [r.postalCode, r.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || t('businessSearch.noAddress')}</span>
            </li>
          ))}
        </ul>
      )}
      {choisi && (
        <div className="business-found" role="status">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <b>✅ {t('businessSearch.found', { name: choisi.name })}</b>
            <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={recommencer}>{t('businessSearch.notIt')}</button>
          </div>
          <p className="small" style={{ margin: '4px 0 0' }}>
            {[choisi.street, choisi.number].filter(Boolean).join(' ')}{choisi.postalCode || choisi.city ? `, ${[choisi.postalCode, choisi.city].filter(Boolean).join(' ')}` : ''}
            {choisi.phone ? ` · 📞 ${choisi.phone}` : ''}{choisi.email ? ` · ✉️ ${choisi.email}` : ''}{choisi.website ? ` · 🌐 ${choisi.website.replace(/^https?:\/\//, '')}` : ''}
            {choisi.cuisine ? ` · 🍽️ ${choisi.cuisine}` : ''}
          </p>
          <p className="small" style={{ margin: '6px 0 0', opacity: 0.8 }}>{t('businessSearch.verifyBelow')}</p>
        </div>
      )}
    </div>
  );
}
