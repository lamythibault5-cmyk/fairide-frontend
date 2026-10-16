import { useLanguage } from '../../context/LanguageContext';
import AvecMarque from '../AvecMarque';

// « POURQUOI FAIRIDE ? » DANS LA BANNIÈRE. Depuis la version B de l'accueil (fondateur, 2026-10-16) : deux barres calmes,
// comme dans l'app (« Pourquoi passer à Fairide ? »), à la place des deux grandes cases et de la flèche dessinée. Plus de
// légende « le resto garde 90 % » : le fondateur préfère dire « seulement 10 % » que « ils gardent 90 % » (2026-10-16).
//
// D'OÙ VIENNENT LES CHIFFRES — à relire avant d'en changer un.
// - 30 % : haut de la fourchette 22-32 % citée partout sur le site, hors TVA.
// - 10 % : le taux de Fairide, sans TVA depuis que Fairide est sous le régime de la franchise (lettre du SPF
//   Finances du 12/10/2026, CLAUDE.md « Pricing model ») : les deux taux sont donc sur la même base. Depuis le modèle du
//   13/10/2026, Fairide garde 10 % du prix payé : « le resto garde 90 % » est exact (il peut monter ses prix de 11,1 % au
//   plus pour retrouver son prix de salle entier).
//
// TEXTES DE LA MAQUETTE DU 2026-10-09 VOLONTAIREMENT ÉCARTÉS (à ne pas remettre) :
// - « Commission prise au restaurant » : faux chez nous, la commission est dans le prix affiché, payée
//   par le client (CLAUDE.md, « Pricing model ») ;
// - « Le livreur garde 100 % des frais de livraison » : il touche 90 % de sa grille, les 10 % restants
//   sont les frais de système de Fairide (modèle du 08/10) ;
// - « Pas de frais de service » : ces frais de système existent, DANS la livraison ;
// - « +10 % » côté client : faux depuis le 13/10/2026, la carte affiche les prix du commerce par défaut.
const TAUX_EUX = 0.30;
const TAUX_NOUS = 0.10;

// Espace fine insécable (typographie française) : « 90 » et « % » ne se séparent jamais.
const pct = (x) => `${Math.round(x * 100)} %`;

export default function HeroPrix() {
  const { t } = useLanguage();
  // La barre des grandes plateformes fait toute la largeur ; celle de Fairide est à l'échelle (10 sur 30).
  const lignes = [
    { nom: 'fairide', taux: TAUX_NOUS, nous: true },
    { nom: t('landing.priceThem'), taux: TAUX_EUX }
  ];
  return (
    <section className="sa-prix" aria-label={t('landing.priceWhyAria')}>
      <h2 className="sa-prix-titre"><AvecMarque>{t('landing.priceWhy')}</AvecMarque></h2>
      {lignes.map((l) => (
        <div key={l.nom} className={`sa-prix-ligne${l.nous ? ' sa-prix-nous' : ''}`}>
          <span className={l.nous ? 'wordmark' : undefined}>{l.nom}</span>
          <i aria-hidden="true"><b style={{ width: `${Math.round((l.taux / TAUX_EUX) * 100)}%` }} /></i>
          <strong>{pct(l.taux)}</strong>
        </div>
      ))}
    </section>
  );
}
