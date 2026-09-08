import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Recherche du commerce du restaurateur dans OpenStreetMap, en deux temps : d'abord son code postal — la liste
// de tous les commerces alimentaires de cette zone s'affiche alors et défile — puis, s'il le veut, quelques
// lettres du nom ou de la rue pour la filtrer. Il clique sur sa fiche : les données récupérées (nom, adresse,
// téléphone, e-mail, site, horaires, cuisine) apparaissent dans des champs modifiables, avec « Revoir la
// liste » pour revenir en arrière. « Mon commerce n'est pas dans la liste » ouvre la même fiche, vide, à
// remplir à la main. Si la zone n'est pas disponible, on retombe sur une recherche par nom.
//
// Le parent reçoit la fiche complète à chaque modification (onSelect), et null quand on revient à la liste.
const EMOJI_TYPE = { restaurant: '🍽️', cafe: '☕', fast_food: '🍔', bar: '🍺', pub: '🍺', bakery: '🥐', ice_cream: '🍨', food_court: '🍱', supermarket: '🛒', convenience: '🏪', butcher: '🥩', deli: '🧀', pastry: '🍰', greengrocer: '🥦', chocolate: '🍫', cheese: '🧀', seafood: '🐟', beverages: '🧃', tea: '🍵', coffee: '☕' };
const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const adresse = (r) => [[r.street, r.number].filter(Boolean).join(' '), [r.postalCode, r.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const FICHE_VIDE = { name: '', cuisine: '', street: '', number: '', postalCode: '', city: '', phone: '', email: '', website: '', openingHours: '' };

export default function BusinessSearch({ onSelect, onPostalCode, compact = false, initialPostalCode = '' }) {
  const { t } = useLanguage();
  const [cp, setCp] = useState(initialPostalCode);
  const [zone, setZone] = useState(null); // { results, unavailable, pending }
  const [chargement, setChargement] = useState(false);
  const [filtre, setFiltre] = useState('');
  const [fiche, setFiche] = useState(null); // fiche affichée et modifiable (choisie ou saisie à la main)
  const [origine, setOrigine] = useState(null); // 'web' | 'manuel'
  const [reponseNom, setReponseNom] = useState(null); // repli : recherche par nom
  const listeRef = useRef(null);

  const cpValide = /^\d{4}$/.test(cp.trim());

  // Une zone jamais demandée est collectée par le serveur en tâche de fond (« pending ») : on repasse toutes
  // les 8 s pendant deux minutes, le temps qu'Overpass réponde ; entre-temps la recherche par nom fonctionne.
  useEffect(() => {
    if (!cpValide) { setZone(null); return undefined; }
    onPostalCode?.(cp.trim());
    let annule = false; let essais = 0; let timer = null;
    setChargement(true); setZone(null); setReponseNom(null);
    const demander = () => api(`/restaurants/lookup/zone?postalCode=${cp.trim()}`)
      .then((r) => {
        if (annule) return;
        const attente = !!r.pending && essais < 15;
        setZone({ results: r.results || [], unavailable: !!r.unavailable, pending: attente });
        if (attente) { essais += 1; timer = setTimeout(demander, 8000); }
      })
      .catch(() => { if (!annule) setZone({ results: [], unavailable: true, pending: false }); })
      .finally(() => { if (!annule) setChargement(false); });
    demander();
    return () => { annule = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, cpValide]);

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

  function publier(f) { setFiche(f); onSelect?.(f); }

  async function choisir(r) {
    let f = { ...FICHE_VIDE, ...r };
    // Une fiche venue de la recherche par nom n'a pas encore ses coordonnées : on les demande.
    if (r.phone === undefined) {
      try { f = { ...f, ...(await api(`/restaurants/lookup/business-details?type=${encodeURIComponent(r.osmType)}&id=${encodeURIComponent(r.osmId)}`)) }; } catch { /* l'adresse suffit déjà */ }
    }
    f.name = r.name;
    if (!f.postalCode) f.postalCode = cp.trim();
    setOrigine('web');
    publier(f);
  }

  function saisirALaMain() { setOrigine('manuel'); publier({ ...FICHE_VIDE, postalCode: cp.trim() }); }
  function revoirListe() { setFiche(null); setOrigine(null); onSelect?.(null); }
  const modifier = (champ) => (e) => publier({ ...fiche, [champ]: e.target.value });

  return (
    <div className={`business-search${compact ? ' compact' : ''}`}>
      <label htmlFor="business-search-cp">📍 {t('businessSearch.postalLabel')}</label>
      <p className="small business-search-help">{t('businessSearch.postalHelp')}</p>
      <div className="business-search-row">
        <input id="business-search-cp" inputMode="numeric" maxLength={4} value={cp} placeholder={t('businessSearch.postalPlaceholder')}
          onChange={(e) => { setCp(e.target.value.replace(/\D/g, '').slice(0, 4)); setFiche(null); setOrigine(null); setFiltre(''); onSelect?.(null); }} disabled={!!fiche} />
        {cpValide && !fiche && (
          <input id="business-search-filter" value={filtre} onChange={(e) => setFiltre(e.target.value)} autoComplete="off"
            placeholder={repli ? t('businessSearch.namePlaceholder') : t('businessSearch.filterPlaceholder')} />
        )}
      </div>

      {chargement && <p className="small" style={{ margin: '6px 0 0' }}>⏳ {t('businessSearch.loadingZone', { cp: cp.trim() })}</p>}

      {zone && !fiche && (
        <>
          <p className="small business-search-count" style={{ margin: '6px 0 4px' }}>
            {repli
              ? (zone.pending ? `⏳ ${t('businessSearch.zonePending', { cp: cp.trim() })}` : zone.unavailable ? t('businessSearch.zoneUnavailable') : t('businessSearch.zoneEmpty', { cp: cp.trim() }))
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
          <button type="button" className="btn-ghost business-manual" onClick={saisirALaMain}>{t('businessSearch.notInList')}</button>
        </>
      )}

      {fiche && (
        <div className="business-found business-fiche" role="region" aria-label={t('businessSearch.ficheTitle')}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <b>{origine === 'web' ? `✅ ${t('businessSearch.found', { name: fiche.name })}` : `✍️ ${t('businessSearch.manualTitle')}`}</b>
            <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={revoirListe}>← {t('businessSearch.backToList')}</button>
          </div>
          <p className="small" style={{ margin: '4px 0 8px', opacity: 0.8 }}>{origine === 'web' ? t('businessSearch.verifyFields') : t('businessSearch.manualHelp')}</p>
          {compact ? (
            <p className="small" style={{ margin: 0 }}>{t('businessSearch.compactHint')}</p>
          ) : (
            <div className="business-fiche-grid">
              <label className="business-fiche-field span2"><span>{t('businessSearch.fName')}</span><input value={fiche.name} onChange={modifier('name')} /></label>
              <label className="business-fiche-field span2"><span>{t('businessSearch.fStreet')}</span><input value={fiche.street} onChange={modifier('street')} /></label>
              <label className="business-fiche-field"><span>{t('businessSearch.fNumber')}</span><input value={fiche.number} onChange={modifier('number')} /></label>
              <label className="business-fiche-field"><span>{t('businessSearch.fPostal')}</span><input value={fiche.postalCode} inputMode="numeric" maxLength={4} onChange={modifier('postalCode')} /></label>
              <label className="business-fiche-field span2"><span>{t('businessSearch.fCity')}</span><input value={fiche.city} onChange={modifier('city')} /></label>
              <label className="business-fiche-field"><span>{t('businessSearch.fPhone')}</span><input value={fiche.phone} type="tel" onChange={modifier('phone')} /></label>
              <label className="business-fiche-field"><span>{t('businessSearch.fEmail')}</span><input value={fiche.email} type="email" onChange={modifier('email')} /></label>
              <label className="business-fiche-field span2"><span>{t('businessSearch.fWebsite')}</span><input value={fiche.website} onChange={modifier('website')} placeholder="https://" /></label>
              <label className="business-fiche-field span2"><span>{t('businessSearch.fHours')}</span><input value={fiche.openingHours} onChange={modifier('openingHours')} placeholder={t('businessSearch.fHoursPh')} /></label>
              <label className="business-fiche-field span2"><span>{t('businessSearch.fCuisine')}</span><input value={fiche.cuisine} onChange={modifier('cuisine')} placeholder={t('businessSearch.fCuisinePh')} /></label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
