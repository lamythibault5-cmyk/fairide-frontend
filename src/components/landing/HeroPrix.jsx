import { useLanguage } from '../../context/LanguageContext';
import AvecMarque from '../AvecMarque';
import MotMarque from '../MotMarque';
import Rich from '../Rich';
import { euros } from '../../prixPlat';

// « POURQUOI FAIRIDE ? » DANS LA BANNIÈRE. Depuis la version B de l'accueil (fondateur, 2026-10-16) : deux barres calmes,
// comme dans l'app (« Pourquoi passer à Fairide ? »), à la place des deux grandes cases et de la flèche dessinée. Plus de
// légende « le resto garde 90 % » : le fondateur préfère dire « seulement 10 % » que « ils gardent 90 % » (2026-10-16).
//
// LE PREMIER ARGUMENT : DES PRIX QUI NE SONT PAS GONFLÉS (fondateur, 2026-10-19, version B de maquettes/prix-pas-gonfles/prix-pas-gonfles.html).
// « Le restaurant ne doit plus gonfler ses prix » parle au client mieux que « 10 % au lieu de 30 » : la phrase ouvre la
// carte, les barres disent pourquoi, et deux étiquettes montrent ce que ça change sur un plat. Sans note de calcul sous les
// étiquettes (fondateur) : le calcul complet est dans l'aide (help.prices2) et dans la FAQ de /notre-histoire.
//
// D'OÙ VIENNENT LES CHIFFRES — à relire avant d'en changer un.
// - 30 % : haut de la fourchette 22-32 % citée partout sur le site, hors TVA.
// - 10 % : le taux de Fairide, sans TVA depuis que Fairide est sous le régime de la franchise (lettre du SPF
//   Finances du 12/10/2026, CLAUDE.md « Pricing model ») : les deux taux sont donc sur la même base.
// - 17,10 € : 12 € ÷ 0,70, ce que la carte doit afficher pour couvrir 30 % de commission, arrondi aux 10 cents inférieurs.
// - 13,20 € : 12 € + 10 %, la hausse la plus forte qu'un commerce peut poser sur Fairide (hausseMaxPourcent du backend,
//   fondateur du 16/10/2026, arrondi aux 10 cents inférieurs comme prixMagasin.prixAvecHausse). « au plus » : par défaut, la
//   carte affiche le prix du comptoir (12 €), d'où « ou 12 € s'il garde son prix ».
// C'EST UN CALCUL, PAS UN RELEVÉ : on ne dit jamais ce qu'un plat coûte sur une autre plateforme (publicité comparative,
// art. VI.17 CDE), on ne promet pas un prix plus bas (« tu paies moins » a quitté le sous-titre le même jour), et on écrit
// « ne doit plus gonfler », jamais « les mêmes prix qu'au restaurant » : un commerce peut monter sa carte de 10 %.
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
const PLAT = 12;
const dixCentimesInferieurs = (v) => Math.floor(v * 10 + 1e-6) / 10;
const AFFICHE_EUX = dixCentimesInferieurs(PLAT / (1 - TAUX_EUX)); // 17,10 €
const AFFICHE_NOUS = dixCentimesInferieurs(PLAT * (1 + TAUX_NOUS)); // 13,20 €

// Espace fine insécable (typographie française) : « 90 » et « % » ne se séparent jamais.
const pct = (x) => `${Math.round(x * 100)} %`;

export default function HeroPrix() {
  const { t } = useLanguage();
  // La barre des grandes plateformes fait toute la largeur ; celle de Fairide est à l'échelle (10 sur 30).
  const lignes = [
    { nom: 'fairride', taux: TAUX_NOUS, nous: true },
    { nom: t('landing.priceThem'), taux: TAUX_EUX }
  ];
  const plat = euros(PLAT).replace(/[,.]00(?=\D|$)/, '');
  return (
    <section className="sa-prix" aria-label={t('landing.priceWhyAria')}>
      <h2 className="sa-prix-titre"><AvecMarque>{t('landing.priceWhy')}</AvecMarque></h2>
      <p className="sa-prix-accroche"><Rich text={t('landing.prixAccroche')} /></p>
      {lignes.map((l) => (
        <div key={l.nom} className={`sa-prix-ligne${l.nous ? ' sa-prix-nous' : ''}`}>
          {l.nous ? <MotMarque /> : <span>{l.nom}</span>}
          <i aria-hidden="true"><b style={{ width: `${Math.round((l.taux / TAUX_EUX) * 100)}%` }} /></i>
          <strong>{pct(l.taux)}</strong>
        </div>
      ))}
      <p className="sa-prix-exemple">{t('landing.prixExemple', { prix: plat })}</p>
      <div className="sa-prix-etiquettes">
        <div className="sa-prix-etiquette">
          <span>{t('landing.prixEux')}</span>
          <strong>{euros(AFFICHE_EUX)}</strong>
          <small>{t('landing.prixEuxSous')}</small>
        </div>
        <div className="sa-prix-etiquette sa-prix-etiquette-nous">
          <span><AvecMarque>{t('landing.prixNous')}</AvecMarque></span>
          <strong>{euros(AFFICHE_NOUS)}</strong>
          <small>{t('landing.prixNousSous', { prix: plat })}</small>
        </div>
      </div>
    </section>
  );
}
