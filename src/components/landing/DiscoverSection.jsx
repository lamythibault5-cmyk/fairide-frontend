import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import Reveal from '../Reveal';

// « Découvre les commerces » : une vraie vitrine avec photos, filtrable par type de cuisine, avant de
// demander quoi que ce soit au visiteur. Public : chaque carte mène à la fiche du commerce, consultable
// sans compte (la connexion n'est demandée qu'au moment de commander).
const NB = 8;

export default function DiscoverSection({ restaurants }) {
  const { t } = useLanguage();
  const [filtre, setFiltre] = useState('');
  const cuisines = useMemo(() => {
    const compte = new Map();
    restaurants.forEach((r) => { if (r.cuisine) compte.set(r.cuisine, (compte.get(r.cuisine) || 0) + 1); });
    return [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([c]) => c);
  }, [restaurants]);
  const cartes = useMemo(() => {
    const base = restaurants.filter((r) => r.coverImageUrl && (!filtre || r.cuisine === filtre));
    const melange = [...base].sort(() => Math.random() - 0.5);
    // Une photo ne sert qu'une fois ; sans filtre, un type de commerce n'apparaît qu'une fois tant qu'il en reste d'autres.
    const idPhoto = (u) => (String(u || '').match(/photo-[0-9a-f-]+/) || [u])[0];
    const photos = new Set(); const types = new Set(); const retenus = [];
    for (const r of melange) { const ph = idPhoto(r.coverImageUrl); if (photos.has(ph) || (!filtre && types.has(r.cuisine))) continue; photos.add(ph); types.add(r.cuisine); retenus.push(r); if (retenus.length >= NB) break; }
    for (const r of melange) { if (retenus.length >= NB) break; const ph = idPhoto(r.coverImageUrl); if (retenus.includes(r) || photos.has(ph)) continue; photos.add(ph); retenus.push(r); }
    return retenus;
  }, [restaurants, filtre]);

  if (restaurants.length === 0) return null;
  return (
    <section className="discover-section">
      <Reveal>
        <div className="discover-head">
          <div>
            <span className="pill hero discover-eyebrow">{t('landing.discoverEyebrow')}</span>
            <h2 className="section-title" style={{ margin: '6px 0 0' }}>{t('landing.discoverTitle')}</h2>
          </div>
          <Link to="/restaurants" className="btn-outline discover-all">{t('landing.discoverAll', { n: restaurants.length })} →</Link>
        </div>
        <div className="discover-filtres" role="tablist">
          <button type="button" role="tab" aria-selected={!filtre} className={`chip${!filtre ? ' active' : ''}`} onClick={() => setFiltre('')}>{t('landing.discoverAllTypes')}</button>
          {cuisines.map((c) => <button key={c} type="button" role="tab" aria-selected={filtre === c} className={`chip${filtre === c ? ' active' : ''}`} onClick={() => setFiltre(c)}>{c}</button>)}
        </div>
      </Reveal>
      <div className="discover-grid">
        {cartes.map((r, i) => (
          <Reveal as={Link} key={r.id} to={`/restaurants/${r.id}`} className="discover-tile" delay={(i % 4) * 70}>
            <div className="discover-tile-img">
              <img loading="lazy" src={r.coverImageUrl} alt={r.name} />
              <span className="discover-tile-cuisine">{r.cuisine}</span>
              {r.reviewCount > 0 && <span className="discover-tile-rating">★ {Number(r.rating).toFixed(1)}</span>}
            </div>
            <div className="discover-tile-body">
              <b>{r.name}</b>
              <span className="discover-tile-meta">📍 {r.neighborhood ? `${r.neighborhood} · ` : ''}{r.commune}{r.reviewCount > 0 ? <span className="discover-tile-reviews"> · {r.reviewCount} {t('landing.discoverReviews')}</span> : null}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
