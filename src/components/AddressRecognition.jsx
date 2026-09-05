import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Reconnaissance de l'adresse d'un commerce pendant qu'on la tape (inscription restaurateur, création
// du restaurant) : dès que rue, numéro et code postal sont là, le serveur déduit la commune et le
// quartier (Nominatim) et liste les commerces déjà référencés sur Internet à cette adresse
// (OpenStreetMap). Le parent reçoit la commune/le quartier (onResult) et, si le restaurateur clique
// sur un commerce proposé, son nom (onPickCandidate). Rien n'est imposé : ce sont des propositions.
export default function AddressRecognition({ street, number, postalCode, city, onResult, onPickCandidate, compact = false }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState('idle'); // idle | loading | done | none | error
  const [reco, setReco] = useState(null);
  const [choisi, setChoisi] = useState(null);
  const derniere = useRef('');

  const complet = street.trim().length >= 3 && number.trim() && /^\d{4}$/.test(postalCode.trim());
  // La ville ne fait pas partie de la clé : elle est souvent remplie par la reconnaissance elle-même, et
  // relancer la recherche à ce moment-là effacerait le commerce que le restaurateur vient de choisir.
  const cle = complet ? `${street.trim()}|${number.trim()}|${postalCode.trim()}` : '';

  useEffect(() => {
    if (!cle) { setEtat('idle'); setReco(null); return undefined; }
    if (cle === derniere.current) return undefined;
    let annule = false;
    const timer = setTimeout(async () => {
      derniere.current = cle;
      setEtat('loading');
      try {
        const q = new URLSearchParams({ street: street.trim(), number: number.trim(), postalCode: postalCode.trim(), city: city.trim() });
        const r = await api(`/restaurants/lookup/address?${q.toString()}`);
        if (annule) return;
        if (!r.found) { setEtat('none'); setReco(null); return; }
        setReco(r); setEtat('done'); setChoisi(null);
        onResult?.(r);
      } catch {
        if (!annule) setEtat('error');
      }
    }, 800);
    return () => { annule = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  if (etat === 'idle') return null;
  return (
    <div className={`address-reco${compact ? ' compact' : ''}`} aria-live="polite">
      {etat === 'loading' && <p className="small" style={{ margin: 0 }}>🔎 {t('addressReco.searching')}</p>}
      {etat === 'none' && <p className="small" style={{ margin: 0 }}>{t('addressReco.notFound')}</p>}
      {etat === 'error' && <p className="small" style={{ margin: 0 }}>{t('addressReco.error')}</p>}
      {etat === 'done' && reco && (
        <>
          <p className="small" style={{ margin: 0 }}>
            📍 <b>{t('addressReco.recognized')}</b>{' '}
            {reco.commune ? t('addressReco.communeLine', { commune: reco.commune }) : t('addressReco.communeUnknown')}
            {reco.neighborhood ? ` · ${t('addressReco.neighbourhoodLine', { neighbourhood: reco.neighborhood })}` : ''}
          </p>
          {reco.candidates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p className="small" style={{ margin: '0 0 6px' }}><b>{t('addressReco.candidatesTitle')}</b> <span style={{ opacity: 0.7 }}>{t('addressReco.candidatesHelp')}</span></p>
              <div className="address-reco-candidates">
                {reco.candidates.map((c) => (
                  <button key={c.name} type="button" className={`address-reco-candidate${choisi === c.name ? ' active' : ''}`} onClick={() => { setChoisi(c.name); onPickCandidate?.(c, reco); }}>
                    <b>{c.name}</b>
                    <span className="small">{[c.cuisine, c.type, c.distanceM !== null ? t('addressReco.distance', { m: c.distanceM }) : null].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
              {choisi && <p className="small" style={{ margin: '6px 0 0' }}>✅ {t('addressReco.picked', { name: choisi })}</p>}
            </div>
          )}
          {reco.candidates.length === 0 && <p className="small" style={{ margin: '6px 0 0', opacity: 0.7 }}>{t('addressReco.noCandidate')}</p>}
        </>
      )}
    </div>
  );
}
