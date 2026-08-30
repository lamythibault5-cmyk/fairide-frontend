import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Défilement horizontal infini des commerces déjà partenaires, en bas de la page d'accueil — un mur
// de confiance avant l'appel à l'action final. Purement décoratif : ne mène nulle part au clic (pas de
// lien vers une fiche resto ni vers une interface qui exigerait une connexion), le défilement continue
// sans interruption quoi que fasse le visiteur. Public (pas besoin d'être connecté), lu directement
// depuis /restaurants ; se met donc à jour tout seul à mesure que de nouveaux commerces rejoignent Fairide.
export default function PartnersMarquee() {
  const { t } = useLanguage();
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    api('/restaurants').then((all) => setRestaurants(all.sort(() => Math.random() - 0.5))).catch(() => {});
  }, []);

  if (restaurants.length === 0) return null;

  const canLoop = restaurants.length >= 4;
  const items = canLoop ? [...restaurants, ...restaurants] : restaurants;

  return (
    <div style={{ marginBottom: 18 }}>
      <h2 className="section-title" style={{ textAlign: 'center' }}>🤝 {t('landing.trustTitle')}</h2>
      <div className="trust-marquee">
        <div
          className={`trust-track${canLoop ? ' animate' : ''}`}
          style={canLoop ? { animationDuration: `${restaurants.length * 3.5}s` } : undefined}
        >
          {items.map((r, i) => (
            <div key={`${r.id}-${i}`} className="trust-card" title={r.name}>
              {r.coverImageUrl ? <img loading="lazy" src={r.coverImageUrl} alt={r.name} /> : <span className="trust-card-fallback">{r.name.slice(0, 2).toUpperCase()}</span>}
              <span>{r.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
