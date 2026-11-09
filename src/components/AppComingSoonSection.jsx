import { useLanguage } from '../context/LanguageContext';
import { lienStore } from '../storesAppli';
import AvecMarque from './AvecMarque';

/* « L'APPLI FAIRRIDE » SUR L'ACCUEIL (Owen, 2026-11-09, après la sortie sur l'App Store) : la vraie icône de l'appli (celle des
   stores : ios/App/App/Assets.xcassets/AppIcon.appiconset, copiée en public/badges/icone-appli.png) et les badges OFFICIELS
   d'Apple et de Google, dans la langue du visiteur, à la place des deux pastilles en texte.
   Les badges ne se redessinent pas : Apple et Google imposent leurs fichiers tels quels (Apple : toolbox.marketingtools.apple.com,
   noir ; Google : play.google.com/intl/en_us/badges, rogné de sa marge transparente). Même hauteur pour les deux ; celui de
   Google en sort un peu plus large, ce que ses règles demandent (jamais plus petit que les autres badges).
   Fond iris très pâle (--iris-tint), sans ombre : la carte se détache de la page blanche sans peser comme l'ancien bloc
   iris plein au faux téléphone, retiré le 2026-10-16. */
const LANGUES_BADGES = ['fr', 'nl', 'en'];

export default function AppComingSoonSection() {
  const { t, language } = useLanguage();
  const l = LANGUES_BADGES.includes(language) ? language : 'fr';
  return (
    <section className="sa-appli">
      <img className="sa-appli-icone" src="/badges/icone-appli.png" alt="" width="88" height="88" loading="lazy" decoding="async" />
      <div className="sa-appli-texte">
        <h2><AvecMarque>{t('landing.appLiveTitle')}</AvecMarque></h2>
        <p>{t('landing.appLiveSub')}</p>
      </div>
      <div className="sa-appli-stores">
        <a className="sa-badge" href={lienStore('ios', 'accueil')} target="_blank" rel="noopener noreferrer">
          <img src={`/badges/app-store-${l}.svg`} alt={t('landing.appBadgeIos')} height="48" loading="lazy" decoding="async" />
        </a>
        <a className="sa-badge" href={lienStore('android', 'accueil')} target="_blank" rel="noopener noreferrer">
          <img src={`/badges/google-play-${l}.png`} alt={t('landing.appBadgeAndroid')} height="48" loading="lazy" decoding="async" />
        </a>
      </div>
    </section>
  );
}
