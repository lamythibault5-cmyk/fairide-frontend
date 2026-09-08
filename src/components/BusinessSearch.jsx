import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Recherche du commerce du restaurateur dans OpenStreetMap, en deux temps : d'abord son code postal — la liste
// de tous les commerces alimentaires de cette zone s'affiche alors et défile — puis, s'il le veut, quelques
// lettres du nom ou de la rue pour la filtrer. Il clique sur sa fiche et tout ce qui est connu publiquement
// est repris (adresse, téléphone, e-mail, site, horaires, cuisine). Rien n'est imposé : chaque champ reste
// modifiable, « Ce n'est pas le bon ? » recommence, « Mon commerce n'est pas dans la liste » laisse tout
// remplir à la main. Si la zone n'est pas disponible, on retombe sur une recherche par nom.
const EMOJI_TYPE = { restaurant: '🍽️', cafe: '☕', fast_food: '🍔', bar: '🍺', pub: '🍺', bakery: '🥐', ice_cream: '🍨', food_court: '🍱', supermarket: '🛒', convenience: '🏪', butcher: '🥩', deli: '🧀', pastry: '🍰', greengrocer: '🥦', chocolate: '🍫', cheese: '🧀', seafood: '🐟', beverages: '🧃', tea: '🍵', coffee: '☕' };
const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const adresse = (r) => [[r.street, r.number].filter(Boolean).join(' '), [r.postalCode, r.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export default function BusinessSearch({ onSelect, onPostalCode, compact = false, initialPostalCode = '' }) {
  const { t } = useLanguage();
  const [cp, setCp] = useState(initialPostalCode);
  const [zone, setZone] = useState(null); // { results, unavailable }
  const [chargement, setChargement] = useState(false);
  const [filtre, setFiltre] = useState('');
  const [choisi, setChoisi] = useState(null);
  const [manuel, setManuel] = useState(false);
  // Recherche par nom (repli quand la zone n'est pas disponible)
  const [reponseNom, setReponseNom] = useState(null);
  const listeRef = useRef(null);

  const cpValide = /^\d{4}$/.test(cp.trim());

  useEffect(() => {
    if (!cpValide) { setZone(null); return undefined; }
    onPostalCode?.(cp.trim());
    let annule = false;
    setChargement(true); setZone(null); setReponseNom(null);
    api(`/restaurants/lookup/zone?postalCode=${cp.trim()}`)
      .then((r) => { if (!annule) setZone({ results: r.results || [], unavailable: !!r.unavailable }); })
      .catch(() => { if (!annule) setZone({ results: [], unavailable: true }); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, cpValide]);

  // Repli : la zone n'a rien donné → recherche par nom sur le web, dès 3 lettres.
  const repli = zone && (zone.unavailable || zone.results.length === 0);
  useEffect(() => {
    if (!repli || filtre.trim().length < 3) { setReponseNom(null); return undefined; }
    let annule = false;
    const timer = setTimeout(() => {
      api(`/restaurants/lookup/business?q=${encodeURIComponent(filtre.trim() + ' ' + cp.trim())}`)
        .then((r) => { if (!annule) setReponseNom((r.results || []).filter((x) => !x.postalCode || x.postalCode === cp.trim())); })
        .catch(() => { if (!annule) setReponseNom([]); });
    }, 500);
    return () => { annule = true; clearTimeout(timer); };
  }, [repli, filtre, cp]);

  const visibles = useMemo(() => {
    if (!zone || repli) return reponseNom || [];
    const f = normaliser(filtre.trim());
    if (!f) return zone.results;
    return zone.results.filter((r) => normaliser(`${r.name} ${r.street} ${r.number} ${r.cuisine} ${r.type}`).includes(f));
  }, [zone, repli, reponseNom, filtre]);

  useEffect(() => { if (listeRef.current) listeRef.current.scrollTop = 0; }, [filtre]);

  async function choisir(r) {
    let fiche = { ...r };
    // Une fiche venue de la recherche par nom n'a pas encore ses coordonnées : on les demande.
    if (r.phone === undefined) {
      try { fiche = { ...fiche, ...(await api(`/restaurants/lookup/business-details?type=${encodeURIComponent(r.osmType)}&id=${encodeURIComponent(r.osmId)}`)) }; } catch { /* l'adresse suffit déjà */ }
    }
    fiche.name = r.name;
    if (!fiche.postalCode) fiche.postalCode = cp.trim();
    setChoisi(fiche);
    onSelect?.(fiche);
  }

  function recommencer() { setChoisi(null); setFiltre(''); setManuel(false); onSelect?.(null); }

  return (
    <div className={`business-search${compact ? ' compact' : ''}`}>
      <label htmlFor="business-search-cp">📍 {t('businessSearch.postalLabel')}</label>
      <p className="small business-search-help">{t('businessSearch.postalHelp')}</p>
      <div className="business-search-row">
        <input id="business-search-cp" inputMode="numeric" maxLength={4} value={cp} placeholder={t('businessSearch.postalPlaceholder')}
          onChange={(e) => { setCp(e.target.value.replace(/\D/g, '').slice(0, 4)); setChoisi(null); setFiltre(''); setManuel(false); }} disabled={!!choisi} />
        {cpValide && !choisi && !manuel && (
          <input id="business-search-filter" value={filtre} onChange={(e) => setFiltre(e.target.value)} autoComplete="off"
            placeholder={repli ? t('businessSearch.namePlaceholder') : t('businessSearch.filterPlaceholder')} />
        )}
      </div>

      {chargement && <p className="small" style={{ margin: '6px 0 0' }}>⏳ {t('businessSearch.loadingZone', { cp: cp.trim() })}</p>}

      {zone && !choisi && !manuel && (
        <>
          <p className="small business-search-count" style={{ margin: '6px 0 4px' }}>
            {repli
              ? (zone.unavailable ? t('businessSearch.zoneUnavailable') : t('businessSearch.zoneEmpty', { cp: cp.trim() }))
              : t('businessSearch.zoneCount', { count: zone.results.length, cp: cp.trim(), shown: visibles.length })}
          </p>
          <ul className="business-zone-list" role="listbox" ref={listeRef} aria-label={t('businessSearch.postalLabel')}>
            {visibles.length === 0 && (
              <li className="business-zone-empty">{repli && filtre.trim().length < 3 ? t('businessSearch.typeName') : t('businessSearch.noMatch')}</li>
            )}
            {visibles.map((r) => (
              <li key={`${r.osmType}-${r.osmId}`} role="option" aria-selected={false}>
                <button type="button" onClick={() => choisir(r)}>
                  <span className="business-zone-emoji" aria-hidden="true">{EMOJI_TYPE[r.type] || '🏪'}</span>
                  <span className="business-zone-text">
                    <b>{r.name}</b>
                    <span className="small">{adresse(r) || t('businessSearch.noAddress')}{r.cuisine ? ` · ${r.cuisine.split(';')[0]}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost business-manual" onClick={() => { setManuel(true); onSelect?.(null); }}>{t('businessSearch.notInList')}</button>
        </>
      )}

      {manuel && !choisi && (
        <p className="small business-found" role="status" style={{ marginTop: 8 }}>
          ✍️ {t('businessSearch.manualMode')} <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={recommencer}>{t('businessSearch.backToList')}</button>
        </p>
      )}

      {choisi && (
        <div className="business-found" role="status">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <b>✅ {t('businessSearch.found', { name: choisi.name })}</b>
            <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={recommencer}>{t('businessSearch.notIt')}</button>
          </div>
          <p className="small" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
            {adresse(choisi)}
            {choisi.phone ? ` · 📞 ${choisi.phone}` : ''}{choisi.email ? ` · ✉️ ${choisi.email}` : ''}{choisi.website ? ` · 🌐 ${choisi.website.replace(/^https?:\/\//, '')}` : ''}
            {choisi.cuisine ? ` · 🍽️ ${choisi.cuisine}` : ''}
          </p>
          <p className="small" style={{ margin: '6px 0 0', opacity: 0.8 }}>{t('businessSearch.verifyBelow')}</p>
        </div>
      )}
    </div>
  );
}
