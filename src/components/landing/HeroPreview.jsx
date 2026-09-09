import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { COMMUNES } from '../../menuCategories';
import { getOpenStatus } from '../../openingHours';
import { useLanguage } from '../../context/LanguageContext';

// Colonne droite de la bannière d'accueil : ce que Fairide EST, montré plutôt que dessiné. Un choix de
// commune, puis trois commerces déjà partenaires, sans jamais prétendre connaître la position du visiteur
// (aucune géolocalisation avant connexion : le titre dit « déjà sur Fairide », pas « près de toi »). Un choix de
// commune (le geste d'entrée de toute plateforme de livraison) et trois vrais commerces partenaires avec
// leur photo, lus sur l'API publique. Remplace l'ancien grand vélo lime, qui occupait 40 % de la bannière
// sans rien apprendre au visiteur ; la marque garde sa signature en petit, à côté de l'accroche.
function StarIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}

export function CommunePicker({ variante = 'hero' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [commune, setCommune] = useState('');
  function aller(e) {
    e.preventDefault();
    navigate('/restaurants', commune ? { state: { commune } } : undefined);
  }
  return (
    <form className={`commune-picker commune-picker-${variante}`} onSubmit={aller}>
      <label htmlFor={`commune-${variante}`} className="commune-picker-label">{t('landing.heroCommuneLabel')}</label>
      <div className="commune-picker-row">
        <select id={`commune-${variante}`} value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">{t('landing.heroCommunePlaceholder')}</option>
          {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn-gold">{t('landing.heroCommuneButton')}</button>
      </div>
    </form>
  );
}

export function useCommercesPublics() {
  const [restaurants, setRestaurants] = useState([]);
  useEffect(() => { api('/restaurants').then((all) => setRestaurants(Array.isArray(all) ? all : [])).catch(() => {}); }, []);
  return restaurants;
}

export default function HeroPreview({ restaurants }) {
  const { t } = useLanguage();
  // Trois commerces avec photo, ouverts de préférence, tirés au sort à chaque visite : la bannière change
  // sans jamais mentir (ce sont de vrais partenaires).
  const choix = useMemo(() => {
    const now = new Date();
    const avecPhoto = restaurants.filter((r) => r.coverImageUrl);
    const ouvert = (r) => !r.hours || getOpenStatus(r.hours, now, r.closures).isOpen;
    const melange = [...avecPhoto].sort(() => Math.random() - 0.5);
    // Trois types de cuisine différents quand c'est possible : une vitrine variée, pas trois night shops.
    const ordonnes = [...melange.filter(ouvert), ...melange.filter((r) => !ouvert(r))];
    const vus = new Set(); const distincts = ordonnes.filter((r) => { if (vus.has(r.cuisine)) return false; vus.add(r.cuisine); return true; });
    return [...distincts, ...ordonnes.filter((r) => !distincts.includes(r))].slice(0, 3).map((r) => ({ ...r, estOuvert: ouvert(r) }));
  }, [restaurants]);

  return (
    <div className="hero-preview" aria-label={t('landing.heroPreviewTitle2')}>
      <div className="hero-preview-head">
        <span className="hero-preview-dot" aria-hidden="true" />
        <span>{t('landing.heroPreviewTitle2')}</span>
        {restaurants.length > 0 && <span className="hero-preview-count">{t('landing.heroPreviewCount', { n: restaurants.length })}</span>}
      </div>
      {choix.length === 0 ? (
        <div className="hero-preview-list">
          {[0, 1, 2].map((i) => <div key={i} className="hero-preview-card hero-preview-skeleton"><div className="hero-preview-img" /><div className="hero-preview-lines"><span /><span /></div></div>)}
        </div>
      ) : (
        <div className="hero-preview-list">
          {choix.map((r) => (
            <Link key={r.id} to={`/restaurants/${r.id}`} className="hero-preview-card">
              <img className="hero-preview-img" src={r.coverImageUrl} alt="" loading="eager" />
              <div className="hero-preview-body">
                <b>{r.name}</b>
                <span className="hero-preview-meta">{r.cuisine} · {r.commune}</span>
              </div>
              <div className="hero-preview-side">
                {r.reviewCount > 0 && <span className="hero-preview-rating"><StarIcon /> {Number(r.rating).toFixed(1)}</span>}
                <span className={`hero-preview-open${r.estOuvert ? '' : ' ferme'}`}>{r.estOuvert ? t('landing.heroPreviewOpen') : t('landing.heroPreviewClosed')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Link to="/restaurants" className="hero-preview-all">{t('landing.heroPreviewAll', { n: restaurants.length || '' })} →</Link>
    </div>
  );
}
