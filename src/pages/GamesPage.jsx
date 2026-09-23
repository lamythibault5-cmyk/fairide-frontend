import usePageMeta from '../hooks/usePageMeta';
import { useLanguage } from '../context/LanguageContext';
import RetourCompte from '../components/RetourCompte';
import GameSwitcher from '../components/GameSwitcher';

// Les mini-jeux, rubrique de Mon compte (onglet iris, en bas de la liste — voir Account.jsx).
//
// RETOUR DU 23/09/2026, EN PLUS SIMPLE. Retirés le matin même avec l'allègement du site, ils reviennent à la
// demande du fondateur, réduits à trois (FairCatch, FairDodge, FairFlash) et seuls sur leur page : plus d'écran
// scindé avec la carte du livreur, plus de jeux sur les pages Carte du commerce et du livreur. Le suivi d'une
// livraison reste dans « Mes commandes ».
//
// Ils ne s'affichaient pas sur Chrome Android : voir l'en-tête de jeux/dessin.js (emojis recopiés depuis un
// sprite vérifié, et canvas non opaque dans GameFrame.jsx).
export default function GamesPage() {
  const { t } = useLanguage();
  usePageMeta({ title: t('games.pageTitle'), description: t('games.pageMetaDescription'), path: '/jeux' });
  return (
    <div>
      <RetourCompte />
      <h1 className="section-title" style={{ marginTop: 0 }}>{t('games.pageTitle')}</h1>
      <p className="small jeux-page-intro">{t('games.pageIntro')}</p>
      <section className="jeux-page-terrain" aria-label={t('games.pageTitle')}>
        <GameSwitcher fill large />
      </section>
    </div>
  );
}
