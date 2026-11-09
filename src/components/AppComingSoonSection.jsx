import { useLanguage } from '../context/LanguageContext';
import { lienStore } from '../storesAppli';
import Icone from './Icone';
import AvecMarque from './AvecMarque';

/* « L'APPLI FAIRRIDE », en une carte blanche (version B de l'accueil, fondateur, 2026-10-16) : il était un grand bloc iris avec
   un faux téléphone dessiné, le plus gros aplat de la page après la bannière.
   LES BADGES SONT DES LIENS (Owen, 2026-11-09) : jusque-là deux repères « Bientôt sur » sans lien, alors qu'Android était
   public depuis des jours. Maintenant « Disponible sur … », vers chaque store (storesAppli.js). */
const BADGES = [['ios', 'App Store'], ['android', 'Google Play']];

export default function AppComingSoonSection() {
  const { t } = useLanguage();
  return (
    <section className="sa-appli">
      <span className="sa-tuile sa-tuile-pleine" aria-hidden="true"><Icone nom="mobile" taille={22} /></span>
      <div className="sa-appli-texte">
        <h2><AvecMarque>{t('landing.appLiveTitle')}</AvecMarque></h2>
        <p>{t('landing.appLiveSub')}</p>
      </div>
      <div className="sa-appli-stores">
        {BADGES.map(([os, nom]) => (
          <a key={os} className="sa-store sa-store-lien" href={lienStore(os, 'accueil')} target="_blank" rel="noopener noreferrer">
            <small>{t('landing.appLiveOn')}</small>{nom}
          </a>
        ))}
      </div>
    </section>
  );
}
