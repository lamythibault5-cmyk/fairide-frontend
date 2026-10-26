import { useLanguage } from '../../context/LanguageContext';
import AvecMarque from '../AvecMarque';
import Icone from '../Icone';
import { euros } from '../../prixPlat';

// « LE MÊME PLAT, TROIS PRIX » DANS LA BANNIÈRE (fondateur, 2026-10-26, version E de maquettes/croissance/prix-gonfles.html).
// Le titre de la bannière dit « Arrête de payer des prix gonflés. » ; cette carte en est la preuve : un vrai plat, relevé au
// comptoir et sur une grande plateforme le même jour, et ce qu'il coûte au plus sur Fairride. Le prix de la plateforme est
// en rouge, avec son écart, comme un avertissement (fondateur : « some red like warning »). Le rouge est --promo, le seul
// rouge vif du site ; ici il n'annonce pas une promo, il signale un prix gonflé.
//
// CE QUI REND LA CARTE LÉGALE — à relire avant de toucher un chiffre ou la ligne grise (docs/agents/voix.md, § 3).
// - Comparaison de prix avec « une grande plateforme » : publicité comparative (CDE art. VI.17). Elle doit être exacte et
//   VÉRIFIABLE : quand l'annonce ne donne pas les détails, elle dit où les obtenir (Cour de justice, Lidl Belgium contre
//   Colruyt, C-356/04, 2006). D'où « Détails sur demande » dans la ligne grise, et la question 9 de la FAQ de
//   /notre-histoire (story.faqQ9), qui dit comment on a mesuré et à qui écrire.
// - Le plat et le restaurant ne sont PAS nommés (fondateur, 2026-10-26) : un partenaire ne doit jamais être reconnaissable
//   à côté d'un prix gonflé. La date reste : sans elle, « +55 % » serait la seule phrase attaquable de la page.
// - Les chiffres : 15,00 € au comptoir et 23,25 € sur la plateforme, relevés le 23/10/2026 (preuves datées dans
//   l'espace de travail, jamais dans ce dépôt public). +55 % = 23,25 ÷ 15,00. « Au plus » sur Fairride = 15,00 + 10 %,
//   arrondi aux 10 cents inférieurs (hausseMaxPourcent et prixAvecHausse du backend) = 16,50 €.
// - À refaire chaque mois : un nouveau relevé, et la date de landing.prixReleve dans les trois langues.
// - Jamais « moins cher », jamais un total livraison comprise : on compare un plat, pas une commande.
const COMPTOIR = 15.0;
const PLATEFORME = 23.25;
const HAUSSE_MAX = 0.10;
const dixCentimesInferieurs = (v) => Math.floor(v * 10 + 1e-6) / 10;
const AU_PLUS = dixCentimesInferieurs(COMPTOIR * (1 + HAUSSE_MAX)); // 16,50 €
const ECART = Math.round((PLATEFORME / COMPTOIR - 1) * 100); // 55

export default function HeroPrix() {
  const { t } = useLanguage();
  const lignes = [
    { cle: 'comptoir', nom: t('landing.prixComptoirLigne'), prix: COMPTOIR },
    { cle: 'plateforme', nom: t('landing.prixPlateformeLigne'), prix: PLATEFORME, alerte: `+${ECART} %` },
    { cle: 'nous', nom: <AvecMarque>{t('landing.prixFairrideLigne')}</AvecMarque>, sous: t('landing.prixAuPlus'), prix: AU_PLUS }
  ];
  return (
    <section className="sa-prix sa-prix-trois" aria-label={t('landing.prixTroisAria', { ecart: ECART })}>
      <h2 className="sa-prix-titre">{t('landing.prixTroisTitre')}</h2>
      <p className="sa-prix-releve">{t('landing.prixReleve')}</p>
      <div className="sa-prix-rangs">
        {lignes.map((l) => (
          <div key={l.cle} className={`sa-prix-rang sa-prix-rang-${l.cle}`}>
            <span className="sa-prix-nom">
              <span>{l.nom}</span>
              {l.alerte && <span className="sa-prix-alerte"><Icone nom="alerte" taille={13} /> {l.alerte}</span>}
              {l.sous && <small>{l.sous}</small>}
            </span>
            <i aria-hidden="true"><b style={{ width: `${Math.round((l.prix / PLATEFORME) * 100)}%` }} /></i>
            <strong>{euros(l.prix)}</strong>
          </div>
        ))}
      </div>
      <p className="sa-prix-pied">{t('landing.prixPied')}</p>
    </section>
  );
}
