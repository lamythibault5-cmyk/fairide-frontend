import { useLanguage, getLocale } from '../context/LanguageContext';
import { datePremierPrelevement } from '../launch';
import TerminalFairide from './TerminalFairide';

// La promesse Fairide aux commerces, dite avec les mêmes mots partout (inscription, Mon compte) — modèle du fondateur,
// 2026-09-25 : UNE SEULE OFFRE (fondateur : « Fairide c'est la livraison et le service à emporter seulement ») — à emporter et
// livraison, 20 € HTVA par mois (premier mois offert) ; tout centralisé sur le TERMINAL FAIRIDE (offert aux 50 premiers, puis
// caution de 80 €) ; rien n'est prélevé tant que le commerce n'a pas activé lui-même l'abonnement. La réservation de table
// (ancienne version gratuite) a été retirée.
// L'ambiguïté « quand est-ce que je commence à payer ? » fait hésiter devant un modèle gratuit → payant : la date
// du premier prélèvement est donc donnée en clair, calculée comme côté serveur (voir launch.js).
//
// payant : à emporter ou livraison choisis. statut : statut de la formule complète (trialing, active…), finEssai :
// date de fin du mois offert ou du prochain prélèvement. onActiver : bouton d'activation (Mon compte).
export default function OffreFormules({ payant = false, statut = null, finEssai = null, onActiver = null, inscription = false }) {
  const { t } = useLanguage();
  const fmt = (d) => new Date(d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const essai = statut === 'trialing';
  const actif = statut === 'active';
  return (
    <div className="offre-formules">
      <div className="offre-colonnes">
        <div className="offre-col offre-col-choisie">
          <b>🛵 {t('accountUi.offre_completeTitle')}</b>
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
              : t('accountUi.offre_when3', { date: fmt(datePremierPrelevement()) })}</li>
        </ol>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('accountUi.offre_noCommitment')}</p>
      </div>
      {/* Le terminal : ce que c'est (image), comment ça marche, et à quelles conditions (offert aux 50 premiers avant le
          5 octobre, puis caution). */}
      <div className="offre-terminal"><TerminalFairide compact /></div>
      {inscription && payant && <p className="small offre-note">✅ {t('accountUi.offre_signupComplete')}</p>}
      {onActiver && payant && !essai && !actif && (
        <button type="button" className="btn-gold" style={{ marginTop: 10 }} onClick={onActiver}>{t('accountUi.offre_activateBtn')}</button>
      )}
    </div>
  );
}
