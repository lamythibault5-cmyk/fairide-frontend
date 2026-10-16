import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';
import AvecMarque from './AvecMarque';

/* « FAIRIDE ARRIVE SUR MOBILE », en une carte blanche (version B de l'accueil, fondateur, 2026-10-16) : il était un grand
   bloc iris avec un faux téléphone dessiné, le plus gros aplat de la page après la bannière. Honnête comme avant : les
   badges des stores ne sont PAS des liens (l'application n'est pas encore publiée), juste des repères visuels. */
const STORES = ['App Store', 'Google Play'];

export default function AppComingSoonSection() {
  const { t } = useLanguage();
  return (
    <section className="sa-appli">
      <span className="sa-tuile sa-tuile-pleine" aria-hidden="true"><Icone nom="mobile" taille={22} /></span>
      <div className="sa-appli-texte">
        <h2><AvecMarque>{t('landing.appSoonTitle')}</AvecMarque></h2>
        <p>{t('landing.appSoonSub')}</p>
      </div>
      <div className="sa-appli-stores">
        {STORES.map((s) => (
          <span key={s} className="sa-store" title={t('landing.appSoonNotYet')}><small>{t('landing.appSoonOn')}</small>{s}</span>
        ))}
      </div>
    </section>
  );
}
