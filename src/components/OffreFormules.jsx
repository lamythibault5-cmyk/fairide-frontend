import GarantieAbonnement from './GarantieAbonnement';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { datePremierPrelevement, useLancement } from '../launch';
import TerminalFairide from './TerminalFairide';
import Icone from './Icone';

// La promesse Fairide aux commerces, dite avec les mêmes mots partout (inscription, Mon compte) — modèle du fondateur,
// 2026-09-25 : UNE SEULE OFFRE (fondateur : « Fairide c'est la livraison et le service à emporter seulement ») — à emporter et
// livraison, 20 € par mois — sans TVA, Fairide étant sous le régime de la franchise depuis le 7/9/2026 — (premier mois offert) ; tout centralisé sur le TERMINAL FAIRIDE (offert aux premiers inscrits, puis
// caution pour les suivants) ; rien n'est prélevé tant que le commerce n'a pas activé lui-même l'abonnement. La réservation de table
// (ancienne version gratuite) a été retirée.
// L'ambiguïté « quand est-ce que je commence à payer ? » fait hésiter devant un modèle gratuit → payant : la date
// du premier prélèvement est donc donnée en clair, calculée comme côté serveur (voir launch.js).
//
// payant : à emporter ou livraison choisis. statut : statut de la formule complète (trialing, active…), finEssai :
// date de fin du mois offert ou du prochain prélèvement. onActiver : bouton d'activation (Mon compte).
export default function OffreFormules({ payant = false, statut = null, finEssai = null, onActiver = null, inscription = false }) {
  const { t } = useLanguage();
  useLancement(); // redessine au GO : la date du premier prélèvement devient connue
  const premier = datePremierPrelevement();
  const fmt = (d) => new Date(d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const essai = statut === 'trialing';
  const actif = statut === 'active';
  return (
    <div className="offre-formules">
      <div className="offre-colonnes">
        <div className="offre-col offre-col-choisie">
          <b><Icone nom="velo" taille={16} className="icone-texte" />{' '}{t('accountUi.offre_completeTitle')}</b>
          <span className="offre-prix">{t('accountUi.offre_completePrice')}</span>
          <span className="small">{t('accountUi.offre_completeDetail')}</span>
        </div>
      </div>
      <div className="offre-quand">
        <b>{t('accountUi.offre_whenTitle')}</b>
        <ol className="small">
          <li>{t('accountUi.offre_when1')}</li>
          <li>{t('accountUi.offre_when2')}</li>
          <li>{essai && finEssai ? t('accountUi.offre_when3Trial', { date: fmt(finEssai) })
            : actif && finEssai ? t('accountUi.offre_when3Active', { date: fmt(finEssai) })
              : premier ? t('accountUi.offre_when3', { date: fmt(premier) }) : t('accountUi.offre_when3AvantGo')}</li>
        </ol>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('accountUi.offre_noCommitment')}</p>
      </div>
      {/* 50 € de commandes ou moins sur un mois = pas d’abonnement pour ce mois (offert ou remboursé). */}
      <GarantieAbonnement />
      {/* Le terminal : ce que c'est (image), comment ça marche, et à quelles conditions (offert aux 50 premiers avant le
          16 octobre, puis caution). */}
      {/* Pas pendant l'inscription (12 oct. 2026) : l'écran des services devait se lire d'un coup d'œil, et le terminal
          s'explique mieux une fois le commerce créé — il reste dans Mon compte (« Mon terminal Fairide »). */}
      {!inscription && <div className="offre-terminal"><TerminalFairide compact /></div>}
      {inscription && payant && <p className="small offre-note"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('accountUi.offre_signupComplete')}</p>}
      {onActiver && payant && !essai && !actif && (
        <button type="button" className="btn-gold" style={{ marginTop: 10 }} onClick={onActiver}>{t('accountUi.offre_activateBtn')}</button>
      )}
    </div>
  );
}
